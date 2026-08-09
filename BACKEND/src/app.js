import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import dbConnector from "./plugins/db.js";
import routes from "./routes/index.js";

export function buildApp(options = {}) {
  const app = Fastify({
    logger,
    ...options
  });

  app.register(helmet, { global: true });
  app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  });

  app.register(multipart, {
    limits: {
      fileSize: config.uploads.maxFileSize
    }
  });

  app.register(fastifyStatic, {
    root: path.resolve(config.uploads.dir),
    prefix: "/uploads/",
    decorateReply: false
  });

  app.register(dbConnector);
  app.register(routes, { prefix: "/api" });

  return app;
}
