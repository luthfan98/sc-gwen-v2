"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, RefreshCcw } from "lucide-react";

type DetailRow = {
  central_trx_code: string | null;
  created_at: string | null;
  cashier_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  method: string | null;
  status: string | null;
  item_name: string | null;
  barcode: string | null;
  kode_supplier?: string | null;
  supplier_name?: string | null;
  kode_merk?: string | null;
  merk_name?: string | null;
  qty: number | null;
  unit_price: number | null;
  line_discount: number | null;
  line_total: number | null;
  promo_codes?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const cleaned = value.replace("T", " ").trim();
  const [datePart, timePartRaw] = cleaned.split(" ");
  if (!datePart) return value;
  const [yyyy, mm, dd] = datePart.split("-");
  if (!yyyy || !mm || !dd) return value;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  const monthName = months[Number(mm) - 1] ?? mm;
  let timePart = timePartRaw || "00:00:00";
  if (timePart.includes(".")) timePart = timePart.split(".")[0];
  const [hh = "00", min = "00"] = timePart.split(":");
  return `${dd} ${monthName} ${yyyy}, ${hh}.${min}`;
};

const formatIDR = (value: number | string | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(Number(value || 0));

export default function HistoryTransaksiDetailPage() {
  const params = useParams();
  const rawTrx = params?.trx;
  const trxCode = Array.isArray(rawTrx) ? rawTrx[0] : rawTrx;

  const [rows, setRows] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!trxCode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/pos/transactions-detail-export?trx=${encodeURIComponent(trxCode)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      setHasFetched(true);
    } catch (err: any) {
      console.error("Failed fetch detail", err);
      setRows([]);
      setError(err?.message || "Gagal memuat detail transaksi.");
      setHasFetched(true);
    } finally {
      setLoading(false);
    }
  }, [trxCode, API_BASE]);

  useEffect(() => {
    if (!trxCode) return;
    loadDetail();
  }, [trxCode, loadDetail]);

  const itemRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.item_name ||
          row.barcode ||
          Number(row.qty || 0) > 0 ||
          Number(row.unit_price || 0) > 0 ||
          Number(row.line_total || 0) > 0
      ),
    [rows]
  );

  const summary = useMemo(
    () =>
      itemRows.reduce(
        (acc, row) => {
          acc.totalQty += Number(row.qty || 0);
          acc.totalDiscount += Number(row.line_discount || 0);
          acc.totalAmount += Number(row.line_total || 0);
          return acc;
        },
        { totalQty: 0, totalDiscount: 0, totalAmount: 0 }
      ),
    [itemRows]
  );

  const header = rows[0] ?? null;

  const infoCards = [
    { label: "Trx Code", value: trxCode || "-" },
    { label: "Tanggal", value: formatDateTime(header?.created_at || null) },
    { label: "Kasir", value: header?.cashier_name || "-" },
    { label: "Customer", value: header?.customer_name || "-" },
    { label: "Phone", value: header?.customer_phone || "-" },
    { label: "Metode", value: header?.method || "-" },
    { label: "Status", value: header?.status || "-" },
    { label: "Promo", value: header?.promo_codes || "-" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 p-4 md:p-6 space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white/90 shadow-sm px-6 py-5 md:px-7 md:py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">History Transaksi</p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Detail Transaksi</h1>
            <p className="text-sm text-slate-500">{trxCode || "-"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/transaksi/history"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Link>
            <button
              type="button"
              onClick={loadDetail}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {infoCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-slate-400">{card.label}</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total Qty</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{summary.totalQty.toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total Diskon</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{formatIDR(summary.totalDiscount)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total Belanja</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{formatIDR(summary.totalAmount)}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div>
            <p className="text-sm font-semibold text-slate-700">Detail Item Barang</p>
            <p className="text-xs text-slate-500">
              {itemRows.length.toLocaleString("id-ID")} item
            </p>
          </div>
        </div>
        {loading && (
          <div className="py-10 text-center text-sm text-slate-500">Memuat detail transaksi...</div>
        )}
        {!loading && hasFetched && itemRows.length === 0 && (
          <div className="py-10 text-center text-sm text-slate-500">
            Tidak ada detail item untuk transaksi ini.
          </div>
        )}
        {!loading && itemRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest text-[10px]">
                <tr>
                  <th className="px-3 py-3 text-left">No</th>
                  <th className="px-3 py-3 text-left">Nama Item</th>
                  <th className="px-3 py-3 text-left">Barcode</th>
                  <th className="px-3 py-3 text-left">Supplier</th>
                  <th className="px-3 py-3 text-left">Merk</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3 text-right">Harga</th>
                  <th className="px-3 py-3 text-right">Diskon</th>
                  <th className="px-3 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemRows.map((row, idx) => (
                  <tr key={`${row.barcode || row.item_name || "item"}-${idx}`} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-700">{idx + 1}</td>
                    <td className="px-3 py-2 text-slate-700">{row.item_name || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{row.barcode || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {row.supplier_name || row.kode_supplier || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.merk_name || row.kode_merk || "-"}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {Number(row.qty || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatIDR(row.unit_price || 0)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatIDR(row.line_discount || 0)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatIDR(row.line_total || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/90 text-slate-700">
                <tr className="border-t border-slate-200">
                  <td className="px-3 py-3 font-semibold" colSpan={5}>
                    Total
                  </td>
                  <td className="px-3 py-3 font-semibold text-right">
                    {summary.totalQty.toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 font-semibold text-right">
                    {formatIDR(summary.totalDiscount)}
                  </td>
                  <td className="px-3 py-3 font-semibold text-right">
                    {formatIDR(summary.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
