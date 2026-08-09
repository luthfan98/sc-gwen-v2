export default async function kelasHargaRoutes(fastify) {
  const { sql, pool } = fastify.mssql;
  const now = () => new Date();

  const selectColumns = `
    kh.id_kelas_harga,
    kh.kode_kelas_harga,
    kh.nama,
    kh.channel_code,
    kh.catatan,
    kh.is_active,
    kh.created_by,
    kh.created_at,
    kh.updated_by,
    kh.updated_at,
    khm.base_source,
    khm.m1_type,
    khm.m1_value,
    khm.m3_type,
    khm.m3_value,
    khm.m6_type,
    khm.m6_value,
    khm.m12_type,
    khm.m12_value,
    khm.rounding_mode,
    khm.rounding_step,
    khm.is_active AS margin_is_active
  `;

  fastify.get("/", async (_req, reply) => {
    try {
      const result = await pool
        .request()
        .query(
          `SELECT TOP (1000)
            ${selectColumns}
          FROM dbo.m_kelas_harga kh
          LEFT JOIN dbo.m_kelas_harga_margin khm ON kh.id_kelas_harga = khm.id_kelas_harga
          ORDER BY kh.nama ASC, kh.id_kelas_harga ASC`
        );
      const rows = (result.recordset || []).map(mapRow);
      return reply.send(rows);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch kelas harga");
      return reply.code(500).send({ message: "Failed to fetch kelas harga" });
    }
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params;
    const parsedId = Number(id);
    if (!parsedId) return reply.code(400).send({ message: "id is required" });

    try {
      const result = await pool
        .request()
        .input("id_kelas_harga", sql.BigInt, parsedId)
        .query(
          `SELECT ${selectColumns}
           FROM dbo.m_kelas_harga kh
           LEFT JOIN dbo.m_kelas_harga_margin khm ON kh.id_kelas_harga = khm.id_kelas_harga
           WHERE kh.id_kelas_harga = @id_kelas_harga`
        );

      if (!result.recordset?.length) {
        return reply.code(404).send({ message: "Kelas harga tidak ditemukan" });
      }

      return reply.send(mapRow(result.recordset[0]));
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch kelas harga detail");
      return reply.code(500).send({ message: "Failed to fetch kelas harga" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const timestamp = now();

    if (!body.nama) return reply.code(400).send({ message: "nama wajib diisi" });
    if (!body.channel_code) return reply.code(400).send({ message: "channel_code wajib diisi" });

    const kodeKelasRaw =
      typeof body.kode_kelas_harga === "string" ? body.kode_kelas_harga.trim() : body.kode_kelas_harga;
    const kodeKelas = kodeKelasRaw || (await generateKodeDb(sql, pool));
    const channelCode = String(body.channel_code).trim().toUpperCase();

    try {
      const existRes = await pool
        .request()
        .input("kode_kelas_harga", sql.VarChar(100), kodeKelas)
        .query("SELECT 1 FROM dbo.m_kelas_harga WHERE kode_kelas_harga = @kode_kelas_harga");

      if (existRes.recordset?.length) {
        return reply.code(409).send({ message: "kode_kelas_harga sudah ada" });
      }

      const existChannel = await pool
        .request()
        .input("channel_code", sql.VarChar(50), channelCode)
        .query("SELECT 1 FROM dbo.m_kelas_harga WHERE channel_code = @channel_code");
      if (existChannel.recordset?.length) {
        return reply.code(409).send({ message: "channel_code sudah ada" });
      }

      const req = new sql.Request(pool);
      req.input("kode_kelas_harga", sql.VarChar(100), kodeKelas);
      req.input("nama", sql.VarChar(255), body.nama);
      req.input("channel_code", sql.VarChar(50), channelCode);
      req.input("catatan", sql.VarChar(sql.MAX), body.catatan || null);
      req.input("is_active", sql.Bit, body.is_active ?? 1);
      req.input("created_by", sql.VarChar(100), body.created_by || "Admin");
      req.input("created_at", sql.DateTime2, body.created_at || timestamp);
      req.input("updated_by", sql.VarChar(100), body.updated_by || body.created_by || "Admin");
      req.input("updated_at", sql.DateTime2, body.updated_at || timestamp);

      const insertRes = await req.query(`
        INSERT INTO dbo.m_kelas_harga (
          kode_kelas_harga,
          nama,
          channel_code,
          catatan,
          is_active,
          created_by,
          created_at,
          updated_by,
          updated_at
        )
        OUTPUT INSERTED.id_kelas_harga
        VALUES (
          @kode_kelas_harga,
          @nama,
          @channel_code,
          @catatan,
          @is_active,
          @created_by,
          @created_at,
          @updated_by,
          @updated_at
        );
      `);

      const insertedId = insertRes.recordset?.[0]?.id_kelas_harga;

      // handle margin (optional)
      if (body.margin) {
        await upsertMargin(insertedId, body.margin, {
          created_by: body.created_by,
          updated_by: body.updated_by,
          timestamp
        });
      }

      return reply.code(201).send({
        id_kelas_harga: insertedId,
        kode_kelas_harga: kodeKelas,
        nama: body.nama,
        channel_code: channelCode,
        catatan: body.catatan || null,
        is_active: body.is_active ?? 1,
        created_by: body.created_by || "Admin",
        created_at: body.created_at || timestamp,
        updated_by: body.updated_by || body.created_by || "Admin",
        updated_at: body.updated_at || timestamp
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to create kelas harga");
      return reply.code(500).send({ message: "Failed to create kelas harga" });
    }
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};
    const parsedId = Number(id);
    if (!parsedId) return reply.code(400).send({ message: "id is required" });
    if (!body.nama) return reply.code(400).send({ message: "nama wajib diisi" });
    if (!body.channel_code) return reply.code(400).send({ message: "channel_code wajib diisi" });

    const kodeKelas =
      typeof body.kode_kelas_harga === "string" ? body.kode_kelas_harga.trim() : body.kode_kelas_harga;
    const channelCode = String(body.channel_code).trim().toUpperCase();
    const timestamp = now();

    try {
      // ensure unique channel_code (different id)
      const channelRes = await pool
        .request()
        .input("channel_code", sql.VarChar(50), channelCode)
        .input("id_kelas_harga", sql.BigInt, parsedId)
        .query(
          "SELECT 1 FROM dbo.m_kelas_harga WHERE channel_code = @channel_code AND id_kelas_harga <> @id_kelas_harga"
        );
      if (channelRes.recordset?.length) {
        return reply.code(409).send({ message: "channel_code sudah digunakan kelas lain" });
      }

      const req = new sql.Request(pool);
      req.input("id_kelas_harga", sql.BigInt, parsedId);
      req.input("kode_kelas_harga", sql.VarChar(100), kodeKelas || null);
      req.input("nama", sql.VarChar(255), body.nama);
      req.input("channel_code", sql.VarChar(50), channelCode);
      req.input("catatan", sql.VarChar(sql.MAX), body.catatan || null);
      req.input("is_active", sql.Bit, body.is_active ?? 1);
      req.input("updated_by", sql.VarChar(100), body.updated_by || body.created_by || "Admin");
      req.input("updated_at", sql.DateTime2, body.updated_at || timestamp);

      const result = await req.query(`
        UPDATE dbo.m_kelas_harga
        SET
          kode_kelas_harga = COALESCE(@kode_kelas_harga, kode_kelas_harga),
          nama = @nama,
          channel_code = @channel_code,
          catatan = @catatan,
          is_active = @is_active,
          updated_by = @updated_by,
          updated_at = @updated_at
        WHERE id_kelas_harga = @id_kelas_harga;
      `);

      if (result.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Kelas harga tidak ditemukan" });
      }

      if (body.margin) {
        await upsertMargin(parsedId, body.margin, {
          created_by: body.created_by,
          updated_by: body.updated_by,
          timestamp
        });
      }

      return reply.send({ message: "Kelas harga updated" });
    } catch (err) {
      fastify.log.error({ err }, "Failed to update kelas harga");
      return reply.code(500).send({ message: "Failed to update kelas harga" });
    }
  });

  async function upsertMargin(id_kelas_harga, marginBody, meta) {
    const timestamp = meta.timestamp || now();
    const base_source = (marginBody.base_source || "HPP").toUpperCase();
    const rounding_mode = (marginBody.rounding_mode || "NONE").toUpperCase();
    const rounding_step = Number(marginBody.rounding_step ?? 1) || 1;

    const payload = {
      base_source,
      m1_type: (marginBody.m1_type || "PCT").toUpperCase(),
      m1_value: toDecimal(marginBody.m1_value, 0),
      m3_type: (marginBody.m3_type || "PCT").toUpperCase(),
      m3_value: toDecimal(marginBody.m3_value, 0),
      m6_type: (marginBody.m6_type || "PCT").toUpperCase(),
      m6_value: toDecimal(marginBody.m6_value, 0),
      m12_type: (marginBody.m12_type || "PCT").toUpperCase(),
      m12_value: toDecimal(marginBody.m12_value, 0),
      rounding_mode,
      rounding_step,
      is_active: marginBody.is_active ?? 1,
    };

    const exists = await pool
      .request()
      .input("id_kelas_harga", sql.BigInt, id_kelas_harga)
      .query("SELECT 1 FROM dbo.m_kelas_harga_margin WHERE id_kelas_harga = @id_kelas_harga");

    if (exists.recordset?.length) {
      const req = new sql.Request(pool);
      req.input("id_kelas_harga", sql.BigInt, id_kelas_harga);
      req.input("base_source", sql.VarChar(10), payload.base_source);
      req.input("m1_type", sql.VarChar(3), payload.m1_type);
      req.input("m1_value", sql.Decimal(18, 4), payload.m1_value);
      req.input("m3_type", sql.VarChar(3), payload.m3_type);
      req.input("m3_value", sql.Decimal(18, 4), payload.m3_value);
      req.input("m6_type", sql.VarChar(3), payload.m6_type);
      req.input("m6_value", sql.Decimal(18, 4), payload.m6_value);
      req.input("m12_type", sql.VarChar(3), payload.m12_type);
      req.input("m12_value", sql.Decimal(18, 4), payload.m12_value);
      req.input("rounding_mode", sql.VarChar(10), payload.rounding_mode);
      req.input("rounding_step", sql.Int, payload.rounding_step);
      req.input("is_active", sql.Bit, payload.is_active);
      req.input("updated_by", sql.VarChar(50), marginBody.updated_by || meta.updated_by || "Admin");
      req.input("updated_at", sql.DateTime2, marginBody.updated_at || timestamp);

      await req.query(`
        UPDATE dbo.m_kelas_harga_margin
        SET base_source = @base_source,
            m1_type = @m1_type, m1_value = @m1_value,
            m3_type = @m3_type, m3_value = @m3_value,
            m6_type = @m6_type, m6_value = @m6_value,
            m12_type = @m12_type, m12_value = @m12_value,
            rounding_mode = @rounding_mode,
            rounding_step = @rounding_step,
            is_active = @is_active,
            updated_by = @updated_by,
            updated_at = @updated_at
        WHERE id_kelas_harga = @id_kelas_harga;
      `);
    } else {
      const req = new sql.Request(pool);
      req.input("id_kelas_harga", sql.BigInt, id_kelas_harga);
      req.input("base_source", sql.VarChar(10), payload.base_source);
      req.input("m1_type", sql.VarChar(3), payload.m1_type);
      req.input("m1_value", sql.Decimal(18, 4), payload.m1_value);
      req.input("m3_type", sql.VarChar(3), payload.m3_type);
      req.input("m3_value", sql.Decimal(18, 4), payload.m3_value);
      req.input("m6_type", sql.VarChar(3), payload.m6_type);
      req.input("m6_value", sql.Decimal(18, 4), payload.m6_value);
      req.input("m12_type", sql.VarChar(3), payload.m12_type);
      req.input("m12_value", sql.Decimal(18, 4), payload.m12_value);
      req.input("rounding_mode", sql.VarChar(10), payload.rounding_mode);
      req.input("rounding_step", sql.Int, payload.rounding_step);
      req.input("is_active", sql.Bit, payload.is_active);
      req.input("created_by", sql.VarChar(50), marginBody.created_by || meta.created_by || "Admin");
      req.input("created_at", sql.DateTime2, marginBody.created_at || timestamp);
      req.input("updated_by", sql.VarChar(50), marginBody.updated_by || meta.updated_by || "Admin");
      req.input("updated_at", sql.DateTime2, marginBody.updated_at || timestamp);

      await req.query(`
        INSERT INTO dbo.m_kelas_harga_margin (
          id_kelas_harga, base_source,
          m1_type, m1_value,
          m3_type, m3_value,
          m6_type, m6_value,
          m12_type, m12_value,
          rounding_mode, rounding_step,
          is_active, created_by, created_at, updated_by, updated_at
        ) VALUES (
          @id_kelas_harga, @base_source,
          @m1_type, @m1_value,
          @m3_type, @m3_value,
          @m6_type, @m6_value,
          @m12_type, @m12_value,
          @rounding_mode, @rounding_step,
          @is_active, @created_by, @created_at, @updated_by, @updated_at
        );
      `);
    }
  }

  function mapRow(row = {}) {
    return {
      id_kelas_harga: row.id_kelas_harga,
      kode_kelas_harga: row.kode_kelas_harga,
      nama: row.nama,
      channel_code: row.channel_code,
      catatan: row.catatan,
      is_active: row.is_active,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_by: row.updated_by,
      updated_at: row.updated_at,
      margin: row.base_source
        ? {
            base_source: row.base_source,
            m1_type: row.m1_type,
            m1_value: row.m1_value,
            m3_type: row.m3_type,
            m3_value: row.m3_value,
            m6_type: row.m6_type,
            m6_value: row.m6_value,
            m12_type: row.m12_type,
            m12_value: row.m12_value,
            rounding_mode: row.rounding_mode,
            rounding_step: row.rounding_step,
            is_active: row.margin_is_active
          }
        : null
    };
  }

  async function generateKodeDb(sql, pool) {
    // fallback: generator via stored procedure GWEN_GenerateDocCode
    try {
      const todayIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const req = new sql.Request(pool);
      req.input("Prefix", sql.VarChar(10), "KHG");
      req.input("ExecDate", sql.VarChar(10), todayIso);
      req.input("SiteCode", sql.VarChar(10), "99");
      req.input("BranchCode", sql.VarChar(10), "YZ");
      req.input("Digits", sql.Int, 5);
      req.input("Separator", sql.VarChar(5), ".");
      req.output("Number", sql.Int);
      req.output("Code", sql.VarChar(50));
      await req.execute("GWEN_GenerateDocCode");
      const code = req.parameters.Code?.value;
      if (code) return code;
    } catch (err) {
      fastify.log.error({ err }, "Failed to generate kode via GWEN_GenerateDocCode");
    }

    // fallback simple generator if SP not available
    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `KHG.${yy}${mm}${dd}${hh}${mi}${ss}`;
  }

  function toDecimal(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }
}
