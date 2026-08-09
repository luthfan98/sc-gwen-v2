$dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { "1433" }
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "db_gwen_v2" }
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "sa" }
$dbPassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "resmi12" }
$conn = New-Object System.Data.SqlClient.SqlConnection("Server=$dbHost,$dbPort;Database=$dbName;User Id=$dbUser;Password=$dbPassword;TrustServerCertificate=True;Encrypt=False;")
$conn.Open()

function Query($sql) {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $sql
    $reader = $cmd.ExecuteReader()
    $rows = @()
    while ($reader.Read()) {
        $row = @{}
        for ($i = 0; $i -lt $reader.FieldCount; $i++) {
            $row[$reader.GetName($i)] = $reader.GetValue($i)
        }
        $rows += [PSCustomObject]$row
    }
    $reader.Close()
    return $rows
}

Write-Host "=== 10 PRODUK TERBARU ==="
Query "SELECT TOP 10 kode_barang, nama, kode_merk, satuan_1, het_sat_1, hpp_avg_sat_1 FROM m_barang ORDER BY created_at DESC" | Format-Table -AutoSize

Write-Host "=== STOK PER GUDANG ==="
Query "SELECT kode_gudang, SUM(qty) AS total_stok, COUNT(DISTINCT kode_barang) AS jenis_barang FROM mn_stok_gudang GROUP BY kode_gudang" | Format-Table -AutoSize

Write-Host "=== STATUS RPO ==="
Query "SELECT status_rpo, COUNT(*) AS jumlah FROM GWEN_t_rpo GROUP BY status_rpo" | Format-Table -AutoSize

Write-Host "=== PROMOSI AKTIF ==="
Query "SELECT TOP 5 kode_t_promosi, nama_promosi, valid_from, valid_to FROM GWEN_t_promosi WHERE status_aktif=1 AND valid_to >= GETDATE() ORDER BY valid_from DESC" | Format-Table -AutoSize

Write-Host "=== RINGKASAN PELANGGAN POS ==="
Query "SELECT COUNT(*) AS total_pelanggan, SUM(total_points) AS total_poin FROM pos_customers" | Format-Table -AutoSize

Write-Host "=== REKAP PENGADAAN PER STATUS ==="
Query "SELECT status_pengadaan, COUNT(*) AS jumlah, SUM(total_akhir) AS total_nilai FROM GWEN_t_pengadaan GROUP BY status_pengadaan" | Format-Table -AutoSize

Write-Host "=== 5 SUPPLIER TERBESAR (by pengadaan) ==="
Query "SELECT TOP 5 p.kode_supplier, s.nama, COUNT(*) AS jml_po, SUM(p.total_akhir) AS total_nilai FROM GWEN_t_pengadaan p LEFT JOIN m_supplier s ON s.kode_supplier=p.kode_supplier GROUP BY p.kode_supplier, s.nama ORDER BY total_nilai DESC" | Format-Table -AutoSize

$conn.Close()
Write-Host "=== SELESAI ==="
