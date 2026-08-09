"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Barcode, Plus, Printer, RefreshCw, Search, X, Edit3 } from "lucide-react";
import JsBarcode from "jsbarcode";

type VarianRow = {
  id_barcode_manual: number;
  barcode: string;
  nama_item: string;
  created_by?: string | null;
  created_at?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const API_URL = `${API_BASE}/barcode-manual`;

export default function BarcodeGeneratorPage() {
  const [items, setItems] = useState<VarianRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [qtyMap, setQtyMap] = useState<Record<number, number>>({});
  const [showModal, setShowModal] = useState(false);
  const [formBarcode, setFormBarcode] = useState("");
  const [formNama, setFormNama] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editBarcode, setEditBarcode] = useState("");
  const [editNama, setEditNama] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? (data as VarianRow[]) : []);
    } catch (err) {
      console.error("Failed fetch varian", err);
      setItems([]);
      setError("Gagal memuat data varian.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      return (
        String(item.nama_item || "").toLowerCase().includes(term) ||
        String(item.barcode || "").toLowerCase().includes(term)
      );
    });
  }, [items, query]);

  const selectedItems = useMemo(
    () => items.filter((item) => selected.has(item.id_barcode_manual)),
    [items, selected]
  );

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setQty = (id: number, value: number) => {
    const safeValue = Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
    setQtyMap((prev) => ({ ...prev, [id]: safeValue }));
  };

  const selectAllFiltered = () => {
    setSelected(new Set(filteredItems.map((item) => item.id_barcode_manual)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const resetForm = () => {
    setFormBarcode("");
    setFormNama("");
  };

  const openEdit = (item: VarianRow) => {
    setEditId(item.id_barcode_manual);
    setEditBarcode(item.barcode || "");
    setEditNama(item.nama_item || "");
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditId(null);
    setEditBarcode("");
    setEditNama("");
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_URL}/generate`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFormBarcode(String(data?.barcode || ""));
    } catch (err) {
      console.error("Failed generate barcode", err);
      setFormBarcode("");
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!formBarcode.trim() || !formNama.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: formBarcode.trim(),
          nama_item: formNama.trim(),
          created_by: "Admin",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      const created = await res.json();
      setItems((prev) => [created, ...prev]);
      resetForm();
      setShowModal(false);
    } catch (err) {
      console.error("Failed create barcode manual", err);
      alert(err instanceof Error ? err.message : "Gagal membuat barcode manual.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editId || !editNama.trim()) return;
    setEditSaving(true);
    try {
      const res = await fetch(`${API_URL}/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_item: editNama.trim(),
          updated_by: "Admin",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setItems((prev) =>
        prev.map((row) => (row.id_barcode_manual === editId ? { ...row, ...updated } : row))
      );
      closeEdit();
    } catch (err) {
      console.error("Failed update barcode manual", err);
      alert(err instanceof Error ? err.message : "Gagal update barcode manual.");
    } finally {
      setEditSaving(false);
    }
  };

  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const buildBarcodeSvg = (value: string) => {
    try {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(svg, value, {
        format: "CODE128",
        displayValue: false,
        height: 48,
        margin: 0,
      });
      return svg.outerHTML;
    } catch (err) {
      console.error("Failed build barcode svg", err);
      return "";
    }
  };

  const handlePrint = () => {
    if (selectedItems.length === 0) return;
    const labelItems = selectedItems.flatMap((item) => {
      const qty = qtyMap[item.id_barcode_manual] ?? 1;
      return Array.from({ length: Math.max(1, qty) }, () => item);
    });

    const labelsHtml = labelItems
      .map((item) => {
        const barcodeValue = item.barcode || "-";
        const barcodeSvg = barcodeValue !== "-" ? buildBarcodeSvg(barcodeValue) : "";
        return `
          <div class="label">
            <div class="barcode-svg">${barcodeSvg || ""}</div>
            <div class="barcode-text">${escapeHtml(String(barcodeValue))}</div>
            <div class="name">${escapeHtml(item.nama_item || "-")}</div>
          </div>
        `;
      })
      .join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode</title>
          <style>
            @page { size: A4; margin: 0; }
            body { font-family: "Arial", sans-serif; margin: 0; padding-top: 2mm; display: flex; justify-content: flex-start; }
            .sheet {
              width: 20cm;
              height: 29.7cm;
              padding: 0mm 3.5mm;
              box-sizing: border-box;
              border: 0px solid #fff;
              display: grid;
              grid-template-columns: repeat(5, 3.8cm);
              grid-template-rows: repeat(8, 1.8cm);
              justify-content: space-between;
              column-gap: 2mm;
              row-gap: 2mm;
            }
            .label {
              width: 3.8cm;
              height: 1.8cm;
              border: 1px solid #fff;
              border-radius: 4px;
              padding: 2px 4px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              box-sizing: border-box;
            }
            .name { font-size: 7px; font-weight: 600; color: #111827; text-align: center; }
            .barcode-svg {
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .barcode-svg svg { width: 100%; height: 100%; }
            .barcode-text { font-size: 8px; letter-spacing: 0.6px; margin-bottom: 0; margin-top: 1px; }
            @media print {
              .label { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">${labelsHtml}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-4 md:p-6 space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-600">Master</p>
            <h1 className="text-2xl font-semibold text-gray-900">Buat Barcode</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/master/barang"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Link>
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <Plus className="w-4 h-4" />
            Tambah Barcode Manual
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Cetak Barcode
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama item atau barcode..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            type="button"
            onClick={selectAllFiltered}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Pilih semua
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Bersihkan
          </button>
        </div>
        <div className="text-sm text-gray-500">
          Terpilih: {selected.size} item
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between text-sm">
          <p className="text-gray-600">Daftar Varian</p>
          <p className="text-gray-500">Total: {filteredItems.length}</p>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 w-12">Pilih</th>
                <th className="px-4 py-2">Barcode</th>
                <th className="px-4 py-2">Nama Item</th>
                <th className="px-4 py-2">Qty Label</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-rose-600">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Tidak ada barcode manual.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filteredItems.map((item) => {
                  const isChecked = selected.has(item.id_barcode_manual);
                  const qty = qtyMap[item.id_barcode_manual] ?? 1;
                  const barcodeValue = item.barcode || "-";
                  return (
                    <tr key={item.id_barcode_manual} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(item.id_barcode_manual)}
                        />
                      </td>
                      <td className="px-4 py-2 text-gray-600">{barcodeValue}</td>
                      <td className="px-4 py-2 text-gray-700">{item.nama_item || "-"}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={1}
                          value={qty}
                          onChange={(e) => setQty(item.id_barcode_manual, Number(e.target.value))}
                          className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Tambah Barcode Manual</h2>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Barcode</label>
                <div className="flex items-center gap-2">
                  <input
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="Masukkan barcode manual"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Nama Item</label>
                <input
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Masukkan nama item barang"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || !formBarcode.trim() || !formNama.trim()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Buat"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit Nama Item</h2>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Barcode</label>
                <input
                  value={editBarcode}
                  disabled
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-gray-600"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Nama Item</label>
                <input
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  placeholder="Masukkan nama item barang"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={editSaving || !editNama.trim()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {editSaving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
