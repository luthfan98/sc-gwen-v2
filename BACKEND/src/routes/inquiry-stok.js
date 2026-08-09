export default async function inquiryStokRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  fastify.get("/merk-options", async (req, reply) => {
    const kodeSupplier = String(req.query?.kode_supplier || "").trim();
    if (!kodeSupplier) {
      return reply.code(400).send({ message: "kode_supplier wajib diisi" });
    }
    try {
      const res = await pool
        .request()
        .input("kode_supplier", sql.VarChar(100), kodeSupplier)
        .query(
          `
          SELECT DISTINCT
            b.kode_merk,
            mm.nama_merk
          FROM dbo.m_barang b
          OUTER APPLY (
            SELECT CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS INT) END AS kode_merk_int
          ) mapm
          LEFT JOIN dbo.m_merk mm ON mm.id_merk = mapm.kode_merk_int
          WHERE b.kode_supplier COLLATE DATABASE_DEFAULT = @kode_supplier COLLATE DATABASE_DEFAULT
            AND b.kode_merk IS NOT NULL
            AND LTRIM(RTRIM(b.kode_merk)) <> ''
          ORDER BY mm.nama_merk ASC, b.kode_merk ASC;
        `
        );
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch merk options");
      return reply.code(500).send({ message: "Failed to fetch merk options" });
    }
  });

  fastify.get("/history", async (req, reply) => {
    const kodeBarangVariant = String(req.query?.kode_barang_variant || "").trim();
    const source = String(req.query?.source || "toko").trim().toLowerCase();
    if (!kodeBarangVariant) {
      return reply.code(400).send({ message: "kode_barang_variant wajib diisi" });
    }
    try {
      const reqDb = pool.request();
      reqDb.input("kode_barang_variant", sql.VarChar(100), kodeBarangVariant);
      reqDb.input("source", sql.VarChar(20), source);
      const historyRes = await reqDb.query(
        `
        SELECT TOP 100
          h.tgl_transaksi,
          h.kode_ref_transaksi,
          h.qty_masuk,
          h.qty_keluar,
          h.stok_akhir_satuan_1
        FROM dbo.GWEN_h_stok_barang_variant h
        WHERE h.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT
          AND (
            (@source = 'gudang' AND h.kode_gudang = 'GUD.27012099GW001')
            OR (@source <> 'gudang' AND h.kode_gudang LIKE 'MTO%')
          )
        ORDER BY h.tgl_transaksi ASC, h.kode_h_stok_barang ASC;
        `
      );

      const metaRes = await reqDb.query(
        `
        SELECT TOP 1 v.nama_varian
        FROM dbo.m_barang_varian v
        WHERE v.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT;
        `
      );

      const stokRes = await reqDb.query(
        source === "gudang"
          ? `
            SELECT SUM(ISNULL(s.stok, 0)) AS stok_sisa
            FROM dbo.GWEN_mn_barang_gudang_variant s
            WHERE s.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT;
            `
          : `
            SELECT SUM(ISNULL(s.stok_available, 0)) AS stok_sisa
            FROM dbo.GWEN_mn_barang_toko_variant s
            WHERE s.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT;
            `
      );

      return reply.send({
        nama_varian: metaRes.recordset?.[0]?.nama_varian || null,
        stok_sisa: Number(stokRes.recordset?.[0]?.stok_sisa ?? 0),
        items: historyRes.recordset || [],
        source,
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch inquiry stok history");
      return reply.code(500).send({ message: "Gagal memuat history stok" });
    }
  });

  fastify.get("/", async (req, reply) => {
    const kodeSupplier = String(req.query?.kode_supplier || "").trim();
    const kodeMerk = String(req.query?.kode_merk || "").trim();
    const stokZero = String(req.query?.stok_zero || "").trim() === "1";
    const stokBelow = String(req.query?.stok_below || "").trim() === "1";
    const gudangReadyTokoEmpty = String(req.query?.gudang_ready_toko_empty || "").trim() === "1";

    try {
      const request = pool.request();
      if (kodeSupplier) request.input("kode_supplier", sql.VarChar(100), kodeSupplier);
      if (kodeMerk) request.input("kode_merk", sql.VarChar(100), kodeMerk);

      const filters = [];
      if (kodeSupplier) filters.push("b.kode_supplier = @kode_supplier");
      if (kodeMerk) filters.push("b.kode_merk = @kode_merk");
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

      const result = await request.query(
        `
        WITH raw_base AS (
          SELECT
            b.kode_supplier,
            ms.nama AS nama_supplier,
            b.kode_merk,
            mm.nama_merk,
            b.nama AS nama_barang,
            v.nama_varian,
            v.kode_varian,
            v.kode_barang_variant,
            v.barcode_varian,
            ISNULL(v.is_aktif, 1) AS is_aktif_varian,
            ISNULL(stt.stok_toko, 0) AS stok_toko,
            ISNULL(stg.stok_gudang, 0) AS stok_gudang,
            ISNULL(stg.stok_gudang_detail, '') AS stok_gudang_detail,
            ISNULL(stt.buffer_total, 0) AS buffer_total,
            ISNULL(b.buffer_stok, 0) AS buffer_barang,
            ISNULL(lrpo.stok_pusat_snapshot, 0) AS stok_rpo_terakhir,
            lrpo.tgl_rpo AS stok_rpo_terakhir_tgl,
            ISNULL(lp.qty, 0) AS po_terakhir,
            lp.tgl_po AS po_terakhir_tgl
          FROM dbo.m_barang_varian v
          JOIN dbo.m_barang b ON b.id_barang = v.id_barang
          OUTER APPLY (
            SELECT CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS INT) END AS kode_merk_int
          ) mapm
          LEFT JOIN dbo.m_merk mm ON mm.id_merk = mapm.kode_merk_int
          LEFT JOIN dbo.m_supplier ms
            ON ms.kode_supplier COLLATE DATABASE_DEFAULT = b.kode_supplier COLLATE DATABASE_DEFAULT
          OUTER APPLY (
            SELECT
              SUM(ISNULL(s.stok_available, 0)) AS stok_toko,
              SUM(ISNULL(s.buffer_min, 0)) AS buffer_total
            FROM dbo.GWEN_mn_barang_toko_variant s
            WHERE s.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
          ) stt
          OUTER APPLY (
            SELECT
              ISNULL(SUM(ISNULL(s.stok, 0)), 0) AS stok_gudang,
              CONCAT(
                '1=',
                CAST(CAST(SUM(CASE WHEN UPPER(ISNULL(g.nama, '')) LIKE '%GUDANG 1%' THEN ISNULL(s.stok, 0) ELSE 0 END) AS BIGINT) AS VARCHAR(50)),
                ', 2=',
                CAST(CAST(SUM(CASE WHEN UPPER(ISNULL(g.nama, '')) LIKE '%GUDANG 2%' THEN ISNULL(s.stok, 0) ELSE 0 END) AS BIGINT) AS VARCHAR(50)),
                ', 3=',
                CAST(CAST(SUM(CASE WHEN UPPER(ISNULL(g.nama, '')) LIKE '%GUDANG 3%' THEN ISNULL(s.stok, 0) ELSE 0 END) AS BIGINT) AS VARCHAR(50)),
                ', bs=',
                CAST(CAST(SUM(CASE WHEN ISNULL(g.is_gudang_bs, 0) = 1 OR UPPER(ISNULL(g.nama, '')) LIKE '%BS%' THEN ISNULL(s.stok, 0) ELSE 0 END) AS BIGINT) AS VARCHAR(50))
              ) AS stok_gudang_detail
            FROM dbo.GWEN_mn_barang_gudang_variant s
            LEFT JOIN dbo.m_gudang g
              ON g.kode_gudang COLLATE DATABASE_DEFAULT = s.kode_gudang COLLATE DATABASE_DEFAULT
            WHERE s.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
          ) stg
          OUTER APPLY (
            SELECT TOP 1
              d.stok_pusat_snapshot,
              t.tgl AS tgl_rpo
            FROM dbo.GWEN_d_rpo d
            LEFT JOIN dbo.GWEN_t_rpo t ON t.kode_t_rpo = d.kode_t_rpo
            WHERE d.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
              AND ISNULL(d.is_active, 1) = 1
              AND ISNULL(t.is_active, 1) = 1
              AND (t.status_rpo IS NULL OR t.status_rpo <> 'APPROVED')
            ORDER BY ISNULL(t.tgl, d.created_at) DESC, d.created_at DESC, d.kode_d_rpo DESC
          ) lrpo
          OUTER APPLY (
            SELECT TOP 1
              d.qty,
              t.tgl AS tgl_po
            FROM dbo.GWEN_d_pengadaan d
            LEFT JOIN dbo.GWEN_t_pengadaan t ON t.kode_t_pengadaan = d.kode_t_pengadaan
            WHERE d.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
              AND ISNULL(d.is_active, 1) = 1
            ORDER BY d.created_at DESC, d.kode_d_pengadaan DESC
          ) lp
          ${whereClause}
        ),
        last_sales AS (
          SELECT
            rb.kode_barang_variant,
            MAX(t.created_at) AS terakhir_terjual_tgl
          FROM raw_base rb
          INNER JOIN dbo.pos_transaction_items_central i
            ON ISNULL(i.qty, 0) > 0
            AND (
              i.item_code COLLATE DATABASE_DEFAULT = rb.kode_varian COLLATE DATABASE_DEFAULT
              OR i.item_code COLLATE DATABASE_DEFAULT = rb.kode_barang_variant COLLATE DATABASE_DEFAULT
              OR (
                rb.barcode_varian IS NOT NULL
                AND i.barcode COLLATE DATABASE_DEFAULT = rb.barcode_varian COLLATE DATABASE_DEFAULT
              )
            )
          INNER JOIN dbo.pos_transactions_central t
            ON t.central_trx_code = i.central_trx_code
          GROUP BY rb.kode_barang_variant
        ),
        base AS (
          SELECT
            rb.kode_supplier,
            rb.nama_supplier,
            rb.kode_merk,
            rb.nama_merk,
            rb.nama_barang,
            rb.nama_varian,
            rb.kode_barang_variant,
            rb.barcode_varian,
            rb.is_aktif_varian,
            rb.stok_toko,
            rb.stok_gudang,
            rb.stok_gudang_detail,
            rb.buffer_total,
            rb.buffer_barang,
            rb.stok_rpo_terakhir,
            rb.stok_rpo_terakhir_tgl,
            rb.po_terakhir,
            rb.po_terakhir_tgl,
            ls.terakhir_terjual_tgl
          FROM raw_base rb
          LEFT JOIN last_sales ls
            ON ls.kode_barang_variant COLLATE DATABASE_DEFAULT = rb.kode_barang_variant COLLATE DATABASE_DEFAULT
        ),
        final AS (
          SELECT
            kode_supplier,
            nama_supplier,
            kode_merk,
            nama_merk,
            nama_barang,
            nama_varian,
            kode_barang_variant,
            barcode_varian,
            is_aktif_varian,
            stok_rpo_terakhir,
            stok_rpo_terakhir_tgl,
            po_terakhir,
            po_terakhir_tgl,
            terakhir_terjual_tgl,
            stok_toko,
            stok_gudang,
            ISNULL(stok_gudang_detail, '') AS stok_gudang_detail,
            CASE
              WHEN buffer_total > 0 THEN buffer_total
              ELSE buffer_barang
            END AS buffer_stok
          FROM base
        )
        SELECT
          *,
          CASE
            WHEN ISNULL(buffer_stok, 0) > 0 THEN ROUND((ISNULL(stok_toko, 0) * 100.0) / buffer_stok, 2)
            WHEN ISNULL(po_terakhir, 0) > 0 THEN ROUND((ISNULL(stok_toko, 0) * 100.0) / po_terakhir, 2)
            ELSE 0
          END AS persen_stok_toko,
          CASE
            WHEN ISNULL(buffer_stok, 0) > 0 THEN ROUND((ISNULL(stok_gudang, 0) * 100.0) / buffer_stok, 2)
            WHEN ISNULL(po_terakhir, 0) > 0 THEN ROUND((ISNULL(stok_gudang, 0) * 100.0) / po_terakhir, 2)
            ELSE 0
          END AS persen_stok_gudang
        FROM final
        ${
          stokZero || stokBelow || gudangReadyTokoEmpty
            ? `WHERE ${
                [
                  stokZero ? "ISNULL(stok_toko, 0) = 0" : null,
                  stokBelow
                    ? "(CASE WHEN ISNULL(buffer_stok, 0) > 0 THEN (ISNULL(stok_toko, 0) * 100.0) / buffer_stok WHEN ISNULL(po_terakhir, 0) > 0 THEN (ISNULL(stok_toko, 0) * 100.0) / po_terakhir ELSE 0 END) < 30"
                    : null,
                  gudangReadyTokoEmpty ? "(ISNULL(stok_gudang, 0) > 0 AND ISNULL(stok_toko, 0) = 0)" : null,
                ]
                  .filter(Boolean)
                  .join(" OR ")
              }`
            : ""
        }
        ORDER BY nama_supplier ASC, nama_merk ASC, nama_barang ASC, nama_varian ASC;
        `
      );

      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch inquiry stok");
      return reply.code(500).send({ message: "Failed to fetch inquiry stok" });
    }
  });
}
