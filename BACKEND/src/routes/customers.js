export default async function customerRoutes(fastify) {
  const { pool } = fastify.mssql;

  fastify.get("/", async (_request, reply) => {
    try {
      const res = await pool.request().query(`
        SELECT TOP (500)
          id_customer,
          nama,
          no_ktp,
          no_hp,
          alamat,
          foto_url
        FROM dbo.m_customer
        ORDER BY id_customer DESC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch customers from m_customer, fallback to transactions");
      try {
        const fallback = await pool.request().query(`
          SELECT
            MIN(CAST(customer_id AS varchar(100))) AS id_customer,
            customer_name AS nama,
            NULL AS no_ktp,
            customer_phone AS no_hp,
            NULL AS alamat,
            NULL AS foto_url
          FROM dbo.pos_transactions_central
          WHERE customer_name IS NOT NULL OR customer_phone IS NOT NULL
          GROUP BY customer_name, customer_phone
          ORDER BY MAX(created_at) DESC;
        `);
        return reply.send(fallback.recordset || []);
      } catch (err2) {
        fastify.log.error({ err: err2 }, "Failed fetch customers fallback");
        return reply.code(500).send({ message: "Gagal memuat customer" });
      }
    }
  });
}
