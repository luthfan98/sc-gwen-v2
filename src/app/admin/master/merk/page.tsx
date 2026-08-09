"use client";

import { useEffect, useMemo, useState } from "react";
import { Tag, Plus, Image as ImageIcon, ArrowUpDown, ShieldCheck, Download } from "lucide-react";

type Merk = {
  id_merk: number;
  nama_merk: string;
  logo_merk: string;
  prioritas: number | null;
  status: number;
  total_barang?: number;
  created_at: string;
  updated_at: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const MERK_URL = `${API_BASE}/merk`;
const MERK_UPLOAD_URL = `${MERK_URL}/upload-logo`;

export default function MasterMerkPage() {
  const [items, setItems] = useState<Merk[]>([]);
  const [form, setForm] = useState<Partial<Merk>>({
    nama_merk: "",
    logo_merk: "",
    prioritas: null,
    status: 1,
  });
  const [openForm, setOpenForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [sortByName, setSortByName] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleExport = () => {
    const headers = ["Nama Merk", "Logo", "Prioritas", "Created At", "Updated At"];
    const rows = items.map((item) => [
      item.nama_merk || "",
      item.logo_merk || "",
      item.prioritas === null || typeof item.prioritas === "undefined" ? "" : String(item.prioritas),
      item.created_at || "",
      item.updated_at || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? "");
            const escaped = value.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    a.href = url;
    a.download = `master-merk-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${MERK_URL}?include_inactive=1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(
          data.map((row: any) => ({
            ...row,
            status: row.status === false || row.status === 0 ? 0 : 1,
            total_barang: Number(row.total_barang ?? 0),
          }))
        );
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error("Failed fetch merk", err);
      setError("Gagal memuat merk dari server.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortByName) {
        const cmp = (a.nama_merk || "").localeCompare(b.nama_merk || "", "id");
        return sortAsc ? cmp : -cmp;
      }
      const pa = a.prioritas ?? Number.MAX_SAFE_INTEGER;
      const pb = b.prioritas ?? Number.MAX_SAFE_INTEGER;
      return sortAsc ? pa - pb : pb - pa;
    });
  }, [items, sortAsc, sortByName]);

  const handleChange = (field: keyof Merk, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value as any }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editingId ? `${MERK_URL}/${editingId}` : MERK_URL, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          prioritas: form.prioritas ?? null,
        }),
      });
      if (res.ok) {
        await fetchData();
        setForm({ nama_merk: "", logo_merk: "", prioritas: null, status: 1 });
        setEditingId(null);
        setOpenForm(false);
      } else {
        const msg = await res.text();
        setError(msg || "Gagal menyimpan merk.");
      }
    } catch (err) {
      console.error("Failed create merk", err);
      setError("Gagal terhubung ke server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Merk</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
          >
            <Download className="w-5 h-5" />
            Export Excel
          </button>
          <button
            onClick={() => setOpenForm(true)}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Tambah Merk
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Merk</p>
              <p className="text-base font-semibold text-gray-800">Kelola brand produk</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="w-4 h-4" />
            {loading ? "Memuat..." : "Sinkron server"}
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 text-sm text-amber-800 bg-amber-50 border-b border-amber-100">
            {error}
          </div>
        )}

        <div className="overflow-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSortByName(true);
                      setSortAsc((v) => (sortByName ? !v : true));
                    }}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700"
                  >
                    Nama Merk <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3">Logo</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSortByName(false);
                      setSortAsc((v) => (sortByName ? true : !v));
                    }}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700"
                  >
                    Prioritas <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3">Total Barang</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Dibuat</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {sortedItems.length === 0 && !loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                    Belum ada data merk.
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => (
                  <tr key={item.id_merk} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{item.nama_merk}</td>
                    <td className="px-4 py-3">
                      {item.logo_merk ? (
                        <button
                          type="button"
                          onClick={() => setPreviewUrl(item.logo_merk)}
                          className="h-10 w-10 rounded-lg border border-gray-100 overflow-hidden"
                        >
                          <img
                            src={item.logo_merk}
                            alt={item.nama_merk}
                            className="h-full w-full object-contain"
                          />
                        </button>
                      ) : (
                        <div className="h-10 w-10 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{item.prioritas ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-700">{item.total_barang ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${
                        item.status === 1 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}>
                        {item.status === 1 ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(item.created_at)}
                      <div className="text-xs text-gray-500">Updated: {formatDate(item.updated_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id_merk);
                          setForm({
                            nama_merk: item.nama_merk,
                            logo_merk: item.logo_merk,
                            prioritas: item.prioritas,
                            status: item.status ?? 1,
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
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tambah Merk</p>
                <h2 className="text-xl font-bold text-gray-900">Input Data Merk</h2>
              </div>
              <button
                onClick={() => setOpenForm(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Tutup"
              >
                <Plus className="w-5 h-5 text-gray-600 rotate-45" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Nama Merk"
                value={form.nama_merk ?? ""}
                onChange={(v) => handleChange("nama_merk", v)}
                placeholder="Nama merk"
                required
              />
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-700">Logo Merk</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      setError(null);
                      try {
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await fetch(MERK_UPLOAD_URL, {
                          method: "POST",
                          body: fd,
                        });
                        if (!res.ok) throw new Error(await res.text());
                        const data = await res.json();
                        setForm((prev) => ({ ...prev, logo_merk: data.url }));
                      } catch (err: any) {
                        console.error("Upload logo failed", err);
                        setError("Upload logo gagal. Pastikan file gambar valid.");
                      } finally {
                        setUploading(false);
                      }
                    }}
                    className="w-full text-sm text-gray-700"
                  />
                  {uploading && <span className="text-xs text-gray-500">Mengunggah...</span>}
                </div>
                {form.logo_merk && (
                  <div className="flex items-center gap-2">
                    <img src={form.logo_merk} alt="Preview logo" className="h-12 w-12 object-contain rounded-lg border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(form.logo_merk || null)}
                      className="text-xs text-[#0f756b] underline"
                    >
                      Lihat besar
                    </button>
                  </div>
                )}
              </div>
              <Select
                label="Prioritas"
                value={form.prioritas === null || typeof form.prioritas === "undefined" ? "" : String(form.prioritas)}
                onChange={(val) => handleChange("prioritas", val === "" ? null : Number(val))}
                options={[
                  { label: "Pilih prioritas", value: "" },
                  { label: "1", value: "1" },
                  { label: "2", value: "2" },
                  { label: "3", value: "3" },
                ]}
              />
              <Select
                label="Status"
                value={String(form.status ?? 1)}
                onChange={(val) => handleChange("status", Number(val))}
                options={[
                  { label: "Aktif", value: "1" },
                  { label: "Nonaktif", value: "0" },
                ]}
              />
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

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-3 -right-3 bg-white rounded-full shadow p-2 hover:bg-gray-100"
              aria-label="Tutup preview"
            >
              ×
            </button>
            <img src={previewUrl} alt="Preview logo" className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl bg-white" />
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
  value: string | number;
  onChange: (val: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <input
        value={value ?? ""}
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
