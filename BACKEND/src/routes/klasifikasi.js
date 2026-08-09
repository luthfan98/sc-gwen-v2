export default async function klasifikasiRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const generateKode = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    return `KLA.${yy}${mm}${dd}${hh}${mi}${ss}${ms}`;
  };

  fastify.get("/", async (_req, reply) => {
    try {
      const result = await pool
        .request()
        .query(
          `SELECT TOP (200)
            kode_klasifikasi, nama, status, status_cadangan,
            created_by, created_at, updated_by, updated_at, kode_parent
          FROM dbo.m_klasifikasi
          ORDER BY created_at DESC`
        );
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch klasifikasi");
      return reply.code(500).send({ message: "Failed to fetch klasifikasi" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const now = new Date();

    if (!body.nama) {
      return reply.code(400).send({ message: "nama wajib diisi" });
    }

    const kodeKlasifikasi = body.kode_klasifikasi?.trim() || generateKode();
    const createdBy = body.created_by?.trim() || "Admin";

    const req = new sql.Request(pool);
    req.input("kode_klasifikasi", sql.VarChar(255), kodeKlasifikasi);
    req.input("nama", sql.VarChar(255), body.nama);
    req.input("status", sql.Int, body.status ?? 1);
    req.input("status_cadangan", sql.Int, body.status_cadangan ?? 0);
    req.input("created_by", sql.VarChar(255), createdBy);
    req.input("created_at", sql.DateTime2, body.created_at || now);
    req.input("updated_by", sql.VarChar(255), body.updated_by || createdBy);
    req.input("updated_at", sql.DateTime2, body.updated_at || now);
    req.input("kode_parent", sql.VarChar(255), body.kode_parent || null);

    try {
      const existRes = await pool
        .request()
        .input("kode_klasifikasi", sql.VarChar(255), kodeKlasifikasi)
        .query("SELECT 1 FROM dbo.m_klasifikasi WHERE kode_klasifikasi = @kode_klasifikasi");
      if (existRes.recordset.length > 0) {
        return reply.code(409).send({ message: "kode_klasifikasi already exists" });
      }

      await req.query(`
        INSERT INTO dbo.m_klasifikasi (
          kode_klasifikasi, nama, status, status_cadangan,
          created_by, created_at, updated_by, updated_at, kode_parent
        ) VALUES (
          @kode_klasifikasi, @nama, @status, @status_cadangan,
          @created_by, @created_at, @updated_by, @updated_at, @kode_parent
        );
      `);

      return reply.code(201).send({
        kode_klasifikasi: kodeKlasifikasi,
        nama: body.nama,
        status: body.status ?? 1,
        status_cadangan: body.status_cadangan ?? 0,
        created_by: createdBy,
        created_at: body.created_at || now,
        updated_by: body.updated_by || createdBy,
        updated_at: body.updated_at || now,
        kode_parent: body.kode_parent || null
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to create klasifikasi");
      return reply.code(500).send({ message: "Failed to create klasifikasi" });
    }
  });

  fastify.put("/:kode_klasifikasi", async (request, reply) => {
    const { kode_klasifikasi } = request.params;
    const body = request.body || {};
    if (!kode_klasifikasi) return reply.code(400).send({ message: "kode_klasifikasi is required" });

    const now = new Date();
    const req = new sql.Request(pool);
    req.input("kode_klasifikasi", sql.VarChar(255), kode_klasifikasi);
    req.input("nama", sql.VarChar(255), body.nama || null);
    req.input("status", sql.Int, body.status ?? null);
    req.input("status_cadangan", sql.Int, body.status_cadangan ?? null);
    req.input("updated_by", sql.VarChar(255), body.updated_by || body.created_by || null);
    req.input("updated_at", sql.DateTime2, body.updated_at || now);
    req.input("kode_parent", sql.VarChar(255), body.kode_parent || null);

    try {
      const result = await req.query(`
        UPDATE dbo.m_klasifikasi
        SET nama = @nama,
            status = @status,
            status_cadangan = @status_cadangan,
            updated_by = @updated_by,
            updated_at = @updated_at,
            kode_parent = @kode_parent
        WHERE kode_klasifikasi = @kode_klasifikasi;
      `);

      if (result.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Klasifikasi tidak ditemukan" });
      }

      return reply.send({ message: "Klasifikasi updated" });
    } catch (err) {
      fastify.log.error({ err }, "Failed to update klasifikasi");
      return reply.code(500).send({ message: "Failed to update klasifikasi" });
    }
  });
}
