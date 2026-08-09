import crypto from "node:crypto";

const hashPassword = (password) => {
  const iterations = 100000;
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512");
  return {
    password_hash: hash.toString("base64"),
    password_salt: salt.toString("base64"),
    password_iterations: iterations,
    password_algo: "pbkdf2_sha512",
  };
};

export default async function userRoutes(fastify) {
  const { sql, pool } = fastify.mssql;
  const kasirTargets = [
    { server: "gwenkasir1\\SQLEXPRESS", database: "db_gwen_kasir1" },
    { server: "gwenkasir2\\SQLEXPRESS", database: "db_gwen_kasir2" },
    { server: "gwenkasir3\\SQLEXPRESS", database: "db_gwen_kasir3" },
    { server: "gwenkasir4\\SQLEXPRESS", database: "db_gwen_kasir4" },
  ];

  const createKasirPool = (target) =>
    new sql.ConnectionPool({
      server: target.server,
      user: "sa",
      password: "resmi12",
      database: target.database,
      requestTimeout: 60000,
      connectionTimeout: 30000,
      pool: {
        max: 2,
        min: 0,
        idleTimeoutMillis: 30000,
      },
      options: {
        encrypt: false,
        trustServerCertificate: true,
        useUTC: true,
      },
    });

  const syncUserToKasir = async (userId) => {
    const userRes = await pool
      .request()
      .input("id", sql.Int, userId)
      .query(`
        SELECT TOP 1
          u.id,
          u.username,
          u.password_hash,
          u.password_salt,
          u.password_iterations,
          u.password_algo,
          u.name,
          u.email,
          u.role_id,
          u.is_active,
          u.last_login_at,
          r.name AS role_name
        FROM dbo.users u
        LEFT JOIN dbo.roles r ON r.id = u.role_id
        WHERE u.id = @id;
      `);

    const sourceUser = userRes.recordset?.[0];
    if (!sourceUser) {
      const error = new Error("User tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const roleName = String(sourceUser.role_name || "").trim();
    const results = [];

    for (const target of kasirTargets) {
      const targetPool = createKasirPool(target);
      try {
        await targetPool.connect();

        const targetRoleRes = await targetPool
          .request()
          .input("role_id", sql.Int, Number(sourceUser.role_id))
          .input("role_name", sql.NVarChar(100), roleName || null)
          .query(`
            SELECT TOP 1 id
            FROM dbo.roles
            WHERE id = @role_id
               OR (@role_name IS NOT NULL AND LTRIM(RTRIM(name)) = LTRIM(RTRIM(@role_name)))
            ORDER BY CASE WHEN id = @role_id THEN 0 ELSE 1 END, id;
          `);

        const targetRoleId = Number(targetRoleRes.recordset?.[0]?.id || 0);
        if (!targetRoleId) {
          throw new Error(`Role "${roleName || sourceUser.role_id}" tidak ditemukan`);
        }

        const req = targetPool.request();
        req.input("id", sql.BigInt, Number(sourceUser.id));
        req.input("username", sql.NVarChar(255), sourceUser.username);
        req.input("password_hash", sql.NVarChar(sql.MAX), sourceUser.password_hash);
        req.input("password_salt", sql.NVarChar(sql.MAX), sourceUser.password_salt);
        req.input("password_iterations", sql.BigInt, Number(sourceUser.password_iterations));
        req.input("password_algo", sql.NVarChar(50), sourceUser.password_algo);
        req.input("name", sql.NVarChar(sql.MAX), sourceUser.name || null);
        req.input("email", sql.NVarChar(sql.MAX), sourceUser.email || null);
        req.input("role_id", sql.BigInt, targetRoleId);
        req.input("is_active", sql.BigInt, Number(sourceUser.is_active) ? 1 : 0);
        req.input("last_login_at", sql.NVarChar(sql.MAX), sourceUser.last_login_at || null);

        await req.query(`
          MERGE dbo.users AS target
          USING (SELECT @username AS username) AS source
            ON LTRIM(RTRIM(target.username)) = LTRIM(RTRIM(source.username))
          WHEN MATCHED THEN
            UPDATE SET
              target.password_hash = @password_hash,
              target.password_salt = @password_salt,
              target.password_iterations = @password_iterations,
              target.password_algo = @password_algo,
              target.name = @name,
              target.email = @email,
              target.role_id = @role_id,
              target.is_active = @is_active,
              target.last_login_at = @last_login_at,
              target.updated_at = CONVERT(nvarchar(50), SYSDATETIME(), 120)
          WHEN NOT MATCHED THEN
            INSERT (
              id, username, password_hash, password_salt, password_iterations, password_algo,
              name, email, role_id, is_active, last_login_at, created_at, updated_at
            )
            VALUES (
              @id, @username, @password_hash, @password_salt, @password_iterations, @password_algo,
              @name, @email, @role_id, @is_active, @last_login_at, CONVERT(nvarchar(50), SYSDATETIME(), 120), CONVERT(nvarchar(50), SYSDATETIME(), 120)
            );
        `);

        results.push({
          server: target.server,
          database: target.database,
          ok: true,
        });
      } catch (err) {
        results.push({
          server: target.server,
          database: target.database,
          ok: false,
          error: err?.originalError?.info?.message || err?.message || "Gagal sync user",
        });
      } finally {
        await targetPool.close().catch(() => {});
      }
    }

    return {
      user: {
        id: sourceUser.id,
        username: sourceUser.username,
        name: sourceUser.name,
        role_name: sourceUser.role_name,
      },
      results,
    };
  };

  fastify.get("/roles", async (_request, reply) => {
    try {
      const res = await pool.request().query(`
        SELECT id, name, description
        FROM dbo.roles
        WHERE is_active = 1
        ORDER BY name;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch roles");
      return reply.code(500).send({ message: "Gagal memuat role" });
    }
  });

  fastify.get("/", async (_request, reply) => {
    try {
      const res = await pool.request().query(`
        SELECT
          u.id,
          u.username,
          u.name,
          u.email,
          u.role_id,
          r.name AS role_name,
          u.is_active,
          u.last_login_at,
          u.created_at,
          u.updated_at
        FROM dbo.users u
        LEFT JOIN dbo.roles r ON r.id = u.role_id
        ORDER BY u.name, u.username;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch users");
      return reply.code(500).send({ message: "Gagal memuat users" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const username = String(body.username || "").trim();
    const name = String(body.name || "").trim();
    const email = body.email ? String(body.email || "").trim() : null;
    const roleId = Number(body.role_id || 0) || null;
    const password = String(body.password || "");
    const isActive = body.is_active === undefined ? true : body.is_active === true || body.is_active === 1;

    if (!username || !name || !password || !roleId) {
      return reply.code(400).send({ message: "username, name, password, role wajib diisi" });
    }
    if (password.length < 6) {
      return reply.code(400).send({ message: "Password minimal 6 karakter" });
    }

    try {
      const roleRes = await pool
        .request()
        .input("role_id", sql.Int, roleId)
        .query(`
          SELECT TOP 1 id
          FROM dbo.roles
          WHERE id = @role_id AND is_active = 1;
        `);
      if (!roleRes.recordset?.length) {
        return reply.code(400).send({ message: "Role tidak ditemukan atau tidak aktif" });
      }

      const existsRes = await pool
        .request()
        .input("username", sql.NVarChar(50), username)
        .input("email", sql.NVarChar(100), email)
        .query(`
          SELECT TOP 1 id
          FROM dbo.users
          WHERE username = @username
             OR (@email IS NOT NULL AND email = @email);
        `);
      if (existsRes.recordset?.length) {
        return reply.code(409).send({ message: "Username atau email sudah digunakan" });
      }

      const hashed = hashPassword(password);
      await pool
        .request()
        .input("username", sql.NVarChar(50), username)
        .input("name", sql.NVarChar(100), name)
        .input("email", sql.NVarChar(100), email)
        .input("role_id", sql.Int, roleId)
        .input("password_hash", sql.NVarChar(255), hashed.password_hash)
        .input("password_salt", sql.NVarChar(255), hashed.password_salt)
        .input("password_iterations", sql.Int, hashed.password_iterations)
        .input("password_algo", sql.NVarChar(50), hashed.password_algo)
        .input("is_active", sql.Bit, isActive ? 1 : 0)
        .query(`
          INSERT INTO dbo.users (
            username, name, email, role_id,
            password_hash, password_salt, password_iterations, password_algo,
            is_active, created_at, updated_at
          )
          VALUES (
            @username, @name, @email, @role_id,
            @password_hash, @password_salt, @password_iterations, @password_algo,
            @is_active, SYSDATETIME(), SYSDATETIME()
          );
        `);

      return reply.code(201).send({ message: "User berhasil ditambahkan" });
    } catch (err) {
      fastify.log.error({ err }, "Failed to create user");
      return reply.code(500).send({ message: "Gagal menambah user" });
    }
  });

  fastify.put("/:id/status", async (request, reply) => {
    const id = Number(request.params?.id || 0);
    const body = request.body || {};
    const isActive = body.is_active === true || body.is_active === 1;
    if (!id) {
      return reply.code(400).send({ message: "id user wajib" });
    }

    try {
      await pool
        .request()
        .input("id", sql.Int, id)
        .input("is_active", sql.Bit, isActive ? 1 : 0)
        .query("UPDATE dbo.users SET is_active = @is_active, updated_at = SYSDATETIME() WHERE id = @id");
      return reply.send({ message: "Status user diperbarui" });
    } catch (err) {
      fastify.log.error({ err }, "Failed to update user status");
      return reply.code(500).send({ message: "Gagal update status user" });
    }
  });

  fastify.post("/:id/password", async (request, reply) => {
    const id = Number(request.params?.id || 0);
    const body = request.body || {};
    const password = String(body.password || "");
    if (!id || !password) {
      return reply.code(400).send({ message: "id dan password wajib diisi" });
    }
    if (password.length < 6) {
      return reply.code(400).send({ message: "Password minimal 6 karakter" });
    }

    const hashed = hashPassword(password);
    try {
      await pool
        .request()
        .input("id", sql.Int, id)
        .input("password_hash", sql.NVarChar(sql.MAX), hashed.password_hash)
        .input("password_salt", sql.NVarChar(200), hashed.password_salt)
        .input("password_iterations", sql.Int, hashed.password_iterations)
        .input("password_algo", sql.NVarChar(50), hashed.password_algo)
        .query(`
          UPDATE dbo.users
          SET password_hash = @password_hash,
              password_salt = @password_salt,
              password_iterations = @password_iterations,
              password_algo = @password_algo,
              updated_at = SYSDATETIME()
          WHERE id = @id;
        `);
      return reply.send({ message: "Password berhasil direset" });
    } catch (err) {
      fastify.log.error({ err }, "Failed to reset password");
      return reply.code(500).send({ message: "Gagal reset password" });
    }
  });

  fastify.put("/:id/role", async (request, reply) => {
    const id = Number(request.params?.id || 0);
    const body = request.body || {};
    const roleId = Number(body.role_id || 0) || null;
    if (!id || !roleId) {
      return reply.code(400).send({ message: "id dan role wajib diisi" });
    }

    try {
      const roleRes = await pool
        .request()
        .input("role_id", sql.Int, roleId)
        .query(`
          SELECT TOP 1 id
          FROM dbo.roles
          WHERE id = @role_id AND is_active = 1;
        `);
      if (!roleRes.recordset?.length) {
        return reply.code(400).send({ message: "Role tidak ditemukan atau tidak aktif" });
      }

      await pool
        .request()
        .input("id", sql.Int, id)
        .input("role_id", sql.Int, roleId)
        .query(`
          UPDATE dbo.users
          SET role_id = @role_id,
              updated_at = SYSDATETIME()
          WHERE id = @id;
        `);
      return reply.send({ message: "Role user diperbarui" });
    } catch (err) {
      fastify.log.error({ err }, "Failed to update user role");
      return reply.code(500).send({ message: "Gagal update role user" });
    }
  });

  fastify.post("/:id/sync-to-kasir", async (request, reply) => {
    const id = Number(request.params?.id || 0);
    if (!id) {
      return reply.code(400).send({ message: "id user wajib" });
    }

    try {
      const result = await syncUserToKasir(id);
      const hasFailure = result.results.some((row) => !row.ok);
      return reply.code(hasFailure ? 207 : 200).send(result);
    } catch (err) {
      fastify.log.error({ err }, "Failed sync user to kasir");
      return reply.code(err.statusCode || 500).send({ message: err.message || "Gagal sync user ke kasir" });
    }
  });
}
