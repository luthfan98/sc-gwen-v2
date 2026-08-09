export default async function barcodeManualRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const generateBarcode = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    return `BM${yy}${mm}${dd}${hh}${mi}${ss}${rand}`;
  };

  const ensureUniqueBarcode = async () => {
    for (let i = 0; i < 10; i += 1) {
      const candidate = generateBarcode();
      const existsRes = await pool
        .request()
        .input("barcode", sql.VarChar(100), candidate)
        .query(
          `SELECT TOP 1 id_barcode_manual
           FROM dbo.GWEN_m_barcode_manual
           WHERE barcode = @barcode;`
        );
      if (!existsRes.recordset?.length) return candidate;
    }
    throw new Error("Gagal generate barcode unik");
  };

  fastify.post("/generate", async (_request, reply) => {
    try {
      const barcode = await ensureUniqueBarcode();
      return reply.send({ barcode });
    } catch (err) {
      fastify.log.error({ err }, "Failed generate barcode manual");
      return reply.code(500).send({ message: "Gagal generate barcode" });
    }
  });

  fastify.get("/", async (_request, reply) => {
    try {
      const result = await pool.request().query(`
        SELECT
          id_barcode_manual,
          barcode,
          nama_item,
          status,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM dbo.GWEN_m_barcode_manual
        WHERE ISNULL(status, 1) = 1
        ORDER BY created_at DESC, id_barcode_manual DESC;
      `);
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch barcode manual");
      return reply.code(500).send({ message: "Gagal memuat barcode manual" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const barcode = String(body.barcode || "").trim();
    const namaItem = String(body.nama_item || "").trim();
    const createdBy = String(body.created_by || "Admin").trim();
    const now = new Date();

    if (!barcode) {
      return reply.code(400).send({ message: "barcode wajib diisi" });
    }
    if (!namaItem) {
      return reply.code(400).send({ message: "nama_item wajib diisi" });
    }

    try {
      const existsRes = await pool
        .request()
        .input("barcode", sql.VarChar(100), barcode)
        .query(
          `SELECT TOP 1 id_barcode_manual
           FROM dbo.GWEN_m_barcode_manual
           WHERE barcode = @barcode;`
        );
      if (existsRes.recordset?.length) {
        return reply.code(409).send({ message: "Barcode sudah digunakan" });
      }

      const insertRes = await pool
        .request()
        .input("barcode", sql.VarChar(100), barcode)
        .input("nama_item", sql.NVarChar(255), namaItem)
        .input("status", sql.Int, 1)
        .input("created_by", sql.VarChar(100), createdBy)
        .input("created_at", sql.DateTime2, now)
        .input("updated_by", sql.VarChar(100), createdBy)
        .input("updated_at", sql.DateTime2, now)
        .query(
          `INSERT INTO dbo.GWEN_m_barcode_manual (
             barcode, nama_item, status, created_by, created_at, updated_by, updated_at
           )
           OUTPUT INSERTED.id_barcode_manual, INSERTED.barcode, INSERTED.nama_item,
                  INSERTED.status, INSERTED.created_by, INSERTED.created_at, INSERTED.updated_by, INSERTED.updated_at
           VALUES (
             @barcode, @nama_item, @status, @created_by, @created_at, @updated_by, @updated_at
           );`
        );

      return reply.code(201).send(insertRes.recordset?.[0]);
    } catch (err) {
      fastify.log.error({ err }, "Failed create barcode manual");
      return reply.code(500).send({ message: "Gagal membuat barcode manual" });
    }
  });

  fastify.put("/:id", async (request, reply) => {
    const id = Number(request.params?.id);
    const body = request.body || {};
    const namaItem = String(body.nama_item || "").trim();
    const updatedBy = String(body.updated_by || "Admin").trim();
    const now = new Date();

    if (!id || Number.isNaN(id)) {
      return reply.code(400).send({ message: "id tidak valid" });
    }
    if (!namaItem) {
      return reply.code(400).send({ message: "nama_item wajib diisi" });
    }

    try {
      const res = await pool
        .request()
        .input("id", sql.Int, id)
        .input("nama_item", sql.NVarChar(255), namaItem)
        .input("updated_by", sql.VarChar(100), updatedBy)
        .input("updated_at", sql.DateTime2, now)
        .query(
          `UPDATE dbo.GWEN_m_barcode_manual
           SET nama_item = @nama_item,
               updated_by = @updated_by,
               updated_at = @updated_at
           OUTPUT INSERTED.id_barcode_manual, INSERTED.barcode, INSERTED.nama_item,
                  INSERTED.status, INSERTED.created_by, INSERTED.created_at, INSERTED.updated_by, INSERTED.updated_at
           WHERE id_barcode_manual = @id;`
        );
      if (!res.recordset?.length) {
        return reply.code(404).send({ message: "Barcode manual tidak ditemukan" });
      }
      return reply.send(res.recordset[0]);
    } catch (err) {
      fastify.log.error({ err }, "Failed update barcode manual");
      return reply.code(500).send({ message: "Gagal update barcode manual" });
    }
  });
}
