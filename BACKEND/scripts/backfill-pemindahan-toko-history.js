import sql from "mssql";
import { config } from "../src/config/index.js";

const APPLY_MODE = process.argv.includes("--apply");
const YESTERDAY_ONLY = process.argv.includes("--yesterday-only");

const toDateOrNow = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
};

const ymdWib = (date) => {
  const d = toDateOrNow(date);
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wib.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const yesterdayWibYmd = () => {
  const now = new Date();
  const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  wibNow.setUTCDate(wibNow.getUTCDate() - 1);
  const y = wibNow.getUTCFullYear();
  const m = String(wibNow.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wibNow.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const main = async () => {
  const pool = await sql.connect(config.db);
  const summary = {
    mode: APPLY_MODE ? "apply" : "dry-run",
    yesterday_only: YESTERDAY_ONLY,
    scanned_details: 0,
    pending_inserts: 0,
    processed_inserts: 0,
    skipped_existing: 0,
    failed_inserts: 0,
    errors: [],
  };

  try {
    const ymdTarget = yesterdayWibYmd();
    const detailReq = pool.request();
    if (YESTERDAY_ONLY) {
      detailReq.input("tgl_target", sql.VarChar(10), ymdTarget);
    }

    const detailsRes = await detailReq.query(`
      SELECT
        t.kode_t_pemindahan,
        t.kode_lokasi_dari AS kode_toko,
        t.tgl,
        t.created_at,
        t.updated_at,
        t.created_by,
        t.updated_by,
        d.kode_d_pemindahan,
        d.kode_barang_variant,
        d.satuan_jml_baik,
        ISNULL(d.jml_baik_pindah, 0) AS qty_baik,
        ISNULL(d.jml_rusak_pindah, 0) AS qty_rusak
      FROM dbo.GWEN_t_pemindahan t
      JOIN dbo.GWEN_d_pemindahan d
        ON d.kode_t_pemindahan = t.kode_t_pemindahan
      WHERE t.tipe_lokasi_dari = 'TOKO'
        AND t.tipe_lokasi_tujuan = 'GUDANG'
        AND ISNULL(d.kode_barang_variant, '') <> ''
        ${YESTERDAY_ONLY ? "AND CONVERT(VARCHAR(10), DATEADD(HOUR, 7, ISNULL(t.tgl, t.created_at)), 23) = @tgl_target" : ""}
      ORDER BY ISNULL(t.tgl, t.created_at) ASC, t.kode_t_pemindahan ASC, d.kode_d_pemindahan ASC;
    `);

    const detailsRaw = detailsRes.recordset || [];
    summary.scanned_details = detailsRaw.length;
    if (!detailsRaw.length) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const rows = [];
    const pendingTotals = new Map();

    for (const row of detailsRaw) {
      const qtyTotal = Number(row.qty_baik || 0) + Number(row.qty_rusak || 0);
      if (!Number.isFinite(qtyTotal) || qtyTotal <= 0) continue;

      const kodeRef = String(row.kode_t_pemindahan || "").trim();
      const kodeToko = String(row.kode_toko || "").trim();
      const kodeVar = String(row.kode_barang_variant || "").trim();
      if (!kodeRef || !kodeToko || !kodeVar) continue;

      rows.push({ ...row, qty_total: qtyTotal });
      const key = `${kodeToko}||${kodeVar}`;
      pendingTotals.set(key, Number(pendingTotals.get(key) || 0) + qtyTotal);
    }

    summary.scanned_details = rows.length;

    if (!rows.length) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    if (!APPLY_MODE) {
      const preview = rows.slice(0, 20).map((r) => ({
        kode_t_pemindahan: r.kode_t_pemindahan,
        kode_d_pemindahan: r.kode_d_pemindahan,
        kode_toko: r.kode_toko,
        kode_barang_variant: r.kode_barang_variant,
        qty_total: r.qty_total,
        tgl_wib: ymdWib(r.tgl || r.created_at),
      }));
      summary.pending_inserts = rows.length;
      console.log(
        JSON.stringify(
          {
            ...summary,
            preview_rows: preview,
          },
          null,
          2
        )
      );
      return;
    }

    for (const row of rows) {
      const tx = new sql.Transaction(pool);
      try {
        await tx.begin();

        const kodeRef = String(row.kode_t_pemindahan || "").trim();
        const kodeDetail = String(row.kode_d_pemindahan || "").trim();
        const kodeToko = String(row.kode_toko || "").trim();
        const kodeVar = String(row.kode_barang_variant || "").trim();
        const qtyTotal = Number(row.qty_total || 0);
        const key = `${kodeToko}||${kodeVar}`;
        const transDate = toDateOrNow(row.tgl || row.created_at || row.updated_at);
        const actor = String(row.updated_by || row.created_by || "SYSTEM").trim() || "SYSTEM";
        const satuan = String(row.satuan_jml_baik || "PCS").trim() || "PCS";

        const existsRes = await new sql.Request(tx)
          .input("kode_ref", sql.VarChar(255), kodeRef)
          .input("kode_barang_variant", sql.VarChar(255), kodeVar)
          .input("kode_gudang", sql.VarChar(255), kodeToko)
          .input("qty_keluar", sql.Decimal(20, 2), qtyTotal)
          .query(`
            SELECT TOP 1 id
            FROM dbo.GWEN_h_stok_barang_variant
            WHERE ket_transaksi = 'PEMINDAHAN'
              AND status = 'KELUAR'
              AND kode_ref_transaksi = @kode_ref
              AND kode_barang_variant = @kode_barang_variant
              AND kode_gudang = @kode_gudang
              AND ABS(ISNULL(qty_keluar, 0) - @qty_keluar) < 0.0001
            ORDER BY id DESC;
          `);
        if (existsRes.recordset?.length) {
          await tx.rollback();
          summary.skipped_existing += 1;
          pendingTotals.set(key, Math.max(0, Number(pendingTotals.get(key) || 0) - qtyTotal));
          continue;
        }

        const prevHistRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(255), kodeVar)
          .input("kode_gudang", sql.VarChar(255), kodeToko)
          .input("tgl_transaksi", sql.DateTime, transDate)
          .query(`
            SELECT TOP 1 stok_akhir_satuan_1
            FROM dbo.GWEN_h_stok_barang_variant
            WHERE kode_barang_variant = @kode_barang_variant
              AND kode_gudang = @kode_gudang
              AND tgl_transaksi <= @tgl_transaksi
            ORDER BY tgl_transaksi DESC, id DESC;
          `);

        let stokAwal = Number(prevHistRes.recordset?.[0]?.stok_akhir_satuan_1 ?? NaN);
        if (!Number.isFinite(stokAwal)) {
          const stokNowRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(255), kodeVar)
            .input("kode_toko", sql.VarChar(255), kodeToko)
            .query(`
              SELECT
                SUM(ISNULL(stok_available, 0) + ISNULL(qty_rusak, 0)) AS stok_total
              FROM dbo.GWEN_mn_barang_toko_variant
              WHERE kode_barang_variant = @kode_barang_variant
                AND kode_toko = @kode_toko;
            `);
          const stokNow = Number(stokNowRes.recordset?.[0]?.stok_total ?? 0);
          const pendingRem = Number(pendingTotals.get(key) || 0);
          stokAwal = stokNow + pendingRem;
        }

        const stokAkhir = stokAwal - qtyTotal;
        const kodeHist = `HST.BFPM.${kodeDetail || `${kodeRef}.${kodeVar}`}`;

        await new sql.Request(tx)
          .input("kode_h_stok_barang", sql.VarChar(255), kodeHist)
          .input("kode_ref_transaksi", sql.VarChar(255), kodeRef)
          .input("tgl_transaksi", sql.DateTime, transDate)
          .input("ket_transaksi", sql.VarChar(sql.MAX), "PEMINDAHAN")
          .input("kode_barang_variant", sql.VarChar(255), kodeVar)
          .input("qty_masuk", sql.Decimal(20, 2), 0)
          .input("status", sql.VarChar(255), "KELUAR")
          .input("status_cadangan", sql.VarChar(255), null)
          .input("created_by", sql.VarChar(255), actor)
          .input("created_at", sql.DateTime, transDate)
          .input("updated_by", sql.VarChar(255), actor)
          .input("updated_at", sql.DateTime, transDate)
          .input("kode_gudang", sql.VarChar(255), kodeToko)
          .input("satuan", sql.VarChar(255), satuan)
          .input("qty_ke_satuan_1", sql.Decimal(20, 2), qtyTotal)
          .input("stok_awal_satuan_1", sql.Decimal(20, 2), stokAwal)
          .input("stok_akhir_satuan_1", sql.Decimal(20, 2), stokAkhir)
          .input("qty_keluar", sql.Decimal(20, 2), qtyTotal)
          .input("kode_sales", sql.VarChar(255), null)
          .input("ket_inquiry", sql.VarChar(sql.MAX), null)
          .query(`
            INSERT INTO dbo.GWEN_h_stok_barang_variant (
              kode_h_stok_barang, kode_ref_transaksi, tgl_transaksi, ket_transaksi, kode_barang_variant, qty_masuk,
              status, status_cadangan, created_by, created_at, updated_by, updated_at, kode_gudang, satuan,
              qty_ke_satuan_1, stok_awal_satuan_1, stok_akhir_satuan_1, qty_keluar, kode_sales, ket_inquiry
            ) VALUES (
              @kode_h_stok_barang, @kode_ref_transaksi, @tgl_transaksi, @ket_transaksi, @kode_barang_variant, @qty_masuk,
              @status, @status_cadangan, @created_by, @created_at, @updated_by, @updated_at, @kode_gudang, @satuan,
              @qty_ke_satuan_1, @stok_awal_satuan_1, @stok_akhir_satuan_1, @qty_keluar, @kode_sales, @ket_inquiry
            );
          `);

        await tx.commit();
        summary.processed_inserts += 1;
        summary.pending_inserts += 1;
        pendingTotals.set(key, Math.max(0, Number(pendingTotals.get(key) || 0) - qtyTotal));
      } catch (err) {
        try {
          await tx.rollback();
        } catch {
          // ignore rollback errors
        }
        summary.failed_inserts += 1;
        summary.errors.push({
          kode_t_pemindahan: String(row.kode_t_pemindahan || ""),
          kode_d_pemindahan: String(row.kode_d_pemindahan || ""),
          message: String(err?.message || err),
        });
      }
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await pool.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
