export default async function kontrabonRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const parsePengadaanCodes = (raw) => {
    if (!raw) return [];
    const trimmed = String(raw).trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => String(c || "").trim()).filter((c) => c);
      }
    } catch {
      // fallback to raw string
    }
    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c);
    }
    return [trimmed];
  };

  const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

  const parseBiayaLainItems = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const calculateBiayaLainTotal = (raw) =>
    roundMoney(
      parseBiayaLainItems(raw).reduce((sum, item) => {
        const nominal = roundMoney(item?.nominal ?? 0);
        if (!nominal) return sum;
        return item?.jenis === "+" ? sum + nominal : sum - nominal;
      }, 0)
    );

  const normalizeKontrabonAmounts = ({ nominal_faktur, nominal_total, biaya_lain }) => {
    const nominalFaktur = roundMoney(nominal_faktur ?? 0);
    const biayaLainTotal = calculateBiayaLainTotal(biaya_lain);
    const computedNominalTotal = roundMoney(nominalFaktur + biayaLainTotal);
    const fallbackNominalTotal = roundMoney(nominal_total ?? computedNominalTotal);
    return {
      nominalFaktur,
      nominalTotal: computedNominalTotal || fallbackNominalTotal,
      biayaLainTotal,
    };
  };

  const toBaseQty = ({ qty, unit, satuan2, ratio12 }) => {
    const safeQty = Number(qty ?? 0);
    if (!Number.isFinite(safeQty) || safeQty <= 0) return 0;
    const normalizedUnit = String(unit || "").trim().toUpperCase();
    const normalizedSatuan2 = String(satuan2 || "").trim().toUpperCase();
    const safeRatio = Number(ratio12 ?? 0);
    if (normalizedUnit && normalizedSatuan2 && normalizedUnit === normalizedSatuan2 && safeRatio > 0) {
      return safeQty * safeRatio;
    }
    return safeQty;
  };

  const fromBaseQty = ({ qtyBase, unit, satuan2, ratio12 }) => {
    const safeQtyBase = Number(qtyBase ?? 0);
    if (!Number.isFinite(safeQtyBase) || safeQtyBase <= 0) return 0;
    const normalizedUnit = String(unit || "").trim().toUpperCase();
    const normalizedSatuan2 = String(satuan2 || "").trim().toUpperCase();
    const safeRatio = Number(ratio12 ?? 0);
    if (normalizedUnit && normalizedSatuan2 && normalizedUnit === normalizedSatuan2 && safeRatio > 0) {
      return Math.floor(safeQtyBase / safeRatio);
    }
    return Math.floor(safeQtyBase);
  };

  const syncActiveTagihanTotals = async ({
    tx,
    noInvoice,
    kodePengadaanList = [],
    nominalTotal,
    noFaktur,
    tglFaktur,
    tglJatuhTempo,
    noFakturPajak,
    tglFakturPajak,
    updatedBy,
    now,
  }) => {
    const activeReq = new sql.Request(tx);
    activeReq.input("no_invoice", sql.VarChar(255), noInvoice);
    const keepFilter = [];
    kodePengadaanList.forEach((kode, idx) => {
      const param = `kode_t_pengadaan_${idx}`;
      activeReq.input(param, sql.VarChar(255), kode);
      keepFilter.push(`@${param}`);
    });
    const activeRes = await activeReq.query(`
      SELECT
        t.kode_t_tagihan,
        t.kode_t_pengadaan,
        t.subtotal,
        t.diskon,
        t.total_stlh_diskon,
        t.total_sblm_ppn,
        t.ppn,
        t.total_tagihan,
        p.total AS pengadaan_total,
        p.diskon AS pengadaan_diskon,
        p.total_stlh_diskon AS pengadaan_total_stlh_diskon,
        p.total_sblm_ppn AS pengadaan_total_sblm_ppn,
        p.ppn AS pengadaan_ppn,
        p.total_akhir AS pengadaan_total_akhir,
        p.no_faktur_supplier AS pengadaan_no_faktur_supplier
      FROM dbo.GWEN_t_tagihan t
      LEFT JOIN dbo.GWEN_t_pengadaan p
        ON p.kode_t_pengadaan = t.kode_t_pengadaan
      WHERE t.no_invoice = @no_invoice
        AND ISNULL(t.is_void, 0) = 0
        AND ISNULL(t.status, 1) = 1
        ${keepFilter.length ? `AND t.kode_t_pengadaan IN (${keepFilter.join(", ")})` : ""}
      ORDER BY t.kode_t_tagihan;
    `);
    const activeTagihan = activeRes.recordset || [];
    if (!activeTagihan.length) return;

    const pengadaanTotal = roundMoney(
      activeTagihan.reduce((sum, row) => sum + roundMoney(row.pengadaan_total_akhir ?? 0), 0)
    );
    const shouldUsePengadaanAmounts =
      activeTagihan.length > 1 &&
      pengadaanTotal > 0 &&
      roundMoney(nominalTotal) === pengadaanTotal;

    if (activeTagihan.length > 1 && pengadaanTotal > 0 && roundMoney(nominalTotal) !== pengadaanTotal) {
      throw new Error(
        `Nominal faktur ${roundMoney(nominalTotal)} tidak sama dengan total PEN ${pengadaanTotal}`
      );
    }

    const existingTotal = roundMoney(
      activeTagihan.reduce((sum, row) => sum + roundMoney(row.total_tagihan ?? 0), 0)
    );
    const basisTotal = existingTotal > 0 ? existingTotal : activeTagihan.length;
    let allocatedTotal = 0;

    for (let idx = 0; idx < activeTagihan.length; idx += 1) {
      const row = activeTagihan[idx];
      const isLast = idx === activeTagihan.length - 1;
      const pengadaanRowTotal = roundMoney(row.pengadaan_total_akhir ?? 0);
      const nextTotalFromPengadaan = shouldUsePengadaanAmounts && pengadaanRowTotal > 0;
      const rowBasis =
        existingTotal > 0 ? roundMoney(row.total_tagihan ?? 0) : 1;
      const nextTotal = nextTotalFromPengadaan
        ? pengadaanRowTotal
        : isLast
        ? roundMoney(nominalTotal - allocatedTotal)
        : roundMoney((nominalTotal * rowBasis) / basisTotal);
      allocatedTotal = roundMoney(allocatedTotal + nextTotal);

      const sourceTotal = roundMoney(row.total_tagihan ?? 0);
      const ratio = sourceTotal > 0 ? nextTotal / sourceTotal : 0;
      const subtotal =
        nextTotalFromPengadaan
          ? roundMoney(row.pengadaan_total ?? nextTotal)
          : sourceTotal > 0
          ? roundMoney((row.subtotal ?? sourceTotal) * ratio)
          : nextTotal;
      const diskon = nextTotalFromPengadaan
        ? roundMoney(row.pengadaan_diskon ?? 0)
        : sourceTotal > 0
        ? roundMoney((row.diskon ?? 0) * ratio)
        : 0;
      const totalStlhDiskon =
        nextTotalFromPengadaan
          ? roundMoney(row.pengadaan_total_stlh_diskon ?? subtotal - diskon)
          : sourceTotal > 0
          ? roundMoney((row.total_stlh_diskon ?? row.total_sblm_ppn ?? subtotal) * ratio)
          : subtotal;
      const totalSblmPpn =
        nextTotalFromPengadaan
          ? roundMoney(row.pengadaan_total_sblm_ppn ?? totalStlhDiskon)
          : sourceTotal > 0
          ? roundMoney((row.total_sblm_ppn ?? totalStlhDiskon) * ratio)
          : totalStlhDiskon;
      const ppn = nextTotalFromPengadaan ? roundMoney(row.pengadaan_ppn ?? nextTotal - totalSblmPpn) : roundMoney(nextTotal - totalSblmPpn);

      await new sql.Request(tx)
        .input("kode_t_tagihan", sql.VarChar(255), row.kode_t_tagihan)
        .input("no_faktur_supplier", sql.VarChar(255), row.pengadaan_no_faktur_supplier || noFaktur || null)
        .input("tgl", sql.DateTime, tglFaktur ? new Date(tglFaktur) : null)
        .input("tgl_jatuh_tempo", sql.DateTime, tglJatuhTempo ? new Date(tglJatuhTempo) : null)
        .input("subtotal", sql.Decimal(20, 2), subtotal)
        .input("diskon", sql.Decimal(20, 2), diskon)
        .input("total_stlh_diskon", sql.Decimal(20, 2), totalStlhDiskon)
        .input("total_sblm_ppn", sql.Decimal(20, 2), totalSblmPpn)
        .input("ppn", sql.Decimal(20, 2), ppn)
        .input("total_tagihan", sql.Decimal(20, 2), nextTotal)
        .input("updated_by", sql.VarChar(255), updatedBy)
        .input("updated_at", sql.DateTime2, now)
        .input("no_faktur_pajak_pembelian", sql.VarChar(255), noFakturPajak || null)
        .input("tgl_faktur_pajak_pembelian", sql.DateTime, tglFakturPajak ? new Date(tglFakturPajak) : null)
        .query(`
          UPDATE dbo.GWEN_t_tagihan
          SET
            no_faktur_supplier = @no_faktur_supplier,
            tgl = @tgl,
            tgl_jatuh_tempo = @tgl_jatuh_tempo,
            subtotal = @subtotal,
            diskon = @diskon,
            total_stlh_diskon = @total_stlh_diskon,
            total_sblm_ppn = @total_sblm_ppn,
            ppn = @ppn,
            total_tagihan = @total_tagihan,
            no_faktur_pajak_pembelian = @no_faktur_pajak_pembelian,
            tgl_faktur_pajak_pembelian = @tgl_faktur_pajak_pembelian,
            updated_by = @updated_by,
            updated_at = @updated_at
          WHERE kode_t_tagihan = @kode_t_tagihan;
        `);
    }
  };

  const generateDocCode = async ({ prefix, tx, userCode = "88", branchCode = "GW", padLength = 5, separator = "." }) => {
    const req = tx ? new sql.Request(tx) : pool.request();
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

  const generateKontrabonCode = async (tx) => {
    const prefix = "GPF";
    const req = new sql.Request(tx);
    req.input("prefix", sql.VarChar(10), prefix);
    const res = await req.query(`
      SELECT MAX(CAST(SUBSTRING(no_kontrabon, LEN(@prefix) + 1, 20) AS INT)) AS maxNum
      FROM dbo.GWEN_t_kontrabon WITH (UPDLOCK, HOLDLOCK)
      WHERE no_kontrabon LIKE @prefix + '%';
    `);
    const nextNum = (res.recordset?.[0]?.maxNum || 0) + 1;
    return `${prefix}${nextNum}`;
  };

  fastify.get("/next-code", async (_request, reply) => {
    const prefix = "GPF";
    const tx = new sql.Transaction(pool);
    try {
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const req = new sql.Request(tx);
      req.input("prefix", sql.VarChar(10), prefix);
      const res = await req.query(`
        SELECT MAX(CAST(SUBSTRING(no_kontrabon, LEN(@prefix) + 1, 20) AS INT)) AS maxNum
        FROM dbo.GWEN_t_kontrabon WITH (UPDLOCK, HOLDLOCK)
        WHERE no_kontrabon LIKE @prefix + '%';
      `);
      const nextNum = (res.recordset?.[0]?.maxNum || 0) + 1;
      const nextCode = `${prefix}${nextNum}`;
      await tx.commit();
      return reply.send({ kode: nextCode });
    } catch (err) {
      await tx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed generate kontrabon code");
      return reply.code(500).send({ message: "Gagal generate nomor kontrabon" });
    }
  });

  fastify.get("/", async (_request, reply) => {
    try {
      const res = await pool.request().query(`
        WITH tagihan_active AS (
          SELECT
            t.no_invoice,
            t.kode_t_pengadaan,
            t.kode_t_tagihan,
            t.total_tagihan,
            COALESCE(
              NULLIF(LTRIM(RTRIM(p.no_faktur_supplier)), ''),
              NULLIF(LTRIM(RTRIM(t.no_faktur_supplier)), '')
            ) AS no_faktur_supplier_display
          FROM dbo.GWEN_t_tagihan t
          LEFT JOIN dbo.GWEN_t_pengadaan p
            ON p.kode_t_pengadaan = t.kode_t_pengadaan
          WHERE ISNULL(t.is_void, 0) = 0
            AND ISNULL(t.status, 1) = 1
        ),
        tagihan_agg AS (
          SELECT
            no_invoice,
            COUNT(DISTINCT kode_t_pengadaan) AS jumlah_pengadaan,
            SUM(ISNULL(total_tagihan, 0)) AS total_tagihan_aktif,
            STRING_AGG(CAST(kode_t_tagihan AS VARCHAR(MAX)), ', ') AS kode_t_tagihan_list,
            STRING_AGG(CAST(no_faktur_supplier_display AS VARCHAR(MAX)), CHAR(10)) AS no_faktur_supplier_list
          FROM tagihan_active
          GROUP BY no_invoice
        ),
        rekap AS (
          SELECT DISTINCT nokontrabon
          FROM dbo.GWEN_tbl_rekap
        )
        SELECT
          k.id,
          k.kode_t_pengadaan,
          k.no_kontrabon,
          k.no_faktur,
          k.kode_supplier,
          k.id_rekening,
          k.no_rekening,
          k.atas_nama,
          k.nama_bank,
          k.cabang,
          k.tgl_kontrabon,
          k.tgl_faktur,
          k.tgl_ppj,
          k.rencana_tf_dari,
          k.rencana_tf_sampai,
          k.nominal_faktur,
          k.biaya_lain,
          k.nominal_total,
          k.status,
          k.status_paid,
          k.catatan_tambahan,
          k.tgl_bayar,
          k.tanggal_faktur_pajak,
          k.nomor_faktur_pajak,
          k.created_at,
          k.created_by,
          ISNULL(ta.jumlah_pengadaan, 0) AS jumlah_pengadaan,
          ISNULL(ta.total_tagihan_aktif, 0) AS total_tagihan_aktif,
          CASE WHEN tr.nokontrabon IS NULL THEN 0 ELSE 1 END AS is_in_rekap,
          ta.kode_t_tagihan_list,
          ta.no_faktur_supplier_list
        FROM dbo.GWEN_t_kontrabon k
        LEFT JOIN rekap tr
          ON tr.nokontrabon COLLATE DATABASE_DEFAULT = k.no_kontrabon COLLATE DATABASE_DEFAULT
        LEFT JOIN tagihan_agg ta
          ON ta.no_invoice COLLATE DATABASE_DEFAULT = k.no_kontrabon COLLATE DATABASE_DEFAULT
        WHERE ISNULL(k.status, 1) = 1
        ORDER BY k.created_at DESC, k.id DESC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch kontrabon list");
      return reply.code(500).send({ message: "Gagal memuat kontrabon" });
    }
  });

  fastify.post("/:no_kontrabon/generate-tagihan", async (request, reply) => {
    const { no_kontrabon } = request.params || {};
    const nomorKontrabon = String(no_kontrabon || "").trim();
    const createdBy = String(request.body?.created_by || "Admin").trim() || "Admin";
    if (!nomorKontrabon) {
      return reply.code(400).send({ message: "no_kontrabon wajib diisi" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      const headerRes = await new sql.Request(tx)
        .input("no_kontrabon", sql.VarChar(255), nomorKontrabon)
        .query(`SELECT TOP 1 * FROM dbo.GWEN_t_kontrabon WHERE no_kontrabon = @no_kontrabon;`);
      const header = headerRes.recordset?.[0];
      if (!header) {
        await tx.rollback();
        return reply.code(404).send({ message: "Kontrabon tidak ditemukan" });
      }

      const pengadaanCodes = parsePengadaanCodes(header.kode_t_pengadaan);
      if (pengadaanCodes.length === 0) {
        await tx.rollback();
        return reply.code(400).send({ message: "Kode pengadaan tidak ditemukan pada kontrabon" });
      }

      const supplierRes = await new sql.Request(tx)
        .input("kode_supplier", sql.VarChar(100), header.kode_supplier || "")
        .query(`SELECT TOP 1 nama FROM dbo.m_supplier WHERE kode_supplier = @kode_supplier`);
      const supplierNama = supplierRes.recordset?.[0]?.nama || header.kode_supplier || null;

      const createdTagihan = [];
      const skippedPengadaan = [];

      for (const kodeT of pengadaanCodes) {
        const existsRes = await new sql.Request(tx)
          .input("kode_t_pengadaan", sql.VarChar(255), kodeT)
          .input("no_invoice", sql.VarChar(255), nomorKontrabon)
          .query(
            `SELECT TOP 1 kode_t_tagihan
             FROM dbo.GWEN_t_tagihan
             WHERE kode_t_pengadaan = @kode_t_pengadaan
               AND no_invoice = @no_invoice
               AND ISNULL(is_void, 0) = 0
               AND ISNULL(status, 1) = 1;`
          );
        if (existsRes.recordset?.length) {
          skippedPengadaan.push(kodeT);
          continue;
        }

        const pengRes = await new sql.Request(tx)
          .input("kode_t_pengadaan", sql.VarChar(255), kodeT)
          .query(`
            SELECT TOP 1
              kode_t_pengadaan,
              kode_t_rpo,
              kode_supplier,
              total,
              diskon,
              total_stlh_diskon,
              total_sblm_ppn,
              ppn,
              total_akhir,
              no_faktur_supplier
            FROM dbo.GWEN_t_pengadaan
            WHERE kode_t_pengadaan = @kode_t_pengadaan
              AND ISNULL(status, 1) = 1;
          `);
        if (!pengRes.recordset?.[0]) {
          throw new Error(`Pengadaan tidak ditemukan atau sudah nonaktif: ${kodeT}`);
        }
        const peng = pengRes.recordset[0];

        const kode_t_tagihan = await generateDocCode({ prefix: "TAG", tx });

        const subtotal = Number(peng.total ?? peng.total_akhir ?? 0);
        const diskon = Number(peng.diskon ?? 0);
        const totalStlhDiskon = Number(peng.total_stlh_diskon ?? subtotal - diskon);
        const totalSblmPpn = Number(peng.total_sblm_ppn ?? totalStlhDiskon);
        const ppn = Number(peng.ppn ?? 0);
        const totalTagihan = Number(peng.total_akhir ?? totalSblmPpn + ppn);

        await new sql.Request(tx)
          .input("kode_t_tagihan", sql.VarChar(255), kode_t_tagihan)
          .input("kode_t_pengadaan", sql.VarChar(255), kodeT)
          .input("kode_t_rpo", sql.VarChar(255), peng.kode_t_rpo || null)
          .input("kode_lpb", sql.VarChar(255), null)
          .input("kode_supplier", sql.VarChar(255), header.kode_supplier || null)
          .input("nama_supplier", sql.VarChar(255), supplierNama)
          .input("no_invoice", sql.VarChar(255), nomorKontrabon)
          .input(
            "no_faktur_supplier",
            sql.VarChar(255),
            peng.no_faktur_supplier || header.no_faktur || null
          )
          .input("tgl", sql.DateTime, header.tgl_faktur ? new Date(header.tgl_faktur) : new Date())
          .input(
            "tgl_jatuh_tempo",
            sql.DateTime,
            header.rencana_tf_sampai ? new Date(header.rencana_tf_sampai) : null
          )
          .input("subtotal", sql.Decimal(20, 2), subtotal)
          .input("diskon", sql.Decimal(20, 2), diskon)
          .input("total_stlh_diskon", sql.Decimal(20, 2), totalStlhDiskon)
          .input("total_sblm_ppn", sql.Decimal(20, 2), totalSblmPpn)
          .input("ppn", sql.Decimal(20, 2), ppn)
          .input("total_tagihan", sql.Decimal(20, 2), totalTagihan)
          .input("total_dibayar", sql.Decimal(20, 2), 0)
          .input("is_lunas", sql.Int, 0)
          .input("tgl_lunas", sql.DateTime, null)
          .input("catatan", sql.VarChar(255), header.catatan_tambahan || null)
          .input("metode_bayar", sql.VarChar(255), null)
          .input("bank", sql.VarChar(255), header.nama_bank || null)
          .input("status_verifikasi", sql.Int, 0)
          .input("verifikasi_by", sql.VarChar(255), null)
          .input("verifikasi_at", sql.DateTime, null)
          .input("is_void", sql.Int, 0)
          .input("void_by", sql.VarChar(255), null)
          .input("void_at", sql.DateTime, null)
          .input("status", sql.Int, 1)
          .input("status_cadangan", sql.Int, 1)
          .input("created_by", sql.VarChar(255), createdBy)
          .input("created_at", sql.DateTime2, new Date())
          .input("updated_by", sql.VarChar(255), createdBy)
          .input("updated_at", sql.DateTime2, new Date())
          .input("no_faktur_pajak_pembelian", sql.VarChar(255), header.nomor_faktur_pajak || null)
          .input(
            "tgl_faktur_pajak_pembelian",
            sql.DateTime,
            header.tanggal_faktur_pajak ? new Date(header.tanggal_faktur_pajak) : null
          )
          .input("ket", sql.VarChar(sql.MAX), header.catatan_tambahan || null)
          .query(
            `
            INSERT INTO dbo.GWEN_t_tagihan (
              kode_t_tagihan, kode_t_pengadaan, kode_t_rpo, kode_lpb, kode_supplier, nama_supplier, no_invoice,
              no_faktur_supplier, tgl, tgl_jatuh_tempo, subtotal, diskon, total_stlh_diskon, total_sblm_ppn, ppn,
              total_tagihan, total_dibayar, is_lunas, tgl_lunas, catatan, metode_bayar, bank, status_verifikasi,
              verifikasi_by, verifikasi_at, is_void, void_by, void_at, status, status_cadangan, created_by, created_at,
              updated_by, updated_at, no_faktur_pajak_pembelian, tgl_faktur_pajak_pembelian, ket
            ) VALUES (
              @kode_t_tagihan, @kode_t_pengadaan, @kode_t_rpo, @kode_lpb, @kode_supplier, @nama_supplier, @no_invoice,
              @no_faktur_supplier, @tgl, @tgl_jatuh_tempo, @subtotal, @diskon, @total_stlh_diskon, @total_sblm_ppn, @ppn,
              @total_tagihan, @total_dibayar, @is_lunas, @tgl_lunas, @catatan, @metode_bayar, @bank, @status_verifikasi,
              @verifikasi_by, @verifikasi_at, @is_void, @void_by, @void_at, @status, @status_cadangan, @created_by, @created_at,
              @updated_by, @updated_at, @no_faktur_pajak_pembelian, @tgl_faktur_pajak_pembelian, @ket
            );
          `
          );

        createdTagihan.push({ kode_t_pengadaan: kodeT, kode_t_tagihan });
      }

      await tx.commit();
      return reply.send({
        message: "Generate tagihan selesai",
        no_kontrabon: nomorKontrabon,
        created_count: createdTagihan.length,
        created_tagihan: createdTagihan,
        skipped_pengadaan: skippedPengadaan,
      });
    } catch (err) {
      await tx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed generate tagihan kontrabon");
      return reply.code(500).send({ message: "Gagal generate tagihan kontrabon" });
    }
  });

  fastify.get("/rekap", async (request, reply) => {
    const { from, to } = request.query || {};
    try {
      const req = pool.request();
      const filters = [];
      if (from) {
        req.input("from", sql.Date, new Date(from));
        filters.push("wr.tgl_rekap >= @from");
      }
      if (to) {
        req.input("to", sql.Date, new Date(to));
        filters.push("wr.tgl_rekap <= @to");
      }
      const baseFilters = ["wr.status = 1"];
      const whereClause = [...baseFilters, ...filters].length
        ? `WHERE ${[...baseFilters, ...filters].join(" AND ")}`
        : "";
      const res = await req.query(`
        SELECT
          wr.id,
          wr.tgl_rekap,
          CASE
            WHEN SUM(CASE WHEN ISNULL(tr.stspaid, '') = 'Paid' THEN 0 ELSE 1 END) = 0
              AND COUNT(tr.nokontrabon) > 0
              THEN 'Paid'
            ELSE 'Not Paid'
          END AS status_rekap,
          wr.status,
          wr.approved_by,
          wr.approved_at,
          wr.catatan,
          COALESCE(SUM(ISNULL(tr.gt, 0)), 0) AS total_nominal
        FROM dbo.GWEN_wadah_rekap wr
        LEFT JOIN dbo.GWEN_tbl_rekap tr
          ON tr.id_wadah_rekap = wr.id
        ${whereClause}
        GROUP BY
          wr.id,
          wr.tgl_rekap,
          wr.status_rekap,
          wr.status,
          wr.approved_by,
          wr.approved_at,
          wr.catatan
        ORDER BY wr.tgl_rekap DESC, wr.id DESC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch rekap kontrabon");
      return reply.code(500).send({ message: "Gagal memuat rekap kontrabon" });
    }
  });

  fastify.post("/rekap", async (request, reply) => {
    const { tgl_rekap } = request.body || {};
    if (!tgl_rekap) {
      return reply.code(400).send({ message: "tgl_rekap wajib diisi" });
    }
    try {
      const req = pool.request();
      req.input("tgl_rekap", sql.Date, new Date(tgl_rekap));
      const res = await req.query(`
        INSERT INTO dbo.GWEN_wadah_rekap (tgl_rekap)
        OUTPUT inserted.*
        VALUES (@tgl_rekap);
      `);
      return reply.send(res.recordset?.[0] || null);
    } catch (err) {
      fastify.log.error({ err }, "Failed create wadah rekap");
      return reply.code(500).send({ message: "Gagal membuat wadah rekap" });
    }
  });

  fastify.patch("/rekap/:id/status", async (request, reply) => {
    const { id } = request.params || {};
    const { status, updated_by } = request.body || {};
    if (!id) return reply.code(400).send({ message: "id wajib diisi" });
    const nextStatus = Number.isFinite(Number(status)) ? Number(status) : 0;
    try {
      const tx = new sql.Transaction(pool);
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
      const req = new sql.Request(tx);
      req.input("id", sql.Int, Number(id));
      req.input("status", sql.Int, nextStatus);
      req.input("updated_by", sql.VarChar(100), updated_by || "Admin");
      req.input("updated_at", sql.DateTime2, new Date());
      const result = await req.query(`
        UPDATE dbo.GWEN_wadah_rekap
        SET status = @status
        WHERE id = @id;
      `);
      if (result.rowsAffected?.[0] === 0) {
        await tx.rollback();
        return reply.code(404).send({ message: "Rekap tidak ditemukan" });
      }

      if (nextStatus === 0) {
        await new sql.Request(tx)
          .input("id_wadah_rekap", sql.Int, Number(id))
          .query(`
            DELETE FROM dbo.GWEN_tbl_rekap
            WHERE id_wadah_rekap = @id_wadah_rekap;
          `);
      }

      await tx.commit();
      return reply.send({ message: "Status rekap diperbarui" });
    } catch (err) {
      fastify.log.error({ err }, "Failed update rekap status");
      return reply.code(500).send({ message: "Gagal update status rekap" });
    }
  });

  fastify.patch("/rekap/:id/catatan", async (request, reply) => {
    const { id } = request.params || {};
    if (!id) return reply.code(400).send({ message: "id wajib diisi" });
    const rawNote = request.body?.catatan;
    const trimmed = rawNote === null || rawNote === undefined ? "" : String(rawNote).trim();
    const catatan = trimmed ? trimmed.slice(0, 255) : null;
    try {
      const req = pool.request();
      req.input("id", sql.Int, Number(id));
      req.input("catatan", sql.VarChar(255), catatan);
      const result = await req.query(`
        UPDATE dbo.GWEN_wadah_rekap
        SET catatan = @catatan
        WHERE id = @id;
      `);
      if (result.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Rekap tidak ditemukan" });
      }
      return reply.send({ message: "Catatan rekap diperbarui", catatan });
    } catch (err) {
      fastify.log.error({ err }, "Failed update catatan rekap");
      return reply.code(500).send({ message: "Gagal menyimpan catatan" });
    }
  });

  fastify.get("/rekap/:id", async (request, reply) => {
    const { id } = request.params || {};
    if (!id) return reply.code(400).send({ message: "id wajib diisi" });
    try {
      const req = pool.request();
      req.input("id", sql.Int, Number(id));
      const headerRes = await req.query(`
        SELECT TOP 1
          id,
          tgl_rekap,
          (
            SELECT CASE
              WHEN SUM(CASE WHEN ISNULL(stspaid, '') = 'Paid' THEN 0 ELSE 1 END) = 0
                AND COUNT(1) > 0
                THEN 'Paid'
              ELSE 'Not Paid'
            END
            FROM dbo.GWEN_tbl_rekap
            WHERE id_wadah_rekap = @id
          ) AS status_rekap,
          status,
          approved_by,
          approved_at,
          catatan
        FROM dbo.GWEN_wadah_rekap
        WHERE id = @id;
      `);
      const header = headerRes.recordset?.[0];
      if (!header) {
        return reply.code(404).send({ message: "Rekap tidak ditemukan" });
      }
      const itemsRes = await pool
        .request()
        .input("id_wadah_rekap", sql.Int, Number(id))
        .query(`
          SELECT
            tr.[no],
            tr.id_wadah_rekap,
            tr.id_rekening,
            tr.nokontrabon,
            tr.username,
            tr.norek,
            tr.namabank,
            tr.atasnama,
            tr.cabang,
            tr.tglbeli,
            tr.[top],
            tr.namasupp,
            tr.tglinput,
            tr.tambahan,
            tr.jenist,
            tr.stspaid,
            tr.stsopen,
            tr.total,
            tr.gt,
            tr.catatan,
            tr.status_notif_wa,
            k.no_faktur,
            k.kode_t_pengadaan,
            STRING_AGG(t.kode_t_tagihan, ', ') AS id_tagihan_list
          FROM dbo.GWEN_tbl_rekap tr
          LEFT JOIN dbo.GWEN_t_kontrabon k
            ON k.no_kontrabon = tr.nokontrabon
          LEFT JOIN dbo.GWEN_t_tagihan t
            ON t.no_invoice = tr.nokontrabon
            AND ISNULL(t.is_void, 0) = 0
            AND ISNULL(t.status, 1) = 1
            AND (
              k.kode_t_pengadaan IS NULL
              OR LTRIM(RTRIM(k.kode_t_pengadaan)) = ''
              OR (
                ',' + REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(k.kode_t_pengadaan, ''), '[', ''), ']', ''), CHAR(34), ''), CHAR(39), '') + ','
                LIKE '%,' + LTRIM(RTRIM(ISNULL(t.kode_t_pengadaan, ''))) + ',%'
              )
            )
          WHERE tr.id_wadah_rekap = @id_wadah_rekap
          GROUP BY
            tr.[no],
            tr.id_wadah_rekap,
            tr.id_rekening,
            tr.nokontrabon,
            tr.username,
            tr.norek,
            tr.namabank,
            tr.atasnama,
            tr.cabang,
            tr.tglbeli,
            tr.[top],
            tr.namasupp,
            tr.tglinput,
            tr.tambahan,
            tr.jenist,
            tr.stspaid,
            tr.stsopen,
            tr.total,
            tr.gt,
            tr.catatan,
            tr.status_notif_wa,
            k.no_faktur,
            k.kode_t_pengadaan
          ORDER BY tr.[no] ASC;
        `);
      return reply.send({ header, items: itemsRes.recordset || [] });
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch rekap detail");
      return reply.code(500).send({ message: "Gagal memuat detail rekap" });
    }
  });

  fastify.get("/rekap/:id/pemantauan-30", async (request, reply) => {
    const { id } = request.params || {};
    if (!id) return reply.code(400).send({ message: "id wajib diisi" });

    try {
      const headerReq = pool.request();
      headerReq.input("id", sql.Int, Number(id));
      const headerRes = await headerReq.query(`
        SELECT TOP 1
          wr.id,
          wr.tgl_rekap,
          SUM(COALESCE(tr.gt, tr.total, 0)) AS grand_total
        FROM dbo.GWEN_wadah_rekap wr
        LEFT JOIN dbo.GWEN_tbl_rekap tr
          ON tr.id_wadah_rekap = wr.id
        WHERE wr.id = @id
        GROUP BY wr.id, wr.tgl_rekap;
      `);
      const header = headerRes.recordset?.[0];
      if (!header) {
        return reply.code(404).send({ message: "Rekap tidak ditemukan" });
      }

      const rekapReq = pool.request();
      rekapReq.input("id_wadah_rekap", sql.Int, Number(id));
      const rekapRes = await rekapReq.query(`
        SELECT
          tr.[no],
          tr.nokontrabon,
          tr.namasupp,
          tr.total,
          tr.gt,
          tr.tglbeli,
          k.no_faktur,
          k.tgl_faktur,
          k.rencana_tf_dari,
          k.rencana_tf_sampai,
          k.kode_t_pengadaan
        FROM dbo.GWEN_tbl_rekap tr
        LEFT JOIN dbo.GWEN_t_kontrabon k
          ON k.no_kontrabon = tr.nokontrabon
        WHERE tr.id_wadah_rekap = @id_wadah_rekap
        ORDER BY tr.[no] ASC;
      `);
      const rekapRows = rekapRes.recordset || [];
      if (!rekapRows.length) {
        return reply.send({ header, cards: [] });
      }

      const cardSources = [];
      const selectedPengadaanCodes = [];
      for (const row of rekapRows) {
        const pengadaanCodes = parsePengadaanCodes(row.kode_t_pengadaan);
        for (const code of pengadaanCodes) {
          cardSources.push({
            rekapNo: row.no,
            nomorKontrabon: row.nokontrabon,
            namaSupplier: row.namasupp,
            total: Number(row.gt ?? row.total ?? 0),
            noFaktur: row.no_faktur,
            tglFaktur: row.tgl_faktur,
            tglKontrabon: row.tglbeli,
            rencanaTfDari: row.rencana_tf_dari,
            rencanaTfSampai: row.rencana_tf_sampai,
            kodeTPengadaan: code,
          });
          selectedPengadaanCodes.push(code);
        }
      }

      const uniquePengadaanCodes = [...new Set(selectedPengadaanCodes)];
      if (!uniquePengadaanCodes.length) {
        return reply.send({ header, cards: [] });
      }

      const pengadaanReq = pool.request();
      uniquePengadaanCodes.forEach((code, idx) => {
        pengadaanReq.input(`kode_${idx}`, sql.VarChar(255), code);
      });
      const pengadaanParams = uniquePengadaanCodes.map((_, idx) => `@kode_${idx}`).join(", ");
      const pengadaanDetailRes = await pengadaanReq.query(`
        SELECT
          tp.kode_t_pengadaan,
          tp.tgl,
          tp.kode_supplier,
          s.nama AS nama_supplier,
          dp.kode_barang_variant,
          b.kode_barang,
          COALESCE(v.nama_varian, dp.nama_varian, dp.nama_barang, b.nama) AS nama_barang,
          dp.qty,
          dp.satuan,
          b.satuan_1,
          b.satuan_2,
          b.rasio_1_ke_2
        FROM dbo.GWEN_t_pengadaan tp
        INNER JOIN dbo.GWEN_d_pengadaan dp
          ON dp.kode_t_pengadaan COLLATE DATABASE_DEFAULT = tp.kode_t_pengadaan COLLATE DATABASE_DEFAULT
          AND ISNULL(dp.is_active, 1) = 1
        LEFT JOIN dbo.m_barang_varian v
          ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = dp.kode_barang_variant COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.m_barang b
          ON b.id_barang = v.id_barang
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = tp.kode_supplier COLLATE DATABASE_DEFAULT
        WHERE tp.kode_t_pengadaan IN (${pengadaanParams})
        ORDER BY tp.tgl DESC, tp.kode_t_pengadaan DESC, dp.kode_d_pengadaan ASC;
      `);
      const pengadaanDetails = pengadaanDetailRes.recordset || [];
      const variantCodes = [...new Set(
        pengadaanDetails
          .map((row) => String(row.kode_barang_variant || "").trim())
          .filter(Boolean)
      )];

      const stockMap = new Map();
      if (variantCodes.length) {
        const stockReq = pool.request();
        variantCodes.forEach((code, idx) => {
          stockReq.input(`variant_${idx}`, sql.VarChar(255), code);
        });
        const stockParams = variantCodes.map((_, idx) => `@variant_${idx}`).join(", ");
        const stockRes = await stockReq.query(`
          SELECT
            kode_barang_variant,
            SUM(ISNULL(qty_baik, 0) - ISNULL(qty_rusak, 0)) AS stok_total
          FROM dbo.GWEN_mn_barang_gudang_variant
          WHERE kode_barang_variant IN (${stockParams})
            AND ISNULL(status, 1) = 1
          GROUP BY kode_barang_variant;
        `);
        (stockRes.recordset || []).forEach((row) => {
          stockMap.set(String(row.kode_barang_variant), Number(row.stok_total ?? 0));
        });
      }

      const historyMap = new Map();
      if (variantCodes.length) {
        const historyReq = pool.request();
        variantCodes.forEach((code, idx) => {
          historyReq.input(`history_variant_${idx}`, sql.VarChar(255), code);
        });
        const historyParams = variantCodes.map((_, idx) => `@history_variant_${idx}`).join(", ");
        const historyRes = await historyReq.query(`
          WITH ranked AS (
            SELECT
              dp.kode_barang_variant,
              tp.kode_t_pengadaan,
              tp.tgl,
              dp.qty,
              dp.satuan,
              b.satuan_1,
              b.satuan_2,
              b.rasio_1_ke_2,
              ROW_NUMBER() OVER (
                PARTITION BY dp.kode_barang_variant
                ORDER BY tp.tgl DESC, tp.kode_t_pengadaan DESC, dp.kode_d_pengadaan DESC
              ) AS rn
            FROM dbo.GWEN_d_pengadaan dp
            INNER JOIN dbo.GWEN_t_pengadaan tp
              ON tp.kode_t_pengadaan COLLATE DATABASE_DEFAULT = dp.kode_t_pengadaan COLLATE DATABASE_DEFAULT
            LEFT JOIN dbo.m_barang_varian v
              ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = dp.kode_barang_variant COLLATE DATABASE_DEFAULT
            LEFT JOIN dbo.m_barang b
              ON b.id_barang = v.id_barang
            WHERE dp.kode_barang_variant IN (${historyParams})
              AND ISNULL(dp.is_active, 1) = 1
          )
          SELECT
            kode_barang_variant,
            kode_t_pengadaan,
            tgl,
            qty,
            satuan,
            satuan_1,
            satuan_2,
            rasio_1_ke_2,
            rn
          FROM ranked
          WHERE rn <= 5
          ORDER BY kode_barang_variant ASC, rn ASC;
        `);
        (historyRes.recordset || []).forEach((row) => {
          const key = String(row.kode_barang_variant || "").trim();
          if (!key) return;
          if (!historyMap.has(key)) historyMap.set(key, []);
          historyMap.get(key).push(row);
        });
      }

      const today = new Date();
      const detailsByPengadaan = new Map();
      pengadaanDetails.forEach((detail) => {
        const kodePengadaan = String(detail.kode_t_pengadaan || "").trim();
        if (!kodePengadaan) return;
        const variantCode = String(detail.kode_barang_variant || "").trim();
        const currentStockBase = Number(stockMap.get(variantCode) ?? 0);
        const histories = (historyMap.get(variantCode) || []).map((row) => ({
          kodeTPengadaan: String(row.kode_t_pengadaan || "").trim(),
          tgl: row.tgl,
          qty: Number(row.qty ?? 0),
          satuan: row.satuan,
          qtyBase: toBaseQty({
            qty: row.qty,
            unit: row.satuan,
            satuan2: row.satuan_2,
            ratio12: row.rasio_1_ke_2,
          }),
          satuan2: row.satuan_2,
          ratio12: Number(row.rasio_1_ke_2 ?? 0),
        }));

        let stockCursorBase = currentStockBase;
        const slots = histories.map((row, index) => {
          const sisaBase = Math.max(Math.min(stockCursorBase, row.qtyBase), 0);
          stockCursorBase = Math.max(stockCursorBase - row.qtyBase, 0);
          const qtyDisplay = Number(row.qty ?? 0);
          const sisaDisplay = fromBaseQty({
            qtyBase: sisaBase,
            unit: row.satuan,
            satuan2: row.satuan2,
            ratio12: row.ratio12,
          });
          const persen = row.qtyBase > 0 ? Math.round((sisaBase / row.qtyBase) * 10000) / 100 : null;
          const ageDays = row.tgl
            ? Math.floor((today.getTime() - new Date(row.tgl).getTime()) / (1000 * 60 * 60 * 24))
            : null;
          return {
            slot: `K${index + 1}`,
            kodeTPengadaan: row.kodeTPengadaan,
            qty: qtyDisplay,
            satuan: row.satuan,
            sisa: sisaDisplay,
            persen,
            umurHari: ageDays,
            isCurrent: row.kodeTPengadaan === kodePengadaan,
          };
        });

        const rowPayload = {
          kodeBarangVariant: variantCode,
          kodeBarang: detail.kode_barang,
          namaBarang: detail.nama_barang,
          namaSupplier: detail.nama_supplier,
          stokSaatIni: currentStockBase,
          qtyPengadaan: Number(detail.qty ?? 0),
          satuanPengadaan: detail.satuan,
          slots,
        };

        if (!detailsByPengadaan.has(kodePengadaan)) detailsByPengadaan.set(kodePengadaan, []);
        detailsByPengadaan.get(kodePengadaan).push(rowPayload);
      });

      const cards = cardSources.map((card) => ({
        ...card,
        umurNotaHari: card.tglFaktur
          ? Math.floor((today.getTime() - new Date(card.tglFaktur).getTime()) / (1000 * 60 * 60 * 24))
          : null,
        data: detailsByPengadaan.get(card.kodeTPengadaan) || [],
      }));

      return reply.send({ header, cards });
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch pemantauan 30 kontrabon");
      return reply.code(500).send({ message: "Gagal memuat pemantauan 30 kontrabon" });
    }
  });

  fastify.post("/rekap/:id/items", async (request, reply) => {
    const { id } = request.params || {};
    const { no_kontrabon_list } = request.body || {};
    const list = Array.isArray(no_kontrabon_list)
      ? no_kontrabon_list.map((v) => String(v || "").trim()).filter(Boolean)
      : [];
    if (!id) return reply.code(400).send({ message: "id wajib diisi" });
    if (list.length === 0) return reply.code(400).send({ message: "no_kontrabon_list wajib diisi" });

    try {
      const checkReq = pool.request();
      list.forEach((code, idx) => {
        checkReq.input(`code${idx}`, sql.VarChar(255), code);
      });
      const checkClause = list.map((_, idx) => `@code${idx}`).join(", ");
      const existing = await checkReq.query(`
        SELECT tr.nokontrabon
        FROM dbo.GWEN_tbl_rekap tr
        WHERE tr.nokontrabon IN (${checkClause});
      `);
      const existingList = (existing.recordset || []).map((r) => String(r.nokontrabon || "").trim()).filter(Boolean);
      if (existingList.length > 0) {
        return reply.code(409).send({
          message: `No kontrabon sudah diinputkan di rekap lain: ${existingList.join(", ")}`,
          duplicates: existingList,
        });
      }

      const req = pool.request();
      req.input("id_wadah_rekap", sql.Int, Number(id));
      list.forEach((code, idx) => {
        req.input(`code${idx}`, sql.VarChar(255), code);
      });
      const inClause = list.map((_, idx) => `@code${idx}`).join(", ");
      const res = await req.query(`
        INSERT INTO dbo.GWEN_tbl_rekap (
          id_wadah_rekap,
          id_rekening,
          nokontrabon,
          username,
          norek,
          namabank,
          atasnama,
          cabang,
          tglbeli,
          [top],
          namasupp,
          tglinput,
          tambahan,
          jenist,
          stspaid,
          stsopen,
          total,
          gt,
          catatan,
          status_notif_wa,
          status
        )
        SELECT
          @id_wadah_rekap,
          k.id_rekening,
          k.no_kontrabon,
          k.created_by,
          k.no_rekening,
          k.nama_bank,
          k.atas_nama,
          k.cabang,
          k.tgl_kontrabon,
          NULL,
          s.nama,
          k.created_at,
          k.biaya_lain,
          NULL,
          k.status_paid,
          'Not Paid',
          k.nominal_faktur,
          k.nominal_total,
          k.catatan_tambahan,
          'Belum Terkirim',
          1
        FROM dbo.GWEN_t_kontrabon k
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = k.kode_supplier COLLATE DATABASE_DEFAULT
        WHERE k.no_kontrabon IN (${inClause})
          AND NOT EXISTS (
            SELECT 1
            FROM dbo.GWEN_tbl_rekap tr
            WHERE tr.id_wadah_rekap = @id_wadah_rekap
              AND tr.nokontrabon = k.no_kontrabon
          );
      `);
      return reply.send({ inserted: res.rowsAffected?.[0] || 0 });
    } catch (err) {
      fastify.log.error({ err }, "Failed add kontrabon to rekap");
      const errNumber = err?.number || err?.originalError?.info?.number;
      if (errNumber === 2601 || errNumber === 2627) {
        return reply.code(409).send({ message: "No kontrabon sudah diinputkan di rekap lain." });
      }
      return reply.code(500).send({ message: "Gagal menambahkan kontrabon ke rekap" });
    }
  });

  fastify.post("/rekap/:id/pelunasan", async (request, reply) => {
    const { id } = request.params || {};
    const { paid_by } = request.body || {};
    if (!id) return reply.code(400).send({ message: "id wajib diisi" });
    const paidBy = String(paid_by || "Admin").trim() || "Admin";
    const now = new Date();
    const tx = new sql.Transaction(pool);
    try {
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      const rekapItemsRes = await new sql.Request(tx)
        .input("id_wadah_rekap", sql.Int, Number(id))
        .query(`
          SELECT nokontrabon
          FROM dbo.GWEN_tbl_rekap
          WHERE id_wadah_rekap = @id_wadah_rekap;
        `);
      const kontrabonList = (rekapItemsRes.recordset || [])
        .map((row) => String(row.nokontrabon || "").trim())
        .filter(Boolean);
      if (kontrabonList.length === 0) {
        await tx.rollback();
        return reply.code(400).send({ message: "Tidak ada kontrabon untuk dilunasi" });
      }

      const formatIDR = (val) => {
        const safe = Number(val ?? 0);
        const rounded = Math.ceil(Number.isFinite(safe) ? safe : 0);
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(
          rounded
        );
      };

      for (const noKontrabon of kontrabonList) {
        await new sql.Request(tx)
          .input("no_kontrabon", sql.VarChar(255), noKontrabon)
          .input("tgl_bayar", sql.DateTime, now)
          .query(`
            UPDATE dbo.GWEN_t_kontrabon
            SET status_paid = 'Paid',
                tgl_bayar = @tgl_bayar
            WHERE no_kontrabon = @no_kontrabon;
          `);

        await new sql.Request(tx)
          .input("no_invoice", sql.VarChar(255), noKontrabon)
          .input("updated_by", sql.VarChar(100), paidBy)
          .input("updated_at", sql.DateTime2, now)
          .input("tgl_lunas", sql.DateTime, now)
          .query(`
            UPDATE dbo.GWEN_t_tagihan
            SET is_lunas = 1,
                total_dibayar = total_tagihan,
                tgl_lunas = @tgl_lunas,
                updated_by = @updated_by,
                updated_at = @updated_at
            WHERE no_invoice = @no_invoice
              AND ISNULL(is_void, 0) = 0
              AND ISNULL(status, 1) = 1
              AND EXISTS (
                SELECT 1
                FROM dbo.GWEN_t_kontrabon k
                WHERE k.no_kontrabon = @no_invoice
                  AND (
                    k.kode_t_pengadaan IS NULL
                    OR LTRIM(RTRIM(k.kode_t_pengadaan)) = ''
                    OR (
                      ',' + REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(k.kode_t_pengadaan, ''), '[', ''), ']', ''), CHAR(34), ''), CHAR(39), '') + ','
                      LIKE '%,' + LTRIM(RTRIM(ISNULL(dbo.GWEN_t_tagihan.kode_t_pengadaan, ''))) + ',%'
                    )
                  )
              );
          `);

        await new sql.Request(tx)
          .input("id_wadah_rekap", sql.Int, Number(id))
          .input("no_kontrabon", sql.VarChar(255), noKontrabon)
          .query(`
            UPDATE dbo.GWEN_tbl_rekap
            SET stspaid = 'Paid'
            WHERE id_wadah_rekap = @id_wadah_rekap
              AND nokontrabon = @no_kontrabon;
          `);

        const tagihanRows = await new sql.Request(tx)
          .input("no_invoice", sql.VarChar(255), noKontrabon)
          .query(`
            SELECT kode_t_pengadaan, total_tagihan
            FROM dbo.GWEN_t_tagihan
            WHERE no_invoice = @no_invoice
              AND ISNULL(is_void, 0) = 0
              AND ISNULL(status, 1) = 1
              AND EXISTS (
                SELECT 1
                FROM dbo.GWEN_t_kontrabon k
                WHERE k.no_kontrabon = @no_invoice
                  AND (
                    k.kode_t_pengadaan IS NULL
                    OR LTRIM(RTRIM(k.kode_t_pengadaan)) = ''
                    OR (
                      ',' + REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(k.kode_t_pengadaan, ''), '[', ''), ']', ''), CHAR(34), ''), CHAR(39), '') + ','
                      LIKE '%,' + LTRIM(RTRIM(ISNULL(dbo.GWEN_t_tagihan.kode_t_pengadaan, ''))) + ',%'
                    )
                  )
              );
          `);

        for (const row of tagihanRows.recordset || []) {
          const kodePembayaran = await generateDocCode({ prefix: "PBT", tx });
          await new sql.Request(tx)
            .input("kode_t_pembayaran_tagihan", sql.VarChar(255), kodePembayaran)
            .input("kode_t_pengadaan", sql.VarChar(255), row.kode_t_pengadaan || null)
            .input("jenis_pembayaran", sql.NVarChar(50), "PELUNASAN")
            .input("jumlah_dibayar", sql.Decimal(20, 2), row.total_tagihan ?? 0)
            .input("keterangan", sql.NVarChar(255), `PELUNASAN KONTRABON ${noKontrabon}`)
            .input("created_by", sql.VarChar(100), paidBy)
            .input("created_at", sql.DateTime, now)
            .query(`
              INSERT INTO dbo.GWEN_t_pembayaran_tagihan (
                kode_t_pembayaran_tagihan,
                kode_t_pengadaan,
                jenis_pembayaran,
                jumlah_dibayar,
                keterangan,
                status,
                status_cadangan,
                created_by,
                created_at
              )
              VALUES (
                @kode_t_pembayaran_tagihan,
                @kode_t_pengadaan,
                @jenis_pembayaran,
                @jumlah_dibayar,
                @keterangan,
                1,
                NULL,
                @created_by,
                @created_at
              );
            `);
        }

        const supplierRes = await new sql.Request(tx)
          .input("no_kontrabon", sql.VarChar(255), noKontrabon)
          .query(`
            SELECT k.kode_supplier, k.no_faktur, k.tgl_faktur, k.nominal_total, k.nama_bank, k.atas_nama, k.no_rekening, k.cabang,
                   s.nama AS nama_supplier
            FROM dbo.GWEN_t_kontrabon k
            LEFT JOIN dbo.m_supplier s
              ON s.kode_supplier COLLATE DATABASE_DEFAULT = k.kode_supplier COLLATE DATABASE_DEFAULT
            WHERE no_kontrabon = @no_kontrabon;
          `);
        const supplierRow = supplierRes.recordset?.[0];
        const kodeSupplier = supplierRow?.kode_supplier;
        if (kodeSupplier) {
          const totalTagihanRes = await new sql.Request(tx)
            .input("no_invoice", sql.VarChar(255), noKontrabon)
            .query(`
              SELECT SUM(ISNULL(total_tagihan, 0)) AS total_tagihan
              FROM dbo.GWEN_t_tagihan
              WHERE no_invoice = @no_invoice
                AND ISNULL(is_void, 0) = 0
                AND ISNULL(status, 1) = 1
                AND EXISTS (
                  SELECT 1
                  FROM dbo.GWEN_t_kontrabon k
                  WHERE k.no_kontrabon = @no_invoice
                    AND (
                      k.kode_t_pengadaan IS NULL
                      OR LTRIM(RTRIM(k.kode_t_pengadaan)) = ''
                      OR (
                        ',' + REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(k.kode_t_pengadaan, ''), '[', ''), ']', ''), CHAR(34), ''), CHAR(39), '') + ','
                        LIKE '%,' + LTRIM(RTRIM(ISNULL(dbo.GWEN_t_tagihan.kode_t_pengadaan, ''))) + ',%'
                      )
                    )
                );
            `);
          const totalTagihan = totalTagihanRes.recordset?.[0]?.total_tagihan ?? supplierRow?.nominal_total ?? 0;
          const message = [
            "Kepada Yth.",
            `*${supplierRow?.nama_supplier || kodeSupplier}*`,
            "",
            `Dengan pemberitahuan ini, kami telah melakukan pelunasan tagihan kepada *${supplierRow?.nama_supplier || kodeSupplier}*, dengan rincian sebagai berikut:`,
            "--------------------------------------------",
            `Nomor Kontrabon: *${noKontrabon}*`,
            `Nomor Faktur: *${supplierRow?.no_faktur || "-"}*`,
            `Tanggal Faktur: *${supplierRow?.tgl_faktur ? new Date(supplierRow.tgl_faktur).toLocaleDateString("id-ID") : "-"}*`,
            `Tanggal Pelunasan: *${new Date(now).toLocaleDateString("id-ID")}*`,
            "Status: *Paid*",
            `Total Tagihan: *${formatIDR(totalTagihan)}*`,
            "--------------------------------------------",
            "Pembayaran kami dilakukan melalui transfer bank dengan detail sebagai berikut:",
            "--------------------------------------------",
            `Nama Bank: *${supplierRow?.nama_bank || "-"}*`,
            `Atas Nama: *${supplierRow?.atas_nama || "-"}*`,
            `Nomor Rekening: *${supplierRow?.no_rekening || "-"}*`,
            `Cabang: *${supplierRow?.cabang || "-"}*`,
            "--------------------------------------------",
            "*#NB :* Mohon untuk mengkonfirmasi penerimaan pembayaran ini. Komplain paling lambat 3 bulan setelah pembayaran diterima. [untuk detail rincian bisa unduh di aplikasi PPJ]",
            "Terima kasih atas perhatian dan kerjasamanya.",
            "",
            "Hormat kami,",
            "",
            "*Bag. Keuangan*",
            "*CV. Sinar Inti Lestari (GWEN Cosmetic)*",
          ].join("\n");

          const contactRes = await new sql.Request(tx)
            .input("kode_supplier", sql.VarChar(255), kodeSupplier)
            .query(`
              SELECT nilai
              FROM dbo.m_supplier_contact
              WHERE kode_supplier = @kode_supplier
                AND ISNULL(is_active, 0) = 1
                AND nilai IS NOT NULL
                AND LTRIM(RTRIM(nilai)) <> '';
            `);

          for (const contact of contactRes.recordset || []) {
            await new sql.Request(tx)
              .input("nomor_tujuan", sql.NVarChar(50), String(contact.nilai))
              .input("isi_pesan", sql.NVarChar(sql.MAX), message)
              .input("link_trigger", sql.NVarChar(500), null)
              .input("status_kirim", sql.NVarChar(50), "PENDING")
              .input("jenis_pesan", sql.NVarChar(50), "PELUNASAN_KONTRABON")
              .input("kode_referensi", sql.NVarChar(100), noKontrabon)
              .input("tipe_referensi", sql.NVarChar(50), "KONTRABON")
              .input("created_at", sql.DateTime, now)
              .query(`
                INSERT INTO dbo.GWEN_temp_pesan_wa (
                  nomor_tujuan,
                  isi_pesan,
                  link_trigger,
                  status_kirim,
                  jenis_pesan,
                  kode_referensi,
                  tipe_referensi,
                  created_at
                )
                VALUES (
                  @nomor_tujuan,
                  @isi_pesan,
                  @link_trigger,
                  @status_kirim,
                  @jenis_pesan,
                  @kode_referensi,
                  @tipe_referensi,
                  @created_at
                );
              `);
          }

          await new sql.Request(tx)
            .input("id_wadah_rekap", sql.Int, Number(id))
            .input("no_kontrabon", sql.VarChar(255), noKontrabon)
            .query(`
              UPDATE dbo.GWEN_tbl_rekap
              SET status_notif_wa = 'PENDING'
              WHERE id_wadah_rekap = @id_wadah_rekap
                AND nokontrabon = @no_kontrabon;
            `);
        }
      }

      await new sql.Request(tx)
        .input("id_wadah_rekap", sql.Int, Number(id))
        .input("status_rekap", sql.VarChar(50), "Paid")
        .input("approved_by", sql.VarChar(100), paidBy)
        .input("approved_at", sql.DateTime2, now)
        .query(`
          UPDATE dbo.GWEN_wadah_rekap
          SET status_rekap = @status_rekap,
              approved_by = @approved_by,
              approved_at = @approved_at
          WHERE id = @id_wadah_rekap;
        `);

      await tx.commit();
      return reply.send({ success: true });
    } catch (err) {
      await tx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed pelunasan rekap");
      return reply.code(500).send({ message: "Gagal proses pelunasan" });
    }
  });

  fastify.delete("/rekap/:id/items/:no", async (request, reply) => {
    const { id, no } = request.params || {};
    if (!id || !no) return reply.code(400).send({ message: "id dan no wajib diisi" });
    try {
      const res = await pool
        .request()
        .input("id_wadah_rekap", sql.Int, Number(id))
        .input("no", sql.Int, Number(no))
        .query(
          `
          DELETE FROM dbo.GWEN_tbl_rekap
          WHERE id_wadah_rekap = @id_wadah_rekap
            AND [no] = @no;
        `
        );
      if (!res.rowsAffected?.[0]) {
        return reply.code(404).send({ message: "Item rekap tidak ditemukan" });
      }
      return reply.send({ message: "Item rekap dihapus" });
    } catch (err) {
      fastify.log.error({ err }, "Failed delete rekap item");
      return reply.code(500).send({ message: "Gagal menghapus item rekap" });
    }
  });

  fastify.get("/:no", async (request, reply) => {
    const { no } = request.params || {};
    if (!no) return reply.code(400).send({ message: "no_kontrabon wajib diisi" });
    try {
      const req = pool.request();
      req.input("no_kontrabon", sql.VarChar(255), String(no));
      const headerRes = await req.query(`
        SELECT TOP 1
          k.*,
          s.nama AS supplier_nama
        FROM dbo.GWEN_t_kontrabon k
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = k.kode_supplier COLLATE DATABASE_DEFAULT
        WHERE k.no_kontrabon = @no_kontrabon
        ORDER BY k.created_at DESC;
      `);
      const header = headerRes.recordset?.[0];
      if (!header) {
        return reply.code(404).send({ message: "Kontrabon tidak ditemukan" });
      }

      const activePengadaanCodes = parsePengadaanCodes(header.kode_t_pengadaan);
      const tagihanReq = pool.request().input("no_invoice", sql.VarChar(255), String(no));
      const tagihanFilters = ["t.no_invoice = @no_invoice"];
      if (activePengadaanCodes.length > 0) {
        const params = [];
        activePengadaanCodes.forEach((kode, idx) => {
          const param = `kode_t_pengadaan_${idx}`;
          tagihanReq.input(param, sql.VarChar(255), kode);
          params.push(`@${param}`);
        });
        tagihanFilters.push(`t.kode_t_pengadaan IN (${params.join(", ")})`);
      }
      const tagihanRes = await tagihanReq.query(`
        SELECT
          t.kode_t_tagihan,
          t.kode_t_pengadaan,
          t.no_invoice,
          t.no_faktur_supplier,
          t.tgl,
          t.tgl_jatuh_tempo,
          t.total_tagihan,
          t.total_dibayar,
          t.is_lunas,
          t.catatan,
          p.no_faktur_supplier AS pengadaan_no_faktur_supplier,
          p.tgl AS pengadaan_tgl,
          p.total_akhir AS pengadaan_total_akhir
        FROM dbo.GWEN_t_tagihan
        t
        LEFT JOIN dbo.GWEN_t_pengadaan p
          ON p.kode_t_pengadaan = t.kode_t_pengadaan
        WHERE ${tagihanFilters.join(" AND ")}
          AND ISNULL(t.is_void, 0) = 0
          AND ISNULL(t.status, 1) = 1
        ORDER BY t.created_at ASC, t.kode_t_tagihan ASC;
      `);

      return reply.send({
        header,
        tagihan: tagihanRes.recordset || [],
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch kontrabon detail");
      return reply.code(500).send({ message: "Gagal memuat kontrabon" });
    }
  });

    fastify.put("/:no", async (request, reply) => {
      const { no } = request.params || {};
      const body = request.body || {};
      const pengadaanList = Array.isArray(body.kode_t_pengadaan_list)
        ? body.kode_t_pengadaan_list.map((k) => String(k || "").trim()).filter(Boolean)
        : [];
      const uniquePengadaanList = [...new Set(pengadaanList)];
      if (!no) return reply.code(400).send({ message: "no_kontrabon wajib diisi" });
      const biayaLainPayload =
        typeof body.biaya_lain === "string" ? body.biaya_lain : JSON.stringify(body.biaya_lain || []);
      const updatedBy = String(body.updated_by || "Admin").trim() || "Admin";
      const now = new Date();
      const normalizedAmounts = normalizeKontrabonAmounts({
        nominal_faktur: body.nominal_faktur,
        nominal_total: body.nominal_total,
        biaya_lain: body.biaya_lain,
      });
      let tx;
      try {
        tx = new sql.Transaction(pool);
        await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

        const currentRes = await new sql.Request(tx)
          .input("no_kontrabon", sql.VarChar(255), String(no))
          .query(`
            SELECT TOP 1 kode_t_pengadaan
            FROM dbo.GWEN_t_kontrabon
            WHERE no_kontrabon = @no_kontrabon;
          `);
        const currentPengadaanSet = new Set(parsePengadaanCodes(currentRes.recordset?.[0]?.kode_t_pengadaan));
        const addedPengadaanList = uniquePengadaanList.filter((kode) => !currentPengadaanSet.has(kode));
        if (addedPengadaanList.length > 0) {
          const paidReq = new sql.Request(tx);
          const paidParams = [];
          addedPengadaanList.forEach((kode, idx) => {
            const param = `paid_kode_${idx}`;
            paidReq.input(param, sql.VarChar(255), kode);
            paidParams.push(`@${param}`);
          });
          const paidRes = await paidReq.query(`
            SELECT kode_t_pengadaan
            FROM dbo.GWEN_t_tagihan
            WHERE kode_t_pengadaan IN (${paidParams.join(", ")})
              AND ISNULL(status, 1) = 1
              AND ISNULL(is_void, 0) = 0
            GROUP BY kode_t_pengadaan
            HAVING SUM(ISNULL(total_tagihan, 0)) > 0
              AND SUM(ISNULL(total_dibayar, 0)) >= SUM(ISNULL(total_tagihan, 0));
          `);
          const paidPengadaan = (paidRes.recordset || [])
            .map((row) => String(row.kode_t_pengadaan || "").trim())
            .filter(Boolean);
          if (paidPengadaan.length > 0) {
            throw new Error(`Pengadaan ${paidPengadaan.join(", ")} sudah PAID dan tidak bisa dipilih kembali`);
          }
        }

        const req = new sql.Request(tx);
        req.input("no_kontrabon", sql.VarChar(255), String(no));
        req.input("no_faktur", sql.VarChar(255), body.no_faktur || null);
        req.input(
          "kode_t_pengadaan",
          sql.VarChar(sql.MAX),
          uniquePengadaanList.length ? JSON.stringify(uniquePengadaanList) : null
        );
        req.input("id_rekening", sql.Int, body.id_rekening ?? null);
        req.input("no_rekening", sql.VarChar(255), body.no_rekening || null);
        req.input("atas_nama", sql.VarChar(255), body.atas_nama || null);
        req.input("nama_bank", sql.VarChar(255), body.nama_bank || null);
        req.input("cabang", sql.VarChar(255), body.cabang || null);
        req.input("tgl_kontrabon", sql.DateTime, body.tgl_kontrabon ? new Date(body.tgl_kontrabon) : null);
        req.input("tgl_faktur", sql.DateTime, body.tgl_faktur ? new Date(body.tgl_faktur) : null);
        req.input("tgl_ppj", sql.DateTime, body.tgl_ppj ? new Date(body.tgl_ppj) : null);
        req.input("rencana_tf_dari", sql.DateTime, body.rencana_tf_dari ? new Date(body.rencana_tf_dari) : null);
        req.input("rencana_tf_sampai", sql.DateTime, body.rencana_tf_sampai ? new Date(body.rencana_tf_sampai) : null);
        req.input("nominal_faktur", sql.Decimal(20, 2), normalizedAmounts.nominalFaktur || null);
        req.input("nominal_total", sql.Decimal(20, 2), normalizedAmounts.nominalTotal || null);
        req.input("biaya_lain", sql.NVarChar(sql.MAX), biayaLainPayload || null);
        req.input("no_faktur_pajak", sql.VarChar(255), body.no_faktur_pajak || null);
        req.input("tgl_faktur_pajak", sql.DateTime, body.tgl_faktur_pajak ? new Date(body.tgl_faktur_pajak) : null);
        const result = await req.query(`
          UPDATE dbo.GWEN_t_kontrabon
          SET
            kode_t_pengadaan = COALESCE(@kode_t_pengadaan, kode_t_pengadaan),
            no_faktur = @no_faktur,
            id_rekening = COALESCE(@id_rekening, id_rekening),
            no_rekening = COALESCE(@no_rekening, no_rekening),
            atas_nama = COALESCE(@atas_nama, atas_nama),
            nama_bank = COALESCE(@nama_bank, nama_bank),
            cabang = COALESCE(@cabang, cabang),
            tgl_kontrabon = @tgl_kontrabon,
            tgl_faktur = @tgl_faktur,
            tgl_ppj = @tgl_ppj,
            rencana_tf_dari = @rencana_tf_dari,
            rencana_tf_sampai = @rencana_tf_sampai,
            nominal_faktur = @nominal_faktur,
            nominal_total = @nominal_total,
            biaya_lain = @biaya_lain,
            nomor_faktur_pajak = @no_faktur_pajak,
            tanggal_faktur_pajak = @tgl_faktur_pajak
          WHERE no_kontrabon = @no_kontrabon;
        `);

        if (result.rowsAffected?.[0] === 0) {
          await tx.rollback();
          return reply.code(404).send({ message: "Kontrabon tidak ditemukan" });
        }

        if (uniquePengadaanList.length > 0) {
          const voidReq = new sql.Request(tx)
            .input("no_invoice", sql.VarChar(255), String(no))
            .input("updated_by", sql.VarChar(100), updatedBy)
            .input("updated_at", sql.DateTime2, now);
          const keepParams = [];
          uniquePengadaanList.forEach((kode, idx) => {
            const param = `keep_kode_${idx}`;
            voidReq.input(param, sql.VarChar(255), kode);
            keepParams.push(`@${param}`);
          });
          await voidReq.query(`
            UPDATE dbo.GWEN_t_tagihan
            SET is_void = 1,
                status = 0,
                void_by = @updated_by,
                void_at = @updated_at,
                updated_by = @updated_by,
                updated_at = @updated_at
            WHERE no_invoice = @no_invoice
              AND ISNULL(is_void, 0) = 0
              AND ISNULL(status, 1) = 1
              AND (
                kode_t_pengadaan IS NULL
                OR LTRIM(RTRIM(kode_t_pengadaan)) = ''
                OR kode_t_pengadaan NOT IN (${keepParams.join(", ")})
              );
          `);
        }

        await syncActiveTagihanTotals({
          tx,
          noInvoice: String(no),
          kodePengadaanList: uniquePengadaanList,
          nominalTotal: normalizedAmounts.nominalFaktur,
          noFaktur: body.no_faktur,
          tglFaktur: body.tgl_faktur,
          tglJatuhTempo: body.rencana_tf_sampai,
          noFakturPajak: body.no_faktur_pajak,
          tglFakturPajak: body.tgl_faktur_pajak,
          updatedBy,
          now,
        });

        await tx.commit();
        return reply.send({ message: "Kontrabon berhasil diupdate" });
    } catch (err) {
      if (tx) await tx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed update kontrabon");
      const message = String(err?.message || "");
      if (
        message.startsWith("Nominal faktur") ||
        message.startsWith("Pengadaan ")
      ) {
        return reply.code(400).send({ message: err.message });
      }
      return reply.code(500).send({ message: "Gagal update kontrabon" });
    }
  });

  fastify.patch("/:no/status", async (request, reply) => {
    const { no } = request.params || {};
    const { status, updated_by } = request.body || {};
    if (!no) return reply.code(400).send({ message: "no_kontrabon wajib diisi" });
    const nextStatus = Number.isFinite(Number(status)) ? Number(status) : 0;
    try {
      const req = pool.request();
      req.input("no_kontrabon", sql.VarChar(255), String(no));
      req.input("status", sql.Int, nextStatus);
      req.input("updated_by", sql.VarChar(100), updated_by || "Admin");
      req.input("updated_at", sql.DateTime2, new Date());
      const result = await req.query(`
        UPDATE dbo.GWEN_t_kontrabon
        SET status = @status,
            updated_by = @updated_by,
            updated_at = @updated_at
        WHERE no_kontrabon = @no_kontrabon;
      `);
      if (result.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Kontrabon tidak ditemukan" });
      }
      return reply.send({ message: "Status kontrabon diperbarui" });
    } catch (err) {
      fastify.log.error({ err }, "Failed update kontrabon status");
      return reply.code(500).send({ message: "Gagal update status kontrabon" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const kodeSupplier = String(body.kode_supplier || "").trim();
    const nomorKontrabonRequest = String(body.no_kontrabon || "").trim();
    const pengadaanList = Array.isArray(body.kode_t_pengadaan_list)
      ? body.kode_t_pengadaan_list.map((k) => String(k || "").trim()).filter(Boolean)
      : [];
    const biayaLain = Array.isArray(body.biaya_lain) ? body.biaya_lain : [];
    const createdBy = String(body.created_by || "Admin").trim() || "Admin";
    const now = new Date();
    const normalizedAmounts = normalizeKontrabonAmounts({
      nominal_faktur: body.nominal_faktur,
      nominal_total: body.nominal_total,
      biaya_lain: biayaLain,
    });

    if (
      !kodeSupplier ||
      !body.id_rekening ||
      pengadaanList.length === 0 ||
      !body.tgl_kontrabon ||
      !body.tgl_faktur ||
      !body.tgl_ppj ||
      !body.rencana_tf_dari ||
      !body.rencana_tf_sampai ||
      !body.nominal_faktur ||
      !body.no_faktur
    ) {
      return reply.code(400).send({ message: "Form kontrabon belum lengkap" });
    }

    const uniquePengadaan = [...new Set(pengadaanList)];
    const tx = new sql.Transaction(pool);
    try {
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      let nomorKontrabon = nomorKontrabonRequest;
      const existsCheck = async (code) => {
        const req = new sql.Request(tx);
        req.input("code", sql.VarChar(255), code);
        const res = await req.query(`
          SELECT 1 FROM dbo.GWEN_t_kontrabon WHERE no_kontrabon = @code
          UNION ALL
          SELECT 1 FROM dbo.GWEN_t_tagihan WHERE no_invoice = @code;
        `);
        return res.recordset?.length > 0;
      };

      if (!nomorKontrabon || (await existsCheck(nomorKontrabon))) {
        nomorKontrabon = await generateKontrabonCode(tx);
        let guard = 0;
        while (await existsCheck(nomorKontrabon)) {
          guard += 1;
          if (guard > 10) break;
          const num = Number(nomorKontrabon.replace(/[^\d]/g, "")) || 0;
          nomorKontrabon = `GPF${num + 1}`;
        }
      }

      const supplierRes = await new sql.Request(tx)
        .input("kode_supplier", sql.VarChar(100), kodeSupplier)
        .query(`SELECT TOP 1 nama FROM dbo.m_supplier WHERE kode_supplier = @kode_supplier`);
      const supplierNama = supplierRes.recordset?.[0]?.nama || body.nama_supplier || null;

      const requestedNominalTotal = normalizedAmounts.nominalFaktur;
      const tagihanCodes = [];
      let createdTagihanTotal = 0;
      for (const kodeT of uniquePengadaan) {
        const pengRes = await new sql.Request(tx)
          .input("kode_t_pengadaan", sql.VarChar(255), kodeT)
          .query(`
            SELECT TOP 1
              kode_t_pengadaan,
              kode_t_rpo,
              kode_supplier,
              total,
              diskon,
              total_stlh_diskon,
              total_sblm_ppn,
              ppn,
              total_akhir,
              no_faktur_supplier
            FROM dbo.GWEN_t_pengadaan
            WHERE kode_t_pengadaan = @kode_t_pengadaan
              AND ISNULL(status, 1) = 1
          `);
        if (!pengRes.recordset?.[0]) {
          throw new Error(`Pengadaan tidak ditemukan atau sudah nonaktif: ${kodeT}`);
        }
        const peng = pengRes.recordset[0];
        const existingTagihanRes = await new sql.Request(tx)
          .input("kode_t_pengadaan", sql.VarChar(255), kodeT)
          .query(`
            SELECT
              SUM(ISNULL(total_tagihan, 0)) AS total_tagihan_aktif,
              SUM(ISNULL(total_dibayar, 0)) AS total_dibayar_aktif
            FROM dbo.GWEN_t_tagihan
            WHERE kode_t_pengadaan = @kode_t_pengadaan
              AND ISNULL(status, 1) = 1
              AND ISNULL(is_void, 0) = 0;
          `);
        const activeTagihanTotal = roundMoney(existingTagihanRes.recordset?.[0]?.total_tagihan_aktif ?? 0);
        const activeDibayarTotal = roundMoney(existingTagihanRes.recordset?.[0]?.total_dibayar_aktif ?? 0);
        if (activeTagihanTotal > 0 && activeDibayarTotal >= activeTagihanTotal) {
          throw new Error(`Pengadaan ${kodeT} sudah PAID dan tidak bisa dipilih kembali`);
        }
        const totalAkhirPengadaan = roundMoney(peng.total_akhir ?? peng.total_sblm_ppn ?? peng.total ?? 0);
        const sisaTagihanPengadaan = roundMoney(totalAkhirPengadaan - activeTagihanTotal);
        if (sisaTagihanPengadaan <= 0) {
          throw new Error(`Pengadaan ${kodeT} sudah tidak memiliki sisa tagihan untuk kontrabon baru`);
        }
        const kode_t_tagihan = await generateDocCode({ prefix: "TAG", tx });
        tagihanCodes.push(kode_t_tagihan);

        let totalTagihan = sisaTagihanPengadaan;
        if (uniquePengadaan.length === 1 && requestedNominalTotal > 0) {
          if (requestedNominalTotal > sisaTagihanPengadaan) {
            throw new Error(
              `Nominal kontrabon ${requestedNominalTotal} melebihi sisa tagihan ${sisaTagihanPengadaan} untuk ${kodeT}`
            );
          }
          totalTagihan = requestedNominalTotal;
        }
        createdTagihanTotal = roundMoney(createdTagihanTotal + totalTagihan);

        const pengSubtotal = roundMoney(peng.total ?? peng.total_akhir ?? 0);
        const pengDiskon = roundMoney(peng.diskon ?? 0);
        const pengTotalStlhDiskon = roundMoney(peng.total_stlh_diskon ?? pengSubtotal - pengDiskon);
        const pengTotalSblmPpn = roundMoney(peng.total_sblm_ppn ?? pengTotalStlhDiskon);
        const ratio = totalAkhirPengadaan > 0 ? totalTagihan / totalAkhirPengadaan : 0;
        const subtotal = roundMoney(pengSubtotal * ratio);
        const diskon = roundMoney(pengDiskon * ratio);
        const totalStlhDiskon = roundMoney(pengTotalStlhDiskon * ratio);
        const totalSblmPpn = roundMoney(pengTotalSblmPpn * ratio);
        const ppn = roundMoney(totalTagihan - totalSblmPpn);

        await new sql.Request(tx)
          .input("kode_t_tagihan", sql.VarChar(255), kode_t_tagihan)
          .input("kode_t_pengadaan", sql.VarChar(255), kodeT)
          .input("kode_t_rpo", sql.VarChar(255), peng.kode_t_rpo || null)
          .input("kode_lpb", sql.VarChar(255), null)
          .input("kode_supplier", sql.VarChar(255), kodeSupplier)
          .input("nama_supplier", sql.VarChar(255), supplierNama)
          .input("no_invoice", sql.VarChar(255), nomorKontrabon)
          .input("no_faktur_supplier", sql.VarChar(255), peng.no_faktur_supplier || body.no_faktur || null)
          .input("tgl", sql.DateTime, new Date(body.tgl_faktur))
          .input("tgl_jatuh_tempo", sql.DateTime, new Date(body.rencana_tf_sampai))
          .input("subtotal", sql.Decimal(20, 2), subtotal)
          .input("diskon", sql.Decimal(20, 2), diskon)
          .input("total_stlh_diskon", sql.Decimal(20, 2), totalStlhDiskon)
          .input("total_sblm_ppn", sql.Decimal(20, 2), totalSblmPpn)
          .input("ppn", sql.Decimal(20, 2), ppn)
          .input("total_tagihan", sql.Decimal(20, 2), totalTagihan)
          .input("total_dibayar", sql.Decimal(20, 2), 0)
          .input("is_lunas", sql.Int, 0)
          .input("tgl_lunas", sql.DateTime, null)
          .input("catatan", sql.VarChar(255), body.catatan_tambahan || null)
          .input("metode_bayar", sql.VarChar(255), null)
          .input("bank", sql.VarChar(255), body.nama_bank || null)
          .input("status_verifikasi", sql.Int, 0)
          .input("verifikasi_by", sql.VarChar(255), null)
          .input("verifikasi_at", sql.DateTime, null)
          .input("is_void", sql.Int, 0)
          .input("void_by", sql.VarChar(255), null)
          .input("void_at", sql.DateTime, null)
          .input("status", sql.Int, 1)
          .input("status_cadangan", sql.Int, 1)
          .input("created_by", sql.VarChar(255), createdBy)
          .input("created_at", sql.DateTime, now)
          .input("updated_by", sql.VarChar(255), createdBy)
          .input("updated_at", sql.DateTime, now)
          .input("no_faktur_pajak_pembelian", sql.VarChar(255), body.no_faktur_pajak || null)
          .input(
            "tgl_faktur_pajak_pembelian",
            sql.DateTime,
            body.tgl_faktur_pajak ? new Date(body.tgl_faktur_pajak) : null
          )
          .input("ket", sql.VarChar(sql.MAX), body.ket || null)
          .query(
            `
            INSERT INTO dbo.GWEN_t_tagihan (
              kode_t_tagihan, kode_t_pengadaan, kode_t_rpo, kode_lpb, kode_supplier, nama_supplier, no_invoice,
              no_faktur_supplier, tgl, tgl_jatuh_tempo, subtotal, diskon, total_stlh_diskon, total_sblm_ppn, ppn,
              total_tagihan, total_dibayar, is_lunas, tgl_lunas, catatan, metode_bayar, bank, status_verifikasi,
              verifikasi_by, verifikasi_at, is_void, void_by, void_at, status, status_cadangan, created_by, created_at,
              updated_by, updated_at, no_faktur_pajak_pembelian, tgl_faktur_pajak_pembelian, ket
            ) VALUES (
              @kode_t_tagihan, @kode_t_pengadaan, @kode_t_rpo, @kode_lpb, @kode_supplier, @nama_supplier, @no_invoice,
              @no_faktur_supplier, @tgl, @tgl_jatuh_tempo, @subtotal, @diskon, @total_stlh_diskon, @total_sblm_ppn, @ppn,
              @total_tagihan, @total_dibayar, @is_lunas, @tgl_lunas, @catatan, @metode_bayar, @bank, @status_verifikasi,
              @verifikasi_by, @verifikasi_at, @is_void, @void_by, @void_at, @status, @status_cadangan, @created_by, @created_at,
              @updated_by, @updated_at, @no_faktur_pajak_pembelian, @tgl_faktur_pajak_pembelian, @ket
            );
          `
          );
      }

      if (
        uniquePengadaan.length > 1 &&
        roundMoney(normalizedAmounts.nominalFaktur) !== roundMoney(createdTagihanTotal)
      ) {
        throw new Error(
          `Nominal faktur ${roundMoney(normalizedAmounts.nominalFaktur)} tidak sama dengan total PEN ${roundMoney(
            createdTagihanTotal
          )}`
        );
      }

      await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(sql.MAX), JSON.stringify(uniquePengadaan))
        .input("no_kontrabon", sql.VarChar(255), nomorKontrabon)
        .input("no_faktur", sql.VarChar(255), body.no_faktur || null)
        .input("kode_supplier", sql.VarChar(255), kodeSupplier)
        .input("id_rekening", sql.Int, Number(body.id_rekening))
        .input("no_rekening", sql.VarChar(255), body.no_rekening || null)
        .input("atas_nama", sql.VarChar(255), body.atas_nama || null)
        .input("nama_bank", sql.VarChar(255), body.nama_bank || null)
        .input("cabang", sql.VarChar(255), body.cabang || null)
        .input("tgl_kontrabon", sql.DateTime, new Date(body.tgl_kontrabon))
        .input("tgl_faktur", sql.DateTime, new Date(body.tgl_faktur))
        .input("tgl_ppj", sql.DateTime, new Date(body.tgl_ppj))
        .input("rencana_tf_dari", sql.DateTime, new Date(body.rencana_tf_dari))
        .input("rencana_tf_sampai", sql.DateTime, new Date(body.rencana_tf_sampai))
        .input("nominal_faktur", sql.Decimal(20, 2), normalizedAmounts.nominalFaktur)
        .input("biaya_lain", sql.VarChar(sql.MAX), JSON.stringify(biayaLain))
        .input("nominal_total", sql.Decimal(20, 2), normalizedAmounts.nominalTotal)
        .input("status", sql.Int, 1)
        .input("status_paid", sql.VarChar(50), body.status_paid || "Not Paid")
        .input("catatan_tambahan", sql.VarChar(sql.MAX), body.catatan_tambahan || null)
        .input("tgl_bayar", sql.DateTime, body.tgl_bayar ? new Date(body.tgl_bayar) : null)
        .input("tanggal_faktur_pajak", sql.DateTime, body.tgl_faktur_pajak ? new Date(body.tgl_faktur_pajak) : null)
        .input("nomor_faktur_pajak", sql.VarChar(255), body.no_faktur_pajak || null)
        .input("created_at", sql.DateTime2, now)
        .input("created_by", sql.VarChar(255), createdBy)
        .query(
          `
          INSERT INTO dbo.GWEN_t_kontrabon (
            kode_t_pengadaan, no_kontrabon, no_faktur, kode_supplier, id_rekening, no_rekening, atas_nama, nama_bank,
            cabang, tgl_kontrabon, tgl_faktur, tgl_ppj, rencana_tf_dari, rencana_tf_sampai, nominal_faktur, biaya_lain,
            nominal_total, status, status_paid, catatan_tambahan, tgl_bayar, tanggal_faktur_pajak, nomor_faktur_pajak,
            created_at, created_by
          ) VALUES (
            @kode_t_pengadaan, @no_kontrabon, @no_faktur, @kode_supplier, @id_rekening, @no_rekening, @atas_nama, @nama_bank,
            @cabang, @tgl_kontrabon, @tgl_faktur, @tgl_ppj, @rencana_tf_dari, @rencana_tf_sampai, @nominal_faktur, @biaya_lain,
            @nominal_total, @status, @status_paid, @catatan_tambahan, @tgl_bayar, @tanggal_faktur_pajak, @nomor_faktur_pajak,
            @created_at, @created_by
          );
        `
        );

      await tx.commit();
      return reply.send({ message: "Kontrabon tersimpan", no_kontrabon: nomorKontrabon, tagihan: tagihanCodes });
    } catch (err) {
      await tx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed save kontrabon");
      const message = String(err?.message || "");
      if (
        message.startsWith("Nominal faktur") ||
        message.startsWith("Pengadaan ")
      ) {
        return reply.code(400).send({ message: err.message });
      }
      return reply.code(500).send({ message: "Gagal menyimpan kontrabon" });
    }
  });
}
