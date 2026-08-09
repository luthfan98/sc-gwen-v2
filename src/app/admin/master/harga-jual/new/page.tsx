"use client";

import React, { useEffect, useMemo, useState } from "react";
import Select, { type SingleValue } from "react-select";
import Swal from "sweetalert2";
import { Plus, X, Search, Filter, CheckSquare, Square } from "lucide-react";

type HargaFields = { h1?: number | null; h3?: number | null; h6?: number | null; h12?: number | null };
type HargaAktif = Record<string, HargaFields>;

type Barang = {
  id_varian: number;
  kode_barang_variant: string;
  kode_barang: string;
  nama_barang: string;
  nama_varian: string;
  barcode_varian?: string | null;
  kode_merk?: string;
  nama_merk?: string;
  kode_supplier?: string;
  nama_supplier?: string;
  harga_beli_sat_1?: number;
  hpp_avg_sat_1?: number;
  harga_het?: number;
  is_aktif?: number;
  last_request_code?: string | null;
  last_request_status?: number | null;
  last_request_at?: string | null;
  stok_gudang?: number | null;
  stok_toko?: number | null;
  harga_aktif?: HargaAktif;
};

type DraftRow = Barang & {
  harga: Record<string, { h1: string; h3: string; h6: string; h12: string }>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const CHANNELS = ["OFFLINE", "GWEN_APP", "SHOPEE", "TIKTOKSHOP"];
const MARKETPLACE_CHANNELS = ["SHOPEE", "TIKTOKSHOP"];
const HEADER_COLORS = ["#d5f5ee", "#ffe6d5", "#e4e0ff", "#ffe3f1"];
const BODY_COLORS = ["#e6fbf3", "#fff2e5", "#efecff", "#fff0f7"];
const DRAFT_STORAGE_KEY = "harga-jual-new-drafts";
const percentDefaults = { h1: "", h3: "", h6: "", h12: "" };
const buildDefaultPercents = () =>
  CHANNELS.reduce((acc, ch) => {
    acc[ch] = { ...percentDefaults };
    return acc;
  }, {} as Record<string, { h1: string; h3: string; h6: string; h12: string }>);

export default function HargaJualNewPage() {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [barangOptions, setBarangOptions] = useState<Barang[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [selectedMerk, setSelectedMerk] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncingHargaBeli, setSyncingHargaBeli] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [hideApproved, setHideApproved] = useState(false);
  const [kelasHarga, setKelasHarga] = useState<{ id_kelas_harga: number; channel_code: string; nama: string }[]>([]);
  const [savingRequest, setSavingRequest] = useState(false);
  const [percentages, setPercentages] = useState<Record<string, { h1: string; h3: string; h6: string; h12: string }>>(
    () => buildDefaultPercents()
  );
  const [merkOptions, setMerkOptions] = useState<{ id_merk: string; nama_merk: string }[]>([]);

  const fetchBarangOptions = async () => {
    setLoading(true);
    try {
      const barangRes = await fetch(`${API_BASE}/barang/varian`);
      const barangJson = barangRes.ok ? await barangRes.json() : [];
      setBarangOptions(
        Array.isArray(barangJson)
          ? barangJson
              .filter((b: any) => Number(b?.is_aktif ?? 1) === 1)
              .map((b: any) => ({
                id_varian: b.id_varian,
                kode_barang_variant: b.kode_barang_variant,
                kode_barang: b.kode_barang,
                nama_barang: b.nama_barang,
                nama_varian: b.nama_varian,
                barcode_varian: b.barcode_varian ?? null,
                kode_merk: b.kode_merk,
                nama_merk: b.nama_merk,
                kode_supplier: b.kode_supplier,
                nama_supplier: b.nama_supplier,
                harga_beli_sat_1: b.harga_beli_sat_1,
                hpp_avg_sat_1: b.hpp_avg_sat_1,
                harga_het: b.harga_het,
                is_aktif: b.is_aktif,
                last_request_code: b.last_request_code ?? null,
                last_request_status: b.last_request_status ?? null,
                last_request_at: b.last_request_at ?? null,
                stok_gudang: b.stok_gudang ?? 0,
                stok_toko: b.stok_toko ?? 0,
                harga_aktif: {
                  OFFLINE: {
                    h1: toNullableNumber(b.harga_aktif_offline_1),
                    h3: toNullableNumber(b.harga_aktif_offline_3),
                    h6: toNullableNumber(b.harga_aktif_offline_6),
                    h12: toNullableNumber(b.harga_aktif_offline_12),
                  },
                  GWEN_APP: {
                    h1: toNullableNumber(b.harga_aktif_gwen_app_1),
                    h3: toNullableNumber(b.harga_aktif_gwen_app_3),
                    h6: toNullableNumber(b.harga_aktif_gwen_app_6),
                    h12: toNullableNumber(b.harga_aktif_gwen_app_12),
                  },
                  SHOPEE: {
                    h1: toNullableNumber(b.harga_aktif_shopee_1),
                    h3: toNullableNumber(b.harga_aktif_shopee_3),
                    h6: toNullableNumber(b.harga_aktif_shopee_6),
                    h12: toNullableNumber(b.harga_aktif_shopee_12),
                  },
                  TIKTOKSHOP: {
                    h1: toNullableNumber(b.harga_aktif_tiktokshop_1),
                    h3: toNullableNumber(b.harga_aktif_tiktokshop_3),
                    h6: toNullableNumber(b.harga_aktif_tiktokshop_6),
                    h12: toNullableNumber(b.harga_aktif_tiktokshop_12),
                  },
                },
              }))
          : []
      );
    } catch (err) {
      console.error("Failed load options", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncHargaBeli = async () => {
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

    setSyncingHargaBeli(true);
    try {
      const res = await fetch(`${API_BASE}/barang/varian/sync-harga-beli`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updated_by: username }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      await fetchBarangOptions();
      await Swal.fire({
        icon: "success",
        title: "Sync selesai",
        text: `Harga beli ter-update: ${data.updated_count ?? 0} item.`,
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Failed sync harga beli", err);
      Swal.fire({ icon: "error", title: "Gagal sync harga beli" });
    } finally {
      setSyncingHargaBeli(false);
    }
  };

  useEffect(() => {
    fetchBarangOptions();
  }, []);

  useEffect(() => {
    const loadKelas = async () => {
      try {
        const res = await fetch(`${API_BASE}/kelas-harga`);
        const data = res.ok ? await res.json() : [];
        const normalized = Array.isArray(data)
          ? data
              .filter((k: any) => Number(k.is_active ?? 1) === 1 && k.channel_code)
              .map((k: any) => ({
                id_kelas_harga: Number(k.id_kelas_harga),
                channel_code: String(k.channel_code).toUpperCase(),
                nama: String(k.nama || k.channel_code),
              }))
          : [];
        setKelasHarga(normalized);
      } catch (err) {
        console.error("Failed load kelas harga", err);
        setKelasHarga([]);
      }
    };
    loadKelas();
  }, []);

  useEffect(() => {
    const loadMerk = async () => {
      try {
        const res = await fetch(`${API_BASE}/merk`);
        const data = res.ok ? await res.json() : [];
        const options = Array.isArray(data)
          ? data
              .filter((m: any) => m.id_merk != null && m.nama_merk)
              .map((m: any) => ({
                id_merk: String(m.id_merk),
                nama_merk: String(m.nama_merk),
              }))
          : [];
        setMerkOptions(options);
      } catch (err) {
        console.error("Failed load merk options", err);
        setMerkOptions([]);
      }
    };
    loadMerk();
  }, []);

  useEffect(() => {
    const prevOverflowX = document.body.style.overflowX;
    document.body.style.overflowX = "hidden";
    return () => {
      document.body.style.overflowX = prevOverflowX;
    };
  }, []);

  const filteredBarang = useMemo(() => {
    const trimmedSearch = search.trim();
    if (!selectedSupplier && !selectedMerk && !trimmedSearch) return [];
    const selectedMerkLabel = selectedMerk
      ? String(merkOptions.find((m) => m.id_merk === selectedMerk)?.nama_merk || "").toLowerCase()
      : "";
    const key = trimmedSearch.toLowerCase();
    const normalizeName = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
    const existingIds = new Set(drafts.map((d) => d.kode_barang_variant));
    const existingNames = new Set(
      drafts
        .map((d) => normalizeName(String(d.nama_barang || "")))
        .filter((name) => name)
    );
    return barangOptions.filter((b) => {
      if (existingIds.has(b.kode_barang_variant)) return false;
      const namaBarangKey = normalizeName(String(b.nama_barang || ""));
      if (namaBarangKey && existingNames.has(namaBarangKey)) return false;
      const stokGudang = Number(b.stok_gudang ?? 0);
      const stokToko = Number(b.stok_toko ?? 0);
      const matchStock = onlyInStock ? stokGudang + stokToko > 0 : true;
      const matchApproved = hideApproved ? Number(b.last_request_status ?? -1) !== 1 : true;
      const matchText = `${b.kode_barang} ${b.nama_barang} ${b.nama_varian} ${b.barcode_varian ?? ""}`
        .toLowerCase()
        .includes(key);
      const matchSupplier = selectedSupplier
        ? (b.kode_supplier || b.nama_supplier || "").toLowerCase() === selectedSupplier.toLowerCase()
        : true;
      const matchMerk = selectedMerk
        ? String(b.kode_merk || "").trim() === selectedMerk ||
          (selectedMerkLabel && String(b.nama_merk || "").toLowerCase() === selectedMerkLabel)
        : true;
      return matchStock && matchApproved && matchText && matchSupplier && matchMerk;
    });
  }, [barangOptions, search, selectedSupplier, selectedMerk, merkOptions, onlyInStock, hideApproved, drafts]);

  const barangByVariant = useMemo(
    () => new Map(barangOptions.map((barang) => [barang.kode_barang_variant, barang])),
    [barangOptions]
  );

  const supplierOptions = useMemo(() => {
    const map = new Map<string, { kode_supplier?: string; nama_supplier?: string }>();
    barangOptions.forEach((b) => {
      const key = (b.kode_supplier || b.nama_supplier || "").trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { kode_supplier: b.kode_supplier, nama_supplier: b.nama_supplier });
      }
    });
    return Array.from(map.values());
  }, [barangOptions]);

  const supplierSelectOptions = useMemo(
    () =>
      supplierOptions.map((s) => {
        const key = (s.kode_supplier || s.nama_supplier || "").trim();
        const label = s.nama_supplier || s.kode_supplier || key;
        return { value: key, label };
      }),
    [supplierOptions]
  );

  const merkSelectOptions = useMemo(
    () =>
      merkOptions.map((m) => ({
        value: m.id_merk,
        label: m.nama_merk,
      })),
    [merkOptions]
  );

  const isMarketplace = (channel: string) => MARKETPLACE_CHANNELS.includes(channel.toUpperCase());
  const totalChannelCols = CHANNELS.reduce((acc, ch) => acc + (isMarketplace(ch) ? 1 : 4), 0);
  const isEligibleBarang = (b: Barang) =>
    Boolean(b.harga_beli_sat_1) && Number(b.last_request_status ?? -1) !== 0;
  const formatRequestStatus = (status?: number | null) => {
    if (status === 1) return { label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (status === 2) return { label: "Rejected", className: "bg-rose-50 text-rose-700 border-rose-200" };
    if (status === 0) return { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" };
    return { label: "-", className: "bg-gray-50 text-gray-600 border-gray-200" };
  };
  const formatRequestDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("id-ID");
  };

  const toggleSelectAll = () => {
    const eligibleIds = filteredBarang.filter(isEligibleBarang).map((b) => b.kode_barang_variant);
    const allSelected = eligibleIds.every((id) => selectedIds.has(id)) && eligibleIds.length > 0;
    setSelectedIds(allSelected ? new Set() : new Set(eligibleIds));
  };

  const toggleSelect = (id: string) => {
    const target = filteredBarang.find((b) => b.kode_barang_variant === id);
    if (!target || !isEligibleBarang(target)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw);

      const cachedDrafts = Array.isArray(cached) ? cached : Array.isArray(cached?.drafts) ? cached.drafts : [];
      const cachedPercents = cached?.percentages;

      const normalized: DraftRow[] = cachedDrafts.map((row: any) => {
        const harga: DraftRow["harga"] = CHANNELS.reduce((acc, ch) => {
          const h = row.harga?.[ch] || {};
          acc[ch] = {
            h1: String(h.h1 ?? ""),
            h3: String(h.h3 ?? ""),
            h6: String(h.h6 ?? ""),
            h12: String(h.h12 ?? ""),
          };
          return acc;
        }, {} as DraftRow["harga"]);
        return {
          id_varian: row.id_varian ?? 0,
          kode_barang_variant: row.kode_barang_variant || row.kodeBarangVariant || "",
          kode_barang: row.kode_barang || "",
          nama_barang: row.nama_barang || row.namaBarang || row.nama || "",
          nama_varian: row.nama_varian || row.namaVarian || "",
          kode_merk: row.kode_merk,
          kode_supplier: row.kode_supplier,
          nama_supplier: row.nama_supplier,
          harga_beli_sat_1: row.harga_beli_sat_1,
          hpp_avg_sat_1: row.hpp_avg_sat_1,
          harga_het: row.harga_het,
          is_aktif: row.is_aktif ?? 1,
          harga_aktif: row.harga_aktif,
          harga,
        };
      });

      const normalizedPercents = CHANNELS.reduce((acc, ch) => {
        const p = cachedPercents?.[ch] || {};
        acc[ch] = {
          h1: String(p.h1 ?? ""),
          h3: String(p.h3 ?? ""),
          h6: String(p.h6 ?? ""),
          h12: String(p.h12 ?? ""),
        };
        return acc;
      }, {} as Record<string, { h1: string; h3: string; h6: string; h12: string }>);

      setDrafts(normalized);
      setPercentages(normalizedPercents);
    } catch (err) {
      console.error("Failed read cached drafts", err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          drafts,
          percentages,
        })
      );
    } catch (err) {
      console.error("Failed persist drafts", err);
    }
  }, [drafts, percentages]);

  const addSelected = () => {
    const toAdd = filteredBarang.filter((b) => selectedIds.has(b.kode_barang_variant));
    const existingIds = new Set(drafts.map((d) => d.kode_barang_variant));
    const newRows: DraftRow[] = toAdd
      .filter((b) => !existingIds.has(b.kode_barang_variant))
      .map((b) => ({
        ...b,
        harga: CHANNELS.reduce((acc, ch) => {
          acc[ch] = { h1: "", h3: "", h6: "", h12: "" };
          return acc;
        }, {} as Record<string, { h1: string; h3: string; h6: string; h12: string }>),
      }));
    setDrafts((prev) => [...prev, ...newRows]);
    setModalOpen(false);
    setSelectedIds(new Set());
  };

  const updatePrice = (
    kode_barang_variant: string,
    channel: string,
    field: keyof DraftRow["harga"][string],
    value: string
  ) => {
    const cleaned = value.replace(/[^\d]/g, "");
    setDrafts((prev) =>
      prev.map((row) =>
        row.kode_barang_variant === kode_barang_variant
          ? { ...row, harga: { ...row.harga, [channel]: { ...row.harga[channel], [field]: cleaned } } }
          : row
      )
    );
  };

  const applyPercentToDrafts = (channel: string, field: keyof typeof percentDefaults, value: string) => {
    const pct = Number(value);
    if (!value || Number.isNaN(pct)) return;
    setDrafts((prev) =>
      prev.map((row) => {
        const base = Number(row.harga_beli_sat_1 ?? 0);
        if (!base) return row;
        const harga = Math.round(base * (1 + pct / 100));
        return {
          ...row,
          harga: {
            ...row.harga,
            [channel]: {
              ...row.harga[channel],
              [field]: harga.toLocaleString("id-ID"),
            },
          },
        };
      })
    );
  };

  const updatePercent = (channel: string, field: keyof typeof percentDefaults, value: string) => {
    setPercentages((prev) => ({
      ...prev,
      [channel]: { ...prev[channel], [field]: value },
    }));
    applyPercentToDrafts(channel, field, value);
  };

  const [hetPercent, setHetPercent] = useState<string>("");

  const applyHetPercent = (value: string) => {
    setHetPercent(value);
    const pct = Number(value);
    if (!value || Number.isNaN(pct)) return;
    setDrafts((prev) =>
      prev.map((row) => {
        const base = Number(row.harga_beli_sat_1 ?? 0);
        if (!base) return row;
        const harga = Math.round(base * (1 + pct / 100));
        return { ...row, harga_het: harga };
      })
    );
  };

  const roundHetToHundreds = () => {
    setDrafts((prev) =>
      prev.map((row) => {
        const val = Number(row.harga_het ?? 0);
        if (!val) return row;
        const rounded = Math.round(val / 100) * 100;
        return { ...row, harga_het: rounded };
      })
    );
  };

  const roundColumn = (channel: string, field: keyof DraftRow["harga"][string], step: number) => {
    setDrafts((prev) =>
      prev.map((row) => {
        const raw = row.harga[channel]?.[field] || "";
        const num = parseNumber(raw);
        if (num === null) return row;
        const rounded = Math.round(num / step) * step;
        return {
          ...row,
          harga: {
            ...row.harga,
            [channel]: {
              ...row.harga[channel],
              [field]: rounded.toLocaleString("id-ID"),
            },
          },
        };
      })
    );
  };

  const parseNumber = (val: string) => {
    const cleaned = val.replace(/[^\d]/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  const formatPercentFromBase = (base?: number, value?: string) => {
    const baseNum = Number(base ?? 0);
    const num = value ? parseNumber(value) : null;
    if (!baseNum || num === null) return "-";
    return `${((num / baseNum) * 100).toFixed(1)}%`;
  };

  const formatActivePrice = (row: DraftRow, channel: string, field: keyof HargaFields) => {
    const active =
      row.harga_aktif?.[channel]?.[field] ?? barangByVariant.get(row.kode_barang_variant)?.harga_aktif?.[channel]?.[field];
    return active ? formatRupiah(active) : "-";
  };

  const renderPriceMeta = (row: DraftRow, channel: string, field: keyof DraftRow["harga"][string]) => {
    const percent = formatPercentFromBase(row.harga_beli_sat_1, row.harga[channel]?.[field]);
    return (
      <div className="min-h-[30px] leading-tight">
        <div className="text-[11px] font-semibold text-gray-700">{formatActivePrice(row, channel, field)}</div>
        {percent !== "-" && <div className="text-[10px] text-gray-500">{percent}</div>}
      </div>
    );
  };

  const formatCurrency = (val: string) => {
    const num = parseNumber(val);
    if (num === null) return "";
    return num.toLocaleString("id-ID");
  };

  const formatPrice = (kode_barang_variant: string, channel: string, field: keyof DraftRow["harga"][string]) => {
    setDrafts((prev) =>
      prev.map((row) =>
        row.kode_barang_variant === kode_barang_variant
          ? {
              ...row,
              harga: {
                ...row.harga,
                [channel]: {
                  ...row.harga[channel],
                  [field]: formatCurrency(row.harga[channel][field] || ""),
                },
              },
            }
          : row
      )
    );
  };

  const updateHet = (kode_barang_variant: string, value: string) => {
    const cleaned = value.replace(/[^\d]/g, "");
    setDrafts((prev) =>
      prev.map((row) =>
        row.kode_barang_variant === kode_barang_variant
          ? { ...row, harga_het: cleaned ? Number(cleaned) : undefined }
          : row
      )
    );
  };

  const formatHet = (kode_barang_variant: string) => {
    setDrafts((prev) =>
      prev.map((row) =>
        row.kode_barang_variant === kode_barang_variant
          ? {
              ...row,
              harga_het:
                row.harga_het === null || row.harga_het === undefined
                  ? undefined
                  : Number(String(row.harga_het).replace(/[^\d]/g, "")),
            }
          : row
      )
    );
  };

  const handleSubmitRequest = async () => {
    if (!drafts.length) {
      Swal.fire({ icon: "warning", title: "Belum ada barang", text: "Tambahkan barang terlebih dahulu." });
      return;
    }
    const kelasMap = new Map(kelasHarga.map((k) => [k.channel_code.toUpperCase(), k.id_kelas_harga]));
    const missingChannels = CHANNELS.filter((ch) => !kelasMap.has(ch.toUpperCase()));
    if (missingChannels.length) {
      Swal.fire({
        icon: "error",
        title: "Kelas harga belum lengkap",
        text: `Channel belum ada di kelas harga: ${missingChannels.join(", ")}`,
      });
      return;
    }

    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let requestedBy = "Admin";
    if (rawSession) {
      try {
        const session = JSON.parse(rawSession);
        requestedBy = session?.username || session?.name || requestedBy;
      } catch {
        // ignore
      }
    }

    const items = drafts.flatMap((row) =>
      CHANNELS.map((ch) => {
        const h = row.harga[ch] || {};
        const idKelas = kelasMap.get(ch.toUpperCase()) || 0;
        const harga1 = parseNumber(h.h1 || "");
        const harga3 = parseNumber(h.h3 || "");
        const harga6 = parseNumber(h.h6 || "");
        const harga12 = parseNumber(h.h12 || "");
        return {
          kode_barang_variant: row.kode_barang_variant,
          id_kelas_harga: idKelas,
          harga_1: harga1,
          harga_3: isMarketplace(ch) ? null : harga3,
          harga_6: isMarketplace(ch) ? null : harga6,
          harga_12: isMarketplace(ch) ? null : harga12,
          harga_beli_snapshot: row.harga_beli_sat_1 ?? null,
          hpp_snapshot: row.hpp_avg_sat_1 ?? null,
        };
      })
    );

    const filteredItems = items.filter((it) => it.id_kelas_harga && it.kode_barang_variant);
    if (!filteredItems.length) {
      Swal.fire({ icon: "error", title: "Data kosong", text: "Tidak ada item yang bisa diajukan." });
      return;
    }

    setSavingRequest(true);
    try {
      const res = await fetch(`${API_BASE}/harga-jual-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_by: requestedBy,
          items: filteredItems,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      let hetSyncFailed = false;
      const hetPayloads = drafts
        .filter((row) => row.harga_het !== null && row.harga_het !== undefined)
        .map((row) => ({
          kode_barang_variant: row.kode_barang_variant,
          het_sat_1: row.harga_het,
          updated_by: requestedBy,
        }));
      for (const payload of hetPayloads) {
        try {
          const hetRes = await fetch(`${API_BASE}/barang-kelas-harga/live-edit`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!hetRes.ok) {
            hetSyncFailed = true;
          }
        } catch (err) {
          console.error("Failed sync HET", err);
          hetSyncFailed = true;
        }
      }

      if (hetSyncFailed) {
        await Swal.fire({
          icon: "warning",
          title: "Request dikirim",
          text: "Beberapa HET gagal tersimpan. Silakan coba sinkron ulang HET.",
        });
      } else {
        await Swal.fire({ icon: "success", title: "Request dikirim", timer: 1200, showConfirmButton: false });
      }
      setDrafts([]);
      setPercentages(buildDefaultPercents());
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (err) {
      console.error("Failed submit harga jual request", err);
      Swal.fire({ icon: "error", title: "Gagal mengirim request" });
    } finally {
      setSavingRequest(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Master Harga Jual</p>
          <h1 className="text-2xl font-bold text-gray-900">Tambah Harga Jual (Multi Barang)</h1>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Tambah Barang
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Daftar barang yang akan diisi harga</p>
            <p className="text-base font-semibold text-gray-800">Total {drafts.length} barang</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDrafts([]);
                setPercentages(buildDefaultPercents());
                localStorage.removeItem(DRAFT_STORAGE_KEY);
              }}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-red-600 hover:bg-red-50"
            >
              Clear Tabel
            </button>
            <button
              type="button"
              onClick={handleSubmitRequest}
              disabled={savingRequest}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-60"
            >
              Ajukan Approval
            </button>
          </div>
        </div>

        <div className="w-full overflow-hidden">
          <div className="w-full max-w-[calc(100vw-2rem)] mx-auto pb-2">
            <div className="max-h-[60vh] overflow-auto">
              <div className="min-w-full overflow-x-auto">
                <table className="w-full min-w-[1600px] text-left border border-gray-300">
                  <thead className="sticky top-0 z-20 bg-gray-50">
                    <tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                      <th className="w-16 px-3 py-3 border border-gray-300 sticky left-0 bg-gray-50 z-30" rowSpan={4}>
                        Aksi
                      </th>
                      <th className="px-4 py-3 border border-gray-300 sticky left-16 bg-gray-50 z-30 min-w-[260px]" rowSpan={4}>
                        Nama Barang
                      </th>
                      <th className="px-4 py-3 border border-gray-300 min-w-[140px]" rowSpan={4}>
                        Harga Beli
                      </th>
                      <th className="px-4 py-3 border border-gray-300 min-w-[140px]" rowSpan={4}>
                        HPP AVG
                      </th>
                      <th className="px-4 py-3 border border-gray-300 min-w-[140px]" rowSpan={4}>
                        <div className="flex items-center justify-center gap-2">
                          <span>HET</span>
                          <input
                            value={hetPercent}
                            onChange={(e) => applyHetPercent(e.target.value)}
                            className="w-14 text-center border border-gray-200 rounded px-1 py-0.5 bg-white"
                            type="number"
                          />
                          <span className="text-xs text-gray-500">%</span>
                          <button
                            type="button"
                            onClick={roundHetToHundreds}
                            className="ml-1 px-2 py-0.5 rounded-full border border-gray-200 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            Bulatkan ratusan
                          </button>
                        </div>
                      </th>
                      {CHANNELS.map((ch, idx) => (
                        <th
                          key={ch}
                          className="px-4 py-3 text-center border border-gray-300"
                          style={{ backgroundColor: HEADER_COLORS[idx % HEADER_COLORS.length] }}
                          colSpan={isMarketplace(ch) ? 1 : 4}
                        >
                          Harga Jual {ch}
                        </th>
                      ))}
                    </tr>
                    <tr className="text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50">
                      {CHANNELS.map((ch, idx) => (
                        <React.Fragment key={`${ch}-round`}> 
                          {isMarketplace(ch) ? (
                            <th
                              className="px-2 py-2 text-center border border-gray-300 border-r-4 border-r-gray-300"
                              style={{ backgroundColor: HEADER_COLORS[idx % HEADER_COLORS.length] }}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => roundColumn(ch, "h1", 100)}
                                  className="px-2 py-0.5 rounded-full border border-gray-200 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                                >
                                  B ratus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => roundColumn(ch, "h1", 1000)}
                                  className="px-2 py-0.5 rounded-full border border-gray-200 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                                >
                                  B ribu
                                </button>
                              </div>
                            </th>
                          ) : (
                            <>
                              {(["h1", "h3", "h6", "h12"] as const).map((tierKey) => (
                                <th
                                  key={`${ch}-${tierKey}-round`}
                                  className={`px-2 py-2 text-center border border-gray-300 ${
                                    tierKey === "h12" ? "border-r-4 border-r-gray-300" : ""
                                  }`}
                                  style={{ backgroundColor: HEADER_COLORS[idx % HEADER_COLORS.length] }}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => roundColumn(ch, tierKey, 100)}
                                      className="px-2 py-0.5 rounded-full border border-gray-200 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                                    >
                                      B ratus
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => roundColumn(ch, tierKey, 1000)}
                                      className="px-2 py-0.5 rounded-full border border-gray-200 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                                    >
                                      B ribu
                                    </button>
                                  </div>
                                </th>
                              ))}
                            </>
                          )}
                        </React.Fragment>
                      ))}
                    </tr>

                    <tr className="text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50">
                      {CHANNELS.map((ch, idx) => (
                        <React.Fragment key={`${ch}-percents`}>
                          {isMarketplace(ch) ? (
                            <th
                              className="px-2 py-2 text-center border border-gray-300 border-r-4 border-r-gray-300"
                              style={{ backgroundColor: HEADER_COLORS[idx % HEADER_COLORS.length] }}
                            >
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      value={percentages[ch].h1}
                                      onChange={(e) => updatePercent(ch, "h1", e.target.value)}
                                      type="number"
                                      className="w-16 text-right border border-gray-200 rounded px-1 py-0.5 bg-white"
                                    />
                                    <span className="text-gray-600">%</span>
                                  </div>
                                </th>
                              ) : (
                            <>
                              {(["h1", "h3", "h6", "h12"] as const).map((tierKey) => (
                                <th
                                  key={`${ch}-${tierKey}-pct`}
                                  className={`px-2 py-2 text-center border border-gray-300 ${
                                    tierKey === "h12" ? "border-r-4 border-r-gray-300" : ""
                                  }`}
                                  style={{ backgroundColor: HEADER_COLORS[idx % HEADER_COLORS.length] }}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      value={percentages[ch][tierKey]}
                                      onChange={(e) => updatePercent(ch, tierKey, e.target.value)}
                                      type="number"
                                      className="w-16 text-right border border-gray-200 rounded px-1 py-0.5 bg-white"
                                    />
                                    <span className="text-gray-600">%</span>
                                  </div>
                                </th>
                              ))}
                            </>
                          )}
                        </React.Fragment>
                      ))}
                    </tr>
                    <tr className="text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50">
                      {CHANNELS.map((ch, idx) => (
                        <React.Fragment key={`${ch}-tiers`}>
                          {isMarketplace(ch) ? (
                            <th
                              className="px-2 py-2 text-center border border-gray-300 border-r-4 border-r-gray-300"
                              style={{ backgroundColor: HEADER_COLORS[idx % HEADER_COLORS.length] }}
                            >
                              PCS
                            </th>
                          ) : (
                            <>
                              <th
                                className="px-2 py-2 text-center border border-gray-300"
                                style={{ backgroundColor: HEADER_COLORS[idx % HEADER_COLORS.length] }}
                              >
                                1 PCS
                              </th>
                              <th
                                className="px-2 py-2 text-center border border-gray-300"
                                style={{ backgroundColor: HEADER_COLORS[idx % HEADER_COLORS.length] }}
                              >
                                3 PCS
                              </th>
                              <th
                                className="px-2 py-2 text-center border border-gray-300"
                                style={{ backgroundColor: HEADER_COLORS[idx % HEADER_COLORS.length] }}
                              >
                                6 PCS
                              </th>
                              <th
                                className="px-2 py-2 text-center border border-gray-300 border-r-4 border-r-gray-300"
                                style={{ backgroundColor: HEADER_COLORS[idx % HEADER_COLORS.length] }}
                              >
                                12 PCS
                              </th>
                            </>
                          )}
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {drafts.map((row) => (
                      <tr key={row.kode_barang_variant} className="hover:bg-gray-50">
                        <td className="w-16 px-3 py-3 border border-gray-200 sticky left-0 bg-white z-20 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setDrafts((prev) => prev.filter((r) => r.kode_barang_variant !== row.kode_barang_variant))
                            }
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                            aria-label={`Hapus ${row.nama_barang}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-4 py-3 border border-gray-200 sticky left-16 bg-white z-10 min-w-[260px] max-w-[320px]">
                          <div className="font-semibold text-gray-900">{row.nama_barang}</div>
                          <div className="text-xs text-gray-500">{row.nama_varian}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-800 border border-gray-200 min-w-[140px]">
                          {row.harga_beli_sat_1 ? formatRupiah(row.harga_beli_sat_1) : "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-800 border border-gray-200 min-w-[140px]">
                          {row.hpp_avg_sat_1 ? formatRupiah(row.hpp_avg_sat_1) : "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-800 border border-gray-200 min-w-[140px]">
                          <input
                            value={row.harga_het !== null && row.harga_het !== undefined ? row.harga_het.toLocaleString("id-ID") : ""}
                            onChange={(e) => updateHet(row.kode_barang_variant, e.target.value)}
                            onBlur={() => formatHet(row.kode_barang_variant)}
                            className="w-28 text-center border rounded px-2 py-1 bg-white"
                            type="text"
                          />
                        </td>
                        {CHANNELS.map((ch, idx) => {
                          const tone = BODY_COLORS[idx % BODY_COLORS.length];
                          const h = row.harga[ch];
                          if (isMarketplace(ch)) {
                            return (
                              <React.Fragment key={`${row.kode_barang_variant}-${ch}`}>
                                <td
                                  className="px-2 py-3 text-center border border-gray-200 border-r-4 border-r-gray-300"
                                  style={{ backgroundColor: tone }}
                                >
                                  <div className="flex flex-col items-center gap-1">
                                    {renderPriceMeta(row, ch, "h1")}
                                    <input
                                      value={h.h1}
                                      onChange={(e) => updatePrice(row.kode_barang_variant, ch, "h1", e.target.value)}
                                      onBlur={() => formatPrice(row.kode_barang_variant, ch, "h1")}
                                      className="w-24 text-center border rounded px-2 py-1"
                                      type="text"
                                    />
                                  </div>
                                </td>
                              </React.Fragment>
                            );
                          }

                          return (
                            <React.Fragment key={`${row.kode_barang_variant}-${ch}`}>
                              <td className={`px-2 py-3 text-center border border-gray-200`} style={{ backgroundColor: tone }}>
                                <div className="flex flex-col items-center gap-1">
                                  {renderPriceMeta(row, ch, "h1")}
                                  <input
                                    value={h.h1}
                                    onChange={(e) => updatePrice(row.kode_barang_variant, ch, "h1", e.target.value)}
                                    onBlur={() => formatPrice(row.kode_barang_variant, ch, "h1")}
                                    className="w-24 text-center border rounded px-2 py-1 bg-white"
                                    type="text"
                                  />
                                </div>
                              </td>
                              <td className={`px-2 py-3 text-center border border-gray-200`} style={{ backgroundColor: tone }}>
                                <div className="flex flex-col items-center gap-1">
                                  {renderPriceMeta(row, ch, "h3")}
                                  <input
                                    value={h.h3}
                                    onChange={(e) => updatePrice(row.kode_barang_variant, ch, "h3", e.target.value)}
                                    onBlur={() => formatPrice(row.kode_barang_variant, ch, "h3")}
                                    className="w-24 text-center border rounded px-2 py-1 bg-white"
                                    type="text"
                                  />
                                </div>
                              </td>
                              <td className={`px-2 py-3 text-center border border-gray-200`} style={{ backgroundColor: tone }}>
                                <div className="flex flex-col items-center gap-1">
                                  {renderPriceMeta(row, ch, "h6")}
                                  <input
                                    value={h.h6}
                                    onChange={(e) => updatePrice(row.kode_barang_variant, ch, "h6", e.target.value)}
                                    onBlur={() => formatPrice(row.kode_barang_variant, ch, "h6")}
                                    className="w-24 text-center border rounded px-2 py-1 bg-white"
                                    type="text"
                                  />
                                </div>
                              </td>
                              <td
                                className={`px-2 py-3 text-center border border-gray-200 border-r-4 border-r-gray-300`}
                                style={{ backgroundColor: tone }}
                              >
                                <div className="flex flex-col items-center gap-1">
                                  {renderPriceMeta(row, ch, "h12")}
                                  <input
                                    value={h.h12}
                                    onChange={(e) => updatePrice(row.kode_barang_variant, ch, "h12", e.target.value)}
                                    onBlur={() => formatPrice(row.kode_barang_variant, ch, "h12")}
                                    className="w-24 text-center border rounded px-2 py-1 bg-white"
                                    type="text"
                                  />
                                </div>
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                    {drafts.length === 0 && (
                      <tr>
                      <td className="px-4 py-6 text-center text-gray-500 border border-gray-200" colSpan={5 + totalChannelCols}>
                        Belum ada barang. Klik &quot;Tambah Barang&quot; untuk memilih.
                      </td>
                    </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-7xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pilih Barang</p>
                <h2 className="text-xl font-bold text-gray-900">Tambah ke daftar harga</h2>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Tutup">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex items-center gap-2 border-2 border-gray-200 rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari barang / barcode"
                  className="w-full outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <div className="min-w-[220px]">
                  <Select
                    instanceId="filter-supplier"
                    options={supplierSelectOptions}
                    value={supplierSelectOptions.find((opt) => opt.value === selectedSupplier) || null}
                    onChange={(opt: SingleValue<{ value: string; label: string }>) =>
                      setSelectedSupplier(opt?.value || "")
                    }
                    isClearable
                    placeholder="Semua supplier"
                    classNamePrefix="react-select"
                  />
                </div>
                <div className="min-w-[200px]">
                  <Select
                    instanceId="filter-merk"
                    options={merkSelectOptions}
                    value={merkSelectOptions.find((opt) => opt.value === selectedMerk) || null}
                    onChange={(opt: SingleValue<{ value: string; label: string }>) =>
                      setSelectedMerk(opt?.value || "")
                    }
                    isClearable
                    placeholder="Semua merk"
                    classNamePrefix="react-select"
                  />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                />
                Hanya stok &gt; 0
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={hideApproved}
                  onChange={(e) => setHideApproved(e.target.checked)}
                />
                Sembunyikan Approved
              </label>
              <button
                type="button"
                onClick={handleSyncHargaBeli}
                disabled={loading || syncingHargaBeli}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {syncingHargaBeli ? "Syncing..." : "Sync Harga Beli"}
              </button>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {selectedIds.size === filteredBarang.length && filteredBarang.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400" />
                )}
                Pilih semua ({filteredBarang.filter(isEligibleBarang).length})
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="max-h-[50vh] overflow-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 w-10"></th>
                      <th className="px-3 py-2">Nama Barang</th>
                      <th className="px-3 py-2">Nama Varian</th>
                      <th className="px-3 py-2">Barcode</th>
                      <th className="px-3 py-2">Pengajuan Terakhir</th>
                      <th className="px-3 py-2">Status Terakhir</th>
                      <th className="px-3 py-2 text-right">Stok Gudang</th>
                      <th className="px-3 py-2 text-right">Stok Toko</th>
                      <th className="px-3 py-2 text-right">Harga Beli</th>
                      <th className="px-3 py-2 text-right">HPP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {filteredBarang.map((b) => (
                      <tr
                        key={b.kode_barang_variant}
                        className={`hover:bg-gray-50 ${
                          Number(b.last_request_status ?? -1) === 0
                            ? "bg-amber-50"
                            : b.harga_beli_sat_1
                            ? ""
                            : "bg-[#ffe0ef]"
                        }`}
                      >
                        <td className="px-3 py-2">
                          {isEligibleBarang(b) ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(b.kode_barang_variant)}
                              onChange={() => toggleSelect(b.kode_barang_variant)}
                              className="w-4 h-4"
                            />
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{b.nama_barang}</td>
                        <td className="px-3 py-2">{b.nama_varian}</td>
                        <td className="px-3 py-2 text-gray-700">{b.barcode_varian || "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{formatRequestDate(b.last_request_at)}</td>
                        <td className="px-3 py-2">
                          {(() => {
                            const badge = formatRequestStatus(b.last_request_status ?? null);
                            return (
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                                {badge.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2 text-right">{Number(b.stok_gudang ?? 0).toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2 text-right">{Number(b.stok_toko ?? 0).toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2 text-right">{b.harga_beli_sat_1 ? formatRupiah(b.harga_beli_sat_1) : "-"}</td>
                        <td className="px-3 py-2 text-right">{b.hpp_avg_sat_1 ? formatRupiah(b.hpp_avg_sat_1) : "-"}</td>
                      </tr>
                    ))}
                    {filteredBarang.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-center text-gray-500" colSpan={10}>
                          {!selectedSupplier && !selectedMerk && !search.trim()
                            ? "Cari barcode/nama barang atau pilih supplier/merk terlebih dahulu."
                            : "Tidak ada barang."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={addSelected}
                disabled={selectedIds.size === 0}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg disabled:opacity-60"
              >
                Tambahkan ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRupiah(value: number) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("id-ID");
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
