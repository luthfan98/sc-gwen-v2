export default async function tokoRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  fastify.get("/", async (_req, reply) => {
    try {
      const request = pool.request();
      request.timeout = 30000;
      const result = await request.query(`
        SELECT TOP (1000)
          kode_toko, nama_toko, alamat, kota, provinsi, kode_pos, telp, status, created_at, updated_at
        FROM dbo.m_toko WITH (NOLOCK)
        WHERE status = 1
        ORDER BY nama_toko ASC;
      `);
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch toko");
      return reply.code(500).send({ message: "Failed to fetch toko" });
    }
  });

  fastify.get("/:kode/stock", async (req, reply) => {
    const kodeToko = String(req.params?.kode || "").trim();
    if (!kodeToko) {
      return reply.code(400).send({ message: "kode_toko wajib diisi" });
    }

    try {
      const page = Math.max(1, Number(req.query?.page || 1));
      const rawPageSize = Number(req.query?.page_size ?? 50);
      const pageSize = Number.isFinite(rawPageSize) ? rawPageSize : 50;
      const noLimit = String(req.query?.no_limit || "").trim() === "1" || pageSize === 0;
      const keyword = String(req.query?.q || "").trim();
      const onlyAvailable = String(req.query?.only_available || "").trim() === "1";
      const kodeMerk = String(req.query?.kode_merk || "").trim();
      const kodeSupplier = String(req.query?.kode_supplier || "").trim();

      const request = pool.request();
      request.input("kode_toko", sql.VarChar(100), kodeToko);
      if (!noLimit) {
        request.input("offset", sql.Int, (page - 1) * pageSize);
        request.input("page_size", sql.Int, pageSize);
      }
      if (keyword) {
        request.input("q", sql.VarChar(255), `%${keyword}%`);
      }
      if (kodeMerk) {
        request.input("kode_merk", sql.VarChar(100), kodeMerk);
      }
      if (kodeSupplier) {
        request.input("kode_supplier", sql.VarChar(100), kodeSupplier);
      }
      const filters = ["sa.kode_toko = @kode_toko"];
      if (keyword) {
        filters.push(
          "(b.nama LIKE @q OR v.nama_varian LIKE @q OR v.barcode_varian LIKE @q OR sa.kode_barang_variant LIKE @q)"
        );
      }
      if (kodeMerk) {
        filters.push("b.kode_merk = @kode_merk");
      }
      if (kodeSupplier) {
        filters.push("b.kode_supplier = @kode_supplier");
      }
      if (onlyAvailable) {
        filters.push("(ISNULL(sa.qty_baik, 0) + ISNULL(sa.qty_rusak, 0)) > 0");
      }
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

      const result = await request.query(
        `
        WITH stock_agg AS (
          SELECT
            s.kode_barang_variant,
            s.kode_toko,
            SUM(ISNULL(s.stok_available, 0)) AS stok,
            SUM(
              CASE
                WHEN s.stok_available IS NOT NULL THEN s.stok_available
                ELSE ISNULL(s.qty_baik, 0)
              END
            ) AS qty_baik,
            SUM(ISNULL(s.qty_rusak, 0)) AS qty_rusak,
            SUM(ISNULL(s.buffer_min, 0)) AS minimum_stok,
            MAX(CAST(ISNULL(s.status, 1) AS INT)) AS status
          FROM dbo.GWEN_mn_barang_toko_variant s
          GROUP BY s.kode_barang_variant, s.kode_toko
        ),
        base AS (
          SELECT
            sa.kode_barang_variant,
            sa.kode_toko,
            sa.stok,
            sa.qty_baik,
            sa.qty_rusak,
            sa.minimum_stok,
            sa.status,
            v.nama_varian,
            v.kode_varian,
            v.barcode_varian,
            b.kode_barang,
            b.nama AS nama_barang,
            b.satuan_1,
            b.kode_supplier,
            b.kode_merk,
            mm.nama_merk,
            ms.nama AS nama_supplier
          FROM stock_agg sa
          LEFT JOIN dbo.m_barang_varian v ON v.kode_barang_variant = sa.kode_barang_variant
          LEFT JOIN dbo.m_barang b ON b.id_barang = v.id_barang
          OUTER APPLY (
            SELECT CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS INT) END AS kode_merk_int
          ) mapm
          LEFT JOIN dbo.m_merk mm ON mm.id_merk = mapm.kode_merk_int
          LEFT JOIN dbo.m_supplier ms
            ON ms.kode_supplier COLLATE DATABASE_DEFAULT = b.kode_supplier COLLATE DATABASE_DEFAULT
          ${whereClause}
        )
        SELECT
          *,
          (SELECT COUNT(1) FROM base) AS total_count
        FROM base
        ORDER BY nama_barang ASC, nama_varian ASC
        ${noLimit ? "" : "OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY"}
        ;
        `
      );
      const rows = result.recordset || [];
      const total = rows.length ? Number(rows[0].total_count ?? 0) : 0;
      const items = rows.map(({ total_count, ...rest }) => rest);
      return reply.send({ items, total });
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch toko stock");
      return reply.code(500).send({ message: "Failed to fetch toko stock" });
    }
  });
}
