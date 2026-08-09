IF NOT EXISTS (
  SELECT 1
  FROM sys.tables t
  JOIN sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.name = 'GWEN_h_harga_beli_barang' AND s.name = 'dbo'
)
BEGIN
  CREATE TABLE dbo.GWEN_h_harga_beli_barang (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    kode_h_harga_beli_barang VARCHAR(50) NOT NULL,
    kode_barang_variant VARCHAR(50) NOT NULL,
    kode_barang VARCHAR(100) NULL,
    harga_beli_sat_1 DECIMAL(20, 2) NOT NULL,
    sumber VARCHAR(50) NOT NULL,
    kode_t_pengadaan VARCHAR(255) NULL,
    kode_d_pengadaan VARCHAR(255) NULL,
    catatan VARCHAR(255) NULL,
    created_by VARCHAR(100) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );

  CREATE UNIQUE INDEX UX_GWEN_h_harga_beli_barang_kode
    ON dbo.GWEN_h_harga_beli_barang (kode_h_harga_beli_barang);

  CREATE INDEX IX_GWEN_h_harga_beli_barang_variant
    ON dbo.GWEN_h_harga_beli_barang (kode_barang_variant, created_at DESC);

  CREATE INDEX IX_GWEN_h_harga_beli_barang_kode_barang
    ON dbo.GWEN_h_harga_beli_barang (kode_barang);
END;

IF COL_LENGTH('dbo.GWEN_h_harga_beli_barang', 'kode_h_harga_beli_barang') IS NULL
BEGIN
  ALTER TABLE dbo.GWEN_h_harga_beli_barang
    ADD kode_h_harga_beli_barang VARCHAR(50) NULL;

  UPDATE dbo.GWEN_h_harga_beli_barang
  SET kode_h_harga_beli_barang = CONCAT('HBB.', RIGHT(CONVERT(VARCHAR(8), created_at, 112), 6), '.', id)
  WHERE kode_h_harga_beli_barang IS NULL;

  ALTER TABLE dbo.GWEN_h_harga_beli_barang
    ALTER COLUMN kode_h_harga_beli_barang VARCHAR(50) NOT NULL;

  CREATE UNIQUE INDEX UX_GWEN_h_harga_beli_barang_kode
    ON dbo.GWEN_h_harga_beli_barang (kode_h_harga_beli_barang);
END;
