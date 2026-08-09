"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { Search } from "lucide-react";

type Option = { value: string; label: string };

type RowData = {
  kode_barang_variant: string;
  nama_supplier: string;
  nama_merk: string;
  nama_barang_varian: string;
  values: Record<string, number>;
};

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

export default function RekapanHarianPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [supplierOptions, setSupplierOptions] = useState<Option[]>([]);
  const [merkOptions, setMerkOptions] = useState<Option[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Option | null>(null);
  const [selectedMerk, setSelectedMerk] = useState<Option | null>(null);
  const [fromDate, setFromDate] = useState<string>(() => getPastDateStr(30));
  const [toDate, setToDate] = useState<string>(() => getTodayStr());
  const [dates, setDates] = useState<string[]>([]);
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/pos/suppliers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const options = (Array.isArray(data) ? data : [])
        .filter((s) => String(s?.kode_supplier || "").trim())
        .map((s) => ({ value: String(s.kode_supplier), label: String(s.nama || s.kode_supplier) }))
        .sort((a, b) => a.label.localeCompare(b.label, "id"));
      setSupplierOptions(options);
    } catch (err) {
      console.error("Failed fetch suppliers", err);
      setSupplierOptions([]);
    }
  }, [API_BASE]);

  const fetchMerks = useCallback(
    async (kodeSupplier?: string) => {
      try {
        const url = kodeSupplier
          ? `${API_BASE}/inquiry-stok/merk-options?kode_supplier=${encodeURIComponent(kodeSupplier)}`
          : `${API_BASE}/pos/merks`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options = (Array.isArray(data) ? data : [])
          .filter((m) => String(m?.kode_merk || "").trim())
          .map((m) => ({ value: String(m.kode_merk), label: String(m.nama_merk || m.kode_merk) }))
          .sort((a, b) => a.label.localeCompare(b.label, "id"));
        setMerkOptions(options);
      } catch (err) {
        console.error("Failed fetch merks", err);
        setMerkOptions([]);
      }
    },
    [API_BASE]
  );

  useEffect(() => {
    fetchSuppliers();
    fetchMerks();
  }, [fetchSuppliers, fetchMerks]);

  useEffect(() => {
    if (selectedSupplier?.value) {
      fetchMerks(selectedSupplier.value);
    } else {
      fetchMerks();
    }
    setSelectedMerk(null);
  }, [selectedSupplier, fetchMerks]);

  const handleApply = async () => {
    setApplied(true);
    if (!fromDate || !toDate) {
      setError("Tanggal dari dan sampai wajib diisi.");
      setRows([]);
      setDates([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
      });
      if (selectedSupplier?.value) params.set("kode_supplier", selectedSupplier.value);
      if (selectedMerk?.value) params.set("kode_merk", selectedMerk.value);
      const res = await fetch(`${API_BASE}/rekapan-harian?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setDates(Array.isArray(data?.dates) ? data.dates : []);
    } catch (err) {
      console.error("Failed fetch rekapan harian", err);
      setError("Gagal memuat rekapan harian.");
      setRows([]);
      setDates([]);
    } finally {
      setLoading(false);
    }
  };

  const dateHeaders = useMemo(() => dates.map((d) => ({ key: d, label: d.slice(-2) })), [dates]);
  const monthLabel = useMemo(() => {
    if (!fromDate || !toDate) return "-";
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "-";
    if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
      return from.toLocaleString("id-ID", { month: "long", year: "numeric" });
    }
    return "Multi";
  }, [fromDate, toDate]);

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Menu Transaksi</p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Rekapan Harian</h1>
        <p className="text-sm text-slate-500">Stok toko berdasarkan stok akhir harian.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Supplier</label>
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
            <label className="text-xs font-semibold text-slate-500">Merk</label>
            <Select
              value={selectedMerk}
              onChange={(opt) => setSelectedMerk(opt as Option)}
              options={merkOptions}
              placeholder="Pilih merk"
              isClearable
              classNamePrefix="select"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Tanggal Dari</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Tanggal Sampai</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end justify-end">
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
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
                  <th className="px-3 py-2 text-left">Nama Supplier</th>
                  <th className="px-3 py-2 text-left">Nama Merk</th>
                  <th className="px-3 py-2 text-left">Nama Barang Varian</th>
                  <th className="px-3 py-2 text-left">Bulan</th>
                  {dateHeaders.map((d) => (
                    <th key={d.key} className="px-3 py-2 text-center">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4 + dateHeaders.length} className="px-3 py-6 text-center text-slate-500">
                      Memuat data...
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={4 + dateHeaders.length} className="px-3 py-6 text-center text-slate-500">
                      Tidak ada data.
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((row) => (
                    <tr key={row.kode_barang_variant} className="border-b border-slate-100">
                      <td className="px-3 py-2">{row.nama_supplier}</td>
                      <td className="px-3 py-2">{row.nama_merk}</td>
                      <td className="px-3 py-2">{row.nama_barang_varian}</td>
                      <td className="px-3 py-2">{monthLabel}</td>
                      {dateHeaders.map((d) => (
                        <td key={d.key} className="px-3 py-2 text-center">
                          {Number(row.values?.[d.key] ?? 0).toLocaleString("id-ID")}
                        </td>
                      ))}
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
