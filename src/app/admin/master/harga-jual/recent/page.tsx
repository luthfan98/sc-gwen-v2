"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReceiptText, Filter, Plus, ShieldCheck, Eye, CalendarClock } from "lucide-react";
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
  approved_at?: string | null;
  approved_by?: string | null;
  changed_at?: string | null;
  changed_by?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const API_MASTER = `${API_BASE}/barang-harga-jual`;
const API_RECENT = `${API_BASE}/barang-harga-jual/recent`;
const API_HISTORY = `${API_MASTER}/history`;
const API_COVERAGE = `${API_MASTER}/coverage`;

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("id-ID");
};

export default function MasterHargaJualPage() {
  const [items, setItems] = useState<HargaJual[]>([]);
  const [search, setSearch] = useState("");
  const [kelasFilter, setKelasFilter] = useState("OFFLINE");
  const [statusFilter, setStatusFilter] = useState("semua");
  const [merkFilter, setMerkFilter] = useState("semua");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<HargaJual | null>(null);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  const roleLower = String(roleName || "").toLowerCase();
  const canLiveEdit = roleLower === "super_admin";
  const [liveEdit, setLiveEdit] = useState(false);
  const [savingCell, setSavingCell] = useState<Record<string, boolean>>({});
  const [bulkHetSaving, setBulkHetSaving] = useState(false);
  const [bulkHetPercent, setBulkHetPercent] = useState(120);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showHetBelowOfflineOnly, setShowHetBelowOfflineOnly] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printLayout, setPrintLayout] = useState<"single" | "double">("single");
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDateInput(d);
  });
  const [dateTo, setDateTo] = useState(() => formatDateInput(new Date()));

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("start", dateFrom);
      if (dateTo) params.set("end", dateTo);
      const url = `${API_RECENT}?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error("Invalid response");
      }
      setItems(data as HargaJual[]);
    } catch (err) {
      console.error("Failed fetch recent harga jual", err);
      setError("Gagal memuat perubahan harga terbaru dari server.");
      setItems([]);
    } finally {
      setLoading(false);
    }
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

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);


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
      const res = await fetch(`${API_MASTER}/live-edit`, {
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
        const res = await fetch(`${API_MASTER}/live-edit`, {
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

  const openDetail = async (row: any) => {
    setDetailRow(row as HargaJual);
    setDetailOpen(true);
    setHistoryItems([]);
    setHistoryError(null);
    if (!row.kode_barang_variant) return;
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

  const kelasOptions = useMemo(() => {
    const uniq = new Map<string, string>();
    items.forEach((i) => {
      if (i.kode_kelas_harga) uniq.set(i.kode_kelas_harga, i.nama_kelas || i.kode_kelas_harga);
    });
    return Array.from(uniq.entries()).map(([value, label]) => ({ value, label }));
  }, [items]);

  useEffect(() => {
    if (!items.length) return;
    if (kelasFilter === "OFFLINE") {
      const hasOffline = kelasOptions.some((opt) => opt.value === "OFFLINE");
      if (!hasOffline) setKelasFilter("semua");
    }
  }, [items, kelasOptions, kelasFilter]);

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
      const matchKelas = kelasFilter === "semua" || item.kode_kelas_harga === kelasFilter;
      const matchStatus =
        statusFilter === "semua" ||
        (statusFilter === "aktif" ? item.is_active === 1 : item.is_active !== 1);
      const matchMerk = merkFilter === "semua" || String(item.kode_merk || "").trim() === merkFilter;
      return matchText && matchKelas && matchStatus && matchMerk;
    });
  }, [items, search, kelasFilter, statusFilter, merkFilter]);

  const totalAktif = items.filter((item) => item.is_active === 1).length;

  const normalizeKey = (value: unknown) => String(value ?? "").trim();

  const toggleAllSelected = (checked: boolean) => {
    if (!checked) {
      setSelectedVariants(new Set());
      return;
    }
    setSelectedVariants(new Set(pagedRows.map((row) => normalizeKey(row.kode_barang_variant))));
  };

  const toggleSelected = (kode: string, checked: boolean) => {
    setSelectedVariants((prev) => {
      const next = new Set(prev);
      const key = normalizeKey(kode);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const handlePrintPriceTag = (layout: "single" | "double") => {
    const selectedRows = displayedRows.filter((row) => selectedVariants.has(normalizeKey(row.kode_barang_variant)));
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
    const map = new Map<
      string,
      {
        kode_barang_variant: string;
        nama_barang?: string;
        kode_barang?: string;
        nama_varian?: string;
        kode_varian?: string;
        barcode_varian?: string;
        kode_merk?: string;
        nama_merk?: string;
        harga_beli?: number;
        het?: number;
        hpp?: number;
        stok_gudang?: number;
        stok_toko?: number;
        status_barang?: number;
        status_varian?: number;
        status_pengajuan?: number | null;
        approved_at?: string | null;
        approved_by?: string | null;
        harga: Record<string, { id_kelas_harga: number; h1: number; h3: number; h6: number; h12: number }>;
      }
    >();

    filteredItems.forEach((it) => {
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
          approved_at: it.approved_at ?? null,
          approved_by: it.approved_by ?? null,
          harga: {},
        });
      }
      const entry = map.get(key)!;
      const channel = it.channel_code || "N/A";
      entry.harga[channel] = {
        id_kelas_harga: it.id_kelas_harga,
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
      if (it.approved_at) {
        if (!entry.approved_at || new Date(it.approved_at) > new Date(entry.approved_at)) {
          entry.approved_at = it.approved_at;
          entry.approved_by = it.approved_by ?? entry.approved_by ?? null;
        }
      }
    });

    return Array.from(map.values());
  }, [filteredItems]);

  const isHetBelowOffline = (row: {
    het?: number;
    harga: Record<string, { id_kelas_harga: number; h1: number; h3: number; h6: number; h12: number }>;
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

  const displayedRows = useMemo(() => {
    if (!showHetBelowOfflineOnly) return groupedByVarian;
    return groupedByVarian.filter((row) => isHetBelowOffline(row));
  }, [groupedByVarian, showHetBelowOfflineOnly]);

  const summaryDisplay = useMemo(() => {
    const total = displayedRows.length;
    const aktif = displayedRows.filter((row) => row.status_barang === 1 && row.status_varian === 1).length;
    const hetBelow = displayedRows.filter((row) => isHetBelowOffline(row)).length;
    return { total, aktif, hetBelow };
  }, [displayedRows]);

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
      case "approved_at":
        return row.approved_at ? new Date(row.approved_at).getTime() : 0;
      case "approved_by":
        return String(row.approved_by ?? "");
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

  const totalPages = Math.max(1, Math.ceil(displayedRows.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);
  const rangeStart = displayedRows.length ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, displayedRows.length);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, kelasFilter, statusFilter, merkFilter, showHetBelowOfflineOnly, pageSize, dateFrom, dateTo]);

  const handleOpenPrintModal = () => {
    const selectedRows = displayedRows.filter((row) => selectedVariants.has(normalizeKey(row.kode_barang_variant)));
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
      "Nama",
      "Merk",
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
        const nama = match
          ? `${match.nama_barang || ""}${match.nama_varian ? ` - ${match.nama_varian}` : ""}`
          : `${row.nama_barang || ""}${row.nama_varian ? ` - ${row.nama_varian}` : ""}`;
        const merk = match?.nama_merk || match?.kode_merk || row.nama_merk || "";
        return [
          idx + 1,
          nama,
          merk,
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

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Harga Jual</p>
          <h1 className="text-2xl font-bold text-gray-900">Perubahan Harga Terbaru</h1>
          <p className="text-sm text-gray-600">Daftar item yang baru di-set harga dalam rentang tanggal.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold shadow-sm hover:bg-gray-50 transition-all"
          >
            Export Excel
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
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
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Total Item (Filter)"
          value={`${summaryDisplay.total} item`}
          accent="from-[#3FE0D0] to-[#2DD4C4]"
        />
        <SummaryCard
          title="Item Aktif"
          value={`${summaryDisplay.aktif} item`}
          accent="from-emerald-400 to-teal-400"
        />
        <SummaryCard
          title="HET < Offline"
          value={`${summaryDisplay.hetBelow} item`}
          accent="from-amber-300 to-orange-400"
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <ReceiptText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Perubahan Harga Terbaru</p>
              <p className="text-base font-semibold text-gray-800">
                Pantau harga per barang & kelas {loading ? "(memuat...)" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="w-4 h-4" />
            {loading ? "Memuat..." : "Sinkron server"}
          </div>
        </div>

        {error && (
          <div className="bg-amber-50 border-b border-amber-100 text-amber-800 text-sm px-4 py-3">
            {error}
          </div>
        )}

        <div className="px-4 py-3 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-gray-600 font-semibold text-sm">
            <Filter className="w-4 h-4" /> Filter
          </div>
          <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto">
            <div className="flex-1 min-w-[200px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari barcode varian / nama varian"
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border-2 border-gray-200 px-3 py-2.5">
              <CalendarClock className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm outline-none"
              />
              <span className="text-xs text-gray-400">s/d</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm outline-none"
              />
            </div>
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
              options={[{ label: "Semua kelas", value: "semua" }, ...kelasOptions]}
            />
          </div>
        </div>

        <div className="px-4 pb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
          <div>
            Menampilkan {rangeStart} - {rangeEnd} dari {displayedRows.length} item
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

        <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
          <table className="min-w-[1100px] text-left border border-gray-300">
            <thead>
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
                <th className="px-4 py-3 border border-gray-300 sticky left-[112px] bg-gray-50 z-10" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("nama_barang")} className="flex items-center gap-1">
                    Nama Barang <span className="text-[10px]">{sortIndicator("nama_barang")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 border border-gray-300" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("nama_merk")} className="flex items-center gap-1">
                    Merk <span className="text-[10px]">{sortIndicator("nama_merk")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 border border-gray-300" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("barcode_varian")} className="flex items-center gap-1">
                    Barcode Varian <span className="text-[10px]">{sortIndicator("barcode_varian")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 border border-gray-300 sticky left-[352px] bg-gray-50 z-10" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("nama_varian")} className="flex items-center gap-1">
                    Nama Varian <span className="text-[10px]">{sortIndicator("nama_varian")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 border border-gray-300" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("status")} className="flex items-center gap-1">
                    Status Aktif <span className="text-[10px]">{sortIndicator("status")}</span>
                  </button>
                </th>
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
                <th className="px-4 py-3 border border-gray-300" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("approved_at")} className="flex items-center gap-1">
                    Approved Pada <span className="text-[10px]">{sortIndicator("approved_at")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 border border-gray-300" rowSpan={2}>
                  <button type="button" onClick={() => toggleSort("approved_by")} className="flex items-center gap-1">
                    Approved Oleh <span className="text-[10px]">{sortIndicator("approved_by")}</span>
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
                    Harga Jual Kelas {ch}
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
              {pagedRows.map((row) => {
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
                        onChange={(e) => toggleSelected(row.kode_barang_variant, e.target.checked)}
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
                      className={`px-4 py-3 border border-gray-200 sticky left-[112px] z-10 ${stickyBg}`}
                    >
                      <div className="font-semibold text-gray-900">{row.nama_barang || "-"}</div>
                    </td>
                    <td className="px-4 py-3 border border-gray-200">
                      {row.nama_merk || row.kode_merk || "-"}
                    </td>
                    <td className="px-4 py-3 border border-gray-200">
                      {row.barcode_varian || "-"}
                    </td>
                    <td
                      className={`px-4 py-3 border border-gray-200 sticky left-[352px] z-10 ${stickyBg}`}
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
                    <td className="px-4 py-3 text-gray-800 border border-gray-200 text-center">
                      {row.approved_at ? formatDate(row.approved_at) : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-800 border border-gray-200">
                      {row.approved_by || "-"}
                    </td>
                    {channelList.map((ch, chIdx) => {
                      const tone = chIdx % 2 === 0 ? "bg-[#f7fffd]" : "bg-[#f9fbff]";
                      const h = row.harga[ch];
                      const hargaKeyBase = `${row.kode_barang_variant}-${ch}`;
                      return (
                        <React.Fragment key={`${row.kode_barang_variant}-${ch}`}>
                          <td className={`px-2 py-3 text-center text-gray-900 font-semibold border border-gray-200 ${tone}`}>
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
                          </td>
                          <td className={`px-2 py-3 text-center text-gray-900 font-semibold border border-gray-200 ${tone}`}>
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
                          </td>
                          <td className={`px-2 py-3 text-center text-gray-900 font-semibold border border-gray-200 ${tone}`}>
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
                          </td>
                          <td
                            className={`px-2 py-3 text-center text-gray-900 font-semibold border border-gray-200 ${tone} border-r-4 border-r-gray-300`}
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
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
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
                            <td className="px-3 py-2 text-gray-700">{h.changed_at ? String(h.changed_at).slice(0, 19) : "-"}</td>
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
    <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm flex items-center gap-3">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center font-bold`}>
        {value.split(" ")[0]}
      </div>
      <div>
        <p className="text-xs text-gray-500">{title}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
        {action ? <div className="mt-1">{action}</div> : null}
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
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      <span className="text-xs text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none transition-colors bg-white"
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
