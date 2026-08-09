"use client";

import { useMemo, useState } from "react";
import { Plus, X, Users, Phone, ShieldCheck, BadgeDollarSign } from "lucide-react";

type Sales = {
  id_sales: number;
  kode: string;
  nama: string;
  kode_site: string;
  status: number;
  status_cadangan: number;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  kode_sales: string;
  toleransi_kunci_overdue: string;
  limit_kredit_global_salesman: string;
  kode_sales_2: string;
  deposit_sales_retur: string;
  id_supervisor_sales: string;
  id_sesco_sales: string;
  nomor_wa: string;
};

const dummySales: Sales[] = [
  {
    id_sales: 1,
    kode: "SL-001",
    nama: "Rani Pratama",
    kode_site: "GW-JKT-01",
    status: 1,
    status_cadangan: 0,
    created_by: "system",
    created_at: "2024-01-10T08:00:00Z",
    updated_by: "admin",
    updated_at: "2024-02-01T09:00:00Z",
    kode_sales: "SLS-001",
    toleransi_kunci_overdue: "7",
    limit_kredit_global_salesman: "150000000",
    kode_sales_2: "SLS-A",
    deposit_sales_retur: "5000000",
    id_supervisor_sales: "10",
    id_sesco_sales: "201",
    nomor_wa: "081212345678",
  },
  {
    id_sales: 2,
    kode: "SL-002",
    nama: "Andi Setiawan",
    kode_site: "GW-SMG-01",
    status: 1,
    status_cadangan: 0,
    created_by: "system",
    created_at: "2024-01-12T08:30:00Z",
    updated_by: "admin",
    updated_at: "2024-02-05T10:00:00Z",
    kode_sales: "SLS-002",
    toleransi_kunci_overdue: "5",
    limit_kredit_global_salesman: "100000000",
    kode_sales_2: "SLS-B",
    deposit_sales_retur: "2500000",
    id_supervisor_sales: "11",
    id_sesco_sales: "202",
    nomor_wa: "081234567890",
  },
];

const emptySales: Sales = {
  id_sales: 0,
  kode: "",
  nama: "",
  kode_site: "",
  status: 1,
  status_cadangan: 0,
  created_by: "admin",
  created_at: "",
  updated_by: "admin",
  updated_at: "",
  kode_sales: "",
  toleransi_kunci_overdue: "",
  limit_kredit_global_salesman: "",
  kode_sales_2: "",
  deposit_sales_retur: "",
  id_supervisor_sales: "",
  id_sesco_sales: "",
  nomor_wa: "",
};

export default function MasterSalesPage() {
  const [items, setItems] = useState<Sales[]>(dummySales);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<Sales>(emptySales);

  const nextId = useMemo(() => items.length + 1, [items.length]);

  const handleChange = (field: keyof Sales, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const newItem: Sales = {
      ...form,
      id_sales: nextId,
      kode: form.kode || `SL-${String(nextId).padStart(3, "0")}`,
      kode_sales: form.kode_sales || `SLS-${String(nextId).padStart(3, "0")}`,
      created_at: now,
      updated_at: now,
    };
    setItems((prev) => [newItem, ...prev]);
    setForm(emptySales);
    setOpenForm(false);
    alert("Sales baru ditambahkan (dummy).");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Sales</h1>
        </div>
        <button
          onClick={() => setOpenForm(true)}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Tambah Sales
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Sales</p>
              <p className="text-base font-semibold text-gray-800">Total {items.length} sales</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="w-4 h-4" />
            Dummy data
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">Limit Kredit</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {items.map((item) => (
                <tr key={item.id_sales} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    <div>{item.kode_sales}</div>
                    <div className="text-xs text-gray-500">{item.kode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{item.nama}</div>
                    <div className="text-xs text-gray-500">Supervisor: {item.id_supervisor_sales || "-"}</div>
                  </td>
                  <td className="px-4 py-3">{item.kode_site || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{item.nomor_wa || "-"}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Toleransi: {item.toleransi_kunci_overdue || "0"} hari
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <BadgeDollarSign className="w-4 h-4 text-gray-400" />
                      <span>
                        {item.limit_kredit_global_salesman
                          ? `Rp ${Number(item.limit_kredit_global_salesman).toLocaleString("id-ID")}`
                          : "-"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Deposit retur: {item.deposit_sales_retur || "0"}
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
                  </td>
                </tr>
              ))}
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
                <p className="text-sm text-gray-500">Tambah Sales</p>
                <h2 className="text-xl font-bold text-gray-900">Input Data Sales</h2>
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
                  label="Kode Sales"
                  value={form.kode_sales}
                  onChange={(v) => handleChange("kode_sales", v)}
                  placeholder={`SLS-${String(nextId).padStart(3, "0")}`}
                  required
                />
                <Input
                  label="Kode"
                  value={form.kode}
                  onChange={(v) => handleChange("kode", v)}
                  placeholder={`SL-${String(nextId).padStart(3, "0")}`}
                />
                <Input
                  label="Nama"
                  value={form.nama}
                  onChange={(v) => handleChange("nama", v)}
                  placeholder="Nama sales"
                  required
                />
                <Input
                  label="Kode Site"
                  value={form.kode_site}
                  onChange={(v) => handleChange("kode_site", v)}
                  placeholder="GW-JKT-01"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  label="Nomor WA"
                  value={form.nomor_wa}
                  onChange={(v) => handleChange("nomor_wa", v)}
                  placeholder="08xxxxxxxxxx"
                />
                <Input
                  label="Toleransi Kunci Overdue (hari)"
                  value={form.toleransi_kunci_overdue}
                  onChange={(v) => handleChange("toleransi_kunci_overdue", v)}
                  type="number"
                />
                <Input
                  label="Limit Kredit Global"
                  value={form.limit_kredit_global_salesman}
                  onChange={(v) => handleChange("limit_kredit_global_salesman", v)}
                  type="number"
                  step="0.01"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  label="Deposit Sales Retur"
                  value={form.deposit_sales_retur}
                  onChange={(v) => handleChange("deposit_sales_retur", v)}
                  type="number"
                  step="0.01"
                />
                <Input
                  label="Kode Sales 2"
                  value={form.kode_sales_2}
                  onChange={(v) => handleChange("kode_sales_2", v)}
                  placeholder="Opsional"
                />
                <Input
                  label="Supervisor ID"
                  value={form.id_supervisor_sales}
                  onChange={(v) => handleChange("id_supervisor_sales", v)}
                  type="number"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Sesco ID"
                  value={form.id_sesco_sales}
                  onChange={(v) => handleChange("id_sesco_sales", v)}
                  type="number"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Status"
                    value={form.status?.toString() ?? "1"}
                    onChange={(v) => handleChange("status", v)}
                    options={[
                      { label: "Aktif", value: "1" },
                      { label: "Nonaktif", value: "0" },
                    ]}
                  />
                  <Select
                    label="Status Cadangan"
                    value={form.status_cadangan?.toString() ?? "0"}
                    onChange={(v) => handleChange("status_cadangan", v)}
                    options={[
                      { label: "Tidak", value: "0" },
                      { label: "Cadangan", value: "1" },
                    ]}
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
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg"
                >
                  Simpan Sales
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
  value: string;
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
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
