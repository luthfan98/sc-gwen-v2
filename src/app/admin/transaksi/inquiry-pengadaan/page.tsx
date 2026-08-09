"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import Select from "react-select";

type InquiryRow = {
  kode_t_pengadaan: string;
  kode_t_rpo?: string | null;
  tgl?: string | null;
  kode_supplier?: string | null;
  supplier_nama?: string | null;
  no_faktur_supplier?: string | null;
  kode_barang_variant?: string | null;
  barcode_varian?: string | null;
  nama_barang?: string | null;
  nama_varian?: string | null;
  qty?: number | null;
  satuan?: string | null;
  harga_beli?: number | null;
  subtotal?: number | null;
  kode_merk?: string | null;
  nama_merk?: string | null;
};

type SupplierOption = { kode_supplier: string; nama: string };
type MerkOption = { id_merk: number; nama_merk: string };

const formatIDR = (val: number | null | undefined) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    Number(val ?? 0)
  );

const getTodayStr = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getPastDateStr = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function InquiryPengadaanPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [dateFrom, setDateFrom] = useState(() => getPastDateStr(30));
  const [dateTo, setDateTo] = useState(() => getTodayStr());
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [merkFilter, setMerkFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [merkOptions, setMerkOptions] = useState<MerkOption[]>([]);

  const supplierSelectOptions = useMemo(() => {
    const base = [{ value: "all", label: "Semua Supplier" }];
    const list = supplierOptions.map((opt) => ({
      value: opt.kode_supplier,
      label: opt.nama || opt.kode_supplier,
    }));
    return [...base, ...list];
  }, [supplierOptions]);

  const merkSelectOptions = useMemo(() => {
    const base = [{ value: "all", label: "Semua Merk" }];
    const list = merkOptions.map((opt) => ({
      value: String(opt.id_merk),
      label: opt.nama_merk,
    }));
    return [...base, ...list];
  }, [merkOptions]);

  const selectedSupplierOption =
    supplierSelectOptions.find((opt) => opt.value === supplierFilter) || supplierSelectOptions[0];
  const selectedMerkOption =
    merkSelectOptions.find((opt) => opt.value === merkFilter) || merkSelectOptions[0];

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      minHeight: 38,
      borderColor: "#e5e7eb",
      boxShadow: "none",
      "&:hover": { borderColor: "#d1d5db" },
    }),
    menuPortal: (base: any) => ({ ...base, zIndex: 50 }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected ? "#e6fffb" : state.isFocused ? "#f3f4f6" : "white",
      color: "#111827",
    }),
  };

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [suppliersRes, merkRes] = await Promise.all([
          fetch(`${API_BASE}/suppliers`),
          fetch(`${API_BASE}/merk?include_inactive=1`),
        ]);
        if (suppliersRes.ok) {
          const data = await suppliersRes.json();
          const list = Array.isArray(data) ? data : [];
          setSupplierOptions(
            list
              .map((s: any) => ({
                kode_supplier: String(s.kode_supplier || "").trim(),
                nama: String(s.nama || s.nama_supplier || s.kode_supplier || "").trim(),
              }))
              .filter((s: SupplierOption) => s.kode_supplier)
          );
        }
        if (merkRes.ok) {
          const data = await merkRes.json();
          const list = Array.isArray(data) ? data : [];
          setMerkOptions(
            list
              .map((m: any) => ({
                id_merk: Number(m.id_merk),
                nama_merk: String(m.nama_merk || "").trim(),
              }))
              .filter((m: MerkOption) => Number.isFinite(m.id_merk) && m.nama_merk)
          );
        }
      } catch {
        // ignore option fetch errors
      }
    };
    fetchOptions();
  }, [API_BASE]);

  const handleFetch = async () => {
    setHasSearched(true);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("start", dateFrom);
      if (dateTo) params.set("end", dateTo);
      if (supplierFilter !== "all") params.set("kode_supplier", supplierFilter);
      if (merkFilter !== "all") params.set("kode_merk", merkFilter);
      const res = await fetch(`${API_BASE}/pengadaan/inquiry?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Gagal memuat data inquiry pengadaan.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const displayedRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => {
      const target = [
        row.kode_t_pengadaan,
        row.kode_t_rpo,
        row.supplier_nama,
        row.kode_supplier,
        row.nama_merk,
        row.kode_merk,
        row.nama_barang,
        row.nama_varian,
        row.barcode_varian,
        row.kode_barang_variant,
        row.no_faktur_supplier,
      ]
        .map((val) => String(val ?? "").toLowerCase())
        .join(" ");
      return target.includes(keyword);
    });
  }, [rows, search]);

  const totals = useMemo(() => {
    return displayedRows.reduce(
      (acc, row) => {
        acc.qty += Number(row.qty ?? 0);
        acc.subtotal += Number(row.subtotal ?? 0);
        return acc;
      },
      { qty: 0, subtotal: 0 }
    );
  }, [displayedRows]);

  const handleExportXlsx = async () => {
    if (!hasSearched) {
      alert("Klik Tampilkan dulu sebelum export.");
      return;
    }
    if (displayedRows.length === 0) {
      alert("Tidak ada data untuk diexport.");
      return;
    }
    try {
      const XLSXModule = await import("xlsx");
      const XLSX = (XLSXModule as any).default ?? XLSXModule;
      const headers = [
        "Tanggal",
        "Nomor PO",
        "Supplier",
        "Merk",
        "Nama Barang",
        "Nama Varian",
        "Qty",
        "Satuan",
        "Harga Beli",
        "Subtotal",
        "No Faktur",
      ];
      const rowsExcel = displayedRows.map((row) => [
        row.tgl ? String(row.tgl).slice(0, 10) : "",
        row.kode_t_pengadaan || "",
        row.supplier_nama || row.kode_supplier || "",
        row.nama_merk || row.kode_merk || "",
        row.nama_barang || "",
        row.nama_varian || "",
        Number(row.qty ?? 0),
        row.satuan || "PCS",
        Number(row.harga_beli ?? 0),
        Number(row.subtotal ?? 0),
        row.no_faktur_supplier || "",
      ]);
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rowsExcel]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inquiry Pengadaan");
      const filename = `inquiry-pengadaan-${dateFrom || "all"}-${dateTo || "all"}.xlsx`;
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed export inquiry pengadaan", err);
      alert("Gagal export data.");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <p className="text-sm text-gray-500">Transaksi</p>
        <h1 className="text-2xl font-bold text-gray-900">Inquiry Pengadaan</h1>
        <p className="text-sm text-gray-600 mt-1">Filter data pengadaan berdasarkan tanggal, supplier, atau merk.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <Filter className="w-4 h-4" />
            Filter
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 min-w-[220px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari PO, supplier, merk, barang..."
              className="w-full outline-none text-sm"
            />
          </div>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Tanggal dari
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[160px]"
            />
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Tanggal sampai
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[160px]"
            />
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Supplier
            <div className="min-w-[220px]">
              <Select
                instanceId="supplier-select"
                value={selectedSupplierOption}
                onChange={(opt) => setSupplierFilter((opt as any)?.value || "all")}
                options={supplierSelectOptions}
                styles={selectStyles}
                isSearchable
                menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
              />
            </div>
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Merk
            <div className="min-w-[220px]">
              <Select
                instanceId="merk-select"
                value={selectedMerkOption}
                onChange={(opt) => setMerkFilter((opt as any)?.value || "all")}
                options={merkSelectOptions}
                styles={selectStyles}
                isSearchable
                menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
              />
            </div>
          </label>
          <button
            type="button"
            onClick={handleFetch}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0f756b] text-white text-sm font-semibold shadow-sm hover:bg-[#0d6a62]"
          >
            <Search className="w-4 h-4" />
            Tampilkan
          </button>
          <button
            type="button"
            onClick={handleExportXlsx}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50"
          >
            Export XLSX
          </button>
          <button
            type="button"
            onClick={() => {
              setDateFrom(getPastDateStr(30));
              setDateTo(getTodayStr());
              setSupplierFilter("all");
              setMerkFilter("all");
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50"
          >
            Reset
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-3 w-12 text-center">No.</th>
                <th className="px-3 py-3">Tanggal</th>
                <th className="px-3 py-3">Nomor PO</th>
                <th className="px-3 py-3">Supplier</th>
                <th className="px-3 py-3">Merk</th>
                <th className="px-3 py-3">Nama Barang</th>
                <th className="px-3 py-3">Nama Varian</th>
                <th className="px-3 py-3 text-center">Qty</th>
                <th className="px-3 py-3 text-right">Harga Beli</th>
                <th className="px-3 py-3 text-right">Subtotal</th>
                <th className="px-3 py-3">No Faktur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!hasSearched && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={11}>
                    Silakan pilih filter (atau biarkan kosong), lalu klik Tampilkan.
                  </td>
                </tr>
              )}
              {hasSearched && loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={11}>
                    Memuat data...
                  </td>
                </tr>
              )}
              {hasSearched && error && !loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-rose-600" colSpan={11}>
                    {error}
                  </td>
                </tr>
              )}
              {hasSearched && !loading && !error && displayedRows.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={11}>
                    Tidak ada data pengadaan.
                  </td>
                </tr>
              )}
              {hasSearched &&
                !loading &&
                !error &&
                displayedRows.map((row, idx) => (
                  <tr key={`${row.kode_t_pengadaan}-${row.kode_barang_variant}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-center text-gray-700">{idx + 1}</td>
                    <td className="px-3 py-3 text-gray-700">
                      {row.tgl ? String(row.tgl).slice(0, 10) : "-"}
                    </td>
                    <td className="px-3 py-3 font-semibold text-gray-900">{row.kode_t_pengadaan}</td>
                    <td className="px-3 py-3 text-gray-800">{row.supplier_nama || row.kode_supplier || "-"}</td>
                    <td className="px-3 py-3 text-gray-700">{row.nama_merk || row.kode_merk || "-"}</td>
                    <td className="px-3 py-3 text-gray-800">{row.nama_barang || "-"}</td>
                    <td className="px-3 py-3 text-gray-700">{row.nama_varian || "-"}</td>
                    <td className="px-3 py-3 text-center text-gray-700">
                      {Number(row.qty ?? 0)} {row.satuan || "PCS"}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-900">{formatIDR(row.harga_beli)}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{formatIDR(row.subtotal)}</td>
                    <td className="px-3 py-3 text-gray-700">{row.no_faktur_supplier || "-"}</td>
                  </tr>
                ))}
            </tbody>
            {hasSearched && !loading && !error && displayedRows.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td className="px-3 py-3 text-right font-semibold text-gray-700" colSpan={7}>
                    Total
                  </td>
                  <td className="px-3 py-3 text-center font-semibold text-gray-900">
                    {totals.qty}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">-</td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">
                    {formatIDR(totals.subtotal)}
                  </td>
                  <td className="px-3 py-3 text-gray-700">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
