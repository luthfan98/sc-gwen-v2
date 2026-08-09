import crypto from "node:crypto";

const verifyPassword = ({ password, salt, hash, iterations, algo }) => {
  if (!password || !salt || !hash || !iterations || !algo) return false;
  if (algo !== "pbkdf2_sha512") return false;
  const derived = crypto.pbkdf2Sync(password, Buffer.from(salt, "base64"), iterations, 64, "sha512");
  const hashBuf = Buffer.from(hash, "base64");
  if (hashBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(hashBuf, derived);
};

export default async function authRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  fastify.post("/login", async (request, reply) => {
    const body = request.body || {};
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!username || !password) {
      return reply.code(400).send({ message: "username dan password wajib diisi" });
    }

    try {
      const res = await pool
        .request()
        .input("username", sql.NVarChar(50), username)
        .query(`
          SELECT TOP 1
            u.id,
            u.username,
            u.name,
            u.email,
            u.password_hash,
            u.password_salt,
            u.password_iterations,
            u.password_algo,
            u.is_active,
            r.id AS role_id,
            r.name AS role_name,
            r.allowed_menus
          FROM dbo.users u
          LEFT JOIN dbo.roles r ON r.id = u.role_id
          WHERE u.username = @username OR u.email = @username;
        `);

      const user = res.recordset?.[0];
      if (!user || !user.is_active) {
        return reply.code(401).send({ message: "Username atau password salah" });
      }

      const ok = verifyPassword({
        password,
        salt: user.password_salt,
        hash: user.password_hash,
        iterations: Number(user.password_iterations),
        algo: user.password_algo,
      });
      if (!ok) {
        return reply.code(401).send({ message: "Username atau password salah" });
      }

      await pool
        .request()
        .input("id", sql.Int, user.id)
        .query("UPDATE dbo.users SET last_login_at = SYSDATETIME(), updated_at = SYSDATETIME() WHERE id = @id");

      let allowedMenus = [];
      if (user.allowed_menus) {
        try {
          const parsed = JSON.parse(user.allowed_menus);
          if (Array.isArray(parsed)) allowedMenus = parsed;
        } catch {
          // ignore invalid JSON
        }
      }

      return reply.send({
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
        },
        role: {
          id: user.role_id,
          name: user.role_name,
          allowedMenus,
        },
      });
    } catch (err) {
      request.log.error({ err }, "Failed login");
      return reply.code(500).send({ message: "Gagal login" });
    }
  });
}
