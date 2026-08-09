"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Handshake,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  BadgeCheck,
  ArrowUpDown,
  Download,
} from "lucide-react";

type Supplier = {
  id_supplier: number;
  kode_supplier: string;
  nama: string;
  siteCode?: string;
  branchCode?: string;
  tipe: string;
  jenis: string;
  npwp: string;
  alamat: string;
  kota: string;
  provinsi: string;
  kode_pos: string;
  negara: string;
  telp_1: string;
  telp_2: string;
  fax: string;
  email: string;
  catatan: string;
  status: number;
  status_cadangan: number;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  deposit: string | number;
  top: string | number | null;
  limit_kredit: string | number;
  kredit_terpakai: string | number;
  sisa_kredit: string | number;
  supplier_status: number;
  approved_by: string;
  approved_at: string;
  pkp: number | string;
  periode_kunjungan_salesman: string;
  nama_bank: string;
  no_rekening: string;
  atas_nama: string;
  cabang: string;
  total_item?: number;
  total_brand?: number;
};

const SITE_CODE = process.env.NEXT_PUBLIC_SITE_CODE ?? "01";
const BRANCH_CODE = process.env.NEXT_PUBLIC_BRANCH_CODE ?? "01";
const DEFAULT_CREATED_BY = process.env.NEXT_PUBLIC_CREATED_BY ?? "admin";

const emptySupplier: Supplier = {
  id_supplier: 0,
  kode_supplier: "",
  nama: "",
  siteCode: SITE_CODE,
  branchCode: BRANCH_CODE,
  tipe: "",
  jenis: "",
  npwp: "",
  alamat: "",
  kota: "",
  provinsi: "",
  kode_pos: "",
  negara: "Indonesia",
  telp_1: "",
  telp_2: "",
  fax: "",
  email: "",
  catatan: "",
  status: 1,
  status_cadangan: 0,
  created_by: DEFAULT_CREATED_BY,
  created_at: "",
  updated_by: DEFAULT_CREATED_BY,
  updated_at: "",
  deposit: "",
  top: "",
  limit_kredit: "",
  kredit_terpakai: "",
  sisa_kredit: "",
  supplier_status: 0,
  approved_by: "",
  approved_at: "",
  pkp: 1,
  periode_kunjungan_salesman: "",
  nama_bank: "",
  no_rekening: "",
  atas_nama: "",
  cabang: "",
};

export default function MasterSupplierPage() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<Supplier>(emptySupplier);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sortNama, setSortNama] = useState<"asc" | "desc">("asc");

  const nextId = useMemo(() => items.length + 1, [items.length]);
  const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "/api"}/suppliers`;

  const sortedItems = useMemo(() => {
    const data = [...items];
    data.sort((a, b) => {
      const left = (a.nama || "").toString();
      const right = (b.nama || "").toString();
      const cmp = left.localeCompare(right, "id", { sensitivity: "base" });
      return sortNama === "asc" ? cmp : -cmp;
    });
    return data;
  }, [items, sortNama]);

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(data as Supplier[]);
      } else {
        setItems([]);
      }
    } catch (err: any) {
      console.error("Failed fetch suppliers", err);
      setError("Gagal memuat supplier dari server.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [API_URL]);

  const handleChange = (field: keyof Supplier, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value as any }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const now = new Date().toISOString();
    const siteCode = SITE_CODE.toString().trim().toUpperCase();
    const branchCode = BRANCH_CODE.toString().trim().toUpperCase();
    const numeric = (val: string | number | null | undefined, fallback: number | null = 0) => {
      if (val === "" || val === null || typeof val === "undefined") return fallback;
      const n = Number(val);
      return Number.isNaN(n) ? fallback : n;
    };

    const newItem: Supplier = {
      ...form,
      id_supplier: editingId ?? (undefined as any), // let backend assign identity
      kode_supplier: editingId ? form.kode_supplier : (undefined as any), // backend generates on create
      created_at: now,
      updated_at: now,
      siteCode,
      branchCode,
      created_by: DEFAULT_CREATED_BY,
      updated_by: DEFAULT_CREATED_BY,
      deposit: numeric(form.deposit, 0) ?? 0,
      top: numeric(form.top, null),
      limit_kredit: numeric(form.limit_kredit) ?? 0,
      kredit_terpakai: numeric(form.kredit_terpakai) ?? 0,
      sisa_kredit: numeric(form.sisa_kredit) ?? 0,
      status: Number(form.status ?? 1),
      status_cadangan: Number(form.status_cadangan ?? 0),
      supplier_status: Number(form.supplier_status ?? 0),
      pkp: numeric(form.pkp, 0) ?? 0,
    };

    try {
      const res = await fetch(editingId ? `${API_URL}/${editingId}` : API_URL, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });

      if (res.ok) {
        await fetchSuppliers();
      } else {
        const message = await res.text();
        setError(message || "Gagal simpan ke server.");
      }
    } catch (err: any) {
      console.error("Failed create supplier", err);
      setError("Gagal terhubung ke server.");
    } finally {
      setForm({ ...emptySupplier });
      setEditingId(null);
      setOpenForm(false);
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    if (items.length === 0) return;
    const headers = [
      "Kode Supplier",
      "Nama",
      "Jenis",
      "Tipe",
      "NPWP",
      "Telepon 1",
      "Telepon 2",
      "Email",
      "Alamat",
      "Kota",
      "Provinsi",
      "Negara",
      "Status",
      "Created At",
      "Updated At",
    ];
    const rows = items.map((sup) => [
      sup.kode_supplier,
      sup.nama,
      sup.jenis,
      sup.tipe,
      sup.npwp,
      sup.telp_1,
      sup.telp_2,
      sup.email,
      sup.alamat,
      sup.kota,
      sup.provinsi,
      sup.negara,
      sup.status === 1 ? "Aktif" : "Nonaktif",
      sup.created_at,
      sup.updated_at,
    ]);
    const csvContent =
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\r\n") + "\r\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `master-supplier-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Supplier</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
          >
            <Download className="w-5 h-5" />
            Export Excel
          </button>
          <button
            onClick={() => {
              setForm({ ...emptySupplier });
              setEditingId(null);
              setOpenForm(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Tambah Supplier
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Supplier</p>
              <p className="text-base font-semibold text-gray-800">
                {loading ? "Memuat supplier..." : `Total ${items.length} supplier`}
              </p>
              <p className="text-xs text-gray-500">Kode supplier otomatis dibuat oleh sistem</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="w-4 h-4" />
            {loading ? "Mengambil dari server" : "Sinkron server"}
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
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSortNama((prev) => (prev === "asc" ? "desc" : "asc"))}
                    className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 hover:text-gray-700"
                    aria-label={`Urutkan nama supplier ${sortNama === "asc" ? "desc" : "asc"}`}
                  >
                    Nama
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-semibold">{sortNama === "asc" ? "ASC" : "DESC"}</span>
                  </button>
                </th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">Lokasi</th>
                <th className="px-4 py-3 text-right">Total Item</th>
                <th className="px-4 py-3 text-right">Total Brand</th>
                <th className="px-4 py-3">Keuangan</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {sortedItems.length === 0 && !loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={8}>
                    Belum ada data supplier.
                  </td>
                </tr>
              ) : (
                sortedItems.map((sup) => (
                  <tr key={sup.id_supplier} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{sup.kode_supplier}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{sup.nama}</div>
                      <div className="text-xs text-gray-500">{sup.tipe || sup.jenis || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{sup.telp_1 || "-"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Mail className="w-4 h-4" />
                        <span>{sup.email || "-"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-700">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>{sup.kota || "-"}</span>
                      </div>
                      <div className="text-xs text-gray-500">{sup.provinsi || sup.negara || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-800">{sup.total_item ?? 0}</td>
                    <td className="px-4 py-3 text-right text-gray-800">{sup.total_brand ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-700">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        <span>Limit: {sup.limit_kredit ?? "-"}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Terpakai: {sup.kredit_terpakai ?? 0} ? Sisa: {sup.sisa_kredit ?? 0}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
                            sup.status === 1
                              ? "bg-[#3FE0D0]/15 text-[#0f756b] border-[#3FE0D0]/30"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          {sup.status === 1 ? "Aktif" : "Nonaktif"}
                        </span>
                        {sup.supplier_status === 1 && (
                          <div className="text-[11px] text-green-700 flex items-center gap-1">
                            <BadgeCheck className="w-3 h-3" />
                            Approved
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setForm({
                              ...sup,
                              status: sup.status ?? 1,
                              status_cadangan: sup.status_cadangan ?? 0,
                              supplier_status: sup.supplier_status ?? 0,
                              pkp: sup.pkp ?? 0,
                              top: sup.top ?? "",
                              deposit: sup.deposit ?? "",
                              limit_kredit: sup.limit_kredit ?? "",
                              kredit_terpakai: sup.kredit_terpakai ?? "",
                              sisa_kredit: sup.sisa_kredit ?? "",
                            });
                            setEditingId(sup.id_supplier);
                            setOpenForm(true);
                          }}
                          className="ml-auto px-3 py-1 text-xs font-semibold text-[#0f756b] border border-[#3FE0D0]/40 rounded-full hover:bg-[#3FE0D0]/10"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {openForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpenForm(false)} />
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tambah Supplier</p>
                <h2 className="text-xl font-bold text-gray-900">Input Data Supplier</h2>
              </div>
              <button
                onClick={() => setOpenForm(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Tutup"
              >
                <Plus className="w-5 h-5 text-gray-600 rotate-45" />
              </button>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid md:grid-cols-3 gap-4">
                <Input label="Nama" value={form.nama} onChange={(v) => handleChange("nama", v)} required />
                <Select
                  label="Tipe"
                  value={form.tipe}
                  onChange={(v) => handleChange("tipe", v)}
                  options={[
                    { label: "Principal", value: "Principal" },
                    { label: "Distributor", value: "Distributor" },
                    { label: "Sub Distributor", value: "Sub Distributor" },
                    { label: "Lainnya", value: "Lainnya" },
                  ]}
                />
                <div className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-3">
                  Kode supplier dibuat otomatis saat disimpan.
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input label="Jenis" value={form.jenis} onChange={(v) => handleChange("jenis", v)} placeholder="Kosmetik/Skincare" />
                <Input label="NPWP" value={form.npwp} onChange={(v) => handleChange("npwp", v)} />
                <Select
                  label="PKP"
                  value={form.pkp?.toString() ?? "1"}
                  onChange={(v) => handleChange("pkp", Number(v))}
                  options={[
                    { label: "PKP", value: "1" },
                    { label: "Non PKP", value: "0" },
                  ]}
                />
              </div>

              <Input label="Alamat" value={form.alamat} onChange={(v) => handleChange("alamat", v)} placeholder="Alamat lengkap" />

              <div className="grid md:grid-cols-3 gap-4">
                <Input label="Kota" value={form.kota} onChange={(v) => handleChange("kota", v)} />
                <Input label="Provinsi" value={form.provinsi} onChange={(v) => handleChange("provinsi", v)} />
                <Input label="Kode Pos" value={form.kode_pos} onChange={(v) => handleChange("kode_pos", v)} />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input label="Negara" value={form.negara} onChange={(v) => handleChange("negara", v)} />
                <Input label="Telp 1" value={form.telp_1} onChange={(v) => handleChange("telp_1", v)} />
                <Input label="Telp 2" value={form.telp_2} onChange={(v) => handleChange("telp_2", v)} />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input label="Fax" value={form.fax} onChange={(v) => handleChange("fax", v)} />
                <Input label="Email" value={form.email} onChange={(v) => handleChange("email", v)} />
                <Input label="Periode Kunjungan Salesman (hari)" value={form.periode_kunjungan_salesman} onChange={(v) => handleChange("periode_kunjungan_salesman", v)} />
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <Input label="Deposit" value={form.deposit} onChange={(v) => handleChange("deposit", v)} />
                <Input label="TOP (hari)" value={form.top ?? ""} onChange={(v) => handleChange("top", v)} />
                <Input label="Limit Kredit" value={form.limit_kredit} onChange={(v) => handleChange("limit_kredit", v)} />
                <Input label="Kredit Terpakai" value={form.kredit_terpakai} onChange={(v) => handleChange("kredit_terpakai", v)} />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input label="Sisa Kredit" value={form.sisa_kredit} onChange={(v) => handleChange("sisa_kredit", v)} />
                <Select
                  label="Status"
                  value={form.status?.toString() ?? "1"}
                  onChange={(v) => handleChange("status", Number(v))}
                  options={[
                    { label: "Aktif", value: "1" },
                    { label: "Nonaktif", value: "0" },
                  ]}
                />
                <Select
                  label="Status Cadangan"
                  value={form.status_cadangan?.toString() ?? "0"}
                  onChange={(v) => handleChange("status_cadangan", Number(v))}
                  options={[
                    { label: "Tidak", value: "0" },
                    { label: "Cadangan", value: "1" },
                  ]}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Select
                  label="Supplier Status"
                  value={form.supplier_status?.toString() ?? "0"}
                  onChange={(v) => handleChange("supplier_status", Number(v))}
                  options={[
                    { label: "Pending", value: "0" },
                    { label: "Approved", value: "1" },
                  ]}
                />
                <Input label="Approved By" value={form.approved_by} onChange={(v) => handleChange("approved_by", v)} />
                <Input label="Approved At" value={form.approved_at} onChange={(v) => handleChange("approved_at", v)} placeholder="YYYY-MM-DD" />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input label="Nama Bank" value={form.nama_bank} onChange={(v) => handleChange("nama_bank", v)} />
                <Input label="No Rekening" value={form.no_rekening} onChange={(v) => handleChange("no_rekening", v)} />
                <Input label="Atas Nama" value={form.atas_nama} onChange={(v) => handleChange("atas_nama", v)} />
                <Input label="Cabang Bank" value={form.cabang} onChange={(v) => handleChange("cabang", v)} />
              </div>

              <Textarea
                label="Catatan"
                value={form.catatan}
                onChange={(v) => handleChange("catatan", v)}
                placeholder="Catatan internal"
              />

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpenForm(false);
                    setForm({ ...emptySupplier });
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? "Menyimpan..." : "Simpan Supplier"}
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

function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-3 min-h-[100px] focus:border-[#3FE0D0] focus:outline-none transition-colors"
      />
    </label>
  );
}
