-- Audit table for transaction inquiry/history
USE [db_gwen_v2];
GO

IF OBJECT_ID('dbo.pos_transactions_central_audit', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_transactions_central_audit (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    central_trx_code VARCHAR(100) NOT NULL,
    audit_status VARCHAR(20) NOT NULL,
    audit_note NVARCHAR(1000) NULL,
    audited_by VARCHAR(100) NULL,
    audited_at DATETIME NOT NULL CONSTRAINT DF_pos_transactions_central_audit_audited_at DEFAULT (GETDATE()),
    source_trx_code NVARCHAR(200) NULL,
    device_code NVARCHAR(400) NULL,
    cashier_name NVARCHAR(800) NULL,
    source_page NVARCHAR(100) NULL
  );

  CREATE NONCLUSTERED INDEX IX_pos_transactions_central_audit_trx
    ON dbo.pos_transactions_central_audit (central_trx_code);
END;
ELSE
BEGIN
  IF COL_LENGTH('dbo.pos_transactions_central_audit', 'source_page') IS NULL
  BEGIN
    ALTER TABLE dbo.pos_transactions_central_audit
      ADD source_page NVARCHAR(100) NULL;
  END;
END;
GO
