"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Select, { type SingleValue } from "react-select";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";

type SupplierOption = {
  value: string;
  label: string;
  nama: string;
};

type MerkOption = {
  value: string;
  label: string;
  nama: string;
};

type GudangOption = {
  value: string;
  label: string;
  nama: string;
};

type VariantOption = {
  value: string;
  label: string;
  kode_barang_variant: string;
  nama_barang: string;
  nama_varian: string;
  barcode_varian: string;
  kode_merk: string;
  nama_merk: string;
  harga_beli_default: number;
  stok_saat_ini: number;
};

type DraftItem = {
  kode_barang_variant: string;
  nama_barang: string;
  nama_varian: string;
  barcode_varian: string;
  kode_merk: string;
  nama_merk: string;
  harga_beli: number;
  stok_saat_ini: number;
  qty: number;
  alasan_retur: string;
};

const formatIDR = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function ReturSupplierNewPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [loadingSupplier, setLoadingSupplier] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierOption | null>(null);

  const [merkOptions, setMerkOptions] = useState<MerkOption[]>([]);
  const [loadingMerk, setLoadingMerk] = useState(false);
  const [selectedMerk, setSelectedMerk] = useState<MerkOption | null>(null);

  const [gudangOptions, setGudangOptions] = useState<GudangOption[]>([]);
  const [loadingGudang, setLoadingGudang] = useState(false);
  const [selectedGudang, setSelectedGudang] = useState<GudangOption | null>(null);

  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [loadingVariant, setLoadingVariant] = useState(false);
  const [variantSearch, setVariantSearch] = useState("");
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [selectedVariantKeys, setSelectedVariantKeys] = useState<Record<string, boolean>>({});

  const [reasonInput, setReasonInput] = useState<string>("");
  const [catatan, setCatatan] = useState<string>("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuppliers = async () => {
      setLoadingSupplier(true);
      try {
        const res = await fetch(`${API_BASE}/retur-supplier/options/suppliers`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options: SupplierOption[] = Array.isArray(data)
          ? data.map((row: any) => ({
              value: String(row.kode_supplier || ""),
              label: `${String(row.nama || row.kode_supplier || "-")} (${String(row.kode_supplier || "-")})`,
              nama: String(row.nama || ""),
            }))
          : [];
        setSupplierOptions(options.filter((opt) => opt.value));
      } catch (err) {
        console.error("Failed fetch supplier options", err);
        setSupplierOptions([]);
      } finally {
        setLoadingSupplier(false);
      }
    };
    fetchSuppliers();
  }, [API_BASE]);

  useEffect(() => {
    const fetchGudang = async () => {
      setLoadingGudang(true);
      try {
        const res = await fetch(`${API_BASE}/retur-supplier/options/gudang`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options: GudangOption[] = Array.isArray(data)
          ? data.map((row: any) => ({
              value: String(row.kode_gudang || ""),
              label: `${String(row.nama || row.kode_gudang || "-")} (${String(row.kode_gudang || "-")})`,
              nama: String(row.nama || ""),
            }))
          : [];
        setGudangOptions(options.filter((opt) => opt.value));
      } catch (err) {
        console.error("Failed fetch gudang options", err);
        setGudangOptions([]);
      } finally {
        setLoadingGudang(false);
      }
    };
    fetchGudang();
  }, [API_BASE]);

  useEffect(() => {
    const supplierCode = selectedSupplier?.value || "";
    if (!supplierCode) {
      setMerkOptions([]);
      setSelectedMerk(null);
      setSelectedVariantKeys({});
      return;
    }
    const fetchMerks = async () => {
      setLoadingMerk(true);
      try {
        const res = await fetch(
          `${API_BASE}/retur-supplier/options/merks?kode_supplier=${encodeURIComponent(supplierCode)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options: MerkOption[] = Array.isArray(data)
          ? data.map((row: any) => ({
              value: String(row.kode_merk || ""),
              label: `${String(row.nama_merk || row.kode_merk || "-")} (${String(row.kode_merk || "-")})`,
              nama: String(row.nama_merk || row.kode_merk || ""),
            }))
          : [];
        setMerkOptions(options.filter((opt) => opt.value));
      } catch (err) {
        console.error("Failed fetch merk options", err);
        setMerkOptions([]);
      } finally {
        setLoadingMerk(false);
      }
    };
    fetchMerks();
    setSelectedMerk(null);
    setVariantOptions([]);
    setVariantSearch("");
    setSelectedVariantKeys({});
  }, [API_BASE, selectedSupplier]);

  useEffect(() => {
    const supplierCode = selectedSupplier?.value || "";
    const merkCode = selectedMerk?.value || "";
    const gudangCode = selectedGudang?.value || "";
    if (!supplierCode || !gudangCode) {
      setVariantOptions([]);
      setSelectedVariantKeys({});
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingVariant(true);
      try {
        const params = new URLSearchParams();
        params.set("kode_supplier", supplierCode);
        if (merkCode) params.set("kode_merk", merkCode);
        params.set("kode_gudang", gudangCode);
        params.set("limit", "120");
        if (variantSearch.trim()) params.set("search", variantSearch.trim());
        const res = await fetch(`${API_BASE}/retur-supplier/options/variants?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options: VariantOption[] = Array.isArray(data)
          ? data.map((row: any) => ({
              value: String(row.kode_barang_variant || ""),
              label: `${String(row.nama_barang || "-")} - ${String(row.nama_varian || "-")} (${String(
                row.kode_barang_variant || "-"
              )})`,
              kode_barang_variant: String(row.kode_barang_variant || ""),
              nama_barang: String(row.nama_barang || ""),
              nama_varian: String(row.nama_varian || ""),
              barcode_varian: String(row.barcode_varian || ""),
              kode_merk: String(row.kode_merk || ""),
              nama_merk: String(row.nama_merk || row.kode_merk || ""),
              harga_beli_default: Number(row.harga_beli_default ?? 0),
              stok_saat_ini: Number(row.stok_saat_ini ?? 0),
            }))
          : [];
        setVariantOptions(options.filter((opt) => opt.value));
      } catch (err) {
        console.error("Failed fetch variant options", err);
        setVariantOptions([]);
      } finally {
        setLoadingVariant(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [API_BASE, selectedSupplier, selectedMerk, selectedGudang, variantSearch]);

  useEffect(() => {
    setVariantSearch("");
    setSelectedVariantKeys({});
  }, [selectedGudang]);

  useEffect(() => {
    setSelectedVariantKeys({});
  }, [selectedMerk]);

  const selectableVariants = useMemo(
    () => variantOptions.filter((item) => Number(item.stok_saat_ini || 0) > 0),
    [variantOptions]
  );

  const selectedVariantList = useMemo(
    () => selectableVariants.filter((item) => selectedVariantKeys[item.kode_barang_variant]),
    [selectableVariants, selectedVariantKeys]
  );

  const allVisibleSelected = useMemo(() => {
    if (selectableVariants.length === 0) return false;
    return selectableVariants.every((item) => selectedVariantKeys[item.kode_barang_variant]);
  }, [selectableVariants, selectedVariantKeys]);

  const toggleVariant = (kodeBarangVariant: string, checked: boolean) => {
    setSelectedVariantKeys((prev) => ({ ...prev, [kodeBarangVariant]: checked }));
  };

  const toggleAllVisibleVariants = (checked: boolean) => {
    setSelectedVariantKeys((prev) => {
      const next = { ...prev };
      selectableVariants.forEach((item) => {
        next[item.kode_barang_variant] = checked;
      });
      return next;
    });
  };

  const addSelectedItemsToDraft = () => {
    setError(null);
    setSuccess(null);
    if (!selectedGudang) {
      setError("Pilih gudang terlebih dahulu.");
      return;
    }
    if (selectedVariantList.length === 0) {
      setError("Pilih minimal 1 barang.");
      return;
    }

    setDraftItems((prev) => {
      const map = new Map(prev.map((item) => [item.kode_barang_variant, item]));
      selectedVariantList.forEach((variant) => {
        const existing = map.get(variant.kode_barang_variant);
        const stokSaatIni = Number(variant.stok_saat_ini || 0);
        if (existing) {
          map.set(variant.kode_barang_variant, {
            ...existing,
            stok_saat_ini: stokSaatIni,
            qty: Math.min(stokSaatIni, Number(existing.qty || 0) + 1),
            alasan_retur: reasonInput.trim() || existing.alasan_retur,
          });
          return;
        }
        map.set(variant.kode_barang_variant, {
          kode_barang_variant: variant.kode_barang_variant,
          nama_barang: variant.nama_barang,
          nama_varian: variant.nama_varian,
          barcode_varian: variant.barcode_varian,
          kode_merk: variant.kode_merk,
          nama_merk: variant.nama_merk,
          harga_beli: variant.harga_beli_default,
          stok_saat_ini: stokSaatIni,
          qty: 1,
          alasan_retur: reasonInput.trim(),
        });
      });
      return Array.from(map.values());
    });
    setSelectedVariantKeys({});
    setReasonInput("");
    setVariantModalOpen(false);
  };

  const updateDraftQty = (kodeBarangVariant: string, rawValue: string) => {
    const nextValue = Number(rawValue);
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.kode_barang_variant !== kodeBarangVariant) return item;
        if (!Number.isFinite(nextValue)) return item;
        const maxQty = Math.max(1, Number(item.stok_saat_ini || 1));
        return { ...item, qty: Math.min(Math.max(1, nextValue), maxQty) };
      })
    );
  };

  const updateDraftReason = (kodeBarangVariant: string, value: string) => {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.kode_barang_variant !== kodeBarangVariant) return item;
        return { ...item, alasan_retur: value };
      })
    );
  };

  const updateDraftPrice = (kodeBarangVariant: string, rawValue: string) => {
    const nextValue = Number(rawValue);
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.kode_barang_variant !== kodeBarangVariant) return item;
        if (!Number.isFinite(nextValue) || nextValue < 0) return item;
        return { ...item, harga_beli: nextValue };
      })
    );
  };

  const openVariantModal = () => {
    setError(null);
    setSuccess(null);
    if (!selectedSupplier?.value || !selectedGudang?.value) {
      setError("Pilih supplier dan gudang terlebih dahulu.");
      return;
    }
    setVariantModalOpen(true);
    setVariantSearch("");
  };

  const removeDraftItem = (kodeBarangVariant: string) => {
    setDraftItems((prev) => prev.filter((x) => x.kode_barang_variant !== kodeBarangVariant));
  };

  const grandTotal = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.qty * Number(item.harga_beli || 0), 0),
    [draftItems]
  );
  const isSupplierLocked = Boolean(selectedSupplier && draftItems.length > 0);
  const isGudangLocked = Boolean(selectedGudang && draftItems.length > 0);

  const submitRetur = async () => {
    setError(null);
    setSuccess(null);
    if (!selectedSupplier?.value) {
      setError("Supplier wajib dipilih.");
      return;
    }
    if (!selectedGudang?.value) {
      setError("Gudang wajib dipilih.");
      return;
    }
    if (!draftItems.length) {
      setError("Tambahkan minimal 1 item retur.");
      return;
    }

    setSaving(true);
    try {
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

      const payload = {
        kode_supplier: selectedSupplier.value,
        nama_supplier: selectedSupplier.nama || selectedSupplier.label,
        kode_gudang: selectedGudang.value,
        catatan: catatan.trim() || null,
        status_retur: "Draft",
        created_by: createdBy,
        items: draftItems.map((item) => ({
          kode_barang_variant: item.kode_barang_variant,
          nama_barang: item.nama_barang,
          nama_varian: item.nama_varian,
          barcode_varian: item.barcode_varian || null,
          harga_beli: Number(item.harga_beli || 0),
          qty: Number(item.qty || 0),
          alasan_retur: item.alasan_retur || null,
        })),
      };

      const res = await fetch(`${API_BASE}/retur-supplier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      const kode = String(data?.kode_t_retur_supplier || "").trim();
      setSuccess(kode ? `Retur supplier tersimpan: ${kode}` : "Retur supplier tersimpan.");
      setDraftItems([]);
      setCatatan("");
      setSelectedVariantKeys({});
      setReasonInput("");
    } catch (err: any) {
      console.error("Failed submit retur supplier", err);
      setError(err?.message || "Gagal menyimpan retur supplier.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-5 px-1 py-4 sm:px-2 lg:px-2">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tambah Retur Supplier</h1>
          <p className="text-sm text-slate-500">
            Flow: pilih supplier dan gudang, gunakan merk sebagai filter opsional, lalu pilih item barang variant.
          </p>
        </div>
        <Link
          href="/admin/purchasing/retur-supplier"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Supplier
              {isSupplierLocked && <span className="ml-2 text-xs text-amber-600">(Terkunci karena item sudah ditambahkan)</span>}
            </label>
            <Select
              instanceId="retur-supplier-supplier"
              options={supplierOptions}
              value={selectedSupplier}
              onChange={(option: SingleValue<SupplierOption>) => setSelectedSupplier(option || null)}
              isClearable
              isLoading={loadingSupplier}
              isDisabled={isSupplierLocked}
              isSearchable
              placeholder="Cari supplier..."
              classNamePrefix="react-select"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Merk Filter</label>
            <Select
              instanceId="retur-supplier-merk"
              options={merkOptions}
              value={selectedMerk}
              onChange={(option: SingleValue<MerkOption>) => setSelectedMerk(option || null)}
              isClearable
              isLoading={loadingMerk}
              isDisabled={!selectedSupplier}
              isSearchable
              placeholder={selectedSupplier ? "Semua merk supplier" : "Pilih supplier dulu"}
              classNamePrefix="react-select"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-base font-semibold text-slate-900">Draft Item Retur</h2>
        </div>

        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[260px_minmax(0,1fr)_auto]">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Gudang Sumber Retur
              {isGudangLocked && <span className="ml-2 text-xs text-amber-600">(Terkunci karena item sudah ditambahkan)</span>}
            </label>
            <Select
              instanceId="retur-supplier-gudang"
              options={gudangOptions}
              value={selectedGudang}
              onChange={(option: SingleValue<GudangOption>) => setSelectedGudang(option || null)}
              isClearable
              isLoading={loadingGudang}
              isDisabled={isGudangLocked}
              isSearchable
              placeholder="Cari gudang..."
              classNamePrefix="react-select"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Barang Retur</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Data barang selalu dibatasi oleh supplier dan gudang. Merk hanya filter, boleh diganti untuk tambah merk lain.
            </div>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={openVariantModal}
              disabled={!selectedSupplier || !selectedGudang}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Tambah Barang
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Kode Barang Variant</th>
                <th className="px-3 py-2 font-medium">Merk</th>
                <th className="px-3 py-2 font-medium">Nama Barang</th>
                <th className="px-3 py-2 font-medium">Nama Varian</th>
                <th className="px-3 py-2 text-right font-medium">Stok</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Harga Beli</th>
                <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                <th className="px-3 py-2 font-medium">Alasan</th>
                <th className="px-3 py-2 text-center font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {draftItems.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                    Belum ada item retur.
                  </td>
                </tr>
              )}
              {draftItems.map((item) => (
                <tr key={item.kode_barang_variant}>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.kode_barang_variant}</td>
                  <td className="px-3 py-2 text-slate-700">{item.nama_merk || item.kode_merk || "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{item.nama_barang || "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{item.nama_varian || "-"}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{item.stok_saat_ini}</td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    <input
                      type="number"
                      min={1}
                      max={item.stok_saat_ini}
                      value={item.qty}
                      onChange={(event) => updateDraftQty(item.kode_barang_variant, event.target.value)}
                      className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-cyan-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    <input
                      type="number"
                      min={0}
                      value={item.harga_beli}
                      onChange={(event) => updateDraftPrice(item.kode_barang_variant, event.target.value)}
                      className="h-8 w-28 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-cyan-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">
                    {formatIDR(Number(item.harga_beli || 0) * Number(item.qty || 0))}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    <input
                      value={item.alasan_retur}
                      onChange={(event) => updateDraftReason(item.kode_barang_variant, event.target.value)}
                      placeholder="Alasan"
                      className="h-8 w-52 rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-cyan-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeDraftItem(item.kode_barang_variant)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                      aria-label={`Hapus ${item.kode_barang_variant}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 border-t border-slate-200 p-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Catatan Retur</span>
            <textarea
              rows={2}
              value={catatan}
              onChange={(event) => setCatatan(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-700">
              Total Nominal Retur: <span className="font-semibold text-slate-900">{formatIDR(grandTotal)}</span>
            </p>
            <button
              type="button"
              onClick={submitRetur}
              disabled={saving}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Menyimpan..." : "Simpan Retur"}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-700">{success}</p>}
        </div>
      </section>

      {variantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[86vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Pilih Barang Retur</h3>
                <p className="text-sm text-slate-500">
                  {selectedSupplier?.nama || selectedSupplier?.label || "-"} / {selectedMerk?.nama || "Semua merk"} /{" "}
                  {selectedGudang?.nama || selectedGudang?.label || "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVariantModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-3 border-b border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,360px)]">
                <input
                  value={variantSearch}
                  onChange={(event) => setVariantSearch(event.target.value)}
                  placeholder="Cari nama barang, varian, barcode, atau kode..."
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500"
                />
                <input
                  value={reasonInput}
                  onChange={(event) => setReasonInput(event.target.value)}
                  placeholder="Alasan retur untuk barang terpilih (opsional)"
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <label className="inline-flex items-center gap-2 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => toggleAllVisibleVariants(event.target.checked)}
                    disabled={selectableVariants.length === 0}
                  />
                  Pilih semua yang tampil
                </label>
                <span className="text-slate-500">
                  Terpilih {selectedVariantList.length} dari {selectableVariants.length} barang stok tersedia
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-center font-medium">Pilih</th>
                    <th className="px-3 py-2 font-medium">Kode</th>
                    <th className="px-3 py-2 font-medium">Merk</th>
                    <th className="px-3 py-2 font-medium">Barang</th>
                    <th className="px-3 py-2 font-medium">Varian</th>
                    <th className="px-3 py-2 font-medium">Barcode</th>
                    <th className="px-3 py-2 text-right font-medium">Stok</th>
                    <th className="px-3 py-2 text-right font-medium">Harga Beli</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingVariant && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                        Memuat barang...
                      </td>
                    </tr>
                  )}
                  {!loadingVariant && variantOptions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                        Tidak ada barang untuk supplier, filter merk, dan gudang yang dipilih.
                      </td>
                    </tr>
                  )}
                  {!loadingVariant &&
                    variantOptions.map((item) => {
                      const stock = Number(item.stok_saat_ini || 0);
                      const disabled = stock <= 0;
                      const checked = Boolean(selectedVariantKeys[item.kode_barang_variant]);
                      return (
                        <tr key={item.kode_barang_variant} className={disabled ? "bg-slate-50 text-slate-400" : ""}>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={(event) => toggleVariant(item.kode_barang_variant, event.target.checked)}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{item.kode_barang_variant}</td>
                          <td className="px-3 py-2">{item.nama_merk || item.kode_merk || "-"}</td>
                          <td className="px-3 py-2">{item.nama_barang || "-"}</td>
                          <td className="px-3 py-2">{item.nama_varian || "-"}</td>
                          <td className="px-3 py-2">{item.barcode_varian || "-"}</td>
                          <td className="px-3 py-2 text-right">{stock}</td>
                          <td className="px-3 py-2 text-right">{formatIDR(Number(item.harga_beli_default || 0))}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4">
              <p className="text-sm text-slate-500">
                Item yang sudah ada di draft akan ditambah qty 1, maksimal sesuai stok.
              </p>
              <button
                type="button"
                onClick={addSelectedItemsToDraft}
                disabled={selectedVariantList.length === 0}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Tambahkan {selectedVariantList.length || ""} Barang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
