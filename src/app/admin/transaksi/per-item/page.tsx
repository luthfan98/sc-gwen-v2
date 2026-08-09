"use client";

import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { FileText, RefreshCcw, X } from "lucide-react";

type ItemSummary = {
  item_key: string | null;
  item_code: string | null;
  barcode: string | null;
  item_name: string | null;
  kode_barang_variant: string | null;
  kode_supplier: string | null;
  supplier_name: string | null;
  kode_merk: string | null;
  merk_name: string | null;
  harga_jual: number | null;
  total_qty: number | null;
  total_sales: number | null;
  total_discount: number | null;
};

type ItemDetailRow = {
  central_trx_code: string | null;
  created_at: string | null;
  status: string | null;
  customer_name: string | null;
  qty: number | null;
  line_total: number | null;
  line_discount: number | null;
};

type SupplierOption = { kode_supplier: string; nama: string };
type MerkOption = { kode_merk: string; nama_merk: string };

export default function TransaksiPerItemPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const getTodayStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [rows, setRows] = useState<ItemSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterFrom, setFilterFrom] = useState(getTodayStr);
  const [filterTo, setFilterTo] = useState(getTodayStr);
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterMerk, setFilterMerk] = useState("all");
  const [search, setSearch] = useState("");
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [merkOptions, setMerkOptions] = useState<MerkOption[]>([]);
  const [detailItem, setDetailItem] = useState<{
    item: ItemSummary;
    rows: ItemDetailRow[];
    loading: boolean;
    error: string | null;
  } | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("from", filterFrom);
      params.set("to", filterTo);
      if (filterSupplier !== "all") params.set("supplier", filterSupplier);
      if (filterMerk !== "all") params.set("merk", filterMerk);
      const url = `${API_BASE}/pos/transaction-items-summary?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [supRes, merkRes] = await Promise.all([
          fetch(`${API_BASE}/pos/suppliers`),
          fetch(`${API_BASE}/pos/merks`),
        ]);
        const supData = supRes.ok ? await supRes.json() : [];
        const merkData = merkRes.ok ? await merkRes.json() : [];
        setSupplierOptions(Array.isArray(supData) ? supData : []);
        setMerkOptions(Array.isArray(merkData) ? merkData : []);
      } catch {
        setSupplierOptions([]);
        setMerkOptions([]);
      }
    };
    loadOptions();
  }, [API_BASE]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!detailItem) return;
      try {
        const params = new URLSearchParams();
        params.set("item_key", detailItem.item.item_key || "");
        params.set("from", filterFrom);
        params.set("to", filterTo);
        const url = `${API_BASE}/pos/transaction-items-detail?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setDetailItem((prev) =>
          prev
            ? { ...prev, rows: Array.isArray(data) ? data : [], loading: false, error: null }
            : prev
        );
      } catch (err: any) {
        setDetailItem((prev) =>
          prev ? { ...prev, loading: false, error: err?.message || "Gagal memuat detail." } : prev
        );
      }
    };

    loadDetail();
  }, [detailItem?.item.item_code, API_BASE, filterFrom, filterTo]);

  const formatIDR = (value: number | string | null) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(
      Number(value || 0)
    );

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

  const totalQty = useMemo(
    () => rows.reduce((acc, row) => acc + Number(row.total_qty || 0), 0),
    [rows]
  );
  const totalSales = useMemo(
    () => rows.reduce((acc, row) => acc + Number(row.total_sales || 0), 0),
    [rows]
  );
  const totalDiscount = useMemo(
    () => rows.reduce((acc, row) => acc + Number(row.total_discount || 0), 0),
    [rows]
  );

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const term = search.toLowerCase();
    return rows.filter((row) => {
      return (
        (row.item_name || "").toLowerCase().includes(term) ||
        (row.barcode || "").toLowerCase().includes(term) ||
        (row.kode_barang_variant || "").toLowerCase().includes(term)
      );
    });
  }, [rows, search]);

  const exportCsv = () => {
    const headers = [
      "Nama Item",
      "Barcode",
      "Kode Varian",
      "Harga Jual",
      "Qty Terjual",
      "Total Diskon",
      "Total Penjualan",
    ];
    const lines = [headers.join(",")];
    filteredRows.forEach((row) => {
      const values = [
        row.item_name || "",
        row.barcode || "",
        row.kode_barang_variant || "",
        Number(row.harga_jual || 0),
        Number(row.total_qty || 0),
        Number(row.total_discount || 0),
        Number(row.total_sales || 0),
      ].map((value) => {
        const str = String(value ?? "");
        return `"${str.replace(/"/g, '""')}"`;
      });
      lines.push(values.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transaksi-per-item_${filterFrom}_${filterTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (filteredRows.length === 0) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const printTotalSales = filteredRows.reduce(
      (acc, row) => acc + Number(row.total_sales || 0),
      0
    );
    const rowsHtml = filteredRows
      .map(
        (row, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${row.item_name || "-"}</td>
          <td>${row.barcode || "-"}</td>
          <td>${row.kode_barang_variant || "-"}</td>
          <td>${formatIDR(row.harga_jual || 0)}</td>
          <td>${Number(row.total_qty || 0)}</td>
          <td>${formatIDR(row.total_discount || 0)}</td>
          <td>${formatIDR(row.total_sales || 0)}</td>
        </tr>
      `
      )
      .join("");
    win.document.write(`
      <html>
        <head>
          <title>Transaksi per Item</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            h2 { margin: 0 0 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background: #f3f4f6; }
            tfoot td { font-weight: 700; background: #f8fafc; }
            .summary { margin: 0 0 12px; font-size: 13px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h2>Transaksi per Item</h2>
          <div style="margin-bottom:8px;font-size:12px;color:#555;">
            Periode: ${filterFrom} - ${filterTo}
          </div>
          <div class="summary">Total Penjualan: ${formatIDR(printTotalSales)}</div>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Item</th>
                <th>Barcode</th>
                <th>Kode Varian</th>
                <th>Harga Jual</th>
                <th>Qty Terjual</th>
                <th>Total Diskon</th>
                <th>Total Penjualan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="7" style="text-align:right;">Total Penjualan</td>
                <td>${formatIDR(printTotalSales)}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const supplierList = useMemo(
    () => supplierOptions.map((opt) => ({ value: opt.kode_supplier, label: opt.nama })),
    [supplierOptions]
  );

  const merkList = useMemo(
    () => merkOptions.map((opt) => ({ value: opt.kode_merk, label: opt.nama_merk })),
    [merkOptions]
  );

  const supplierSelectOptions = useMemo(
    () => [{ value: "all", label: "Semua" }, ...supplierList],
    [supplierList]
  );

  const merkSelectOptions = useMemo(
    () => [{ value: "all", label: "Semua" }, ...merkList],
    [merkList]
  );

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      minHeight: "36px",
      borderRadius: "0.75rem",
      borderColor: "#e2e8f0",
      boxShadow: "none",
      fontSize: "0.75rem",
      fontWeight: 600,
      paddingLeft: "0.25rem",
    }),
    valueContainer: (base: any) => ({ ...base, padding: "0 8px" }),
    indicatorsContainer: (base: any) => ({ ...base, height: "36px" }),
    singleValue: (base: any) => ({ ...base, color: "#334155" }),
    placeholder: (base: any) => ({ ...base, color: "#94a3b8" }),
    menu: (base: any) => ({ ...base, zIndex: 50 }),
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-100 bg-white/90 shadow-sm px-6 py-5 md:px-7 md:py-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Menu Transaksi</p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Transaksi per Item</h1>
            <p className="text-sm text-slate-500">Ringkasan penjualan item.</p>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total Qty</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalQty}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total Penjualan</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatIDR(totalSales)}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total Diskon</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatIDR(totalDiscount)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Data</p>
              <p className="text-base font-semibold text-slate-800">Transaksi per Item</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchRows}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-700"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Tanggal Dari</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm h-[36px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Tanggal Sampai</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm h-[36px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Supplier</label>
              <Select
                instanceId="supplier-select"
                value={supplierSelectOptions.find((opt) => opt.value === filterSupplier)}
                onChange={(opt) => setFilterSupplier((opt as any)?.value || "all")}
                options={supplierSelectOptions}
                styles={selectStyles}
                className="min-w-[200px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Merk</label>
              <Select
                instanceId="merk-select"
                value={merkSelectOptions.find((opt) => opt.value === filterMerk)}
                onChange={(opt) => setFilterMerk((opt as any)?.value || "all")}
                options={merkSelectOptions}
                styles={selectStyles}
                className="min-w-[200px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Pencarian</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama / barcode / kode varian"
                className="w-[260px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm h-[36px]"
              />
            </div>
            <button
              type="button"
              onClick={fetchRows}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 h-[36px]"
            >
              Terapkan Filter
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 h-[36px]"
            >
              Export Excel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 h-[36px]"
            >
              <FileText className="w-4 h-4" />
              Print
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Filter tanggal otomatis dari jam 00:00 sampai 23:59.
          </div>
        </div>

        {loading ? (
          <div className="p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="h-3 w-64 rounded bg-slate-200" />
              <div className="h-64 rounded-2xl bg-slate-100" />
            </div>
          </div>
        ) : error ? (
          <div className="py-10 text-center text-sm text-rose-600">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">Tidak ada data.</div>
        ) : (
          <div className="w-full overflow-auto max-h-[60vh]">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3">No</th>
                  <th className="px-3 py-3">Nama Item</th>
                  <th className="px-3 py-3">Barcode</th>
                  <th className="px-3 py-3">Kode Varian</th>
                  <th className="px-3 py-3">Harga Jual</th>
                  <th className="px-3 py-3">Qty Terjual</th>
                  <th className="px-3 py-3">Total Diskon</th>
                  <th className="px-3 py-3">Total Penjualan</th>
                  <th className="px-3 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, idx) => (
                  <tr
                    key={`${row.item_code ?? "item"}-${idx}`}
                    className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}
                  >
                    <td className="px-3 py-2 text-slate-700">{idx + 1}</td>
                    <td className="px-3 py-2 text-slate-700">{row.item_name || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{row.barcode || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{row.kode_barang_variant || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{formatIDR(row.harga_jual || 0)}</td>
                    <td className="px-3 py-2 text-slate-700">{Number(row.total_qty || 0)}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {formatIDR(row.total_discount || 0)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {formatIDR(row.total_sales || 0)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <button
                        type="button"
                        onClick={() =>
                          setDetailItem({
                            item: row,
                            rows: [],
                            loading: true,
                            error: null,
                          })
                        }
                        className="rounded-full border border-amber-700 bg-amber-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-amber-700"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Detail Penjualan Item</h2>
                <p className="text-xs text-slate-500">{detailItem.item.item_name || "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Periode:</span> {filterFrom} - {filterTo}
              </div>
            </div>
            <div className="mt-4">
              {detailItem.loading ? (
                <div className="py-6 text-center text-sm text-slate-500">Memuat detail...</div>
              ) : detailItem.error ? (
                <div className="py-6 text-center text-sm text-rose-600">{detailItem.error}</div>
              ) : (
                <div className="w-full overflow-auto max-h-[60vh]">
                  <table className="w-full min-w-[800px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-3">No</th>
                        <th className="px-3 py-3">Kode Transaksi</th>
                        <th className="px-3 py-3">Tanggal</th>
                        <th className="px-3 py-3">Customer</th>
                        <th className="px-3 py-3">Qty</th>
                        <th className="px-3 py-3">Diskon</th>
                        <th className="px-3 py-3">Total</th>
                        <th className="px-3 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailItem.rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-3 text-center text-slate-500">
                            Tidak ada data.
                          </td>
                        </tr>
                      ) : (
                        detailItem.rows.map((row, idx) => (
                          <tr key={`${row.central_trx_code ?? "trx"}-${idx}`}>
                            <td className="px-3 py-2 text-slate-700">{idx + 1}</td>
                            <td className="px-3 py-2 text-slate-700">{row.central_trx_code || "-"}</td>
                            <td className="px-3 py-2 text-slate-700">
                              {formatDateTime(row.created_at)}
                            </td>
                            <td className="px-3 py-2 text-slate-700">{row.customer_name || "-"}</td>
                            <td className="px-3 py-2 text-slate-700">{row.qty ?? 0}</td>
                            <td className="px-3 py-2 text-slate-700">
                              {formatIDR(row.line_discount || 0)}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {formatIDR(row.line_total || 0)}
                            </td>
                            <td className="px-3 py-2 text-slate-700">{row.status || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
