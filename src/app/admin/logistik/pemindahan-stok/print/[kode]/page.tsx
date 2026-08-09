"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type PemindahanHeader = {
  kode_t_pemindahan: string;
  tipe_lokasi_dari: string;
  kode_lokasi_dari: string;
  tipe_lokasi_tujuan: string;
  kode_lokasi_tujuan: string;
  nama_lokasi_dari?: string | null;
  nama_lokasi_tujuan?: string | null;
  catatan: string | null;
  status_pemindahan: number | null;
  tgl: string;
  created_by: string | null;
  created_at: string | null;
};

type PemindahanDetail = {
  kode_d_pemindahan: string;
  kode_barang: string | null;
  kode_barang_variant: string | null;
  barcode_varian?: string | null;
  jml_baik_pindah: number | null;
  satuan_jml_baik: string | null;
  jml_rusak_pindah?: number | null;
  satuan_jml_rusak?: string | null;
  nama_varian: string | null;
  nama_barang: string | null;
};

export default function PrintPemindahanPage() {
  const params = useParams();
  const kode = typeof params?.kode === "string" ? params.kode : "";
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [header, setHeader] = useState<PemindahanHeader | null>(null);
  const [detail, setDetail] = useState<PemindahanDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [lokasiNama, setLokasiNama] = useState({ dari: "", tujuan: "" });

  useEffect(() => {
    const fetchDetail = async () => {
      if (!kode) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/pemindahan/${encodeURIComponent(kode)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setHeader(data?.header || null);
        setDetail(Array.isArray(data?.detail) ? data.detail : []);
      } catch {
        setHeader(null);
        setDetail([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [API_BASE, kode]);

  useEffect(() => {
    const fetchLokasiNama = async () => {
      if (!header) return;
      if (header.nama_lokasi_dari || header.nama_lokasi_tujuan) {
        setLokasiNama({
          dari: header.nama_lokasi_dari || "",
          tujuan: header.nama_lokasi_tujuan || "",
        });
        return;
      }

      try {
        const [gudangRes, tokoRes] = await Promise.all([
          fetch(`${API_BASE}/gudang`),
          fetch(`${API_BASE}/toko`),
        ]);
        const gudangData = gudangRes.ok ? await gudangRes.json() : [];
        const tokoData = tokoRes.ok ? await tokoRes.json() : [];

        const gudangMap = new Map(
          (Array.isArray(gudangData) ? gudangData : []).map((item) => [
            String(item.kode_gudang),
            String(item.nama || item.kode_gudang),
          ])
        );
        const tokoMap = new Map(
          (Array.isArray(tokoData) ? tokoData : []).map((item) => [
            String(item.kode_toko),
            String(item.nama_toko || item.kode_toko),
          ])
        );

        setLokasiNama({
          dari:
            header.tipe_lokasi_dari === "TOKO"
              ? tokoMap.get(String(header.kode_lokasi_dari)) || ""
              : gudangMap.get(String(header.kode_lokasi_dari)) || "",
          tujuan:
            header.tipe_lokasi_tujuan === "TOKO"
              ? tokoMap.get(String(header.kode_lokasi_tujuan)) || ""
              : gudangMap.get(String(header.kode_lokasi_tujuan)) || "",
        });
      } catch {
        setLokasiNama({ dari: "", tujuan: "" });
      }
    };

    fetchLokasiNama();
  }, [API_BASE, header]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const lokasi = useMemo(() => {
    if (!header) return { dari: "-", tujuan: "-" };
    const dari = lokasiNama.dari || header.kode_lokasi_dari || "-";
    const tujuan = lokasiNama.tujuan || header.kode_lokasi_tujuan || "-";
    return { dari, tujuan };
  }, [header, lokasiNama]);

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("id-ID");
  };

  const totalQty = detail.reduce((sum, row) => sum + (Number(row.jml_baik_pindah) || 0), 0);
  const totalRusak = detail.reduce((sum, row) => sum + (Number(row.jml_rusak_pindah) || 0), 0);

  return (
    <div className="min-h-screen bg-white p-6 text-gray-900 text-[12px]">
      <div className="max-w-5xl mx-auto print:hidden flex justify-end mb-3">
        <button
          type="button"
          onClick={handlePrint}
          className="px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50"
        >
          Print
        </button>
      </div>
      <div className="max-w-5xl mx-auto border border-gray-900 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 border border-gray-700 rounded-md flex items-center justify-center">
              <img src="/logo_gwen.png" alt="Gwen" className="w-10 h-10 object-contain" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold tracking-wide">CV. SINAR INTI LESTARI</p>
              <p>JL. Kolonel Sugiono No. 15</p>
              <p>Slawi - Tegal</p>
              <p>Tel. </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="text-sm leading-5">
              <div className="flex gap-2">
                <span className="w-14 text-gray-700">Dari</span>
                <span>:</span>
                <span>{lokasi.dari}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-14 text-gray-700">Tujuan</span>
                <span>:</span>
                <span>{lokasi.tujuan}</span>
              </div>
            </div>
            <div className="w-20 h-20 border border-gray-700 flex items-center justify-center overflow-hidden">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                  kode || ""
                )}`}
                alt={`QR ${kode}`}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-900 mt-4 pt-3 text-center text-base font-bold tracking-wide">
          PEMINDAHAN
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="flex gap-2">
            <span>No Nota</span>
            <span>:</span>
            <span>{kode || "-"}</span>
          </div>
          <div className="flex gap-2">
            <span>Tanggal</span>
            <span>:</span>
            <span>{formatDate(header?.tgl)}</span>
          </div>
        </div>

        <div className="mt-3 border-2 border-gray-900">
          <table className="min-w-full text-left text-[12px]">
            <thead className="border-b-2 border-gray-900">
              <tr>
                <th className="px-2 py-1 w-10">No</th>
                <th className="px-2 py-1 w-28">Barcode</th>
                <th className="px-2 py-1">Nama Barang</th>
                <th className="px-2 py-1">Nama Varian</th>
                <th className="px-2 py-1 w-24 text-right">QTY Baik</th>
                <th className="px-2 py-1 w-24 text-right">Qty Rusak</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-gray-500">
                    Memuat data pemindahan...
                  </td>
                </tr>
              )}
              {!loading && detail.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-gray-500">
                    Tidak ada detail pemindahan.
                  </td>
                </tr>
              )}
              {!loading &&
                detail.map((row, index) => (
                  <tr key={row.kode_d_pemindahan} className="border-t border-gray-700">
                    <td className="px-2 py-1">{index + 1}</td>
                    <td className="px-2 py-1 text-[11px] text-gray-700">
                      {row.barcode_varian || "-"}
                    </td>
                    <td className="px-2 py-1 font-semibold">{row.nama_barang || "-"}</td>
                    <td className="px-2 py-1 text-[11px] text-gray-700">{row.nama_varian || "-"}</td>
                    <td className="px-2 py-1 text-right">
                      {(row.jml_baik_pindah ?? 0).toLocaleString("id-ID")} {row.satuan_jml_baik || "PCS"}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {(row.jml_rusak_pindah ?? 0).toLocaleString("id-ID")} {row.satuan_jml_rusak || row.satuan_jml_baik || "PCS"}
                    </td>
                  </tr>
                ))}
            </tbody>
            {!loading && detail.length > 0 && (
              <tfoot className="border-t-2 border-gray-900">
                <tr>
                  <td className="px-2 py-1" />
                  <td className="px-2 py-1 text-right font-semibold">Total</td>
                  <td className="px-2 py-1" />
                  <td className="px-2 py-1" />
                  <td className="px-2 py-1 text-right font-semibold">{totalQty.toLocaleString("id-ID")}</td>
                  <td className="px-2 py-1 text-right font-semibold">{totalRusak.toLocaleString("id-ID")}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="mt-10 flex items-center justify-between text-sm">
          <div className="text-center w-32">
            <div>( Penerima )</div>
          </div>
          <div className="text-center w-32">
            <div>( Gudang )</div>
          </div>
          <div className="text-center w-32">{header?.created_by || "-"}</div>
        </div>
      </div>
    </div>
  );
}
