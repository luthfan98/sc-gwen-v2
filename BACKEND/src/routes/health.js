export default async function healthRoutes(fastify) {
  fastify.get("/health", async () => {
    try {
      const result = await fastify.mssql.query("SELECT 1 AS ok");
      const ok = result?.recordset?.[0]?.ok === 1;
      return { status: ok ? "ok" : "degraded" };
    } catch (err) {
      fastify.log.error({ err }, "Health check failed");
      return { status: "error", error: err.message };
    }
  });
}
