"use client";

import { useEffect, useMemo, useState } from "react";
import { Phone, Plus, RefreshCcw, Search, X } from "lucide-react";
import Select from "react-select";
import Swal from "sweetalert2";

type ContactRow = {
  id_contact: number;
  kode_supplier: string | null;
  nama_supplier?: string | null;
  nama: string | null;
  jabatan: string | null;
  tipe: string | null;
  nilai: string | null;
  label: string | null;
  is_active: boolean | number | null;
  created_at?: string | null;
};

type SupplierOption = {
  kode_supplier: string;
  nama: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

export default function MasterKontakSupplierPage() {
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    kode_supplier: "",
    nama: "",
    jabatan: "",
    tipe: "WA",
    nilai: "",
    label: "",
    is_active: true,
  });
  const [supplierOption, setSupplierOption] = useState<{ value: string; label: string } | null>(null);

  const fetchContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (showActiveOnly) params.set("active", "1");
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`${API_BASE}/suppliers/contacts?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed fetch supplier contacts", err);
      setError("Gagal memuat kontak supplier.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [showActiveOnly]);

  const fetchSuppliers = async () => {
    setSupplierLoading(true);
    try {
      const res = await fetch(`${API_BASE}/suppliers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const mapped = Array.isArray(data)
        ? data
            .map((row: any) => ({
              kode_supplier: String(row.kode_supplier || "").trim(),
              nama: String(row.nama || row.nama_supplier || row.supplier || "").trim(),
            }))
            .filter((row: SupplierOption) => row.kode_supplier)
        : [];
      setSuppliers(mapped);
    } catch (err) {
      console.error("Failed fetch suppliers", err);
      setSuppliers([]);
    } finally {
      setSupplierLoading(false);
    }
  };

  const openModal = () => {
    setForm({
      kode_supplier: "",
      nama: "",
      jabatan: "",
      tipe: "WA",
      nilai: "",
      label: "",
      is_active: true,
    });
    setSupplierOption(null);
    setShowModal(true);
    if (suppliers.length === 0) {
      fetchSuppliers();
    }
  };

  const handleSave = async () => {
    if (!form.kode_supplier) {
      setError("Supplier wajib dipilih.");
      return;
    }
    if (!form.nama.trim()) {
      setError("Nama kontak wajib diisi.");
      return;
    }
    if (!form.tipe.trim()) {
      setError("Tipe kontak wajib diisi.");
      return;
    }
    if (!form.nilai.trim()) {
      setError("Nilai kontak wajib diisi.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/suppliers/${encodeURIComponent(form.kode_supplier)}/contacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nama: form.nama.trim(),
            jabatan: form.jabatan.trim() || null,
            tipe: form.tipe.trim(),
            nilai: form.nilai.trim(),
            label: form.label.trim() || null,
            is_active: form.is_active ? 1 : 0,
            created_by: "Admin",
            updated_by: "Admin",
          }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowModal(false);
      fetchContacts();
      await Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Kontak supplier berhasil disimpan.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Failed create contact", err);
      setError("Gagal menambahkan kontak supplier.");
    } finally {
      setSaving(false);
    }
  };

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.kode_supplier, label: s.nama || s.kode_supplier })),
    [suppliers]
  );

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const key = search.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = [
        row.kode_supplier,
        row.nama_supplier,
        row.nama,
        row.jabatan,
        row.tipe,
        row.nilai,
        row.label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(key);
    });
  }, [rows, search]);

  const activeBadge = (isActive: boolean | number | null) => {
    const active = Number(isActive ?? 0) === 1;
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
          active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
        }`}
      >
        {active ? "Aktif" : "Nonaktif"}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Kontak Supplier</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchContacts}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Tambah Kontak
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="h-4 w-4" />
            Total kontak: <span className="font-semibold">{filteredRows.length}</span>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kontak/supplier..."
                className="w-64 max-w-full outline-none text-sm"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600"
              />
              Tampilkan aktif saja
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Supplier</th>
                <th className="px-4 py-3 text-left">Kontak</th>
                <th className="px-4 py-3 text-left">Jabatan</th>
                <th className="px-4 py-3 text-left">Tipe</th>
                <th className="px-4 py-3 text-left">Nilai</th>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Dibuat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-rose-600">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    Tidak ada kontak supplier.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filteredRows.map((row) => (
                  <tr key={row.id_contact} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{row.kode_supplier || "-"}</div>
                      <div className="text-xs text-gray-500">{row.nama_supplier || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{row.nama || "-"}</td>
                    <td className="px-4 py-3 text-gray-700">{row.jabatan || "-"}</td>
                    <td className="px-4 py-3 text-gray-700">{row.tipe || "-"}</td>
                    <td className="px-4 py-3 text-gray-700">{row.nilai || "-"}</td>
                    <td className="px-4 py-3 text-gray-700">{row.label || "-"}</td>
                    <td className="px-4 py-3">{activeBadge(row.is_active)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(row.created_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Tambah Kontak Supplier</p>
                <h2 className="text-lg font-semibold text-gray-900">Kontak Baru</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {error && <div className="text-sm text-rose-600">{error}</div>}
              <label className="block text-sm text-gray-700">
                Supplier
                <div className="mt-1">
                  <Select
                    options={supplierOptions}
                    value={supplierOption}
                    onChange={(opt) => {
                      setSupplierOption(opt);
                      setForm((prev) => ({ ...prev, kode_supplier: opt?.value || "" }));
                    }}
                    placeholder={supplierLoading ? "Memuat supplier..." : "Pilih supplier"}
                    isLoading={supplierLoading}
                    isClearable
                    classNamePrefix="react-select"
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: 40,
                        height: 40,
                        borderColor: "#e5e7eb",
                        boxShadow: "none",
                      }),
                      valueContainer: (base) => ({
                        ...base,
                        paddingTop: 0,
                        paddingBottom: 0,
                        height: 40,
                      }),
                      input: (base) => ({
                        ...base,
                        margin: 0,
                        padding: 0,
                      }),
                      indicatorsContainer: (base) => ({
                        ...base,
                        height: 40,
                      }),
                    }}
                  />
                </div>
              </label>
              <label className="block text-sm text-gray-700">
                Nama Kontak
                <input
                  value={form.nama}
                  onChange={(e) => setForm((prev) => ({ ...prev, nama: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  placeholder="Nama kontak"
                />
              </label>
              <label className="block text-sm text-gray-700">
                Jabatan
                <input
                  value={form.jabatan}
                  onChange={(e) => setForm((prev) => ({ ...prev, jabatan: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  placeholder="Jabatan"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm text-gray-700">
                  Tipe
                  <select
                    value={form.tipe}
                    onChange={(e) => setForm((prev) => ({ ...prev, tipe: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="WA">WA</option>
                    <option value="PHONE">PHONE</option>
                    <option value="EMAIL">EMAIL</option>
                  </select>
                </label>
                <label className="block text-sm text-gray-700">
                  Nilai
                  <input
                    value={form.nilai}
                    onChange={(e) => setForm((prev) => ({ ...prev, nilai: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                    placeholder="Nomor/Email"
                  />
                </label>
              </div>
              <label className="block text-sm text-gray-700">
                Label
                <input
                  value={form.label}
                  onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  placeholder="Label (opsional)"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600"
                />
                Aktif
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
