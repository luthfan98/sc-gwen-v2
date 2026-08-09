"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Gift, Pencil, Tag, XCircle } from "lucide-react";

type VoucherProgram = {
  id: string;
  nama_program: string;
  berlaku_from: string;
  berlaku_to: string;
  nominal_voucher: string;
  kode_voucher: string[];
  created_at?: string;
};

const generateVoucherCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
};

export default function PromoVoucherPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<VoucherProgram[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nama_program: "",
    berlaku_from: "",
    berlaku_to: "",
    nominal_voucher: "",
    kode_voucher: [] as string[],
  });

  const resetForm = () => {
    setForm({
      nama_program: "",
      berlaku_from: "",
      berlaku_to: "",
      nominal_voucher: "",
      kode_voucher: [],
    });
  };

  const openCreate = () => {
    resetForm();
    setEditingId(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const openEdit = (row: VoucherProgram) => {
    setEditingId(row.id);
    setForm({
      nama_program: row.nama_program || "",
      berlaku_from: row.berlaku_from ? String(row.berlaku_from).slice(0, 16) : "",
      berlaku_to: row.berlaku_to ? String(row.berlaku_to).slice(0, 16) : "",
      nominal_voucher: row.nominal_voucher ? String(row.nominal_voucher) : "",
      kode_voucher: Array.isArray(row.kode_voucher) ? row.kode_voucher : [],
    });
    setModalOpen(true);
  };

  const handleGenerateVoucher = () => {
    const next = generateVoucherCode();
    setForm((prev) => ({ ...prev, kode_voucher: [...prev.kode_voucher, next] }));
  };

  const handleRemoveVoucher = (code: string) => {
    setForm((prev) => ({ ...prev, kode_voucher: prev.kode_voucher.filter((v) => v !== code) }));
  };

  const canSubmit = useMemo(() => {
    return (
      form.nama_program.trim() &&
      form.berlaku_from.trim() &&
      form.berlaku_to.trim() &&
      form.nominal_voucher.trim() &&
      form.kode_voucher.length > 0
    );
  }, [form]);

  const submitForm = () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const url = editingId
      ? `${API_BASE}/promos/voucher/${encodeURIComponent(editingId)}`
      : `${API_BASE}/promos/voucher`;
    const method = editingId ? "PUT" : "POST";
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama_program: form.nama_program.trim(),
        berlaku_from: form.berlaku_from,
        berlaku_to: form.berlaku_to,
        nominal_voucher: form.nominal_voucher.trim(),
        kode_voucher: form.kode_voucher,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(() => loadList())
      .then(() => {
        setModalOpen(false);
        resetForm();
        setEditingId(null);
      })
      .catch((err: any) => {
        setError(err?.message || "Gagal menyimpan voucher.");
      })
      .finally(() => setSaving(false));
  };

  const loadList = () => {
    setLoading(true);
    setError(null);
    return fetch(`${API_BASE}/promos/voucher`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setPrograms(Array.isArray(data) ? data : []);
      })
      .catch((err: any) => {
        setPrograms([]);
        setError(err?.message || "Gagal memuat data voucher.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadList();
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Program Promosi</p>
          <h1 className="text-2xl font-bold text-gray-900">Voucher</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/master/promosi"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Gift className="w-4 h-4" />
            Master Promosi
          </Link>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <FilePlus2 className="w-4 h-4" />
            Tambah Promosi
          </button>
          <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            <Tag className="w-4 h-4" />
            Voucher
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Daftar Voucher</p>
            <p className="text-base font-semibold text-gray-800">Total {programs.length} program</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FilePlus2 className="w-4 h-4" />
            Tambah Promosi
          </button>
        </div>
        {loading && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-6 text-sm text-gray-500">
            Memuat data...
          </div>
        )}
        {!loading && error && (
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-6 text-sm text-rose-600">
            {error}
          </div>
        )}
        {!loading && !error && programs.length === 0 ? (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-6 text-sm text-gray-500">
            Belum ada program voucher.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
              <tr>
                <th className="px-4 py-3">Nama Program</th>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3">Nominal</th>
                <th className="px-4 py-3">Kode Voucher</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {programs.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{row.nama_program}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.berlaku_from} - {row.berlaku_to}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.nominal_voucher}</td>
                  <td className="px-4 py-3 font-mono text-gray-900">
                    {row.kode_voucher.join(", ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-sm text-gray-500">Form Voucher</p>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? "Edit Promosi" : "Tambah Promosi"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {error}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="text-gray-600">Nama Program Promosi</span>
                  <input
                    value={form.nama_program}
                    onChange={(e) => setForm((prev) => ({ ...prev, nama_program: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    placeholder="Contoh: Voucher Belanja Februari"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Berlaku dari</span>
                  <input
                    type="datetime-local"
                    value={form.berlaku_from}
                    onChange={(e) => setForm((prev) => ({ ...prev, berlaku_from: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-gray-600">Berlaku sampai</span>
                  <input
                    type="datetime-local"
                    value={form.berlaku_to}
                    onChange={(e) => setForm((prev) => ({ ...prev, berlaku_to: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="text-gray-600">Nominal Voucher</span>
                  <input
                    value={form.nominal_voucher}
                    onChange={(e) => setForm((prev) => ({ ...prev, nominal_voucher: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    placeholder="Contoh: 25000"
                  />
                </label>
                <div className="space-y-1 text-sm md:col-span-2">
                  <span className="text-gray-600">Kode Voucher (8 digit)</span>
                  <div className="flex gap-2">
                    <input
                      value={form.kode_voucher[form.kode_voucher.length - 1] || ""}
                      readOnly
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono bg-gray-50"
                      placeholder="Klik tambah voucher"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateVoucher}
                      className="inline-flex items-center justify-center rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
                    >
                      Tambah Voucher
                    </button>
                  </div>
                  {form.kode_voucher.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {form.kode_voucher.map((code, idx) => (
                        <div key={`${code}-${idx}`} className="flex items-center gap-2">
                          <div className="w-8 text-right text-xs font-semibold text-gray-400">{idx + 1}.</div>
                          <input
                            value={code}
                            readOnly
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono bg-gray-50"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveVoucher(code)}
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 whitespace-nowrap"
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitForm}
                disabled={!canSubmit}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
