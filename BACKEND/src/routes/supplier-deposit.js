import { runBackfill } from "../../run_deposit_backfill.js";

export default async function supplierDepositRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  // Get deposit balance for a specific supplier
  fastify.get("/saldo/:kodeSupplier", async (request, reply) => {
    const kodeSupplier = String(request.params?.kodeSupplier || "").trim();
    if (!kodeSupplier) {
      return reply.code(400).send({ message: "kode_supplier wajib diisi" });
    }

    try {
      const res = await pool
        .request()
        .input("kode_supplier", sql.VarChar(255), kodeSupplier)
        .query(`
          SELECT
            s.kode_supplier,
            COALESCE(d.nama_supplier COLLATE DATABASE_DEFAULT, s.nama COLLATE DATABASE_DEFAULT, s.kode_supplier COLLATE DATABASE_DEFAULT) AS nama_supplier,
            ISNULL(d.saldo_deposit, 0) AS saldo_deposit,
            d.updated_at
          FROM dbo.m_supplier s
          LEFT JOIN dbo.GWEN_m_supplier_deposit d
            ON d.kode_supplier COLLATE DATABASE_DEFAULT = s.kode_supplier COLLATE DATABASE_DEFAULT
          WHERE s.kode_supplier COLLATE DATABASE_DEFAULT = @kode_supplier COLLATE DATABASE_DEFAULT;
        `);

      if (!res.recordset?.length) {
        // Fallback check directly in deposit table if supplier code isn't in m_supplier
        const fallback = await pool
          .request()
          .input("kode_supplier", sql.VarChar(255), kodeSupplier)
          .query(`
            SELECT
              kode_supplier,
              nama_supplier,
              ISNULL(saldo_deposit, 0) AS saldo_deposit,
              updated_at
            FROM dbo.GWEN_m_supplier_deposit
            WHERE kode_supplier = @kode_supplier;
          `);

        if (fallback.recordset?.length) {
          return reply.send(fallback.recordset[0]);
        }

        return reply.send({
          kode_supplier: kodeSupplier,
          nama_supplier: kodeSupplier,
          saldo_deposit: 0,
          updated_at: null,
        });
      }

      return reply.send(res.recordset[0]);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch supplier deposit balance");
      return reply.code(500).send({ message: "Gagal memuat saldo deposit supplier" });
    }
  });

  // Get all suppliers deposit summary
  fastify.get("/summary", async (_request, reply) => {
    try {
      const res = await pool.request().query(`
        SELECT
          d.kode_supplier,
          COALESCE(s.nama COLLATE DATABASE_DEFAULT, d.nama_supplier COLLATE DATABASE_DEFAULT, d.kode_supplier COLLATE DATABASE_DEFAULT) AS nama_supplier,
          d.saldo_deposit,
          d.updated_at,
          d.updated_by
        FROM dbo.GWEN_m_supplier_deposit d
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = d.kode_supplier COLLATE DATABASE_DEFAULT
        ORDER BY d.saldo_deposit DESC, d.nama_supplier ASC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch deposit summary");
      return reply.code(500).send({ message: "Gagal memuat ringkasan deposit supplier" });
    }
  });

  // Get deposit audit ledger (buku besar mutasi)
  fastify.get("/ledger", async (request, reply) => {
    const query = request.query || {};
    const kodeSupplier = String(query.kode_supplier || "").trim();
    const search = String(query.search || "").trim();
    const tipeMutasi = String(query.tipe_mutasi || "").trim().toUpperCase();
    const tglMulai = String(query.tgl_mulai || "").trim();
    const tglAkhir = String(query.tgl_akhir || "").trim();
    const page = Math.max(Number(query.page || 1) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.page_size || 50) || 50, 1), 200);
    const offset = (page - 1) * pageSize;

    const filters = [];
    const req = pool.request();

    if (kodeSupplier) {
      req.input("kode_supplier", sql.VarChar(255), kodeSupplier);
      filters.push("l.kode_supplier = @kode_supplier");
    }
    if (tipeMutasi && (tipeMutasi === "MASUK" || tipeMutasi === "KELUAR")) {
      req.input("tipe_mutasi", sql.VarChar(50), tipeMutasi);
      filters.push("l.tipe_mutasi = @tipe_mutasi");
    }
    if (tglMulai) {
      req.input("tgl_mulai", sql.DateTime, new Date(tglMulai));
      filters.push("l.tgl_mutasi >= @tgl_mulai");
    }
    if (tglAkhir) {
      const endExclusive = new Date(tglAkhir);
      endExclusive.setDate(endExclusive.getDate() + 1);
      req.input("tgl_akhir", sql.DateTime, endExclusive);
      filters.push("l.tgl_mutasi < @tgl_akhir");
    }
    if (search) {
      req.input("search_like", sql.NVarChar(255), `%${search}%`);
      filters.push(`(
        l.kode_mutasi LIKE @search_like
        OR l.kode_ref LIKE @search_like
        OR l.nama_supplier LIKE @search_like
        OR l.keterangan LIKE @search_like
      )`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    req.input("offset", sql.Int, offset);
    req.input("page_size", sql.Int, pageSize);

    try {
      const result = await req.query(`
        SELECT
          l.id_ledger,
          l.kode_mutasi,
          l.tgl_mutasi,
          l.kode_supplier,
          l.nama_supplier,
          l.tipe_mutasi,
          l.kode_ref,
          l.saldo_awal,
          l.nominal,
          l.saldo_akhir,
          l.keterangan,
          l.created_by,
          l.created_at,
          COUNT(1) OVER() AS total_count
        FROM dbo.GWEN_t_supplier_deposit_ledger l
        ${whereClause}
        ORDER BY l.tgl_mutasi DESC, l.id_ledger DESC
        OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY;
      `);

      const rows = result.recordset || [];
      const totalCount = rows.length ? Number(rows[0].total_count) : 0;

      return reply.send({
        items: rows.map(({ total_count: _, ...rest }) => rest),
        total: totalCount,
        page,
        page_size: pageSize,
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch deposit ledger");
      return reply.code(500).send({ message: "Gagal memuat buku besar deposit supplier" });
    }
  });

  // Trigger backfill
  fastify.post("/backfill", async (_request, reply) => {
    try {
      const res = await runBackfill(pool);
      return reply.send({ message: "Backfill berhasil dijalankan", ...res });
    } catch (err) {
      fastify.log.error({ err }, "Failed to run deposit backfill");
      return reply.code(500).send({ message: "Gagal menjalankan backfill deposit" });
    }
  });
}

