import sql from "mssql";
import { config } from "../src/config/index.js";

const APPLY_MODE = process.argv.includes("--apply");

const main = async () => {
  const pool = await sql.connect(config.db);
  const summary = {
    mode: APPLY_MODE ? "apply" : "dry-run",
    anomaly_rows: 0,
    affected_docs: 0,
    updated_header_rows: 0,
    updated_detail_rows: 0,
    updated_history_rows: 0,
    failed_docs: 0,
    errors: [],
    docs: [],
  };

  try {
    const anomalyRes = await pool.request().query(`
      WITH terima AS (
        SELECT id, kode_ref_transaksi, kode_barang_variant, kode_gudang, tgl_transaksi
        FROM dbo.GWEN_h_stok_barang_variant
        WHERE ket_transaksi = 'TERIMA PEMINDAHAN'
      ),
      retur AS (
        SELECT id, kode_ref_transaksi, kode_barang_variant, kode_gudang, tgl_transaksi
        FROM dbo.GWEN_h_stok_barang_variant
        WHERE ket_transaksi = 'RETUR SUPPLIER'
      ),
      anomaly AS (
        SELECT
          r.id AS retur_id,
          r.kode_ref_transaksi AS kode_retur,
          r.kode_barang_variant,
          r.kode_gudang,
          r.tgl_transaksi AS tgl_retur,
          (
            SELECT TOP 1 t.id
            FROM terima t
            WHERE t.kode_barang_variant = r.kode_barang_variant
              AND t.kode_gudang = r.kode_gudang
              AND t.tgl_transaksi > r.tgl_transaksi
            ORDER BY t.tgl_transaksi ASC, t.id ASC
          ) AS terima_id_after,
          (
            SELECT TOP 1 t.kode_ref_transaksi
            FROM terima t
            WHERE t.kode_barang_variant = r.kode_barang_variant
              AND t.kode_gudang = r.kode_gudang
              AND t.tgl_transaksi > r.tgl_transaksi
            ORDER BY t.tgl_transaksi ASC, t.id ASC
          ) AS kode_terima_after,
          (
            SELECT TOP 1 t.tgl_transaksi
            FROM terima t
            WHERE t.kode_barang_variant = r.kode_barang_variant
              AND t.kode_gudang = r.kode_gudang
              AND t.tgl_transaksi > r.tgl_transaksi
            ORDER BY t.tgl_transaksi ASC, t.id ASC
          ) AS tgl_terima_after,
          (
            SELECT MAX(t.tgl_transaksi)
            FROM terima t
            WHERE t.kode_barang_variant = r.kode_barang_variant
              AND t.kode_gudang = r.kode_gudang
              AND t.tgl_transaksi <= r.tgl_transaksi
          ) AS last_terima_before
        FROM retur r
      )
      SELECT
        kode_terima_after AS kode_t_penerimaan,
        COUNT(1) AS affected_rows,
        MIN(tgl_terima_after) AS min_tgl_terima_after,
        MAX(tgl_terima_after) AS max_tgl_terima_after,
        MIN(tgl_retur) AS min_tgl_retur,
        MAX(tgl_retur) AS max_tgl_retur
      FROM anomaly
      WHERE last_terima_before IS NULL
        AND terima_id_after IS NOT NULL
        AND DATEADD(HOUR, -7, tgl_terima_after) <= tgl_retur
      GROUP BY kode_terima_after
      ORDER BY kode_terima_after;
    `);

    const docs = anomalyRes.recordset || [];
    summary.affected_docs = docs.length;
    summary.anomaly_rows = docs.reduce((sum, row) => sum + Number(row.affected_rows || 0), 0);
    summary.docs = docs.map((row) => ({
      kode_t_penerimaan: row.kode_t_penerimaan,
      affected_rows: Number(row.affected_rows || 0),
      min_tgl_retur: row.min_tgl_retur,
      max_tgl_retur: row.max_tgl_retur,
      min_tgl_terima_after: row.min_tgl_terima_after,
      max_tgl_terima_after: row.max_tgl_terima_after,
    }));

    if (!APPLY_MODE || !docs.length) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      for (const doc of docs) {
        const kode = String(doc.kode_t_penerimaan || "").trim();
        if (!kode) continue;

        try {
          const headerUpd = await new sql.Request(tx)
            .input("kode_t_penerimaan", sql.VarChar(50), kode)
            .query(`
              UPDATE dbo.GWEN_t_penerimaan_pemindahan
              SET
                tgl_terima = DATEADD(HOUR, -7, tgl_terima),
                created_at = DATEADD(HOUR, -7, created_at),
                updated_at = DATEADD(HOUR, -7, updated_at)
              WHERE kode_t_penerimaan = @kode_t_penerimaan;
              SELECT @@ROWCOUNT AS affected;
            `);
          const headerAffected = Number(headerUpd.recordset?.[0]?.affected ?? 0);

          const detailUpd = await new sql.Request(tx)
            .input("kode_t_penerimaan", sql.VarChar(50), kode)
            .query(`
              UPDATE dbo.GWEN_d_penerimaan_pemindahan
              SET
                created_at = DATEADD(HOUR, -7, created_at),
                updated_at = DATEADD(HOUR, -7, updated_at)
              WHERE kode_t_penerimaan = @kode_t_penerimaan;
              SELECT @@ROWCOUNT AS affected;
            `);
          const detailAffected = Number(detailUpd.recordset?.[0]?.affected ?? 0);

          const histUpd = await new sql.Request(tx)
            .input("kode_ref_transaksi", sql.VarChar(255), kode)
            .query(`
              UPDATE dbo.GWEN_h_stok_barang_variant
              SET
                tgl_transaksi = DATEADD(HOUR, -7, tgl_transaksi),
                created_at = DATEADD(HOUR, -7, created_at),
                updated_at = DATEADD(HOUR, -7, updated_at)
              WHERE ket_transaksi = 'TERIMA PEMINDAHAN'
                AND kode_ref_transaksi = @kode_ref_transaksi;
              SELECT @@ROWCOUNT AS affected;
            `);
          const histAffected = Number(histUpd.recordset?.[0]?.affected ?? 0);

          summary.updated_header_rows += headerAffected;
          summary.updated_detail_rows += detailAffected;
          summary.updated_history_rows += histAffected;
        } catch (err) {
          summary.failed_docs += 1;
          summary.errors.push({
            kode_t_penerimaan: kode,
            message: String(err?.message || err),
          });
        }
      }

      if (summary.failed_docs > 0) {
        throw new Error(`Terdapat ${summary.failed_docs} dokumen gagal diperbaiki.`);
      }

      await tx.commit();
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // ignore rollback error
      }
      throw err;
    }

    const verifyRes = await pool.request().query(`
      WITH terima AS (
        SELECT id, kode_ref_transaksi, kode_barang_variant, kode_gudang, tgl_transaksi
        FROM dbo.GWEN_h_stok_barang_variant
        WHERE ket_transaksi = 'TERIMA PEMINDAHAN'
      ),
      retur AS (
        SELECT id, kode_ref_transaksi, kode_barang_variant, kode_gudang, tgl_transaksi
        FROM dbo.GWEN_h_stok_barang_variant
        WHERE ket_transaksi = 'RETUR SUPPLIER'
      ),
      chk AS (
        SELECT
          r.id,
          (
            SELECT MAX(t.tgl_transaksi)
            FROM terima t
            WHERE t.kode_barang_variant = r.kode_barang_variant
              AND t.kode_gudang = r.kode_gudang
              AND t.tgl_transaksi <= r.tgl_transaksi
          ) AS last_terima_before,
          (
            SELECT MIN(t.tgl_transaksi)
            FROM terima t
            WHERE t.kode_barang_variant = r.kode_barang_variant
              AND t.kode_gudang = r.kode_gudang
              AND t.tgl_transaksi > r.tgl_transaksi
          ) AS first_terima_after
        FROM retur r
      )
      SELECT
        SUM(CASE WHEN last_terima_before IS NULL AND first_terima_after IS NOT NULL THEN 1 ELSE 0 END) AS remaining_anomaly_rows
      FROM chk;
    `);
    summary.remaining_anomaly_rows = Number(verifyRes.recordset?.[0]?.remaining_anomaly_rows ?? 0);

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await pool.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
