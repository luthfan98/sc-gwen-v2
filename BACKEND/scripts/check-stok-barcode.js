import sql from "mssql";
import { config } from "../src/config/index.js";

const barcode = "6970635463782";
const kodePengadaan = "PEN.14032688GW00097";
const kodeLpb = "LPB.14032688GW00099";
const kodeGudang = "GUD.27012099GW001";

const main = async () => {
  const pool = await sql.connect(config.db);
  try {
    const resVar = await pool.request().input("barcode", sql.VarChar(50), barcode).query(`
      SELECT TOP 20
        v.kode_barang_variant,
        v.kode_varian,
        v.nama_varian,
        b.kode_barang,
        b.nama AS nama_barang,
        v.barcode_varian,
        b.barcode_global
      FROM dbo.m_barang_varian v
      JOIN dbo.m_barang b ON b.id_barang = v.id_barang
      WHERE v.barcode_varian = @barcode
         OR b.barcode_global = @barcode
      ORDER BY v.kode_barang_variant;
    `);

    const variants = resVar.recordset || [];
    console.log("variants", variants);

    if (variants.length === 0) {
      return;
    }

    const kodeList = variants.map((v) => String(v.kode_barang_variant || "").trim()).filter(Boolean);
    const req = pool.request();
    const params = kodeList.map((_, idx) => `@kbv_${idx}`);
    kodeList.forEach((val, idx) => req.input(`kbv_${idx}`, sql.VarChar(50), val));
    req.input("kode_gudang", sql.VarChar(50), kodeGudang);

    const stokGudang = await req.query(`
      SELECT
        s.kode_barang_variant,
        s.kode_gudang,
        s.stok,
        s.qty_baik,
        s.qty_rusak,
        s.updated_at
      FROM dbo.GWEN_mn_barang_gudang_variant s
      WHERE s.kode_barang_variant IN (${params.join(",")})
      ORDER BY s.kode_gudang, s.kode_barang_variant;
    `);

    console.log("stok_gudang", stokGudang.recordset || []);

    const hstok = await req.query(`
      SELECT TOP 50
        h.kode_barang_variant,
        h.kode_gudang,
        h.tgl_transaksi,
        h.kode_ref_transaksi,
        h.ket_transaksi,
        h.qty_masuk,
        h.qty_keluar,
        h.stok_awal_satuan_1,
        h.stok_akhir_satuan_1
      FROM dbo.GWEN_h_stok_barang_variant h
      WHERE h.kode_barang_variant IN (${params.join(",")})
        AND h.kode_gudang = @kode_gudang
      ORDER BY h.tgl_transaksi DESC, h.kode_h_stok_barang DESC;
    `);

    console.log("hstok_gudang", hstok.recordset || []);

    const penerimaanHeader = await pool
      .request()
      .input("kode_t_pengadaan", sql.VarChar(255), kodePengadaan)
      .query(`
        SELECT TOP 1
          kode_t_penerimaan_pengadaan,
          kode_t_pengadaan,
          kode_gudang,
          tgl
        FROM dbo.GWEN_t_penerimaan_pengadaan
        WHERE kode_t_pengadaan = @kode_t_pengadaan;
      `);
    console.log("penerimaan_header", penerimaanHeader.recordset || []);

    const kodePenerimaan = penerimaanHeader.recordset?.[0]?.kode_t_penerimaan_pengadaan || null;
    if (kodePenerimaan) {
      const penerimaanDetail = await pool
        .request()
        .input("kode_t_penerimaan_pengadaan", sql.VarChar(255), kodePenerimaan)
        .input("barcode", sql.VarChar(50), barcode)
        .query(`
          SELECT
            d.kode_d_penerimaan_pengadaan,
            d.kode_barang AS kode_barang_variant,
            d.jml_baik_dikirim,
            d.jml_baik_diterima,
            d.jml_rusak_diterima,
            v.barcode_varian,
            b.barcode_global,
            b.nama AS nama_barang,
            v.nama_varian
          FROM dbo.GWEN_d_penerimaan_pengadaan d
          LEFT JOIN dbo.m_barang_varian v
            ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.m_barang b
            ON b.id_barang = v.id_barang
          WHERE d.kode_t_penerimaan_pengadaan = @kode_t_penerimaan_pengadaan
            AND (
              v.barcode_varian = @barcode
              OR b.barcode_global = @barcode
            )
          ORDER BY d.created_at ASC, d.kode_d_penerimaan_pengadaan ASC;
        `);
      console.log("penerimaan_detail", penerimaanDetail.recordset || []);

      const histPenerimaan = await pool
        .request()
        .input("kode_ref_transaksi", sql.VarChar(255), kodePenerimaan)
        .query(`
          SELECT
            h.kode_h_stok_barang,
            h.kode_barang_variant,
            h.tgl_transaksi,
            h.qty_masuk,
            h.qty_keluar,
            h.stok_awal_satuan_1,
            h.stok_akhir_satuan_1,
            h.kode_gudang
          FROM dbo.GWEN_h_stok_barang_variant h
          WHERE h.kode_ref_transaksi = @kode_ref_transaksi
          ORDER BY h.created_at ASC, h.kode_h_stok_barang ASC;
        `);
      console.log("hstok_penerimaan", histPenerimaan.recordset || []);
    }

    const pengadaanDetail = await pool
      .request()
      .input("kode_t_pengadaan", sql.VarChar(255), kodePengadaan)
      .input("barcode", sql.VarChar(50), barcode)
      .query(`
        SELECT
          d.kode_d_pengadaan,
          d.kode_t_pengadaan,
          d.kode_barang_variant,
          d.qty,
          d.satuan,
          d.barcode_varian,
          v.barcode_varian AS barcode_varian_master,
          b.barcode_global,
          b.nama AS nama_barang,
          v.nama_varian
        FROM dbo.GWEN_d_pengadaan d
        LEFT JOIN dbo.m_barang_varian v
          ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.m_barang b
          ON b.id_barang = v.id_barang
        WHERE d.kode_t_pengadaan = @kode_t_pengadaan
          AND (
            d.barcode_varian = @barcode
            OR v.barcode_varian = @barcode
            OR b.barcode_global = @barcode
          )
        ORDER BY d.created_at ASC, d.kode_d_pengadaan ASC;
      `);
    console.log("pengadaan_detail", pengadaanDetail.recordset || []);

    const lpbDetail = await pool
      .request()
      .input("kode_lpb", sql.VarChar(40), kodeLpb)
      .input("barcode", sql.VarChar(50), barcode)
      .query(`
        SELECT
          d.kode_d_lpb,
          d.kode_lpb,
          d.kode_barang_variant,
          d.barcode_varian,
          d.nama_barang,
          d.qty_rpo,
          d.qty,
          v.barcode_varian AS barcode_varian_master,
          b.barcode_global,
          b.nama AS nama_barang_master,
          v.nama_varian
        FROM dbo.GWEN_d_lpb d
        LEFT JOIN dbo.m_barang_varian v
          ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.m_barang b
          ON b.id_barang = v.id_barang
        WHERE d.kode_lpb = @kode_lpb
          AND (
            d.barcode_varian = @barcode
            OR v.barcode_varian = @barcode
            OR b.barcode_global = @barcode
          )
        ORDER BY d.created_at ASC, d.kode_d_lpb ASC;
      `);
    console.log("lpb_detail", lpbDetail.recordset || []);

  } finally {
    await pool.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
