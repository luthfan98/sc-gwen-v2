"use client";

import { useEffect, useState } from "react";
import { Plus, X, Tags, ShieldCheck } from "lucide-react";

type Channel = {
  id_channel: number;
  kode_channel: string;
  nama: string;
  is_marketplace: number | boolean;
  is_active: number | boolean;
};

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "/api"}/channel`;

const emptyChannel: Channel = {
  id_channel: 0,
  kode_channel: "",
  nama: "",
  is_marketplace: 0,
  is_active: 1,
};

export default function MasterChannelPage() {
  const [items, setItems] = useState<Channel[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<Channel>(emptyChannel);
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
      if (Array.isArray(data)) {
        setItems(data as Channel[]);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error("Failed fetch channel", err);
      setError("Gagal memuat channel.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (field: keyof Channel, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value as any }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        kode_channel: form.kode_channel.trim(),
        nama: form.nama.trim(),
        is_marketplace: Number(form.is_marketplace) ?? 0,
        is_active: Number(form.is_active) ?? 1,
      };
      const res = await fetch(editingId ? `${API_URL}/${editingId}` : API_URL, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Gagal menyimpan channel");
      }
      await fetchData();
      setForm(emptyChannel);
      setEditingId(null);
      setOpenForm(false);
    } catch (err) {
      console.error("Failed save channel", err);
      setError(err instanceof Error ? err.message : "Gagal terhubung ke server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Channel</h1>
        </div>
        <button
          onClick={() => {
            setForm(emptyChannel);
            setEditingId(null);
            setOpenForm(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Tambah Channel
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <Tags className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Channel</p>
              <p className="text-base font-semibold text-gray-800">Total {items.length} channel</p>
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

        <div className="overflow-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Marketplace</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {items.map((item) => (
                <tr key={item.id_channel} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{item.kode_channel}</td>
                  <td className="px-4 py-3 text-gray-800">{item.nama}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
                        (item.is_marketplace ? 1 : 0) === 1
                          ? "bg-[#3FE0D0]/15 text-[#0f756b] border-[#3FE0D0]/30"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {(item.is_marketplace ? 1 : 0) === 1 ? "Ya" : "Tidak"}
                    </span>
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
                        setEditingId(item.id_channel);
                        setForm({
                          ...item,
                          is_active: item.is_active ? 1 : 0,
                          is_marketplace: item.is_marketplace ? 1 : 0,
                        });
                        setOpenForm(true);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-[#0f756b] border border-[#3FE0D0]/50 rounded-full hover:bg-[#3FE0D0]/10"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpenForm(false)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{editingId ? "Edit Channel" : "Tambah Channel"}</p>
                <h2 className="text-xl font-bold text-gray-900">Input Data Channel</h2>
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
                  label="Kode Channel"
                  value={form.kode_channel}
                  onChange={(v) => handleChange("kode_channel", v)}
                  placeholder="SHOPEE / GWEN_APP"
                  required
                />
                <Input
                  label="Nama Channel"
                  value={form.nama}
                  onChange={(v) => handleChange("nama", v)}
                  placeholder="Shopee Marketplace"
                  required
                />
                <Select
                  label="Marketplace?"
                  value={(form.is_marketplace ? 1 : 0).toString()}
                  onChange={(v) => handleChange("is_marketplace", Number(v))}
                  options={[
                    { label: "Tidak", value: "0" },
                    { label: "Ya", value: "1" },
                  ]}
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
