IF OBJECT_ID(N'dbo.h_log_action', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.h_log_action (
    id_log BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    datetime_action DATETIME NOT NULL CONSTRAINT DF_h_log_action_datetime_action DEFAULT (GETDATE()),
    [action] VARCHAR(20) NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    key_column_name VARCHAR(255) NOT NULL,
    key_column_value VARCHAR(MAX) NULL
  );

  CREATE INDEX IX_h_log_action_datetime ON dbo.h_log_action (datetime_action DESC);
  CREATE INDEX IX_h_log_action_table_name ON dbo.h_log_action (table_name, datetime_action DESC);
END;
GO

