import sql from "mssql";
import { config } from "../src/config/index.js";

const APPLY_MODE = process.argv.includes("--apply");

const toDateOrNow = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
};

const main = async () => {
  const pool = await sql.connect(config.db);
  const summary = {
    scanned_docs: 0,
    pending_docs: 0,
    processed_docs: 0,
    skipped_docs: 0,
    failed_docs: 0,
    updated_stock_rows: 0,
    inserted_history_rows: 0,
    errors: [],
  };

  try {
    const pendingRes = await pool.request().query(`
      SELECT
        t.kode_t_retur_supplier,
        t.kode_gudang,
        t.created_by,
        t.created_at,
        t.updated_by,
        t.updated_at,
        COUNT(d.kode_d_retur_supplier) AS total_item
      FROM dbo.GWEN_t_retur_supplier t
      LEFT JOIN dbo.GWEN_d_retur_supplier d
        ON d.kode_t_retur_supplier = t.kode_t_retur_supplier
      WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.GWEN_h_stok_barang_variant h
        WHERE h.kode_ref_transaksi = t.kode_t_retur_supplier
          AND h.ket_transaksi = 'RETUR SUPPLIER'
      )
      GROUP BY
        t.kode_t_retur_supplier,
        t.kode_gudang,
        t.created_by,
        t.created_at,
        t.updated_by,
        t.updated_at
      ORDER BY t.created_at ASC, t.kode_t_retur_supplier ASC;
    `);

    const pendingDocs = pendingRes.recordset || [];
    summary.scanned_docs = pendingDocs.length;
    summary.pending_docs = pendingDocs.length;

    if (!APPLY_MODE) {
      console.log(
        JSON.stringify(
          {
            mode: "dry-run",
            pending_docs: pendingDocs.length,
            docs: pendingDocs,
          },
          null,
          2
        )
      );
      return;
    }

    for (const doc of pendingDocs) {
      const kodeRetur = String(doc.kode_t_retur_supplier || "").trim();
      const tx = new sql.Transaction(pool);

      try {
        await tx.begin();

        const checkReq = new sql.Request(tx).input("kode_ref", sql.VarChar(255), kodeRetur);
        const checkRes = await checkReq.query(`
          SELECT COUNT(1) AS cnt
          FROM dbo.GWEN_h_stok_barang_variant
          WHERE kode_ref_transaksi = @kode_ref
            AND ket_transaksi = 'RETUR SUPPLIER';
        `);
        const alreadyPosted = Number(checkRes.recordset?.[0]?.cnt || 0) > 0;
        if (alreadyPosted) {
          await tx.rollback();
          summary.skipped_docs += 1;
          continue;
        }

        const headerReq = new sql.Request(tx).input("kode_t_retur_supplier", sql.VarChar(255), kodeRetur);
        const headerRes = await headerReq.query(`
          SELECT TOP 1
            kode_t_retur_supplier,
            kode_gudang,
            created_by,
            created_at,
            updated_by,
            updated_at
          FROM dbo.GWEN_t_retur_supplier
          WHERE kode_t_retur_supplier = @kode_t_retur_supplier;
        `);
        const header = headerRes.recordset?.[0];
        if (!header) {
          throw new Error(`Header retur ${kodeRetur} tidak ditemukan.`);
        }

        const detailReq = new sql.Request(tx).input("kode_t_retur_supplier", sql.VarChar(255), kodeRetur);
        const detailRes = await detailReq.query(`
          SELECT
            kode_d_retur_supplier,
            kode_gudang,
            kode_barang_variant,
            qty,
            satuan
          FROM dbo.GWEN_d_retur_supplier
          WHERE kode_t_retur_supplier = @kode_t_retur_supplier
          ORDER BY created_at ASC, kode_d_retur_supplier ASC;
        `);

        const details = detailRes.recordset || [];
        const transDate = toDateOrNow(header.updated_at || header.created_at);
        const actor = String(header.updated_by || header.created_by || "SYSTEM").trim() || "SYSTEM";

        for (let idx = 0; idx < details.length; idx += 1) {
          const item = details[idx];
          const kodeBarangVariant = String(item.kode_barang_variant || "").trim();
          const kodeGudang = String(item.kode_gudang || header.kode_gudang || "").trim();
          const qtyRetur = Number(item.qty || 0);

          if (!kodeBarangVariant || !kodeGudang || !Number.isFinite(qtyRetur) || qtyRetur <= 0) {
            continue;
          }

          const stokReq = new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
            .input("kode_gudang", sql.VarChar(100), kodeGudang);
          const stokRes = await stokReq.query(`
            SELECT
              kode_mn_barang_gudang,
              ISNULL(stok, 0) AS stok,
              CASE
                WHEN qty_baik IS NULL THEN ISNULL(stok, 0)
                ELSE ISNULL(qty_baik, 0)
              END AS qty_baik,
              ISNULL(qty_rusak, 0) AS qty_rusak
            FROM dbo.GWEN_mn_barang_gudang_variant WITH (UPDLOCK, ROWLOCK)
            WHERE kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT
              AND kode_gudang COLLATE DATABASE_DEFAULT = @kode_gudang COLLATE DATABASE_DEFAULT
            ORDER BY updated_at DESC, created_at DESC, kode_mn_barang_gudang ASC;
          `);

          const stokRows = stokRes.recordset || [];
          if (!stokRows.length) {
            throw new Error(
              `Stok varian ${kodeBarangVariant} pada gudang ${kodeGudang} tidak ditemukan (retur ${kodeRetur}).`
            );
          }

          const stokAwalBaik = stokRows.reduce((sum, row) => sum + (Number(row.qty_baik) || 0), 0);
          const stokAwalRusak = stokRows.reduce((sum, row) => sum + (Number(row.qty_rusak) || 0), 0);
          const stokAwalTotal = stokAwalBaik + stokAwalRusak;

          if (qtyRetur > stokAwalBaik) {
            throw new Error(
              `Stok baik tidak cukup untuk ${kodeBarangVariant} (retur ${kodeRetur}): qty retur ${qtyRetur}, stok baik ${stokAwalBaik}.`
            );
          }

          let sisaRetur = qtyRetur;
          for (const stokRow of stokRows) {
            if (sisaRetur <= 0) break;
            const qtyBaikAwalRow = Number(stokRow.qty_baik) || 0;
            const qtyRusakAwalRow = Number(stokRow.qty_rusak) || 0;
            if (qtyBaikAwalRow <= 0) continue;

            const qtyAmbilRow = Math.min(qtyBaikAwalRow, sisaRetur);
            const qtyBaikAkhirRow = qtyBaikAwalRow - qtyAmbilRow;
            const stokAkhirRow = qtyBaikAkhirRow + qtyRusakAwalRow;

            await new sql.Request(tx)
              .input("stok", sql.Decimal(20, 2), stokAkhirRow)
              .input("qty_baik", sql.Decimal(20, 2), qtyBaikAkhirRow)
              .input("qty_rusak", sql.Decimal(20, 2), qtyRusakAwalRow)
              .input("updated_by", sql.VarChar(255), actor)
              .input("updated_at", sql.DateTime, transDate)
              .input("kode_mn_barang_gudang", sql.VarChar(255), String(stokRow.kode_mn_barang_gudang || ""))
              .query(`
                UPDATE dbo.GWEN_mn_barang_gudang_variant
                SET stok = @stok,
                    qty_baik = @qty_baik,
                    qty_rusak = @qty_rusak,
                    updated_by = @updated_by,
                    updated_at = @updated_at
                WHERE kode_mn_barang_gudang = @kode_mn_barang_gudang;
              `);

            summary.updated_stock_rows += 1;
            sisaRetur -= qtyAmbilRow;
          }

          if (sisaRetur > 0) {
            throw new Error(
              `Pengurangan stok gagal tuntas untuk ${kodeBarangVariant} (retur ${kodeRetur}), sisa ${sisaRetur}.`
            );
          }

          const histReq = new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
            .input("kode_gudang", sql.VarChar(100), kodeGudang);
          const histRes = await histReq.query(`
            SELECT TOP 1 stok_akhir_satuan_1
            FROM dbo.GWEN_h_stok_barang_variant
            WHERE kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT
              AND kode_gudang COLLATE DATABASE_DEFAULT = @kode_gudang COLLATE DATABASE_DEFAULT
            ORDER BY tgl_transaksi DESC, id DESC;
          `);
          const stokAwalHist = Number(histRes.recordset?.[0]?.stok_akhir_satuan_1 ?? stokAwalTotal);
          const stokAkhirHist = stokAwalHist - qtyRetur;
          const kodeHist = `HST.${kodeRetur}.${String(idx + 1).padStart(3, "0")}`;

          await new sql.Request(tx)
            .input("kode_h_stok_barang", sql.VarChar(255), kodeHist)
            .input("kode_ref_transaksi", sql.VarChar(255), kodeRetur)
            .input("tgl_transaksi", sql.DateTime, transDate)
            .input("ket_transaksi", sql.VarChar(sql.MAX), "RETUR SUPPLIER")
            .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
            .input("qty_masuk", sql.Decimal(20, 2), 0)
            .input("status", sql.VarChar(255), "KELUAR")
            .input("status_cadangan", sql.VarChar(255), null)
            .input("created_by", sql.VarChar(255), actor)
            .input("created_at", sql.DateTime, transDate)
            .input("updated_by", sql.VarChar(255), actor)
            .input("updated_at", sql.DateTime, transDate)
            .input("kode_gudang", sql.VarChar(255), kodeGudang)
            .input("satuan", sql.VarChar(255), String(item.satuan || "PCS").trim() || "PCS")
            .input("qty_ke_satuan_1", sql.Decimal(20, 2), qtyRetur)
            .input("stok_awal_satuan_1", sql.Decimal(20, 2), stokAwalHist)
            .input("stok_akhir_satuan_1", sql.Decimal(20, 2), stokAkhirHist)
            .input("qty_keluar", sql.Decimal(20, 2), qtyRetur)
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

          summary.inserted_history_rows += 1;
        }

        await tx.commit();
        summary.processed_docs += 1;
      } catch (err) {
        try {
          await tx.rollback();
        } catch {
          // ignore rollback errors
        }
        summary.failed_docs += 1;
        summary.errors.push({
          kode_t_retur_supplier: kodeRetur,
          message: String(err?.message || err),
        });
      }
    }

    console.log(JSON.stringify({ mode: "apply", ...summary }, null, 2));
  } finally {
    await pool.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
