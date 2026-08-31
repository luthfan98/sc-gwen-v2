"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CircleDollarSign, Eye, Pencil, RotateCcw, X } from "lucide-react";
import Swal from "sweetalert2";

type EventItem = {
  id: number;
  kode_barang_variant: string;
  nama_barang?: string;
  nama_varian?: string;
  kode_varian?: string;
  barcode_varian?: string;
  harga_normal_1: number;
  harga_normal_3: number;
  harga_normal_6: number;
  harga_normal_12: number;
  harga_event_1: number;
  harga_event_3: number;
  harga_event_6: number;
  harga_event_12: number;
};

type HargaEvent = {
  kode_t_harga_event: string;
  nama_event: string;
  berlaku_mulai: string;
  berlaku_sampai: string;
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "DRAFT";
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
  total_item?: number;
  items?: EventItem[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const API_URL = `${API_BASE}/barang-harga-jual/events`;

const formatRupiah = (value: number | string | null | undefined) =>
  value == null ? "-" : Number(value).toLocaleString("id-ID");
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
const localDateTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function statusStyle(status: HargaEvent["status"]) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-amber-100 text-amber-800",
    SCHEDULED: "bg-sky-100 text-sky-800",
    COMPLETED: "bg-emerald-100 text-emerald-800",
    CANCELLED: "bg-rose-100 text-rose-800",
    DRAFT: "bg-slate-100 text-slate-700",
  };
  return styles[status] || styles.DRAFT;
}

export default function MasterHargaEventPage() {
  const [events, setEvents] = useState<HargaEvent[]>([]);
  const [selected, setSelected] = useState<HargaEvent | null>(null);
  const [statusFilter, setStatusFilter] = useState("semua");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<HargaEvent | null>(null);
  const [splitPercent, setSplitPercent] = useState(52);
  const [resizing, setResizing] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  const getUsername = () => {
    try {
      return JSON.parse(localStorage.getItem("kosmetik-admin-session") || "{}").username || "Admin";
    } catch {
      return "Admin";
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      Swal.fire("Gagal memuat event", String(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (event: HargaEvent) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_URL}/${event.kode_t_harga_event}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setSelected(data);
    } catch (err) {
      Swal.fire("Gagal memuat detail", String(err), "error");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { loadEvents(); }, []);

  const filteredEvents = useMemo(() => events.filter((event) => {
    const matchesStatus = statusFilter === "semua" || event.status === statusFilter;
    const keyword = search.toLowerCase();
    const matchesSearch = !keyword || `${event.kode_t_harga_event} ${event.nama_event}`.toLowerCase().includes(keyword);
    return matchesStatus && matchesSearch;
  }), [events, search, statusFilter]);

  const refreshSelected = async () => {
    await loadEvents();
    if (selected) await openDetail(selected);
  };

  const handleCancel = async (event: HargaEvent) => {
    const confirm = await Swal.fire({ icon: "warning", title: "Batalkan event?", text: `${event.nama_event} tidak akan dijalankan.`, showCancelButton: true, confirmButtonText: "Batalkan Event", cancelButtonText: "Kembali" });
    if (!confirm.isConfirmed) return;
    const res = await fetch(`${API_URL}/${event.kode_t_harga_event}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updated_by: getUsername() }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return Swal.fire("Gagal membatalkan", data?.message || `HTTP ${res.status}`, "error");
    await Swal.fire("Event dibatalkan", data.message, "success");
    setSelected(null);
    await loadEvents();
  };

  const handleRestore = async (event: HargaEvent) => {
    const confirm = await Swal.fire({ icon: "warning", title: "Kembalikan harga normal?", text: `${event.nama_event} akan dihentikan sekarang.`, showCancelButton: true, confirmButtonText: "Kembalikan", cancelButtonText: "Kembali" });
    if (!confirm.isConfirmed) return;
    const res = await fetch(`${API_URL}/${event.kode_t_harga_event}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return Swal.fire("Gagal mengembalikan", data?.message || `HTTP ${res.status}`, "error");
    await Swal.fire("Harga normal dikembalikan", data.message, "success");
    setSelected(null);
    await loadEvents();
  };

  const openEdit = () => {
    if (!selected) return;
    setEditForm({ ...selected, items: (selected.items || []).map((item) => ({ ...item })) });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    if (!editForm.nama_event.trim() || !editForm.berlaku_mulai || !editForm.berlaku_sampai) {
      return Swal.fire("Data belum lengkap", "Nama dan periode event wajib diisi.", "warning");
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/${editForm.kode_t_harga_event}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_event: editForm.nama_event,
          berlaku_mulai: new Date(editForm.berlaku_mulai).toISOString(),
          berlaku_sampai: new Date(editForm.berlaku_sampai).toISOString(),
          updated_by: getUsername(),
          items: (editForm.items || []).map((item) => ({
            id: item.id,
            harga_event_1: Number(item.harga_event_1), harga_event_3: Number(item.harga_event_3),
            harga_event_6: Number(item.harga_event_6), harga_event_12: Number(item.harga_event_12),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setEditOpen(false);
      await Swal.fire("Event diperbarui", data.message, "success");
      await refreshSelected();
    } catch (err) {
      Swal.fire("Gagal menyimpan", String(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const updateSplit = (clientX: number) => {
    const rect = splitContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setSplitPercent(Math.min(70, Math.max(32, Number(next.toFixed(1)))));
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
    updateSplit(event.clientX);
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm text-gray-500">Master Harga</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Harga Event</h1>
          <p className="mt-1 text-sm text-gray-600">Kelola periode, harga per item, dan status aktivasi harga event.</p>
        </div>
        <Link href="/admin/master/harga-jual" className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" /> Master Harga Jual
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Terjadwal", events.filter((item) => item.status === "SCHEDULED").length, "text-sky-700 bg-sky-50"],
          ["Aktif", events.filter((item) => item.status === "ACTIVE").length, "text-amber-700 bg-amber-50"],
          ["Selesai", events.filter((item) => item.status === "COMPLETED").length, "text-emerald-700 bg-emerald-50"],
          ["Dibatalkan", events.filter((item) => item.status === "CANCELLED").length, "text-rose-700 bg-rose-50"],
        ].map(([label, value, style]) => <div key={String(label)} className={`rounded-xl px-3 py-2 ${style}`}><p className="text-xs">{label}</p><p className="text-lg font-bold">{value}</p></div>)}
      </div>

      <div ref={splitContainerRef} style={{ "--event-list-width": `${splitPercent}%` } as React.CSSProperties} className={`flex min-h-[560px] flex-col gap-4 xl:flex-row xl:gap-0 ${resizing ? "select-none" : ""}`}>
        <section className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:basis-[var(--event-list-width)] xl:shrink-0">
          <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/70 p-3 md:flex-row md:items-end">
            <label className="flex-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Cari event
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kode atau nama event" className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-sky-400" />
            </label>
            <label className="min-w-[170px] text-[10px] font-bold uppercase tracking-wide text-gray-500">Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case outline-none focus:border-sky-400">
                <option value="semua">Semua status</option><option value="SCHEDULED">Terjadwal</option><option value="ACTIVE">Aktif</option><option value="COMPLETED">Selesai</option><option value="CANCELLED">Dibatalkan</option>
              </select>
            </label>
          </div>
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm"><thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-3 py-3">Event</th><th className="px-3 py-3">Periode</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-center">Item</th><th className="px-3 py-3" /></tr></thead>
              <tbody className="divide-y divide-gray-100">{loading ? Array.from({ length: 8 }).map((_, index) => <tr key={index} className="animate-pulse"><td colSpan={5} className="px-3 py-4"><div className="h-3 rounded bg-gray-200" /></td></tr>) : filteredEvents.map((event) => <tr key={event.kode_t_harga_event} className={`cursor-pointer hover:bg-sky-50 ${selected?.kode_t_harga_event === event.kode_t_harga_event ? "bg-sky-50" : ""}`} onClick={() => openDetail(event)}><td className="px-3 py-3"><p className="font-semibold text-gray-900">{event.nama_event}</p><p className="text-[11px] text-gray-500">{event.kode_t_harga_event}</p></td><td className="px-3 py-3 text-xs text-gray-600"><p>{formatDate(event.berlaku_mulai)}</p><p>s/d {formatDate(event.berlaku_sampai)}</p></td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyle(event.status)}`}>{event.status}</span></td><td className="px-3 py-3 text-center font-semibold text-gray-700">{event.total_item ?? event.items?.length ?? 0}</td><td className="px-3 py-3"><Eye className="h-4 w-4 text-gray-400" /></td></tr>)}{!loading && !filteredEvents.length && <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-500">Tidak ada event yang sesuai.</td></tr>}</tbody>
            </table>
          </div>
        </section>

        <div
          role="separator"
          aria-label="Ubah lebar panel daftar event"
          aria-orientation="vertical"
          onPointerDown={startResize}
          onPointerMove={(event) => resizing && updateSplit(event.clientX)}
          onPointerUp={() => setResizing(false)}
          onPointerCancel={() => setResizing(false)}
          className="group relative hidden w-4 shrink-0 cursor-col-resize touch-none items-stretch justify-center xl:flex"
        >
          <div className={`h-full w-px transition-colors ${resizing ? "bg-sky-500" : "bg-gray-200 group-hover:bg-sky-400"}`} />
          <div className={`absolute top-1/2 flex h-12 w-4 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition-colors ${resizing ? "border-sky-400 text-sky-600" : "border-gray-200 text-gray-400 group-hover:border-sky-300 group-hover:text-sky-500"}`}>
            <span className="text-xs leading-none">|</span>
          </div>
        </div>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {!selected && !detailLoading && <div className="flex flex-1 flex-col items-center justify-center px-8 text-center text-gray-500"><CircleDollarSign className="h-10 w-10 text-gray-300" /><p className="mt-3 font-semibold text-gray-700">Pilih event untuk melihat detail</p><p className="mt-1 text-sm">Detail harga normal dan harga event per item akan tampil di sini.</p></div>}
          {detailLoading && <div className="space-y-4 p-5 animate-pulse"><div className="h-6 w-2/3 rounded bg-gray-200" /><div className="h-4 w-1/2 rounded bg-gray-200" /><div className="h-64 rounded bg-gray-100" /></div>}
          {selected && !detailLoading && <><div className="border-b border-gray-100 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-gray-500">{selected.kode_t_harga_event}</p><h2 className="text-lg font-bold text-gray-900">{selected.nama_event}</h2><p className="mt-1 text-xs text-gray-600">{formatDate(selected.berlaku_mulai)} s/d {formatDate(selected.berlaku_sampai)}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyle(selected.status)}`}>{selected.status}</span></div><div className="mt-3 flex flex-wrap gap-2">{selected.status === "SCHEDULED" && <><button onClick={openEdit} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"><Pencil className="h-3.5 w-3.5" /> Edit Event</button><button onClick={() => handleCancel(selected)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"><X className="h-3.5 w-3.5" /> Batalkan</button></>}{selected.status === "ACTIVE" && <button onClick={() => handleRestore(selected)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"><RotateCcw className="h-3.5 w-3.5" /> Kembalikan Harga Normal</button>}</div></div><div className="min-h-0 flex-1 overflow-auto"><table className="min-w-[760px] w-full text-xs"><thead className="sticky top-0 bg-gray-50 text-left text-gray-500"><tr><th className="px-3 py-2">Item</th><th className="px-2 py-2">Normal 1/3/6/12</th><th className="px-2 py-2">Event 1/3/6/12</th></tr></thead><tbody className="divide-y divide-gray-100">{(selected.items || []).map((item) => <tr key={item.id}><td className="px-3 py-2"><p className="font-semibold text-gray-900">{item.nama_barang || "-"}</p><p className="text-gray-600">{item.nama_varian || item.kode_varian || item.kode_barang_variant}</p><p className="text-[10px] text-gray-400">{item.barcode_varian || item.kode_barang_variant}</p></td><td className="whitespace-nowrap px-2 py-2 text-gray-600">{formatRupiah(item.harga_normal_1)} / {formatRupiah(item.harga_normal_3)} / {formatRupiah(item.harga_normal_6)} / {formatRupiah(item.harga_normal_12)}</td><td className="whitespace-nowrap px-2 py-2 font-semibold text-amber-800">{formatRupiah(item.harga_event_1)} / {formatRupiah(item.harga_event_3)} / {formatRupiah(item.harga_event_6)} / {formatRupiah(item.harga_event_12)}</td></tr>)}</tbody></table></div></>}
        </section>
      </div>

      {editOpen && editForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Event Terjadwal</p><h2 className="text-lg font-bold text-gray-900">Edit Harga Event</h2></div><button onClick={() => setEditOpen(false)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600">Tutup</button></div><div className="mt-5 grid gap-3 md:grid-cols-3"><label className="md:col-span-3 text-sm font-semibold text-gray-700">Nama Event<input value={editForm.nama_event} onChange={(e) => setEditForm({ ...editForm, nama_event: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-gray-700">Mulai<input type="datetime-local" value={localDateTime(editForm.berlaku_mulai)} onChange={(e) => setEditForm({ ...editForm, berlaku_mulai: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-normal" /></label><label className="text-sm font-semibold text-gray-700">Selesai<input type="datetime-local" value={localDateTime(editForm.berlaku_sampai)} onChange={(e) => setEditForm({ ...editForm, berlaku_sampai: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-normal" /></label></div><div className="mt-5 overflow-auto rounded-xl border border-gray-200"><table className="min-w-[900px] w-full text-xs"><thead className="bg-gray-50 text-left text-gray-500"><tr><th className="px-3 py-2">Item</th>{["1 PCS", "3 PCS", "6 PCS", "12 PCS"].map((tier) => <th key={tier} className="px-2 py-2">{tier}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{(editForm.items || []).map((item, index) => <tr key={item.id}><td className="px-3 py-2"><p className="font-semibold">{item.nama_varian || item.kode_barang_variant}</p><p className="text-[10px] text-gray-500">Normal {formatRupiah(item.harga_normal_1)} / {formatRupiah(item.harga_normal_3)} / {formatRupiah(item.harga_normal_6)} / {formatRupiah(item.harga_normal_12)}</p></td>{(["harga_event_1", "harga_event_3", "harga_event_6", "harga_event_12"] as const).map((field) => <td key={field} className="px-2 py-2"><input type="number" min="0" value={item[field]} onChange={(e) => setEditForm((prev) => { if (!prev) return prev; const items = [...(prev.items || [])]; items[index] = { ...items[index], [field]: e.target.value === "" ? 0 : Number(e.target.value) }; return { ...prev, items }; })} className="w-28 rounded-md border border-gray-200 px-2 py-1.5 text-right" /></td>)}</tr>)}</tbody></table></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setEditOpen(false)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700">Batal</button><button onClick={saveEdit} disabled={saving} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">{saving ? "Menyimpan..." : "Simpan Perubahan"}</button></div></div></div>}
    </div>
  );
}
