export default async function siteRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  fastify.get("/", async (_request, reply) => {
    try {
      const result = await pool
        .request()
        .query(
          `SELECT TOP (1)
            id_site, kode_site, nama, npwp, alamat, kota, kode_pos, provinsi, negara,
            no_telp, fax, catatan, status, status_cadangan, created_by, created_at,
            updated_by, updated_at, kode_pusat, nama_header_print, alamat_header_print,
            nama_rekening, nama_bank, cabang_bank, nomor_rekening
          FROM dbo.m_site
          ORDER BY created_at DESC, id_site DESC`
        );
      return reply.send(result.recordset?.[0] || {});
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch site info");
      return reply.code(500).send({ message: "Failed to fetch site info" });
    }
  });
}
