"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil, Printer, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

type RekapRow = {
  id: number;
  tgl_rekap: string | null;
  status_rekap: string | null;
  status: number | null;
  approved_by: string | null;
  approved_at: string | null;
  catatan: string | null;
  total_nominal: number | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(
    Number(value ?? 0)
  );

const isPaidStatus = (value?: string | null) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("not paid") || normalized.includes("unpaid") || normalized.includes("belum")) {
    return false;
  }
  return normalized === "paid" || normalized === "lunas";
};

export default function KontrabonRekapPage() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [showModal, setShowModal] = useState(false);
  const [rekapDate, setRekapDate] = useState(today);
  const [rows, setRows] = useState<RekapRow[]>([]);
  const [catatanDrafts, setCatatanDrafts] = useState<Record<number, string>>({});
  const [savingCatatan, setSavingCatatan] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/kontrabon/rekap?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const nextRows = Array.isArray(data) ? data : [];
      setRows(nextRows);
      setCatatanDrafts((prev) => {
        const next = { ...prev };
        nextRows.forEach((row) => {
          if (next[row.id] === undefined) {
            next[row.id] = row.catatan || "";
          }
        });
        return next;
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Gagal memuat data rekap.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fromDate, toDate]);

  const handleCreateRekap = async () => {
    if (!rekapDate) return;
    try {
      const res = await fetch(`${API_BASE}/kontrabon/rekap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tgl_rekap: rekapDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowModal(false);
      fetchData();
    } catch {
      setError("Gagal membuat rekap.");
    }
  };

  const handleDisableRekap = async (id: number) => {
    if (!id) return;
    if (!window.confirm("Nonaktifkan rekap ini?")) return;
    let updatedBy = "Admin";
    const raw = localStorage.getItem("kosmetik-admin-session");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data?.username) updatedBy = data.username;
      } catch {
        // ignore
      }
    }
    try {
      const res = await fetch(`${API_BASE}/kontrabon/rekap/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: 0, updated_by: updatedBy }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchData();
    } catch {
      setError("Gagal menonaktifkan rekap.");
    }
  };

  const handleSaveCatatan = async (row: RekapRow) => {
    const draft = (catatanDrafts[row.id] ?? "").trim();
    setSavingCatatan((prev) => ({ ...prev, [row.id]: true }));
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/kontrabon/rekap/${row.id}/catatan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catatan: draft }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const message = payload?.message || `HTTP ${res.status}`;
        throw new Error(message);
      }
      const data = await res.json().catch(() => ({}));
      const nextNote = typeof data?.catatan === "string" ? data.catatan : draft;
      setRows((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, catatan: nextNote } : item))
      );
      setCatatanDrafts((prev) => ({ ...prev, [row.id]: nextNote || "" }));
    } catch (err) {
      console.error("Failed save catatan", err);
      setError("Gagal menyimpan catatan.");
    } finally {
      setSavingCatatan((prev) => ({ ...prev, [row.id]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[#eef3ff] px-6 py-6">
      <div className="w-full max-w-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Wadah Rekap</h1>
            <div className="text-xs text-gray-500 mt-1">
              <span className="text-blue-600">Wadah Rekap</span>
              <span className="px-2">»</span>
              <span>Wadah Rekap</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-700">Dari</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 px-3 rounded-md border border-gray-300 bg-white text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-700">Sampai</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 px-3 rounded-md border border-gray-300 bg-white text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="h-9 px-4 rounded-md bg-[#2f3b57] text-white text-sm font-semibold shadow-sm hover:bg-[#263148]"
            >
              + Buat Rekap
            </button>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-4">
          <div className="text-sm font-semibold text-gray-800">WADAH REKAP</div>
          <div className="mt-4 overflow-hidden rounded-lg border border-[#efe7c9]">
            <table className="w-full text-sm">
              <thead className="bg-[#fff8e6] text-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left w-40">AKSI</th>
                  <th className="px-4 py-3 text-left">TANGGAL REKAPAN</th>
                  <th className="px-4 py-3 text-left">STATUS REKAPAN</th>
                  <th className="px-4 py-3 text-left">TOTAL NOMINAL</th>
                  <th className="px-4 py-3 text-left">APPROVED BY</th>
                  <th className="px-4 py-3 text-left">APPROVED AT</th>
                  <th className="px-4 py-3 text-left w-56">CATATAN</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Memuat data...
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-rose-600">
                      {error}
                    </td>
                  </tr>
                )}
                {!loading &&
                  !error &&
                  rows.map((row) => {
                    const paid = isPaidStatus(row.status_rekap);
                    const statusTone = paid ? "bg-emerald-600" : "bg-rose-600";
                    const draft = catatanDrafts[row.id] ?? row.catatan ?? "";
                    const hasChanges = draft !== (row.catatan ?? "");
                    const isSaving = Boolean(savingCatatan[row.id]);
                    return (
                    <tr key={row.id} className="border-t border-gray-200">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDisableRekap(row.id)}
                          className="h-9 w-9 rounded-md bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700"
                          aria-label="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/master/kontrabon/rekap/${row.id}`)}
                          className="h-9 w-9 rounded-md bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700"
                          aria-label="Lihat"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              `/admin/master/kontrabon/rekap/${row.id}/print`,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                          className="h-9 w-9 rounded-md bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700"
                          aria-label="Cetak"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4">{formatDate(row.tgl_rekap)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold text-white ${statusTone}`}
                      >
                        {row.status_rekap || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-semibold text-gray-900">{formatCurrency(row.total_nominal)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold text-white ${
                          row.approved_by ? "bg-emerald-600" : "bg-rose-600"
                        }`}
                      >
                        {row.approved_by ? row.approved_by : "Belum diapproved"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{row.approved_at || "0000-00-00 00:00:00"}</td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="h-9 w-9 rounded-md bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600"
                            aria-label="Edit catatan"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {hasChanges && (
                            <button
                              type="button"
                              onClick={() => handleSaveCatatan(row)}
                              disabled={isSaving}
                              className="h-9 px-4 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {isSaving ? "Menyimpan..." : "Simpan"}
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={2}
                          className="w-full min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-sm"
                          value={draft}
                          onChange={(e) =>
                            setCatatanDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                          placeholder="Catatan..."
                        />
                      </div>
                    </td>
                  </tr>
                  );
                  })}
                {!loading && !error && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      Belum ada data rekap.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#0f172a] text-white text-xs">
                  +
                </span>
                Tambah Data
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4">
              <label className="block text-sm text-gray-700 mb-2">Rekapan untuk tanggal</label>
              <input
                type="date"
                value={rekapDate}
                onChange={(e) => setRekapDate(e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              />
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="h-9 px-4 rounded-md bg-slate-600 text-white text-sm font-semibold hover:bg-slate-700"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleCreateRekap}
                className="h-9 px-4 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                Buat Rekapan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
