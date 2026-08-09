"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { categories, products } from "@/lib/data";
import { Search, Sparkles, Droplets, SprayCan, Scissors } from "lucide-react";

const catIcon: Record<string, any> = {
  skincare: Droplets,
  makeup: Sparkles,
  "body-care": SprayCan,
  "hair-care": Scissors,
};

export default function CategoryList() {
  const [hovered, setHovered] = useState<string | null>(null);

  // hitung jumlah produk per kategori
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
    });
    return map;
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Kategori Produk</h2>
        <Search className="w-5 h-5 text-gray-400" />
      </div>

      {/* Rail scroll di mobile, grid di desktop */}
      <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible">
        {categories.map((c) => {
          const Icon = catIcon[c.slug] ?? Sparkles;
          const count = counts.get(c.id) ?? 0;

          return (
            <Link
              key={c.id}
              href={`/#produk?category=${c.slug}`}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              className={`group relative min-w-[200px] md:min-w-0 overflow-hidden rounded-2xl p-5 text-left transition-all duration-300
              ${
                hovered === c.id
                  ? "bg-gradient-to-br from-[#3FE0D0] to-[#2DD4C4] text-white shadow-xl scale-[1.02]"
                  : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-700 hover:shadow-lg"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`shrink-0 w-10 h-10 rounded-xl grid place-items-center transition-colors
                  ${
                    hovered === c.id
                      ? "bg-white/20 text-white"
                      : "bg-white text-[#3FE0D0]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p
                    className={`font-semibold truncate ${
                      hovered === c.id ? "text-white" : "text-gray-800"
                    }`}
                  >
                    {c.name}
                  </p>
                  <p
                    className={`text-xs ${
                      hovered === c.id ? "text-white/90" : "text-gray-500"
                    }`}
                  >
                    {count} produk
                  </p>
                </div>
              </div>

              {/* accent blur */}
              <div className="pointer-events-none absolute -bottom-10 -right-10 w-28 h-28 rounded-full bg-white/30 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
