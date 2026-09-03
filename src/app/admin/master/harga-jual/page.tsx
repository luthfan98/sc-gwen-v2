"use client";

import React from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Plus, ShieldCheck, Eye, CalendarClock, ChevronDown } from "lucide-react";
import Swal from "sweetalert2";
import JsBarcode from "jsbarcode";

type HargaJual = {
  id: string | number;
  id_barang: number;
  id_kelas_harga: number;
  harga_1: number;
  harga_3: number;
  harga_6: number;
  harga_12: number;
  berlaku_mulai: string;
  berlaku_sampai: string | null;
  is_active: number;
  kode_barang?: string;
  kode_merk?: string;
  nama_merk?: string;
  nama_barang?: string;
  kode_barang_variant?: string;
  nama_varian?: string;
  kode_varian?: string;
  barcode_varian?: string;
  kode_kelas_harga?: string;
  nama_kelas?: string;
  channel_code?: string;
  updated_at?: string;
  updated_by?: string;
  harga_beli_sat_1?: number;
  het_sat_1?: number;
  hpp_avg_sat_1?: number;
  stok_gudang?: number;
  stok_toko?: number;
  status_barang?: number;
  status_varian?: number;
  last_request_status?: number | null;
  last_request_at?: string | null;
};

type KasirPriceResult = {
  label: string;
  server: string;
  database: string;
  status: "ok" | "error";
  message?: string;
  rows: {
    channel_code?: string | null;
    nama_kelas?: string | null;
    harga_1?: number | null;
    harga_3?: number | null;
    harga_6?: number | null;
    harga_12?: number | null;
    is_active?: number | boolean | null;
    updated_by?: string | null;
    updated_at?: string | null;
  }[];
};

type EventPriceDraft = {
  harga_1: string;
  harga_3: string;
  harga_6: string;
  harga_12: string;
};

type SelectedHargaJualRow = {
  kode_barang_variant?: string;
  nama_barang?: string;
  nama_varian?: string;
  kode_varian?: string;
  barcode_varian?: string;
  harga?: Record<string, any>;
  [key: string]: any;
};

type EventImportPreviewRow = {
  no: string;
  barcode: string;
  nama_varian_excel: string;
  harga_1: string;
  harga_3: string;
  harga_6: string;
  harga_12: string;
  status: "valid" | "error";
  message: string;
  matchedRow?: SelectedHargaJualRow;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const API_URL = `${API_BASE}/barang-harga-jual`;
const API_HISTORY = `${API_BASE}/barang-harga-jual/history`;
const API_KASIR_PRICES = `${API_BASE}/barang-harga-jual/kasir-prices`;
const API_KASIR_SYNC = `${API_BASE}/barang-harga-jual/kasir-prices/sync`;
const API_KASIR_SYNC_ALL = `${API_BASE}/barang-harga-jual/kasir-prices/sync-all`;
const API_SUMMARY = `${API_BASE}/barang-harga-jual/summary`;
const API_COVERAGE = `${API_BASE}/barang-harga-jual/coverage`;
const KELAS_FILTER_OPTIONS = [
  { label: "Semua kelas", value: "semua" },
  { label: "Kelas Harga Offline", value: "OFFLINE" },
  { label: "Kelas Harga Gwen App", value: "GWEN_APP" },
  { label: "Kelas Harga Shopee", value: "SHOPEE" },
  { label: "Kelas Harga Tiktokshop", value: "TIKTOKSHOP" },
];

export default function MasterHargaJualPage() {
  const [items, setItems] = useState<HargaJual[]>([]);
  const [search, setSearch] = useState("");
  const [kelasFilter, setKelasFilter] = useState("OFFLINE");
  const [statusFilter, setStatusFilter] = useState("aktif");
  const [merkFilter, setMerkFilter] = useState("semua");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<HargaJual | null>(null);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [kasirPrices, setKasirPrices] = useState<KasirPriceResult[]>([]);
  const [kasirLoading, setKasirLoading] = useState(false);
  const [kasirError, setKasirError] = useState<string | null>(null);
  const [syncingKasir, setSyncingKasir] = useState<Record<string, boolean>>({});
  const [roleName, setRoleName] = useState<string | null>(null);
  const roleLower = String(roleName || "").toLowerCase();
  const canLiveEdit = roleLower === "super_admin";
  const [liveEdit, setLiveEdit] = useState(false);
  const [savingCell, setSavingCell] = useState<Record<string, boolean>>({});
  const [bulkHetSaving, setBulkHetSaving] = useState(false);
  const [bulkHetPercent, setBulkHetPercent] = useState(120);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showHetBelowOfflineOnly, setShowHetBelowOfflineOnly] = useState(false);
  const [showHargaBelowBuyOnly, setShowHargaBelowBuyOnly] = useState(false);
  const [summary, setSummary] = useState<{
    kelas1_active_count: number;
    varian_with_harga: number;
    total_varian: number;
    total_pengadaan_varian: number;
    pengadaan_varian_with_harga: number;
  } | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printLayout, setPrintLayout] = useState<"single" | "double">("single");
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [selectedRowsByVariant, setSelectedRowsByVariant] = useState<Record<string, SelectedHargaJualRow>>({});
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventPriceDrafts, setEventPriceDrafts] = useState<Record<string, EventPriceDraft>>({});
  const [eventSaving, setEventSaving] = useState(false);
  const [eventImportRows, setEventImportRows] = useState<EventImportPreviewRow[]>([]);
  const [eventImportLoading, setEventImportLoading] = useState(false);
  const [eventImportFileName, setEventImportFileName] = useState("");
  const [eventImportProgress, setEventImportProgress] = useState({ processed: 0, total: 0 });
  const [eventSaveProgress, setEventSaveProgress] = useState({
    processed: 0,
    total: 0,
    percent: 0,
    currentItem: "",
    message: "",
  });
  const [restoringEvent, setRestoringEvent] = useState(false);
  const [restoreEventModalOpen, setRestoreEventModalOpen] = useState(false);
  const [kasirSyncModalOpen, setKasirSyncModalOpen] = useState(false);
  const [kasirSyncRunning, setKasirSyncRunning] = useState(false);
  const [kasirSyncResults, setKasirSyncResults] = useState<{
    label: string;
    database: string;
    status: "pending" | "running" | "success" | "error";
    message?: string;
    count?: number;
    processed?: number;
    total?: number;
    currentItem?: string;
    currentBarcode?: string | null;
  }[]>([]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [hargaEvents, setHargaEvents] = useState<any[]>([]);

  const fetchData = useCallback(async (channelCode = kelasFilter) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (channelCode && channelCode !== "semua") {
        params.set("channel_code", channelCode);
      }
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter && statusFilter !== "semua") params.set("status", statusFilter);
      if (merkFilter && merkFilter !== "semua") params.set("merk", merkFilter);
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      const url = params.toString() ? `${API_URL}?${params.toString()}` : API_URL;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const total = Array.isArray(data) && data.length ? Number(data[0]?.total_count ?? data.length) : Number(data?.total ?? rows.length);
      setItems(
        rows.map((row: any) => {
          const { total_count: _totalCount, ...rest } = row;
          void _totalCount;
          return rest;
        }) as HargaJual[]
      );
      setTotalItems(Number.isFinite(total) ? total : rows.length);
    } catch (err) {
      console.error("Failed fetch harga jual", err);
      setError("Gagal memuat harga jual dari server.");
      setItems([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [kelasFilter, merkFilter, page, pageSize, search, statusFilter]);

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

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch(API_SUMMARY);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSummary({
          kelas1_active_count: Number(data?.kelas1_active_count ?? 0),
          varian_with_harga: Number(data?.varian_with_harga ?? 0),
          total_varian: Number(data?.total_varian ?? 0),
          total_pengadaan_varian: Number(data?.total_pengadaan_varian ?? 0),
          pengadaan_varian_with_harga: Number(data?.pengadaan_varian_with_harga ?? 0),
        });
      } catch (err) {
        console.error("Failed fetch harga jual summary", err);
        setSummary(null);
      }
    };
    fetchSummary();
    const fetchHargaEvents = async () => {
      try {
        const res = await fetch(`${API_URL}/events`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setHargaEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed fetch harga events", err);
        setHargaEvents([]);
      }
    };
    fetchHargaEvents();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const parseNumberInput = (val: string) => {
    const cleaned = val.replace(/[^\d.-]/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  const handleLiveEditSave = async (payload: Record<string, any>, key: string) => {
    setSavingCell((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`${API_URL}/live-edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updated_by: "Admin",
          ...payload,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
      Swal.fire({
        icon: "success",
        title: "Berhasil update",
        toast: true,
        position: "top-end",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Failed live edit harga jual", err);
      alert("Gagal menyimpan perubahan.");
    } finally {
      setSavingCell((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleToggleChannelStatus = async (channel: string) => {
    if (!canLiveEdit) return;
    const key = `header-status-${channel}`;
    const targets = pagedRows
      .map((row) => {
        const h = row.harga[channel];
        if (!h?.id_kelas_harga) return null;
        return {
          kode_barang_variant: row.kode_barang_variant,
          id_kelas_harga: h.id_kelas_harga,
          isActive: Number(h.isActive ?? 0),
        };
      })
      .filter(Boolean) as { kode_barang_variant: string; id_kelas_harga: number; isActive: number }[];

    if (!targets.length) return;

    const nextStatus = targets.some((target) => target.isActive !== 1) ? 1 : 0;
    setSavingCell((prev) => ({ ...prev, [key]: true }));
    try {
      for (const target of targets) {
        const res = await fetch(`${API_URL}/live-edit`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kode_barang_variant: target.kode_barang_variant,
            id_kelas_harga: target.id_kelas_harga,
            is_active: nextStatus,
            updated_by: getUsername(),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      await fetchData();
      Swal.fire({
        icon: "success",
        title: "Status harga diperbarui",
        toast: true,
        position: "top-end",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Failed toggle harga jual status", err);
      alert("Gagal mengubah status harga.");
    } finally {
      setSavingCell((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleEditNamaVarian = async (row: any) => {
    const current = row.nama_varian || row.kode_varian || "";
    const result = await Swal.fire({
      title: "Ubah Nama Varian",
      input: "text",
      inputValue: current,
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
    });
    if (!result.isConfirmed) return;
    const next = String(result.value || "").trim();
    if (!next) {
      Swal.fire({ icon: "warning", title: "Nama varian tidak boleh kosong" });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/barang/varian/nama`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_barang_variant: row.kode_barang_variant,
          nama_varian: next,
          updated_by: getUsername(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
      Swal.fire({
        icon: "success",
        title: "Nama varian diperbarui",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Gagal update nama varian" });
    }
  };

  const handleBulkHetPercent = async () => {
    if (bulkHetSaving) return;
    if (selectedVariants.size === 0) {
      Swal.fire({ icon: "warning", title: "Pilih item dulu", text: "Checklist item yang ingin diupdate HET." });
      return;
    }
    const percent = Number(bulkHetPercent);
    if (!Number.isFinite(percent) || percent <= 0) {
      Swal.fire({ icon: "warning", title: "Persentase tidak valid" });
      return;
    }
    const confirm = await Swal.fire({
      icon: "question",
      title: `Set HET ${percent}% dari harga beli?`,
      text: "Hanya item yang diceklist akan diupdate.",
      showCancelButton: true,
      confirmButtonText: "Ya, update",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;

    setBulkHetSaving(true);
    try {
      const payloads = displayedRows
        .filter((row) => selectedVariants.has(normalizeKey(row.kode_barang_variant)))
        .filter((row) => Number(row.harga_beli ?? 0) > 0)
        .map((row) => ({
          kode_barang_variant: row.kode_barang_variant,
          het_sat_1: Math.round(Number(row.harga_beli ?? 0) * (percent / 100)),
          updated_by: "Admin",
        }));

      if (!payloads.length) {
        Swal.fire({ icon: "warning", title: "Tidak ada item yang bisa diupdate" });
        return;
      }

      let done = 0;
      Swal.fire({
        title: "Mengupdate HET...",
        html: `<div class="text-sm text-gray-600">0/${payloads.length} item</div>`,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      for (const payload of payloads) {
        const res = await fetch(`${API_URL}/live-edit`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        done += 1;
        Swal.update({
          html: `<div class="text-sm text-gray-600">${done}/${payloads.length} item</div>`,
        });
      }

      await fetchData();
      Swal.fire({
        icon: "success",
        title: "HET diperbarui",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Failed bulk update HET", err);
      Swal.fire({ icon: "error", title: "Gagal update HET" });
    } finally {
      setBulkHetSaving(false);
    }
  };

  const fetchKasirPricesForRow = async (row: HargaJual) => {
    setKasirLoading(true);
    setKasirError(null);
    try {
      const kasirParams = new URLSearchParams({
        kode_barang_variant: row.kode_barang_variant || "",
      });
      if (row.barcode_varian) kasirParams.set("barcode_varian", row.barcode_varian);
      const kasirRes = await fetch(`${API_KASIR_PRICES}?${kasirParams.toString()}`);
      if (!kasirRes.ok) throw new Error(`HTTP ${kasirRes.status}`);
      const kasirData = await kasirRes.json();
      setKasirPrices(Array.isArray(kasirData) ? kasirData : []);
    } catch (err) {
      console.error("Failed fetch harga kasir", err);
      setKasirError("Gagal memuat harga dari database kasir.");
    } finally {
      setKasirLoading(false);
    }
  };

  const isKasirPriceDifferent = (kasir: KasirPriceResult) => {
    if (kasir.status !== "ok") return false;
    const centralHarga = ((detailRow as any)?.harga || {}) as Record<
      string,
      { isActive?: number; h1?: number | null; h3?: number | null; h6?: number | null; h12?: number | null }
    >;
    const channels = Object.keys(centralHarga);
    if (!channels.length) return false;
    const kasirByChannel = new Map(kasir.rows.map((row) => [String(row.channel_code || "").toUpperCase(), row]));
    return channels.some((channel) => {
      const central = centralHarga[channel];
      const kasirRow = kasirByChannel.get(channel.toUpperCase());
      if (!kasirRow) return true;
      return (
        Number(central.isActive ?? 0) !== Number(kasirRow.is_active ?? 0) ||
        toComparableNumber(central.h1) !== toComparableNumber(kasirRow.harga_1) ||
        toComparableNumber(central.h3) !== toComparableNumber(kasirRow.harga_3) ||
        toComparableNumber(central.h6) !== toComparableNumber(kasirRow.harga_6) ||
        toComparableNumber(central.h12) !== toComparableNumber(kasirRow.harga_12)
      );
    });
  };

  const handleSyncKasirPrice = async (kasir: KasirPriceResult) => {
    if (!detailRow?.kode_barang_variant) return;
    const confirm = await Swal.fire({
      icon: "question",
      title: `Sinkron harga ke ${kasir.label}?`,
      text: "Harga dan status aktif di kasir ini akan disamakan dengan data pusat.",
      showCancelButton: true,
      confirmButtonText: "Sinkron",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;

    setSyncingKasir((prev) => ({ ...prev, [kasir.database]: true }));
    try {
      const res = await fetch(API_KASIR_SYNC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_barang_variant: detailRow.kode_barang_variant,
          database: kasir.database,
          updated_by: getUsername(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      await fetchKasirPricesForRow(detailRow);
      Swal.fire({
        icon: "success",
        title: "Harga kasir tersinkron",
        toast: true,
        position: "top-end",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Failed sync harga kasir", err);
      Swal.fire({ icon: "error", title: "Gagal sinkron harga kasir" });
    } finally {
      setSyncingKasir((prev) => ({ ...prev, [kasir.database]: false }));
    }
  };

  const openDetail = async (row: any) => {
    setDetailRow(row as HargaJual);
    setDetailOpen(true);
    setHistoryItems([]);
    setHistoryError(null);
    setKasirPrices([]);
    setKasirError(null);
    if (!row.kode_barang_variant) return;

    fetchKasirPricesForRow(row);

    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        kode_barang_variant: row.kode_barang_variant,
      });
      if (row.id_kelas_harga) params.set("id_kelas_harga", String(row.id_kelas_harga));
      const res = await fetch(`${API_HISTORY}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed fetch history harga jual", err);
      setHistoryError("Gagal memuat history harga jual.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const kelasOptions = KELAS_FILTER_OPTIONS;

  const merkOptions = useMemo(() => {
    const uniq = new Map<string, string>();
    items.forEach((i) => {
      const key = String(i.kode_merk || "").trim();
      if (!key) return;
      const label = i.nama_merk || key;
      uniq.set(key, label);
    });
    return Array.from(uniq.entries()).map(([value, label]) => ({ value, label }));
  }, [items]);

  const filteredItems = useMemo(() => {
    const keyword = search.toLowerCase();
    return items.filter((item) => {
      const barcode = String(item.barcode_varian ?? "").toLowerCase();
      const namaVarian = String(item.nama_varian ?? item.kode_varian ?? "").toLowerCase();
      const matchText = !keyword || barcode.includes(keyword) || namaVarian.includes(keyword);
      const matchKelas = kelasFilter === "semua" || item.channel_code === kelasFilter;
      const matchStatus =
        statusFilter === "semua" ||
        (statusFilter === "aktif" ? item.is_active === 1 : item.is_active !== 1);
      const matchMerk = merkFilter === "semua" || String(item.kode_merk || "").trim() === merkFilter;
      return matchText && matchKelas && matchStatus && matchMerk;
    });
  }, [items, search, kelasFilter, statusFilter, merkFilter]);

  const totalAktif = items.filter((item) => item.is_active === 1).length;

  const formatRatio = (value: number, total: number) => `${value} / ${total}`;
  const formatPercent = (value: number, total: number) => {
    if (!total) return "0%";
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  const normalizeKey = (value: unknown) => String(value ?? "").trim();
  const groupHargaRows = useCallback((sourceItems: HargaJual[]) => {
    const map = new Map<
      string,
      SelectedHargaJualRow & {
        harga: Record<string, { id_kelas_harga: number; isActive: number; h1: number; h3: number; h6: number; h12: number }>;
      }
    >();

    sourceItems.forEach((it) => {
      const key = String(it.kode_barang_variant || it.kode_varian || it.id);
      if (!map.has(key)) {
        map.set(key, {
          kode_barang_variant: key,
          nama_barang: it.nama_barang,
          kode_barang: it.kode_barang,
          nama_varian: it.nama_varian,
          kode_varian: it.kode_varian,
          barcode_varian: it.barcode_varian,
          kode_merk: it.kode_merk,
          nama_merk: it.nama_merk,
          harga_beli: it.harga_beli_sat_1,
          het: it.het_sat_1,
          hpp: it.hpp_avg_sat_1,
          stok_gudang: it.stok_gudang ?? 0,
          stok_toko: it.stok_toko ?? 0,
          status_barang: it.status_barang,
          status_varian: it.status_varian,
          harga: {},
        });
      }
      const entry = map.get(key)!;
      const channel = it.channel_code || "N/A";
      entry.harga[channel] = {
        id_kelas_harga: it.id_kelas_harga,
        isActive: Number(it.is_active ?? 0),
        h1: it.harga_1,
        h3: it.harga_3,
        h6: it.harga_6,
        h12: it.harga_12,
      };
      if (channel === "OFFLINE") {
        entry.status_pengajuan = it.last_request_status ?? entry.status_pengajuan ?? null;
      } else if (entry.status_pengajuan === undefined) {
        entry.status_pengajuan = it.last_request_status ?? null;
      }
      if (!entry.barcode_varian && it.barcode_varian) {
        entry.barcode_varian = it.barcode_varian;
      }
      entry.status_barang = entry.status_barang === 1 && it.status_barang === 1 ? 1 : it.status_barang ?? entry.status_barang;
      entry.status_varian = entry.status_varian === 1 && it.status_varian === 1 ? 1 : it.status_varian ?? entry.status_varian;
    });

    return Array.from(map.values());
  }, []);
  const selectedRows = useMemo(() => Object.values(selectedRowsByVariant), [selectedRowsByVariant]);
  const selectedCount = selectedRows.length;
  const eventImportValidCount = eventImportRows.filter((row) => row.status === "valid").length;
  const eventImportErrorCount = eventImportRows.filter((row) => row.status === "error").length;
  const eventImportNotFoundRows = eventImportRows.filter((row) => row.message.toLowerCase().includes("tidak ditemukan"));
  const eventImportProgressPercent = eventImportProgress.total
    ? Math.round((eventImportProgress.processed / eventImportProgress.total) * 100)
    : 0;

  const toggleAllSelected = (checked: boolean) => {
    const visibleRows = pagedRows
      .map((row) => ({ key: normalizeKey(row.kode_barang_variant), row }))
      .filter((item) => item.key);

    setSelectedVariants((prev) => {
      const next = new Set(prev);
      visibleRows.forEach(({ key }) => {
        if (checked) next.add(key);
        else next.delete(key);
      });
      return next;
    });

    setSelectedRowsByVariant((prev) => {
      const next = { ...prev };
      visibleRows.forEach(({ key, row }) => {
        if (checked) next[key] = row;
        else delete next[key];
      });
      return next;
    });
  };

  const toggleSelected = (row: SelectedHargaJualRow, checked: boolean) => {
    const key = normalizeKey(row.kode_barang_variant);
    if (!key) return;
    setSelectedVariants((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
    setSelectedRowsByVariant((prev) => {
      const next = { ...prev };
      if (checked) next[key] = row;
      else delete next[key];
      return next;
    });
  };

  const openHargaEventModal = () => {
    const drafts: Record<string, EventPriceDraft> = {};
    setEventImportRows([]);
    setEventImportFileName("");
    setEventImportProgress({ processed: 0, total: 0 });
    setEventSaveProgress({ processed: 0, total: 0, percent: 0, currentItem: "", message: "" });
    selectedRows
      .forEach((row) => {
        const harga = row.harga?.OFFLINE;
        const key = normalizeKey(row.kode_barang_variant);
        drafts[key] = {
          harga_1: harga?.h1 == null ? "" : String(harga.h1),
          harga_3: harga?.h3 == null ? "" : String(harga.h3),
          harga_6: harga?.h6 == null ? "" : String(harga.h6),
          harga_12: harga?.h12 == null ? "" : String(harga.h12),
        };
      });
    setEventPriceDrafts(drafts);
    setEventModalOpen(true);
  };

  const parseEventImportPrice = (value: unknown) => {
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value < 0) return null;
      return Math.round(value > 0 && value < 1000 ? value * 1000 : value);
    }
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const normalized = raw.replace(/rp/gi, "").replace(/\s/g, "");
    let numericText = normalized;
    const hasComma = normalized.includes(",");
    const hasDot = normalized.includes(".");
    if (hasComma && hasDot) {
      numericText = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
    } else if (hasComma) {
      numericText = normalized.replace(/\./g, "").replace(",", ".");
    } else if (hasDot) {
      const parts = normalized.split(".");
      numericText = parts.at(-1)?.length === 3 ? normalized.replace(/\./g, "") : normalized;
    }
    const parsed = Number(numericText.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed > 0 && parsed < 1000 ? parsed * 1000 : parsed);
  };

  const normalizeExcelHeader = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const pickExcelCell = (row: unknown[], headerMap: Record<string, number>, names: string[], fallbackIndex: number) => {
    const index = names.map((name) => headerMap[name]).find((idx) => idx !== undefined);
    return row[index ?? fallbackIndex];
  };

  const fetchHargaRowByBarcode = async (barcode: string) => {
    const params = new URLSearchParams({
      channel_code: "OFFLINE",
      status: "aktif",
      search: barcode,
      page: "1",
      page_size: "20",
    });
    const res = await fetch(`${API_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rows = (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []) as HargaJual[];
    const exactRows = rows.filter((row) => normalizeKey(row.barcode_varian) === barcode);
    const groupedRows = groupHargaRows(exactRows.length ? exactRows : rows);
    return groupedRows.find((row) => normalizeKey(row.barcode_varian) === barcode) || null;
  };

  const handleImportHargaEventExcel = async (file: File) => {
    setEventImportLoading(true);
    setEventImportFileName(file.name);
    setEventImportRows([]);
    setEventImportProgress({ processed: 0, total: 0 });
    try {
      const XLSXModule = await import("xlsx");
      const XLSX = (XLSXModule as any).default ?? XLSXModule;
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const sheetRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false }) as unknown[][];
      const nonEmptyRows = sheetRows.filter((row) => row.some((cell) => String(cell ?? "").trim()));
      if (nonEmptyRows.length < 2) {
        setEventImportRows([]);
        Swal.fire({ icon: "warning", title: "Excel kosong", text: "Pastikan file berisi header dan minimal satu baris data." });
        return;
      }

      const headerRow = nonEmptyRows[0];
      const headerMap = headerRow.reduce<Record<string, number>>((acc, cell, index) => {
        const key = normalizeExcelHeader(cell);
        if (key) acc[key] = index;
        return acc;
      }, {});
      const barcodeHeaders = ["barcode", "barcodevarian", "kodebarcode"];
      const priceHeaders = {
        harga_1: ["harga1pcs", "harga1pc", "harga1", "1pcs", "1pc"],
        harga_3: ["harga3pcs", "harga3pc", "harga3", "3pcs", "3pc"],
        harga_6: ["harga6pcs", "harga6pc", "harga6", "6pcs", "6pc"],
        harga_12: ["harga12pcs", "harga12pc", "harga12", "12pcs", "12pc"],
      };

      const parsedRows = nonEmptyRows.slice(1).map((row, index) => {
        const barcode = normalizeKey(pickExcelCell(row, headerMap, barcodeHeaders, 1));
        const namaVarianExcel = normalizeKey(pickExcelCell(row, headerMap, ["namavarian", "varian", "namaitem", "item"], 2));
        const harga1 = parseEventImportPrice(pickExcelCell(row, headerMap, priceHeaders.harga_1, 3));
        const harga3 = parseEventImportPrice(pickExcelCell(row, headerMap, priceHeaders.harga_3, 4));
        const harga6 = parseEventImportPrice(pickExcelCell(row, headerMap, priceHeaders.harga_6, 5));
        const harga12 = parseEventImportPrice(pickExcelCell(row, headerMap, priceHeaders.harga_12, 6));
        return {
          no: String(pickExcelCell(row, headerMap, ["no", "nomor"], 0) || index + 1),
          barcode,
          nama_varian_excel: namaVarianExcel,
          harga_1: harga1 == null ? "" : String(harga1),
          harga_3: harga3 == null ? "" : String(harga3),
          harga_6: harga6 == null ? "" : String(harga6),
          harga_12: harga12 == null ? "" : String(harga12),
          invalidPrice: harga1 == null,
        };
      }).filter((row) => row.barcode || row.nama_varian_excel || row.harga_1 || row.harga_3 || row.harga_6 || row.harga_12);

      const previewRows: EventImportPreviewRow[] = [];
      const seenBarcode = new Set<string>();
      setEventImportProgress({ processed: 0, total: parsedRows.length });
      for (const row of parsedRows) {
        if (!row.barcode) {
          previewRows.push({ ...row, status: "error", message: "Barcode kosong" });
          setEventImportProgress((prev) => ({ ...prev, processed: prev.processed + 1 }));
          continue;
        }
        if (seenBarcode.has(row.barcode)) {
          previewRows.push({ ...row, status: "error", message: "Barcode duplikat di Excel" });
          setEventImportProgress((prev) => ({ ...prev, processed: prev.processed + 1 }));
          continue;
        }
        seenBarcode.add(row.barcode);
        if (row.invalidPrice) {
          previewRows.push({ ...row, status: "error", message: "Harga 1 PCS wajib angka" });
          setEventImportProgress((prev) => ({ ...prev, processed: prev.processed + 1 }));
          continue;
        }
        try {
          const matchedRow = await fetchHargaRowByBarcode(row.barcode);
          if (!matchedRow?.harga?.OFFLINE?.id_kelas_harga) {
            previewRows.push({ ...row, status: "error", message: "Barcode tidak ditemukan di harga OFFLINE" });
            setEventImportProgress((prev) => ({ ...prev, processed: prev.processed + 1 }));
            continue;
          }
          previewRows.push({ ...row, status: "valid", message: "Siap diterapkan", matchedRow });
        } catch (err) {
          previewRows.push({ ...row, status: "error", message: err instanceof Error ? err.message : "Gagal cek barcode" });
        }
        setEventImportProgress((prev) => ({ ...prev, processed: prev.processed + 1 }));
      }
      setEventImportRows(previewRows);
    } catch (err) {
      console.error("Failed import harga event excel", err);
      Swal.fire({ icon: "error", title: "Gagal membaca Excel", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setEventImportLoading(false);
    }
  };

  const handleApplyHargaEventImport = () => {
    const validRows = eventImportRows.filter((row) => row.status === "valid" && row.matchedRow);
    if (!validRows.length) {
      Swal.fire({ icon: "warning", title: "Tidak ada data valid", text: "Upload Excel dan pastikan minimal satu barcode valid." });
      return;
    }
    setSelectedVariants((prev) => {
      const next = new Set(prev);
      validRows.forEach((row) => {
        const key = normalizeKey(row.matchedRow?.kode_barang_variant);
        if (key) next.add(key);
      });
      return next;
    });
    setSelectedRowsByVariant((prev) => {
      const next = { ...prev };
      validRows.forEach((row) => {
        const key = normalizeKey(row.matchedRow?.kode_barang_variant);
        if (key && row.matchedRow) next[key] = row.matchedRow;
      });
      return next;
    });
    setEventPriceDrafts((prev) => {
      const next = { ...prev };
      validRows.forEach((row) => {
        const key = normalizeKey(row.matchedRow?.kode_barang_variant);
        if (!key) return;
        next[key] = {
          harga_1: row.harga_1,
          harga_3: row.harga_3,
          harga_6: row.harga_6,
          harga_12: row.harga_12,
        };
      });
      return next;
    });
    setEventImportRows([]);
    setEventImportFileName("");
    setEventImportProgress({ processed: 0, total: 0 });
    Swal.fire({
      icon: "success",
      title: "Preview diterapkan",
      text: `${validRows.length} item masuk ke draft harga event.`,
      timer: 1400,
      showConfirmButton: false,
    });
  };

  const handleApplyCurrentPriceToEventDraft = (field: keyof EventPriceDraft, normalField: "h3" | "h6" | "h12") => {
    if (!selectedRows.length) {
      Swal.fire({ icon: "warning", title: "Belum ada item", text: "Pilih item atau import Excel dulu." });
      return;
    }
    setEventPriceDrafts((prev) => {
      const next = { ...prev };
      selectedRows.forEach((row) => {
        const key = normalizeKey(row.kode_barang_variant);
        if (!key) return;
        const hargaNormal = row.harga?.OFFLINE?.[normalField];
        next[key] = {
          harga_1: next[key]?.harga_1 ?? "",
          harga_3: next[key]?.harga_3 ?? "",
          harga_6: next[key]?.harga_6 ?? "",
          harga_12: next[key]?.harga_12 ?? "",
          [field]: hargaNormal == null ? "" : String(Math.round(Number(hargaNormal))),
        };
      });
      return next;
    });
  };

  const handleRestoreHargaNormal = async (event: any) => {
    if (!event?.kode_t_harga_event) return;
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Kembalikan harga normal?",
      text: `Event ${event.nama_event} akan dihentikan sekarang.`,
      showCancelButton: true,
      confirmButtonText: "Kembalikan",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;
    setRestoreEventModalOpen(false);
    setRestoringEvent(true);
    try {
      const res = await fetch(`${API_URL}/events/${event.kode_t_harga_event}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      const eventsRes = await fetch(`${API_URL}/events`);
      if (eventsRes.ok) setHargaEvents(await eventsRes.json());
      await Swal.fire("Harga normal dikembalikan", "Harga event sudah dihentikan.", "success");
    } catch (err) {
      Swal.fire("Gagal mengembalikan harga", String(err), "error");
    } finally {
      setRestoringEvent(false);
    }
  };

  const handleSyncAllKasir = async () => {
    const targets = [
      { label: "Kasir 1", database: "db_gwen_kasir1" },
      { label: "Kasir 2", database: "db_gwen_kasir2" },
      { label: "Kasir 3", database: "db_gwen_kasir3" },
    ];
    const confirmed = await Swal.fire({
      icon: "question",
      title: "Sinkron semua harga ke kasir?",
      text: "Harga pusat akan disalin ke seluruh database kasir.",
      showCancelButton: true,
      confirmButtonText: "Mulai Sinkron",
      cancelButtonText: "Batal",
    });
    if (!confirmed.isConfirmed) return;
    setKasirSyncResults(targets.map((target) => ({ ...target, status: "pending" })));
    setKasirSyncModalOpen(true);
    setKasirSyncRunning(true);
    for (const target of targets) {
      setKasirSyncResults((prev) => prev.map((item) => item.database === target.database ? { ...item, status: "running" } : item));
      try {
        const res = await fetch(API_KASIR_SYNC_ALL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ database: target.database, updated_by: getUsername() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        if (!res.body) throw new Error("Server tidak mengirim progress stream");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let processed = 0;
        let total = 0;
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as {
              type?: string;
              message?: string;
              processed?: number;
              total?: number;
              current_item?: string;
              current_barcode?: string | null;
            };
            if (event.type === "kasir_start") {
              total = event.total || 0;
            } else if (event.type === "progress") {
              processed = event.processed || 0;
              total = event.total || total;
              setKasirSyncResults((prev) => prev.map((item) => item.database === target.database ? {
                ...item,
                status: "running",
                processed,
                total,
                currentItem: event.current_item,
                currentBarcode: event.current_barcode,
              } : item));
            } else if (event.type === "merge_start") {
              setKasirSyncResults((prev) => prev.map((item) => item.database === target.database ? {
                ...item,
                currentItem: "Menyimpan perubahan ke database kasir...",
                processed: event.processed || processed,
                total: event.total || total,
              } : item));
            } else if (event.type === "kasir_complete" || event.type === "complete") {
              processed = event.processed || processed;
              total = event.total || total;
            } else if (event.type === "error") {
              throw new Error(event.message || "Gagal sinkron semua harga kasir");
            }
          }
          if (done) break;
        }
        if (buffer.trim()) {
          const event = JSON.parse(buffer) as { type?: string; message?: string };
          if (event.type === "error") throw new Error(event.message || "Gagal sinkron semua harga kasir");
        }
        setKasirSyncResults((prev) => prev.map((item) => item.database === target.database ? {
          ...item,
          status: "success",
          message: "Semua harga kasir tersinkron",
          count: processed,
          processed,
          total,
        } : item));
      } catch (err) {
        setKasirSyncResults((prev) => prev.map((item) => item.database === target.database ? { ...item, status: "error", message: err instanceof Error ? err.message : String(err) } : item));
      }
    }
    setKasirSyncRunning(false);
  };

  const activeKasirSync = kasirSyncResults.find((result) => result.status === "running");
  const completedKasirSync = kasirSyncResults.filter((result) => result.status === "success").length;
  const activeKasirProgress = activeKasirSync && activeKasirSync.total
    ? Math.min(100, ((activeKasirSync.processed || 0) / activeKasirSync.total) * 100)
    : 0;
  const kasirOverallProgress = kasirSyncResults.length
    ? ((completedKasirSync + activeKasirProgress / 100) / kasirSyncResults.length) * 100
    : 0;

  const handleCreateHargaEvent = async () => {
    if (!eventName.trim() || !eventStart || !eventEnd || !selectedRows.length) {
      Swal.fire({ icon: "warning", title: "Data event belum lengkap", text: "Isi nama, periode, dan pilih minimal satu barang." });
      return;
    }
    const eventItems = selectedRows.flatMap((row) => {
      const harga = row.harga?.OFFLINE;
      if (!harga?.id_kelas_harga) return [];
      const draft = eventPriceDrafts[normalizeKey(row.kode_barang_variant)];
      const parsePrice = (value: string | undefined, fallback: number | null | undefined) => {
        if (!value?.trim()) return fallback == null ? null : Number(fallback);
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : NaN;
      };
      const prices = [
        parsePrice(draft?.harga_1, harga.h1),
        parsePrice(draft?.harga_3, harga.h3),
        parsePrice(draft?.harga_6, harga.h6),
        parsePrice(draft?.harga_12, harga.h12),
      ];
      if (prices.some((price) => Number.isNaN(price))) return [];
      return [{
        kode_barang_variant: row.kode_barang_variant,
        id_kelas_harga: harga.id_kelas_harga,
        harga_1: prices[0],
        harga_3: prices[1],
        harga_6: prices[2],
        harga_12: prices[3],
      }];
    });
    if (!eventItems.length) {
      Swal.fire({ icon: "warning", title: "Harga event belum valid", text: "Isi harga event dengan angka nol atau lebih untuk setiap item." });
      return;
    }
    setEventSaving(true);
    setEventSaveProgress({
      processed: 0,
      total: eventItems.length,
      percent: 0,
      currentItem: "",
      message: "Menyiapkan data event",
    });
    try {
      const res = await fetch(`${API_URL}/events?progress=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_event: eventName.trim(),
          berlaku_mulai: new Date(eventStart).toISOString(),
          berlaku_sampai: new Date(eventEnd).toISOString(),
          items: eventItems,
          created_by: localStorage.getItem("username") || "Admin",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("Server tidak mengirim progress simpan");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let savedTotal = eventItems.length;
      let savedCount = 0;
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type?: string;
            message?: string;
            processed?: number;
            total?: number;
            current_item?: string;
            kode_t_harga_event?: string;
            total_item?: number;
          };
          if (event.type === "error") {
            throw new Error(event.message || "Gagal membuat harga event");
          }
          if (event.type === "start" || event.type === "progress" || event.type === "commit" || event.type === "complete") {
            savedTotal = event.total || savedTotal;
            savedCount = event.processed ?? savedCount;
            const percent = savedTotal ? Math.min(100, Math.round((savedCount / savedTotal) * 100)) : 0;
            setEventSaveProgress({
              processed: savedCount,
              total: savedTotal,
              percent: event.type === "complete" ? 100 : percent,
              currentItem: event.current_item || "",
              message: event.message || (event.type === "complete" ? "Selesai" : "Menyimpan data event"),
            });
          }
        }
        if (done) break;
      }
      if (buffer.trim()) {
        const event = JSON.parse(buffer) as { type?: string; message?: string; processed?: number; total?: number; total_item?: number };
        if (event.type === "error") throw new Error(event.message || "Gagal membuat harga event");
        if (event.type === "complete") {
          savedTotal = event.total || savedTotal;
          savedCount = event.processed ?? savedCount;
          setEventSaveProgress((prev) => ({ ...prev, processed: savedCount, total: savedTotal, percent: 100, message: "Selesai" }));
        }
      }
      const eventsRes = await fetch(`${API_URL}/events`);
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setHargaEvents(Array.isArray(eventsData) ? eventsData : []);
      }
      setEventModalOpen(false);
      setSelectedVariants(new Set());
      setSelectedRowsByVariant({});
      await Swal.fire("Harga event dibuat", `${eventItems.length} barang dijadwalkan. SQL Agent akan mengaktifkan otomatis sesuai periode.`, "success");
    } catch (err) {
      Swal.fire("Gagal membuat harga event", String(err), "error");
    } finally {
      setEventSaving(false);
    }
  };

  const handlePrintPriceTag = (layout: "single" | "double") => {
    if (!selectedRows.length) {
      Swal.fire({ icon: "warning", title: "Pilih item dulu", text: "Checklist item yang ingin dicetak." });
      return;
    }

    const buildBarcodeSvg = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return "";
      try {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        JsBarcode(svg, trimmed, {
          format: "CODE128",
          displayValue: false,
          height: 32,
          margin: 0,
        });
        return svg.outerHTML;
      } catch (err) {
        console.error("Failed build barcode svg", err);
        return "";
      }
    };

    const basePayload = selectedRows.map((row) => {
      const offline = row.harga["OFFLINE"];
      const firstHarga = Object.values(row.harga).find((h) => h?.h1 !== undefined && h?.h1 !== null);
      const hargaRef = offline || firstHarga;
      const barcodeValue = row.barcode_varian || "";
      return {
        kode_barang_variant: row.kode_barang_variant,
        nama_barang: row.nama_barang || "",
        nama_varian: row.nama_varian || row.kode_varian || "",
        barcode_svg: buildBarcodeSvg(barcodeValue),
        het: row.het ?? null,
        harga_1: hargaRef?.h1 ?? null,
        harga_3: hargaRef?.h3 ?? null,
        harga_6: hargaRef?.h6 ?? null,
        harga_12: hargaRef?.h12 ?? null,
      };
    });
    const payload = basePayload;
    const isDouble = layout === "double";
    const config = isDouble
      ? {
          backgroundUrl: "/back%20pricetag_2.png",
          tagWidth: "5.75cm",
          tagHeight: "6.5cm",
          gridColumns: "repeat(4, 5.75cm)",
          backgroundSize: "11.5cm 6.5cm",
          backgroundPosition: "left top",
          fontBase: "6px",
          titleSize: "9px",
          promoTop: "72px",
          promoLabelSize: "10px",
          hetSize: "18px",
          pricesFont: "17px",
          pricesMargin: "100px",
          footerMargin: "187px",
          barcodeMinWidth: "135px",
          barcodeWidth: "135px",
          barcodeHeight: "54px",
        }
      : {
          backgroundUrl: "/back%20pricetag.png",
          tagWidth: "11.5cm",
          tagHeight: "6.5cm",
          gridColumns: "repeat(2, 11.5cm)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          fontBase: "12px",
          titleSize: "9px",
          promoTop: "65px",
          promoLabelSize: "16px",
          hetSize: "24px",
          pricesFont: "28px",
          pricesMargin: "110px",
          footerMargin: "195px",
          barcodeMinWidth: "120px",
          barcodeWidth: "120px",
          barcodeHeight: "32px",
        };

    const escapeHtml = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const formatRupiah = (value: number | null) =>
      value === null || value === undefined ? "-" : `Rp ${Number(value).toLocaleString("id-ID")}`;
    const formatNumberOnly = (value: number | null) =>
      value === null || value === undefined ? "-" : Number(value).toLocaleString("id-ID");

    const tagsHtml = payload
      .map(
        (item) => `
        <div class="price-tag">
          ${isDouble ? `<div class="product-name">${escapeHtml((item.nama_barang || "-").toUpperCase())}</div>` : ""}
          <div class="title">${escapeHtml((item.nama_varian || item.nama_barang || "-").toUpperCase())}</div>
          <div class="promo-row">
            <div class="promo-label">Harga PROMO</div>
            <div class="het">${escapeHtml(formatRupiah(item.het))}</div>
          </div>
          <div class="prices">
            <div class="price-item">1 pcs <span>${escapeHtml(formatNumberOnly(item.harga_1))}</span></div>
            <div class="price-item">3 pcs <span>${escapeHtml(formatNumberOnly(item.harga_3))}</span></div>
            <div class="price-item">6 pcs <span>${escapeHtml(formatNumberOnly(item.harga_6))}</span></div>
            <div class="price-item">12 pcs <span>${escapeHtml(formatNumberOnly(item.harga_12))}</span></div>
          </div>
          <div class="footer">
            <div class="barcode-wrap">${item.barcode_svg || ""}</div>
          </div>
        </div>
      `
      )
      .join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Price Tag</title>
          <style>
            body { margin: 0; background: #fff; font-family: Arial, sans-serif; }
            .sheet {
              width: 297mm;
              min-height: 210mm;
              margin: 0;
              display: grid;
              grid-template-columns: ${config.gridColumns};
              gap: 0;
              padding: 2mm 0 0 2mm;
              box-sizing: border-box;
              justify-content: start;
            }
            .price-tag {
              width: ${config.tagWidth};
              height: ${config.tagHeight};
              border: 1px solid #374151;
              border-radius: 4px;
              padding: 8px;
              box-sizing: border-box;
              font-size: ${config.fontBase};
              display: flex;
              flex-direction: column;
              background-image: url("${config.backgroundUrl}");
              background-size: ${config.backgroundSize};
              background-repeat: no-repeat;
              background-position: ${config.backgroundPosition};
              break-inside: avoid;
              page-break-inside: avoid;
              position: relative;
            }
            ${isDouble ? `
            .price-tag:nth-child(odd) { background-position: left top; }
            .price-tag:nth-child(even) { background-position: right top; }
            ` : ""}
            .title {
              font-size: ${isDouble ? "11px" : config.titleSize};
              font-weight: ${isDouble ? 600 : 600};
              color: #111827;
              line-height: 1.1;
              margin-bottom: 4px;
              max-height: calc(${isDouble ? "11px" : config.titleSize} * 2 * 1.1);
              overflow: hidden;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
            }
            .product-name {
              font-size: ${isDouble ? "11px" : "9px"};
              font-weight: ${isDouble ? 700 : 600};
              color: #111827;
              line-height: 1.1;
              margin-bottom: 2px;
              text-transform: uppercase;
              max-height: calc(${isDouble ? "11px" : "12px"} * 2 * 1.1);
              overflow: hidden;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
            }
            .promo-row {
              position: absolute;
              left: 8px;
              right: 8px;
              top: ${config.promoTop};
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-top: 2px;
            }
            .promo-label {
              font-size: ${config.promoLabelSize};
              font-weight: 600;
              color: #111827;
            }
            .het {
              color: #dc2626;
              text-decoration: line-through;
              font-style: italic;
              font-size: ${config.hetSize};
              font-weight: 700;
            }
            .prices {
              display: grid;
              grid-template-columns: ${isDouble ? "1fr" : "repeat(2, 1fr)"};
              gap: 4px 12px;
              font-size: ${config.pricesFont};
              font-weight: 700;
              color: #111827;
              position: absolute;
              margin-top: ${config.pricesMargin};
              margin-left: ${isDouble ? "50px" : "0"};
            }
            .price-item {
              display: grid;
              grid-template-columns: 1fr auto;
              column-gap: 8px;
              align-items: baseline;
            }
            .price-item span {
              text-align: right;
              min-width: 70px;
            }
            .footer {
              margin-top: ${config.footerMargin};
              display: flex;
              align-items: flex-end;
              justify-content: flex-start;
              position: absolute;
            }
            .barcode-wrap {
              padding: 2px 4px;
              min-height: 18px;
              min-width: ${config.barcodeMinWidth};
            }
            .barcode-wrap svg {
              width: ${config.barcodeWidth};
              height: ${config.barcodeHeight};
            }
            @media print {
              body { background: #fff; }
              .sheet { padding: 2mm 0 0 2mm; gap: 0; }
            }
            @page {
              size: A4 landscape;
              margin: 2mm 0 0 2mm;
            }
          </style>
        </head>
        <body>
          <div class="sheet">${tagsHtml}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  const channelList = useMemo(() => {
    const set = new Set<string>();
    filteredItems.forEach((it) => {
      if (it.channel_code) set.add(it.channel_code);
    });
    const baseOrder = ["OFFLINE", "GWEN_APP", "SHOPEE", "TIKTOKSHOP"];
    const rest = Array.from(set).filter((c) => !baseOrder.includes(c)).sort();
    return [...baseOrder.filter((c) => set.has(c)), ...rest];
  }, [filteredItems]);

  const groupedByVarian = useMemo(() => {
    return groupHargaRows(filteredItems);
  }, [filteredItems, groupHargaRows]);

  const isHetBelowOffline = (row: {
    het?: number;
    harga: Record<string, { id_kelas_harga: number; isActive: number; h1: number; h3: number; h6: number; h12: number }>;
  }) => {
    const offlineHarga1 = row.harga["OFFLINE"]?.h1 ?? null;
    return (
      row.het !== null &&
      row.het !== undefined &&
      offlineHarga1 !== null &&
      offlineHarga1 !== undefined &&
      Number(row.het) < Number(offlineHarga1)
    );
  };

  const isHargaJualBelowOrEqualBuy = useCallback((hargaJual: number | null | undefined, hargaBeli: number | null | undefined) => {
    const jual = Number(hargaJual ?? 0);
    const beli = Number(hargaBeli ?? 0);
    return Number.isFinite(jual) && Number.isFinite(beli) && beli > 0 && hargaJual !== null && hargaJual !== undefined && jual <= beli;
  }, []);

  const getHargaCellClass = (
    tone: string,
    hargaJual: number | null | undefined,
    hargaBeli: number | null | undefined,
    extra = ""
  ) =>
    isHargaJualBelowOrEqualBuy(hargaJual, hargaBeli)
      ? `px-2 py-3 text-center font-semibold border border-rose-300 bg-rose-100 text-rose-900 ${extra}`
      : `px-2 py-3 text-center text-gray-900 font-semibold border border-gray-200 ${tone} ${extra}`;

  const hasHargaJualBelowOrEqualBuy = useCallback((row: {
    harga_beli?: number;
    harga: Record<string, { h1?: number | null; h3?: number | null; h6?: number | null; h12?: number | null }>;
  }) =>
    Object.values(row.harga || {}).some((harga) =>
      [harga?.h1, harga?.h3, harga?.h6, harga?.h12].some((value) =>
        isHargaJualBelowOrEqualBuy(value, row.harga_beli)
      )
    ), [isHargaJualBelowOrEqualBuy]);

  const displayedRows = useMemo(() => {
    return groupedByVarian.filter((row) => {
      if (showHetBelowOfflineOnly && !isHetBelowOffline(row)) return false;
      if (showHargaBelowBuyOnly && !hasHargaJualBelowOrEqualBuy(row)) return false;
      return true;
    });
  }, [groupedByVarian, showHetBelowOfflineOnly, showHargaBelowBuyOnly, hasHargaJualBelowOrEqualBuy]);

  const activeHargaEvent = hargaEvents.find((event) => event.status === "ACTIVE");
  const activeHargaEvents = hargaEvents.filter((event) => event.status === "ACTIVE");
  const scheduledHargaEvent = hargaEvents.find((event) => event.status === "SCHEDULED");
  const activeEventVariants = new Set(
    (activeHargaEvent?.items || []).map((item: any) => normalizeKey(item.kode_barang_variant))
  );

  const getSortValue = (row: any, key: string) => {
    if (key.startsWith("price:")) {
      const [, channel, tier] = key.split(":");
      return Number(row.harga?.[channel]?.[tier] ?? 0);
    }
    switch (key) {
      case "nama_barang":
        return String(row.nama_barang ?? "");
      case "nama_merk":
        return String(row.nama_merk ?? "");
      case "barcode_varian":
        return String(row.barcode_varian ?? "");
      case "nama_varian":
        return String(row.nama_varian ?? row.kode_varian ?? "");
      case "status":
        return row.status_barang === 1 && row.status_varian === 1 ? 1 : 0;
      case "harga_beli":
        return Number(row.harga_beli ?? 0);
      case "het":
        return Number(row.het ?? 0);
      case "hpp":
        return Number(row.hpp ?? 0);
      case "stok_gudang":
        return Number(row.stok_gudang ?? 0);
      case "stok_toko":
        return Number(row.stok_toko ?? 0);
      default:
        return String(row[key] ?? "");
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return displayedRows;
    const sorted = [...displayedRows];
    sorted.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb));
      }
      return Number(va) - Number(vb);
    });
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [displayedRows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pagedRows = useMemo(() => {
    return sortedRows;
  }, [sortedRows]);
  const rangeStart = totalItems ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, totalItems);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, kelasFilter, statusFilter, merkFilter, showHetBelowOfflineOnly, showHargaBelowBuyOnly, pageSize]);

  useEffect(() => {
    if (!pagedRows.length || !selectedVariants.size) return;
    setSelectedRowsByVariant((prev) => {
      let changed = false;
      const next = { ...prev };
      pagedRows.forEach((row) => {
        const key = normalizeKey(row.kode_barang_variant);
        if (key && selectedVariants.has(key)) {
          next[key] = row;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [pagedRows, selectedVariants]);

  const handleOpenPrintModal = () => {
    if (!selectedRows.length) {
      Swal.fire({ icon: "warning", title: "Pilih item dulu", text: "Checklist item yang ingin dicetak." });
      return;
    }
    const hasYellow = selectedRows.some((row) => isHetBelowOffline(row));
    if (hasYellow) {
      Swal.fire({
        icon: "warning",
        title: "Ada HET di bawah harga offline",
        text: "Perbaiki dulu baris kuning sebelum cetak price tag.",
      });
      return;
    }
    setPrintModalOpen(true);
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const sortIndicator = (key: string) => {
    if (sortKey !== key) return "↕";
    return sortDir === "asc" ? "▲" : "▼";
  };

  const handleExportExcel = async () => {
    const headers = [
      "No",
      "Nama Barang",
      "Nama Varian",
      "Barcode",
      "Merk",
      "Harga Beli",
      "Harga 1 (Offline)",
      "Harga 3 (Offline)",
      "Harga 6 (Offline)",
      "Harga 12 (Offline)",
      "Status Pengajuan",
    ];
    try {
      const res = await fetch(API_COVERAGE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const coverageRows = Array.isArray(data) ? data : [];
      const inStockRows = coverageRows.filter((row: any) => {
        const stokGudang = Number(row.stok_gudang ?? 0);
        const stokToko = Number(row.stok_toko ?? 0);
        return stokGudang > 0 || stokToko > 0;
      });

      const mapByVarian = new Map(
        groupedByVarian.map((row) => [String(row.kode_barang_variant), row])
      );

      const rows = inStockRows.map((row: any, idx: number) => {
        const key = String(row.kode_barang_variant || "");
        const match = mapByVarian.get(key);
        const offline = match?.harga?.["OFFLINE"];
        const statusPengajuan =
          Number(row.last_request_status ?? match?.status_pengajuan ?? -1) === 1
            ? "Approved"
            : Number(row.last_request_status ?? match?.status_pengajuan ?? -1) === 2
              ? "Rejected"
              : Number(row.last_request_status ?? match?.status_pengajuan ?? -1) === 0
                ? "Pending"
                : "Belum diajukan";
        const namaBarang = match?.nama_barang || row.nama_barang || "";
        const namaVarian = match?.nama_varian || row.nama_varian || "";
        const barcode = match?.barcode_varian || row.barcode_varian || "";
        const merk = match?.nama_merk || match?.kode_merk || row.nama_merk || "";
        const hargaBeli = match?.harga_beli ?? row.harga_beli_sat_1 ?? "";
        return [
          idx + 1,
          namaBarang,
          namaVarian,
          barcode,
          merk,
          hargaBeli,
          offline?.h1 ?? "",
          offline?.h3 ?? "",
          offline?.h6 ?? "",
          offline?.h12 ?? "",
          statusPengajuan,
        ];
      });

      const escapeCsv = (val: string | number) => `"${String(val ?? "").replace(/\"/g, '""')}"`;
      const lines = [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))];
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `harga-jual-pengadaan-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed export harga jual", err);
      alert("Gagal export data.");
    }
  };

  const handleDownloadCoverage = async (scope: "varian" | "pengadaan") => {
    try {
      const res = await fetch(API_COVERAGE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rawRows = Array.isArray(data) ? data : [];
      const rows =
        scope === "pengadaan"
          ? rawRows.filter((row: any) => Number(row.ada_di_pengadaan ?? 0) === 1)
          : rawRows;
      const headers = [
        "Kode Barang Variant",
        "Kode Barang",
        "Nama Barang",
        "Nama Varian",
        "Status Varian",
        "Sudah Setting Harga",
        "Ada di Pengadaan",
      ];
      const lines = [
        headers.join(","),
        ...rows.map((row: any) => {
          const statusVarian = Number(row.status_varian ?? 0) === 1 ? "Aktif" : "Nonaktif";
          const sudahHarga = Number(row.sudah_setting_harga ?? 0) === 1 ? "Ya" : "Tidak";
          const adaPengadaan = Number(row.ada_di_pengadaan ?? 0) === 1 ? "Ya" : "Tidak";
          const values = [
            row.kode_barang_variant || "",
            row.kode_barang || "",
            row.nama_barang || "",
            row.nama_varian || "",
            statusVarian,
            sudahHarga,
            adaPengadaan,
          ];
          const escapeCsv = (val: string | number) => `"${String(val ?? "").replace(/\"/g, '""')}"`;
          return values.map(escapeCsv).join(",");
        }),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `harga-jual-coverage-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed download coverage", err);
      alert("Gagal download data coverage.");
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Harga Jual</h1>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-semibold">
            {activeHargaEvent ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {activeEventVariants.size} item event aktif
                </span>
                <span className="text-amber-700">{activeHargaEvent.nama_event}</span>
              </>
            ) : null}
            {scheduledHargaEvent ? (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">
                Event berikutnya: {scheduledHargaEvent.nama_event}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-stretch gap-2 lg:max-w-[calc(100%-320px)]">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleSyncAllKasir}
              disabled={kasirSyncRunning}
              className="inline-flex items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-800 shadow-sm hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {kasirSyncRunning ? "Sinkronisasi..." : "Sinkron ke Kasir"}
            </button>
            <button
              type="button"
              onClick={() => setActionsOpen((open) => !open)}
              className="inline-flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              aria-expanded={actionsOpen}
            >
              Aksi & Navigasi
              <ChevronDown className={`h-4 w-4 transition-transform ${actionsOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
          {actionsOpen && <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold shadow-sm hover:bg-gray-50 transition-all"
          >
            Export Excel
          </button>
          <div className="ml-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-sm text-gray-600 font-semibold">HET %</span>
            <input
              type="number"
              min={1}
              value={bulkHetPercent}
              onChange={(e) => setBulkHetPercent(Number(e.target.value))}
              className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700"
            />
          </div>
          <button
            type="button"
            onClick={handleBulkHetPercent}
            disabled={bulkHetSaving}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold shadow-sm hover:bg-gray-50 transition-all disabled:opacity-60"
          >
            {bulkHetSaving ? "Mengupdate HET..." : `Set HET ${bulkHetPercent}%`}
          </button>
          <button
            type="button"
            onClick={handleOpenPrintModal}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold shadow-sm hover:bg-gray-50 transition-all"
          >
            Cetak Price Tag
          </button>
          <button
            type="button"
            onClick={() => setShowHetBelowOfflineOnly((prev) => !prev)}
            className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border font-semibold shadow-sm transition-all ${
              showHetBelowOfflineOnly
                ? "border-yellow-400 bg-yellow-300 text-gray-900 hover:bg-yellow-400"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {showHetBelowOfflineOnly ? "Tampilkan Semua" : "HET < Offline"}
          </button>
          <button
            type="button"
            onClick={() => setShowHargaBelowBuyOnly((prev) => !prev)}
            className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border font-semibold shadow-sm transition-all ${
              showHargaBelowBuyOnly
                ? "border-rose-300 bg-rose-100 text-rose-900 hover:bg-rose-200"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {showHargaBelowBuyOnly ? "Tampilkan Semua" : "Harga <= Beli"}
          </button>
          {canLiveEdit && (
            <button
              type="button"
              onClick={() => setLiveEdit((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border font-semibold shadow-sm transition-all ${
                liveEdit
                  ? "border-emerald-400 bg-emerald-500 text-white hover:bg-emerald-600"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {liveEdit ? "Live Edit: ON" : "Live Edit"}
            </button>
          )}
          {canLiveEdit && (
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const end = new Date(now);
                end.setDate(end.getDate() + 1);
                const toLocalInput = (date: Date) =>
                  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                setEventStart(toLocalInput(now));
                setEventEnd(toLocalInput(end));
                openHargaEventModal();
              }}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 font-semibold shadow-sm hover:bg-amber-100 transition-all"
            >
              Harga Event ({selectedCount})
            </button>
          )}
          {canLiveEdit && activeHargaEvents.length > 0 && (
            <button
              type="button"
              onClick={() => setRestoreEventModalOpen(true)}
              disabled={restoringEvent}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 font-semibold text-rose-700 shadow-sm transition-all hover:bg-rose-100 disabled:opacity-60"
            >
              {restoringEvent ? "Mengembalikan..." : `Kembalikan Harga Normal (${activeHargaEvents.length})`}
            </button>
          )}
          <Link
            href="/admin/master/harga-jual/recent"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold shadow-sm hover:bg-gray-50 transition-all"
          >
            <CalendarClock className="w-5 h-5" />
            Perubahan Harga Terbaru
          </Link>
          <Link
            href="/admin/master/harga-event"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-sky-200 bg-sky-50 text-sky-800 font-semibold shadow-sm hover:bg-sky-100 transition-all"
          >
            Kelola Harga Event
          </Link>
          <Link
            href="/admin/master/harga-jual/approval"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold shadow-sm hover:bg-gray-50 transition-all"
          >
            <ShieldCheck className="w-5 h-5" />
            Approval Harga Jual
          </Link>
          <Link
            href="/admin/master/harga-jual/new"
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Edit Harga Jual
          </Link>
          </div>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Harga Approved (Kelas 1)"
          value={`${summary?.kelas1_active_count ?? 0} item`}
          accent="from-[#3FE0D0] to-[#2DD4C4]"
        />
        <SummaryCard
          title="Cakupan Harga Jual vs Varian"
          value={`${formatRatio(summary?.varian_with_harga ?? 0, summary?.total_varian ?? 0)} (${formatPercent(
            summary?.varian_with_harga ?? 0,
            summary?.total_varian ?? 0
          )})`}
          action={
            <button
              type="button"
              onClick={() => handleDownloadCoverage("varian")}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Download
            </button>
          }
          accent="from-emerald-400 to-teal-400"
        />
        <SummaryCard
          title="Cakupan vs Pengadaan (unik)"
          value={`${formatRatio(
            summary?.pengadaan_varian_with_harga ?? 0,
            summary?.total_pengadaan_varian ?? 0
          )} (${formatPercent(
            summary?.pengadaan_varian_with_harga ?? 0,
            summary?.total_pengadaan_varian ?? 0
          )})`}
          action={
            <button
              type="button"
              onClick={() => handleDownloadCoverage("pengadaan")}
              className="text-xs font-semibold text-amber-700 hover:text-amber-800"
            >
              Download
            </button>
          }
          accent="from-amber-300 to-orange-400"
        />
      </div>

      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-white border border-gray-100 rounded-2xl shadow-sm">
        {error && (
          <div className="bg-amber-50 border-b border-amber-100 text-amber-800 text-sm px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/70 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-600">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-gray-500 shadow-sm">
              <Filter className="h-3.5 w-3.5" />
            </span>
            Filter Data
          </div>
          <div className="flex w-full flex-col gap-2 md:flex-row lg:w-auto">
            <Select
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: "Semua", value: "semua" },
                { label: "Aktif", value: "aktif" },
                { label: "Nonaktif", value: "nonaktif" },
              ]}
            />
            <Select
              label="Merk"
              value={merkFilter}
              onChange={setMerkFilter}
              options={[{ label: "Semua merk", value: "semua" }, ...merkOptions]}
            />
            <Select
              label="Kelas"
              value={kelasFilter}
              onChange={setKelasFilter}
              options={kelasOptions}
            />
            <div className="min-w-[220px] flex-1 lg:ml-2 lg:border-l lg:border-gray-200 lg:pl-3">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Pencarian</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari barcode varian / nama varian"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#3FE0D0] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="px-4 pb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
          <div className="flex flex-wrap items-center gap-2">
            Menampilkan {rangeStart} - {rangeEnd} dari {totalItems} item
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Aktif terceklist: {selectedCount} item
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>Per halaman</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border border-gray-200 px-2 py-1 text-sm"
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Prev
            </button>
            <span>
              Hal {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <div className="min-h-0 w-full max-w-full flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain">
          <table className="w-max min-w-[1100px] border border-gray-300 text-left text-xs leading-tight [&_td]:!px-2 [&_td]:!py-2 [&_th]:!px-2 [&_th]:!py-2">
            <thead className="sticky top-0 z-20">
              <tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-3 py-3 border border-gray-300 sticky left-0 bg-gray-50 z-10 w-12" rowSpan={2}>
                  <input
                    type="checkbox"
                    checked={
                      pagedRows.length > 0 &&
                      pagedRows.every((row) => selectedVariants.has(normalizeKey(row.kode_barang_variant)))
                    }
                    onChange={(e) => toggleAllSelected(e.target.checked)}
                  />
                </th>
                <th className="px-3 py-3 border border-gray-300 sticky left-[48px] bg-gray-50 z-10" rowSpan={2}>
                  Detail
                </th>
                <th className="w-[220px] min-w-[220px] max-w-[220px] px-4 py-3 border border-gray-300 sticky left-[112px] bg-gray-50 z-10" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("nama_barang")} className="flex items-center gap-1">
                    Nama Barang <span className="text-[10px]">{sortIndicator("nama_barang")}</span>
                  </button>
                </th>
                <th className="w-[220px] min-w-[220px] max-w-[220px] px-4 py-3 border border-gray-300 sticky left-[332px] bg-gray-50 z-10" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("nama_varian")} className="flex items-center gap-1">
                    Nama Varian <span className="text-[10px]">{sortIndicator("nama_varian")}</span>
                  </button>
                </th>
                <th className="w-[160px] min-w-[160px] max-w-[160px] px-4 py-3 border border-gray-300 sticky left-[552px] bg-gray-50 z-10" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("barcode_varian")} className="flex items-center gap-1">
                    Barcode Varian <span className="text-[10px]">{sortIndicator("barcode_varian")}</span>
                  </button>
                </th>
                <th className="w-[140px] min-w-[140px] max-w-[140px] px-4 py-3 border border-gray-300" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("nama_merk")} className="flex items-center gap-1">
                    Merk <span className="text-[10px]">{sortIndicator("nama_merk")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 border border-gray-300" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("status")} className="flex items-center gap-1">
                    Status Aktif <span className="text-[10px]">{sortIndicator("status")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 border border-gray-300" rowSpan={2}>Sumber Harga</th>
                <th className="px-4 py-3 border border-gray-300" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("harga_beli")} className="flex items-center gap-1">
                    Harga Beli <span className="text-[10px]">{sortIndicator("harga_beli")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 border border-gray-300" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("het")} className="flex items-center gap-1">
                    HET <span className="text-[10px]">{sortIndicator("het")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 border border-gray-300" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("hpp")} className="flex items-center gap-1">
                    HPP <span className="text-[10px]">{sortIndicator("hpp")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 border border-gray-300" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("stok_gudang")} className="flex items-center gap-1">
                    Stok Gudang <span className="text-[10px]">{sortIndicator("stok_gudang")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 border border-gray-300" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("stok_toko")} className="flex items-center gap-1">
                    Stok Toko <span className="text-[10px]">{sortIndicator("stok_toko")}</span>
                  </button>
                </th>
                {channelList.map((ch, idx) => (
                  <th
                    key={ch}
                    className={`px-4 py-3 text-center border border-gray-300 ${
                      idx % 2 === 0 ? "bg-[#f0faf8]" : "bg-[#f7fbff]"
                    }`}
                    colSpan={4}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span>Harga Jual Kelas {ch}</span>
                      {(() => {
                        const statusKey = `header-status-${ch}`;
                        const hargaRows = pagedRows.map((row) => row.harga[ch]).filter(Boolean);
                        const hasInactive = hargaRows.some((h) => Number(h.isActive ?? 0) !== 1);
                        const hasActive = hargaRows.some((h) => Number(h.isActive ?? 0) === 1);
                        if (!hargaRows.length) return null;
                        const label = hasActive && hasInactive ? "Campur" : hasInactive ? "Nonaktif" : "Aktif";
                        return (
                          <button
                            type="button"
                            disabled={!canLiveEdit || savingCell[statusKey]}
                            title={canLiveEdit ? "Klik untuk ubah status harga kelas ini" : "Hanya super admin yang bisa ubah status"}
                            onClick={() => handleToggleChannelStatus(ch)}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case ${
                              hasInactive
                                ? "bg-rose-50 text-rose-700"
                                : "bg-emerald-50 text-emerald-700"
                            } ${canLiveEdit ? "cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-[#3FE0D0]/40" : "cursor-not-allowed opacity-80"}`}
                          >
                            {savingCell[statusKey] ? "..." : label}
                          </button>
                        );
                      })()}
                    </div>
                  </th>
                ))}
              </tr>
              <tr className="text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50">
                {channelList.map((ch, idx) => (
                  <React.Fragment key={`${ch}-tiers`}>
                    <th
                      className={`px-2 py-2 text-center border border-gray-300 ${
                        idx % 2 === 0 ? "bg-[#f0faf8]" : "bg-[#f7fbff]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(`price:${ch}:h1`)}
                        className="flex items-center justify-center gap-1 w-full"
                      >
                        1 PCS <span className="text-[10px]">{sortIndicator(`price:${ch}:h1`)}</span>
                      </button>
                    </th>
                    <th
                      className={`px-2 py-2 text-center border border-gray-300 ${
                        idx % 2 === 0 ? "bg-[#f0faf8]" : "bg-[#f7fbff]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(`price:${ch}:h3`)}
                        className="flex items-center justify-center gap-1 w-full"
                      >
                        3 PCS <span className="text-[10px]">{sortIndicator(`price:${ch}:h3`)}</span>
                      </button>
                    </th>
                    <th
                      className={`px-2 py-2 text-center border border-gray-300 ${
                        idx % 2 === 0 ? "bg-[#f0faf8]" : "bg-[#f7fbff]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(`price:${ch}:h6`)}
                        className="flex items-center justify-center gap-1 w-full"
                      >
                        6 PCS <span className="text-[10px]">{sortIndicator(`price:${ch}:h6`)}</span>
                      </button>
                    </th>
                    <th
                      className={`px-2 py-2 text-center border border-gray-300 ${
                        idx % 2 === 0 ? "bg-[#f0faf8]" : "bg-[#f7fbff]"
                      } border-r-4 border-r-gray-300`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(`price:${ch}:h12`)}
                        className="flex items-center justify-center gap-1 w-full"
                      >
                        12 PCS <span className="text-[10px]">{sortIndicator(`price:${ch}:h12`)}</span>
                      </button>
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading && Array.from({ length: 8 }).map((_, index) => (
                <tr key={`harga-skeleton-${index}`} className="animate-pulse">
                  <td colSpan={12 + Math.max(channelList.length, 1) * 4} className="border border-gray-200 px-2 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-5 rounded bg-gray-200" />
                      <div className="h-3 w-28 rounded bg-gray-200" />
                      <div className="h-3 w-40 rounded bg-gray-200" />
                      <div className="h-3 w-24 rounded bg-gray-200" />
                      <div className="h-3 flex-1 rounded bg-gray-200" />
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && pagedRows.map((row) => {
                const statusBarang = Number(row.status_barang ?? 0);
                const statusVarian = Number(row.status_varian ?? 0);
                const isInactive = statusBarang !== 1 || statusVarian !== 1;
                const isYellow = isHetBelowOffline(row);
                const rowBg = isYellow
                  ? "bg-yellow-300 hover:bg-yellow-300"
                  : isInactive
                    ? "bg-rose-50 hover:bg-rose-100"
                    : "hover:bg-gray-50";
                const stickyBg = isYellow
                  ? "bg-yellow-300"
                  : isInactive
                    ? "bg-rose-50"
                    : "bg-white";
                return (
                  <tr
                    key={row.kode_barang_variant}
                    className={rowBg}
                  >
                    <td
                      className={`px-3 py-3 border border-gray-200 sticky left-0 z-10 ${stickyBg}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedVariants.has(normalizeKey(row.kode_barang_variant))}
                        onChange={(e) => toggleSelected(row, e.target.checked)}
                      />
                    </td>
                    <td
                      className={`px-3 py-3 border border-gray-200 sticky left-[48px] z-10 ${stickyBg}`}
                    >
                      <button
                        type="button"
                        onClick={() => openDetail(row)}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                    <td
                      className={`w-[220px] min-w-[220px] max-w-[220px] px-4 py-3 border border-gray-200 sticky left-[112px] z-10 ${stickyBg}`}
                    >
                      <div className="font-semibold text-gray-900">{row.nama_barang || "-"}</div>
                    </td>
                    <td
                      className={`w-[220px] min-w-[220px] max-w-[220px] px-4 py-3 border border-gray-200 sticky left-[332px] z-10 ${stickyBg}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-gray-800">{row.nama_varian || row.kode_varian || "-"}</div>
                        <button
                          type="button"
                          onClick={() => handleEditNamaVarian(row)}
                          className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                    <td className={`w-[160px] min-w-[160px] max-w-[160px] px-4 py-3 border border-gray-200 sticky left-[552px] z-10 ${stickyBg}`}>
                      {row.barcode_varian || "-"}
                    </td>
                    <td className="w-[140px] min-w-[140px] max-w-[140px] px-4 py-3 border border-gray-200">
                      {row.nama_merk || row.kode_merk || "-"}
                    </td>
                    <td className="px-4 py-3 border border-gray-200">
                      {statusBarang === 1 && statusVarian === 1 ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          Tidak aktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 border border-gray-200">
                      {activeEventVariants.has(normalizeKey(row.kode_barang_variant)) ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Event Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-800 border border-gray-200">
                      {row.harga_beli ? formatRupiah(row.harga_beli) : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-800 border border-gray-200">
                      {liveEdit && canLiveEdit ? (
                        <input
                          defaultValue={row.het ?? ""}
                          onBlur={(e) => {
                            const next = parseNumberInput(e.target.value);
                            const current = row.het ?? null;
                            if ((next ?? null) === (current ?? null)) return;
                            handleLiveEditSave(
                              {
                                kode_barang_variant: row.kode_barang_variant,
                                het_sat_1: next,
                              },
                              `het-${row.kode_barang_variant}`
                            );
                          }}
                          className="w-24 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700"
                          disabled={savingCell[`het-${row.kode_barang_variant}`]}
                        />
                      ) : row.het ? (
                        formatRupiah(row.het)
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-800 border border-gray-200">
                      {row.hpp ? formatRupiah(row.hpp) : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-800 border border-gray-200 text-center">
                      {Number(row.stok_gudang ?? 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-gray-800 border border-gray-200 text-center">
                      {Number(row.stok_toko ?? 0).toLocaleString("id-ID")}
                    </td>
                    {channelList.map((ch, chIdx) => {
                      const tone = chIdx % 2 === 0 ? "bg-[#f7fffd]" : "bg-[#f9fbff]";
                      const h = row.harga[ch];
                      const hargaKeyBase = `${row.kode_barang_variant}-${ch}`;
                      const eventActiveForCell = ch === "OFFLINE" && activeEventVariants.has(normalizeKey(row.kode_barang_variant));
                      return (
                        <React.Fragment key={`${row.kode_barang_variant}-${ch}`}>
                          <td className={`${getHargaCellClass(tone, h?.h1, row.harga_beli)} ${eventActiveForCell ? "!bg-yellow-200 !text-yellow-950" : ""}`}>
                            {liveEdit && canLiveEdit ? (
                              <input
                                defaultValue={h?.h1 ?? ""}
                                onBlur={(e) => {
                                  if (!h?.id_kelas_harga) return;
                                  const next = parseNumberInput(e.target.value);
                                  const current = h?.h1 ?? null;
                                  if ((next ?? null) === (current ?? null)) return;
                                  handleLiveEditSave(
                                    {
                                      kode_barang_variant: row.kode_barang_variant,
                                      id_kelas_harga: h.id_kelas_harga,
                                      harga_1: next,
                                      harga_3: h?.h3 ?? null,
                                      harga_6: h?.h6 ?? null,
                                      harga_12: h?.h12 ?? null,
                                    },
                                    `h1-${hargaKeyBase}`
                                  );
                                }}
                                className="w-20 rounded-md border border-gray-200 px-1 py-0.5 text-xs text-gray-700 text-center"
                                disabled={savingCell[`h1-${hargaKeyBase}`]}
                              />
                            ) : h ? (
                              formatRupiah(h.h1)
                            ) : (
                              "-"
                            )}
                            {eventActiveForCell ? <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-yellow-800">EVENT</span> : null}
                          </td>
                          <td className={`${getHargaCellClass(tone, h?.h3, row.harga_beli)} ${eventActiveForCell ? "!bg-yellow-200 !text-yellow-950" : ""}`}>
                            {liveEdit && canLiveEdit ? (
                              <input
                                defaultValue={h?.h3 ?? ""}
                                onBlur={(e) => {
                                  if (!h?.id_kelas_harga) return;
                                  const next = parseNumberInput(e.target.value);
                                  const current = h?.h3 ?? null;
                                  if ((next ?? null) === (current ?? null)) return;
                                  handleLiveEditSave(
                                    {
                                      kode_barang_variant: row.kode_barang_variant,
                                      id_kelas_harga: h.id_kelas_harga,
                                      harga_1: h?.h1 ?? null,
                                      harga_3: next,
                                      harga_6: h?.h6 ?? null,
                                      harga_12: h?.h12 ?? null,
                                    },
                                    `h3-${hargaKeyBase}`
                                  );
                                }}
                                className="w-20 rounded-md border border-gray-200 px-1 py-0.5 text-xs text-gray-700 text-center"
                                disabled={savingCell[`h3-${hargaKeyBase}`]}
                              />
                            ) : h ? (
                              formatRupiah(h.h3)
                            ) : (
                              "-"
                            )}
                            {eventActiveForCell ? <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-yellow-800">EVENT</span> : null}
                          </td>
                          <td className={`${getHargaCellClass(tone, h?.h6, row.harga_beli)} ${eventActiveForCell ? "!bg-yellow-200 !text-yellow-950" : ""}`}>
                            {liveEdit && canLiveEdit ? (
                              <input
                                defaultValue={h?.h6 ?? ""}
                                onBlur={(e) => {
                                  if (!h?.id_kelas_harga) return;
                                  const next = parseNumberInput(e.target.value);
                                  const current = h?.h6 ?? null;
                                  if ((next ?? null) === (current ?? null)) return;
                                  handleLiveEditSave(
                                    {
                                      kode_barang_variant: row.kode_barang_variant,
                                      id_kelas_harga: h.id_kelas_harga,
                                      harga_1: h?.h1 ?? null,
                                      harga_3: h?.h3 ?? null,
                                      harga_6: next,
                                      harga_12: h?.h12 ?? null,
                                    },
                                    `h6-${hargaKeyBase}`
                                  );
                                }}
                                className="w-20 rounded-md border border-gray-200 px-1 py-0.5 text-xs text-gray-700 text-center"
                                disabled={savingCell[`h6-${hargaKeyBase}`]}
                              />
                            ) : h ? (
                              formatRupiah(h.h6)
                            ) : (
                              "-"
                            )}
                            {eventActiveForCell ? <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-yellow-800">EVENT</span> : null}
                          </td>
                          <td
                            className={`${getHargaCellClass(tone, h?.h12, row.harga_beli, "border-r-4 border-r-gray-300")} ${eventActiveForCell ? "!bg-yellow-200 !text-yellow-950" : ""}`}
                          >
                            {liveEdit && canLiveEdit ? (
                              <input
                                defaultValue={h?.h12 ?? ""}
                                onBlur={(e) => {
                                  if (!h?.id_kelas_harga) return;
                                  const next = parseNumberInput(e.target.value);
                                  const current = h?.h12 ?? null;
                                  if ((next ?? null) === (current ?? null)) return;
                                  handleLiveEditSave(
                                    {
                                      kode_barang_variant: row.kode_barang_variant,
                                      id_kelas_harga: h.id_kelas_harga,
                                      harga_1: h?.h1 ?? null,
                                      harga_3: h?.h3 ?? null,
                                      harga_6: h?.h6 ?? null,
                                      harga_12: next,
                                    },
                                    `h12-${hargaKeyBase}`
                                  );
                                }}
                                className="w-20 rounded-md border border-gray-200 px-1 py-0.5 text-xs text-gray-700 text-center"
                                disabled={savingCell[`h12-${hargaKeyBase}`]}
                              />
                            ) : h ? (
                              formatRupiah(h.h12)
                            ) : (
                              "-"
                            )}
                            {eventActiveForCell ? <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-yellow-800">EVENT</span> : null}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
              {groupedByVarian.length === 0 && !loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500 border border-gray-200" colSpan={12 + channelList.length * 4}>
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailOpen && detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-xs text-gray-500">Detail Harga Jual</p>
                <h2 className="text-lg font-semibold text-gray-900">{detailRow.nama_barang || "-"}</h2>
                <p className="text-sm text-gray-600">{detailRow.nama_varian || detailRow.kode_varian || "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Kode Barang</p>
                  <p className="font-semibold text-gray-900">{detailRow.kode_barang || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Kode Barang Varian</p>
                  <p className="font-semibold text-gray-900">{detailRow.kode_barang_variant || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Status Aktif</p>
                  <p className="font-semibold text-gray-900">
                    {Number(detailRow.status_barang ?? 0) === 1 && Number(detailRow.status_varian ?? 0) === 1
                      ? "Aktif"
                      : "Tidak aktif"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Harga di Setiap Kasir</p>
                <div className="overflow-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Kasir</th>
                        <th className="px-3 py-2">Kelas</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">1 PCS</th>
                        <th className="px-3 py-2">3 PCS</th>
                        <th className="px-3 py-2">6 PCS</th>
                        <th className="px-3 py-2">12 PCS</th>
                        <th className="px-3 py-2">Update</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {kasirLoading && (
                        <tr>
                          <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                            Memuat harga kasir...
                          </td>
                        </tr>
                      )}
                      {!kasirLoading && kasirError && (
                        <tr>
                          <td colSpan={8} className="px-3 py-4 text-center text-rose-600">
                            {kasirError}
                          </td>
                        </tr>
                      )}
                      {!kasirLoading && !kasirError && kasirPrices.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                            Belum ada data kasir.
                          </td>
                        </tr>
                      )}
                      {!kasirLoading &&
                        !kasirError &&
                        kasirPrices.flatMap((kasir) => {
                          const kasirDiff = isKasirPriceDifferent(kasir);
                          const isSyncing = Boolean(syncingKasir[kasir.database]);
                          if (kasir.status === "error") {
                            return [
                              <tr key={`${kasir.label}-error`}>
                                <td className="px-3 py-2 font-semibold text-gray-900">{kasir.label}</td>
                                <td colSpan={7} className="px-3 py-2 text-rose-600">
                                  {kasir.message || "Gagal koneksi/query kasir"}
                                </td>
                              </tr>,
                            ];
                          }
                          if (!kasir.rows.length) {
                            return [
                              <tr key={`${kasir.label}-empty`}>
                                <td className="px-3 py-2">
                                  <div className="font-semibold text-gray-900">{kasir.label}</div>
                                  <div className="text-[11px] text-gray-500">{kasir.database}</div>
                                  {kasirDiff ? (
                                    <button
                                      type="button"
                                      disabled={isSyncing}
                                      onClick={() => handleSyncKasirPrice(kasir)}
                                      className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                                    >
                                      {isSyncing ? "Sinkron..." : "Sinkron manual"}
                                    </button>
                                  ) : null}
                                </td>
                                <td colSpan={7} className="px-3 py-2 text-gray-500">
                                  Harga tidak ditemukan di {kasir.database}.
                                </td>
                              </tr>,
                            ];
                          }
                          return kasir.rows.map((price, idx) => {
                            const isActive = Number(price.is_active ?? 0) === 1;
                            return (
                              <tr key={`${kasir.label}-${price.channel_code || idx}`}>
                                <td className="px-3 py-2">
                                  <div className="font-semibold text-gray-900">{idx === 0 ? kasir.label : ""}</div>
                                  {idx === 0 ? (
                                    <>
                                      <div className="text-[11px] text-gray-500">{kasir.database}</div>
                                      {kasirDiff ? (
                                        <button
                                          type="button"
                                          disabled={isSyncing}
                                          onClick={() => handleSyncKasirPrice(kasir)}
                                          className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                                        >
                                          {isSyncing ? "Sinkron..." : "Sinkron manual"}
                                        </button>
                                      ) : (
                                        <span className="mt-1 inline-flex rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                                          Sesuai pusat
                                        </span>
                                      )}
                                    </>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 text-gray-700">{price.channel_code || price.nama_kelas || "-"}</td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                    }`}
                                  >
                                    {isActive ? "Aktif" : "Nonaktif"}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-semibold text-gray-900">{formatRupiah(price.harga_1)}</td>
                                <td className="px-3 py-2 font-semibold text-gray-900">{formatRupiah(price.harga_3)}</td>
                                <td className="px-3 py-2 font-semibold text-gray-900">{formatRupiah(price.harga_6)}</td>
                                <td className="px-3 py-2 font-semibold text-gray-900">{formatRupiah(price.harga_12)}</td>
                                <td className="px-3 py-2 text-gray-600">
                                  {formatWibDateTime(price.updated_at)}
                                  {price.updated_by ? <div className="text-[11px] text-gray-500">{price.updated_by}</div> : null}
                                </td>
                              </tr>
                            );
                          });
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">History Harga Jual</p>
                <div className="overflow-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Tanggal</th>
                        <th className="px-3 py-2">Kelas</th>
                        <th className="px-3 py-2">1 PCS</th>
                        <th className="px-3 py-2">3 PCS</th>
                        <th className="px-3 py-2">6 PCS</th>
                        <th className="px-3 py-2">12 PCS</th>
                        <th className="px-3 py-2">Changed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {historyLoading && (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                            Memuat history...
                          </td>
                        </tr>
                      )}
                      {!historyLoading && historyError && (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-rose-600">
                            {historyError}
                          </td>
                        </tr>
                      )}
                      {!historyLoading && !historyError && historyItems.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                            Belum ada history.
                          </td>
                        </tr>
                      )}
                      {!historyLoading &&
                        !historyError &&
                        historyItems.map((h) => (
                          <tr key={h.kode_h_harga_jual || `${h.changed_at}-${h.id_kelas_harga}`}>
                            <td className="px-3 py-2 text-gray-700">{formatWibDateTime(h.changed_at)}</td>
                            <td className="px-3 py-2 text-gray-700">{h.nama_kelas || h.kode_kelas_harga || "-"}</td>
                            <td className="px-3 py-2 text-gray-900 font-semibold">{formatRupiah(h.harga_1)}</td>
                            <td className="px-3 py-2 text-gray-900 font-semibold">{formatRupiah(h.harga_3)}</td>
                            <td className="px-3 py-2 text-gray-900 font-semibold">{formatRupiah(h.harga_6)}</td>
                            <td className="px-3 py-2 text-gray-900 font-semibold">{formatRupiah(h.harga_12)}</td>
                            <td className="px-3 py-2 text-gray-700">{h.changed_by || "-"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {printModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Cetak Price Tag</p>
                <p className="text-sm font-semibold text-gray-900">Pilih Layout</p>
              </div>
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                {selectedCount} item terceklist untuk dicetak
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="layout"
                  value="single"
                  checked={printLayout === "single"}
                  onChange={() => setPrintLayout("single")}
                />
                1 Kolom (layout sekarang)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="layout"
                  value="double"
                  checked={printLayout === "double"}
                  onChange={() => setPrintLayout("double")}
                />
                2 Kolom (dobel jumlah, background 2)
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintModalOpen(false);
                  handlePrintPriceTag(printLayout);
                }}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
              >
                Cetak
              </button>
            </div>
          </div>
        </div>
      )}

      {restoreEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Pemulihan Harga</p>
                <h2 className="text-lg font-bold text-gray-900">Pilih Event</h2>
                <p className="mt-1 text-sm text-gray-500">Pilih event aktif yang ingin dihentikan dan dikembalikan ke harga normal.</p>
              </div>
              <button type="button" onClick={() => setRestoreEventModalOpen(false)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">Tutup</button>
            </div>
            <div className="mt-5 space-y-2">
              {activeHargaEvents.map((event) => (
                <div key={event.kode_t_harga_event} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{event.nama_event}</p>
                    <p className="text-xs text-gray-500">{event.total_item ?? event.items?.length ?? 0} item aktif</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestoreHargaNormal(event)}
                    disabled={restoringEvent}
                    className="shrink-0 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    Kembalikan
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {eventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl border border-gray-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Harga Jual Offline</p>
                <h2 className="text-lg font-bold text-gray-900">Buat Harga Event</h2>
                <p className="mt-1 text-sm text-gray-500">Harga normal disimpan dan dikembalikan otomatis setelah event berakhir.</p>
              </div>
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 flex flex-col gap-1 text-sm font-semibold text-gray-700">
                Nama event
                <input
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Contoh: Promo 17 Agustus"
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal focus:border-amber-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
                Mulai
                <input
                  type="datetime-local"
                  value={eventStart}
                  onChange={(e) => setEventStart(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal focus:border-amber-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
                Selesai
                <input
                  type="datetime-local"
                  value={eventEnd}
                  onChange={(e) => setEventEnd(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 font-normal focus:border-amber-400 focus:outline-none"
                />
              </label>
              <div className="sm:col-span-2 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Import harga event dari Excel</p>
                    <p className="mt-1 text-xs text-gray-600">
                      Format kolom: no, barcode, nama varian, harga 1 pcs, 3pcs, 6pcs, 12pcs. Setelah upload, cek preview lalu klik Terapkan ke Draft.
                    </p>
                    {eventImportFileName && <p className="mt-1 text-[11px] font-semibold text-sky-700">{eventImportFileName}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={`inline-flex cursor-pointer items-center rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm hover:bg-sky-50 ${eventImportLoading ? "pointer-events-none opacity-60" : ""}`}>
                      {eventImportLoading ? "Membaca Excel..." : "Upload Excel"}
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImportHargaEventExcel(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleApplyHargaEventImport}
                      disabled={eventImportLoading || eventImportValidCount === 0}
                      className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Terapkan ke Draft ({eventImportValidCount})
                    </button>
                  </div>
                </div>
                {(eventImportLoading || eventImportProgress.total > 0) && (
                  <div className="mt-3 rounded-lg border border-sky-100 bg-white px-3 py-2">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-700">
                        Memproses Excel: {eventImportProgress.processed} / {eventImportProgress.total} barcode
                      </span>
                      <span className="font-bold text-sky-700">{eventImportProgressPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-sky-100">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all duration-300"
                        style={{ width: `${eventImportProgressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
                {eventImportRows.length > 0 && (
                  <div className="mt-3 overflow-auto rounded-lg border border-sky-100 bg-white">
                    <div className="flex flex-wrap items-center gap-2 border-b border-sky-100 px-3 py-2 text-xs">
                      <span className="font-semibold text-gray-700">Preview import</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">{eventImportValidCount} sukses</span>
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">{eventImportErrorCount} tidak sukses</span>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">{eventImportNotFoundRows.length} tidak ditemukan</span>
                    </div>
                    {eventImportNotFoundRows.length > 0 && (
                      <div className="border-b border-rose-100 bg-rose-50/70 px-3 py-2">
                        <p className="text-xs font-semibold text-rose-700">Barcode tidak ditemukan</p>
                        <div className="mt-1 max-h-24 overflow-auto text-[11px] text-rose-700">
                          {eventImportNotFoundRows.map((row, index) => (
                            <div key={`not-found-${row.barcode}-${index}`}>
                              {row.barcode || "-"} - {row.nama_varian_excel || "Nama varian kosong"}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <table className="min-w-[980px] w-full text-xs">
                      <thead className="bg-sky-50 text-left text-gray-600">
                        <tr>
                          <th className="px-2 py-2">No</th>
                          <th className="px-2 py-2">Barcode</th>
                          <th className="px-2 py-2">Nama Varian Excel</th>
                          <th className="px-2 py-2">Item DB</th>
                          <th className="px-2 py-2 text-right">1 PCS</th>
                          <th className="px-2 py-2 text-right">3 PCS</th>
                          <th className="px-2 py-2 text-right">6 PCS</th>
                          <th className="px-2 py-2 text-right">12 PCS</th>
                          <th className="px-2 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {eventImportRows.map((row, index) => (
                          <tr key={`${row.barcode || "empty"}-${index}`} className={row.status === "valid" ? "bg-white" : "bg-rose-50/60"}>
                            <td className="px-2 py-2 text-gray-500">{row.no}</td>
                            <td className="px-2 py-2 font-semibold text-gray-800">{row.barcode || "-"}</td>
                            <td className="max-w-[220px] px-2 py-2">
                              <div className="truncate text-gray-700" title={row.nama_varian_excel}>
                                {row.nama_varian_excel || "-"}
                              </div>
                            </td>
                            <td className="max-w-[240px] px-2 py-2">
                              <div className="truncate font-semibold text-gray-800" title={row.matchedRow?.nama_varian || row.matchedRow?.nama_barang}>
                                {row.matchedRow?.nama_varian || row.matchedRow?.nama_barang || "-"}
                              </div>
                            </td>
                            {([
                              ["harga_1", "h1"],
                              ["harga_3", "h3"],
                              ["harga_6", "h6"],
                              ["harga_12", "h12"],
                            ] as const).map(([eventField, normalField]) => (
                              <td key={eventField} className="px-2 py-2 text-right">
                                {row.status === "valid" ? (
                                  <div className="leading-tight">
                                    {row[eventField] ? (
                                      <>
                                        <span className="text-gray-500 line-through">{formatRupiah(row.matchedRow?.harga?.OFFLINE?.[normalField])}</span>
                                        <span className="mx-1 text-gray-400">-&gt;</span>
                                        <span className="font-semibold text-amber-700">{formatRupiah(Number(row[eventField]))}</span>
                                      </>
                                    ) : (
                                      <span className="font-semibold text-gray-400">null</span>
                                    )}
                                  </div>
                                ) : (
                                  row[eventField] ? formatRupiah(Number(row[eventField])) : "null"
                                )}
                              </td>
                            ))}
                            <td className={`px-2 py-2 font-semibold ${row.status === "valid" ? "text-emerald-700" : "text-rose-700"}`}>
                              {row.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Harga event per item</p>
                    <p className="text-xs text-gray-600">Isi nominal berbeda untuk tiap item. Harga normal ditampilkan sebagai referensi.</p>
                  </div>
                  <span className="text-xs font-semibold text-amber-800">{selectedCount} item dipilih</span>
                </div>
                <div className="max-h-64 overflow-auto rounded-lg border border-amber-100 bg-white">
                  <table className="min-w-[760px] w-full text-xs">
                    <thead className="sticky top-0 bg-amber-50 text-left text-gray-600">
                      <tr>
                        <th className="px-2 py-2">Item</th>
                        <th className="px-2 py-2">1 PCS</th>
                        <th className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span>3 PCS</span>
                            <button
                              type="button"
                              onClick={() => handleApplyCurrentPriceToEventDraft("harga_3", "h3")}
                              className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                              title="Terapkan semua harga 3 PCS saat ini"
                            >
                              Pakai saat ini
                            </button>
                          </div>
                        </th>
                        <th className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span>6 PCS</span>
                            <button
                              type="button"
                              onClick={() => handleApplyCurrentPriceToEventDraft("harga_6", "h6")}
                              className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                              title="Terapkan semua harga 6 PCS saat ini"
                            >
                              Pakai saat ini
                            </button>
                          </div>
                        </th>
                        <th className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span>12 PCS</span>
                            <button
                              type="button"
                              onClick={() => handleApplyCurrentPriceToEventDraft("harga_12", "h12")}
                              className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                              title="Terapkan semua harga 12 PCS saat ini"
                            >
                              Pakai saat ini
                            </button>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedRows
                        .map((row) => {
                          const key = normalizeKey(row.kode_barang_variant);
                          const harga = row.harga?.OFFLINE;
                          const draft = eventPriceDrafts[key] || { harga_1: "", harga_3: "", harga_6: "", harga_12: "" };
                          return (
                            <tr key={`event-price-${key}`}>
                              <td className="max-w-[260px] px-2 py-2">
                                <div className="truncate font-semibold text-gray-800" title={row.nama_varian || row.kode_varian}>{row.nama_varian || row.kode_varian || key}</div>
                                <div className="text-[10px] text-gray-500">Normal: {formatRupiah(harga?.h1)} / {formatRupiah(harga?.h3)} / {formatRupiah(harga?.h6)} / {formatRupiah(harga?.h12)}</div>
                              </td>
                              {(["harga_1", "harga_3", "harga_6", "harga_12"] as const).map((field) => (
                                <td key={field} className="px-2 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    value={draft[field]}
                                    onChange={(e) => setEventPriceDrafts((prev) => ({
                                      ...prev,
                                      [key]: { ...draft, [field]: e.target.value },
                                    }))}
                                    className="w-28 rounded-md border border-gray-200 px-2 py-1.5 text-right text-xs focus:border-amber-400 focus:outline-none"
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            {eventSaving && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-gray-800">
                    Menyimpan event: {eventSaveProgress.processed} / {eventSaveProgress.total} item
                  </span>
                  <span className="font-bold text-amber-700">{eventSaveProgress.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-amber-100">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${eventSaveProgress.percent}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span>{eventSaveProgress.message || "Menyimpan data event"}</span>
                  {eventSaveProgress.currentItem && (
                    <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-gray-700">
                      {eventSaveProgress.currentItem}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                disabled={eventSaving}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreateHargaEvent}
                disabled={eventSaving}
                className="px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-60"
              >
                {eventSaving ? "Menyimpan..." : "Jadwalkan Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {kasirSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Sinkronisasi Harga</p>
                <h2 className="text-lg font-bold text-gray-900">Sinkron ke Kasir</h2>
                <p className="mt-1 text-sm text-gray-500">Proses dilakukan satu per satu agar status setiap kasir terlihat jelas.</p>
              </div>
              <button type="button" onClick={() => !kasirSyncRunning && setKasirSyncModalOpen(false)} disabled={kasirSyncRunning} className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                Tutup
              </button>
            </div>
            <div className="mt-5">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-600">
                <span>Progress sinkronisasi</span>
                <span>{Math.round(kasirOverallProgress)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-sky-500 transition-[width] duration-300" style={{ width: `${kasirOverallProgress}%` }} />
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {kasirSyncResults.map((result) => (
                <div key={result.database} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{result.label}</p>
                      <p className="text-[11px] text-gray-500">{result.database}</p>
                      {result.status === "running" && result.currentItem ? (
                        <p className="mt-1 truncate text-xs text-sky-700" title={result.currentItem}>Memproses: {result.currentItem}</p>
                      ) : null}
                      {result.status === "running" && result.currentBarcode ? (
                        <p className="text-[11px] text-gray-500">Barcode: {result.currentBarcode}</p>
                      ) : null}
                      {result.message && result.status !== "success" ? <p className="mt-1 text-xs text-rose-600">{result.message}</p> : null}
                    </div>
                    <div className="shrink-0 text-right text-xs font-semibold">
                      {result.status === "pending" && <span className="text-gray-400">Menunggu</span>}
                      {result.status === "running" && <span className="text-sky-600">Memproses...</span>}
                      {result.status === "success" && <span className="text-emerald-600">Berhasil ({result.count ?? 0} data)</span>}
                      {result.status === "error" && <span className="text-rose-600">Gagal</span>}
                    </div>
                  </div>
                  {result.status === "running" && result.total ? (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full rounded-full bg-sky-500 transition-[width] duration-200" style={{ width: `${Math.min(100, ((result.processed || 0) / result.total) * 100)}%` }} />
                      </div>
                      <span className="shrink-0 text-[11px] text-gray-500">{(result.processed || 0).toLocaleString("id-ID")} / {result.total.toLocaleString("id-ID")}</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {!kasirSyncRunning && kasirSyncResults.length > 0 ? (
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={() => setKasirSyncModalOpen(false)} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">Selesai</button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  accent,
  action,
}: {
  title: string;
  value: string;
  accent: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${accent} text-xs font-bold text-white`}>
        {value.split(" ")[0]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] text-gray-500">{title}</p>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-gray-900">{value}</p>
          {action ? <div>{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-sm font-semibold text-gray-700">
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition-colors focus:border-[#3FE0D0] focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatRupiah(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("id-ID");
}

function toComparableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
}

function formatWibDateTime(value?: string | null) {
  if (!value) return "-";
  const raw = String(value).trim();
  if (!raw) return "-";
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const withoutFraction = normalized.replace(/(\.\d{3})\d+/, "$1");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(withoutFraction);
  const date = new Date(hasTimezone ? withoutFraction : `${withoutFraction}Z`);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 19);
  return date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
