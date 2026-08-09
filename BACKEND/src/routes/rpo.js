export default async function rpoRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const ensureRpoSchema = async () => {
    await pool.request().query(`
      IF COL_LENGTH('dbo.GWEN_t_rpo', 'tanggal_barang_datang') IS NULL
      BEGIN
        ALTER TABLE dbo.GWEN_t_rpo
        ADD tanggal_barang_datang DATE NULL;
      END
    `);
  };

  await ensureRpoSchema();

  const generateDocCode = async ({ prefix, userCode = "88", branchCode = "GW", padLength = 5, separator = "." }) => {
    const req = pool.request();
    req.input("Prefix", sql.VarChar(10), prefix);
    req.input("ExecDate", sql.Date, new Date());
    req.input("UserCode", sql.Char(2), userCode);
    req.input("BranchCode", sql.Char(2), branchCode);
    req.input("PadLength", sql.Int, padLength);
    req.input("Separator", sql.Char(1), separator);
    req.output("NextNo", sql.Int);
    req.output("GeneratedCode", sql.VarChar(50));
    const result = await req.execute("dbo.GWEN_GenerateDocCode");
    return result.output.GeneratedCode;
  };

  const clampPercent = (val) => {
    if (val === null || val === undefined || Number.isNaN(val)) return 0;
    if (val < 0) return 0;
    if (val > 100) return 100;
    return val;
  };

  const truncate = (val, max) => {
    if (val === undefined || val === null) return null;
    const str = String(val);
    return str.length > max ? str.slice(0, max) : str;
  };

  const calculateDiscountedTotal = ({ harga_beli = 0, qty = 0, disc_1 = 0, disc_2 = 0, disc_3 = 0 }) => {
    const gross = (Number(harga_beli) || 0) * (Number(qty) || 0);
    const d1 = clampPercent(Number(disc_1) || 0);
    const d2 = clampPercent(Number(disc_2) || 0);
    const d3 = clampPercent(Number(disc_3) || 0);
    const afterD1 = gross * (1 - d1 / 100);
    const afterD2 = afterD1 * (1 - d2 / 100);
    const afterD3 = afterD2 * (1 - d3 / 100);
    const net = Math.max(afterD3, 0);
    const diskon = gross - net;
    return { gross, net, diskon };
  };

  const computeTotals = (rows, ppnPersen = 0, isPpn = 0) => {
    const totals = rows.reduce(
      (acc, r) => {
        const qty = Number(r.qty ?? 0) || 0;
        const hargaBeli = Number(r.harga_beli ?? 0) || 0;
        const hargaNett = Number(r.harga_nett ?? 0) || 0;
        const gross = hargaBeli * qty;
        const net = hargaNett * qty;
        acc.total_barang += qty;
        acc.gross += gross;
        acc.net += net;
        return acc;
      },
      { total_barang: 0, gross: 0, net: 0 }
    );
    const total_diskon = totals.gross - totals.net;
    const total_ppn = isPpn ? (totals.net * (Number(ppnPersen) || 0)) / 100 : 0;
    const total_akhir = totals.net + total_ppn;
    return {
      total_barang: totals.total_barang,
      total_diskon,
      total_sebelum_ppn: totals.net,
      total_ppn,
      total_akhir,
    };
  };

  fastify.post("/draft", async (request, reply) => {
    const body = request.body || {};
    const {
      kode_t_rpo: kode_t_rpo_body,
      kode_rpo, // fallback nama lama
      tgl,
      deadline,
      request_pengiriman_dari = null,
      request_pengiriman_sampai = null,
      kode_gudang_asal = "GUD.27012099GW001",
      kode_supplier,
      catatan_header = null,
      is_ppn = 0,
      ppn_persen = 11.0,
      total_barang: total_barang_body = 0,
      total_diskon: total_diskon_body = 0,
      total_sebelum_ppn: total_sebelum_ppn_body = 0,
      total_ppn = 0,
      total_akhir: total_akhir_body = 0,
      wa_notif_number = null,
      wa_notif_contact_id = null,
      wa_notif_status = "PENDING",
      items = [],
      created_by = "Admin",
      is_validasi_gudang = 0,
    } = body;

    const kode_t_rpo = String(kode_t_rpo_body || kode_rpo || "").trim();

    if (!kode_t_rpo || !tgl || !kode_supplier || !Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ message: "kode_t_rpo, tgl, kode_supplier, items wajib diisi" });
    }

    const now = new Date();
    const tx = new sql.Transaction(pool);
    try {
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

      // cek header eksisting
      const checkHeader = await new sql.Request(tx)
        .input("kode_t_rpo", sql.VarChar(30), kode_t_rpo)
        .query("SELECT 1 FROM dbo.GWEN_t_rpo WHERE kode_t_rpo = @kode_t_rpo");

      const headerReq = new sql.Request(tx);
      headerReq.input("kode_t_rpo", sql.VarChar(30), kode_t_rpo);
      headerReq.input("tgl", sql.Date, new Date(tgl));
      headerReq.input("deadline", sql.Date, deadline ? new Date(deadline) : null);
      headerReq.input("request_pengiriman_dari", sql.Date, request_pengiriman_dari ? new Date(request_pengiriman_dari) : null);
      headerReq.input(
        "request_pengiriman_sampai",
        sql.Date,
        request_pengiriman_sampai ? new Date(request_pengiriman_sampai) : null
      );
      headerReq.input("kode_gudang_asal", sql.VarChar(30), kode_gudang_asal);
      headerReq.input("kode_supplier", sql.VarChar(30), kode_supplier);
      headerReq.input("catatan_header", sql.NVarChar(1000), truncate(catatan_header, 1000));
      headerReq.input("is_ppn", sql.Bit, is_ppn ? 1 : 0);
      headerReq.input("ppn_persen", sql.Decimal(5, 2), ppn_persen ?? 0);
      headerReq.input("status_rpo", sql.VarChar(20), "DRAFT");
      headerReq.input("wa_notif_number", sql.VarChar(30), truncate(wa_notif_number, 30));
      headerReq.input("wa_notif_contact_id", sql.BigInt, wa_notif_contact_id || null);
      headerReq.input("created_by", sql.VarChar(50), created_by);
      headerReq.input("created_at", sql.DateTime2, now);
      headerReq.input("updated_by", sql.VarChar(50), created_by);
      headerReq.input("updated_at", sql.DateTime2, now);
      headerReq.input("wa_notif_status", sql.VarChar(20), wa_notif_status || "PENDING");
      headerReq.input("wa_notif_sent_at", sql.DateTime2, null);
      headerReq.input("wa_notif_last_error", sql.NVarChar(500), null);
      headerReq.input("is_active", sql.Bit, 1);
      headerReq.input("is_validasi_gudang", sql.Bit, is_validasi_gudang ? 1 : 0);

      // cache varian untuk mempercepat lookup
      const variantCache = new Map();
      const resolveVariantInfo = async ({ kodeBarangVariant, kodeBarang, kodeVarian }) => {
        const cacheKey = `${kodeBarangVariant || "-"}|${kodeBarang || "-"}|${kodeVarian || "-"}`;
        if (variantCache.has(cacheKey)) return variantCache.get(cacheKey);

        const req = pool.request();
        let whereClause = "";
        if (kodeBarangVariant) {
          req.input("kode_barang_variant", sql.VarChar(100), kodeBarangVariant);
          whereClause = "v.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT";
        } else if (kodeVarian) {
          req.input("kode_barang", sql.VarChar(100), kodeBarang || "");
          req.input("kode_varian", sql.VarChar(100), kodeVarian || "");
          whereClause = `
            b.kode_barang COLLATE DATABASE_DEFAULT = @kode_barang COLLATE DATABASE_DEFAULT
            AND v.kode_varian COLLATE DATABASE_DEFAULT = @kode_varian COLLATE DATABASE_DEFAULT
          `;
        } else {
          req.input("kode_barang", sql.VarChar(100), kodeBarang || "");
          whereClause = `
            b.kode_barang COLLATE DATABASE_DEFAULT = @kode_barang COLLATE DATABASE_DEFAULT
            AND (v.is_base = 1 OR v.kode_varian COLLATE DATABASE_DEFAULT = 'BASE')
          `;
        }

        const res = await req.query(`
          SELECT TOP 1
            v.kode_barang_variant,
            v.kode_varian
          FROM dbo.m_barang_varian v
          JOIN dbo.m_barang b ON b.id_barang = v.id_barang
          WHERE ${whereClause}
          ORDER BY v.is_base DESC
        `);

        const record = res.recordset?.[0] || {};
        const value = {
          kode_barang_variant: record.kode_barang_variant || kodeBarangVariant || null,
          kode_varian: record.kode_varian || kodeVarian || null,
        };
        variantCache.set(cacheKey, value);
        return value;
      };

      // normalisasi item + hitung ulang total berdasarkan diskon bertingkat
      const normalizedItems = [];
      for (const raw of items) {
        const kodeBarangKey = raw.kode_barang || "";
        const kodeVarianInput = raw.kode_varian || raw.kodeVarian || (raw.id_varian ? String(raw.id_varian) : null);
        const qtyVal = Number(raw.qty ?? raw.qtyOrder ?? 0) || 0;
        const hargaBeliVal = Number(raw.harga_beli ?? raw.hargaBeli ?? 0) || 0;
        const hetVal = Number(raw.het ?? raw.hargaHET ?? raw.harga_het ?? 0) || 0;
        const disc1Val = clampPercent(Number(raw.disc_1 ?? raw.disc1 ?? 0) || 0);
        const disc2Val = clampPercent(Number(raw.disc_2 ?? raw.disc2 ?? 0) || 0);
        const disc3Val = clampPercent(Number(raw.disc_3 ?? raw.disc3 ?? 0) || 0);
        const kodeBarangVariantRaw = raw.kode_barang_variant || raw.kodeBarangVariant || null;
        const { kode_barang_variant: kodeBarangVariantResolved, kode_varian: kodeVarianResolved } =
          await resolveVariantInfo({
            kodeBarangVariant: kodeBarangVariantRaw,
            kodeBarang: kodeBarangKey,
            kodeVarian: kodeVarianInput,
          });
        const finalKodeBarangVariant = kodeBarangVariantResolved || kodeBarangVariantRaw || null;
        const finalKodeVarian = String(kodeVarianResolved || kodeVarianInput || "BASE").trim() || "BASE";
        const { net, gross } = calculateDiscountedTotal({
          harga_beli: hargaBeliVal,
          qty: qtyVal,
          disc_1: disc1Val,
          disc_2: disc2Val,
          disc_3: disc3Val,
        });
        const subtotalVal = Number(raw.subtotal ?? net ?? 0) || 0;
        const kodeBarangFinal = String(kodeBarangKey || "").trim();
        const kodeBarangVariantFinal = finalKodeBarangVariant === null ? null : String(finalKodeBarangVariant).trim();
        const normalized = {
          ...raw,
          kode_barang: kodeBarangFinal,
          kode_varian: finalKodeVarian,
          kode_barang_variant: kodeBarangVariantFinal,
          qty: qtyVal,
          satuan: raw.satuan || raw.unit || "PCS",
          harga_beli: hargaBeliVal,
          het: hetVal,
          disc_1: disc1Val,
          disc_2: disc2Val,
          disc_3: disc3Val,
          subtotal: subtotalVal,
          gross_total: gross,
          status_harga: raw.status_harga || raw.statusHarga || null,
          harga_beli_terakhir: raw.harga_beli_terakhir ?? raw.lastHargaBeli ?? null,
          stok_pusat_snapshot: raw.stok_pusat_snapshot ?? raw.stok ?? null,
          buffer_snapshot: raw.buffer_snapshot ?? raw.buffer ?? null,
          catatan: truncate(raw.catatan, 500),
        };
        normalizedItems.push(normalized);
      }

      let totalBarangCalc = 0;
      let totalDiskonCalc = 0;
      let totalNetCalc = 0;
      for (const it of normalizedItems) {
        const { gross, net } = calculateDiscountedTotal(it);
        totalBarangCalc += Number(it.qty ?? 0);
        totalDiskonCalc += gross - net;
        totalNetCalc += it.subtotal ?? net ?? 0;
      }

      const totalBarangFinal = totalBarangCalc || total_barang_body || 0;
      const totalDiskonFinal = totalDiskonCalc || total_diskon_body || 0;
      const totalSebelumPpnFinal = totalNetCalc || total_sebelum_ppn_body || 0;
      const totalAkhirFinal = totalNetCalc || total_akhir_body || 0;

      headerReq.input("total_barang", sql.Decimal(18, 2), totalBarangFinal);
      headerReq.input("total_diskon", sql.Decimal(18, 2), totalDiskonFinal);
      headerReq.input("total_sebelum_ppn", sql.Decimal(18, 2), totalSebelumPpnFinal);
      headerReq.input("total_ppn", sql.Decimal(18, 2), total_ppn ?? 0);
      headerReq.input("total_akhir", sql.Decimal(18, 2), totalAkhirFinal);

      if (checkHeader.recordset?.length) {
        // update header jika sudah ada
        await headerReq.query(`
          UPDATE dbo.GWEN_t_rpo
          SET
            tgl = @tgl,
            deadline = @deadline,
            request_pengiriman_dari = @request_pengiriman_dari,
            request_pengiriman_sampai = @request_pengiriman_sampai,
            kode_gudang_asal = @kode_gudang_asal,
            kode_supplier = @kode_supplier,
            catatan_header = @catatan_header,
            is_ppn = @is_ppn,
            ppn_persen = @ppn_persen,
            total_barang = @total_barang,
            total_diskon = @total_diskon,
            total_sebelum_ppn = @total_sebelum_ppn,
            total_ppn = @total_ppn,
            total_akhir = @total_akhir,
            status_rpo = @status_rpo,
            wa_notif_number = @wa_notif_number,
            wa_notif_contact_id = @wa_notif_contact_id,
            updated_by = @updated_by,
            updated_at = @updated_at,
            wa_notif_status = @wa_notif_status,
            wa_notif_sent_at = @wa_notif_sent_at,
            wa_notif_last_error = @wa_notif_last_error,
            is_active = @is_active,
            is_validasi_gudang = @is_validasi_gudang
          WHERE kode_t_rpo = @kode_t_rpo;
        `);

      } else {
        await headerReq.query(`
          INSERT INTO dbo.GWEN_t_rpo (
            kode_t_rpo, tgl, deadline, request_pengiriman_dari, request_pengiriman_sampai, kode_gudang_asal, kode_supplier, catatan_header, is_ppn, ppn_persen,
            total_barang, total_diskon, total_sebelum_ppn, total_ppn, total_akhir, status_rpo,
            wa_notif_number, wa_notif_contact_id, created_by, created_at, updated_by, updated_at, is_active, is_validasi_gudang,
            wa_notif_status, wa_notif_sent_at, wa_notif_last_error
          )
          VALUES (
            @kode_t_rpo, @tgl, @deadline, @request_pengiriman_dari, @request_pengiriman_sampai, @kode_gudang_asal, @kode_supplier, @catatan_header, @is_ppn, @ppn_persen,
            @total_barang, @total_diskon, @total_sebelum_ppn, @total_ppn, @total_akhir, @status_rpo,
            @wa_notif_number, @wa_notif_contact_id, @created_by, @created_at, @updated_by, @updated_at, @is_active, @is_validasi_gudang,
            @wa_notif_status, @wa_notif_sent_at, @wa_notif_last_error
          );
        `);
      }

      await new sql.Request(tx)
        .input("kode_t_rpo", sql.VarChar(30), kode_t_rpo)
        .query("DELETE FROM dbo.GWEN_d_rpo WHERE kode_t_rpo = @kode_t_rpo;");

      let urut = 1;
      for (const it of normalizedItems) {
        let kode_d_rpo;
        try {
          kode_d_rpo = await generateDocCode({
            prefix: "DPO",
            userCode: "88",
            branchCode: "GW",
            padLength: 5,
            separator: ".",
          });
        } catch (genErr) {
          // fallback jika SP gagal
          kode_d_rpo = `DPO.${String(urut).padStart(6, "0")}`;
        }
        urut += 1;
        const detailReq = new sql.Request(tx);
        detailReq.input("kode_d_rpo", sql.VarChar(40), kode_d_rpo);
        detailReq.input("kode_t_rpo", sql.VarChar(30), kode_t_rpo);
        detailReq.input("kode_barang", sql.VarChar(30), it.kode_barang || "");
        detailReq.input("kode_varian", sql.VarChar(50), it.kode_varian || null);
        detailReq.input("kode_barang_variant", sql.VarChar(50), it.kode_barang_variant || null);
        detailReq.input("qty", sql.Decimal(18, 4), it.qty ?? 0);
        detailReq.input("satuan", sql.VarChar(20), it.satuan || "PCS");
        detailReq.input("harga_beli", sql.Decimal(18, 2), it.harga_beli ?? 0);
        detailReq.input("het", sql.Decimal(18, 2), it.het ?? 0);
        detailReq.input("disc_1", sql.Decimal(5, 2), it.disc_1 ?? 0);
        detailReq.input("disc_2", sql.Decimal(5, 2), it.disc_2 ?? 0);
        detailReq.input("disc_3", sql.Decimal(5, 2), it.disc_3 ?? 0);
        const hargaNettVal = Number(it.qty ?? 0) ? Number(it.subtotal ?? 0) / Number(it.qty ?? 1) : 0;
        detailReq.input("harga_nett", sql.Decimal(18, 2), hargaNettVal || 0);
        detailReq.input("catatan", sql.NVarChar(500), it.catatan || null);
        detailReq.input("harga_beli_terakhir", sql.Decimal(18, 2), it.harga_beli_terakhir ?? null);
        detailReq.input("stok_pusat_snapshot", sql.Decimal(18, 4), it.stok_pusat_snapshot ?? null);
        detailReq.input("buffer_snapshot", sql.Decimal(18, 4), it.buffer_snapshot ?? null);
        detailReq.input("is_active", sql.Bit, 1);
        detailReq.input("created_by", sql.VarChar(50), created_by);
        detailReq.input("created_at", sql.DateTime2, now);
        detailReq.input("updated_by", sql.VarChar(50), created_by);
        detailReq.input("updated_at", sql.DateTime2, now);

        await detailReq.query(`
          INSERT INTO dbo.GWEN_d_rpo (
            kode_d_rpo, kode_t_rpo, kode_barang, kode_varian, kode_barang_variant, qty, satuan, harga_beli, het, disc_1, disc_2, disc_3, harga_nett, catatan,
            harga_beli_terakhir, stok_pusat_snapshot, buffer_snapshot, is_active,
            created_by, created_at, updated_by, updated_at
          )
          VALUES (
            @kode_d_rpo, @kode_t_rpo, @kode_barang, @kode_varian, @kode_barang_variant, @qty, @satuan, @harga_beli, @het, @disc_1, @disc_2, @disc_3, @harga_nett, @catatan,
            @harga_beli_terakhir, @stok_pusat_snapshot, @buffer_snapshot, @is_active,
            @created_by, @created_at, @updated_by, @updated_at
          );
        `);
      }

      await tx.commit();
      return reply.code(201).send({ message: "Draft RPO tersimpan", kode_t_rpo });
    } catch (err) {
      await tx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed to save RPO draft");
      return reply.code(500).send({ message: "Gagal menyimpan draft RPO" });
    }
  });

  fastify.get("/", async (_request, reply) => {
    try {
      const res = await pool
        .request()
        .query(`
          SELECT 
            t.kode_t_rpo,
            t.tgl,
            t.deadline,
            t.tanggal_barang_datang,
            t.request_pengiriman_dari,
            t.request_pengiriman_sampai,
            t.kode_supplier,
            s.nama AS supplier_nama,
            STUFF((
              SELECT DISTINCT ', ' + merk_list.merk_name
              FROM dbo.GWEN_d_rpo d2
              JOIN dbo.m_barang b2
                ON b2.kode_barang COLLATE DATABASE_DEFAULT = d2.kode_barang COLLATE DATABASE_DEFAULT
              OUTER APPLY (
                SELECT CASE WHEN ISNUMERIC(b2.kode_merk) = 1 THEN CAST(b2.kode_merk AS INT) END AS kode_merk_int
              ) mapm2
              LEFT JOIN dbo.m_merk mm2 ON mm2.id_merk = mapm2.kode_merk_int
              CROSS APPLY (
                SELECT COALESCE(NULLIF(mm2.nama_merk, ''), NULLIF(b2.kode_merk, '')) AS merk_name
              ) merk_list
              WHERE d2.kode_t_rpo = t.kode_t_rpo
                AND merk_list.merk_name IS NOT NULL
              FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS merk_list,
            t.kode_gudang_asal,
            t.status_rpo,
            t.is_active,
            t.is_validasi_gudang,
            t.validasi_gudang_by,
            t.validasi_gudang_at,
            t.kode_lpb,
            t.kode_t_po,
            t.is_rilis,
            t.total_barang,
            t.total_diskon,
            t.total_sebelum_ppn,
            t.total_ppn,
            t.total_akhir,
            t.wa_notif_number,
            t.created_at,
            t.updated_at,
            ISNULL(item_counts.total_item, 0) AS total_item
          FROM dbo.GWEN_t_rpo t
          OUTER APPLY (
            SELECT COUNT(1) AS total_item
            FROM dbo.GWEN_d_rpo d
            WHERE d.kode_t_rpo = t.kode_t_rpo
          ) item_counts
          LEFT JOIN dbo.m_supplier s 
            ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
          ORDER BY t.created_at DESC
        `);
      return reply.send(res.recordset || []);
    } catch (err) {
      _request.log.error({ err }, "Failed to fetch RPO list");
      return reply.code(500).send({ message: "Gagal memuat daftar RPO", detail: err?.message });
    }
  });

  fastify.get("/:kode/pdf", async (request, reply) => {
    const { kode } = request.params;
    const orientation = String(request.query?.orientation || "").toLowerCase();
    const landscape = orientation !== "portrait";
    if (!kode) return reply.code(400).send({ message: "kode_t_rpo wajib diisi" });

    const webBase = process.env.WEB_BASE_URL || "http://localhost:3000";
    const targetUrl = `${webBase}/admin/purchasing/permintaan-pengadaan/preview?kode=${encodeURIComponent(
      kode
    )}&print=1&orientation=${landscape ? "landscape" : "portrait"}`;

    let browser;
    let puppeteer;
    try {
      try {
        ({ default: puppeteer } = await import("puppeteer"));
      } catch (importErr) {
        fastify.log.error({ err: importErr }, "Puppeteer not installed");
        return reply.code(500).send({ message: "Puppeteer belum terpasang. Jalankan npm install puppeteer di BACKEND." });
      }
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
      browser = await puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath,
      });
      const page = await browser.newPage();
      await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 60000 });
      await page.waitForSelector(".print-page", { timeout: 20000 });
      await page.emulateMediaType("print");
      const pdfBuffer = await page.pdf({
        format: "A4",
        landscape,
        printBackground: true,
        preferCSSPageSize: true,
      });
      await browser.close();
      browser = null;

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename=\"RPO-${kode}.pdf\"`);
      return reply.send(pdfBuffer);
    } catch (err) {
      if (browser) {
        try {
          await browser.close();
        } catch {
          // ignore close errors
        }
      }
      fastify.log.error({ err }, "Failed generate RPO PDF");
      return reply.code(500).send({ message: "Gagal membuat PDF RPO" });
    }
  });

  fastify.get("/:kode", async (request, reply) => {
    const { kode } = request.params;
    if (!kode) return reply.code(400).send({ message: "kode wajib diisi" });
    try {
      const headerRes = await pool
        .request()
        .input("kode_t_rpo", sql.VarChar(30), kode.trim())
        .query(`
          SELECT 
            t.kode_t_rpo,
            t.tgl,
            t.deadline,
            t.tanggal_barang_datang,
            t.kode_supplier,
            s.nama AS supplier_nama,
            t.kode_gudang_asal,
            t.status_rpo,
            t.approved_by,
            t.approved_at,
            t.is_validasi_gudang,
            t.validasi_gudang_by,
            t.validasi_gudang_at,
            t.kode_lpb,
            t.kode_t_po,
            t.is_rilis,
            t.rilis_by,
            t.rilis_at,
            t.total_barang,
            t.total_diskon,
            t.total_sebelum_ppn,
            t.total_ppn,
            t.total_akhir,
            t.wa_notif_number,
            t.created_by,
            t.created_at,
            t.updated_at
          FROM dbo.GWEN_t_rpo t
          LEFT JOIN dbo.m_supplier s 
            ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
          WHERE RTRIM(LTRIM(t.kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
            AND t.is_active = 1
        `);
      if (!headerRes.recordset?.length) {
        return reply.code(404).send({ message: "RPO tidak ditemukan" });
      }

      await pool
        .request()
        .input("kode_t_rpo", sql.VarChar(30), kode.trim())
        .query(`
          UPDATE d
          SET nama_varian = v.nama_varian
          FROM dbo.GWEN_d_rpo d
          JOIN dbo.m_barang_varian v
            ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT
          WHERE RTRIM(LTRIM(d.kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
            AND d.is_active = 1
            AND (d.nama_varian IS NULL OR LTRIM(RTRIM(d.nama_varian)) = '')
        `);

      const detailRes = await pool
        .request()
        .input("kode_t_rpo", sql.VarChar(30), kode.trim())
        .query(`
          SELECT 
            d.kode_d_rpo,
            d.kode_t_rpo,
            d.kode_barang,
            d.kode_varian,
            d.kode_barang_variant,
            d.qty,
            d.qty_diterima,
            d.satuan,
            d.harga_beli,
            d.het,
            d.disc_1,
            d.disc_2,
            d.disc_3,
            d.harga_nett,
            d.catatan,
            d.harga_beli_terakhir,
            d.status_harga,
            d.stok_pusat_snapshot,
            d.buffer_snapshot,
            COALESCE(v.nama_varian, d.nama_varian, d.kode_varian, d.kode_barang_variant) AS barang_nama,
            COALESCE(b.nama, b2.nama, d.kode_barang) AS barang_nama_master,
            COALESCE(v.nama_varian, d.nama_varian, d.kode_varian, d.kode_barang_variant) AS nama_varian,
            v.barcode_varian,
            v.is_aktif AS status_varian,
            COALESCE(b.barcode_global, b2.barcode_global) AS barcode_global
          FROM dbo.GWEN_d_rpo d
          OUTER APPLY (
            SELECT TOP 1 mv.*
            FROM dbo.m_barang_varian mv
            WHERE mv.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT
              OR (
                d.kode_varian IS NOT NULL
                AND mv.kode_varian COLLATE DATABASE_DEFAULT = d.kode_varian COLLATE DATABASE_DEFAULT
              )
            ORDER BY CASE
              WHEN mv.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT THEN 0
              ELSE 1
            END
          ) v
          LEFT JOIN dbo.m_barang b 
            ON b.id_barang = v.id_barang
          LEFT JOIN dbo.m_barang b2
            ON b2.kode_barang COLLATE DATABASE_DEFAULT = d.kode_barang COLLATE DATABASE_DEFAULT
          WHERE RTRIM(LTRIM(d.kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
            AND d.is_active = 1
          ORDER BY d.created_at ASC, d.kode_d_rpo ASC
        `);

      const expiredRes = await pool
        .request()
        .input("kode_t_rpo", sql.VarChar(30), kode.trim())
        .query(`
          SELECT kode_barang_variant, expired_date
          FROM dbo.GWEN_d_rpo_expired
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
        `);

      const expiredMap = new Map();
      (expiredRes.recordset || []).forEach((row) => {
        const key = String(row.kode_barang_variant || "").trim();
        if (!key) return;
        if (!expiredMap.has(key)) expiredMap.set(key, []);
        expiredMap.get(key).push(String(row.expired_date).slice(0, 10));
      });

      const items = (detailRes.recordset || []).filter(
        (it) => (it.kode_t_rpo || "").trim() === (kode || "").trim()
      );

      const itemsWithExpired = items.map((it) => ({
        ...it,
        expired_dates: expiredMap.get(String(it.kode_barang_variant || "").trim()) || [],
      }));

      return reply.send({ header: headerRes.recordset[0], items: itemsWithExpired });
    } catch (err) {
      request.log.error({ err }, "Failed to fetch RPO detail");
      return reply.code(500).send({ message: "Gagal memuat detail RPO" });
    }
  });

  fastify.post("/:kode/move", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodeList = Array.isArray(body.kode_d_rpo_list) ? body.kode_d_rpo_list : [];
    const createdBy = String(body.created_by || "Admin").trim();
    if (!kode || kodeList.length === 0) {
      return reply.code(400).send({ message: "kode_t_rpo dan kode_d_rpo_list wajib diisi" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

      const headerRes = await new sql.Request(tx)
        .input("kode_t_rpo", sql.VarChar(30), kode.trim())
        .query(`SELECT TOP 1 * FROM dbo.GWEN_t_rpo WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))`);
      const header = headerRes.recordset?.[0];
      if (!header) {
        await tx.rollback();
        return reply.code(404).send({ message: "RPO tidak ditemukan" });
      }

      const newKode = await generateDocCode({ prefix: "RPO" });

      const listParams = kodeList
        .map((_, idx) => `@kode_${idx}`)
        .join(", ");
      const detailReq = new sql.Request(tx);
      detailReq.input("kode_t_rpo", sql.VarChar(30), kode.trim());
      kodeList.forEach((val, idx) => {
        detailReq.input(`kode_${idx}`, sql.VarChar(40), String(val));
      });
      const detailRes = await detailReq.query(`
        SELECT * FROM dbo.GWEN_d_rpo
        WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
          AND kode_d_rpo IN (${listParams});
      `);
      const movedRows = detailRes.recordset || [];
      if (movedRows.length === 0) {
        await tx.rollback();
        return reply.code(404).send({ message: "Detail RPO tidak ditemukan" });
      }

      const totalsNew = computeTotals(movedRows, header.ppn_persen ?? 0, header.is_ppn ?? 0);

      const insertHeader = new sql.Request(tx);
      insertHeader.input("kode_t_rpo", sql.VarChar(30), newKode);
      insertHeader.input("tgl", sql.Date, header.tgl || new Date());
      insertHeader.input("deadline", sql.Date, header.deadline || null);
      insertHeader.input("request_pengiriman_dari", sql.Date, header.request_pengiriman_dari || null);
      insertHeader.input("request_pengiriman_sampai", sql.Date, header.request_pengiriman_sampai || null);
      insertHeader.input("kode_gudang_asal", sql.VarChar(30), header.kode_gudang_asal || null);
      insertHeader.input("kode_supplier", sql.VarChar(30), header.kode_supplier || null);
      insertHeader.input("catatan_header", sql.NVarChar(1000), header.catatan_header || null);
      insertHeader.input("is_ppn", sql.Bit, header.is_ppn ? 1 : 0);
      insertHeader.input("ppn_persen", sql.Decimal(5, 2), header.ppn_persen ?? 0);
      insertHeader.input("status_rpo", sql.VarChar(20), "DRAFT");
      insertHeader.input("wa_notif_number", sql.VarChar(30), null);
      insertHeader.input("wa_notif_contact_id", sql.BigInt, null);
      insertHeader.input("created_by", sql.VarChar(50), createdBy);
      insertHeader.input("created_at", sql.DateTime2, new Date());
      insertHeader.input("updated_by", sql.VarChar(50), createdBy);
      insertHeader.input("updated_at", sql.DateTime2, new Date());
      insertHeader.input("wa_notif_status", sql.VarChar(20), "PENDING");
      insertHeader.input("wa_notif_sent_at", sql.DateTime2, null);
      insertHeader.input("wa_notif_last_error", sql.NVarChar(500), null);
      insertHeader.input("is_active", sql.Bit, 1);
      insertHeader.input("is_validasi_gudang", sql.Bit, header.is_validasi_gudang ? 1 : 0);
      insertHeader.input("total_barang", sql.Decimal(18, 2), totalsNew.total_barang);
      insertHeader.input("total_diskon", sql.Decimal(18, 2), totalsNew.total_diskon);
      insertHeader.input("total_sebelum_ppn", sql.Decimal(18, 2), totalsNew.total_sebelum_ppn);
      insertHeader.input("total_ppn", sql.Decimal(18, 2), totalsNew.total_ppn);
      insertHeader.input("total_akhir", sql.Decimal(18, 2), totalsNew.total_akhir);
      await insertHeader.query(`
        INSERT INTO dbo.GWEN_t_rpo (
          kode_t_rpo, tgl, deadline, request_pengiriman_dari, request_pengiriman_sampai, kode_gudang_asal, kode_supplier, catatan_header, is_ppn, ppn_persen,
          total_barang, total_diskon, total_sebelum_ppn, total_ppn, total_akhir, status_rpo,
          wa_notif_number, wa_notif_contact_id, created_by, created_at, updated_by, updated_at, is_active, is_validasi_gudang,
          wa_notif_status, wa_notif_sent_at, wa_notif_last_error
        )
        VALUES (
          @kode_t_rpo, @tgl, @deadline, @request_pengiriman_dari, @request_pengiriman_sampai, @kode_gudang_asal, @kode_supplier, @catatan_header, @is_ppn, @ppn_persen,
          @total_barang, @total_diskon, @total_sebelum_ppn, @total_ppn, @total_akhir, @status_rpo,
          @wa_notif_number, @wa_notif_contact_id, @created_by, @created_at, @updated_by, @updated_at, @is_active, @is_validasi_gudang,
          @wa_notif_status, @wa_notif_sent_at, @wa_notif_last_error
        );
      `);

      const moveReq = new sql.Request(tx);
      moveReq.input("kode_t_rpo_old", sql.VarChar(30), kode.trim());
      moveReq.input("kode_t_rpo_new", sql.VarChar(30), newKode);
      moveReq.input("updated_by", sql.VarChar(50), createdBy);
      moveReq.input("updated_at", sql.DateTime2, new Date());
      kodeList.forEach((val, idx) => {
        moveReq.input(`kode_${idx}`, sql.VarChar(40), String(val));
      });
      await moveReq.query(`
        UPDATE dbo.GWEN_d_rpo
        SET kode_t_rpo = @kode_t_rpo_new,
            updated_by = @updated_by,
            updated_at = @updated_at
        WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo_old))
          AND kode_d_rpo IN (${listParams});
      `);

      const kodeBarangVariantList = movedRows
        .map((r) => String(r.kode_barang_variant || "").trim())
        .filter((v) => v);
      if (kodeBarangVariantList.length > 0) {
        const expReq = new sql.Request(tx);
        expReq.input("kode_t_rpo_old", sql.VarChar(30), kode.trim());
        expReq.input("kode_t_rpo_new", sql.VarChar(30), newKode);
        kodeBarangVariantList.forEach((val, idx) => {
          expReq.input(`kbv_${idx}`, sql.VarChar(50), val);
        });
        const expListParams = kodeBarangVariantList.map((_, idx) => `@kbv_${idx}`).join(", ");
        await expReq.query(`
          UPDATE dbo.GWEN_d_rpo_expired
          SET kode_t_rpo = @kode_t_rpo_new
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo_old))
            AND kode_barang_variant IN (${expListParams});
        `);
      }

      const remainRes = await new sql.Request(tx)
        .input("kode_t_rpo", sql.VarChar(30), kode.trim())
        .query(`SELECT * FROM dbo.GWEN_d_rpo WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo)) AND is_active = 1`);
      const remainTotals = computeTotals(remainRes.recordset || [], header.ppn_persen ?? 0, header.is_ppn ?? 0);
      await new sql.Request(tx)
        .input("kode_t_rpo", sql.VarChar(30), kode.trim())
        .input("total_barang", sql.Decimal(18, 2), remainTotals.total_barang)
        .input("total_diskon", sql.Decimal(18, 2), remainTotals.total_diskon)
        .input("total_sebelum_ppn", sql.Decimal(18, 2), remainTotals.total_sebelum_ppn)
        .input("total_ppn", sql.Decimal(18, 2), remainTotals.total_ppn)
        .input("total_akhir", sql.Decimal(18, 2), remainTotals.total_akhir)
        .input("updated_by", sql.VarChar(50), createdBy)
        .input("updated_at", sql.DateTime2, new Date())
        .query(`
          UPDATE dbo.GWEN_t_rpo
          SET total_barang = @total_barang,
              total_diskon = @total_diskon,
              total_sebelum_ppn = @total_sebelum_ppn,
              total_ppn = @total_ppn,
              total_akhir = @total_akhir,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo));
        `);

      await tx.commit();
      return reply.send({ message: "Items moved", kode_t_rpo: newKode });
    } catch (err) {
      await tx.rollback().catch(() => {});
      request.log.error({ err }, "Failed to move RPO items");
      return reply.code(500).send({ message: "Gagal memindahkan item RPO" });
    }
  });

  fastify.put("/:kode/received-qty", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodeDRpo = String(body.kode_d_rpo || "").trim();
    const qtyDiterima = Number(body.qty_diterima ?? 0);
    const updatedBy = String(body.updated_by || "Admin").trim();

    if (!kode || !kodeDRpo) {
      return reply.code(400).send({ message: "kode_t_rpo dan kode_d_rpo wajib diisi" });
    }

    if (Number.isNaN(qtyDiterima) || qtyDiterima < 0) {
      return reply.code(400).send({ message: "qty_diterima tidak valid" });
    }

    try {
      const res = await pool
        .request()
        .input("kode_t_rpo", sql.VarChar(30), kode.trim())
        .input("kode_d_rpo", sql.VarChar(40), kodeDRpo)
        .input("qty_diterima", sql.Int, Math.floor(qtyDiterima))
        .input("updated_by", sql.VarChar(100), updatedBy)
        .input("updated_at", sql.DateTime2, new Date())
        .query(`
          UPDATE dbo.GWEN_d_rpo
          SET qty_diterima = @qty_diterima,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
            AND RTRIM(LTRIM(kode_d_rpo)) = RTRIM(LTRIM(@kode_d_rpo))
            AND is_active = 1;
        `);
      if (res.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Detail RPO tidak ditemukan" });
      }
      return reply.send({ message: "Qty diterima updated" });
    } catch (err) {
      request.log.error({ err }, "Failed to update qty diterima");
      return reply.code(500).send({ message: "Gagal update qty diterima" });
    }
  });

  fastify.put("/:kode/expired", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodeBarangVariant = String(body.kode_barang_variant || "").trim();
    const expiredDates = Array.isArray(body.expired_dates) ? body.expired_dates : [];

    if (!kode || !kodeBarangVariant) {
      return reply.code(400).send({ message: "kode_t_rpo dan kode_barang_variant wajib diisi" });
    }

    const normalizedDates = Array.from(
      new Set(
        expiredDates
          .map((d) => String(d || "").slice(0, 10))
          .filter((d) => d && !Number.isNaN(new Date(d).getTime()))
      )
    );

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
      await new sql.Request(tx)
        .input("kode_t_rpo", sql.VarChar(30), kode.trim())
        .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
        .query(`
          DELETE FROM dbo.GWEN_d_rpo_expired
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
            AND RTRIM(LTRIM(kode_barang_variant)) = RTRIM(LTRIM(@kode_barang_variant));
        `);

      for (const dateStr of normalizedDates) {
        await new sql.Request(tx)
          .input("kode_t_rpo", sql.VarChar(30), kode.trim())
          .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
          .input("expired_date", sql.Date, new Date(dateStr))
          .query(`
            INSERT INTO dbo.GWEN_d_rpo_expired (kode_t_rpo, kode_barang_variant, expired_date)
            VALUES (@kode_t_rpo, @kode_barang_variant, @expired_date);
          `);
      }

      await tx.commit();
      return reply.send({ message: "Expired dates updated" });
    } catch (err) {
      await tx.rollback().catch(() => {});
      request.log.error({ err }, "Failed to update expired dates");
      return reply.code(500).send({ message: "Gagal update expired" });
    }
  });

  fastify.put("/:kode/validasi-gudang", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const validatedBy = String(body.validasi_gudang_by || body.updated_by || "").trim();

    if (!kode || !validatedBy) {
      return reply.code(400).send({ message: "kode_t_rpo dan validasi_gudang_by wajib diisi" });
    }

    try {
      const res = await pool
        .request()
        .input("kode_t_rpo", sql.VarChar(30), kode.trim())
        .input("validasi_gudang_by", sql.NVarChar(100), validatedBy)
        .input("validasi_gudang_at", sql.DateTime2, new Date())
        .input("updated_by", sql.NVarChar(100), validatedBy)
        .input("updated_at", sql.DateTime2, new Date())
        .query(`
          UPDATE dbo.GWEN_t_rpo
          SET is_validasi_gudang = 1,
              validasi_gudang_by = @validasi_gudang_by,
              validasi_gudang_at = @validasi_gudang_at,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
            AND is_active = 1;
        `);
      if (res.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "RPO tidak ditemukan" });
      }
      return reply.send({ message: "Validasi gudang tersimpan" });
    } catch (err) {
      request.log.error({ err }, "Failed to validate gudang");
      return reply.code(500).send({ message: "Gagal menyimpan validasi gudang" });
    }
  });

  fastify.post("/:kode/approve", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const approvedBy = String(body.approved_by || "").trim();
    if (!kode || !approvedBy) {
      return reply.code(400).send({ message: "kode dan approved_by wajib diisi" });
    }
    try {
      const res = await pool
        .request()
        .input("kode_t_rpo", sql.VarChar(30), kode.trim())
        .input("approved_by", sql.NVarChar(100), approvedBy)
        .query(`
          UPDATE dbo.GWEN_t_rpo
          SET
            status_rpo = 'APPROVED',
            approved_by = @approved_by,
            approved_at = SYSDATETIME(),
            updated_at = SYSDATETIME()
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
            AND (status_rpo IS NULL OR status_rpo <> '0');
        `);
      if (res.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "RPO tidak ditemukan" });
      }
      return reply.send({ message: "RPO disetujui" });
    } catch (err) {
      request.log.error({ err }, "Failed to approve RPO");
      return reply.code(500).send({ message: "Gagal approve RPO" });
    }
  });

  fastify.post("/:kode/release", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const rilisBy = String(body.rilis_by || "").trim();
    const tanggalBarangDatangRaw =
      body.tanggal_barang_datang || body.request_pengiriman_dari || body.request_pengiriman_sampai || null;
    const requestPengirimanDariRaw = body.request_pengiriman_dari || null;
    const requestPengirimanSampaiRaw = body.request_pengiriman_sampai || null;
    if (!kode || !rilisBy) {
      return reply.code(400).send({ message: "kode dan rilis_by wajib diisi" });
    }
    let tanggalBarangDatang = null;
    let requestPengirimanDari = null;
    let requestPengirimanSampai = null;
    if (tanggalBarangDatangRaw) {
      tanggalBarangDatang = new Date(String(tanggalBarangDatangRaw));
      if (Number.isNaN(tanggalBarangDatang.getTime())) {
        return reply.code(400).send({ message: "tanggal barang datang tidak valid" });
      }
    }
    if (requestPengirimanDariRaw) {
      requestPengirimanDari = new Date(String(requestPengirimanDariRaw));
      if (Number.isNaN(requestPengirimanDari.getTime())) {
        return reply.code(400).send({ message: "request_pengiriman_dari tidak valid" });
      }
    }
    if (requestPengirimanSampaiRaw) {
      requestPengirimanSampai = new Date(String(requestPengirimanSampaiRaw));
      if (Number.isNaN(requestPengirimanSampai.getTime())) {
        return reply.code(400).send({ message: "request_pengiriman_sampai tidak valid" });
      }
    }
    try {
      const res = await pool
        .request()
        .input("kode_t_rpo", sql.VarChar(30), kode.trim())
        .input("rilis_by", sql.NVarChar(100), rilisBy)
        .input("tanggal_barang_datang", sql.Date, tanggalBarangDatang)
        .input("request_pengiriman_dari", sql.Date, requestPengirimanDari)
        .input("request_pengiriman_sampai", sql.Date, requestPengirimanSampai)
        .query(`
          UPDATE dbo.GWEN_t_rpo
          SET
            is_rilis = 1,
            rilis_by = @rilis_by,
            rilis_at = SYSDATETIME(),
            tanggal_barang_datang = COALESCE(@tanggal_barang_datang, tanggal_barang_datang),
            request_pengiriman_dari = COALESCE(@request_pengiriman_dari, request_pengiriman_dari),
            request_pengiriman_sampai = COALESCE(@request_pengiriman_sampai, request_pengiriman_sampai),
            updated_at = SYSDATETIME()
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
            AND status_rpo = 'APPROVED'
            AND COALESCE(@tanggal_barang_datang, tanggal_barang_datang) IS NOT NULL
            AND is_active = 1;
        `);
      if (res.rowsAffected?.[0] === 0) {
        return reply.code(400).send({ message: "RPO harus approved dan tanggal barang datang harus terisi sebelum dirilis" });
      }
      return reply.send({ message: "RPO dirilis" });
    } catch (err) {
      request.log.error({ err }, "Failed to release RPO");
      return reply.code(500).send({ message: "Gagal rilis RPO" });
    }
  });

  fastify.put("/:kode/tanggal-barang-datang", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const tanggalBarangDatangRaw = body.tanggal_barang_datang;
    const updatedBy = String(body.updated_by || body.set_by || "Admin").trim();

    if (!kode) {
      return reply.code(400).send({ message: "kode_t_rpo wajib diisi" });
    }

    if (!tanggalBarangDatangRaw) {
      return reply.code(400).send({ message: "tanggal_barang_datang wajib diisi" });
    }

    const tanggalBarangDatang = new Date(String(tanggalBarangDatangRaw));
    if (Number.isNaN(tanggalBarangDatang.getTime())) {
      return reply.code(400).send({ message: "tanggal_barang_datang tidak valid" });
    }

    try {
      const res = await pool
        .request()
        .input("kode_t_rpo", sql.VarChar(30), String(kode).trim())
        .input("tanggal_barang_datang", sql.Date, tanggalBarangDatang)
        .input("updated_by", sql.NVarChar(100), updatedBy)
        .query(`
          UPDATE dbo.GWEN_t_rpo
          SET
            tanggal_barang_datang = @tanggal_barang_datang,
            updated_by = @updated_by,
            updated_at = SYSDATETIME()
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
            AND status_rpo = 'APPROVED'
            AND is_active = 1;
        `);

      if (res.rowsAffected?.[0] === 0) {
        return reply.code(400).send({ message: "Tanggal barang datang hanya bisa diisi saat status sudah APPROVED" });
      }

      return reply.send({ message: "Tanggal barang datang tersimpan" });
    } catch (err) {
      request.log.error({ err }, "Failed to update tanggal barang datang");
      return reply.code(500).send({ message: "Gagal menyimpan tanggal barang datang" });
    }
  });

  fastify.delete("/:kode", async (request, reply) => {
    const { kode } = request.params;
    if (!kode) return reply.code(400).send({ message: "kode wajib diisi" });
    try {
      const res = await pool
        .request()
        .input("kode_t_rpo", sql.VarChar(30), kode)
        .input("updated_at", sql.DateTime2, new Date())
        .query(`
          UPDATE dbo.GWEN_t_rpo
          SET is_active = 0, updated_at = @updated_at
          WHERE kode_t_rpo = @kode_t_rpo;
        `);
      if (res.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "RPO tidak ditemukan" });
      }
      await pool
        .request()
        .input("kode_t_rpo", sql.VarChar(30), kode)
        .input("updated_at", sql.DateTime2, new Date())
        .query(`
          UPDATE dbo.GWEN_d_rpo
          SET is_active = 0, updated_at = @updated_at
          WHERE kode_t_rpo = @kode_t_rpo;
        `);
      return reply.send({ message: "RPO dinonaktifkan" });
    } catch (err) {
      request.log.error({ err }, "Failed to deactivate RPO");
      return reply.code(500).send({ message: "Gagal menonaktifkan RPO" });
    }
  });
}
