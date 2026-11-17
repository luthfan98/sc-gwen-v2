import { config } from "../src/config/index.js";
import sql from "mssql";

export async function syncHistoricalKontrabonDeposit(pool) {
  const shouldClose = !pool;
  const dbPool = pool || (await sql.connect(config.db));

  try {
    console.log("Checking historical kontrabons for deposit retur claims...");
    const kontrabons = await dbPool.request().query(`
      SELECT
        k.no_kontrabon,
        k.kode_supplier,
        COALESCE(s.nama COLLATE DATABASE_DEFAULT, k.kode_supplier COLLATE DATABASE_DEFAULT) AS nama_supplier,
        k.tgl_kontrabon,
        k.biaya_lain,
        k.created_by
      FROM dbo.GWEN_t_kontrabon k
      LEFT JOIN dbo.m_supplier s
        ON s.kode_supplier COLLATE DATABASE_DEFAULT = k.kode_supplier COLLATE DATABASE_DEFAULT
      WHERE k.biaya_lain IS NOT NULL AND (k.biaya_lain LIKE '%RTS.%' OR k.biaya_lain LIKE '%DEPOSIT RETUR%')
      ORDER BY k.tgl_kontrabon ASC, k.no_kontrabon ASC;
    `);

    let processedCount = 0;

    for (const k of kontrabons.recordset || []) {
      let items = [];
      try {
        items = typeof k.biaya_lain === "string" ? JSON.parse(k.biaya_lain) : k.biaya_lain;
      } catch {
        continue;
      }
      if (!Array.isArray(items)) continue;

      let mutasiIdx = 0;
      for (const item of items) {
        const nominal = Number(item?.nominal || 0);
        if (nominal <= 0) continue;

        const isDeposit = item?.tipe === "DEPOSIT RETUR" || String(item?.keterangan || "").toUpperCase().includes("RETUR");
        if (!isDeposit) continue;

        mutasiIdx += 1;
        const rtsMatch = String(item?.keterangan || "").match(/RTS\.[A-Za-z0-9]+/)?.[0];
        const noRetur = item?.no_retur || rtsMatch || null;

        const tx = new sql.Transaction(dbPool);
        await tx.begin();

        try {
          const kodeMutasi = `MUT.DEP.OUT.${k.no_kontrabon}.${mutasiIdx}`;

          // Check if already in ledger
          const checkRes = await new sql.Request(tx)
            .input("kode_mutasi", sql.VarChar(100), kodeMutasi)
            .query(`
              SELECT TOP 1 id_ledger
              FROM dbo.GWEN_t_supplier_deposit_ledger
              WHERE kode_mutasi = @kode_mutasi;
            `);

          if (checkRes.recordset?.length > 0) {
            await tx.rollback();
            continue;
          }

          // Lock supplier deposit
          const suppRes = await new sql.Request(tx)
            .input("kode_supplier", sql.VarChar(255), k.kode_supplier)
            .query(`
              SELECT saldo_deposit
              FROM dbo.GWEN_m_supplier_deposit WITH (UPDLOCK, ROWLOCK)
              WHERE kode_supplier = @kode_supplier;
            `);

          const saldoAwal = Number(suppRes.recordset?.[0]?.saldo_deposit || 0);
          const saldoAkhir = saldoAwal - nominal;

          await new sql.Request(tx)
            .input("kode_mutasi", sql.VarChar(100), kodeMutasi)
            .input("tgl_mutasi", sql.DateTime, k.tgl_kontrabon ? new Date(k.tgl_kontrabon) : new Date())
            .input("kode_supplier", sql.VarChar(255), k.kode_supplier)
            .input("nama_supplier", sql.NVarChar(255), k.nama_supplier)
            .input("tipe_mutasi", sql.VarChar(50), "KELUAR")
            .input("kode_ref", sql.VarChar(255), noRetur || k.no_kontrabon)
            .input("saldo_awal", sql.Decimal(20, 2), saldoAwal)
            .input("nominal", sql.Decimal(20, 2), nominal)
            .input("saldo_akhir", sql.Decimal(20, 2), saldoAkhir)
            .input("keterangan", sql.NVarChar(500), `Klaim Retur ${noRetur ? `${noRetur} ` : ""}pada Kontrabon ${k.no_kontrabon}`)
            .input("created_by", sql.VarChar(255), k.created_by || "System")
            .input("created_at", sql.DateTime, new Date())
            .query(`
              INSERT INTO dbo.GWEN_t_supplier_deposit_ledger (
                kode_mutasi, tgl_mutasi, kode_supplier, nama_supplier, tipe_mutasi, kode_ref,
                saldo_awal, nominal, saldo_akhir, keterangan, created_by, created_at
              ) VALUES (
                @kode_mutasi, @tgl_mutasi, @kode_supplier, @nama_supplier, @tipe_mutasi, @kode_ref,
                @saldo_awal, @nominal, @saldo_akhir, @keterangan, @created_by, @created_at
              );
            `);

          await new sql.Request(tx)
            .input("kode_supplier", sql.VarChar(255), k.kode_supplier)
            .input("saldo_deposit", sql.Decimal(20, 2), saldoAkhir)
            .input("updated_by", sql.VarChar(255), "Backfill-Kontrabon")
            .query(`
              UPDATE dbo.GWEN_m_supplier_deposit
              SET saldo_deposit = @saldo_deposit,
                  updated_at = GETDATE(),
                  updated_by = @updated_by
              WHERE kode_supplier = @kode_supplier;
            `);

          await tx.commit();
          processedCount += 1;
          console.log(`Recorded KELUAR for ${k.no_kontrabon}: Rp ${nominal} (${noRetur})`);
        } catch (err) {
          await tx.rollback().catch(() => {});
          console.error(`Error processing kontrabon ${k.no_kontrabon}:`, err);
        }
      }
    }

    console.log(`Sync finished: ${processedCount} mutasi KELUAR recorded.`);
    return { processedCount };
  } finally {
    if (shouldClose) await dbPool.close();
  }
}

if (process.argv[1]?.endsWith("sync-kontrabon-deposit.js")) {
  syncHistoricalKontrabonDeposit(null)
    .then((r) => {
      console.log("Done:", r);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed:", err);
      process.exit(1);
    });
}

