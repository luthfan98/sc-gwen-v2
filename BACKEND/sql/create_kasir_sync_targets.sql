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

IF NOT EXISTS (SELECT 1 FROM dbo.GWEN_m_kasir_sync_target WHERE database_name = 'db_gwen_kasir1')
BEGIN
  INSERT INTO dbo.GWEN_m_kasir_sync_target (label, server, database_name, db_user, db_password, is_active, sort_order)
  VALUES ('Kasir 1', 'gwenkasir1\SQLEXPRESS', 'db_gwen_kasir1', 'sa', 'resmi12', 1, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.GWEN_m_kasir_sync_target WHERE database_name = 'db_gwen_kasir2')
BEGIN
  INSERT INTO dbo.GWEN_m_kasir_sync_target (label, server, database_name, db_user, db_password, is_active, sort_order)
  VALUES ('Kasir 2', 'gwenkasir2\SQLEXPRESS', 'db_gwen_kasir2', 'sa', 'resmi12', 1, 2);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.GWEN_m_kasir_sync_target WHERE database_name = 'db_gwen_kasir3')
BEGIN
  INSERT INTO dbo.GWEN_m_kasir_sync_target (label, server, database_name, db_user, db_password, is_active, sort_order)
  VALUES ('Kasir 3', 'gwenkasir3', 'db_gwen_kasir3', 'sa', 'resmi12', 1, 3);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.GWEN_m_kasir_sync_target WHERE database_name = 'db_gwen_kasir4')
BEGIN
  INSERT INTO dbo.GWEN_m_kasir_sync_target (label, server, database_name, db_user, db_password, is_active, sort_order)
  VALUES ('Kasir 4', 'gwenkasir4\SQLEXPRESS', 'db_gwen_kasir4', 'sa', 'resmi12', 0, 4);
END;
