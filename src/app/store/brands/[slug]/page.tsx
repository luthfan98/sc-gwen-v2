"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { brands, categories, products } from "@/lib/data";
import ProductCard from "@/components/product-card";
import { ArrowLeft, Grid, List, Search } from "lucide-react";

export default function BrandDetailPage({ params }: { params: { slug: string } }) {
  const brand = brands.find((b) => b.slug === params.slug);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  const all = useMemo(() => {
    if (!brand) return [];
    return products.filter((p) => p.brandId === brand.id);
  }, [brand]);

  const filtered = useMemo(() => {
    const kw = q.toLowerCase();
    return all.filter((p) => {
      const okName = p.name.toLowerCase().includes(kw);
      const okCat = cat === "all" || p.categoryId === cat;
      return okName && okCat;
    });
  }, [all, q, cat]);

  if (!brand) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-lg font-semibold">Brand tidak ditemukan.</p>
        <Link href="/brands" className="text-[#3FE0D0] underline mt-2 inline-block">
          Kembali ke daftar brand
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3FE0D0]/10 via-white to-pink-50">
      {/* Hero brand */}
      <div className="bg-white border-b">
        <div className="mx-auto max-w-7xl px-4 py-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Brand</p>
            <h1 className="text-3xl font-bold text-gray-900">{brand.name}</h1>
            <p className="text-gray-500">Produk {brand.name} pilihan untukmu</p>
          </div>
          <Link
            href="/brands"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-[#3FE0D0]"
          >
            <ArrowLeft className="w-5 h-5" />
            Kembali
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 grid lg:grid-cols-4 gap-8">
        {/* Sidebar filter kategori */}
        <aside className="lg:col-span-1">
          <div className="bg-white rounded-3xl shadow p-6 sticky top-6">
            <h3 className="font-bold text-gray-800 mb-4">Filter</h3>

            <div className="relative mb-5">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari produk…"
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3FE0D0] outline-none"
              />
            </div>

            <div>
              <p className="font-semibold text-gray-700 mb-2">Kategori</p>
              <div className="space-y-2">
                <button
                  onClick={() => setCat("all")}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                    cat === "all"
                      ? "bg-[#3FE0D0]/10 text-[#3FE0D0] font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Semua
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCat(c.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                      cat === c.id
                        ? "bg-[#3FE0D0]/10 text-[#3FE0D0] font-semibold"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Konten produk */}
        <main className="lg:col-span-3">
          {/* Toolbar */}
          <div className="bg-white rounded-2xl shadow p-4 mb-6 flex items-center justify-between">
            <p className="text-gray-600">
              {filtered.length} produk {q ? `untuk "${q}"` : "" }
            </p>
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setView("grid")}
                className={`p-2 rounded-lg ${view === "grid" ? "bg-white shadow" : "text-gray-500"}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setView("list")}
                className={`p-2 rounded-lg ${view === "list" ? "bg-white shadow" : "text-gray-500"}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* List/Grid */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-3xl shadow p-12 text-center text-gray-600">
              Tidak ada produk ditemukan
            </div>
          ) : view === "grid" ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  slug={p.slug}
                  name={p.name}
                  image={p.image}
                  price={p.price}
                  shortDesc={p.shortDesc}
                  rating={(p as any).rating}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {filtered.map((p) => (
                <BrandListCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Kartu versi list khusus di halaman brand
function BrandListCard({ p }: { p: (typeof products)[number] }) {
  return (
    <Link
      href={`/product/${p.slug}`}
      className="bg-white rounded-2xl shadow hover:shadow-xl transition overflow-hidden flex gap-6 p-5 group"
    >
      <div className="w-40 h-40 rounded-xl overflow-hidden">
        <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#3FE0D0] line-clamp-2">
          {p.name}
        </h3>
        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{p.shortDesc}</p>
      </div>
    </Link>
  );
}
