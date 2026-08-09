import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const rootDir = process.cwd();

export const config = {
  env: process.env.NODE_ENV || "development",
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT) || 3500,
  httpsPort: Number(process.env.HTTPS_PORT) || 3443,
  ssl: {
    keyPath: process.env.SSL_KEY_PATH,
    certPath: process.env.SSL_CERT_PATH
  },
  db: {
    server: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 1433,
    database: process.env.DB_NAME || "db_gwen_v2",
    user: process.env.DB_USER || "sa",
    password: process.env.DB_PASSWORD || "resmi12",
    requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT) || 60000,
    connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT) || 30000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    options: {
      encrypt: false, // adjust if your SQL Server requires encryption
      trustServerCertificate: true,
      useUTC: true
    }
  },
  uploads: {
    // simpan ke folder public frontend supaya bisa langsung diakses oleh Next.js
    dir: path.resolve(rootDir, process.env.UPLOAD_DIR || "../public/uploads/master_barang"),
    maxFileSize: 50 * 1024 * 1024, // 50MB
    minFileSize: Number(process.env.MIN_UPLOAD_FILE_SIZE) || 20 * 1024, // 20KB
    minWidth: Number(process.env.MIN_UPLOAD_WIDTH ?? 400) || 400,
    minHeight: Number(process.env.MIN_UPLOAD_HEIGHT ?? 0) || 0, // 0 = tidak divalidasi
    allowedTypes: ["image/", "video/"]
  }
};
