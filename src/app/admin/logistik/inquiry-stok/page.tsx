"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, RefreshCw, ListChecks, ArrowLeft } from "lucide-react";

type GudangOption = {
  kode_gudang: string;
  nama: string;
};

type TokoOption = {
  kode_toko: string;
  nama_toko: string;
};

type StockItem = {
  kode_barang_variant: string | null;
  kode_gudang?: string | null;
  kode_toko?: string | null;
  stok: number | null;
  qty_baik?: number | null;
  qty_rusak?: number | null;
  minimum_stok: number | null;
  status: number | null;
  is_show: number | null;
  nama_varian: string | null;
  kode_varian: string | null;
  barcode_varian: string | null;
  kode_barang: string | null;
  nama_barang: string | null;
  satuan_1: string | null;
  kode_merk?: string | null;
  nama_merk?: string | null;
  kode_supplier?: string | null;
  nama_supplier?: string | null;
};

export default function InquiryStokPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [gudangOptions, setGudangOptions] = useState<GudangOption[]>([]);
  const [tokoOptions, setTokoOptions] = useState<TokoOption[]>([]);
  const [gudangLoading, setGudangLoading] = useState(false);
  const [tokoLoading, setTokoLoading] = useState(false);
  const [selectedLokasi, setSelectedLokasi] = useState("");
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;
  const [merkFilter, setMerkFilter] = useState<string>("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");
  const merkOptions = useMemo(() => {
    const values = new Map<string, string>();
    stockItems.forEach((item) => {
      const value = String(item.kode_merk || "").trim();
      if (!value) return;
      const label = String(item.nama_merk || value).trim();
      values.set(value, label);
    });
    return Array.from(values.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "id"));
  }, [stockItems]);
  const supplierOptions = useMemo(() => {
    const values = new Map<string, string>();
    stockItems.forEach((item) => {
      const value = String(item.kode_supplier || "").trim();
      if (!value) return;
      const label = String(item.nama_supplier || value).trim();
      values.set(value, label);
    });
    return Array.from(values.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "id"));
  }, [stockItems]);

  useEffect(() => {
    const fetchGudang = async () => {
      setGudangLoading(true);
      try {
        const res = await fetch(`${API_BASE}/gudang`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options = (Array.isArray(data) ? data : [])
          .filter((item) => Number(item?.status) === 1)
          .map((item) => ({ kode_gudang: String(item.kode_gudang), nama: String(item.nama || item.kode_gudang) }));
        setGudangOptions(options);
      } catch (err) {
        console.error("Failed fetch gudang", err);
        setGudangOptions([]);
      } finally {
        setGudangLoading(false);
      }
    };
    fetchGudang();
  }, [API_BASE]);

  useEffect(() => {
    const fetchToko = async () => {
      setTokoLoading(true);
      try {
        const res = await fetch(`${API_BASE}/toko`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options = (Array.isArray(data) ? data : [])
          .filter((item) => Number(item?.status) === 1)
          .map((item) => ({ kode_toko: String(item.kode_toko), nama_toko: String(item.nama_toko || item.kode_toko) }));
        setTokoOptions(options);
      } catch (err) {
        console.error("Failed fetch toko", err);
        setTokoOptions([]);
      } finally {
        setTokoLoading(false);
      }
    };
    fetchToko();
  }, [API_BASE]);

  const fetchStock = async (target: string, page = currentPage) => {
    if (!target) {
      setStockItems([]);
      setStockError(null);
      setTotalCount(0);
      return;
    }
    const [tipe, kode] = target.split("::");
    if (!tipe || !kode) {
      setStockItems([]);
      setStockError("Lokasi tidak valid.");
      setTotalCount(0);
      return;
    }
    setStockLoading(true);
    setStockError(null);
    try {
      const baseUrl =
        tipe === "TOKO"
          ? `${API_BASE}/toko/${encodeURIComponent(kode)}/stock`
          : `${API_BASE}/gudang/${encodeURIComponent(kode)}/stock`;
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (query.trim()) params.set("q", query.trim());
      if (onlyAvailable) params.set("only_available", "1");
      if (merkFilter !== "ALL") params.set("kode_merk", merkFilter);
      if (supplierFilter !== "ALL") params.set("kode_supplier", supplierFilter);
      const res = await fetch(`${baseUrl}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setStockItems(data);
        setTotalCount(data.length);
      } else {
        setStockItems(Array.isArray(data?.items) ? data.items : []);
        setTotalCount(Number(data?.total ?? 0));
      }
    } catch (err) {
      console.error("Failed fetch stock", err);
      setStockItems([]);
      setStockError("Gagal memuat stok.");
      setTotalCount(0);
    } finally {
      setStockLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLokasi) {
      fetchStock(selectedLokasi, currentPage);
    } else {
      setStockItems([]);
      setTotalCount(0);
    }
  }, [selectedLokasi, currentPage, query, onlyAvailable, merkFilter, supplierFilter]);

  useEffect(() => {
    setCurrentPage(1);
    setMerkFilter("ALL");
    setSupplierFilter("ALL");
  }, [selectedLokasi]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, onlyAvailable, merkFilter, supplierFilter]);

  const filteredItems = useMemo(() => {
    if (merkFilter === "ALL" && supplierFilter === "ALL") return stockItems;
    return stockItems.filter((item) => {
      if (merkFilter !== "ALL" && String(item.kode_merk || "") !== merkFilter) return false;
      if (supplierFilter !== "ALL" && String(item.kode_supplier || "") !== supplierFilter) return false;
      return true;
    });
  }, [stockItems, merkFilter, supplierFilter]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const exportRows = filteredItems;

  const handleExportCsv = () => {
    if (exportRows.length === 0) return;
    const headers = [
      "Nama Barang",
      "Nama Varian",
      "Barcode",
      "Merk",
      "Supplier",
      "Qty Baik",
      "Qty Rusak",
      "Satuan",
    ];
    const escapeCsv = (val: string) => `"${val.replace(/\"/g, '""')}"`;
    const lines = [
      headers.join(","),
      ...exportRows.map((item) =>
        [
          item.nama_barang || "",
          item.nama_varian || "",
          item.barcode_varian || "",
          item.nama_merk || item.kode_merk || "",
          item.nama_supplier || item.kode_supplier || "",
          String(item.qty_baik ?? item.stok ?? 0),
          String(item.qty_rusak ?? 0),
          item.satuan_1 || "PCS",
        ]
          .map((v) => escapeCsv(String(v)))
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inquiry-stok-${selectedLokasi || "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (exportRows.length === 0) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const rowsHtml = exportRows
      .map(
        (item) => `
        <tr>
          <td>${item.nama_barang || "-"}</td>
          <td>${item.nama_varian || "-"}</td>
          <td>${item.barcode_varian || "-"}</td>
          <td>${item.nama_merk || item.kode_merk || "-"}</td>
          <td>${item.nama_supplier || item.kode_supplier || "-"}</td>
          <td>${item.qty_baik ?? item.stok ?? 0}</td>
          <td>${item.qty_rusak ?? 0}</td>
          <td>${item.satuan_1 || "PCS"}</td>
        </tr>`
      )
      .join("");
    win.document.write(`
      <html>
        <head>
          <title>Inquiry Stok</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            h2 { margin: 0 0 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h2>Inquiry Stok ${selectedLokasi ? `(${selectedLokasi})` : ""}</h2>
          <table>
            <thead>
              <tr>
                <th>Nama Barang</th>
                <th>Nama Varian</th>
                <th>Barcode</th>
                <th>Merk</th>
                <th>Supplier</th>
                <th>Qty Baik</th>
                <th>Qty Rusak</th>
                <th>Satuan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-4 md:p-6 space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <ListChecks className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-600">Logistik</p>
            <h1 className="text-2xl font-semibold text-gray-900">Inquiry Stok</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/dashboard-pramuniaga"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to menu
          </Link>
          <button
            type="button"
            onClick={() => fetchStock(selectedLokasi, currentPage)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
        <div className="grid lg:grid-cols-6 gap-3 items-end">
          <label className="space-y-1 text-sm lg:col-span-2">
            <span className="text-gray-600">Lokasi</span>
            <select
              value={selectedLokasi}
              onChange={(e) => setSelectedLokasi(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 bg-white"
            >
              <option value="">{gudangLoading || tokoLoading ? "Memuat lokasi..." : "Pilih lokasi"}</option>
              {gudangOptions.map((item) => (
                <option key={item.kode_gudang} value={`GUDANG::${item.kode_gudang}`}>
                  Gudang: {item.nama} ({item.kode_gudang})
                </option>
              ))}
              {tokoOptions.map((item) => (
                <option key={item.kode_toko} value={`TOKO::${item.kode_toko}`}>
                  Toko: {item.nama_toko} ({item.kode_toko})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm lg:col-span-2">
            <span className="text-gray-600">Pencarian</span>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari barang, varian, barcode..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-600">Merk</span>
            <select
              value={merkFilter}
              onChange={(e) => setMerkFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 bg-white"
            >
              <option value="ALL">Semua merk</option>
              {merkOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-600">Supplier</span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 bg-white"
            >
              <option value="ALL">Semua supplier</option>
              {supplierOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
            />
            Stok &gt; 0
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between text-sm">
          <p className="text-gray-600">Daftar Stok</p>
          <p className="text-gray-500">Total: {totalCount}</p>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Nama Barang</th>
                <th className="px-4 py-2">Nama Varian</th>
                <th className="px-4 py-2">Barcode</th>
                <th className="px-4 py-2">Merk</th>
                <th className="px-4 py-2">Supplier</th>
                <th className="px-4 py-2">Qty Baik</th>
                <th className="px-4 py-2">Qty Rusak</th>
                <th className="px-4 py-2">Satuan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stockLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!stockLoading && stockError && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-rose-600">
                    {stockError}
                  </td>
                </tr>
              )}
              {!stockLoading && !stockError && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    {selectedLokasi ? "Tidak ada stok untuk filter ini." : "Pilih lokasi terlebih dahulu."}
                  </td>
                </tr>
              )}
              {!stockLoading &&
                !stockError &&
                filteredItems.map((item, idx) => (
                  <tr key={`${item.kode_barang_variant || "stok"}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-900">{item.nama_barang || "-"}</td>
                    <td className="px-4 py-2 text-gray-700">{item.nama_varian || "-"}</td>
                    <td className="px-4 py-2 text-gray-600">{item.barcode_varian || "-"}</td>
                    <td className="px-4 py-2 text-gray-700">{item.nama_merk || item.kode_merk || "-"}</td>
                    <td className="px-4 py-2 text-gray-700">{item.nama_supplier || item.kode_supplier || "-"}</td>
                    <td className="px-4 py-2">{item.qty_baik ?? item.stok ?? 0}</td>
                    <td className="px-4 py-2">{item.qty_rusak ?? 0}</td>
                    <td className="px-4 py-2">{item.satuan_1 || "PCS"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!stockLoading && !stockError && totalCount > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="text-gray-600">
              Menampilkan {Math.min((safePage - 1) * pageSize + 1, totalCount)}-
              {Math.min(safePage * pageSize, totalCount)} dari {totalCount}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safePage === 1}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-xs text-gray-600">
                Page {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage >= totalPages}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
