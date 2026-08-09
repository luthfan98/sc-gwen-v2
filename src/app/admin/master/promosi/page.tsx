
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Eye, FilePlus2, Inbox, Pencil, Tag, XCircle } from "lucide-react";
import Swal from "sweetalert2";

type PromoRow = {
  kode_t_promosi: string;
  nama_promosi: string;
  deskripsi?: string | null;
  valid_from: string;
  valid_to: string;
  time_from?: string | null;
  time_to?: string | null;
  jenis_sumber?: string | null;
  status_aktif: number | boolean;
  status_approval: number;
  payment_scope?: string | null;
  budget_total?: number | null;
  budget_terpakai?: number | null;
  max_total_item?: number | null;
  total_item_terpakai?: number | null;
  max_total_redeem_trx?: number | null;
  total_redeem_trx_used?: number | null;
  is_archived?: number | boolean | null;
  created_at?: string;
  updated_at?: string;
};

type PromoDetail = {
  header: PromoRow;
  target_toko: string[];
  payment_methods: string[];
  rule_groups: unknown[];
  benefits: unknown[];
  banners: unknown[];
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString("id-ID");
};

const boolLabel = (value?: number | boolean | null) => (Number(value) === 1 ? "Aktif" : "Nonaktif");

const toDateKey = (value: Date) => {
  const yy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

const parseTimeToMinutes = (value?: string | null) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parts = text.split(":").map((v) => v.trim());
  if (parts.length < 2) return null;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
};

const getUsername = () => {
  const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
  let username = "Admin";
  if (rawSession) {
    try {
      const parsed = JSON.parse(rawSession);
      username = parsed?.username || parsed?.name || username;
    } catch {
      // ignore
    }
  }
  return String(username || "Admin");
};

export default function MasterPromosiPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [items, setItems] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [tokoFilter, setTokoFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<PromoDetail | null>(null);
  const [currentUser, setCurrentUser] = useState("Admin");

  const [form, setForm] = useState({
    nama_promosi: "",
    deskripsi: "",
    valid_from: "",
    valid_to: "",
    time_from: "",
    time_to: "",
    jenis_sumber: "",
    status_aktif: true,
    payment_scope: "ALL",
    redeem_mode: "ONCE",
    max_redeem_times_per_trx: "",
    max_redeem_per_customer: "",
    redeem_scope_per_customer: "",
    budget_total: "",
    max_total_item: "",
    max_total_redeem_trx: "",
  });

  const [jsonTargets, setJsonTargets] = useState("[]");
  const [jsonPayments, setJsonPayments] = useState("[]");
  const [jsonRules, setJsonRules] = useState("[]");
  const [jsonBenefits, setJsonBenefits] = useState("[]");
  const [jsonBanners, setJsonBanners] = useState("[]");
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setForm({
      nama_promosi: "",
      deskripsi: "",
      valid_from: "",
      valid_to: "",
      time_from: "",
      time_to: "",
      jenis_sumber: "",
      status_aktif: true,
      payment_scope: "ALL",
      redeem_mode: "ONCE",
      max_redeem_times_per_trx: "",
      max_redeem_per_customer: "",
      redeem_scope_per_customer: "",
      budget_total: "",
      max_total_item: "",
      max_total_redeem_trx: "",
    });
    setJsonTargets("[]");
    setJsonPayments("[]");
    setJsonRules("[]");
    setJsonBenefits("[]");
    setJsonBanners("[]");
    setFormError(null);
  };

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (activeFilter !== "ALL") params.set("aktif", activeFilter);
      if (tokoFilter.trim()) params.set("toko", tokoFilter.trim());

      const res = await fetch(`${API_BASE}/promos?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed fetch promos", err);
      setError("Gagal memuat data promosi.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, query, statusFilter, activeFilter, tokoFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    setCurrentUser(getUsername());
  }, []);

  const parseJsonArray = (value: string, label: string) => {
    if (!value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new Error(`${label} harus berupa array JSON`);
      }
      return parsed;
    } catch (err) {
      throw new Error(`${label} tidak valid`);
    }
  };
  const buildPayload = () => {
    const payload = {
      nama_promosi: form.nama_promosi,
      deskripsi: form.deskripsi || null,
      valid_from: form.valid_from,
      valid_to: form.valid_to,
      time_from: form.time_from || null,
      time_to: form.time_to || null,
      jenis_sumber: form.jenis_sumber || null,
      status_aktif: form.status_aktif ? 1 : 0,
      payment_scope: form.payment_scope,
      redeem_mode: form.redeem_mode,
      max_redeem_times_per_trx: form.max_redeem_times_per_trx ? Number(form.max_redeem_times_per_trx) : null,
      max_redeem_per_customer: form.max_redeem_per_customer ? Number(form.max_redeem_per_customer) : null,
      redeem_scope_per_customer: form.redeem_scope_per_customer || null,
      budget_total: form.budget_total ? Number(form.budget_total) : null,
      max_total_item: form.max_total_item ? Number(form.max_total_item) : null,
      max_total_redeem_trx: form.max_total_redeem_trx ? Number(form.max_total_redeem_trx) : null,
      target_toko: parseJsonArray(jsonTargets, "Target toko"),
      payment_methods: parseJsonArray(jsonPayments, "Payment methods"),
      rule_groups: parseJsonArray(jsonRules, "Rule groups"),
      benefits: parseJsonArray(jsonBenefits, "Benefits"),
      banners: parseJsonArray(jsonBanners, "Banners"),
    };
    return payload;
  };

  const openCreate = () => {
    resetForm();
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = async (kode: string) => {
    setFormError(null);
    setEditingId(kode);
    setModalOpen(true);
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setForm({
        nama_promosi: data.header?.nama_promosi || "",
        deskripsi: data.header?.deskripsi || "",
        valid_from: data.header?.valid_from?.slice(0, 16) || "",
        valid_to: data.header?.valid_to?.slice(0, 16) || "",
        time_from: data.header?.time_from || "",
        time_to: data.header?.time_to || "",
        jenis_sumber: data.header?.jenis_sumber || "",
        status_aktif: Number(data.header?.status_aktif) === 1,
        payment_scope: data.header?.payment_scope || "ALL",
        redeem_mode: data.header?.redeem_mode || "ONCE",
        max_redeem_times_per_trx: data.header?.max_redeem_times_per_trx?.toString() || "",
        max_redeem_per_customer: data.header?.max_redeem_per_customer?.toString() || "",
        redeem_scope_per_customer: data.header?.redeem_scope_per_customer || "",
        budget_total: data.header?.budget_total?.toString() || "",
        max_total_item: data.header?.max_total_item?.toString() || "",
        max_total_redeem_trx: data.header?.max_total_redeem_trx?.toString() || "",
      });
      setJsonTargets(JSON.stringify(data.target_toko || [], null, 2));
      setJsonPayments(JSON.stringify(data.payment_methods || [], null, 2));
      setJsonRules(JSON.stringify(data.rule_groups || [], null, 2));
      setJsonBenefits(JSON.stringify(data.benefits || [], null, 2));
      setJsonBanners(JSON.stringify(data.banners || [], null, 2));
    } catch (err) {
      console.error("Failed load promo detail", err);
      setFormError("Gagal memuat detail promosi.");
    }
  };

  const openDetail = async (kode: string) => {
    setDetailOpen(true);
    setDetailData(null);
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDetailData(data);
    } catch (err) {
      console.error("Failed load promo detail", err);
      setDetailData(null);
    }
  };

  const submitForm = async () => {
    setFormError(null);
    try {
      const payload = buildPayload();
      const url = editingId ? `${API_BASE}/promos/${encodeURIComponent(editingId)}` : `${API_BASE}/promos`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      setModalOpen(false);
      resetForm();
      await loadList();
    } catch (err: any) {
      setFormError(err?.message || "Gagal menyimpan promosi.");
    }
  };

  const updateStatus = async (kode: string, action: "approve" | "reject" | "archive" | "unarchive") => {
    const url = `${API_BASE}/promos/${encodeURIComponent(kode)}/${action}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await loadList();
  };

  const getPromoValidity = (promo: PromoRow) => {
    const reasons: string[] = [];
    const now = new Date();
    const nowKey = toDateKey(now);
    const from = promo.valid_from ? new Date(promo.valid_from) : null;
    const to = promo.valid_to ? new Date(promo.valid_to) : null;
    const fromKey = from ? toDateKey(from) : null;
    const toKey = to ? toDateKey(to) : null;
    const dateOk = (!fromKey || nowKey >= fromKey) && (!toKey || nowKey <= toKey);
    if (!dateOk) reasons.push("tanggal di luar periode");

    const timeFrom = parseTimeToMinutes(promo.time_from);
    const timeTo = parseTimeToMinutes(promo.time_to);
    if (timeFrom !== null && timeTo !== null) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const timeOk = timeFrom <= timeTo ? nowMinutes >= timeFrom && nowMinutes <= timeTo : nowMinutes >= timeFrom || nowMinutes <= timeTo;
      if (!timeOk) reasons.push("jam di luar window");
    }

    return { ok: reasons.length === 0, reasons };
  };

  const reactivatePromo = async (promo: PromoRow) => {
    const allowedUsers = ["natalia", "yudha", "uphan"];
    const currentLower = currentUser.trim().toLowerCase();
    const isAllowed = allowedUsers.includes(currentLower);
    if (!isAllowed) {
      await Swal.fire("Tidak diizinkan", "Fitur ini hanya untuk username natalia, yudha, uphan.", "warning");
      return;
    }

    const validity = getPromoValidity(promo);
    if (!validity.ok) {
      const confirm = await Swal.fire({
        icon: "warning",
        title: "Periode/jam tidak aktif",
        text: `Promo ini ${validity.reasons.join(" dan ")}. Tetap aktifkan kembali?`,
        showCancelButton: true,
        confirmButtonText: "Tetap aktifkan",
        cancelButtonText: "Batal",
      });
      if (!confirm.isConfirmed) return;
    }

    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(promo.kode_t_promosi)}/reactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updated_by: currentUser, approved_by: currentUser }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      await loadList();
    } catch (err: any) {
      await Swal.fire("Gagal", err?.message || "Gagal mengaktifkan kembali promosi.", "error");
    }
  };

  const rows = useMemo(() => items, [items]);
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Promosi</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/master/promosi/voucher"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Tag className="w-4 h-4" />
            Voucher
          </Link>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <FilePlus2 className="w-4 h-4" />
            Tambah Promosi
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_160px_160px_160px_auto] items-end">
          <label className="space-y-1 text-sm">
            <span className="text-gray-600">Pencarian</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama/desk promosi..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-600">Status Approval</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2"
            >
              <option value="ALL">Semua</option>
              <option value="0">Pending</option>
              <option value="1">Approved</option>
              <option value="2">Rejected</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-600">Status Aktif</span>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2"
            >
              <option value="ALL">Semua</option>
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-600">Filter Toko</span>
            <input
              value={tokoFilter}
              onChange={(e) => setTokoFilter(e.target.value)}
              placeholder="Kode toko"
              className="w-full rounded-lg border border-gray-200 px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={loadList}
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <p className="text-sm text-gray-500">Daftar Promosi</p>
            <p className="text-base font-semibold text-gray-800">Total {rows.length} promosi</p>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
              <tr>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-rose-600">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    <div className="inline-flex flex-col items-center gap-2">
                      <Inbox className="w-5 h-5" />
                      Belum ada data promosi.
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                rows.map((promo) => {
                  const allowedUsers = ["natalia", "yudha", "uphan"];
                  const currentLower = currentUser.trim().toLowerCase();
                  const isAllowed = allowedUsers.includes(currentLower);
                  const shouldReactivate =
                    Number(promo.status_aktif) !== 1 ||
                    Number(promo.status_approval) !== 1 ||
                    Number(promo.is_archived ?? 0) === 1;
                  return (
                  <tr key={promo.kode_t_promosi} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{promo.kode_t_promosi}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{promo.nama_promosi}</div>
                      <div className="text-xs text-gray-500">{promo.deskripsi || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-700">
                        <CalendarClock className="w-4 h-4 text-gray-400" />
                        <span>
                          {formatDate(promo.valid_from)} - {formatDate(promo.valid_to)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 space-y-1">
                      <div className="text-xs text-gray-600">Aktif: {boolLabel(promo.status_aktif)}</div>
                      <div className="text-xs text-gray-600">
                        Approval:{" "}
                        {promo.status_approval === 1
                          ? "Approved"
                          : promo.status_approval === 2
                          ? "Rejected"
                          : "Pending"}
                      </div>
                      <div className="text-xs text-gray-600">
                        Archived: {Number(promo.is_archived) === 1 ? "Ya" : "Tidak"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      <div>Total: {promo.budget_total ?? "-"}</div>
                      <div>Terpakai: {promo.budget_terpakai ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {shouldReactivate && isAllowed && (
                          <button
                            type="button"
                            onClick={() => reactivatePromo(promo)}
                            className="inline-flex items-center justify-center rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            title="Aktifkan kembali"
                          >
                            Aktifkan kembali
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openDetail(promo.kode_t_promosi)}
                          className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                          title="Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(promo.kode_t_promosi)}
                          className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(promo.kode_t_promosi, "approve")}
                          className="inline-flex items-center justify-center rounded-md border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50"
                          title="Approve"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(promo.kode_t_promosi, "reject")}
                          className="inline-flex items-center justify-center rounded-md border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        {Number(promo.is_archived) === 1 ? (
                          <button
                            type="button"
                            onClick={() => updateStatus(promo.kode_t_promosi, "unarchive")}
                            className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                            title="Unarchive"
                          >
                            Unarchive
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateStatus(promo.kode_t_promosi, "archive")}
                            className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                            title="Archive"
                          >
                            Archive
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
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-sm text-gray-500">Form Promosi</p>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? "Edit Promosi" : "Tambah Promosi"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {formError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {formError}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Nama Promosi</span>
                  <input
                    value={form.nama_promosi}
                    onChange={(e) => setForm((prev) => ({ ...prev, nama_promosi: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Jenis Sumber</span>
                  <select
                    value={form.jenis_sumber}
                    onChange={(e) => setForm((prev) => ({ ...prev, jenis_sumber: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <option value="">-</option>
                    <option value="SUPPLIER">SUPPLIER</option>
                    <option value="INTERNAL">INTERNAL</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="text-gray-600">Deskripsi</span>
                  <textarea
                    value={form.deskripsi}
                    onChange={(e) => setForm((prev) => ({ ...prev, deskripsi: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    rows={2}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="text-gray-600">Valid From</span>
                  <input
                    type="datetime-local"
                    value={form.valid_from}
                    onChange={(e) => setForm((prev) => ({ ...prev, valid_from: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="text-gray-600">Valid To</span>
                  <input
                    type="datetime-local"
                    value={form.valid_to}
                    onChange={(e) => setForm((prev) => ({ ...prev, valid_to: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Jam Mulai</span>
                  <input
                    type="time"
                    value={form.time_from}
                    onChange={(e) => setForm((prev) => ({ ...prev, time_from: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Jam Selesai</span>
                  <input
                    type="time"
                    value={form.time_to}
                    onChange={(e) => setForm((prev) => ({ ...prev, time_to: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Status Aktif</span>
                  <select
                    value={form.status_aktif ? "1" : "0"}
                    onChange={(e) => setForm((prev) => ({ ...prev, status_aktif: e.target.value === "1" }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <option value="1">Aktif</option>
                    <option value="0">Nonaktif</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Payment Scope</span>
                  <select
                    value={form.payment_scope}
                    onChange={(e) => setForm((prev) => ({ ...prev, payment_scope: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <option value="ALL">ALL</option>
                    <option value="SELECTED">SELECTED</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Redeem Mode</span>
                  <select
                    value={form.redeem_mode}
                    onChange={(e) => setForm((prev) => ({ ...prev, redeem_mode: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <option value="ONCE">ONCE</option>
                    <option value="MULTIPLY">MULTIPLY</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Max Redeem / Trx</span>
                  <input
                    value={form.max_redeem_times_per_trx}
                    onChange={(e) => setForm((prev) => ({ ...prev, max_redeem_times_per_trx: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Max Redeem / Customer</span>
                  <input
                    value={form.max_redeem_per_customer}
                    onChange={(e) => setForm((prev) => ({ ...prev, max_redeem_per_customer: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Scope Customer</span>
                  <select
                    value={form.redeem_scope_per_customer}
                    onChange={(e) => setForm((prev) => ({ ...prev, redeem_scope_per_customer: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <option value="">-</option>
                    <option value="PER_PROMO_PERIOD">PER_PROMO_PERIOD</option>
                    <option value="PER_DAY">PER_DAY</option>
                    <option value="PER_WEEK">PER_WEEK</option>
                    <option value="PER_MONTH">PER_MONTH</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Budget Total</span>
                  <input
                    value={form.budget_total}
                    onChange={(e) => setForm((prev) => ({ ...prev, budget_total: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Max Total Item</span>
                  <input
                    value={form.max_total_item}
                    onChange={(e) => setForm((prev) => ({ ...prev, max_total_item: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Max Total Redeem Trx</span>
                  <input
                    value={form.max_total_redeem_trx}
                    onChange={(e) => setForm((prev) => ({ ...prev, max_total_redeem_trx: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Target Toko (JSON array)</span>
                  <textarea
                    value={jsonTargets}
                    onChange={(e) => setJsonTargets(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Payment Methods (JSON array)</span>
                  <textarea
                    value={jsonPayments}
                    onChange={(e) => setJsonPayments(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Rule Groups (JSON array)</span>
                  <textarea
                    value={jsonRules}
                    onChange={(e) => setJsonRules(e.target.value)}
                    rows={6}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Benefits (JSON array)</span>
                  <textarea
                    value={jsonBenefits}
                    onChange={(e) => setJsonBenefits(e.target.value)}
                    rows={6}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
                  />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="text-gray-600">Banners (JSON array)</span>
                  <textarea
                    value={jsonBanners}
                    onChange={(e) => setJsonBanners(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
                  />
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitForm}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-sm text-gray-500">Detail Promosi</p>
                <h2 className="text-lg font-semibold text-gray-900">{detailData?.header?.nama_promosi || "-"}</h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 text-sm">
              {!detailData && <div className="text-gray-500">Memuat detail...</div>}
              {detailData && (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-gray-500">Kode</div>
                      <div className="font-semibold text-gray-900">{detailData.header.kode_t_promosi}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Status Aktif</div>
                      <div className="font-semibold text-gray-900">{boolLabel(detailData.header.status_aktif)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Periode</div>
                      <div className="font-semibold text-gray-900">
                        {formatDate(detailData.header.valid_from)} - {formatDate(detailData.header.valid_to)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Jam</div>
                      <div className="font-semibold text-gray-900">
                        {detailData.header.time_from || "-"} - {detailData.header.time_to || "-"}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-500 mb-1">Target Toko</div>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(detailData.target_toko, null, 2)}
                      </pre>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-500 mb-1">Payment Methods</div>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(detailData.payment_methods, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs text-gray-500 mb-1">Rule Groups</div>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                      {JSON.stringify(detailData.rule_groups, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs text-gray-500 mb-1">Benefits</div>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                      {JSON.stringify(detailData.benefits, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
