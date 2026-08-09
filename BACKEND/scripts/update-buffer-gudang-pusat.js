import sql from "mssql";
import { config } from "../src/config/index.js";

const query = `
SET NOCOUNT ON;

WITH store_keys AS (
  SELECT DISTINCT
    h.kode_barang_variant,
    h.kode_gudang
  FROM dbo.GWEN_h_stok_barang_variant h
  WHERE h.kode_gudang LIKE 'MTO%'
),
per_store AS (
  SELECT
    s.kode_barang_variant,
    s.kode_gudang,
    COALESCE(outrow.stok_before, lastrow.stok_akhir_satuan_1, 0) AS stok_before
  FROM store_keys s
  OUTER APPLY (
    SELECT TOP 1
      (ISNULL(h.stok_akhir_satuan_1, 0) + ISNULL(h.qty_keluar, 0)) AS stok_before
    FROM dbo.GWEN_h_stok_barang_variant h
    WHERE h.kode_barang_variant COLLATE DATABASE_DEFAULT = s.kode_barang_variant COLLATE DATABASE_DEFAULT
      AND h.kode_gudang COLLATE DATABASE_DEFAULT = s.kode_gudang COLLATE DATABASE_DEFAULT
      AND ISNULL(h.qty_keluar, 0) > 0
    ORDER BY h.tgl_transaksi ASC, h.kode_h_stok_barang ASC
  ) outrow
  OUTER APPLY (
    SELECT TOP 1
      ISNULL(h.stok_akhir_satuan_1, 0) AS stok_akhir_satuan_1
    FROM dbo.GWEN_h_stok_barang_variant h
    WHERE h.kode_barang_variant COLLATE DATABASE_DEFAULT = s.kode_barang_variant COLLATE DATABASE_DEFAULT
      AND h.kode_gudang COLLATE DATABASE_DEFAULT = s.kode_gudang COLLATE DATABASE_DEFAULT
    ORDER BY h.tgl_transaksi DESC, h.kode_h_stok_barang DESC
  ) lastrow
),
sum_store AS (
  SELECT
    kode_barang_variant,
    SUM(stok_before) AS buffer_val
  FROM per_store
  GROUP BY kode_barang_variant
),
mapped AS (
  SELECT
    s.kode_barang_variant,
    s.buffer_val,
    b.kode_barang,
    v.kode_varian
  FROM sum_store s
  JOIN dbo.m_barang_varian v
    ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = s.kode_barang_variant COLLATE DATABASE_DEFAULT
  JOIN dbo.m_barang b
    ON b.id_barang = v.id_barang
)
UPDATE g
SET
  g.buffer_min = m.buffer_val,
  g.updated_at = SYSDATETIME()
FROM dbo.mn_stok_gudang g
JOIN mapped m
  ON g.kode_barang COLLATE DATABASE_DEFAULT = m.kode_barang COLLATE DATABASE_DEFAULT
  AND g.kode_varian COLLATE DATABASE_DEFAULT = m.kode_varian COLLATE DATABASE_DEFAULT
WHERE g.kode_gudang = 'GUD.27012099GW001';

SELECT @@ROWCOUNT AS updated_count;
`;

const main = async () => {
  const pool = await sql.connect(config.db);
  try {
    const res = await pool.request().query(query);
    console.log(JSON.stringify(res.recordset?.[0] || { updated_count: 0 }));
  } finally {
    await pool.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
