"use client";

import { useMemo, useState } from "react";
import { FileDown, Search } from "lucide-react";

type DetailRow = {
  central_trx_code: string | null;
  source_trx_code?: string | null;
  created_at: string | null;
  cashier_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  method: string | null;
  status: string | null;
  item_name: string | null;
  barcode: string | null;
  kode_supplier?: string | null;
  supplier_name?: string | null;
  kode_merk?: string | null;
  merk_name?: string | null;
  qty: number | null;
  unit_price: number | null;
  line_discount: number | null;
  line_total: number | null;
  promo_codes?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const getTodayStr = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const cleaned = value.replace("T", " ").trim();
  const [datePart, timePartRaw] = cleaned.split(" ");
  if (!datePart) return value;
  const [yyyy, mm, dd] = datePart.split("-");
  if (!yyyy || !mm || !dd) return value;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  const monthName = months[Number(mm) - 1] ?? mm;
  let timePart = timePartRaw || "00:00:00";
  if (timePart.includes(".")) timePart = timePart.split(".")[0];
  const [hh = "00", min = "00"] = timePart.split(":");
  return `${dd} ${monthName} ${yyyy}, ${hh}.${min}`;
};

const formatIDR = (value: number | string | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(Number(value || 0));

const getNomorNota = (row: DetailRow) => {
  const candidates = [row.source_trx_code, row.central_trx_code]
    .filter((val): val is string => typeof val === "string" && val.trim() !== "");
  const trxCandidate = candidates.find((val) => val.toUpperCase().includes("TRX"));
  return trxCandidate || row.source_trx_code || row.central_trx_code || "-";
};

export default function DetailTransaksiPage() {
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [filterFrom, setFilterFrom] = useState(getTodayStr);
  const [filterTo, setFilterTo] = useState(getTodayStr);
  const [searchTerm, setSearchTerm] = useState("");

  const handleApply = async () => {
    setApplied(true);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      const res = await fetch(`${API_BASE}/pos/transactions-detail-export?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed fetch detail transaksi", err);
      setRows([]);
      setError("Gagal memuat detail transaksi.");
    } finally {
      setLoading(false);
    }
  };

  const detailRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.item_name ||
          row.barcode ||
          Number(row.qty || 0) > 0 ||
          Number(row.unit_price || 0) > 0 ||
          Number(row.line_total || 0) > 0
      ),
    [rows]
  );

  const summary = useMemo(
    () =>
      detailRows.reduce(
        (acc, row) => {
          acc.totalQty += Number(row.qty || 0);
          acc.totalDiscount += Number(row.line_discount || 0);
          acc.totalAmount += Number(row.line_total || 0);
          return acc;
        },
        { totalQty: 0, totalDiscount: 0, totalAmount: 0 }
      ),
    [detailRows]
  );

  const handleExportExcel = async () => {
    if (detailRows.length === 0 || exporting) return;
    setExporting(true);
    try {
      const XLSXModule = await import("xlsx");
      const XLSX = (XLSXModule as any).default ?? XLSXModule;
      const headers = [
        "Trx Code",
        "Nomor Nota",
        "Tanggal",
        "Kasir",
        "Customer",
        "Phone",
        "Metode",
        "Status",
        "Nama Item",
        "Barcode",
        "Supplier",
        "Merk",
        "Qty",
        "Harga",
        "Diskon",
        "Total",
        "Kode Promo",
      ];
      const rowsExcel = detailRows.map((row) => [
        row.central_trx_code || "",
        getNomorNota(row) || "",
        formatDateTime(row.created_at || null),
        row.cashier_name || "",
        row.customer_name || "",
        row.customer_phone || "",
        row.method || "",
        row.status || "",
        row.item_name || "",
        row.barcode || "",
        row.supplier_name || row.kode_supplier || "",
        row.merk_name || row.kode_merk || "",
        Number(row.qty || 0),
        Number(row.unit_price || 0),
        Number(row.line_discount || 0),
        Number(row.line_total || 0),
        row.promo_codes || "",
      ]);
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rowsExcel]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Detail Transaksi");
      const filename = `detail-transaksi-${filterFrom || "all"}-${filterTo || "all"}.xlsx`;
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed export excel", err);
      alert("Gagal export Excel.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Menu Transaksi</p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Detail Transaksi</h1>
        <p className="text-sm text-slate-500">Data transaksi berbasis detail item barang.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-widest text-slate-400">Pencarian</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari trx, kasir, customer, phone..."
              className="w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-widest text-slate-400">Tanggal Dari</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-widest text-slate-400">Tanggal Sampai</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
            >
              <Search className="h-4 w-4" />
              Terapkan
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </section>

      {applied && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Item</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {detailRows.length.toLocaleString("id-ID")} baris
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Qty</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {summary.totalQty.toLocaleString("id-ID")}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Belanja</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{formatIDR(summary.totalAmount)}</p>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Data Detail Item</p>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!detailRows.length || loading || exporting}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            <FileDown className="h-4 w-4" />
            {exporting ? "Exporting..." : "Export Excel"}
          </button>
        </div>
        {!applied && (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Pilih filter lalu klik Terapkan untuk memuat data.
          </div>
        )}
        {applied && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Trx Code</th>
                  <th className="px-3 py-2 text-left">Nomor Nota</th>
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">Kasir</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-left">Metode</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Nama Item</th>
                  <th className="px-3 py-2 text-left">Barcode</th>
                  <th className="px-3 py-2 text-left">Supplier</th>
                  <th className="px-3 py-2 text-left">Merk</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Harga</th>
                  <th className="px-3 py-2 text-right">Diskon</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-left">Kode Promo</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={17} className="px-3 py-6 text-center text-slate-500">
                      Memuat data...
                    </td>
                  </tr>
                )}
                {!loading && detailRows.length === 0 && (
                  <tr>
                    <td colSpan={17} className="px-3 py-6 text-center text-slate-500">
                      Tidak ada data.
                    </td>
                  </tr>
                )}
                {!loading &&
                  detailRows.map((row, idx) => (
                    <tr key={`${row.central_trx_code || "trx"}-${idx}`} className="border-b border-slate-100">
                      <td className="px-3 py-2">{row.central_trx_code || "-"}</td>
                      <td className="px-3 py-2">{getNomorNota(row)}</td>
                      <td className="px-3 py-2">{formatDateTime(row.created_at || null)}</td>
                      <td className="px-3 py-2">{row.cashier_name || "-"}</td>
                      <td className="px-3 py-2">{row.customer_name || "-"}</td>
                      <td className="px-3 py-2">{row.customer_phone || "-"}</td>
                      <td className="px-3 py-2">{row.method || "-"}</td>
                      <td className="px-3 py-2">{row.status || "-"}</td>
                      <td className="px-3 py-2">{row.item_name || "-"}</td>
                      <td className="px-3 py-2">{row.barcode || "-"}</td>
                      <td className="px-3 py-2">{row.supplier_name || row.kode_supplier || "-"}</td>
                      <td className="px-3 py-2">{row.merk_name || row.kode_merk || "-"}</td>
                      <td className="px-3 py-2 text-right">{Number(row.qty || 0).toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2 text-right">{formatIDR(row.unit_price || 0)}</td>
                      <td className="px-3 py-2 text-right">{formatIDR(row.line_discount || 0)}</td>
                      <td className="px-3 py-2 text-right">{formatIDR(row.line_total || 0)}</td>
                      <td className="px-3 py-2">{row.promo_codes || "-"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
