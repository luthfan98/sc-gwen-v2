"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, Warehouse, MapPin, Phone, BarChart2, ShieldCheck, RefreshCw } from "lucide-react";

type Gudang = {
  id_gudang: number;
  kode_gudang: string;
  nama: string | null;
  alamat: string | null;
  telp: string | null;
  fax: string | null;
  kode_gudang_induk: string | null;
  volume: number | string | null;
  nilai: number | string | null;
  kode_site: string | null;
  status: number | null;
  status_cadangan: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
  jenis_gudang: string | null;
  kode_kelas_harga_beli: string | null;
  volume_terpakai: number | string | null;
  prefix: string | null;
  is_gudang_bs: number | null;
  panjang: string | null;
  lebar: string | null;
  tinggi: string | null;
};

type GudangForm = {
  kode_gudang: string;
  nama: string;
  alamat: string;
  telp: string;
  fax: string;
  kode_gudang_induk: string;
  volume: string;
  nilai: string;
  kode_site: string;
  status: number;
  status_cadangan: number;
  created_by: string;
  updated_by: string;
  jenis_gudang: string;
  kode_kelas_harga_beli: string;
  volume_terpakai: string;
  prefix: string;
  is_gudang_bs: number;
  panjang: string;
  lebar: string;
  tinggi: string;
};

const emptyGudangForm: GudangForm = {
  kode_gudang: "",
  nama: "",
  alamat: "",
  telp: "",
  fax: "",
  kode_gudang_induk: "",
  volume: "",
  nilai: "",
  kode_site: "",
  status: 1,
  status_cadangan: 0,
  created_by: "admin",
  updated_by: "admin",
  jenis_gudang: "",
  kode_kelas_harga_beli: "",
  volume_terpakai: "0",
  prefix: "",
  is_gudang_bs: 0,
  panjang: "",
  lebar: "",
  tinggi: "",
};

const toNumberOrZero = (value: number | string | null | undefined) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num;
};

const toNullableNumber = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  return num;
};

const safeTrim = (value: string) => {
  const raw = String(value || "").trim();
  return raw.length > 0 ? raw : null;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return `${dt.toLocaleDateString("id-ID")} ${dt.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export default function MasterGudangPage() {
  const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "/api"}/gudang`;

  const [items, setItems] = useState<Gudang[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<GudangForm>(emptyGudangForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    const key = search.trim().toLowerCase();
    if (!key) return items;
    return items.filter((row) => {
      const kode = String(row.kode_gudang || "").toLowerCase();
      const nama = String(row.nama || "").toLowerCase();
      const site = String(row.kode_site || "").toLowerCase();
      const jenis = String(row.jenis_gudang || "").toLowerCase();
      return kode.includes(key) || nama.includes(key) || site.includes(key) || jenis.includes(key);
    });
  }, [items, search]);

  const fetchGudang = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? (data as Gudang[]) : []);
    } catch (err) {
      console.error("Failed fetch gudang", err);
      setItems([]);
      setError("Gagal memuat data gudang dari server.");
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchGudang();
  }, [fetchGudang]);

  const handleChange = (field: keyof GudangForm, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value as never }));
  };

  const getCurrentUsername = () => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
      if (!raw) return "Admin";
      const parsed = JSON.parse(raw);
      return String(parsed?.username || parsed?.name || "Admin");
    } catch {
      return "Admin";
    }
  };

  const parseResponseMessage = async (res: Response) => {
    const raw = await res.text();
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.message) return String(parsed.message);
      return raw || `HTTP ${res.status}`;
    } catch {
      return raw || `HTTP ${res.status}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.nama.trim()) {
      setError("Nama gudang wajib diisi.");
      return;
    }
    if (!form.kode_site.trim()) {
      setError("Kode site wajib diisi.");
      return;
    }
    if (!form.jenis_gudang.trim()) {
      setError("Jenis gudang wajib diisi.");
      return;
    }

    const user = getCurrentUsername();
    const payload = {
      kode_gudang: safeTrim(form.kode_gudang),
      nama: form.nama.trim(),
      alamat: safeTrim(form.alamat),
      telp: safeTrim(form.telp),
      fax: safeTrim(form.fax),
      kode_gudang_induk: safeTrim(form.kode_gudang_induk),
      volume: toNullableNumber(form.volume),
      nilai: toNullableNumber(form.nilai),
      kode_site: form.kode_site.trim(),
      status: Number(form.status ?? 1),
      status_cadangan: Number(form.status_cadangan ?? 0),
      created_by: user,
      updated_by: user,
      jenis_gudang: form.jenis_gudang.trim(),
      kode_kelas_harga_beli: safeTrim(form.kode_kelas_harga_beli),
      volume_terpakai: toNullableNumber(form.volume_terpakai),
      prefix: safeTrim(form.prefix),
      is_gudang_bs: Number(form.is_gudang_bs ?? 0),
      panjang: safeTrim(form.panjang),
      lebar: safeTrim(form.lebar),
      tinggi: safeTrim(form.tinggi),
    };

    setSubmitting(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await parseResponseMessage(res);
        throw new Error(msg);
      }

      setOpenForm(false);
      setForm({ ...emptyGudangForm, created_by: user, updated_by: user });
      await fetchGudang();
    } catch (err: any) {
      console.error("Failed create gudang", err);
      setError(err?.message || "Gagal menyimpan gudang.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Gudang</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchGudang}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenForm(true);
              setError(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] px-4 py-3 font-semibold text-white shadow-md transition-all hover:shadow-lg"
          >
            <Plus className="h-5 w-5" />
            Tambah Gudang
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3FE0D0]/15 text-[#0f756b]">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Gudang</p>
              <p className="text-base font-semibold text-gray-800">
                {loading ? "Memuat gudang..." : `Total ${items.length} gudang`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="h-4 w-4" />
            Data realtime database
          </div>
        </div>

        {error && (
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
        )}

        <div className="border-b border-gray-100 px-4 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode / nama / site / jenis gudang"
            className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#2DD4C4]"
          />
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">Volume</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {!loading && filteredItems.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={7}>
                    Tidak ada data gudang.
                  </td>
                </tr>
              )}
              {filteredItems.map((gd) => (
                <tr key={gd.id_gudang} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{gd.kode_gudang}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{gd.nama || "-"}</div>
                    <div className="text-xs text-gray-500">{gd.jenis_gudang || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>{gd.kode_site || "-"}</span>
                    </div>
                    <div className="text-xs text-gray-500">Induk: {gd.kode_gudang_induk || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{gd.telp || "-"}</span>
                    </div>
                    <div className="text-xs text-gray-500">Fax: {gd.fax || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <BarChart2 className="h-4 w-4 text-gray-400" />
                      <span>{toNumberOrZero(gd.volume).toLocaleString("id-ID")} m3</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Terpakai: {toNumberOrZero(gd.volume_terpakai).toLocaleString("id-ID")} m3
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                        Number(gd.status) === 1
                          ? "border-[#3FE0D0]/30 bg-[#3FE0D0]/15 text-[#0f756b]"
                          : "border-gray-200 bg-gray-100 text-gray-600"
                      }`}
                    >
                      {Number(gd.status) === 1 ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDateTime(gd.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && setOpenForm(false)} />
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tambah Gudang</p>
                <h2 className="text-xl font-bold text-gray-900">Input Data Gudang</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpenForm(false)}
                disabled={submitting}
                className="rounded-lg p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Tutup"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Kode Gudang (opsional)"
                  value={form.kode_gudang}
                  onChange={(v) => handleChange("kode_gudang", v)}
                  placeholder="Kosongkan untuk auto generate"
                />
                <Input
                  label="Nama Gudang"
                  value={form.nama}
                  onChange={(v) => handleChange("nama", v)}
                  placeholder="Nama lengkap gudang"
                  required
                />
                <Input
                  label="Jenis Gudang"
                  value={form.jenis_gudang}
                  onChange={(v) => handleChange("jenis_gudang", v)}
                  placeholder="TOKO / GUDANG PUSAT / REGIONAL"
                  required
                />
                <Input
                  label="Kode Gudang Induk"
                  value={form.kode_gudang_induk}
                  onChange={(v) => handleChange("kode_gudang_induk", v)}
                  placeholder="Opsional"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Alamat"
                  value={form.alamat}
                  onChange={(v) => handleChange("alamat", v)}
                  placeholder="Alamat lengkap"
                />
                <Input
                  label="Kode Site"
                  value={form.kode_site}
                  onChange={(v) => handleChange("kode_site", v)}
                  placeholder="Contoh: CAB.27012099GW001"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Input label="Telepon" value={form.telp} onChange={(v) => handleChange("telp", v)} />
                <Input label="Fax" value={form.fax} onChange={(v) => handleChange("fax", v)} />
                <Input label="Prefix" value={form.prefix} onChange={(v) => handleChange("prefix", v)} />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  label="Volume (m3)"
                  value={form.volume}
                  onChange={(v) => handleChange("volume", v)}
                  type="number"
                  step="0.01"
                />
                <Input
                  label="Volume Terpakai (m3)"
                  value={form.volume_terpakai}
                  onChange={(v) => handleChange("volume_terpakai", v)}
                  type="number"
                  step="0.01"
                />
                <Input
                  label="Nilai (Rp)"
                  value={form.nilai}
                  onChange={(v) => handleChange("nilai", v)}
                  type="number"
                  step="0.01"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Input label="Panjang (m)" value={form.panjang} onChange={(v) => handleChange("panjang", v)} />
                <Input label="Lebar (m)" value={form.lebar} onChange={(v) => handleChange("lebar", v)} />
                <Input label="Tinggi (m)" value={form.tinggi} onChange={(v) => handleChange("tinggi", v)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Kode Kelas Harga Beli"
                  value={form.kode_kelas_harga_beli}
                  onChange={(v) => handleChange("kode_kelas_harga_beli", v)}
                />
                <Select
                  label="Gudang Barang Second (BS)"
                  value={String(form.is_gudang_bs)}
                  onChange={(v) => handleChange("is_gudang_bs", Number(v))}
                  options={[
                    { label: "Tidak", value: "0" },
                    { label: "Ya", value: "1" },
                  ]}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  label="Status"
                  value={String(form.status)}
                  onChange={(v) => handleChange("status", Number(v))}
                  options={[
                    { label: "Aktif", value: "1" },
                    { label: "Nonaktif", value: "0" },
                  ]}
                />
                <Select
                  label="Status Cadangan"
                  value={String(form.status_cadangan)}
                  onChange={(v) => handleChange("status_cadangan", Number(v))}
                  options={[
                    { label: "Tidak", value: "0" },
                    { label: "Cadangan", value: "1" },
                  ]}
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpenForm(false)}
                  disabled={submitting}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] px-5 py-2.5 font-semibold text-white shadow-md hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Menyimpan..." : "Simpan Gudang"}
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
  step,
}: {
  label: string;
  value: string | number;
  onChange: (val: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
  step?: string;
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
        step={step}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 transition-colors focus:border-[#3FE0D0] focus:outline-none"
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
        className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2.5 transition-colors focus:border-[#3FE0D0] focus:outline-none"
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

