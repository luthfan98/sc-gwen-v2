CREATE OR ALTER TRIGGER dbo.trg_pos_items_to_stock_history
ON dbo.pos_transaction_items_central
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;
  IF NOT EXISTS (SELECT 1 FROM inserted) RETURN;

  DECLARE @kode_toko varchar(50) = 'MTO.160126AdYZ00001';

  ;WITH raw AS (
    SELECT
      i.id AS item_row_id,
      i.central_trx_code,
      i.item_id,
      i.qty,
      t.created_at,
      t.source_trx_code,
      t.customer_name,
      t.customer_phone,
      v.kode_barang_variant,
      b.satuan_1,
      'HST.' + REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(varchar(23), t.created_at, 121),'-',''),':',''),' ',''),'.','') AS prefix
    FROM inserted i
    JOIN dbo.pos_transactions_central t ON t.central_trx_code = i.central_trx_code
    LEFT JOIN dbo.m_barang_varian v ON v.id_varian = i.item_id
    LEFT JOIN dbo.m_barang b ON b.id_barang = v.id_barang
    WHERE ISNULL(t.status,'') <> 'Batal'
      AND v.kode_barang_variant IS NOT NULL
  ), eligible AS (
    SELECT raw.*
    FROM raw
    WHERE NOT EXISTS (
      SELECT 1
      FROM dbo.GWEN_h_stok_barang_variant h
      WHERE h.kode_ref_transaksi = raw.central_trx_code
        AND h.kode_barang_variant = raw.kode_barang_variant
        AND ISNULL(h.qty_keluar,0) = ISNULL(raw.qty,0)
        AND h.ket_transaksi LIKE '%PENJUALAN%'
    )
  ), ordered AS (
    SELECT eligible.*,
      ROW_NUMBER() OVER (
        PARTITION BY kode_barang_variant
        ORDER BY created_at, central_trx_code, item_id, item_row_id
      ) AS candidate_seq,
      ROW_NUMBER() OVER (
        PARTITION BY prefix
        ORDER BY created_at, central_trx_code, item_id, item_row_id
      ) AS prefix_seq
    FROM eligible
  ), counted AS (
    SELECT ordered.*,
      ISNULL(ec.max_suffix,0) AS existing_max
    FROM ordered
    OUTER APPLY (
      SELECT MAX(TRY_CAST(RIGHT(h.kode_h_stok_barang,5) AS int)) AS max_suffix
      FROM dbo.GWEN_h_stok_barang_variant h
      WHERE h.kode_h_stok_barang LIKE ordered.prefix + '%'
    ) ec
  ), prepared AS (
    SELECT
      counted.*,
      ISNULL(ls.last_stock,0) - ISNULL(pb.qty_before,0) AS stok_awal,
      ISNULL(ls.last_stock,0) - ISNULL(pb.qty_before,0) - ISNULL(counted.qty,0) AS stok_akhir,
      COALESCE(counted.satuan_1, ls.last_satuan, 'PCS') AS satuan
    FROM counted
    OUTER APPLY (
      SELECT TOP 1
        h.stok_akhir_satuan_1 AS last_stock,
        h.satuan AS last_satuan
      FROM dbo.GWEN_h_stok_barang_variant h
      WHERE h.kode_barang_variant = counted.kode_barang_variant
        AND h.kode_gudang = @kode_toko
        AND h.created_at <= counted.created_at
      ORDER BY h.created_at DESC, h.kode_h_stok_barang DESC
    ) ls
    OUTER APPLY (
      SELECT SUM(ISNULL(prior.qty,0)) AS qty_before
      FROM counted prior
      WHERE prior.kode_barang_variant = counted.kode_barang_variant
        AND prior.candidate_seq < counted.candidate_seq
    ) pb
  )
  SELECT
    prefix + RIGHT('00000' + CAST(existing_max + prefix_seq AS varchar(10)),5) AS kode_h_stok_barang,
    central_trx_code AS kode_ref_transaksi,
    created_at AS tgl_transaksi,
    'PENJUALAN' AS ket_transaksi,
    kode_barang_variant,
    CAST(0 AS decimal(18,2)) AS qty_masuk,
    '1' AS status,
    NULL AS status_cadangan,
    'SYSTEM' AS created_by,
    created_at,
    'SYSTEM' AS updated_by,
    created_at AS updated_at,
    @kode_toko AS kode_gudang,
    satuan,
    CAST(ISNULL(qty,0) AS decimal(18,2)) AS qty_ke_satuan_1,
    CAST(stok_awal AS decimal(18,2)) AS stok_awal_satuan_1,
    CAST(stok_akhir AS decimal(18,2)) AS stok_akhir_satuan_1,
    CAST(ISNULL(qty,0) AS decimal(18,2)) AS qty_keluar,
    NULL AS kode_sales,
    'Transaksi dengan kode ' + ISNULL(source_trx_code,'') + ', customer ' + ISNULL(customer_name,'') + ', nomor hp ' + ISNULL(customer_phone,'') AS ket_inquiry,
    kode_barang_variant AS kbv,
    central_trx_code AS ctrx,
    qty AS q
  INTO #toins
  FROM prepared;

  -- Late POS rows change the balance of every later history row for that item.
  ;WITH later_delta AS (
    SELECT h.id, SUM(ti.qty_ke_satuan_1) AS qty_delta
    FROM dbo.GWEN_h_stok_barang_variant h
    JOIN #toins ti
      ON ti.kode_barang_variant = h.kode_barang_variant
     AND h.kode_gudang = @kode_toko
     AND h.created_at > ti.created_at
    GROUP BY h.id
  )
  UPDATE h
  SET h.stok_awal_satuan_1 = h.stok_awal_satuan_1 - d.qty_delta,
      h.stok_akhir_satuan_1 = h.stok_akhir_satuan_1 - d.qty_delta
  FROM dbo.GWEN_h_stok_barang_variant h
  JOIN later_delta d ON d.id = h.id;

  INSERT INTO dbo.GWEN_h_stok_barang_variant (
    kode_h_stok_barang, kode_ref_transaksi, tgl_transaksi, ket_transaksi, kode_barang_variant,
    qty_masuk, status, status_cadangan, created_by, created_at, updated_by, updated_at,
    kode_gudang, satuan, qty_ke_satuan_1, stok_awal_satuan_1, stok_akhir_satuan_1, qty_keluar,
    kode_sales, ket_inquiry
  )
  SELECT
    kode_h_stok_barang, kode_ref_transaksi, tgl_transaksi, ket_transaksi, kode_barang_variant,
    qty_masuk, status, status_cadangan, created_by, created_at, updated_by, updated_at,
    kode_gudang, satuan, qty_ke_satuan_1, stok_awal_satuan_1, stok_akhir_satuan_1, qty_keluar,
    kode_sales, ket_inquiry
  FROM #toins;

  DECLARE @affected TABLE (kode_barang_variant varchar(255) PRIMARY KEY);
  INSERT INTO @affected (kode_barang_variant)
  SELECT DISTINCT kbv FROM #toins;

  ;WITH last_row AS (
    SELECT
      h.kode_barang_variant,
      h.stok_akhir_satuan_1,
      ROW_NUMBER() OVER (
        PARTITION BY h.kode_barang_variant
        ORDER BY h.created_at DESC, h.kode_h_stok_barang DESC
      ) AS rn
    FROM dbo.GWEN_h_stok_barang_variant h
    JOIN @affected a ON a.kode_barang_variant = h.kode_barang_variant
    WHERE h.kode_gudang = @kode_toko
  )
  UPDATE t
  SET t.stok_available = l.stok_akhir_satuan_1 - ISNULL(t.qty_rusak,0),
      t.qty_baik = l.stok_akhir_satuan_1 - ISNULL(t.qty_rusak,0),
      t.updated_at = SYSDATETIME()
  FROM dbo.GWEN_mn_barang_toko_variant t
  JOIN last_row l ON l.kode_barang_variant = t.kode_barang_variant AND l.rn = 1
  WHERE t.kode_toko = @kode_toko;
END;
