export default async function docCodeRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  fastify.post("/generate", async (request, reply) => {
    const body = request.body || {};
    const {
      prefix = "RPO",
      userCode = "99",
      branchCode = "YZ",
      padLength = 5,
      separator = ".",
      execDate = null,
    } = body;

    try {
      const req = pool.request();
      req.input("Prefix", sql.VarChar(10), prefix);
      req.input("ExecDate", sql.Date, execDate ? new Date(execDate) : null);
      req.input("UserCode", sql.Char(2), userCode);
      req.input("BranchCode", sql.Char(2), branchCode);
      req.input("PadLength", sql.Int, padLength);
      req.input("Separator", sql.Char(1), separator);
      req.output("NextNo", sql.Int);
      req.output("GeneratedCode", sql.VarChar(50));

      const res = await req.execute("GWEN_GenerateDocCode");

      const generatedCode = res.output?.GeneratedCode;
      const nextNo = res.output?.NextNo;

      if (!generatedCode) {
        return reply.code(500).send({ message: "Failed to generate code" });
      }

      return reply.send({ generatedCode, nextNo });
    } catch (err) {
      fastify.log.error({ err }, "Failed to generate document code");
      const message = err?.message || "Failed to generate code";
      return reply.code(500).send({ message });
    }
  });
}
