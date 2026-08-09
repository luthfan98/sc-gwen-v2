# Rekap Fitur (berdasarkan struktur folder)

Ringkasan jumlah:
- 92 halaman UI (Next.js `src/app/**/page.tsx`).
- 36 modul API backend (`BACKEND/src/routes/*.js`).

Catatan:
- Fitur di bawah disimpulkan dari nama route/halaman dan file route, belum menelusuri detail implementasi per komponen.

## Frontend - Publik / Store
- Beranda: `/`.
- Halaman dinamis: `/[slug]` (konten dinamis/landing sesuai slug).
- Brand publik: daftar brand dan detail brand `/brands/[slug]`.
- Produk publik: detail produk `/product/[slug]`.
- Cek harga: `/cek-harga`.
- Store (e-commerce):
  - Daftar produk `/store/products`.
  - Daftar brand `/store/brand` dan detail `/store/brands/[slug]`.
  - Kategori `/store/kategori`.
  - Keranjang `/store/cart`.
  - Login customer `/store/login`.
  - Registrasi customer `/store/register`.
- Penjualan (front-of-house):
  - Beranda penjualan `/penjualan`.
  - Login kasir `/penjualan/login`.
  - POS `/penjualan/pos`.
  - Inquiry transaksi `/penjualan/inquiry` dan detail `/penjualan/inquiry/[id]`.
  - Retur `/penjualan/retur` dan retur baru `/penjualan/retur/baru`.
- Penerimaan barang (front-of-house):
  - Beranda penerimaan `/penerimaan-barang`.
  - Login penerimaan `/penerimaan-barang/login`.
  - Detail penerimaan `/penerimaan-barang/[id]`.
  - Supplier list `/penerimaan-barang/supplier`.
  - Detail supplier `/penerimaan-barang/supplier/[kode]` dan print `/penerimaan-barang/supplier/[kode]/print`.
  - LPB detail `/penerimaan-barang/LPB/[kode]` dan print `/penerimaan-barang/LPB/[kode]/print`.
- Logout: `/logout`.

## Admin - Umum
- Admin root `/admin`.
- Login admin `/admin/login`.
- Dashboard admin `/admin/dashboard`.
- Dashboard pramuniaga `/admin/dashboard-pramuniaga`.

## Admin - Logistik
- Inquiry stok `/admin/logistik/inquiry-stok`.
- Pemindahan stok:
  - List `/admin/logistik/pemindahan-stok`.
  - Buat baru `/admin/logistik/pemindahan-stok/new`.
  - Print dokumen `/admin/logistik/pemindahan-stok/print/[kode]`.
- Terima pemindahan:
  - List `/admin/logistik/terima-pemindahan`.
  - Detail `/admin/logistik/terima-pemindahan/[kode]`.
  - Print `/admin/logistik/terima-pemindahan/print/[kode]`.

## Admin - Master Data
- Armada `/admin/master/armada`.
- Barang:
  - List `/admin/master/barang`.
  - Tambah `/admin/master/barang/new`.
  - Edit `/admin/master/barang/edit/[id]`.
  - Barcode `/admin/master/barang/barcode`.
- Barang kelas harga `/admin/master/barang-kelas-harga`.
- Channel `/admin/master/channel`.
- Channel pricing rule `/admin/master/channel-pricing-rule`.
- Customer:
  - List `/admin/master/customer`.
  - Tambah `/admin/master/customer/new`.
- Etalase `/admin/master/etalase`.
- Gudang `/admin/master/gudang`.
- Harga jual:
  - List `/admin/master/harga-jual`.
  - Tambah `/admin/master/harga-jual/new`.
  - Approval list `/admin/master/harga-jual/approval`.
  - Approval detail `/admin/master/harga-jual/approval/[kode]`.
- Kelas harga `/admin/master/kelas-harga`.
- Klasifikasi `/admin/master/klasifikasi`.
- Kontak supplier `/admin/master/kontak-supplier`.
- Kontrabon:
  - History `/admin/master/kontrabon/history` dan print `/admin/master/kontrabon/history/print`.
  - Rekap list `/admin/master/kontrabon/rekap`.
  - Rekap detail `/admin/master/kontrabon/rekap/[id]`.
  - Rekap print `/admin/master/kontrabon/rekap/[id]/print`.
  - Rekening supplier `/admin/master/kontrabon/rekening-supplier`.
- Merk `/admin/master/merk`.
- Promosi:
  - Promosi umum `/admin/master/promosi`.
  - Promosi refraksi `/admin/master/promosi/refraksi`.
  - Voucher `/admin/master/promosi/voucher`.
- Sales `/admin/master/sales`.
- Site `/admin/master/site`.
- Supir `/admin/master/supir`.
- Supplier `/admin/master/supplier`.
- Users `/admin/master/users`.

## Admin - Penjualan
- Ringkasan penjualan `/admin/penjualan`.
- Inquiry penjualan `/admin/penjualan/inquiry` dan detail `/admin/penjualan/inquiry/[id]`.
- POS `/admin/penjualan/pos`.

## Admin - Purchasing
- Harga pembelian `/admin/purchasing/harga`.
- Listing pembelian `/admin/purchasing/listing`.
- Permintaan pengadaan:
  - List `/admin/purchasing/permintaan-pengadaan`.
  - Buat baru `/admin/purchasing/permintaan-pengadaan/new`.
  - Preview `/admin/purchasing/permintaan-pengadaan/preview`.
- PO:
  - Buat baru `/admin/purchasing/po/new`.
  - Print PO `/admin/purchasing/po/print`.
- Tagihan `/admin/purchasing/tagihan`.

## Admin - Transaksi & Laporan
- History transaksi `/admin/transaksi/history`.
- Inquiry stok `/admin/transaksi/inquiry-stok`.
- Mutasi barang `/admin/transaksi/mutasi-barang`.
- Transaksi per item `/admin/transaksi/per-item`.
- Program promosi `/admin/transaksi/program-promosi`.
- Rekapan harian `/admin/transaksi/rekapan-harian`.
- Rilis RPO cepat `/admin/transaksi/rilis-rpo-cepat`.

## Backend API (modul route)
- `auth` (autentikasi).
- `barang`, `barang-kelas-harga`, `barcode-manual` (data barang & barcode).
- `channel`, `channel-pricing-rule`.
- `dashboard`.
- `doc-code` (kode dokumen).
- `etalase`.
- `gudang`.
- `harga-jual-request`.
- `health`.
- `index` (route agregasi).
- `inquiry-stok`.
- `kelas-harga`, `klasifikasi`.
- `kontrabon`.
- `lpb`.
- `merk`.
- `mutasi-barang`.
- `pemindahan`, `penerimaan-pemindahan`.
- `penerimaan-pengadaan`, `pengadaan`.
- `pos-transactions`.
- `promo-voucher`, `promos`.
- `rekapan-harian`.
- `rekening-supplier`.
- `rpo`.
- `site`.
- `suppliers`.
- `tagihan`.
- `toko`.
- `uploads`.
- `users`.
