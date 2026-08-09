"use client";

import { useEffect, useState } from "react";
import { Landmark, ShieldCheck } from "lucide-react";
import Select, { type SingleValue } from "react-select";

type RekeningSupplier = {
  id: number;
  kode_supplier: string;
  nama_supplier: string;
  nama_bank: string;
  no_rekening: string;
  atas_nama: string;
  cabang: string;
  status: number | boolean;
};

type SupplierOption = {
  kode_supplier: string;
  nama_supplier: string;
};

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "/api"}/rekening-supplier`;
const SUPPLIER_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "/api"}/suppliers`;

export default function RekeningSupplierPage() {
  const [items, setItems] = useState<RekeningSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<RekeningSupplier | null>(null);
  const [form, setForm] = useState({
    kode_supplier: "",
    nama_supplier: "",
    nama_bank: "",
    no_rekening: "",
    atas_nama: "",
    cabang: "",
  });

  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier.kode_supplier,
    label: supplier.nama_supplier,
  }));
  const selectedSupplier =
    supplierOptions.find((option) => option.value === form.kode_supplier) || null;

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? (data as RekeningSupplier[]) : []);
    } catch (err) {
      console.error("Failed fetch rekening supplier", err);
      setError("Gagal memuat rekening supplier.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(SUPPLIER_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSuppliers(
        Array.isArray(data)
          ? data.map((row: any) => ({
              kode_supplier: row.kode_supplier,
              nama_supplier: row.nama_supplier || row.nama || row.supplier || "",
            }))
          : []
      );
    } catch (err) {
      console.error("Failed fetch suppliers", err);
      setSuppliers([]);
    }
  };

  const openModal = () => {
    setEditingItem(null);
    setForm({
      kode_supplier: "",
      nama_supplier: "",
      nama_bank: "",
      no_rekening: "",
      atas_nama: "",
      cabang: "",
    });
    setShowModal(true);
  };

  const openEditModal = (item: RekeningSupplier) => {
    setEditingItem(item);
    setForm({
      kode_supplier: item.kode_supplier || "",
      nama_supplier: item.nama_supplier || "",
      nama_bank: item.nama_bank || "",
      no_rekening: item.no_rekening || "",
      atas_nama: item.atas_nama || "",
      cabang: item.cabang || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleSupplierChange = (option: SingleValue<{ value: string; label: string }>) => {
    const value = option?.value || "";
    const selected = suppliers.find((s) => s.kode_supplier === value);
    setForm((prev) => ({
      ...prev,
      kode_supplier: value,
      nama_supplier: selected?.nama_supplier || "",
    }));
  };

  const handleSubmit = async () => {
    if (!form.kode_supplier || !form.nama_bank || !form.no_rekening) {
      setError("Supplier, Nama Bank, dan No Rekening wajib diisi.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}${editingItem ? `/${editingItem.id}` : ""}`, {
        method: editingItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_supplier: form.kode_supplier,
          nama_supplier: form.nama_supplier,
          nama_bank: form.nama_bank,
          no_rekening: form.no_rekening,
          atas_nama: form.atas_nama,
          cabang: form.cabang,
          status: editingItem ? editingItem.status : 1,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
      setShowModal(false);
    } catch (err) {
      console.error("Failed create rekening supplier", err);
      setError("Gagal menambah rekening supplier.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (item: RekeningSupplier, nextStatus: number) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_supplier: item.kode_supplier,
          nama_supplier: item.nama_supplier,
          nama_bank: item.nama_bank,
          no_rekening: item.no_rekening,
          atas_nama: item.atas_nama,
          cabang: item.cabang,
          status: nextStatus,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData();
    } catch (err) {
      console.error("Failed update status rekening supplier", err);
      setError("Gagal memperbarui status rekening supplier.");
    } finally {
      setSaving(false);
    }
  };

  const renderStatus = (status: number | boolean) => {
    const normalized = typeof status === "boolean" ? (status ? 1 : 0) : Number(status ?? 0);
    const isActive = normalized === 1;
    return (
      <span
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
          isActive
            ? "bg-[#3FE0D0]/15 text-[#0f756b] border-[#3FE0D0]/30"
            : "bg-gray-100 text-gray-600 border-gray-200"
        }`}
      >
        {isActive ? "Aktif" : "Nonaktif"}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Kontrabon</p>
          <h1 className="text-2xl font-bold text-gray-900">Rekening Supplier</h1>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f756b] px-6 py-3 text-base font-semibold text-white hover:bg-[#0b5a52] transition"
        >
          + Tambah Rekening
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Rekening Supplier</p>
              <p className="text-base font-semibold text-gray-800">
                {loading ? "Memuat data..." : `Total ${items.length} rekening`}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="w-4 h-4" />
            {loading ? "Memuat..." : "Sinkron server"}
          </div>
        </div>

        {error && (
          <div className="bg-amber-50 border-b border-amber-100 text-amber-800 text-sm px-4 py-3">
            {error}
          </div>
        )}

        <div className="overflow-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Kode Supplier</th>
                <th className="px-4 py-3">Nama Supplier</th>
                <th className="px-4 py-3">Bank</th>
                <th className="px-4 py-3">No Rekening</th>
                <th className="px-4 py-3">Atas Nama</th>
                <th className="px-4 py-3">Cabang</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {items.length === 0 && !loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={9}>
                    Belum ada data rekening supplier.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{item.id}</td>
                    <td className="px-4 py-3 text-gray-800">{item.kode_supplier}</td>
                    <td className="px-4 py-3 text-gray-800">{item.nama_supplier}</td>
                    <td className="px-4 py-3 text-gray-800">{item.nama_bank}</td>
                    <td className="px-4 py-3 text-gray-800">{item.no_rekening}</td>
                    <td className="px-4 py-3 text-gray-800">{item.atas_nama}</td>
                    <td className="px-4 py-3 text-gray-800">{item.cabang}</td>
                    <td className="px-4 py-3">
                      <select
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                          Number(item.status ?? 1) === 1
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                        value={Number(item.status ?? 1)}
                        onChange={(e) => handleUpdateStatus(item, Number(e.target.value))}
                        disabled={saving}
                      >
                        <option value={1}>Aktif</option>
                        <option value={0}>Nonaktif</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#0f756b] text-white">
                +
              </span>
              {editingItem ? "Edit Data" : "Tambah Data"}
            </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-600">Supplier</label>
                <Select
                  instanceId="rekening-supplier-select"
                  options={supplierOptions}
                  value={selectedSupplier}
                  onChange={handleSupplierChange}
                  placeholder="Pilih Supplier"
                  isClearable
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: 44,
                      borderRadius: 8,
                      borderColor: "#e5e7eb",
                      boxShadow: "none",
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      padding: "0 12px",
                    }),
                    input: (base) => ({
                      ...base,
                      margin: 0,
                      padding: 0,
                    }),
                    indicatorsContainer: (base) => ({
                      ...base,
                      height: 44,
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 60,
                    }),
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-600">Pemilik Rekening</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  value={form.nama_supplier}
                  onChange={(e) => setForm((prev) => ({ ...prev, nama_supplier: e.target.value }))}
                  placeholder="Nama pemilik rekening"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-600">Nama Bank</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  value={form.nama_bank}
                  onChange={(e) => setForm((prev) => ({ ...prev, nama_bank: e.target.value }))}
                  placeholder="Nama bank"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-600">No Rekening</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  value={form.no_rekening}
                  onChange={(e) => setForm((prev) => ({ ...prev, no_rekening: e.target.value }))}
                  placeholder="Nomor rekening"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-600">Atas Nama</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  value={form.atas_nama}
                  onChange={(e) => setForm((prev) => ({ ...prev, atas_nama: e.target.value }))}
                  placeholder="Atas nama"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-600">Cabang</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  value={form.cabang}
                  onChange={(e) => setForm((prev) => ({ ...prev, cabang: e.target.value }))}
                  placeholder="Cabang"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600"
                disabled={saving}
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Menyimpan..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
