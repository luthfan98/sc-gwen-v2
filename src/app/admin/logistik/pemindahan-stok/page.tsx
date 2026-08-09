"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Plus, RefreshCw, Printer } from "lucide-react";

type PemindahanRow = {
  kode_t_pemindahan: string;
  tipe_lokasi_dari: string;
  kode_lokasi_dari: string;
  tipe_lokasi_tujuan: string;
  kode_lokasi_tujuan: string;
  tgl: string;
  created_by: string | null;
  varian_list?: string | null;
  barcode_list?: string | null;
  total_qty: number;
  total_terima?: number;
  persen_terima?: number;
};

type GudangOption = {
  kode_gudang: string;
  nama: string;
};

type TokoOption = {
  kode_toko: string;
  nama_toko: string;
};

export default function PemindahanStokListPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [items, setItems] = useState<PemindahanRow[]>([]);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [gudangOptions, setGudangOptions] = useState<GudangOption[]>([]);
  const [tokoOptions, setTokoOptions] = useState<TokoOption[]>([]);
  const [gudangLoading, setGudangLoading] = useState(false);
  const [tokoLoading, setTokoLoading] = useState(false);
  const pageSize = 50;

  const gudangMap = useMemo(() => {
    const map = new Map<string, string>();
    gudangOptions.forEach((item) => {
      map.set(String(item.kode_gudang), String(item.nama || item.kode_gudang));
    });
    return map;
  }, [gudangOptions]);

  const tokoMap = useMemo(() => {
    const map = new Map<string, string>();
    tokoOptions.forEach((item) => {
      map.set(String(item.kode_toko), String(item.nama_toko || item.kode_toko));
    });
    return map;
  }, [tokoOptions]);

  const roleLower = String(roleName || "").toLowerCase();
  const isPramuniaga = roleLower === "staff_pramuniaga";

  const fetchPemindahan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/pemindahan`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed fetch pemindahan", err);
      setItems([]);
      setError("Gagal memuat data pemindahan.");
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  const fetchGudang = useCallback(async () => {
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
  }, [API_BASE]);

  const fetchToko = useCallback(async () => {
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
  }, [API_BASE]);

  useEffect(() => {
    fetchPemindahan();
    fetchGudang();
    fetchToko();
  }, [fetchPemindahan, fetchGudang, fetchToko]);

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

  const getLokasiLabel = useCallback((tipe?: string | null, kode?: string | null) => {
    const cleanType = String(tipe || "").toUpperCase();
    const cleanCode = String(kode || "");
    if (!cleanType || !cleanCode) return "-";
    if (cleanType === "GUDANG") {
      const name = gudangMap.get(cleanCode) || cleanCode;
      return `Gudang: ${name} (${cleanCode})`;
    }
    if (cleanType === "TOKO") {
      const name = tokoMap.get(cleanCode) || cleanCode;
      return `Toko: ${name} (${cleanCode})`;
    }
    return `${cleanType} ${cleanCode}`;
  }, [gudangMap, tokoMap]);

  const scopedItems = useMemo(() => {
    if (!isPramuniaga) return items;
    return items.filter(
      (row) =>
        String(row.tipe_lokasi_dari || "").toUpperCase() === "TOKO" &&
        String(row.tipe_lokasi_tujuan || "").toUpperCase() === "GUDANG"
    );
  }, [items, isPramuniaga]);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return scopedItems;
    return scopedItems.filter((row) => {
      const dariLabel = getLokasiLabel(row.tipe_lokasi_dari, row.kode_lokasi_dari).toLowerCase();
      const tujuanLabel = getLokasiLabel(row.tipe_lokasi_tujuan, row.kode_lokasi_tujuan).toLowerCase();
      return (
        String(row.kode_t_pemindahan || "").toLowerCase().includes(term) ||
        String(row.tipe_lokasi_dari || "").toLowerCase().includes(term) ||
        String(row.kode_lokasi_dari || "").toLowerCase().includes(term) ||
        String(row.tipe_lokasi_tujuan || "").toLowerCase().includes(term) ||
        String(row.kode_lokasi_tujuan || "").toLowerCase().includes(term) ||
        dariLabel.includes(term) ||
        tujuanLabel.includes(term) ||
        String(row.created_by || "").toLowerCase().includes(term) ||
        String(row.varian_list || "").toLowerCase().includes(term) ||
        String(row.barcode_list || "").toLowerCase().includes(term)
      );
    });
  }, [scopedItems, query, getLokasiLabel]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fffb] via-white to-[#e5f7f3] p-4 md:p-6 space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Logistik</p>
            <h1 className="text-2xl font-bold text-gray-900">Pemindahan Stok</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPemindahan}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <Link
            href="/admin/logistik/pemindahan-stok/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#16a34a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#15803d]"
          >
            <Plus className="w-4 h-4" />
            Tambah Pemindahan
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Cari kode, lokasi, pembuat, varian, barcode...${
                gudangLoading || tokoLoading ? " (memuat lokasi)" : ""
              }`}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-600">Daftar Pemindahan</p>
          <p className="text-sm text-gray-500">Total: {filteredItems.length}</p>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Kode</th>
                <th className="px-4 py-2">Tanggal</th>
                <th className="px-4 py-2">Dari</th>
                <th className="px-4 py-2">Tujuan</th>
                <th className="px-4 py-2">Diterima</th>
                <th className="px-4 py-2">Total Qty</th>
                <th className="px-4 py-2">Dibuat Oleh</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-rose-600">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    Belum ada pemindahan.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                pagedItems.map((row) => (
                  <tr key={row.kode_t_pemindahan} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-900">{row.kode_t_pemindahan}</td>
                    <td className="px-4 py-2">{formatDate(row.tgl)}</td>
                    <td className="px-4 py-2">{getLokasiLabel(row.tipe_lokasi_dari, row.kode_lokasi_dari)}</td>
                    <td className="px-4 py-2">{getLokasiLabel(row.tipe_lokasi_tujuan, row.kode_lokasi_tujuan)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                          Number(row.persen_terima ?? 0) >= 100
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {Number(row.total_terima ?? 0)} / {Number(row.total_qty ?? 0)}
                        <span>({Number(row.persen_terima ?? 0)}%)</span>
                      </span>
                    </td>
                    <td className="px-4 py-2">{row.total_qty ?? 0}</td>
                    <td className="px-4 py-2">{row.created_by || "-"}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/admin/logistik/pemindahan-stok/print/${encodeURIComponent(row.kode_t_pemindahan)}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        <Printer className="w-3 h-3" />
                        Print
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!loading && !error && filteredItems.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="text-gray-600">
              Menampilkan {Math.min((safePage - 1) * pageSize + 1, filteredItems.length)}-
              {Math.min(safePage * pageSize, filteredItems.length)} dari {filteredItems.length}
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
