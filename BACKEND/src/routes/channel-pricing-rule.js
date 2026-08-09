export default async function channelPricingRuleRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const selectColumns = `
    cpr.id,
    cpr.id_kelas_harga,
    cpr.id_channel,
    cpr.base_tier,
    cpr.fee_pct,
    cpr.markup_pct,
    cpr.fixed_fee,
    cpr.rounding_mode,
    cpr.rounding_step,
    cpr.berlaku_mulai,
    cpr.berlaku_sampai,
    cpr.is_active,
    kh.kode_kelas_harga,
    kh.nama AS nama_kelas,
    ch.kode_channel,
    ch.nama AS nama_channel
  `;

  fastify.get("/", async (_req, reply) => {
    try {
      const result = await pool
        .request()
        .query(
          `SELECT TOP (300)
            ${selectColumns}
          FROM dbo.m_channel_pricing_rule cpr
          LEFT JOIN dbo.m_kelas_harga kh ON cpr.id_kelas_harga = kh.id_kelas_harga
          LEFT JOIN dbo.m_channel ch ON cpr.id_channel = ch.id_channel
          ORDER BY cpr.berlaku_mulai DESC, cpr.id DESC`
        );
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch channel pricing rule");
      return reply.code(500).send({ message: "Failed to fetch channel pricing rule" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    if (!body.id_kelas_harga || !body.id_channel || !body.berlaku_mulai) {
      return reply.code(400).send({ message: "id_kelas_harga, id_channel, berlaku_mulai wajib diisi" });
    }

    try {
      const req = new sql.Request(pool);
      req.input("id_kelas_harga", sql.BigInt, Number(body.id_kelas_harga));
      req.input("id_channel", sql.Int, Number(body.id_channel));
      req.input("base_tier", sql.TinyInt, Number(body.base_tier ?? 1));
      req.input("fee_pct", sql.Decimal(9, 4), toDecimal(body.fee_pct, 0));
      req.input("markup_pct", sql.Decimal(9, 4), toDecimal(body.markup_pct, 0));
      req.input("fixed_fee", sql.Decimal(18, 2), toDecimal(body.fixed_fee, 0));
      req.input("rounding_mode", sql.VarChar(10), body.rounding_mode || "CEIL");
      req.input("rounding_step", sql.Int, Number(body.rounding_step ?? 1));
      req.input("berlaku_mulai", sql.DateTime2, new Date(body.berlaku_mulai));
      req.input("berlaku_sampai", sql.DateTime2, body.berlaku_sampai ? new Date(body.berlaku_sampai) : null);
      req.input("is_active", sql.Bit, body.is_active ?? 1);

      const insertRes = await req.query(`
        INSERT INTO dbo.m_channel_pricing_rule (
          id_kelas_harga,
          id_channel,
          base_tier,
          fee_pct,
          markup_pct,
          fixed_fee,
          rounding_mode,
          rounding_step,
          berlaku_mulai,
          berlaku_sampai,
          is_active
        )
        OUTPUT INSERTED.id
        VALUES (
          @id_kelas_harga,
          @id_channel,
          @base_tier,
          @fee_pct,
          @markup_pct,
          @fixed_fee,
          @rounding_mode,
          @rounding_step,
          @berlaku_mulai,
          @berlaku_sampai,
          @is_active
        );
      `);

      return reply.code(201).send({ id: insertRes.recordset?.[0]?.id, ...body });
    } catch (err) {
      if (err.number === 2627) {
        return reply.code(409).send({ message: "Data dengan kombinasi sama sudah ada" });
      }
      fastify.log.error({ err }, "Failed to create pricing rule");
      return reply.code(500).send({ message: "Failed to create pricing rule" });
    }
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};
    if (!id) return reply.code(400).send({ message: "id is required" });

    try {
      const req = new sql.Request(pool);
      req.input("id", sql.BigInt, Number(id));
      req.input("id_kelas_harga", sql.BigInt, body.id_kelas_harga ? Number(body.id_kelas_harga) : null);
      req.input("id_channel", sql.Int, body.id_channel ? Number(body.id_channel) : null);
      req.input("base_tier", sql.TinyInt, body.base_tier ? Number(body.base_tier) : null);
      req.input("fee_pct", sql.Decimal(9, 4), toDecimal(body.fee_pct, null));
      req.input("markup_pct", sql.Decimal(9, 4), toDecimal(body.markup_pct, null));
      req.input("fixed_fee", sql.Decimal(18, 2), toDecimal(body.fixed_fee, null));
      req.input("rounding_mode", sql.VarChar(10), body.rounding_mode || null);
      req.input("rounding_step", sql.Int, body.rounding_step ? Number(body.rounding_step) : null);
      req.input("berlaku_mulai", sql.DateTime2, body.berlaku_mulai ? new Date(body.berlaku_mulai) : null);
      req.input("berlaku_sampai", sql.DateTime2, body.berlaku_sampai ? new Date(body.berlaku_sampai) : null);
      req.input("is_active", sql.Bit, body.is_active ?? 1);

      const result = await req.query(`
        UPDATE dbo.m_channel_pricing_rule
        SET
          id_kelas_harga = COALESCE(@id_kelas_harga, id_kelas_harga),
          id_channel = COALESCE(@id_channel, id_channel),
          base_tier = COALESCE(@base_tier, base_tier),
          fee_pct = COALESCE(@fee_pct, fee_pct),
          markup_pct = COALESCE(@markup_pct, markup_pct),
          fixed_fee = COALESCE(@fixed_fee, fixed_fee),
          rounding_mode = COALESCE(@rounding_mode, rounding_mode),
          rounding_step = COALESCE(@rounding_step, rounding_step),
          berlaku_mulai = COALESCE(@berlaku_mulai, berlaku_mulai),
          berlaku_sampai = @berlaku_sampai,
          is_active = @is_active
        WHERE id = @id;
      `);

      if (result.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Pricing rule tidak ditemukan" });
      }
      return reply.send({ message: "Pricing rule updated" });
    } catch (err) {
      if (err.number === 2627) {
        return reply.code(409).send({ message: "Data dengan kombinasi sama sudah ada" });
      }
      fastify.log.error({ err }, "Failed to update pricing rule");
      return reply.code(500).send({ message: "Failed to update pricing rule" });
    }
  });

  function toDecimal(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }
}
