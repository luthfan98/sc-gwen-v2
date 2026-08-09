"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

type RequestRow = {
  kode_t_request: string;
  tgl_request: string;
  status_request: number;
  requested_by?: string | null;
  requested_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  catatan?: string | null;
  total_item?: number | null;
  approved_item?: number | null;
  rejected_item?: number | null;
  pending_item?: number | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export default function HargaJualApprovalListPage() {
  const [items, setItems] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showReviewed, setShowReviewed] = useState(false);

  const fetchList = async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q && q.trim()) params.set("q", q.trim());
      const res = await fetch(
        `${API_BASE}/harga-jual-request${params.toString() ? `?${params.toString()}` : ""}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed fetch harga jual request", err);
      setItems([]);
      setError("Gagal memuat request harga jual.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchList(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const approvedCount = items.filter((row) => row.status_request === 1).length;
  const rejectedCount = items.filter((row) => row.status_request === 2).length;
  const pendingCount = items.filter((row) => row.status_request === 0).length;

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("id-ID");
  };

  const filteredItems = useMemo(() => {
    const key = search.trim().toLowerCase();
    return items.filter((row) => {
      const matchText = key
        ? true
        : `${row.kode_t_request} ${row.requested_by || ""}`.toLowerCase().includes(key);
      const matchStatus =
        statusFilter === "ALL" ? true : Number(row.status_request) === Number(statusFilter);
      const hideInactive = Number(row.status_request) !== 3;
      const total = Number(row.total_item ?? 0);
      const approved = Number(row.approved_item ?? 0);
      const rejected = Number(row.rejected_item ?? 0);
      const isReviewed = total > 0 && approved + rejected >= total;
      const matchReviewed = showReviewed ? true : !isReviewed;
      return matchText && matchStatus && hideInactive && matchReviewed;
    });
  }, [items, search, statusFilter, showReviewed]);

  const toggleSelectAll = () => {
    if (filteredItems.length === 0) return;
    const allSelected = filteredItems.every((row) => selectedIds.has(row.kode_t_request));
    setSelectedIds(allSelected ? new Set() : new Set(filteredItems.map((row) => row.kode_t_request)));
  };

  const toggleSelect = (kode: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(kode)) {
        next.delete(kode);
      } else {
        next.add(kode);
      }
      return next;
    });
  };

  const handleDeactivate = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Nonaktifkan ${selectedIds.size} pengajuan terpilih?`)) return;
    try {
      const res = await fetch(`${API_BASE}/harga-jual-request/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode_list: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSelectedIds(new Set());
      await fetchList();
    } catch (err) {
      console.error("Failed deactivate request", err);
      alert("Gagal menonaktifkan pengajuan.");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Master Harga Jual</p>
          <h1 className="text-2xl font-bold text-gray-900">Approval Harga Jual</h1>
        </div>
        <button
          type="button"
          onClick={() => fetchList()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-gray-600">Daftar request harga jual</p>
          <p className="text-sm text-gray-500">
            Approved {approvedCount} · Rejected {rejectedCount} · Pending {pendingCount} · Total {items.length}
          </p>
        </div>
        <div className="px-4 pb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode / requester..."
              className="w-full md:w-72 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-52 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="ALL">Semua status</option>
              <option value="0">Pending</option>
              <option value="1">Approved</option>
              <option value="2">Rejected</option>
              <option value="3">Nonaktif</option>
            </select>
            <button
              type="button"
              onClick={() => setShowReviewed((prev) => !prev)}
              className="w-full md:w-auto rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              {showReviewed ? "Sembunyikan yang sudah ditinjau" : "Tampilkan yang sudah ditinjau"}
            </button>
          </div>
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={selectedIds.size === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          >
            Nonaktifkan Pengajuan
          </button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 w-10">
                  <input
                    type="checkbox"
                    checked={
                      filteredItems.length > 0 &&
                      filteredItems.every((row) => selectedIds.has(row.kode_t_request))
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-2">Kode</th>
                <th className="px-4 py-2">Tanggal</th>
                <th className="px-4 py-2">Requester</th>
                <th className="px-4 py-2">Total Item</th>
                <th className="px-4 py-2">Status (A/R/P)</th>
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
                    Tidak ada data.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filteredItems.map((row) => (
                  <tr key={row.kode_t_request} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.kode_t_request)}
                        onChange={() => toggleSelect(row.kode_t_request)}
                      />
                    </td>
                    <td className="px-4 py-2 font-semibold text-gray-900">{row.kode_t_request}</td>
                    <td className="px-4 py-2">{formatDate(row.requested_at || row.tgl_request)}</td>
                    <td className="px-4 py-2">{row.requested_by || "-"}</td>
                    <td className="px-4 py-2">{row.total_item ?? 0}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                          Approved {row.approved_item ?? 0}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                          Rejected {row.rejected_item ?? 0}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                          Pending {row.pending_item ?? 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/admin/master/harga-jual/approval/${encodeURIComponent(row.kode_t_request)}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Detail
                      </Link>
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
