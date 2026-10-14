SET XACT_ABORT ON;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

BEGIN TRANSACTION;

DECLARE @variant varchar(80) = 'BGV.23012688GW13532';
DECLARE @store varchar(80) = 'MTO.160126AdYZ00001';
DECLARE @barcode varchar(20) = '8992796011136';
DECLARE @chain_gaps int;
DECLARE @formula_errors int;
DECLARE @first_open decimal(18,2);

IF NOT EXISTS (
  SELECT 1
  FROM dbo.m_barang_varian v
  LEFT JOIN dbo.m_barang b ON b.id_barang = v.id_barang
  WHERE v.kode_barang_variant = @variant
    AND (v.barcode_varian = @barcode OR b.barcode_global = @barcode)
)
BEGIN
  ;THROW 51010, 'Rekonsiliasi dihentikan: barcode dan variant tidak cocok.', 1;
END;

IF EXISTS (
  SELECT 1
  FROM dbo.GWEN_mn_barang_toko_variant WITH (UPDLOCK, HOLDLOCK)
  WHERE kode_toko = @store
    AND kode_barang_variant = @variant
    AND ISNULL(qty_rusak,0) <> 0
)
BEGIN
  ;THROW 51011, 'Rekonsiliasi dihentikan: stok rusak perlu dihitung terpisah.', 1;
END;

;WITH ordered AS (
  SELECT
    h.id,
    h.created_at,
    h.kode_h_stok_barang,
    h.stok_awal_satuan_1,
    h.stok_akhir_satuan_1,
    ISNULL(h.qty_masuk,0) AS qty_masuk,
    ISNULL(h.qty_keluar,0) AS qty_keluar,
    LAG(h.stok_akhir_satuan_1) OVER (
      ORDER BY h.created_at, h.kode_h_stok_barang
    ) AS previous_end,
    ROW_NUMBER() OVER (
      ORDER BY h.created_at, h.kode_h_stok_barang
    ) AS rn
  FROM dbo.GWEN_h_stok_barang_variant h WITH (UPDLOCK, HOLDLOCK)
  WHERE h.kode_gudang = @store
    AND h.kode_barang_variant = @variant
)
SELECT
  @chain_gaps = SUM(CASE WHEN previous_end IS NOT NULL
                           AND ABS(stok_awal_satuan_1 - previous_end) > 0.009
                         THEN 1 ELSE 0 END),
  @formula_errors = SUM(CASE WHEN ABS(stok_akhir_satuan_1 - (stok_awal_satuan_1 + qty_masuk - qty_keluar)) > 0.009
                              THEN 1 ELSE 0 END),
  @first_open = MAX(CASE WHEN rn = 1 THEN stok_awal_satuan_1 END)
FROM ordered;

IF ISNULL(@chain_gaps,0) <> 1
BEGIN
  ;THROW 51012, 'Rekonsiliasi dihentikan: pola celah riwayat berubah dari yang telah ditelusuri.', 1;
END;

IF ISNULL(@formula_errors,0) <> 0
BEGIN
  ;THROW 51013, 'Rekonsiliasi dihentikan: ada baris dengan jumlah masuk/keluar yang tidak cocok.', 1;
END;

IF ISNULL(@first_open,-1) <> 0
BEGIN
  ;THROW 51014, 'Rekonsiliasi dihentikan: saldo awal pertama bukan nol.', 1;
END;

DECLARE @changed TABLE (id int PRIMARY KEY);

;WITH ordered AS (
  SELECT
    h.id,
    h.created_at,
    h.kode_h_stok_barang,
    h.stok_awal_satuan_1,
    h.stok_akhir_satuan_1,
    ISNULL(h.qty_masuk,0) - ISNULL(h.qty_keluar,0) AS movement,
    FIRST_VALUE(h.stok_awal_satuan_1) OVER (
      ORDER BY h.created_at, h.kode_h_stok_barang
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS first_open,
    SUM(ISNULL(h.qty_masuk,0) - ISNULL(h.qty_keluar,0)) OVER (
      ORDER BY h.created_at, h.kode_h_stok_barang
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_net
  FROM dbo.GWEN_h_stok_barang_variant h WITH (UPDLOCK, HOLDLOCK)
  WHERE h.kode_gudang = @store
    AND h.kode_barang_variant = @variant
), expected AS (
  SELECT
    id,
    first_open + running_net - movement AS expected_start,
    first_open + running_net AS expected_end
  FROM ordered
)
UPDATE h
SET h.stok_awal_satuan_1 = e.expected_start,
    h.stok_akhir_satuan_1 = e.expected_end,
    h.updated_by = 'SYSTEM_RECONCILE',
    h.updated_at = SYSDATETIME()
OUTPUT inserted.id INTO @changed(id)
FROM dbo.GWEN_h_stok_barang_variant h
JOIN expected e ON e.id = h.id
WHERE ABS(h.stok_awal_satuan_1 - e.expected_start) > 0.009
   OR ABS(h.stok_akhir_satuan_1 - e.expected_end) > 0.009;

;WITH latest AS (
  SELECT TOP 1 h.stok_akhir_satuan_1
  FROM dbo.GWEN_h_stok_barang_variant h
  WHERE h.kode_gudang = @store
    AND h.kode_barang_variant = @variant
  ORDER BY h.created_at DESC, h.kode_h_stok_barang DESC
)
UPDATE s
SET s.stok_available = l.stok_akhir_satuan_1 - ISNULL(s.qty_rusak,0),
    s.qty_baik = l.stok_akhir_satuan_1 - ISNULL(s.qty_rusak,0),
    s.updated_at = SYSDATETIME()
FROM dbo.GWEN_mn_barang_toko_variant s
CROSS JOIN latest l
WHERE s.kode_toko = @store
  AND s.kode_barang_variant = @variant;

IF EXISTS (
  SELECT 1
  FROM (
    SELECT
      h.stok_awal_satuan_1,
      LAG(h.stok_akhir_satuan_1) OVER (
        ORDER BY h.created_at, h.kode_h_stok_barang
      ) AS previous_end,
      h.stok_akhir_satuan_1,
      h.stok_awal_satuan_1 + ISNULL(h.qty_masuk,0) - ISNULL(h.qty_keluar,0) AS expected_end
    FROM dbo.GWEN_h_stok_barang_variant h
    WHERE h.kode_gudang = @store
      AND h.kode_barang_variant = @variant
  ) v
  WHERE (v.previous_end IS NOT NULL AND ABS(v.stok_awal_satuan_1 - v.previous_end) > 0.009)
     OR ABS(v.stok_akhir_satuan_1 - v.expected_end) > 0.009
)
BEGIN
  ;THROW 51015, 'Rekonsiliasi gagal: rantai riwayat belum konsisten.', 1;
END;

IF EXISTS (
  SELECT 1
  FROM dbo.GWEN_mn_barang_toko_variant s
  CROSS APPLY (
    SELECT TOP 1 h.stok_akhir_satuan_1
    FROM dbo.GWEN_h_stok_barang_variant h
    WHERE h.kode_gudang = @store
      AND h.kode_barang_variant = @variant
    ORDER BY h.created_at DESC, h.kode_h_stok_barang DESC
  ) h
  WHERE s.kode_toko = @store
    AND s.kode_barang_variant = @variant
    AND (ABS(s.stok_available - (h.stok_akhir_satuan_1 - ISNULL(s.qty_rusak,0))) > 0.009
      OR ABS(s.qty_baik - (h.stok_akhir_satuan_1 - ISNULL(s.qty_rusak,0))) > 0.009)
)
BEGIN
  ;THROW 51016, 'Rekonsiliasi gagal: saldo aktif belum cocok dengan kartu mutasi.', 1;
END;

COMMIT TRANSACTION;

SELECT
  COUNT(*) AS history_rows_changed,
  (SELECT TOP 1 stok_akhir_satuan_1
   FROM dbo.GWEN_h_stok_barang_variant
   WHERE kode_gudang = @store AND kode_barang_variant = @variant
   ORDER BY created_at DESC, kode_h_stok_barang DESC) AS final_stock,
  (SELECT SUM(ISNULL(qty_masuk,0) - ISNULL(qty_keluar,0))
   FROM dbo.GWEN_h_stok_barang_variant
   WHERE kode_gudang = @store AND kode_barang_variant = @variant) AS net_movement
FROM @changed;
