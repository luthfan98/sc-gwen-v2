"use client";

import Link from "next/link";
import { CreditCard, FileText, ShoppingCart } from "lucide-react";

export default function PenjualanIndex() {
  const userName = "Admin";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e2fff9] via-white to-[#c8f3ea] text-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-10 lg:py-14">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 rounded-2xl border border-[#0f756b]/15 bg-white/75 backdrop-blur-md px-4 py-3 shadow-sm shadow-[#3fe0d0]/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#0f756b]/10 border border-[#0f756b]/20 flex items-center justify-center text-[#0f756b] font-bold shadow-sm">
              GW
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">Gwen Retail</span>
              <span className="text-sm font-semibold text-gray-900">Penjualan · Pilih mode transaksi</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-2 rounded-xl bg-[#0f756b]/10 text-[#0f756b] border border-[#0f756b]/15 text-sm font-semibold">
              {userName}
            </span>
          </div>
        </header>

        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">Penjualan</p>
            <h1 className="text-2xl font-bold text-gray-900">Pilih Mode Transaksi</h1>
            <p className="text-sm text-gray-600">Masuk ke POS untuk kasir, atau lihat Inquiry Penjualan.</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Link
            href="/admin/penjualan/pos"
            className="group relative overflow-hidden rounded-3xl border border-[#0f756b]/20 bg-white/80 p-6 shadow-lg shadow-[#3fe0d0]/15 transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -right-10 -top-12 w-40 h-40 bg-[#3FE0D0]/25 blur-3xl" />
              <div className="absolute -left-16 bottom-0 w-48 h-48 bg-[#0f756b]/15 blur-3xl" />
            </div>
            <div className="relative flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-[#0f756b]/10 text-[#0f756b] border border-[#0f756b]/20 flex items-center justify-center shadow-sm">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">POS</h2>
                <p className="text-sm text-gray-600">Masuk ke kasir untuk transaksi langsung.</p>
              </div>
            </div>
            <div className="relative mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#0f756b] group-hover:gap-3 transition">
              <CreditCard className="w-4 h-4" />
              Mulai ke POS
            </div>
          </Link>

          <Link
            href="/admin/penjualan/inquiry"
            className="group relative overflow-hidden rounded-3xl border border-indigo-100 bg-white/80 p-6 shadow-lg shadow-indigo-100/40 transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -right-12 -top-10 w-40 h-40 bg-indigo-200/60 blur-3xl" />
              <div className="absolute left-0 bottom-0 w-48 h-48 bg-blue-100/60 blur-3xl" />
            </div>
            <div className="relative flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shadow-sm">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Inquiry Penjualan</h2>
                <p className="text-sm text-gray-600">Lihat riwayat dan status transaksi.</p>
              </div>
            </div>
            <div className="relative mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 group-hover:gap-3 transition">
              <FileText className="w-4 h-4" />
              Buka Inquiry
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
