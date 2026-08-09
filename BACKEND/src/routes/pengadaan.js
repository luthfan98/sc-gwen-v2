import { normalizeDateRange } from "../utils/date-range.js";
import { formatWibSqlDateTime, logWibConversion, nowWib, toWibDate } from "../utils/wib-time.js";

export default async function pengadaanRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const generateDocCode = async ({ prefix, tx, userCode = "88", branchCode = "GW", padLength = 5, separator = "." }) => {
    const req = tx ? new sql.Request(tx) : pool.request();
    req.input("Prefix", sql.VarChar(10), prefix);
    req.input("ExecDate", sql.Date, null);
    req.input("UserCode", sql.Char(2), userCode);
    req.input("BranchCode", sql.Char(2), branchCode);
    req.input("PadLength", sql.Int, padLength);
    req.input("Separator", sql.Char(1), separator);
    req.output("NextNo", sql.Int);
    req.output("GeneratedCode", sql.VarChar(50));

    const res = await req.execute("GWEN_GenerateDocCode");
    const generatedCode = res.output?.GeneratedCode;

    if (!generatedCode) {
      throw new Error("Failed to generate kode_t_pengadaan");
    }

    return generatedCode;
  };

  const generateDetailCode = async ({ prefix, tx, padLength = 6, separator = "." }) => {
    const req = tx ? new sql.Request(tx) : pool.request();
    const res = await req
      .input("prefix", sql.VarChar(10), prefix)
      .query(
        `
        SELECT TOP 1 kode_d_pengadaan AS kode
        FROM dbo.GWEN_d_pengadaan
        WHERE kode_d_pengadaan LIKE @prefix + '%'
        ORDER BY created_at DESC, kode_d_pengadaan DESC;
      `
      );
    const last = res.recordset?.[0]?.kode || "";
    let next = 1;
    if (last) {
      const parts = String(last).split(separator);
      const tail = parts[parts.length - 1];
      const asNum = Number(tail);
      if (!Number.isNaN(asNum)) next = asNum + 1;
    }
    return `${prefix}${separator}${String(next).padStart(padLength, "0")}`;
  };

  const generatePenerimaanCode = async ({ prefix, tx, userCode = "88", branchCode = "GW", padLength = 5, separator = "." }) => {
    const req = tx ? new sql.Request(tx) : pool.request();
    req.input("Prefix", sql.VarChar(10), prefix);
    req.input("ExecDate", sql.Date, null);
    req.input("UserCode", sql.Char(2), userCode);
    req.input("BranchCode", sql.Char(2), branchCode);
    req.input("PadLength", sql.Int, padLength);
    req.input("Separator", sql.Char(1), separator);
    req.output("NextNo", sql.Int);
    req.output("GeneratedCode", sql.VarChar(50));

    const res = await req.execute("GWEN_GenerateDocCode");
    const generatedCode = res.output?.GeneratedCode;

    if (!generatedCode) {
      throw new Error("Failed to generate kode_t_penerimaan_pengadaan");
    }

    return generatedCode;
  };

  const generatePenerimaanDetailCode = async ({ prefix, tx, padLength = 6, separator = "." }) => {
    const req = tx ? new sql.Request(tx) : pool.request();
    const res = await req
      .input("prefix", sql.VarChar(10), prefix)
      .query(
        `
        SELECT TOP 1 kode_d_penerimaan_pengadaan AS kode
        FROM dbo.GWEN_d_penerimaan_pengadaan
        WHERE kode_d_penerimaan_pengadaan LIKE @prefix + '%'
        ORDER BY created_at DESC, kode_d_penerimaan_pengadaan DESC;
      `
      );
    const last = res.recordset?.[0]?.kode || "";
    let next = 1;
    if (last) {
      const parts = String(last).split(separator);
      const tail = parts[parts.length - 1];
      const asNum = Number(tail);
      if (!Number.isNaN(asNum)) next = asNum + 1;
    }
    return `${prefix}${separator}${String(next).padStart(padLength, "0")}`;
  };

  const updateHppAvgFromPengadaan = async ({ tx, kodeBarangVariants, updatedBy }) => {
    const cleaned = [...new Set((kodeBarangVariants || []).map((v) => String(v || "").trim()).filter(Boolean))];
    if (cleaned.length === 0) return;
    const req = new sql.Request(tx);
    const params = cleaned.map((_, idx) => `@kode_${idx}`);
    cleaned.forEach((val, idx) => {
      req.input(`kode_${idx}`, sql.VarChar(50), val);
    });
    req.input("updated_by", sql.VarChar(255), updatedBy);
    req.input("updated_at", sql.DateTime, nowWib());
    await req.query(
      `
      WITH avg_hpp AS (
        SELECT
          d.kode_barang_variant,
          AVG(CAST(d.harga_beli AS DECIMAL(20, 2))) AS avg_hpp
        FROM dbo.GWEN_d_pengadaan d
        WHERE d.kode_barang_variant IN (${params.join(",")})
          AND ISNULL(d.is_active, 1) = 1
          AND ISNULL(d.harga_beli, 0) > 0
        GROUP BY d.kode_barang_variant
      )
      UPDATE v
      SET v.hpp_avg_sat_1 = a.avg_hpp,
          v.updated_by = @updated_by,
          v.updated_at = @updated_at
      FROM dbo.m_barang_varian v
      JOIN avg_hpp a
        ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = a.kode_barang_variant COLLATE DATABASE_DEFAULT
      WHERE ISNULL(v.hpp_avg_sat_1, 0) <> ISNULL(a.avg_hpp, 0);
    `
    );
  };

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const kode_t_rpo = String(body.kode_t_rpo || "").trim();
    const kode_supplier = String(body.kode_supplier || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];
    const created_by = String(body.created_by || "Admin").trim() || "Admin";
    const now = nowWib();
    const tglPengadaan = body.tgl ? toWibDate(body.tgl, { sourceTz: "Asia/Jakarta" }) : now;
    const deadlinePengadaan = body.deadline ? toWibDate(body.deadline, { sourceTz: "Asia/Jakarta" }) : null;

    if (body.tgl && !tglPengadaan) {
      return reply.code(400).send({ message: "Format tgl tidak valid" });
    }
    if (body.deadline && !deadlinePengadaan) {
      return reply.code(400).send({ message: "Format deadline tidak valid" });
    }

    logWibConversion(fastify.log, {
      route: "pengadaan.create",
      field: "tgl",
      source: body.tgl ?? null,
      converted_wib: formatWibSqlDateTime(tglPengadaan),
      sql_value: formatWibSqlDateTime(tglPengadaan),
    });
    if (body.deadline) {
      logWibConversion(fastify.log, {
        route: "pengadaan.create",
        field: "deadline",
        source: body.deadline,
        converted_wib: formatWibSqlDateTime(deadlinePengadaan),
        sql_value: formatWibSqlDateTime(deadlinePengadaan),
      });
    }

    if (!kode_t_rpo || !kode_supplier || items.length === 0) {
      return reply.code(400).send({ message: "kode_t_rpo, kode_supplier, dan items wajib diisi" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();
      const kode_t_pengadaan = await generateDocCode({ prefix: "PEN", tx });

      let total = 0;
      let totalQty = 0;
      for (const it of items) {
        const qty = Number(it.qty ?? 0);
        const harga = Number(it.harga_beli ?? 0);
        total += qty * harga;
        totalQty += qty;
      }
      const diskon = Number(body.diskon ?? 0);
      const total_stlh_diskon = total - diskon;
      const total_sblm_ppn = Number(body.total_sblm_ppn ?? total_stlh_diskon);
      const ppn = Number(body.ppn ?? 0);
      const total_akhir = Number(body.total_akhir ?? total_sblm_ppn + ppn);

      const gudangFallbackRes = await new sql.Request(tx)
        .input("kode_t_rpo", sql.VarChar(255), kode_t_rpo)
        .query(
          `
          SELECT TOP 1 kode_gudang_asal
          FROM dbo.GWEN_t_rpo
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo));
        `
        );
      const kodeGudangFallback = gudangFallbackRes.recordset?.[0]?.kode_gudang_asal || null;

      await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), kode_t_pengadaan)
        .input("kode_t_rpo", sql.VarChar(255), kode_t_rpo)
        .input("tgl", sql.DateTime, tglPengadaan)
        .input("deadline", sql.DateTime, deadlinePengadaan)
        .input("kode_supplier", sql.VarChar(255), kode_supplier)
        .input("no_faktur_supplier", sql.VarChar(255), body.no_faktur_supplier || null)
        .input("catatan", sql.VarChar(255), body.catatan || null)
        .input("total", sql.Decimal(20, 2), total)
        .input("diskon", sql.Decimal(20, 2), diskon)
        .input("total_stlh_diskon", sql.Decimal(20, 2), total_stlh_diskon)
        .input("total_sblm_ppn", sql.Decimal(20, 2), total_sblm_ppn)
        .input("ppn", sql.Decimal(20, 2), ppn)
        .input("total_akhir", sql.Decimal(20, 2), total_akhir)
        .input("status_pengadaan", sql.Int, 0)
        .input("status", sql.Int, 1)
        .input("status_cadangan", sql.Int, null)
        .input("created_by", sql.VarChar(255), created_by)
        .input("created_at", sql.DateTime, now)
        .input("updated_by", sql.VarChar(255), created_by)
        .input("updated_at", sql.DateTime, now)
        .input("total_ditagih", sql.Decimal(20, 2), 0)
        .input("total_dibayar", sql.Decimal(20, 2), 0)
        .input("jumlah_barang", sql.Decimal(20, 2), items.length)
        .input("jumlah_diterima", sql.Decimal(20, 2), totalQty)
        .query(
          `
          INSERT INTO dbo.GWEN_t_pengadaan (
            kode_t_pengadaan, kode_t_rpo, tgl, deadline, kode_supplier, no_faktur_supplier, catatan, total, diskon, total_stlh_diskon,
            total_sblm_ppn, ppn, total_akhir, status_pengadaan, status, status_cadangan, created_by, created_at,
            updated_by, updated_at, total_ditagih, total_dibayar, jumlah_barang, jumlah_diterima
          ) VALUES (
            @kode_t_pengadaan, @kode_t_rpo, @tgl, @deadline, @kode_supplier, @no_faktur_supplier, @catatan, @total, @diskon, @total_stlh_diskon,
            @total_sblm_ppn, @ppn, @total_akhir, @status_pengadaan, @status, @status_cadangan, @created_by, @created_at,
            @updated_by, @updated_at, @total_ditagih, @total_dibayar, @jumlah_barang, @jumlah_diterima
          );
        `
        );

      for (const it of items) {
        const kode_barang_variant = String(it.kode_barang_variant || "").trim();
        const qty = Number(it.qty ?? 0);
        const harga_beli = Number(it.harga_beli ?? 0);
        const disc_1 = Number(it.disc_1 ?? 0);
        const disc_2 = Number(it.disc_2 ?? 0);
        const disc_3 = Number(it.disc_3 ?? 0);
        const subtotal = qty * harga_beli;
        let kode_d_pengadaan = await generateDetailCode({ prefix: "DPN", tx, padLength: 6 });
        let tries = 0;
        while (tries < 5) {
          const exists = await new sql.Request(tx)
            .input("kode_d_pengadaan", sql.VarChar(255), kode_d_pengadaan)
            .query(
              `
              SELECT 1
              FROM dbo.GWEN_d_pengadaan
              WHERE kode_d_pengadaan = @kode_d_pengadaan;
            `
            );
          if (!exists.recordset?.length) break;
          tries += 1;
          kode_d_pengadaan = await generateDetailCode({ prefix: "DPN", tx, padLength: 6 });
        }
        const kodeGudangRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
          .query(
            `
            SELECT TOP 1 b.kode_gudang, b.kode_barang
            FROM dbo.m_barang_varian v
            JOIN dbo.m_barang b ON b.id_barang = v.id_barang
            WHERE v.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT;
          `
          );
        const kode_gudang = kodeGudangRes.recordset?.[0]?.kode_gudang || kodeGudangFallback || null;
        const kode_barang = kodeGudangRes.recordset?.[0]?.kode_barang || null;

        await new sql.Request(tx)
          .input("kode_d_pengadaan", sql.VarChar(255), kode_d_pengadaan)
          .input("kode_t_pengadaan", sql.VarChar(255), kode_t_pengadaan)
          .input("kode_t_rpo", sql.VarChar(255), kode_t_rpo)
          .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant || null)
          .input("barcode_varian", sql.VarChar(255), it.barcode_varian || null)
          .input("nama_barang", sql.VarChar(255), it.nama_barang || null)
          .input("nama_varian", sql.VarChar(255), it.nama_varian || null)
          .input("qty", sql.Int, qty)
          .input("satuan", sql.VarChar(50), it.satuan || "PCS")
          .input("harga_beli", sql.Decimal(20, 2), harga_beli)
          .input("disc_1", sql.Decimal(20, 2), disc_1)
          .input("disc_2", sql.Decimal(20, 2), disc_2)
          .input("disc_3", sql.Decimal(20, 2), disc_3)
          .input("subtotal", sql.Decimal(20, 2), subtotal)
          .input("catatan", sql.VarChar(255), it.catatan || null)
          .input("is_active", sql.Bit, it.is_active ? 1 : 0)
          .input("kode_parent", sql.VarChar(255), it.kode_parent || null)
          .input("created_by", sql.VarChar(255), created_by)
          .input("created_at", sql.DateTime, now)
          .input("updated_by", sql.VarChar(255), created_by)
          .input("updated_at", sql.DateTime, now)
          .query(
            `
            INSERT INTO dbo.GWEN_d_pengadaan (
              kode_d_pengadaan, kode_t_pengadaan, kode_t_rpo, kode_barang_variant, barcode_varian, nama_barang, nama_varian,
              qty, satuan, harga_beli, disc_1, disc_2, disc_3, subtotal, catatan, is_active, kode_parent,
              created_by, created_at, updated_by, updated_at
            ) VALUES (
              @kode_d_pengadaan, @kode_t_pengadaan, @kode_t_rpo, @kode_barang_variant, @barcode_varian, @nama_barang, @nama_varian,
              @qty, @satuan, @harga_beli, @disc_1, @disc_2, @disc_3, @subtotal, @catatan, @is_active, @kode_parent,
              @created_by, @created_at, @updated_by, @updated_at
            );
          `
          );

        if (kode_barang_variant) {
          const varianUpdateRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
            .input("harga_beli", sql.Decimal(20, 2), harga_beli)
            .input("updated_by", sql.VarChar(255), created_by)
            .input("updated_at", sql.DateTime, now)
            .query(
              `
              UPDATE dbo.m_barang_varian
              SET harga_beli_sat_1 = @harga_beli,
                  updated_by = @updated_by,
                  updated_at = @updated_at
              WHERE kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT
                AND ISNULL(harga_beli_sat_1, 0) <> @harga_beli;
            `
            );

          const baseUpdateRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
            .input("harga_beli", sql.Decimal(20, 2), harga_beli)
            .input("updated_by", sql.VarChar(255), created_by)
            .input("updated_at", sql.DateTime, now)
            .query(
              `
              UPDATE b
              SET b.harga_beli_sat_1 = @harga_beli,
                  b.updated_by = @updated_by,
                  b.updated_at = @updated_at
              FROM dbo.m_barang b
              JOIN dbo.m_barang_varian v ON v.id_barang = b.id_barang
              WHERE v.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT
                AND ISNULL(b.harga_beli_sat_1, 0) <> @harga_beli;
            `
            );

          const varianUpdated = varianUpdateRes.rowsAffected?.[0] || 0;
          const baseUpdated = baseUpdateRes.rowsAffected?.[0] || 0;
          if ((varianUpdated > 0 || baseUpdated > 0) && harga_beli > 0) {
            const kodeHistory = await generateDocCode({ prefix: "HBB", tx });
            await new sql.Request(tx)
              .input("kode_h_harga_beli_barang", sql.VarChar(50), kodeHistory)
              .input("kode_barang_variant", sql.VarChar(50), kode_barang_variant)
              .input("kode_barang", sql.VarChar(100), kode_barang || null)
              .input("harga_beli_sat_1", sql.Decimal(20, 2), harga_beli)
              .input("sumber", sql.VarChar(50), "PENGADAAN")
              .input("kode_t_pengadaan", sql.VarChar(255), kode_t_pengadaan)
              .input("kode_d_pengadaan", sql.VarChar(255), kode_d_pengadaan)
              .input("catatan", sql.VarChar(255), it.catatan || null)
              .input("created_by", sql.VarChar(100), created_by)
              .input("created_at", sql.DateTime2, now)
              .query(
                `
                INSERT INTO dbo.GWEN_h_harga_beli_barang (
                  kode_h_harga_beli_barang,
                  kode_barang_variant,
                  kode_barang,
                  harga_beli_sat_1,
                  sumber,
                  kode_t_pengadaan,
                  kode_d_pengadaan,
                  catatan,
                  created_by,
                  created_at
                ) VALUES (
                  @kode_h_harga_beli_barang,
                  @kode_barang_variant,
                  @kode_barang,
                  @harga_beli_sat_1,
                  @sumber,
                  @kode_t_pengadaan,
                  @kode_d_pengadaan,
                  @catatan,
                  @created_by,
                  @created_at
                );
              `
              );
          }
        }

      }

      await updateHppAvgFromPengadaan({
        tx,
        kodeBarangVariants: items.map((it) => it.kode_barang_variant).filter(Boolean),
        updatedBy: created_by,
      });

      const penerimaanExisting = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), kode_t_pengadaan)
        .query(
          `
          SELECT TOP 1 kode_t_penerimaan_pengadaan
          FROM dbo.GWEN_t_penerimaan_pengadaan
          WHERE kode_t_pengadaan = @kode_t_pengadaan;
        `
        );

      if (!penerimaanExisting.recordset?.length) {
        const kode_t_penerimaan_pengadaan = await generatePenerimaanCode({ prefix: "PPG", tx });
        await new sql.Request(tx)
          .input("kode_t_penerimaan_pengadaan", sql.VarChar(255), kode_t_penerimaan_pengadaan)
          .input("kode_supplier", sql.VarChar(255), kode_supplier)
          .input("kode_gudang", sql.VarChar(255), kodeGudangFallback)
          .input("no_sj_masuk", sql.VarChar(255), body.no_sj_masuk || null)
          .input("catatan", sql.VarChar(255), body.catatan || null)
          .input("status", sql.Int, 1)
          .input("status_cadangan", sql.Int, null)
          .input("created_by", sql.VarChar(255), created_by)
          .input("created_at", sql.DateTime, now)
          .input("updated_by", sql.VarChar(255), created_by)
          .input("updated_at", sql.DateTime, now)
          .input("tgl", sql.DateTime, now)
          .input("kode_t_pengadaan", sql.VarChar(255), kode_t_pengadaan)
          .query(
            `
            INSERT INTO dbo.GWEN_t_penerimaan_pengadaan (
              kode_t_penerimaan_pengadaan, kode_supplier, kode_gudang, no_sj_masuk, catatan, status, status_cadangan,
              created_by, created_at, updated_by, updated_at, tgl, kode_t_pengadaan
            ) VALUES (
              @kode_t_penerimaan_pengadaan, @kode_supplier, @kode_gudang, @no_sj_masuk, @catatan, @status, @status_cadangan,
              @created_by, @created_at, @updated_by, @updated_at, @tgl, @kode_t_pengadaan
            );
          `
          );

        for (const it of items) {
          const kode_d_penerimaan_pengadaan = await generatePenerimaanDetailCode({ prefix: "DPPG", tx, padLength: 6 });
          const qty = Number(it.qty ?? 0);
          await new sql.Request(tx)
            .input("kode_d_penerimaan_pengadaan", sql.VarChar(255), kode_d_penerimaan_pengadaan)
            .input("kode_t_penerimaan_pengadaan", sql.VarChar(255), kode_t_penerimaan_pengadaan)
            .input("kode_barang", sql.VarChar(255), it.kode_barang_variant || null)
            .input("jml_baik_dikirim", sql.Decimal(20, 2), qty)
            .input("jml_baik_diterima", sql.Decimal(20, 2), 0)
            .input("satuan_jml_baik", sql.VarChar(255), it.satuan || "PCS")
            .input("jml_rusak_diterima", sql.Decimal(20, 2), 0)
            .input("satuan_jml_rusak", sql.VarChar(255), it.satuan || "PCS")
            .input("catatan", sql.VarChar(255), it.catatan || null)
            .input("status", sql.Int, 1)
            .input("status_cadangan", sql.Int, null)
            .input("created_by", sql.VarChar(255), created_by)
            .input("created_at", sql.DateTime, now)
            .input("updated_by", sql.VarChar(255), created_by)
            .input("updated_at", sql.DateTime, now)
            .input("kode_d_pengadaan", sql.VarChar(255), it.kode_d_pengadaan || null)
            .query(
              `
            INSERT INTO dbo.GWEN_d_penerimaan_pengadaan (
              kode_d_penerimaan_pengadaan, kode_t_penerimaan_pengadaan, kode_barang, jml_baik_dikirim, jml_baik_diterima, satuan_jml_baik,
              jml_rusak_diterima, satuan_jml_rusak, catatan, status, status_cadangan, created_by, created_at,
              updated_by, updated_at, kode_d_pengadaan
            ) VALUES (
              @kode_d_penerimaan_pengadaan, @kode_t_penerimaan_pengadaan, @kode_barang, @jml_baik_dikirim, @jml_baik_diterima, @satuan_jml_baik,
              @jml_rusak_diterima, @satuan_jml_rusak, @catatan, @status, @status_cadangan, @created_by, @created_at,
              @updated_by, @updated_at, @kode_d_pengadaan
            );
          `
          );
        }
      }

      await new sql.Request(tx)
        .input("kode_t_rpo", sql.VarChar(255), kode_t_rpo)
        .input("kode_t_pengadaan", sql.VarChar(255), kode_t_pengadaan)
        .query(
          `
          UPDATE dbo.GWEN_t_rpo
          SET kode_t_po = @kode_t_pengadaan
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo));
        `
        );

      await tx.commit();
      return reply.send({ message: "Pengadaan tersimpan", kode_t_pengadaan });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed save pengadaan");
      return reply.code(500).send({ message: "Gagal menyimpan pengadaan" });
    }
  });

  fastify.get("/harga-beli-history", async (request, reply) => {
    const { kode_barang_variant, limit } = request.query || {};
    const kodeVarian = String(kode_barang_variant || "").trim();
    if (!kodeVarian) {
      return reply.code(400).send({ message: "kode_barang_variant wajib diisi" });
    }

    const safeLimitRaw = Number(limit ?? 10);
    const safeLimit = Number.isFinite(safeLimitRaw) ? Math.min(Math.max(Math.trunc(safeLimitRaw), 1), 100) : 10;

    try {
      const res = await pool
        .request()
        .input("kode_barang_variant", sql.VarChar(100), kodeVarian)
        .input("limit", sql.Int, safeLimit)
        .query(
          `
          SELECT TOP (@limit)
            t.tgl,
            t.kode_t_pengadaan,
            d.qty,
            d.harga_beli,
            CAST(
              CASE
                WHEN ISNULL(d.harga_beli, 0) > 0 THEN d.harga_beli
                WHEN ISNULL(d.subtotal, 0) > 0 AND NULLIF(d.qty, 0) IS NOT NULL THEN d.subtotal / NULLIF(d.qty, 0)
                ELSE 0
              END
              AS DECIMAL(20, 2)
            ) AS harga_beli_nett
          FROM dbo.GWEN_d_pengadaan d
          JOIN dbo.GWEN_t_pengadaan t
            ON t.kode_t_pengadaan = d.kode_t_pengadaan
          WHERE ISNULL(d.is_active, 1) = 1
            AND ISNULL(t.status, 1) = 1
            AND d.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT
          ORDER BY t.tgl DESC, t.created_at DESC, d.created_at DESC, d.kode_d_pengadaan DESC;
        `
        );

      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch harga beli history");
      return reply.code(500).send({ message: "Gagal memuat riwayat harga beli" });
    }
  });

  fastify.post("/po-exists", async (request, reply) => {
    const body = request.body || {};
    const list = Array.isArray(body.kode_barang_variant_list) ? body.kode_barang_variant_list : [];
    const cleaned = list.map((v) => String(v || "").trim()).filter(Boolean);
    if (cleaned.length === 0) {
      return reply.send([]);
    }
    try {
      const req = pool.request();
      const params = cleaned.map((_, idx) => `@kode_${idx}`);
      cleaned.forEach((val, idx) => {
        req.input(`kode_${idx}`, sql.VarChar(100), val);
      });
      const res = await req.query(
        `
        SELECT
          d.kode_barang_variant,
          COUNT(1) AS po_count,
          MAX(t.tgl) AS last_po_date
        FROM dbo.GWEN_d_pengadaan d
        JOIN dbo.GWEN_t_pengadaan t
          ON t.kode_t_pengadaan = d.kode_t_pengadaan
        WHERE ISNULL(d.is_active, 1) = 1
          AND ISNULL(t.status, 1) = 1
          AND d.kode_barang_variant IN (${params.join(",")})
        GROUP BY d.kode_barang_variant;
      `
      );
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch po exists list");
      return reply.code(500).send({ message: "Gagal memuat status PO" });
    }
  });

  fastify.get("/inquiry", async (request, reply) => {
    const { start, end, kode_supplier, kode_merk } = request.query || {};
    const startRaw = String(start || "").trim();
    const endRaw = String(end || "").trim();
    const supplierRaw = String(kode_supplier || "").trim();
    const merkRaw = String(kode_merk || "").trim();

    const dateRange = normalizeDateRange({
      from: startRaw,
      to: endRaw,
      defaultDays: 30,
      maxSpanDays: 93,
    });
    if (dateRange.error) {
      return reply.code(400).send({ message: dateRange.error });
    }
    const startDate = new Date(dateRange.fromDate);
    const endExclusive = new Date(dateRange.toDate);
    endExclusive.setDate(endExclusive.getDate() + 1);

    try {
      const req = pool.request();
      const filters = [];
      req.input("start_date", sql.DateTime2, startDate);
      req.input("end_date", sql.DateTime2, endExclusive);
      filters.push("t.tgl >= @start_date");
      filters.push("t.tgl < @end_date");
      if (supplierRaw) {
        req.input("kode_supplier", sql.VarChar(100), supplierRaw);
        filters.push("RTRIM(LTRIM(t.kode_supplier)) = RTRIM(LTRIM(@kode_supplier))");
      }
      if (merkRaw) {
        req.input("kode_merk_raw", sql.VarChar(50), merkRaw);
        const merkInt = Number(merkRaw);
        if (!Number.isNaN(merkInt)) {
          req.input("kode_merk_int", sql.Int, merkInt);
        } else {
          req.input("kode_merk_int", sql.Int, null);
        }
        filters.push(
          "(RTRIM(LTRIM(b.kode_merk)) = RTRIM(LTRIM(@kode_merk_raw)) OR TRY_CAST(b.kode_merk AS INT) = @kode_merk_int)"
        );
      }

      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const res = await req.query(
        `
        SELECT
          t.kode_t_pengadaan,
          t.kode_t_rpo,
          t.tgl,
          t.kode_supplier,
          s.nama AS supplier_nama,
          t.no_faktur_supplier,
          d.kode_d_pengadaan,
          d.kode_barang_variant,
          d.barcode_varian,
          d.nama_barang,
          d.nama_varian,
          d.qty,
          d.satuan,
          d.harga_beli,
          d.subtotal,
          b.kode_merk,
          mk.nama_merk
        FROM dbo.GWEN_t_pengadaan t
        JOIN dbo.GWEN_d_pengadaan d
          ON d.kode_t_pengadaan = t.kode_t_pengadaan
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.m_barang_varian v
          ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.m_barang b
          ON b.id_barang = v.id_barang
        LEFT JOIN dbo.m_merk mk
          ON mk.id_merk = TRY_CAST(b.kode_merk AS INT)
        ${whereClause}
        ORDER BY t.tgl DESC, t.kode_t_pengadaan DESC, d.kode_d_pengadaan ASC;
        `
      );
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch inquiry pengadaan");
      return reply.code(500).send({ message: "Gagal memuat inquiry pengadaan" });
    }
  });

  fastify.get("/:kode", async (request, reply) => {
    const { kode } = request.params;
    const includeInactive = String(request.query?.include_inactive || "").trim() === "1";
    if (!kode) return reply.code(400).send({ message: "kode_t_pengadaan wajib diisi" });
    try {
      const headerRes = await pool
        .request()
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT TOP 1
            t.kode_t_pengadaan,
            t.kode_t_rpo,
            t.tgl,
            r.tanggal_barang_datang,
            t.deadline,
            t.kode_supplier,
            t.no_faktur_supplier,
            t.created_by,
            s.nama AS supplier_nama,
            t.catatan,
            t.total,
            t.diskon,
            t.total_stlh_diskon,
            t.total_sblm_ppn,
            t.ppn,
            t.total_akhir,
            ISNULL(tag.total_tagihan, 0) AS total_tagihan,
            ISNULL(tag.total_dibayar, 0) AS total_dibayar,
            CASE
              WHEN ISNULL(tag.total_tagihan, 0) > 0
                AND ISNULL(tag.total_dibayar, 0) >= ISNULL(tag.total_tagihan, 0)
                THEN 1
              ELSE 0
            END AS is_lunas,
            CASE
              WHEN ISNULL(tag.total_tagihan, 0) > 0
                AND ISNULL(tag.total_dibayar, 0) >= ISNULL(tag.total_tagihan, 0)
                THEN 'PAID'
              ELSE 'NOT PAID'
            END AS status_paid
          FROM dbo.GWEN_t_pengadaan t
          LEFT JOIN dbo.m_supplier s
            ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.GWEN_t_rpo r
            ON r.kode_t_rpo COLLATE DATABASE_DEFAULT = t.kode_t_rpo COLLATE DATABASE_DEFAULT
          LEFT JOIN (
            SELECT
              kode_t_pengadaan,
              SUM(ISNULL(total_tagihan, 0)) AS total_tagihan,
              SUM(ISNULL(total_dibayar, 0)) AS total_dibayar
            FROM dbo.GWEN_t_tagihan
            WHERE ISNULL(status, 1) = 1
              AND ISNULL(is_void, 0) = 0
            GROUP BY kode_t_pengadaan
          ) tag
            ON tag.kode_t_pengadaan = t.kode_t_pengadaan
          WHERE RTRIM(LTRIM(t.kode_t_pengadaan)) = RTRIM(LTRIM(@kode_t_pengadaan))
            ${includeInactive ? "" : "AND ISNULL(t.status, 1) = 1"};
        `
        );
      if (!headerRes.recordset?.length) {
        return reply.code(404).send({ message: "Pengadaan tidak ditemukan" });
      }
      const detailRes = await pool
        .request()
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT
            kode_d_pengadaan,
            kode_t_pengadaan,
            kode_barang_variant,
            barcode_varian,
            nama_barang,
            nama_varian,
            qty,
            satuan,
            harga_beli,
            disc_1,
            disc_2,
            disc_3,
            subtotal,
            catatan,
            is_active,
            kode_parent
          FROM dbo.GWEN_d_pengadaan
          WHERE RTRIM(LTRIM(kode_t_pengadaan)) = RTRIM(LTRIM(@kode_t_pengadaan))
          ORDER BY created_at ASC, kode_d_pengadaan ASC;
        `
        );
      return reply.send({ header: headerRes.recordset[0], items: detailRes.recordset || [] });
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch pengadaan");
      return reply.code(500).send({ message: "Gagal memuat pengadaan" });
    }
  });

  fastify.get("/", async (request, reply) => {
    const { kode_supplier, status: statusQuery } = request.query || {};
    const statusFilterRaw = String(statusQuery || "aktif").trim().toLowerCase();
    try {
      const req = pool.request();
      const supplierFilter =
        kode_supplier && String(kode_supplier).trim().length
          ? "AND RTRIM(LTRIM(t.kode_supplier)) = RTRIM(LTRIM(@kode_supplier))"
          : "";
      if (supplierFilter) {
        req.input("kode_supplier", sql.VarChar(100), String(kode_supplier).trim());
      }
      let statusFilter = "AND ISNULL(t.status, 1) = 1";
      if (statusFilterRaw === "nonaktif") {
        statusFilter = "AND ISNULL(t.status, 1) <> 1";
      } else if (statusFilterRaw === "all") {
        statusFilter = "";
      }
      const res = await req.query(`
        SELECT
          t.kode_t_pengadaan,
          t.kode_t_rpo,
          t.tgl,
          t.deadline,
          t.kode_supplier,
          s.nama AS supplier_nama,
          t.no_faktur_supplier,
          t.catatan,
          t.status_pengadaan,
          t.status,
          t.total_akhir,
          ISNULL(tag.total_tagihan, 0) AS total_tagihan,
          ISNULL(tag.total_dibayar, 0) AS total_dibayar,
          CASE
            WHEN
              (
                CASE
                  WHEN ISNULL(tag.total_tagihan, 0) > 0 THEN ISNULL(tag.total_tagihan, 0)
                  ELSE ISNULL(t.total_akhir, 0)
                END
              ) > 0
              AND ISNULL(tag.total_dibayar, 0) >=
              (
                CASE
                  WHEN ISNULL(tag.total_tagihan, 0) > 0 THEN ISNULL(tag.total_tagihan, 0)
                  ELSE ISNULL(t.total_akhir, 0)
                END
              )
              THEN 1
            ELSE 0
          END AS is_lunas,
          ISNULL(pr.qty_dikirim, 0) AS qty_dikirim,
          ISNULL(pr.qty_diterima, 0) AS qty_diterima,
          t.created_by,
          t.created_at,
          t.updated_by,
          t.updated_at
        FROM dbo.GWEN_t_pengadaan t
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
        LEFT JOIN (
          SELECT
            kode_t_pengadaan,
            SUM(ISNULL(total_tagihan, 0)) AS total_tagihan,
            SUM(ISNULL(total_dibayar, 0)) AS total_dibayar
          FROM dbo.GWEN_t_tagihan
          WHERE ISNULL(status, 1) = 1
            AND ISNULL(is_void, 0) = 0
          GROUP BY kode_t_pengadaan
        ) tag
          ON tag.kode_t_pengadaan = t.kode_t_pengadaan
        LEFT JOIN (
          SELECT
            tp.kode_t_pengadaan,
            SUM(
              CASE
                WHEN COALESCE(p.is_active, p2.is_active, 1) = 1 THEN ISNULL(dp.jml_baik_dikirim, 0)
                ELSE 0
              END
            ) AS qty_dikirim,
            SUM(
              CASE
                WHEN COALESCE(p.is_active, p2.is_active, 1) = 1 THEN ISNULL(dp.jml_baik_diterima, 0)
                ELSE 0
              END
            ) AS qty_diterima
          FROM dbo.GWEN_t_penerimaan_pengadaan tp
          JOIN dbo.GWEN_d_penerimaan_pengadaan dp
            ON dp.kode_t_penerimaan_pengadaan = tp.kode_t_penerimaan_pengadaan
          LEFT JOIN dbo.GWEN_d_pengadaan p
            ON p.kode_d_pengadaan = dp.kode_d_pengadaan
          OUTER APPLY (
            SELECT TOP 1 p2.is_active
            FROM dbo.GWEN_d_pengadaan p2
            WHERE p2.kode_t_pengadaan = tp.kode_t_pengadaan
              AND p2.kode_barang_variant = dp.kode_barang
            ORDER BY p2.updated_at DESC, p2.created_at DESC
          ) p2
          GROUP BY tp.kode_t_pengadaan
        ) pr
          ON pr.kode_t_pengadaan = t.kode_t_pengadaan
        WHERE 1 = 1
          ${statusFilter}
          ${supplierFilter}
        ORDER BY t.created_at DESC, t.kode_t_pengadaan DESC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch pengadaan list");
      return reply.code(500).send({ message: "Gagal memuat data pengadaan" });
    }
  });

  fastify.patch("/:kode/nonaktif", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodePengadaan = String(kode || "").trim();
    const updatedBy = String(body.updated_by || "Admin").trim() || "Admin";
    const alasan = String(body.alasan || "PO dinonaktifkan").trim();
    const now = nowWib();

    if (!kodePengadaan) return reply.code(400).send({ message: "kode_t_pengadaan wajib diisi" });
    if (!kodePengadaan.startsWith("PEN.")) {
      return reply.code(400).send({ message: "Hanya PO PEN yang bisa dinonaktifkan dari menu ini" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const headerRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), kodePengadaan)
        .query(
          `
          SELECT TOP 1 kode_t_pengadaan, status
          FROM dbo.GWEN_t_pengadaan WITH (UPDLOCK, ROWLOCK)
          WHERE RTRIM(LTRIM(kode_t_pengadaan)) = RTRIM(LTRIM(@kode_t_pengadaan));
        `
        );
      if (!headerRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Pengadaan tidak ditemukan" });
      }

      await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), kodePengadaan)
        .input("catatan_nonaktif", sql.VarChar(255), alasan)
        .input("updated_by", sql.VarChar(255), updatedBy)
        .input("updated_at", sql.DateTime, now)
        .query(
          `
          UPDATE dbo.GWEN_t_pengadaan
          SET status = 0,
              status_cadangan = ISNULL(status_cadangan, status_pengadaan),
              catatan = CONCAT(ISNULL(catatan, ''), CASE WHEN ISNULL(catatan, '') = '' THEN '' ELSE ' | ' END, @catatan_nonaktif),
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE RTRIM(LTRIM(kode_t_pengadaan)) = RTRIM(LTRIM(@kode_t_pengadaan));
        `
        );

      const detailRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), kodePengadaan)
        .input("catatan_nonaktif", sql.VarChar(255), alasan)
        .input("updated_by", sql.VarChar(255), updatedBy)
        .input("updated_at", sql.DateTime, now)
        .query(
          `
          UPDATE dbo.GWEN_d_pengadaan
          SET is_active = 0,
              catatan = CONCAT(ISNULL(catatan, ''), CASE WHEN ISNULL(catatan, '') = '' THEN '' ELSE ' | ' END, @catatan_nonaktif),
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_t_pengadaan = @kode_t_pengadaan
            AND ISNULL(is_active, 1) = 1;
        `
        );

      const tagihanRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), kodePengadaan)
        .input("catatan_nonaktif", sql.VarChar(255), alasan)
        .input("updated_by", sql.VarChar(255), updatedBy)
        .input("updated_at", sql.DateTime, now)
        .query(
          `
          UPDATE dbo.GWEN_t_tagihan
          SET is_void = 1,
              void_by = @updated_by,
              void_at = @updated_at,
              status = 0,
              ket = CONCAT(ISNULL(ket, ''), CASE WHEN ISNULL(ket, '') = '' THEN '' ELSE ' | ' END, @catatan_nonaktif),
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_t_pengadaan = @kode_t_pengadaan
            AND ISNULL(is_void, 0) = 0;
        `
        );

      await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), kodePengadaan)
        .input("catatan_nonaktif", sql.VarChar(255), alasan)
        .input("updated_by", sql.VarChar(255), updatedBy)
        .input("updated_at", sql.DateTime, now)
        .query(
          `
          UPDATE dbo.GWEN_d_tagihan
          SET status = 0,
              catatan_item = CONCAT(ISNULL(catatan_item, ''), CASE WHEN ISNULL(catatan_item, '') = '' THEN '' ELSE ' | ' END, @catatan_nonaktif),
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_t_pengadaan = @kode_t_pengadaan
            AND ISNULL(status, 1) = 1;
        `
        );

      const penerimaanRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), kodePengadaan)
        .input("catatan_nonaktif", sql.VarChar(255), alasan)
        .input("updated_by", sql.VarChar(255), updatedBy)
        .input("updated_at", sql.DateTime, now)
        .query(
          `
          UPDATE dbo.GWEN_t_penerimaan_pengadaan
          SET status = 0,
              catatan = CONCAT(ISNULL(catatan, ''), CASE WHEN ISNULL(catatan, '') = '' THEN '' ELSE ' | ' END, @catatan_nonaktif),
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_t_pengadaan = @kode_t_pengadaan
            AND ISNULL(status, 1) = 1;
        `
        );

      await tx.commit();
      return reply.send({
        message: "PO berhasil dinonaktifkan",
        kode_t_pengadaan: kodePengadaan,
        detail_nonaktif: detailRes.rowsAffected?.[0] || 0,
        tagihan_void: tagihanRes.rowsAffected?.[0] || 0,
        penerimaan_nonaktif: penerimaanRes.rowsAffected?.[0] || 0,
      });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed deactivate pengadaan");
      return reply.code(500).send({ message: "Gagal menonaktifkan PO" });
    }
  });

  fastify.put("/:kode/edit", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const secret = String(body.secret || "").trim();
    const no_faktur_supplier = String(body.no_faktur_supplier || "").trim() || null;
    const items = Array.isArray(body.items) ? body.items : [];
    const deletedItems = Array.isArray(body.deleted_items) ? body.deleted_items : [];
    const newItems = Array.isArray(body.new_items) ? body.new_items : [];
    const updated_by = String(body.updated_by || "Admin").trim() || "Admin";
    const now = nowWib();

    if (!kode) return reply.code(400).send({ message: "kode_t_pengadaan wajib diisi" });
    if (secret !== (process.env.PO_EDIT_SECRET || "rahasia")) {
      return reply.code(403).send({ message: "Secret tidak valid" });
    }
    if (items.length === 0 && deletedItems.length === 0 && newItems.length === 0) {
      return reply.code(400).send({ message: "Items tidak boleh kosong" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const headerRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT TOP 1 total_akhir, diskon, ppn, kode_t_rpo, kode_supplier
          FROM dbo.GWEN_t_pengadaan
          WHERE RTRIM(LTRIM(kode_t_pengadaan)) = RTRIM(LTRIM(@kode_t_pengadaan));
        `
        );
      if (!headerRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Pengadaan tidak ditemukan" });
      }

      const kode_t_rpo = headerRes.recordset[0]?.kode_t_rpo || null;
      const kode_supplier = headerRes.recordset[0]?.kode_supplier || null;

      if (deletedItems.length) {
        for (const kode_d_pengadaan of deletedItems) {
          const kodeDel = String(kode_d_pengadaan || "").trim();
          if (!kodeDel) continue;
          await new sql.Request(tx)
            .input("kode_d_pengadaan", sql.VarChar(255), kodeDel)
            .input("updated_by", sql.VarChar(255), updated_by)
            .input("updated_at", sql.DateTime, now)
            .query(
              `
              UPDATE dbo.GWEN_d_pengadaan
              SET is_active = 0,
                  updated_by = @updated_by,
                  updated_at = @updated_at
              WHERE kode_d_pengadaan = @kode_d_pengadaan;
            `
            );

          await new sql.Request(tx)
            .input("kode_d_pengadaan", sql.VarChar(255), kodeDel)
            .input("updated_by", sql.VarChar(255), updated_by)
            .input("updated_at", sql.DateTime, now)
            .query(
              `
              UPDATE dbo.GWEN_d_penerimaan_pengadaan
              SET status = 0,
                  jml_baik_dikirim = 0,
                  updated_by = @updated_by,
                  updated_at = @updated_at
              WHERE kode_d_pengadaan = @kode_d_pengadaan;
            `
            );
        }
      }

      for (const it of items) {
        const kode_d_pengadaan = String(it.kode_d_pengadaan || "").trim();
        if (!kode_d_pengadaan) continue;
        if (deletedItems.includes(kode_d_pengadaan)) continue;
        const qty = Math.max(0, Number(it.qty ?? 0));
        const harga = Math.max(0, Number(it.harga_beli ?? 0));
        const subtotal = qty * harga;

        await new sql.Request(tx)
          .input("kode_d_pengadaan", sql.VarChar(255), kode_d_pengadaan)
          .input("qty", sql.Int, qty)
          .input("harga_beli", sql.Decimal(20, 2), harga)
          .input("subtotal", sql.Decimal(20, 2), subtotal)
          .input("updated_by", sql.VarChar(255), updated_by)
          .input("updated_at", sql.DateTime, now)
          .query(
            `
            UPDATE dbo.GWEN_d_pengadaan
            SET qty = @qty,
                harga_beli = @harga_beli,
                subtotal = @subtotal,
                updated_by = @updated_by,
                updated_at = @updated_at
            WHERE kode_d_pengadaan = @kode_d_pengadaan;
          `
          );

        await new sql.Request(tx)
          .input("kode_d_pengadaan", sql.VarChar(255), kode_d_pengadaan)
          .input("qty", sql.Decimal(20, 2), qty)
          .input("updated_by", sql.VarChar(255), updated_by)
          .input("updated_at", sql.DateTime, now)
          .query(
            `
            UPDATE dbo.GWEN_d_penerimaan_pengadaan
            SET jml_baik_dikirim = @qty,
                updated_by = @updated_by,
                updated_at = @updated_at
            WHERE kode_d_pengadaan = @kode_d_pengadaan;
          `
          );
      }

      if (newItems.length) {
        const gudangFallbackRes = await new sql.Request(tx)
          .input("kode_t_rpo", sql.VarChar(255), kode_t_rpo)
          .query(
            `
            SELECT TOP 1 kode_gudang_asal
            FROM dbo.GWEN_t_rpo
            WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo));
          `
          );
        const kodeGudangFallback = gudangFallbackRes.recordset?.[0]?.kode_gudang_asal || null;

        let kode_t_penerimaan_pengadaan = null;
        const penerimaanExisting = await new sql.Request(tx)
          .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
          .query(
            `
            SELECT TOP 1 kode_t_penerimaan_pengadaan
            FROM dbo.GWEN_t_penerimaan_pengadaan
            WHERE kode_t_pengadaan = @kode_t_pengadaan;
          `
          );
        if (penerimaanExisting.recordset?.length) {
          kode_t_penerimaan_pengadaan = penerimaanExisting.recordset[0].kode_t_penerimaan_pengadaan;
        } else {
          kode_t_penerimaan_pengadaan = await generatePenerimaanCode({ prefix: "PPG", tx });
          await new sql.Request(tx)
            .input("kode_t_penerimaan_pengadaan", sql.VarChar(255), kode_t_penerimaan_pengadaan)
            .input("kode_supplier", sql.VarChar(255), kode_supplier)
            .input("kode_gudang", sql.VarChar(255), kodeGudangFallback)
            .input("no_sj_masuk", sql.VarChar(255), null)
            .input("catatan", sql.VarChar(255), null)
            .input("status", sql.Int, 1)
            .input("status_cadangan", sql.Int, null)
            .input("created_by", sql.VarChar(255), updated_by)
            .input("created_at", sql.DateTime, now)
            .input("updated_by", sql.VarChar(255), updated_by)
            .input("updated_at", sql.DateTime, now)
            .input("tgl", sql.DateTime, now)
            .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
            .query(
              `
              INSERT INTO dbo.GWEN_t_penerimaan_pengadaan (
                kode_t_penerimaan_pengadaan, kode_supplier, kode_gudang, no_sj_masuk, catatan, status, status_cadangan,
                created_by, created_at, updated_by, updated_at, tgl, kode_t_pengadaan
              ) VALUES (
                @kode_t_penerimaan_pengadaan, @kode_supplier, @kode_gudang, @no_sj_masuk, @catatan, @status, @status_cadangan,
                @created_by, @created_at, @updated_by, @updated_at, @tgl, @kode_t_pengadaan
              );
            `
            );
        }

        for (const it of newItems) {
          const kode_barang_variant = String(it.kode_barang_variant || "").trim();
          if (!kode_barang_variant) continue;
          const qty = Math.max(0, Number(it.qty ?? 0));
          const harga_beli = Math.max(0, Number(it.harga_beli ?? 0));
          const subtotal = qty * harga_beli;

          const varianRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
            .query(
              `
              SELECT TOP 1 v.barcode_varian, v.nama_varian, v.kode_barang_variant, b.nama AS nama_barang,
                     b.kode_barang, b.kode_gudang
              FROM dbo.m_barang_varian v
              JOIN dbo.m_barang b ON b.id_barang = v.id_barang
              WHERE v.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT;
            `
            );
          if (!varianRes.recordset?.length) continue;
          const varian = varianRes.recordset[0];
          const kode_barang = varian.kode_barang || null;
          const kode_gudang = varian.kode_gudang || kodeGudangFallback || null;
          let kode_d_pengadaan = await generateDetailCode({ prefix: "DPN", tx, padLength: 6 });
          let tries = 0;
          while (tries < 5) {
            const exists = await new sql.Request(tx)
              .input("kode_d_pengadaan", sql.VarChar(255), kode_d_pengadaan)
              .query(
                `
                SELECT 1
                FROM dbo.GWEN_d_pengadaan
                WHERE kode_d_pengadaan = @kode_d_pengadaan;
              `
              );
            if (!exists.recordset?.length) break;
            tries += 1;
            kode_d_pengadaan = await generateDetailCode({ prefix: "DPN", tx, padLength: 6 });
          }

          await new sql.Request(tx)
            .input("kode_d_pengadaan", sql.VarChar(255), kode_d_pengadaan)
            .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
            .input("kode_t_rpo", sql.VarChar(255), kode_t_rpo)
            .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant || null)
            .input("barcode_varian", sql.VarChar(255), varian.barcode_varian || null)
            .input("nama_barang", sql.VarChar(255), varian.nama_barang || null)
            .input("nama_varian", sql.VarChar(255), varian.nama_varian || null)
            .input("qty", sql.Int, qty)
            .input("satuan", sql.VarChar(50), it.satuan || "PCS")
            .input("harga_beli", sql.Decimal(20, 2), harga_beli)
            .input("disc_1", sql.Decimal(20, 2), 0)
            .input("disc_2", sql.Decimal(20, 2), 0)
            .input("disc_3", sql.Decimal(20, 2), 0)
            .input("subtotal", sql.Decimal(20, 2), subtotal)
            .input("catatan", sql.VarChar(255), it.catatan || null)
            .input("is_active", sql.Bit, 1)
            .input("kode_parent", sql.VarChar(255), null)
            .input("created_by", sql.VarChar(255), updated_by)
            .input("created_at", sql.DateTime, now)
            .input("updated_by", sql.VarChar(255), updated_by)
            .input("updated_at", sql.DateTime, now)
            .query(
              `
              INSERT INTO dbo.GWEN_d_pengadaan (
                kode_d_pengadaan, kode_t_pengadaan, kode_t_rpo, kode_barang_variant, barcode_varian, nama_barang, nama_varian,
                qty, satuan, harga_beli, disc_1, disc_2, disc_3, subtotal, catatan, is_active, kode_parent,
                created_by, created_at, updated_by, updated_at
              ) VALUES (
                @kode_d_pengadaan, @kode_t_pengadaan, @kode_t_rpo, @kode_barang_variant, @barcode_varian, @nama_barang, @nama_varian,
                @qty, @satuan, @harga_beli, @disc_1, @disc_2, @disc_3, @subtotal, @catatan, @is_active, @kode_parent,
                @created_by, @created_at, @updated_by, @updated_at
              );
            `
            );

          if (kode_t_penerimaan_pengadaan) {
            const kode_d_penerimaan_pengadaan = await generatePenerimaanDetailCode({
              prefix: "DPPG",
              tx,
              padLength: 6,
            });
            await new sql.Request(tx)
              .input("kode_d_penerimaan_pengadaan", sql.VarChar(255), kode_d_penerimaan_pengadaan)
              .input("kode_t_penerimaan_pengadaan", sql.VarChar(255), kode_t_penerimaan_pengadaan)
              .input("kode_barang", sql.VarChar(255), kode_barang_variant || null)
              .input("jml_baik_dikirim", sql.Decimal(20, 2), qty)
              .input("jml_baik_diterima", sql.Decimal(20, 2), 0)
              .input("satuan_jml_baik", sql.VarChar(255), it.satuan || "PCS")
              .input("jml_rusak_diterima", sql.Decimal(20, 2), 0)
              .input("satuan_jml_rusak", sql.VarChar(255), it.satuan || "PCS")
              .input("catatan", sql.VarChar(255), it.catatan || null)
              .input("status", sql.Int, 1)
              .input("status_cadangan", sql.Int, null)
              .input("created_by", sql.VarChar(255), updated_by)
              .input("created_at", sql.DateTime, now)
              .input("updated_by", sql.VarChar(255), updated_by)
              .input("updated_at", sql.DateTime, now)
              .input("kode_d_pengadaan", sql.VarChar(255), kode_d_pengadaan)
              .query(
                `
                INSERT INTO dbo.GWEN_d_penerimaan_pengadaan (
                  kode_d_penerimaan_pengadaan, kode_t_penerimaan_pengadaan, kode_barang, jml_baik_dikirim, jml_baik_diterima, satuan_jml_baik,
                  jml_rusak_diterima, satuan_jml_rusak, catatan, status, status_cadangan, created_by, created_at,
                  updated_by, updated_at, kode_d_pengadaan
                ) VALUES (
                  @kode_d_penerimaan_pengadaan, @kode_t_penerimaan_pengadaan, @kode_barang, @jml_baik_dikirim, @jml_baik_diterima, @satuan_jml_baik,
                  @jml_rusak_diterima, @satuan_jml_rusak, @catatan, @status, @status_cadangan, @created_by, @created_at,
                  @updated_by, @updated_at, @kode_d_pengadaan
                );
              `
              );
          }

          if (kode_barang_variant && harga_beli > 0) {
            const varianUpdateRes = await new sql.Request(tx)
              .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
              .input("harga_beli", sql.Decimal(20, 2), harga_beli)
              .input("updated_by", sql.VarChar(255), updated_by)
              .input("updated_at", sql.DateTime, now)
              .query(
                `
                UPDATE dbo.m_barang_varian
                SET harga_beli_sat_1 = @harga_beli,
                    updated_by = @updated_by,
                    updated_at = @updated_at
                WHERE kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT
                  AND ISNULL(harga_beli_sat_1, 0) <> @harga_beli;
              `
              );

            const baseUpdateRes = await new sql.Request(tx)
              .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
              .input("harga_beli", sql.Decimal(20, 2), harga_beli)
              .input("updated_by", sql.VarChar(255), updated_by)
              .input("updated_at", sql.DateTime, now)
              .query(
                `
                UPDATE b
                SET b.harga_beli_sat_1 = @harga_beli,
                    b.updated_by = @updated_by,
                    b.updated_at = @updated_at
                FROM dbo.m_barang b
                JOIN dbo.m_barang_varian v ON v.id_barang = b.id_barang
                WHERE v.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT
                  AND ISNULL(b.harga_beli_sat_1, 0) <> @harga_beli;
              `
              );

            const varianUpdated = varianUpdateRes.rowsAffected?.[0] || 0;
            const baseUpdated = baseUpdateRes.rowsAffected?.[0] || 0;
            if (varianUpdated > 0 || baseUpdated > 0) {
              const kodeHistory = await generateDocCode({ prefix: "HBB", tx });
              await new sql.Request(tx)
                .input("kode_h_harga_beli_barang", sql.VarChar(50), kodeHistory)
                .input("kode_barang_variant", sql.VarChar(50), kode_barang_variant)
                .input("kode_barang", sql.VarChar(100), kode_barang || null)
                .input("harga_beli_sat_1", sql.Decimal(20, 2), harga_beli)
                .input("sumber", sql.VarChar(50), "PENGADAAN")
                .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
                .input("kode_d_pengadaan", sql.VarChar(255), kode_d_pengadaan)
                .input("catatan", sql.VarChar(255), it.catatan || null)
                .input("created_by", sql.VarChar(100), updated_by)
                .input("created_at", sql.DateTime2, now)
                .query(
                  `
                  INSERT INTO dbo.GWEN_h_harga_beli_barang (
                    kode_h_harga_beli_barang,
                    kode_barang_variant,
                    kode_barang,
                    harga_beli_sat_1,
                    sumber,
                    kode_t_pengadaan,
                    kode_d_pengadaan,
                    catatan,
                    created_by,
                    created_at
                  ) VALUES (
                    @kode_h_harga_beli_barang,
                    @kode_barang_variant,
                    @kode_barang,
                    @harga_beli_sat_1,
                    @sumber,
                    @kode_t_pengadaan,
                    @kode_d_pengadaan,
                    @catatan,
                    @created_by,
                    @created_at
                  );
                `
                );
            }
          }
        }
      }

      await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .input("updated_by", sql.VarChar(255), updated_by)
        .input("updated_at", sql.DateTime, now)
        .query(
          `
          UPDATE dbo.GWEN_d_pengadaan
          SET subtotal = ISNULL(qty, 0) * ISNULL(harga_beli, 0),
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE RTRIM(LTRIM(kode_t_pengadaan)) = RTRIM(LTRIM(@kode_t_pengadaan))
            AND ISNULL(is_active, 1) = 1;
        `
        );

      const totalsRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT
            COUNT(1) AS total_item,
            SUM(ISNULL(qty, 0)) AS total_qty,
            SUM(ISNULL(subtotal, 0)) AS total
          FROM dbo.GWEN_d_pengadaan
          WHERE RTRIM(LTRIM(kode_t_pengadaan)) = RTRIM(LTRIM(@kode_t_pengadaan))
            AND ISNULL(is_active, 1) = 1;
        `
        );
      const total = Number(totalsRes.recordset?.[0]?.total ?? 0);
      const totalQty = Number(totalsRes.recordset?.[0]?.total_qty ?? 0);
      const totalItem = Number(totalsRes.recordset?.[0]?.total_item ?? 0);
      const diskon = Number(headerRes.recordset[0]?.diskon ?? 0);
      const ppn = Number(headerRes.recordset[0]?.ppn ?? 0);
      const total_stlh_diskon = total - diskon;
      const total_sblm_ppn = total_stlh_diskon;
      const total_akhir = total_sblm_ppn + ppn;

      await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .input("total", sql.Decimal(20, 2), total)
        .input("diskon", sql.Decimal(20, 2), diskon)
        .input("total_stlh_diskon", sql.Decimal(20, 2), total_stlh_diskon)
        .input("total_sblm_ppn", sql.Decimal(20, 2), total_sblm_ppn)
        .input("ppn", sql.Decimal(20, 2), ppn)
        .input("total_akhir", sql.Decimal(20, 2), total_akhir)
        .input("jumlah_barang", sql.Decimal(20, 2), totalItem)
        .input("jumlah_diterima", sql.Decimal(20, 2), totalQty)
        .input("no_faktur_supplier", sql.VarChar(255), no_faktur_supplier)
        .input("updated_by", sql.VarChar(255), updated_by)
        .input("updated_at", sql.DateTime, now)
        .query(
          `
          UPDATE dbo.GWEN_t_pengadaan
          SET total = @total,
              diskon = @diskon,
              total_stlh_diskon = @total_stlh_diskon,
              total_sblm_ppn = @total_sblm_ppn,
              ppn = @ppn,
              total_akhir = @total_akhir,
              jumlah_barang = @jumlah_barang,
              jumlah_diterima = @jumlah_diterima,
              no_faktur_supplier = @no_faktur_supplier,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE RTRIM(LTRIM(kode_t_pengadaan)) = RTRIM(LTRIM(@kode_t_pengadaan));
        `
        );

      const kodeVarRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT DISTINCT kode_barang_variant
          FROM dbo.GWEN_d_pengadaan
          WHERE RTRIM(LTRIM(kode_t_pengadaan)) = RTRIM(LTRIM(@kode_t_pengadaan))
            AND kode_barang_variant IS NOT NULL;
        `
        );
      await updateHppAvgFromPengadaan({
        tx,
        kodeBarangVariants: kodeVarRes.recordset?.map((row) => row.kode_barang_variant) || [],
        updatedBy: updated_by,
      });

      await tx.commit();

      const refreshed = await pool
        .request()
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT TOP 1
            t.kode_t_pengadaan,
            t.kode_t_rpo,
            t.tgl,
            r.tanggal_barang_datang,
            t.deadline,
            t.kode_supplier,
            t.no_faktur_supplier,
            t.created_by,
            s.nama AS supplier_nama,
            t.catatan,
            t.total,
            t.diskon,
            t.total_stlh_diskon,
            t.total_sblm_ppn,
            t.ppn,
            t.total_akhir
          FROM dbo.GWEN_t_pengadaan t
          LEFT JOIN dbo.m_supplier s
            ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.GWEN_t_rpo r
            ON r.kode_t_rpo COLLATE DATABASE_DEFAULT = t.kode_t_rpo COLLATE DATABASE_DEFAULT
          WHERE RTRIM(LTRIM(t.kode_t_pengadaan)) = RTRIM(LTRIM(@kode_t_pengadaan));
        `
        );

      const detailRes = await pool
        .request()
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT
            kode_d_pengadaan,
            kode_t_pengadaan,
            kode_barang_variant,
            barcode_varian,
            nama_barang,
            nama_varian,
            qty,
            satuan,
            harga_beli,
            disc_1,
            disc_2,
            disc_3,
            subtotal,
            catatan,
            is_active,
            kode_parent
          FROM dbo.GWEN_d_pengadaan
          WHERE RTRIM(LTRIM(kode_t_pengadaan)) = RTRIM(LTRIM(@kode_t_pengadaan))
          ORDER BY created_at ASC, kode_d_pengadaan ASC;
        `
        );

      return reply.send({ header: refreshed.recordset?.[0] || null, items: detailRes.recordset || [] });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed update pengadaan");
      return reply.code(500).send({ message: "Gagal update pengadaan" });
    }
  });
}
