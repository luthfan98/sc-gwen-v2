"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgePercent, Plus, X, ShieldCheck } from "lucide-react";

type Channel = { id_channel: number; kode_channel: string; nama: string };
type Kelas = { id_kelas_harga: number; kode_kelas_harga: string; nama: string };

type PricingRule = {
  id: number;
  id_kelas_harga: number;
  id_channel: number;
  base_tier: number;
  fee_pct: number;
  markup_pct: number;
  fixed_fee: number;
  rounding_mode: string;
  rounding_step: number;
  berlaku_mulai: string;
  berlaku_sampai: string | null;
  is_active: number | boolean;
  nama_kelas?: string;
  kode_kelas_harga?: string;
  nama_channel?: string;
  kode_channel?: string;
};

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "/api"}`;
const API_URL = `${API_BASE}/channel-pricing-rule`;

const emptyForm: PricingRule = {
  id: 0,
  id_kelas_harga: 0,
  id_channel: 0,
  base_tier: 1,
  fee_pct: 0,
  markup_pct: 0,
  fixed_fee: 0,
  rounding_mode: "CEIL",
  rounding_step: 1,
  berlaku_mulai: "",
  berlaku_sampai: "",
  is_active: 1,
};

export default function ChannelPricingRulePage() {
  const [items, setItems] = useState<PricingRule[]>([]);
  const [form, setForm] = useState<PricingRule>(emptyForm);
  const [openForm, setOpenForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [kelasOptions, setKelasOptions] = useState<Kelas[]>([]);
  const [channelOptions, setChannelOptions] = useState<Channel[]>([]);
  const [search, setSearch] = useState("");

  const fetchOptions = async () => {
    try {
      const [kelasRes, channelRes] = await Promise.all([
        fetch(`${API_BASE}/kelas-harga`),
        fetch(`${API_BASE}/channel`),
      ]);
      const kelasJson = kelasRes.ok ? await kelasRes.json() : [];
      const channelJson = channelRes.ok ? await channelRes.json() : [];
      setKelasOptions(
        Array.isArray(kelasJson)
          ? kelasJson.map((k) => ({
              id_kelas_harga: k.id_kelas_harga,
              kode_kelas_harga: k.kode_kelas_harga,
              nama: k.nama,
            }))
          : []
      );
      setChannelOptions(
        Array.isArray(channelJson)
          ? channelJson.map((c) => ({
              id_channel: c.id_channel,
              kode_channel: c.kode_channel,
              nama: c.nama,
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
      setItems(Array.isArray(data) ? (data as PricingRule[]) : []);
    } catch (err) {
      console.error("Failed fetch pricing rules", err);
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

  const handleChange = (field: keyof PricingRule, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value as any }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id_kelas_harga: Number(form.id_kelas_harga),
        id_channel: Number(form.id_channel),
        base_tier: Number(form.base_tier || 1),
        fee_pct: Number(form.fee_pct || 0),
        markup_pct: Number(form.markup_pct || 0),
        fixed_fee: Number(form.fixed_fee || 0),
        rounding_mode: form.rounding_mode || "CEIL",
        rounding_step: Number(form.rounding_step || 1),
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
        throw new Error(msg || "Gagal menyimpan aturan");
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
      const text = `${item.kode_kelas_harga ?? ""} ${item.nama_kelas ?? ""} ${item.kode_channel ?? ""} ${
        item.nama_channel ?? ""
      }`.toLowerCase();
      return text.includes(keyword);
    });
  }, [items, search]);

  const kelasLabel = (id: number) => {
    const found = kelasOptions.find((k) => k.id_kelas_harga === id);
    return found ? `${found.kode_kelas_harga} - ${found.nama}` : `#${id}`;
  };
  const channelLabel = (id: number) => {
    const found = channelOptions.find((c) => c.id_channel === id);
    return found ? `${found.kode_channel} - ${found.nama}` : `#${id}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Channel Pricing Rule</h1>
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
          Tambah Rule
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <BadgePercent className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Aturan Harga per Channel</p>
              <p className="text-base font-semibold text-gray-800">Total {items.length} rule</p>
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
            placeholder="Cari kelas / channel"
            className="w-full md:w-80 rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none"
          />
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Fee / Markup / Fixed</th>
                <th className="px-4 py-3">Rounding</th>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredItems.length === 0 && !loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                    Belum ada data.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{kelasLabel(item.id_kelas_harga)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{channelLabel(item.id_channel)}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {formatPct(item.fee_pct)} / {formatPct(item.markup_pct)} / {formatCurrency(item.fixed_fee)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {item.rounding_mode} @ {item.rounding_step}
                      <div className="text-xs text-gray-500">Base tier: {item.base_tier}</div>
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
                <p className="text-sm text-gray-500">{editingId ? "Edit Rule" : "Tambah Rule"}</p>
                <h2 className="text-xl font-bold text-gray-900">Aturan Harga Channel</h2>
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
                  label="Kelas Harga"
                  value={form.id_kelas_harga ? String(form.id_kelas_harga) : ""}
                  onChange={(v) => handleChange("id_kelas_harga", Number(v))}
                  options={kelasOptions.map((k) => ({
                    label: `${k.kode_kelas_harga} - ${k.nama}`,
                    value: String(k.id_kelas_harga),
                  }))}
                  required
                />
                <Select
                  label="Channel"
                  value={form.id_channel ? String(form.id_channel) : ""}
                  onChange={(v) => handleChange("id_channel", Number(v))}
                  options={channelOptions.map((c) => ({
                    label: `${c.kode_channel} - ${c.nama}`,
                    value: String(c.id_channel),
                  }))}
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <InputNumber label="Base Tier (1/3/6/12)" value={form.base_tier} onChange={(v) => handleChange("base_tier", v)} />
                <InputNumber label="Fee (%)" value={form.fee_pct} onChange={(v) => handleChange("fee_pct", v)} step="0.0001" />
                <InputNumber label="Markup (%)" value={form.markup_pct} onChange={(v) => handleChange("markup_pct", v)} step="0.0001" />
                <InputNumber label="Fixed Fee" value={form.fixed_fee} onChange={(v) => handleChange("fixed_fee", v)} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Select
                  label="Rounding Mode"
                  value={form.rounding_mode}
                  onChange={(v) => handleChange("rounding_mode", v)}
                  options={[
                    { label: "CEIL", value: "CEIL" },
                    { label: "FLOOR", value: "FLOOR" },
                    { label: "ROUND", value: "ROUND" },
                  ]}
                />
                <InputNumber
                  label="Rounding Step"
                  value={form.rounding_step}
                  onChange={(v) => handleChange("rounding_step", v)}
                />
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
  step,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <input
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        type="number"
        step={step}
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

function formatPct(value: number) {
  if (value === null || value === undefined) return "-";
  return `${value}%`;
}
