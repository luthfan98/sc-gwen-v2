"use client";

import { useEffect, useMemo, useState } from "react";
import { Grid2x2, Plus, Filter, ListTree, ShieldCheck } from "lucide-react";

type Klasifikasi = {
  kode_klasifikasi: string;
  nama: string;
  status: number;
  status_cadangan: number;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  kode_parent: string;
};

const DEFAULT_CREATED_BY = process.env.NEXT_PUBLIC_CREATED_BY ?? "admin";

const emptyKlasifikasi: Klasifikasi = {
  kode_klasifikasi: "",
  nama: "",
  status: 1,
  status_cadangan: 0,
  created_by: DEFAULT_CREATED_BY,
  created_at: "",
  updated_by: DEFAULT_CREATED_BY,
  updated_at: "",
  kode_parent: "",
};

export default function MasterKlasifikasiPage() {
  const [items, setItems] = useState<Klasifikasi[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<Klasifikasi>(emptyKlasifikasi);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("semua");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingKode, setEditingKode] = useState<string | null>(null);

  const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "/api"}/klasifikasi`;

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(data as Klasifikasi[]);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error("Failed fetch klasifikasi", err);
      setError("Gagal memuat klasifikasi dari server.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [API_URL]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchText = `${item.nama} ${item.kode_klasifikasi}`.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "semua" || (statusFilter === "aktif" ? item.status === 1 : item.status === 0);
      return matchText && matchStatus;
    });
  }, [items, search, statusFilter]);

  const orderedWithIndent = useMemo(() => {
    const kodeToNama = new Map<string, string>();
    filteredItems.forEach((item) => kodeToNama.set(item.kode_klasifikasi, item.nama));

    const byParent: Record<string, Klasifikasi[]> = {};
    filteredItems.forEach((item) => {
      const parent = item.kode_parent || "";
      if (!byParent[parent]) byParent[parent] = [];
      byParent[parent].push(item);
    });
    Object.values(byParent).forEach((arr) => arr.sort((a, b) => a.nama.localeCompare(b.nama, "id", { sensitivity: "base" })));

    const result: Array<Klasifikasi & { level: number; parentName: string; isLast: boolean }> = [];
    const visited = new Set<string>();

    const walk = (parentKey: string, level: number) => {
      const children = byParent[parentKey] || [];
      children.forEach((child, idx) => {
        if (visited.has(child.kode_klasifikasi)) return;
        visited.add(child.kode_klasifikasi);
        result.push({
          ...child,
          level,
          parentName: parentKey ? kodeToNama.get(parentKey) ?? "" : "",
          isLast: idx === children.length - 1,
        });
        walk(child.kode_klasifikasi, level + 1);
      });
    };

    const roots = (byParent[""] || []).slice().sort((a, b) => a.nama.localeCompare(b.nama, "id", { sensitivity: "base" }));
    roots.forEach((root, idx) => {
      if (!visited.has(root.kode_klasifikasi)) {
        visited.add(root.kode_klasifikasi);
        result.push({ ...root, level: 0, parentName: "", isLast: idx === roots.length - 1 });
        walk(root.kode_klasifikasi, 1);
      }
    });

    // include any orphans not connected yet, sorted
    filteredItems.forEach((item) => {
      if (!visited.has(item.kode_klasifikasi)) {
        result.push({ ...item, level: 0, parentName: "", isLast: true });
        walk(item.kode_klasifikasi, 1);
      }
    });

    return result;
  }, [filteredItems]);

  const handleChange = (field: keyof Klasifikasi, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value as any }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const now = new Date().toISOString();
    const payload: Klasifikasi = {
      ...form,
      kode_klasifikasi: editingKode ?? form.kode_klasifikasi.trim(),
      created_at: form.created_at || now,
      updated_at: now,
      created_by: form.created_by || DEFAULT_CREATED_BY,
      updated_by: form.updated_by || form.created_by || DEFAULT_CREATED_BY,
    };

    try {
      const res = await fetch(editingKode ? `${API_URL}/${editingKode}` : API_URL, {
        method: editingKode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchData();
        setForm(emptyKlasifikasi);
        setEditingKode(null);
        setOpenForm(false);
      } else {
        const msg = await res.text();
        setError(msg || "Gagal menyimpan klasifikasi.");
      }
    } catch (err) {
      console.error("Failed create klasifikasi", err);
      setError("Gagal terhubung ke server.");
    } finally {
      setSaving(false);
    }
  };

  const totalAktif = items.filter((item) => item.status === 1).length;
  const totalCadangan = items.filter((item) => item.status_cadangan === 1).length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Klasifikasi</h1>
        </div>
        <button
          onClick={() => setOpenForm(true)}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Tambah Klasifikasi
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard title="Total" value={`${items.length} klasifikasi`} accent="from-[#3FE0D0] to-[#2DD4C4]" />
        <SummaryCard title="Aktif" value={`${totalAktif} aktif`} accent="from-emerald-400 to-teal-400" />
        <SummaryCard title="Cadangan" value={`${totalCadangan} cadangan`} accent="from-amber-300 to-orange-400" />
      </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <Grid2x2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Klasifikasi Produk</p>
              <p className="text-base font-semibold text-gray-800">Susunan parent-child produk</p>
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
            <Filter className="w-4 h-4" /> Filter
          </div>
          <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto">
            <div className="flex-1 min-w-[200px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode / nama"
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
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Dibuat</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {orderedWithIndent.length === 0 && !loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>
                    Belum ada data klasifikasi.
                  </td>
                </tr>
              ) : (
                orderedWithIndent.map((item) => (
                  <tr key={item.kode_klasifikasi} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div
                        className={`text-gray-900 ${item.level === 0 ? "font-bold" : "font-medium"}`}
                        style={{ paddingLeft: `${item.level * 16}px` }}
                      >
                        {item.level === 0 ? item.nama : `${item.isLast ? "└─" : "├─"} ${item.nama}`}
                      </div>
                      <div className="text-xs text-gray-500" style={{ paddingLeft: `${item.level * 40}px` }}>
                        Updated: {formatDate(item.updated_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-800">
                        <ListTree className="w-4 h-4 text-gray-400" />
                        {item.level === 0 ? "" : item.parentName || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
                          item.status === 1
                            ? "bg-[#3FE0D0]/15 text-[#0f756b] border-[#3FE0D0]/30"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {item.status === 1 ? "Aktif" : "Nonaktif"}
                      </span>
                      {item.status_cadangan === 1 && (
                        <div className="text-[11px] text-amber-700 mt-1">Cadangan</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(item.created_at)}
                      <div className="text-xs text-gray-500">By {item.created_by || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingKode(item.kode_klasifikasi);
                          setForm({
                            ...form,
                            ...item,
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
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tambah Klasifikasi</p>
                <h2 className="text-xl font-bold text-gray-900">Input Data Klasifikasi Produk</h2>
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
              <div className="grid md:grid-cols-1 gap-3">
                <Input
                  label="Nama"
                  value={form.nama}
                  onChange={(v) => handleChange("nama", v)}
                  placeholder="Nama klasifikasi"
                  required
                />
              </div>

              <div className="grid md:grid-cols-1 gap-3">
                <SearchableSelect
                  label="Parent"
                  value={form.kode_parent}
                  onChange={(v) => handleChange("kode_parent", v)}
                  options={(items.filter((i) => !i.kode_parent) || []).map((item) => ({
                    label: item.nama,
                    value: item.kode_klasifikasi,
                  }))}
                  placeholder="Cari nama klasifikasi, kosongkan jika root"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <Select
                  label="Status"
                  value={form.status?.toString() ?? "1"}
                  onChange={(v) => handleChange("status", Number(v))}
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

function SummaryCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm flex items-center gap-3">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center font-bold`}>
        {value.split(" ")[0]}
      </div>
      <div>
        <p className="text-xs text-gray-500">{title}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
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
      <span className="text-xs text-gray-500">{label}</span>
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

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    const match = options.find((o) => o.value === value);
    setDisplay(match ? match.label : "");
  }, [value, options]);

  const handleInput = (text: string) => {
    setDisplay(text);
    const match = options.find((o) => o.label.toLowerCase() === text.toLowerCase());
    if (match) {
      onChange(match.value);
    } else if (text === "") {
      onChange("");
    }
  };

  const listId = "parent-options";
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        list={listId}
        value={display}
        onChange={(e) => handleInput(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none transition-colors"
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

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID");
}
