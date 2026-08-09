"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, ClipboardList, RefreshCcw, Sparkles } from "lucide-react";

type LpbListItem = {
  id: string;
  kodeRpo: string;
  supplier: string;
  date: string;
  status: "Terverifikasi" | "Belum";
  verifiedBy: string;
  verifiedAt: string;
  totalItems: number;
  totalQty: number;
};

export default function PenerimaanBarangPage() {
  const router = useRouter();
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [list, setList] = useState<LpbListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchReleased = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/lpb`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) {
        setList([]);
        return;
      }
      const mapped = data.map((row: any) => ({
        id: row.kode_lpb || "-",
        kodeRpo: row.kode_t_rpo || "-",
        supplier: row.supplier_nama || row.kode_supplier || "-",
        date: row.tgl_lpb ? String(row.tgl_lpb).slice(0, 10) : "-",
        status: row.verifikasi_by ? "Terverifikasi" : "Belum",
        verifiedBy: row.verifikasi_by || "",
        verifiedAt: row.verifikasi_at ? String(row.verifikasi_at).slice(0, 19) : "",
        totalItems: Number(row.total_item ?? 0),
        totalQty: Number(row.total_qty ?? 0),
      }));
      setList(mapped);
    } catch (err) {
      console.error("Failed load LPB list", err);
      setError("Gagal memuat daftar LPB.");
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReleased();
  }, []);

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

  const stats = useMemo(() => {
    const total = list.length;
    const selesai = list.filter((p) => p.status === "Selesai").length;
    const belum = total - selesai;
    const totalQty = list.reduce((sum, p) => sum + p.totalQty, 0);
    return { total, selesai, belum, totalQty };
  }, [list]);

  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return list;
    const term = searchTerm.trim().toLowerCase();
    return list.filter((row) => {
      return (
        row.id.toLowerCase().includes(term) ||
        row.kodeRpo.toLowerCase().includes(term) ||
        row.supplier.toLowerCase().includes(term)
      );
    });
  }, [list, searchTerm]);

  const handleLogout = () => {
    const ok = typeof window !== "undefined" && window.confirm("Yakin ingin logout?");
    if (!ok) return;
    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie = "penjualan_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "kosmetik-admin-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "kosmetik-admin-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    router.push("/logout");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#0f756b]/15 bg-white/85 backdrop-blur-md px-4 py-3 shadow-sm shadow-[#3fe0d0]/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#0f756b]/10 border border-[#0f756b]/20 flex items-center justify-center text-[#0f756b] font-bold shadow-sm">
            PB
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.22em] text-[#0f756b]">
              Gudang
            </span>
            <span className="text-sm font-semibold text-gray-900">
              Penerimaan Barang
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">
          Penerimaan Barang
        </p>
        <h1 className="text-2xl font-bold text-gray-900">
          Daftar LPB untuk diterima
        </h1>
        <p className="text-sm text-gray-600">
          Lihat ringkasan penerimaan bulan ini, dan buka detail untuk proses
          cek barang masuk.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="rounded-2xl border border-[#0f756b]/15 bg-white/90 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Nota Bulan Ini</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-[#0f756b]" />
            {stats.totalQty} pcs total item
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm">
          <p className="text-xs text-emerald-700">Nota Selesai</p>
          <p className="text-2xl font-bold text-emerald-800">{stats.selesai}</p>
          <p className="text-xs text-emerald-700">Sudah diterima</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
          <p className="text-xs text-amber-700">Nota Belum Selesai</p>
          <p className="text-2xl font-bold text-amber-800">{stats.belum}</p>
          <p className="text-xs text-amber-700">Perlu proses penerimaan</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Pembaruan data</p>
            <p className="text-sm font-semibold text-gray-800">
              Sinkronisasi manual
            </p>
          </div>
          <button
            onClick={fetchReleased}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-[#0f756b]/15 bg-white/95 shadow-lg shadow-[#3fe0d0]/10 p-4 lg:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <ClipboardList className="h-4 w-4 text-[#0f756b]" />
          List LPB
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[220px]">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nomor LPB / RPO / supplier"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
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
            onClick={() => setSearchTerm("")}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">No. LPB</th>
                <th className="px-3 py-2 text-left">No. RPO</th>
                <th className="px-3 py-2 text-left">Supplier</th>
                <th className="px-3 py-2 text-left">Tanggal</th>
                <th className="px-3 py-2 text-left">Total Item</th>
                <th className="px-3 py-2 text-left">Qty</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Verifikasi</th>
                <th className="px-3 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={9}>
                    Memuat data LPB...
                  </td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-rose-600" colSpan={9}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && list.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={9}>
                    Tidak ada LPB.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filteredList.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2 font-semibold text-gray-900">
                      {po.id}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{po.kodeRpo}</td>
                    <td className="px-3 py-2 text-gray-700">{po.supplier}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {po.date === "-" ? "-" : new Date(po.date).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{po.totalItems}</td>
                    <td className="px-3 py-2 text-gray-700">{po.totalQty} pcs</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          po.status === "Terverifikasi"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {po.verifiedBy
                        ? `${po.verifiedBy}${po.verifiedAt ? ` (${new Date(po.verifiedAt).toLocaleString("id-ID")})` : ""}`
                        : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/penerimaan-barang/LPB/${encodeURIComponent(po.id)}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#0f756b] text-white text-xs font-semibold px-3 py-1.5 shadow-sm hover:shadow-md hover:bg-[#0d6a62] transition"
                      >
                        Lihat detail
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Scan Barcode</p>
                <p className="text-sm font-semibold text-gray-900">Cari LPB</p>
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
                    setSearchTerm(scanValue.trim());
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
    </div>
  );
}
