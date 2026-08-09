import {
  formatWibSqlDateTime,
  logWibConversion,
  nowWib,
  toWibDate,
  wibDateOnly,
  wibStamp,
} from "../utils/wib-time.js";

export default async function pemindahanRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const generateStockCode = (prefix) => `${prefix}.${wibStamp()}`;

  const generateDocCode = async (tx, prefix, userCode) => {
    try {
      const todayIso = wibDateOnly();
      const req = new sql.Request(tx);
      req.input("Prefix", sql.VarChar(10), prefix);
      req.input("ExecDate", sql.VarChar(10), todayIso);
      req.input("UserCode", sql.VarChar(50), userCode || "Admin");
      req.input("BranchCode", sql.VarChar(10), "YZ");
      req.input("PadLength", sql.Int, 5);
      req.input("Separator", sql.VarChar(5), ".");
      req.output("NextNo", sql.Int);
      req.output("GeneratedCode", sql.VarChar(50));
      await req.execute("GWEN_GenerateDocCode");
      const code = req.parameters.GeneratedCode?.value;
      if (code) return code;
      throw new Error("GeneratedCode kosong");
    } catch (err) {
      fastify.log.error({ err }, "Failed to generate kode via GWEN_GenerateDocCode");
      return `${prefix}.${wibStamp().slice(0, 12)}`;
    }
  };

  const generateDetailCode = (prefix, index) => {
    const idx = String(index).padStart(3, "0");
    return `${prefix}.${wibStamp()}${idx}`;
  };

  const formatQty = (value) => {
    const num = Number(value) || 0;
    return Number.isInteger(num) ? String(num) : String(num);
  };

  const getItemLabel = (item) => {
    const namaBarang = String(item.nama_barang || item.namaBarang || "").trim();
    const namaVarian = String(item.nama_varian || item.namaVarian || "").trim();
    const kodeVarian = String(item.kode_barang_variant || "").trim();
    const parts = [namaBarang, namaVarian].filter(Boolean);
    const label = parts.length ? parts.join(" - ") : kodeVarian || "item tidak diketahui";
    return kodeVarian && !label.includes(kodeVarian) ? `${label} (${kodeVarian})` : label;
  };

  const createStockError = (baseMessage, item, details = {}) => {
    const parts = [`${baseMessage}: ${getItemLabel(item)}`];
    if (typeof details.requested !== "undefined") parts.push(`diminta ${formatQty(details.requested)}`);
    if (typeof details.available !== "undefined") parts.push(`tersedia ${formatQty(details.available)}`);
    return new Error(parts.join(", "));
  };

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const tgl = toWibDate(body.tgl, { sourceTz: "Asia/Jakarta" });
    const lokasiAsalTipeInput = String(body.lokasi_asal_tipe || "").trim().toUpperCase();
    const lokasiAsalKodeInput = String(body.lokasi_asal_kode || "").trim();
    const gudangAsalLegacy = String(body.gudang_asal || "").trim();
    const lokasiAsalTipe = lokasiAsalTipeInput || (gudangAsalLegacy ? "GUDANG" : "");
    const lokasiAsalKode = lokasiAsalKodeInput || gudangAsalLegacy;
    const tujuanTipe = String(body.tujuan_tipe || "").trim().toUpperCase();
    const tujuanKode = String(body.tujuan_kode || "").trim();
    const catatan = body.catatan ? String(body.catatan).trim() : null;
    const createdBy = body.created_by ? String(body.created_by).trim() : "Admin";
    const items = Array.isArray(body.items) ? body.items : [];

    if (!tgl || Number.isNaN(tgl.getTime())) {
      return reply.code(400).send({ message: "tgl wajib diisi" });
    }
    if (!lokasiAsalKode) {
      return reply.code(400).send({ message: "lokasi asal wajib diisi" });
    }
    if (!["GUDANG", "TOKO"].includes(lokasiAsalTipe)) {
      return reply.code(400).send({ message: "tipe lokasi asal tidak valid" });
    }
    if (!["GUDANG", "TOKO"].includes(tujuanTipe)) {
      return reply.code(400).send({ message: "tipe lokasi tujuan tidak valid" });
    }
    if (!tujuanTipe || !tujuanKode) {
      return reply.code(400).send({ message: "tujuan wajib diisi" });
    }
    if (lokasiAsalTipe === tujuanTipe && lokasiAsalKode === tujuanKode) {
      return reply.code(400).send({ message: "lokasi asal dan tujuan tidak boleh sama" });
    }
    if (!items.length) {
      return reply.code(400).send({ message: "items wajib diisi" });
    }

    logWibConversion(fastify.log, {
      route: "pemindahan.create",
      field: "tgl",
      source: body.tgl ?? null,
      converted_wib: formatWibSqlDateTime(tgl),
      sql_value: formatWibSqlDateTime(tgl),
    });

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const kodeTPemindahan = await generateDocCode(tx, "TPM", createdBy);
      if (!kodeTPemindahan) {
        throw new Error("Gagal generate kode pemindahan");
      }

      await new sql.Request(tx)
        .input("kode_t_pemindahan", sql.VarChar(50), kodeTPemindahan)
        .input("tipe_lokasi_dari", sql.VarChar(20), lokasiAsalTipe)
        .input("kode_lokasi_dari", sql.VarChar(50), lokasiAsalKode)
        .input("tipe_lokasi_tujuan", sql.VarChar(20), tujuanTipe)
        .input("kode_lokasi_tujuan", sql.VarChar(50), tujuanKode)
        .input("catatan", sql.VarChar(255), catatan)
        .input("status_pemindahan", sql.Int, 1)
        .input("tgl", sql.DateTime2, tgl)
        .input("created_by", sql.VarChar(100), createdBy)
        .input("created_at", sql.DateTime2, nowWib())
        .input("updated_by", sql.VarChar(100), createdBy)
        .input("updated_at", sql.DateTime2, nowWib())
        .query(
          `INSERT INTO dbo.GWEN_t_pemindahan (
            kode_t_pemindahan,
            tipe_lokasi_dari,
            kode_lokasi_dari,
            tipe_lokasi_tujuan,
            kode_lokasi_tujuan,
            catatan,
            status_pemindahan,
            tgl,
            created_by,
            created_at,
            updated_by,
            updated_at
          )
          VALUES (
            @kode_t_pemindahan,
            @tipe_lokasi_dari,
            @kode_lokasi_dari,
            @tipe_lokasi_tujuan,
            @kode_lokasi_tujuan,
            @catatan,
            @status_pemindahan,
            @tgl,
            @created_by,
            @created_at,
            @updated_by,
            @updated_at
          );`
        );

      let detailIndex = 1;
      for (const item of items) {
        const qtyBaikPindah = Number(item.qty_baik_pindah ?? item.qty_pindah ?? 0);
        const qtyRusakPindah = Number(item.qty_rusak_pindah ?? 0);
        const qtyTotalPindah = qtyBaikPindah + qtyRusakPindah;
        if (!qtyTotalPindah || qtyTotalPindah <= 0) continue;
        const kodeDPemindahan = generateDetailCode("DPM", detailIndex++);
        await new sql.Request(tx)
          .input("kode_d_pemindahan", sql.VarChar(50), kodeDPemindahan)
          .input("kode_t_pemindahan", sql.VarChar(50), kodeTPemindahan)
          .input("kode_barang", sql.VarChar(50), item.kode_barang || null)
          .input("kode_barang_variant", sql.VarChar(50), item.kode_barang_variant || null)
          .input("jml_baik_pindah", sql.Decimal(20, 2), qtyBaikPindah)
          .input("satuan_jml_baik", sql.VarChar(50), item.satuan || "PCS")
          .input("jml_rusak_pindah", sql.Decimal(20, 2), qtyRusakPindah)
          .input("satuan_jml_rusak", sql.VarChar(50), item.satuan || "PCS")
          .input("status", sql.Int, 1)
          .input("created_by", sql.VarChar(100), createdBy)
          .input("created_at", sql.DateTime2, nowWib())
          .input("updated_by", sql.VarChar(100), createdBy)
          .input("updated_at", sql.DateTime2, nowWib())
          .query(
            `INSERT INTO dbo.GWEN_d_pemindahan (
              kode_d_pemindahan,
              kode_t_pemindahan,
              kode_barang,
              kode_barang_variant,
              jml_baik_pindah,
              satuan_jml_baik,
              jml_rusak_pindah,
              satuan_jml_rusak,
              status,
              created_by,
              created_at,
              updated_by,
              updated_at
            )
            VALUES (
              @kode_d_pemindahan,
              @kode_t_pemindahan,
              @kode_barang,
              @kode_barang_variant,
              @jml_baik_pindah,
              @satuan_jml_baik,
              @jml_rusak_pindah,
              @satuan_jml_rusak,
              @status,
              @created_by,
              @created_at,
              @updated_by,
              @updated_at
            );`
          );

        const kodeBarangVariant = item.kode_barang_variant || null;
        if (lokasiAsalTipe === "GUDANG") {
          const stokRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
            .input("kode_gudang", sql.VarChar(50), lokasiAsalKode)
            .query(
              `SELECT
                 kode_mn_barang_gudang,
                 ISNULL(stok, 0) AS stok,
                 CASE
                   WHEN qty_baik IS NULL THEN ISNULL(stok, 0)
                   ELSE ISNULL(qty_baik, 0)
                 END AS qty_baik,
                 ISNULL(qty_rusak, 0) AS qty_rusak
               FROM dbo.GWEN_mn_barang_gudang_variant WITH (UPDLOCK, ROWLOCK)
               WHERE kode_barang_variant = @kode_barang_variant
                 AND kode_gudang = @kode_gudang
               ORDER BY updated_at DESC, created_at DESC, kode_mn_barang_gudang ASC;`
            );
          const stokRows = stokRes.recordset || [];
          if (!stokRows.length) {
            throw createStockError("Stok gudang tidak ditemukan", item);
          }
          const stokAwalBaik = stokRows.reduce((sum, row) => sum + (Number(row.qty_baik) || 0), 0);
          const stokAwalRusak = stokRows.reduce((sum, row) => sum + (Number(row.qty_rusak) || 0), 0);
          const stokAwalTotal = stokAwalBaik + stokAwalRusak;
          if (qtyBaikPindah > stokAwalBaik) {
            throw createStockError("Stok gudang (baik) tidak mencukupi", item, {
              requested: qtyBaikPindah,
              available: stokAwalBaik,
            });
          }
          if (qtyRusakPindah > stokAwalRusak) {
            throw createStockError("Stok gudang (rusak) tidak mencukupi", item, {
              requested: qtyRusakPindah,
              available: stokAwalRusak,
            });
          }

          let sisaBaik = qtyBaikPindah;
          let sisaRusak = qtyRusakPindah;
          for (const row of stokRows) {
            if (sisaBaik <= 0 && sisaRusak <= 0) break;
            const rowBaik = Number(row.qty_baik) || 0;
            const rowRusak = Number(row.qty_rusak) || 0;
            const ambilBaik = Math.min(rowBaik, sisaBaik);
            const ambilRusak = Math.min(rowRusak, sisaRusak);
            if (ambilBaik <= 0 && ambilRusak <= 0) continue;
            const stokAkhirBaikRow = rowBaik - ambilBaik;
            const stokAkhirRusakRow = rowRusak - ambilRusak;
            const stokAkhirTotalRow = stokAkhirBaikRow + stokAkhirRusakRow;

            await new sql.Request(tx)
              .input("stok", sql.Decimal(20, 2), stokAkhirTotalRow)
              .input("qty_baik", sql.Decimal(20, 2), stokAkhirBaikRow)
              .input("qty_rusak", sql.Decimal(20, 2), stokAkhirRusakRow)
              .input("updated_by", sql.VarChar(100), createdBy)
              .input("updated_at", sql.DateTime2, nowWib())
              .input("kode_mn_barang_gudang", sql.VarChar(50), String(row.kode_mn_barang_gudang || ""))
              .query(
                `UPDATE dbo.GWEN_mn_barang_gudang_variant
                 SET stok = @stok,
                     qty_baik = @qty_baik,
                     qty_rusak = @qty_rusak,
                     updated_by = @updated_by,
                     updated_at = @updated_at
                 WHERE kode_mn_barang_gudang = @kode_mn_barang_gudang;`
              );
            sisaBaik -= ambilBaik;
            sisaRusak -= ambilRusak;
          }
          if (sisaBaik > 0 || sisaRusak > 0) {
            throw createStockError("Stok gudang tidak cukup untuk diproses", item, {
              requested: qtyTotalPindah,
              available: stokAwalTotal,
            });
          }

          const histRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
            .input("kode_gudang", sql.VarChar(50), lokasiAsalKode)
            .query(
              `SELECT TOP 1 stok_akhir_satuan_1
               FROM dbo.GWEN_h_stok_barang_variant
               WHERE kode_barang_variant = @kode_barang_variant
                 AND kode_gudang = @kode_gudang
               ORDER BY tgl_transaksi DESC, id DESC;`
            );
          const stokAwalHist = Number(histRes.recordset?.[0]?.stok_akhir_satuan_1 ?? stokAwalTotal);
          const stokAkhirHist = stokAwalHist - qtyTotalPindah;

          const kodeHist = generateStockCode("HST");
          await new sql.Request(tx)
            .input("kode_h_stok_barang", sql.VarChar(255), kodeHist)
            .input("kode_ref_transaksi", sql.VarChar(255), kodeTPemindahan)
            .input("tgl_transaksi", sql.DateTime, nowWib())
            .input("ket_transaksi", sql.VarChar(sql.MAX), "PEMINDAHAN")
            .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
            .input("qty_masuk", sql.Decimal(20, 2), 0)
            .input("status", sql.VarChar(255), "KELUAR")
            .input("status_cadangan", sql.VarChar(255), null)
            .input("created_by", sql.VarChar(255), createdBy)
            .input("created_at", sql.DateTime, nowWib())
            .input("updated_by", sql.VarChar(255), createdBy)
            .input("updated_at", sql.DateTime, nowWib())
            .input("kode_gudang", sql.VarChar(255), lokasiAsalKode)
            .input("satuan", sql.VarChar(255), item.satuan || "PCS")
            .input("qty_ke_satuan_1", sql.Decimal(20, 2), qtyTotalPindah)
            .input("stok_awal_satuan_1", sql.Decimal(20, 2), stokAwalHist)
            .input("stok_akhir_satuan_1", sql.Decimal(20, 2), stokAkhirHist)
            .input("qty_keluar", sql.Decimal(20, 2), qtyTotalPindah)
            .input("kode_sales", sql.VarChar(255), null)
            .input("ket_inquiry", sql.VarChar(sql.MAX), null)
            .query(
              `INSERT INTO dbo.GWEN_h_stok_barang_variant (
                kode_h_stok_barang, kode_ref_transaksi, tgl_transaksi, ket_transaksi, kode_barang_variant, qty_masuk,
                status, status_cadangan, created_by, created_at, updated_by, updated_at, kode_gudang, satuan,
                qty_ke_satuan_1, stok_awal_satuan_1, stok_akhir_satuan_1, qty_keluar, kode_sales, ket_inquiry
              ) VALUES (
                @kode_h_stok_barang, @kode_ref_transaksi, @tgl_transaksi, @ket_transaksi, @kode_barang_variant, @qty_masuk,
                @status, @status_cadangan, @created_by, @created_at, @updated_by, @updated_at, @kode_gudang, @satuan,
                @qty_ke_satuan_1, @stok_awal_satuan_1, @stok_akhir_satuan_1, @qty_keluar, @kode_sales, @ket_inquiry
              );`
            );
        } else {
          const stokRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
            .input("kode_toko", sql.VarChar(50), lokasiAsalKode)
            .query(
              `SELECT
                 ISNULL(kode_etalase, '') AS kode_etalase,
                 ISNULL(kode_etalase_sub, '') AS kode_etalase_sub,
                 ISNULL(stok_available, 0) AS stok_available,
                 ISNULL(qty_rusak, 0) AS qty_rusak
               FROM dbo.GWEN_mn_barang_toko_variant WITH (UPDLOCK, ROWLOCK)
               WHERE kode_barang_variant = @kode_barang_variant
                 AND kode_toko = @kode_toko
               ORDER BY ISNULL(stok_available, 0) DESC, updated_at DESC;`
            );
          const stokRows = stokRes.recordset || [];
          if (!stokRows.length) {
            throw createStockError("Stok toko tidak ditemukan", item);
          }
          const stokAwalBaik = stokRows.reduce((sum, row) => sum + (Number(row.stok_available) || 0), 0);
          const stokAwalRusak = stokRows.reduce((sum, row) => sum + (Number(row.qty_rusak) || 0), 0);
          const stokAwalTotal = stokAwalBaik + stokAwalRusak;
          if (qtyBaikPindah > stokAwalBaik) {
            throw createStockError("Stok toko (baik) tidak mencukupi", item, {
              requested: qtyBaikPindah,
              available: stokAwalBaik,
            });
          }
          if (qtyRusakPindah > stokAwalRusak) {
            throw createStockError("Stok toko (rusak) tidak mencukupi", item, {
              requested: qtyRusakPindah,
              available: stokAwalRusak,
            });
          }

          let sisaBaik = qtyBaikPindah;
          let sisaRusak = qtyRusakPindah;
          for (const row of stokRows) {
            if (sisaBaik <= 0 && sisaRusak <= 0) break;
            const rowBaik = Number(row.stok_available) || 0;
            const rowRusak = Number(row.qty_rusak) || 0;
            const ambilBaik = Math.min(rowBaik, sisaBaik);
            const ambilRusak = Math.min(rowRusak, sisaRusak);
            if (ambilBaik <= 0 && ambilRusak <= 0) continue;
            const stokAkhirBaikRow = rowBaik - ambilBaik;
            const stokAkhirRusakRow = rowRusak - ambilRusak;

            await new sql.Request(tx)
              .input("stok_available", sql.Decimal(20, 2), stokAkhirBaikRow)
              .input("qty_baik", sql.Decimal(20, 2), stokAkhirBaikRow)
              .input("qty_rusak", sql.Decimal(20, 2), stokAkhirRusakRow)
              .input("updated_at", sql.DateTime2, nowWib())
              .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
              .input("kode_toko", sql.VarChar(50), lokasiAsalKode)
              .input("kode_etalase", sql.VarChar(50), row.kode_etalase || "")
              .input("kode_etalase_sub", sql.VarChar(50), row.kode_etalase_sub || "")
              .query(
                `UPDATE dbo.GWEN_mn_barang_toko_variant
                 SET stok_available = @stok_available,
                     qty_baik = @qty_baik,
                     qty_rusak = @qty_rusak,
                     updated_at = @updated_at
                 WHERE kode_barang_variant = @kode_barang_variant
                   AND kode_toko = @kode_toko
                   AND ISNULL(kode_etalase, '') = @kode_etalase
                   AND ISNULL(kode_etalase_sub, '') = @kode_etalase_sub;`
              );
            sisaBaik -= ambilBaik;
            sisaRusak -= ambilRusak;
          }
          if (sisaBaik > 0 || sisaRusak > 0) {
            throw createStockError("Stok toko tidak cukup untuk diproses", item, {
              requested: qtyTotalPindah,
              available: stokAwalTotal,
            });
          }

          const histRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
            .input("kode_gudang", sql.VarChar(50), lokasiAsalKode)
            .query(
              `SELECT TOP 1 stok_akhir_satuan_1
               FROM dbo.GWEN_h_stok_barang_variant
               WHERE kode_barang_variant = @kode_barang_variant
                 AND kode_gudang = @kode_gudang
               ORDER BY tgl_transaksi DESC, id DESC;`
            );
          const stokAwalHist = Number(histRes.recordset?.[0]?.stok_akhir_satuan_1 ?? stokAwalTotal);
          const stokAkhirHist = stokAwalHist - qtyTotalPindah;
          const kodeHist = generateStockCode("HST");
          await new sql.Request(tx)
            .input("kode_h_stok_barang", sql.VarChar(255), kodeHist)
            .input("kode_ref_transaksi", sql.VarChar(255), kodeTPemindahan)
            .input("tgl_transaksi", sql.DateTime, nowWib())
            .input("ket_transaksi", sql.VarChar(sql.MAX), "PEMINDAHAN")
            .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
            .input("qty_masuk", sql.Decimal(20, 2), 0)
            .input("status", sql.VarChar(255), "KELUAR")
            .input("status_cadangan", sql.VarChar(255), null)
            .input("created_by", sql.VarChar(255), createdBy)
            .input("created_at", sql.DateTime, nowWib())
            .input("updated_by", sql.VarChar(255), createdBy)
            .input("updated_at", sql.DateTime, nowWib())
            .input("kode_gudang", sql.VarChar(255), lokasiAsalKode)
            .input("satuan", sql.VarChar(255), item.satuan || "PCS")
            .input("qty_ke_satuan_1", sql.Decimal(20, 2), qtyTotalPindah)
            .input("stok_awal_satuan_1", sql.Decimal(20, 2), stokAwalHist)
            .input("stok_akhir_satuan_1", sql.Decimal(20, 2), stokAkhirHist)
            .input("qty_keluar", sql.Decimal(20, 2), qtyTotalPindah)
            .input("kode_sales", sql.VarChar(255), null)
            .input("ket_inquiry", sql.VarChar(sql.MAX), null)
            .query(
              `INSERT INTO dbo.GWEN_h_stok_barang_variant (
                kode_h_stok_barang, kode_ref_transaksi, tgl_transaksi, ket_transaksi, kode_barang_variant, qty_masuk,
                status, status_cadangan, created_by, created_at, updated_by, updated_at, kode_gudang, satuan,
                qty_ke_satuan_1, stok_awal_satuan_1, stok_akhir_satuan_1, qty_keluar, kode_sales, ket_inquiry
              ) VALUES (
                @kode_h_stok_barang, @kode_ref_transaksi, @tgl_transaksi, @ket_transaksi, @kode_barang_variant, @qty_masuk,
                @status, @status_cadangan, @created_by, @created_at, @updated_by, @updated_at, @kode_gudang, @satuan,
                @qty_ke_satuan_1, @stok_awal_satuan_1, @stok_akhir_satuan_1, @qty_keluar, @kode_sales, @ket_inquiry
              );`
            );
        }
      }

      await tx.commit();
      return reply.code(201).send({ kode_t_pemindahan: kodeTPemindahan });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed to create pemindahan");
      const message = err instanceof Error && err.message ? err.message : "Gagal membuat pemindahan";
      const isValidationError =
        message.startsWith("Stok ") ||
        message.includes("tidak mencukupi") ||
        message.includes("tidak cukup") ||
        message.includes("tidak ditemukan");
      return reply.code(isValidationError ? 400 : 500).send({
        message: isValidationError ? message : "Gagal membuat pemindahan",
      });
    }
  });

  fastify.get("/", async (_request, reply) => {
    try {
      const result = await pool.request().query(`
        WITH kirim AS (
          SELECT kode_t_pemindahan,
                 SUM(ISNULL(jml_baik_pindah, 0) + ISNULL(jml_rusak_pindah, 0)) AS total_kirim
          FROM dbo.GWEN_d_pemindahan
          GROUP BY kode_t_pemindahan
        ),
        terima AS (
          SELECT t.kode_t_pemindahan,
                 SUM(ISNULL(d.jml_baik_terima, 0) + ISNULL(d.jml_rusak_terima, 0)) AS total_terima
          FROM dbo.GWEN_t_penerimaan_pemindahan t
          JOIN dbo.GWEN_d_penerimaan_pemindahan d ON d.kode_t_penerimaan = t.kode_t_penerimaan
          GROUP BY t.kode_t_pemindahan
        ),
        detail_agg AS (
          SELECT
            d.kode_t_pemindahan,
            STRING_AGG(CAST(v.nama_varian COLLATE DATABASE_DEFAULT AS NVARCHAR(MAX)), ' | ') AS varian_list,
            STRING_AGG(CAST(v.barcode_varian COLLATE DATABASE_DEFAULT AS NVARCHAR(MAX)), ' | ') AS barcode_list
          FROM dbo.GWEN_d_pemindahan d
          LEFT JOIN dbo.m_barang_varian v
            ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT
          GROUP BY d.kode_t_pemindahan
        )
        SELECT
          t.kode_t_pemindahan,
          t.tipe_lokasi_dari,
          t.kode_lokasi_dari,
          t.tipe_lokasi_tujuan,
          t.kode_lokasi_tujuan,
          t.tgl,
          t.created_by,
          da.varian_list,
          da.barcode_list,
          ISNULL(k.total_kirim, 0) AS total_qty,
          ISNULL(tr.total_terima, 0) AS total_terima,
          CASE
            WHEN ISNULL(k.total_kirim, 0) = 0 THEN 0
            ELSE CAST(ROUND((ISNULL(tr.total_terima, 0) * 100.0) / NULLIF(k.total_kirim, 0), 0) AS INT)
          END AS persen_terima
        FROM dbo.GWEN_t_pemindahan t
        LEFT JOIN kirim k ON k.kode_t_pemindahan COLLATE DATABASE_DEFAULT = t.kode_t_pemindahan COLLATE DATABASE_DEFAULT
        LEFT JOIN terima tr ON tr.kode_t_pemindahan COLLATE DATABASE_DEFAULT = t.kode_t_pemindahan COLLATE DATABASE_DEFAULT
        LEFT JOIN detail_agg da ON da.kode_t_pemindahan COLLATE DATABASE_DEFAULT = t.kode_t_pemindahan COLLATE DATABASE_DEFAULT
        ORDER BY t.created_at DESC, t.kode_t_pemindahan DESC;
      `);
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch pemindahan list");
      return reply.code(500).send({ message: "Gagal memuat pemindahan" });
    }
  });

  fastify.get("/:kode", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    if (!kode) {
      return reply.code(400).send({ message: "kode pemindahan wajib diisi" });
    }

    try {
      let headerRes;
      try {
        headerRes = await pool
          .request()
          .input("kode", sql.VarChar(50), kode)
          .query(
            `SELECT
              t.kode_t_pemindahan,
              t.tipe_lokasi_dari,
              t.kode_lokasi_dari,
              t.tipe_lokasi_tujuan,
              t.kode_lokasi_tujuan,
              t.catatan,
              t.status_pemindahan,
              t.tgl,
              t.created_by,
              t.created_at,
              COALESCE(gd.nama COLLATE DATABASE_DEFAULT, td.nama_toko COLLATE DATABASE_DEFAULT) AS nama_lokasi_dari,
              COALESCE(gt.nama COLLATE DATABASE_DEFAULT, tt.nama_toko COLLATE DATABASE_DEFAULT) AS nama_lokasi_tujuan
            FROM dbo.GWEN_t_pemindahan t
            LEFT JOIN dbo.m_gudang gd
              ON t.tipe_lokasi_dari COLLATE DATABASE_DEFAULT = 'GUDANG'
             AND gd.kode_gudang COLLATE DATABASE_DEFAULT = t.kode_lokasi_dari COLLATE DATABASE_DEFAULT
            LEFT JOIN dbo.m_toko td
              ON t.tipe_lokasi_dari COLLATE DATABASE_DEFAULT = 'TOKO'
             AND td.kode_toko COLLATE DATABASE_DEFAULT = t.kode_lokasi_dari COLLATE DATABASE_DEFAULT
            LEFT JOIN dbo.m_gudang gt
              ON t.tipe_lokasi_tujuan COLLATE DATABASE_DEFAULT = 'GUDANG'
             AND gt.kode_gudang COLLATE DATABASE_DEFAULT = t.kode_lokasi_tujuan COLLATE DATABASE_DEFAULT
            LEFT JOIN dbo.m_toko tt
              ON t.tipe_lokasi_tujuan COLLATE DATABASE_DEFAULT = 'TOKO'
             AND tt.kode_toko COLLATE DATABASE_DEFAULT = t.kode_lokasi_tujuan COLLATE DATABASE_DEFAULT
            WHERE t.kode_t_pemindahan = @kode;`
          );
      } catch (err) {
        fastify.log.warn({ err }, "Fallback header pemindahan tanpa nama lokasi");
        headerRes = await pool
          .request()
          .input("kode", sql.VarChar(50), kode)
          .query(
            `SELECT
              kode_t_pemindahan,
              tipe_lokasi_dari,
              kode_lokasi_dari,
              tipe_lokasi_tujuan,
              kode_lokasi_tujuan,
              catatan,
              status_pemindahan,
              tgl,
              created_by,
              created_at
            FROM dbo.GWEN_t_pemindahan
            WHERE kode_t_pemindahan = @kode;`
          );
      }

      if (!headerRes.recordset?.length) {
        return reply.code(404).send({ message: "Pemindahan tidak ditemukan" });
      }

      const detailRes = await pool
        .request()
        .input("kode", sql.VarChar(50), kode)
        .query(
          `SELECT
            d.kode_d_pemindahan,
            d.kode_barang,
            d.kode_barang_variant,
            d.jml_baik_pindah,
            d.satuan_jml_baik,
            d.jml_rusak_pindah,
            d.satuan_jml_rusak,
            v.nama_varian,
            v.barcode_varian,
            b.nama AS nama_barang
          FROM dbo.GWEN_d_pemindahan d
          LEFT JOIN dbo.m_barang_varian v
            ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.m_barang b ON b.id_barang = v.id_barang
          WHERE d.kode_t_pemindahan = @kode
          ORDER BY b.nama ASC, v.nama_varian ASC;`
        );

      return reply.send({
        header: headerRes.recordset[0],
        detail: detailRes.recordset || [],
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch pemindahan detail");
      return reply.code(500).send({ message: "Gagal memuat detail pemindahan" });
    }
  });
}
