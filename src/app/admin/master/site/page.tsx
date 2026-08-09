"use client";

import { useMemo, useState } from "react";
import { Plus, X, Building2, MapPin, Phone, FileText, ShieldCheck } from "lucide-react";

type Site = {
  id_site: string;
  kode_site: string;
  nama: string;
  npwp: string;
  alamat: string;
  kota: string;
  kode_pos: string;
  provinsi: string;
  negara: string;
  no_telp: string;
  fax: string;
  catatan: string;
  status: string;
  status_cadangan: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  kode_pusat: string;
  nama_header_print: string;
  alamat_header_print: string;
  nama_rekening: string;
  nama_bank: string;
  cabang_bank: string;
  nomor_rekening: string;
};

const initialSites: Site[] = [
  {
    id_site: "S001",
    kode_site: "GW-JKT-01",
    nama: "Gwen Center Jakarta",
    npwp: "01.234.567.8-901.000",
    alamat: "Jl. Melati No. 12, Kebayoran",
    kota: "Jakarta Selatan",
    kode_pos: "12130",
    provinsi: "DKI Jakarta",
    negara: "Indonesia",
    no_telp: "021-5550001",
    fax: "021-5550002",
    catatan: "Site utama untuk fulfillment",
    status: "Aktif",
    status_cadangan: "Tidak",
    created_by: "system",
    created_at: "2024-01-10T09:00:00Z",
    updated_by: "system",
    updated_at: "2024-01-20T10:00:00Z",
    kode_pusat: "GW-CENTER",
    nama_header_print: "GWEN BEAUTY CENTER",
    alamat_header_print: "Jl. Melati No. 12, Jakarta Selatan",
    nama_rekening: "PT Gwen Cantik",
    nama_bank: "BCA",
    cabang_bank: "Pondok Indah",
    nomor_rekening: "1234567890",
  },
  {
    id_site: "S002",
    kode_site: "GW-SMG-01",
    nama: "Gwen Warehouse Semarang",
    npwp: "02.345.678.9-012.000",
    alamat: "Jl. Sisingamangaraja No. 88",
    kota: "Semarang",
    kode_pos: "50144",
    provinsi: "Jawa Tengah",
    negara: "Indonesia",
    no_telp: "024-7771234",
    fax: "024-7771235",
    catatan: "Gudang regional Jawa Tengah",
    status: "Aktif",
    status_cadangan: "Cadangan",
    created_by: "system",
    created_at: "2024-02-02T08:00:00Z",
    updated_by: "admin",
    updated_at: "2024-03-05T08:30:00Z",
    kode_pusat: "GW-CENTER",
    nama_header_print: "GWEN SEMARANG HUB",
    alamat_header_print: "Jl. Sisingamangaraja No. 88, Semarang",
    nama_rekening: "PT Gwen Cantik",
    nama_bank: "Mandiri",
    cabang_bank: "Gajah Mada",
    nomor_rekening: "9876543210",
  },
];

const emptySite: Site = {
  id_site: "",
  kode_site: "",
  nama: "",
  npwp: "",
  alamat: "",
  kota: "",
  kode_pos: "",
  provinsi: "",
  negara: "Indonesia",
  no_telp: "",
  fax: "",
  catatan: "",
  status: "Aktif",
  status_cadangan: "Tidak",
  created_by: "admin",
  created_at: "",
  updated_by: "admin",
  updated_at: "",
  kode_pusat: "GW-CENTER",
  nama_header_print: "",
  alamat_header_print: "",
  nama_rekening: "",
  nama_bank: "",
  cabang_bank: "",
  nomor_rekening: "",
};

export default function MasterSitePage() {
  const [sites, setSites] = useState<Site[]>(initialSites);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<Site>(emptySite);

  const nextId = useMemo(
    () => `S${String(sites.length + 1).padStart(3, "0")}`,
    [sites.length]
  );

  const handleChange = (field: keyof Site, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const newSite: Site = {
      ...form,
      id_site: nextId,
      kode_site: form.kode_site || nextId,
      created_at: now,
      updated_at: now,
    };
    setSites((prev) => [newSite, ...prev]);
    setForm(emptySite);
    setOpenForm(false);
    alert("Site baru ditambahkan (dummy).");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Site</h1>
        </div>
        <button
          onClick={() => setOpenForm(true)}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Tambah Site
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Site</p>
              <p className="text-base font-semibold text-gray-800">Total {sites.length} site</p>
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
                <th className="px-4 py-3">Lokasi</th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {sites.map((site) => (
                <tr key={site.id_site} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{site.kode_site}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{site.nama}</div>
                    <div className="text-xs text-gray-500">{site.id_site}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{site.kota}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {site.provinsi}, {site.negara}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{site.no_telp || "-"}</span>
                    </div>
                    <div className="text-xs text-gray-500">NPWP: {site.npwp || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3FE0D0]/15 text-[#0f756b] border border-[#3FE0D0]/30 text-xs font-semibold">
                      {site.status}
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
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpenForm(false)}
          />
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tambah Site</p>
                <h2 className="text-xl font-bold text-gray-900">Input Data Site</h2>
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
                  label="Kode Site"
                  value={form.kode_site}
                  onChange={(v) => handleChange("kode_site", v)}
                  placeholder={nextId}
                />
                <Input
                  label="Nama Site"
                  value={form.nama}
                  onChange={(v) => handleChange("nama", v)}
                  placeholder="Nama lengkap site"
                  required
                />
                <Input
                  label="NPWP"
                  value={form.npwp}
                  onChange={(v) => handleChange("npwp", v)}
                  placeholder="01.234.567.8-901.000"
                />
                <Input
                  label="Kode Pusat"
                  value={form.kode_pusat}
                  onChange={(v) => handleChange("kode_pusat", v)}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Alamat"
                  value={form.alamat}
                  onChange={(v) => handleChange("alamat", v)}
                  placeholder="Alamat lengkap"
                />
                <Input
                  label="Alamat Header Print"
                  value={form.alamat_header_print}
                  onChange={(v) => handleChange("alamat_header_print", v)}
                  placeholder="Alamat untuk cetak header"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  label="Kota"
                  value={form.kota}
                  onChange={(v) => handleChange("kota", v)}
                />
                <Input
                  label="Provinsi"
                  value={form.provinsi}
                  onChange={(v) => handleChange("provinsi", v)}
                />
                <Input
                  label="Kode Pos"
                  value={form.kode_pos}
                  onChange={(v) => handleChange("kode_pos", v)}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  label="Negara"
                  value={form.negara}
                  onChange={(v) => handleChange("negara", v)}
                />
                <Input
                  label="No. Telp"
                  value={form.no_telp}
                  onChange={(v) => handleChange("no_telp", v)}
                />
                <Input
                  label="Fax"
                  value={form.fax}
                  onChange={(v) => handleChange("fax", v)}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Nama Header Print"
                  value={form.nama_header_print}
                  onChange={(v) => handleChange("nama_header_print", v)}
                />
                <Input
                  label="Catatan"
                  value={form.catatan}
                  onChange={(v) => handleChange("catatan", v)}
                  placeholder="Catatan internal"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Nama Rekening"
                  value={form.nama_rekening}
                  onChange={(v) => handleChange("nama_rekening", v)}
                />
                <Input
                  label="Nama Bank"
                  value={form.nama_bank}
                  onChange={(v) => handleChange("nama_bank", v)}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Cabang Bank"
                  value={form.cabang_bank}
                  onChange={(v) => handleChange("cabang_bank", v)}
                />
                <Input
                  label="Nomor Rekening"
                  value={form.nomor_rekening}
                  onChange={(v) => handleChange("nomor_rekening", v)}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(v) => handleChange("status", v)}
                  options={["Aktif", "Nonaktif"]}
                />
                <Select
                  label="Status Cadangan"
                  value={form.status_cadangan}
                  onChange={(v) => handleChange("status_cadangan", v)}
                  options={["Tidak", "Cadangan"]}
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
                  Simpan Site
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
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
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
  options: string[];
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
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
