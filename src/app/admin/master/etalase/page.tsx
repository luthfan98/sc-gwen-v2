"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Store, Package, RefreshCw, ArrowLeft } from "lucide-react";
import Swal from "sweetalert2";

type EtalaseSub = {
  kode_etalase_sub: string;
  nama: string;
  posisi: string | null;
  kapasitas: number | null;
  status: number | null;
};

type Etalase = {
  kode_etalase: string;
  nama: string;
  lokasi: string | null;
  status: number | null;
  is_disewakan: number | null;
  kapasitas: number | null;
  biaya_sewa_default: number | null;
  satuan_sewa: string | null;
  kode_merk: string | null;
  is_show: number | null;
  subs: EtalaseSub[];
};

const emptyForm = {
  kode_etalase: "",
  nama: "",
  lokasi: "",
  status: 1,
  is_disewakan: 1,
  kapasitas: 0,
  biaya_sewa_default: 0,
  satuan_sewa: "",
  kode_merk: "",
  is_show: 1,
  subs: [] as EtalaseSub[],
};

export default function MasterEtalasePage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [items, setItems] = useState<Etalase[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const totalSub = useMemo(
    () => items.reduce((sum, item) => sum + (item.subs?.length || 0), 0),
    [items]
  );

  const fetchEtalase = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/etalase`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed fetch etalase", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEtalase();
  }, []);

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addSub = () => {
    setForm((prev) => ({
      ...prev,
      subs: [
        ...prev.subs,
        {
          kode_etalase_sub: "",
          nama: "",
          posisi: "",
          kapasitas: 0,
          status: 1,
        },
      ],
    }));
  };

  const updateSub = (index: number, patch: Partial<EtalaseSub>) => {
    setForm((prev) => ({
      ...prev,
      subs: prev.subs.map((sub, idx) => (idx === index ? { ...sub, ...patch } : sub)),
    }));
  };

  const removeSub = (index: number) => {
    setForm((prev) => ({
      ...prev,
      subs: prev.subs.filter((_, idx) => idx !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama) {
      Swal.fire({ icon: "error", title: "Nama etalase wajib diisi" });
      return;
    }
    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let createdBy = "Admin";
    if (rawSession) {
      try {
        const session = JSON.parse(rawSession);
        createdBy = session?.username || session?.name || createdBy;
      } catch {
        // ignore
      }
    }

    try {
      const res = await fetch(`${API_BASE}/etalase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_etalase: form.kode_etalase || null,
          nama: form.nama,
          lokasi: form.lokasi || null,
          status: Number(form.status),
          is_disewakan: Number(form.is_disewakan),
          kapasitas: Number(form.kapasitas || 0),
          biaya_sewa_default: Number(form.biaya_sewa_default || 0),
          satuan_sewa: form.satuan_sewa || null,
          kode_merk: form.kode_merk || null,
          is_show: Number(form.is_show),
          created_by: createdBy,
          subs: form.subs.map((sub) => ({
            kode_etalase_sub: sub.kode_etalase_sub || null,
            nama: sub.nama,
            posisi: sub.posisi || null,
            kapasitas: Number(sub.kapasitas || 0),
            status: Number(sub.status ?? 1),
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      await Swal.fire({
        icon: "success",
        title: "Etalase tersimpan",
        timer: 1000,
        showConfirmButton: false,
      });
      setOpenForm(false);
      setForm({ ...emptyForm });
      fetchEtalase();
    } catch (err) {
      console.error("Failed create etalase", err);
      Swal.fire({ icon: "error", title: "Gagal menambah etalase" });
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Etalase</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to menu
          </Link>
          <button
            type="button"
            onClick={fetchEtalase}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setOpenForm(true)}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Tambah Etalase
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Etalase</p>
              <p className="text-base font-semibold text-gray-800">
                Total {items.length} etalase / {totalSub} sub
              </p>
            </div>
          </div>
          {loading && <div className="text-xs text-gray-500">Memuat...</div>}
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Lokasi</th>
                <th className="px-4 py-3">Kapasitas</th>
                <th className="px-4 py-3">Disewakan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {items.map((eta) => (
                <tr key={eta.kode_etalase} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{eta.kode_etalase}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{eta.nama}</div>
                    <div className="text-xs text-gray-500">{eta.kode_merk || "-"}</div>
                  </td>
                  <td className="px-4 py-3">{eta.lokasi || "-"}</td>
                  <td className="px-4 py-3">{eta.kapasitas ?? 0}</td>
                  <td className="px-4 py-3">{Number(eta.is_disewakan) === 1 ? "Ya" : "Tidak"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${
                        Number(eta.status) === 1
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {Number(eta.status) === 1 ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span>{eta.subs?.length || 0} sub</span>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Belum ada data etalase.
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
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tambah Etalase</p>
                <h2 className="text-xl font-bold text-gray-900">Input Data Etalase</h2>
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
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Kode Etalase"
                  value={form.kode_etalase}
                  onChange={(v) => handleChange("kode_etalase", v)}
                  placeholder="Kosongkan untuk auto"
                />
                <Input
                  label="Nama Etalase"
                  value={form.nama}
                  onChange={(v) => handleChange("nama", v)}
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Input label="Lokasi" value={form.lokasi} onChange={(v) => handleChange("lokasi", v)} />
                <Input label="Kode Merk" value={form.kode_merk} onChange={(v) => handleChange("kode_merk", v)} />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  label="Kapasitas"
                  value={String(form.kapasitas)}
                  onChange={(v) => handleChange("kapasitas", v)}
                  type="number"
                />
                <Input
                  label="Biaya Sewa Default"
                  value={String(form.biaya_sewa_default)}
                  onChange={(v) => handleChange("biaya_sewa_default", v)}
                  type="number"
                />
                <Input
                  label="Satuan Sewa"
                  value={form.satuan_sewa}
                  onChange={(v) => handleChange("satuan_sewa", v)}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Select
                  label="Disewakan"
                  value={String(form.is_disewakan)}
                  onChange={(v) => handleChange("is_disewakan", Number(v))}
                  options={[
                    { label: "Ya", value: "1" },
                    { label: "Tidak", value: "0" },
                  ]}
                />
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
                  label="Tampil"
                  value={String(form.is_show)}
                  onChange={(v) => handleChange("is_show", Number(v))}
                  options={[
                    { label: "Ya", value: "1" },
                    { label: "Tidak", value: "0" },
                  ]}
                />
              </div>

              <div className="border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Sub Etalase</p>
                    <p className="text-xs text-gray-500">Atur slot/kompartemen pada etalase.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addSub}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
                  >
                    Tambah Sub
                  </button>
                </div>
                {form.subs.length === 0 && <div className="text-xs text-gray-500">Belum ada sub etalase.</div>}
                <div className="space-y-3">
                  {form.subs.map((sub, idx) => (
                    <div key={`${sub.kode_etalase_sub}-${idx}`} className="grid md:grid-cols-5 gap-3">
                      <Input
                        label="Nama Sub"
                        value={sub.nama}
                        onChange={(v) => updateSub(idx, { nama: v })}
                      />
                      <Input
                        label="Posisi"
                        value={sub.posisi || ""}
                        onChange={(v) => updateSub(idx, { posisi: v })}
                      />
                      <Input
                        label="Kapasitas"
                        value={String(sub.kapasitas ?? 0)}
                        onChange={(v) => updateSub(idx, { kapasitas: Number(v) })}
                        type="number"
                      />
                      <Select
                        label="Status"
                        value={String(sub.status ?? 1)}
                        onChange={(v) => updateSub(idx, { status: Number(v) })}
                        options={[
                          { label: "Aktif", value: "1" },
                          { label: "Nonaktif", value: "0" },
                        ]}
                      />
                      <button
                        type="button"
                        onClick={() => removeSub(idx)}
                        className="mt-6 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
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
                  Simpan Etalase
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
