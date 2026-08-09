"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SiteInfo = {
  nama?: string;
  alamat?: string;
  kota?: string;
  kode_pos?: string;
  provinsi?: string;
  negara?: string;
  no_telp?: string;
  email?: string;
  nama_header_print?: string;
  alamat_header_print?: string;
};

type SupplierInfo = {
  nama?: string;
  kode_supplier?: string;
  alamat?: string;
  kota?: string;
  provinsi?: string;
  kode_pos?: string;
  negara?: string;
  telp_1?: string;
  telp_2?: string;
  email?: string;
};

type RpoHeader = {
  kode_t_pengadaan?: string;
  kode_t_rpo?: string;
  tgl?: string;
  deadline?: string;
  kode_supplier?: string;
  supplier_nama?: string;
  no_faktur_supplier?: string;
};

type RpoItem = {
  kode_d_rpo: string;
  kode_barang_variant?: string | null;
  barang_nama?: string | null;
  barang_nama_master?: string | null;
  nama_varian?: string | null;
  qty?: number | null;
  harga_beli?: number | null;
  harga_nett?: number | null;
  catatan?: string | null;
  disc_1?: number | null;
  disc_2?: number | null;
  disc_3?: number | null;
};

type LpbItem = {
  kode_d_lpb: string;
  kode_barang_variant?: string | null;
  barcode_varian?: string | null;
  nama_barang?: string | null;
  nama_varian?: string | null;
  barang_nama?: string | null;
  qty?: number | null;
  qty_rpo?: number | null;
  status?: number | null;
};

type LpbHeader = {
  kode_lpb?: string;
  kode_t_rpo?: string;
  kode_supplier?: string;
  supplier_nama?: string;
  tgl_lpb?: string;
  status?: string | null;
};

type DraftItem = {
  id: string;
  kodeDetailPengadaan?: string | null;
  kode_barang_variant: string;
  barcode: string;
  namaBarang: string;
  namaVarian: string;
  qty: number;
  hargaBeli: number;
  disc1: number;
  disc2: number;
  disc3: number;
  qtyRpo: number;
  missingInRpo: boolean;
  qtyMismatch: boolean;
  isActive: boolean;
  catatan: string;
  isManualAdd: boolean;
  isInlineAdd: boolean;
  kodeParent: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const formatIDR = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("id-ID");
};

const formatAddress = (obj: { alamat?: string; kota?: string; provinsi?: string; kode_pos?: string; negara?: string }) =>
  [obj.alamat, [obj.kota, obj.provinsi, obj.kode_pos].filter(Boolean).join(", "), obj.negara]
    .filter((s) => s && s.trim())
    .join("\n");

const makeDraftItemId = (base: string) => {
  const cleanBase = String(base || "ITEM").trim().replace(/\s+/g, "-") || "ITEM";
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${cleanBase}-${randomPart}`;
};

const ensureUniqueDraftItemIds = (items: DraftItem[]) => {
  const seen = new Set<string>();
  let touched = false;
  const next = items.map((item) => {
    const id = String(item.id || "").trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      return item;
    }
    touched = true;
    const base = item.kode_barang_variant || item.barcode || item.namaBarang || "ITEM";
    const uniqueId = makeDraftItemId(base);
    seen.add(uniqueId);
    return { ...item, id: uniqueId };
  });
  return touched ? next : items;
};

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  allowCustom = true,
}: {
  label: string;
  value: string;
  onChange: (v: string, selected?: any) => void;
  options: { label: string; value: string; data?: any }[];
  placeholder?: string;
  allowCustom?: boolean;
}) {
  const listId = `${label.replace(/\s+/g, "-").toLowerCase()}-options`;
  const display = useMemo(() => {
    if (value === "") return "";
    return options.find((o) => o.value === value)?.label || value;
  }, [options, value]);
  const [inputValue, setInputValue] = useState(display);

  useEffect(() => {
    setInputValue(display);
  }, [display]);

  const findMatch = (inputVal: string) =>
    options.find((opt) => opt.label === inputVal || opt.value === inputVal);

  const handleChangeValue = (inputVal: string) => {
    setInputValue(inputVal);
    const match = findMatch(inputVal);
    if (match) {
      onChange(match.value, match.data);
      return;
    }
    if (inputVal === "") {
      onChange("", undefined);
      return;
    }
    if (allowCustom) {
      onChange(inputVal, undefined);
    }
  };

  const handleBlur = () => {
    if (allowCustom) return;
    const match = findMatch(inputValue);
    if (!match) {
      setInputValue(display);
    }
  };

  return (
    <label className="flex flex-col gap-1 text-xs text-gray-600">
      {label}
      <input
        list={listId}
        value={inputValue}
        onChange={(e) => handleChangeValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full rounded border border-gray-200 px-2 py-1"
      />
      <datalist id={listId}>
        {options.map((opt, index) => (
          <option key={`${opt.value}-${index}`} value={opt.label}>
            {opt.label}
          </option>
        ))}
      </datalist>
    </label>
  );
}

export default function NewPOPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kodeParam = searchParams.get("kode");
  const editKodeParam = searchParams.get("edit_kode");
  const isEditMode = Boolean(editKodeParam);
  const [site, setSite] = useState<SiteInfo>({});
  const [supplierInfo, setSupplierInfo] = useState<SupplierInfo>({});
  const [header, setHeader] = useState<RpoHeader | null>(null);
  const [rpoItems, setRpoItems] = useState<RpoItem[]>([]);
  const [lpbItems, setLpbItems] = useState<LpbItem[]>([]);
  const [lpbHeader, setLpbHeader] = useState<LpbHeader | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [barangList, setBarangList] = useState<any[]>([]);
  const [barangOptions, setBarangOptions] = useState<{ label: string; value: string; data: any }[]>([]);
  const [varianOptions, setVarianOptions] = useState<{ label: string; value: string; data: any }[]>([]);
  const [selectedBarangId, setSelectedBarangId] = useState<string>("");
  const [barangLoading, setBarangLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [noFakturSupplier, setNoFakturSupplier] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [newItem, setNewItem] = useState({
    kode_barang_variant: "",
    barcode: "",
    namaBarang: "",
    namaVarian: "",
    qty: 0,
    hargaBeli: 0,
    catatan: "",
  });
  const hasLocalDraftRef = useRef(false);
  const didHydrateDraftRef = useRef(false);
  const draftRef = useRef<DraftItem[]>([]);
  const noFakturRef = useRef("");
  const storageKey = useMemo(() => {
    const key = isEditMode ? editKodeParam : kodeParam;
    if (!key) return "";
    return `${isEditMode ? "po-edit-draft" : "po-new-draft"}:${encodeURIComponent(key)}`;
  }, [editKodeParam, isEditMode, kodeParam]);

  useEffect(() => {
    const fetchSite = async () => {
      try {
        const res = await fetch(`${API_BASE}/site`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const s: SiteInfo = await res.json();
        setSite(s || {});
      } catch (err) {
        console.error("Failed load site info", err);
      }
    };
    fetchSite();
  }, []);

  useEffect(() => {
    draftRef.current = draftItems;
    noFakturRef.current = noFakturSupplier;
  }, [draftItems, noFakturSupplier]);

  useEffect(() => {
    if (!kodeParam || !storageKey) return;
    hasLocalDraftRef.current = false;
    didHydrateDraftRef.current = false;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.draftItems) && parsed.draftItems.length > 0) {
        setDraftItems(ensureUniqueDraftItemIds(parsed.draftItems));
        hasLocalDraftRef.current = true;
      }
      if (typeof parsed?.noFakturSupplier === "string") {
        setNoFakturSupplier(parsed.noFakturSupplier);
      }
      if (parsed?.savedAt) {
        const savedDate = new Date(parsed.savedAt);
        if (!Number.isNaN(savedDate.getTime())) {
          setDraftSavedAt(savedDate);
        }
      }
    } catch (err) {
      console.error("Failed load draft from storage", err);
    }
  }, [kodeParam, storageKey]);

  useEffect(() => {
    if (!isEditMode) return;
    const fetchPengadaan = async () => {
      if (!editKodeParam) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/pengadaan/${encodeURIComponent(editKodeParam)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const pengadaanHeader = payload?.header || null;
        const pengadaanItems = Array.isArray(payload?.items) ? payload.items : [];
        setHeader(pengadaanHeader);
        if (!hasLocalDraftRef.current) {
          setNoFakturSupplier(String(pengadaanHeader?.no_faktur_supplier || ""));
          setDraftItems(
            ensureUniqueDraftItemIds(
              pengadaanItems
                .filter((it: any) => Number(it?.is_active ?? 1) !== 0)
                .map((it: any, index: number) => ({
                  id: it?.kode_d_pengadaan || `${it?.kode_barang_variant || "ITEM"}-${index}`,
                  kodeDetailPengadaan: it?.kode_d_pengadaan || null,
                  kode_barang_variant: String(it?.kode_barang_variant || "").trim(),
                  barcode: it?.barcode_varian || "-",
                  namaBarang: it?.nama_barang || "-",
                  namaVarian: it?.nama_varian || "-",
                  qty: Number(it?.qty ?? 0),
                  hargaBeli: Number(it?.harga_beli ?? 0),
                  disc1: Number(it?.disc_1 ?? 0),
                  disc2: Number(it?.disc_2 ?? 0),
                  disc3: Number(it?.disc_3 ?? 0),
                  qtyRpo: Number(it?.qty ?? 0),
                  missingInRpo: false,
                  qtyMismatch: false,
                  isActive: true,
                  catatan: it?.catatan || "",
                  isManualAdd: false,
                  isInlineAdd: false,
                  kodeParent: it?.kode_parent || null,
                }))
            )
          );
        }
        if (pengadaanHeader?.kode_t_rpo) {
          const rpoRes = await fetch(`${API_BASE}/rpo/${encodeURIComponent(pengadaanHeader.kode_t_rpo)}`);
          if (rpoRes.ok) {
            const rpoPayload = await rpoRes.json();
            setRpoItems(Array.isArray(rpoPayload?.items) ? rpoPayload.items : []);
          } else {
            setRpoItems([]);
          }
        } else {
          setRpoItems([]);
        }
        setLpbItems([]);
        setLpbHeader(null);
      } catch (err) {
        console.error("Failed load pengadaan for edit", err);
        setError("Gagal memuat data pengadaan.");
      } finally {
        setLoading(false);
      }
    };
    fetchPengadaan();
  }, [editKodeParam, isEditMode]);

  useEffect(() => {
    if (isEditMode) return;
    const fetchRpo = async () => {
      if (!kodeParam) return;
      setLoading(true);
      setError(null);
      try {
        const [rpoRes, lpbRes] = await Promise.all([
          fetch(`${API_BASE}/rpo/${encodeURIComponent(kodeParam)}`),
          fetch(`${API_BASE}/lpb/${encodeURIComponent(kodeParam)}`),
        ]);
        if (!rpoRes.ok) throw new Error(`HTTP ${rpoRes.status}`);
        const rpoPayload = await rpoRes.json();
        const rpoHeader = rpoPayload?.header || null;
        const rpoList = Array.isArray(rpoPayload?.items) ? rpoPayload.items : [];
        setHeader(rpoHeader);
        setRpoItems(rpoList);

        if (lpbRes.ok) {
          const lpbPayload = await lpbRes.json();
          const lpbHead = lpbPayload?.header || null;
          setLpbHeader(lpbHead);
          const lpbList = Array.isArray(lpbPayload?.items) ? lpbPayload.items : [];
          const activeLpb = lpbList.filter((it: LpbItem) => Number(it.status ?? 1) !== 0);
          if (String(lpbHead?.status || "").toUpperCase() === "SAVED") {
            setLpbItems(activeLpb);
          } else {
            setLpbItems([]);
            setError("LPB belum tersimpan. Simpan LPB terlebih dahulu sebelum buat PO.");
          }
        } else {
          setLpbItems([]);
          setLpbHeader(null);
          setError("LPB belum tersimpan. Simpan LPB terlebih dahulu sebelum buat PO.");
        }
      } catch (err) {
        console.error("Failed load RPO/LPB for PO", err);
        setError("Gagal memuat data RPO/LPB.");
      } finally {
        setLoading(false);
      }
    };
    fetchRpo();
  }, [isEditMode, kodeParam]);

  useEffect(() => {
    const fetchSupplier = async () => {
      const kodeSupplier = header?.kode_supplier || lpbHeader?.kode_supplier;
      if (!kodeSupplier) return;
      try {
        const res = await fetch(`${API_BASE}/suppliers/by-code/${encodeURIComponent(kodeSupplier)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const sup: SupplierInfo = await res.json();
        setSupplierInfo(sup || {});
      } catch (err) {
        console.error("Failed load supplier info", err);
      }
    };
    fetchSupplier();
  }, [header?.kode_supplier, lpbHeader?.kode_supplier]);

  useEffect(() => {
    const fetchBarang = async () => {
      if (barangList.length > 0) return;
      setBarangLoading(true);
      try {
        const res = await fetch(`${API_BASE}/barang`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const list = await res.json();
        setBarangList(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("Failed load barang options", err);
      } finally {
        setBarangLoading(false);
      }
    };
    fetchBarang();
  }, [barangList.length]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (draftItems.length === 0 && !noFakturSupplier) return;
      const savedAt = new Date().toISOString();
      const payload = JSON.stringify({
        draftItems,
        noFakturSupplier,
        savedAt,
      });
      localStorage.setItem(storageKey, payload);
      setDraftSavedAt(new Date(savedAt));
    } catch (err) {
      console.error("Failed save draft to storage", err);
    }
  }, [draftItems, noFakturSupplier, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    const handleBeforeUnload = () => {
      try {
        if (draftRef.current.length === 0 && !noFakturRef.current) return;
        const savedAt = new Date().toISOString();
        const payload = JSON.stringify({
          draftItems: draftRef.current,
          noFakturSupplier: noFakturRef.current,
          savedAt,
        });
        localStorage.setItem(storageKey, payload);
      } catch (err) {
        console.error("Failed save draft before unload", err);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [storageKey]);

  useEffect(() => {
    const supplier = String(header?.kode_supplier || "").trim();
    const filtered = (barangList || []).filter((row) => {
      if (!supplier) return true;
      return String(row?.kode_supplier || "").trim() === supplier;
    });
    const options = filtered.map((row) => ({
      label: row?.nama || "-",
      value: String(row?.id_barang ?? row?.nama ?? ""),
      data: row,
    }));
    setBarangOptions(options);
  }, [barangList, header?.kode_supplier]);

  const barcodeOptions = useMemo(() => {
    const supplier = String(header?.kode_supplier || "").trim();
    const filtered = (barangList || []).filter((row) => {
      if (!supplier) return true;
      return String(row?.kode_supplier || "").trim() === supplier;
    });
    return filtered.flatMap((barang) => {
      const variants = Array.isArray(barang?.variants) ? barang.variants : [];
      return variants
        .filter((variant: any) => variant?.kode_barang_variant && (variant?.barcode || variant?.barcode_varian))
        .map((variant: any) => {
          const barcode = String(variant?.barcode || variant?.barcode_varian || "").trim();
          const namaVarian = variant?.nama || variant?.nama_varian || "-";
          return {
            label: `${barcode} - ${barang?.nama || "-"} / ${namaVarian}`,
            value: barcode,
            data: { barang, variant },
          };
        });
    });
  }, [barangList, header?.kode_supplier]);

  const buildVarianOptions = (barang: any) => {
    const variants = Array.isArray(barang?.variants) ? barang.variants : [];
    return variants
      .filter((variant: any) => variant?.kode_barang_variant)
      .map((variant: any) => ({
        label: `${variant?.nama || variant?.nama_varian || "-"} (${variant?.barcode || variant?.barcode_varian || "-"})`,
        value: String(variant?.kode_barang_variant),
        data: {
          kode_barang_variant: String(variant?.kode_barang_variant),
          nama_varian: variant?.nama || variant?.nama_varian || "-",
          barcode: variant?.barcode || variant?.barcode_varian || "-",
          harga_beli: Number(variant?.harga_beli_sat_1 ?? 0),
        },
      }));
  };

  const selectBarangVariant = (barang: any, variant: any) => {
    setSelectedBarangId(String(barang?.id_barang ?? ""));
    setVarianOptions(buildVarianOptions(barang));
    setNewItem((prev) => ({
      ...prev,
      namaBarang: barang?.nama || prev.namaBarang,
      namaVarian: variant?.nama || variant?.nama_varian || prev.namaVarian,
      kode_barang_variant: String(variant?.kode_barang_variant || ""),
      barcode: variant?.barcode || variant?.barcode_varian || prev.barcode,
      hargaBeli: Number(variant?.harga_beli_sat_1 ?? prev.hargaBeli ?? 0),
    }));
  };

  const merged = useMemo(() => {
    const rpoMap = new Map<string, RpoItem>();
    rpoItems.forEach((it) => {
      const key = String(it.kode_barang_variant || "").trim();
      if (key) rpoMap.set(key, it);
    });

    return lpbItems.map((lpb, index) => {
      const kodeVarian = String(lpb.kode_barang_variant || "-").trim();
      const rpo = rpoMap.get(kodeVarian);
      const qtyRpo = Number(rpo?.qty ?? lpb.qty_rpo ?? 0);
      const qtyLpb = Number(lpb.qty ?? 0);
      const hargaBeli = Number(rpo?.harga_nett ?? rpo?.harga_beli ?? 0);
      const disc1 = Number(rpo?.disc_1 ?? 0);
      const disc2 = Number(rpo?.disc_2 ?? 0);
      const disc3 = Number(rpo?.disc_3 ?? 0);
      const missingInRpo = !rpo;
      const qtyMismatch = !missingInRpo && qtyRpo !== qtyLpb;
      return {
        id: lpb.kode_d_lpb || `${kodeVarian}-${index}`,
        kode_barang_variant: kodeVarian,
        barcode: lpb.barcode_varian || "-",
        namaBarang: rpo?.barang_nama_master || lpb.barang_nama || "-",
        namaVarian: rpo?.nama_varian || lpb.nama_varian || lpb.nama_barang || "-",
        qty: qtyLpb,
        hargaBeli,
        disc1,
        disc2,
        disc3,
        qtyRpo,
        missingInRpo,
        qtyMismatch,
        isActive: true,
        catatan: rpo?.catatan || "",
        isManualAdd: false,
        isInlineAdd: false,
        kodeParent: null,
      } as DraftItem;
    });
  }, [lpbItems, rpoItems]);

  useEffect(() => {
    if (isEditMode) return;
    if (hasLocalDraftRef.current) return;
    setDraftItems(ensureUniqueDraftItemIds(merged));
  }, [isEditMode, merged]);

  useEffect(() => {
    setDraftItems((prev) => {
      const next = ensureUniqueDraftItemIds(prev);
      return next === prev ? prev : next;
    });
  }, [draftItems]);

  useEffect(() => {
    if (!hasLocalDraftRef.current || didHydrateDraftRef.current) return;
    if (!Array.isArray(rpoItems) || rpoItems.length === 0) return;
    const rpoMap = new Map(
      rpoItems.map((it) => [
        String(it.kode_barang_variant || "").trim(),
        {
          harga_beli: Number(it.harga_beli ?? it.harga_nett ?? 0),
          catatan: it.catatan || "",
        },
      ])
    );
    let touched = false;
    setDraftItems((prev) =>
      prev.map((it) => {
        const key = String(it.kode_barang_variant || "").trim();
        if (!key) return it;
        const rpo = rpoMap.get(key);
        if (!rpo) return it;
        const nextHargaBeli =
          Number(it.hargaBeli ?? 0) > 0 ? it.hargaBeli : Number(rpo.harga_beli ?? 0);
        const nextCatatan = it.catatan || rpo.catatan || "";
        if (nextHargaBeli === it.hargaBeli && nextCatatan === it.catatan) return it;
        touched = true;
        return {
          ...it,
          hargaBeli: nextHargaBeli,
          catatan: nextCatatan,
        };
      })
    );
    didHydrateDraftRef.current = true;
    if (touched) {
      hasLocalDraftRef.current = true;
    }
  }, [rpoItems]);

  const totals = useMemo(() => {
    return draftItems.reduce(
      (acc, it) => {
        if (!it.isActive) return acc;
        const qty = Number(it.qty ?? 0);
        const harga = Number(it.hargaBeli ?? 0);
        acc.qty += qty;
        acc.subtotal += qty * harga;
        return acc;
      },
      { qty: 0, subtotal: 0 }
    );
  }, [draftItems]);

  const displayedDraftItems = useMemo(() => {
    return draftItems
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const getRank = (draft: DraftItem) => {
          if (!draft.isActive) return 2;
          if (draft.isManualAdd) return 0;
          return 1;
        };
        const rankDiff = getRank(a.item) - getRank(b.item);
        if (rankDiff !== 0) return rankDiff;
        return a.index - b.index;
      })
      .map(({ item }) => item);
  }, [draftItems]);

  const duplicateItemKeys = useMemo(() => {
    const counts = new Map<string, number>();
    draftItems.forEach((item) => {
      if (!item.isActive) return;
      const kode = String(item.kode_barang_variant || "").trim().toUpperCase();
      const barcode = String(item.barcode || "").trim().toUpperCase();
      const key = kode && kode !== "-" ? `KODE:${kode}` : barcode && barcode !== "-" ? `BARCODE:${barcode}` : "";
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key));
  }, [draftItems]);

  const getDuplicateItemKey = (item: DraftItem) => {
    const kode = String(item.kode_barang_variant || "").trim().toUpperCase();
    const barcode = String(item.barcode || "").trim().toUpperCase();
    if (kode && kode !== "-") return `KODE:${kode}`;
    if (barcode && barcode !== "-") return `BARCODE:${barcode}`;
    return "";
  };

  const updateItem = (id: string, patch: Partial<DraftItem>) => {
    setDraftItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const varianNameMap = useMemo(() => {
    const map = new Map<string, { nama_barang?: string; nama_varian?: string }>();
    (barangList || []).forEach((barang) => {
      const namaBarang = barang?.nama || "";
      const variants = Array.isArray(barang?.variants) ? barang.variants : [];
      variants.forEach((variant: any) => {
        const kode = String(variant?.kode_barang_variant || "").trim();
        if (!kode) return;
        map.set(kode, {
          nama_barang: namaBarang,
          nama_varian: variant?.nama || variant?.nama_varian || "",
        });
      });
    });
    return map;
  }, [barangList]);

  const handleSyncNames = async () => {
    if (!varianNameMap.size) {
      alert("Data master barang belum siap.");
      return;
    }
    let touched = false;
    const kodeList = Array.from(
      new Set(draftItems.map((it) => String(it.kode_barang_variant || "").trim()).filter(Boolean))
    );
    if (kodeList.length === 0) {
      alert("Tidak ada kode barang variant untuk disinkronkan.");
      return;
    }
    setDraftItems((prev) =>
      prev.map((it) => {
        const match = varianNameMap.get(String(it.kode_barang_variant || "").trim());
        if (!match) return it;
        const nextNamaBarang = match.nama_barang || it.namaBarang;
        const nextNamaVarian = match.nama_varian || it.namaVarian;
        if (nextNamaBarang === it.namaBarang && nextNamaVarian === it.namaVarian) {
          return it;
        }
        touched = true;
        return {
          ...it,
          namaBarang: nextNamaBarang,
          namaVarian: nextNamaVarian,
        };
      })
    );
    alert(touched ? "Nama barang dan varian disinkronkan." : "Tidak ada perubahan nama.");
  };

  const handleSave = async () => {
    if (isEditMode) {
      if (!editKodeParam) return;
      if (!noFakturSupplier.trim()) {
        alert("Nomor faktur supplier wajib diisi sebelum simpan perubahan.");
        return;
      }
      const confirm = window.confirm(`Simpan perubahan pengadaan ${editKodeParam}?`);
      if (!confirm) return;

      const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
      let updatedBy = "Admin";
      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession);
          updatedBy = parsed?.username || parsed?.name || updatedBy;
        } catch {
          // ignore parse error
        }
      }

      setSaving(true);
      setError(null);
      try {
        const itemsPayload = draftItems
          .filter((it) => it.isActive && it.kodeDetailPengadaan)
          .map((it) => ({
            kode_d_pengadaan: it.kodeDetailPengadaan,
            qty: Number(it.qty ?? 0),
            harga_beli: Number(it.hargaBeli ?? 0),
            catatan: it.catatan || null,
            satuan: "PCS",
          }));
        const deletedItems = draftItems
          .filter((it) => !it.isActive && it.kodeDetailPengadaan)
          .map((it) => String(it.kodeDetailPengadaan || "").trim())
          .filter(Boolean);
        const newItems = draftItems
          .filter((it) => it.isActive && !it.kodeDetailPengadaan)
          .map((it) => ({
            kode_barang_variant: it.kode_barang_variant,
            qty: Number(it.qty ?? 0),
            harga_beli: Number(it.hargaBeli ?? 0),
            catatan: it.catatan || null,
            satuan: "PCS",
          }));

        const res = await fetch(`${API_BASE}/pengadaan/${encodeURIComponent(editKodeParam)}/edit`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: "rahasia",
            updated_by: updatedBy,
            no_faktur_supplier: noFakturSupplier.trim(),
            items: itemsPayload,
            deleted_items: deletedItems,
            new_items: newItems,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (storageKey) {
          try {
            localStorage.removeItem(storageKey);
          } catch (err) {
            console.error("Failed clear draft storage", err);
          }
        }
        alert(`Pengadaan diperbarui: ${editKodeParam}`);
        router.push(`/admin/purchasing/po/print?kode=${encodeURIComponent(editKodeParam)}`);
      } catch (err) {
        console.error("Failed update pengadaan", err);
        setError("Gagal memperbarui pengadaan.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!header?.kode_t_rpo || !header?.kode_supplier) return;
    if (String(lpbHeader?.status || "").toUpperCase() !== "SAVED") {
      setError("LPB belum tersimpan. Simpan LPB terlebih dahulu sebelum buat PO.");
      return;
    }
    if (!noFakturSupplier.trim()) {
      alert("Nomor faktur supplier wajib diisi sebelum simpan pengadaan.");
      return;
    }
    const confirm = window.confirm(`Simpan pengadaan untuk RPO ${header.kode_t_rpo}?`);
    if (!confirm) return;

    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let createdBy = "Admin";
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        createdBy = parsed?.username || parsed?.name || createdBy;
      } catch {
        // ignore parse error
      }
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        kode_t_rpo: header.kode_t_rpo,
        kode_supplier: header.kode_supplier,
        tgl: header.tgl,
        deadline: header.deadline,
        no_faktur_supplier: noFakturSupplier.trim(),
        items: draftItems
          .filter((it) => it.isActive)
          .map((it) => ({
          kode_barang_variant: it.kode_barang_variant,
          barcode_varian: it.barcode,
          nama_barang: it.namaBarang || it.namaVarian,
          nama_varian: it.namaVarian || null,
          qty: Number(it.qty ?? 0),
          satuan: "PCS",
          harga_beli: Number(it.hargaBeli ?? 0),
          disc_1: Number(it.disc1 ?? 0),
          disc_2: Number(it.disc2 ?? 0),
          disc_3: Number(it.disc3 ?? 0),
          catatan: it.catatan || null,
          is_active: it.isActive ? 1 : 0,
          kode_parent: it.kodeParent,
        })),
        created_by: createdBy,
      };

      const res = await fetch(`${API_BASE}/pengadaan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const kodePengadaan = data?.kode_t_pengadaan || "";
      alert(`Pengadaan tersimpan: ${kodePengadaan || "-"}`);
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch (err) {
          console.error("Failed clear draft storage", err);
        }
      }
      setDraftItems([]);
      setNoFakturSupplier("");
      hasLocalDraftRef.current = false;
      if (kodePengadaan) {
        router.push(`/admin/purchasing/po/print?kode=${encodeURIComponent(kodePengadaan)}`);
        return;
      }
      router.push("/admin/purchasing/permintaan-pengadaan");
    } catch (err) {
      console.error("Failed save pengadaan", err);
      setError("Gagal menyimpan pengadaan.");
    } finally {
      setSaving(false);
    }
  };

  if ((!isEditMode && !kodeParam) || (isEditMode && !editKodeParam)) {
    return (
      <div className="p-6">
        <div className="p-4 rounded border border-amber-200 bg-amber-50 text-amber-800">
          {isEditMode ? "Kode pengadaan tidak diberikan." : "Kode RPO tidak diberikan. Buka halaman ini melalui tombol Buat PO."}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 text-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Draft Purchase Order</p>
          <h1 className="text-2xl font-bold">{isEditMode ? "Edit Pengadaan" : "Cetak Pengadaan"}</h1>
          <p className="text-sm text-gray-600">
            {isEditMode ? `No Pengadaan: ${editKodeParam}` : `RPO: ${kodeParam}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              router.push(
                isEditMode && editKodeParam
                  ? `/admin/purchasing/po/print?kode=${encodeURIComponent(editKodeParam)}`
                  : "/admin/purchasing/permintaan-pengadaan"
              )
            }
            className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Kembali
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          {isEditMode ? "Memuat data pengadaan..." : "Memuat data RPO/LPB..."}
        </div>
      )}
      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="bg-white border border-gray-300 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap justify-between gap-4 border-b border-gray-300 pb-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold">{site.nama_header_print || site.nama || "-"}</div>
            <div className="text-xs text-gray-600 whitespace-pre-line">
              {site.alamat_header_print || formatAddress(site) || "-"}
            </div>
            {(site.no_telp || site.email) && (
              <div className="text-xs text-gray-600">
                {site.no_telp ? `Telp: ${site.no_telp}` : ""}
                {site.email ? `${site.no_telp ? " | " : ""}${site.email}` : ""}
              </div>
            )}
          </div>
          <div className="space-y-1 text-xs text-gray-700">
            <div>Supplier: {supplierInfo.nama || header?.supplier_nama || header?.kode_supplier || "-"}</div>
            <div>Alamat: {formatAddress(supplierInfo) || "-"}</div>
            <div>Kota: {supplierInfo.kota || "-"}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs text-gray-700 pt-3">
          <div>No Pengadaan: <span className="font-semibold">{isEditMode ? header?.kode_t_pengadaan || editKodeParam || "-" : "(Auto)"}</span></div>
          <div>Tanggal: <span className="font-semibold">{formatDate(header?.tgl)}</span></div>
          <div>No Permintaan: <span className="font-semibold">{header?.kode_t_rpo || "-"}</span></div>
          <div>Deadline: <span className="font-semibold">{formatDate(header?.deadline)}</span></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Total Qty</div>
            <div className="text-lg font-semibold text-gray-900">{totals.qty}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Total Nominal</div>
            <div className="text-lg font-semibold text-gray-900">{formatIDR(totals.subtotal)}</div>
          </div>
        </div>
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2">
          <label className="flex flex-col gap-1 text-[11px] text-gray-500">
            Nomor Faktur Supplier
            <input
              value={noFakturSupplier}
              onChange={(e) => setNoFakturSupplier(e.target.value)}
              placeholder="Masukkan nomor faktur supplier"
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm bg-white"
            />
          </label>
        </div>
        <div className="text-xs text-emerald-700">
          {draftSavedAt
            ? `Draft tersimpan • ${draftSavedAt.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "Draft belum tersimpan"}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowAddModal(true);
            }}
            className="h-10 w-10 flex items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 text-lg font-semibold"
            title="Tambah Item"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleSyncNames}
            disabled={barangLoading}
            className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Sinkron Nama
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || draftItems.length === 0}
            className={`px-5 py-2.5 text-sm font-semibold rounded-md text-white ${
              saving || loading || draftItems.length === 0
                ? "bg-emerald-300 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {saving ? "Menyimpan..." : isEditMode ? "Simpan Perubahan" : "Simpan Pengadaan"}
          </button>
        </div>
      </div>

      <div className="border border-gray-400 rounded-lg overflow-hidden bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-100 border-b border-gray-400">
            <tr>
              <th className="px-2 py-2 text-left w-10 border-r border-gray-300">No</th>
              <th className="px-2 py-2 text-left border-r border-gray-300">Barcode</th>
              <th className="px-2 py-2 text-left border-r border-gray-300">Nama Barang</th>
              <th className="px-2 py-2 text-left border-r border-gray-300">Nama Varian</th>
              <th className="px-2 py-2 text-right w-20 border-r border-gray-300">Jml</th>
              <th className="px-2 py-2 text-left w-14 border-r border-gray-300">Satuan</th>
              <th className="px-2 py-2 text-right w-28 border-r border-gray-300">H. Beli</th>
              <th className="px-2 py-2 text-right w-28 border-r border-gray-300">Subtotal</th>
              <th className="px-2 py-2 text-left border-r border-gray-300">Catatan</th>
              <th className="px-2 py-2 text-center w-20">Action</th>
            </tr>
          </thead>
          <tbody>
            {displayedDraftItems.map((item, idx) => {
              const isDuplicate = duplicateItemKeys.has(getDuplicateItemKey(item));
              const rowClass = isDuplicate
                ? "bg-rose-100"
                : item.isManualAdd
                  ? "bg-amber-100"
                  : item.missingInRpo
                    ? "bg-rose-50"
                    : item.qtyMismatch
                      ? "bg-amber-50"
                      : "";
              const subtotal = Number(item.qty ?? 0) * Number(item.hargaBeli ?? 0);
              const disabledClass = !item.isActive && !isDuplicate ? "bg-slate-300 text-slate-600" : "";
              const hoverClass = isDuplicate ? "hover:bg-rose-100" : "hover:bg-slate-50";
              return (
                <tr
                  key={item.id}
                  className={`border-b border-gray-200 ${hoverClass} ${rowClass} ${disabledClass}`}
                >
                  <td className="px-2 py-2 text-center border-r border-gray-200">{idx + 1}</td>
                  <td className="px-2 py-2 border-r border-gray-200">
                    <div className="font-semibold">{item.barcode}</div>
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200">
                    <div className="font-semibold">
                      {item.isInlineAdd ? "└─── " : ""}
                      {item.namaBarang}
                    </div>
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200">
                    <div className="font-semibold">{item.namaVarian}</div>
                  </td>
                  <td className="px-2 py-2 text-right border-r border-gray-200">
                    <input
                      type="number"
                      className="w-16 text-right border border-gray-200 rounded px-1 py-0.5 bg-white"
                      value={Number(item.qty ?? 0)}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => e.currentTarget.select()}
                      onChange={(e) => updateItem(item.id, { qty: Number(e.target.value || 0) })}
                      disabled={!item.isActive}
                    />
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200">PCS</td>
                  <td className="px-2 py-2 text-right border-r border-gray-200">
                    <input
                      type="number"
                      className="w-24 text-right border border-gray-200 rounded px-1 py-0.5 bg-white"
                      value={Number(item.hargaBeli ?? 0)}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => e.currentTarget.select()}
                      onChange={(e) => updateItem(item.id, { hargaBeli: Number(e.target.value || 0) })}
                      disabled={!item.isActive}
                    />
                  </td>
                  <td className="px-2 py-2 text-right font-semibold border-r border-gray-200">{formatIDR(subtotal)}</td>
                  <td className="px-2 py-2 border-r border-gray-200">
                    <input
                      type="text"
                      className="w-full border border-gray-200 rounded px-1 py-0.5 bg-white"
                      value={item.catatan}
                      onChange={(e) => updateItem(item.id, { catatan: e.target.value })}
                      disabled={!item.isActive}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { isActive: !item.isActive })}
                        className={`h-7 w-7 rounded-full border text-xs font-semibold ${
                          item.isActive
                            ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                            : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        }`}
                        title={item.isActive ? "Nonaktifkan" : "Aktifkan"}
                      >
                        {item.isActive ? "×" : "↺"}
                      </button>
                      {item.isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddModal(true);
                          }}
                          className="h-7 w-7 rounded-full border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                          title="Tambah item"
                        >
                          +
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {draftItems.length === 0 && !loading && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={9}>
                  Tidak ada item.
                </td>
              </tr>
            )}
          </tbody>
          {draftItems.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-300">
              <tr>
                <td className="px-2 py-2 font-semibold text-right" colSpan={3}>
                  Total
                </td>
                <td className="px-2 py-2 text-right font-semibold">{totals.qty}</td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2 text-right font-semibold">{formatIDR(totals.subtotal)}</td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Tambah Item</h2>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setShowAddModal(false);
                }}
              >
                ✕
              </button>
            </div>
            <div className="px-4 py-4 space-y-3 text-sm">
              <SearchableSelect
                label="Cari Barcode"
                value={newItem.barcode}
                options={barcodeOptions}
                placeholder={barangLoading ? "Memuat barcode..." : "Scan / ketik barcode"}
                allowCustom={false}
                onChange={(value, selected) => {
                  if (!selected?.barang || !selected?.variant) {
                    setNewItem((prev) => ({ ...prev, barcode: value }));
                    return;
                  }
                  selectBarangVariant(selected.barang, selected.variant);
                }}
              />
              <SearchableSelect
                label="Nama Barang"
                value={selectedBarangId}
                options={barangOptions}
                placeholder={barangLoading ? "Memuat data barang..." : "Pilih barang"}
                allowCustom={false}
                onChange={(value, selected) => {
                  if (!selected) {
                    setSelectedBarangId(value);
                    return;
                  }
                  setSelectedBarangId(String(selected.id_barang ?? value));
                  setVarianOptions(buildVarianOptions(selected));
                  setNewItem((prev) => ({
                    ...prev,
                    namaBarang: selected?.nama || prev.namaBarang,
                    namaVarian: "",
                    kode_barang_variant: "",
                    barcode: "",
                  }));
                }}
              />
              <SearchableSelect
                label="Nama Varian"
                value={newItem.kode_barang_variant}
                options={varianOptions}
                placeholder={selectedBarangId ? "Pilih varian" : "Pilih barang dulu"}
                allowCustom={false}
                onChange={(_value, selected) => {
                  if (!selected) return;
                  setNewItem((prev) => ({
                    ...prev,
                    kode_barang_variant: selected.kode_barang_variant,
                    namaVarian: selected.nama_varian || prev.namaVarian,
                    barcode: selected.barcode || prev.barcode,
                    hargaBeli: Number(selected.harga_beli ?? prev.hargaBeli ?? 0),
                  }));
                }}
              />
              <label className="block">
                <span className="text-xs text-gray-600">Barcode</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border border-gray-200 px-2 py-1"
                  value={newItem.barcode}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, barcode: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-600">Qty</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-right"
                    value={newItem.qty}
                    disabled={!newItem.kode_barang_variant}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, qty: Number(e.target.value || 0) }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-600">Harga Beli</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-right"
                    value={newItem.hargaBeli}
                    disabled={!newItem.kode_barang_variant}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, hargaBeli: Number(e.target.value || 0) }))}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-gray-600">Catatan</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border border-gray-200 px-2 py-1"
                  value={newItem.catatan}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, catatan: e.target.value }))}
                />
              </label>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setShowAddModal(false);
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setSelectedBarangId("");
                  setVarianOptions([]);
                  setNewItem({
                    kode_barang_variant: "",
                    barcode: "",
                    namaBarang: "",
                    namaVarian: "",
                    qty: 0,
                    hargaBeli: 0,
                    catatan: "",
                  });
                }}
              >
                Clear Form
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => {
                  const kodeVar = newItem.kode_barang_variant.trim() || `MANUAL-${Date.now()}`;
                  const added: DraftItem = {
                    id: makeDraftItemId(kodeVar),
                    kode_barang_variant: kodeVar,
                    barcode: newItem.barcode || "-",
                    namaBarang: newItem.namaBarang || "-",
                    namaVarian: newItem.namaVarian || newItem.namaBarang || "-",
                    qty: Number(newItem.qty ?? 0),
                    hargaBeli: Number(newItem.hargaBeli ?? 0),
                    disc1: 0,
                    disc2: 0,
                    disc3: 0,
                    qtyRpo: 0,
                    missingInRpo: true,
                    qtyMismatch: false,
                    isActive: true,
                    catatan: newItem.catatan || "",
                    isManualAdd: true,
                    isInlineAdd: false,
                    kodeParent: null,
                  };
                  setDraftItems((prev) => [added, ...prev]);
                  setSelectedBarangId("");
                  setVarianOptions([]);
                  setNewItem({
                    kode_barang_variant: "",
                    barcode: "",
                    namaBarang: "",
                    namaVarian: "",
                    qty: 0,
                    hargaBeli: 0,
                    catatan: "",
                  });
                  setShowAddModal(false);
                }}
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
