"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import JsBarcode from "jsbarcode";
import {
  AlertCircle,
  ArrowLeft,
  Barcode,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  Eye,
  Filter,
  Layers,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Store,
  Tag,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

// Format currency
const formatIDR = (val: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val || 0);
};

// Format date
const formatDate = (val?: string | null) => {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

interface MasterItemVariant {
  kode_barang_variant: string;
  nama_barang: string;
  nama_varian: string;
  nama_merk: string | null;
  kode_supplier: string | null;
  nama_supplier: string | null;
  barcode_varian?: string | null;
  stok_gudang?: number | null;
  stok_toko?: number | null;
  harga_real: number;
}

interface BundlingItemRow {
  kode_barang_variant: string;
  nama_barang: string;
  nama_varian: string;
  barcode_varian: string | null;
  nama_merk: string | null;
  nama_supplier: string | null;
  harga_real: number;
  qty: number;
  harga_promo: number;
}

interface PromoBundlingRow {
  kode_t_promosi: string;
  nama_promosi: string;
  deskripsi: string | null;
  valid_from: string;
  valid_to: string;
  time_from: string | null;
  time_to: string | null;
  jenis_sumber: string;
  status_aktif: number;
  status_approval: number;
  barcode_bundling: string | null;
  total_harga_real: number | null;
  total_harga_bundling: number | null;
  total_diskon: number | null;
  total_bundling_items?: number | null;
  target_toko?: string | null;
}

// Visual Barcode SVG component with JsBarcode
function BarcodeVisual({
  value,
  width = 1.8,
  height = 45,
  fontSize = 13,
  displayValue = true,
}: {
  value: string;
  width?: number;
  height?: number;
  fontSize?: number;
  displayValue?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width,
        height,
        displayValue,
        fontSize,
        fontOptions: "bold",
        textMargin: 3,
        margin: 4,
      });
    } catch (err) {
      console.error("Failed to render barcode", err);
    }
  }, [value, width, height, fontSize, displayValue]);

  if (!value) return null;
  return <svg ref={svgRef} className="max-w-full inline-block" />;
}

export default function PromoBundlingPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [tab, setTab] = useState<"list" | "create">("list");

  // Filter & List state
  const [promoRows, setPromoRows] = useState<PromoBundlingRow[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState("");
  const [statusApprovalFilter, setStatusApprovalFilter] = useState("semua");
  const [statusAktifFilter, setStatusAktifFilter] = useState("semua");

  // Toko options
  const [tokoOptions, setTokoOptions] = useState<{ kode_toko: string; nama_toko: string }[]>([]);
  const [selectedToko, setSelectedToko] = useState<Set<string>>(new Set());
  const [selectAllToko, setSelectAllToko] = useState(true);

  // Master variants
  const [items, setItems] = useState<MasterItemVariant[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<{ kode_supplier: string; nama_supplier: string }[]>([]);

  // Item search & filter in form
  const [itemSearch, setItemSearch] = useState("");
  const [filterMerk, setFilterMerk] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [namaPromo, setNamaPromo] = useState("");
  const [barcodeBundling, setBarcodeBundling] = useState("");
  const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false);
  const [deskripsi, setDeskripsi] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [jamMulai, setJamMulai] = useState("00:00");
  const [jamSelesai, setJamSelesai] = useState("23:59");
  const [bundlingItems, setBundlingItems] = useState<BundlingItemRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Modals
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printData, setPrintData] = useState<{
    nama_promosi: string;
    barcode_bundling: string;
    total_harga_real: number;
    total_harga_bundling: number;
    total_diskon: number;
    valid_from?: string;
    valid_to?: string;
    items: { nama_barang: string; nama_varian: string; qty: number; harga_real: number; harga_promo: number }[];
  } | null>(null);
  const [printLabelSize, setPrintLabelSize] = useState<"70x40" | "50x30">("70x40");

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

  // Helper date
  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // Fetch Toko
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
          setSelectedToko(new Set(list.map((t) => t.kode_toko)));
        }
      } catch (err) {
        console.error("Failed fetch toko", err);
      }
    };
    fetchToko();
  }, [API_BASE, selectAllToko]);

  // Fetch Barang Varian
  useEffect(() => {
    const fetchItems = async () => {
      setItemsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/barang/varian`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list: MasterItemVariant[] = Array.isArray(data)
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
                harga_real: Number(row.harga_aktif_offline_1 || row.harga_het || 0),
              }))
              .filter((row) => row.kode_barang_variant)
          : [];
        setItems(list);
      } catch (err) {
        console.error("Failed fetch barang varian", err);
      } finally {
        setItemsLoading(false);
      }
    };
    fetchItems();
  }, [API_BASE]);

  // Fetch Suppliers
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
      }
    };
    fetchSuppliers();
  }, [API_BASE]);

  // Distinct brands for filter
  const merkOptions = useMemo(() => {
    const s = new Set<string>();
    items.forEach((it) => {
      if (it.nama_merk) s.add(it.nama_merk);
    });
    return Array.from(s).sort();
  }, [items]);

  // Fetch Promo Bundling List
  const fetchPromos = useCallback(async () => {
    setPromoLoading(true);
    setPromoError(null);
    try {
      const params = new URLSearchParams();
      params.set("bundle_only", "1");
      if (listQuery.trim()) params.set("q", listQuery.trim());
      if (statusApprovalFilter !== "semua") params.set("status", statusApprovalFilter);
      if (statusAktifFilter !== "semua") params.set("aktif", statusAktifFilter);

      const res = await fetch(`${API_BASE}/promos?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPromoRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed fetch promos", err);
      setPromoError("Gagal memuat daftar promo bundling.");
      setPromoRows([]);
    } finally {
      setPromoLoading(false);
    }
  }, [API_BASE, listQuery, statusAktifFilter, statusApprovalFilter]);

  useEffect(() => {
    if (tab === "list") {
      fetchPromos();
    }
  }, [fetchPromos, tab]);

  // Generate Barcode API call
  const generateNewBarcode = useCallback(async () => {
    setIsGeneratingBarcode(true);
    try {
      const res = await fetch(`${API_BASE}/promos/generate-bundle-barcode`);
      if (res.ok) {
        const data = await res.json();
        if (data?.barcode) {
          setBarcodeBundling(data.barcode);
          return data.barcode;
        }
      }
    } catch (err) {
      console.error("Failed call generate barcode API", err);
    } finally {
      setIsGeneratingBarcode(false);
    }

    // Fallback generate client-side
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const rand = String(Math.floor(Math.random() * 900) + 100);
    const generated = `BDL${yy}${mm}${dd}${rand}`;
    setBarcodeBundling(generated);
    return generated;
  }, [API_BASE]);

  // Reset form
  const handleOpenCreateForm = () => {
    setEditingId(null);
    setNamaPromo("");
    setDeskripsi("");
    setTanggalMulai(todayStr);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 30);
    const yyyy = nextWeek.getFullYear();
    const mm = String(nextWeek.getMonth() + 1).padStart(2, "0");
    const dd = String(nextWeek.getDate()).padStart(2, "0");
    setTanggalSelesai(`${yyyy}-${mm}-${dd}`);
    setJamMulai("00:00");
    setJamSelesai("23:59");
    setBundlingItems([]);
    setItemSearch("");
    setFilterMerk("");
    setFilterSupplier("");
    setSelectAllToko(true);
    setSelectedToko(new Set(tokoOptions.map((t) => t.kode_toko)));
    setTab("create");
    generateNewBarcode();
  };

  // Add Item to Bundling
  const handleAddItemToBundling = (it: MasterItemVariant) => {
    const exists = bundlingItems.some((b) => b.kode_barang_variant === it.kode_barang_variant);
    if (exists) return;

    // Default harga promo set to harga real, user will edit it
    const newRow: BundlingItemRow = {
      kode_barang_variant: it.kode_barang_variant,
      nama_barang: it.nama_barang,
      nama_varian: it.nama_varian,
      barcode_varian: it.barcode_varian || null,
      nama_merk: it.nama_merk,
      nama_supplier: it.nama_supplier,
      harga_real: it.harga_real,
      qty: 1,
      harga_promo: it.harga_real > 0 ? it.harga_real : 0,
    };
    setBundlingItems((prev) => [...prev, newRow]);
  };

  // Remove Item from Bundling
  const handleRemoveItemFromBundling = (kode_barang_variant: string) => {
    setBundlingItems((prev) => prev.filter((b) => b.kode_barang_variant !== kode_barang_variant));
  };

  // Update Item Qty
  const handleUpdateItemQty = (kode_barang_variant: string, qty: number) => {
    const safeQty = Math.max(1, Math.floor(qty || 1));
    setBundlingItems((prev) =>
      prev.map((b) => (b.kode_barang_variant === kode_barang_variant ? { ...b, qty: safeQty } : b))
    );
  };

  // Update Item Harga Real (if needed)
  const handleUpdateItemHargaReal = (kode_barang_variant: string, val: number) => {
    const safeVal = Math.max(0, val || 0);
    setBundlingItems((prev) =>
      prev.map((b) => (b.kode_barang_variant === kode_barang_variant ? { ...b, harga_real: safeVal } : b))
    );
  };

  // Update Item Harga Promo (WAJIB DIISI)
  const handleUpdateItemHargaPromo = (kode_barang_variant: string, val: number) => {
    const safeVal = Math.max(0, val || 0);
    setBundlingItems((prev) =>
      prev.map((b) => (b.kode_barang_variant === kode_barang_variant ? { ...b, harga_promo: safeVal } : b))
    );
  };

  // Calculations for Bundling
  const totals = useMemo(() => {
    let totalReal = 0;
    let totalPromo = 0;
    let totalQty = 0;

    bundlingItems.forEach((b) => {
      const q = b.qty || 1;
      totalReal += (b.harga_real || 0) * q;
      totalPromo += (b.harga_promo || 0) * q;
      totalQty += q;
    });

    const totalDiskon = Math.max(0, totalReal - totalPromo);
    const persenDiskon = totalReal > 0 ? (totalDiskon / totalReal) * 100 : 0;

    return {
      totalReal,
      totalPromo,
      totalQty,
      totalDiskon,
      persenDiskon,
    };
  }, [bundlingItems]);

  // Filtered search list in form
  const filteredSearchItems = useMemo(() => {
    if (!itemSearch.trim() && !filterMerk && !filterSupplier) return [];
    const q = itemSearch.toLowerCase().trim();

    return items
      .filter((it) => {
        if (filterMerk && it.nama_merk !== filterMerk) return false;
        if (filterSupplier && it.kode_supplier !== filterSupplier) return false;
        if (!q) return true;
        return (
          it.nama_barang.toLowerCase().includes(q) ||
          it.nama_varian.toLowerCase().includes(q) ||
          (it.barcode_varian && it.barcode_varian.toLowerCase().includes(q)) ||
          it.kode_barang_variant.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [items, itemSearch, filterMerk, filterSupplier]);

  // Save Bundling Promo
  const handleSavePromo = async () => {
    if (!namaPromo.trim()) {
      Swal.fire("Nama Promo Wajib Diisi", "Silakan masukkan nama promo bundling terlebih dahulu.", "warning");
      return;
    }
    if (!barcodeBundling.trim()) {
      Swal.fire("Barcode Bundling Wajib Ada", "Silakan generate barcode bundling terlebih dahulu.", "warning");
      return;
    }
    if (!tanggalMulai || !tanggalSelesai) {
      Swal.fire("Periode Wajib Diisi", "Silakan atur tanggal mulai dan tanggal selesai promo.", "warning");
      return;
    }
    if (bundlingItems.length < 2) {
      Swal.fire(
        "Minimal 2 Item Produk",
        "Paket promo bundling minimal harus memiliki 2 item produk yang saling terikat.",
        "warning"
      );
      return;
    }

    // Check that every item has harga_promo > 0
    const invalidItem = bundlingItems.find((b) => !b.harga_promo || b.harga_promo <= 0);
    if (invalidItem) {
      Swal.fire(
        "Harga Promo Wajib Diisi",
        `Kolom harga promo untuk barang "${invalidItem.nama_barang} (${invalidItem.nama_varian})" wajib diisi dan harus lebih besar dari Rp 0.`,
        "warning"
      );
      return;
    }

    if (totals.totalPromo <= 0) {
      Swal.fire("Total Harga Bundling Tidak Valid", "Total harga paket bundling harus lebih dari Rp 0.", "warning");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nama_promosi: namaPromo.trim(),
        deskripsi: deskripsi.trim() || null,
        valid_from: tanggalMulai,
        valid_to: tanggalSelesai,
        time_from: jamMulai ? `${jamMulai}:00` : "00:00:00",
        time_to: jamSelesai ? `${jamSelesai}:00` : "23:59:59",
        jenis_sumber: "BUNDLING",
        barcode_bundling: barcodeBundling.trim(),
        status_aktif: 1,
        status_approval: 0,
        updated_by: getUsername(),
        target_toko: Array.from(selectedToko),
        total_harga_real: totals.totalReal,
        total_harga_bundling: totals.totalPromo,
        total_diskon: totals.totalDiskon,
        bundling_items: bundlingItems.map((b) => ({
          kode_barang_variant: b.kode_barang_variant,
          nama_barang: b.nama_barang,
          nama_varian: b.nama_varian,
          barcode_varian: b.barcode_varian,
          qty: b.qty,
          harga_real: b.harga_real,
          harga_promo: b.harga_promo,
          subtotal_real: b.harga_real * b.qty,
          subtotal_promo: b.harga_promo * b.qty,
          diskon_item: Math.max(0, b.harga_real * b.qty - b.harga_promo * b.qty),
        })),
        rule_groups: [
          {
            group_no: 1,
            group_operator: "AND",
            rule_type: "ITEM_COMBO",
            min_total_qty: totals.totalQty,
            max_redeem_qty: null,
            items: bundlingItems.map((b) => ({
              kode_barang_variant: b.kode_barang_variant,
              min_qty: b.qty,
              max_qty: b.qty,
            })),
          },
        ],
        benefits: [
          {
            benefit_type: "DISKON_NOMINAL",
            diskon_nominal: totals.totalDiskon,
            apply_scope: "APPLY_TO_CART",
          },
        ],
      };

      const url = editingId ? `${API_BASE}/promos/${encodeURIComponent(editingId)}` : `${API_BASE}/promos`;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || `HTTP ${res.status}`);
      }

      const confirmResult = await Swal.fire({
        title: "Berhasil Disimpan!",
        text: `Program Promo Bundling "${namaPromo}" dengan barcode ${barcodeBundling} siap digunakan. Apakah ingin langsung mencetak label barcode?`,
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "Cetak Label Barcode Sekarang",
        cancelButtonText: "Kembali ke Daftar",
        confirmButtonColor: "#10b981",
      });

      if (confirmResult.isConfirmed) {
        setPrintData({
          nama_promosi: namaPromo.trim(),
          barcode_bundling: barcodeBundling.trim(),
          total_harga_real: totals.totalReal,
          total_harga_bundling: totals.totalPromo,
          total_diskon: totals.totalDiskon,
          valid_from: tanggalMulai,
          valid_to: tanggalSelesai,
          items: bundlingItems.map((b) => ({
            nama_barang: b.nama_barang,
            nama_varian: b.nama_varian,
            qty: b.qty,
            harga_real: b.harga_real,
            harga_promo: b.harga_promo,
          })),
        });
        setPrintModalOpen(true);
      }

      setTab("list");
      fetchPromos();
    } catch (err: any) {
      console.error("Failed save bundling promo", err);
      Swal.fire("Gagal Menyimpan Promo", err?.message || String(err), "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Edit Promo
  const handleEditPromo = async (kode: string) => {
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const header = data?.header || {};

      setEditingId(kode);
      setNamaPromo(header.nama_promosi || "");
      setDeskripsi(header.deskripsi || "");
      setBarcodeBundling(data?.bundling_header?.barcode_bundling || header.barcode_bundling || "");
      setTanggalMulai(header.valid_from ? header.valid_from.slice(0, 10) : todayStr);
      setTanggalSelesai(header.valid_to ? header.valid_to.slice(0, 10) : todayStr);
      setJamMulai(header.time_from ? header.time_from.slice(0, 5) : "00:00");
      setJamSelesai(header.time_to ? header.time_to.slice(0, 5) : "23:59");

      // Toko
      const targets = Array.isArray(data?.target_toko) ? data.target_toko : [];
      setSelectedToko(new Set(targets.map((t: any) => String(t))));
      setSelectAllToko(targets.length === 0 || targets.length === tokoOptions.length);

      // Bundling items
      const bItems = Array.isArray(data?.bundling_items) ? data.bundling_items : [];
      if (bItems.length > 0) {
        setBundlingItems(
          bItems.map((b: any) => ({
            kode_barang_variant: String(b.kode_barang_variant || ""),
            nama_barang: String(b.nama_barang || ""),
            nama_varian: String(b.nama_varian || ""),
            barcode_varian: b.barcode_varian || null,
            nama_merk: null,
            nama_supplier: null,
            harga_real: Number(b.harga_real || 0),
            qty: Number(b.qty || 1),
            harga_promo: Number(b.harga_promo || 0),
          }))
        );
      } else {
        // Fallback from rule items if bundling_items empty
        const firstGroup = data?.rule_groups?.[0];
        const rItems = Array.isArray(firstGroup?.items) ? firstGroup.items : [];
        setBundlingItems(
          rItems.map((ri: any) => {
            const master = items.find((m) => m.kode_barang_variant === ri.kode_barang_variant);
            const hReal = master?.harga_real || 0;
            return {
              kode_barang_variant: String(ri.kode_barang_variant || ""),
              nama_barang: ri.nama_barang || master?.nama_barang || "",
              nama_varian: ri.nama_varian || master?.nama_varian || "",
              barcode_varian: ri.barcode_varian || master?.barcode_varian || null,
              nama_merk: master?.nama_merk || null,
              nama_supplier: master?.nama_supplier || null,
              harga_real: hReal,
              qty: Number(ri.min_qty || 1),
              harga_promo: hReal,
            };
          })
        );
      }

      setTab("create");
    } catch (err) {
      console.error("Failed load promo for edit", err);
      Swal.fire("Gagal Membuka Promo", String(err), "error");
    }
  };

  // View Detail Promo
  const handleViewDetail = async (row: PromoBundlingRow) => {
    setDetailLoading(true);
    setDetailModalOpen(true);
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(row.kode_t_promosi)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDetailData(data);
    } catch (err) {
      console.error("Failed fetch promo detail", err);
      Swal.fire("Gagal memuat detail promo", String(err), "error");
    } finally {
      setDetailLoading(false);
    }
  };

  // Delete Promo
  const handleDeletePromo = async (kode: string, nama: string) => {
    const confirm = await Swal.fire({
      title: "Hapus Promo Bundling?",
      text: `Promo "${nama}" (${kode}) akan dihapus secara permanen.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#e11d48",
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      Swal.fire("Berhasil", "Promo bundling telah dihapus.", "success");
      setPromoRows((prev) => prev.filter((r) => r.kode_t_promosi !== kode));
    } catch (err) {
      console.error("Failed delete promo", err);
      Swal.fire("Gagal menghapus", String(err), "error");
    }
  };

  // Open Print Modal for existing row
  const handleOpenPrintModalForRow = async (row: PromoBundlingRow) => {
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(row.kode_t_promosi)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const bItems = Array.isArray(data?.bundling_items) ? data.bundling_items : [];

      setPrintData({
        nama_promosi: row.nama_promosi,
        barcode_bundling: row.barcode_bundling || data?.bundling_header?.barcode_bundling || row.kode_t_promosi,
        total_harga_real: Number(row.total_harga_real || data?.bundling_header?.total_harga_real || 0),
        total_harga_bundling: Number(row.total_harga_bundling || data?.bundling_header?.total_harga_bundling || 0),
        total_diskon: Number(row.total_diskon || data?.bundling_header?.total_diskon || 0),
        valid_from: row.valid_from,
        valid_to: row.valid_to,
        items: bItems.map((b: any) => ({
          nama_barang: b.nama_barang,
          nama_varian: b.nama_varian,
          qty: Number(b.qty || 1),
          harga_real: Number(b.harga_real || 0),
          harga_promo: Number(b.harga_promo || 0),
        })),
      });
      setPrintModalOpen(true);
    } catch (err) {
      console.error("Failed load print data", err);
      Swal.fire("Gagal memuat data cetak barcode", String(err), "error");
    }
  };

  // Trigger Native Print Dialog
  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Print Style Injected */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-bundle-label,
          #printable-bundle-label * {
            visibility: visible !important;
          }
          #printable-bundle-label {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-950 text-white rounded-2xl p-6 shadow-sm border border-emerald-700/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-xs font-semibold tracking-wide flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-300" />
                Special Package
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-200 border border-teal-400/30 text-xs font-semibold tracking-wide flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-teal-300" />
                Single Barcode Bundling
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Promo Bundling</h1>
            <p className="text-emerald-100/80 text-sm max-w-2xl">
              Buat program paket bundling multi-item dengan harga promo terikat, barcode bundling otomatis, dan label
              siap cetak untuk operasional kasir &amp; display toko.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("list")}
              className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
                tab === "list"
                  ? "bg-white text-emerald-900 shadow-md font-semibold"
                  : "bg-emerald-900/60 text-emerald-100 hover:bg-emerald-900/90 border border-emerald-600/40"
              }`}
            >
              <Layers className="w-4 h-4" />
              Daftar Promo Bundling
              {promoRows.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  {promoRows.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleOpenCreateForm}
              className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
                tab === "create"
                  ? "bg-emerald-400 text-emerald-950 font-bold shadow-lg"
                  : "bg-emerald-500 text-white hover:bg-emerald-400 hover:text-emerald-950 shadow-sm"
              }`}
            >
              <Plus className="w-4 h-4" />
              + Tambah Promo Bundling
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: LIST PROMO BUNDLING */}
      {tab === "list" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder="Cari nama promo atau barcode bundling..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusApprovalFilter}
                onChange={(e) => setStatusApprovalFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="semua">Semua Status Approval</option>
                <option value="1">Approved</option>
                <option value="0">Pending Approval</option>
                <option value="2">Rejected</option>
              </select>

              <select
                value={statusAktifFilter}
                onChange={(e) => setStatusAktifFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="semua">Semua Status Aktif</option>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>

              <button
                type="button"
                onClick={fetchPromos}
                className="p-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all"
                title="Refresh daftar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table List */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
            {promoLoading ? (
              <div className="py-16 text-center text-sm text-gray-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                <span>Memuat data promo bundling...</span>
              </div>
            ) : promoError ? (
              <div className="py-12 text-center text-rose-600 text-sm">{promoError}</div>
            ) : promoRows.length === 0 ? (
              <div className="py-16 px-4 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
                  <Package className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-gray-800">Belum ada program promo bundling</p>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Saat ini belum ada promo bundling yang dibuat. Klik tombol di bawah untuk membuat program paket
                    bundling pertama Anda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCreateForm}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm transition-all inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Buat Promo Bundling Sekarang
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50/80 text-gray-500 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3.5 text-left">Barcode &amp; Kode</th>
                      <th className="px-4 py-3.5 text-left">Nama Promo Bundling</th>
                      <th className="px-4 py-3.5 text-left">Periode Berlaku</th>
                      <th className="px-4 py-3.5 text-right">Harga Real (Normal)</th>
                      <th className="px-4 py-3.5 text-right">Harga Bundling</th>
                      <th className="px-4 py-3.5 text-right">Hemat</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-4 py-3.5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-800">
                    {promoRows.map((row) => {
                      const totalReal = Number(row.total_harga_real || 0);
                      const totalBundling = Number(row.total_harga_bundling || 0);
                      const totalDiskon = Number(row.total_diskon || Math.max(0, totalReal - totalBundling));
                      const persenDiskon = totalReal > 0 ? (totalDiskon / totalReal) * 100 : 0;

                      return (
                        <tr key={row.kode_t_promosi} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="space-y-1">
                              {row.barcode_bundling ? (
                                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 border border-gray-300 font-mono text-xs font-bold text-gray-900 shadow-2xs">
                                  <Barcode className="w-3.5 h-3.5 text-emerald-700" />
                                  {row.barcode_bundling}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 font-mono">-</span>
                              )}
                              <div className="text-[11px] font-mono text-gray-400">{row.kode_t_promosi}</div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-gray-900">{row.nama_promosi}</div>
                            {row.deskripsi && <div className="text-xs text-gray-500 line-clamp-1">{row.deskripsi}</div>}
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium">
                                <Package className="w-3 h-3 text-emerald-600" />
                                {row.total_bundling_items ?? 1} item dalam paket
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-xs text-gray-600">
                            <div>{formatDate(row.valid_from)} s/d</div>
                            <div className="font-medium text-gray-800">{formatDate(row.valid_to)}</div>
                          </td>

                          <td className="px-4 py-3.5 text-right font-medium text-gray-500 line-through">
                            {formatIDR(totalReal)}
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <span className="font-bold text-emerald-700 text-base">{formatIDR(totalBundling)}</span>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <div className="font-semibold text-emerald-600">{formatIDR(totalDiskon)}</div>
                            {persenDiskon > 0 && (
                              <div className="text-[11px] font-bold text-rose-600">-{persenDiskon.toFixed(1)}%</div>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <div className="space-y-1">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  row.status_approval === 1
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : row.status_approval === 2
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {row.status_approval === 1
                                  ? "Approved"
                                  : row.status_approval === 2
                                  ? "Rejected"
                                  : "Pending"}
                              </span>
                              <div>
                                <span
                                  className={`text-[10px] font-medium ${
                                    row.status_aktif === 1 ? "text-emerald-700" : "text-gray-400"
                                  }`}
                                >
                                  {row.status_aktif === 1 ? "● Aktif" : "○ Nonaktif"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenPrintModalForRow(row)}
                                className="p-1.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-all shadow-2xs"
                                title="Cetak Label Barcode Bundling"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleViewDetail(row)}
                                className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all"
                                title="Lihat Detail Paket"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditPromo(row.kode_t_promosi)}
                                className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all"
                                title="Edit Promo Bundling"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePromo(row.kode_t_promosi, row.nama_promosi)}
                                className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all"
                                title="Hapus Promo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CREATE / EDIT PROMO BUNDLING */}
      {tab === "create" && (
        <div className="space-y-6">
          {/* Top Bar Navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setTab("list")}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Daftar Promo Bundling
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {editingId ? `Mode Edit: ${editingId}` : "Mode Pembuatan Promo Bundling Baru"}
              </span>
            </div>
          </div>

          {/* Form Card 1: Informasi Dasar & Barcode Bundling */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-emerald-600" />
                  1. Informasi Program &amp; Barcode Bundling
                </h2>
                <p className="text-xs text-gray-500">
                  Nama promo, masa berlaku, dan barcode khusus yang akan dicetak serta discan di kasir.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nama Promo */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                  Nama Program Promo Bundling <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={namaPromo}
                  onChange={(e) => setNamaPromo(e.target.value)}
                  placeholder="Contoh: PAKET GLOWING 3-IN-1 WARDAH (DAY + NIGHT + SERUM)"
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Barcode Bundling Box with Live Barcode Visual */}
              <div className="space-y-2 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-gray-50 p-4 rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1">
                    <Barcode className="w-4 h-4 text-emerald-700" />
                    Barcode Bundling (Scan di Kasir) <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateNewBarcode}
                    disabled={isGeneratingBarcode}
                    className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-semibold transition-colors"
                    title="Generate ulang kode barcode baru"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingBarcode ? "animate-spin" : ""}`} />
                    Generate Ulang
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={barcodeBundling}
                    onChange={(e) => setBarcodeBundling(e.target.value.toUpperCase())}
                    placeholder="Contoh: BDL261119001"
                    className="flex-1 font-mono font-bold text-base px-3 py-2 bg-white border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                  />
                </div>

                {/* Live Preview Barcode */}
                <div className="bg-white p-3 rounded-lg border border-emerald-100 flex flex-col items-center justify-center text-center shadow-2xs min-h-[90px]">
                  {barcodeBundling ? (
                    <>
                      <BarcodeVisual value={barcodeBundling} width={1.8} height={45} fontSize={12} />
                      <span className="text-[10px] text-gray-400 mt-0.5">
                        Barcode Code128 siap discan dengan barcode scanner toko
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Belum ada barcode di-generate</span>
                  )}
                </div>
              </div>

              {/* Masa Berlaku */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      Tanggal Mulai <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={tanggalMulai}
                      onChange={(e) => setTanggalMulai(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      Tanggal Selesai <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={tanggalSelesai}
                      onChange={(e) => setTanggalSelesai(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      Jam Mulai
                    </label>
                    <input
                      type="time"
                      value={jamMulai}
                      onChange={(e) => setJamMulai(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      Jam Selesai
                    </label>
                    <input
                      type="time"
                      value={jamSelesai}
                      onChange={(e) => setJamSelesai(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Target Toko */}
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-gray-500" />
                    Target Toko Berlaku
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectAllToko}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectAllToko(checked);
                        if (checked) {
                          setSelectedToko(new Set(tokoOptions.map((t) => t.kode_toko)));
                        } else {
                          setSelectedToko(new Set());
                        }
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    Pilih Semua Toko ({tokoOptions.length})
                  </label>
                </div>

                {!selectAllToko && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 max-h-40 overflow-y-auto">
                    {tokoOptions.map((t) => (
                      <label key={t.kode_toko} className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={selectedToko.has(t.kode_toko)}
                          onChange={(e) => {
                            const next = new Set(selectedToko);
                            if (e.target.checked) next.add(t.kode_toko);
                            else next.delete(t.kode_toko);
                            setSelectedToko(next);
                            setSelectAllToko(next.size === tokoOptions.length);
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="truncate">{t.nama_toko}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Card 2: Tambah Item Produk ke Paket Bundling */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="border-b border-gray-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  2. Tambah Item Yang Termasuk Promo Bundling
                </h2>
                <p className="text-xs text-gray-500">
                  Cari dan pilih item produk yang ingin diikatkan ke dalam kesatuan 1 paket promo bundling ini.
                </p>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Ketik nama produk, varian, atau barcode..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <select
                  value={filterMerk}
                  onChange={(e) => setFilterMerk(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Semua Merk</option>
                  {merkOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Semua Supplier</option>
                  {supplierOptions.map((s) => (
                    <option key={s.kode_supplier} value={s.kode_supplier}>
                      {s.nama_supplier}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Results Dropdown/Box */}
            {(itemSearch.trim() || filterMerk || filterSupplier) && (
              <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/20 max-h-60 overflow-y-auto space-y-2">
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  Hasil Pencarian ({filteredSearchItems.length} produk ditemukan):
                </p>
                {filteredSearchItems.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-2 text-center">
                    Tidak ada produk yang cocok dengan pencarian.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {filteredSearchItems.map((it) => {
                      const alreadyAdded = bundlingItems.some(
                        (b) => b.kode_barang_variant === it.kode_barang_variant
                      );

                      return (
                        <div
                          key={it.kode_barang_variant}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-white hover:border-emerald-300 transition-all text-xs"
                        >
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="font-semibold text-gray-900 truncate">{it.nama_barang}</div>
                            <div className="text-gray-500 text-[11px] truncate">
                              Varian: {it.nama_varian || "-"} {it.barcode_varian ? `| Barcode: ${it.barcode_varian}` : ""}
                            </div>
                            <div className="text-emerald-700 font-bold mt-0.5">
                              Harga Real: {formatIDR(it.harga_real)}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={alreadyAdded}
                            onClick={() => handleAddItemToBundling(it)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 ${
                              alreadyAdded
                                ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {alreadyAdded ? "Sudah Dipilih" : "Tambah"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Card 3: Daftar Item Bundling Terpilih (KOLOM HARGA PROMO WAJIB DIISI) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="border-b border-gray-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-600" />
                  3. Daftar Item Paket Bundling &amp; Harga Promo Per Item
                </h2>
                <p className="text-xs text-gray-500">
                  Isi kolom <strong className="text-emerald-800">Harga Promo Per Item (Wajib)</strong> di samping harga
                  jual realnya untuk menentukan porsi diskon setiap barang dalam paket bundling.
                </p>
              </div>

              <div className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {bundlingItems.length} Produk Dipilih
              </div>
            </div>

            {bundlingItems.length === 0 ? (
              <div className="py-12 text-center space-y-2 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <Package className="w-8 h-8 text-gray-400 mx-auto" />
                <p className="text-sm font-semibold text-gray-700">Belum ada item yang ditambahkan ke paket</p>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Cari barang pada bagian &ldquo;Tambah Item&rdquo; di atas, lalu klik tombol &ldquo;Tambah&rdquo; untuk
                  memasukkan minimal 2 item produk ke paket bundling ini.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100 text-gray-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5 text-center w-10">No</th>
                      <th className="px-3 py-2.5 text-left">Item Produk &amp; Varian</th>
                      <th className="px-3 py-2.5 text-center w-24">Qty Paket</th>
                      <th className="px-3 py-2.5 text-right w-36">Harga Jual Real</th>
                      <th className="px-3 py-2.5 text-right w-36 bg-emerald-50/70 border-x border-emerald-200">
                        Harga Promo Per Item <span className="text-rose-500">*</span>
                      </th>
                      <th className="px-3 py-2.5 text-right w-32">Subtotal Promo</th>
                      <th className="px-3 py-2.5 text-right w-28">Hemat / Item</th>
                      <th className="px-3 py-2.5 text-center w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bundlingItems.map((item, idx) => {
                      const subtotalReal = item.harga_real * item.qty;
                      const subtotalPromo = item.harga_promo * item.qty;
                      const hematItem = Math.max(0, subtotalReal - subtotalPromo);
                      const isZeroPromo = !item.harga_promo || item.harga_promo <= 0;

                      return (
                        <tr key={item.kode_barang_variant} className="hover:bg-gray-50/60">
                          <td className="px-3 py-3 text-center font-bold text-gray-400">{idx + 1}</td>

                          <td className="px-3 py-3">
                            <div className="font-semibold text-gray-900 text-sm">{item.nama_barang}</div>
                            <div className="text-gray-500 text-[11px]">
                              Varian: <span className="font-medium text-gray-700">{item.nama_varian || "-"}</span>
                              {item.barcode_varian && (
                                <span className="ml-2 font-mono text-gray-400">({item.barcode_varian})</span>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-3 text-center">
                            <input
                              type="number"
                              min={1}
                              value={item.qty}
                              onChange={(e) =>
                                handleUpdateItemQty(item.kode_barang_variant, parseInt(e.target.value) || 1)
                              }
                              className="w-16 px-2 py-1 text-center font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </td>

                          {/* Harga Jual Real */}
                          <td className="px-3 py-3 text-right">
                            <div className="font-semibold text-gray-800">{formatIDR(item.harga_real)}</div>
                            <div className="text-[10px] text-gray-400">Total: {formatIDR(subtotalReal)}</div>
                          </td>

                          {/* KOLOM HARGA PROMO PER ITEM (WAJIB DIISI) */}
                          <td className="px-3 py-3 text-right bg-emerald-50/40 border-x border-emerald-200">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-xs">
                                Rp
                              </span>
                              <input
                                type="number"
                                min={0}
                                step={500}
                                value={item.harga_promo || ""}
                                onChange={(e) =>
                                  handleUpdateItemHargaPromo(
                                    item.kode_barang_variant,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                placeholder="0"
                                className={`w-full pl-8 pr-2 py-1.5 text-right font-bold text-sm rounded-lg border focus:outline-none focus:ring-2 ${
                                  isZeroPromo
                                    ? "border-rose-400 bg-rose-50 text-rose-900 focus:ring-rose-500"
                                    : "border-emerald-300 bg-white text-emerald-900 focus:ring-emerald-500"
                                }`}
                              />
                            </div>
                            {isZeroPromo ? (
                              <div className="text-[10px] text-rose-600 font-semibold mt-1 flex items-center justify-end gap-1">
                                <AlertCircle className="w-3 h-3" /> Wajib diisi &gt; 0
                              </div>
                            ) : (
                              item.harga_real > item.harga_promo && (
                                <div className="text-[10px] text-emerald-700 font-semibold mt-1">
                                  Hemat Rp {(item.harga_real - item.harga_promo).toLocaleString("id-ID")}
                                </div>
                              )
                            )}
                          </td>

                          {/* Subtotal Promo */}
                          <td className="px-3 py-3 text-right font-bold text-emerald-800 text-sm">
                            {formatIDR(subtotalPromo)}
                          </td>

                          {/* Diskon / Hemat */}
                          <td className="px-3 py-3 text-right">
                            <div className="font-semibold text-emerald-600">{formatIDR(hematItem)}</div>
                            {subtotalReal > 0 && hematItem > 0 && (
                              <div className="text-[10px] font-bold text-rose-600">
                                -{((hematItem / subtotalReal) * 100).toFixed(0)}%
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromBundling(item.kode_barang_variant)}
                              className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Hapus dari paket"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Form Card 4: Ringkasan Total Harga Promo Bundling & Action */}
          <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-gray-950 text-white rounded-2xl p-6 shadow-md border border-emerald-700/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Box 1: Total Real */}
              <div className="p-4 rounded-xl bg-white/10 border border-white/10 space-y-1">
                <span className="text-xs uppercase tracking-wider text-emerald-200 font-semibold">
                  Total Harga Normal (Real)
                </span>
                <div className="text-xl sm:text-2xl font-bold line-through text-emerald-300">
                  {formatIDR(totals.totalReal)}
                </div>
                <div className="text-[11px] text-emerald-100/70">
                  Akumulasi {totals.totalQty} pcs dari {bundlingItems.length} produk
                </div>
              </div>

              {/* Box 2: Total Bundling Promo */}
              <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-400/40 space-y-1">
                <span className="text-xs uppercase tracking-wider text-emerald-200 font-extrabold flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-300" />
                  TOTAL HARGA PROMO BUNDLING
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300">
                  {formatIDR(totals.totalPromo)}
                </div>
                <div className="text-[11px] text-emerald-200">
                  Harga kesatuan 1 paket bundling yang muncul di kasir
                </div>
              </div>

              {/* Box 3: Total Hemat */}
              <div className="p-4 rounded-xl bg-rose-500/20 border border-rose-400/30 space-y-1">
                <span className="text-xs uppercase tracking-wider text-rose-200 font-semibold">
                  Total Diskon / Penghematan
                </span>
                <div className="text-xl sm:text-2xl font-bold text-rose-300">
                  {formatIDR(totals.totalDiskon)}
                </div>
                <div className="text-[11px] text-rose-200">
                  Pelanggan hemat {totals.persenDiskon.toFixed(1)}% dari harga normal
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 pt-6 border-t border-emerald-700/50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (bundlingItems.length < 2) {
                      Swal.fire("Info", "Tambahkan minimal 2 item untuk preview label cetak.", "info");
                      return;
                    }
                    setPrintData({
                      nama_promosi: namaPromo || "PROMO BUNDLING",
                      barcode_bundling: barcodeBundling || "BDL-SAMPLE",
                      total_harga_real: totals.totalReal,
                      total_harga_bundling: totals.totalPromo,
                      total_diskon: totals.totalDiskon,
                      valid_from: tanggalMulai,
                      valid_to: tanggalSelesai,
                      items: bundlingItems.map((b) => ({
                        nama_barang: b.nama_barang,
                        nama_varian: b.nama_varian,
                        qty: b.qty,
                        harga_real: b.harga_real,
                        harga_promo: b.harga_promo,
                      })),
                    });
                    setPrintModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 border border-white/20 text-xs font-semibold transition-all inline-flex items-center gap-2"
                >
                  <Printer className="w-4 h-4 text-emerald-300" />
                  Preview Label Barcode Siap Cetak
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTab("list")}
                  className="px-5 py-2.5 rounded-xl bg-transparent text-emerald-200 hover:text-white hover:bg-white/10 text-sm font-semibold transition-all"
                >
                  Batal
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSavePromo}
                  className="px-6 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-bold text-sm transition-all shadow-lg inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {editingId ? "Perbarui Promo Bundling" : "Simpan Promo Bundling"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: PREVIEW & CETAK LABEL BARCODE (READY TO PRINT) */}
      {printModalOpen && printData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-gray-900 text-base">Cetak Label Barcode Bundling</h3>
              </div>
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Option Label Size */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">Format Ukuran Stiker:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintLabelSize("70x40")}
                  className={`px-2.5 py-1 rounded-lg font-medium border ${
                    printLabelSize === "70x40"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-400 font-bold"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                  }`}
                >
                  Thermal 70 x 40 mm
                </button>
                <button
                  type="button"
                  onClick={() => setPrintLabelSize("50x30")}
                  className={`px-2.5 py-1 rounded-lg font-medium border ${
                    printLabelSize === "50x30"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-400 font-bold"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                  }`}
                >
                  Thermal 50 x 30 mm
                </button>
              </div>
            </div>

            {/* PRINTABLE LABEL CONTAINER */}
            <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-center">
              <div
                id="printable-bundle-label"
                className={`bg-white text-black p-4 border border-gray-300 rounded-lg shadow-sm text-center flex flex-col items-center justify-between mx-auto ${
                  printLabelSize === "70x40" ? "w-[300px] min-h-[220px]" : "w-[240px] min-h-[180px]"
                }`}
              >
                {/* Store Header */}
                <div className="border-b border-black w-full pb-1 mb-1">
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-black">
                    GWEN BEAUTY STORE
                  </div>
                  <div className="text-[9px] font-bold tracking-tight text-gray-700">PAKET PROMO BUNDLING</div>
                </div>

                {/* Promo Name */}
                <div className="font-extrabold text-xs text-black leading-tight uppercase px-1 line-clamp-2 my-1">
                  {printData.nama_promosi}
                </div>

                {/* Barcode Visual */}
                <div className="my-1 w-full flex justify-center">
                  <BarcodeVisual
                    value={printData.barcode_bundling}
                    width={printLabelSize === "70x40" ? 1.6 : 1.3}
                    height={printLabelSize === "70x40" ? 42 : 32}
                    fontSize={printLabelSize === "70x40" ? 12 : 10}
                  />
                </div>

                {/* Package Items Snippet */}
                <div className="text-[10px] text-gray-800 w-full text-left bg-gray-50 p-1.5 rounded border border-gray-200 my-1 space-y-0.5">
                  <div className="font-bold text-[9px] uppercase tracking-wider text-gray-600">Isi Paket:</div>
                  {printData.items.slice(0, 4).map((it, i) => (
                    <div key={i} className="truncate text-[9px] leading-tight">
                      • {it.qty}x {it.nama_barang} ({it.nama_varian || "Std"})
                    </div>
                  ))}
                  {printData.items.length > 4 && (
                    <div className="text-[8px] text-gray-500 italic">+{printData.items.length - 4} item lainnya</div>
                  )}
                </div>

                {/* Price Display */}
                <div className="w-full pt-1 border-t border-black flex items-center justify-between">
                  <div className="text-left">
                    <div className="text-[8px] text-gray-500 line-through">
                      {formatIDR(printData.total_harga_real)}
                    </div>
                    <div className="text-[8px] font-bold text-black">HARGA PAKET:</div>
                  </div>
                  <div className="text-base font-extrabold text-black">
                    {formatIDR(printData.total_harga_bundling)}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleTriggerPrint}
                className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md inline-flex items-center gap-1.5 transition-all"
              >
                <Printer className="w-4 h-4" />
                Cetak Label Sekarang (Print)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DETAIL PAKET BUNDLING */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-gray-900 text-base">Detail Paket Promo Bundling</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="py-12 text-center text-sm text-gray-500">Memuat rincian paket...</div>
            ) : detailData ? (
              <div className="space-y-4">
                {/* Header Information */}
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/60 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-base text-emerald-950">
                        {detailData.header?.nama_promosi}
                      </h4>
                      <p className="text-xs text-gray-600">{detailData.header?.deskripsi || "-"}</p>
                    </div>

                    {detailData.bundling_header?.barcode_bundling && (
                      <div className="flex flex-col items-center sm:items-end">
                        <BarcodeVisual
                          value={detailData.bundling_header.barcode_bundling}
                          width={1.5}
                          height={35}
                          fontSize={11}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-xs text-gray-700">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Kode Dokumen:</span>
                      <span className="font-mono font-semibold">{detailData.header?.kode_t_promosi}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Periode Promo:</span>
                      <span className="font-medium">
                        {formatDate(detailData.header?.valid_from)} s/d {formatDate(detailData.header?.valid_to)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Jam Berlaku:</span>
                      <span className="font-medium">
                        {detailData.header?.time_from || "00:00"} - {detailData.header?.time_to || "23:59"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items in Bundling */}
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Rincian Item Produk &amp; Harga Promo:
                  </h5>
                  <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50 text-gray-600 font-semibold uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Nama Produk</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-right">Harga Real</th>
                          <th className="px-3 py-2 text-right text-emerald-800 bg-emerald-50/50">Harga Promo</th>
                          <th className="px-3 py-2 text-right">Subtotal Promo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(detailData.bundling_items || []).map((bi: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="font-semibold text-gray-900">{bi.nama_barang}</div>
                              <div className="text-[10px] text-gray-400">
                                {bi.nama_varian} {bi.barcode_varian ? `(${bi.barcode_varian})` : ""}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center font-bold">{bi.qty}</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-500">
                              {formatIDR(bi.harga_real)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-800 bg-emerald-50/30">
                              {formatIDR(bi.harga_promo)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-900">
                              {formatIDR(bi.subtotal_promo)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] block">TOTAL HARGA NORMAL:</span>
                    <span className="font-bold text-gray-500 line-through text-sm">
                      {formatIDR(Number(detailData.bundling_header?.total_harga_real || 0))}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-700 text-[10px] font-bold block">HARGA PAKET BUNDLING:</span>
                    <span className="font-extrabold text-emerald-700 text-lg">
                      {formatIDR(Number(detailData.bundling_header?.total_harga_bundling || 0))}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Tutup
              </button>
              {detailData && (
                <button
                  type="button"
                  onClick={() => {
                    setPrintData({
                      nama_promosi: detailData.header?.nama_promosi,
                      barcode_bundling:
                        detailData.bundling_header?.barcode_bundling || detailData.header?.barcode_bundling,
                      total_harga_real: Number(detailData.bundling_header?.total_harga_real || 0),
                      total_harga_bundling: Number(detailData.bundling_header?.total_harga_bundling || 0),
                      total_diskon: Number(detailData.bundling_header?.total_diskon || 0),
                      valid_from: detailData.header?.valid_from,
                      valid_to: detailData.header?.valid_to,
                      items: (detailData.bundling_items || []).map((b: any) => ({
                        nama_barang: b.nama_barang,
                        nama_varian: b.nama_varian,
                        qty: Number(b.qty || 1),
                        harga_real: Number(b.harga_real || 0),
                        harga_promo: Number(b.harga_promo || 0),
                      })),
                    });
                    setDetailModalOpen(false);
                    setPrintModalOpen(true);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Label Barcode Ini
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
