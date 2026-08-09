"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Filter,
  LayoutGrid,
  List,
  Package,
  Plus,
  ShieldCheck,
  UploadCloud,
  Download,
  Tags,
  Edit3,
} from "lucide-react";

type Variant = {
  nama: string;
  kode: string;
  kode_barang_variant?: string;
  barcode: string;
  warna_hex?: string;
  image?: string;
  is_aktif?: number;
  harga_beli_sat_1?: number | null;
  hpp_avg_sat_1?: number | null;
  het_sat_1?: number | null;
  harga_jual_offline_1?: number | null;
  harga_jual_offline_3?: number | null;
  harga_jual_offline_6?: number | null;
  harga_jual_offline_12?: number | null;
};

type Barang = {
  id_barang: number;
  kode_barang: string;
  kode_manual: string;
  nama: string;
  kode_supplier?: string;
  kode_merk?: string;
  kode_kategori?: string;
  kode_gudang?: string;
  nama_gudang?: string;
  gudang?: string;
  barcode_global?: string;
  satuan_1?: string;
  margin_profit?: number;
  buffer_stok?: number;
  harga_beli_sat_1?: number;
  het_sat_1?: number;
  harga_jual_sat_1?: number;
  merk?: string;
  nama_merk?: string;
  supplier?: string;
  nama_supplier?: string;
  tipe?: string;
  status: number;
  is_discontinue: number;
  boleh_retur: number;
  barang_khusus?: number;
  is_memiliki_varian?: number;
  segmentasi_pasar?: string;
  cocok_untuk?: string;
  manfaat?: string;
  deskripsi_produk?: string;
  catatan_internal?: string;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
  gambar_list: string[];
  variants?: Variant[];
};

type VariantStockRow = {
  id_barang?: number | null;
  kode_barang_variant?: string | null;
  kode_varian?: string | null;
  nama_varian?: string | null;
  barcode_varian?: string | null;
  is_aktif?: number | null;
  harga_beli_sat_1?: number | null;
  hpp_avg_sat_1?: number | null;
  harga_het?: number | null;
  stok_gudang?: number | null;
  stok_toko?: number | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const API_URL = `${API_BASE}/barang`;
const TEMPLATE_URL = `${API_BASE}/barang/template`;
const MERK_URL = `${API_BASE}/merk`;
const SUPPLIER_URL = `${API_BASE}/suppliers`;

export default function MasterBarangPage() {
  const [items, setItems] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State filter & search
  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState<string>("");
  const [filterMerk, setFilterMerk] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterCreatedFrom, setFilterCreatedFrom] = useState<string>("");
  const [filterCreatedTo, setFilterCreatedTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [merkMasterOptions, setMerkMasterOptions] = useState<{ label: string; value: string }[]>([]);
  const [supplierMasterOptions, setSupplierMasterOptions] = useState<{ label: string; value: string }[]>([]);
  const [merkUpdates, setMerkUpdates] = useState<Record<number, string>>({});
  const [savingMerk, setSavingMerk] = useState<Record<number, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkMerk, setBulkMerk] = useState<string>("");
  const [bulkSupplier, setBulkSupplier] = useState<string>("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkSupplierSaving, setBulkSupplierSaving] = useState(false);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    item: Barang;
    src: string;
    label: string;
  } | null>(null);

  const handleStatusChange = (id: number, newStatus: "1" | "0") => {
    setItems((prev) =>
      prev.map((item) =>
        item.id_barang === id ? { ...item, status: Number(newStatus) } : item
      )
    );
  };

  const merkLabelMap = useMemo(
    () => new Map(merkMasterOptions.map((m) => [m.value, m.label])),
    [merkMasterOptions]
  );
  const getMerkLabel = useCallback(
    (item: Barang) => {
      const kode = String(item.kode_merk ?? "").trim();
      if (kode && merkLabelMap.has(kode)) return merkLabelMap.get(kode) || "-";
      return item.nama_merk || item.merk || item.kode_merk || "-";
    },
    [merkLabelMap]
  );
  const getSupplierLabel = useCallback(
    (item: Barang) => item.nama_supplier || item.supplier || item.kode_supplier || "-",
    []
  );
  const getGudangLabel = useCallback(
    (item: Barang) => item.nama_gudang || item.gudang || item.kode_gudang || "-",
    []
  );

  const totalProduk = items.length;
  const totalAktif = items.filter((i) => i.status === 1).length;
  const totalDiscontinue = items.filter((i) => i.is_discontinue === 1).length;
  const totalMerk = new Set(items.map((i) => getMerkLabel(i)).filter((v) => v && v !== "-")).size;
  const totalVarian = items.reduce((sum, i) => sum + (i.variants?.length ?? 0), 0);
  const roleLower = String(roleName || "").toLowerCase();
  const canEditMasterBarang = roleLower === "super_admin" || roleLower === "staff_purchasing";

  const supplierOptions = useMemo(
    () => Array.from(new Set(items.map((i) => getSupplierLabel(i)))).sort(),
    [items, getSupplierLabel]
  );
  const merkFilterOptions = useMemo(
    () =>
      merkMasterOptions
        .filter((m) => m.value && m.label)
        .map((m) => ({ value: m.value, label: m.label }))
        .sort((a, b) => a.label.localeCompare(b.label, "id")),
    [merkMasterOptions]
  );

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) setItems(data as Barang[]);
    } catch (err) {
      console.error("Failed fetch barang", err);
      setError("Gagal memuat barang dari server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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

  useEffect(() => {
    const fetchMerk = async () => {
      try {
        const res = await fetch(MERK_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          const opts = data
            .map((m: any) => ({
              label: String(m.nama_merk || "").trim(),
              value: m.id_merk != null ? String(m.id_merk) : "",
            }))
            .filter((m: any) => m.label && m.value)
            .sort((a: any, b: any) => a.label.localeCompare(b.label, "id"));
          setMerkMasterOptions(opts);
        }
      } catch (err) {
        console.error("Failed fetch merk master", err);
      }
    };
    fetchMerk();
  }, []);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const res = await fetch(SUPPLIER_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          const opts = data
            .filter((s: any) => s.kode_supplier && s.nama)
            .map((s: any) => ({
              label: `${String(s.nama || "").trim()} (${String(s.kode_supplier || "").trim()})`,
              value: String(s.kode_supplier || "").trim(),
            }))
            .filter((s: any) => s.value && s.label)
            .sort((a: any, b: any) => a.label.localeCompare(b.label, "id"));
          setSupplierMasterOptions(opts);
        }
      } catch (err) {
        console.error("Failed fetch supplier master", err);
      }
    };
    fetchSupplier();
  }, []);

  const resolveMerkValue = useCallback(
    (item: Barang) => {
      if (item.kode_merk && String(item.kode_merk).trim()) return String(item.kode_merk);
      const fallbackLabel = getMerkLabel(item);
      const match = merkMasterOptions.find((m) => m.label === fallbackLabel);
      return match?.value || "";
    },
    [getMerkLabel, merkMasterOptions]
  );
  
  const handleSaveMerk = async (item: Barang) => {
    const id = item.id_barang;
    const nextValue = merkUpdates[id] ?? resolveMerkValue(item);
    setSavingMerk((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`${API_URL}/${id}/merk`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_merk: nextValue || null,
          updated_by: "Admin",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) =>
        prev.map((row) => (row.id_barang === id ? { ...row, kode_merk: nextValue } : row))
      );
      setMerkUpdates((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    } catch (err) {
      console.error("Failed update merk", err);
      alert("Gagal menyimpan merk.");
    } finally {
      setSavingMerk((prev) => ({ ...prev, [id]: false }));
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterSupplier, filterMerk, filterStatus, filterCreatedFrom, filterCreatedTo, pageSize]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const keyword = search.trim().toLowerCase();

      if (keyword) {
        const baseHaystack =
          `${item.nama} ${item.kode_manual} ${item.barcode_global} ${getSupplierLabel(item)} ${getMerkLabel(item)} ${item.tipe} ${getGudangLabel(item)}`.toLowerCase();
        const variantHaystack = (item.variants ?? [])
          .map((v) => `${v.nama} ${v.kode} ${v.barcode}`)
          .join(" ")
          .toLowerCase();
        const haystack = `${baseHaystack} ${variantHaystack}`.trim();
        if (!haystack.includes(keyword)) return false;
      }

      if (filterSupplier && getSupplierLabel(item) !== filterSupplier) return false;
      if (filterMerk && String(item.kode_merk ?? "") !== filterMerk) return false;
      if (filterStatus && String(Number(item.status ?? 0)) !== filterStatus) return false;

      const createdAt = item.created_at ?? "";
      if (filterCreatedFrom) {
        if (!createdAt || createdAt < filterCreatedFrom) return false;
      }
      if (filterCreatedTo) {
        if (!createdAt || createdAt > filterCreatedTo) return false;
      }

      return true;
    });
  }, [
    items,
    search,
    filterSupplier,
    filterMerk,
    filterStatus,
    filterCreatedFrom,
    filterCreatedTo,
    getMerkLabel,
    getSupplierLabel,
    getGudangLabel,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const paginatedItems = filteredItems.slice(pageStart, pageEnd);
  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return [1];
    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    for (let p = currentPage - 1; p <= currentPage + 1; p += 1) {
      if (p >= 1 && p <= totalPages) pages.add(p);
    }
    return Array.from(pages).sort((a, b) => a - b);
  }, [currentPage, totalPages]);
  const isAllSelected = paginatedItems.length > 0 && paginatedItems.every((item) => selectedIds.has(item.id_barang));
  const selectedCount = selectedIds.size;

  useEffect(() => {
    const initSelect2 = async () => {
      if (typeof window === "undefined") return;
      const { default: $ } = await import("jquery");
      (window as any).$ = $;
      (window as any).jQuery = $;
      await import("select2");

      const currentMap = new Map<number, string>();
      paginatedItems.forEach((item) => {
        currentMap.set(item.id_barang, resolveMerkValue(item));
      });

      $(".merk-select2").each((_: number, el: HTMLElement) => {
        const $el = $(el);
        const id = Number($el.data("id"));
        const currentValue = currentMap.get(id) || "";

        if ($el.hasClass("select2-hidden-accessible")) {
          $el.off("change.select2");
          $el.select2("destroy");
        }

        $el.select2({
          width: "100%",
          placeholder: "Pilih Merk",
          allowClear: true,
        });

        $el.val(currentValue).trigger("change.select2");

        $el.on("change.select2", () => {
          const val = ($el.val() || "").toString();
          if (val === currentMap.get(id)) {
            setMerkUpdates((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          } else {
            setMerkUpdates((prev) => ({ ...prev, [id]: val }));
          }
        });
      });

      $(".merk-select2-bulk").each((_: number, el: HTMLElement) => {
        const $el = $(el);
        if ($el.hasClass("select2-hidden-accessible")) {
          $el.off("change.select2");
          $el.select2("destroy");
        }
        $el.select2({
          width: "100%",
          placeholder: "Pilih Merk",
          allowClear: true,
        });
      });
    };

    initSelect2();
    return () => {
      if (typeof window === "undefined") return;
      import("jquery").then(({ default: $ }) => {
        $(".merk-select2, .merk-select2-bulk").each((_: number, el: HTMLElement) => {
          const $el = $(el);
          if ($el.hasClass("select2-hidden-accessible")) {
            $el.off("change.select2");
            $el.select2("destroy");
          }
        });
      });
    };
  }, [paginatedItems, merkMasterOptions, resolveMerkValue]);

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllSelected) {
        paginatedItems.forEach((item) => next.delete(item.id_barang));
      } else {
        paginatedItems.forEach((item) => next.add(item.id_barang));
      }
      return next;
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkSave = async () => {
    if (!bulkMerk || selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`${API_URL}/${id}/merk`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kode_merk: bulkMerk,
              updated_by: "Admin",
            }),
          })
        )
      );
      setItems((prev) =>
        prev.map((row) => (selectedIds.has(row.id_barang) ? { ...row, kode_merk: bulkMerk } : row))
      );
      setSelectedIds(new Set());
      setBulkMerk("");
    } catch (err) {
      console.error("Failed bulk update merk", err);
      alert("Gagal menyimpan merk untuk item terpilih.");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkSupplierSave = async () => {
    if (!bulkSupplier || selectedIds.size === 0) return;
    setBulkSupplierSaving(true);
    try {
      const res = await fetch(`${API_URL}/bulk/supplier`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          kode_supplier: bulkSupplier,
          updated_by: "Admin",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setItems((prev) =>
        prev.map((row) => (selectedIds.has(row.id_barang) ? { ...row, kode_supplier: bulkSupplier } : row))
      );
      setSelectedIds(new Set());
      setBulkSupplier("");
      await fetchData();
    } catch (err) {
      console.error("Failed bulk update supplier", err);
      alert("Gagal memindahkan barang terpilih ke supplier.");
    } finally {
      setBulkSupplierSaving(false);
    }
  };

  const openPreview = (item: Barang, src?: string, label?: string) => {
    const mainImage = src ?? item.gambar_list?.[0] ?? "";
    setPreview({
      item,
      src: mainImage,
      label: label ?? item.nama,
    });
  };

  const renderImagePreview = (src: string, alt: string) => {
    if (src) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={src} alt={alt} className="max-h-[70vh] max-w-full object-contain rounded-xl border border-gray-200" />;
    }
    return (
      <div className="w-80 h-80 max-w-full flex items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500 bg-gray-50">
        Tidak ada gambar
      </div>
    );
  };

  const formatRupiah = (value?: number | null) => {
    if (value === null || value === undefined) return "-";
    const num = Number(value);
    if (Number.isNaN(num)) return "-";
    return num.toLocaleString("id-ID");
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const tanggal = date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const jam = date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${tanggal}, ${jam}`;
  };

  const renderHargaJualOffline = (variant: Variant) => {
    const prices = [
      { label: "1", value: variant.harga_jual_offline_1 },
      { label: "3", value: variant.harga_jual_offline_3 },
      { label: "6", value: variant.harga_jual_offline_6 },
      { label: "12", value: variant.harga_jual_offline_12 },
    ];
    const hasValue = prices.some((p) => p.value !== null && p.value !== undefined);
    if (!hasValue) return "-";
    return prices
      .map((p) => `${p.label}:${formatRupiah(p.value)}`)
      .join(" • ");
  };

  const handleExportAll = async () => {
    if (items.length === 0) return;

    let stockRows: VariantStockRow[] = [];
    try {
      const stockRes = await fetch(`${API_URL}/varian`);
      if (stockRes.ok) {
        const stockJson = await stockRes.json();
        stockRows = Array.isArray(stockJson) ? (stockJson as VariantStockRow[]) : [];
      }
    } catch (err) {
      console.error("Failed fetch varian stocks for export", err);
    }

    const stockByVariant = new Map<string, VariantStockRow>();
    const stockByBarang = new Map<number, { stokGudang: number; stokToko: number }>();
    stockRows.forEach((row) => {
      const kodeVariant = String(row.kode_barang_variant || "").trim();
      if (kodeVariant) stockByVariant.set(kodeVariant, row);

      const idBarang = Number(row.id_barang || 0);
      if (!idBarang) return;
      const prev = stockByBarang.get(idBarang) || { stokGudang: 0, stokToko: 0 };
      prev.stokGudang += Number(row.stok_gudang || 0);
      prev.stokToko += Number(row.stok_toko || 0);
      stockByBarang.set(idBarang, prev);
    });

    const getBarangKhususLabel = (value?: number) =>
      value === 1 ? "Festive" : value === 2 ? "Bonus" : "Regular";

    const header = [
      "ID Barang",
      "Kode Barang",
      "Kode Manual",
      "Nama Barang",
      "Barcode Global",
      "Supplier",
      "Merk",
      "Gudang",
      "Status Barang",
      "Discontinue",
      "Boleh Retur",
      "Barang Khusus",
      "Harga Beli Master",
      "HET Master",
      "Harga Jual Master",
      "Stok Gudang Master",
      "Stok Toko Master",
      "Jumlah Varian",
      "Created At",
      "Updated At",
      "Kode Barang Variant",
      "Kode Varian",
      "Nama Varian",
      "Barcode Varian",
      "Status Varian",
      "Harga Beli Varian",
      "HPP Varian",
      "HET Varian",
      "Harga Jual Offline 1",
      "Harga Jual Offline 3",
      "Harga Jual Offline 6",
      "Harga Jual Offline 12",
      "Stok Gudang Varian",
      "Stok Toko Varian",
    ];

    const rows = items.flatMap((item) => {
      const variants = item.variants ?? [];
      const barangStock = stockByBarang.get(item.id_barang) || { stokGudang: 0, stokToko: 0 };

      if (variants.length === 0) {
        return [[
          item.id_barang,
          item.kode_barang,
          item.kode_manual,
          item.nama,
          item.barcode_global || "",
          getSupplierLabel(item),
          getMerkLabel(item),
          getGudangLabel(item),
          item.status === 1 ? "Aktif" : "Nonaktif",
          item.is_discontinue === 1 ? "Ya" : "Tidak",
          item.boleh_retur === 1 ? "Ya" : "Tidak",
          getBarangKhususLabel(item.barang_khusus),
          item.harga_beli_sat_1 ?? "",
          item.het_sat_1 ?? "",
          item.harga_jual_sat_1 ?? "",
          barangStock.stokGudang,
          barangStock.stokToko,
          0,
          formatDateTime(item.created_at),
          formatDateTime(item.updated_at),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]];
      }

      return variants.map((variant) => {
        const kodeBarangVariant = String(variant.kode_barang_variant || "").trim();
        const stock = kodeBarangVariant ? stockByVariant.get(kodeBarangVariant) : undefined;
        return [
          item.id_barang,
          item.kode_barang,
          item.kode_manual,
          item.nama,
          item.barcode_global || "",
          getSupplierLabel(item),
          getMerkLabel(item),
          getGudangLabel(item),
          item.status === 1 ? "Aktif" : "Nonaktif",
          item.is_discontinue === 1 ? "Ya" : "Tidak",
          item.boleh_retur === 1 ? "Ya" : "Tidak",
          getBarangKhususLabel(item.barang_khusus),
          item.harga_beli_sat_1 ?? "",
          item.het_sat_1 ?? "",
          item.harga_jual_sat_1 ?? "",
          barangStock.stokGudang,
          barangStock.stokToko,
          variants.length,
          formatDateTime(item.created_at),
          formatDateTime(item.updated_at),
          kodeBarangVariant || (stock?.kode_barang_variant ?? ""),
          variant.kode || (stock?.kode_varian ?? ""),
          variant.nama || (stock?.nama_varian ?? ""),
          variant.barcode || (stock?.barcode_varian ?? ""),
          Number(variant.is_aktif ?? stock?.is_aktif ?? 1) === 1 ? "Aktif" : "Nonaktif",
          variant.harga_beli_sat_1 ?? stock?.harga_beli_sat_1 ?? "",
          variant.hpp_avg_sat_1 ?? stock?.hpp_avg_sat_1 ?? "",
          variant.het_sat_1 ?? stock?.harga_het ?? "",
          variant.harga_jual_offline_1 ?? "",
          variant.harga_jual_offline_3 ?? "",
          variant.harga_jual_offline_6 ?? "",
          variant.harga_jual_offline_12 ?? "",
          stock?.stok_gudang ?? "",
          stock?.stok_toko ?? "",
        ];
      });
    });

    const csvContent =
      [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\r\n") + "\r\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `master-barang-all-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header utama */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Barang</h1>
        </div>
        <Link
          href="/admin/master/barang/new"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Tambah Barang (Tab Baru)
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Summary produk */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <div className="h-9 w-9 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Total Produk</div>
            <div className="text-lg font-bold text-gray-900">
              {totalProduk}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Total Varian</div>
            <div className="text-lg font-bold text-gray-900">
              {totalVarian}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Produk Aktif</div>
            <div className="text-lg font-bold text-gray-900">
              {totalAktif}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Tags className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Total Merk</div>
            <div className="text-lg font-bold text-gray-900">
              {totalMerk}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-gray-500">Produk Discontinue</div>
            <div className="text-lg font-bold text-gray-900">
              {totalDiscontinue}
            </div>
          </div>
        </div>
      </div>

      {/* Card tabel + filter */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        {/* Header card */}
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Barang</p>
              <p className="text-base font-semibold text-gray-800">
                Menampilkan {Math.min(filteredItems.length, pageEnd)} dari {items.length} barang
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
              <ShieldCheck className="w-4 h-4" />
              Dummy data
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <Link
                href="/admin/master/barang/import"
                className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[#3FE0D0]/60 px-3 py-1.5 text-[#0f756b] bg-[#3FE0D0]/10 hover:bg-[#3FE0D0]/20 transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Import Barang
              </Link>
              <a
                href={TEMPLATE_URL}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50 transition-colors"
                download
              >
                <Download className="w-3.5 h-3.5" />
                Download Template
              </a>
              <button
                type="button"
                onClick={handleExportAll}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export Semua
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 transition-colors ${
                  viewMode === "list"
                    ? "bg-[#3FE0D0] text-white border-transparent shadow-sm"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
                aria-label="Tampilkan sebagai list"
              >
                <List className="w-3 h-3" />
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 transition-colors ${
                  viewMode === "grid"
                    ? "bg-[#3FE0D0] text-white border-transparent shadow-sm"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
                aria-label="Tampilkan sebagai grid"
              >
                <LayoutGrid className="w-3 h-3" />
                Grid
              </button>
            </div>
          </div>
        </div>

        {/* Filter & search */}
        <div className="border-b border-gray-100 px-4 py-3 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-600 flex items-center gap-2 mb-1">
                Pencarian
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, SKU, barcode, merk, supplier..."
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:border-[#3FE0D0] focus:outline-none"
              />
            </div>

            {/* Filters select */}
            <div className="flex flex-wrap gap-3 lg:w-[640px]">
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1">
                  <Filter className="w-3 h-3" />
                  Supplier
                </label>
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-xs focus:border-[#3FE0D0] focus:outline-none bg-white"
                >
                  <option value="">Semua Supplier</option>
                  {supplierOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[140px]">
                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1">
                  <Filter className="w-3 h-3" />
                  Status Barang
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-xs focus:border-[#3FE0D0] focus:outline-none bg-white"
                >
                  <option value="">Semua Status</option>
                  <option value="1">Aktif</option>
                  <option value="0">Nonaktif</option>
                </select>
              </div>

              <div className="flex-1 min-w-[140px]">
                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1">
                  <Filter className="w-3 h-3" />
                  Merk
                </label>
                <select
                  value={filterMerk}
                  onChange={(e) => setFilterMerk(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-xs focus:border-[#3FE0D0] focus:outline-none bg-white"
                >
                  <option value="">Semua Merk</option>
                  {merkFilterOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Filter created_at */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-1 text-xs font-semibold text-gray-600 w-full">
              <Calendar className="w-3 h-3" />
              Filter Created At
            </div>
            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">
                  Dari tanggal
                </label>
                <input
                  type="date"
                  value={filterCreatedFrom}
                  onChange={(e) => setFilterCreatedFrom(e.target.value)}
                  className="rounded-xl border-2 border-gray-200 px-3 py-1.5 text-xs focus:border-[#3FE0D0] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">
                  Sampai tanggal
                </label>
                <input
                  type="date"
                  value={filterCreatedTo}
                  onChange={(e) => setFilterCreatedTo(e.target.value)}
                  className="rounded-xl border-2 border-gray-200 px-3 py-1.5 text-xs focus:border-[#3FE0D0] focus:outline-none"
                />
              </div>
              {(filterCreatedFrom || filterCreatedTo || filterSupplier || filterMerk || filterStatus || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilterSupplier("");
                    setFilterMerk("");
                    setFilterStatus("");
                    setFilterCreatedFrom("");
                    setFilterCreatedTo("");
                  }}
                  className="self-end text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabel */}
        <div className="overflow-auto">
          {viewMode === "list" ? (
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                  <th className="px-4 py-3 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-3">Foto</th>
                  <th className="px-4 py-3">SKU / Barcode</th>
                  <th className="px-4 py-3">Nama &amp; Supplier</th>
                  <th className="px-4 py-3">Merk</th>
                  <th className="px-4 py-3">Gudang</th>
                  <th className="px-4 py-3">Harga Jual Offline</th>
                  <th className="px-4 py-3">Varian</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {loading &&
                  Array.from({ length: pageSize }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="animate-pulse">
                      <td className="px-4 py-3 text-center">
                        <div className="h-4 w-4 bg-gray-100 rounded" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-14 h-14 rounded-lg bg-gray-100" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3 w-24 bg-gray-100 rounded mb-2" />
                        <div className="h-3 w-16 bg-gray-100 rounded" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3 w-32 bg-gray-100 rounded mb-2" />
                        <div className="h-3 w-20 bg-gray-100 rounded mb-1" />
                        <div className="h-3 w-24 bg-gray-100 rounded" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3 w-20 bg-gray-100 rounded mb-1" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3 w-20 bg-gray-100 rounded mb-1" />
                        <div className="h-3 w-16 bg-gray-100 rounded" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3 w-28 bg-gray-100 rounded mb-1" />
                        <div className="h-3 w-20 bg-gray-100 rounded" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3 w-28 bg-gray-100 rounded" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-8 w-24 bg-gray-100 rounded-lg" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-8 w-16 bg-gray-100 rounded-lg" />
                      </td>
                    </tr>
                  ))}

                {!loading && paginatedItems.map((item) => (
                  <tr key={item.id_barang} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id_barang)}
                        onChange={() => toggleSelect(item.id_barang)}
                        className="w-4 h-4"
                        aria-label={`Select ${item.nama}`}
                      />
                    </td>
                    {/* Foto produk utama */}
                    <td className="px-4 py-3">
                      {item.gambar_list?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.gambar_list[0]}
                          alt={item.nama}
                          className="w-14 h-14 rounded-lg object-cover border border-gray-200 cursor-zoom-in"
                          onClick={() => openPreview(item, item.gambar_list?.[0], item.nama)}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gray-100 border border-dashed border-gray-200 text-[11px] text-gray-400 flex items-center justify-center">
                          No Foto
                        </div>
                      )}
                    </td>

                    {/* SKU & barcode global */}
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      <div>{item.kode_manual}</div>
                      <div className="text-xs text-gray-500">
                        {item.barcode_global || "-"}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1">
                        Created: {formatDateTime(item.created_at)}
                      </div>
                    </td>

                    {/* Nama & supplier */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {item.nama}
                      </div>
                      <div className="text-xs text-gray-500">
                        Supplier: {getSupplierLabel(item)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Tipe: {item.kode_kategori || "-"}
                      </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        data-id={item.id_barang}
                        value={merkUpdates[item.id_barang] ?? resolveMerkValue(item)}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          const currentValue = resolveMerkValue(item);
                          if (nextValue === currentValue) {
                            setMerkUpdates((prev) => {
                              const next = { ...prev };
                              delete next[item.id_barang];
                              return next;
                            });
                          } else {
                            setMerkUpdates((prev) => ({ ...prev, [item.id_barang]: nextValue }));
                          }
                        }}
                        className="merk-select2 w-48 text-xs"
                      >
                        <option value="">Pilih Merk</option>
                        {merkMasterOptions.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      {merkUpdates[item.id_barang] !== undefined && (
                        <button
                          type="button"
                          onClick={() => handleSaveMerk(item)}
                          disabled={savingMerk[item.id_barang]}
                          className="px-2 py-1 text-xs font-semibold text-[#0f756b] border border-[#3FE0D0]/50 rounded-lg hover:bg-[#3FE0D0]/10 disabled:opacity-60"
                        >
                          {savingMerk[item.id_barang] ? "Menyimpan..." : "Simpan"}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Info gudang & retur */}
                  <td className="px-4 py-3">
                    <div className="text-gray-800">
                      {getGudangLabel(item)}
                    </div>
                      <div className="text-xs text-gray-500">
                        Retur:{" "}
                        {item.boleh_retur === 1
                          ? "Boleh"
                          : "Tidak boleh"}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {item.barang_khusus === 1
                          ? "Festive"
                          : item.barang_khusus === 2
                          ? "Bonus"
                          : "Regular"}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {item.variants?.length ? (
                        <div className="space-y-1">
                          {item.variants.map((v) => {
                            const priceText = renderHargaJualOffline(v);
                            if (priceText === "-") {
                              return (
                                <div key={`${item.id_barang}-${v.kode}`} className="text-xs text-gray-500">
                                  -
                                </div>
                              );
                            }
                            return (
                              <div key={`${item.id_barang}-${v.kode}`} className="text-xs text-gray-700">
                                <span className="font-semibold">{v.nama}</span>{" "}
                                <span className="text-gray-500">({v.kode})</span>
                                <div className="text-[11px] text-gray-600">
                                  {priceText}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>

                    {/* Varian: thumbnail & nama/sku, handle banyak varian */}
                    <td className="px-4 py-3 space-y-1">
                      {item.variants?.length ? (
                        <>
                          <div className="text-xs font-semibold text-[#0f756b] inline-flex items-center gap-1 bg-[#3FE0D0]/10 border border-[#3FE0D0]/30 rounded-full px-2 py-0.5">
                            <Tags className="w-3 h-3" />{" "}
                            {item.variants.length} Varian
                          </div>
                          <div className="space-y-1">
                            {item.variants.slice(0, 3).map((v) => (
                              <div
                                key={v.kode}
                                className="flex items-center gap-2"
                              >
                              <div className="h-5 w-5 rounded-md border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0">
                                {v.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={v.image}
                                    alt={v.nama}
                                    className="w-full h-full object-cover cursor-zoom-in"
                                    onClick={() => openPreview(item, v.image, v.nama)}
                                  />
                                ) : v.warna_hex ? (
                                  <div
                                    className="w-full h-full cursor-zoom-in"
                                    style={{
                                      backgroundColor: v.warna_hex,
                                    }}
                                    onClick={() => openPreview(item, v.image, v.nama)}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-400">
                                    -
                                  </div>
                                )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-medium text-gray-800">
                                    {v.nama}
                                  </span>
                                  <span className="text-[10px] text-gray-500">
                                    {v.kode}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {item.variants.length > 3 && (
                              <div className="text-[11px] text-gray-500">
                                +{item.variants.length - 3} varian lain
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500">
                          Tanpa varian
                        </span>
                      )}
                    </td>

                    {/* Status: select Aktif / Nonaktif */}
                    <td className="px-4 py-3 space-y-1">
                      <select
                        value={item.status}
                        onChange={(e) =>
                          handleStatusChange(
                            item.id_barang,
                            e.target.value as "1" | "0"
                          )
                        }
                        className="w-full md:w-32 rounded-lg border-2 border-gray-200 px-2 py-1.5 text-xs font-semibold focus:border-[#3FE0D0] focus:outline-none bg-white"
                      >
                        <option value="1">Aktif</option>
                        <option value="0">Nonaktif</option>
                      </select>
                      <div className="text-[11px] text-gray-600">
                        {item.is_discontinue === 1
                          ? "Discontinue"
                          : "Masih dijual"}
                      </div>
                    </td>

                    {/* Aksi */}
                    <td className="px-4 py-3">
                      {canEditMasterBarang ? (
                        <Link
                          href={`/admin/master/barang/edit/${item.id_barang}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}

                {!loading && paginatedItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      Tidak ada data yang cocok dengan filter/pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="p-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {loading &&
                Array.from({ length: pageSize }).map((_, idx) => (
                  <div
                    key={`grid-skeleton-${idx}`}
                    className="rounded-2xl border border-gray-100 bg-white shadow-sm animate-pulse"
                  >
                    <div className="h-36 bg-gray-100" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 w-32 bg-gray-100 rounded" />
                      <div className="h-3 w-24 bg-gray-100 rounded" />
                      <div className="h-3 w-16 bg-gray-100 rounded" />
                      <div className="h-8 w-20 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}

              {!loading && paginatedItems.map((item) => (
                <div
                  key={item.id_barang}
                  className="flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
                >
                  <div className="relative h-40 bg-gray-50">
                    {item.gambar_list?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.gambar_list[0]}
                        alt={item.nama}
                        className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => openPreview(item, item.gambar_list?.[0], item.nama)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
                        No Foto
                      </div>
                    )}
                    <span
                      className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold border ${
                        item.status === 1
                          ? "bg-[#3FE0D0]/15 text-[#0f756b] border-[#3FE0D0]/40"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {item.status === 1 ? "Aktif" : "Nonaktif"}
                    </span>
                    {item.is_discontinue === 1 && (
                      <span className="absolute right-3 top-3 rounded-full bg-rose-100 text-rose-600 text-[11px] font-semibold px-2 py-1 border border-rose-200">
                        Discontinue
                      </span>
                    )}
                  </div>

                  <div className="flex-1 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 leading-tight">
                          {item.nama}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          SKU: {item.kode_manual}
                        </p>
                      </div>
                      <select
                        value={item.status}
                        onChange={(e) =>
                          handleStatusChange(
                            item.id_barang,
                            e.target.value as "1" | "0"
                          )
                        }
                        className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold bg-white focus:border-[#3FE0D0] focus:outline-none"
                      >
                        <option value="1">Aktif</option>
                        <option value="0">Nonaktif</option>
                      </select>
                    </div>

                    <div className="text-xs text-gray-600 space-y-1">
                      <div>Brand: {getMerkLabel(item)}</div>
                      <div>Supplier: {getSupplierLabel(item)}</div>
                      <div>Gudang: {getGudangLabel(item)}</div>
                    </div>

                    <div className="flex flex-wrap gap-1 text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                        <Tags className="w-3 h-3" />
                        {item.variants?.length ? `${item.variants.length} Varian` : "Tanpa varian"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(item.created_at)}
                      </span>
                    </div>
                  </div>

                  {canEditMasterBarang ? (
                    <div className="px-3 pb-3">
                      <Link
                        href={`/admin/master/barang/edit/${item.id_barang}`}
                        className="inline-flex items-center justify-center gap-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit Barang
                      </Link>
                    </div>
                  ) : null}
                </div>
              ))}

              {!loading && paginatedItems.length === 0 && (
                <div className="col-span-full text-center text-sm text-gray-500 py-6">
                  Tidak ada data yang cocok dengan filter/pencarian.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
          <div className="text-xs text-gray-600">
            Halaman {currentPage} dari {totalPages} • Menampilkan {paginatedItems.length} data
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border-2 border-gray-200 px-2 py-1 text-xs focus:border-[#3FE0D0] focus:outline-none"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} / halaman
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <div className="flex items-center gap-1">
                {pageNumbers.map((page, idx) => {
                  const prev = pageNumbers[idx - 1];
                  const showEllipsis = prev !== undefined && page - prev > 1;
                  return (
                    <span key={page} className="flex items-center gap-1">
                      {showEllipsis && <span className="px-2 text-xs text-gray-400">...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
                          page === currentPage
                            ? "border-[#3FE0D0]/60 text-[#0f756b] bg-[#3FE0D0]/10"
                            : "border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    </span>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === "list" && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="text-sm text-gray-700 min-w-fit">
              Terpilih: <span className="font-semibold">{selectedCount}</span>
            </div>
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="merk-select2-bulk w-64 text-xs"
                  value={bulkMerk}
                  onChange={(e) => setBulkMerk(e.target.value)}
                >
                  <option value="">Pilih Merk</option>
                  {merkMasterOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleBulkSave}
                  disabled={!bulkMerk || selectedIds.size === 0 || bulkSaving}
                  className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-800 bg-emerald-50 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkSaving ? "Menyimpan..." : "Simpan Merk ke Terpilih"}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="w-80 text-xs rounded-lg border border-gray-200 px-3 py-1.5 bg-white focus:border-[#3FE0D0] focus:outline-none"
                  value={bulkSupplier}
                  onChange={(e) => setBulkSupplier(e.target.value)}
                >
                  <option value="">Pilih Supplier</option>
                  {supplierMasterOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleBulkSupplierSave}
                  disabled={!bulkSupplier || selectedIds.size === 0 || bulkSupplierSaving}
                  className="px-3 py-1.5 rounded-lg border border-sky-200 text-sky-800 bg-sky-50 text-xs font-semibold hover:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkSupplierSaving ? "Memindahkan..." : "Pindahkan ke Supplier Terpilih"}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPreview(null)} />
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500">Preview Gambar</p>
                <h3 className="text-lg font-semibold text-gray-900">{preview.label || preview.item.nama}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="Tutup preview"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
              <div className="flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 p-2">
                {renderImagePreview(preview.src, preview.label || preview.item.nama)}
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <div className="font-semibold text-gray-900">{preview.item.nama}</div>
                  <div className="text-xs text-gray-500">SKU: {preview.item.kode_manual}</div>
                  <div className="text-xs text-gray-500">Brand: {getMerkLabel(preview.item)}</div>
                  <div className="text-xs text-gray-500">Supplier: {getSupplierLabel(preview.item)}</div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-2">Varian</div>
                  <div className="max-h-64 overflow-auto space-y-2 pr-1">
                    {(preview.item.variants ?? []).map((v) => (
                      <button
                        key={v.kode}
                        type="button"
                        onClick={() => openPreview(preview.item, v.image, v.nama)}
                        className="w-full flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-2 hover:border-[#3FE0D0] hover:bg-[#3FE0D0]/10 transition-colors text-left"
                      >
                        <div className="h-10 w-10 rounded-md border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0">
                          {v.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.image} alt={v.nama} className="w-full h-full object-cover" />
                          ) : v.warna_hex ? (
                            <div className="w-full h-full" style={{ backgroundColor: v.warna_hex }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                              -
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{v.nama}</div>
                          <div className="text-[11px] text-gray-500 truncate">{v.kode}</div>
                        </div>
                      </button>
                    ))}
                    {(preview.item.variants ?? []).length === 0 && (
                      <div className="text-xs text-gray-500">Tidak ada varian.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

