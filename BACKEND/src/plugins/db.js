import fastifyPlugin from "fastify-plugin";
import sql from "mssql";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

async function dbConnector(fastify) {
  const pool = new sql.ConnectionPool({
    server: config.db.server,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    requestTimeout: config.db.requestTimeout,
    connectionTimeout: config.db.connectionTimeout,
    pool: config.db.pool,
    options: config.db.options
  });

  try {
    await pool.connect();
    logger.info("SQL Server connected");
  } catch (err) {
    logger.error({ err }, "Failed to connect to SQL Server");
    throw err;
  }

  fastify.decorate("mssql", {
    sql,
    pool,
    query: (...args) => pool.request().query(...args)
  });

  fastify.addHook("onClose", async () => {
    await pool.close();
  });
}

export default fastifyPlugin(dbConnector);
