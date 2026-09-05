/*
  Backfill link detail penerimaan pengadaan ke detail purchase.

  Aman dijalankan berulang:
  - hanya mengisi GWEN_d_penerimaan_pengadaan.kode_d_pengadaan yang masih NULL/kosong
  - hanya untuk pasangan purchase aktif yang unik per dokumen + variant
  - tidak mengubah histori stok yang sudah diposting
*/

;WITH purchase_unique AS (
  SELECT
    p.kode_t_pengadaan,
    d.kode_barang_variant,
    MAX(d.kode_d_pengadaan) AS kode_d_pengadaan,
    COUNT(*) AS match_count
  FROM dbo.GWEN_d_pengadaan d
  JOIN dbo.GWEN_t_pengadaan p
    ON p.kode_t_pengadaan = d.kode_t_pengadaan
  WHERE ISNULL(d.is_active, 1) = 1
    AND d.kode_barang_variant IS NOT NULL
  GROUP BY p.kode_t_pengadaan, d.kode_barang_variant
  HAVING COUNT(*) = 1
)
UPDATE dp
SET dp.kode_d_pengadaan = pu.kode_d_pengadaan,
    dp.updated_by = 'SYSTEM_BACKFILL',
    dp.updated_at = GETDATE()
FROM dbo.GWEN_d_penerimaan_pengadaan dp
JOIN dbo.GWEN_t_penerimaan_pengadaan tp
  ON tp.kode_t_penerimaan_pengadaan = dp.kode_t_penerimaan_pengadaan
JOIN purchase_unique pu
  ON pu.kode_t_pengadaan = tp.kode_t_pengadaan
 AND pu.kode_barang_variant COLLATE DATABASE_DEFAULT = dp.kode_barang COLLATE DATABASE_DEFAULT
WHERE dp.kode_barang IS NOT NULL
  AND (dp.kode_d_pengadaan IS NULL OR LTRIM(RTRIM(dp.kode_d_pengadaan)) = '');
