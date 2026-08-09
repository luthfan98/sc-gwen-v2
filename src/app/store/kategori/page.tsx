"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { categories, products } from "@/lib/data";
import { Search } from "lucide-react";

export default function CategoriesPage() {
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
    });
    return map;
  }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(kw));
  }, [q]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3FE0D0]/10 via-white to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white py-10">
        <div className="mx-auto max-w-7xl px-4">
          <h1 className="text-3xl sm:text-4xl font-bold">Kategori Produk</h1>
          <p className="text-white/90 mt-2">Jelajahi berdasarkan kategori</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Search */}
        <div className="relative max-w-xl mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari kategori…"
            className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-[#3FE0D0] outline-none"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl shadow p-12 text-center text-gray-600">
            Tidak ada kategori ditemukan
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((c) => {
              const count = counts.get(c.id) ?? 0;
              return (
                <Link
                  href={`/categories/${c.slug}`}
                  key={c.id}
                  className="group bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all p-5 flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#3FE0D0]/10 text-[#3FE0D0] font-extrabold flex items-center justify-center text-lg group-hover:scale-105 transition">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate group-hover:text-[#3FE0D0]">
                      {c.name}
                    </p>
                    <p className="text-sm text-gray-500">{count} produk</p>
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
