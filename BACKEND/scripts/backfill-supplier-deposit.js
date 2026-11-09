import { config } from "../src/config/index.js";
import sql from "mssql";

export async function runBackfill(pool) {
  const shouldClose = !pool;
  const dbPool = pool || (await sql.connect(config.db));

  try {
    console.log("Starting deposit backfill from dbo.GWEN_t_retur_supplier...");

    const returs = await dbPool.request().query(`
      SELECT
        r.kode_t_retur_supplier,
        r.tgl,
        r.kode_supplier,
        COALESCE(
          s.nama COLLATE DATABASE_DEFAULT,
          r.nama_supplier COLLATE DATABASE_DEFAULT,
          r.kode_supplier COLLATE DATABASE_DEFAULT
        ) AS nama_supplier,
        r.total_nominal,
        r.created_by,
        r.created_at
      FROM dbo.GWEN_t_retur_supplier r
      LEFT JOIN dbo.m_supplier s
        ON s.kode_supplier COLLATE DATABASE_DEFAULT = r.kode_supplier COLLATE DATABASE_DEFAULT
      WHERE ISNULL(r.total_nominal, 0) > 0
      ORDER BY r.created_at ASC, r.kode_t_retur_supplier ASC;
    `);

    console.log(`Found ${returs.recordset.length} retur records with nominal > 0.`);

    let insertedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < returs.recordset.length; i += 1) {
      const r = returs.recordset[i];
      const kodeSupplier = String(r.kode_supplier || "").trim();
      const namaSupplier = String(r.nama_supplier || "").trim();
      const nominal = Number(r.total_nominal || 0);
      const tglMutasi = r.tgl ? new Date(r.tgl) : r.created_at ? new Date(r.created_at) : new Date();

      if (!kodeSupplier || nominal <= 0) continue;

      const tx = new sql.Transaction(dbPool);
      await tx.begin();

      try {
        // Check if already in ledger
        const checkLedger = await new sql.Request(tx)
          .input("kode_ref", sql.VarChar(255), r.kode_t_retur_supplier)
          .query(`
            SELECT TOP 1 id_ledger
            FROM dbo.GWEN_t_supplier_deposit_ledger
            WHERE kode_ref = @kode_ref AND tipe_mutasi = 'MASUK';
          `);

        if (checkLedger.recordset?.length > 0) {
          await tx.rollback();
          skippedCount += 1;
          continue;
        }

        // Lock / get supplier master deposit
        const suppRes = await new sql.Request(tx)
          .input("kode_supplier", sql.VarChar(255), kodeSupplier)
          .query(`
            SELECT kode_supplier, saldo_deposit
            FROM dbo.GWEN_m_supplier_deposit WITH (UPDLOCK, ROWLOCK)
            WHERE kode_supplier = @kode_supplier;
          `);

        const saldoAwal = Number(suppRes.recordset?.[0]?.saldo_deposit || 0);
        const saldoAkhir = saldoAwal + nominal;
        const kodeMutasi = `MUT.DEP.BF.${String(i + 1).padStart(5, "0")}`;

        // Insert into ledger
        await new sql.Request(tx)
          .input("kode_mutasi", sql.VarChar(100), kodeMutasi)
          .input("tgl_mutasi", sql.DateTime, tglMutasi)
          .input("kode_supplier", sql.VarChar(255), kodeSupplier)
          .input("nama_supplier", sql.NVarChar(255), namaSupplier)
          .input("tipe_mutasi", sql.VarChar(50), "MASUK")
          .input("kode_ref", sql.VarChar(255), r.kode_t_retur_supplier)
          .input("saldo_awal", sql.Decimal(20, 2), saldoAwal)
          .input("nominal", sql.Decimal(20, 2), nominal)
          .input("saldo_akhir", sql.Decimal(20, 2), saldoAkhir)
          .input("keterangan", sql.NVarChar(500), `Backfill Retur Pembelian ${r.kode_t_retur_supplier}`)
          .input("created_by", sql.VarChar(255), r.created_by || "System")
          .input("created_at", sql.DateTime, r.created_at ? new Date(r.created_at) : new Date())
          .query(`
            INSERT INTO dbo.GWEN_t_supplier_deposit_ledger (
              kode_mutasi, tgl_mutasi, kode_supplier, nama_supplier, tipe_mutasi, kode_ref,
              saldo_awal, nominal, saldo_akhir, keterangan, created_by, created_at
            ) VALUES (
              @kode_mutasi, @tgl_mutasi, @kode_supplier, @nama_supplier, @tipe_mutasi, @kode_ref,
              @saldo_awal, @nominal, @saldo_akhir, @keterangan, @created_by, @created_at
            );
          `);

        // Upsert master deposit
        if (suppRes.recordset?.length > 0) {
          await new sql.Request(tx)
            .input("kode_supplier", sql.VarChar(255), kodeSupplier)
            .input("saldo_deposit", sql.Decimal(20, 2), saldoAkhir)
            .input("nama_supplier", sql.NVarChar(255), namaSupplier)
            .input("updated_by", sql.VarChar(255), "Backfill")
            .query(`
              UPDATE dbo.GWEN_m_supplier_deposit
              SET saldo_deposit = @saldo_deposit,
                  nama_supplier = @nama_supplier,
                  updated_at = GETDATE(),
                  updated_by = @updated_by
              WHERE kode_supplier = @kode_supplier;
            `);
        } else {
          await new sql.Request(tx)
            .input("kode_supplier", sql.VarChar(255), kodeSupplier)
            .input("nama_supplier", sql.NVarChar(255), namaSupplier)
            .input("saldo_deposit", sql.Decimal(20, 2), saldoAkhir)
            .input("updated_by", sql.VarChar(255), "Backfill")
            .query(`
              INSERT INTO dbo.GWEN_m_supplier_deposit (
                kode_supplier, nama_supplier, saldo_deposit, updated_at, updated_by
              ) VALUES (
                @kode_supplier, @nama_supplier, @saldo_deposit, GETDATE(), @updated_by
              );
            `);
        }

        await tx.commit();
        insertedCount += 1;
      } catch (err) {
        await tx.rollback();
        console.error(`Error backfilling retur ${r.kode_t_retur_supplier}:`, err);
      }
    }

    console.log(`Backfill finished: ${insertedCount} inserted, ${skippedCount} skipped.`);
    return { insertedCount, skippedCount, totalProcessed: returs.recordset.length };
  } finally {
    if (shouldClose) await dbPool.close();
  }
}

// Allow direct CLI execution
if (process.argv[1]?.endsWith("run_deposit_backfill.js")) {
  runBackfill(null)
    .then((res) => {
      console.log("Result:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}
