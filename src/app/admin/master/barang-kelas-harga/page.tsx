"use client";

import { useEffect, useMemo, useState } from "react";
import { ReceiptText, Plus, X, ShieldCheck } from "lucide-react";

type BarangOption = { id_barang: number; kode_barang: string; nama: string };
type KelasOption = { id_kelas_harga: number; kode_kelas_harga: string; nama: string };

type BarangKelasHarga = {
  id: number;
  id_barang: number;
  id_kelas_harga: number;
  harga_1: number;
  harga_3: number;
  harga_6: number;
  harga_12: number;
  berlaku_mulai: string;
  berlaku_sampai: string | null;
  is_active: number | boolean;
  nama_barang?: string;
  kode_barang?: string;
  nama_kelas?: string;
  kode_kelas_harga?: string;
  channel_code?: string;
};

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "/api"}`;
const API_URL = `${API_BASE}/barang-harga-jual`;

const emptyForm: BarangKelasHarga = {
  id: 0,
  id_barang: 0,
  id_kelas_harga: 0,
  harga_1: 0,
  harga_3: 0,
  harga_6: 0,
  harga_12: 0,
  berlaku_mulai: "",
  berlaku_sampai: "",
  is_active: 1,
};

export default function BarangKelasHargaPage() {
  const [items, setItems] = useState<BarangKelasHarga[]>([]);
  const [form, setForm] = useState<BarangKelasHarga>(emptyForm);
  const [openForm, setOpenForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [barangOptions, setBarangOptions] = useState<BarangOption[]>([]);
  const [kelasOptions, setKelasOptions] = useState<KelasOption[]>([]);
  const [search, setSearch] = useState("");

  const fetchOptions = async () => {
    try {
      const [barangRes, kelasRes] = await Promise.all([
        fetch(`${API_BASE}/barang`),
        fetch(`${API_BASE}/kelas-harga`),
      ]);
      const barangJson = barangRes.ok ? await barangRes.json() : [];
      const kelasJson = kelasRes.ok ? await kelasRes.json() : [];
      setBarangOptions(
        Array.isArray(barangJson)
          ? barangJson.map((b) => ({ id_barang: b.id_barang, kode_barang: b.kode_barang, nama: b.nama }))
          : []
      );
      setKelasOptions(
        Array.isArray(kelasJson)
          ? kelasJson.map((k) => ({
              id_kelas_harga: k.id_kelas_harga,
              kode_kelas_harga: k.kode_kelas_harga,
              nama: k.nama,
            }))
          : []
      );
    } catch (err) {
      console.error("Failed fetch options", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? (data as BarangKelasHarga[]) : []);
    } catch (err) {
      console.error("Failed fetch barang kelas harga", err);
      setError("Gagal memuat data.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
    fetchData();
  }, []);

  const handleChange = (field: keyof BarangKelasHarga, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value as any }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id_barang: Number(form.id_barang),
        id_kelas_harga: Number(form.id_kelas_harga),
        harga_1: Number(form.harga_1 || 0),
        harga_3: Number(form.harga_3 || 0),
        harga_6: Number(form.harga_6 || 0),
        harga_12: Number(form.harga_12 || 0),
        berlaku_mulai: form.berlaku_mulai,
        berlaku_sampai: form.berlaku_sampai || null,
        is_active: Number(form.is_active) ?? 1,
      };

      const res = await fetch(editingId ? `${API_URL}/${editingId}` : API_URL, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Gagal menyimpan");
      }

      await fetchData();
      setForm(emptyForm);
      setEditingId(null);
      setOpenForm(false);
    } catch (err) {
      console.error("Failed save", err);
      setError(err instanceof Error ? err.message : "Gagal terhubung ke server.");
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    const keyword = search.toLowerCase();
    return items.filter((item) => {
      const text = `${item.nama_barang ?? ""} ${item.kode_barang ?? ""} ${item.nama_kelas ?? ""} ${item.kode_kelas_harga ?? ""} ${
        item.channel_code ?? ""
      }`.toLowerCase();
      return text.includes(keyword);
    });
  }, [items, search]);

  const barangLabel = (id: number) => {
    const found = barangOptions.find((b) => b.id_barang === id);
    return found ? `${found.kode_barang} - ${found.nama}` : `#${id}`;
  };
  const kelasLabel = (id: number) => {
    const found = kelasOptions.find((k) => k.id_kelas_harga === id);
    return found ? `${found.kode_kelas_harga} - ${found.nama}` : `#${id}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Harga Barang per Kelas</h1>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setOpenForm(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Tambah Harga
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <ReceiptText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Listing Harga Barang</p>
              <p className="text-base font-semibold text-gray-800">Total {items.length} entri</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="w-4 h-4" />
            {loading ? "Memuat..." : "Sinkron server"}
          </div>
        </div>

        {error && (
          <div className="bg-amber-50 border-b border-amber-100 text-amber-800 text-sm px-4 py-3">
            {error}
          </div>
        )}

        <div className="px-4 py-3 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari barang / kelas"
            className="w-full md:w-80 rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none"
          />
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-3">Barang</th>
                <th className="px-4 py-3">Kelas / Channel</th>
                <th className="px-4 py-3">Harga 1/3/6/12</th>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredItems.length === 0 && !loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={6}>
                    Belum ada data.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{barangLabel(item.id_barang)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{kelasLabel(item.id_kelas_harga)}</div>
                      <div className="text-xs text-gray-500">Channel: {item.channel_code || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800 font-semibold">
                        {formatCurrency(item.harga_1)} / {formatCurrency(item.harga_3)} / {formatCurrency(item.harga_6)} /{" "}
                        {formatCurrency(item.harga_12)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(item.berlaku_mulai)}
                      <div className="text-xs text-gray-500">
                        s/d {item.berlaku_sampai ? formatDate(item.berlaku_sampai) : "∞"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
                          (item.is_active ? 1 : 0) === 1
                            ? "bg-[#3FE0D0]/15 text-[#0f756b] border-[#3FE0D0]/30"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {(item.is_active ? 1 : 0) === 1 ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setForm({
                            ...item,
                            is_active: item.is_active ? 1 : 0,
                            berlaku_sampai: item.berlaku_sampai || "",
                          });
                          setOpenForm(true);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-[#0f756b] border border-[#3FE0D0]/50 rounded-full hover:bg-[#3FE0D0]/10"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpenForm(false)} />
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{editingId ? "Edit Harga" : "Tambah Harga"}</p>
                <h2 className="text-xl font-bold text-gray-900">Input Harga Barang per Kelas</h2>
              </div>
              <button
                onClick={() => setOpenForm(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Tutup"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid md:grid-cols-2 gap-4">
                <Select
                  label="Barang"
                  value={form.id_barang ? String(form.id_barang) : ""}
                  onChange={(v) => handleChange("id_barang", Number(v))}
                  options={barangOptions.map((b) => ({
                    label: `${b.kode_barang} - ${b.nama}`,
                    value: String(b.id_barang),
                  }))}
                  required
                />
                <Select
                  label="Kelas Harga"
                  value={form.id_kelas_harga ? String(form.id_kelas_harga) : ""}
                  onChange={(v) => handleChange("id_kelas_harga", Number(v))}
                  options={kelasOptions.map((k) => ({
                    label: `${k.kode_kelas_harga} - ${k.nama}`,
                    value: String(k.id_kelas_harga),
                  }))}
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <InputNumber label="Harga Qty 1" value={form.harga_1} onChange={(v) => handleChange("harga_1", v)} />
                <InputNumber label="Harga Qty 3" value={form.harga_3} onChange={(v) => handleChange("harga_3", v)} />
                <InputNumber label="Harga Qty 6" value={form.harga_6} onChange={(v) => handleChange("harga_6", v)} />
                <InputNumber label="Harga Qty 12" value={form.harga_12} onChange={(v) => handleChange("harga_12", v)} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Berlaku Mulai"
                  type="date"
                  value={form.berlaku_mulai ? form.berlaku_mulai.slice(0, 10) : ""}
                  onChange={(v) => handleChange("berlaku_mulai", v)}
                  required
                />
                <Input
                  label="Berlaku Sampai"
                  type="date"
                  value={form.berlaku_sampai ? form.berlaku_sampai.slice(0, 10) : ""}
                  onChange={(v) => handleChange("berlaku_sampai", v)}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Select
                  label="Status"
                  value={(form.is_active ? 1 : 0).toString()}
                  onChange={(v) => handleChange("is_active", Number(v))}
                  options={[
                    { label: "Aktif", value: "1" },
                    { label: "Nonaktif", value: "0" },
                  ]}
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpenForm(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none transition-colors"
      />
    </label>
  );
}

function InputNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <input
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        type="number"
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none transition-colors"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none transition-colors bg-white"
      >
        <option value="">- pilih -</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID");
}

function formatCurrency(value: number) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("id-ID").format(value);
}
