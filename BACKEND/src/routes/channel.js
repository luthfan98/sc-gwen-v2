export default async function channelRoutes(fastify) {
  const { sql, pool } = fastify.mssql;
  const now = () => new Date();

  fastify.get("/", async (_req, reply) => {
    try {
      const result = await pool
        .request()
        .query(
          `SELECT TOP (200)
            id_channel,
            kode_channel,
            nama,
            is_marketplace,
            is_active
          FROM dbo.m_channel
          ORDER BY id_channel ASC`
        );
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch channel");
      return reply.code(500).send({ message: "Failed to fetch channel" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    if (!body.kode_channel || !body.nama) {
      return reply.code(400).send({ message: "kode_channel dan nama wajib diisi" });
    }
    try {
      const exist = await pool
        .request()
        .input("kode_channel", sql.VarChar(50), body.kode_channel)
        .query("SELECT 1 FROM dbo.m_channel WHERE kode_channel = @kode_channel");
      if (exist.recordset?.length) {
        return reply.code(409).send({ message: "kode_channel sudah ada" });
      }

      const req = new sql.Request(pool);
      req.input("kode_channel", sql.VarChar(50), body.kode_channel);
      req.input("nama", sql.VarChar(100), body.nama);
      req.input("is_marketplace", sql.Bit, body.is_marketplace ?? 0);
      req.input("is_active", sql.Bit, body.is_active ?? 1);

      const insertRes = await req.query(`
        INSERT INTO dbo.m_channel (kode_channel, nama, is_marketplace, is_active)
        OUTPUT INSERTED.id_channel
        VALUES (@kode_channel, @nama, @is_marketplace, @is_active);
      `);

      return reply.code(201).send({
        id_channel: insertRes.recordset?.[0]?.id_channel,
        kode_channel: body.kode_channel,
        nama: body.nama,
        is_marketplace: body.is_marketplace ?? 0,
        is_active: body.is_active ?? 1,
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to create channel");
      return reply.code(500).send({ message: "Failed to create channel" });
    }
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};
    if (!id) return reply.code(400).send({ message: "id is required" });
    if (!body.nama) return reply.code(400).send({ message: "nama wajib diisi" });

    try {
      const req = new sql.Request(pool);
      req.input("id_channel", sql.Int, Number(id));
      req.input("kode_channel", sql.VarChar(50), body.kode_channel || null);
      req.input("nama", sql.VarChar(100), body.nama);
      req.input("is_marketplace", sql.Bit, body.is_marketplace ?? 0);
      req.input("is_active", sql.Bit, body.is_active ?? 1);

      const result = await req.query(`
        UPDATE dbo.m_channel
        SET
          kode_channel = COALESCE(@kode_channel, kode_channel),
          nama = @nama,
          is_marketplace = @is_marketplace,
          is_active = @is_active
        WHERE id_channel = @id_channel;
      `);

      if (result.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Channel tidak ditemukan" });
      }
      return reply.send({ message: "Channel updated" });
    } catch (err) {
      fastify.log.error({ err }, "Failed to update channel");
      return reply.code(500).send({ message: "Failed to update channel" });
    }
  });
}
