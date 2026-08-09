"use client";

import Link from "next/link";
import {
  CreditCard,
  FileText,
  ShoppingCart,
  Sparkles,
  ArrowRight,
  Undo2,
} from "lucide-react";
import UserBadge from "./user-badge";

export default function PenjualanLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
        {/* HEADER MODERN */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#0f756b] to-[#3FE0D0] flex items-center justify-center text-white font-bold shadow-lg shadow-[#0f756b]/30">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#0f756b] font-semibold">
                    Penjualan
                  </p>
                  <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                    Pilih Mode Transaksi
                  </h1>
                </div>
              </div>
              <p className="text-sm text-gray-600 max-w-2xl ml-12">
                Gunakan POS untuk transaksi kasir secara realtime, atau buka Inquiry
                Penjualan untuk melihat riwayat dan analitik transaksi.
              </p>
            </div>
            <UserBadge />
          </div>
        </div>

        {/* KARTU PILIHAN */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {/* KARTU POS */}
          <Link
            href="/penjualan/pos"
            className="group relative overflow-hidden rounded-3xl border border-[#0f756b]/20 bg-white p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 hover:border-[#0f756b]/40"
          >
            {/* dekorasi */}
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -right-10 -top-16 w-48 h-48 bg-[#3FE0D0]/30 blur-3xl" />
              <div className="absolute -left-20 bottom-0 w-56 h-56 bg-[#0f756b]/20 blur-3xl" />
            </div>

            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#0f756b] to-[#3FE0D0] text-white flex items-center justify-center shadow-lg shadow-[#0f756b]/30 group-hover:scale-110 transition-transform duration-300">
                  <ShoppingCart className="w-7 h-7" />
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700 border border-emerald-100">
                  Kasir
                </span>
              </div>

              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">POS</h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Mode kasir dengan tampilan cepat untuk transaksi on-site,
                  pembacaan barcode, dan ringkasan pembayaran.
                </p>
              </div>

              {/* bullet kecil */}
              <ul className="space-y-2 text-xs text-gray-600 mb-5">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0f756b] flex-shrink-0" />
                  <span>Scan barcode & input manual</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0f756b] flex-shrink-0" />
                  <span>Ringkasan pembayaran multi-metode</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0f756b] flex-shrink-0" />
                  <span>Struk dan nota cetak / simpan</span>
                </li>
              </ul>

              <div className="flex items-center gap-2 text-sm font-semibold text-[#0f756b] group-hover:gap-3 transition-all">
                <CreditCard className="w-4 h-4" />
                <span>Mulai ke POS</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* KARTU INQUIRY */}
          <Link
            href="/penjualan/inquiry"
            className="group relative overflow-hidden rounded-3xl border border-indigo-200/60 bg-white p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 hover:border-indigo-300"
          >
            {/* dekorasi */}
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -right-14 -top-14 w-48 h-48 bg-indigo-200/70 blur-3xl" />
              <div className="absolute left-0 bottom-0 w-56 h-56 bg-blue-100/70 blur-3xl" />
            </div>

            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform duration-300">
                  <FileText className="w-7 h-7" />
                </div>
                <span className="px-3 py-1 rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 border border-indigo-100">
                  Monitoring
                </span>
              </div>

              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Inquiry Penjualan
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Lihat riwayat transaksi, status pembayaran, dan analitik
                  penjualan dalam satu dashboard ringkas.
                </p>
              </div>

              {/* bullet kecil */}
              <ul className="space-y-2 text-xs text-gray-600 mb-5">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                  <span>Filter berdasarkan tanggal & status</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                  <span>Grafik tren penjualan & target</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                  <span>Export laporan ke CSV / PDF</span>
                </li>
              </ul>

              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 group-hover:gap-3 transition-all">
                <Sparkles className="w-4 h-4" />
                <span>Buka Inquiry</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* KARTU RETUR */}
          <Link
            href="/penjualan/retur"
            className="group relative overflow-hidden rounded-3xl border border-amber-200/60 bg-white p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 hover:border-amber-300"
          >
            {/* dekorasi */}
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -right-14 -top-14 w-48 h-48 bg-amber-200/70 blur-3xl" />
              <div className="absolute left-0 bottom-0 w-56 h-56 bg-yellow-100/70 blur-3xl" />
            </div>

            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-600 to-yellow-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Undo2 className="w-7 h-7" />
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-50 text-xs font-semibold text-amber-700 border border-amber-100">
                  After Sales
                </span>
              </div>

              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Retur Penjualan
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Ajukan pengembalian barang, unggah bukti, dan pantau status
                  proses retur.
                </p>
              </div>

              {/* bullet kecil */}
              <ul className="space-y-2 text-xs text-gray-600 mb-5">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span>Form pengajuan retur singkat</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span>Upload bukti & catatan transaksi</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span>Pantau status verifikasi retur</span>
                </li>
              </ul>

              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 group-hover:gap-3 transition-all">
                <Undo2 className="w-4 h-4" />
                <span>Buka Retur</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}