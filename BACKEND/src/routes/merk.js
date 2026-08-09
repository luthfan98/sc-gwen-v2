import { mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { config } from "../config/index.js";

export default async function merkRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  fastify.get("/", async (_req, reply) => {
    try {
      const includeInactive = String(_req.query?.include_inactive || "") === "1";
      const result = await pool
        .request()
        .query(
          `SELECT TOP (1000)
            m.id_merk, m.nama_merk, m.logo_merk, m.prioritas, m.status, m.created_at, m.updated_at,
            ISNULL(item_counts.total_barang, 0) AS total_barang
          FROM dbo.m_merk m
          OUTER APPLY (
            SELECT COUNT(1) AS total_barang
            FROM dbo.m_barang b
            WHERE ISNUMERIC(b.kode_merk) = 1
              AND TRY_CAST(b.kode_merk AS INT) = m.id_merk
          ) item_counts
          ${includeInactive ? "" : "WHERE status = 1"}
          ORDER BY prioritas ASC, nama_merk ASC`
        );
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch merk");
      return reply.code(500).send({ message: "Failed to fetch merk" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const now = new Date();

    if (!body.nama_merk) {
      return reply.code(400).send({ message: "nama_merk wajib diisi" });
    }

    const req = new sql.Request(pool);
    req.input("nama_merk", sql.VarChar(255), body.nama_merk);
    req.input("logo_merk", sql.VarChar(255), body.logo_merk || null);
    req.input("prioritas", sql.Int, body.prioritas ?? null);
    req.input("status", sql.Bit, Number(body.status) === 0 ? 0 : 1);
    req.input("created_at", sql.DateTime2, body.created_at || now);
    req.input("updated_at", sql.DateTime2, body.updated_at || now);

    try {
      const insertResult = await req.query(`
        INSERT INTO dbo.m_merk (nama_merk, logo_merk, prioritas, status, created_at, updated_at)
        OUTPUT INSERTED.id_merk
        VALUES (@nama_merk, @logo_merk, @prioritas, @status, @created_at, @updated_at);
      `);

      const insertedId = insertResult.recordset?.[0]?.id_merk;
      return reply.code(201).send({
        id_merk: insertedId,
        nama_merk: body.nama_merk,
        logo_merk: body.logo_merk || null,
        prioritas: body.prioritas ?? null,
        status: Number(body.status) === 0 ? 0 : 1,
        created_at: body.created_at || now,
        updated_at: body.updated_at || now,
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to create merk");
      return reply.code(500).send({ message: "Failed to create merk" });
    }
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};
    if (!id) return reply.code(400).send({ message: "id is required" });
    if (!body.nama_merk) return reply.code(400).send({ message: "nama_merk wajib diisi" });

    const req = new sql.Request(pool);
    req.input("id_merk", sql.Int, Number(id));
    req.input("nama_merk", sql.VarChar(255), body.nama_merk);
    req.input("logo_merk", sql.VarChar(255), body.logo_merk || null);
    req.input("prioritas", sql.Int, body.prioritas ?? null);
    req.input("status", sql.Bit, Number(body.status) === 0 ? 0 : 1);
    req.input("updated_at", sql.DateTime2, body.updated_at || new Date());

    try {
      const result = await req.query(`
        UPDATE dbo.m_merk
        SET nama_merk = @nama_merk,
            logo_merk = @logo_merk,
            prioritas = @prioritas,
            status = @status,
            updated_at = @updated_at
        WHERE id_merk = @id_merk;
      `);

      if (result.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Merk tidak ditemukan" });
      }

      return reply.send({ message: "Merk updated" });
    } catch (err) {
      fastify.log.error({ err }, "Failed to update merk");
      return reply.code(500).send({ message: "Failed to update merk" });
    }
  });

  fastify.post("/upload-logo", async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ message: "File tidak ditemukan" });

    const { mimetype, filename, file } = data;
    const isAllowed = mimetype.startsWith("image/");
    if (!isAllowed) return reply.code(415).send({ message: "Hanya file gambar yang diizinkan" });

    const targetDir = path.resolve(process.cwd(), "../public/logos");
    await mkdir(targetDir, { recursive: true });

    const ext = path.extname(filename) || "";
    const safeName = `${crypto.randomUUID()}${ext}`;
    const targetPath = path.join(targetDir, safeName);

    await pipeline(file, createWriteStream(targetPath));

    return reply.code(201).send({ url: `/logos/${safeName}` });
  });
}
