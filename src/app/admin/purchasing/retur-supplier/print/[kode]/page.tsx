"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";

type ReturSupplierHeader = {
  kode_t_retur_supplier: string;
  kode_t_pengadaan?: string | null;
  tgl?: string | null;
  kode_supplier?: string | null;
  nama_supplier?: string | null;
  kode_gudang?: string | null;
  nama_gudang?: string | null;
  catatan?: string | null;
  total_item?: number | null;
  total_qty?: number | null;
  total_nominal?: number | null;
  created_by?: string | null;
  created_at?: string | null;
};

type ReturSupplierDetailItem = {
  kode_d_retur_supplier: string;
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

const formatTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export default function PrintReturSupplierPage() {
  const params = useParams();
  const kode = typeof params?.kode === "string" ? params.kode : "";
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [header, setHeader] = useState<ReturSupplierHeader | null>(null);
  const [items, setItems] = useState<ReturSupplierDetailItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!kode) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/retur-supplier/${encodeURIComponent(kode)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        setHeader(payload?.header || null);
        setItems(Array.isArray(payload?.items) ? payload.items : []);
      } catch {
        setHeader(null);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [API_BASE, kode]);

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, row) => {
          const qty = Number(row.qty ?? 0) || 0;
          const subtotal = Number(row.subtotal ?? 0) || 0;
          if (Number(row.is_batal_retur || 0) !== 1) {
            acc.qty += qty;
            acc.nominal += subtotal;
          }
          return acc;
        },
        { qty: 0, nominal: 0 }
      ),
    [items]
  );
  const totalBatal = useMemo(
    () => items.filter((row) => Number(row.is_batal_retur || 0) === 1).length,
    [items]
  );
  const jamDibuat = formatTime(header?.created_at || header?.tgl || null);

  return (
    <div className="min-h-screen bg-white p-6 text-[12px] text-gray-900">
      <div className="mx-auto mb-3 flex max-w-5xl justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Print
        </button>
      </div>

      <div className="mx-auto max-w-5xl border border-gray-900 p-5">
        <div className="flex items-center gap-3 border-b border-gray-900 pb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded border border-gray-700">
            <Image src="/logo_gwen.png" alt="Logo Gwen" width={42} height={42} className="h-10 w-10 object-contain" />
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold tracking-wide">RETUR SUPPLIER</h1>
          </div>
          <div className="w-12" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <p>
            <span className="font-semibold">Kode Retur:</span> {header?.kode_t_retur_supplier || kode || "-"}
          </p>
          <p>
            <span className="font-semibold">Tanggal:</span> {formatDate(header?.tgl)}
          </p>
          <p>
            <span className="font-semibold">Supplier:</span> {header?.nama_supplier || header?.kode_supplier || "-"}
          </p>
          <p>
            <span className="font-semibold">Gudang:</span> {header?.nama_gudang || header?.kode_gudang || "-"}
          </p>
          <p>
            <span className="font-semibold">Kode Pengadaan:</span> {header?.kode_t_pengadaan || "-"}
          </p>
          <p>
            <span className="font-semibold">Dibuat Oleh:</span> {header?.created_by || "-"}
          </p>
          <p>
            <span className="font-semibold">Jam Dibuat:</span> {jamDibuat}
          </p>
          <p>
            <span className="font-semibold">Item Batal:</span> {totalBatal.toLocaleString("id-ID")}
          </p>
        </div>

        <div className="mt-3 border-2 border-gray-900">
          <table className="min-w-full text-left text-[12px]">
            <thead className="border-b-2 border-gray-900">
              <tr>
                <th className="px-2 py-1">No</th>
                <th className="px-2 py-1">Barcode</th>
                <th className="px-2 py-1">Nama Barang</th>
                <th className="px-2 py-1">Nama Varian</th>
                <th className="px-2 py-1 text-right">Qty</th>
                <th className="px-2 py-1">Satuan</th>
                <th className="px-2 py-1 text-right">Harga Beli</th>
                <th className="px-2 py-1 text-right">Subtotal</th>
                <th className="px-2 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-2 py-4 text-center text-gray-500">
                    Memuat data retur supplier...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-2 py-4 text-center text-gray-500">
                    Tidak ada detail retur supplier.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((row, index) => {
                  const isCanceled = Number(row.is_batal_retur || 0) === 1;
                  return (
                    <tr key={row.kode_d_retur_supplier} className={`border-t border-gray-700 ${isCanceled ? "bg-gray-100" : ""}`}>
                      <td className="px-2 py-1">{index + 1}</td>
                      <td className="px-2 py-1 font-medium">{row.barcode_varian || "-"}</td>
                      <td className="px-2 py-1">{row.nama_barang || "-"}</td>
                      <td className="px-2 py-1">{row.nama_varian || "-"}</td>
                      <td className="px-2 py-1 text-right">{Number(row.qty ?? 0).toLocaleString("id-ID")}</td>
                      <td className="px-2 py-1">{row.satuan || "-"}</td>
                      <td className="px-2 py-1 text-right">{formatIDR(Number(row.harga_beli ?? 0))}</td>
                      <td className={`px-2 py-1 text-right ${isCanceled ? "line-through" : ""}`}>
                        {formatIDR(Number(row.subtotal ?? 0))}
                      </td>
                      <td className="px-2 py-1">
                        {isCanceled ? (
                          <span className="font-bold uppercase text-gray-900">Batal Retur</span>
                        ) : (
                          <span>Aktif</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            {!loading && items.length > 0 && (
              <tfoot className="border-t-2 border-gray-900">
                <tr>
                  <td className="px-2 py-1" colSpan={4}>
                    <span className="font-semibold">Total</span>
                  </td>
                  <td className="px-2 py-1 text-right font-semibold">{totals.qty.toLocaleString("id-ID")}</td>
                  <td className="px-2 py-1" />
                  <td className="px-2 py-1" />
                  <td className="px-2 py-1 text-right font-semibold">{formatIDR(totals.nominal)}</td>
                  <td className="px-2 py-1 font-semibold">Aktif</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="mt-3 rounded border border-gray-300 p-2 text-sm">
          <span className="font-semibold">Catatan:</span> {header?.catatan || "-"}
        </div>
      </div>
    </div>
  );
}
