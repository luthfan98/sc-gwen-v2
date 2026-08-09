export default async function dashboardRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  fastify.get("/summary", async (_request, reply) => {
    try {
      const statsRes = await pool.request().query(`
        SELECT
          (SELECT COUNT(1) FROM dbo.GWEN_t_rpo WHERE is_active = 1 AND (status_rpo IS NULL OR status_rpo = 'DRAFT')) AS draft_rpo,
          (SELECT COUNT(1) FROM dbo.GWEN_t_rpo WHERE is_active = 1 AND status_rpo = 'APPROVED' AND ISNULL(is_rilis, 0) = 0) AS pending_release,
          (SELECT COUNT(1) FROM dbo.GWEN_t_rpo WHERE is_active = 1 AND ISNULL(is_rilis, 0) = 1) AS released_rpo,
          (SELECT COUNT(1) FROM dbo.m_barang WHERE status = 1) AS total_barang,
          (SELECT COUNT(1) FROM dbo.users WHERE is_active = 1) AS total_users
      `);

      const pendingDraftRes = await pool.request().query(`
        SELECT TOP 5
          t.kode_t_rpo,
          t.tgl,
          s.nama AS supplier_nama,
          t.total_akhir,
          t.status_rpo,
          t.is_rilis
        FROM dbo.GWEN_t_rpo t
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
        WHERE t.is_active = 1
          AND (t.status_rpo IS NULL OR t.status_rpo = 'DRAFT')
        ORDER BY t.created_at DESC;
      `);

      const pendingReleaseRes = await pool.request().query(`
        SELECT TOP 5
          t.kode_t_rpo,
          t.tgl,
          s.nama AS supplier_nama,
          t.total_akhir,
          t.status_rpo,
          t.is_rilis
        FROM dbo.GWEN_t_rpo t
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
        WHERE t.is_active = 1
          AND t.status_rpo = 'APPROVED'
          AND ISNULL(t.is_rilis, 0) = 0
        ORDER BY t.updated_at DESC;
      `);

      const recentRes = await pool.request().query(`
        SELECT TOP 5
          t.kode_t_rpo,
          t.tgl,
          s.nama AS supplier_nama,
          t.total_akhir,
          t.status_rpo,
          t.is_rilis
        FROM dbo.GWEN_t_rpo t
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
        WHERE t.is_active = 1
        ORDER BY t.created_at DESC;
      `);

      const stats = statsRes.recordset?.[0] || {};
      return reply.send({
        stats,
        pending: {
          draft: pendingDraftRes.recordset || [],
          release: pendingReleaseRes.recordset || [],
        },
        recent: recentRes.recordset || [],
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch dashboard summary");
      return reply.code(500).send({ message: "Gagal memuat dashboard" });
    }
  });
}
