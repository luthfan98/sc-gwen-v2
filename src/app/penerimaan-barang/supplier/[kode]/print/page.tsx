"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Header = {
  kode_t_penerimaan_pengadaan: string;
  kode_t_pengadaan: string;
  kode_supplier?: string | null;
  supplier_nama?: string | null;
  kode_gudang?: string | null;
  tgl?: string | null;
};

type DetailItem = {
  kode_d_penerimaan_pengadaan: string;
  kode_barang?: string | null;
  barcode_varian?: string | null;
  nama_barang?: string | null;
  nama_varian?: string | null;
  catatan?: string | null;
  kode_h_stok_barang?: string | null;
  kode_gudang?: string | null;
  jml_baik_dikirim?: number | null;
  qty_masuk?: number | null;
  jml_baik_diterima?: number | null;
  jml_rusak_diterima?: number | null;
  satuan_jml_baik?: string | null;
};

export default function PenerimaanSupplierPrintPage() {
  const params = useParams<{ kode: string }>();
  const searchParams = useSearchParams();
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const kode = decodeURIComponent(params?.kode ?? "");
  const isEdit = searchParams?.get("edit") === "true";
  const [header, setHeader] = useState<Header | null>(null);
  const [items, setItems] = useState<DetailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editBarcodeOpen, setEditBarcodeOpen] = useState(false);
  const [editNamaOpen, setEditNamaOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DetailItem | null>(null);
  const [editBarcodeValue, setEditBarcodeValue] = useState("");
  const [editNamaValue, setEditNamaValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [syncAllError, setSyncAllError] = useState<string | null>(null);

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(kode)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHeader(data?.header || null);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError("Gagal memuat detail penerimaan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!kode) return;
    fetchDetail();
  }, [API_BASE, kode]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, it) => {
        acc.dikirim += Number(it.jml_baik_dikirim ?? 0);
        acc.masuk += Number(it.qty_masuk ?? 0);
        acc.diterima += Number(it.jml_baik_diterima ?? 0);
        acc.rusak += Number(it.jml_rusak_diterima ?? 0);
        return acc;
      },
      { dikirim: 0, masuk: 0, diterima: 0, rusak: 0 }
    );
  }, [items]);

  const duplicateVarian = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const key = String(item.kode_barang || "").trim();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const dup = new Set<string>();
    counts.forEach((count, key) => {
      if (count > 1) dup.add(key);
    });
    return dup;
  }, [items]);

  const getUsername = () => {
    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let username = "Admin";
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        username = parsed?.username || parsed?.name || username;
      } catch {
        // ignore parse error
      }
    }
    return username;
  };

  const handleSaveBarcode = async () => {
    if (!editTarget?.kode_barang || editSaving) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(kode)}/items/barcode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_barang_variant: editTarget.kode_barang,
          barcode_varian: editBarcodeValue.trim() || null,
          updated_by: getUsername(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) =>
        prev.map((it) =>
          it.kode_d_penerimaan_pengadaan === editTarget.kode_d_penerimaan_pengadaan
            ? { ...it, barcode_varian: editBarcodeValue.trim() || null }
            : it
        )
      );
      setEditBarcodeOpen(false);
      setEditTarget(null);
    } catch (err) {
      setEditError("Gagal menyimpan barcode.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleSaveNamaVarian = async () => {
    if (!editTarget?.kode_barang || editSaving) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(kode)}/items/nama-varian`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_barang_variant: editTarget.kode_barang,
          nama_varian: editNamaValue.trim() || null,
          updated_by: getUsername(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) =>
        prev.map((it) =>
          it.kode_d_penerimaan_pengadaan === editTarget.kode_d_penerimaan_pengadaan
            ? { ...it, nama_varian: editNamaValue.trim() || null }
            : it
        )
      );
      setEditNamaOpen(false);
      setEditTarget(null);
    } catch (err) {
      setEditError("Gagal menyimpan nama varian.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleSyncAllWithPurchase = async () => {
    if (syncAllLoading) return;
    setSyncAllLoading(true);
    setSyncAllError(null);
    try {
      const res = await fetch(
        `${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(kode)}/items/sync-purchase-all`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updated_by: getUsername() }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchDetail();
    } catch (err) {
      setSyncAllError("Gagal menyamakan semua item dengan purchase.");
    } finally {
      setSyncAllLoading(false);
    }
  };

  if (!kode) {
    return <div className="p-6 text-sm text-gray-600">Kode pengadaan tidak valid.</div>;
  }

  return (
    <div className="p-6 text-gray-900">
      <div className="max-w-5xl mx-auto space-y-4 print:max-w-none print:m-0">
        <div className="flex items-center justify-end gap-2 print:hidden">
          {isEdit && (
            <button
              type="button"
              onClick={handleSyncAllWithPurchase}
              disabled={syncAllLoading}
              className="px-4 py-2 rounded-md bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-60"
            >
              Samakan Dengan Purchase
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            Print
          </button>
        </div>

        <div className="print-area space-y-4">
          {loading && (
            <div className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              Memuat data penerimaan...
            </div>
          )}
          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {syncAllError && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {syncAllError}
            </div>
          )}

          <div className="bg-white border border-gray-300 rounded-xl p-4 shadow-sm">
            <div className="text-center border-b border-gray-200 pb-2 mb-3">
              <div className="text-xs uppercase tracking-[0.3em] text-gray-500">Penerimaan Barang Supplier</div>
              <div className="text-xl font-bold text-gray-900">Penerimaan Barang Supplier</div>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-700 flex-1">
                <div>Kode Penerimaan: <span className="font-semibold">{header?.kode_t_penerimaan_pengadaan || "-"}</span></div>
                <div>Kode PO: <span className="font-semibold">{header?.kode_t_pengadaan || kode}</span></div>
                <div>Supplier: <span className="font-semibold">{header?.supplier_nama || header?.kode_supplier || "-"}</span></div>
                <div>Gudang: <span className="font-semibold">{header?.kode_gudang || "-"}</span></div>
                <div>Tanggal: <span className="font-semibold">{header?.tgl ? String(header.tgl).slice(0, 10) : "-"}</span></div>
              </div>
              {header?.kode_t_penerimaan_pengadaan && (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                    header.kode_t_penerimaan_pengadaan
                  )}`}
                  alt="QR Penerimaan"
                  className="h-20 w-20 object-contain border border-gray-300 bg-white"
                />
              )}
            </div>
          </div>

          <div className="border border-gray-400 rounded-lg overflow-hidden bg-white">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-100 border-b border-gray-400">
                <tr>
                  <th className="px-2 py-2 text-left w-10 border-r border-gray-300">No</th>
                  <th className="px-2 py-2 text-left border-r border-gray-300">Barcode</th>
                  <th className="px-2 py-2 text-left border-r border-gray-300">Nama Barang</th>
                  <th className="px-2 py-2 text-left border-r border-gray-300">Nama Varian</th>
                  <th className="px-2 py-2 text-left border-r border-gray-300">Catatan</th>
                  <th className="px-2 py-2 text-left border-r border-gray-300">History Stok</th>
                  <th className="px-2 py-2 text-left border-r border-gray-300">Kode Gudang</th>
                  <th className="px-2 py-2 text-right border-r border-gray-300">Qty Dikirim</th>
                  {isEdit && (
                    <th className="px-2 py-2 text-right border-r border-gray-300">Qty Masuk</th>
                  )}
                  <th className="px-2 py-2 text-right border-r border-gray-300">Qty Baik</th>
                  <th className="px-2 py-2 text-right">Qty Rusak</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const isDuplicate = duplicateVarian.has(String(item.kode_barang || "").trim());
                  const qtyMismatch =
                    Number(item.qty_masuk ?? 0) !== Number(item.jml_baik_diterima ?? 0);
                  return (
                    <tr
                      key={item.kode_d_penerimaan_pengadaan}
                      className={`border-b border-gray-200 ${
                        isDuplicate ? "bg-red-200" : qtyMismatch ? "bg-pink-100" : ""
                      }`}
                    >
                    <td className="px-2 py-2 text-center border-r border-gray-200">{idx + 1}</td>
                    <td className="px-2 py-2 border-r border-gray-200">
                      <div className="flex items-center gap-2">
                        <span>{item.barcode_varian || "-"}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditTarget(item);
                            setEditBarcodeValue(item.barcode_varian || "");
                            setEditError(null);
                            setEditBarcodeOpen(true);
                          }}
                          className="print:hidden inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Ubah
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200">{item.nama_barang || "-"}</td>
                    <td className="px-2 py-2 border-r border-gray-200">
                      <div className="flex items-center gap-2">
                        <span>{item.nama_varian || "-"}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditTarget(item);
                            setEditNamaValue(item.nama_varian || "");
                            setEditError(null);
                            setEditNamaOpen(true);
                          }}
                          className="print:hidden inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Ubah
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200">{item.catatan || "-"}</td>
                    <td className="px-2 py-2 border-r border-gray-200">
                      {item.kode_h_stok_barang ? item.kode_h_stok_barang : "Belum"}
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200">{item.kode_gudang || "-"}</td>
                    <td className="px-2 py-2 text-right border-r border-gray-200">
                      {Number(item.jml_baik_dikirim ?? 0)} {item.satuan_jml_baik || "PCS"}
                    </td>
                    {isEdit && (
                      <td className="px-2 py-2 text-right border-r border-gray-200">
                        {Number(item.qty_masuk ?? 0)} {item.satuan_jml_baik || "PCS"}
                      </td>
                    )}
                    <td className="px-2 py-2 text-right border-r border-gray-200">
                      {Number(item.jml_baik_diterima ?? 0)} {item.satuan_jml_baik || "PCS"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {Number(item.jml_rusak_diterima ?? 0)} {item.satuan_jml_baik || "PCS"}
                    </td>
                    </tr>
                  );
                })}
                {items.length === 0 && !loading && (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={isEdit ? 11 : 10}>
                      Tidak ada item.
                    </td>
                  </tr>
                )}
              </tbody>
              {items.length > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-300">
                  <tr>
                    <td className="px-2 py-2 font-semibold text-right" colSpan={7}>
                      Total
                    </td>
                    <td className="px-2 py-2 text-right font-semibold">{totals.dikirim}</td>
                    {isEdit && <td className="px-2 py-2 text-right font-semibold">{totals.masuk}</td>}
                    <td className="px-2 py-2 text-right font-semibold">{totals.diterima}</td>
                    <td className="px-2 py-2 text-right font-semibold">{totals.rusak}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="text-center text-xs text-gray-700">
              <div className="mb-12">Kepala Gudang</div>
              <div className="border-t border-gray-300 pt-1 min-w-[160px]">(__________________)</div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: #fff;
          }
          body * {
            visibility: hidden;
          }
          .print-area,
          .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      {editBarcodeOpen && editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 print:hidden">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Ubah Barcode</p>
                <p className="text-sm font-semibold text-gray-900">{editTarget.nama_barang || "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditBarcodeOpen(false);
                  setEditTarget(null);
                  setEditError(null);
                }}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {editError && <div className="text-xs text-rose-600">{editError}</div>}
              <label className="block text-xs text-gray-600">
                Barcode baru
                <input
                  type="text"
                  value={editBarcodeValue}
                  onChange={(e) => setEditBarcodeValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditBarcodeOpen(false);
                    setEditTarget(null);
                    setEditError(null);
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveBarcode}
                  disabled={editSaving}
                  className="px-3 py-2 rounded-lg bg-[#0f756b] text-white text-sm font-semibold hover:bg-[#0d6a62] disabled:opacity-60"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editNamaOpen && editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 print:hidden">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Ubah Nama Varian</p>
                <p className="text-sm font-semibold text-gray-900">{editTarget.nama_barang || "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditNamaOpen(false);
                  setEditTarget(null);
                  setEditError(null);
                }}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {editError && <div className="text-xs text-rose-600">{editError}</div>}
              <label className="block text-xs text-gray-600">
                Nama varian baru
                <input
                  type="text"
                  value={editNamaValue}
                  onChange={(e) => setEditNamaValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditNamaOpen(false);
                    setEditTarget(null);
                    setEditError(null);
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveNamaVarian}
                  disabled={editSaving}
                  className="px-3 py-2 rounded-lg bg-[#0f756b] text-white text-sm font-semibold hover:bg-[#0d6a62] disabled:opacity-60"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
