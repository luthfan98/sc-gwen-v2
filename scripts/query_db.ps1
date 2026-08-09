$conn = New-Object System.Data.SqlClient.SqlConnection
$dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { "1433" }
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "db_gwen_v2" }
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "sa" }
$dbPassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "resmi12" }
$conn.ConnectionString = "Server=$dbHost,$dbPort;Database=$dbName;User Id=$dbUser;Password=$dbPassword;TrustServerCertificate=True;Encrypt=False;"
$conn.Open()

# 10 Produk terbaru
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT TOP 10 kode_barang, nama, kode_merk, kode_kategori, satuan_1, het_sat_1, hpp_avg_sat_1, status FROM m_barang ORDER BY created_at DESC"
$r = $cmd.ExecuteReader()
Write-Host "=== 10 PRODUK TERBARU ==="
while ($r.Read()) {
    Write-Host ("{0} | {1} | merk={2} | kat={3} | sat={4} | HET={5} | HPP={6} | aktif={7}" -f $r["kode_barang"], $r["nama"], $r["kode_merk"], $r["kode_kategori"], $r["satuan_1"], $r["het_sat_1"], $r["hpp_avg_sat_1"], $r["status"])
}
$r.Close()

# 10 Transaksi POS terbaru
$cmd2 = $conn.CreateCommand()
$cmd2.CommandText = "SELECT TOP 10 trx_code, cashier_name, customer_name, method, subtotal, discount, promo_discount, total, status, created_at FROM pos_transactions ORDER BY created_at DESC"
$r2 = $cmd2.ExecuteReader()
Write-Host ""
Write-Host "=== 10 TRANSAKSI POS TERBARU ==="
while ($r2.Read()) {
    Write-Host ("{0} | Kasir={1} | Pelanggan={2} | Metode={3} | Subtotal={4} | Diskon={5} | Promo={6} | Total={7} | Status={8} | Tgl={9}" -f $r2["trx_code"], $r2["cashier_name"], $r2["customer_name"], $r2["method"], $r2["subtotal"], $r2["discount"], $r2["promo_discount"], $r2["total"], $r2["status"], $r2["created_at"])
}
$r2.Close()

# Ringkasan stok barang (top 10)
$cmd3 = $conn.CreateCommand()
$cmd3.CommandText = "SELECT TOP 10 sg.kode_barang, b.nama, sg.kode_gudang, sg.qty FROM mn_stok_gudang sg JOIN m_barang b ON b.kode_barang = sg.kode_barang ORDER BY sg.qty DESC"
$r3 = $cmd3.ExecuteReader()
Write-Host ""
Write-Host "=== TOP 10 STOK BARANG TERTINGGI ==="
while ($r3.Read()) {
    Write-Host ("{0} | {1} | gudang={2} | stok={3}" -f $r3["kode_barang"], $r3["nama"], $r3["kode_gudang"], $r3["qty"])
}
$r3.Close()

# Merk
$cmd4 = $conn.CreateCommand()
$cmd4.CommandText = "SELECT id_merk, nama_merk, prioritas, status FROM m_merk WHERE status=1 ORDER BY prioritas"
$r4 = $cmd4.ExecuteReader()
Write-Host ""
Write-Host "=== DAFTAR MERK AKTIF ==="
while ($r4.Read()) {
    Write-Host ("{0} | {1} | prioritas={2}" -f $r4["id_merk"], $r4["nama_merk"], $r4["prioritas"])
}
$r4.Close()

# Ringkasan sales bulanan dari POS
$cmd5 = $conn.CreateCommand()
$cmd5.CommandText = "SELECT TOP 6 FORMAT(CAST(created_at AS datetime2), 'yyyy-MM') AS bulan, COUNT(*) AS jml_transaksi, SUM(total) AS total_penjualan FROM pos_transactions WHERE status='Sukses' GROUP BY FORMAT(CAST(created_at AS datetime2), 'yyyy-MM') ORDER BY bulan DESC"
$r5 = $cmd5.ExecuteReader()
Write-Host ""
Write-Host "=== REKAP PENJUALAN POS PER BULAN (6 bulan terakhir) ==="
while ($r5.Read()) {
    Write-Host ("Bulan={0} | Transaksi={1} | Total=Rp {2:N0}" -f $r5["bulan"], $r5["jml_transaksi"], $r5["total_penjualan"])
}
$r5.Close()

$conn.Close()
Write-Host ""
Write-Host "=== SELESAI ==="
