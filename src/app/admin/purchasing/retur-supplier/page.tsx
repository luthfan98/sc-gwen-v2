"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, RotateCcw, Search, XCircle } from "lucide-react";

type ReturSupplierHeader = {
  kode_t_retur_supplier: string;
  kode_t_pengadaan?: string | null;
  tgl?: string | null;
  kode_supplier?: string | null;
  nama_supplier?: string | null;
  kode_gudang?: string | null;
  nama_gudang?: string | null;
  catatan?: string | null;
  status_retur?: string | null;
  total_item?: number | null;
  total_qty?: number | null;
  total_nominal?: number | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ReturSupplierDetailItem = {
  kode_d_retur_supplier: string;
  kode_t_retur_supplier: string;
  kode_t_pengadaan?: string | null;
  kode_d_pengadaan?: string | null;
  kode_gudang?: string | null;
  kode_barang_variant?: string | null;
  barcode_varian?: string | null;
  nama_barang?: string | null;
  nama_varian?: string | null;
  qty?: number | null;
  satuan?: string | null;
  harga_beli?: number | null;
  subtotal?: number | null;
  alasan_retur?: string | null;
  is_batal_retur?: boolean | number | null;
  batal_retur_by?: string | null;
  batal_retur_at?: string | null;
  alasan_batal_retur?: string | null;
};

type ReturSupplierDetailResponse = {
  header: ReturSupplierHeader;
  items: ReturSupplierDetailItem[];
};

const formatIDR = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("id-ID");
};

export default function ReturSupplierPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [rows, setRows] = useState<ReturSupplierHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedKode, setSelectedKode] = useState<string>("");
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState<ReturSupplierDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelDetail, setCancelDetail] = useState<ReturSupplierDetailResponse | null>(null);
  const [selectedCancelItems, setSelectedCancelItems] = useState<string[]>([]);
  const [loadingCancelDetail, setLoadingCancelDetail] = useState(false);
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [errorCancel, setErrorCancel] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState("");

  const loadHeaders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/retur-supplier`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      if (list.length === 0) {
        setSelectedKode("");
        setDetail(null);
        setShowDetail(false);
        return;
      }
      setSelectedKode((prev) =>
        list.some((item) => String(item?.kode_t_retur_supplier || "") === prev) ? prev : ""
      );
    } catch (err) {
      console.error("Failed fetch retur supplier", err);
      setError("Gagal memuat list retur supplier.");
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    loadHeaders();
  }, [loadHeaders]);

  useEffect(() => {
    const kode = String(selectedKode || "").trim();
    if (!kode || !showDetail) return;
    const fetchDetail = async () => {
      setLoadingDetail(true);
      setErrorDetail(null);
      try {
        const res = await fetch(`${API_BASE}/retur-supplier/${encodeURIComponent(kode)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setDetail({
          header: data?.header || null,
          items: Array.isArray(data?.items) ? data.items : [],
        });
      } catch (err) {
        console.error("Failed fetch detail retur supplier", err);
        setErrorDetail("Gagal memuat detail retur supplier.");
        setDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [API_BASE, selectedKode, showDetail]);

  const openCancelModal = useCallback(
    async (kode: string) => {
      const cleanKode = String(kode || "").trim();
      if (!cleanKode) return;
      setSelectedKode(cleanKode);
      setShowCancel(true);
      setCancelDetail(null);
      setSelectedCancelItems([]);
      setCancelNote("");
      setErrorCancel(null);
      setLoadingCancelDetail(true);
      try {
        const res = await fetch(`${API_BASE}/retur-supplier/${encodeURIComponent(cleanKode)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const nextDetail = {
          header: data?.header || null,
          items: Array.isArray(data?.items) ? data.items : [],
        };
        setCancelDetail(nextDetail);
      } catch (err) {
        console.error("Failed fetch cancel retur supplier detail", err);
        setErrorCancel("Gagal memuat item retur supplier.");
      } finally {
        setLoadingCancelDetail(false);
      }
    },
    [API_BASE]
  );

  const submitCancelItems = useCallback(async () => {
    const kode = String(cancelDetail?.header?.kode_t_retur_supplier || selectedKode || "").trim();
    if (!kode || selectedCancelItems.length === 0) {
      setErrorCancel("Pilih minimal 1 item yang ingin dibatalkan.");
      return;
    }
    setSubmittingCancel(true);
    setErrorCancel(null);
    try {
      const res = await fetch(`${API_BASE}/retur-supplier/${encodeURIComponent(kode)}/cancel-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_codes: selectedCancelItems,
          alasan: cancelNote,
          canceled_by: "Admin",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setShowCancel(false);
      setCancelDetail(null);
      setSelectedCancelItems([]);
      await loadHeaders();
      if (showDetail && selectedKode === kode) {
        setDetail(null);
        setShowDetail(false);
      }
    } catch (err) {
      console.error("Failed cancel retur supplier items", err);
      setErrorCancel(err instanceof Error ? err.message : "Gagal membatalkan item retur supplier.");
    } finally {
      setSubmittingCancel(false);
    }
  }, [API_BASE, cancelDetail, cancelNote, loadHeaders, selectedCancelItems, selectedKode, showDetail]);

  const filteredRows = useMemo(() => {
    const key = search.trim().toLowerCase();
    if (!key) return rows;
    return rows.filter((row) => {
      const kode = String(row.kode_t_retur_supplier || "").toLowerCase();
      const supplier = String(row.nama_supplier || "").toLowerCase();
      const kodeSupplier = String(row.kode_supplier || "").toLowerCase();
      const gudang = String(row.nama_gudang || "").toLowerCase();
      const kodeGudang = String(row.kode_gudang || "").toLowerCase();
      return (
        kode.includes(key) ||
        supplier.includes(key) ||
        kodeSupplier.includes(key) ||
        gudang.includes(key) ||
        kodeGudang.includes(key)
      );
    });
  }, [rows, search]);

  const summary = useMemo(() => {
    const totalDokumen = rows.length;
    const totalItem = rows.reduce((sum, row) => sum + Number(row.total_item ?? 0), 0);
    const totalQty = rows.reduce((sum, row) => sum + Number(row.total_qty ?? 0), 0);
    const totalNominal = rows.reduce((sum, row) => sum + Number(row.total_nominal ?? 0), 0);
    return { totalDokumen, totalItem, totalQty, totalNominal };
  }, [rows]);

  const cancelableItems = useMemo(
    () => (cancelDetail?.items || []).filter((item) => Number(item.is_batal_retur || 0) !== 1),
    [cancelDetail]
  );

  return (
    <div className="w-full space-y-6 px-1 py-4 sm:px-2 lg:px-2">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Retur ke Supplier</h1>
            <p className="text-sm text-slate-500">
              Data real retur supplier dengan struktur header dan detail item.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/purchasing/retur-supplier/new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white hover:bg-cyan-700"
          >
            <Plus className="h-4 w-4" />
            Tambah Retur
          </Link>
          <button
            type="button"
            onClick={loadHeaders}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Dokumen</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.totalDokumen}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Item Baris</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.totalItem}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Qty Retur</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.totalQty}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Nominal</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatIDR(summary.totalNominal)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari kode / supplier"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 text-right font-medium">No</th>
                <th className="px-4 py-3 font-medium">Kode Retur</th>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Gudang</th>
                <th className="px-4 py-3 text-right font-medium">Item</th>
                <th className="px-4 py-3 text-right font-medium">Qty</th>
                <th className="px-4 py-3 text-right font-medium">Nominal</th>
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    Belum ada data retur supplier.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filteredRows.map((row, index) => {
                  const kode = String(row.kode_t_retur_supplier || "");
                  const isActive = showDetail && selectedKode === kode;
                  return (
                    <tr
                      key={kode}
                      className={`hover:bg-slate-50 ${isActive ? "bg-cyan-50/60" : ""}`}
                    >
                      <td className="px-4 py-3 text-right text-slate-600">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{kode}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(row.tgl)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <p className="font-medium text-slate-900">{row.nama_supplier || "-"}</p>
                        <p className="text-xs text-slate-500">{row.kode_supplier || "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <p className="font-medium text-slate-900">{row.nama_gudang || "-"}</p>
                        <p className="text-xs text-slate-500">{row.kode_gudang || "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{Number(row.total_item ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{Number(row.total_qty ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatIDR(Number(row.total_nominal ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedKode(kode);
                              setDetail(null);
                              setErrorDetail(null);
                              setShowDetail(true);
                            }}
                            className="inline-flex h-8 items-center rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-xs font-medium text-cyan-700 hover:bg-cyan-100"
                          >
                            Detail
                          </button>
                          <button
                            type="button"
                            onClick={() => openCancelModal(kode)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 hover:bg-rose-100"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Batal Retur
                          </button>
                          <Link
                            href={`/admin/purchasing/retur-supplier/print/${encodeURIComponent(kode)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Print
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (loadingCancelDetail || submittingCancel) return;
              setShowCancel(false);
            }}
          />
          <section className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Batal Retur Item</h2>
                <p className="text-xs text-slate-500">
                  Pilih item retur yang akan dibatalkan dan stoknya akan dikembalikan ke gudang.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                disabled={loadingCancelDetail || submittingCancel}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Tutup
              </button>
            </div>

            <div className="max-h-[calc(90vh-136px)] overflow-auto p-4">
              {loadingCancelDetail && <p className="text-sm text-slate-500">Memuat item retur...</p>}
              {!loadingCancelDetail && errorCancel && (
                <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {errorCancel}
                </div>
              )}
              {!loadingCancelDetail && cancelDetail && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Kode Retur</p>
                      <p className="font-semibold text-slate-900">
                        {cancelDetail.header?.kode_t_retur_supplier || "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Supplier</p>
                      <p className="font-semibold text-slate-900">{cancelDetail.header?.nama_supplier || "-"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Gudang</p>
                      <p className="font-semibold text-slate-900">
                        {cancelDetail.header?.nama_gudang || cancelDetail.header?.kode_gudang || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800">Item yang bisa dibatalkan</p>
                    <button
                      type="button"
                      onClick={() => setSelectedCancelItems(cancelableItems.map((item) => item.kode_d_retur_supplier))}
                      disabled={cancelableItems.length === 0 || submittingCancel}
                      className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Pilih Semua
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-600">
                        <tr>
                          <th className="w-12 px-3 py-2 text-right font-medium">No</th>
                          <th className="w-12 px-3 py-2 font-medium">Pilih</th>
                          <th className="px-3 py-2 font-medium">Barang</th>
                          <th className="px-3 py-2 font-medium">Varian</th>
                          <th className="px-3 py-2 text-right font-medium">Qty</th>
                          <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cancelDetail.items.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-3 py-5 text-center text-slate-500">
                              Detail item belum ada.
                            </td>
                          </tr>
                        )}
                        {cancelDetail.items.map((item, index) => {
                          const isCanceled = Number(item.is_batal_retur || 0) === 1;
                          const checked = selectedCancelItems.includes(item.kode_d_retur_supplier);
                          return (
                            <tr key={item.kode_d_retur_supplier} className={isCanceled ? "bg-rose-50/40" : ""}>
                              <td className="px-3 py-2 text-right text-slate-600">{index + 1}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isCanceled || submittingCancel}
                                  onChange={(event) => {
                                    setSelectedCancelItems((prev) =>
                                      event.target.checked
                                        ? [...prev, item.kode_d_retur_supplier]
                                        : prev.filter((code) => code !== item.kode_d_retur_supplier)
                                    );
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <p className="font-medium text-slate-900">{item.nama_barang || "-"}</p>
                                <p className="text-xs text-slate-500">{item.kode_barang_variant || "-"}</p>
                              </td>
                              <td className="px-3 py-2 text-slate-700">{item.nama_varian || "-"}</td>
                              <td className="px-3 py-2 text-right text-slate-700">
                                {Number(item.qty ?? 0)} {item.satuan || ""}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-slate-900">
                                {formatIDR(Number(item.subtotal ?? 0))}
                              </td>
                              <td className="px-3 py-2">
                                {isCanceled ? (
                                  <span className="inline-flex rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">
                                    Sudah batal
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                                    Bisa batal
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Catatan batal</span>
                    <textarea
                      value={cancelNote}
                      onChange={(event) => setCancelNote(event.target.value)}
                      disabled={submittingCancel}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-500 disabled:bg-slate-50"
                      placeholder="Opsional"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4">
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                disabled={submittingCancel}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={submitCancelItems}
                disabled={submittingCancel || loadingCancelDetail || selectedCancelItems.length === 0}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-rose-600 px-3 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                {submittingCancel ? "Memproses..." : "Batalkan Item"}
              </button>
            </div>
          </section>
        </div>
      )}

      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (loadingDetail) return;
              setShowDetail(false);
            }}
          />
          <section className="relative max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Detail Retur Supplier</h2>
                <p className="text-xs text-slate-500">
                  Detail dokumen retur supplier berdasarkan header yang dipilih.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDetail(false);
                }}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>

            <div className="max-h-[calc(90vh-72px)] overflow-auto">
              {loadingDetail && <p className="p-4 text-sm text-slate-500">Memuat detail...</p>}
              {!loadingDetail && errorDetail && <p className="p-4 text-sm text-red-600">{errorDetail}</p>}
              {!loadingDetail && !errorDetail && !detail && (
                <p className="p-4 text-sm text-slate-500">Pilih tombol detail pada salah satu dokumen.</p>
              )}

              {!loadingDetail && !errorDetail && detail && (
                <div className="space-y-4 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Kode Retur</p>
                      <p className="font-semibold text-slate-900">{detail.header?.kode_t_retur_supplier || "-"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Tanggal</p>
                      <p className="font-semibold text-slate-900">{formatDate(detail.header?.tgl)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Supplier</p>
                      <p className="font-semibold text-slate-900">{detail.header?.nama_supplier || "-"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Gudang</p>
                      <p className="font-semibold text-slate-900">
                        {detail.header?.nama_gudang || detail.header?.kode_gudang || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-right font-medium">No</th>
                          <th className="px-3 py-2 font-medium">Kode Barang Variant</th>
                          <th className="px-3 py-2 font-medium">Nama Barang</th>
                          <th className="px-3 py-2 font-medium">Nama Varian</th>
                          <th className="px-3 py-2 text-right font-medium">Qty</th>
                          <th className="px-3 py-2 font-medium">Satuan</th>
                          <th className="px-3 py-2 text-right font-medium">Harga Beli</th>
                          <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.items.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-3 py-5 text-center text-slate-500">
                              Detail item belum ada.
                            </td>
                          </tr>
                        )}
                        {detail.items.map((item, index) => {
                          const isCanceled = Number(item.is_batal_retur || 0) === 1;
                          return (
                            <tr key={item.kode_d_retur_supplier} className={isCanceled ? "bg-rose-50/40" : ""}>
                              <td className="px-3 py-2 text-right text-slate-600">{index + 1}</td>
                              <td className="px-3 py-2 font-medium text-slate-900">{item.kode_barang_variant || "-"}</td>
                              <td className="px-3 py-2 text-slate-700">{item.nama_barang || "-"}</td>
                              <td className="px-3 py-2 text-slate-700">{item.nama_varian || "-"}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{Number(item.qty ?? 0)}</td>
                              <td className="px-3 py-2 text-slate-700">{item.satuan || "-"}</td>
                              <td className="px-3 py-2 text-right text-slate-700">
                                {formatIDR(Number(item.harga_beli ?? 0))}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-slate-900">
                                {formatIDR(Number(item.subtotal ?? 0))}
                              </td>
                              <td className="px-3 py-2">
                                {isCanceled ? (
                                  <span className="inline-flex rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">
                                    Batal
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                                    Aktif
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                    <p>
                      <span className="font-medium text-slate-800">Catatan:</span> {detail.header?.catatan || "-"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
