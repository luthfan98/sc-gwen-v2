const fs = require("fs");
const https = require("https");
const path = require("path");
const next = require("next");

const rootDir = __dirname;
const hostname = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const pfxPath = process.env.HTTPS_PFX || "";
const pfxPassphrase = process.env.HTTPS_PFX_PASSPHRASE || "";
const certPath = process.env.HTTPS_CERT || path.join(rootDir, "certificates", "localhost.pem");
const keyPath = process.env.HTTPS_KEY || path.join(rootDir, "certificates", "localhost-key.pem");

function readCertificate(filePath, label) {
  try {
    return fs.readFileSync(filePath);
  } catch (err) {
    console.error(`Unable to read ${label} at ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

const app = next({ dev: false, dir: rootDir, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const tlsOptions = pfxPath
    ? {
        pfx: readCertificate(pfxPath, "HTTPS PFX certificate"),
        passphrase: pfxPassphrase,
      }
    : {
        cert: readCertificate(certPath, "HTTPS certificate"),
        key: readCertificate(keyPath, "HTTPS key"),
      };

  const server = https.createServer(tlsOptions, (req, res) => handle(req, res));

  server.listen(port, hostname, () => {
    console.log(`HTTPS server listening on https://${hostname}:${port}`);
  });
});
