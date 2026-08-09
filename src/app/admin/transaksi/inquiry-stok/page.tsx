"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { Eye, Printer, RefreshCw, Search, X } from "lucide-react";

type Option = { value: string; label: string };

type InquiryRow = {
  kode_supplier: string | null;
  nama_supplier: string | null;
  kode_merk: string | null;
  nama_merk: string | null;
  nama_barang: string | null;
  nama_varian: string | null;
  barcode_varian: string | null;
  is_aktif_varian?: number | null;
  buffer_stok: number | null;
  stok_rpo_terakhir: number | null;
  stok_rpo_terakhir_tgl?: string | null;
  po_terakhir: number | null;
  po_terakhir_tgl?: string | null;
  terakhir_terjual_tgl?: string | null;
  stok_toko: number | null;
  stok_gudang: number | null;
  stok_gudang_detail?: string | null;
  persen_stok_toko: number | null;
  persen_stok_gudang: number | null;
  kode_barang_variant: string | null;
};

export default function InquiryStokTransaksiPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

  const [supplierOptions, setSupplierOptions] = useState<Option[]>([]);
  const [merkOptions, setMerkOptions] = useState<Option[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Option | null>(null);
  const [selectedMerk, setSelectedMerk] = useState<Option | null>(null);
  const [onlyZero, setOnlyZero] = useState(false);
  const [onlyBelow, setOnlyBelow] = useState(false);
  const [gudangReadyTokoEmpty, setGudangReadyTokoEmpty] = useState(false);
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<string>("nama_barang");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyVariantName, setHistoryVariantName] = useState<string | null>(null);
  const [historyStokSisa, setHistoryStokSisa] = useState<number>(0);
  const [historySource, setHistorySource] = useState<"toko" | "gudang">("toko");
  const [historyRows, setHistoryRows] = useState<
    {
      tgl_transaksi: string | null;
      kode_ref_transaksi?: string | null;
      qty_masuk: number | null;
      qty_keluar: number | null;
      stok_akhir_satuan_1: number | null;
    }[]
  >([]);
  const [appliedFilters, setAppliedFilters] = useState<{
    kode_supplier: string;
    kode_merk: string | null;
    stok_zero: boolean;
    stok_below: boolean;
    gudang_ready_toko_empty: boolean;
  } | null>(null);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/suppliers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const options = (Array.isArray(data) ? data : [])
        .filter((s) => String(s?.kode_supplier || "").trim())
        .map((s) => ({
          value: String(s.kode_supplier),
          label: String(s.nama || s.kode_supplier),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "id"));
      setSupplierOptions([{ value: "__ALL__", label: "Semua supplier" }, ...options]);
    } catch (err) {
      console.error("Failed fetch suppliers", err);
      setSupplierOptions([{ value: "__ALL__", label: "Semua supplier" }]);
    }
  }, [API_BASE]);

  const fetchMerkBySupplier = useCallback(
    async (kodeSupplier: string) => {
      try {
        const res = await fetch(
          `${API_BASE}/inquiry-stok/merk-options?kode_supplier=${encodeURIComponent(kodeSupplier)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options = (Array.isArray(data) ? data : [])
          .filter((m) => String(m?.kode_merk || "").trim())
          .map((m) => ({
            value: String(m.kode_merk),
            label: String(m.nama_merk || m.kode_merk),
          }))
          .sort((a, b) => a.label.localeCompare(b.label, "id"));
        setMerkOptions(options);
      } catch (err) {
        console.error("Failed fetch merk options", err);
        setMerkOptions([]);
      }
    },
    [API_BASE]
  );

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    if (!selectedSupplier?.value || selectedSupplier.value === "__ALL__") {
      setMerkOptions([]);
      setSelectedMerk(null);
      return;
    }
    setSelectedMerk(null);
    fetchMerkBySupplier(selectedSupplier.value);
  }, [selectedSupplier, fetchMerkBySupplier]);

  const fetchRows = useCallback(
    async (filters: {
      kode_supplier: string;
      kode_merk: string | null;
      stok_zero: boolean;
      stok_below: boolean;
      gudang_ready_toko_empty: boolean;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters.kode_supplier) params.set("kode_supplier", filters.kode_supplier);
        if (filters.kode_merk) params.set("kode_merk", filters.kode_merk);
        if (filters.stok_zero) params.set("stok_zero", "1");
        if (filters.stok_below) params.set("stok_below", "1");
        if (filters.gudang_ready_toko_empty) params.set("gudang_ready_toko_empty", "1");
        const res = await fetch(`${API_BASE}/inquiry-stok?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
        setSelectedKeys({});
      } catch (err) {
        console.error("Failed fetch inquiry stok", err);
        setRows([]);
        setError("Gagal memuat data inquiry stok.");
      } finally {
        setLoading(false);
      }
    },
    [API_BASE]
  );

  const handleTampilkan = () => {
    const kodeSupplier =
      !selectedSupplier?.value || selectedSupplier.value === "__ALL__" ? "" : selectedSupplier.value;
    const filters = {
      kode_supplier: kodeSupplier,
      kode_merk: kodeSupplier ? selectedMerk?.value ?? null : null,
      stok_zero: onlyZero,
      stok_below: onlyBelow,
      gudang_ready_toko_empty: gudangReadyTokoEmpty,
    };
    setAppliedFilters(filters);
    fetchRows(filters);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedKeys({});
      return;
    }
    const next: Record<string, boolean> = {};
    rows.forEach((row) => {
      const key = String(row.kode_barang_variant || row.nama_varian || "");
      if (key) next[key] = true;
    });
    setSelectedKeys(next);
  };

  const toggleSelectItem = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => ({ ...prev, [key]: checked }));
  };

  const isAllSelected = useMemo(() => {
    if (!rows.length) return false;
    return rows.every((row) => {
      const key = String(row.kode_barang_variant || row.nama_varian || "");
      return key && selectedKeys[key];
    });
  }, [rows, selectedKeys]);

  const parseStokGudangDetail = (row: InquiryRow) => {
    const result = { gudang1: 0, gudang2: 0, gudang3: 0, bs: 0 };
    const detail = String(row.stok_gudang_detail || "").trim();
    if (!detail) {
      result.gudang1 = Number(row.stok_gudang ?? 0) || 0;
      return result;
    }

    detail.split(",").forEach((part) => {
      const [rawKey, rawValue] = part.split("=");
      const key = String(rawKey || "").trim().toLowerCase();
      const value = Number(String(rawValue || "0").trim()) || 0;
      if (key === "1") result.gudang1 = value;
      if (key === "2") result.gudang2 = value;
      if (key === "3") result.gudang3 = value;
      if (key === "bs") result.bs = value;
    });

    return result;
  };

  const sortedRows = useMemo(() => {
    const data = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    const getVal = (row: InquiryRow) => {
      const stokGudang = parseStokGudangDetail(row);
      switch (sortKey) {
        case "nama_supplier":
          return row.nama_supplier || "";
        case "nama_merk":
          return row.nama_merk || "";
        case "nama_barang":
          return row.nama_barang || "";
        case "nama_varian":
          return row.nama_varian || "";
        case "barcode_varian":
          return row.barcode_varian || "";
        case "buffer_stok":
          return Number(row.buffer_stok ?? 0);
        case "stok_rpo_terakhir":
          return Number(row.stok_rpo_terakhir ?? 0);
        case "po_terakhir":
          return Number(row.po_terakhir ?? 0);
        case "stok_saat_ini":
          return Number(row.stok_toko ?? 0);
        case "stok_toko":
          return Number(row.stok_toko ?? 0);
        case "stok_gudang":
          return Number(row.stok_gudang ?? 0);
        case "stok_gudang_1":
          return stokGudang.gudang1;
        case "stok_gudang_2":
          return stokGudang.gudang2;
        case "stok_gudang_3":
          return stokGudang.gudang3;
        case "stok_gudang_bs":
          return stokGudang.bs;
        case "persen_stok_toko":
          return Number(row.persen_stok_toko ?? 0);
        case "persen_stok_gudang":
          return Number(row.persen_stok_gudang ?? 0);
        case "po_terakhir_tgl":
          return row.po_terakhir_tgl ? new Date(row.po_terakhir_tgl).getTime() : 0;
        case "terakhir_terjual_tgl":
          return row.terakhir_terjual_tgl ? new Date(row.terakhir_terjual_tgl).getTime() : 0;
        case "stok_rpo_terakhir_tgl":
          return row.stok_rpo_terakhir_tgl ? new Date(row.stok_rpo_terakhir_tgl).getTime() : 0;
        default:
          return "";
      }
    };
    data.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb), "id") * dir;
    });
    return data;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    setSortDir((prev) => (key === sortKey ? (prev === "asc" ? "desc" : "asc") : "asc"));
    setSortKey(key);
  };

  const SortHeader = ({ label, sort }: { label: string; sort: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(sort)}
      className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
    >
      <span>{label}</span>
      <span className="text-[10px]">{sortKey === sort ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
    </button>
  );

  const getDaysSinceDate = (dateValue?: string | null) => {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.max(0, Math.floor((today - start) / 86400000));
  };

  const exportCsv = () => {
    if (!sortedRows.length) return;
    const headers = [
      "Nama Supplier",
      "Nama Merk",
      "Nama Barang",
      "Nama Varian",
      "Barcode",
      "Buffer Stok",
      "Stok RPO Terakhir",
      "Tanggal RPO Terakhir",
      "PO Terakhir",
      "Tanggal PO",
      "Hari Sejak PO",
      "Tanggal Terakhir Terjual",
      "Hari Sejak Terjual",
      "Stok Toko",
      "Stok Gudang 1",
      "Stok Gudang 2",
      "Stok Gudang 3",
      "Stok Gudang BS",
      "Persentase Toko",
      "Persentase Gudang",
    ];
    const lines = [headers.join(",")];
    sortedRows.forEach((row) => {
      const stokGudang = parseStokGudangDetail(row);
      const values = [
        row.nama_supplier || "",
        row.nama_merk || "",
        row.nama_barang || "",
        row.nama_varian || "",
        row.barcode_varian || "",
        Number(row.buffer_stok ?? 0),
        Number(row.stok_rpo_terakhir ?? 0),
        row.stok_rpo_terakhir_tgl ? new Date(row.stok_rpo_terakhir_tgl).toLocaleDateString("id-ID") : "",
        Number(row.po_terakhir ?? 0),
        row.po_terakhir_tgl ? new Date(row.po_terakhir_tgl).toLocaleDateString("id-ID") : "",
        getDaysSinceDate(row.po_terakhir_tgl) ?? "",
        row.terakhir_terjual_tgl ? new Date(row.terakhir_terjual_tgl).toLocaleDateString("id-ID") : "",
        getDaysSinceDate(row.terakhir_terjual_tgl) ?? "",
        Number(row.stok_toko ?? 0),
        stokGudang.gudang1,
        stokGudang.gudang2,
        stokGudang.gudang3,
        stokGudang.bs,
        Number(row.persen_stok_toko ?? 0),
        Number(row.persen_stok_gudang ?? 0),
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
    link.download = `inquiry-stok.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!appliedFilters || loading || sortedRows.length === 0) return;
    window.print();
  };

  const openHistory = async (kodeBarangVariant: string | null, source: "toko" | "gudang") => {
    if (!kodeBarangVariant) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistorySource(source);
    try {
      const res = await fetch(
        `${API_BASE}/inquiry-stok/history?kode_barang_variant=${encodeURIComponent(
          kodeBarangVariant
        )}&source=${source}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHistoryVariantName(data?.nama_varian || null);
      setHistoryStokSisa(Number(data?.stok_sisa ?? 0));
      setHistoryRows(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error("Failed fetch history", err);
      setHistoryError("Gagal memuat history.");
      setHistoryRows([]);
      setHistoryVariantName(null);
      setHistoryStokSisa(0);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Menu Transaksi</p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Inquiry Stok</h1>
        <p className="text-sm text-slate-500">Tampilkan stok berdasarkan supplier dan merk.</p>
      </div>

      <section className="no-print rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Nama Supplier</label>
            <Select
              value={selectedSupplier}
              onChange={(opt) => setSelectedSupplier(opt as Option)}
              options={supplierOptions}
              placeholder="Pilih supplier"
              isClearable
              classNamePrefix="select"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Nama Merk</label>
            <Select
              value={selectedMerk}
              onChange={(opt) => setSelectedMerk(opt as Option)}
              options={merkOptions}
              placeholder="Pilih merk"
              isClearable
              classNamePrefix="select"
              isDisabled={!selectedSupplier}
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={onlyZero}
                onChange={(e) => setOnlyZero(e.target.checked)}
              />
              Tampilkan stok 0
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={onlyBelow}
                onChange={(e) => setOnlyBelow(e.target.checked)}
              />
              Tampilkan stok &lt; 30%
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={gudangReadyTokoEmpty}
                onChange={(e) => setGudangReadyTokoEmpty(e.target.checked)}
              />
              Gudang &gt; 0, Toko 0
            </label>
          </div>
          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={handleTampilkan}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
            >
              <Search className="h-4 w-4" />
              Tampilkan
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}
        {appliedFilters && (
          <div className="text-xs text-slate-500">
            Filter aktif: Supplier <span className="font-semibold">{selectedSupplier?.label}</span>
            {selectedMerk?.label ? `, Merk ${selectedMerk.label}` : ""}
          </div>
        )}
      </section>

      <section className="print-section rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-slate-700">Data Inquiry Stok</p>
          <div className="no-print flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              disabled={!appliedFilters || loading || sortedRows.length === 0}
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100"
              disabled={!appliedFilters || loading || sortedRows.length === 0}
            >
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => appliedFilters && fetchRows(appliedFilters)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              disabled={!appliedFilters || loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {!appliedFilters && (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Pilih filter lalu klik Tampilkan untuk memuat data.
          </div>
        )}

        {appliedFilters && (
          <div className="print-table-wrapper overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="print-hide px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-2 text-left">No</th>
                  <th className="px-3 py-2 text-left">
                    <SortHeader label="Nama Supplier" sort="nama_supplier" />
                  </th>
                  <th className="px-3 py-2 text-left">
                    <SortHeader label="Nama Merk" sort="nama_merk" />
                  </th>
                  <th className="px-3 py-2 text-left">
                    <SortHeader label="Nama Barang" sort="nama_barang" />
                  </th>
                  <th className="px-3 py-2 text-left">
                    <SortHeader label="Nama Varian" sort="nama_varian" />
                  </th>
                  <th className="px-3 py-2 text-left">
                    <SortHeader label="Barcode" sort="barcode_varian" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Buffer Stok" sort="buffer_stok" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Stok RPO Terakhir" sort="stok_rpo_terakhir" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="PO Terakhir" sort="po_terakhir" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Terakhir Terjual" sort="terakhir_terjual_tgl" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Stok Toko" sort="stok_toko" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Gudang 1" sort="stok_gudang_1" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Gudang 2" sort="stok_gudang_2" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Gudang 3" sort="stok_gudang_3" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Gudang BS" sort="stok_gudang_bs" />
                  </th>
                  <th className="print-hide px-3 py-2 text-center">
                    Hist. Gudang
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Persentase Toko" sort="persen_stok_toko" />
                  </th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Persentase Gudang" sort="persen_stok_gudang" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={19} className="px-3 py-6 text-center text-slate-500">
                      Memuat data...
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={19} className="px-3 py-6 text-center text-slate-500">
                      Tidak ada data.
                    </td>
                  </tr>
                )}
                {!loading &&
                  sortedRows.map((row, idx) => {
                    const key = String(row.kode_barang_variant || `${row.nama_barang}-${row.nama_varian}-${idx}`);
                    const isZero = Number(row.persen_stok_toko ?? 0) === 0;
                    const daysSinceSold = getDaysSinceDate(row.terakhir_terjual_tgl);
                    const isDiscontinued = daysSinceSold !== null && daysSinceSold > 90;
                    const isInactiveVariant = Number(row.is_aktif_varian ?? 1) !== 1;
                    const stokGudang = parseStokGudangDetail(row);
                    return (
                      <tr
                        key={key}
                        className={`border-b border-slate-100 ${
                          isInactiveVariant
                            ? "bg-rose-100/90 text-slate-800"
                            : isDiscontinued
                              ? "bg-slate-200/80 text-slate-500"
                              : isZero
                                ? "bg-pink-50/70"
                                : ""
                        }`}
                      >
                        <td className="print-hide px-3 py-2">
                          <input
                            type="checkbox"
                            checked={!!selectedKeys[key]}
                            onChange={(e) => toggleSelectItem(key, e.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2">{row.nama_supplier || "-"}</td>
                        <td className="px-3 py-2">{row.nama_merk || "-"}</td>
                        <td className="px-3 py-2">{row.nama_barang || "-"}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{row.nama_varian || "-"}</span>
                            {Number(row.is_aktif_varian ?? 1) !== 1 && (
                              <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                Non Aktif
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.barcode_varian || "-"}</td>
                        <td className="px-3 py-2 text-right">{Number(row.buffer_stok ?? 0).toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex flex-col items-end leading-tight">
                            <span>{Number(row.stok_rpo_terakhir ?? 0).toLocaleString("id-ID")}</span>
                            <span className="text-[11px] text-slate-400">
                              {row.stok_rpo_terakhir_tgl
                                ? new Date(row.stok_rpo_terakhir_tgl).toLocaleDateString("id-ID")
                                : "-"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex flex-col items-end leading-tight">
                            <span>{Number(row.po_terakhir ?? 0).toLocaleString("id-ID")}</span>
                            <span className="text-[11px] text-slate-400">
                              {row.po_terakhir_tgl
                                ? new Date(row.po_terakhir_tgl).toLocaleDateString("id-ID")
                                : "-"}
                            </span>
                            {row.po_terakhir_tgl && (
                              <span className="text-[11px] font-medium text-slate-500">
                                {getDaysSinceDate(row.po_terakhir_tgl)} hari
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex flex-col items-end leading-tight">
                            <span className="text-[11px] text-slate-400">
                              {row.terakhir_terjual_tgl
                                ? new Date(row.terakhir_terjual_tgl).toLocaleDateString("id-ID")
                                : "-"}
                            </span>
                            {row.terakhir_terjual_tgl && (
                              <span className="text-[11px] font-medium text-slate-500">
                                {daysSinceSold} hari
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right bg-emerald-50">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-semibold text-emerald-700">
                              {Number(row.stok_toko ?? 0).toLocaleString("id-ID")}
                            </span>
                            <button
                              type="button"
                              onClick={() => openHistory(row.kode_barang_variant, "toko")}
                              className="print-hide inline-flex items-center justify-center rounded-md border border-slate-200 px-1.5 py-1 text-slate-500 hover:bg-slate-50"
                              title="Lihat history"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right bg-blue-50 font-semibold text-blue-700">
                          {stokGudang.gudang1.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 text-right bg-blue-50 font-semibold text-blue-700">
                          {stokGudang.gudang2.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 text-right bg-blue-50 font-semibold text-blue-700">
                          {stokGudang.gudang3.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 text-right bg-blue-50 font-semibold text-blue-700">
                          {stokGudang.bs.toLocaleString("id-ID")}
                        </td>
                        <td className="print-hide px-3 py-2 text-center bg-blue-50">
                          <button
                            type="button"
                            onClick={() => openHistory(row.kode_barang_variant, "gudang")}
                            className="inline-flex items-center justify-center rounded-md border border-slate-200 px-1.5 py-1 text-slate-500 hover:bg-slate-50"
                            title="Lihat history gudang"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={
                              Number(row.persen_stok_toko ?? 0) === 0 ? "font-semibold text-pink-600" : ""
                            }
                          >
                            {Number(row.persen_stok_toko ?? 0).toLocaleString("id-ID", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })}
                            %
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={
                              Number(row.persen_stok_gudang ?? 0) === 0 ? "font-semibold text-pink-600" : ""
                            }
                          >
                            {Number(row.persen_stok_gudang ?? 0).toLocaleString("id-ID", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })}
                            %
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {historyOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">History Stok</p>
                <h3 className="text-lg font-semibold text-slate-900">{historyVariantName || "-"}</h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="inline-flex items-center justify-center rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="mb-4 text-sm text-slate-600">
                Akumulasi stok sisa saat ini:{" "}
                <span className="font-semibold text-slate-900">
                  {historyStokSisa.toLocaleString("id-ID")}
                </span>
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-500">
                  {historySource === "gudang" ? "Gudang" : "Toko"}
                </span>
              </div>
              {historyLoading && <div className="py-6 text-center text-sm text-slate-500">Memuat...</div>}
              {historyError && <div className="py-6 text-center text-sm text-rose-600">{historyError}</div>}
              {!historyLoading && !historyError && (
                <div className="max-h-[50vh] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Tanggal</th>
                        <th className="px-3 py-2 text-left">Kode Ref</th>
                        <th className="px-3 py-2 text-right">Masuk</th>
                        <th className="px-3 py-2 text-right">Keluar</th>
                        <th className="px-3 py-2 text-right">Stok Akhir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                            Tidak ada data.
                          </td>
                        </tr>
                      )}
                      {historyRows.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="px-3 py-2">
                            {row.tgl_transaksi ? new Date(row.tgl_transaksi).toLocaleString("id-ID") : "-"}
                          </td>
                          <td className="px-3 py-2">{row.kode_ref_transaksi || "-"}</td>
                          <td className="px-3 py-2 text-right">
                            {Number(row.qty_masuk ?? 0).toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {Number(row.qty_keluar ?? 0).toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                              {Number(row.stok_akhir_satuan_1 ?? 0).toLocaleString("id-ID")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          body {
            background: #fff !important;
          }
          .no-print,
          .print-hide {
            display: none !important;
          }
          .print-section {
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          .print-table-wrapper {
            overflow: visible !important;
          }
          .print-table-wrapper table {
            width: 100% !important;
            min-width: 0 !important;
            border-collapse: collapse !important;
            font-size: 8px !important;
          }
          .print-table-wrapper thead {
            display: table-header-group;
          }
          .print-table-wrapper tr {
            break-inside: avoid;
          }
          .print-table-wrapper th,
          .print-table-wrapper td {
            border: 1px solid #cbd5e1 !important;
            padding: 3px 4px !important;
          }
        }
      `}</style>
    </main>
  );
}
