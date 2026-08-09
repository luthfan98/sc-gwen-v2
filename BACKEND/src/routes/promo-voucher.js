import crypto from "node:crypto";

export default async function promoVoucherRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const parseDate = (value) => {
    if (!value) return null;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  };

  const generateDocCode = async (trx, prefix) => {
    try {
      const req = trx.request();
      req.input("Prefix", sql.VarChar(10), prefix);
      req.input("ExecDate", sql.Date, null);
      req.input("UserCode", sql.Char(2), "88");
      req.input("BranchCode", sql.Char(2), "GW");
      req.input("PadLength", sql.Int, 6);
      req.input("Separator", sql.Char(1), ".");
      req.output("NextNo", sql.Int);
      req.output("GeneratedCode", sql.VarChar(50));
      const res = await req.execute("GWEN_GenerateDocCode");
      if (res.output?.GeneratedCode) return res.output.GeneratedCode;
    } catch (err) {
      fastify.log.error({ err }, "Failed generate doc code");
    }
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    return `${prefix}.${stamp}${rand}`;
  };

  const generateDetailCode = (prefix) => {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 17);
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    return `${prefix}.${stamp}${rand}`;
  };

  fastify.get("/", async (request, reply) => {
    try {
      const res = await pool.request().query(
        `SELECT h.kode_t_voucher,
                h.nama_program,
                h.berlaku_from,
                h.berlaku_to,
                h.nominal_voucher,
                h.created_at,
                d.kode_voucher
         FROM dbo.GWEN_t_promosi_voucher h
         LEFT JOIN dbo.GWEN_d_promosi_voucher_code d
           ON d.kode_t_voucher = h.kode_t_voucher
         ORDER BY h.created_at DESC;`
      );

      const map = new Map();
      for (const row of res.recordset || []) {
        const key = row.kode_t_voucher;
        if (!map.has(key)) {
          map.set(key, {
            id: row.kode_t_voucher,
            nama_program: row.nama_program,
            berlaku_from: row.berlaku_from,
            berlaku_to: row.berlaku_to,
            nominal_voucher: row.nominal_voucher,
            created_at: row.created_at,
            kode_voucher: [],
          });
        }
        if (row.kode_voucher) {
          map.get(key).kode_voucher.push(row.kode_voucher);
        }
      }
      return reply.send(Array.from(map.values()));
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch promo voucher list");
      return reply.code(500).send({ message: "Gagal memuat voucher" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const nama_program = String(body.nama_program || "").trim();
    const berlaku_from = parseDate(body.berlaku_from);
    const berlaku_to = parseDate(body.berlaku_to);
    const nominal_voucher =
      body.nominal_voucher != null && body.nominal_voucher !== "" ? Number(body.nominal_voucher) : null;
    const kode_voucher = Array.isArray(body.kode_voucher) ? body.kode_voucher : [];
    const created_by = String(body.created_by || "Admin").trim();

    if (!nama_program) return reply.code(400).send({ message: "nama_program wajib diisi" });
    if (!berlaku_from || !berlaku_to) return reply.code(400).send({ message: "berlaku_from dan berlaku_to wajib diisi" });
    if (berlaku_from > berlaku_to) return reply.code(400).send({ message: "berlaku_from tidak boleh > berlaku_to" });
    if (nominal_voucher == null || Number.isNaN(nominal_voucher)) {
      return reply.code(400).send({ message: "nominal_voucher wajib diisi" });
    }
    if (kode_voucher.length === 0) return reply.code(400).send({ message: "kode_voucher minimal 1" });

    const trx = new sql.Transaction(pool);
    try {
      await trx.begin();
      const kode_t_voucher = await generateDocCode(trx, "VCR");
      const now = new Date();

      await trx
        .request()
        .input("kode_t_voucher", sql.VarChar(50), kode_t_voucher)
        .input("nama_program", sql.VarChar(200), nama_program)
        .input("berlaku_from", sql.DateTime2, berlaku_from)
        .input("berlaku_to", sql.DateTime2, berlaku_to)
        .input("nominal_voucher", sql.Decimal(18, 2), nominal_voucher)
        .input("created_by", sql.VarChar(100), created_by)
        .input("created_at", sql.DateTime2, now)
        .input("updated_by", sql.VarChar(100), created_by)
        .input("updated_at", sql.DateTime2, now)
        .query(
          `INSERT INTO dbo.GWEN_t_promosi_voucher
           (kode_t_voucher, nama_program, berlaku_from, berlaku_to, nominal_voucher,
            created_by, created_at, updated_by, updated_at)
           VALUES (@kode_t_voucher, @nama_program, @berlaku_from, @berlaku_to, @nominal_voucher,
                   @created_by, @created_at, @updated_by, @updated_at);`
        );

      for (const code of kode_voucher) {
        const cleaned = String(code || "").trim();
        if (!cleaned) continue;
        await trx
          .request()
          .input("kode_d_voucher", sql.VarChar(50), generateDetailCode("VCD"))
          .input("kode_t_voucher", sql.VarChar(50), kode_t_voucher)
          .input("kode_voucher", sql.VarChar(20), cleaned)
          .input("created_at", sql.DateTime2, now)
          .query(
            `INSERT INTO dbo.GWEN_d_promosi_voucher_code
             (kode_d_voucher, kode_t_voucher, kode_voucher, created_at)
             VALUES (@kode_d_voucher, @kode_t_voucher, @kode_voucher, @created_at);`
          );
      }

      await trx.commit();
      return reply.code(201).send({ kode_t_voucher });
    } catch (err) {
      await trx.rollback().catch(() => {});
      const message =
        err?.originalError?.info?.message ||
        err?.originalError?.message ||
        err?.message ||
        "Gagal menyimpan voucher";
      fastify.log.error({ err }, "Failed create promo voucher");
      return reply.code(500).send({ message });
    }
  });

  fastify.put("/:id", async (request, reply) => {
    const kode = String(request.params?.id || "").trim();
    if (!kode) return reply.code(400).send({ message: "kode voucher tidak valid" });

    const body = request.body || {};
    const nama_program = String(body.nama_program || "").trim();
    const berlaku_from = parseDate(body.berlaku_from);
    const berlaku_to = parseDate(body.berlaku_to);
    const nominal_voucher =
      body.nominal_voucher != null && body.nominal_voucher !== "" ? Number(body.nominal_voucher) : null;
    const kode_voucher = Array.isArray(body.kode_voucher) ? body.kode_voucher : [];
    const updated_by = String(body.updated_by || "Admin").trim();

    if (!nama_program) return reply.code(400).send({ message: "nama_program wajib diisi" });
    if (!berlaku_from || !berlaku_to) return reply.code(400).send({ message: "berlaku_from dan berlaku_to wajib diisi" });
    if (berlaku_from > berlaku_to) return reply.code(400).send({ message: "berlaku_from tidak boleh > berlaku_to" });
    if (nominal_voucher == null || Number.isNaN(nominal_voucher)) {
      return reply.code(400).send({ message: "nominal_voucher wajib diisi" });
    }
    if (kode_voucher.length === 0) return reply.code(400).send({ message: "kode_voucher minimal 1" });

    const trx = new sql.Transaction(pool);
    try {
      await trx.begin();
      const now = new Date();

      const updateRes = await trx
        .request()
        .input("kode_t_voucher", sql.VarChar(50), kode)
        .input("nama_program", sql.VarChar(200), nama_program)
        .input("berlaku_from", sql.DateTime2, berlaku_from)
        .input("berlaku_to", sql.DateTime2, berlaku_to)
        .input("nominal_voucher", sql.Decimal(18, 2), nominal_voucher)
        .input("updated_by", sql.VarChar(100), updated_by)
        .input("updated_at", sql.DateTime2, now)
        .query(
          `UPDATE dbo.GWEN_t_promosi_voucher
           SET nama_program = @nama_program,
               berlaku_from = @berlaku_from,
               berlaku_to = @berlaku_to,
               nominal_voucher = @nominal_voucher,
               updated_by = @updated_by,
               updated_at = @updated_at
           WHERE kode_t_voucher = @kode_t_voucher;`
        );

      if (!updateRes.rowsAffected?.[0]) {
        await trx.rollback();
        return reply.code(404).send({ message: "Voucher tidak ditemukan" });
      }

      await trx
        .request()
        .input("kode_t_voucher", sql.VarChar(50), kode)
        .query(`DELETE FROM dbo.GWEN_d_promosi_voucher_code WHERE kode_t_voucher = @kode_t_voucher;`);

      for (const code of kode_voucher) {
        const cleaned = String(code || "").trim();
        if (!cleaned) continue;
        await trx
          .request()
          .input("kode_d_voucher", sql.VarChar(50), generateDetailCode("VCD"))
          .input("kode_t_voucher", sql.VarChar(50), kode)
          .input("kode_voucher", sql.VarChar(20), cleaned)
          .input("created_at", sql.DateTime2, now)
          .query(
            `INSERT INTO dbo.GWEN_d_promosi_voucher_code
             (kode_d_voucher, kode_t_voucher, kode_voucher, created_at)
             VALUES (@kode_d_voucher, @kode_t_voucher, @kode_voucher, @created_at);`
          );
      }

      await trx.commit();
      return reply.send({ kode_t_voucher: kode });
    } catch (err) {
      await trx.rollback().catch(() => {});
      const message =
        err?.originalError?.info?.message ||
        err?.originalError?.message ||
        err?.message ||
        "Gagal update voucher";
      fastify.log.error({ err }, "Failed update promo voucher");
      return reply.code(500).send({ message });
    }
  });
}
