IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'm_toko' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.m_toko (
    kode_toko VARCHAR(50) NOT NULL,
    nama_toko NVARCHAR(150) NOT NULL,
    alamat NVARCHAR(255) NULL,
    kota NVARCHAR(100) NULL,
    provinsi NVARCHAR(100) NULL,
    kode_pos NVARCHAR(20) NULL,
    telp NVARCHAR(50) NULL,
    status BIT NOT NULL CONSTRAINT DF_m_toko_status DEFAULT (1),
    created_at DATETIME2 NOT NULL CONSTRAINT DF_m_toko_created_at DEFAULT (SYSDATETIME()),
    updated_at DATETIME2 NULL,
    CONSTRAINT PK_m_toko PRIMARY KEY (kode_toko)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'GWEN_mn_barang_toko_variant' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.GWEN_mn_barang_toko_variant (
    kode_barang_variant VARCHAR(50) NOT NULL,
    kode_toko VARCHAR(50) NOT NULL,
    stok_available DECIMAL(18, 4) NOT NULL CONSTRAINT DF_mn_barang_toko_variant_stok DEFAULT (0),
    buffer_min DECIMAL(18, 4) NOT NULL CONSTRAINT DF_mn_barang_toko_variant_buffer DEFAULT (0),
    status BIT NOT NULL CONSTRAINT DF_mn_barang_toko_variant_status DEFAULT (1),
    updated_at DATETIME2 NULL,
    CONSTRAINT PK_mn_barang_toko_variant PRIMARY KEY (kode_barang_variant, kode_toko),
    CONSTRAINT FK_mn_barang_toko_variant_toko
      FOREIGN KEY (kode_toko) REFERENCES dbo.m_toko (kode_toko)
  );

  CREATE INDEX IX_mn_barang_toko_variant_kode_barang_variant
    ON dbo.GWEN_mn_barang_toko_variant (kode_barang_variant);
END;
GO
