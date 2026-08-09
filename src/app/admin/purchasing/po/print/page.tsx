"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

type SiteInfo = {
  nama?: string;
  alamat?: string;
  kota?: string;
  kode_pos?: string;
  provinsi?: string;
  negara?: string;
  no_telp?: string;
  email?: string;
  nama_header_print?: string;
  alamat_header_print?: string;
};

type PengadaanHeader = {
  kode_t_pengadaan?: string;
  kode_t_rpo?: string;
  tgl?: string;
  tanggal_barang_datang?: string;
  deadline?: string;
  kode_supplier?: string;
  supplier_nama?: string;
  created_by?: string;
  catatan?: string;
  total?: number;
  diskon?: number;
  total_stlh_diskon?: number;
  total_sblm_ppn?: number;
  ppn?: number;
  total_akhir?: number;
};

type PengadaanItem = {
  kode_d_pengadaan: string;
  barcode_varian?: string | null;
  nama_barang?: string | null;
  nama_varian?: string | null;
  qty?: number | null;
  satuan?: string | null;
  harga_beli?: number | null;
  subtotal?: number | null;
  catatan?: string | null;
  is_active?: boolean | number | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const formatIDR = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("id-ID");
};

const formatAddress = (obj: { alamat?: string; kota?: string; provinsi?: string; kode_pos?: string; negara?: string }) =>
  [obj.alamat, [obj.kota, obj.provinsi, obj.kode_pos].filter(Boolean).join(", "), obj.negara]
    .filter((s) => s && s.trim())
    .join("\n");

export default function PengadaanPrintPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kodeParam = searchParams.get("kode");
  const [site, setSite] = useState<SiteInfo>({});
  const [header, setHeader] = useState<PengadaanHeader | null>(null);
  const [items, setItems] = useState<PengadaanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSite = async () => {
      try {
        const res = await fetch(`${API_BASE}/site`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const s: SiteInfo = await res.json();
        setSite(s || {});
      } catch (err) {
        console.error("Failed load site info", err);
      }
    };
    fetchSite();
  }, []);

  useEffect(() => {
    const fetchPengadaan = async () => {
      if (!kodeParam) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/pengadaan/${encodeURIComponent(kodeParam)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        setHeader(payload?.header || null);
        const list = Array.isArray(payload?.items) ? payload.items : [];
        setItems(list.filter((it: PengadaanItem) => Number(it?.is_active ?? 1) !== 0));
      } catch (err) {
        console.error("Failed load pengadaan", err);
        setError("Gagal memuat data pengadaan.");
      } finally {
        setLoading(false);
      }
    };
    fetchPengadaan();
  }, [kodeParam]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, it) => {
        const qty = Number(it.qty ?? 0);
        const harga = Number(it.harga_beli ?? 0);
        acc.qty += qty;
        acc.subtotal += qty * harga;
        return acc;
      },
      { qty: 0, subtotal: 0 }
    );
  }, [items]);

  if (!kodeParam) {
    return <div className="p-6 text-sm text-gray-600">Kode pengadaan tidak valid.</div>;
  }

  return (
    <div className="p-6 text-gray-900">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex justify-end gap-2 print:hidden">
          {header?.kode_t_pengadaan && (
            <button
              type="button"
              onClick={() =>
                router.push(`/admin/purchasing/po/new?edit_kode=${encodeURIComponent(header.kode_t_pengadaan || "")}`)
              }
              className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Edit
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
            Memuat data pengadaan...
          </div>
        )}
        {error && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="bg-white border border-gray-300 rounded-xl p-4 shadow-sm">
          <div className="text-center border-b border-gray-200 pb-2 mb-3">
            <div className="text-xs uppercase tracking-[0.3em] text-gray-500">GWEN KOSMETIK</div>
            <div className="text-xl font-bold text-gray-900">Purchase Order</div>
          </div>
          <div className="flex flex-wrap justify-between gap-4 border-b border-gray-300 pb-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold">{site.nama_header_print || site.nama || "-"}</div>
              <div className="text-xs text-gray-600 whitespace-pre-line">
                {site.alamat_header_print || formatAddress(site) || "-"}
              </div>
              {(site.no_telp || site.email) && (
                <div className="text-xs text-gray-600">
                  {site.no_telp ? `Telp: ${site.no_telp}` : ""}
                  {site.email ? `${site.no_telp ? " | " : ""}${site.email}` : ""}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-700 text-right">
              <div className="space-y-1">
                <div>Supplier: {header?.supplier_nama || header?.kode_supplier || "-"}</div>
                <div>No Pengadaan: {header?.kode_t_pengadaan || "-"}</div>
                <div>No Permintaan: {header?.kode_t_rpo || "-"}</div>
                <div>Entry By: {header?.created_by || "-"}</div>
                <div>Tanggal: {formatDate(header?.tanggal_barang_datang || header?.tgl)}</div>
                <div>Deadline: {formatDate(header?.deadline)}</div>
              </div>
              {header?.kode_t_pengadaan && (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                    header.kode_t_pengadaan
                  )}`}
                  alt="QR PO"
                  className="h-20 w-20 object-contain border border-gray-300 bg-white"
                />
              )}
            </div>
          </div>
          {header?.catatan && (
            <div className="pt-3 text-xs text-gray-700">Catatan: {header.catatan}</div>
          )}
        </div>

        <div className="border border-gray-400 rounded-lg overflow-hidden bg-white">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-100 border-b border-gray-400">
              <tr>
                <th className="px-2 py-2 text-left w-10 border-r border-gray-300">No</th>
                <th className="px-2 py-2 text-left border-r border-gray-300">Barcode</th>
                <th className="px-2 py-2 text-left border-r border-gray-300">Nama Barang</th>
                <th className="px-2 py-2 text-left border-r border-gray-300">Nama Varian</th>
                <th className="px-2 py-2 text-right w-20 border-r border-gray-300">Jml</th>
                <th className="px-2 py-2 text-left w-14 border-r border-gray-300">Satuan</th>
                <th className="px-2 py-2 text-right w-28 border-r border-gray-300">H. Beli</th>
                <th className="px-2 py-2 text-right w-28 border-r border-gray-300">Subtotal</th>
                <th className="px-2 py-2 text-left border-r border-gray-300">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const subtotal = Number(item.subtotal ?? Number(item.qty ?? 0) * Number(item.harga_beli ?? 0));
                return (
                  <tr key={item.kode_d_pengadaan} className="border-b border-gray-200">
                    <td className="px-2 py-2 text-center border-r border-gray-200">{idx + 1}</td>
                    <td className="px-2 py-2 border-r border-gray-200">{item.barcode_varian || "-"}</td>
                    <td className="px-2 py-2 border-r border-gray-200">{item.nama_barang || "-"}</td>
                    <td className="px-2 py-2 border-r border-gray-200">{item.nama_varian || "-"}</td>
                    <td className="px-2 py-2 text-right border-r border-gray-200">{item.qty ?? 0}</td>
                    <td className="px-2 py-2 border-r border-gray-200">{item.satuan || "PCS"}</td>
                    <td className="px-2 py-2 text-right border-r border-gray-200">
                      {Number(item.harga_beli ?? 0) ? formatIDR(Number(item.harga_beli)) : "-"}
                    </td>
                    <td className="px-2 py-2 text-right border-r border-gray-200">
                      {formatIDR(Number(subtotal))}
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200">{item.catatan || "-"}</td>
                  </tr>
                );
              })}
              {items.length === 0 && !loading && (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={9}>
                    Tidak ada item.
                  </td>
                </tr>
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-300">
                <tr>
                  <td className="px-2 py-2 font-semibold text-right" colSpan={4}>
                    Total
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">{totals.qty}</td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2 text-right font-semibold">{formatIDR(totals.subtotal)}</td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
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
    </div>
  );
}
