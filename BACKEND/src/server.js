import fs from "node:fs";
import path from "node:path";
import { buildApp } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import "./utils/wib-time.js";

const readIfExists = (maybePath) => {
  if (!maybePath) return null;
  const resolved = path.resolve(maybePath);
  if (!fs.existsSync(resolved)) return null;
  return fs.readFileSync(resolved);
};

async function startHttp() {
  const app = buildApp();
  await app.listen({ port: config.port, host: config.host });
  logger.info(`HTTP server listening on http://${config.host}:${config.port}`);
  return app;
}

async function startHttps() {
  const key = readIfExists(config.ssl.keyPath);
  const cert = readIfExists(config.ssl.certPath);
  if (!key || !cert) {
    logger.info("HTTPS disabled: SSL key/cert not found, continuing with HTTP only");
    return null;
  }

  const app = buildApp({
    https: {
      key,
      cert
    }
  });

  await app.listen({ port: config.httpsPort, host: config.host });
  logger.info(`HTTPS server listening on https://${config.host}:${config.httpsPort}`);
  return app;
}

async function bootstrap() {
  try {
    await Promise.all([startHttp(), startHttps()]);
  } catch (err) {
    logger.error({ err }, "Failed to start servers");
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled rejection");
});

bootstrap();
