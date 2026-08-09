"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Camera, ClipboardList } from "lucide-react";
import Select, { type SingleValue } from "react-select";

type Header = {
  kode_t_penerimaan_pengadaan: string;
  kode_t_pengadaan: string;
  kode_supplier?: string | null;
  supplier_nama?: string | null;
  kode_gudang?: string | null;
  nama_gudang?: string | null;
  tgl?: string | null;
};

type GudangOption = {
  kode_gudang: string;
  nama: string;
};

type DetailItem = {
  kode_d_penerimaan_pengadaan: string;
  kode_barang?: string | null;
  nama_barang?: string | null;
  nama_varian?: string | null;
  barcode_varian?: string | null;
  jml_baik_dikirim?: number | null;
  jml_baik_diterima?: number | null;
  satuan_jml_baik?: string | null;
  jml_rusak_diterima?: number | null;
  satuan_jml_rusak?: string | null;
  catatan?: string | null;
  status?: number | null;
  is_active?: number | null;
  kode_h_stok_barang?: string | null;
  qty_masuk?: number | null;
};

export default function PenerimaanSupplierDetailPage() {
  const params = useParams<{ kode: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const kode = decodeURIComponent(params?.kode ?? "");
  const isEditMode = searchParams?.get("edit") === "true";
  const [header, setHeader] = useState<Header | null>(null);
  const [items, setItems] = useState<DetailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<DetailItem | null>(null);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [scanSearchOpen, setScanSearchOpen] = useState(false);
  const [scanSearchValue, setScanSearchValue] = useState("");
  const [scanSearchError, setScanSearchError] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeTarget, setChangeTarget] = useState<DetailItem | null>(null);
  const [barangOptions, setBarangOptions] = useState<any[]>([]);
  const [varianOptions, setVarianOptions] = useState<any[]>([]);
  const [selectedBarang, setSelectedBarang] = useState("");
  const [selectedVarian, setSelectedVarian] = useState("");
  const [changeSaving, setChangeSaving] = useState(false);
  const [rowBarangSelection, setRowBarangSelection] = useState<Record<string, string>>({});
  const [rowVarianSelection, setRowVarianSelection] = useState<Record<string, string>>({});
  const [gudangOptions, setGudangOptions] = useState<GudangOption[]>([]);
  const [selectedGudang, setSelectedGudang] = useState<{ value: string; label: string } | null>(null);
  const [savingGudang, setSavingGudang] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const searchVideoRef = useRef<HTMLVideoElement | null>(null);
  const saveTimersRef = useRef<Record<string, number>>({});
  const streamRef = useRef<MediaStream | null>(null);
  const searchStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!kode) return;
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(kode)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setHeader(data?.header || null);
        const list = Array.isArray(data?.items) ? data.items : [];
        setItems(list.filter((item: DetailItem) => Number(item.status ?? 1) === 1));
      } catch (err) {
        setError("Gagal memuat detail penerimaan.");
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [API_BASE, kode]);

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

  useEffect(() => {
    if (!changeOpen) return;
    const fetchOptions = async () => {
      try {
        const [barangRes, varianRes] = await Promise.all([
          fetch(`${API_BASE}/barang`),
          fetch(`${API_BASE}/barang/varian`),
        ]);
        const barangData = barangRes.ok ? await barangRes.json() : [];
        const varianData = varianRes.ok ? await varianRes.json() : [];
        setBarangOptions(Array.isArray(barangData) ? barangData : []);
        setVarianOptions(Array.isArray(varianData) ? varianData : []);
      } catch (err) {
        console.error("Failed fetch barang/varian options", err);
        setBarangOptions([]);
        setVarianOptions([]);
      }
    };
    fetchOptions();
  }, [API_BASE, changeOpen]);

  useEffect(() => {
    if (!changeTarget) return;
    setSelectedBarang("");
    setSelectedVarian("");
  }, [changeTarget]);

  useEffect(() => {
    const fetchGudang = async () => {
      try {
        const res = await fetch(`${API_BASE}/gudang`);
        const data = res.ok ? await res.json() : [];
        const mapped = Array.isArray(data)
          ? data
              .filter((item: any) => String(item?.kode_gudang || "").trim())
              .map((item: any) => ({
                kode_gudang: String(item.kode_gudang || "").trim(),
                nama: String(item.nama || item.kode_gudang || "").trim(),
              }))
          : [];
        setGudangOptions(mapped);
      } catch (err) {
        console.error("Failed fetch gudang options", err);
        setGudangOptions([]);
      }
    };
    fetchGudang();
  }, [API_BASE]);

  useEffect(() => {
    if (!header?.kode_gudang) {
      setSelectedGudang(null);
      return;
    }
    const kodeGudang = String(header.kode_gudang || "").trim();
    const namaGudang =
      gudangOptions.find((item) => item.kode_gudang === kodeGudang)?.nama ||
      header.nama_gudang ||
      kodeGudang;
    setSelectedGudang({ value: kodeGudang, label: namaGudang });
  }, [gudangOptions, header?.kode_gudang, header?.nama_gudang]);

  const updateItem = (id: string, patch: Partial<DetailItem>) => {
    setItems((prev) => prev.map((it) => (it.kode_d_penerimaan_pengadaan === id ? { ...it, ...patch } : it)));
  };

  const persistTargetGudang = async (kodeGudang: string, updatedBy: string) => {
    const res = await fetch(`${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(kode)}/target-gudang`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kode_gudang: kodeGudang,
        updated_by: updatedBy,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    setHeader((prev) =>
      prev
        ? {
            ...prev,
            kode_gudang: payload?.kode_gudang || kodeGudang,
            nama_gudang: payload?.nama_gudang || kodeGudang,
          }
        : prev
    );
    return payload;
  };

  const queueSave = (item: DetailItem) => {
    const key = item.kode_d_penerimaan_pengadaan;
    if (!key) return;
    if (saveTimersRef.current[key]) {
      window.clearTimeout(saveTimersRef.current[key]);
    }
    saveTimersRef.current[key] = window.setTimeout(async () => {
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
        await fetch(`${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(kode)}/items`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kode_d_penerimaan_pengadaan: item.kode_d_penerimaan_pengadaan,
            jml_baik_dikirim: Number(item.jml_baik_dikirim ?? 0),
            jml_baik_diterima: Number(item.jml_baik_diterima ?? 0),
            jml_rusak_diterima: Number(item.jml_rusak_diterima ?? 0),
            catatan: item.catatan || null,
            updated_by: username,
          }),
        });
      } catch (err) {
        console.error("Failed update penerimaan item", err);
      }
    }, 600);
  };

  const handleSaveAll = async () => {
    if (saving) return;
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
      const targetGudang = String(selectedGudang?.value || "").trim();
      if (!targetGudang) {
        alert("Target gudang wajib dipilih.");
        return;
      }
      await persistTargetGudang(targetGudang, username);
      await Promise.all(
        items.map((item) =>
          fetch(`${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(kode)}/items`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kode_d_penerimaan_pengadaan: item.kode_d_penerimaan_pengadaan,
              jml_baik_dikirim: Number(item.jml_baik_dikirim ?? 0),
              jml_baik_diterima: Number(item.jml_baik_diterima ?? 0),
              jml_rusak_diterima: Number(item.jml_rusak_diterima ?? 0),
              catatan: item.catatan || null,
              updated_by: username,
            }),
          })
        )
      );
      const stockRes = await fetch(`${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(kode)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updated_by: username, kode_gudang: targetGudang }),
      });
      if (!stockRes.ok) throw new Error(`HTTP ${stockRes.status}`);
      alert("Penerimaan tersimpan dan stok diperbarui.");
      router.push("/penerimaan-barang/supplier");
    } catch (err) {
      alert("Gagal menyimpan penerimaan.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBarcode = async () => {
    if (!scanTarget) return;
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
      const res = await fetch(`${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(kode)}/items/barcode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_barang_variant: scanTarget.kode_barang,
          barcode_varian: scanValue.trim() || null,
          updated_by: username,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      updateItem(scanTarget.kode_d_penerimaan_pengadaan, { barcode_varian: scanValue.trim() || null });
      setScanOpen(false);
      setScanTarget(null);
      setScanError(null);
    } catch (err) {
      setScanError("Gagal menyimpan barcode.");
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      return (
        String(item.barcode_varian || "").toLowerCase().includes(term) ||
        String(item.nama_barang || "").toLowerCase().includes(term) ||
        String(item.nama_varian || "").toLowerCase().includes(term) ||
        String(item.kode_barang || "").toLowerCase().includes(term)
      );
    });
  }, [items, searchTerm]);

  const duplicateVarian = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const key = String(item.kode_barang || "").trim();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const dup = new Set<string>();
    counts.forEach((count, key) => {
      if (count > 1) dup.add(key);
    });
    return dup;
  }, [items]);

  const showActionColumn = isEditMode || duplicateVarian.size > 0;

  const gudangSelectOptions = useMemo(
    () =>
      gudangOptions.map((item) => ({
        value: item.kode_gudang,
        label: item.nama || item.kode_gudang,
      })),
    [gudangOptions]
  );

  const supplierKode = String(header?.kode_supplier || "").trim();
  const barangMap = useMemo(() => {
    const map = new Map<string, any>();
    barangOptions.forEach((row: any) => {
      const key = String(row?.id_barang ?? "");
      if (key) map.set(key, row);
    });
    return map;
  }, [barangOptions]);

  const varianMap = useMemo(() => {
    const map = new Map<string, any>();
    varianOptions.forEach((row: any) => {
      const key = String(row?.kode_barang_variant ?? "");
      if (key) map.set(key, row);
    });
    return map;
  }, [varianOptions]);

  const barangSelectOptions = useMemo(() => {
    const filtered = supplierKode
      ? barangOptions.filter(
          (row: any) => String(row?.kode_supplier || "").trim() === supplierKode
        )
      : barangOptions;
    return filtered.map((row: any) => ({
      value: String(row?.id_barang ?? ""),
      label: row?.nama || row?.kode_barang || row?.id_barang,
      data: row,
    }));
  }, [barangOptions, supplierKode]);

  const varianOptionsByBarang = useMemo(() => {
    const filtered = supplierKode
      ? varianOptions.filter((row: any) => String(row?.kode_supplier || "").trim() === supplierKode)
      : varianOptions;
    const map = new Map<string, Array<{ value: string; label: string; data: any }>>();
    filtered.forEach((row: any) => {
      const key = String(row?.id_barang ?? "");
      if (!key) return;
      const list = map.get(key) || [];
      list.push({
        value: String(row?.kode_barang_variant ?? ""),
        label: row?.nama_varian || row?.kode_barang_variant,
        data: row,
      });
      map.set(key, list);
    });
    return map;
  }, [supplierKode, varianOptions]);

  const filteredVarianOptions = useMemo(() => {
    const filtered = varianOptions.filter((row: any) => {
      if (selectedBarang && String(row.id_barang ?? "") !== selectedBarang) return false;
      if (supplierKode && String(row?.kode_supplier || "").trim() !== supplierKode) return false;
      return true;
    });
    return filtered.map((row: any) => ({
      value: String(row?.kode_barang_variant ?? ""),
      label: row?.nama_varian || row?.kode_barang_variant,
      data: row,
    }));
  }, [selectedBarang, supplierKode, varianOptions]);

  const selectedBarangOption = barangSelectOptions.find((opt) => opt.value === selectedBarang) || null;
  const selectedVarianOption = filteredVarianOptions.find((opt) => opt.value === selectedVarian) || null;

  const selectStylesCompact = {
    control: (base: any) => ({
      ...base,
      minHeight: "30px",
      borderRadius: "0.5rem",
      borderColor: "#e5e7eb",
      boxShadow: "none",
      fontSize: "0.75rem",
      paddingLeft: "0.25rem",
    }),
    valueContainer: (base: any) => ({ ...base, padding: "0 6px" }),
    indicatorsContainer: (base: any) => ({ ...base, height: "30px" }),
    singleValue: (base: any) => ({ ...base, color: "#374151" }),
    placeholder: (base: any) => ({ ...base, color: "#9ca3af" }),
    menu: (base: any) => ({ ...base, zIndex: 60 }),
  };

  return (
    <div className="mx-auto px-4 py-10 space-y-6">
      <header className="flex items-center justify-between rounded-2xl border border-[#0f756b]/15 bg-white/85 px-4 py-3 shadow-sm shadow-[#3fe0d0]/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#0f756b]/10 border border-[#0f756b]/20 flex items-center justify-center text-[#0f756b] font-bold shadow-sm">
            PB
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.22em] text-[#0f756b]">
              Gudang
            </span>
            <span className="text-sm font-semibold text-gray-900">
              Detail Penerimaan Supplier
            </span>
          </div>
        </div>
        <Link
          href="/penerimaan-barang/supplier"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
      </header>

      <div className="rounded-3xl border border-[#0f756b]/15 bg-white/95 shadow-lg shadow-[#3fe0d0]/10 p-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-[#0f756b]/10 border border-[#0f756b]/20 flex items-center justify-center text-[#0f756b]">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">
              Detail Penerimaan
            </p>
            <h1 className="text-2xl font-bold text-gray-900">
              {kode || "-"}
            </h1>
            <p className="text-sm text-gray-600">
              Halaman detail penerimaan barang supplier.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[#0f756b]/15 bg-white/95 shadow-lg shadow-[#3fe0d0]/10 p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="grid md:grid-cols-3 gap-3 text-sm text-gray-700">
            <div>Kode Penerimaan: <span className="font-semibold">{header?.kode_t_penerimaan_pengadaan || "-"}</span></div>
            <div>Kode PO: <span className="font-semibold">{header?.kode_t_pengadaan || kode || "-"}</span></div>
            <div>Supplier: <span className="font-semibold">{header?.supplier_nama || header?.kode_supplier || "-"}</span></div>
            <div className="md:col-span-2 flex items-center gap-3">
              <span>
                Gudang Saat Ini:{" "}
                <span className="font-semibold">
                  {header?.nama_gudang || header?.kode_gudang || "-"}
                </span>
              </span>
              <div className="min-w-[260px]">
                <Select
                  instanceId="target-gudang-penerimaan"
                  options={gudangSelectOptions}
                  value={selectedGudang}
                  onChange={async (option: SingleValue<{ value: string; label: string }>) => {
                    const next = option ?? null;
                    setSelectedGudang(next);
                    if (!next?.value) return;
                    const rawSession =
                      typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
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
                      setSavingGudang(true);
                      await persistTargetGudang(next.value, username);
                    } catch (err) {
                      alert("Gagal menyimpan target gudang.");
                    } finally {
                      setSavingGudang(false);
                    }
                  }}
                  isDisabled={loading || saving || savingGudang}
                  placeholder="Pilih target gudang"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: 38,
                      borderRadius: 10,
                      borderColor: "#e5e7eb",
                      boxShadow: "none",
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      padding: "0 10px",
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 60,
                    }),
                  }}
                />
              </div>
            </div>
            <div>Tanggal: <span className="font-semibold">{header?.tgl ? String(header.tgl).slice(0, 10) : "-"}</span></div>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || loading}
            className="px-4 py-2 rounded-lg bg-[#0f756b] text-white text-sm font-semibold hover:bg-[#0d6a62] disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[220px]">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari barcode / nama barang / varian"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setScanSearchValue("");
              setScanSearchError(null);
              setScanSearchOpen(true);
            }}
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
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">No</th>
                <th className="px-3 py-2 text-left">Barcode</th>
                <th className="px-3 py-2 text-left">Nama Barang</th>
                <th className="px-3 py-2 text-left">Nama Varian</th>
                <th className="px-3 py-2 text-right">Qty Dikirim</th>
                {isEditMode && <th className="px-3 py-2 text-right">Qty Masuk</th>}
                <th className="px-3 py-2 text-right">Qty Baik</th>
                <th className="px-3 py-2 text-right">Qty Rusak</th>
                <th className="px-3 py-2 text-left">Catatan</th>
                {showActionColumn && <th className="px-3 py-2 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td
                    className="px-3 py-4 text-center text-gray-500"
                    colSpan={showActionColumn ? (isEditMode ? 10 : 9) : isEditMode ? 9 : 8}
                  >
                    Memuat data...
                  </td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td
                    className="px-3 py-4 text-center text-rose-600"
                    colSpan={showActionColumn ? (isEditMode ? 10 : 9) : isEditMode ? 9 : 8}
                  >
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filteredItems.length === 0 && (
                <tr>
                  <td
                    className="px-3 py-4 text-center text-gray-500"
                    colSpan={showActionColumn ? (isEditMode ? 10 : 9) : isEditMode ? 9 : 8}
                  >
                    Belum ada item penerimaan.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filteredItems.map((item, index) => {
                  const isInactive = Number(item.is_active ?? 1) === 0;
                  const missingHistory = !item.kode_h_stok_barang;
                  const isDuplicate = duplicateVarian.has(String(item.kode_barang || "").trim());
                  const qtyMismatch =
                    Number(item.qty_masuk ?? 0) !== Number(item.jml_baik_diterima ?? 0);
                  const rowId = item.kode_d_penerimaan_pengadaan;
                  const currentVarianCode = String(item.kode_barang || "");
                  const currentVarian = varianMap.get(currentVarianCode);
                  const defaultBarangId = currentVarian?.id_barang
                    ? String(currentVarian.id_barang)
                    : "";
                  const selectedBarangId = rowBarangSelection[rowId] ?? defaultBarangId;
                  const barangValue =
                    barangSelectOptions.find((opt) => opt.value === selectedBarangId) || null;
                  const varianOptionsRow = varianOptionsByBarang.get(selectedBarangId) || [];
                  const selectedVarianCode = rowVarianSelection[rowId] || currentVarianCode;
                  const selectedVarian = varianMap.get(selectedVarianCode);
                  const varianValue = selectedVarian
                    ? {
                        value: String(selectedVarian?.kode_barang_variant ?? ""),
                        label: selectedVarian?.nama_varian || selectedVarian?.kode_barang_variant,
                        data: selectedVarian,
                      }
                    : null;
                  const rowClass = isDuplicate
                    ? "bg-red-200"
                    : qtyMismatch
                    ? "bg-pink-100"
                    : isInactive
                    ? "bg-pink-50"
                    : missingHistory
                    ? "bg-amber-50"
                    : "";
                  return (
                    <tr
                      key={item.kode_d_penerimaan_pengadaan}
                      className={`hover:bg-gray-50/80 ${rowClass}`}
                    >
                    <td className="px-3 py-2 text-gray-700">{index + 1}</td>
                    <td className="px-3 py-2 text-gray-700">
                      <div className="flex items-center gap-2">
                        <span>{item.barcode_varian || "-"}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setScanTarget(item);
                            setScanValue(item.barcode_varian || "");
                            setScanError(null);
                            setScanOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          <Camera className="h-3 w-3" />
                          Ubah
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-800">
                      {isEditMode ? (
                        <Select
                          className="min-w-[220px]"
                          classNamePrefix="react-select"
                          styles={selectStylesCompact}
                          options={barangSelectOptions}
                          value={barangValue}
                          onChange={(opt: SingleValue<{ value: string }>) => {
                            const nextId = opt?.value || "";
                            setRowBarangSelection((prev) => ({ ...prev, [rowId]: nextId }));
                            setRowVarianSelection((prev) => ({ ...prev, [rowId]: "" }));
                          }}
                          placeholder="Pilih barang"
                          isClearable
                        />
                      ) : (
                        item.nama_barang || "-"
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {isEditMode ? (
                        <Select
                          className="min-w-[220px]"
                          classNamePrefix="react-select"
                          styles={selectStylesCompact}
                          options={varianOptionsRow}
                          value={varianValue}
                          onChange={async (opt: SingleValue<{ value: string; data?: any }>) => {
                            if (!opt?.value) return;
                            const rawSession =
                              typeof window !== "undefined"
                                ? localStorage.getItem("kosmetik-admin-session")
                                : null;
                            let username = "Admin";
                            if (rawSession) {
                              try {
                                const parsed = JSON.parse(rawSession);
                                username = parsed?.username || parsed?.name || username;
                              } catch {
                                // ignore
                              }
                            }
                            try {
                              const res = await fetch(
                                `${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(kode)}/items/variant`,
                                {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    kode_d_penerimaan_pengadaan: rowId,
                                    kode_barang_variant: opt.value,
                                    updated_by: username,
                                  }),
                                }
                              );
                              if (!res.ok) {
                                const data = await res.json().catch(() => ({}));
                                throw new Error(data.message || `HTTP ${res.status}`);
                              }
                              const selectedRow = opt.data || varianMap.get(String(opt.value));
                              updateItem(rowId, {
                                kode_barang: opt.value,
                                nama_barang: selectedRow?.nama_barang || item.nama_barang || null,
                                nama_varian: selectedRow?.nama_varian || item.nama_varian || null,
                                barcode_varian: selectedRow?.barcode_varian || item.barcode_varian || null,
                              });
                              setRowVarianSelection((prev) => ({ ...prev, [rowId]: opt.value }));
                              if (selectedRow?.id_barang) {
                                setRowBarangSelection((prev) => ({
                                  ...prev,
                                  [rowId]: String(selectedRow.id_barang),
                                }));
                              }
                            } catch (err: any) {
                              alert(err?.message || "Gagal mengganti item.");
                            }
                          }}
                          placeholder="Pilih varian"
                          isClearable
                        />
                      ) : (
                        item.nama_varian || "-"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {isEditMode ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            min={0}
                            value={Number(item.jml_baik_dikirim ?? 0)}
                            onChange={(e) => {
                              const next = Number(e.target.value || 0);
                              const updated = { ...item, jml_baik_dikirim: next };
                              updateItem(item.kode_d_penerimaan_pengadaan, { jml_baik_dikirim: next });
                              queueSave(updated);
                            }}
                            onFocus={(e) => e.currentTarget.select()}
                            onClick={(e) => e.currentTarget.select()}
                            className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-xs"
                          />
                          <span className="text-xs text-gray-500">{item.satuan_jml_baik || "PCS"}</span>
                        </div>
                      ) : (
                        <>
                          {item.jml_baik_dikirim ?? 0} {item.satuan_jml_baik || "PCS"}
                        </>
                      )}
                    </td>
                    {isEditMode && (
                      <td className="px-3 py-2 text-right text-gray-700">
                        {Number(item.qty_masuk ?? 0)} {item.satuan_jml_baik || "PCS"}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right text-gray-700">
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          min={0}
                          value={Number(item.jml_baik_diterima ?? 0)}
                          onChange={(e) => {
                            const next = Number(e.target.value || 0);
                            const updated = { ...item, jml_baik_diterima: next };
                            updateItem(item.kode_d_penerimaan_pengadaan, { jml_baik_diterima: next });
                            queueSave(updated);
                          }}
                          onFocus={(e) => e.currentTarget.select()}
                          onClick={(e) => e.currentTarget.select()}
                          className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const fullQty = Number(item.jml_baik_dikirim ?? 0);
                            const updated = { ...item, jml_baik_diterima: fullQty };
                            updateItem(item.kode_d_penerimaan_pengadaan, { jml_baik_diterima: fullQty });
                            queueSave(updated);
                          }}
                          className="h-7 w-7 rounded border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          title="Isi penuh"
                        >
                          F
                        </button>
                        <span className="text-xs text-gray-500">{item.satuan_jml_baik || "PCS"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          min={0}
                          value={Number(item.jml_rusak_diterima ?? 0)}
                          onChange={(e) => {
                            const next = Number(e.target.value || 0);
                            const updated = { ...item, jml_rusak_diterima: next };
                            updateItem(item.kode_d_penerimaan_pengadaan, { jml_rusak_diterima: next });
                            queueSave(updated);
                          }}
                          onFocus={(e) => e.currentTarget.select()}
                          onClick={(e) => e.currentTarget.select()}
                          className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-xs"
                        />
                        <span className="text-xs text-gray-500">{item.satuan_jml_rusak || "PCS"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      <input
                        type="text"
                        value={item.catatan || ""}
                        onChange={(e) => {
                          const next = e.target.value;
                          const updated = { ...item, catatan: next };
                          updateItem(item.kode_d_penerimaan_pengadaan, { catatan: next });
                          queueSave(updated);
                        }}
                        className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                      />
                    </td>
                    {showActionColumn && (
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(isEditMode || isDuplicate) && (
                            <button
                              type="button"
                              onClick={() => {
                                setChangeTarget(item);
                                setChangeOpen(true);
                              }}
                              className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Ganti Item
                            </button>
                          )}
                          {missingHistory && (
                            <button
                              type="button"
                              onClick={async () => {
                                const rawSession =
                                  typeof window !== "undefined"
                                    ? localStorage.getItem("kosmetik-admin-session")
                                    : null;
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
                                  const res = await fetch(
                                    `${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(kode)}/items/repair`,
                                    {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        kode_d_penerimaan_pengadaan: item.kode_d_penerimaan_pengadaan,
                                        updated_by: username,
                                      }),
                                    }
                                  );
                                  if (!res.ok) {
                                    const data = await res.json().catch(() => ({}));
                                    throw new Error(data.message || `HTTP ${res.status}`);
                                  }
                                  const data = await res.json().catch(() => ({}));
                                  updateItem(item.kode_d_penerimaan_pengadaan, {
                                    kode_h_stok_barang: data?.kode_h_stok_barang || "OK",
                                  });
                                  alert(data?.message || "History diperbaiki.");
                                } catch (err: any) {
                                  alert(err?.message || "Gagal memperbaiki history.");
                                }
                              }}
                              className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                            >
                              Perbaiki
                            </button>
                          )}
                          {isEditMode && (
                            <button
                              type="button"
                              onClick={async () => {
                                const confirm = window.confirm("Hapus item ini dari detail penerimaan?");
                                if (!confirm) return;
                                try {
                                  const res = await fetch(
                                    `${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(
                                      kode
                                    )}/items/${encodeURIComponent(item.kode_d_penerimaan_pengadaan)}`,
                                    { method: "DELETE" }
                                  );
                                  if (!res.ok) {
                                    const data = await res.json().catch(() => ({}));
                                    throw new Error(data.message || `HTTP ${res.status}`);
                                  }
                                  setItems((prev) =>
                                    prev.filter(
                                      (row) =>
                                        row.kode_d_penerimaan_pengadaan !==
                                        item.kode_d_penerimaan_pengadaan
                                    )
                                  );
                                } catch (err: any) {
                                  alert(err?.message || "Gagal menghapus item.");
                                }
                              }}
                              className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

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
                onClick={() => {
                  setScanOpen(false);
                  setScanTarget(null);
                  setScanError(null);
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach((t) => t.stop());
                    streamRef.current = null;
                  }
                }}
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
                  onClick={() => {
                    setScanOpen(false);
                    setScanTarget(null);
                    setScanError(null);
                    if (streamRef.current) {
                      streamRef.current.getTracks().forEach((t) => t.stop());
                      streamRef.current = null;
                    }
                  }}
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

      {changeOpen && changeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Ganti Item Barang</p>
                <p className="text-sm font-semibold text-gray-900">
                  {changeTarget.nama_barang || "-"} / {changeTarget.nama_varian || "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setChangeOpen(false);
                  setChangeTarget(null);
                }}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-gray-600">
                Barang
                <Select
                  className="mt-1 text-sm"
                  classNamePrefix="react-select"
                  options={barangSelectOptions}
                  value={selectedBarangOption}
                  onChange={(opt: SingleValue<{ value: string }>) => {
                    setSelectedBarang(opt?.value || "");
                    setSelectedVarian("");
                  }}
                  placeholder="Pilih barang"
                  isClearable
                />
              </label>
              <label className="block text-xs text-gray-600">
                Varian
                <Select
                  className="mt-1 text-sm"
                  classNamePrefix="react-select"
                  options={filteredVarianOptions}
                  value={selectedVarianOption}
                  onChange={(opt: SingleValue<{ value: string; data?: any }>) => {
                    setSelectedVarian(opt?.value || "");
                  }}
                  placeholder="Pilih varian"
                  isClearable
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setChangeOpen(false);
                  setChangeTarget(null);
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!selectedVarian || changeSaving}
                onClick={async () => {
                  if (!changeTarget || !selectedVarian) return;
                  const rawSession =
                    typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
                  let username = "Admin";
                  if (rawSession) {
                    try {
                      const parsed = JSON.parse(rawSession);
                      username = parsed?.username || parsed?.name || username;
                    } catch {
                      // ignore
                    }
                  }
                  setChangeSaving(true);
                  try {
                    const res = await fetch(
                      `${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(kode)}/items/variant`,
                      {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          kode_d_penerimaan_pengadaan: changeTarget.kode_d_penerimaan_pengadaan,
                          kode_barang_variant: selectedVarian,
                          updated_by: username,
                        }),
                      }
                    );
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data.message || `HTTP ${res.status}`);
                    }
                    const selectedRow = filteredVarianOptions.find(
                      (row: any) => row.value === selectedVarian
                    )?.data;
                    updateItem(changeTarget.kode_d_penerimaan_pengadaan, {
                      kode_barang: selectedVarian,
                      nama_barang: selectedRow?.nama_barang || changeTarget.nama_barang || null,
                      nama_varian: selectedRow?.nama_varian || changeTarget.nama_varian || null,
                      barcode_varian: selectedRow?.barcode_varian || changeTarget.barcode_varian || null,
                    });
                    setChangeOpen(false);
                    setChangeTarget(null);
                  } catch (err: any) {
                    alert(err?.message || "Gagal mengganti item.");
                  } finally {
                    setChangeSaving(false);
                  }
                }}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {changeSaving ? "Menyimpan..." : "Simpan"}
              </button>
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
                <p className="text-sm font-semibold text-gray-900">Cari barang</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScanSearchOpen(false);
                  setScanSearchError(null);
                  if (searchStreamRef.current) {
                    searchStreamRef.current.getTracks().forEach((t) => t.stop());
                    searchStreamRef.current = null;
                  }
                }}
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
                  onClick={() => {
                    setScanSearchOpen(false);
                    setScanSearchError(null);
                    if (searchStreamRef.current) {
                      searchStreamRef.current.getTracks().forEach((t) => t.stop());
                      searchStreamRef.current = null;
                    }
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm(scanSearchValue.trim());
                    setScanSearchOpen(false);
                    setScanSearchError(null);
                    if (searchStreamRef.current) {
                      searchStreamRef.current.getTracks().forEach((t) => t.stop());
                      searchStreamRef.current = null;
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-[#0f756b] text-white text-sm font-semibold hover:bg-[#0d6a62]"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
