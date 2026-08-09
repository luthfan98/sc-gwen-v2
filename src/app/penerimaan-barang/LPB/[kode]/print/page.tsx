"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type LpbHeader = {
  kode_lpb: string;
  kode_t_rpo: string;
  kode_supplier: string;
  supplier_nama?: string;
  tgl_lpb: string;
  status: string;
};

type LpbItem = {
  kode_d_lpb: string;
  kode_barang_variant: string;
  barcode_varian?: string | null;
  nama_barang?: string | null;
  nama_varian?: string | null;
  qty: number;
  expired_dates?: string[];
  catatan?: string | null;
  status?: number | null;
};

export default function LpbPrintPage() {
  const params = useParams<{ kode: string }>();
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const kodeParam = decodeURIComponent(params?.kode ?? "");
  const [header, setHeader] = useState<LpbHeader | null>(null);
  const [items, setItems] = useState<LpbItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!kodeParam) return;
      try {
        const res = await fetch(`${API_BASE}/lpb/${encodeURIComponent(kodeParam)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setHeader(data?.header || null);
        const list = Array.isArray(data?.items) ? data.items : [];
        setItems(list.filter((it: LpbItem) => Number(it.status ?? 1) !== 0));
      } catch {
        setError("Gagal memuat data LPB.");
      }
    };
    fetchData();
  }, [API_BASE, kodeParam]);

  const totalQty = useMemo(() => items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0), [items]);
  const formatTanggal = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString("id-ID");
  };

  if (!kodeParam) {
    return <div className="p-6 text-sm text-gray-600">Kode RPO tidak valid.</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-rose-600">{error}</div>;
  }

  return (
    <div className="p-8 print:p-0 text-gray-900 text-[10pt]">
      <div className="max-w-4xl mx-auto space-y-4 print:max-w-none">
        <div className="flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            Print
          </button>
        </div>
        <div className="flex items-start justify-between border-b border-gray-200 pb-3 gap-4">
          {header?.kode_lpb && (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                header.kode_lpb
              )}`}
              alt="QR LPB"
              className="h-24 w-24 object-contain border border-gray-300 bg-white"
            />
          )}
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Lembar Penerimaan Barang</p>
            <h1 className="text-2xl font-bold">{header?.kode_lpb || "-"}</h1>
            <p className="text-sm text-gray-600">RPO: {header?.kode_t_rpo || "-"}</p>
            <p className="text-sm text-gray-600">Supplier: {header?.supplier_nama || header?.kode_supplier || "-"}</p>
            <p className="text-sm text-gray-600">Tanggal: {formatTanggal(header?.tgl_lpb)}</p>
          </div>
          <div className="text-right text-sm">
            <div className="text-xs text-gray-500">Total Qty</div>
            <div className="text-xl font-bold">{totalQty}</div>
          </div>
        </div>

        <table className="w-full text-xs border-2 border-gray-400">
          <thead className="bg-gray-50 border-b-2 border-gray-400">
            <tr>
              <th className="px-3 py-2 text-center border-b-2 border-gray-400 border-r border-gray-300 w-10">No</th>
              <th className="px-3 py-2 text-left border-b-2 border-gray-400 border-r border-gray-300">Barcode</th>
              <th className="px-3 py-2 text-left border-b-2 border-gray-400 border-r border-gray-300">Nama Barang</th>
              <th className="px-3 py-2 text-left border-b-2 border-gray-400 border-r border-gray-300">Nama Varian</th>
              <th className="px-3 py-2 text-right border-b-2 border-gray-400 border-r border-gray-300">Qty LPB</th>
              <th className="px-3 py-2 text-left border-b-2 border-gray-400 border-r border-gray-300">Satuan</th>
              <th className="px-3 py-2 text-left border-b-2 border-gray-400 border-r border-gray-300">Expired</th>
              <th className="px-3 py-2 text-left border-b-2 border-gray-400">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.kode_d_lpb}>
                <td className="px-3 py-2 text-center border-b border-gray-300 border-r border-gray-300">{idx + 1}</td>
                <td className="px-3 py-2 border-b border-gray-300 border-r border-gray-300">{item.barcode_varian || "-"}</td>
                <td className="px-3 py-2 border-b border-gray-300 border-r border-gray-300">{item.nama_barang || "-"}</td>
                <td className="px-3 py-2 border-b border-gray-300 border-r border-gray-300">{item.nama_varian || "-"}</td>
                <td className="px-3 py-2 text-right border-b border-gray-300 border-r border-gray-300">{item.qty}</td>
                <td className="px-3 py-2 border-b border-gray-300 border-r border-gray-300">PCS</td>
                <td className="px-3 py-2 border-b border-gray-300 border-r border-gray-300">
                  {item.expired_dates && item.expired_dates.length > 0 ? item.expired_dates.join(", ") : "-"}
                </td>
                <td className="px-3 py-2 border-b border-gray-300">{item.catatan || "-"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={8}>
                  Tidak ada item.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="grid grid-cols-4 gap-6 pt-6">
          {["Kepala Gudang", "Mandor", "Staff Purchasing", "Sopir"].map((label) => (
            <div key={label} className="text-center">
              <div className="text-xs text-gray-500">{label}</div>
              <div className="mt-12 border-t border-gray-300" />
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: #fff;
          }
          a,
          button,
          input {
            display: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:max-w-none {
            max-width: none !important;
          }
        }
      `}</style>
    </div>
  );
}
