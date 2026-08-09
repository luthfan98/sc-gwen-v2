"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, RefreshCw, ArrowLeft } from "lucide-react";

type PenerimaanRow = {
  kode_t_pemindahan: string;
  kode_t_penerimaan?: string | null;
  tipe_lokasi_dari: string;
  kode_lokasi_dari: string;
  tipe_lokasi_tujuan: string;
  kode_lokasi_tujuan: string;
  tgl: string;
  created_by: string | null;
  total_kirim: number;
  total_terima: number;
  persen_terima: number;
};

export default function TerimaPemindahanPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [items, setItems] = useState<PenerimaanRow[]>([]);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterFromType, setFilterFromType] = useState("semua");
  const [filterFromCode, setFilterFromCode] = useState("semua");
  const [filterToType, setFilterToType] = useState("semua");
  const [filterToCode, setFilterToCode] = useState("semua");
  const [statusFilter, setStatusFilter] = useState("semua");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roleLower = String(roleName || "").toLowerCase();
  const isPramuniaga = roleLower === "staff_pramuniaga";

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/penerimaan-pemindahan`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed fetch penerimaan pemindahan", err);
      setItems([]);
      setError("Gagal memuat data penerimaan.");
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("kosmetik-admin-session");
      if (!raw) {
        setRoleName(null);
        return;
      }
      const parsed = JSON.parse(raw);
      setRoleName(parsed?.role?.name ? String(parsed.role.name) : null);
    } catch {
      setRoleName(null);
    }
  }, []);

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("id-ID");
  };

  const statusBadge = (persen: number) => {
    if (persen >= 100) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (persen > 0) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-rose-50 text-rose-700 border-rose-200";
  };

  const scopedItems = isPramuniaga
    ? items.filter(
        (row) =>
          String(row.tipe_lokasi_dari || "").toUpperCase() === "GUDANG" &&
          String(row.tipe_lokasi_tujuan || "").toUpperCase() === "TOKO"
      )
    : items;

  const fromTypeOptions = Array.from(new Set(scopedItems.map((i) => i.tipe_lokasi_dari).filter(Boolean)));
  const fromCodeOptions = Array.from(new Set(scopedItems.map((i) => i.kode_lokasi_dari).filter(Boolean)));
  const toTypeOptions = Array.from(new Set(scopedItems.map((i) => i.tipe_lokasi_tujuan).filter(Boolean)));
  const toCodeOptions = Array.from(new Set(scopedItems.map((i) => i.kode_lokasi_tujuan).filter(Boolean)));

  const filteredItems = scopedItems.filter((row) => {
    const keyword = search.trim().toLowerCase();
    if (keyword) {
      const haystack = `${row.kode_t_pemindahan} ${row.kode_t_penerimaan ?? ""} ${row.tipe_lokasi_dari} ${row.kode_lokasi_dari} ${row.tipe_lokasi_tujuan} ${row.kode_lokasi_tujuan} ${row.created_by ?? ""}`
        .toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    if (filterFromType !== "semua" && row.tipe_lokasi_dari !== filterFromType) return false;
    if (filterFromCode !== "semua" && row.kode_lokasi_dari !== filterFromCode) return false;
    if (filterToType !== "semua" && row.tipe_lokasi_tujuan !== filterToType) return false;
    if (filterToCode !== "semua" && row.kode_lokasi_tujuan !== filterToCode) return false;
    if (statusFilter === "belum" && Number(row.persen_terima ?? 0) >= 100) return false;
    if (statusFilter === "sudah" && Number(row.persen_terima ?? 0) < 100) return false;
    if (dateFrom) {
      const dt = row.tgl ? new Date(row.tgl).toISOString().slice(0, 10) : "";
      if (!dt || dt < dateFrom) return false;
    }
    if (dateTo) {
      const dt = row.tgl ? new Date(row.tgl).toISOString().slice(0, 10) : "";
      if (!dt || dt > dateTo) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fffb] via-white to-[#e5f7f3] p-4 md:p-6 space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Logistik</p>
            <h1 className="text-2xl font-bold text-gray-900">Terima Pemindahan</h1>
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
            onClick={fetchList}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-600">Daftar Pemindahan Masuk</p>
          <p className="text-sm text-gray-500">Total: {filteredItems.length}</p>
        </div>
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode / lokasi / user"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[220px] flex-1"
          />
          <select
            value={filterFromType}
            onChange={(e) => setFilterFromType(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[140px]"
          >
            <option value="semua">Dari (Tipe)</option>
            {fromTypeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select
            value={filterFromCode}
            onChange={(e) => setFilterFromCode(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[140px]"
          >
            <option value="semua">Dari (Kode)</option>
            {fromCodeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select
            value={filterToType}
            onChange={(e) => setFilterToType(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[140px]"
          >
            <option value="semua">Tujuan (Tipe)</option>
            {toTypeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select
            value={filterToCode}
            onChange={(e) => setFilterToCode(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[140px]"
          >
            <option value="semua">Tujuan (Kode)</option>
            {toCodeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[140px]"
          >
            <option value="semua">Status</option>
            <option value="belum">Belum 100%</option>
            <option value="sudah">Sudah 100%</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[140px]"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[140px]"
          />
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilterFromType("semua");
              setFilterFromCode("semua");
              setFilterToType("semua");
              setFilterToCode("semua");
              setStatusFilter("semua");
              setDateFrom("");
              setDateTo("");
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Kode</th>
                <th className="px-4 py-2">Kode Pemindahan</th>
                <th className="px-4 py-2">Tanggal</th>
                <th className="px-4 py-2">Dari</th>
                <th className="px-4 py-2">Tujuan</th>
                <th className="px-4 py-2">Progress</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-rose-600">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Belum ada pemindahan masuk.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filteredItems.map((row) => (
                  <tr key={row.kode_t_pemindahan} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-900">
                      {row.kode_t_penerimaan || "-"}
                      <div className="text-[11px] text-gray-500 font-normal">{row.kode_t_pemindahan}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{row.kode_t_pemindahan}</td>
                    <td className="px-4 py-2">{formatDate(row.tgl)}</td>
                    <td className="px-4 py-2">{row.tipe_lokasi_dari} {row.kode_lokasi_dari}</td>
                    <td className="px-4 py-2">{row.tipe_lokasi_tujuan} {row.kode_lokasi_tujuan}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${statusBadge(row.persen_terima || 0)}`}>
                        {row.total_terima ?? 0}/{row.total_kirim ?? 0} ({row.persen_terima ?? 0}%)
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {Number(row.persen_terima) >= 100 ? (
                        <Link
                          href={`/admin/logistik/terima-pemindahan/print/${encodeURIComponent(
                            row.kode_t_penerimaan || row.kode_t_pemindahan
                          )}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Print
                        </Link>
                      ) : (
                        <Link
                          href={`/admin/logistik/terima-pemindahan/${encodeURIComponent(row.kode_t_pemindahan)}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Terima
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
