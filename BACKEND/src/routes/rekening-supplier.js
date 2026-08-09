export default async function rekeningSupplierRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  fastify.get("/", async (_request, reply) => {
    try {
      const res = await pool.request().query(`
        SELECT
          id,
          kode_supplier,
          nama_supplier,
          nama_bank,
          no_rekening,
          atas_nama,
          cabang,
          status
        FROM dbo.GWEN_m_rekening_supplier
        ORDER BY id DESC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch rekening supplier");
      return reply.code(500).send({ message: "Gagal memuat rekening supplier" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const now = new Date();
    const kodeSupplier = body.kode_supplier || null;
    const namaSupplier = body.nama_supplier || null;
    const namaBank = body.nama_bank || null;
    const noRekening = body.no_rekening || null;
    const atasNama = body.atas_nama || null;
    const cabang = body.cabang || null;
    const status = body.status ?? 1;

    if (!kodeSupplier || !namaSupplier || !namaBank || !noRekening) {
      return reply.code(400).send({ message: "Supplier, bank, dan nomor rekening wajib diisi" });
    }

    try {
      const req = pool.request();
      req.input("kode_supplier", sql.VarChar(255), kodeSupplier);
      req.input("nama_supplier", sql.VarChar(255), namaSupplier);
      req.input("nama_bank", sql.VarChar(255), namaBank);
      req.input("no_rekening", sql.VarChar(255), noRekening);
      req.input("atas_nama", sql.VarChar(255), atasNama);
      req.input("cabang", sql.VarChar(255), cabang);
      req.input("status", sql.Int, Number(status));
      req.input("created_at", sql.DateTime2, now);
      req.input("updated_at", sql.DateTime2, now);

      const res = await req.query(`
        INSERT INTO dbo.GWEN_m_rekening_supplier (
          kode_supplier,
          nama_supplier,
          nama_bank,
          no_rekening,
          atas_nama,
          cabang,
          status,
          created_at,
          updated_at
        )
        OUTPUT INSERTED.id
        VALUES (
          @kode_supplier,
          @nama_supplier,
          @nama_bank,
          @no_rekening,
          @atas_nama,
          @cabang,
          @status,
          @created_at,
          @updated_at
        );
      `);

      return reply.code(201).send({ id: res.recordset?.[0]?.id });
    } catch (err) {
      fastify.log.error({ err }, "Failed create rekening supplier");
      return reply.code(500).send({ message: "Gagal menambah rekening supplier" });
    }
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params || {};
    const body = request.body || {};
    const now = new Date();
    const kodeSupplier = body.kode_supplier || null;
    const namaSupplier = body.nama_supplier || null;
    const namaBank = body.nama_bank || null;
    const noRekening = body.no_rekening || null;
    const atasNama = body.atas_nama || null;
    const cabang = body.cabang || null;
    const status = body.status ?? 1;

    if (!id) {
      return reply.code(400).send({ message: "id wajib diisi" });
    }

    try {
      const req = pool.request();
      req.input("id", sql.Int, Number(id));
      req.input("kode_supplier", sql.VarChar(255), kodeSupplier);
      req.input("nama_supplier", sql.VarChar(255), namaSupplier);
      req.input("nama_bank", sql.VarChar(255), namaBank);
      req.input("no_rekening", sql.VarChar(255), noRekening);
      req.input("atas_nama", sql.VarChar(255), atasNama);
      req.input("cabang", sql.VarChar(255), cabang);
      req.input("status", sql.Int, Number(status));
      req.input("updated_at", sql.DateTime2, now);

      const res = await req.query(`
        UPDATE dbo.GWEN_m_rekening_supplier
        SET
          kode_supplier = @kode_supplier,
          nama_supplier = @nama_supplier,
          nama_bank = @nama_bank,
          no_rekening = @no_rekening,
          atas_nama = @atas_nama,
          cabang = @cabang,
          status = @status,
          updated_at = @updated_at
        WHERE id = @id;
      `);

      if (res.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Rekening supplier tidak ditemukan" });
      }

      return reply.send({ message: "Rekening supplier updated" });
    } catch (err) {
      fastify.log.error({ err }, "Failed update rekening supplier");
      return reply.code(500).send({ message: "Gagal update rekening supplier" });
    }
  });
}
