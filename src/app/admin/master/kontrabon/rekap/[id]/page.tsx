"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Printer, Plus, Wallet, Bell, ClipboardList, Trash2, Search, X } from "lucide-react";
import Swal from "sweetalert2";

type RekapHeader = {
  id: number;
  tgl_rekap: string | null;
  status_rekap: string | null;
  status: number | null;
  approved_by: string | null;
  approved_at: string | null;
  catatan: string | null;
};

type RekapItem = {
  no: number;
  id_wadah_rekap: number;
  nokontrabon: string | null;
  no_faktur: string | null;
  kode_t_pengadaan: string | null;
  id_tagihan_list: string | null;
  username: string | null;
  namasupp: string | null;
  tglbeli: string | null;
  tglinput: string | null;
  total: number | null;
  gt: number | null;
  tambahan: string | null;
  stspaid: string | null;
  stsopen: string | null;
  status_notif_wa: string | null;
  catatan: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

const formatCurrency = (value?: number | null) => {
  const safe = Number(value ?? 0);
  const rounded = Math.ceil(safe);
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(
    Number.isFinite(rounded) ? rounded : 0
  );
};

const parseTambahan = (raw?: string | null) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parsePurchaseList = (raw?: string | null) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(raw || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
};

export default function KontrabonRekapDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [header, setHeader] = useState<RekapHeader | null>(null);
  const [items, setItems] = useState<RekapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [kontrabonList, setKontrabonList] = useState<any[]>([]);
  const [kontrabonLoading, setKontrabonLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKontrabon, setSelectedKontrabon] = useState<Set<string>>(new Set());
  const [roleName, setRoleName] = useState<string | null>(null);
  const roleLower = String(roleName || "").toLowerCase();
  const isSuperAdmin = roleLower === "super_admin";

  const fetchDetail = async (signal?: AbortSignal) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/kontrabon/rekap/${encodeURIComponent(id)}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHeader(data?.header || null);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Gagal memuat detail rekap.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(controller.signal);
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    document.body.classList.add("kontrabon-rekap-no-x");
    return () => document.body.classList.remove("kontrabon-rekap-no-x");
  }, []);

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

  const fetchKontrabonList = async () => {
    setKontrabonLoading(true);
    try {
      const res = await fetch(`${API_BASE}/kontrabon`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setKontrabonList(Array.isArray(data) ? data : []);
    } catch {
      setKontrabonList([]);
    } finally {
      setKontrabonLoading(false);
    }
  };

  useEffect(() => {
    if (showAddModal) {
      fetchKontrabonList();
    }
  }, [showAddModal]);

  const statusBadge = (value?: string | null) => {
    const label = value || "Not Paid";
    const normalized = label.toLowerCase();
    const isPaid =
      (normalized.includes("paid") && !normalized.includes("not")) ||
      normalized.includes("lunas") ||
      normalized.includes("terbayar");
    const badgeClass = isPaid ? "bg-emerald-600" : "bg-rose-600";
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold text-white ${badgeClass}`}>
        {label}
      </span>
    );
  };

  const isRekapPaid = useMemo(() => {
    const label = String(header?.status_rekap || "").toLowerCase();
    if (!label) return false;
    if (label.includes("not paid") || label.includes("unpaid") || label.includes("belum")) return false;
    return label.includes("paid") || label.includes("lunas") || label.includes("terbayar");
  }, [header?.status_rekap]);

  const notifBadge = (value?: string | null) => (
    <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold bg-amber-500 text-white">
      {value || "Belum Terkirim"}
    </span>
  );

  const renderWhatsappButton = (label?: string | null) => (
    <button
      type="button"
      className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700"
      aria-label={label ? `Kirim notif WhatsApp (${label})` : "Kirim notif WhatsApp"}
      title={label ? `Kirim notif WhatsApp (${label})` : "Kirim notif WhatsApp"}
    >
      <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M16.02 3C8.85 3 3 8.76 3 15.85c0 2.8.94 5.39 2.53 7.49L4 29l5.82-1.52a13.2 13.2 0 0 0 6.2 1.58h.01C23.2 29.06 29 23.3 29 16.2 29 9.12 23.2 3 16.02 3zm7.5 18.8c-.32.9-1.87 1.65-2.57 1.74-.65.08-1.45.12-2.33-.14-.54-.17-1.24-.4-2.14-.78-3.78-1.58-6.25-5.45-6.44-5.7-.18-.25-1.54-2.05-1.54-3.9 0-1.86.97-2.77 1.31-3.15.34-.39.75-.48 1-.48.25 0 .5 0 .72.01.23.02.53-.09.83.63.32.77 1.09 2.66 1.18 2.85.1.19.17.42.04.67-.12.25-.19.42-.38.64-.19.22-.4.49-.58.66-.19.19-.39.39-.17.77.22.38.97 1.6 2.08 2.6 1.43 1.28 2.63 1.68 3.02 1.87.38.19.6.17.82-.1.22-.25.94-1.1 1.19-1.48.25-.38.5-.31.84-.18.35.12 2.2 1.04 2.58 1.23.38.19.63.29.72.45.08.17.08.95-.24 1.85z"
        />
      </svg>
    </button>
  );

  const summaryRows = useMemo(
    () =>
      items.map((item) => ({
        total: item.gt ?? item.total ?? 0,
        statusBayar: item.stspaid || "Not Paid",
        kirimNotif: item.stsopen || "Not Paid",
        statusNotif: item.status_notif_wa || "Belum Terkirim",
      })),
    [items]
  );
  const totalNominal = useMemo(
    () => summaryRows.reduce((acc, row) => acc + Number(row.total ?? 0), 0),
    [summaryRows]
  );

  const filteredKontrabon = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const existing = new Set(
      items.map((item) => String(item.nokontrabon || "")).filter((code) => code)
    );
    const source = kontrabonList.filter(
      (row) => !existing.has(String(row.no_kontrabon || "")) && Number(row.is_in_rekap ?? 0) === 0
    );
    if (!term) return source;
    return source.filter((row) => {
      const no = String(row.no_kontrabon || "").toLowerCase();
      const faktur = String(row.no_faktur || "").toLowerCase();
      return no.includes(term) || faktur.includes(term);
    });
  }, [kontrabonList, items, searchTerm]);

  const toggleAllKontrabon = (checked: boolean) => {
    if (!checked) {
      setSelectedKontrabon(new Set());
      return;
    }
    const next = new Set<string>();
    filteredKontrabon.forEach((row) => {
      if (row.no_kontrabon) next.add(String(row.no_kontrabon));
    });
    setSelectedKontrabon(next);
  };

  const toggleKontrabon = (code: string, checked: boolean) => {
    setSelectedKontrabon((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (!id || selectedKontrabon.size === 0) return;
    const list = Array.from(selectedKontrabon);
    try {
      const res = await fetch(`${API_BASE}/kontrabon/rekap/${encodeURIComponent(id)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ no_kontrabon_list: list }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload?.message || `Gagal menambahkan kontrabon (HTTP ${res.status})`;
        Swal.fire({ icon: "error", title: "Gagal", text: message });
        return;
      }
      setShowAddModal(false);
      setSelectedKontrabon(new Set());
      fetchDetail();
    } catch {
      setError("Gagal menambahkan kontrabon.");
      Swal.fire({ icon: "error", title: "Gagal", text: "Gagal menambahkan kontrabon." });
    }
  };

  const handlePelunasan = async () => {
    if (!id || paying) return;
    setPaying(true);
    Swal.fire({
      title: "Memproses pelunasan...",
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false,
    });
    let paidBy = "Admin";
    const raw = localStorage.getItem("kosmetik-admin-session");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data?.username) paidBy = data.username;
      } catch {
        // ignore
      }
    }
    try {
      const res = await fetch(`${API_BASE}/kontrabon/rekap/${encodeURIComponent(id)}/pelunasan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid_by: paidBy }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchDetail();
      Swal.fire({ icon: "success", title: "Berhasil", text: "Pelunasan berhasil diproses." });
    } catch {
      setError("Gagal proses pelunasan.");
      Swal.fire({ icon: "error", title: "Gagal", text: "Pelunasan gagal diproses." });
    } finally {
      setPaying(false);
    }
  };

  const handleDeleteItem = async (row: RekapItem) => {
    if (!id || !row?.no) return;
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Hapus item rekap?",
      text: `Kontrabon ${row.nokontrabon || "-"} akan dihapus dari rekap.`,
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#e11d48",
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(
        `${API_BASE}/kontrabon/rekap/${encodeURIComponent(id)}/items/${encodeURIComponent(String(row.no))}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload?.message || `Gagal menghapus item (HTTP ${res.status})`;
        Swal.fire({ icon: "error", title: "Gagal", text: message });
        return;
      }
      setItems((prev) => prev.filter((item) => item.no !== row.no));
      Swal.fire({ icon: "success", title: "Berhasil", text: "Item rekap dihapus." });
    } catch {
      Swal.fire({ icon: "error", title: "Gagal", text: "Gagal menghapus item rekap." });
    }
  };

  return (
    <div className="min-h-screen bg-[#eef3ff] px-6 py-6 overflow-x-hidden">
      <style jsx global>{`
        body.kontrabon-rekap-no-x {
          overflow-x: hidden;
        }
      `}</style>
      <div className="w-full max-w-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Isi Rekap</h1>
            <div className="text-xs text-gray-500 mt-1">
              <span className="text-blue-600">Isi Rekap</span>
              <span className="px-2">»</span>
              <span>Isi Rekap</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {isSuperAdmin && (
              <button
                className="h-9 px-4 rounded-md bg-green-600 text-white text-sm font-semibold flex items-center gap-2"
                onClick={handlePelunasan}
                disabled={paying}
              >
                <Wallet className="w-4 h-4" />
                {paying ? "Memproses..." : "Pelunasan"}
              </button>
            )}
            <button className="h-9 px-4 rounded-md bg-slate-700 text-white text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Ajukan kontrabon 30%
            </button>
            <button className="h-9 px-4 rounded-md bg-slate-700 text-white text-sm font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Pemantauan Stok
            </button>
            <button
              className="h-9 px-4 rounded-md bg-slate-700 text-white text-sm font-semibold flex items-center gap-2"
              onClick={() => {
                if (!id) return;
                window.open(`/admin/master/kontrabon/rekap/${id}/print`, "_blank", "noopener,noreferrer");
              }}
            >
              <Printer className="w-4 h-4" />
              Print Nota
            </button>
            <button
              className="h-9 px-4 rounded-md bg-slate-700 text-white text-sm font-semibold flex items-center gap-2"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-4 h-4" />
              Tambah Nota
            </button>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-4 max-w-[calc(100vw-330px)]">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-800">ISI REKAP</div>
            <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-gray-800">
              <div>Tanggal Rekap : {formatDate(header?.tgl_rekap)}</div>
              <div>Total Nominal : {formatCurrency(totalNominal)}</div>
            </div>
          </div>
          {loading && <div className="mt-4 text-sm text-gray-500">Memuat data...</div>}
          {error && <div className="mt-4 text-sm text-rose-600">{error}</div>}
          {!loading && !error && (
            <div className="mt-4">
              <div className="overflow-x-auto rounded-lg border border-[#efe7c9] max-w-[calc(100vw-320px)]">
                <table className="w-full min-w-[1200px] text-sm">
                  <thead className="bg-[#fff8e6] text-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left w-24">AKSI</th>
                      <th className="px-4 py-3 text-left w-40">ID TAGIHAN</th>
                      <th className="px-4 py-3 text-left w-40">NO KONTRABON</th>
                      <th className="px-4 py-3 text-left w-40">NO FAKTUR</th>
                      <th className="px-4 py-3 text-left w-44">NO PURCHASE</th>
                      <th className="px-4 py-3 text-left w-40">TANGGAL KONTRABON</th>
                      <th className="px-4 py-3 text-left w-48">SUPPLIER</th>
                      <th className="px-4 py-3 text-left w-40">NOMINAL FAKTUR</th>
                      <th className="px-4 py-3 text-left">NOMINAL TAMBAHAN</th>
                      <th className="px-4 py-3 text-left w-40">NOMINAL TOTAL</th>
                      <th className="px-4 py-3 text-left w-32">STATUS BAYAR</th>
                      <th className="px-4 py-3 text-left w-32">KIRIM NOTIF</th>
                      <th className="px-4 py-3 text-left w-36">STATUS NOTIF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const tambahanList = parseTambahan(item.tambahan);
                      const summary = summaryRows[idx];
                      const purchaseList = parsePurchaseList(item.kode_t_pengadaan);
                      const tagihanList = String(item.id_tagihan_list || "")
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean);
                      return (
                        <tr key={item.no} className="border-t border-gray-200">
                          <td className="px-4 py-3">
                            {!isRekapPaid && (
                              <button
                                className="h-9 w-9 rounded-md bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700"
                                onClick={() => handleDeleteItem(item)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {tagihanList.length === 0 && <div>-</div>}
                            {tagihanList.map((tag) => (
                              <div key={`${item.no}-tag-${tag}`}>{tag}</div>
                            ))}
                          </td>
                          <td className="px-4 py-3">{item.nokontrabon || "-"}</td>
                          <td className="px-4 py-3">{item.no_faktur || "-"}</td>
                          <td className="px-4 py-3">
                            {purchaseList.length === 0 && <div>-</div>}
                            {purchaseList.map((code) => (
                              <div key={`${item.no}-po-${code}`}>{code}</div>
                            ))}
                          </td>
                          <td className="px-4 py-3">{formatDate(item.tglbeli)}</td>
                          <td className="px-4 py-3">{item.namasupp || "-"}</td>
                          <td className="px-4 py-3">{formatCurrency(item.total)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {tambahanList.length === 0 && <span>-</span>}
                            {tambahanList.map((row: any, idx2: number) => (
                              <div key={`${item.no}-tambahan-${idx2}`}>
                                ({row?.jenis || "-"}) Nominal: {formatCurrency(Number(row?.nominal ?? 0))}
                              </div>
                            ))}
                          </td>
                          <td className="px-4 py-3">{formatCurrency(summary?.total)}</td>
                          <td className="px-4 py-3">{statusBadge(summary?.statusBayar)}</td>
                          <td className="px-4 py-3">{renderWhatsappButton(summary?.kirimNotif)}</td>
                          <td className="px-4 py-3">{notifBadge(summary?.statusNotif)}</td>
                        </tr>
                      );
                    })}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                          Belum ada data rekap.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#0f172a] text-white text-xs">
                  +
                </span>
                Tambah Data
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="h-8 w-8 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                <div className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2 w-56">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari..."
                    className="w-full text-sm outline-none"
                  />
                </div>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left w-10">
                        <input
                          type="checkbox"
                          checked={
                            filteredKontrabon.length > 0 &&
                            filteredKontrabon.every((row) => selectedKontrabon.has(String(row.no_kontrabon)))
                          }
                          onChange={(e) => toggleAllKontrabon(e.target.checked)}
                        />
                      </th>
                      <th className="px-3 py-2 text-left">NO KONTRABON</th>
                      <th className="px-3 py-2 text-left">TGL KONTRABON</th>
                      <th className="px-3 py-2 text-left">NO FAKTUR</th>
                      <th className="px-3 py-2 text-left">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kontrabonLoading && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                          Memuat data...
                        </td>
                      </tr>
                    )}
                    {!kontrabonLoading &&
                      filteredKontrabon.map((row) => {
                        const code = String(row.no_kontrabon || "");
                        return (
                          <tr key={code} className="border-t border-gray-100">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedKontrabon.has(code)}
                                onChange={(e) => toggleKontrabon(code, e.target.checked)}
                              />
                            </td>
                            <td className="px-3 py-2 text-blue-700">{row.no_kontrabon || "-"}</td>
                            <td className="px-3 py-2">{formatDate(row.tgl_kontrabon)}</td>
                            <td className="px-3 py-2">{row.no_faktur || "-"}</td>
                            <td className="px-3 py-2">{formatCurrency(row.nominal_total)}</td>
                          </tr>
                        );
                      })}
                    {!kontrabonLoading && filteredKontrabon.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                          Tidak ada data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="h-9 px-4 rounded-md bg-slate-600 text-white text-sm font-semibold hover:bg-slate-700"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleAddSelected}
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
