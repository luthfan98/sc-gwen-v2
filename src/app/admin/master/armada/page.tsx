"use client";

import { useMemo, useState } from "react";
import { Plus, X, Truck, BadgeInfo, Ruler, Weight, ShieldCheck } from "lucide-react";

type Armada = {
  id_kendaraan: number;
  kode_kendaraan: string;
  nama: string;
  no_polisi: string;
  tahun: string;
  merk: string;
  panjang: string;
  lebar: string;
  tinggi: string;
  muatan: string;
  bobot: string;
  volume: string;
  catatan: string;
  status: number;
  status_cadangan: number;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
};

const dummyArmada: Armada[] = [
  {
    id_kendaraan: 1,
    kode_kendaraan: "TRK-001",
    nama: "Truck Box 6m",
    no_polisi: "B 1234 GWN",
    tahun: "2021",
    merk: "Hino",
    panjang: "600",
    lebar: "220",
    tinggi: "230",
    muatan: "5000",
    bobot: "3500",
    volume: "30",
    catatan: "Unit utama untuk rute Jakarta",
    status: 1,
    status_cadangan: 0,
    created_by: "system",
    created_at: "2024-01-05T08:00:00Z",
    updated_by: "admin",
    updated_at: "2024-02-01T09:00:00Z",
  },
  {
    id_kendaraan: 2,
    kode_kendaraan: "VAN-002",
    nama: "Van Delivery",
    no_polisi: "H 7890 SGM",
    tahun: "2020",
    merk: "Isuzu",
    panjang: "420",
    lebar: "180",
    tinggi: "190",
    muatan: "1500",
    bobot: "2200",
    volume: "14",
    catatan: "Cadangan Semarang",
    status: 1,
    status_cadangan: 1,
    created_by: "system",
    created_at: "2024-01-10T08:30:00Z",
    updated_by: "admin",
    updated_at: "2024-02-10T10:00:00Z",
  },
];

const emptyArmada: Armada = {
  id_kendaraan: 0,
  kode_kendaraan: "",
  nama: "",
  no_polisi: "",
  tahun: "",
  merk: "",
  panjang: "",
  lebar: "",
  tinggi: "",
  muatan: "",
  bobot: "",
  volume: "",
  catatan: "",
  status: 1,
  status_cadangan: 0,
  created_by: "admin",
  created_at: "",
  updated_by: "admin",
  updated_at: "",
};

export default function MasterArmadaPage() {
  const [items, setItems] = useState<Armada[]>(dummyArmada);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<Armada>(emptyArmada);

  const nextId = useMemo(() => items.length + 1, [items.length]);

  const handleChange = (field: keyof Armada, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const newItem: Armada = {
      ...form,
      id_kendaraan: nextId,
      kode_kendaraan: form.kode_kendaraan || `ARM-${String(nextId).padStart(3, "0")}`,
      created_at: now,
      updated_at: now,
    };
    setItems((prev) => [newItem, ...prev]);
    setForm(emptyArmada);
    setOpenForm(false);
    alert("Armada baru ditambahkan (dummy).");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Armada</h1>
        </div>
        <button
          onClick={() => setOpenForm(true)}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Tambah Armada
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Armada</p>
              <p className="text-base font-semibold text-gray-800">Total {items.length} armada</p>
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
                <th className="px-4 py-3">Spesifikasi</th>
                <th className="px-4 py-3">Kapasitas</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {items.map((item) => (
                <tr key={item.id_kendaraan} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    <div>{item.kode_kendaraan}</div>
                    <div className="text-xs text-gray-500">{item.no_polisi || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{item.nama}</div>
                    <div className="text-xs text-gray-500">{item.merk || "-"} • {item.tahun || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <BadgeInfo className="w-4 h-4 text-gray-400" />
                      <span>
                        {item.panjang || "-"} x {item.lebar || "-"} x {item.tinggi || "-"} cm
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{item.catatan || "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Ruler className="w-4 h-4 text-gray-400" />
                      <span>Volume: {item.volume || "0"} m³</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Weight className="w-4 h-4" />
                      <span>Muatan: {item.muatan || "0"} kg • Bobot: {item.bobot || "0"} kg</span>
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
                <p className="text-sm text-gray-500">Tambah Armada</p>
                <h2 className="text-xl font-bold text-gray-900">Input Data Armada</h2>
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
                  label="Kode Kendaraan"
                  value={form.kode_kendaraan}
                  onChange={(v) => handleChange("kode_kendaraan", v)}
                  placeholder={`ARM-${String(nextId).padStart(3, "0")}`}
                />
                <Input
                  label="Nama Kendaraan"
                  value={form.nama}
                  onChange={(v) => handleChange("nama", v)}
                  placeholder="Nama unit armada"
                  required
                />
                <Input
                  label="Nomor Polisi"
                  value={form.no_polisi}
                  onChange={(v) => handleChange("no_polisi", v)}
                  placeholder="B 1234 XXX"
                />
                <Input
                  label="Merk"
                  value={form.merk}
                  onChange={(v) => handleChange("merk", v)}
                  placeholder="Hino / Isuzu"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  label="Tahun"
                  value={form.tahun}
                  onChange={(v) => handleChange("tahun", v)}
                  placeholder="2021"
                />
                <Input
                  label="Panjang (cm)"
                  value={form.panjang}
                  onChange={(v) => handleChange("panjang", v)}
                />
                <Input
                  label="Lebar (cm)"
                  value={form.lebar}
                  onChange={(v) => handleChange("lebar", v)}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  label="Tinggi (cm)"
                  value={form.tinggi}
                  onChange={(v) => handleChange("tinggi", v)}
                />
                <Input
                  label="Muatan (kg)"
                  value={form.muatan}
                  onChange={(v) => handleChange("muatan", v)}
                  type="number"
                />
                <Input
                  label="Bobot (kg)"
                  value={form.bobot}
                  onChange={(v) => handleChange("bobot", v)}
                  type="number"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  label="Volume (m³)"
                  value={form.volume}
                  onChange={(v) => handleChange("volume", v)}
                  type="number"
                  step="0.01"
                />
                <Input
                  label="Catatan"
                  value={form.catatan}
                  onChange={(v) => handleChange("catatan", v)}
                  placeholder="Catatan internal"
                />
                <Select
                  label="Status"
                  value={form.status?.toString() ?? "1"}
                  onChange={(v) => handleChange("status", v)}
                  options={[
                    { label: "Aktif", value: "1" },
                    { label: "Nonaktif", value: "0" },
                  ]}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Select
                  label="Status Cadangan"
                  value={form.status_cadangan?.toString() ?? "0"}
                  onChange={(v) => handleChange("status_cadangan", v)}
                  options={[
                    { label: "Tidak", value: "0" },
                    { label: "Cadangan", value: "1" },
                  ]}
                />
                <div className="grid grid-cols-2 gap-4">
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
                  Simpan Armada
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
