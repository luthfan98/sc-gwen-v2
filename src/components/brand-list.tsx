"use client";

import Link from "next/link";
import { useMemo } from "react";
import { brands, products } from "@/lib/data";

export default function BrandList() {
  // jumlah produk per brand
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      map.set(p.brandId, (map.get(p.brandId) ?? 0) + 1);
    });
    return map;
  }, []);

  return (
    <section className="bg-gradient-to-b from-white to-gray-50 py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Brand Terpercaya</h2>
          <p className="text-gray-600">Partner resmi brand internasional</p>
        </div>

        {/* Rail scroll di mobile, grid di desktop */}
        <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 sm:overflow-visible">
          {brands.map((b) => {
            const count = counts.get(b.id) ?? 0;
            return (
              <Link
                key={b.id}
                href={`/#produk?brand=${b.slug}`}
                className="group relative min-w-[220px] sm:min-w-0 bg-white rounded-2xl p-6 text-left shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#3FE0D0]/0 to-[#3FE0D0]/0 group-hover:from-[#3FE0D0]/5 group-hover:to-[#2DD4C4]/10 transition-colors" />
                <div className="relative flex items-center gap-4">
                  {/* avatar huruf brand (bisa ganti ke logo file kalau tersedia) */}
                  <div className="w-12 h-12 rounded-xl grid place-items-center font-extrabold text-[#3FE0D0] bg-[#3FE0D0]/10 border border-[#3FE0D0]/20 group-hover:scale-105 transition">
                    {b.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate group-hover:text-[#3FE0D0]">
                      {b.name}
                    </p>
                    <p className="text-sm text-gray-500">{count} produk</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
