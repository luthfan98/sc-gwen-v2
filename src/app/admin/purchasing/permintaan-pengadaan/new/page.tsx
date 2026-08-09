"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckSquare,
  Plus,
  Search,
  Trash2,
  Warehouse,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Info,
  X,
  Check,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";

type Item = {
  id: string;
  parentId: string;
  kodeDRpo?: string | null;
  kodeBarang: string;
  kodeBarangVariant?: string | null;
  idVarian?: number | null;
  kodeVarian?: string | null;
  barcodeVarian?: string | null;
  satuan?: string;
  supplier: string;
  nama: string;
  variant: string;
  stok: number | null;
  buffer: number | null;
  hargaBeli: number | null;
  lastHargaBeli: number | null;
  hargaHET: number | null;
  qtyOrder: number;
  catatan?: string;
  hargaStatus?: "NAIK" | "TURUN" | null;
  disc1?: number | null;
  disc2?: number | null;
  disc3?: number | null;
};
type ProductGroup = {
  id: string;
  nama: string;
  supplier: string;
  variants: Item[];
};

type Supplier = {
  id_supplier?: number;
  kode_supplier?: string;
  nama?: string;
  supplier_status?: number;
  status?: number;
  telp_1?: string;
};

type SupplierDetail = {
  id_supplier?: number;
  kode_supplier?: string;
  nama?: string;
  alamat?: string;
  kota?: string;
  provinsi?: string;
  kode_pos?: string;
  negara?: string;
  telp_1?: string;
  telp_2?: string;
  email?: string;
  npwp?: string;
  nama_npwp?: string;
  nama_bank?: string;
  no_rekening?: string;
  atas_nama?: string;
  cabang?: string;
};

type WaRecipient = {
  id: string;
  label: string;
  phone?: string;
};

type SupplierContact = {
  id_contact: number;
  kode_supplier: string;
  nama: string;
  jabatan?: string;
  tipe: string;
  nilai: string;
  label?: string;
  is_active?: boolean;
};

type HargaBeliHistoryRow = {
  tgl?: string | null;
  kode_t_pengadaan?: string | null;
  qty?: number | null;
  harga_beli?: number | null;
  disc_1?: number | null;
  disc_2?: number | null;
  disc_3?: number | null;
  harga_beli_nett?: number | null;
};

const formatIDR = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

const deriveHargaStatus = (current: number | null, last: number | null): Item["hargaStatus"] => {
  if (current === null || last === null) return null;
  if (current > last) return "NAIK";
  if (current < last) return "TURUN";
  return null;
};

const selectAllOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

const parseNumberInput = (val: string | number): number | null => {
  if (typeof val === "number") return val;
  const raw = val.trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;

  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");
  let normalized = cleaned;

  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    normalized = cleaned.split(thousandsSep).join("").replace(decimalSep, ".");
  } else if (hasComma) {
    const parts = cleaned.split(",");
    if (parts.length > 2) {
      normalized = parts.join("");
    } else {
      const [intPart, decPart] = parts;
      normalized = decPart.length <= 2 ? `${intPart.replace(/\./g, "")}.${decPart}` : cleaned.replace(/,/g, "");
    }
  } else if (hasDot) {
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      normalized = parts.join("");
    } else {
      const [intPart, decPart] = parts;
      normalized = decPart.length <= 2 ? `${intPart.replace(/,/g, "")}.${decPart}` : cleaned.replace(/\./g, "");
    }
  }

  const num = Number(normalized);
  return isNaN(num) ? null : num;
};

const formatNumberInput = (val: number | null | undefined) => {
  if (val === null || val === undefined || Number.isNaN(val)) return "";
  return val.toLocaleString("id-ID");
};

const formatShortDate = (val?: string | null) => {
  if (!val) return "-";
  const str = String(val);
  if (str.includes("T")) return str.slice(0, 10);
  return str.length >= 10 ? str.slice(0, 10) : str;
};

const buildApiUrl = (base: string, path: string) => {
  const cleanBase = String(base || "").trim();
  const cleanPath = String(path || "").trim();
  if (!cleanBase) return cleanPath;
  if (cleanBase.startsWith("http://") || cleanBase.startsWith("https://")) {
    return `${cleanBase.replace(/\/+$/, "")}/${cleanPath.replace(/^\/+/, "")}`;
  }
  if (cleanBase.startsWith("/")) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${cleanBase.replace(/\/+$/, "")}/${cleanPath.replace(/^\/+/, "")}`;
    }
    return `${cleanBase.replace(/\/+$/, "")}/${cleanPath.replace(/^\/+/, "")}`;
  }
  return `${cleanBase.replace(/\/+$/, "")}/${cleanPath.replace(/^\/+/, "")}`;
};

const getCurrentUsername = () => {
  const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
  if (!rawSession) return "Admin";
  try {
    const parsed = JSON.parse(rawSession);
    return String(parsed?.username || parsed?.name || "Admin").trim() || "Admin";
  } catch {
    return "Admin";
  }
};

const clampPercent = (val: number | null | undefined) => {
  if (val === null || val === undefined || Number.isNaN(val)) return 0;
  if (val < 0) return 0;
  if (val > 100) return 100;
  return val;
};

const pickFirstPositive = (...vals: Array<number | null | undefined>) => {
  for (const val of vals) {
    if (val === null || val === undefined) continue;
    if (Number.isFinite(val) && val > 0) return val;
  }
  return null;
};

const MAX_CATATAN_LENGTH = 500;

const calculateItemTotals = (item: Item, mode: "PERCENT" | "NOMINAL" = "PERCENT") => {
  const qty = item.qtyOrder ?? 0;
  const harga = item.hargaBeli ?? 0;
  const gross = harga * qty;
  const d1 = clampPercent(item.disc1);
  const d2 = clampPercent(item.disc2);
  const d3 = clampPercent(item.disc3);
  if (mode === "NOMINAL") {
    const hargaSafe = Number(harga) || 0;
    const nominalPerUnit = hargaSafe > 0 ? (hargaSafe * (d1 + d2 + d3)) / 100 : 0;
    const diskon = Math.min(nominalPerUnit * qty, gross);
    const net = Math.max(gross - diskon, 0);
    return { gross, net, diskon };
  }
  const afterD1 = gross * (1 - d1 / 100);
  const afterD2 = afterD1 * (1 - d2 / 100);
  const afterD3 = afterD2 * (1 - d3 / 100);
  const net = Math.max(afterD3, 0);
  const diskon = gross - net;
  return { gross, net, diskon };
};

export default function PermintaanPengadaanNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editKode = searchParams.get("edit");
  const STORAGE_KEY = "permintaan-pengadaan-new";
  const [nomorAuto, setNomorAuto] = useState<string>("");
  const [tanggalAuto, setTanggalAuto] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [requestPengirimanDari, setRequestPengirimanDari] = useState<string>("");
  const [requestPengirimanSampai, setRequestPengirimanSampai] = useState<string>("");
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const [supplier, setSupplier] = useState<string>("");
  const [supplierCode, setSupplierCode] = useState<string>("");
  const [supplierDetail, setSupplierDetail] = useState<SupplierDetail>({});
  const [supplierForm, setSupplierForm] = useState<SupplierDetail>({});
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rpoList, setRpoList] = useState<Item[]>([]);
  const [moveSelectedIds, setMoveSelectedIds] = useState<Set<string>>(new Set());
  const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: string; telp?: string; kode?: string }[]>([]);
  const [loadingSup, setLoadingSup] = useState(false);
  const [errorSup, setErrorSup] = useState<string | null>(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [barangData, setBarangData] = useState<ProductGroup[]>([]);
  const [loadingBarang, setLoadingBarang] = useState(false);
  const [errorBarang, setErrorBarang] = useState<string | null>(null);
  const [historyModal, setHistoryModal] = useState<{ open: boolean; item?: Item }>({ open: false });
  const [historyRows, setHistoryRows] = useState<HargaBeliHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [poHistorySet, setPoHistorySet] = useState<Set<string>>(new Set());
  const [poHistoryLoading, setPoHistoryLoading] = useState(false);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waRecipients, setWaRecipients] = useState<WaRecipient[]>([]);
  const [waTempSelected, setWaTempSelected] = useState<Set<string>>(new Set());
  const [waContacts, setWaContacts] = useState<SupplierContact[]>([]);
  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [waForm, setWaForm] = useState({ nama: "", jabatan: "", tipe: "WA", nilai: "", label: "" });
  const [waFormOpen, setWaFormOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [groupDrafts, setGroupDrafts] = useState<Record<
    string,
    { hargaHET?: string; hargaBeli?: string; qty?: string; catatan?: string; disc1?: string; disc2?: string; disc3?: string }
  >>({});
  const [discDrafts, setDiscDrafts] = useState<Record<string, { disc1?: string; disc2?: string; disc3?: string }>>({});
  const [discountMode, setDiscountMode] = useState<"PERCENT" | "NOMINAL">("PERCENT");
  const [itemSortDir, setItemSortDir] = useState<"asc" | "desc">("asc");
  const supplierLocked = rpoList.length > 0;
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [initialLoading, setInitialLoading] = useState<boolean>(false);

  useEffect(() => {
    const now = new Date();
    setTanggalAuto(now.toISOString().slice(0, 10));
    const dl = new Date(now);
    dl.setDate(dl.getDate() + 7);
    setDeadline(dl.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (editKode) return;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setSessionLoaded(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed.nomorAuto) setNomorAuto(parsed.nomorAuto);
      if (parsed.tanggalAuto) setTanggalAuto(parsed.tanggalAuto);
      if (parsed.deadline) setDeadline(parsed.deadline);
      if (parsed.requestPengirimanDari) setRequestPengirimanDari(parsed.requestPengirimanDari);
      if (parsed.requestPengirimanSampai) setRequestPengirimanSampai(parsed.requestPengirimanSampai);
      if (parsed.supplier) setSupplier(parsed.supplier);
      if (parsed.supplierCode) setSupplierCode(parsed.supplierCode);
      if (parsed.supplierQuery) setSupplierQuery(parsed.supplierQuery);
      if (parsed.search) setSearch(parsed.search);
      if (Array.isArray(parsed.rpoList)) {
        // pastikan field display tetap ada agar tabel tidak kosong saat reload
        const normalized = parsed.rpoList.map((it: any) => {
          const namaVal = it.nama || it.variant || "";
          const variantVal = it.variant || it.nama || "";
          return {
            ...it,
            nama: namaVal || it.kodeBarang || it.parentId || "",
            variant: variantVal || it.kodeBarangVariant || it.kodeVarian || it.kodeBarang || it.parentId || "",
            supplier: it.supplier || parsed.supplier || "",
            barcodeVarian: it.barcodeVarian ?? null,
            stok: it.stok ?? null,
            buffer: it.buffer ?? null,
            hargaStatus: it.hargaStatus ?? null,
            lastHargaBeli: it.lastHargaBeli ?? null,
          };
        });
        setRpoList(normalized);
      }
      if (Array.isArray(parsed.waRecipients)) setWaRecipients(parsed.waRecipients);
      if (parsed.discountMode === "NOMINAL") setDiscountMode("NOMINAL");
      if (parsed.discountMode === "PERCENT") setDiscountMode("PERCENT");
    } catch (err) {
      console.error("Failed to load session data", err);
    } finally {
      setSessionLoaded(true);
    }
  }, [STORAGE_KEY, editKode]);

  const fetchDocCode = async () => {
    try {
      setGeneratingCode(true);
      const res = await fetch(`${API_BASE}/doc-code/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "RPO", userCode: "88", branchCode: "GW", padLength: 5, separator: "." }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNomorAuto(data.generatedCode || "");
    } catch (err) {
      console.error("Failed to generate doc code", err);
    } finally {
      setGeneratingCode(false);
    }
  };

  useEffect(() => {
    if (sessionLoaded && !nomorAuto && !editKode) {
      fetchDocCode();
    }
  }, [sessionLoaded, nomorAuto, editKode]);

  // Load data saat edit
  useEffect(() => {
    const loadEdit = async () => {
      if (!editKode) return;
      setInitialLoading(true);
      try {
        const res = await fetch(`${API_BASE}/rpo/${encodeURIComponent(editKode)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const header = data.header || {};
        const items = Array.isArray(data.items) ? data.items : [];
        setNomorAuto(header.kode_t_rpo || editKode);
        if (header.tgl) setTanggalAuto(String(header.tgl).slice(0, 10));
        if (header.deadline) setDeadline(String(header.deadline).slice(0, 10));
        if (header.request_pengiriman_dari) setRequestPengirimanDari(String(header.request_pengiriman_dari).slice(0, 10));
        if (header.request_pengiriman_sampai) setRequestPengirimanSampai(String(header.request_pengiriman_sampai).slice(0, 10));
        const supNama = header.supplier_nama || header.kode_supplier || "";
        setSupplier(supNama);
        setSupplierCode(header.kode_supplier || "");
        setSupplierQuery(supNama);
        const mapped: Item[] = items.map((it: any, idx: number) => ({
          id: `${it.kode_barang_variant || it.kode_barang || "ITEM"}-${idx}`,
          parentId: it.kode_barang || "",
          kodeDRpo: it.kode_d_rpo || null,
          kodeBarang: it.kode_barang || "",
          kodeBarangVariant: it.kode_barang_variant || null,
          idVarian: null,
          kodeVarian: it.kode_varian || null,
          barcodeVarian: it.barcode_varian || it.barcode_global || null,
          satuan: it.satuan || "PCS",
          supplier: supNama,
          nama: it.barang_nama || it.nama_varian || "",
          variant: it.nama_varian || it.barang_nama || "",
          stok: it.stok_pusat_snapshot ?? null,
          buffer: it.buffer_snapshot ?? null,
          hargaBeli: it.harga_beli ?? null,
          lastHargaBeli: it.harga_beli_terakhir ?? null,
          hargaHET: it.het ?? null,
          qtyOrder: it.qty ?? 0,
          catatan: it.catatan || "",
          hargaStatus: it.status_harga || null,
          disc1: it.disc_1 ?? 0,
          disc2: it.disc_2 ?? 0,
          disc3: it.disc_3 ?? 0,
        }));
        setRpoList(mapped);
      } catch (err) {
        console.error("Failed load RPO for edit", err);
      } finally {
        setSessionLoaded(true);
        setInitialLoading(false);
      }
    };
    loadEdit();
  }, [editKode, API_BASE]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Saat edit, jangan simpan ke session untuk menghindari payload besar & quota errors
    if (editKode) return;
    if (!sessionLoaded) return;
    try {
      const slimList = rpoList.map((it) => ({
        id: it.id,
        parentId: it.parentId,
        kodeBarang: it.kodeBarang,
        kodeBarangVariant: it.kodeBarangVariant,
        kodeVarian: it.kodeVarian,
        nama: it.nama,
        variant: it.variant,
        supplier: it.supplier,
        barcodeVarian: it.barcodeVarian,
        stok: it.stok,
        buffer: it.buffer,
        qtyOrder: it.qtyOrder,
        hargaBeli: it.hargaBeli,
        hargaHET: it.hargaHET,
        disc1: it.disc1,
        disc2: it.disc2,
        disc3: it.disc3,
        catatan: it.catatan,
        hargaStatus: it.hargaStatus,
        lastHargaBeli: it.lastHargaBeli,
      }));
      const payload = {
        nomorAuto,
        tanggalAuto,
        deadline,
        requestPengirimanDari,
        requestPengirimanSampai,
        supplier,
        supplierCode,
        supplierQuery,
        search,
        discountMode,
        rpoList: slimList,
        waRecipients,
      };
      const json = JSON.stringify(payload);
      sessionStorage.setItem(STORAGE_KEY, json);
    } catch (err) {
      console.warn("Skip sessionStorage setItem", err);
    }
  }, [
    STORAGE_KEY,
    nomorAuto,
    tanggalAuto,
    deadline,
    requestPengirimanDari,
    requestPengirimanSampai,
    supplier,
    supplierCode,
    supplierQuery,
    search,
    discountMode,
    rpoList,
    waRecipients,
    editKode,
    sessionLoaded,
  ]);

  useEffect(() => {
    const fetchSuppliers = async () => {
      setLoadingSup(true);
      setErrorSup(null);
      try {
        const res = await fetch(`${API_BASE}/suppliers`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Supplier[] = await res.json();
        if (!Array.isArray(data)) {
          setSupplierOptions([]);
          return;
        }
        const opts = data
          .filter((s) => {
            const statusVal = Number(s.status ?? s.supplier_status ?? 0);
            return statusVal === 1;
          })
          .map((s) => ({
            label: s.nama ?? s.kode_supplier ?? "-",
            value: s.nama ?? s.kode_supplier ?? "",
            telp: s.telp_1,
            kode: s.kode_supplier,
          }))
          .filter((s) => s.value);
        setSupplierOptions(opts);
      } catch (err) {
        console.error("Failed fetch suppliers", err);
        setErrorSup("Gagal memuat supplier");
        setSupplierOptions([]);
      } finally {
        setLoadingSup(false);
      }
    };
    fetchSuppliers();
  }, [API_BASE]);

  useEffect(() => {
    const fetchBarang = async () => {
      setLoadingBarang(true);
      setErrorBarang(null);
      try {
        const res = await fetch(`${API_BASE}/barang`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) {
          setBarangData([]);
          return;
        }
        const mapped: ProductGroup[] = data.map((b: any) => {
          const variants =
            Array.isArray(b.variants) && b.variants.length > 0 ? b.variants : [{ nama: b.nama || "", kode: "BASE" }];
          const supplierName = b.nama_supplier || b.kode_supplier || "";
          const kodeBarang = b.kode_barang || String(b.id_barang);
          return {
            id: String(b.id_barang),
            nama: b.nama || "",
            supplier: supplierName,
            variants: variants.map((v: any, idx: number) => {
              const hargaBeli = pickFirstPositive(v.harga_beli_sat_1, b.harga_beli_sat_1);
              const hargaHET = pickFirstPositive(v.het_sat_1, b.het_sat_1);
              const lastHargaBeli = pickFirstPositive(b.harga_beli_sat_1);
              return {
                id: v.kode_barang_variant || String(v.id_varian ?? `${b.id_barang}-${idx}-${v.kode || v.nama || "BASE"}`),
                parentId: kodeBarang,
                kodeBarang,
                kodeBarangVariant: v.kode_barang_variant || null,
                idVarian: typeof v.id_varian === "number" ? v.id_varian : v.id_varian ? Number(v.id_varian) : null,
                kodeVarian: v.kode || (v.id_varian ? String(v.id_varian) : `VAR-${b.id_barang}-${idx}`),
                barcodeVarian: v.barcode || b.barcode_global || null,
                satuan: b.satuan_1 || "PCS",
                supplier: supplierName,
                nama: b.nama || "",
                variant: v.nama || b.nama || "",
                stok: v.stok_toko ?? v.stok_available ?? 0,
                buffer: v.buffer_min ?? b.buffer_stok ?? null,
                hargaBeli,
                lastHargaBeli,
                hargaHET,
                qtyOrder: 1,
                catatan: "",
                disc1: 0,
                disc2: 0,
                disc3: 0,
                hargaStatus: deriveHargaStatus(hargaBeli, lastHargaBeli),
              };
            }),
          };
        });
        setBarangData(mapped);
      } catch (err) {
        console.error("Failed fetch barang", err);
        setErrorBarang("Gagal memuat barang");
        setBarangData([]);
      } finally {
        setLoadingBarang(false);
      }
    };
    fetchBarang();
  }, [API_BASE]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!historyModal.open || !historyModal.item) {
        setHistoryRows([]);
        setHistoryError(null);
        setHistoryLoading(false);
        return;
      }

      const kodeVarian = String(historyModal.item.kodeBarangVariant || "").trim();
      if (!kodeVarian) {
        setHistoryRows([]);
        setHistoryError("Kode varian tidak tersedia.");
        return;
      }

      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const baseUrl = buildApiUrl(API_BASE, "/pengadaan/harga-beli-history");
        const url = `${baseUrl}?kode_barang_variant=${encodeURIComponent(kodeVarian)}&limit=20`;
        const res = await fetch(url);
        if (!res.ok) {
          let message = `HTTP ${res.status}`;
          try {
            const errBody = await res.json();
            if (errBody?.message) message = String(errBody.message);
          } catch {
            // ignore parse error
          }
          throw new Error(message);
        }
        const data = await res.json();
        const mapped: HargaBeliHistoryRow[] = Array.isArray(data)
          ? data.map((row: any) => ({
              tgl: row.tgl ?? null,
              kode_t_pengadaan: row.kode_t_pengadaan ?? null,
              qty: row.qty !== undefined ? Number(row.qty) : null,
              harga_beli: row.harga_beli !== undefined ? Number(row.harga_beli) : null,
              disc_1: row.disc_1 !== undefined ? Number(row.disc_1) : null,
              disc_2: row.disc_2 !== undefined ? Number(row.disc_2) : null,
              disc_3: row.disc_3 !== undefined ? Number(row.disc_3) : null,
              harga_beli_nett: row.harga_beli_nett !== undefined ? Number(row.harga_beli_nett) : null,
            }))
          : [];
        setHistoryRows(mapped);
      } catch (err) {
        console.error("Failed fetch harga beli history", err);
        setHistoryRows([]);
        const msg = err instanceof Error ? err.message : "Gagal memuat riwayat harga beli.";
        setHistoryError(msg);
      } finally {
        setHistoryLoading(false);
      }
    };

    loadHistory();
  }, [historyModal.open, historyModal.item?.kodeBarangVariant, API_BASE]);

  useEffect(() => {
    if (waModalOpen) {
      setWaTempSelected(new Set(waRecipients.map((r) => r.id)));
    }
  }, [waModalOpen, waRecipients]);

  useEffect(() => {
    if (supplier && !supplierCode) {
      const match = supplierOptions.find((s) => s.label === supplier || s.value === supplier);
      if (match?.kode) setSupplierCode(match.kode);
    }
  }, [supplier, supplierCode, supplierOptions]);

  useEffect(() => {
    const fetchSupplierDetail = async () => {
      if (!supplierCode) {
        setSupplierDetail({});
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/suppliers/by-code/${encodeURIComponent(supplierCode)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SupplierDetail = await res.json();
        setSupplierDetail(data || {});
      } catch (err) {
        console.error("Failed fetch supplier detail", err);
        setSupplierDetail({});
      }
    };
    fetchSupplierDetail();
  }, [supplierCode, API_BASE]);

  useEffect(() => {
    const fetchContacts = async () => {
      if (!supplierCode) {
        setWaContacts([]);
        return;
      }
      setWaLoading(true);
      setWaError(null);
      try {
        const res = await fetch(`${API_BASE}/suppliers/${encodeURIComponent(supplierCode)}/contacts`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SupplierContact[] = await res.json();
        setWaContacts(Array.isArray(data) ? data.filter((c) => c.is_active !== false) : []);
      } catch (err) {
        console.error("Failed fetch supplier contacts", err);
        setWaError("Gagal memuat kontak supplier");
        setWaContacts([]);
      } finally {
        setWaLoading(false);
      }
    };
    fetchContacts();
  }, [supplierCode, API_BASE]);

  useEffect(() => {
    if (supplierModalOpen) {
      setSupplierForm(supplierDetail || {});
    }
  }, [supplierModalOpen, supplierDetail]);

  const filteredGroups = useMemo(() => {
    if (!supplier) return [];
    const key = search.toLowerCase();
    const existingIds = new Set(rpoList.map((i) => i.id));
    return barangData
      .filter((group) => group.supplier === supplier)
      .map((group) => ({
        ...group,
        variants: group.variants
          .filter((v) => `${v.nama} ${v.variant} ${v.barcodeVarian || ""}`.toLowerCase().includes(key))
          .filter((v) => !existingIds.has(v.id)),
      }))
      .filter((group) => group.variants.length > 0);
  }, [supplier, search, barangData, rpoList]);

  const filteredVariants = useMemo(() => filteredGroups.flatMap((g) => g.variants), [filteredGroups]);
  const filteredVariantCount = filteredVariants.length;

  useEffect(() => {
    const kodeList = Array.from(
      new Set(
        filteredVariants
          .map((v) => String(v.kodeBarangVariant || "").trim())
          .filter((v) => v)
      )
    );
    if (kodeList.length === 0) {
      setPoHistorySet(new Set());
      setPoHistoryLoading(false);
      return;
    }
    let cancelled = false;
    const loadPoHistory = async () => {
      setPoHistoryLoading(true);
      try {
        const url = buildApiUrl(API_BASE, "/pengadaan/po-exists");
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kode_barang_variant_list: kodeList }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const set = new Set<string>();
        if (Array.isArray(data)) {
          data.forEach((row: any) => {
            const key = String(row?.kode_barang_variant || "").trim();
            if (key) set.add(key);
          });
        }
        setPoHistorySet(set);
      } catch (err) {
        console.error("Failed fetch PO history list", err);
        if (!cancelled) setPoHistorySet(new Set());
      } finally {
        if (!cancelled) setPoHistoryLoading(false);
      }
    };
    loadPoHistory();
    return () => {
      cancelled = true;
    };
  }, [filteredVariants, API_BASE]);

  // index varian dari master barang untuk memperkaya data RPO (nama/varian/satuan/harga)
  const variantIndex = useMemo(() => {
    const map = new Map<
      string,
      {
        namaBarang: string;
        namaVarian: string;
        satuan?: string;
        hargaBeli?: number | null;
        hargaHET?: number | null;
      }
    >();
    barangData.forEach((g) => {
      g.variants.forEach((v) => {
        const key = v.kodeBarangVariant || v.kodeVarian || v.id;
        map.set(key, {
          namaBarang: v.nama || g.nama || "",
          namaVarian: v.variant || v.nama || g.nama || "",
          satuan: v.satuan,
          hargaBeli: v.hargaBeli,
          hargaHET: v.hargaHET,
        });
      });
    });
    return map;
  }, [barangData]);

  // Perkaya item RPO dengan nama/varian dari master barang (hindari tampil kode)
  useEffect(() => {
    if (variantIndex.size === 0) return;
    setRpoList((prev) =>
      prev.map((it) => {
        const key = it.kodeBarangVariant || it.kodeVarian || it.id;
        const found = variantIndex.get(key);
        if (!found) return it;
        const namaVal = it.nama || found.namaBarang || found.namaVarian || it.kodeBarang || it.parentId || "";
        const variantVal = it.variant || found.namaVarian || found.namaBarang || it.kodeBarangVariant || it.kodeVarian || "";
        return {
          ...it,
          nama: namaVal,
          variant: variantVal,
          satuan: it.satuan || found.satuan || "PCS",
          hargaBeli: it.hargaBeli ?? found.hargaBeli ?? null,
          hargaHET: it.hargaHET ?? found.hargaHET ?? null,
        };
      })
    );
  }, [variantIndex]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const allowed = new Set(filteredVariants.map((v) => v.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id);
      });
      return next;
    });
  }, [filteredVariants]);

  useEffect(() => {
    const hasMissingKode = rpoList.some((it) => !it.kodeBarang);
    if (!hasMissingKode) return;
    setRpoList((prev) =>
      prev.map((it) => {
        if (it.kodeBarang) return it;
        const fallback = it.parentId || it.id;
        return { ...it, kodeBarang: fallback, parentId: it.parentId || fallback };
      })
    );
  }, [rpoList]);

  const waContactOptions = useMemo(
    () =>
      waContacts.map((c) => ({
        id: String(c.id_contact),
        label: c.nama || c.label || c.nilai,
        phone: c.nilai,
        detail: c.label,
        jabatan: c.jabatan,
      })),
    [waContacts]
  );

  const rpoGrouped = useMemo(() => {
    const map = new Map<string, { id: string; nama: string; variants: Item[] }>();
    rpoList.forEach((item) => {
      if (!map.has(item.parentId)) {
        map.set(item.parentId, { id: item.parentId, nama: item.nama, variants: [] });
      }
      map.get(item.parentId)!.variants.push(item);
    });
    const sortedGroups = Array.from(map.values());
    sortedGroups.forEach((g) =>
      g.variants.sort((a, b) =>
        itemSortDir === "asc"
          ? (a.variant || "").localeCompare(b.variant || "", "id")
          : (b.variant || "").localeCompare(a.variant || "", "id")
      )
    );
    return sortedGroups;
  }, [rpoList, itemSortDir]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredVariantCount) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVariants.map((i) => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addToRPO = () => {
    const picked = filteredVariants.filter((i) => selectedIds.has(i.id));
    const existing = new Set(rpoList.map((i) => i.id));
    const newItems = picked.filter((p) => !existing.has(p.id));
    const merged = [...newItems, ...rpoList];
    setRpoList(merged);
    setSelectedIds(new Set());
  };

  const removeFromRPO = (id: string) => {
    setRpoList((prev) => prev.filter((i) => i.id !== id));
  };

  const toggleWaTempSelect = (id: string) => {
    setWaTempSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyWaSelections = () => {
    const selected = waContactOptions.filter((c) => waTempSelected.has(c.id));
    const merged = [...waRecipients];
    selected.forEach((s) => {
      if (!merged.find((m) => m.id === s.id)) merged.push(s);
    });
    setWaRecipients(merged);
    setWaModalOpen(false);
  };

  const removeWaRecipient = (id: string) => {
    setWaRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const updateSupplierData = async () => {
    if (!supplierDetail.id_supplier) return;
    setSavingSupplier(true);
    try {
      const res = await fetch(`${API_BASE}/suppliers/${supplierDetail.id_supplier}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: supplierForm.nama,
          alamat: supplierForm.alamat,
          kota: supplierForm.kota,
          provinsi: supplierForm.provinsi,
          kode_pos: supplierForm.kode_pos,
          negara: supplierForm.negara,
          telp_1: supplierForm.telp_1,
          telp_2: supplierForm.telp_2,
          email: supplierForm.email,
          npwp: supplierForm.npwp,
          nama_npwp: supplierForm.nama_npwp,
          nama_bank: supplierForm.nama_bank,
          no_rekening: supplierForm.no_rekening,
          atas_nama: supplierForm.atas_nama,
          cabang: supplierForm.cabang,
          updated_by: getCurrentUsername(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSupplierDetail({ ...supplierDetail, ...supplierForm });
      setSupplierModalOpen(false);
    } catch (err) {
      console.error("Failed update supplier", err);
    } finally {
      setSavingSupplier(false);
    }
  };

  const addNewContact = async () => {
    if (!supplierCode) {
      setWaError("Pilih supplier terlebih dahulu");
      return;
    }
    if (!waForm.nama || !waForm.tipe || !waForm.nilai) {
      setWaError("Nama, tipe, dan nilai wajib diisi");
      return;
    }
    setWaError(null);
    setWaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/suppliers/${encodeURIComponent(supplierCode)}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...waForm, is_active: 1 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created: SupplierContact = await res.json();
      setWaContacts((prev) => [{ ...created, is_active: true }, ...prev]);
      setWaTempSelected((prev) => new Set(prev).add(String(created.id_contact)));
      setWaForm({ nama: "", jabatan: "", tipe: "WA", nilai: "", label: "" });
      setWaFormOpen(false);
    } catch (err) {
      console.error("Failed create contact", err);
      setWaError("Gagal menambahkan kontak");
    } finally {
      setWaLoading(false);
    }
  };

  const clearSessionData = () => {
    const now = new Date();
    const dl = new Date(now);
    dl.setDate(dl.getDate() + 7);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    setNomorAuto("");
    setTanggalAuto(now.toISOString().slice(0, 10));
    setDeadline(dl.toISOString().slice(0, 10));
    setRequestPengirimanDari("");
    setRequestPengirimanSampai("");
    setSupplier("");
    setSupplierCode("");
    setSupplierDetail({});
    setSupplierForm({});
    setSupplierQuery("");
    setSearch("");
    setSelectedIds(new Set());
    setRpoList([]);
    setGroupDrafts({});
    setWaRecipients([]);
    setWaTempSelected(new Set());
    setWaContacts([]);
    setSupplierOpen(false);
    setHistoryModal({ open: false });
  };

  const updateRpoItem = (id: string, field: keyof Item, value: string) => {
    setRpoList((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === "hargaHET" || field === "qtyOrder") {
          const num = parseNumberInput(value);
          return { ...item, [field]: num === null ? null : num };
        }
        if (field === "disc1" || field === "disc2" || field === "disc3") {
          const num = parseNumberInput(value);
          if (num === null) return { ...item, [field]: null };
          if (discountMode === "PERCENT") {
            const clamped = clampPercent(num);
            return { ...item, [field]: clamped };
          }
          const harga = Number(item.hargaBeli ?? 0);
          if (!Number.isFinite(harga) || harga <= 0) return { ...item, [field]: 0 };
          const pct = clampPercent((num / harga) * 100);
          return { ...item, [field]: pct };
        }
        if (field === "hargaBeli") {
          const num = parseNumberInput(value);
          if (num === null) return { ...item, hargaBeli: null, hargaStatus: null };
          return { ...item, hargaBeli: num, hargaStatus: deriveHargaStatus(num, item.lastHargaBeli) };
        }
        if (field === "catatan") {
          return { ...item, catatan: (value || "").slice(0, MAX_CATATAN_LENGTH) };
        }
        return { ...item, [field]: value as any };
      })
    );
  };

  const setDiscDraftValue = (id: string, field: "disc1" | "disc2" | "disc3", value: string) => {
    setDiscDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const commitDiscDraft = (id: string, field: "disc1" | "disc2" | "disc3") => {
    const raw = discDrafts[id]?.[field];
    if (raw === undefined) return;
    updateRpoItem(id, field, raw);
    setDiscDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: undefined },
    }));
  };

  const handleGroupDraftChange = (
    groupId: string,
    field: "hargaHET" | "hargaBeli" | "qty" | "catatan" | "disc1" | "disc2" | "disc3",
    value: string
  ) => {
    setGroupDrafts((prev) => ({
      ...prev,
      [groupId]: { ...prev[groupId], [field]: value },
    }));
  };

  const applyGroupField = (
    groupId: string,
    field: "hargaHET" | "hargaBeli" | "qty" | "catatan" | "disc1" | "disc2" | "disc3"
  ) => {
    const draft = groupDrafts[groupId];
    if (!draft) return;
    const val = draft[field];
    if (val === undefined || val === "") return;
    setRpoList((prev) =>
      prev.map((item) => {
        if (item.parentId !== groupId) return item;
        if (field === "hargaHET") {
          const num = parseNumberInput(val);
          if (num === null) return item;
          return { ...item, hargaHET: num };
        }
        if (field === "hargaBeli") {
          const num = parseNumberInput(val);
          if (num === null) return item;
          return { ...item, hargaBeli: num, hargaStatus: deriveHargaStatus(num, item.lastHargaBeli) };
        }
        if (field === "disc1" || field === "disc2" || field === "disc3") {
          const num = parseNumberInput(val);
          if (num === null) return item;
          if (discountMode === "PERCENT") {
            return { ...item, [field]: clampPercent(num) };
          }
          const harga = Number(item.hargaBeli ?? 0);
          if (!Number.isFinite(harga) || harga <= 0) return item;
          const pct = clampPercent((num / harga) * 100);
          return { ...item, [field]: pct };
        }
        if (field === "qty") {
          const num = parseNumberInput(val);
          if (num === null) return item;
          return { ...item, qtyOrder: num };
        }
        if (field === "catatan") return { ...item, catatan: (val as string).slice(0, MAX_CATATAN_LENGTH) };
        return item;
      })
    );
    // Bersihkan draft setelah diterapkan supaya tidak bingung saat menerapkan ulang
    setGroupDrafts((prev) => ({
      ...prev,
      [groupId]: { ...prev[groupId], [field]: "" },
    }));
  };

  const discSuffix = discountMode === "PERCENT" ? "%" : "Rp";
  const discLabel = (index: number) =>
    discountMode === "PERCENT" ? `Disc ${index} (%)` : `Disc ${index} (Rp/pcs)`;

  const formatDiscValue = (value: number | null | undefined, hargaBeli?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "";
    if (discountMode === "PERCENT") return formatNumberInput(Number(value));
    const harga = Number(hargaBeli ?? 0);
    if (!Number.isFinite(harga) || harga <= 0) return "";
    const nominal = (Number(value) / 100) * harga;
    return formatNumberInput(nominal);
  };

  const renderHargaStatus = (status?: "NAIK" | "TURUN" | null) => {
    if (!status) return <span className="text-xs text-gray-400">-</span>;
    const isUp = status === "NAIK";
    const Icon = isUp ? ArrowUp : ArrowDown;
    const color = isUp ? "text-rose-600 bg-rose-50 border-rose-200" : "text-emerald-700 bg-emerald-50 border-emerald-200";
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold ${color}`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  const aggregateTotals = useMemo(
    () =>
      rpoList.reduce(
        (acc, item) => {
          const { gross, net, diskon } = calculateItemTotals(item, discountMode);
          acc.gross += gross;
          acc.net += net;
          acc.diskon += diskon;
          acc.qty += item.qtyOrder ?? 0;
          return acc;
        },
        { gross: 0, net: 0, diskon: 0, qty: 0 }
      ),
    [rpoList, discountMode]
  );

  const totalNominal = aggregateTotals.net;
  const isPriceComplete = useMemo(
    () =>
      rpoList.length > 0 &&
      rpoList.every((it) => {
        const hb = it.hargaBeli ?? 0;
        const het = it.hargaHET ?? 0;
        return hb > 0 && het > 0;
      }),
    [rpoList]
  );

  const totalQty = aggregateTotals.qty;
  const allItemIds = useMemo(() => rpoList.map((it) => it.id), [rpoList]);
  const allSelected = allItemIds.length > 0 && moveSelectedIds.size === allItemIds.length;
  const someSelected = moveSelectedIds.size > 0 && moveSelectedIds.size < allItemIds.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const renderSkeleton = () => (
    <div className="p-4 md:p-6 space-y-4">
      <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
      <div className="h-6 w-40 bg-gray-200 animate-pulse rounded" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-32 bg-gray-200 animate-pulse rounded" />
        <div className="h-32 bg-gray-200 animate-pulse rounded" />
      </div>
      <div className="h-10 w-full bg-gray-200 animate-pulse rounded" />
      <div className="h-64 w-full bg-gray-200 animate-pulse rounded" />
    </div>
  );

  const handlePreviewOrder = () => {
    if (!supplier || rpoList.length === 0) return;
    if (typeof window !== "undefined") {
      window.open("/admin/purchasing/permintaan-pengadaan/preview", "_blank");
    }
  };

  const handleSaveDraft = async () => {
    const effectiveSupplierCode =
      supplierCode ||
      supplierOptions.find((s) => s.label === supplier || s.value === supplier || s.kode === supplierCode)?.kode ||
      "";
    if (!nomorAuto || !tanggalAuto || !effectiveSupplierCode || rpoList.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Data belum lengkap",
        text: "Lengkapi supplier, nomor RPO, dan item sebelum menyimpan draft.",
      });
      return;
    }
    if (!isPriceComplete) {
      Swal.fire({
        icon: "warning",
        title: "Harga belum lengkap",
        text: "Lengkapi HET dan Harga Beli semua item (tidak boleh 0) sebelum simpan draft.",
      });
      return;
    }
    const tooLongCatatan = rpoList.find((it) => (it.catatan || "").length > MAX_CATATAN_LENGTH);
    if (tooLongCatatan) {
      Swal.fire({
        icon: "warning",
        title: "Catatan terlalu panjang",
        text: `Catatan untuk ${tooLongCatatan.variant || tooLongCatatan.nama || tooLongCatatan.kodeBarang || "item"} maksimal ${MAX_CATATAN_LENGTH} karakter.`,
      });
      return;
    }
    try {
      const checkRes = await fetch(`${API_BASE}/rpo/${encodeURIComponent(nomorAuto)}`);
      if (checkRes.ok) {
        const confirm = await Swal.fire({
          icon: "warning",
          title: "Kode RPO sudah ada",
          text: "Kode RPO ini sudah pernah digunakan. Yakin ingin replace data pada kode tersebut?",
          showCancelButton: true,
          confirmButtonText: "Ya, replace",
          cancelButtonText: "Batal",
        });
        if (!confirm.isConfirmed) return;
      } else if (checkRes.status !== 404) {
        throw new Error(`HTTP ${checkRes.status}`);
      }
    } catch (err) {
      console.error("Failed to check RPO code", err);
      Swal.fire({
        icon: "error",
        title: "Gagal cek kode RPO",
        text: "Tidak bisa memastikan kode RPO. Coba lagi.",
      });
      return;
    }
    setSavingDraft(true);
    try {
      const waPrimary = waRecipients[0];
      const totalNominalNumber = Number((totalNominal || 0).toFixed(2));
      const totalQtyNumber = Number((totalQty || 0).toFixed(2));
      const totalDiskonNumber = Number((aggregateTotals.diskon || 0).toFixed(2));
      const totalGrossNumber = Number((aggregateTotals.gross || 0).toFixed(2));
      const currentUsername = getCurrentUsername();
      const body = {
        kode_t_rpo: nomorAuto,
        tgl: tanggalAuto,
        deadline: deadline || null,
        request_pengiriman_dari: requestPengirimanDari || null,
        request_pengiriman_sampai: requestPengirimanSampai || null,
        kode_gudang_asal: "GUD.27012099GW001",
        kode_supplier: effectiveSupplierCode,
        catatan_header: null,
        is_ppn: 0,
        ppn_persen: 0,
        total_barang: totalQtyNumber,
        total_diskon: totalDiskonNumber,
        total_sebelum_ppn: totalNominalNumber,
        total_ppn: 0,
        total_akhir: totalNominalNumber,
        total_bruto: totalGrossNumber,
        wa_notif_number: waPrimary?.phone || null,
        wa_notif_contact_id: waPrimary?.id ? Number(waPrimary.id) : null,
        created_by: currentUsername,
        items: rpoList.map((it) => {
          const parsedIdVar = Number(it.idVarian ?? it.id);
          const idVarianNum = Number.isFinite(parsedIdVar) ? parsedIdVar : null;
          const itemTotals = calculateItemTotals(it, discountMode);
          const disc1Raw = clampPercent(Number(it.disc1 ?? 0) || 0);
          const disc2Raw = clampPercent(Number(it.disc2 ?? 0) || 0);
          const disc3Raw = clampPercent(Number(it.disc3 ?? 0) || 0);
          const discTotal = clampPercent(disc1Raw + disc2Raw + disc3Raw);
          const disc1Send = discountMode === "NOMINAL" ? discTotal : disc1Raw;
          const disc2Send = discountMode === "NOMINAL" ? 0 : disc2Raw;
          const disc3Send = discountMode === "NOMINAL" ? 0 : disc3Raw;
          return {
            kode_barang: it.kodeBarang || it.parentId,
            // backend kini pakai kode_barang_variant sebagai kunci varian unik
            kode_varian: null,
            kode_barang_variant: it.kodeBarangVariant || null,
            id_varian: idVarianNum,
            qty: it.qtyOrder ?? 0,
            satuan: it.satuan || "PCS",
            harga_beli: it.hargaBeli ?? 0,
            het: it.hargaHET ?? 0,
            catatan: it.catatan ? it.catatan.slice(0, MAX_CATATAN_LENGTH) : null,
            harga_beli_terakhir: it.lastHargaBeli ?? null,
            stok_pusat_snapshot: it.stok ?? null,
            buffer_snapshot: it.buffer ?? null,
            disc_1: disc1Send,
            disc_2: disc2Send,
            disc_3: disc3Send,
            subtotal: Number(itemTotals.net.toFixed(6)),
            status_harga: it.hargaStatus ?? null,
          };
        }),
      };

      const res = await fetch(`${API_BASE}/rpo/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await Swal.fire({
          icon: "success",
          title: "Draft tersimpan",
          text: "Draft RPO berhasil disimpan.",
          confirmButtonText: "OK",
        });
        clearSessionData();
        router.push("/admin/purchasing/permintaan-pengadaan");
      } catch (err) {
      console.error("Failed to save draft RPO", err);
      Swal.fire({
        icon: "error",
        title: "Gagal menyimpan draft",
        text: "Gagal menyimpan draft RPO. Silakan coba lagi.",
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const toggleMoveSelection = (id: string, checked: boolean) => {
    setMoveSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleMoveSelected = async () => {
    if (!editKode) {
      Swal.fire({
        icon: "warning",
        title: "Aksi hanya untuk edit",
        text: "Pindahkan RPO hanya bisa digunakan saat mengedit RPO yang sudah tersimpan.",
      });
      return;
    }
    if (moveSelectedIds.size === 0) {
      Swal.fire({
        icon: "warning",
        title: "Belum ada item dipilih",
        text: "Pilih item RPO yang akan dipindahkan terlebih dahulu.",
      });
      return;
    }
    const selectedItems = rpoList.filter((it) => moveSelectedIds.has(it.id));
    const selectedWithKode = selectedItems.filter((it) => it.kodeDRpo);
    if (selectedWithKode.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Item belum tersimpan",
        text: "Item yang dipilih belum tersimpan di database, jadi belum bisa dipindahkan.",
      });
      return;
    }
    if (selectedWithKode.length < selectedItems.length) {
      const confirmPartial = await Swal.fire({
        icon: "warning",
        title: "Sebagian item belum tersimpan",
        text: "Hanya item yang sudah tersimpan di database yang akan dipindahkan. Lanjutkan?",
        showCancelButton: true,
        confirmButtonText: "Lanjutkan",
        cancelButtonText: "Batal",
      });
      if (!confirmPartial.isConfirmed) return;
    }
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Pindahkan item terpilih?",
      text: `Ada ${moveSelectedIds.size} item yang akan dipindahkan dari daftar ini.`,
      showCancelButton: true,
      confirmButtonText: "Ya, pindahkan",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;
    try {
      const kodeList = selectedWithKode.map((it) => it.kodeDRpo);
      const res = await fetch(`${API_BASE}/rpo/${encodeURIComponent(editKode)}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode_d_rpo_list: kodeList, created_by: getCurrentUsername() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRpoList((prev) => prev.filter((it) => !moveSelectedIds.has(it.id)));
      setMoveSelectedIds(new Set());
      await Swal.fire({
        icon: "success",
        title: "Item dipindahkan",
        text: `Item berhasil dipindahkan ke RPO baru: ${data?.kode_t_rpo || "-"}`,
      });
    } catch (err) {
      console.error("Failed move RPO items", err);
      Swal.fire({
        icon: "error",
        title: "Gagal memindahkan",
        text: "Tidak dapat memindahkan item. Silakan coba lagi.",
      });
    }
  };

  return initialLoading ? (
    renderSkeleton()
  ) : (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>
            <div>
              <p className="text-xs text-gray-500">Purchasing</p>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Tambah Permintaan Pengadaan</h1>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Nomor otomatis: <span className="font-semibold">{nomorAuto}</span> • Tanggal:{" "}
            <span className="font-semibold">{tanggalAuto}</span>
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm relative block">
                <div className="flex items-center gap-2">
                  <span className="text-gray-700">Pilih Supplier</span>
                  {supplierLocked && (
                    <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                      Terkunci (sudah ada item)
                    </span>
                  )}
                </div>
                <div
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 bg-white flex items-center gap-2 ${
                    supplierLocked ? "cursor-not-allowed opacity-80 bg-gray-50" : "cursor-text"
                  } ${supplierOpen ? "ring-2 ring-emerald-200" : ""}`}
                  onClick={() => {
                    if (supplierLocked) return;
                    setSupplierOpen((v) => !v);
                  }}
                >
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    value={supplierQuery}
                    readOnly={supplierLocked}
                    onChange={(e) => {
                      if (supplierLocked) return;
                      setSupplierQuery(e.target.value);
                      setSupplierOpen(true);
                    }}
                    onFocus={() => {
                      if (supplierLocked) return;
                      setSupplierOpen(true);
                    }}
                    placeholder="Cari nama supplier"
                    className={`w-full outline-none ${supplierLocked ? "bg-gray-50 cursor-not-allowed" : ""}`}
                  />
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
                {supplierOpen && !supplierLocked && (
                  <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                    {loadingSup && <div className="px-3 py-2 text-sm text-gray-500">Memuat supplier...</div>}
                    {errorSup && <div className="px-3 py-2 text-sm text-rose-500">{errorSup}</div>}
                    {!loadingSup &&
                      supplierOptions
                        .filter((s) => s.label.toLowerCase().includes(supplierQuery.toLowerCase()))
                        .map((s) => (
                          <button
                            type="button"
                            key={s.value}
                            onClick={() => {
                              setSupplier(s.value);
                              setSupplierCode(s.kode || "");
                              setSupplierQuery(s.label);
                              setSupplierOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                              supplier === s.value ? "bg-emerald-50 text-emerald-700" : "text-gray-800"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                    {!loadingSup &&
                      supplierOptions.filter((s) => s.label.toLowerCase().includes(supplierQuery.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">Tidak ada supplier</div>
                      )}
                  </div>
                )}
              </label>

              <label className="space-y-1 text-sm block">
                <span className="text-gray-700">Cari Barang</span>
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nama, varian, atau barcode varian"
                    className="w-full outline-none"
                  />
                </div>
                <p className="text-xs text-gray-500">Pilih supplier terlebih dahulu untuk memuat barang.</p>
              </label>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold text-gray-800 text-sm">Pilih Barang (Supplier: {supplier || "-"})</span>
                </div>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 inline-flex items-center gap-1"
                >
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  Pilih Semua ({filteredVariantCount})
                </button>
              </div>
              <div className="overflow-x-auto max-h-[360px]">
                <table className="min-w-full text-sm">
                  <thead className="bg-white text-gray-600 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 w-10"></th>
                      <th className="px-3 py-2 text-left">Nama Barang / Varian</th>
                      <th className="px-3 py-2 text-left">Barcode Varian</th>
                      <th className="px-3 py-2 text-right">Stok Tersedia</th>
                      <th className="px-3 py-2 text-right">Buffer Stok</th>
                      <th className="px-3 py-2 text-right">Harga Beli</th>
                      <th className="px-3 py-2 text-right">Harga HET</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredGroups.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-center text-gray-500" colSpan={8}>
                          Tidak ada barang.
                        </td>
                      </tr>
                    )}
                    {filteredGroups.map((group) => (
                      <React.Fragment key={group.id}>
                        <tr className="bg-white">
                          <td className="px-3 py-2 text-left" colSpan={8}>
                            <div className="flex items-center gap-3">
                              <label className="inline-flex items-center gap-2 text-gray-700 text-sm font-semibold">
                                <input
                                  type="checkbox"
                                  checked={group.variants.every((v) => selectedIds.has(v.id)) && group.variants.length > 0}
                                  onChange={() => {
                                    const allSelected = group.variants.every((v) => selectedIds.has(v.id));
                                    setSelectedIds((prev) => {
                                      const next = new Set(prev);
                                      if (allSelected) {
                                        group.variants.forEach((v) => next.delete(v.id));
                                      } else {
                                        group.variants.forEach((v) => next.add(v.id));
                                      }
                                      return next;
                                    });
                                  }}
                                  className="w-4 h-4"
                                />
                                <span className="font-semibold text-gray-900">{group.nama}</span>
                                <span className="text-xs text-gray-500">({group.variants.length} varian)</span>
                              </label>
                            </div>
                          </td>
                        </tr>
                        {group.variants.map((item) => {
                          const kodeVarian = String(item.kodeBarangVariant || "").trim();
                          const hasPo = poHistoryLoading ? true : kodeVarian ? poHistorySet.has(kodeVarian) : true;
                          const rowClass = hasPo ? "bg-white" : "bg-yellow-50";
                          return (
                          <tr key={item.id} className={rowClass}>
                            <td className="px-3 py-2 text-center pl-6">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(item.id)}
                                onChange={() => toggleSelect(item.id)}
                                className="w-4 h-4"
                              />
                            </td>
                            <td className="px-3 py-2 pl-4">
                              <div className="text-gray-900 font-semibold">{item.variant}</div>
                              <div className="text-xs text-gray-500">{item.nama}</div>
                            </td>
                            <td className="px-3 py-2 text-gray-800">{item.barcodeVarian || "-"}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{item.stok ?? "-"}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{item.buffer ?? "-"}</td>
                            <td className="px-3 py-2 text-right text-gray-900">
                            {item.hargaBeli !== null && item.hargaBeli !== undefined ? formatIDR(item.hargaBeli) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900">
                            {item.hargaHET !== null && item.hargaHET !== undefined ? formatIDR(item.hargaHET) : "-"}
                          </td>
                          </tr>
                        )})}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={addToRPO}
                disabled={selectedIds.size === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Masukkan ke List RPO ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3 md:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Ringkasan Order</p>
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-gray-900">RPO #{nomorAuto || "-"}</h3>
                <button
                  type="button"
                  onClick={fetchDocCode}
                  disabled={Boolean(editKode) || generatingCode}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {generatingCode ? "Membuat..." : "Buat Kode Baru"}
                </button>
              </div>
            </div>
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              Draft
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-gray-500">Entri oleh</p>
              <p className="font-semibold text-gray-900">{getCurrentUsername()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-500">Order dari</p>
              <p className="font-semibold text-gray-900">Gudang Pusat</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-500">Order ke</p>
              <p className="font-semibold text-gray-900">{supplier || "Pilih supplier"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-500">Informasi pajak</p>
              <p className="font-semibold text-gray-900">Belum termasuk PPN</p>
            </div>
          </div>
          <hr className="border-gray-200" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Penerima WA Notifikasi</p>
                <p className="text-sm text-gray-700">Tambah kontak yang akan menerima notifikasi RPO.</p>
              </div>
              <button
                type="button"
                onClick={() => setWaModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold"
              >
                <Search className="w-4 h-4" />
                Browse Kontak
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {waRecipients.length === 0 && <span className="text-xs text-gray-500">Belum ada penerima.</span>}
              {waRecipients.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs"
                >
                  <span className="font-semibold">{r.label}</span>
                  {r.phone && <span className="text-[11px] text-emerald-700">{r.phone}</span>}
                  <button
                    type="button"
                    onClick={() => removeWaRecipient(r.id)}
                    className="hover:text-emerald-900"
                    aria-label={`Hapus ${r.label}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-gray-700 font-semibold">{supplierDetail.nama || supplier || "Pilih supplier"}</p>
              <div className="text-xs text-gray-600 whitespace-pre-line">
                {[supplierDetail.alamat, [supplierDetail.kota, supplierDetail.provinsi, supplierDetail.kode_pos].filter(Boolean).join(", "), supplierDetail.negara]
                  .filter((v) => v && v.trim())
                  .join("\n") || "-"}
              </div>
              <div className="text-xs text-gray-600">
                {[
                  supplierDetail.telp_1 ? `Telp: ${supplierDetail.telp_1}` : null,
                  supplierDetail.telp_2 ? supplierDetail.telp_2 : null,
                  supplierDetail.email ? `Email: ${supplierDetail.email}` : null,
                  supplierDetail.npwp ? `NPWP: ${supplierDetail.npwp}` : null,
                ]
                  .filter(Boolean)
                  .join(" | ") || "-"}
              </div>
            </div>
            {supplier && (
              <button
                type="button"
                onClick={() => setSupplierModalOpen(true)}
                className="text-xs text-emerald-700 border border-emerald-200 rounded px-2 py-1 hover:bg-emerald-50"
              >
                Edit
              </button>
            )}
          </div>
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Deadline</span>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="border border-gray-200 rounded px-2 py-1 text-xs"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Request Kirim Dari</span>
                <input
                  type="date"
                  value={requestPengirimanDari}
                  onChange={(e) => setRequestPengirimanDari(e.target.value)}
                  className="border border-gray-200 rounded px-2 py-1 text-xs"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Request Kirim Sampai</span>
                <input
                  type="date"
                  value={requestPengirimanSampai}
                  onChange={(e) => setRequestPengirimanSampai(e.target.value)}
                  className="border border-gray-200 rounded px-2 py-1 text-xs"
                />
              </label>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total nominal</p>
              <p className="text-xl font-bold text-gray-900">{formatIDR(totalNominal)}</p>
              <div className="mt-1 flex flex-wrap justify-end gap-2 text-xs text-gray-600">
                <span>Item: {rpoList.length}</span>
                <span className="font-semibold text-gray-900">Total Qty: {totalQty.toLocaleString("id-ID")}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={clearSessionData}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-rose-200 text-rose-800 bg-rose-50 hover:bg-rose-100"
            >
              Clear Data
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={savingDraft || !supplier || rpoList.length === 0 || !isPriceComplete}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingDraft ? "Menyimpan..." : "Simpan Draft"}
            </button>
            <button
              type="button"
              disabled={!supplier || rpoList.length === 0}
              onClick={handlePreviewOrder}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-sky-200 text-sky-800 bg-sky-50 hover:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Preview Order
            </button>
            <button
              type="button"
              disabled={!supplier || rpoList.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Buat Request Order
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-gray-800 text-sm">List RPO (final)</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              Total Qty: {totalQty.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <span>Tipe Diskon</span>
              <select
                value={discountMode}
                onChange={(e) => setDiscountMode(e.target.value as "PERCENT" | "NOMINAL")}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
              >
                <option value="PERCENT">Persen (%)</option>
                <option value="NOMINAL">Nominal (Rp/pcs)</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleMoveSelected}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50"
            >
              Pindahkan RPO
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-center w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setMoveSelectedIds(checked ? new Set(allItemIds) : new Set());
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600"
                    aria-label="Pilih semua item"
                    disabled={allItemIds.length === 0}
                  />
                </th>
                <th className="px-3 py-2 text-left w-12">No</th>
                <th className="px-3 py-2 text-left">
                  <div className="flex items-center gap-2">
                    <span>Nama Barang / Varian</span>
                    <button
                      type="button"
                      onClick={() => setItemSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 text-gray-600"
                    >
                      {itemSortDir === "asc" ? (
                        <>
                          <ArrowUp className="w-3 h-3" />
                          <span>ASC</span>
                        </>
                      ) : (
                        <>
                          <ArrowDown className="w-3 h-3" />
                          <span>DESC</span>
                        </>
                      )}
                    </button>
                  </div>
                </th>
                <th className="px-3 py-2 text-right border-l border-gray-200 w-60">HET</th>
                <th className="px-3 py-2 text-right border-l border-gray-200 w-60">Harga Beli</th>
                <th className="px-3 py-2 text-right border-l border-gray-200 w-32">{discLabel(1)}</th>
                <th className="px-3 py-2 text-right border-l border-gray-200 w-32">{discLabel(2)}</th>
                <th className="px-3 py-2 text-right border-l border-gray-200 w-32">{discLabel(3)}</th>
                <th className="px-3 py-2 text-left border-l border-gray-200">Status Harga</th>
                <th className="px-3 py-2 text-right border-l border-gray-200 min-w-[140px]">Harga Nett</th>
                <th className="px-3 py-2 text-right border-l border-gray-200 w-40">Qty (PCS)</th>
                <th className="px-3 py-2 text-right border-l border-gray-200 min-w-[140px]">Total Nominal</th>
                <th className="px-3 py-2 text-left border-l border-gray-200">Catatan</th>
                <th className="px-3 py-2 text-center border-l border-gray-200">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                let rowIndex = 1;
                return rpoGrouped.map((group) => (
                <React.Fragment key={group.id}>
                  <tr className="bg-gray-50">
                    <td className="px-3 py-2 text-center text-gray-400"></td>
                    <td className="px-3 py-2 text-center text-gray-400">#</td>
                    <td className="px-3 py-2 font-semibold text-gray-900">
                      {group.nama} <span className="text-xs text-gray-500 ml-1">({group.variants.length} varian)</span>
                    </td>
                    <td className="px-3 py-2 text-right border-l border-gray-200 w-60">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-gray-500">Rp</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="HET"
                            value={formatNumberInput(parseNumberInput(groupDrafts[group.id]?.hargaHET ?? ""))}
                            onFocus={selectAllOnFocus}
                            onChange={(e) => handleGroupDraftChange(group.id, "hargaHET", e.target.value)}
                            className="w-full text-right border border-gray-200 rounded px-2 py-1 bg-white"
                          />
                        <button
                          type="button"
                          onClick={() => applyGroupField(group.id, "hargaHET")}
                          className="p-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          aria-label="Terapkan HET"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right border-l border-gray-200 w-60">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-gray-500">Rp</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Harga Beli"
                            value={formatNumberInput(parseNumberInput(groupDrafts[group.id]?.hargaBeli ?? ""))}
                            onFocus={selectAllOnFocus}
                            onChange={(e) => handleGroupDraftChange(group.id, "hargaBeli", e.target.value)}
                            className="w-full text-right border border-gray-200 rounded px-2 py-1 bg-white"
                          />
                        <button
                          type="button"
                          onClick={() => applyGroupField(group.id, "hargaBeli")}
                          className="p-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          aria-label="Terapkan harga beli"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right border-l border-gray-200 w-32">
                      <div className="flex items-center gap-2 justify-end">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Disc 1"
                          value={groupDrafts[group.id]?.disc1 ?? ""}
                          onFocus={selectAllOnFocus}
                          onChange={(e) => handleGroupDraftChange(group.id, "disc1", e.target.value)}
                          className="w-full text-right border border-gray-200 rounded px-2 py-1 bg-white"
                        />
                        <span className="text-xs text-gray-500">{discSuffix}</span>
                        <button
                          type="button"
                          onClick={() => applyGroupField(group.id, "disc1")}
                          className="p-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          aria-label="Terapkan disc 1"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right border-l border-gray-200 w-32">
                      <div className="flex items-center gap-2 justify-end">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Disc 2"
                          value={groupDrafts[group.id]?.disc2 ?? ""}
                          onFocus={selectAllOnFocus}
                          onChange={(e) => handleGroupDraftChange(group.id, "disc2", e.target.value)}
                          className="w-full text-right border border-gray-200 rounded px-2 py-1 bg-white"
                        />
                        <span className="text-xs text-gray-500">{discSuffix}</span>
                        <button
                          type="button"
                          onClick={() => applyGroupField(group.id, "disc2")}
                          className="p-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          aria-label="Terapkan disc 2"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right border-l border-gray-200 w-32">
                      <div className="flex items-center gap-2 justify-end">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Disc 3"
                          value={groupDrafts[group.id]?.disc3 ?? ""}
                          onFocus={selectAllOnFocus}
                          onChange={(e) => handleGroupDraftChange(group.id, "disc3", e.target.value)}
                          className="w-full text-right border border-gray-200 rounded px-2 py-1 bg-white"
                        />
                        <span className="text-xs text-gray-500">{discSuffix}</span>
                        <button
                          type="button"
                          onClick={() => applyGroupField(group.id, "disc3")}
                          className="p-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          aria-label="Terapkan disc 3"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-left border-l border-gray-200">
                      <p className="text-xs text-gray-500">Status otomatis dari selisih harga beli vs riwayat terakhir.</p>
                    </td>
                    <td className="px-3 py-2 text-right border-l border-gray-200 min-w-[140px] text-gray-400">-</td>
                    <td className="px-3 py-2 text-right border-l border-gray-200 w-24">
                      <div className="flex items-center gap-2 justify-end">
                        <input
                          type="text"
                          inputMode="decimal"
                          min={0}
                          placeholder="Qty"
                          value={formatNumberInput(parseNumberInput(groupDrafts[group.id]?.qty ?? ""))}
                          onFocus={selectAllOnFocus}
                          onChange={(e) => handleGroupDraftChange(group.id, "qty", e.target.value)}
                          className="w-full text-right border border-gray-200 rounded px-2 py-1 bg-white"
                        />
                        <span className="text-xs text-gray-500">pcs</span>
                        <button
                          type="button"
                          onClick={() => applyGroupField(group.id, "qty")}
                          className="p-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          aria-label="Terapkan qty"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right border-l border-gray-200 text-gray-400">-</td>
                    <td className="px-3 py-2 text-left border-l border-gray-200">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Catatan"
                          value={groupDrafts[group.id]?.catatan ?? ""}
                          maxLength={MAX_CATATAN_LENGTH}
                          onChange={(e) => handleGroupDraftChange(group.id, "catatan", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => applyGroupField(group.id, "catatan")}
                          className="p-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          aria-label="Terapkan catatan"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-l border-gray-200 text-gray-400">-</td>
                  </tr>
                  {group.variants.map((item) => {
                    const itemTotals = calculateItemTotals(item, discountMode);
                    const currentIndex = rowIndex++;
                    return (
                      <tr key={item.id} className={`hover:bg-gray-50 ${item.stok === 0 ? "bg-rose-100/80" : ""}`}>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={moveSelectedIds.has(item.id)}
                            onChange={(e) => toggleMoveSelection(item.id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-emerald-600"
                          />
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700">{currentIndex}</td>
                        <td className="px-3 py-2 pl-4">
                          <div className="text-gray-900 font-semibold">{item.variant}</div>
                          <div className="text-xs text-gray-500">{item.nama}</div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 border-l border-gray-200 w-60">
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-xs text-gray-500">Rp</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={formatNumberInput(item.hargaHET)}
                              onFocus={selectAllOnFocus}
                              onChange={(e) => updateRpoItem(item.id, "hargaHET", e.target.value)}
                              className="w-full text-right border border-gray-200 rounded px-2 py-1 bg-white"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 border-l border-gray-200 w-60">
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-xs text-gray-500">Rp</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={formatNumberInput(item.hargaBeli)}
                              onFocus={selectAllOnFocus}
                              onChange={(e) => updateRpoItem(item.id, "hargaBeli", e.target.value)}
                              className="w-full text-right border border-gray-200 rounded px-2 py-1 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => setHistoryModal({ open: true, item })}
                              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500"
                              aria-label="Riwayat harga beli"
                            >
                              <Info className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 border-l border-gray-200 w-32">
                          <div className="flex items-center gap-2 justify-end">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={discDrafts[item.id]?.disc1 ?? formatDiscValue(item.disc1, item.hargaBeli)}
                              onFocus={selectAllOnFocus}
                              onChange={(e) => setDiscDraftValue(item.id, "disc1", e.target.value)}
                              onBlur={() => commitDiscDraft(item.id, "disc1")}
                              className="w-full text-right border border-gray-200 rounded px-2 py-1 bg-white"
                            />
                            <span className="text-xs text-gray-500">{discSuffix}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 border-l border-gray-200 w-32">
                          <div className="flex items-center gap-2 justify-end">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={discDrafts[item.id]?.disc2 ?? formatDiscValue(item.disc2, item.hargaBeli)}
                              onFocus={selectAllOnFocus}
                              onChange={(e) => setDiscDraftValue(item.id, "disc2", e.target.value)}
                              onBlur={() => commitDiscDraft(item.id, "disc2")}
                              className="w-full text-right border border-gray-200 rounded px-2 py-1 bg-white"
                            />
                            <span className="text-xs text-gray-500">{discSuffix}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 border-l border-gray-200 w-32">
                          <div className="flex items-center gap-2 justify-end">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={discDrafts[item.id]?.disc3 ?? formatDiscValue(item.disc3, item.hargaBeli)}
                              onFocus={selectAllOnFocus}
                              onChange={(e) => setDiscDraftValue(item.id, "disc3", e.target.value)}
                              onBlur={() => commitDiscDraft(item.id, "disc3")}
                              className="w-full text-right border border-gray-200 rounded px-2 py-1 bg-white"
                            />
                            <span className="text-xs text-gray-500">{discSuffix}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-left border-l border-gray-200">
                          <div className="flex items-center gap-2">
                            {renderHargaStatus(item.hargaStatus)}
                            <span className="text-xs text-gray-500">
                              {item.lastHargaBeli ? `Dari ${formatIDR(item.lastHargaBeli)}` : "Belum ada riwayat harga"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 border-l border-gray-200 min-w-[140px]">
                          {formatIDR(item.qtyOrder ? itemTotals.net / item.qtyOrder : 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 border-l border-gray-200 w-24">
                          <div className="flex items-center gap-2 justify-end">
                            <input
                              type="text"
                              inputMode="decimal"
                              min={0}
                              value={formatNumberInput(item.qtyOrder)}
                              onFocus={selectAllOnFocus}
                              onChange={(e) => updateRpoItem(item.id, "qtyOrder", e.target.value)}
                              className="w-full text-right border border-gray-200 rounded px-2 py-1 bg-white"
                            />
                            <span className="text-xs text-gray-500">pcs</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 font-semibold border-l border-gray-200 min-w-[140px]">
                          {formatIDR(itemTotals.net)}
                        </td>
                        <td className="px-3 py-2 border-l border-gray-200">
                          <input
                            type="text"
                            value={item.catatan ?? ""}
                            maxLength={MAX_CATATAN_LENGTH}
                            onChange={(e) => updateRpoItem(item.id, "catatan", e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 bg-white"
                            placeholder="Catatan"
                          />
                        </td>
                        <td className="px-3 py-2 text-center border-l border-gray-200">
                          <button
                            type="button"
                            onClick={() => removeFromRPO(item.id)}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ));
              })()}
              {rpoList.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={13}>
                    Belum ada barang di list RPO.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {historyModal.open && historyModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setHistoryModal({ open: false })} />
          <div className="relative w-full max-w-xl max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Riwayat Harga Beli</p>
                <h3 className="text-lg font-bold text-gray-900">{historyModal.item.variant}</h3>
                <p className="text-xs text-gray-500">{historyModal.item.nama}</p>
              </div>
              <button
                onClick={() => setHistoryModal({ open: false })}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Tutup"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <p className="text-sm text-gray-600">Riwayat harga beli nett dari PO yang aktif.</p>
            {historyError && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{historyError}</div>
            )}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Tanggal PO</th>
                    <th className="px-3 py-2 text-left">Nomor PO</th>
                    <th className="px-3 py-2 text-right">Harga Beli Nett</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historyLoading && (
                    <tr>
                      <td className="px-3 py-3 text-center text-gray-500" colSpan={4}>
                        Memuat riwayat...
                      </td>
                    </tr>
                  )}
                  {!historyLoading && historyRows.length === 0 && (
                    <tr>
                      <td className="px-3 py-3 text-center text-gray-500" colSpan={4}>
                        Belum ada riwayat.
                      </td>
                    </tr>
                  )}
                  {!historyLoading &&
                    historyRows.map((row, idx) => (
                      <tr key={`${row.kode_t_pengadaan || "PO"}-${idx}`}>
                        <td className="px-3 py-2 text-gray-700">{formatShortDate(row.tgl)}</td>
                        <td className="px-3 py-2 text-gray-700">{row.kode_t_pengadaan || "-"}</td>
                        <td className="px-3 py-2 text-right text-gray-900">
                          {formatIDR(Number(row.harga_beli_nett ?? 0))}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {Number(row.qty ?? 0).toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {waModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setWaModalOpen(false)} />
          <div className="relative w-full max-w-xl max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Penerima WA Notifikasi</p>
                <h3 className="text-lg font-bold text-gray-900">Pilih kontak supplier</h3>
              </div>
              <button
                onClick={() => setWaModalOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Tutup"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Centang kontak yang akan dikirim notifikasi. Data diambil dari kontak aktif supplier terpilih.
            </p>
            {waError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{waError}</div>}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 w-12"></th>
                    <th className="px-3 py-2 text-left">Nama</th>
                    <th className="px-3 py-2 text-left">Kontak</th>
                    <th className="px-3 py-2 text-left">Label</th>
                    <th className="px-3 py-2 text-left">Jabatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {waLoading && (
                    <tr>
                      <td className="px-3 py-3 text-center text-gray-500" colSpan={5}>
                        Memuat kontak...
                      </td>
                    </tr>
                  )}
                  {!waLoading && waContactOptions.length === 0 && (
                    <tr>
                      <td className="px-3 py-3 text-center text-gray-500" colSpan={5}>
                        Tidak ada kontak.
                      </td>
                    </tr>
                  )}
                  {waContactOptions.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={waTempSelected.has(c.id)}
                          onChange={() => toggleWaTempSelect(c.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-3 py-2 text-gray-900 font-semibold">{c.label}</td>
                      <td className="px-3 py-2 text-gray-700">{c.phone || "-"}</td>
                      <td className="px-3 py-2 text-gray-700">{c.detail || "-"}</td>
                      <td className="px-3 py-2 text-gray-700">{c.jabatan || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setWaFormOpen((v) => !v)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                {waFormOpen ? "Tutup form kontak baru" : "Tambah kontak baru"}
              </button>
              {waFormOpen && (
                <div className="space-y-3 p-3 border border-dashed border-gray-200 rounded-xl">
                  <p className="text-sm font-semibold text-gray-800">Tambah kontak baru</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Nama</label>
                      <input
                        value={waForm.nama}
                        onChange={(e) => setWaForm((prev) => ({ ...prev, nama: e.target.value }))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Jabatan</label>
                      <input
                        value={waForm.jabatan}
                        onChange={(e) => setWaForm((prev) => ({ ...prev, jabatan: e.target.value }))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Tipe</label>
                      <select
                        value={waForm.tipe}
                        onChange={(e) => setWaForm((prev) => ({ ...prev, tipe: e.target.value }))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                      >
                        <option value="WA">WA</option>
                        <option value="PHONE">PHONE</option>
                        <option value="EMAIL">EMAIL</option>
                      </select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs text-gray-500">Nilai (No/Email)</label>
                      <input
                        value={waForm.nilai}
                        onChange={(e) => setWaForm((prev) => ({ ...prev, nilai: e.target.value }))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Label</label>
                    <input
                      value={waForm.label}
                      onChange={(e) => setWaForm((prev) => ({ ...prev, label: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={addNewContact}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60"
                      disabled={waLoading}
                    >
                      Tambah Kontak
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWaModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={applyWaSelections}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600"
              >
                Tambahkan
              </button>
            </div>
          </div>
        </div>
      )}

      {supplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSupplierModalOpen(false)} />
          <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Edit Supplier</p>
                <h3 className="text-lg font-bold text-gray-900">{supplierDetail.nama || "Supplier"}</h3>
              </div>
              <button
                onClick={() => setSupplierModalOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Tutup"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Nama</span>
                <input
                  value={supplierForm.nama || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, nama: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Email</span>
                <input
                  value={supplierForm.email || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Telepon 1</span>
                <input
                  value={supplierForm.telp_1 || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, telp_1: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Telepon 2</span>
                <input
                  value={supplierForm.telp_2 || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, telp_2: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1 md:col-span-2">
                <span className="text-gray-600 text-xs">Alamat</span>
                <textarea
                  value={supplierForm.alamat || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, alamat: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                  rows={2}
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Kota</span>
                <input
                  value={supplierForm.kota || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, kota: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Provinsi</span>
                <input
                  value={supplierForm.provinsi || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, provinsi: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Kode Pos</span>
                <input
                  value={supplierForm.kode_pos || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, kode_pos: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Negara</span>
                <input
                  value={supplierForm.negara || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, negara: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">NPWP</span>
                <input
                  value={supplierForm.npwp || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, npwp: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Nama NPWP</span>
                <input
                  value={supplierForm.nama_npwp || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, nama_npwp: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Nama Bank</span>
                <input
                  value={supplierForm.nama_bank || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, nama_bank: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">No. Rekening</span>
                <input
                  value={supplierForm.no_rekening || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, no_rekening: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Atas Nama</span>
                <input
                  value={supplierForm.atas_nama || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, atas_nama: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
              <label className="space-y-1">
                <span className="text-gray-600 text-xs">Cabang Bank</span>
                <input
                  value={supplierForm.cabang || ""}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, cabang: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingSupplier}
                onClick={updateSupplierData}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
