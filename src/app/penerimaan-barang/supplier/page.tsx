"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Package } from "lucide-react";
import Swal from "sweetalert2";

type PoItem = {
  kode_t_pengadaan: string;
  kode_t_penerimaan_pengadaan?: string | null;
  penerima_barang?: string | null;
  kode_gudang?: string | null;
  nama_gudang?: string | null;
  kode_t_rpo?: string | null;
  tgl?: string | null;
  deadline?: string | null;
  kode_supplier?: string | null;
  supplier_nama?: string | null;
  total_akhir?: number;
  total_item_d?: number;
  total_item_h?: number;
  persen_diterima?: number;
  status_penerimaan?: string;
};

type FixItem = {
  kode_barang_variant: string;
  nama_barang?: string | null;
  nama_varian?: string | null;
  jml_baik_diterima?: number | null;
  satuan_jml_baik?: string | null;
  qty_masuk?: number | null;
  satuan_h?: string | null;
  mismatch_type?: string | null;
  qty?: number | null;
  satuan?: string | null;
  kode_gudang?: string | null;
  status?: string | null;
  message?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("id-ID");
};

const formatIDR = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

export default function PenerimaanBarangSupplierPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [list, setList] = useState<PoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [fixOpen, setFixOpen] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  const [fixItems, setFixItems] = useState<FixItem[]>([]);
  const [fixKodePengadaan, setFixKodePengadaan] = useState<string | null>(null);
  const [fixKodePenerimaan, setFixKodePenerimaan] = useState<string | null>(null);
  const [fixApplying, setFixApplying] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"all" | "received" | "pending">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  useEffect(() => {
    const fetchList = async () => {
      setLoading(true);
      setError(null);
      try {
        const query = barcodeSearch.trim()
          ? `?q=${encodeURIComponent(barcodeSearch.trim())}`
          : "";
        const res = await fetch(`${API_BASE}/penerimaan-pengadaan/po-open${query}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setList(Array.isArray(data) ? data : []);
      } catch (err) {
        setError("Gagal memuat daftar PO.");
        setList([]);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [API_BASE, barcodeSearch, refreshKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [barcodeSearch, statusFilter, refreshKey]);

  useEffect(() => {
    const startCamera = async () => {
      if (!scanOpen) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setScanError("Kamera tidak dapat diakses. Cek izin kamera.");
      }
    };
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [scanOpen]);

  const openFixModal = async (row: PoItem) => {
    setFixOpen(true);
    setFixError(null);
    setFixItems([]);
    setFixKodePengadaan(row.kode_t_pengadaan);
    setFixKodePenerimaan(row.kode_t_penerimaan_pengadaan || null);
    setFixLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(row.kode_t_pengadaan)}/mismatch`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setFixKodePenerimaan(data?.kode_t_penerimaan_pengadaan || row.kode_t_penerimaan_pengadaan || null);
      setFixItems(
        items.map((item: FixItem) => ({
          ...item,
          qty:
            item.mismatch_type === "H_ONLY"
              ? Number(item.qty_masuk ?? item.qty ?? 0)
              : Number(item.jml_baik_diterima ?? item.qty ?? 0),
          satuan:
            item.mismatch_type === "H_ONLY"
              ? item.satuan_h || item.satuan || "PCS"
              : item.satuan || item.satuan_jml_baik || "PCS",
          status: item.mismatch_type || "MISSING",
        }))
      );
    } catch (err) {
      setFixError("Gagal memuat daftar mismatch.");
    } finally {
      setFixLoading(false);
    }
  };

  const handleFixApply = async () => {
    if (!fixKodePengadaan || fixApplying) return;
    setFixApplying(true);
    setFixError(null);
    try {
      const res = await fetch(
        `${API_BASE}/penerimaan-pengadaan/${encodeURIComponent(fixKodePengadaan)}/fix-missing`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updated_by: getUsername() }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setFixKodePenerimaan(data?.kode_t_penerimaan_pengadaan || fixKodePenerimaan);
      if (items.length === 0) {
        setFixError("Tidak ada item yang bisa diperbaiki otomatis.");
        return;
      }
      setFixItems(
        items.map((item: FixItem) => ({
          ...item,
          qty: Number(item.jml_baik_diterima ?? item.qty ?? 0),
          satuan: item.satuan || item.satuan_jml_baik || "PCS",
        }))
      );
      setRefreshKey((prev) => prev + 1);
      await Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Perbaikan stok selesai diproses.",
        timer: 1400,
        showConfirmButton: false,
      });
      setFixOpen(false);
      setFixError(null);
      setFixItems([]);
    } catch (err) {
      setFixError("Gagal memperbaiki mismatch.");
    } finally {
      setFixApplying(false);
    }
  };

  const filteredList = list.filter((row) => {
    const totalD = Number(row.total_item_d ?? 0);
    const totalH = Number(row.total_item_h ?? 0);
    const isMismatch = Number(row.persen_diterima ?? 0) >= 100 && totalD !== totalH;
    const statusLabel = String(row.status_penerimaan || "").toLowerCase();
    const isReceived =
      !isMismatch &&
      (Number(row.persen_diterima ?? 0) >= 100 ||
      statusLabel.includes("sudah") ||
      statusLabel.includes("complete") ||
      (statusLabel.includes("diterima") && !statusLabel.includes("belum")));
    if (statusFilter === "received") return isReceived;
    if (statusFilter === "pending") return !isReceived;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedList = filteredList.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="mx-auto px-3 py-6 space-y-6">
      <header className="flex items-center justify-between rounded-2xl border border-[#0f756b]/15 bg-white/85 px-4 py-3 shadow-sm shadow-[#3fe0d0]/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#0f756b]/10 border border-[#0f756b]/20 flex items-center justify-center text-[#0f756b] font-bold shadow-sm">
            PB
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.22em] text-[#0f756b]">
              Gudang
            </span>
            <span className="text-sm font-semibold text-gray-900">
              Penerimaan Barang Supplier
            </span>
          </div>
        </div>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
      </header>

      <div className="rounded-3xl border border-[#0f756b]/15 bg-white/95 shadow-lg shadow-[#3fe0d0]/10 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-[#0f756b]/10 border border-[#0f756b]/20 flex items-center justify-center text-[#0f756b]">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">
              Daftar PO
            </p>
            <h1 className="text-2xl font-bold text-gray-900">
              Pengadaan belum diterima
            </h1>
            <p className="text-sm text-gray-600">
              List PO yang status penerimaan barangnya belum diproses.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[220px]">
            <input
              value={barcodeSearch}
              onChange={(e) => setBarcodeSearch(e.target.value)}
              placeholder="Cari nama barang / barcode untuk menemukan PO"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[180px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "received" | "pending")}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="all">Semua Status</option>
              <option value="received">Sudah diterima</option>
              <option value="pending">Belum diterima</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setScanValue("");
              setScanError(null);
              setScanOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Camera className="h-4 w-4" />
            Scan Barcode
          </button>
          <button
            type="button"
            onClick={() => setBarcodeSearch("")}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">No. PO</th>
                <th className="px-3 py-2 text-left">No. Penerimaan</th>
                <th className="px-3 py-2 text-left">Supplier</th>
                <th className="px-3 py-2 text-left">Diterima di Gudang</th>
                <th className="px-3 py-2 text-left">Penerima</th>
                <th className="px-3 py-2 text-left">Tanggal</th>
                <th className="px-3 py-2 text-left">Deadline</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Diterima</th>
                <th className="px-3 py-2 text-right">Rasio H/D</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={12}>
                    Memuat data...
                  </td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-rose-600" colSpan={12}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filteredList.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={12}>
                    Tidak ada PO yang menunggu penerimaan.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                pagedList.map((row) => {
                  const totalD = Number(row.total_item_d ?? 0);
                  const totalH = Number(row.total_item_h ?? 0);
                  const isMismatch = Number(row.persen_diterima ?? 0) >= 100 && totalD !== totalH;
                  const statusLabel = String(row.status_penerimaan || "").toLowerCase();
                  const isReceived =
                    !isMismatch &&
                    (Number(row.persen_diterima ?? 0) >= 100 ||
                    statusLabel.includes("sudah") ||
                    statusLabel.includes("complete") ||
                    (statusLabel.includes("diterima") && !statusLabel.includes("belum")));
                  return (
                    <tr
                      key={row.kode_t_pengadaan}
                      className={isMismatch ? "bg-rose-50/70 hover:bg-rose-50" : "hover:bg-gray-50/80"}
                    >
                    <td className="px-3 py-2 font-semibold text-gray-900">{row.kode_t_pengadaan}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {row.kode_t_penerimaan_pengadaan || "-"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{row.supplier_nama || row.kode_supplier || "-"}</td>
                    <td className="px-3 py-2 text-gray-700">{row.nama_gudang || row.kode_gudang || "-"}</td>
                    <td className="px-3 py-2 text-gray-700">{row.penerima_barang || "-"}</td>
                    <td className="px-3 py-2 text-gray-600">{formatDate(row.tgl)}</td>
                    <td className="px-3 py-2 text-gray-600">{formatDate(row.deadline)}</td>
                    <td className="px-3 py-2 text-right text-gray-900 font-semibold">
                      {formatIDR(Number(row.total_akhir ?? 0))}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {Number(row.persen_diterima ?? 0)}%
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      <div className="flex items-center justify-end gap-2">
                        <span>{totalH} / {totalD}</span>
                        {isMismatch && (
                          <button
                            type="button"
                            onClick={() => openFixModal(row)}
                            className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            Perbaiki
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                          isReceived
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-amber-50 text-amber-700 border-amber-100"
                        }`}
                      >
                        {row.status_penerimaan || (isReceived ? "Sudah diterima" : "Belum diterima")}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {isReceived ? (
                        <Link
                          href={`/penerimaan-barang/supplier/${encodeURIComponent(row.kode_t_pengadaan)}/print`}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                        >
                          Print
                        </Link>
                      ) : (
                        <Link
                          href={`/penerimaan-barang/supplier/${encodeURIComponent(row.kode_t_pengadaan)}`}
                          className="px-3 py-1.5 rounded-lg bg-[#0f756b] text-white text-xs font-semibold hover:bg-[#0d6a62]"
                        >
                          Terima Sekarang
                        </Link>
                      )}
                    </td>
                  </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!loading && !error && filteredList.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-gray-600">
              Menampilkan {Math.min((safePage - 1) * pageSize + 1, filteredList.length)}-
              {Math.min(safePage * pageSize, filteredList.length)} dari {filteredList.length}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safePage === 1}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-xs text-gray-600">
                Page {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage >= totalPages}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Scan Barcode</p>
                <p className="text-sm font-semibold text-gray-900">Cari PO</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScanOpen(false);
                  setScanError(null);
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach((t) => t.stop());
                    streamRef.current = null;
                  }
                }}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
                <video ref={videoRef} autoPlay playsInline className="w-full h-56 object-cover" />
              </div>
              {scanError && <div className="text-xs text-rose-600">{scanError}</div>}
              <label className="block text-xs text-gray-600">
                Barcode hasil scan / input manual
                <input
                  type="text"
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScanOpen(false);
                    setScanError(null);
                    if (streamRef.current) {
                      streamRef.current.getTracks().forEach((t) => t.stop());
                      streamRef.current = null;
                    }
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBarcodeSearch(scanValue.trim());
                    setScanOpen(false);
                    setScanError(null);
                    if (streamRef.current) {
                      streamRef.current.getTracks().forEach((t) => t.stop());
                      streamRef.current = null;
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-[#0f756b] text-white text-sm font-semibold hover:bg-[#0d6a62]"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {fixOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Perbaiki Stok Penerimaan</p>
                <p className="text-sm font-semibold text-gray-900">
                  {fixKodePengadaan || "-"} {fixKodePenerimaan ? `• ${fixKodePenerimaan}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFixOpen(false);
                  setFixError(null);
                  setFixItems([]);
                }}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {fixError && <div className="text-xs text-rose-600">{fixError}</div>}
              <div className="overflow-hidden rounded-xl border border-gray-100 shadow-sm bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Kode Varian</th>
                      <th className="px-3 py-2 text-left">Nama</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fixLoading && (
                      <tr>
                        <td className="px-3 py-4 text-center text-gray-500" colSpan={5}>
                          Memuat data...
                        </td>
                      </tr>
                    )}
                    {!fixLoading && fixItems.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-center text-gray-500" colSpan={5}>
                          Tidak ada mismatch.
                        </td>
                      </tr>
                    )}
                    {!fixLoading &&
                      fixItems.map((item) => (
                        <tr key={item.kode_barang_variant}>
                          <td className="px-3 py-2 text-gray-800">{item.kode_barang_variant}</td>
                          <td className="px-3 py-2 text-gray-700">
                            {item.nama_varian || item.nama_barang || "-"}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            {Number(item.qty ?? 0)} {item.satuan || "PCS"}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {item.status || "-"}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {item.message || "-"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFixOpen(false);
                    setFixError(null);
                    setFixItems([]);
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleFixApply}
                  disabled={fixApplying || fixLoading || fixItems.length === 0}
                  className="px-3 py-2 rounded-lg bg-[#0f756b] text-white text-sm font-semibold hover:bg-[#0d6a62] disabled:opacity-60"
                >
                  {fixApplying ? "Memproses..." : "Perbaiki Otomatis"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
