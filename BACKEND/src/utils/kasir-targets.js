const DEFAULT_KASIR_TARGETS = [
  { label: "Kasir 1", server: "gwenkasir1\\SQLEXPRESS", database_name: "db_gwen_kasir1", db_user: "sa", db_password: "resmi12", is_active: 1, sort_order: 1 },
  { label: "Kasir 2", server: "gwenkasir2\\SQLEXPRESS", database_name: "db_gwen_kasir2", db_user: "sa", db_password: "resmi12", is_active: 1, sort_order: 2 },
  { label: "Kasir 3", server: "gwenkasir3", database_name: "db_gwen_kasir3", db_user: "sa", db_password: "resmi12", is_active: 1, sort_order: 3 },
  { label: "Kasir 4", server: "gwenkasir4\\SQLEXPRESS", database_name: "db_gwen_kasir4", db_user: "sa", db_password: "resmi12", is_active: 0, sort_order: 4 },
];

export const ensureKasirTargetsTable = async ({ pool, sql }) => {
  await pool.request().query(`
    IF OBJECT_ID('dbo.GWEN_m_kasir_sync_target', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.GWEN_m_kasir_sync_target (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        label VARCHAR(100) NOT NULL,
        server VARCHAR(255) NOT NULL,
        database_name VARCHAR(255) NOT NULL,
        db_user VARCHAR(100) NOT NULL CONSTRAINT DF_GWEN_m_kasir_sync_target_db_user DEFAULT ('sa'),
        db_password VARCHAR(255) NOT NULL,
        is_active BIT NOT NULL CONSTRAINT DF_GWEN_m_kasir_sync_target_is_active DEFAULT (1),
        sort_order INT NOT NULL CONSTRAINT DF_GWEN_m_kasir_sync_target_sort_order DEFAULT (0),
        created_at DATETIME2 NOT NULL CONSTRAINT DF_GWEN_m_kasir_sync_target_created_at DEFAULT (SYSDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_GWEN_m_kasir_sync_target_updated_at DEFAULT (SYSDATETIME())
      );
      CREATE UNIQUE INDEX UX_GWEN_m_kasir_sync_target_database_name
        ON dbo.GWEN_m_kasir_sync_target(database_name);
    END;
  `);

  for (const target of DEFAULT_KASIR_TARGETS) {
    await pool
      .request()
      .input("label", sql.VarChar(100), target.label)
      .input("server", sql.VarChar(255), target.server)
      .input("database_name", sql.VarChar(255), target.database_name)
      .input("db_user", sql.VarChar(100), target.db_user)
      .input("db_password", sql.VarChar(255), target.db_password)
      .input("is_active", sql.Bit, target.is_active)
      .input("sort_order", sql.Int, target.sort_order)
      .query(`
        IF NOT EXISTS (
          SELECT 1
          FROM dbo.GWEN_m_kasir_sync_target
          WHERE database_name = @database_name
        )
        BEGIN
          INSERT INTO dbo.GWEN_m_kasir_sync_target (
            label, server, database_name, db_user, db_password, is_active, sort_order
          ) VALUES (
            @label, @server, @database_name, @db_user, @db_password, @is_active, @sort_order
          );
        END;
      `);
  }
};

export const getKasirTargets = async ({ pool, sql, activeOnly = true }) => {
  await ensureKasirTargetsTable({ pool, sql });
  const res = await pool
    .request()
    .input("active_only", sql.Bit, activeOnly ? 1 : 0)
    .query(`
      SELECT id, label, server, database_name, db_user, db_password, is_active, sort_order, updated_at
      FROM dbo.GWEN_m_kasir_sync_target
      WHERE (@active_only = 0 OR is_active = 1)
      ORDER BY sort_order ASC, id ASC;
    `);
  return res.recordset || [];
};

export const createKasirPool = ({ sql, target, requestTimeout = 30000, connectionTimeout = 10000 }) =>
  new sql.ConnectionPool({
    server: target.server,
    user: target.db_user || "sa",
    password: target.db_password,
    database: target.database_name || target.database,
    requestTimeout,
    connectionTimeout,
    pool: {
      max: 1,
      min: 0,
      idleTimeoutMillis: Math.max(connectionTimeout, 10000),
    },
    options: {
      encrypt: false,
      trustServerCertificate: true,
      useUTC: true,
    },
  });

export const sanitizeKasirTarget = (target) => ({
  id: target.id,
  label: target.label,
  server: target.server,
  database: target.database_name || target.database,
  database_name: target.database_name || target.database,
  db_user: target.db_user || "sa",
  db_password_set: Boolean(target.db_password),
  is_active: Number(target.is_active) === 1,
  sort_order: Number(target.sort_order || 0),
  updated_at: target.updated_at,
});
