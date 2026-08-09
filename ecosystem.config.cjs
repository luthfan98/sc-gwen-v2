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
        WEB_BASE_URL: "http://localhost:3000",
      },
    },
    {
      name: "kosmetik-frontend",
      cwd: "C:/Users/SERVER GWEN/Downloads/kosmetik-store/kosmetik-store",
      script: "node_modules/next/dist/bin/next",
      interpreter: "node",
      args: "start --hostname 0.0.0.0 --port 3000",
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "/api",
        BACKEND_API_URL: "http://localhost:3500/api",
      },
    },
  ],
};
