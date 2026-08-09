IF OBJECT_ID(N'dbo.GWEN_t_retur_supplier', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.GWEN_t_retur_supplier (
    kode_t_retur_supplier VARCHAR(255) NOT NULL PRIMARY KEY,
    kode_t_pengadaan VARCHAR(255) NULL,
    tgl DATETIME NOT NULL,
    kode_supplier VARCHAR(255) NOT NULL,
    nama_supplier NVARCHAR(255) NULL,
    kode_gudang VARCHAR(100) NULL,
    nama_gudang NVARCHAR(255) NULL,
    catatan NVARCHAR(500) NULL,
    status_retur VARCHAR(30) NOT NULL CONSTRAINT DF_GWEN_t_retur_supplier_status DEFAULT ('Draft'),
    total_item INT NOT NULL CONSTRAINT DF_GWEN_t_retur_supplier_total_item DEFAULT (0),
    total_qty DECIMAL(20, 2) NOT NULL CONSTRAINT DF_GWEN_t_retur_supplier_total_qty DEFAULT (0),
    total_nominal DECIMAL(20, 2) NOT NULL CONSTRAINT DF_GWEN_t_retur_supplier_total_nominal DEFAULT (0),
    created_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    updated_by VARCHAR(255) NULL,
    updated_at DATETIME NOT NULL
  );
END;
GO

IF OBJECT_ID(N'dbo.GWEN_d_retur_supplier', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.GWEN_d_retur_supplier (
    kode_d_retur_supplier VARCHAR(255) NOT NULL PRIMARY KEY,
    kode_t_retur_supplier VARCHAR(255) NOT NULL,
    kode_t_pengadaan VARCHAR(255) NULL,
    kode_d_pengadaan VARCHAR(255) NULL,
    kode_gudang VARCHAR(100) NULL,
    kode_barang_variant VARCHAR(255) NOT NULL,
    barcode_varian VARCHAR(255) NULL,
    nama_barang NVARCHAR(255) NULL,
    nama_varian NVARCHAR(255) NULL,
    qty DECIMAL(20, 2) NOT NULL,
    satuan VARCHAR(50) NOT NULL CONSTRAINT DF_GWEN_d_retur_supplier_satuan DEFAULT ('PCS'),
    harga_beli DECIMAL(20, 2) NOT NULL CONSTRAINT DF_GWEN_d_retur_supplier_harga DEFAULT (0),
    subtotal DECIMAL(20, 2) NOT NULL CONSTRAINT DF_GWEN_d_retur_supplier_subtotal DEFAULT (0),
    alasan_retur NVARCHAR(255) NULL,
    is_batal_retur BIT NOT NULL CONSTRAINT DF_GWEN_d_retur_supplier_is_batal DEFAULT (0),
    batal_retur_by VARCHAR(255) NULL,
    batal_retur_at DATETIME NULL,
    alasan_batal_retur NVARCHAR(255) NULL,
    created_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    updated_by VARCHAR(255) NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT FK_GWEN_d_retur_supplier_header
      FOREIGN KEY (kode_t_retur_supplier)
      REFERENCES dbo.GWEN_t_retur_supplier (kode_t_retur_supplier)
      ON DELETE CASCADE
  );
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_GWEN_t_retur_supplier_created_at'
    AND object_id = OBJECT_ID(N'dbo.GWEN_t_retur_supplier')
)
BEGIN
  CREATE INDEX IX_GWEN_t_retur_supplier_created_at
    ON dbo.GWEN_t_retur_supplier (created_at DESC, kode_t_retur_supplier DESC);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_GWEN_d_retur_supplier_header'
    AND object_id = OBJECT_ID(N'dbo.GWEN_d_retur_supplier')
)
BEGIN
  CREATE INDEX IX_GWEN_d_retur_supplier_header
    ON dbo.GWEN_d_retur_supplier (kode_t_retur_supplier, kode_barang_variant);
END;
GO

IF COL_LENGTH('dbo.GWEN_t_retur_supplier', 'kode_gudang') IS NULL
BEGIN
  ALTER TABLE dbo.GWEN_t_retur_supplier ADD kode_gudang VARCHAR(100) NULL;
END;
IF COL_LENGTH('dbo.GWEN_t_retur_supplier', 'nama_gudang') IS NULL
BEGIN
  ALTER TABLE dbo.GWEN_t_retur_supplier ADD nama_gudang NVARCHAR(255) NULL;
END;
IF COL_LENGTH('dbo.GWEN_d_retur_supplier', 'kode_gudang') IS NULL
BEGIN
  ALTER TABLE dbo.GWEN_d_retur_supplier ADD kode_gudang VARCHAR(100) NULL;
END;
IF COL_LENGTH('dbo.GWEN_d_retur_supplier', 'is_batal_retur') IS NULL
BEGIN
  ALTER TABLE dbo.GWEN_d_retur_supplier
    ADD is_batal_retur BIT NOT NULL CONSTRAINT DF_GWEN_d_retur_supplier_is_batal DEFAULT (0);
END;
IF COL_LENGTH('dbo.GWEN_d_retur_supplier', 'batal_retur_by') IS NULL
BEGIN
  ALTER TABLE dbo.GWEN_d_retur_supplier ADD batal_retur_by VARCHAR(255) NULL;
END;
IF COL_LENGTH('dbo.GWEN_d_retur_supplier', 'batal_retur_at') IS NULL
BEGIN
  ALTER TABLE dbo.GWEN_d_retur_supplier ADD batal_retur_at DATETIME NULL;
END;
IF COL_LENGTH('dbo.GWEN_d_retur_supplier', 'alasan_batal_retur') IS NULL
BEGIN
  ALTER TABLE dbo.GWEN_d_retur_supplier ADD alasan_batal_retur NVARCHAR(255) NULL;
END;
GO
