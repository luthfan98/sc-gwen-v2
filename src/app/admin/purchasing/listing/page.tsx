"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ClipboardList } from "lucide-react";

type PengadaanRow = {
  kode_t_pengadaan: string;
  kode_t_rpo?: string | null;
  kode_supplier?: string | null;
  supplier_nama?: string | null;
  tgl?: string | null;
  deadline?: string | null;
  no_faktur_supplier?: string | null;
  catatan?: string | null;
  status_pengadaan?: number | null;
  status?: number | null;
  total_akhir?: number;
  total_tagihan?: number;
  total_dibayar?: number;
  qty_dikirim?: number;
  qty_diterima?: number;
  is_lunas?: number | boolean | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
};

const formatIDR = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

export default function ListingPengadaanPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [rows, setRows] = useState<PengadaanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "aktif" | "nonaktif">("aktif");
  const [lunasFilter, setLunasFilter] = useState<"all" | "lunas" | "belum">("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deactivating, setDeactivating] = useState<Record<string, boolean>>({});
  const pageSize = 50;

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: statusFilter === "all" ? "all" : statusFilter,
      });
      const res = await fetch(`${API_BASE}/pengadaan?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(
        Array.isArray(data)
          ? data.map((row: any) => ({
              kode_t_pengadaan: row.kode_t_pengadaan || "-",
              kode_t_rpo: row.kode_t_rpo || null,
              kode_supplier: row.kode_supplier || null,
              supplier_nama: row.supplier_nama || null,
              tgl: row.tgl ? String(row.tgl).slice(0, 10) : null,
              deadline: row.deadline ? String(row.deadline).slice(0, 10) : null,
              no_faktur_supplier: row.no_faktur_supplier || null,
              catatan: row.catatan || null,
              status_pengadaan: row.status_pengadaan ?? null,
              status: row.status ?? null,
              total_akhir: Number(row.total_akhir ?? 0),
              total_tagihan: Number(row.total_tagihan ?? 0),
              total_dibayar: Number(row.total_dibayar ?? 0),
              qty_dikirim: Number(row.qty_dikirim ?? 0),
              qty_diterima: Number(row.qty_diterima ?? 0),
              is_lunas: row.is_lunas ?? 0,
              created_by: row.created_by || null,
              created_at: row.created_at ? String(row.created_at).slice(0, 10) : null,
              updated_by: row.updated_by || null,
              updated_at: row.updated_at ? String(row.updated_at).slice(0, 10) : null,
            }))
          : []
      );
    } catch (err) {
      console.error("Failed load pengadaan list", err);
      setError("Gagal memuat daftar pengadaan.");
    } finally {
      setLoading(false);
    }
  }, [API_BASE, statusFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleDeactivate = async (row: PengadaanRow) => {
    const kode = String(row.kode_t_pengadaan || "").trim();
    if (!kode.startsWith("PEN.")) {
      window.alert("Hanya PO dengan kode PEN yang bisa dinonaktifkan.");
      return;
    }
    if (Number(row.status ?? 0) !== 1) {
      window.alert("PO ini sudah nonaktif.");
      return;
    }
    const alasan = window.prompt(
      `Alasan menonaktifkan ${kode}:`,
      "DINONAKTIFKAN: double input"
    );
    if (alasan === null) return;
    const cleanAlasan = alasan.trim();
    if (!cleanAlasan) {
      window.alert("Alasan wajib diisi.");
      return;
    }
    if (!window.confirm(`Nonaktifkan PO ${kode}? Tagihan dan penerimaan terkait juga akan dinonaktifkan.`)) return;

    setDeactivating((prev) => ({ ...prev, [kode]: true }));
    try {
      const res = await fetch(`${API_BASE}/pengadaan/${encodeURIComponent(kode)}/nonaktif`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alasan: cleanAlasan, updated_by: "Admin" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      window.alert(data?.message || "PO berhasil dinonaktifkan.");
      await fetchList();
    } catch (err) {
      console.error("Failed deactivate pengadaan", err);
      window.alert(err instanceof Error ? err.message : "Gagal menonaktifkan PO.");
    } finally {
      setDeactivating((prev) => ({ ...prev, [kode]: false }));
    }
  };

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      const kode = String(row.kode_supplier || "").trim();
      const label = String(row.supplier_nama || row.kode_supplier || "").trim();
      if (!kode && !label) return;
      map.set(kode || label, label || kode);
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "id"));
  }, [rows]);

  const filtered = useMemo(() => {
    const key = search.toLowerCase();
    return rows.filter((r) => {
      const matchText =
        String(r.kode_t_pengadaan || "").toLowerCase().includes(key) ||
        String(r.kode_t_rpo || "").toLowerCase().includes(key) ||
        String(r.supplier_nama || r.kode_supplier || "").toLowerCase().includes(key);
      const lunasVal = Number(r.is_lunas ?? 0) === 1 ? "lunas" : "belum";
      if (lunasFilter !== "all" && lunasVal !== lunasFilter) return false;
      if (supplierFilter !== "all" && String(r.kode_supplier || "") !== supplierFilter) return false;
      if (createdFrom) {
        const createdDate = String(r.created_at || "").slice(0, 10);
        if (!createdDate || createdDate < createdFrom) return false;
      }
      if (createdTo) {
        const createdDate = String(r.created_at || "").slice(0, 10);
        if (!createdDate || createdDate > createdTo) return false;
      }
      return matchText;
    });
  }, [rows, search, lunasFilter, supplierFilter, createdFrom, createdTo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, lunasFilter, supplierFilter, createdFrom, createdTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <p className="text-sm text-gray-500">Purchasing</p>
        <h1 className="text-2xl font-bold text-gray-900">Listing Pengadaan</h1>
        <p className="text-sm text-gray-600 mt-1">Daftar PO yang masih aktif dari GWEN_t_pengadaan.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor PO, RPO, atau supplier"
              className="w-full outline-none"
            />
          </div>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[200px]"
          >
            <option value="all">Semua Supplier</option>
            {supplierOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "aktif" | "nonaktif")}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="all">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
          <select
            value={lunasFilter}
            onChange={(e) => setLunasFilter(e.target.value as "all" | "lunas" | "belum")}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="all">Semua Lunas</option>
            <option value="lunas">Lunas</option>
            <option value="belum">Belum</option>
          </select>
          <label className="text-xs text-gray-600 flex items-center gap-2">
            Dari
            <input
              type="date"
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 flex items-center gap-2">
            Sampai
            <input
              type="date"
              value={createdTo}
              onChange={(e) => setCreatedTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-3 w-12 text-center">No.</th>
                <th className="px-3 py-3">Nomor PO</th>
                <th className="px-3 py-3">Supplier</th>
                <th className="px-3 py-3">No Faktur</th>
                <th className="px-3 py-3">Qty Dikirim/Diterima</th>
                <th className="px-3 py-3 text-right">Total Nilai</th>
                <th className="px-3 py-3 text-right">Total Dibayar</th>
                <th className="px-3 py-3 text-right">Sisa</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Status Lunas</th>
                <th className="px-3 py-3">Catatan</th>
                <th className="px-3 py-3">Dibuat</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={16}>
                    Memuat data...
                  </td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-rose-600" colSpan={16}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={16}>
                    Tidak ada data pengadaan.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                paged.map((row, idx) => {
                  const totalAkhir = Number(row.total_akhir ?? 0);
                  const totalTagihan = Number(row.total_tagihan ?? 0);
                  const totalDibayar = Number(row.total_dibayar ?? 0);
                  const basisTagihan = totalTagihan > 0 ? totalTagihan : totalAkhir;
                  const sisa = Math.max(0, basisTagihan - totalDibayar);
                  const statusLabel = Number(row.status ?? 0) === 1 ? "AKTIF" : "NONAKTIF";
                  return (
                    <tr key={row.kode_t_pengadaan} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-center text-gray-700">
                        {(safePage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-900">{row.kode_t_pengadaan}</td>
                      <td className="px-3 py-3 text-gray-800">{row.supplier_nama || row.kode_supplier || "-"}</td>
                      <td className="px-3 py-3 text-gray-700">{row.no_faktur_supplier || "-"}</td>
                      <td className="px-3 py-3">
                        {(() => {
                          const dikirim = Number(row.qty_dikirim ?? 0);
                          const diterima = Number(row.qty_diterima ?? 0);
                          const percent = dikirim > 0 ? Math.min(100, Math.round((diterima / dikirim) * 100)) : 0;
                          return (
                            <div className="min-w-[180px]">
                              <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>{`${dikirim} / ${diterima}`}</span>
                                <span>{`${percent}%`}</span>
                              </div>
                              <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
                                <div
                                  className="h-2 rounded-full bg-emerald-400"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-900 font-semibold">{formatIDR(totalAkhir)}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{formatIDR(totalDibayar)}</td>
                      <td className="px-3 py-3 text-right text-amber-700 font-semibold">{formatIDR(sisa)}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                          <ClipboardList className="w-3 h-3" />
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {(() => {
                          const isLunas = Number(row.is_lunas ?? 0) === 1;
                          return (
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                            isLunas
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-amber-50 text-amber-700 border border-amber-100"
                          }`}
                        >
                          {isLunas ? "Lunas" : "Belum"}
                        </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-3 text-gray-700">{row.catatan || "-"}</td>
                      <td className="px-3 py-3 text-gray-700">
                        {row.created_at ? `${row.created_at} (${row.created_by || "-"})` : "-"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              `/admin/purchasing/po/print?kode=${encodeURIComponent(row.kode_t_pengadaan || "")}`,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                          className="px-3 py-1 rounded-full bg-slate-900 text-white border border-slate-900 text-xs font-semibold hover:bg-slate-800"
                        >
                          Print PO
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(row)}
                          disabled={
                            !String(row.kode_t_pengadaan || "").startsWith("PEN.") ||
                            Number(row.status ?? 0) !== 1 ||
                            Boolean(deactivating[row.kode_t_pengadaan])
                          }
                          className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {deactivating[row.kode_t_pengadaan] ? "Proses..." : "Nonaktifkan"}
                        </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="text-gray-600">
              Menampilkan {Math.min((safePage - 1) * pageSize + 1, filtered.length)}-
              {Math.min(safePage * pageSize, filtered.length)} dari {filtered.length}
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
