IF OBJECT_ID('dbo.GWEN_m_barcode_manual', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.GWEN_m_barcode_manual (
    id_barcode_manual INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    barcode VARCHAR(100) NOT NULL,
    nama_item NVARCHAR(255) NOT NULL,
    status INT NOT NULL DEFAULT 1,
    created_by VARCHAR(100) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by VARCHAR(100) NULL,
    updated_at DATETIME2 NULL
  );

  CREATE UNIQUE INDEX UQ_GWEN_m_barcode_manual_barcode
    ON dbo.GWEN_m_barcode_manual (barcode);
END
