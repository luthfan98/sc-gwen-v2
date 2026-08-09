"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardList, Trash2, Save, Camera } from "lucide-react";

type LpbHeader = {
  kode_lpb: string;
  kode_t_rpo: string;
  kode_supplier: string;
  supplier_nama?: string;
  tgl_lpb: string;
  status: string;
};

type LpbItem = {
  kode_d_lpb: string;
  kode_barang_variant: string;
  barcode_varian?: string | null;
  nama_barang?: string | null;
  nama_varian?: string | null;
  qty_rpo?: number;
  qty: number;
  catatan?: string | null;
  expired_dates?: string[];
  status?: number | null;
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
        {options.map((opt) => (
          <option key={opt.value} value={opt.label}>
            {opt.label}
          </option>
        ))}
      </datalist>
    </label>
  );
}

export default function LpbPage() {
  const params = useParams<{ kode: string }>();
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const kodeParam = decodeURIComponent(params?.kode ?? "");

  const [header, setHeader] = useState<LpbHeader | null>(null);
  const [items, setItems] = useState<LpbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<LpbItem | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanValue, setScanValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [scanSearchOpen, setScanSearchOpen] = useState(false);
  const [scanSearchValue, setScanSearchValue] = useState("");
  const [scanSearchError, setScanSearchError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [barangList, setBarangList] = useState<any[]>([]);
  const [barangOptions, setBarangOptions] = useState<{ label: string; value: string; data: any }[]>([]);
  const [varianOptions, setVarianOptions] = useState<{ label: string; value: string; data: any }[]>([]);
  const [selectedBarangId, setSelectedBarangId] = useState<string>("");
  const [barangLoading, setBarangLoading] = useState(false);
  const [newItem, setNewItem] = useState({
    kode_barang_variant: "",
    nama_barang: "",
    nama_varian: "",
    barcode_varian: "",
    qty: 0,
    harga_beli: 0,
    catatan: "",
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const searchVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const searchStreamRef = useRef<MediaStream | null>(null);
  const saveTimersRef = useRef<Record<string, number>>({});

  const showToast = (next: { type: "success" | "error"; message: string }) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2000);
  };

  const fetchLpb = async () => {
    if (!kodeParam) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/lpb/${encodeURIComponent(kodeParam)}`);
      if (res.status === 404) {
        const createRes = await fetch(`${API_BASE}/lpb/from-rpo/${encodeURIComponent(kodeParam)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ created_by: "Admin" }),
        });
        if (!createRes.ok) throw new Error(`HTTP ${createRes.status}`);
        const created = await createRes.json();
        setHeader(created?.header || null);
        setItems(Array.isArray(created?.items) ? created.items : []);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHeader(data?.header || null);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error("Failed fetch LPB", err);
      setError("Gagal memuat LPB.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLpb();
  }, [kodeParam]);

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

  const formatTanggal = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString("id-ID");
  };

  const totalQty = useMemo(
    () =>
      items.reduce(
        (sum, it) => sum + (Number(it.status ?? 1) === 0 ? 0 : Number(it.qty) || 0),
        0
      ),
    [items]
  );

  const handleQtyChange = (kodeDLpb: string, value: number) => {
    setItems((prev) =>
      prev.map((it) => (it.kode_d_lpb === kodeDLpb ? { ...it, qty: Math.max(0, value) } : it))
    );
    const target = items.find((it) => it.kode_d_lpb === kodeDLpb);
    if (!target || Number(target.status ?? 1) === 0) return;
    if (saveTimersRef.current[kodeDLpb]) {
      window.clearTimeout(saveTimersRef.current[kodeDLpb]);
    }
    saveTimersRef.current[kodeDLpb] = window.setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/lpb/${encodeURIComponent(kodeParam)}/items`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kode_d_lpb: target.kode_d_lpb,
            kode_barang_variant: target.kode_barang_variant,
            barcode_varian: target.barcode_varian || null,
            nama_barang: target.nama_barang || null,
            qty: Math.max(0, Math.floor(value)),
            updated_by: "Admin",
            status: target.status ?? 1,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showToast({ type: "success", message: "Qty LPB tersimpan." });
      } catch (err) {
        showToast({ type: "error", message: "Gagal menyimpan qty LPB." });
      }
    }, 600);
  };

  const handleCatatanChange = (kodeDLpb: string, value: string) => {
    setItems((prev) =>
      prev.map((it) => (it.kode_d_lpb === kodeDLpb ? { ...it, catatan: value } : it))
    );
    const target = items.find((it) => it.kode_d_lpb === kodeDLpb);
    if (!target || Number(target.status ?? 1) === 0) return;
    if (saveTimersRef.current[`${kodeDLpb}-catatan`]) {
      window.clearTimeout(saveTimersRef.current[`${kodeDLpb}-catatan`]);
    }
    saveTimersRef.current[`${kodeDLpb}-catatan`] = window.setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/lpb/${encodeURIComponent(kodeParam)}/items`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kode_d_lpb: target.kode_d_lpb,
            kode_barang_variant: target.kode_barang_variant,
            barcode_varian: target.barcode_varian || null,
            nama_barang: target.nama_barang || null,
            qty: Math.max(0, Math.floor(Number(target.qty) || 0)),
            catatan: value || null,
            updated_by: "Admin",
            status: target.status ?? 1,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showToast({ type: "success", message: "Catatan tersimpan." });
      } catch {
        showToast({ type: "error", message: "Gagal menyimpan catatan." });
      }
    }, 700);
  };

  const updateExpiredDates = (kodeBarangVariant: string, dates: string[]) => {
    setItems((prev) =>
      prev.map((it) =>
        it.kode_barang_variant === kodeBarangVariant ? { ...it, expired_dates: dates } : it
      )
    );
  };

  const queueExpiredSave = (kodeBarangVariant: string, dates: string[]) => {
    if (!kodeParam || !kodeBarangVariant) return;
    const target = items.find((it) => it.kode_barang_variant === kodeBarangVariant);
    if (Number(target?.status ?? 1) === 0) return;
    const timerKey = `expired:${kodeBarangVariant}`;
    if (saveTimersRef.current[timerKey]) {
      window.clearTimeout(saveTimersRef.current[timerKey]);
    }
    saveTimersRef.current[timerKey] = window.setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/lpb/${encodeURIComponent(kodeParam)}/expired`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_barang_variant: kodeBarangVariant,
          expired_dates: dates.filter((d) => d),
        }),
      });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showToast({ type: "success", message: "Expired tersimpan." });
      } catch (err) {
        showToast({ type: "error", message: "Gagal menyimpan expired." });
      }
    }, 700);
  };

  const handleDeactivate = async (kodeDLpb: string) => {
    const target = items.find((it) => it.kode_d_lpb === kodeDLpb);
    if (!target || Number(target.status ?? 1) === 0) return;
    try {
      const res = await fetch(`${API_BASE}/lpb/${encodeURIComponent(kodeParam)}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_d_lpb: target.kode_d_lpb,
          kode_barang_variant: target.kode_barang_variant,
          barcode_varian: target.barcode_varian || null,
          nama_barang: target.nama_barang || null,
          qty: Math.max(0, Math.floor(Number(target.qty) || 0)),
          catatan: target.catatan || null,
          updated_by: "Admin",
          status: 0,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.map((it) => (it.kode_d_lpb === kodeDLpb ? { ...it, status: 0 } : it)));
      showToast({ type: "success", message: "Item dinonaktifkan." });
    } catch (err) {
      showToast({ type: "error", message: "Gagal menonaktifkan item." });
    }
  };

  const handleActivate = async (kodeDLpb: string) => {
    const target = items.find((it) => it.kode_d_lpb === kodeDLpb);
    if (!target || Number(target.status ?? 1) !== 0) return;
    try {
      const res = await fetch(`${API_BASE}/lpb/${encodeURIComponent(kodeParam)}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_d_lpb: target.kode_d_lpb,
          kode_barang_variant: target.kode_barang_variant,
          barcode_varian: target.barcode_varian || null,
          nama_barang: target.nama_barang || null,
          qty: Math.max(0, Math.floor(Number(target.qty) || 0)),
          catatan: target.catatan || null,
          updated_by: "Admin",
          status: 1,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.map((it) => (it.kode_d_lpb === kodeDLpb ? { ...it, status: 1 } : it)));
      showToast({ type: "success", message: "Item diaktifkan." });
    } catch (err) {
      showToast({ type: "error", message: "Gagal mengaktifkan item." });
    }
  };

  const openScan = (item: LpbItem) => {
    setScanTarget(item);
    setScanValue(item.barcode_varian || "");
    setScanError(null);
    setScanOpen(true);
  };

  const closeScan = () => {
    setScanOpen(false);
    setScanTarget(null);
    setScanError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const openSearchScan = () => {
    setScanSearchValue("");
    setScanSearchError(null);
    setScanSearchOpen(true);
  };

  const closeSearchScan = () => {
    setScanSearchOpen(false);
    setScanSearchError(null);
    if (searchStreamRef.current) {
      searchStreamRef.current.getTracks().forEach((t) => t.stop());
      searchStreamRef.current = null;
    }
  };

  useEffect(() => {
    const startCamera = async () => {
      if (!scanOpen) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setScanError("Kamera tidak dapat diakses. Cek izin kamera.");
      }
    };
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [scanOpen]);

  useEffect(() => {
    const startCamera = async () => {
      if (!scanSearchOpen) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        searchStreamRef.current = stream;
        if (searchVideoRef.current) {
          searchVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        setScanSearchError("Kamera tidak dapat diakses. Cek izin kamera.");
      }
    };
    startCamera();
    return () => {
      if (searchStreamRef.current) {
        searchStreamRef.current.getTracks().forEach((t) => t.stop());
        searchStreamRef.current = null;
      }
    };
  }, [scanSearchOpen]);

  const handleApplySearchScan = () => {
    setSearchTerm(scanSearchValue.trim());
    closeSearchScan();
  };

  const handleSaveBarcode = async () => {
    if (!scanTarget) return;
    const nextBarcode = scanValue.trim();
    if (scanTarget.status === 0) return;
    try {
      const res = await fetch(`${API_BASE}/lpb/${encodeURIComponent(kodeParam)}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_d_lpb: scanTarget.kode_d_lpb,
          kode_barang_variant: scanTarget.kode_barang_variant,
          barcode_varian: nextBarcode || null,
          nama_barang: scanTarget.nama_barang || null,
          qty: Math.max(0, Math.floor(Number(scanTarget.qty) || 0)),
          catatan: scanTarget.catatan || null,
          updated_by: "Admin",
          status: scanTarget.status ?? 1,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) =>
        prev.map((it) =>
          it.kode_d_lpb === scanTarget.kode_d_lpb ? { ...it, barcode_varian: nextBarcode || null } : it
        )
      );
      showToast({ type: "success", message: "Barcode diperbarui." });
      closeScan();
    } catch (err) {
      showToast({ type: "error", message: "Gagal memperbarui barcode." });
    }
  };

  const handleAddItem = async () => {
    if (!kodeParam) return;
    const kodeVar = newItem.kode_barang_variant.trim();
    if (!kodeVar) {
      showToast({ type: "error", message: "Kode varian wajib diisi." });
      return;
    }
    setAddSaving(true);
    try {
      const res = await fetch(`${API_BASE}/lpb/${encodeURIComponent(kodeParam)}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_barang_variant: kodeVar,
          barcode_varian: newItem.barcode_varian.trim() || null,
          nama_barang: newItem.nama_barang.trim() || null,
          qty: Math.max(0, Math.floor(Number(newItem.qty) || 0)),
          catatan: newItem.catatan.trim() || null,
          updated_by: "Admin",
          status: 1,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast({ type: "success", message: "Item ditambahkan." });
      setSelectedBarangId("");
      setVarianOptions([]);
      setNewItem({
        kode_barang_variant: "",
        nama_barang: "",
        nama_varian: "",
        barcode_varian: "",
        qty: 0,
        harga_beli: 0,
        catatan: "",
      });
      setShowAddModal(false);
      await fetchLpb();
    } catch (err) {
      showToast({ type: "error", message: "Gagal menambah item." });
    } finally {
      setAddSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.trim().toLowerCase();
    return items.filter((it) => {
      return (
        String(it.barcode_varian || "").toLowerCase().includes(term) ||
        String(it.nama_barang || "").toLowerCase().includes(term) ||
        String(it.nama_varian || "").toLowerCase().includes(term) ||
        String(it.kode_barang_variant || "").toLowerCase().includes(term)
      );
    });
  }, [items, searchTerm]);

  const handleSave = async () => {
    if (!kodeParam) return;
    const ok = window.confirm("Simpan LPB dan lanjutkan ke cetak?");
    if (!ok) return;
    setSaving(true);
    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let username = "Admin";
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        username = parsed?.username || parsed?.name || username;
      } catch {
        // ignore parse error
      }
    }
    try {
      const res = await fetch(`${API_BASE}/lpb/${encodeURIComponent(kodeParam)}/save`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updated_by: username, verifikasi_by: username }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast({ type: "success", message: "LPB tersimpan." });
      window.location.href = `/penerimaan-barang/LPB/${encodeURIComponent(kodeParam)}/print`;
    } catch (err) {
      showToast({ type: "error", message: "Gagal menyimpan LPB." });
    } finally {
      setSaving(false);
    }
  };

  if (!kodeParam) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 py-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
          Kode RPO tidak valid.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 py-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
          Memuat data LPB...
        </div>
      </div>
    );
  }

  if (error || !header) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 py-8 space-y-4">
        <Link
          href="/admin/purchasing/permintaan-pengadaan"
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error || "LPB tidak ditemukan."}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/penerimaan-barang"
            className="mt-1 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">Lembar Penerimaan Barang</p>
            <h1 className="text-2xl font-bold text-gray-900">{header.kode_lpb}</h1>
            <p className="text-sm text-gray-600">
              RPO: {header.kode_t_rpo} | Supplier: {header.supplier_nama || header.kode_supplier}
            </p>
            <p className="text-xs text-gray-500">Tanggal: {formatTanggal(header.tgl_lpb)}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm">
            <div className="text-xs text-gray-500">Total Qty</div>
            <div className="text-xl font-bold text-gray-900">{totalQty}</div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[#0f756b]/15 bg-white/95 shadow-lg shadow-[#3fe0d0]/10 p-4 lg:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <ClipboardList className="h-4 w-4 text-[#0f756b]" />
          Item LPB
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[220px]">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari barcode / nama barang / nama varian / kode varian"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={openSearchScan}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Camera className="h-4 w-4" />
            Scan Barcode
          </button>
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0f756b] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0d6a62]"
          >
            Tambah Item
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
          <table className="min-w-[1320px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-center w-12">No</th>
                <th className="px-3 py-2 text-left">Barcode</th>
                <th className="px-3 py-2 text-left">Nama Barang</th>
                <th className="px-3 py-2 text-left">Nama Varian</th>
                <th className="px-3 py-2 text-left">Expired</th>
                <th className="px-3 py-2 text-right">Qty RPO</th>
                <th className="px-3 py-2 text-right">Qty LPB</th>
                <th className="px-3 py-2 text-left">Catatan</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map((item, idx) => {
                const displayExpired =
                  item.expired_dates && item.expired_dates.length > 0 ? item.expired_dates : [""];
                const isInactive = Number(item.status ?? 1) === 0;
                const rowTone = isInactive ? "bg-slate-50 text-slate-600" : "bg-white";
                return (
                <tr
                  key={item.kode_d_lpb}
                  className={`hover:bg-gray-50/80 ${rowTone} ${isInactive ? "opacity-60" : ""}`}
                >
                  <td className="px-3 py-2 text-center text-gray-700">{idx + 1}</td>
                  <td className="px-3 py-2 text-gray-700">
                    <div className="flex items-center gap-2">
                      <span>{item.barcode_varian || "-"}</span>
                      <button
                        type="button"
                        onClick={() => openScan(item)}
                        disabled={isInactive}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        <Camera className="h-3 w-3" />
                        Ubah
                      </button>
                      {isInactive && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                          Nonaktif
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-800">{item.nama_barang || "-"}</td>
                  <td className="px-3 py-2 text-gray-800">{item.nama_varian || "-"}</td>
                  <td className="px-3 py-2 text-gray-600">
                    <div className="space-y-2">
                      {displayExpired.map((dateValue, idx) => (
                        <div key={`${item.kode_barang_variant}-exp-${idx}`} className="flex items-center gap-2">
                          <input
                            type="date"
                            value={dateValue}
                            onChange={(e) => {
                              const next = [...displayExpired];
                              next[idx] = e.target.value;
                              const sanitized = next.filter((d) => d);
                              updateExpiredDates(item.kode_barang_variant, next);
                              queueExpiredSave(item.kode_barang_variant, sanitized);
                            }}
                            disabled={isInactive}
                            className="rounded-md border border-gray-200 px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const ok = window.confirm("Hapus tanggal expired ini?");
                              if (!ok) return;
                              const next = displayExpired.filter((_, i) => i !== idx);
                              const sanitized = next.filter((d) => d);
                              updateExpiredDates(item.kode_barang_variant, next);
                              queueExpiredSave(item.kode_barang_variant, sanitized);
                            }}
                            disabled={isInactive}
                            className="px-2 py-1 rounded-md border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...displayExpired, ""];
                              updateExpiredDates(item.kode_barang_variant, next);
                            }}
                            disabled={isInactive}
                            className="px-2 py-1 rounded-md border border-dashed border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50"
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">{item.qty_rpo ?? 0}</td>
                  <td className="px-3 py-2 text-right text-gray-900 font-semibold">
                    <input
                      type="number"
                      min={0}
                      value={item.qty}
                      onChange={(e) => handleQtyChange(item.kode_d_lpb, Number(e.target.value))}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => e.currentTarget.select()}
                      disabled={isInactive}
                      className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm disabled:opacity-60"
                    />
                  </td>
                  <td className="px-3 py-2 text-left">
                    <input
                      type="text"
                      value={item.catatan || ""}
                      onChange={(e) => handleCatatanChange(item.kode_d_lpb, e.target.value)}
                      disabled={isInactive}
                      className="w-40 rounded-lg border border-gray-200 px-2 py-1 text-sm disabled:opacity-60"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeactivate(item.kode_d_lpb)}
                        disabled={isInactive}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 text-rose-600 px-2 py-1 text-xs font-semibold hover:bg-rose-50 disabled:opacity-60"
                      >
                        <Trash2 className="w-3 h-3" />
                        Nonaktifkan
                      </button>
                      {isInactive && (
                        <button
                          type="button"
                          onClick={() => handleActivate(item.kode_d_lpb)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 text-emerald-700 px-2 py-1 text-xs font-semibold hover:bg-emerald-50"
                        >
                          Aktifkan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                    Belum ada item LPB.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg border ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      {scanOpen && scanTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Scan Barcode</p>
                <p className="text-sm font-semibold text-gray-900">{scanTarget.nama_barang || "-"}</p>
              </div>
              <button
                type="button"
                onClick={closeScan}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
                <video ref={videoRef} autoPlay playsInline className="w-full h-56 object-cover" />
              </div>
              {scanError && <div className="text-xs text-rose-600">{scanError}</div>}
              <label className="block text-xs text-gray-600">
                Barcode hasil scan / input manual
                <input
                  type="text"
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeScan}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveBarcode}
                  className="px-3 py-2 rounded-lg bg-[#0f756b] text-white text-sm font-semibold hover:bg-[#0d6a62]"
                >
                  Simpan Barcode
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {scanSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Scan Barcode</p>
                <p className="text-sm font-semibold text-gray-900">Cari item LPB</p>
              </div>
              <button
                type="button"
                onClick={closeSearchScan}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
                <video ref={searchVideoRef} autoPlay playsInline className="w-full h-56 object-cover" />
              </div>
              {scanSearchError && <div className="text-xs text-rose-600">{scanSearchError}</div>}
              <label className="block text-xs text-gray-600">
                Barcode hasil scan / input manual
                <input
                  type="text"
                  value={scanSearchValue}
                  onChange={(e) => setScanSearchValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeSearchScan}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleApplySearchScan}
                  className="px-3 py-2 rounded-lg bg-[#0f756b] text-white text-sm font-semibold hover:bg-[#0d6a62]"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Tambah Item</div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                X
              </button>
            </div>
            <div className="mt-4 space-y-3">
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
                  const variants = Array.isArray(selected?.variants) ? selected.variants : [];
                  setVarianOptions(
                    variants
                      .filter((v: any) => v?.kode_barang_variant)
                      .map((v: any) => ({
                        label: `${v?.nama || v?.nama_varian || "-"} (${v?.barcode || v?.barcode_varian || "-"})`,
                        value: String(v?.kode_barang_variant),
                        data: {
                          kode_barang_variant: String(v?.kode_barang_variant),
                          nama_varian: v?.nama || v?.nama_varian || "-",
                          barcode: v?.barcode || v?.barcode_varian || "-",
                          harga_beli: Number(v?.harga_beli_sat_1 ?? 0),
                        },
                      }))
                  );
                  setNewItem((prev) => ({
                    ...prev,
                    nama_barang: selected?.nama || prev.nama_barang,
                    nama_varian: "",
                    kode_barang_variant: "",
                    barcode_varian: "",
                    harga_beli: 0,
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
                    nama_varian: selected.nama_varian || prev.nama_varian,
                    barcode_varian: selected.barcode || prev.barcode_varian,
                    harga_beli: Number(selected.harga_beli ?? prev.harga_beli ?? 0),
                  }));
                }}
              />
              <label className="block text-xs text-gray-600">
                Barcode
                <input
                  type="text"
                  value={newItem.barcode_varian}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, barcode_varian: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-600">
                  Qty
                  <input
                    type="number"
                    min={0}
                    value={newItem.qty}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, qty: Number(e.target.value || 0) }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  Harga Beli
                  <input
                    type="number"
                    min={0}
                    value={newItem.harga_beli}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, harga_beli: Number(e.target.value || 0) }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs text-gray-600">
                Catatan
                <input
                  type="text"
                  value={newItem.catatan}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, catatan: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBarangId("");
                    setVarianOptions([]);
                    setNewItem({
                      kode_barang_variant: "",
                      nama_barang: "",
                      nama_varian: "",
                      barcode_varian: "",
                      qty: 0,
                      harga_beli: 0,
                      catatan: "",
                    });
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Clear Form
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={addSaving}
                  className="px-3 py-2 rounded-lg bg-[#0f756b] text-white text-sm font-semibold hover:bg-[#0d6a62] disabled:opacity-60"
                >
                  {addSaving ? "Menyimpan..." : "Tambah"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
