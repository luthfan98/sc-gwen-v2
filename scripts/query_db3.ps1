$dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { "1433" }
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "db_gwen_v2" }
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "sa" }
$dbPassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "resmi12" }
$cs = "Server=$dbHost,$dbPort;Database=$dbName;User Id=$dbUser;Password=$dbPassword;TrustServerCertificate=True;Encrypt=False;"

function RunQuery($sql, $title) {
    Write-Host ""
    Write-Host "=== $title ===" -ForegroundColor Cyan
    $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
    $conn.Open()
    $da = New-Object System.Data.SqlClient.SqlDataAdapter($sql, $conn)
    $dt = New-Object System.Data.DataTable
    $da.Fill($dt) | Out-Null
    $conn.Close()
    $dt | Format-Table -AutoSize
}

RunQuery "SELECT TOP 10 kode_barang, nama, kode_merk, satuan_1, het_sat_1, hpp_avg_sat_1 FROM m_barang ORDER BY created_at DESC" "10 PRODUK TERBARU"

RunQuery "SELECT kode_gudang, CAST(SUM(qty) AS BIGINT) AS total_stok, COUNT(DISTINCT kode_barang) AS jenis_barang FROM mn_stok_gudang GROUP BY kode_gudang ORDER BY total_stok DESC" "STOK PER GUDANG"

RunQuery "SELECT status_rpo, COUNT(*) AS jumlah FROM GWEN_t_rpo GROUP BY status_rpo ORDER BY jumlah DESC" "STATUS RPO (Rilis Pesanan Outlet)"

RunQuery "SELECT TOP 5 kode_t_promosi, nama_promosi, CONVERT(varchar,valid_from,120) AS dari, CONVERT(varchar,valid_to,120) AS sampai FROM GWEN_t_promosi WHERE status_aktif=1 AND valid_to >= GETDATE() ORDER BY valid_from DESC" "PROMOSI AKTIF SAAT INI"

RunQuery "SELECT COUNT(*) AS total_pelanggan, ISNULL(SUM(total_points),0) AS total_poin FROM pos_customers" "RINGKASAN PELANGGAN POS"

RunQuery "SELECT status_pengadaan, COUNT(*) AS jumlah_po, CAST(SUM(total_akhir) AS BIGINT) AS total_nilai FROM GWEN_t_pengadaan GROUP BY status_pengadaan ORDER BY status_pengadaan" "REKAP PENGADAAN PER STATUS"

RunQuery "SELECT TOP 5 p.kode_supplier, s.nama, COUNT(*) AS jml_po, CAST(SUM(p.total_akhir) AS BIGINT) AS total_nilai FROM GWEN_t_pengadaan p LEFT JOIN m_supplier s ON s.kode_supplier=p.kode_supplier GROUP BY p.kode_supplier, s.nama ORDER BY total_nilai DESC" "TOP 5 SUPPLIER (by nilai pengadaan)"

RunQuery "SELECT TOP 5 item_code, item_name, SUM(qty) AS total_terjual FROM pos_transaction_items GROUP BY item_code, item_name ORDER BY total_terjual DESC" "TOP 5 PRODUK TERLARIS (POS)"

RunQuery "SELECT FORMAT(CAST(created_at AS datetime2),'yyyy-MM') AS bulan, COUNT(*) AS jml_trx, CAST(SUM(total) AS BIGINT) AS omzet FROM pos_transactions WHERE status='Sukses' GROUP BY FORMAT(CAST(created_at AS datetime2),'yyyy-MM') ORDER BY bulan DESC" "REKAP OMZET POS PER BULAN"

RunQuery "SELECT TOP 5 cashier_name, COUNT(*) AS jml_trx, CAST(SUM(total) AS BIGINT) AS total_penjualan FROM pos_transactions WHERE status='Sukses' GROUP BY cashier_name ORDER BY total_penjualan DESC" "TOP 5 KASIR TERBAIK"

Write-Host "" 
Write-Host "=== SELESAI ===" -ForegroundColor Green
