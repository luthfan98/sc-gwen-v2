module.exports = {
  apps: [
    {
      name: "kosmetik-backend",
      cwd: "C:/Users/SERVER GWEN/Downloads/kosmetik-store/kosmetik-store/BACKEND",
      script: "src/server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: "3500",
        HTTPS_PORT: "3443",
        WEB_BASE_URL: "https://server-home-gwen:3000",
      },
    },
    {
      name: "kosmetik-frontend",
      cwd: "C:/Users/SERVER GWEN/Downloads/kosmetik-store/kosmetik-store",
      script: "server-https.cjs",
      interpreter: "node",
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
