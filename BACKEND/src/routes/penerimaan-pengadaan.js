import { formatWibSqlDateTime, logWibConversion, nowWib, wibStamp } from "../utils/wib-time.js";

export default async function penerimaanPengadaanRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const generateStockCode = (prefix) => `${prefix}.${wibStamp()}`;

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

  fastify.get("/po-open", async (request, reply) => {
    const { barcode, q, limit: limitParam } = request.query || {};
    const searchValue = String(q || barcode || "").trim();
    const hasSearch = Boolean(searchValue);
    const rawLimit = Number(limitParam);
    const defaultLimit = 500;
    const maxLimit = 2000;
    const limit = !hasSearch
      ? Math.max(50, Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit, maxLimit))
      : null;
    const topClause = limit ? "TOP (@limit)" : "";
    const orderClause = limit ? "ORDER BY p.created_at DESC, p.kode_t_pengadaan DESC" : "";
    try {
      const req = pool.request();
      req.input("search", sql.VarChar(255), searchValue || null);
      if (limit) req.input("limit", sql.Int, limit);
      const res = await req.query(
        `
        WITH base_po AS (
          SELECT ${topClause}
            p.kode_t_pengadaan,
            p.kode_t_rpo,
            p.tgl,
            p.deadline,
            p.kode_supplier,
            p.total_akhir,
            p.created_at
          FROM dbo.GWEN_t_pengadaan p
          WHERE (
            @search IS NULL
            OR p.kode_t_pengadaan LIKE '%' + @search + '%'
            OR EXISTS (
              SELECT 1
              FROM dbo.GWEN_d_pengadaan d
              LEFT JOIN dbo.m_barang_varian v
                ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT
              LEFT JOIN dbo.m_barang b
                ON b.id_barang = v.id_barang
              WHERE d.kode_t_pengadaan = p.kode_t_pengadaan
                AND (
                  d.barcode_varian LIKE '%' + @search + '%'
                  OR v.barcode_varian LIKE '%' + @search + '%'
                  OR d.nama_barang LIKE '%' + @search + '%'
                  OR v.nama_varian LIKE '%' + @search + '%'
                  OR b.nama LIKE '%' + @search + '%'
                )
            )
          )
            AND ISNULL(p.status, 1) = 1
          ${orderClause}
        ),
        penerimaan AS (
          SELECT
            d.kode_t_penerimaan_pengadaan,
            SUM(ISNULL(d.jml_baik_dikirim, 0)) AS total_dikirim,
            SUM(ISNULL(d.jml_baik_diterima, 0)) AS total_diterima,
            SUM(CASE WHEN ISNULL(d.jml_baik_dikirim, 0) > 0 THEN 1 ELSE 0 END) AS total_item_d
          FROM dbo.GWEN_d_penerimaan_pengadaan d
          JOIN dbo.GWEN_t_penerimaan_pengadaan t
            ON t.kode_t_penerimaan_pengadaan = d.kode_t_penerimaan_pengadaan
          JOIN base_po bp
            ON bp.kode_t_pengadaan = t.kode_t_pengadaan
          WHERE ISNULL(d.status, 1) = 1
          GROUP BY d.kode_t_penerimaan_pengadaan
        ),
        stok AS (
          SELECT
            h.kode_ref_transaksi AS kode_t_penerimaan_pengadaan,
            COUNT(1) AS total_item_h
          FROM dbo.GWEN_h_stok_barang_variant h
          JOIN dbo.GWEN_t_penerimaan_pengadaan t
            ON t.kode_t_penerimaan_pengadaan = h.kode_ref_transaksi
          JOIN base_po bp
            ON bp.kode_t_pengadaan = t.kode_t_pengadaan
          GROUP BY h.kode_ref_transaksi
        )
        SELECT
          p.kode_t_pengadaan,
          t.kode_t_penerimaan_pengadaan,
          t.kode_gudang,
          COALESCE(NULLIF(t.updated_by, ''), NULLIF(t.created_by, '')) AS penerima_barang,
          g.nama AS nama_gudang,
          p.kode_t_rpo,
          p.tgl,
          p.deadline,
          p.kode_supplier,
          s.nama AS supplier_nama,
          p.total_akhir,
          ISNULL(pr.total_dikirim, 0) AS total_dikirim,
          ISNULL(pr.total_diterima, 0) AS total_diterima,
          ISNULL(pr.total_item_d, 0) AS total_item_d,
          ISNULL(st.total_item_h, 0) AS total_item_h,
          CASE
            WHEN ISNULL(pr.total_dikirim, 0) = 0 THEN 0
            ELSE CAST(ROUND((ISNULL(pr.total_diterima, 0) * 100.0) / NULLIF(pr.total_dikirim, 0), 0) AS INT)
          END AS persen_diterima,
          CASE
            WHEN t.kode_t_pengadaan IS NULL THEN 'Belum diterima'
            WHEN ISNULL(pr.total_diterima, 0) < ISNULL(pr.total_dikirim, 0) THEN 'Belum diterima'
            ELSE 'Sudah diterima'
          END AS status_penerimaan
        FROM base_po p
        LEFT JOIN dbo.GWEN_t_penerimaan_pengadaan t
          ON t.kode_t_pengadaan = p.kode_t_pengadaan
        LEFT JOIN penerimaan pr
          ON pr.kode_t_penerimaan_pengadaan = t.kode_t_penerimaan_pengadaan
        LEFT JOIN stok st
          ON st.kode_t_penerimaan_pengadaan = t.kode_t_penerimaan_pengadaan
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = p.kode_supplier COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.m_gudang g
          ON g.kode_gudang COLLATE DATABASE_DEFAULT = t.kode_gudang COLLATE DATABASE_DEFAULT
        ORDER BY p.created_at DESC, p.kode_t_pengadaan DESC;
        `
      );
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch penerimaan pengadaan list");
      return reply.code(500).send({ message: "Gagal memuat data penerimaan pengadaan" });
    }
  });

  fastify.get("/:kode", async (request, reply) => {
    const { kode } = request.params;
    if (!kode) return reply.code(400).send({ message: "kode_t_pengadaan wajib diisi" });
    try {
      const headerRes = await pool
        .request()
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT TOP 1
            t.kode_t_penerimaan_pengadaan,
            t.kode_t_pengadaan,
            t.kode_supplier,
            t.kode_gudang,
            g.nama AS nama_gudang,
            t.no_sj_masuk,
            t.catatan,
            t.status,
            t.tgl,
            s.nama AS supplier_nama
          FROM dbo.GWEN_t_penerimaan_pengadaan t
          LEFT JOIN dbo.m_supplier s
            ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.m_gudang g
            ON g.kode_gudang COLLATE DATABASE_DEFAULT = t.kode_gudang COLLATE DATABASE_DEFAULT
          WHERE t.kode_t_pengadaan = @kode_t_pengadaan;
        `
        );

      if (!headerRes.recordset?.length) {
        return reply.code(404).send({ message: "Penerimaan pengadaan tidak ditemukan" });
      }

      const detailRes = await pool
        .request()
        .input("kode_t_penerimaan_pengadaan", sql.VarChar(255), headerRes.recordset[0].kode_t_penerimaan_pengadaan)
        .query(
          `
          SELECT
            d.kode_d_penerimaan_pengadaan,
            d.kode_t_penerimaan_pengadaan,
            d.kode_barang,
            d.jml_baik_dikirim,
            d.jml_baik_diterima,
            d.satuan_jml_baik,
            d.jml_rusak_diterima,
            d.satuan_jml_rusak,
            d.catatan,
            d.status,
            d.kode_d_pengadaan,
            COALESCE(p.is_active, p2.is_active) AS is_active,
            h.kode_h_stok_barang,
            h.qty_masuk,
            b.nama AS nama_barang,
            b.kode_gudang AS kode_gudang,
            v.nama_varian AS nama_varian,
            v.barcode_varian AS barcode_varian
          FROM dbo.GWEN_d_penerimaan_pengadaan d
          LEFT JOIN dbo.GWEN_t_penerimaan_pengadaan t
            ON t.kode_t_penerimaan_pengadaan = d.kode_t_penerimaan_pengadaan
          LEFT JOIN dbo.GWEN_d_pengadaan p
            ON p.kode_d_pengadaan = d.kode_d_pengadaan
          OUTER APPLY (
            SELECT TOP 1 p2.is_active
            FROM dbo.GWEN_d_pengadaan p2
            WHERE p2.kode_t_pengadaan = t.kode_t_pengadaan
              AND p2.kode_barang_variant = d.kode_barang
            ORDER BY p2.updated_at DESC, p2.created_at DESC
          ) p2
          OUTER APPLY (
            SELECT TOP 1 h.kode_h_stok_barang, h.qty_masuk
            FROM dbo.GWEN_h_stok_barang_variant h
            WHERE h.kode_ref_transaksi = d.kode_t_penerimaan_pengadaan
              AND h.kode_barang_variant = d.kode_barang
            ORDER BY h.created_at, h.kode_h_stok_barang
          ) h
          LEFT JOIN dbo.m_barang_varian v
            ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.m_barang b
            ON b.id_barang = v.id_barang
          WHERE d.kode_t_penerimaan_pengadaan = @kode_t_penerimaan_pengadaan
          ORDER BY d.created_at ASC, d.kode_d_penerimaan_pengadaan ASC;
        `
        );

      return reply.send({ header: headerRes.recordset[0], items: detailRes.recordset || [] });
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch penerimaan pengadaan detail");
      return reply.code(500).send({ message: "Gagal memuat penerimaan pengadaan" });
    }
  });

  fastify.get("/:kode/mismatch", async (request, reply) => {
    const { kode } = request.params;
    if (!kode) return reply.code(400).send({ message: "kode_t_pengadaan wajib diisi" });
    try {
      const headerRes = await pool
        .request()
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT TOP 1
            kode_t_penerimaan_pengadaan,
            kode_gudang
          FROM dbo.GWEN_t_penerimaan_pengadaan
          WHERE kode_t_pengadaan = @kode_t_pengadaan;
        `
        );

      if (!headerRes.recordset?.length) {
        return reply.code(404).send({ message: "Penerimaan pengadaan tidak ditemukan" });
      }

      const kode_t_penerimaan_pengadaan = headerRes.recordset[0].kode_t_penerimaan_pengadaan;

      const missingRes = await pool
        .request()
        .input("kode_t_penerimaan_pengadaan", sql.VarChar(255), kode_t_penerimaan_pengadaan)
        .query(
          `
          WITH d AS (
            SELECT
              d.kode_d_penerimaan_pengadaan,
              d.kode_barang,
              d.jml_baik_diterima,
              d.satuan_jml_baik,
              ROW_NUMBER() OVER (
                PARTITION BY d.kode_barang
                ORDER BY d.created_at, d.kode_d_penerimaan_pengadaan
              ) AS rn
            FROM dbo.GWEN_d_penerimaan_pengadaan d
            WHERE d.kode_t_penerimaan_pengadaan = @kode_t_penerimaan_pengadaan
              AND ISNULL(d.jml_baik_diterima, 0) > 0
          ),
          h AS (
            SELECT
              h.kode_h_stok_barang,
              h.kode_barang_variant,
              h.qty_masuk,
              h.satuan,
              ROW_NUMBER() OVER (
                PARTITION BY h.kode_barang_variant
                ORDER BY h.created_at, h.kode_h_stok_barang
              ) AS rn
            FROM dbo.GWEN_h_stok_barang_variant h
            WHERE h.kode_ref_transaksi = @kode_t_penerimaan_pengadaan
          )
          SELECT
            COALESCE(d.kode_barang, h.kode_barang_variant) AS kode_barang_variant,
            d.jml_baik_diterima,
            d.satuan_jml_baik,
            h.qty_masuk,
            h.satuan AS satuan_h,
            CASE
              WHEN d.kode_barang IS NULL THEN 'H_ONLY'
              WHEN h.kode_barang_variant IS NULL THEN 'D_ONLY'
              ELSE 'COUNT_MISMATCH'
            END AS mismatch_type,
            b.nama AS nama_barang,
            v.nama_varian AS nama_varian,
            b.kode_gudang AS kode_gudang_barang
          FROM d
          FULL JOIN h
            ON h.kode_barang_variant = d.kode_barang
           AND h.rn = d.rn
          LEFT JOIN dbo.m_barang_varian v
            ON v.kode_barang_variant COLLATE DATABASE_DEFAULT =
              COALESCE(d.kode_barang, h.kode_barang_variant) COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.m_barang b
            ON b.id_barang = v.id_barang
          WHERE d.kode_barang IS NULL OR h.kode_barang_variant IS NULL
          ORDER BY COALESCE(d.kode_barang, h.kode_barang_variant);
        `
        );

      return reply.send({
        kode_t_penerimaan_pengadaan,
        items: missingRes.recordset || [],
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch penerimaan mismatch");
      return reply.code(500).send({ message: "Gagal memuat mismatch penerimaan" });
    }
  });

  fastify.put("/:kode/target-gudang", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodeGudang = String(body.kode_gudang || "").trim();
    const updatedBy = String(body.updated_by || "Admin").trim() || "Admin";
    if (!kode) return reply.code(400).send({ message: "kode_t_pengadaan wajib diisi" });
    if (!kodeGudang) return reply.code(400).send({ message: "kode_gudang wajib diisi" });
    try {
      const gudangRes = await pool
        .request()
        .input("kode_gudang", sql.VarChar(255), kodeGudang)
        .query(`
          SELECT TOP 1 kode_gudang, nama
          FROM dbo.m_gudang
          WHERE kode_gudang = @kode_gudang;
        `);
      if (!gudangRes.recordset?.length) {
        return reply.code(404).send({ message: "Gudang tidak ditemukan" });
      }

      const result = await pool
        .request()
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .input("kode_gudang", sql.VarChar(255), kodeGudang)
        .input("updated_by", sql.VarChar(255), updatedBy)
        .input("updated_at", sql.DateTime, nowWib())
        .query(`
          UPDATE dbo.GWEN_t_penerimaan_pengadaan
          SET kode_gudang = @kode_gudang,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_t_pengadaan = @kode_t_pengadaan;
        `);
      if (!result.rowsAffected?.[0]) {
        return reply.code(404).send({ message: "Penerimaan pengadaan tidak ditemukan" });
      }

      return reply.send({
        message: "Target gudang diperbarui",
        kode_gudang: gudangRes.recordset[0].kode_gudang,
        nama_gudang: gudangRes.recordset[0].nama || gudangRes.recordset[0].kode_gudang,
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed update target gudang penerimaan pengadaan");
      return reply.code(500).send({ message: "Gagal memperbarui target gudang" });
    }
  });

  fastify.post("/:kode/fix-missing", async (request, reply) => {
    const { kode } = request.params;
    if (!kode) return reply.code(400).send({ message: "kode_t_pengadaan wajib diisi" });
    const body = request.body || {};
    const updated_by = String(body.updated_by || "Admin").trim() || "Admin";

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const headerRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT TOP 1
            kode_t_penerimaan_pengadaan,
            kode_gudang
          FROM dbo.GWEN_t_penerimaan_pengadaan
          WHERE kode_t_pengadaan = @kode_t_pengadaan;
        `
        );

      if (!headerRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Penerimaan pengadaan tidak ditemukan" });
      }

      const kode_t_penerimaan_pengadaan = headerRes.recordset[0].kode_t_penerimaan_pengadaan;
      const headerGudang = headerRes.recordset[0].kode_gudang || null;

      const missingRes = await new sql.Request(tx)
        .input("kode_t_penerimaan_pengadaan", sql.VarChar(255), kode_t_penerimaan_pengadaan)
        .query(
          `
          WITH d AS (
            SELECT
              d.kode_d_penerimaan_pengadaan,
              d.kode_barang,
              d.jml_baik_diterima,
              d.satuan_jml_baik,
              ROW_NUMBER() OVER (
                PARTITION BY d.kode_barang
                ORDER BY d.created_at, d.kode_d_penerimaan_pengadaan
              ) AS rn
            FROM dbo.GWEN_d_penerimaan_pengadaan d
            WHERE d.kode_t_penerimaan_pengadaan = @kode_t_penerimaan_pengadaan
              AND ISNULL(d.jml_baik_diterima, 0) > 0
          ),
          h AS (
            SELECT
              h.kode_h_stok_barang,
              h.kode_barang_variant,
              h.qty_masuk,
              h.satuan,
              ROW_NUMBER() OVER (
                PARTITION BY h.kode_barang_variant
                ORDER BY h.created_at, h.kode_h_stok_barang
              ) AS rn
            FROM dbo.GWEN_h_stok_barang_variant h
            WHERE h.kode_ref_transaksi = @kode_t_penerimaan_pengadaan
          )
          SELECT
            COALESCE(d.kode_barang, h.kode_barang_variant) AS kode_barang_variant,
            d.jml_baik_diterima,
            d.satuan_jml_baik,
            h.qty_masuk,
            h.satuan AS satuan_h,
            CASE
              WHEN d.kode_barang IS NULL THEN 'H_ONLY'
              WHEN h.kode_barang_variant IS NULL THEN 'D_ONLY'
              ELSE 'COUNT_MISMATCH'
            END AS mismatch_type,
            b.nama AS nama_barang,
            v.nama_varian AS nama_varian,
            b.kode_gudang AS kode_gudang_barang
          FROM d
          FULL JOIN h
            ON h.kode_barang_variant = d.kode_barang
           AND h.rn = d.rn
          LEFT JOIN dbo.m_barang_varian v
            ON v.kode_barang_variant COLLATE DATABASE_DEFAULT =
              COALESCE(d.kode_barang, h.kode_barang_variant) COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.m_barang b
            ON b.id_barang = v.id_barang
          WHERE h.kode_barang_variant IS NULL
          ORDER BY COALESCE(d.kode_barang, h.kode_barang_variant);
        `
        );

      const results = [];
      const fallbackGudang = "GUD.27012099GW001";

      for (const row of missingRes.recordset || []) {
        const kode_barang_variant = String(row.kode_barang_variant || "").trim();
        const qty = Number(row.jml_baik_diterima ?? 0);
        if (!kode_barang_variant || qty <= 0) {
          results.push({
            kode_barang_variant,
            nama_barang: row.nama_barang || null,
            nama_varian: row.nama_varian || null,
            qty,
            satuan: row.satuan_jml_baik || "PCS",
            status: "SKIP",
            message: "Qty tidak valid",
          });
          continue;
        }

        const kode_gudang =
          headerGudang ||
          row.kode_gudang_barang ||
          fallbackGudang ||
          null;
        if (!kode_gudang) {
          results.push({
            kode_barang_variant,
            nama_barang: row.nama_barang || null,
            nama_varian: row.nama_varian || null,
            qty,
            satuan: row.satuan_jml_baik || "PCS",
            status: "SKIP",
            message: "Kode gudang tidak ditemukan",
          });
          continue;
        }

        await new sql.Request(tx)
          .input("kode_gudang", sql.VarChar(255), kode_gudang)
          .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
          .query(
            `
            UPDATE b
            SET b.kode_gudang = @kode_gudang
            FROM dbo.m_barang b
            JOIN dbo.m_barang_varian v ON v.id_barang = b.id_barang
            WHERE v.kode_barang_variant = @kode_barang_variant
              AND (b.kode_gudang IS NULL OR LTRIM(RTRIM(b.kode_gudang)) = '');
          `
          );

        const stokRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
          .input("kode_gudang", sql.VarChar(255), kode_gudang)
          .query(
            `
            SELECT TOP 1 stok
            FROM dbo.GWEN_mn_barang_gudang_variant
            WHERE kode_barang_variant = @kode_barang_variant
              AND kode_gudang = @kode_gudang;
          `
          );
        const stokAwal = Number(stokRes.recordset?.[0]?.stok ?? 0);
        const stokAkhir = stokAwal + qty;

        if (stokRes.recordset?.length) {
          await new sql.Request(tx)
            .input("stok", sql.Decimal(20, 2), stokAkhir)
            .input("updated_by", sql.VarChar(255), updated_by)
            .input("updated_at", sql.DateTime, nowWib())
            .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
            .input("kode_gudang", sql.VarChar(255), kode_gudang)
            .query(
              `
              UPDATE dbo.GWEN_mn_barang_gudang_variant
              SET stok = @stok,
                  qty_baik = @stok,
                  updated_by = @updated_by,
                  updated_at = @updated_at
              WHERE kode_barang_variant = @kode_barang_variant
                AND kode_gudang = @kode_gudang;
            `
            );
        } else {
          const kodeMn = generateStockCode("STK");
          await new sql.Request(tx)
            .input("kode_mn_barang_gudang", sql.VarChar(255), kodeMn)
            .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
            .input("kode_gudang", sql.VarChar(255), kode_gudang)
            .input("minimum_stok", sql.Decimal(20, 2), 0)
            .input("status", sql.Int, 1)
            .input("status_cadangan", sql.Int, null)
            .input("created_by", sql.VarChar(255), updated_by)
            .input("created_at", sql.DateTime, nowWib())
            .input("updated_by", sql.VarChar(255), updated_by)
            .input("updated_at", sql.DateTime, nowWib())
            .input("stok", sql.Decimal(20, 2), stokAkhir)
            .input("qty_baik", sql.Decimal(20, 2), stokAkhir)
            .input("qty_rusak", sql.Decimal(20, 2), 0)
            .input("is_sync", sql.Int, 0)
            .input("is_show", sql.Int, 1)
            .query(
              `
              INSERT INTO dbo.GWEN_mn_barang_gudang_variant (
                kode_mn_barang_gudang, kode_barang_variant, kode_gudang, minimum_stok, status, status_cadangan,
                created_by, created_at, updated_by, updated_at, stok, qty_baik, qty_rusak, is_sync, is_show
              ) VALUES (
                @kode_mn_barang_gudang, @kode_barang_variant, @kode_gudang, @minimum_stok, @status, @status_cadangan,
                @created_by, @created_at, @updated_by, @updated_at, @stok, @qty_baik, @qty_rusak, @is_sync, @is_show
              );
            `
            );
        }

        const kodeHist = generateStockCode("HST");
        await new sql.Request(tx)
          .input("kode_h_stok_barang", sql.VarChar(255), kodeHist)
          .input("kode_ref_transaksi", sql.VarChar(255), kode_t_penerimaan_pengadaan)
          .input("tgl_transaksi", sql.DateTime, nowWib())
          .input("ket_transaksi", sql.VarChar(sql.MAX), "PENERIMAAN PENGADAAN")
          .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
          .input("qty_masuk", sql.Decimal(20, 2), qty)
          .input("status", sql.VarChar(255), "MASUK")
          .input("status_cadangan", sql.VarChar(255), null)
          .input("created_by", sql.VarChar(255), updated_by)
          .input("created_at", sql.DateTime, nowWib())
          .input("updated_by", sql.VarChar(255), updated_by)
          .input("updated_at", sql.DateTime, nowWib())
          .input("kode_gudang", sql.VarChar(255), kode_gudang)
          .input("satuan", sql.VarChar(255), row.satuan_jml_baik || "PCS")
          .input("qty_ke_satuan_1", sql.Decimal(20, 2), qty)
          .input("stok_awal_satuan_1", sql.Decimal(20, 2), stokAwal)
          .input("stok_akhir_satuan_1", sql.Decimal(20, 2), stokAkhir)
          .input("qty_keluar", sql.Decimal(20, 2), 0)
          .input("kode_sales", sql.VarChar(255), null)
          .input("ket_inquiry", sql.VarChar(sql.MAX), null)
          .query(
            `
            INSERT INTO dbo.GWEN_h_stok_barang_variant (
              kode_h_stok_barang, kode_ref_transaksi, tgl_transaksi, ket_transaksi, kode_barang_variant, qty_masuk,
              status, status_cadangan, created_by, created_at, updated_by, updated_at, kode_gudang, satuan,
              qty_ke_satuan_1, stok_awal_satuan_1, stok_akhir_satuan_1, qty_keluar, kode_sales, ket_inquiry
            ) VALUES (
              @kode_h_stok_barang, @kode_ref_transaksi, @tgl_transaksi, @ket_transaksi, @kode_barang_variant, @qty_masuk,
              @status, @status_cadangan, @created_by, @created_at, @updated_by, @updated_at, @kode_gudang, @satuan,
              @qty_ke_satuan_1, @stok_awal_satuan_1, @stok_akhir_satuan_1, @qty_keluar, @kode_sales, @ket_inquiry
            );
          `
          );

        results.push({
          kode_barang_variant,
          nama_barang: row.nama_barang || null,
          nama_varian: row.nama_varian || null,
          qty,
          satuan: row.satuan_jml_baik || "PCS",
          kode_gudang,
          status: "FIXED",
          message: "Stok diperbarui",
        });
      }

      await tx.commit();
      return reply.send({
        kode_t_penerimaan_pengadaan,
        items: results,
      });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed fix penerimaan mismatch");
      return reply.code(500).send({ message: "Gagal memperbaiki penerimaan" });
    }
  });

  fastify.post("/:kode/items/repair", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodeDetail = String(body.kode_d_penerimaan_pengadaan || "").trim();
    if (!kode || !kodeDetail) {
      return reply.code(400).send({ message: "kode_t_pengadaan dan kode_d_penerimaan_pengadaan wajib diisi" });
    }
    const updated_by = String(body.updated_by || "Admin").trim() || "Admin";

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const headerRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT TOP 1
            kode_t_penerimaan_pengadaan,
            kode_gudang
          FROM dbo.GWEN_t_penerimaan_pengadaan
          WHERE kode_t_pengadaan = @kode_t_pengadaan;
        `
        );

      if (!headerRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Penerimaan pengadaan tidak ditemukan" });
      }

      const kode_t_penerimaan_pengadaan = headerRes.recordset[0].kode_t_penerimaan_pengadaan;
      const headerGudang = headerRes.recordset[0].kode_gudang || null;

      const detailRes = await new sql.Request(tx)
        .input("kode_d_penerimaan_pengadaan", sql.VarChar(255), kodeDetail)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT TOP 1
            d.kode_d_penerimaan_pengadaan,
            d.kode_barang,
            d.jml_baik_diterima,
            d.satuan_jml_baik,
            COALESCE(p.is_active, p2.is_active, 1) AS is_active
          FROM dbo.GWEN_d_penerimaan_pengadaan d
          LEFT JOIN dbo.GWEN_t_penerimaan_pengadaan t
            ON t.kode_t_penerimaan_pengadaan = d.kode_t_penerimaan_pengadaan
          LEFT JOIN dbo.GWEN_d_pengadaan p
            ON p.kode_d_pengadaan = d.kode_d_pengadaan
          OUTER APPLY (
            SELECT TOP 1 p2.is_active
            FROM dbo.GWEN_d_pengadaan p2
            WHERE p2.kode_t_pengadaan = t.kode_t_pengadaan
              AND p2.kode_barang_variant = d.kode_barang
            ORDER BY p2.updated_at DESC, p2.created_at DESC
          ) p2
          WHERE d.kode_d_penerimaan_pengadaan = @kode_d_penerimaan_pengadaan
            AND t.kode_t_pengadaan = @kode_t_pengadaan;
        `
        );

      if (!detailRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Detail penerimaan tidak ditemukan" });
      }

      const detail = detailRes.recordset[0];
      if (Number(detail.is_active ?? 1) === 0) {
        await tx.rollback();
        return reply.code(400).send({ message: "Item pengadaan nonaktif, tidak bisa diperbaiki" });
      }

      const kode_barang_variant = String(detail.kode_barang || "").trim();
      const qty = Number(detail.jml_baik_diterima ?? 0);
      if (!kode_barang_variant || qty <= 0) {
        await tx.rollback();
        return reply.code(400).send({ message: "Qty tidak valid" });
      }

      const historyRes = await new sql.Request(tx)
        .input("kode_ref_transaksi", sql.VarChar(255), kode_t_penerimaan_pengadaan)
        .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
        .query(
          `
          SELECT TOP 1 kode_h_stok_barang
          FROM dbo.GWEN_h_stok_barang_variant
          WHERE kode_ref_transaksi = @kode_ref_transaksi
            AND kode_barang_variant = @kode_barang_variant
          ORDER BY created_at, kode_h_stok_barang;
        `
        );

      if (historyRes.recordset?.length) {
        await tx.commit();
        return reply.send({
          message: "History sudah ada",
          kode_h_stok_barang: historyRes.recordset[0].kode_h_stok_barang,
        });
      }

      const gudangRes = await new sql.Request(tx)
        .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
        .query(
          `
          SELECT TOP 1 b.kode_gudang
          FROM dbo.m_barang_varian v
          JOIN dbo.m_barang b ON b.id_barang = v.id_barang
          WHERE v.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT;
        `
        );
      const fallbackGudang = "GUD.27012099GW001";
      const kode_gudang =
        headerGudang || gudangRes.recordset?.[0]?.kode_gudang || fallbackGudang || null;
      if (!kode_gudang) {
        await tx.rollback();
        return reply.code(400).send({ message: "Kode gudang tidak ditemukan" });
      }

      await new sql.Request(tx)
        .input("kode_gudang", sql.VarChar(255), kode_gudang)
        .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
        .query(
          `
          UPDATE b
          SET b.kode_gudang = @kode_gudang
          FROM dbo.m_barang b
          JOIN dbo.m_barang_varian v ON v.id_barang = b.id_barang
          WHERE v.kode_barang_variant = @kode_barang_variant
            AND (b.kode_gudang IS NULL OR LTRIM(RTRIM(b.kode_gudang)) = '');
        `
        );

      const stokRes = await new sql.Request(tx)
        .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
        .input("kode_gudang", sql.VarChar(255), kode_gudang)
        .query(
          `
          SELECT TOP 1 stok
          FROM dbo.GWEN_mn_barang_gudang_variant
          WHERE kode_barang_variant = @kode_barang_variant
            AND kode_gudang = @kode_gudang;
        `
        );
      const stokAwal = Number(stokRes.recordset?.[0]?.stok ?? 0);
      const stokAkhir = stokAwal + qty;

      if (stokRes.recordset?.length) {
        await new sql.Request(tx)
          .input("stok", sql.Decimal(20, 2), stokAkhir)
          .input("updated_by", sql.VarChar(255), updated_by)
          .input("updated_at", sql.DateTime, nowWib())
          .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
          .input("kode_gudang", sql.VarChar(255), kode_gudang)
          .query(
            `
            UPDATE dbo.GWEN_mn_barang_gudang_variant
            SET stok = @stok,
                qty_baik = @stok,
                updated_by = @updated_by,
                updated_at = @updated_at
            WHERE kode_barang_variant = @kode_barang_variant
              AND kode_gudang = @kode_gudang;
          `
          );
      } else {
        const kodeMn = generateStockCode("STK");
        await new sql.Request(tx)
          .input("kode_mn_barang_gudang", sql.VarChar(255), kodeMn)
          .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
          .input("kode_gudang", sql.VarChar(255), kode_gudang)
          .input("minimum_stok", sql.Decimal(20, 2), 0)
          .input("status", sql.Int, 1)
          .input("status_cadangan", sql.Int, null)
          .input("created_by", sql.VarChar(255), updated_by)
          .input("created_at", sql.DateTime, nowWib())
          .input("updated_by", sql.VarChar(255), updated_by)
          .input("updated_at", sql.DateTime, nowWib())
          .input("stok", sql.Decimal(20, 2), stokAkhir)
          .input("qty_baik", sql.Decimal(20, 2), stokAkhir)
          .input("qty_rusak", sql.Decimal(20, 2), 0)
          .input("is_sync", sql.Int, 0)
          .input("is_show", sql.Int, 1)
          .query(
            `
            INSERT INTO dbo.GWEN_mn_barang_gudang_variant (
              kode_mn_barang_gudang, kode_barang_variant, kode_gudang, minimum_stok, status, status_cadangan,
              created_by, created_at, updated_by, updated_at, stok, qty_baik, qty_rusak, is_sync, is_show
            ) VALUES (
              @kode_mn_barang_gudang, @kode_barang_variant, @kode_gudang, @minimum_stok, @status, @status_cadangan,
              @created_by, @created_at, @updated_by, @updated_at, @stok, @qty_baik, @qty_rusak, @is_sync, @is_show
            );
          `
          );
      }

      const kodeHist = generateStockCode("HST");
      await new sql.Request(tx)
        .input("kode_h_stok_barang", sql.VarChar(255), kodeHist)
        .input("kode_ref_transaksi", sql.VarChar(255), kode_t_penerimaan_pengadaan)
        .input("tgl_transaksi", sql.DateTime, nowWib())
        .input("ket_transaksi", sql.VarChar(sql.MAX), "PENERIMAAN PENGADAAN")
        .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
        .input("qty_masuk", sql.Decimal(20, 2), qty)
        .input("status", sql.VarChar(255), "MASUK")
        .input("status_cadangan", sql.VarChar(255), null)
        .input("created_by", sql.VarChar(255), updated_by)
        .input("created_at", sql.DateTime, nowWib())
        .input("updated_by", sql.VarChar(255), updated_by)
        .input("updated_at", sql.DateTime, nowWib())
        .input("kode_gudang", sql.VarChar(255), kode_gudang)
        .input("satuan", sql.VarChar(255), detail.satuan_jml_baik || "PCS")
        .input("qty_ke_satuan_1", sql.Decimal(20, 2), qty)
        .input("stok_awal_satuan_1", sql.Decimal(20, 2), stokAwal)
        .input("stok_akhir_satuan_1", sql.Decimal(20, 2), stokAkhir)
        .input("qty_keluar", sql.Decimal(20, 2), 0)
        .input("kode_sales", sql.VarChar(255), null)
        .input("ket_inquiry", sql.VarChar(sql.MAX), null)
        .query(
          `
          INSERT INTO dbo.GWEN_h_stok_barang_variant (
            kode_h_stok_barang, kode_ref_transaksi, tgl_transaksi, ket_transaksi, kode_barang_variant, qty_masuk,
            status, status_cadangan, created_by, created_at, updated_by, updated_at, kode_gudang, satuan,
            qty_ke_satuan_1, stok_awal_satuan_1, stok_akhir_satuan_1, qty_keluar, kode_sales, ket_inquiry
          ) VALUES (
            @kode_h_stok_barang, @kode_ref_transaksi, @tgl_transaksi, @ket_transaksi, @kode_barang_variant, @qty_masuk,
            @status, @status_cadangan, @created_by, @created_at, @updated_by, @updated_at, @kode_gudang, @satuan,
            @qty_ke_satuan_1, @stok_awal_satuan_1, @stok_akhir_satuan_1, @qty_keluar, @kode_sales, @ket_inquiry
          );
        `
        );

      await tx.commit();
      return reply.send({ message: "History diperbaiki", kode_h_stok_barang: kodeHist });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed repair penerimaan item");
      return reply.code(500).send({ message: "Gagal memperbaiki history penerimaan" });
    }
  });

  fastify.delete("/:kode/items/:kodeDetail", async (request, reply) => {
    const { kode, kodeDetail } = request.params;
    if (!kode || !kodeDetail) {
      return reply.code(400).send({ message: "kode_t_pengadaan dan kode_d_penerimaan_pengadaan wajib diisi" });
    }
    try {
      const res = await pool
        .request()
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .input("kode_d_penerimaan_pengadaan", sql.VarChar(255), String(kodeDetail).trim())
        .query(
          `
          DELETE d
          FROM dbo.GWEN_d_penerimaan_pengadaan d
          JOIN dbo.GWEN_t_penerimaan_pengadaan t
            ON t.kode_t_penerimaan_pengadaan = d.kode_t_penerimaan_pengadaan
          WHERE d.kode_d_penerimaan_pengadaan = @kode_d_penerimaan_pengadaan
            AND t.kode_t_pengadaan = @kode_t_pengadaan;
        `
        );
      if (!res.rowsAffected?.[0]) {
        return reply.code(404).send({ message: "Detail penerimaan tidak ditemukan" });
      }
      return reply.send({ message: "Detail penerimaan dihapus" });
    } catch (err) {
      fastify.log.error({ err }, "Failed delete penerimaan item");
      return reply.code(500).send({ message: "Gagal menghapus detail penerimaan" });
    }
  });

  fastify.put("/:kode/items", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodeDetail = String(body.kode_d_penerimaan_pengadaan || "").trim();
    if (!kode || !kodeDetail) {
      return reply.code(400).send({ message: "kode_t_pengadaan dan kode_d_penerimaan_pengadaan wajib diisi" });
    }
    try {
      await pool
        .request()
        .input("kode_d_penerimaan_pengadaan", sql.VarChar(255), kodeDetail)
        .input("jml_baik_dikirim", sql.Decimal(20, 2), Number(body.jml_baik_dikirim ?? 0))
        .input("jml_baik_diterima", sql.Decimal(20, 2), Number(body.jml_baik_diterima ?? 0))
        .input("jml_rusak_diterima", sql.Decimal(20, 2), Number(body.jml_rusak_diterima ?? 0))
        .input("catatan", sql.VarChar(255), body.catatan || null)
        .input("updated_by", sql.VarChar(255), body.updated_by || "Admin")
        .input("updated_at", sql.DateTime, nowWib())
        .query(
          `
          UPDATE dbo.GWEN_d_penerimaan_pengadaan
          SET jml_baik_dikirim = @jml_baik_dikirim,
              jml_baik_diterima = @jml_baik_diterima,
              jml_rusak_diterima = @jml_rusak_diterima,
              catatan = @catatan,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_d_penerimaan_pengadaan = @kode_d_penerimaan_pengadaan;
        `
        );
      return reply.send({ message: "Item diperbarui" });
    } catch (err) {
      fastify.log.error({ err }, "Failed update penerimaan item");
      return reply.code(500).send({ message: "Gagal memperbarui item" });
    }
  });

  fastify.post("/:kode/submit", async (request, reply) => {
    const { kode } = request.params;
    if (!kode) return reply.code(400).send({ message: "kode_t_pengadaan wajib diisi" });
    const body = request.body || {};
    const updated_by = String(body.updated_by || "Admin").trim() || "Admin";
    const requestedGudang = String(body.kode_gudang || "").trim() || null;
    const submitAt = nowWib();
    logWibConversion(fastify.log, {
      route: "penerimaan-pengadaan.submit",
      field: "submit_at",
      source: "server_now()",
      converted_wib: formatWibSqlDateTime(submitAt),
      sql_value: formatWibSqlDateTime(submitAt),
    });

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const headerRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT TOP 1
            kode_t_penerimaan_pengadaan,
            kode_gudang
          FROM dbo.GWEN_t_penerimaan_pengadaan
          WHERE kode_t_pengadaan = @kode_t_pengadaan;
        `
        );

      if (!headerRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Penerimaan pengadaan tidak ditemukan" });
      }

      const kode_t_penerimaan_pengadaan = headerRes.recordset[0].kode_t_penerimaan_pengadaan;
      let headerGudang = requestedGudang || headerRes.recordset[0].kode_gudang || null;

      if (requestedGudang) {
        await new sql.Request(tx)
          .input("kode_t_penerimaan_pengadaan", sql.VarChar(255), kode_t_penerimaan_pengadaan)
          .input("kode_gudang", sql.VarChar(255), requestedGudang)
          .input("updated_by", sql.VarChar(255), updated_by)
          .input("updated_at", sql.DateTime, nowWib())
          .query(`
            UPDATE dbo.GWEN_t_penerimaan_pengadaan
            SET kode_gudang = @kode_gudang,
                updated_by = @updated_by,
                updated_at = @updated_at
            WHERE kode_t_penerimaan_pengadaan = @kode_t_penerimaan_pengadaan;
          `);
      }

      const existingHist = await new sql.Request(tx)
        .input("kode_ref_transaksi", sql.VarChar(255), kode_t_penerimaan_pengadaan)
        .query(
          `
          SELECT TOP 1 kode_h_stok_barang
          FROM dbo.GWEN_h_stok_barang_variant
          WHERE kode_ref_transaksi = @kode_ref_transaksi;
        `
        );
      if (existingHist.recordset?.length) {
        await tx.rollback();
        return reply.send({ message: "Stok sudah diproses" });
      }

      const detailRes = await new sql.Request(tx)
        .input("kode_t_penerimaan_pengadaan", sql.VarChar(255), kode_t_penerimaan_pengadaan)
        .query(
          `
          SELECT
            d.kode_barang,
            d.jml_baik_diterima,
            d.jml_rusak_diterima,
            d.satuan_jml_baik
          FROM dbo.GWEN_d_penerimaan_pengadaan d
          LEFT JOIN dbo.GWEN_t_penerimaan_pengadaan t
            ON t.kode_t_penerimaan_pengadaan = d.kode_t_penerimaan_pengadaan
          LEFT JOIN dbo.GWEN_d_pengadaan p
            ON p.kode_d_pengadaan = d.kode_d_pengadaan
          OUTER APPLY (
            SELECT TOP 1 p2.is_active
            FROM dbo.GWEN_d_pengadaan p2
            WHERE p2.kode_t_pengadaan = t.kode_t_pengadaan
              AND p2.kode_barang_variant = d.kode_barang
            ORDER BY p2.updated_at DESC, p2.created_at DESC
          ) p2
          WHERE d.kode_t_penerimaan_pengadaan = @kode_t_penerimaan_pengadaan
            AND COALESCE(p.is_active, p2.is_active, 1) = 1;
        `
        );

      for (const row of detailRes.recordset || []) {
        const kode_barang_variant = String(row.kode_barang || "").trim();
        const qty = Number(row.jml_baik_diterima ?? 0);
        const qtyRusak = Number(row.jml_rusak_diterima ?? 0);
        if (!kode_barang_variant || (qty <= 0 && qtyRusak <= 0)) continue;

        const gudangRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
          .query(
            `
            SELECT TOP 1 b.kode_gudang
            FROM dbo.m_barang_varian v
            JOIN dbo.m_barang b ON b.id_barang = v.id_barang
            WHERE v.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT;
          `
          );
        const fallbackGudang = "GUD.27012099GW001";
        const kode_gudang =
          headerGudang || gudangRes.recordset?.[0]?.kode_gudang || fallbackGudang || null;
        if (!kode_gudang) continue;

        await new sql.Request(tx)
          .input("kode_gudang", sql.VarChar(255), kode_gudang)
          .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
          .query(
            `
            UPDATE b
            SET b.kode_gudang = @kode_gudang
            FROM dbo.m_barang b
            JOIN dbo.m_barang_varian v ON v.id_barang = b.id_barang
            WHERE v.kode_barang_variant = @kode_barang_variant
              AND (b.kode_gudang IS NULL OR LTRIM(RTRIM(b.kode_gudang)) = '');
          `
          );

        const stokRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
          .input("kode_gudang", sql.VarChar(255), kode_gudang)
          .query(
            `
            SELECT TOP 1 stok
            FROM dbo.GWEN_mn_barang_gudang_variant
            WHERE kode_barang_variant = @kode_barang_variant
              AND kode_gudang = @kode_gudang;
          `
          );
        const stokAwal = Number(stokRes.recordset?.[0]?.stok ?? 0);
        const stokAkhir = stokAwal + qty;

        if (stokRes.recordset?.length) {
          await new sql.Request(tx)
            .input("stok", sql.Decimal(20, 2), stokAkhir)
            .input("qty_rusak", sql.Decimal(20, 2), qtyRusak)
            .input("updated_by", sql.VarChar(255), updated_by)
            .input("updated_at", sql.DateTime, nowWib())
            .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
            .input("kode_gudang", sql.VarChar(255), kode_gudang)
            .query(
              `
              UPDATE dbo.GWEN_mn_barang_gudang_variant
              SET stok = @stok,
                  qty_baik = @stok,
                  qty_rusak = ISNULL(qty_rusak, 0) + @qty_rusak,
                  updated_by = @updated_by,
                  updated_at = @updated_at
              WHERE kode_barang_variant = @kode_barang_variant
                AND kode_gudang = @kode_gudang;
            `
            );
        } else {
          const kodeMn = generateStockCode("STK");
          await new sql.Request(tx)
            .input("kode_mn_barang_gudang", sql.VarChar(255), kodeMn)
            .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
            .input("kode_gudang", sql.VarChar(255), kode_gudang)
            .input("minimum_stok", sql.Decimal(20, 2), 0)
            .input("status", sql.Int, 1)
            .input("status_cadangan", sql.Int, null)
            .input("created_by", sql.VarChar(255), updated_by)
            .input("created_at", sql.DateTime, nowWib())
            .input("updated_by", sql.VarChar(255), updated_by)
            .input("updated_at", sql.DateTime, nowWib())
            .input("stok", sql.Decimal(20, 2), stokAkhir)
            .input("qty_baik", sql.Decimal(20, 2), stokAkhir)
            .input("qty_rusak", sql.Decimal(20, 2), qtyRusak)
            .input("is_sync", sql.Int, 0)
            .input("is_show", sql.Int, 1)
            .query(
              `
              INSERT INTO dbo.GWEN_mn_barang_gudang_variant (
                kode_mn_barang_gudang, kode_barang_variant, kode_gudang, minimum_stok, status, status_cadangan,
                created_by, created_at, updated_by, updated_at, stok, qty_baik, qty_rusak, is_sync, is_show
              ) VALUES (
                @kode_mn_barang_gudang, @kode_barang_variant, @kode_gudang, @minimum_stok, @status, @status_cadangan,
                @created_by, @created_at, @updated_by, @updated_at, @stok, @qty_baik, @qty_rusak, @is_sync, @is_show
              );
            `
            );
        }

        const kodeHist = generateStockCode("HST");
        await new sql.Request(tx)
          .input("kode_h_stok_barang", sql.VarChar(255), kodeHist)
          .input("kode_ref_transaksi", sql.VarChar(255), kode_t_penerimaan_pengadaan)
          .input("tgl_transaksi", sql.DateTime, nowWib())
          .input("ket_transaksi", sql.VarChar(sql.MAX), "PENERIMAAN PENGADAAN")
          .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
          .input("qty_masuk", sql.Decimal(20, 2), qty)
          .input("status", sql.VarChar(255), "MASUK")
          .input("status_cadangan", sql.VarChar(255), null)
          .input("created_by", sql.VarChar(255), updated_by)
          .input("created_at", sql.DateTime, nowWib())
          .input("updated_by", sql.VarChar(255), updated_by)
          .input("updated_at", sql.DateTime, nowWib())
          .input("kode_gudang", sql.VarChar(255), kode_gudang)
          .input("satuan", sql.VarChar(255), "PCS")
          .input("qty_ke_satuan_1", sql.Decimal(20, 2), qty)
          .input("stok_awal_satuan_1", sql.Decimal(20, 2), stokAwal)
          .input("stok_akhir_satuan_1", sql.Decimal(20, 2), stokAkhir)
          .input("qty_keluar", sql.Decimal(20, 2), 0)
          .input("kode_sales", sql.VarChar(255), null)
          .input("ket_inquiry", sql.VarChar(sql.MAX), null)
          .query(
            `
            INSERT INTO dbo.GWEN_h_stok_barang_variant (
              kode_h_stok_barang, kode_ref_transaksi, tgl_transaksi, ket_transaksi, kode_barang_variant, qty_masuk,
              status, status_cadangan, created_by, created_at, updated_by, updated_at, kode_gudang, satuan,
              qty_ke_satuan_1, stok_awal_satuan_1, stok_akhir_satuan_1, qty_keluar, kode_sales, ket_inquiry
            ) VALUES (
              @kode_h_stok_barang, @kode_ref_transaksi, @tgl_transaksi, @ket_transaksi, @kode_barang_variant, @qty_masuk,
              @status, @status_cadangan, @created_by, @created_at, @updated_by, @updated_at, @kode_gudang, @satuan,
              @qty_ke_satuan_1, @stok_awal_satuan_1, @stok_akhir_satuan_1, @qty_keluar, @kode_sales, @ket_inquiry
            );
          `
          );
      }

      await tx.commit();
      return reply.send({ message: "Stok diperbarui" });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed submit penerimaan pengadaan");
      return reply.code(500).send({ message: "Gagal menyimpan stok penerimaan" });
    }
  });

  fastify.put("/:kode/items/barcode", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodeBarangVariant = String(body.kode_barang_variant || "").trim();
    if (!kode || !kodeBarangVariant) {
      return reply.code(400).send({ message: "kode_t_pengadaan dan kode_barang_variant wajib diisi" });
    }
    try {
      await pool
        .request()
        .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
        .input("barcode_varian", sql.VarChar(255), body.barcode_varian || null)
        .input("updated_by", sql.VarChar(255), body.updated_by || "Admin")
        .input("updated_at", sql.DateTime, nowWib())
        .query(
          `
          UPDATE dbo.m_barang_varian
          SET barcode_varian = @barcode_varian,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_barang_variant = @kode_barang_variant;
        `
        );
      return reply.send({ message: "Barcode varian diperbarui" });
    } catch (err) {
      fastify.log.error({ err }, "Failed update barcode varian");
      return reply.code(500).send({ message: "Gagal memperbarui barcode varian" });
    }
  });

  fastify.put("/:kode/items/variant", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodeDetail = String(body.kode_d_penerimaan_pengadaan || "").trim();
    const kodeBarangVariant = String(body.kode_barang_variant || "").trim();
    if (!kode || !kodeDetail || !kodeBarangVariant) {
      return reply.code(400).send({ message: "kode_t_pengadaan, kode_d_penerimaan_pengadaan, kode_barang_variant wajib diisi" });
    }
    const updated_by = String(body.updated_by || "Admin").trim() || "Admin";
    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const headerRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT TOP 1
            kode_t_penerimaan_pengadaan,
            kode_t_pengadaan
          FROM dbo.GWEN_t_penerimaan_pengadaan
          WHERE kode_t_pengadaan = @kode_t_pengadaan;
        `
        );
      if (!headerRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Penerimaan pengadaan tidak ditemukan" });
      }
      const kode_t_pengadaan = headerRes.recordset[0].kode_t_pengadaan;
      const kode_t_penerimaan_pengadaan = headerRes.recordset[0].kode_t_penerimaan_pengadaan;

      const detailRes = await new sql.Request(tx)
        .input("kode_d_penerimaan_pengadaan", sql.VarChar(255), kodeDetail)
        .input("kode_t_pengadaan", sql.VarChar(255), kode_t_pengadaan)
        .query(
          `
          SELECT TOP 1
            d.kode_d_penerimaan_pengadaan,
            d.kode_barang AS kode_barang_lama,
            d.jml_baik_diterima,
            d.satuan_jml_baik
          FROM dbo.GWEN_d_penerimaan_pengadaan d
          JOIN dbo.GWEN_t_penerimaan_pengadaan t
            ON t.kode_t_penerimaan_pengadaan = d.kode_t_penerimaan_pengadaan
          WHERE d.kode_d_penerimaan_pengadaan = @kode_d_penerimaan_pengadaan
            AND t.kode_t_pengadaan = @kode_t_pengadaan;
        `
        );
      if (!detailRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Detail penerimaan tidak ditemukan" });
      }

      const detail = detailRes.recordset[0];
      const kode_barang_lama = String(detail.kode_barang_lama || "").trim();
      const qtyTerima = Number(detail.jml_baik_diterima ?? 0);

      if (kode_barang_lama && kode_barang_lama === kodeBarangVariant) {
        await tx.commit();
        return reply.send({ message: "Item sudah sesuai" });
      }

      const pengadaanRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), kode_t_pengadaan)
        .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
        .query(
          `
          SELECT TOP 1 kode_d_pengadaan
          FROM dbo.GWEN_d_pengadaan
          WHERE kode_t_pengadaan = @kode_t_pengadaan
            AND kode_barang_variant = @kode_barang_variant
          ORDER BY updated_at DESC, created_at DESC;
        `
        );
      const kode_d_pengadaan = pengadaanRes.recordset?.[0]?.kode_d_pengadaan || null;

      const gudangOldRes = await new sql.Request(tx)
        .input("kode_barang_variant", sql.VarChar(255), kode_barang_lama || null)
        .query(
          `
          SELECT TOP 1 b.kode_gudang
          FROM dbo.m_barang_varian v
          JOIN dbo.m_barang b ON b.id_barang = v.id_barang
          WHERE v.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT;
        `
        );
      const gudangNewRes = await new sql.Request(tx)
        .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
        .query(
          `
          SELECT TOP 1 b.kode_gudang
          FROM dbo.m_barang_varian v
          JOIN dbo.m_barang b ON b.id_barang = v.id_barang
          WHERE v.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT;
        `
        );

      const fallbackGudang = "GUD.27012099GW001";
      const gudangOld = gudangOldRes.recordset?.[0]?.kode_gudang || headerRes.recordset[0].kode_gudang || fallbackGudang;
      const gudangNew = gudangNewRes.recordset?.[0]?.kode_gudang || headerRes.recordset[0].kode_gudang || fallbackGudang;

      if (kode_barang_lama && qtyTerima > 0) {
        const tokoRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(255), kode_barang_lama)
          .query(
            `
            SELECT kode_toko, stok_available
            FROM dbo.GWEN_mn_barang_toko_variant
            WHERE kode_barang_variant = @kode_barang_variant
            ORDER BY stok_available DESC;
          `
          );
        let remainingToMove = qtyTerima;
        const tokoRows = tokoRes.recordset || [];
        for (const row of tokoRows) {
          if (remainingToMove <= 0) break;
          const stokToko = Number(row.stok_available ?? 0);
          if (stokToko <= 0) continue;
          const moveQty = Math.min(stokToko, remainingToMove);
          await new sql.Request(tx)
            .input("stok_available", sql.Decimal(20, 2), stokToko - moveQty)
            .input("updated_at", sql.DateTime2, nowWib())
            .input("kode_barang_variant", sql.VarChar(255), kode_barang_lama)
            .input("kode_toko", sql.VarChar(255), row.kode_toko)
            .query(
              `
              UPDATE dbo.GWEN_mn_barang_toko_variant
              SET stok_available = @stok_available,
                  updated_at = @updated_at
              WHERE kode_barang_variant = @kode_barang_variant
                AND kode_toko = @kode_toko;
            `
            );

          const newTokoRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
            .input("kode_toko", sql.VarChar(255), row.kode_toko)
            .query(
              `
              SELECT TOP 1 stok_available
              FROM dbo.GWEN_mn_barang_toko_variant
              WHERE kode_barang_variant = @kode_barang_variant
                AND kode_toko = @kode_toko;
            `
            );
          if (newTokoRes.recordset?.length) {
            const stokNew = Number(newTokoRes.recordset?.[0]?.stok_available ?? 0) + moveQty;
            await new sql.Request(tx)
              .input("stok_available", sql.Decimal(20, 2), stokNew)
              .input("updated_at", sql.DateTime2, nowWib())
              .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
              .input("kode_toko", sql.VarChar(255), row.kode_toko)
              .query(
                `
                UPDATE dbo.GWEN_mn_barang_toko_variant
                SET stok_available = @stok_available,
                    updated_at = @updated_at
                WHERE kode_barang_variant = @kode_barang_variant
                  AND kode_toko = @kode_toko;
              `
              );
          } else {
            await new sql.Request(tx)
              .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
              .input("kode_toko", sql.VarChar(255), row.kode_toko)
              .input("stok_available", sql.Decimal(20, 2), moveQty)
              .input("buffer_min", sql.Decimal(20, 2), 0)
              .input("status", sql.Int, 1)
              .input("updated_at", sql.DateTime2, nowWib())
              .query(
                `
                INSERT INTO dbo.GWEN_mn_barang_toko_variant (
                  kode_barang_variant, kode_toko, stok_available, buffer_min, status, updated_at
                ) VALUES (
                  @kode_barang_variant, @kode_toko, @stok_available, @buffer_min, @status, @updated_at
                );
              `
              );
          }
          remainingToMove -= moveQty;
        }

        if (remainingToMove > 0) {
          const stokOldRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(255), kode_barang_lama)
            .input("kode_gudang", sql.VarChar(255), gudangOld)
            .query(
              `
              SELECT TOP 1 stok
              FROM dbo.GWEN_mn_barang_gudang_variant
              WHERE kode_barang_variant = @kode_barang_variant
                AND kode_gudang = @kode_gudang;
            `
            );
          const stokOld = Number(stokOldRes.recordset?.[0]?.stok ?? 0);
          const stokOldAkhir = Math.max(0, stokOld - remainingToMove);
          if (stokOldRes.recordset?.length) {
            await new sql.Request(tx)
              .input("stok", sql.Decimal(20, 2), stokOldAkhir)
              .input("updated_by", sql.VarChar(255), updated_by)
              .input("updated_at", sql.DateTime, nowWib())
              .input("kode_barang_variant", sql.VarChar(255), kode_barang_lama)
              .input("kode_gudang", sql.VarChar(255), gudangOld)
              .query(
                `
                UPDATE dbo.GWEN_mn_barang_gudang_variant
                SET stok = @stok,
                    qty_baik = @stok,
                    updated_by = @updated_by,
                    updated_at = @updated_at
                WHERE kode_barang_variant = @kode_barang_variant
                  AND kode_gudang = @kode_gudang;
              `
              );
          }

          const stokNewRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
            .input("kode_gudang", sql.VarChar(255), gudangNew)
            .query(
              `
              SELECT TOP 1 stok
              FROM dbo.GWEN_mn_barang_gudang_variant
              WHERE kode_barang_variant = @kode_barang_variant
                AND kode_gudang = @kode_gudang;
            `
            );
          const stokNew = Number(stokNewRes.recordset?.[0]?.stok ?? 0);
          const stokNewAkhir = stokNew + remainingToMove;
          if (stokNewRes.recordset?.length) {
            await new sql.Request(tx)
              .input("stok", sql.Decimal(20, 2), stokNewAkhir)
              .input("updated_by", sql.VarChar(255), updated_by)
              .input("updated_at", sql.DateTime, nowWib())
              .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
              .input("kode_gudang", sql.VarChar(255), gudangNew)
              .query(
                `
                UPDATE dbo.GWEN_mn_barang_gudang_variant
                SET stok = @stok,
                    qty_baik = @stok,
                    updated_by = @updated_by,
                    updated_at = @updated_at
                WHERE kode_barang_variant = @kode_barang_variant
                  AND kode_gudang = @kode_gudang;
              `
              );
          } else {
            const kodeMn = generateStockCode("STK");
            await new sql.Request(tx)
              .input("kode_mn_barang_gudang", sql.VarChar(255), kodeMn)
              .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
              .input("kode_gudang", sql.VarChar(255), gudangNew)
              .input("minimum_stok", sql.Decimal(20, 2), 0)
              .input("status", sql.Int, 1)
              .input("status_cadangan", sql.Int, null)
              .input("created_by", sql.VarChar(255), updated_by)
              .input("created_at", sql.DateTime, nowWib())
              .input("updated_by", sql.VarChar(255), updated_by)
              .input("updated_at", sql.DateTime, nowWib())
              .input("stok", sql.Decimal(20, 2), stokNewAkhir)
              .input("qty_baik", sql.Decimal(20, 2), stokNewAkhir)
              .input("qty_rusak", sql.Decimal(20, 2), 0)
              .input("is_sync", sql.Int, 0)
              .input("is_show", sql.Int, 1)
              .query(
                `
                INSERT INTO dbo.GWEN_mn_barang_gudang_variant (
                  kode_mn_barang_gudang, kode_barang_variant, kode_gudang, minimum_stok, status, status_cadangan,
                  created_by, created_at, updated_by, updated_at, stok, qty_baik, qty_rusak, is_sync, is_show
                ) VALUES (
                  @kode_mn_barang_gudang, @kode_barang_variant, @kode_gudang, @minimum_stok, @status, @status_cadangan,
                  @created_by, @created_at, @updated_by, @updated_at, @stok, @qty_baik, @qty_rusak, @is_sync, @is_show
                );
              `
              );
          }
        }

        const histRes = await new sql.Request(tx)
          .input("kode_ref_transaksi", sql.VarChar(255), kode_t_penerimaan_pengadaan)
          .input("kode_barang_variant", sql.VarChar(255), kode_barang_lama)
          .query(
            `
            SELECT kode_h_stok_barang
            FROM dbo.GWEN_h_stok_barang_variant
            WHERE kode_ref_transaksi = @kode_ref_transaksi
              AND kode_barang_variant = @kode_barang_variant;
          `
          );
        if (histRes.recordset?.length) {
          await new sql.Request(tx)
            .input("kode_ref_transaksi", sql.VarChar(255), kode_t_penerimaan_pengadaan)
            .input("kode_barang_variant_old", sql.VarChar(255), kode_barang_lama)
            .input("kode_barang_variant_new", sql.VarChar(255), kodeBarangVariant)
            .input("kode_gudang", sql.VarChar(255), gudangNew)
            .input("updated_by", sql.VarChar(255), updated_by)
            .input("updated_at", sql.DateTime, nowWib())
            .query(
              `
              UPDATE dbo.GWEN_h_stok_barang_variant
              SET kode_barang_variant = @kode_barang_variant_new,
                  kode_gudang = @kode_gudang,
                  updated_by = @updated_by,
                  updated_at = @updated_at
              WHERE kode_ref_transaksi = @kode_ref_transaksi
                AND kode_barang_variant = @kode_barang_variant_old;
            `
            );
        } else if (qtyTerima > 0) {
          const kodeHist = generateStockCode("HST");
          await new sql.Request(tx)
            .input("kode_h_stok_barang", sql.VarChar(255), kodeHist)
            .input("kode_ref_transaksi", sql.VarChar(255), kode_t_penerimaan_pengadaan)
            .input("tgl_transaksi", sql.DateTime, nowWib())
            .input("ket_transaksi", sql.VarChar(sql.MAX), "PENERIMAAN PENGADAAN")
            .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
            .input("qty_masuk", sql.Decimal(20, 2), qtyTerima)
            .input("status", sql.VarChar(255), "MASUK")
            .input("status_cadangan", sql.VarChar(255), null)
            .input("created_by", sql.VarChar(255), updated_by)
            .input("created_at", sql.DateTime, nowWib())
            .input("updated_by", sql.VarChar(255), updated_by)
            .input("updated_at", sql.DateTime, nowWib())
            .input("kode_gudang", sql.VarChar(255), gudangNew)
            .input("satuan", sql.VarChar(255), detail.satuan_jml_baik || "PCS")
            .input("qty_ke_satuan_1", sql.Decimal(20, 2), qtyTerima)
            .input("stok_awal_satuan_1", sql.Decimal(20, 2), 0)
            .input("stok_akhir_satuan_1", sql.Decimal(20, 2), qtyTerima)
            .input("qty_keluar", sql.Decimal(20, 2), 0)
            .input("kode_sales", sql.VarChar(255), null)
            .input("ket_inquiry", sql.VarChar(sql.MAX), null)
            .query(
              `
              INSERT INTO dbo.GWEN_h_stok_barang_variant (
                kode_h_stok_barang, kode_ref_transaksi, tgl_transaksi, ket_transaksi, kode_barang_variant, qty_masuk,
                status, status_cadangan, created_by, created_at, updated_by, updated_at, kode_gudang, satuan,
                qty_ke_satuan_1, stok_awal_satuan_1, stok_akhir_satuan_1, qty_keluar, kode_sales, ket_inquiry
              ) VALUES (
                @kode_h_stok_barang, @kode_ref_transaksi, @tgl_transaksi, @ket_transaksi, @kode_barang_variant, @qty_masuk,
                @status, @status_cadangan, @created_by, @created_at, @updated_by, @updated_at, @kode_gudang, @satuan,
                @qty_ke_satuan_1, @stok_awal_satuan_1, @stok_akhir_satuan_1, @qty_keluar, @kode_sales, @ket_inquiry
              );
            `
            );
        }
      }

      const updateRes = await new sql.Request(tx)
        .input("kode_d_penerimaan_pengadaan", sql.VarChar(255), kodeDetail)
        .input("kode_barang", sql.VarChar(255), kodeBarangVariant)
        .input("kode_d_pengadaan", sql.VarChar(255), kode_d_pengadaan)
        .input("updated_by", sql.VarChar(255), updated_by)
        .input("updated_at", sql.DateTime, nowWib())
        .query(
          `
          UPDATE dbo.GWEN_d_penerimaan_pengadaan
          SET kode_barang = @kode_barang,
              kode_d_pengadaan = @kode_d_pengadaan,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_d_penerimaan_pengadaan = @kode_d_penerimaan_pengadaan;
        `
        );

      if (!updateRes.rowsAffected?.[0]) {
        await tx.rollback();
        return reply.code(404).send({ message: "Detail penerimaan tidak ditemukan" });
      }

      await tx.commit();
      return reply.send({ message: "Item diperbarui" });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed update penerimaan item variant");
      return reply.code(500).send({ message: "Gagal mengganti item penerimaan" });
    }
  });

  fastify.put("/:kode/items/nama-varian", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodeBarangVariant = String(body.kode_barang_variant || "").trim();
    const namaVarian = body.nama_varian ? String(body.nama_varian).trim() : null;
    if (!kode || !kodeBarangVariant) {
      return reply.code(400).send({ message: "kode_t_pengadaan dan kode_barang_variant wajib diisi" });
    }
    try {
      await pool
        .request()
        .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
        .input("nama_varian", sql.NVarChar(255), namaVarian)
        .input("updated_by", sql.VarChar(255), body.updated_by || "Admin")
        .input("updated_at", sql.DateTime, nowWib())
        .query(
          `
          UPDATE dbo.m_barang_varian
          SET nama_varian = @nama_varian,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_barang_variant = @kode_barang_variant;
        `
        );
      return reply.send({ message: "Nama varian diperbarui" });
    } catch (err) {
      fastify.log.error({ err }, "Failed update nama varian");
      return reply.code(500).send({ message: "Gagal memperbarui nama varian" });
    }
  });

  fastify.put("/:kode/items/qty-masuk-sync", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodeDetail = String(body.kode_d_penerimaan_pengadaan || "").trim();
    if (!kode || !kodeDetail) {
      return reply.code(400).send({ message: "kode_t_pengadaan dan kode_d_penerimaan_pengadaan wajib diisi" });
    }
    const updated_by = String(body.updated_by || "Admin").trim() || "Admin";
    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const headerRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT TOP 1
            kode_t_penerimaan_pengadaan
          FROM dbo.GWEN_t_penerimaan_pengadaan
          WHERE kode_t_pengadaan = @kode_t_pengadaan;
        `
        );
      if (!headerRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Penerimaan pengadaan tidak ditemukan" });
      }

      const kode_t_penerimaan_pengadaan = headerRes.recordset[0].kode_t_penerimaan_pengadaan;
      const detailRes = await new sql.Request(tx)
        .input("kode_d_penerimaan_pengadaan", sql.VarChar(255), kodeDetail)
        .query(
          `
          SELECT TOP 1
            kode_barang,
            jml_baik_diterima
          FROM dbo.GWEN_d_penerimaan_pengadaan
          WHERE kode_d_penerimaan_pengadaan = @kode_d_penerimaan_pengadaan;
        `
        );
      if (!detailRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Detail penerimaan tidak ditemukan" });
      }

      const kode_barang_variant = String(detailRes.recordset[0].kode_barang || "").trim();
      const qtyMasuk = Number(detailRes.recordset[0].jml_baik_diterima ?? 0);
      if (!kode_barang_variant) {
        await tx.rollback();
        return reply.code(400).send({ message: "Kode barang varian tidak valid" });
      }

      const histRes = await new sql.Request(tx)
        .input("kode_ref_transaksi", sql.VarChar(255), kode_t_penerimaan_pengadaan)
        .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
        .query(
          `
          SELECT TOP 1
            kode_h_stok_barang,
            stok_awal_satuan_1
          FROM dbo.GWEN_h_stok_barang_variant
          WHERE kode_ref_transaksi = @kode_ref_transaksi
            AND kode_barang_variant = @kode_barang_variant
          ORDER BY created_at, kode_h_stok_barang;
        `
        );
      if (!histRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "History stok tidak ditemukan" });
      }

      const kode_h_stok_barang = histRes.recordset[0].kode_h_stok_barang;
      const stokAwal = Number(histRes.recordset[0].stok_awal_satuan_1 ?? 0);
      const stokAkhir = stokAwal + qtyMasuk;

      await new sql.Request(tx)
        .input("kode_h_stok_barang", sql.VarChar(255), kode_h_stok_barang)
        .input("qty_masuk", sql.Decimal(20, 2), qtyMasuk)
        .input("qty_ke_satuan_1", sql.Decimal(20, 2), qtyMasuk)
        .input("stok_akhir_satuan_1", sql.Decimal(20, 2), stokAkhir)
        .input("updated_by", sql.VarChar(255), updated_by)
        .input("updated_at", sql.DateTime, nowWib())
        .query(
          `
          UPDATE dbo.GWEN_h_stok_barang_variant
          SET qty_masuk = @qty_masuk,
              qty_ke_satuan_1 = @qty_ke_satuan_1,
              stok_akhir_satuan_1 = @stok_akhir_satuan_1,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_h_stok_barang = @kode_h_stok_barang;
        `
        );

      await tx.commit();
      return reply.send({ message: "Qty masuk disamakan", qty_masuk: qtyMasuk });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed sync qty masuk");
      return reply.code(500).send({ message: "Gagal menyamakan qty masuk" });
    }
  });

  fastify.put("/:kode/items/sync-purchase", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodeDetail = String(body.kode_d_penerimaan_pengadaan || "").trim();
    if (!kode || !kodeDetail) {
      return reply.code(400).send({ message: "kode_t_pengadaan dan kode_d_penerimaan_pengadaan wajib diisi" });
    }
    const updated_by = String(body.updated_by || "Admin").trim() || "Admin";
    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const headerRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT TOP 1
            kode_t_penerimaan_pengadaan
          FROM dbo.GWEN_t_penerimaan_pengadaan
          WHERE kode_t_pengadaan = @kode_t_pengadaan;
        `
        );
      if (!headerRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Penerimaan pengadaan tidak ditemukan" });
      }
      const kode_t_penerimaan_pengadaan = headerRes.recordset[0].kode_t_penerimaan_pengadaan;

      const detailRes = await new sql.Request(tx)
        .input("kode_d_penerimaan_pengadaan", sql.VarChar(255), kodeDetail)
        .query(
          `
          SELECT TOP 1
            d.kode_barang,
            d.kode_d_pengadaan,
            d.jml_baik_dikirim,
            d.satuan_jml_baik,
            COALESCE(p.is_active, p2.is_active, 1) AS is_active
          FROM dbo.GWEN_d_penerimaan_pengadaan d
          LEFT JOIN dbo.GWEN_d_pengadaan p
            ON p.kode_d_pengadaan = d.kode_d_pengadaan
          LEFT JOIN dbo.GWEN_t_penerimaan_pengadaan t
            ON t.kode_t_penerimaan_pengadaan = d.kode_t_penerimaan_pengadaan
          OUTER APPLY (
            SELECT TOP 1 p2.is_active
            FROM dbo.GWEN_d_pengadaan p2
            WHERE p2.kode_t_pengadaan = t.kode_t_pengadaan
              AND p2.kode_barang_variant = d.kode_barang
            ORDER BY p2.updated_at DESC, p2.created_at DESC
          ) p2
          WHERE d.kode_d_penerimaan_pengadaan = @kode_d_penerimaan_pengadaan;
        `
        );
      if (!detailRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Detail penerimaan tidak ditemukan" });
      }
      const detail = detailRes.recordset[0];
      if (Number(detail.is_active ?? 1) === 0) {
        await tx.rollback();
        return reply.code(400).send({ message: "Item nonaktif, tidak bisa disamakan" });
      }

      const qtyDikirim = Number(detail.jml_baik_dikirim ?? 0);
      const kode_barang_variant = String(detail.kode_barang || "").trim();
      if (!kode_barang_variant) {
        await tx.rollback();
        return reply.code(400).send({ message: "Kode barang varian tidak valid" });
      }

      await new sql.Request(tx)
        .input("kode_d_penerimaan_pengadaan", sql.VarChar(255), kodeDetail)
        .input("jml_baik_diterima", sql.Decimal(20, 2), qtyDikirim)
        .input("jml_rusak_diterima", sql.Decimal(20, 2), 0)
        .input("updated_by", sql.VarChar(255), updated_by)
        .input("updated_at", sql.DateTime, nowWib())
        .query(
          `
          UPDATE dbo.GWEN_d_penerimaan_pengadaan
          SET jml_baik_diterima = @jml_baik_diterima,
              jml_rusak_diterima = @jml_rusak_diterima,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_d_penerimaan_pengadaan = @kode_d_penerimaan_pengadaan;
        `
        );

      const histRes = await new sql.Request(tx)
        .input("kode_ref_transaksi", sql.VarChar(255), kode_t_penerimaan_pengadaan)
        .input("kode_barang_variant", sql.VarChar(255), kode_barang_variant)
        .query(
          `
          SELECT TOP 1
            kode_h_stok_barang,
            stok_awal_satuan_1
          FROM dbo.GWEN_h_stok_barang_variant
          WHERE kode_ref_transaksi = @kode_ref_transaksi
            AND kode_barang_variant = @kode_barang_variant
          ORDER BY created_at, kode_h_stok_barang;
        `
        );
      if (histRes.recordset?.length) {
        const kode_h_stok_barang = histRes.recordset[0].kode_h_stok_barang;
        const stokAwal = Number(histRes.recordset[0].stok_awal_satuan_1 ?? 0);
        const stokAkhir = stokAwal + qtyDikirim;
        await new sql.Request(tx)
          .input("kode_h_stok_barang", sql.VarChar(255), kode_h_stok_barang)
          .input("qty_masuk", sql.Decimal(20, 2), qtyDikirim)
          .input("qty_ke_satuan_1", sql.Decimal(20, 2), qtyDikirim)
          .input("stok_akhir_satuan_1", sql.Decimal(20, 2), stokAkhir)
          .input("updated_by", sql.VarChar(255), updated_by)
          .input("updated_at", sql.DateTime, nowWib())
          .query(
            `
            UPDATE dbo.GWEN_h_stok_barang_variant
            SET qty_masuk = @qty_masuk,
                qty_ke_satuan_1 = @qty_ke_satuan_1,
                stok_akhir_satuan_1 = @stok_akhir_satuan_1,
                updated_by = @updated_by,
                updated_at = @updated_at
            WHERE kode_h_stok_barang = @kode_h_stok_barang;
          `
          );
      }

      await tx.commit();
      return reply.send({ message: "Qty disamakan dengan purchase", qty: qtyDikirim });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed sync qty with purchase");
      return reply.code(500).send({ message: "Gagal menyamakan qty dengan purchase" });
    }
  });

  fastify.put("/:kode/items/sync-purchase-all", async (request, reply) => {
    const { kode } = request.params;
    if (!kode) return reply.code(400).send({ message: "kode_t_pengadaan wajib diisi" });
    const body = request.body || {};
    const updated_by = String(body.updated_by || "Admin").trim() || "Admin";
    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const headerRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT TOP 1
            kode_t_penerimaan_pengadaan
          FROM dbo.GWEN_t_penerimaan_pengadaan
          WHERE kode_t_pengadaan = @kode_t_pengadaan;
        `
        );
      if (!headerRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Penerimaan pengadaan tidak ditemukan" });
      }
      const kode_t_penerimaan_pengadaan = headerRes.recordset[0].kode_t_penerimaan_pengadaan;

      const purchaseRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), String(kode).trim())
        .query(
          `
          SELECT
            kode_d_pengadaan,
            kode_barang_variant,
            qty,
            satuan,
            catatan,
            is_active
          FROM dbo.GWEN_d_pengadaan
          WHERE kode_t_pengadaan = @kode_t_pengadaan
            AND ISNULL(is_active, 1) = 1
          ORDER BY created_at ASC, kode_d_pengadaan ASC;
        `
        );

      const existingRes = await new sql.Request(tx)
        .input("kode_t_penerimaan_pengadaan", sql.VarChar(255), kode_t_penerimaan_pengadaan)
        .query(
          `
          SELECT
            kode_d_penerimaan_pengadaan,
            kode_d_pengadaan,
            kode_barang
          FROM dbo.GWEN_d_penerimaan_pengadaan
          WHERE kode_t_penerimaan_pengadaan = @kode_t_penerimaan_pengadaan;
        `
        );

      const existingByPengadaan = new Map();
      const existingByVariant = new Map();
      for (const row of existingRes.recordset || []) {
        const kode_d_pengadaan = String(row.kode_d_pengadaan || "").trim();
        const kode_barang = String(row.kode_barang || "").trim();
        if (kode_d_pengadaan) existingByPengadaan.set(kode_d_pengadaan, row);
        if (kode_barang) existingByVariant.set(kode_barang, row);
      }

      let insertedCount = 0;
      let updatedCount = 0;

      for (const row of purchaseRes.recordset || []) {
        const kode_d_pengadaan = String(row.kode_d_pengadaan || "").trim();
        const kode_barang_variant = String(row.kode_barang_variant || "").trim();
        if (!kode_barang_variant) continue;

        const qtyDikirim = Number(row.qty ?? 0);
        const satuan = row.satuan || "PCS";
        const catatan = row.catatan || null;

        const existing =
          (kode_d_pengadaan && existingByPengadaan.get(kode_d_pengadaan)) ||
          existingByVariant.get(kode_barang_variant);

        if (existing?.kode_d_penerimaan_pengadaan) {
          await new sql.Request(tx)
            .input("kode_d_penerimaan_pengadaan", sql.VarChar(255), existing.kode_d_penerimaan_pengadaan)
            .input("jml_baik_dikirim", sql.Decimal(20, 2), qtyDikirim)
            .input("satuan_jml_baik", sql.VarChar(255), satuan)
            .input("satuan_jml_rusak", sql.VarChar(255), satuan)
            .input("updated_by", sql.VarChar(255), updated_by)
            .input("updated_at", sql.DateTime, nowWib())
            .query(
              `
              UPDATE dbo.GWEN_d_penerimaan_pengadaan
              SET jml_baik_dikirim = @jml_baik_dikirim,
                  satuan_jml_baik = @satuan_jml_baik,
                  satuan_jml_rusak = @satuan_jml_rusak,
                  updated_by = @updated_by,
                  updated_at = @updated_at
              WHERE kode_d_penerimaan_pengadaan = @kode_d_penerimaan_pengadaan;
            `
            );
          updatedCount += 1;
          continue;
        }

        const kode_d_penerimaan_pengadaan = await generatePenerimaanDetailCode({
          prefix: "DPPG",
          tx,
          padLength: 6,
        });

        await new sql.Request(tx)
          .input("kode_d_penerimaan_pengadaan", sql.VarChar(255), kode_d_penerimaan_pengadaan)
          .input("kode_t_penerimaan_pengadaan", sql.VarChar(255), kode_t_penerimaan_pengadaan)
          .input("kode_barang", sql.VarChar(255), kode_barang_variant)
          .input("jml_baik_dikirim", sql.Decimal(20, 2), qtyDikirim)
          .input("jml_baik_diterima", sql.Decimal(20, 2), 0)
          .input("satuan_jml_baik", sql.VarChar(255), satuan)
          .input("jml_rusak_diterima", sql.Decimal(20, 2), 0)
          .input("satuan_jml_rusak", sql.VarChar(255), satuan)
          .input("catatan", sql.VarChar(255), catatan)
          .input("status", sql.Int, 1)
          .input("status_cadangan", sql.Int, null)
          .input("created_by", sql.VarChar(255), updated_by)
          .input("created_at", sql.DateTime, nowWib())
          .input("updated_by", sql.VarChar(255), updated_by)
          .input("updated_at", sql.DateTime, nowWib())
          .input("kode_d_pengadaan", sql.VarChar(255), kode_d_pengadaan || null)
          .query(
            `
            INSERT INTO dbo.GWEN_d_penerimaan_pengadaan (
              kode_d_penerimaan_pengadaan, kode_t_penerimaan_pengadaan, kode_barang, jml_baik_dikirim, jml_baik_diterima,
              satuan_jml_baik, jml_rusak_diterima, satuan_jml_rusak, catatan, status, status_cadangan,
              created_by, created_at, updated_by, updated_at, kode_d_pengadaan
            ) VALUES (
              @kode_d_penerimaan_pengadaan, @kode_t_penerimaan_pengadaan, @kode_barang, @jml_baik_dikirim, @jml_baik_diterima,
              @satuan_jml_baik, @jml_rusak_diterima, @satuan_jml_rusak, @catatan, @status, @status_cadangan,
              @created_by, @created_at, @updated_by, @updated_at, @kode_d_pengadaan
            );
          `
          );
        insertedCount += 1;
      }

      await tx.commit();
      return reply.send({
        message: "Item disamakan dengan purchase",
        inserted_count: insertedCount,
        updated_count: updatedCount,
      });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed sync all items with purchase");
      return reply.code(500).send({ message: "Gagal menyamakan semua item dengan purchase" });
    }
  });
}

