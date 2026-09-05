"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import Select, { components, type ActionMeta, type MultiValue, type OptionProps } from "react-select";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgePercent,
  CalendarClock,
  Download,
  Filter,
  ListChecks,
  LoaderCircle,
  Plus,
  Upload,
  XCircle,
} from "lucide-react";

const toDateInputValue = (value: Date) => {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getDefaultPromoListDateRange = () => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
  };
};

type SyncKasirResult = {
  label?: string;
  server: string;
  database: string;
  ok: boolean;
  error?: string;
  state?: "pending" | "running" | "success" | "failed";
};

type BulkPromoSyncResult = {
  kode_t_promosi: string;
  nama_promosi: string;
  ok: boolean;
  error?: string;
};

export default function PromoRefraksiPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [tab, setTab] = useState<"list" | "create">("list");
  const [tokoOptions, setTokoOptions] = useState<{ kode_toko: string; nama_toko: string }[]>([]);
  const [selectedToko, setSelectedToko] = useState<Set<string>>(new Set());
  const [selectAllToko, setSelectAllToko] = useState(true);
  const allTokoOption = useMemo(() => ({ value: "__ALL__", label: "Semua toko" }), []);
  const [items, setItems] = useState<
    {
      kode_barang_variant: string;
      nama_barang: string;
      nama_varian: string;
      nama_merk: string | null;
      kode_supplier: string | null;
      nama_supplier: string | null;
      barcode_varian?: string | null;
      stok_gudang?: number | null;
      stok_toko?: number | null;
    }[]
  >([]);
  const [supplierOptions, setSupplierOptions] = useState<{ kode_supplier: string; nama_supplier: string }[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [filterMerk, setFilterMerk] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());
  const [namaPromo, setNamaPromo] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [jamMulai, setJamMulai] = useState("");
  const [jamSelesai, setJamSelesai] = useState("");
  const [jenisDiskon, setJenisDiskon] = useState<"PERSEN" | "NOMINAL">("PERSEN");
  const [nilaiDiskon, setNilaiDiskon] = useState("");
  const [qtyMinimum, setQtyMinimum] = useState(1);
  const [qtyMaksimum, setQtyMaksimum] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [gunakanKelipatan, setGunakanKelipatan] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [itemMaxQty, setItemMaxQty] = useState<Record<string, string>>({});
  const [promoRows, setPromoRows] = useState<any[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [selectedPromoCodes, setSelectedPromoCodes] = useState<Set<string>>(new Set());
  const [listQuery, setListQuery] = useState("");
  const [statusApprovalFilter, setStatusApprovalFilter] = useState("semua");
  const [statusAktifFilter, setStatusAktifFilter] = useState("semua");
  const [statusBerlakuFilter, setStatusBerlakuFilter] = useState("semua");
  const [listDateFrom, setListDateFrom] = useState(() => getDefaultPromoListDateRange().from);
  const [listDateTo, setListDateTo] = useState(() => getDefaultPromoListDateRange().to);
  const [showBudgetAlertOnly, setShowBudgetAlertOnly] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSearch, setDetailSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHeader, setEditingHeader] = useState<any | null>(null);
  const [timeEditOpen, setTimeEditOpen] = useState(false);
  const [timeEditId, setTimeEditId] = useState<string | null>(null);
  const [timeEditFrom, setTimeEditFrom] = useState("");
  const [timeEditTo, setTimeEditTo] = useState("");
  const [timeEditSaving, setTimeEditSaving] = useState(false);
  const [timeEditError, setTimeEditError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState("kode_t_promosi");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncPromoName, setSyncPromoName] = useState("");
  const [syncProgress, setSyncProgress] = useState<SyncKasirResult[]>([]);
  const [syncTotal, setSyncTotal] = useState(4);
  const [syncCompleted, setSyncCompleted] = useState(0);
  const [syncFinished, setSyncFinished] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncMode, setSyncMode] = useState<"single" | "all">("single");
  const [syncPromoIndex, setSyncPromoIndex] = useState(0);
  const [syncPromoTotal, setSyncPromoTotal] = useState(0);
  const [syncPromoResults, setSyncPromoResults] = useState<BulkPromoSyncResult[]>([]);
  const [syncOfflineTargets, setSyncOfflineTargets] = useState<SyncKasirResult[]>([]);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string; kode: string } | null>(null);

  const toLocalDateStr = (value: Date) => {
    return toDateInputValue(value);
  };

  const getValidityLabel = useCallback((row: any) => {
    if (Number(row?.status_aktif ?? 0) !== 1) return "Tidak Berlaku";
    if (Number(row?.status_approval ?? -1) === 2) return "Tidak Berlaku";
    const todayStr = toLocalDateStr(new Date());
    if (!row?.valid_to) return "-";
    const end = new Date(row.valid_to);
    if (Number.isNaN(end.getTime())) return "-";
    const endStr = toLocalDateStr(end);
    return endStr < todayStr ? "Expired" : "Berlaku";
  }, []);

  const getBudgetInfo = (row: any) => {
    const total = Number(row?.budget_total ?? 0);
    const used = Number(row?.budget_terpakai ?? 0);
    const percent = total > 0 && Number.isFinite(total) ? (used / total) * 100 : 0;
    return {
      total,
      used,
      percent,
      isOver: percent > 100,
      isNear: percent >= 90 && percent <= 100,
    };
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
    return username;
  };

  const handleViewDetail = async (kode: string) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDetailData(data);
      setDetailSearch("");
      setDetailOpen(true);
    } catch (err) {
      Swal.fire("Gagal memuat detail promo", String(err), "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (kode: string) => {
    const confirm = await Swal.fire({
      title: "Approve promo ini?",
      text: "Status approval akan diubah menjadi Approved.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Approve",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: getUsername() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await Swal.fire("Berhasil approve", "", "success");
      setPromoRows((prev) =>
        prev.map((row) => (row.kode_t_promosi === kode ? { ...row, status_approval: 1 } : row))
      );
    } catch (err) {
      Swal.fire("Gagal approve promo", String(err), "error");
    }
  };

  const handleReject = async (kode: string) => {
    const result = await Swal.fire({
      title: "Reject promo ini?",
      input: "text",
      inputLabel: "Catatan (opsional)",
      inputPlaceholder: "Alasan reject",
      showCancelButton: true,
      confirmButtonText: "Reject",
      cancelButtonText: "Batal",
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejected_by: getUsername(),
          catatan_approval: result.value || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await Swal.fire("Berhasil reject", "", "success");
      setPromoRows((prev) =>
        prev.map((row) => (row.kode_t_promosi === kode ? { ...row, status_approval: 2 } : row))
      );
    } catch (err) {
      Swal.fire("Gagal reject promo", String(err), "error");
    }
  };

  const handleEdit = async (kode: string) => {
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const header = data?.header || {};
      const ruleGroups = Array.isArray(data?.rule_groups) ? data.rule_groups : [];
      const firstGroup = ruleGroups[0] || {};
      const items = Array.isArray(firstGroup.items) ? firstGroup.items : [];
      const benefits = Array.isArray(data?.benefits) ? data.benefits : [];
      const firstBenefit = benefits[0] || {};

      setEditingId(String(header.kode_t_promosi || kode));
      setEditingHeader(header);
      setNamaPromo(header.nama_promosi || "");
      setDeskripsi(header.deskripsi || "");
      setTanggalMulai(toInputDate(header.valid_from));
      setTanggalSelesai(toInputDate(header.valid_to));
      setJamMulai(toInputTime(header.time_from));
      setJamSelesai(toInputTime(header.time_to));
      setQtyMinimum(Number(firstGroup.min_total_qty ?? 1));
      setQtyMaksimum(header.max_total_item != null ? String(header.max_total_item) : "");
      setGunakanKelipatan(firstGroup.max_redeem_qty == null);
      setBudgetMax(header.budget_total != null ? String(header.budget_total) : "");

      if (firstBenefit.benefit_type === "DISKON_NOMINAL") {
        setJenisDiskon("NOMINAL");
        setNilaiDiskon(firstBenefit.diskon_nominal != null ? String(firstBenefit.diskon_nominal) : "");
      } else {
        setJenisDiskon("PERSEN");
        setNilaiDiskon(firstBenefit.diskon_persen != null ? String(firstBenefit.diskon_persen) : "");
      }

      const targets = Array.isArray(data?.target_toko) ? (data.target_toko as string[]) : [];
      setSelectedToko(new Set(targets.map((t: string) => String(t))));
      setSelectAllToko(targets.length > 0 && targets.length === tokoOptions.length);

      const selected: Set<string> = new Set<string>(items.map((it: any) => String(it.kode_barang_variant)));
      setSelectedItems(selected);
      setPendingItems(new Set());
      setItemMaxQty(
        items.reduce((acc: Record<string, string>, it: any) => {
          if (it.kode_barang_variant && it.max_qty != null) {
            acc[String(it.kode_barang_variant)] = String(it.max_qty);
          }
          return acc;
        }, {})
      );

      setTab("create");
    } catch (err) {
      Swal.fire("Gagal memuat data promo", String(err), "error");
    }
  };

  const openTimeEdit = (row: any) => {
    setTimeEditId(String(row?.kode_t_promosi || ""));
    setTimeEditFrom(formatTime(row?.time_from) === "-" ? "" : formatTime(row?.time_from));
    setTimeEditTo(formatTime(row?.time_to) === "-" ? "" : formatTime(row?.time_to));
    setTimeEditError(null);
    setTimeEditOpen(true);
  };

  const closeTimeEdit = () => {
    setTimeEditOpen(false);
    setTimeEditId(null);
    setTimeEditFrom("");
    setTimeEditTo("");
    setTimeEditError(null);
  };

  const handleSaveTimeEdit = async () => {
    if (!timeEditId) return;
    if ((timeEditFrom && !timeEditTo) || (!timeEditFrom && timeEditTo)) {
      setTimeEditError("Jam mulai dan jam selesai harus diisi berpasangan.");
      return;
    }
    setTimeEditSaving(true);
    setTimeEditError(null);
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(timeEditId)}/time`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          time_from: toSqlTime(timeEditFrom),
          time_to: toSqlTime(timeEditTo),
          updated_by: getUsername(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      setPromoRows((prev) =>
        prev.map((row) =>
          row.kode_t_promosi === timeEditId
            ? { ...row, time_from: toSqlTime(timeEditFrom), time_to: toSqlTime(timeEditTo) }
            : row
        )
      );
      closeTimeEdit();
    } catch (err: any) {
      setTimeEditError(err?.message || "Gagal menyimpan jam.");
    } finally {
      setTimeEditSaving(false);
    }
  };

  const handleDelete = async (kode: string) => {
    const confirm = await Swal.fire({
      title: "Hapus promo ini?",
      text: "Data promosi akan dihapus permanen.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await Swal.fire("Berhasil dihapus", "", "success");
      setPromoRows((prev) => prev.filter((row) => row.kode_t_promosi !== kode));
    } catch (err) {
      Swal.fire("Gagal menghapus promo", String(err), "error");
    }
  };

  const handleReactivate = async (row: any) => {
    const kode = String(row?.kode_t_promosi || "").trim();
    if (!kode) return;

    const currentUser = getUsername();
    const allowedUsers = ["natalia", "yudha", "uphan"];
    if (!allowedUsers.includes(currentUser.trim().toLowerCase())) {
      await Swal.fire("Tidak diizinkan", "Fitur ini hanya untuk username natalia, yudha, uphan.", "warning");
      return;
    }

    const confirm = await Swal.fire({
      icon: "warning",
      title: "Aktifkan kembali promo?",
      html: `
        <div style="text-align:left;font-size:14px;line-height:1.5">
          <div><strong>${row?.nama_promosi || kode}</strong></div>
          <div>Kode: ${kode}</div>
          <div class="mt-2">Promo akan diubah menjadi aktif, approved, dan tidak archived.</div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Aktifkan kembali",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;

    setReactivatingId(kode);
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}/reactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updated_by: currentUser, approved_by: currentUser }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setPromoRows((prev) =>
        prev.map((item) =>
          item.kode_t_promosi === kode
            ? {
                ...item,
                status_aktif: 1,
                status_approval: 1,
                is_archived: 0,
              }
            : item
        )
      );
      await Swal.fire("Berhasil diaktifkan", "Promo berhasil diaktifkan kembali.", "success");
    } catch (err) {
      await Swal.fire("Gagal mengaktifkan promo", String(err), "error");
    } finally {
      setReactivatingId(null);
    }
  };

  const handleSyncToKasir = async (row: any) => {
    const kode = String(row?.kode_t_promosi || "").trim();
    if (!kode) return;

    setSyncingId(kode);
    setSyncMode("single");
    setSyncPromoName(String(row?.nama_promosi || kode));
    setSyncProgress([]);
    setSyncTotal(4);
    setSyncCompleted(0);
    setSyncFinished(false);
    setSyncError(null);
    setSyncPromoIndex(0);
    setSyncPromoTotal(0);
    setSyncPromoResults([]);
    setSyncOfflineTargets([]);
    setSyncModalOpen(true);

    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}/sync-to-kasir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updated_by: getUsername() }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResults: SyncKasirResult[] = [];
      const applyEvent = (event: any) => {
        if (event?.type === "start") {
          setSyncTotal(Number(event.total) || 4);
        }
        if (event?.type === "kasir_start") {
          setSyncProgress((current) => {
            const next = current.filter((item) => item.database !== event.database);
            return [...next, { server: event.server, database: event.database, ok: false, state: "running" }];
          });
        }
        if (event?.type === "kasir_complete") {
          const result = {
            server: event.server,
            database: event.database,
            ok: Boolean(event.ok),
            error: event.error,
            state: event.ok ? "success" : "failed",
          } as SyncKasirResult;
          setSyncProgress((current) => [...current.filter((item) => item.database !== result.database), result]);
          setSyncCompleted((current) => Math.max(current, Number(event.index) || current + 1));
        }
        if (event?.type === "complete") {
          finalResults = Array.isArray(event.results) ? event.results : [];
          setSyncProgress(finalResults.map((item) => ({ ...item, state: item.ok ? "success" : "failed" })));
          setSyncCompleted(finalResults.length);
          setSyncFinished(true);
        }
        if (event?.type === "error") {
          throw new Error(event.message || "Gagal sync ke kasir");
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        lines.filter(Boolean).forEach((line) => applyEvent(JSON.parse(line)));
        if (done) break;
      }

      if (!finalResults.length && buffer.trim()) applyEvent(JSON.parse(buffer));
    } catch (err) {
      setSyncError(String(err));
      setSyncFinished(true);
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAllToKasir = async () => {
    const promos = selectedPromoRows
      .map((row) => ({
        kode_t_promosi: String(row?.kode_t_promosi || "").trim(),
        nama_promosi: String(row?.nama_promosi || row?.deskripsi || row?.kode_t_promosi || "").trim(),
      }))
      .filter((row) => row.kode_t_promosi);
    if (!promos.length) return;

    setSyncingId("__ALL__");
    setSyncMode("all");
    setSyncPromoName("Menyiapkan sinkronisasi promo terpilih...");
    setSyncProgress([]);
    setSyncTotal(1);
    setSyncCompleted(0);
    setSyncFinished(false);
    setSyncError(null);
    setSyncPromoIndex(0);
    setSyncPromoTotal(promos.length);
    setSyncPromoResults([]);
    setSyncOfflineTargets([]);
    setSyncModalOpen(true);

    try {
      const res = await fetch(`${API_BASE}/promos/sync-all-to-kasir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updated_by: getUsername(),
          promo_codes: promos.map((row) => row.kode_t_promosi),
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const applyEvent = (event: any) => {
        if (event?.type === "start") {
          setSyncPromoTotal(Number(event.total_promos) || promos.length);
          setSyncTotal(Number(event.total_kasir) || 1);
        }
        if (event?.type === "prepare_targets") {
          setSyncPromoName("Menyiapkan koneksi kasir...");
          setSyncProgress([]);
          setSyncCompleted(0);
          setSyncTotal(Number(event.total_kasir) || 1);
        }
        if (event?.type === "target_connect_start") {
          setSyncProgress((current) => {
            const next = current.filter((item) => item.database !== event.database);
            return [
              ...next,
              {
                label: event.label,
                server: event.server,
                database: event.database,
                ok: false,
                state: "running",
              },
            ];
          });
        }
        if (event?.type === "target_connect_complete") {
          const result = {
            label: event.label,
            server: event.server,
            database: event.database,
            ok: Boolean(event.ok),
            error: event.error,
            state: event.ok ? "success" : "failed",
          } as SyncKasirResult;
          setSyncProgress((current) => [...current.filter((item) => item.database !== result.database), result]);
          setSyncCompleted((current) => Math.max(current, Number(event.index) || current + 1));
        }
        if (event?.type === "target_check_complete") {
          const offlineTargets = Array.isArray(event.offline_targets)
            ? event.offline_targets.map((item: any) => ({
                label: item.label,
                server: item.server,
                database: item.database,
                ok: false,
                error: item.error,
                state: "failed",
              }))
            : [];
          setSyncOfflineTargets(offlineTargets);
          setSyncTotal(Number(event.online_kasir) || 0);
          setSyncCompleted(0);
          setSyncProgress([]);
          if (Number(event.online_kasir) === 0) {
            setSyncPromoName("Tidak ada kasir online untuk sinkronisasi");
          }
        }
        if (event?.type === "promo_start") {
          setSyncPromoIndex(Number(event.promo_index) || 0);
          setSyncPromoTotal(Number(event.promo_total) || promos.length);
          setSyncPromoName(String(event.nama_promosi || event.kode_t_promosi || "Promo"));
          setSyncProgress([]);
          setSyncCompleted(0);
          setSyncTotal(Number(event.total_kasir) || 1);
        }
        if (event?.type === "kasir_start") {
          setSyncProgress((current) => {
            const next = current.filter((item) => item.database !== event.database);
            return [
              ...next,
              {
                label: event.label,
                server: event.server,
                database: event.database,
                ok: false,
                state: "running",
              },
            ];
          });
        }
        if (event?.type === "kasir_complete") {
          const result = {
            label: event.label,
            server: event.server,
            database: event.database,
            ok: Boolean(event.ok),
            error: event.error,
            state: event.ok ? "success" : "failed",
          } as SyncKasirResult;
          setSyncProgress((current) => [...current.filter((item) => item.database !== result.database), result]);
          setSyncCompleted((current) => Math.max(current, Number(event.index) || current + 1));
        }
        if (event?.type === "promo_complete") {
          const result = {
            kode_t_promosi: String(event.kode_t_promosi || ""),
            nama_promosi: String(event.nama_promosi || event.kode_t_promosi || ""),
            ok: Boolean(event.ok),
            error: event.error,
          };
          setSyncPromoIndex((current) => Math.max(current, Number(event.promo_done_count) || current + 1));
          setSyncPromoResults((current) => [
            ...current.filter((item) => item.kode_t_promosi !== result.kode_t_promosi),
            result,
          ]);
        }
        if (event?.type === "complete") {
          const finalResults = Array.isArray(event.results) ? event.results : [];
          const successCodes = finalResults
            .filter((item: any) => Boolean(item.ok))
            .map((item: any) => String(item.kode_t_promosi || ""))
            .filter(Boolean);
          setSyncPromoResults(
            finalResults.map((item: any) => ({
              kode_t_promosi: String(item.kode_t_promosi || ""),
              nama_promosi: String(item.nama_promosi || item.kode_t_promosi || ""),
              ok: Boolean(item.ok),
              error: item.error,
            }))
          );
          setSyncPromoIndex(Number(event.total_promos) || promos.length);
          setSelectedPromoCodes((current) => {
            const next = new Set(current);
            successCodes.forEach((kode) => next.delete(kode));
            return next;
          });
          setSyncFinished(true);
        }
        if (event?.type === "error") {
          throw new Error(event.message || "Gagal sync semua promo ke kasir");
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        lines.filter(Boolean).forEach((line) => applyEvent(JSON.parse(line)));
        if (done) break;
      }

      if (buffer.trim()) applyEvent(JSON.parse(buffer));
    } catch (err) {
      setSyncError(String(err));
      setSyncFinished(true);
    } finally {
      setSyncingId(null);
    }
  };

  const handleUploadPromoImage = async (row: any, file: File) => {
    const kode = String(row?.kode_t_promosi || "").trim();
    if (!kode || !file) return;
    setUploadingImageId(kode);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("updated_by", getUsername());
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}/banner-image`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setPromoRows((current) => current.map((item) => (
        item.kode_t_promosi === kode ? { ...item, banner_url: data.banner_url } : item
      )));
      setImagePreview((current) => current && current.kode === kode ? { ...current, url: data.banner_url } : current);
      await Swal.fire("Berhasil", "Gambar promo berhasil di-upload.", "success");
    } catch (err) {
      await Swal.fire("Gagal upload gambar", String(err), "error");
    } finally {
      setUploadingImageId(null);
    }
  };

  useEffect(() => {
    const fetchToko = async () => {
      try {
        const res = await fetch(`${API_BASE}/toko`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
              .filter((row) => Number(row?.status ?? 1) === 1)
              .map((row) => ({
                kode_toko: String(row.kode_toko || ""),
                nama_toko: String(row.nama_toko || row.kode_toko || ""),
              }))
              .filter((row) => row.kode_toko)
          : [];
        setTokoOptions(list);
        if (selectAllToko) {
          setSelectedToko(new Set(list.map((t) => String(t.kode_toko))));
        }
      } catch (err) {
        console.error("Failed fetch toko", err);
        setTokoOptions([]);
      }
    };
    fetchToko();
  }, [API_BASE, selectAllToko]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(`${API_BASE}/barang/varian`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
              .filter((row) => Number(row?.is_aktif ?? 1) === 1)
              .map((row) => ({
                kode_barang_variant: String(row.kode_barang_variant || ""),
                nama_barang: String(row.nama_barang || "").trim(),
                nama_varian: String(row.nama_varian || "").trim(),
                nama_merk: row.nama_merk ? String(row.nama_merk).trim() : null,
                kode_supplier: row.kode_supplier ? String(row.kode_supplier).trim() : null,
                nama_supplier: row.nama_supplier ? String(row.nama_supplier).trim() : null,
                barcode_varian: row.barcode_varian ? String(row.barcode_varian).trim() : null,
                stok_gudang: row.stok_gudang ?? null,
                stok_toko: row.stok_toko ?? null,
              }))
              .filter((row) => row.kode_barang_variant)
          : [];
        setItems(list);
      } catch (err) {
        console.error("Failed fetch barang varian", err);
        setItems([]);
      }
    };
    fetchItems();
  }, [API_BASE]);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch(`${API_BASE}/barang/supplier-options`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
              .map((row) => ({
                kode_supplier: String(row.kode_supplier || "").trim(),
                nama_supplier: String(row.nama_supplier || row.kode_supplier || "").trim(),
              }))
              .filter((row) => row.kode_supplier)
          : [];
        setSupplierOptions(list);
      } catch (err) {
        console.error("Failed fetch supplier options", err);
        setSupplierOptions([]);
      }
    };
    fetchSuppliers();
  }, [API_BASE]);

  useEffect(() => {
    if (tab !== "list") return;

    const fetchPromos = async () => {
      setPromoLoading(true);
      setPromoError(null);
      try {
        const params = new URLSearchParams();
        const q = listQuery.trim();
        const isBarcode = q !== "" && /^[0-9]{6,}$/.test(q);
        if (q) {
          if (isBarcode) {
            params.set("barcode", q);
          } else {
            params.set("q", q);
          }
        }
        if (statusApprovalFilter !== "semua") params.set("status", statusApprovalFilter);
        if (statusAktifFilter !== "semua") params.set("aktif", statusAktifFilter);
        if (listDateFrom) params.set("date_from", listDateFrom);
        if (listDateTo) params.set("date_to", listDateTo);

        const url = params.toString() ? `${API_BASE}/promos?${params.toString()}` : `${API_BASE}/promos`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        if (statusBerlakuFilter === "semua") {
          setPromoRows(list);
        } else {
          const todayStr = toLocalDateStr(new Date());
          const filtered = list.filter((row) => {
            if (statusBerlakuFilter === "tidak_berlaku") {
              return Number(row?.status_approval ?? -1) === 2 || Number(row?.status_aktif ?? 0) !== 1;
            }
            if (!row?.valid_to) return false;
            const end = new Date(row.valid_to);
            if (Number.isNaN(end.getTime())) return false;
            const endStr = toLocalDateStr(end);
            return statusBerlakuFilter === "berlaku" ? endStr >= todayStr : endStr < todayStr;
          });
          setPromoRows(filtered);
        }
      } catch (err) {
        console.error("Failed fetch promo list", err);
        setPromoError("Gagal memuat daftar promo.");
        setPromoRows([]);
      } finally {
        setPromoLoading(false);
      }
    };

    fetchPromos();
  }, [
    API_BASE,
    listDateFrom,
    listDateTo,
    listQuery,
    statusAktifFilter,
    statusApprovalFilter,
    statusBerlakuFilter,
    tab,
  ]);

  const tokoSelectOptions = useMemo(
    () => [
      allTokoOption,
      ...tokoOptions.map((toko) => ({
        value: toko.kode_toko,
        label: `${toko.nama_toko} (${toko.kode_toko})`,
      })),
    ],
    [allTokoOption, tokoOptions]
  );

  const selectedTokoValues = useMemo(() => {
    if (selectAllToko) {
      return [allTokoOption];
    }
    const selectedList = tokoSelectOptions.filter(
      (opt) => opt.value !== allTokoOption.value && selectedToko.has(opt.value)
    );
    return selectedList;
  }, [allTokoOption, selectAllToko, selectedToko, tokoSelectOptions]);

  const handleTokoChange = (
    value: MultiValue<{ value: string; label: string }>,
    actionMeta: ActionMeta<{ value: string; label: string }>
  ) => {
    const nextSelected = Array.isArray(value) ? value : [];
    const hasAll = nextSelected.some((opt) => opt.value === allTokoOption.value);

    if (hasAll && actionMeta.action === "select-option" && actionMeta.option?.value !== allTokoOption.value) {
      const filtered = nextSelected.filter((opt) => opt.value !== allTokoOption.value);
      const nextSet = new Set(filtered.map((opt) => opt.value));
      setSelectAllToko(false);
      setSelectedToko(nextSet);
      return;
    }

    if (hasAll) {
      setSelectAllToko(true);
      setSelectedToko(new Set(tokoOptions.map((t) => String(t.kode_toko))));
      return;
    }

    const nextSet = new Set(nextSelected.map((opt) => opt.value));
    const isAll = tokoOptions.length > 0 && nextSet.size === tokoOptions.length;
    setSelectAllToko(isAll);
    setSelectedToko(isAll ? new Set(tokoOptions.map((t) => String(t.kode_toko))) : nextSet);
  };

  const selectStyles = {
    control: (base: Record<string, unknown>) => ({
      ...base,
      minHeight: 44,
      borderColor: "#e5e7eb",
      boxShadow: "none",
      ":hover": { borderColor: "#cbd5e1" },
    }),
    valueContainer: (base: Record<string, unknown>) => ({
      ...base,
      paddingTop: 4,
      paddingBottom: 4,
    }),
    input: (base: Record<string, unknown>) => ({
      ...base,
      margin: 0,
      padding: 0,
    }),
    option: (base: Record<string, unknown>, state: { isFocused: boolean; isSelected: boolean }) => ({
      ...base,
      backgroundColor: state.isSelected ? "#e6fffb" : state.isFocused ? "#f3f4f6" : "white",
      color: "#111827",
    }),
    multiValue: (base: Record<string, unknown>) => ({
      ...base,
      backgroundColor: "#e6fffb",
    }),
    multiValueLabel: (base: Record<string, unknown>) => ({
      ...base,
      color: "#0f756b",
      fontWeight: 600,
    }),
    multiValueRemove: (base: Record<string, unknown>) => ({
      ...base,
      color: "#0f756b",
      ":hover": { backgroundColor: "#c1f3ec", color: "#0f756b" },
    }),
  };

  const CheckboxOption = (props: OptionProps<{ value: string; label: string }, true>) => (
    <components.Option {...props}>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={props.isSelected} readOnly />
        <span className="text-sm">{props.label}</span>
      </div>
    </components.Option>
  );

  const merkOptions = useMemo(() => {
    const map = new Map<string, string>();
    const supplierKey = filterSupplier.trim().toLowerCase();
    items.forEach((row) => {
      const rowSupplier = row.kode_supplier ? row.kode_supplier.trim().toLowerCase() : "";
      if (supplierKey && rowSupplier !== supplierKey) return;
      if (row.nama_merk) map.set(row.nama_merk.trim(), row.nama_merk.trim());
    });
    return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  }, [filterSupplier, items]);

  const filteredItems = useMemo(() => {
    const keyword = itemSearch.trim().toLowerCase();
    const filterMerkValue = filterMerk.trim().toLowerCase();
    const filterSupplierValue = filterSupplier.trim().toLowerCase();
    return items.filter((row) => {
      const rowMerk = row.nama_merk ? row.nama_merk.trim().toLowerCase() : "";
      const rowSupplier = row.kode_supplier ? row.kode_supplier.trim().toLowerCase() : "";
      if (filterMerkValue && rowMerk !== filterMerkValue) return false;
      if (filterSupplierValue && rowSupplier !== filterSupplierValue) return false;
      if (!keyword) return true;
      return (
        row.nama_barang.toLowerCase().includes(keyword) ||
        row.nama_varian.toLowerCase().includes(keyword) ||
        row.kode_barang_variant.toLowerCase().includes(keyword)
      );
    });
  }, [filterMerk, filterSupplier, itemSearch, items]);

  const shouldShowItems = filterMerk !== "" || filterSupplier !== "";
  const isMerkEnabled = filterSupplier !== "";

  const selectedItemsList = useMemo(
    () => items.filter((row) => selectedItems.has(row.kode_barang_variant)),
    [items, selectedItems]
  );

  const availableItems = useMemo(
    () => filteredItems.filter((row) => !selectedItems.has(row.kode_barang_variant)),
    [filteredItems, selectedItems]
  );

  const promoRowsWithBudget = useMemo(
    () =>
      promoRows.map((row) => ({
        ...row,
        __budget: getBudgetInfo(row),
      })),
    [promoRows]
  );

  const budgetStats = useMemo(() => {
    const activeRows = promoRowsWithBudget.filter((row) => {
      if (Number(row?.status_approval ?? 0) !== 1) return false;
      if (Number(row?.status_aktif ?? 0) !== 1) return false;
      return getValidityLabel(row) === "Berlaku";
    });
    const near = activeRows.filter((row) => row.__budget?.isNear).length;
    const over = activeRows.filter((row) => row.__budget?.isOver).length;
    return { near, over };
  }, [getValidityLabel, promoRowsWithBudget]);

  const displayedPromoRows = useMemo(() => {
    if (!showBudgetAlertOnly) return promoRowsWithBudget;
    return promoRowsWithBudget.filter((row) => {
      if (!row.__budget?.isNear && !row.__budget?.isOver) return false;
      if (Number(row?.status_approval ?? 0) !== 1) return false;
      if (Number(row?.status_aktif ?? 0) !== 1) return false;
      return getValidityLabel(row) === "Berlaku";
    });
  }, [getValidityLabel, promoRowsWithBudget, showBudgetAlertOnly]);

  const sortedPromoRows = useMemo(() => {
    const rankMap: Record<string, number> = {
      "-": 0,
      "Tidak Berlaku": 1,
      Expired: 2,
      Berlaku: 3,
    };

    const getValue = (row: any) => {
      switch (sortKey) {
        case "kode_t_promosi":
          return String(row?.kode_t_promosi || "").toLowerCase();
        case "nama_promosi":
          return String(row?.nama_promosi || row?.deskripsi || "").toLowerCase();
        case "valid_from":
          return row?.valid_from ? new Date(row.valid_from).getTime() : 0;
        case "valid_to":
          return row?.valid_to ? new Date(row.valid_to).getTime() : 0;
        case "berlaku":
          return rankMap[getValidityLabel(row)] ?? 0;
        case "target_toko":
          return formatTargetToko(row?.target_toko).toLowerCase();
        case "benefit":
          return formatBenefit(row?.benefit_info).toLowerCase();
        case "budget":
          return Number(row?.budget_total ?? 0);
        case "jam":
          return String(formatTime(row?.time_from) || "").toLowerCase();
        case "approval":
          return Number(row?.status_approval ?? 0);
        case "aktif":
          return Number(row?.status_aktif ?? 0);
        default:
          return String(row?.[sortKey] ?? "").toLowerCase();
      }
    };

    return [...displayedPromoRows].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const comparison = String(aValue).localeCompare(String(bValue), "id", {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [displayedPromoRows, getValidityLabel, sortDirection, sortKey]);

  const selectedPromoRows = useMemo(
    () => sortedPromoRows.filter((row) => selectedPromoCodes.has(String(row?.kode_t_promosi || ""))),
    [selectedPromoCodes, sortedPromoRows]
  );

  const visiblePromoCodes = useMemo(
    () => sortedPromoRows.map((row) => String(row?.kode_t_promosi || "")).filter(Boolean),
    [sortedPromoRows]
  );

  const isAllVisiblePromosSelected =
    visiblePromoCodes.length > 0 && visiblePromoCodes.every((kode) => selectedPromoCodes.has(kode));

  const toggleSelectAllVisiblePromos = (checked: boolean) => {
    setSelectedPromoCodes((current) => {
      const next = new Set(current);
      visiblePromoCodes.forEach((kode) => {
        if (checked) next.add(kode);
        else next.delete(kode);
      });
      return next;
    });
  };

  const toggleSelectPromo = (kode: string, checked: boolean) => {
    setSelectedPromoCodes((current) => {
      const next = new Set(current);
      if (checked) next.add(kode);
      else next.delete(kode);
      return next;
    });
  };

  const toggleSort = (key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDirection((prevDirection) => (prevDirection === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDirection("asc");
      return key;
    });
  };

  const renderSortIcon = (key: string) => {
    if (sortKey !== key) return <ArrowUpDown className="inline-block ml-1 h-3.5 w-3.5 opacity-60" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="inline-block ml-1 h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="inline-block ml-1 h-3.5 w-3.5" />
    );
  };

  const handleExportExcel = async () => {
    if (!sortedPromoRows.length) return;
    try {
      const XLSXModule = await import("xlsx");
      const XLSX = (XLSXModule as any).default ?? XLSXModule;
      const headers = [
        "No",
        "Kode Promo",
        "Nama Promo",
        "Deskripsi",
        "Tanggal Mulai",
        "Tanggal Selesai",
        "Status Berlaku",
        "Target Toko",
        "Benefit",
        "Budget Total",
        "Budget Terpakai",
        "Budget Persen",
        "Jam Mulai",
        "Jam Selesai",
        "Approval",
        "Approved At",
        "Status Aktif",
      ];
      const rowsExcel = sortedPromoRows.map((row, idx) => {
        const totalBudget = Number(row?.budget_total ?? 0);
        const usedBudget = Number(row?.budget_terpakai ?? 0);
        const budgetPercent =
          totalBudget > 0 && Number.isFinite(totalBudget) ? `${((usedBudget / totalBudget) * 100).toFixed(2)}%` : "";
        return [
          idx + 1,
          row?.kode_t_promosi || "",
          row?.nama_promosi || "",
          row?.deskripsi || "",
          formatDate(row?.valid_from),
          formatDate(row?.valid_to),
          getValidityLabel(row),
          formatTargetToko(row?.target_toko),
          formatBenefit(row?.benefit_info),
          totalBudget > 0 ? totalBudget : "",
          usedBudget > 0 ? usedBudget : "",
          budgetPercent,
          formatTime(row?.time_from) === "-" ? "" : formatTime(row?.time_from),
          formatTime(row?.time_to) === "-" ? "" : formatTime(row?.time_to),
          row?.status_approval === 1 ? "Approved" : row?.status_approval === 2 ? "Rejected" : "Pending",
          formatDateTime(row?.approved_at) === "-" ? "" : formatDateTime(row?.approved_at),
          Number(row?.status_aktif ?? 0) === 1 ? "Aktif" : "Nonaktif",
        ];
      });
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rowsExcel]);
      worksheet["!cols"] = headers.map((header) => ({ wch: Math.max(12, header.length + 2) }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Promo Refraksi");
      const filename = `promo-refraksi-${listDateFrom || "all"}-${listDateTo || "all"}.xlsx`;
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed export promo refraksi excel", err);
      Swal.fire("Gagal export Excel", String(err), "error");
    }
  };

  const isAllPendingChecked = useMemo(() => {
    if (!shouldShowItems || availableItems.length === 0) return false;
    return availableItems.every((row) => pendingItems.has(row.kode_barang_variant));
  }, [availableItems, pendingItems, shouldShowItems]);

  const handleSavePromo = async () => {
    if (isSaving) return;
    if (!namaPromo.trim()) {
      await Swal.fire("Nama promo wajib diisi", "", "warning");
      return;
    }
    if (!tanggalMulai || !tanggalSelesai) {
      await Swal.fire("Tanggal mulai dan selesai wajib diisi", "", "warning");
      return;
    }
    if ((jamMulai && !jamSelesai) || (!jamMulai && jamSelesai)) {
      await Swal.fire("Jam mulai dan selesai harus diisi berpasangan", "", "warning");
      return;
    }
    if (selectedItems.size === 0) {
      await Swal.fire("Pilih item promo terlebih dahulu", "", "warning");
      return;
    }
    if (!nilaiDiskon || Number.isNaN(Number(nilaiDiskon))) {
      await Swal.fire("Nilai diskon wajib diisi", "", "warning");
      return;
    }

    const parsePositiveInt = (value: string | number | null | undefined) => {
      if (value === null || value === undefined || value === "") return null;
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0) return null;
      return Math.floor(num);
    };

    const ruleItems = Array.from(selectedItems).map((kode) => ({
      kode_barang_variant: kode,
      min_qty: 1,
      max_qty: parsePositiveInt(itemMaxQty[kode]),
    }));

    const payload = {
      nama_promosi: namaPromo.trim(),
      deskripsi: deskripsi.trim() || null,
      valid_from: tanggalMulai,
      valid_to: tanggalSelesai,
      time_from: toSqlTime(jamMulai),
      time_to: toSqlTime(jamSelesai),
      jenis_sumber: "INTERNAL",
      status_aktif: editingHeader?.status_aktif ?? 1,
      status_approval: editingHeader?.status_approval ?? 0,
      updated_by: getUsername(),
      budget_total: budgetMax === "" ? null : Number(budgetMax),
      max_total_item: parsePositiveInt(qtyMaksimum),
      target_toko: Array.from(selectedToko),
      rule_groups: [
        {
          group_no: 1,
          group_operator: "AND",
          rule_type: "ITEM_COMBO",
          min_total_qty: Number(qtyMinimum || 1),
          max_redeem_qty: gunakanKelipatan ? null : 1,
          items: ruleItems,
        },
      ],
      benefits: [
        {
          benefit_type: jenisDiskon === "PERSEN" ? "DISKON_PERSEN" : "DISKON_NOMINAL",
          diskon_persen: jenisDiskon === "PERSEN" ? Number(nilaiDiskon) : null,
          diskon_nominal: jenisDiskon === "NOMINAL" ? Number(nilaiDiskon) : null,
          apply_scope: "APPLY_TO_RULE_ITEMS",
          rounding_mode: "ROUND",
          rounding_step: 1,
        },
      ],
    };

    setIsSaving(true);
    try {
      const url = editingId ? `${API_BASE}/promos/${encodeURIComponent(editingId)}` : `${API_BASE}/promos`;
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      await Swal.fire(editingId ? "Promo berhasil diperbarui" : "Promo berhasil disimpan", "", "success");
      setTab("list");
      setEditingId(null);
      setEditingHeader(null);
    } catch (err) {
      await Swal.fire(editingId ? "Gagal memperbarui promo" : "Gagal menyimpan promo", String(err), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#f3fffb] via-white to-[#e6fbf6] p-4 md:p-6 space-y-6 overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-[#5fe7d7]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-[#0f756b]/10 blur-3xl" />

      <div className="relative bg-white/90 backdrop-blur border border-[#d7f2ee] rounded-3xl shadow-[0_12px_30px_-24px_rgba(15,117,107,0.6)] p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0f756b] to-[#35d8c8] text-white flex items-center justify-center shadow-sm">
            <BadgePercent className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#3c7f77]">Promosi</p>
            <h1 className="text-2xl font-bold text-gray-900">Diskon Refraksi</h1>
            <p className="text-sm text-gray-500">Atur promo berbasis harga 1 pcs dengan target toko.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("list")}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
              tab === "list"
                ? "bg-[#e6fffb] text-[#0f756b] border-[#b9ede6]"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Daftar Promo
          </button>
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`px-5 py-2 rounded-full text-sm font-semibold border transition ${
              tab === "create"
                ? "bg-[#0f756b] text-white border-[#0f756b] shadow-sm"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Plus className="w-4 h-4 inline-block mr-1" />
            Buat Promo
          </button>
        </div>
      </div>

      {tab === "list" ? (
        <>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600">
                <Filter className="w-4 h-4" />
                <span>Filter</span>
              </div>
              <input
                placeholder="Cari promo / kode / barcode"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[220px] flex-1"
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
              />
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[160px]"
                value={statusApprovalFilter}
                onChange={(e) => setStatusApprovalFilter(e.target.value)}
              >
                <option value="semua">Status Approval</option>
                <option value="0">Pending</option>
                <option value="1">Approved</option>
                <option value="2">Rejected</option>
              </select>
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[160px]"
                value={statusAktifFilter}
                onChange={(e) => setStatusAktifFilter(e.target.value)}
              >
                <option value="semua">Status Aktif</option>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[160px]"
                value={statusBerlakuFilter}
                onChange={(e) => setStatusBerlakuFilter(e.target.value)}
              >
                <option value="semua">Status Berlaku</option>
                <option value="berlaku">Berlaku</option>
                <option value="expired">Expired</option>
                <option value="tidak_berlaku">Tidak Berlaku</option>
              </select>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600">
                <CalendarClock className="h-4 w-4 text-gray-400" />
                Dari
                <input
                  type="date"
                  className="text-sm text-gray-700 outline-none"
                  value={listDateFrom}
                  onChange={(e) => setListDateFrom(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600">
                Sampai
                <input
                  type="date"
                  className="text-sm text-gray-700 outline-none"
                  value={listDateTo}
                  onChange={(e) => setListDateTo(e.target.value)}
                />
              </label>
              {(listDateFrom || listDateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    const range = getDefaultPromoListDateRange();
                    setListDateFrom(range.from);
                    setListDateTo(range.to);
                  }}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Reset Tanggal
                </button>
              )}
              <label className="ml-auto flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={showBudgetAlertOnly}
                  onChange={(e) => setShowBudgetAlertOnly(e.target.checked)}
                />
                Tampilkan promo mendekati/di atas 100%
              </label>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Mendekati 100%</p>
              <p className="mt-2 text-2xl font-semibold text-amber-800">{budgetStats.near}</p>
              <p className="text-xs text-amber-700">Promo aktif yang mendekati 100% budget.</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-rose-700">Di Atas 100%</p>
              <p className="mt-2 text-2xl font-semibold text-rose-800">{budgetStats.over}</p>
              <p className="text-xs text-rose-700">Promo aktif yang melebihi 100% budget.</p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Daftar Promo</p>
                <p className="text-base font-semibold text-gray-800">Diskon Refraksi</p>
                <p className="text-xs text-gray-500">{selectedPromoRows.length} promo terseleksi</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSyncAllToKasir}
                  disabled={promoLoading || selectedPromoRows.length === 0 || syncingId === "__ALL__"}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Sinkron promo yang diceklist saja"
                >
                  {syncingId === "__ALL__" ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <ListChecks className="h-4 w-4" />
                  )}
                  Sync Promo Terpilih ({selectedPromoRows.length})
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={promoLoading || sortedPromoRows.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Export Excel
                </button>
              </div>
            </div>
            <div className="p-4">
              {promoLoading ? (
                <div className="py-10 text-center text-sm text-gray-500">Memuat daftar promo...</div>
              ) : promoError ? (
                <div className="py-10 text-center text-sm text-rose-600">{promoError}</div>
              ) : displayedPromoRows.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">Belum ada data promo diskon refraksi.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300"
                            checked={isAllVisiblePromosSelected}
                            onChange={(event) => toggleSelectAllVisiblePromos(event.target.checked)}
                            aria-label="Pilih semua promo yang tampil"
                          />
                        </th>
                        <th className="px-4 py-3 text-left">
                          <button type="button" className="inline-flex items-center" onClick={() => toggleSort("kode_t_promosi")}>
                            Kode {renderSortIcon("kode_t_promosi")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <button type="button" className="inline-flex items-center" onClick={() => toggleSort("nama_promosi")}>
                            Nama Promo {renderSortIcon("nama_promosi")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left">Gambar Promo</th>
                        <th className="px-4 py-3 text-left">
                          <button type="button" className="inline-flex items-center" onClick={() => toggleSort("valid_from")}>
                            Periode {renderSortIcon("valid_from")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <button type="button" className="inline-flex items-center" onClick={() => toggleSort("berlaku")}>
                            Berlaku {renderSortIcon("berlaku")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <button type="button" className="inline-flex items-center" onClick={() => toggleSort("target_toko")}>
                            Target Toko {renderSortIcon("target_toko")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <button type="button" className="inline-flex items-center" onClick={() => toggleSort("benefit")}>
                            Benefit {renderSortIcon("benefit")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-right">
                          <button type="button" className="inline-flex items-center justify-end w-full" onClick={() => toggleSort("budget")}>
                            Budget {renderSortIcon("budget")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <button type="button" className="inline-flex items-center" onClick={() => toggleSort("jam")}>
                            Jam {renderSortIcon("jam")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-center">
                          <button type="button" className="inline-flex items-center justify-center w-full" onClick={() => toggleSort("approval")}>
                            Approval {renderSortIcon("approval")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-center">
                          <button type="button" className="inline-flex items-center justify-center w-full" onClick={() => toggleSort("aktif")}>
                            Aktif {renderSortIcon("aktif")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedPromoRows.map((row) => (
                        <tr key={row.kode_t_promosi} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300"
                              checked={selectedPromoCodes.has(String(row.kode_t_promosi || ""))}
                              onChange={(event) => toggleSelectPromo(String(row.kode_t_promosi || ""), event.target.checked)}
                              aria-label={`Pilih promo ${row.kode_t_promosi}`}
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{row.kode_t_promosi}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{row.nama_promosi || "-"}</div>
                            <div className="text-xs text-gray-500">{row.deskripsi || "-"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {row.banner_url ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setImagePreview({
                                      url: row.banner_url,
                                      name: String(row.nama_promosi || row.kode_t_promosi),
                                      kode: String(row.kode_t_promosi),
                                    })}
                                    className="h-12 w-20 overflow-hidden rounded-lg bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                                    title="Klik untuk preview gambar"
                                  >
                                    <img
                                      src={row.banner_url}
                                      alt={`Gambar ${row.nama_promosi || row.kode_t_promosi}`}
                                      loading="lazy"
                                      className="block h-12 w-20 rounded-lg border border-gray-200 object-cover transition hover:opacity-80"
                                      onError={(event) => {
                                        event.currentTarget.style.display = "none";
                                      }}
                                    />
                                  </button>
                                </>
                              ) : (
                                <label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 ${uploadingImageId === row.kode_t_promosi ? "pointer-events-none opacity-50" : ""}`}>
                                  <Upload className="h-3.5 w-3.5" />
                                  {uploadingImageId === row.kode_t_promosi ? "Upload..." : "Upload"}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploadingImageId === row.kode_t_promosi}
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      if (file) void handleUploadPromoImage(row, file);
                                      event.currentTarget.value = "";
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatDate(row.valid_from)} - {formatDate(row.valid_to)}
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const label = getValidityLabel(row);
                              if (label === "Berlaku") {
                                return (
                                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                    Berlaku
                                  </span>
                                );
                              }
                              if (label === "Tidak Berlaku") {
                                return (
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                    Tidak Berlaku
                                  </span>
                                );
                              }
                              if (label === "Expired") {
                                return (
                                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                    Expired
                                  </span>
                                );
                              }
                              return <span className="text-xs text-gray-500">-</span>;
                            })()}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatTargetToko(row.target_toko)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatBenefit(row.benefit_info)}
                          </td>
                          <td className="px-4 py-3 text-right">
                              {(() => {
                                const budget = formatBudget(row);
                                if (budget === "-") {
                                  return <span className="text-gray-500">-</span>;
                                }
                                return (
                                  <span
                                    className={
                                      budget.isOver
                                        ? "rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"
                                        : "text-gray-700"
                                    }
                                  >
                                    {budget.text}
                                  </span>
                                );
                              })()}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            <div className="flex items-center gap-2">
                              <span>
                                {row.time_from || row.time_to
                                  ? `${formatTime(row.time_from)} - ${formatTime(row.time_to)}`
                                  : "-"}
                              </span>
                              <button
                                type="button"
                                onClick={() => openTimeEdit(row)}
                                className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                                title="Edit jam"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.status_approval === 1 ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                  Approved
                                </span>
                                <span className="text-[11px] text-gray-500">{formatDateTime(row.approved_at)}</span>
                              </div>
                            ) : row.status_approval === 2 ? (
                              <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {Number(row.status_aktif ?? 0) === 1 ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                Aktif
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReactivate(row)}
                                disabled={reactivatingId === row.kode_t_promosi}
                                className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Klik untuk aktifkan kembali"
                              >
                                {reactivatingId === row.kode_t_promosi ? "Mengaktifkan..." : "Nonaktif"}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {Number(row.status_aktif ?? 0) !== 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleReactivate(row)}
                                  disabled={reactivatingId === row.kode_t_promosi}
                                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                >
                                  {reactivatingId === row.kode_t_promosi ? "Aktifkan..." : "Aktifkan"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSyncToKasir(row)}
                                disabled={syncingId === row.kode_t_promosi}
                                className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 disabled:opacity-60"
                              >
                                {syncingId === row.kode_t_promosi ? "Sync..." : "Sync to Kasir"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleViewDetail(row.kode_t_promosi)}
                                disabled={detailLoading}
                                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                Detail
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEdit(row.kode_t_promosi)}
                                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                Edit
                              </button>
                              {Number(row.status_approval ?? 0) === 0 && (
                                <>
                              <button
                                type="button"
                                onClick={() => handleApprove(row.kode_t_promosi)}
                                disabled={Number(row.status_approval ?? 0) === 1}
                                className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(row.kode_t_promosi)}
                                disabled={Number(row.status_approval ?? 0) === 2}
                                className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                              >
                                Reject
                              </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDelete(row.kode_t_promosi)}
                                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                              >
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white/95 backdrop-blur border border-[#d7f2ee] rounded-3xl shadow-[0_12px_30px_-24px_rgba(15,117,107,0.5)] p-6 space-y-6">
          <div className="flex items-center gap-3 text-sm font-semibold text-[#0f756b]">
            <div className="h-9 w-9 rounded-xl bg-[#e6fffb] flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#3c7f77]">Informasi Promo</p>
              <p className="text-base font-semibold text-gray-800">Detail Diskon</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Nama Promo</span>
              <input
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                placeholder="Nama promo"
                value={namaPromo}
                onChange={(e) => setNamaPromo(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Deskripsi</span>
              <input
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                placeholder="Deskripsi singkat"
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Tanggal Mulai</span>
              <input
                type="date"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={tanggalMulai}
                onChange={(e) => setTanggalMulai(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Tanggal Selesai</span>
              <input
                type="date"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={tanggalSelesai}
                onChange={(e) => setTanggalSelesai(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Jam Mulai</span>
              <input
                type="time"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={jamMulai}
                onChange={(e) => setJamMulai(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Jam Selesai</span>
              <input
                type="time"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={jamSelesai}
                onChange={(e) => setJamSelesai(e.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Jenis Diskon</span>
              <select
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={jenisDiskon}
                onChange={(e) => setJenisDiskon(e.target.value as "PERSEN" | "NOMINAL")}
              >
                <option value="PERSEN">Persentase</option>
                <option value="NOMINAL">Potongan Nominal</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Nilai Diskon</span>
              <input
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                placeholder="Contoh: 10 / 2000"
                value={nilaiDiskon}
                onChange={(e) => setNilaiDiskon(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Qty Minimum</span>
              <input
                type="number"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={qtyMinimum}
                onChange={(e) => setQtyMinimum(Number(e.target.value || 1))}
                min={1}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Qty Maksimum Promo</span>
              <input
                type="number"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={qtyMaksimum}
                onChange={(e) => setQtyMaksimum(e.target.value)}
                min={1}
                placeholder="Opsional"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Gunakan Kelipatan</span>
              <select
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={gunakanKelipatan ? "1" : "0"}
                onChange={(e) => setGunakanKelipatan(e.target.value === "1")}
              >
                <option value="1">Ya</option>
                <option value="0">Tidak</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Budget Max (Opsional)</span>
              <input
                type="number"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                min={0}
                placeholder="Contoh: 5000000"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-gray-600">Target Toko</span>
              <Select
                isMulti
                closeMenuOnSelect={false}
                hideSelectedOptions={false}
                options={tokoSelectOptions}
                value={selectedTokoValues}
                onChange={handleTokoChange}
                isOptionSelected={(option: { value: string; label: string }) =>
                  option.value === allTokoOption.value ? selectAllToko : selectedToko.has(option.value)
                }
                styles={selectStyles}
                placeholder="Pilih toko"
                noOptionsMessage={() => "Tidak ada toko."}
                components={{ Option: CheckboxOption }}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-gray-200 p-4 bg-gradient-to-br from-white to-[#f8fffd]">
            <div className="flex items-center gap-3 text-sm font-semibold text-gray-700 mb-3">
              <div className="h-8 w-8 rounded-lg bg-[#e6fffb] text-[#0f756b] flex items-center justify-center">
                <ListChecks className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#3c7f77]">Item Promo</p>
                <p className="text-sm font-semibold text-gray-800">Pilih Item Promo</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <span>Daftar Item</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#0f756b] hover:underline disabled:text-gray-400 disabled:no-underline"
                      disabled={pendingItems.size === 0}
                      onClick={() => {
                        if (pendingItems.size === 0) return;
                        const next = new Set(selectedItems);
                        pendingItems.forEach((kode) => next.add(kode));
                        setSelectedItems(next);
                        setPendingItems(new Set());
                      }}
                    >
                      Pilih Item
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3 border-b border-gray-100 bg-white">
                  <div className="grid gap-2 md:grid-cols-[160px_160px_1fr]">
                    <select
                      className="rounded-xl border border-gray-200 px-3 h-11 text-sm"
                      value={filterSupplier}
                      onChange={(e) => {
                        setFilterSupplier(e.target.value);
                        if (e.target.value === "") {
                          setFilterMerk("");
                        }
                        if (e.target.value === "" && filterMerk === "") {
                          setItemSearch("");
                        }
                      }}
                    >
                      <option value="">Pilih Supplier</option>
                      {supplierOptions.map((supplier) => (
                        <option key={supplier.kode_supplier} value={supplier.kode_supplier}>
                          {supplier.nama_supplier || supplier.kode_supplier}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-xl border border-gray-200 px-3 h-11 text-sm"
                      value={filterMerk}
                      onChange={(e) => {
                        setFilterMerk(e.target.value);
                        if (e.target.value === "" && filterSupplier === "") {
                          setItemSearch("");
                        }
                      }}
                      disabled={!isMerkEnabled}
                    >
                      <option value="">Filter Merk</option>
                      {merkOptions.map((merk) => (
                        <option key={merk} value={merk}>
                          {merk}
                        </option>
                      ))}
                    </select>
                    <input
                      className="rounded-xl border border-gray-200 px-3 h-11 text-sm"
                      placeholder="Cari barang / varian"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      disabled={!shouldShowItems}
                    />
                  </div>
                  {!shouldShowItems ? (
                    <div className="mt-2 text-xs text-gray-500">
                      Pilih supplier terlebih dahulu untuk menampilkan item.
                    </div>
                  ) : null}
                </div>
                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white sticky top-0 z-10">
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="px-4 py-2 w-8">
                          <input
                            type="checkbox"
                            checked={isAllPendingChecked}
                            onChange={(e) => {
                              if (!shouldShowItems) return;
                              const next = new Set(pendingItems);
                              if (e.target.checked) {
                                availableItems.forEach((row) => next.add(row.kode_barang_variant));
                              } else {
                                availableItems.forEach((row) => next.delete(row.kode_barang_variant));
                              }
                              setPendingItems(next);
                            }}
                            disabled={!shouldShowItems || availableItems.length === 0}
                          />
                        </th>
                        <th className="px-4 py-2">Nama Barang</th>
                        <th className="px-4 py-2">Nama Varian</th>
                        <th className="px-4 py-2">Barcode</th>
                        <th className="px-4 py-2">Merk</th>
                        <th className="px-4 py-2">Supplier</th>
                        <th className="px-4 py-2 text-right">Stok Gudang</th>
                        <th className="px-4 py-2 text-right">Stok Toko</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!shouldShowItems ? (
                        <tr>
                          <td className="px-4 py-4 text-gray-500" colSpan={7}>
                            Item belum ditampilkan.
                          </td>
                        </tr>
                      ) : availableItems.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-gray-500" colSpan={7}>
                            Tidak ada item.
                          </td>
                        </tr>
                      ) : (
                        availableItems.map((row) => (
                          <tr key={row.kode_barang_variant} className="border-b border-gray-100 last:border-0">
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={pendingItems.has(row.kode_barang_variant)}
                                onChange={(e) => {
                                  const next = new Set(pendingItems);
                                  if (e.target.checked) {
                                    next.add(row.kode_barang_variant);
                                  } else {
                                    next.delete(row.kode_barang_variant);
                                  }
                                  setPendingItems(next);
                                }}
                              />
                            </td>
                          <td className="px-4 py-2 text-gray-800">{row.nama_barang}</td>
                          <td className="px-4 py-2 text-gray-800">{row.nama_varian}</td>
                          <td className="px-4 py-2 text-gray-600">{row.barcode_varian || "-"}</td>
                          <td className="px-4 py-2 text-gray-600">{row.nama_merk || "-"}</td>
                            <td className="px-4 py-2 text-gray-600">{row.nama_supplier || "-"}</td>
                            <td className="px-4 py-2 text-right text-gray-700">{formatNumber(row.stok_gudang)}</td>
                            <td className="px-4 py-2 text-right text-gray-700">{formatNumber(row.stok_toko)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span>Item Promo Terpilih</span>
                  <span className="rounded-full bg-[#e6fffb] px-2 py-0.5 text-[11px] font-semibold text-[#0f756b]">
                    {selectedItemsList.length} item
                  </span>
                </div>
                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white sticky top-0 z-10">
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="px-4 py-2">Nama Barang</th>
                        <th className="px-4 py-2">Nama Varian</th>
                        <th className="px-4 py-2">Barcode</th>
                        <th className="px-4 py-2 text-center">Max Qty</th>
                        <th className="px-4 py-2 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItemsList.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-gray-500" colSpan={4}>
                            Belum ada item dipilih.
                          </td>
                        </tr>
                      ) : (
                        selectedItemsList.map((row) => (
                          <tr key={row.kode_barang_variant} className="border-b border-gray-100 last:border-0">
                            <td className="px-4 py-2 text-gray-800">{row.nama_barang}</td>
                            <td className="px-4 py-2 text-gray-800">{row.nama_varian}</td>
                            <td className="px-4 py-2 text-gray-600">{row.barcode_varian || "-"}</td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="number"
                                className="w-20 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 text-center"
                                placeholder="-"
                                min={1}
                                value={itemMaxQty[row.kode_barang_variant] ?? ""}
                                onChange={(e) =>
                                  setItemMaxQty((prev) => ({
                                    ...prev,
                                    [row.kode_barang_variant]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                className="text-xs font-semibold text-rose-600 hover:underline"
                                onClick={() => {
                                  const next = new Set(selectedItems);
                                  next.delete(row.kode_barang_variant);
                                  setSelectedItems(next);
                                  setItemMaxQty((prev) => {
                                    const next = { ...prev };
                                    delete next[row.kode_barang_variant];
                                    return next;
                                  });
                                }}
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-500">
              {selectedItemsList.length} item dipilih.
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">
              Batal
            </button>
            <button
              className="rounded-full bg-[#0f756b] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 shadow-sm"
              onClick={handleSavePromo}
              disabled={isSaving}
            >
              {isSaving ? "Menyimpan..." : "Simpan Promo"}
            </button>
            </div>
          </div>
        </div>
      )}

      {detailOpen && detailData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-xs text-gray-500">Detail Promo</p>
                <h2 className="text-lg font-semibold text-gray-900">{detailData?.header?.nama_promosi || "-"}</h2>
                <p className="text-sm text-gray-600">
                  {formatDate(detailData?.header?.valid_from)} - {formatDate(detailData?.header?.valid_to)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Kode Promo</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.kode_t_promosi || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Status Aktif</p>
                  <p className="font-semibold text-gray-900">
                    {Number(detailData?.header?.status_aktif ?? 0) === 1 ? "Aktif" : "Nonaktif"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Status Approval</p>
                  <p className="font-semibold text-gray-900">
                    {detailData?.header?.status_approval === 1
                      ? "Approved"
                      : detailData?.header?.status_approval === 2
                        ? "Rejected"
                        : "Pending"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 md:col-span-2">
                  <p className="text-xs text-gray-500">Deskripsi</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.deskripsi || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Jenis Sumber</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.jenis_sumber || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Budget Max</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.budget_total)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Budget Terpakai</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.budget_terpakai)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Max Total Item</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.max_total_item)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Total Item Terpakai</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.total_item_terpakai)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Max Redeem / Trx</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.max_total_redeem_trx)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Redeem Trx Used</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.total_redeem_trx_used)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Redeem Mode</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.redeem_mode || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Max Redeem / Trx</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.max_redeem_times_per_trx)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Max Redeem / Customer</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.max_redeem_per_customer)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Scope Redeem Customer</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.redeem_scope_per_customer || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Payment Scope</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.payment_scope || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Dibuat Oleh</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.created_by || "-"}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(detailData?.header?.created_at)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Diupdate Oleh</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.updated_by || "-"}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(detailData?.header?.updated_at)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Approved By</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.approved_by || "-"}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(detailData?.header?.approved_at)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Rejected By</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.rejected_by || "-"}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(detailData?.header?.rejected_at)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 md:col-span-2">
                  <p className="text-xs text-gray-500">Catatan Approval</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.catatan_approval || "-"}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <p className="text-xs text-gray-500 mb-2">Target Toko</p>
                  <div className="flex flex-wrap gap-2">
                    {(detailData?.target_toko || []).length ? (
                      detailData.target_toko.map((t: any) => (
                        <span key={t} className="rounded-full bg-[#e6fffb] px-2 py-0.5 text-xs font-semibold text-[#0f756b]">
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-600">-</span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <p className="text-xs text-gray-500 mb-2">Payment Methods</p>
                  <div className="flex flex-wrap gap-2">
                    {(detailData?.payment_methods || []).length ? (
                      detailData.payment_methods.map((t: any) => (
                        <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-600">-</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Rule Groups</p>
                <div className="overflow-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Group No</th>
                        <th className="px-3 py-2">Operator</th>
                        <th className="px-3 py-2">Rule Type</th>
                        <th className="px-3 py-2 text-center">Min Qty</th>
                        <th className="px-3 py-2 text-center">Min Value</th>
                        <th className="px-3 py-2 text-center">Max Qty</th>
                        <th className="px-3 py-2 text-center">Max Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(detailData?.rule_groups || []).length ? (
                        detailData.rule_groups.map((g: any) => (
                          <tr key={g.kode_d_rule_group || g.group_no}>
                            <td className="px-3 py-2">{g.group_no ?? "-"}</td>
                            <td className="px-3 py-2">{g.group_operator || "-"}</td>
                            <td className="px-3 py-2">{g.rule_type || "-"}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(g.min_total_qty)}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(g.min_total_value)}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(g.max_redeem_qty)}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(g.max_redeem_value)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-4 text-center text-gray-500" colSpan={7}>
                            Tidak ada rule group.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Benefits</p>
                <div className="overflow-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2 text-center">Diskon %</th>
                        <th className="px-3 py-2 text-center">Diskon Nominal</th>
                        <th className="px-3 py-2">Apply Scope</th>
                        <th className="px-3 py-2 text-center">Max Discount</th>
                        <th className="px-3 py-2 text-center">Rounding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(detailData?.benefits || []).length ? (
                        detailData.benefits.map((b: any) => (
                          <tr key={b.kode_d_benefit || b.benefit_type}>
                            <td className="px-3 py-2">{b.benefit_type || "-"}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(b.diskon_persen)}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(b.diskon_nominal)}</td>
                            <td className="px-3 py-2">{b.apply_scope || "-"}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(b.max_discount_value_per_trx)}</td>
                            <td className="px-3 py-2 text-center">
                              {b.rounding_mode || "-"} {b.rounding_step ? `(${b.rounding_step})` : ""}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-4 text-center text-gray-500" colSpan={6}>
                            Tidak ada benefit.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Bonus Items</p>
                <div className="overflow-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Kode Varian</th>
                        <th className="px-3 py-2">Qty Bonus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(() => {
                        const bonusItems =
                          detailData?.benefits
                            ?.flatMap((b: any) => b.bonus_items || [])
                            ?.filter((b: any) => b) || [];
                        if (bonusItems.length === 0) {
                          return (
                            <tr>
                              <td className="px-3 py-4 text-center text-gray-500" colSpan={2}>
                                Tidak ada bonus item.
                              </td>
                            </tr>
                          );
                        }
                        return bonusItems.map((bi: any, idx: number) => (
                          <tr key={bi.kode_d_bonus_item || `${bi.kode_barang_variant}-${idx}`}>
                            <td className="px-3 py-2">{bi.kode_barang_variant || "-"}</td>
                            <td className="px-3 py-2">{formatNumber(bi.qty_bonus)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-800">Detail Item Promo</p>
                  <input
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    placeholder="Cari nama varian / barcode"
                    className="w-full md:w-72 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                  />
                </div>
                <div className="overflow-auto border border-gray-200 rounded-xl max-h-[45vh]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Kode Varian</th>
                        <th className="px-3 py-2">Nama Barang</th>
                        <th className="px-3 py-2">Nama Varian</th>
                        <th className="px-3 py-2">Barcode</th>
                        <th className="px-3 py-2 text-center">Min Qty</th>
                        <th className="px-3 py-2 text-center">Max Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(() => {
                        const keyword = detailSearch.trim().toLowerCase();
                        const allItems = detailData?.rule_groups?.flatMap((g: any) => g.items || []) || [];
                        const filteredItems = keyword
                          ? allItems.filter((item: any) => {
                              const namaVarian = String(item.nama_varian || item.kode_varian || "").toLowerCase();
                              const barcode = String(item.barcode_varian || "").toLowerCase();
                              return namaVarian.includes(keyword) || barcode.includes(keyword);
                            })
                          : allItems;

                        if (filteredItems.length === 0) {
                          return (
                            <tr>
                              <td className="px-3 py-4 text-center text-gray-500" colSpan={6}>
                                Tidak ada item promo.
                              </td>
                            </tr>
                          );
                        }

                        return filteredItems.map((item: any) => (
                          <tr key={item.kode_d_rule_item || `${item.kode_barang_variant}-${item.kode_d_rule_group}`}>
                            <td className="px-3 py-2 text-gray-700">{item.kode_barang_variant || "-"}</td>
                            <td className="px-3 py-2 text-gray-800">{item.nama_barang || "-"}</td>
                            <td className="px-3 py-2 text-gray-800">{item.nama_varian || item.kode_varian || "-"}</td>
                            <td className="px-3 py-2 text-gray-700">{item.barcode_varian || "-"}</td>
                            <td className="px-3 py-2 text-center text-gray-700">{item.min_qty ?? "-"}</td>
                            <td className="px-3 py-2 text-center text-gray-700">{item.max_qty ?? "-"}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {syncModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Sinkronisasi Promo</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{syncPromoName}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {syncFinished
                      ? "Proses selesai. Periksa status sinkronisasi di bawah."
                      : syncMode === "all"
                        ? "Menjalankan sinkronisasi promo yang diceklist..."
                        : "Menjalankan sinkronisasi ke database kasir..."}
                  </p>
                </div>
                {!syncFinished && <LoaderCircle className="h-5 w-5 animate-spin text-cyan-600" />}
              </div>
              {syncMode === "all" && (
                <div className="mt-4 rounded-xl border border-cyan-100 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
                    <span>Progress promo</span>
                    <span>
                      {syncPromoIndex} dari {syncPromoTotal} promo
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (syncPromoIndex / Math.max(1, syncPromoTotal)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-cyan-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, (syncCompleted / Math.max(1, syncTotal)) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-right text-xs font-medium text-slate-500">
                {syncCompleted} dari {syncTotal} kasir selesai
              </p>
            </div>

            <div className="space-y-3 px-5 py-5">
              {syncMode === "all" && syncOfflineTargets.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Kasir offline dilewati
                  </p>
                  <div className="mt-2 space-y-2">
                    {syncOfflineTargets.map((item) => (
                      <div key={item.database} className="text-xs text-amber-800">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{item.label || item.server}</span>
                          <span>Dilewati</span>
                        </div>
                        <p className="mt-0.5 break-all text-amber-700">{item.database}</p>
                        {item.error && <p className="mt-1 rounded-lg bg-white/70 px-2 py-1 text-amber-700">{item.error}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {syncMode === "all" && syncPromoResults.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Riwayat Promo</p>
                  <div className="space-y-1">
                    {syncPromoResults.map((item) => (
                      <div key={item.kode_t_promosi} className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-700">{item.nama_promosi}</p>
                          <p className="text-slate-400">{item.kode_t_promosi}</p>
                        </div>
                        <span className={item.ok ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                          {item.ok ? "Berhasil" : "Gagal"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {syncProgress.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                  Menyiapkan data promo...
                </div>
              ) : (
                syncProgress.map((item) => {
                  const isRunning = item.state === "running";
                  const isSuccess = item.state === "success";
                  return (
                    <div key={item.database} className="rounded-xl border border-slate-200 px-4 py-3">
                      <div className="flex items-start gap-3">
                        {isRunning ? (
                          <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-cyan-600" />
                        ) : (
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              isSuccess ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {isSuccess ? "✓" : "!"}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-slate-800">{item.label || item.server}</p>
                            <span
                              className={`text-xs font-semibold ${
                                isRunning ? "text-cyan-700" : isSuccess ? "text-emerald-700" : "text-rose-700"
                              }`}
                            >
                              {isRunning ? "Sedang diproses..." : isSuccess ? "Berhasil" : "Gagal"}
                            </span>
                          </div>
                          <p className="mt-0.5 break-all text-xs text-slate-500">{item.database}</p>
                          {!isRunning && !isSuccess && item.error && (
                            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">{item.error}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {syncError && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{syncError}</div>}
              {syncFinished && !syncError && (
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {syncMode === "all"
                    ? `${syncPromoResults.filter((item) => item.ok).length} promo berhasil, ${
                        syncPromoResults.filter((item) => !item.ok).length
                      } promo gagal.${syncOfflineTargets.length ? ` ${syncOfflineTargets.length} kasir offline dilewati.` : ""}`
                    : `${syncProgress.filter((item) => item.ok).length} berhasil, ${
                        syncProgress.filter((item) => !item.ok).length
                      } gagal.`}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                disabled={!syncFinished}
                onClick={() => setSyncModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {imagePreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Preview Gambar Promo</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">{imagePreview.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setImagePreview(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
            <div className="bg-slate-950 p-4">
              <img src={imagePreview.url} alt={`Preview ${imagePreview.name}`} className="mx-auto max-h-[65vh] max-w-full rounded-lg object-contain" />
            </div>
            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 ${uploadingImageId === imagePreview.kode ? "pointer-events-none opacity-50" : ""}`}>
                <Upload className="h-4 w-4" />
                {uploadingImageId === imagePreview.kode ? "Mengupload..." : "Ganti Image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingImageId === imagePreview.kode}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleUploadPromoImage({ kode_t_promosi: imagePreview.kode, nama_promosi: imagePreview.name }, file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {timeEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-xs text-gray-500">Edit Jam Berlaku</p>
                <p className="text-sm font-semibold text-gray-900">{timeEditId || "-"}</p>
              </div>
              <button
                type="button"
                onClick={closeTimeEdit}
                className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {timeEditError && (
                <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {timeEditError}
                </div>
              )}
              <label className="space-y-1 text-sm">
                <span className="text-gray-600">Jam Mulai</span>
                <input
                  type="time"
                  value={timeEditFrom}
                  onChange={(e) => setTimeEditFrom(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600">Jam Selesai</span>
                <input
                  type="time"
                  value={timeEditTo}
                  onChange={(e) => setTimeEditTo(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={closeTimeEdit}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTimeEdit}
                disabled={timeEditSaving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {timeEditSaving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("id-ID");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("id-ID");
}

function formatNumber(value: any) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("id-ID");
}

function toInputDate(value: string | null | undefined) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toInputTime(value: string | null | undefined) {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";
  return text.length >= 5 ? text.slice(0, 5) : text;
}

function formatTime(value: any) {
  if (!value) return "-";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(11, 16);
  }
  const text = String(value).trim();
  if (!text) return "-";
  if (text.includes("T") && text.length >= 16) {
    return text.slice(11, 16);
  }
  return text.length >= 5 ? text.slice(0, 5) : text;
}

function formatTargetToko(value: any) {
  if (!value) return "-";
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",").map((v) => v.trim()).filter(Boolean)
      : [];
  if (!list.length) return "-";
  const top = list.slice(0, 3).join(", ");
  if (list.length <= 3) return top;
  return `${top} +${list.length - 3}`;
}

function formatBenefit(value: any) {
  if (!value) return "-";
  const list =
    typeof value === "string"
      ? value.split(",").map((v) => v.trim()).filter(Boolean)
      : Array.isArray(value)
        ? value
        : [];
  if (!list.length) return "-";
  if (list.length <= 1) return list[0];
  return list.join(", ");
}

function formatBudget(row: any) {
  if (!row) return "-";
  const total = Number(row.budget_total ?? 0);
  if (!Number.isFinite(total) || total <= 0) return "-";
  const used = Number(row.budget_terpakai ?? 0);
  const pct = total > 0 ? (used / total) * 100 : 0;
  const pctText = pct.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  const usedText = `Rp ${Number.isFinite(used) ? used.toLocaleString("id-ID") : "0"}`;
  const totalText = `Rp ${total.toLocaleString("id-ID")}`;
  return {
    text: `${usedText} / ${totalText} (${pctText}%)`,
    isOver: pct > 100,
  };
}

function toSqlTime(value: string | null | undefined) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length === 5 ? `${text}:00` : text;
}
