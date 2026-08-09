"use client";

import { useMemo, useState } from "react";
import { Plus, X, CarFront, Phone, IdCard, ShieldCheck } from "lucide-react";

type Supir = {
  kode_supir: string;
  nama_supir: string;
  no_hp: string;
  sim_nomor: string;
  sim_jenis: string;
  alamat: string;
  status: number;
  status_cadangan: number;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  id_kendaraan: string;
  username: string;
};

const dummySupir: Supir[] = [
  {
    kode_supir: "DR-001",
    nama_supir: "Budi Santoso",
    no_hp: "081234567890",
    sim_nomor: "SIM1234567",
    sim_jenis: "B1",
    alamat: "Jl. Kenanga No. 5, Jakarta",
    status: 1,
    status_cadangan: 0,
    created_by: "system",
    created_at: "2024-01-05T08:00:00Z",
    updated_by: "admin",
    updated_at: "2024-02-01T09:00:00Z",
    id_kendaraan: "TRK-001",
    username: "budi.santoso",
  },
  {
    kode_supir: "DR-002",
    nama_supir: "Slamet Widodo",
    no_hp: "081298765432",
    sim_nomor: "SIM9876543",
    sim_jenis: "B2",
    alamat: "Jl. Diponegoro No. 10, Semarang",
    status: 1,
    status_cadangan: 1,
    created_by: "system",
    created_at: "2024-01-10T08:30:00Z",
    updated_by: "admin",
    updated_at: "2024-02-10T10:00:00Z",
    id_kendaraan: "VAN-002",
    username: "slamet.w",
  },
];

const emptySupir: Supir = {
  kode_supir: "",
  nama_supir: "",
  no_hp: "",
  sim_nomor: "",
  sim_jenis: "",
  alamat: "",
  status: 1,
  status_cadangan: 1,
  created_by: "admin",
  created_at: "",
  updated_by: "admin",
  updated_at: "",
  id_kendaraan: "",
  username: "",
};

export default function MasterSupirPage() {
  const [items, setItems] = useState<Supir[]>(dummySupir);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<Supir>(emptySupir);

  const nextId = useMemo(() => items.length + 1, [items.length]);

  const handleChange = (field: keyof Supir, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value as any }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const newItem: Supir = {
      ...form,
      kode_supir: form.kode_supir || `DR-${String(nextId).padStart(3, "0")}`,
      created_at: now,
      updated_at: now,
    };
    setItems((prev) => [newItem, ...prev]);
    setForm(emptySupir);
    setOpenForm(false);
    alert("Supir baru ditambahkan (dummy).");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Supir</h1>
        </div>
        <button
          onClick={() => setOpenForm(true)}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Tambah Supir
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <CarFront className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Supir</p>
              <p className="text-base font-semibold text-gray-800">Total {items.length} supir</p>
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
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">SIM</th>
                <th className="px-4 py-3">Armada</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {items.map((item) => (
                <tr key={item.kode_supir} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{item.kode_supir}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{item.nama_supir}</div>
                    <div className="text-xs text-gray-500">User: {item.username || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{item.no_hp || "-"}</span>
                    </div>
                    <div className="text-xs text-gray-500">{item.alamat || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <IdCard className="w-4 h-4 text-gray-400" />
                      <span>{item.sim_nomor || "-"}</span>
                    </div>
                    <div className="text-xs text-gray-500">Jenis: {item.sim_jenis || "-"}</div>
                  </td>
                  <td className="px-4 py-3">{item.id_kendaraan || "-"}</td>
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
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tambah Supir</p>
                <h2 className="text-xl font-bold text-gray-900">Input Data Supir</h2>
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
                  label="Kode Supir"
                  value={form.kode_supir}
                  onChange={(v) => handleChange("kode_supir", v)}
                  placeholder={`DR-${String(nextId).padStart(3, "0")}`}
                  required
                />
                <Input
                  label="Nama Supir"
                  value={form.nama_supir}
                  onChange={(v) => handleChange("nama_supir", v)}
                  placeholder="Nama lengkap"
                  required
                />
                <Input
                  label="Nomor HP"
                  value={form.no_hp}
                  onChange={(v) => handleChange("no_hp", v)}
                  placeholder="08xxxxxxxxxx"
                />
                <Input
                  label="Username"
                  value={form.username}
                  onChange={(v) => handleChange("username", v)}
                  placeholder="User login"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  label="Nomor SIM"
                  value={form.sim_nomor}
                  onChange={(v) => handleChange("sim_nomor", v)}
                />
                <Input
                  label="Jenis SIM"
                  value={form.sim_jenis}
                  onChange={(v) => handleChange("sim_jenis", v)}
                  placeholder="A / B1 / B2"
                />
                <Input
                  label="ID Kendaraan"
                  value={form.id_kendaraan}
                  onChange={(v) => handleChange("id_kendaraan", v)}
                  placeholder="TRK-001"
                />
              </div>

              <Input
                label="Alamat"
                value={form.alamat}
                onChange={(v) => handleChange("alamat", v)}
                placeholder="Alamat domisili"
              />

              <div className="grid md:grid-cols-2 gap-4">
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
                  value={form.status_cadangan?.toString() ?? "1"}
                  onChange={(v) => handleChange("status_cadangan", Number(v))}
                  options={[
                    { label: "Cadangan", value: "1" },
                    { label: "Tidak", value: "0" },
                  ]}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Created By"
                  value={form.created_by}
                  onChange={(v) => handleChange("created_by", v)}
                />
                <Input
                  label="Updated By"
                  value={form.updated_by}
                  onChange={(v) => handleChange("updated_by", v)}
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
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg"
                >
                  Simpan Supir
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
