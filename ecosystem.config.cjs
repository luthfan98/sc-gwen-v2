const fs = require("fs");
const path = require("path");

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
        return [key, value];
      })
  );
};

const backendEnv = loadEnvFile(path.join(__dirname, "BACKEND", ".env"));

module.exports = {
  apps: [
    {
      name: "kosmetik-backend",
      cwd: "C:/Users/SERVER GWEN/Downloads/kosmetik-store/kosmetik-store/BACKEND",
      script: "src/server.js",
      interpreter: "node",
      node_args: "--no-deprecation",
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: "3500",
        HTTPS_PORT: "3443",
        WEB_BASE_URL: "https://server-home-gwen:3000",
        IMAGE_STORAGE_ENDPOINT: process.env.IMAGE_STORAGE_ENDPOINT || backendEnv.IMAGE_STORAGE_ENDPOINT || "https://image.gwencosmetic.com",
        IMAGE_STORAGE_PUBLIC_URL: process.env.IMAGE_STORAGE_PUBLIC_URL || backendEnv.IMAGE_STORAGE_PUBLIC_URL || "https://image.gwencosmetic.com",
        IMAGE_STORAGE_BUCKET: process.env.IMAGE_STORAGE_BUCKET || backendEnv.IMAGE_STORAGE_BUCKET || "promo-images",
        IMAGE_STORAGE_REGION: process.env.IMAGE_STORAGE_REGION || backendEnv.IMAGE_STORAGE_REGION || "us-east-1",
        IMAGE_STORAGE_ACCESS_KEY: process.env.IMAGE_STORAGE_ACCESS_KEY || backendEnv.IMAGE_STORAGE_ACCESS_KEY,
        IMAGE_STORAGE_SECRET_KEY: process.env.IMAGE_STORAGE_SECRET_KEY || backendEnv.IMAGE_STORAGE_SECRET_KEY,
      },
    },
    {
      name: "kosmetik-frontend",
      cwd: "C:/Users/SERVER GWEN/Downloads/kosmetik-store/kosmetik-store",
      script: "server-https.cjs",
      interpreter: "node",
      node_args: "--no-deprecation",
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: "3000",
        HTTPS_PFX: "C:/Users/SERVER GWEN/Downloads/kosmetik-store/kosmetik-store/certificates/server-home-gwen.pfx",
        HTTPS_PFX_PASSPHRASE: "gwen-local-https",
        NEXT_PUBLIC_API_URL: "/api",
        BACKEND_API_URL: "http://localhost:3500/api",
      },
    },
  ],
};
