"use client";

import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { FileText, RefreshCcw, Eye, X, Store, Warehouse, Boxes } from "lucide-react";

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
  stok_toko?: number | null;
  stok_gudang?: number | null;
  total_stok?: number | null;
  qty_po_tertinggi?: number | null;
};

type StockStoreItem = {
  kode_toko: string;
  nama_toko: string;
  stok: number;
  qty_baik: number;
  qty_rusak: number;
};

type StockWarehouseItem = {
  kode_gudang: string;
  nama_gudang: string;
  jenis_gudang: string;
  is_gudang_bs: number;
  stok: number;
  qty_baik: number;
  qty_rusak: number;
};

type StockDetailData = {
  kode_barang_variant: string;
  item_name: string;
  barcode: string;
  total_stok: number;
  total_toko: number;
  total_gudang: number;
  toko: StockStoreItem[];
  gudang: StockWarehouseItem[];
};

type SupplierOption = { kode_supplier: string; nama: string };
type MerkOption = { kode_merk: string; nama_merk: string };

export default function TransaksiPerItemPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [rows, setRows] = useState<ItemSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterMerk, setFilterMerk] = useState("all");
  const [search, setSearch] = useState("");
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [merkOptions, setMerkOptions] = useState<MerkOption[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [qtyPoTerakhirByKey, setQtyPoTerakhirByKey] = useState<Record<string, number>>({});
  const [saranPoByKey, setSaranPoByKey] = useState<Record<string, number>>({});
  const [editedSaranKeys, setEditedSaranKeys] = useState<Set<string>>(new Set());
  const [stockDetailModal, setStockDetailModal] = useState<{
    isOpen: boolean;
    loading: boolean;
    data: StockDetailData | null;
    error: string | null;
    itemName: string;
    barcode: string;
  }>({
    isOpen: false,
    loading: false,
    data: null,
    error: null,
    itemName: "",
    barcode: "",
  });

  const getItemTotalStock = (row: ItemSummary) => {
    if (row.total_stok !== undefined && row.total_stok !== null) {
      return Number(row.total_stok);
    }
    return Number(row.stok_toko || 0) + Number(row.stok_gudang || 0);
  };

  const handleOpenStockDetail = async (row: ItemSummary) => {
    const itemName = row.item_name || "-";
    const barcode = row.barcode || "-";
    setStockDetailModal({
      isOpen: true,
      loading: true,
      data: null,
      error: null,
      itemName,
      barcode,
    });

    try {
      const params = new URLSearchParams();
      if (row.kode_barang_variant) params.set("kode_barang_variant", row.kode_barang_variant);
      if (row.barcode) params.set("barcode", row.barcode);
      if (row.item_code) params.set("item_code", row.item_code);

      const res = await fetch(`${API_BASE}/pos/transaction-items-stock-detail?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStockDetailModal((prev) => ({
        ...prev,
        loading: false,
        data,
      }));
    } catch (err: any) {
      setStockDetailModal((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || "Gagal memuat rincian stok lokasi",
      }));
    }
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
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

  const formatIDR = (value: number | string | null) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(
      Number(value || 0)
    );

  const totalQty = useMemo(
    () => rows.reduce((acc, row) => acc + Number(row.total_qty || 0), 0),
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

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [filteredRows]);

  useEffect(() => {
    setQtyPoTerakhirByKey((prev) => {
      const next = { ...prev };
      filteredRows.forEach((row) => {
        const key = String(row.item_key || row.item_code || row.barcode || "");
        if (!key) return;
        if (next[key] === undefined) {
          next[key] = Number(row.qty_po_tertinggi || 0);
        }
      });
      return next;
    });
  }, [filteredRows]);

  useEffect(() => {
    setSaranPoByKey((prev) => {
      const next = { ...prev };
      filteredRows.forEach((row) => {
        const key = String(row.item_key || row.item_code || row.barcode || "");
        if (!key) return;
        if (editedSaranKeys.has(key)) return;
        const qtyTerjual = Number(row.total_qty || 0);
        const qtyPoTerakhir = Number(qtyPoTerakhirByKey[key] ?? 0);
        next[key] = calcSaranOrder(qtyPoTerakhir, qtyTerjual);
      });
      return next;
    });
  }, [filteredRows, qtyPoTerakhirByKey, editedSaranKeys]);

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(new Set(filteredRows.map((row) => String(row.item_key || row.item_code || row.barcode || ""))));
  };

  const toggleRow = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const exportCsv = () => {
    const headers = [
      "Nama Item",
      "Barcode",
      "Qty PO Terakhir",
      "Sisa Stok",
      "Saran PO",
    ];
    const lines = [headers.join(",")];
    filteredRows.forEach((row) => {
      const key = String(row.item_key || row.item_code || row.barcode || "");
      const qtyTerjual = Number(row.total_qty || 0);
      const qtyPoTerakhir = Number(qtyPoTerakhirByKey[key] ?? 0);
      const sisaStok = Number(row.stok_toko || 0);
      const saran = Number(saranPoByKey[key] ?? calcSaranOrder(qtyPoTerakhir, qtyTerjual));
      const values = [
        row.item_name || "",
        row.barcode || "",
        qtyPoTerakhir,
        sisaStok,
        saran,
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
    link.download = `transaksi-per-item_all.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (filteredRows.length === 0) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const rowsHtml = filteredRows
      .map(
        (row, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${row.item_name || "-"}</td>
          <td>${row.barcode || "-"}</td>
          <td>${Number(qtyPoTerakhirByKey[String(row.item_key || row.item_code || row.barcode || "")] ?? 0)}</td>
          <td>${Number(row.stok_toko || 0)}</td>
          <td>${Number(
            saranPoByKey[String(row.item_key || row.item_code || row.barcode || "")] ??
              calcSaranOrder(
                Number(qtyPoTerakhirByKey[String(row.item_key || row.item_code || row.barcode || "")] ?? 0),
                Number(row.total_qty || 0)
              )
          )}</td>
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
          </style>
        </head>
        <body>
          <h2>Transaksi per Item</h2>
          <div style="margin-bottom:8px;font-size:12px;color:#555;">
            Periode: Semua
          </div>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Item</th>
                <th>Barcode</th>
                <th>Qty PO Terakhir</th>
                <th>Sisa Stok</th>
                <th>Saran PO</th>
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

  const calcSaranOrder = (qtyPoTerakhir: number, qtyTerjual: number) => {
    const diff = Number(qtyPoTerakhir || 0) - Number(qtyTerjual || 0);
    const base = diff <= 0 ? Number(qtyPoTerakhir || 0) : diff;
    if (base <= 0) return 0;
    return Math.ceil(base / 3) * 3;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-100 bg-white/90 shadow-sm px-6 py-5 md:px-7 md:py-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Menu Transaksi</p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">RILIS RPO Cepat</h1>
            <p className="text-sm text-slate-500">Rekomendasi cepat untuk rilis RPO.</p>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total Qty</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalQty}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400">Dipilih</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{selectedKeys.size}</p>
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
              <p className="text-base font-semibold text-slate-800">RILIS RPO Cepat</p>
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
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Supplier</label>
              <Select
                instanceId="supplier-select"
                value={supplierSelectOptions.find((opt) => opt.value === filterSupplier)}
                onChange={(opt: any) => setFilterSupplier(opt?.value || "all")}
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
                onChange={(opt: any) => setFilterMerk(opt?.value || "all")}
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
                  <th className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredRows.length > 0 &&
                        filteredRows.every((row) =>
                          selectedKeys.has(String(row.item_key || row.item_code || row.barcode || ""))
                        )
                      }
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-3">Nama Item</th>
                  <th className="px-3 py-3">Barcode</th>
                  <th className="px-3 py-3">Qty PO Terakhir</th>
                  <th className="px-3 py-3">Total Stok</th>
                  <th className="px-3 py-3">Saran PO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, idx) => (
                  <tr
                    key={`${row.item_code ?? "item"}-${idx}`}
                    className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}
                  >
                    <td className="px-3 py-2 text-slate-700">{idx + 1}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(String(row.item_key || row.item_code || row.barcode || ""))}
                        onChange={(e) =>
                          toggleRow(
                            String(row.item_key || row.item_code || row.barcode || ""),
                            e.target.checked
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.item_name || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{row.barcode || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {Number(qtyPoTerakhirByKey[String(row.item_key || row.item_code || row.barcode || "")] ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {Number(row.stok_toko || 0)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <input
                        type="number"
                        min={0}
                        value={saranPoByKey[String(row.item_key || row.item_code || row.barcode || "")] ?? 0}
                        onChange={(e) =>
                          {
                            const key = String(row.item_key || row.item_code || row.barcode || "");
                            const value = Number(e.target.value || 0);
                            setSaranPoByKey((prev) => ({
                              ...prev,
                              [key]: value,
                            }));
                            setEditedSaranKeys((prev) => {
                              const next = new Set(prev);
                              next.add(key);
                              return next;
                            });
                          }
                        }
                        className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Modal Detail Rincian Stok Toko & Seluruh Gudang */}
      {stockDetailModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shadow-xs">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Detail Rincian Stok</h2>
                  <p className="text-xs text-slate-500">Distribusi stok di Toko dan seluruh Gudang</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockDetailModal((prev) => ({ ...prev, isOpen: false }))}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Info Item */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Nama Item</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {stockDetailModal.data?.item_name || stockDetailModal.itemName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {stockDetailModal.barcode && stockDetailModal.barcode !== "-" && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-mono text-slate-700">
                      Barcode: {stockDetailModal.barcode}
                    </span>
                  )}
                  {stockDetailModal.data?.kode_barang_variant && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-mono text-slate-700">
                      Varian: {stockDetailModal.data.kode_barang_variant}
                    </span>
                  )}
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200/60">
                  <div className="rounded-xl bg-teal-50 border border-teal-100 p-3 text-center">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-teal-700">Total Semua</p>
                    <p className="text-xl font-bold text-teal-800 mt-0.5">
                      {stockDetailModal.loading ? "..." : (stockDetailModal.data?.total_stok ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-center">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-blue-700">Total Toko</p>
                    <p className="text-xl font-bold text-blue-800 mt-0.5">
                      {stockDetailModal.loading ? "..." : (stockDetailModal.data?.total_toko ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-amber-700">Total Gudang</p>
                    <p className="text-xl font-bold text-amber-800 mt-0.5">
                      {stockDetailModal.loading ? "..." : (stockDetailModal.data?.total_gudang ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              {stockDetailModal.loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <RefreshCcw className="w-7 h-7 text-teal-600 animate-spin" />
                  <p className="text-xs text-slate-500 font-medium">Memuat rincian stok toko & gudang...</p>
                </div>
              ) : stockDetailModal.error ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs text-center">
                  {stockDetailModal.error}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Bagian 1: Toko */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Store className="w-4 h-4 text-blue-600" />
                      <span>Stok Toko</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2">Nama Toko</th>
                            <th className="px-3 py-2 text-right">Stok Baik</th>
                            <th className="px-3 py-2 text-right">Stok Rusak</th>
                            <th className="px-3 py-2 text-right">Stok Available</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(stockDetailModal.data?.toko || []).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                                Tidak ada data toko
                              </td>
                            </tr>
                          ) : (
                            stockDetailModal.data?.toko.map((t) => (
                              <tr key={t.kode_toko} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-medium text-slate-800">{t.nama_toko}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{t.qty_baik}</td>
                                <td className="px-3 py-2 text-right text-rose-600">
                                  {t.qty_rusak > 0 ? t.qty_rusak : "-"}
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-blue-700">{t.stok}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Bagian 2: Seluruh Gudang */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Warehouse className="w-4 h-4 text-amber-600" />
                      <span>Stok Seluruh Gudang</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2">Nama Gudang</th>
                            <th className="px-3 py-2">Jenis</th>
                            <th className="px-3 py-2 text-right">Stok Baik</th>
                            <th className="px-3 py-2 text-right">Stok Rusak</th>
                            <th className="px-3 py-2 text-right">Total Stok</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(stockDetailModal.data?.gudang || []).length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                                Tidak ada data gudang
                              </td>
                            </tr>
                          ) : (
                            stockDetailModal.data?.gudang.map((g) => (
                              <tr key={g.kode_gudang} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-medium text-slate-800">
                                  <div className="flex items-center gap-2">
                                    <span>{g.nama_gudang}</span>
                                    {g.is_gudang_bs === 1 && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                                        BS
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-slate-500 text-[11px]">{g.jenis_gudang || "-"}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{g.qty_baik}</td>
                                <td className="px-3 py-2 text-right text-rose-600">
                                  {g.qty_rusak > 0 ? g.qty_rusak : "-"}
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-amber-700">{g.stok}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setStockDetailModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition"
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
