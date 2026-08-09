"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminInquiryPage from "@/app/admin/penjualan/inquiry/page";

export default function InquiryPage() {
  return (
    <div className="relative">
      <Link
        href="/penjualan"
        className="fixed z-50 left-4 top-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali
      </Link>
      <AdminInquiryPage />
    </div>
  );
}
