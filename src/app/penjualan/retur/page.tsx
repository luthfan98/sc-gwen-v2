"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ClipboardCheck,
  PackageOpen,
  RefreshCw,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  Printer,
  Undo2,
} from "lucide-react";

const summaryCards = [
  {
    title: "Pengajuan Baru",
    value: "3",
    desc: "Menunggu verifikasi",
    icon: RefreshCw,
    accent: "emerald",
  },
  {
    title: "Diproses",
    value: "5",
    desc: "Sedang diperiksa",
    icon: PackageOpen,
    accent: "indigo",
  },
  {
    title: "Selesai",
    value: "24",
    desc: "Retur tuntas bulan ini",
    icon: ShieldCheck,
    accent: "orange",
  },
];

// dummy list retur
const dummyRetur = [
  {
    id: "RT-2025-0001",
    tanggal: "12/02/2025 10:15",
    customer: "Anisa Rahma",
    invoice: "INV-2025-0101",
    itemCount: 2,
    total: 185_000,
    status: "Diproses",
  },
  {
    id: "RT-2025-0002",
    tanggal: "12/02/2025 11:03",
    customer: "Walk-in",
    invoice: "INV-2025-0103",
    itemCount: 1,
    total: 92_000,
    status: "Baru",
  },
  {
    id: "RT-2025-0003",
    tanggal: "11/02/2025 16:40",
    customer: "Bima Nugraha",
    invoice: "INV-2025-0097",
    itemCount: 3,
    total: 310_000,
    status: "Selesai",
  },
];

export default function ReturPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* HEADER */}
      <Link
          href="/penjualan"
          className="mt-1 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
      <div className="flex items-start gap-3">
        
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">
            Penjualan
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Retur Penjualan</h1>
          <p className="text-sm text-gray-600">
            Pantau semua pengajuan retur yang sudah dibuat dan buat pengajuan
            baru bila diperlukan.
          </p>
        </div>
      </div>

      {/* SUMMARY KIRI ATAS */}
      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => {
          const color =
            card.accent === "emerald"
              ? "text-emerald-600 bg-emerald-50 border-emerald-100"
              : card.accent === "indigo"
              ? "text-indigo-600 bg-indigo-50 border-indigo-100"
              : "text-amber-600 bg-amber-50 border-amber-100";
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm"
            >
              <div
                className={`inline-flex items-center justify-center rounded-xl border ${color} p-2`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3">
                <p className="text-sm font-semibold text-gray-800">
                  {card.title}
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {card.value}
                </p>
                <p className="text-xs text-gray-500">{card.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* KONTEN BAWAH: LIST RETUR + PANEL INFO / TIPS */}
      <div className="grid gap-6 lg:grid-cols-[1fr]">
        {/* LIST RETUR */}
        <div className="space-y-4">
          <div className="rounded-3xl border border-[#0f756b]/15 bg-white/90 p-5 shadow-lg shadow-[#3fe0d0]/10">
            {/* HEADER LIST */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Undo2 className="h-5 w-5 text-[#0f756b]" />
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    Daftar Retur
                  </h2>
                  <p className="text-xs text-gray-500">
                    Ini adalah daftar retur yang sudah pernah diajukan.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search di atas table */}
                <div className="relative">
                  <input
                    placeholder="Cari ID / invoice / customer"
                    className="w-56 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 pl-9 text-xs md:text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-[#3FE0D0]"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                </div>
                <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs md:text-sm font-semibold text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow">
                  <Filter className="h-4 w-4" />
                  Filter Status
                </button>
                <Link
                  href="/penjualan/retur/baru"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0f756b] px-3.5 py-2 text-xs md:text-sm font-semibold text-white shadow-md shadow-[#0f756b]/30 transition hover:-translate-y-0.5 hover:shadow-lg hover:bg-[#0d6a62]"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Tambah Retur
                </Link>
              </div>
            </div>

            {/* TABEL LIST RETUR */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100">
              <table className="w-full text-xs md:text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">ID Retur</th>
                    <th className="px-3 py-2 text-left">Tanggal</th>
                    <th className="px-3 py-2 text-left">Customer</th>
                    <th className="px-3 py-2 text-left">Invoice</th>
                    <th className="px-3 py-2 text-right">Item</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {dummyRetur.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/70">
                      <td className="px-3 py-2 font-semibold text-gray-900">
                        {row.id}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {row.tanggal}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {row.customer}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {row.invoice}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {row.itemCount}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">
                        Rp {row.total.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-1 rounded-full text-[11px] font-semibold
                            ${
                              row.status === "Selesai"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : row.status === "Diproses"
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : "bg-sky-50 text-sky-700 border border-sky-100"
                            }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button className="inline-flex items-center gap-1 rounded-lg bg-[#0f756b] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-[#0d6a62]">
                            <Eye className="w-3.5 h-3.5" />
                            Detail
                          </button>
                          <button className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50">
                            <Printer className="w-3.5 h-3.5" />
                            Cetak
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {dummyRetur.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-4 text-center text-sm text-gray-500"
                      >
                        Belum ada data retur.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-[11px] text-gray-500">
              Data di atas masih dummy untuk contoh tampilan. Nantinya akan
              diganti dengan data real dari API retur penjualan.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
