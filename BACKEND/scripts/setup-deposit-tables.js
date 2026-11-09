import { config } from "../src/config/index.js";
import sql from "mssql";

async function main() {
  const pool = await sql.connect(config.db);
  console.log("Connected to database:", config.db.database);

  console.log("Creating dbo.GWEN_m_supplier_deposit...");
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.GWEN_m_supplier_deposit', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.GWEN_m_supplier_deposit (
        kode_supplier VARCHAR(255) NOT NULL PRIMARY KEY,
        nama_supplier NVARCHAR(255) NULL,
        saldo_deposit DECIMAL(20, 2) NOT NULL CONSTRAINT DF_GWEN_m_supplier_deposit_saldo DEFAULT (0),
        updated_at DATETIME NOT NULL CONSTRAINT DF_GWEN_m_supplier_deposit_updated DEFAULT (GETDATE()),
        updated_by VARCHAR(255) NULL
      );
      PRINT 'Table dbo.GWEN_m_supplier_deposit created.';
    END;
  `);

  console.log("Creating dbo.GWEN_t_supplier_deposit_ledger...");
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.GWEN_t_supplier_deposit_ledger', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.GWEN_t_supplier_deposit_ledger (
        id_ledger BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        kode_mutasi VARCHAR(100) NOT NULL UNIQUE,
        tgl_mutasi DATETIME NOT NULL,
        kode_supplier VARCHAR(255) NOT NULL,
        nama_supplier NVARCHAR(255) NULL,
        tipe_mutasi VARCHAR(50) NOT NULL,
        kode_ref VARCHAR(255) NULL,
        saldo_awal DECIMAL(20, 2) NOT NULL DEFAULT (0),
        nominal DECIMAL(20, 2) NOT NULL,
        saldo_akhir DECIMAL(20, 2) NOT NULL DEFAULT (0),
        keterangan NVARCHAR(500) NULL,
        created_by VARCHAR(255) NULL,
        created_at DATETIME NOT NULL CONSTRAINT DF_GWEN_t_supplier_deposit_ledger_created DEFAULT (GETDATE())
      );

      CREATE INDEX IX_GWEN_t_supplier_deposit_ledger_supplier
        ON dbo.GWEN_t_supplier_deposit_ledger (kode_supplier, tgl_mutasi DESC, id_ledger DESC);

      PRINT 'Table dbo.GWEN_t_supplier_deposit_ledger created.';
    END;
  `);

  console.log("Creating dbo.GWEN_t_tagihan_pembayaran_history...");
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.GWEN_t_tagihan_pembayaran_history', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.GWEN_t_tagihan_pembayaran_history (
        id_pembayaran BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        kode_pembayaran VARCHAR(100) NOT NULL UNIQUE,
        kode_t_tagihan VARCHAR(255) NOT NULL,
        tgl_bayar DATETIME NOT NULL,
        nominal_bayar DECIMAL(20, 2) NOT NULL,
        sumber_pembayaran VARCHAR(50) NOT NULL,
        bank VARCHAR(255) NULL,
        no_referensi VARCHAR(255) NULL,
        catatan NVARCHAR(500) NULL,
        created_by VARCHAR(255) NULL,
        created_at DATETIME NOT NULL CONSTRAINT DF_GWEN_t_tagihan_pembayaran_history_created DEFAULT (GETDATE())
      );

      CREATE INDEX IX_GWEN_t_tagihan_pembayaran_tagihan
        ON dbo.GWEN_t_tagihan_pembayaran_history (kode_t_tagihan, tgl_bayar DESC);

      PRINT 'Table dbo.GWEN_t_tagihan_pembayaran_history created.';
    END;
  `);

  console.log("All tables checked/created successfully!");
  await pool.close();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});

