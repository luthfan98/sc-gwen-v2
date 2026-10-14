SET XACT_ABORT ON;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

BEGIN TRANSACTION;

DECLARE @changed TABLE (
  kode_barang_variant varchar(255),
  old_stok_available decimal(20,4),
  new_stok_available decimal(20,4),
  old_qty_baik decimal(20,4),
  new_qty_baik decimal(20,4)
);

IF EXISTS (
  SELECT 1
  FROM dbo.GWEN_mn_barang_toko_variant
  WHERE kode_toko = 'MTO.160126AdYZ00001'
    AND ISNULL(qty_rusak,0) <> 0
)
BEGIN
  ;THROW 51000, 'Rekonsiliasi dihentikan: ditemukan stok rusak yang perlu dipisahkan dari saldo baik.', 1;
END;

IF EXISTS (
  SELECT 1
  FROM dbo.GWEN_mn_barang_toko_variant s
  WHERE s.kode_toko = 'MTO.160126AdYZ00001'
    AND NOT EXISTS (
      SELECT 1 FROM dbo.GWEN_h_stok_barang_variant h
      WHERE h.kode_gudang = s.kode_toko
        AND h.kode_barang_variant = s.kode_barang_variant
    )
)
BEGIN
  ;THROW 51001, 'Rekonsiliasi dihentikan: ada saldo toko tanpa kartu mutasi.', 1;
END;

;WITH latest AS (
  SELECT
    h.kode_barang_variant,
    h.stok_akhir_satuan_1,
    ROW_NUMBER() OVER (
      PARTITION BY h.kode_barang_variant
      ORDER BY h.created_at DESC, h.kode_h_stok_barang DESC
    ) AS rn
  FROM dbo.GWEN_h_stok_barang_variant h
  WHERE h.kode_gudang = 'MTO.160126AdYZ00001'
)
UPDATE s
SET s.stok_available = l.stok_akhir_satuan_1,
    s.qty_baik = l.stok_akhir_satuan_1,
    s.updated_at = SYSDATETIME()
OUTPUT
  inserted.kode_barang_variant,
  deleted.stok_available,
  inserted.stok_available,
  deleted.qty_baik,
  inserted.qty_baik
INTO @changed (
  kode_barang_variant,
  old_stok_available,
  new_stok_available,
  old_qty_baik,
  new_qty_baik
)
FROM dbo.GWEN_mn_barang_toko_variant s
JOIN latest l
  ON l.kode_barang_variant = s.kode_barang_variant
 AND l.rn = 1
WHERE s.kode_toko = 'MTO.160126AdYZ00001'
  AND (
    ABS(ISNULL(s.stok_available,0) - l.stok_akhir_satuan_1) > 0.009
    OR ABS(ISNULL(s.qty_baik,0) - l.stok_akhir_satuan_1) > 0.009
  );

IF EXISTS (
  SELECT 1
  FROM dbo.GWEN_mn_barang_toko_variant s
  JOIN (
    SELECT h.kode_barang_variant, h.stok_akhir_satuan_1,
      ROW_NUMBER() OVER (
        PARTITION BY h.kode_barang_variant
        ORDER BY h.created_at DESC, h.kode_h_stok_barang DESC
      ) AS rn
    FROM dbo.GWEN_h_stok_barang_variant h
    WHERE h.kode_gudang = 'MTO.160126AdYZ00001'
  ) l ON l.kode_barang_variant = s.kode_barang_variant AND l.rn = 1
  WHERE s.kode_toko = 'MTO.160126AdYZ00001'
    AND (
      ABS(ISNULL(s.stok_available,0) - l.stok_akhir_satuan_1) > 0.009
      OR ABS(ISNULL(s.qty_baik,0) - l.stok_akhir_satuan_1) > 0.009
    )
)
BEGIN
  ;THROW 51002, 'Rekonsiliasi gagal: masih ada saldo yang tidak cocok dengan kartu mutasi.', 1;
END;

COMMIT TRANSACTION;

SELECT
  COUNT(*) AS rows_changed,
  SUM(ABS(ISNULL(new_stok_available,0) - ISNULL(old_stok_available,0))) AS stok_available_delta,
  SUM(ABS(ISNULL(new_qty_baik,0) - ISNULL(old_qty_baik,0))) AS qty_baik_delta
FROM @changed;
