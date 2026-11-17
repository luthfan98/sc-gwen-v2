import sql from "mssql";

/**
 * Sync / record deposit mutasi KELUAR for a kontrabon.
 * Called inside kontrabon transaction.
 */
export async function syncKontrabonDepositMutasi(tx, {
  noKontrabon,
  kodeSupplier,
  namaSupplier,
  tglKontrabon,
  biayaLain,
  createdBy
}) {
  if (!noKontrabon || !kodeSupplier) return;

  // 1. Revert any existing KELUAR ledger rows for this kontrabon
  const existingLedger = await new sql.Request(tx)
    .input("no_kontrabon_prefix", sql.VarChar(100), `MUT.DEP.OUT.${noKontrabon}.%`)
    .input("no_kontrabon_ref", sql.VarChar(255), noKontrabon)
    .query(`
      SELECT id_ledger, kode_mutasi, nominal, kode_supplier
      FROM dbo.GWEN_t_supplier_deposit_ledger
      WHERE tipe_mutasi = 'KELUAR'
        AND (kode_mutasi LIKE @no_kontrabon_prefix OR kode_ref = @no_kontrabon_ref);
    `);

  if (existingLedger.recordset?.length > 0) {
    for (const oldRow of existingLedger.recordset) {
      // Refund saldo deposit
      await new sql.Request(tx)
        .input("kode_supplier", sql.VarChar(255), oldRow.kode_supplier)
        .input("nominal", sql.Decimal(20, 2), Number(oldRow.nominal || 0))
        .query(`
          UPDATE dbo.GWEN_m_supplier_deposit
          SET saldo_deposit = saldo_deposit + @nominal,
              updated_at = GETDATE()
          WHERE kode_supplier = @kode_supplier;
        `);

      // Delete old ledger row
      await new sql.Request(tx)
        .input("id_ledger", sql.BigInt, oldRow.id_ledger)
        .query(`
          DELETE FROM dbo.GWEN_t_supplier_deposit_ledger
          WHERE id_ledger = @id_ledger;
        `);
    }
  }

  // 2. Parse new biaya_lain for items with DEPOSIT RETUR
  const items = Array.isArray(biayaLain) ? biayaLain : [];
  let mutasiIdx = 0;

  for (const item of items) {
    const isDeposit = item?.tipe === "DEPOSIT RETUR";
    const nominal = Number(item?.nominal || 0);
    if (!isDeposit || nominal <= 0) continue;

    mutasiIdx += 1;
    const rtsMatch = String(item?.keterangan || "").match(/RTS\.[A-Za-z0-9]+/)?.[0];
    const noRetur = item?.no_retur || rtsMatch || null;

    // Get current balance with lock
    const suppRes = await new sql.Request(tx)
      .input("kode_supplier", sql.VarChar(255), kodeSupplier)
      .query(`
        SELECT saldo_deposit
        FROM dbo.GWEN_m_supplier_deposit WITH (UPDLOCK, ROWLOCK)
        WHERE kode_supplier = @kode_supplier;
      `);

    const saldoAwal = Number(suppRes.recordset?.[0]?.saldo_deposit || 0);
    const saldoAkhir = saldoAwal - nominal;
    const kodeMutasi = `MUT.DEP.OUT.${noKontrabon}.${mutasiIdx}`;

    // Insert KELUAR into ledger
    await new sql.Request(tx)
      .input("kode_mutasi", sql.VarChar(100), kodeMutasi)
      .input("tgl_mutasi", sql.DateTime, tglKontrabon ? new Date(tglKontrabon) : new Date())
      .input("kode_supplier", sql.VarChar(255), kodeSupplier)
      .input("nama_supplier", sql.NVarChar(255), namaSupplier || kodeSupplier)
      .input("tipe_mutasi", sql.VarChar(50), "KELUAR")
      .input("kode_ref", sql.VarChar(255), noRetur || noKontrabon)
      .input("saldo_awal", sql.Decimal(20, 2), saldoAwal)
      .input("nominal", sql.Decimal(20, 2), nominal)
      .input("saldo_akhir", sql.Decimal(20, 2), saldoAkhir)
      .input("keterangan", sql.NVarChar(500), `Klaim Retur ${noRetur ? `${noRetur} ` : ""}pada Kontrabon ${noKontrabon}`)
      .input("created_by", sql.VarChar(255), createdBy || "Admin")
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

    // Update master deposit
    await new sql.Request(tx)
      .input("kode_supplier", sql.VarChar(255), kodeSupplier)
      .input("saldo_deposit", sql.Decimal(20, 2), saldoAkhir)
      .input("updated_by", sql.VarChar(255), createdBy || "Admin")
      .query(`
        UPDATE dbo.GWEN_m_supplier_deposit
        SET saldo_deposit = @saldo_deposit,
            updated_at = GETDATE(),
            updated_by = @updated_by
        WHERE kode_supplier = @kode_supplier;
      `);
  }
}

