"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Image, Save } from "lucide-react";

type FormCustomer = {
  nama: string;
  no_ktp: string;
  no_hp: string;
  alamat: string;
  foto_url: string;
};

const initialForm: FormCustomer = {
  nama: "",
  no_ktp: "",
  no_hp: "",
  alamat: "",
  foto_url: "",
};

export default function CustomerNewPage() {
  const [form, setForm] = useState<FormCustomer>(initialForm);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  const handleChange = (field: keyof FormCustomer, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFoto = (file: File | null) => {
    setFotoFile(file);
    if (!file) {
      setFotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFotoPreview(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Nanti bisa dikirim ke API: { form, fotoFile }
    console.log("Customer baru:", form, fotoFile);
    alert("Customer tersimpan (dummy).");
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/master/customer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </Link>
            <div>
              <p className="text-sm text-gray-500">Master Data / Customer</p>
              <h1 className="text-2xl font-bold text-gray-900">Tambah Customer</h1>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-5"
        >
          <div className="grid md:grid-cols-[1fr_200px] gap-5 items-start">
            <div className="space-y-4">
              <Input
                label="Nama"
                value={form.nama}
                onChange={(v) => handleChange("nama", v)}
                placeholder="Nama lengkap customer"
                required
              />
              <Input
                label="No KTP"
                value={form.no_ktp}
                onChange={(v) => handleChange("no_ktp", v)}
                placeholder="Nomor KTP"
              />
              <Input
                label="No HP"
                value={form.no_hp}
                onChange={(v) => handleChange("no_hp", v)}
                placeholder="08xx..."
              />
              <Textarea
                label="Alamat"
                value={form.alamat}
                onChange={(v) => handleChange("alamat", v)}
                placeholder="Alamat lengkap"
                minRows={4}
              />
              <Input
                label="Foto (URL opsional)"
                value={form.foto_url}
                onChange={(v) => handleChange("foto_url", v)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Image className="w-4 h-4 text-[#0f756b]" />
                Upload Foto (opsional)
              </div>
              <label className="block w-full aspect-square rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer">
                {fotoPreview || form.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fotoPreview || form.foto_url}
                    alt="Preview foto"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-400 text-xs text-center px-3">Klik untuk unggah foto</div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFoto(e.target.files?.[0] || null)}
                />
              </label>
              <p className="text-xs text-gray-500">
                Jika tidak ada file, gunakan URL foto saja.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link
              href="/admin/master/customer"
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Batal
            </Link>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg"
            >
              <Save className="w-4 h-4" />
              Simpan Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
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

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  minRows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-3 focus:border-[#3FE0D0] focus:outline-none transition-colors"
      />
    </label>
  );
}
