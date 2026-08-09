"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { brands, products } from "@/lib/data";
import { Search } from "lucide-react";

export default function BrandsPage() {
  const [q, setQ] = useState("");

  // hitung jumlah produk per brand
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      map.set(p.brandId, (map.get(p.brandId) ?? 0) + 1);
    });
    return map;
  }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(kw));
  }, [q]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3FE0D0]/10 via-white to-pink-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white py-10">
        <div className="mx-auto max-w-7xl px-4">
          <h1 className="text-3xl sm:text-4xl font-bold">Brand</h1>
          <p className="text-white/90 mt-2">Temukan merek favoritmu</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Search */}
        <div className="relative max-w-xl mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari brand…"
            className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-[#3FE0D0] outline-none"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl shadow p-12 text-center text-gray-600">
            Brand tidak ditemukan
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((b) => {
              const c = counts.get(b.id) ?? 0;
              return (
                <Link
                  href={`/brands/${b.slug}`}
                  key={b.id}
                  className="group bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all p-5 flex items-center gap-4"
                >
                  {/* Avatar huruf sebagai logo sederhana */}
                  <div className="w-12 h-12 rounded-xl bg-[#3FE0D0]/10 text-[#3FE0D0] font-extrabold flex items-center justify-center text-lg group-hover:scale-105 transition">
                    {b.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate group-hover:text-[#3FE0D0]">
                      {b.name}
                    </p>
                    <p className="text-sm text-gray-500">{c} produk</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
