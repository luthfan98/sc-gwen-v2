"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, Building2, ClipboardList, SendHorizonal, Trash2, ArrowUpRight, Download } from "lucide-react";

type RpoHeader = {
  kode_t_rpo: string;
  tgl: string;
  deadline: string;
  tanggal_barang_datang?: string;
  kode_supplier: string;
  supplier_nama?: string;
  merk_list?: string;
  kode_gudang_asal: string;
  status_rpo: string;
  is_active: boolean;
  is_rilis: boolean;
  kode_lpb?: string | null;
  kode_t_po?: string | null;
  total_barang: number;
  total_akhir: number;
  total_item: number;
  wa_notif_number?: string;
};

const formatIDR = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

export default function PermintaanPengadaanPage() {
  const router = useRouter();
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [list, setList] = useState<RpoHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("semua");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [releasingCode, setReleasingCode] = useState<string | null>(null);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<RpoHeader | null>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [roleName, setRoleName] = useState<string | null>(null);

  useEffect(() => {
    const fetchList = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/rpo`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) {
          setList([]);
          return;
        }
        setList(
          data
            .map((row: any) => ({
              kode_t_rpo: row.kode_t_rpo || row.kode_rpo || "-",
              tgl: row.tgl ? String(row.tgl).slice(0, 10) : "-",
              deadline: row.deadline ? String(row.deadline).slice(0, 10) : "-",
              tanggal_barang_datang: row.tanggal_barang_datang ? String(row.tanggal_barang_datang).slice(0, 10) : "-",
              kode_supplier: row.kode_supplier || "-",
              supplier_nama: row.supplier_nama || row.kode_supplier || "-",
              merk_list: row.merk_list || "-",
              kode_gudang_asal: row.kode_gudang_asal || "-",
              status_rpo: row.status_rpo || "DRAFT",
              is_active: row.is_active === undefined ? true : Boolean(row.is_active),
              is_rilis: Boolean(row.is_rilis),
              kode_lpb: row.kode_lpb ? String(row.kode_lpb) : null,
              kode_t_po: row.kode_t_po ? String(row.kode_t_po) : null,
              total_barang: Number(row.total_barang ?? 0),
              total_akhir: Number(row.total_akhir ?? 0),
              total_item: Number(row.total_item ?? 0),
              wa_notif_number: row.wa_notif_number || "",
            }))
            .filter((row) => row.is_active)
        );
      } catch (err) {
        console.error("Failed load RPO list", err);
        setError("Gagal memuat daftar RPO");
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [API_BASE]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawSession = localStorage.getItem("kosmetik-admin-session");
    if (!rawSession) return;
    try {
      const session = JSON.parse(rawSession);
      setRoleName(session?.role?.name || null);
    } catch {
      // ignore
    }
  }, []);

  const supplierOptions = useMemo(() => {
    const set = new Set<string>();
    list.forEach((r) => set.add(r.supplier_nama || r.kode_supplier));
    return Array.from(set);
  }, [list]);
  const isSuperAdmin = String(roleName || "").toLowerCase() === "super_admin";

  const deriveStatusKey = (r: RpoHeader) => {
    if (!r.is_active) return "batal";
    if (r.is_rilis) return "rilis";
    return (r.status_rpo || "DRAFT").toLowerCase();
  };

  const deriveStatusLabel = (r: RpoHeader) => {
    const key = deriveStatusKey(r);
    if (key === "batal") return "BATAL";
    if (key === "rilis") return "RILIS";
    return (r.status_rpo || "DRAFT").toUpperCase();
  };

  const summary = useMemo(() => {
    const totalNominal = (items: RpoHeader[]) => items.reduce((sum, r) => sum + (r.total_akhir || 0), 0);
    const draft = list.filter((r) => deriveStatusKey(r) === "draft");
    const submitted = list.filter((r) => deriveStatusKey(r) !== "draft");
    return {
      draftCount: draft.length,
      draftNominal: totalNominal(draft),
      submittedCount: submitted.length,
      submittedNominal: totalNominal(submitted),
    };
  }, [list]);

  const filtered = useMemo(() => {
    const key = search.toLowerCase();
    return list.filter((r) => {
      const matchText =
        r.kode_t_rpo.toLowerCase().includes(key) ||
        (r.supplier_nama || "").toLowerCase().includes(key) ||
        (r.merk_list || "").toLowerCase().includes(key) ||
        (r.kode_gudang_asal || "").toLowerCase().includes(key);
      const matchStatus = statusFilter === "semua" || deriveStatusKey(r) === statusFilter;
      const matchSupplier = supplierFilter ? (r.supplier_nama || r.kode_supplier) === supplierFilter : true;
      const tgl = r.tgl && r.tgl !== "-" ? r.tgl : "";
      const matchFrom = dateFrom ? tgl >= dateFrom : true;
      const matchTo = dateTo ? tgl <= dateTo : true;
      return matchText && matchStatus && matchSupplier && matchFrom && matchTo;
    });
  }, [list, search, statusFilter, supplierFilter, dateFrom, dateTo]);
  const filteredLength = filtered.length;

  const handleDelete = async (kode: string) => {
    if (!kode) return;
    const ok = window.confirm(`Nonaktifkan RPO ${kode}?`);
    if (!ok) return;
    try {
      const res = await fetch(`${API_BASE}/rpo/${encodeURIComponent(kode)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setList((prev) => prev.filter((r) => r.kode_t_rpo !== kode));
    } catch (err) {
      console.error("Failed delete RPO", err);
      alert("Gagal menonaktifkan RPO.");
    }
  };

  const openReleaseModal = (rpo: RpoHeader) => {
    setReleaseTarget(rpo);
    setDeliveryDate("");
    setReleaseModalOpen(true);
  };

  const closeReleaseModal = () => {
    if (releasingCode) return;
    setReleaseModalOpen(false);
    setReleaseTarget(null);
  };

  const handleRelease = async (rpo: RpoHeader) => {
    if (!rpo?.kode_t_rpo || releasingCode) return;
    if (!deliveryDate) {
      alert("Pilih tanggal kirim terlebih dahulu.");
      return;
    }
    setReleasingCode(rpo.kode_t_rpo);
    try {
      const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
      let rilisBy = "Admin";
      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession);
          rilisBy = parsed?.username || parsed?.name || rilisBy;
        } catch {
          // ignore parse error
        }
      }
      const res = await fetch(`${API_BASE}/rpo/${encodeURIComponent(rpo.kode_t_rpo)}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rilis_by: rilisBy,
          tanggal_barang_datang: deliveryDate,
          request_pengiriman_dari: deliveryDate,
          request_pengiriman_sampai: deliveryDate,
        }),
      });
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const payload = await res.json();
          if (payload?.message) message = payload.message;
        } catch {
          // ignore response parse error
        }
        throw new Error(message);
      }
      setList((prev) =>
        prev.map((r) => (r.kode_t_rpo === rpo.kode_t_rpo ? { ...r, is_rilis: true } : r))
      );
      setReleaseModalOpen(false);
      setReleaseTarget(null);
    } catch (err) {
      console.error("Failed release RPO", err);
      alert(err instanceof Error ? err.message : "Gagal rilis RPO.");
    } finally {
      setReleasingCode(null);
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) return;
    const headers = [
      "Nomor RPO",
      "Tanggal",
      "Deadline",
      "Tanggal Barang Datang",
      "Supplier",
      "Merk",
      "Gudang",
      "Total Item",
      "Total Qty",
      "Total Nilai",
      "Status",
    ];
    const rows = filtered.map((r) => [
      r.kode_t_rpo,
      r.tgl,
      r.deadline,
      r.tanggal_barang_datang || "-",
      r.supplier_nama || r.kode_supplier,
      r.merk_list || "-",
      r.kode_gudang_asal,
      r.total_item,
      r.total_barang,
      r.total_akhir,
      deriveStatusLabel(r),
    ]);
    const csvContent =
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\r\n") + "\r\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `permintaan-pengadaan-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status: string) => {
    const low = (status || "").toLowerCase();
    const map: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700 border border-gray-200",
      rilis: "bg-sky-50 text-sky-700 border border-sky-200",
      approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      batal: "bg-rose-50 text-rose-700 border border-rose-200",
    };
    return map[low] || "bg-sky-50 text-sky-700 border border-sky-200";
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Purchasing</p>
          <h1 className="text-2xl font-bold text-gray-900">Permintaan Pengadaan</h1>
          <p className="text-sm text-gray-600 mt-1">Daftar RPO yang sudah tersimpan di sistem.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
          >
            <Download className="w-5 h-5" />
            Export Excel
          </button>
          <button
            onClick={() => router.push("/admin/purchasing/permintaan-pengadaan/new")}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Buat Permintaan
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Draft</p>
          <div className="flex items-end justify-between mt-2">
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.draftCount}</p>
              <p className="text-sm text-gray-600">Belum diajukan</p>
            </div>
            <p className="text-lg font-semibold text-amber-600">{formatIDR(summary.draftNominal)}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Diajukan / Lainnya</p>
          <div className="flex items-end justify-between mt-2">
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.submittedCount}</p>
              <p className="text-sm text-gray-600">Di luar draft</p>
            </div>
            <p className="text-lg font-semibold text-emerald-600">{formatIDR(summary.submittedNominal)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
        <div className="grid md:grid-cols-5 gap-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor, supplier, atau gudang"
              className="w-full outline-none"
            />
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="bg-white text-sm outline-none w-full"
            >
              <option value="">Semua supplier</option>
              {supplierOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white text-sm outline-none w-full"
            >
              <option value="semua">Semua status</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="rilis">Rilis</option>
              <option value="batal">Batal</option>
            </select>
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500">Dari</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-white text-sm outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500">Sampai</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-white text-sm outline-none w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-3 w-12 text-center">No.</th>
                <th className="px-3 py-3">Nomor</th>
                <th className="px-3 py-3">Tanggal</th>
                <th className="px-3 py-3">Deadline</th>
                <th className="px-3 py-3">Tanggal Barang Datang</th>
                <th className="px-3 py-3">Supplier</th>
                <th className="px-3 py-3">Merk</th>
                <th className="px-3 py-3">Gudang</th>
                <th className="px-3 py-3 text-right">Jumlah Baris</th>
                <th className="px-3 py-3 text-right">Total Qty</th>
                <th className="px-3 py-3 text-right">Total Nilai</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                    <td className="px-3 py-4 text-center text-gray-500" colSpan={13}>
                      Memuat data...
                    </td>
                  </tr>
                )}
                {error && !loading && (
                  <tr>
                    <td className="px-3 py-4 text-center text-rose-600" colSpan={13}>
                      {error}
                    </td>
                  </tr>
                )}
                {!loading && !error && filtered.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center text-gray-500" colSpan={13}>
                      Tidak ada data permintaan.
                    </td>
                  </tr>
                )}
              {!loading &&
                !error &&
                filtered.map((r, idx) => {
                  const rowNum = filteredLength - idx; // descending numbering
                  const isApproved = deriveStatusKey(r) === "approved";
                  const isReleased = r.is_rilis;
                  const hasLpb = Boolean(r.kode_lpb);
                  const canDelete = isSuperAdmin || (!isApproved && !isReleased);
                  return (
                    <tr key={r.kode_t_rpo} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-center text-gray-700">{rowNum}</td>
                      <td className="px-3 py-3 font-semibold text-gray-900">{r.kode_t_rpo}</td>
                    <td className="px-3 py-3 text-gray-700">{r.tgl}</td>
                    <td className="px-3 py-3 text-gray-700">{r.deadline}</td>
                    <td className="px-3 py-3 text-gray-700">{r.tanggal_barang_datang || "-"}</td>
                    <td className="px-3 py-3 text-gray-800">{r.supplier_nama}</td>
                    <td className="px-3 py-3 text-gray-700">{r.merk_list || "-"}</td>
                    <td className="px-3 py-3 text-gray-800">{r.kode_gudang_asal}</td>
                    <td className="px-3 py-3 text-right text-gray-800">{r.total_item}</td>
                    <td className="px-3 py-3 text-right text-gray-800">{r.total_barang}</td>
                    <td className="px-3 py-3 text-right text-gray-900 font-semibold">{formatIDR(r.total_akhir)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(deriveStatusKey(r))}`}>
                        <ClipboardList className="w-3 h-3" />
                        {deriveStatusLabel(r)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            window.open(
                              `/admin/purchasing/permintaan-pengadaan/preview?kode=${r.kode_t_rpo}`,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                          className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold hover:bg-emerald-100 inline-flex items-center gap-1"
                        >
                          <SendHorizonal className="w-3 h-3" /> Preview
                        </button>
                        {isApproved && !isReleased && (
                          <button
                            onClick={() => openReleaseModal(r)}
                            disabled={releasingCode === r.kode_t_rpo}
                            className="px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100 text-xs font-semibold hover:bg-sky-100 inline-flex items-center gap-1 disabled:opacity-60"
                          >
                            <ArrowUpRight className="w-3 h-3" />{" "}
                            {releasingCode === r.kode_t_rpo ? "Rilis..." : "Rilis Sekarang"}
                          </button>
                        )}
                        {isReleased && !hasLpb && (
                          <button
                            onClick={() => router.push(`/penerimaan-barang/LPB/${r.kode_t_rpo}`)}
                            className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 text-xs font-semibold hover:bg-amber-100"
                          >
                            Buat LPB
                          </button>
                        )}
                        {hasLpb && (
                          <>
                            <button
                              onClick={() =>
                                window.open(
                                  `/penerimaan-barang/LPB/${r.kode_t_rpo}/print`,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                              className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-semibold hover:bg-indigo-100"
                            >
                              Print LPB
                            </button>
                            {r.kode_t_po ? (
                              <button
                                onClick={() =>
                                  window.open(
                                    `/admin/purchasing/po/print?kode=${encodeURIComponent(r.kode_t_po || "")}`,
                                    "_blank",
                                    "noopener,noreferrer"
                                  )
                                }
                                className="px-3 py-1 rounded-full bg-slate-900 text-white border border-slate-900 text-xs font-semibold hover:bg-slate-800"
                              >
                                Print PO
                              </button>
                              
                            ) : (
                              <button
                                onClick={() =>
                                  router.push(`/admin/purchasing/po/new?kode=${r.kode_t_rpo}`)
                                }
                                className="px-3 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100 text-xs font-semibold hover:bg-violet-100"
                              >
                                Buat PO
                              </button>
                            )}
                          </>
                        )}
                        {!isApproved && !isReleased && (
                          <button
                            onClick={() => router.push(`/admin/purchasing/permintaan-pengadaan/new?edit=${r.kode_t_rpo}`)}
                            className="px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100 text-xs font-semibold hover:bg-sky-100"
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(r.kode_t_rpo)}
                            className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100 text-xs font-semibold hover:bg-rose-100 inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {releaseModalOpen && releaseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeReleaseModal} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Rilis RPO</p>
                <h3 className="text-lg font-bold text-gray-900">{releaseTarget.kode_t_rpo}</h3>
              </div>
              <button
                onClick={closeReleaseModal}
                className="text-sm text-gray-500 hover:text-gray-700"
                disabled={Boolean(releasingCode)}
              >
                Tutup
              </button>
            </div>

            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Supplier</span>
                <span className="font-semibold text-gray-900">{releaseTarget.supplier_nama}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Total Item</span>
                <span className="font-semibold text-gray-900">{releaseTarget.total_item}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Total Qty</span>
                <span className="font-semibold text-gray-900">{releaseTarget.total_barang}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Total Harga</span>
                <span className="font-semibold text-gray-900">{formatIDR(releaseTarget.total_akhir)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-sm font-semibold text-gray-700">Waktu kirim barang</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={closeReleaseModal}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                disabled={Boolean(releasingCode)}
              >
                Batal
              </button>
              <button
                onClick={() => handleRelease(releaseTarget)}
                disabled={Boolean(releasingCode)}
                className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60"
              >
                {releasingCode ? "Merilis..." : "Rilis Sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
