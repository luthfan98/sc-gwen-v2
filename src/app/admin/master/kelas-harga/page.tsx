"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X, Tags, ShieldCheck, NotebookPen } from "lucide-react";

type Margin = {
  base_source: string;
  m1_type: string;
  m1_value: number;
  m3_type: string;
  m3_value: number;
  m6_type: string;
  m6_value: number;
  m12_type: string;
  m12_value: number;
  rounding_mode: string;
  rounding_step: number;
  is_active: number | boolean;
};

type KelasHarga = {
  id_kelas_harga: number;
  kode_kelas_harga: string;
  channel_code: string;
  nama: string;
  catatan: string;
  is_active: number | boolean;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  margin?: Margin | null;
};

const DEFAULT_CREATED_BY = process.env.NEXT_PUBLIC_CREATED_BY ?? "admin";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const API_URL = `${API_BASE}/kelas-harga`;

const emptyMargin: Margin = {
  base_source: "HPP",
  m1_type: "PCT",
  m1_value: 0,
  m3_type: "PCT",
  m3_value: 0,
  m6_type: "PCT",
  m6_value: 0,
  m12_type: "PCT",
  m12_value: 0,
  rounding_mode: "NONE",
  rounding_step: 1,
  is_active: 1,
};

const emptyKelas: KelasHarga = {
  id_kelas_harga: 0,
  kode_kelas_harga: "",
  channel_code: "",
  nama: "",
  catatan: "",
  is_active: 1,
  created_by: DEFAULT_CREATED_BY,
  created_at: "",
  updated_by: DEFAULT_CREATED_BY,
  updated_at: "",
  margin: emptyMargin,
};

export default function MasterKelasHargaPage() {
  const [items, setItems] = useState<KelasHarga[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<KelasHarga>(emptyKelas);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("semua");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(
        Array.isArray(data)
          ? (data as KelasHarga[]).map((d) => ({
              ...d,
              margin: d.margin || { ...emptyMargin },
            }))
          : []
      );
    } catch (err) {
      console.error("Failed fetch kelas harga", err);
      setError("Gagal memuat kelas harga dari server.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = search.toLowerCase();
    return items.filter((item) => {
      const textMatch = `${item.nama} ${item.kode_kelas_harga} ${item.channel_code}`.toLowerCase().includes(keyword);
      const statusVal = item.is_active ? 1 : 0;
      const statusMatch =
        statusFilter === "semua" ||
        (statusFilter === "aktif" && statusVal === 1) ||
        (statusFilter === "nonaktif" && statusVal === 0);
      return textMatch && statusMatch;
    });
  }, [items, search, statusFilter]);

  const handleChange = (field: keyof KelasHarga, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value as any }));
  };

  const handleMarginChange = (field: keyof Margin, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      margin: { ...(prev.margin || { ...emptyMargin }), [field]: value } as Margin,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const now = new Date().toISOString();
    const payload: Partial<KelasHarga> & { margin?: Margin } = {
      ...form,
      kode_kelas_harga: form.kode_kelas_harga?.trim(),
      channel_code: form.channel_code.trim().toUpperCase(),
      nama: form.nama.trim(),
      catatan: form.catatan?.trim(),
      is_active: Number(form.is_active) ?? 1,
      created_by: form.created_by || DEFAULT_CREATED_BY,
      created_at: form.created_at || now,
      updated_by: form.updated_by || form.created_by || DEFAULT_CREATED_BY,
      updated_at: now,
      margin: form.margin
        ? {
            ...form.margin,
            base_source: form.margin.base_source?.trim().toUpperCase(),
            m1_type: form.margin.m1_type?.trim().toUpperCase(),
            m3_type: form.margin.m3_type?.trim().toUpperCase(),
            m6_type: form.margin.m6_type?.trim().toUpperCase(),
            m12_type: form.margin.m12_type?.trim().toUpperCase(),
            rounding_mode: form.margin.rounding_mode?.trim().toUpperCase(),
            rounding_step: Number(form.margin.rounding_step || 1),
            is_active: Number(form.margin.is_active ?? 1),
          }
        : undefined,
    };

    try {
      const res = await fetch(editingId ? `${API_URL}/${editingId}` : API_URL, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Gagal menyimpan kelas harga");
      }

      await fetchData();
      setForm(emptyKelas);
      setEditingId(null);
      setOpenForm(false);
    } catch (err) {
      console.error("Failed save kelas harga", err);
      setError(err instanceof Error ? err.message : "Gagal terhubung ke server.");
    } finally {
      setSaving(false);
    }
  };

  const totalAktif = items.filter((item) => (item.is_active ? 1 : 0) === 1).length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Kelas Harga</h1>
        </div>
        <button
          onClick={() => {
            setForm(emptyKelas);
            setEditingId(null);
            setOpenForm(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Tambah Kelas
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <Tags className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Kelas Harga</p>
              <p className="text-base font-semibold text-gray-800">Total {items.length} kelas</p>
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
            <NotebookPen className="w-4 h-4 text-gray-400" />
            Filter
          </div>
          <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto">
            <div className="flex-1 min-w-[200px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode / nama / channel"
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none"
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
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama & Channel</th>
                <th className="px-4 py-3">Margin</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredItems.length === 0 && !loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={6}>
                    Belum ada data kelas harga.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id_kelas_harga} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{item.kode_kelas_harga}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.nama || "-"}</div>
                      <div className="text-xs text-gray-500">Channel: {item.channel_code}</div>
                      <div className="text-xs text-gray-500">{item.catatan || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {item.margin ? (
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500">Base: {item.margin.base_source}</div>
                          <div className="text-xs">
                            1:{item.margin.m1_type}-{item.margin.m1_value} | 3:{item.margin.m3_type}-{item.margin.m3_value} | 6:
                            {item.margin.m6_type}-{item.margin.m6_value} | 12:{item.margin.m12_type}-{item.margin.m12_value}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Rounding: {item.margin.rounding_mode} @ {item.margin.rounding_step}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
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
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(item.updated_at)}
                      <div className="text-xs text-gray-500">By {item.updated_by || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id_kelas_harga);
                          setForm({
                            ...form,
                            ...item,
                            is_active: item.is_active ? 1 : 0,
                            margin: item.margin || { ...emptyMargin },
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
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{editingId ? "Edit Kelas Harga" : "Tambah Kelas Harga"}</p>
                <h2 className="text-xl font-bold text-gray-900">Input Data Kelas</h2>
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
                <Input
                  label="Kode Kelas Harga"
                  value={form.kode_kelas_harga}
                  onChange={(v) => handleChange("kode_kelas_harga", v)}
                  placeholder="Auto jika dikosongkan"
                />
                <Input
                  label="Nama Kelas"
                  value={form.nama}
                  onChange={(v) => handleChange("nama", v)}
                  placeholder="Nama kelas"
                  required
                />
                <Input
                  label="Channel Code"
                  value={form.channel_code}
                  onChange={(v) => handleChange("channel_code", v)}
                  placeholder="OFFLINE / GWEN_APP / SHOPEE / TIKTOKSHOP"
                  required
                />
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

              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Catatan"
                  value={form.catatan}
                  onChange={(v) => handleChange("catatan", v)}
                  placeholder="Catatan internal"
                />
              </div>

              <div className="border border-gray-100 rounded-xl p-4 space-y-4">
                <p className="text-sm font-semibold text-gray-800">Margin Kelas (m1/m3/m6/m12)</p>
                <div className="grid md:grid-cols-3 gap-4">
                  <Select
                    label="Base Source"
                    value={form.margin?.base_source || "HPP"}
                    onChange={(v) => handleMarginChange("base_source", v)}
                    options={[
                      { label: "HPP", value: "HPP" },
                      { label: "BELI", value: "BELI" },
                    ]}
                  />
                  <Select
                    label="Rounding Mode"
                    value={form.margin?.rounding_mode || "NONE"}
                    onChange={(v) => handleMarginChange("rounding_mode", v)}
                    options={[
                      { label: "NONE", value: "NONE" },
                      { label: "CEIL", value: "CEIL" },
                      { label: "FLOOR", value: "FLOOR" },
                      { label: "ROUND", value: "ROUND" },
                    ]}
                  />
                  <Input
                    label="Rounding Step"
                    value={String(form.margin?.rounding_step ?? 1)}
                    onChange={(v) => handleMarginChange("rounding_step", Number(v) || 1)}
                    type="number"
                  />
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MarginInput
                    label="M1"
                    typeValue={form.margin?.m1_type || "PCT"}
                    value={form.margin?.m1_value ?? 0}
                    onTypeChange={(v) => handleMarginChange("m1_type", v)}
                    onValueChange={(v) => handleMarginChange("m1_value", v)}
                  />
                  <MarginInput
                    label="M3"
                    typeValue={form.margin?.m3_type || "PCT"}
                    value={form.margin?.m3_value ?? 0}
                    onTypeChange={(v) => handleMarginChange("m3_type", v)}
                    onValueChange={(v) => handleMarginChange("m3_value", v)}
                  />
                  <MarginInput
                    label="M6"
                    typeValue={form.margin?.m6_type || "PCT"}
                    value={form.margin?.m6_value ?? 0}
                    onTypeChange={(v) => handleMarginChange("m6_type", v)}
                    onValueChange={(v) => handleMarginChange("m6_value", v)}
                  />
                  <MarginInput
                    label="M12"
                    typeValue={form.margin?.m12_type || "PCT"}
                    value={form.margin?.m12_value ?? 0}
                    onTypeChange={(v) => handleMarginChange("m12_type", v)}
                    onValueChange={(v) => handleMarginChange("m12_value", v)}
                  />
                </div>
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
                  {saving ? "Menyimpan..." : "Simpan Kelas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MarginInput({
  label,
  typeValue,
  value,
  onTypeChange,
  onValueChange,
}: {
  label: string;
  typeValue: string;
  value: number;
  onTypeChange: (val: string) => void;
  onValueChange: (val: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-semibold text-gray-700">{label}</div>
      <div className="grid grid-cols-5 gap-2">
        <select
          value={typeValue}
          onChange={(e) => onTypeChange(e.target.value)}
          className="col-span-2 rounded-lg border-2 border-gray-200 px-2 py-2 focus:border-[#3FE0D0] focus:outline-none"
        >
          <option value="PCT">PCT</option>
          <option value="NOM">NOM</option>
        </select>
        <input
          value={value ?? ""}
          onChange={(e) => onValueChange(Number(e.target.value) || 0)}
          type="number"
          className="col-span-3 rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-[#3FE0D0] focus:outline-none"
        />
      </div>
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
      {label}
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

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID");
}
