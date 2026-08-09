"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { products, categories, brands } from "@/lib/data";
import { formatIDR } from "@/lib/utils";
import ProductCard from "@/components/product-card";
import {
  Search,
  Filter,
  SlidersHorizontal,
  X,
  Grid,
  List,
  Star,
  ShoppingCart,
} from "lucide-react";

// Card versi LIST (horizontal) – grid pakai ProductCard bawaan proyek
function ListCard({ p }: { p: (typeof products)[number] }) {
  const brand = brands.find((b) => b.id === p.brandId);
  return (
    <Link
      href={`/product/${p.slug}`}
      className="bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden flex gap-6 p-6 group"
    >
      <div className="relative w-40 sm:w-48 h-40 sm:h-48 flex-shrink-0 rounded-xl overflow-hidden">
        <img
          src={p.image}
          alt={p.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 right-3 bg-[#3FE0D0] text-white px-2 py-1 rounded-full text-[11px] font-semibold">
          40% OFF
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#3FE0D0] bg-[#3FE0D0]/10 px-3 py-1 rounded-full">
              {brand?.name}
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-1 line-clamp-2 group-hover:text-[#3FE0D0] transition-colors">
            {p.name}
          </h3>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{p.shortDesc}</p>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold text-gray-700">
                {(p as any).rating ?? 4.7}
              </span>
            </div>
            {(p as any).sold && (
              <span className="text-gray-500">{(p as any).sold} terjual</span>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 line-through">
              {formatIDR(Math.round(p.price / 0.6))}
            </p>
            <p className="text-xl font-bold text-[#3FE0D0]">{formatIDR(p.price)}</p>
          </div>

          <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white rounded-xl text-sm font-semibold">
            <ShoppingCart className="w-4 h-4" />
            Lihat
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function ProductListingPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | string>("all");
  const [selectedBrand, setSelectedBrand] = useState<"all" | string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "popular" | "rating" | "price-low" | "price-high">("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showMobileFilter, setShowMobileFilter] = useState(false);

  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      const byName = p.name.toLowerCase().includes(search.toLowerCase());
      const byCat = selectedCategory === "all" || p.categoryId === selectedCategory;
      const byBrand = selectedBrand === "all" || p.brandId === selectedBrand;
      return byName && byCat && byBrand;
    });

    switch (sortBy) {
      case "price-low":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "rating":
        result = [...result].sort(
          (a, b) => ((b as any).rating ?? 0) - ((a as any).rating ?? 0)
        );
        break;
      case "popular":
        result = [...result].sort(
          (a, b) => ((b as any).sold ?? 0) - ((a as any).sold ?? 0)
        );
        break;
      default:
        // "newest" – biarkan urutan data
        break;
    }

    return result;
  }, [search, selectedCategory, selectedBrand, sortBy]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white py-10">
        <div className="mx-auto max-w-7xl px-4">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Semua Produk</h1>
          <p className="text-white/90">Temukan produk kecantikan terbaik untuk Anda</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar Filter – Desktop */}
          <aside className="hidden lg:block">
            <div className="bg-white rounded-3xl shadow-xl p-6 sticky top-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-[#3FE0D0]" />
                  Filter
                </h2>
                <button
                  onClick={() => {
                    setSelectedCategory("all");
                    setSelectedBrand("all");
                    setSearch("");
                  }}
                  className="text-sm text-[#3FE0D0] hover:underline font-medium"
                >
                  Reset
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Cari produk..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3FE0D0] focus:outline-none transition-colors"
                />
              </div>

              {/* Category */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <h3 className="font-bold mb-3 text-gray-800">Kategori</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      selectedCategory === "all"
                        ? "bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white shadow-lg"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Semua Kategori
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        selectedCategory === cat.id
                          ? "bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white shadow-lg"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand */}
              <div>
                <h3 className="font-bold mb-3 text-gray-800">Brand</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedBrand("all")}
                    className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      selectedBrand === "all"
                        ? "bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white shadow-lg"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Semua Brand
                  </button>
                  {brands.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBrand(b.id)}
                      className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        selectedBrand === b.id
                          ? "bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white shadow-lg"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="lg:col-span-3">
            {/* Toolbar */}
            <div className="bg-white rounded-2xl shadow-md p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMobileFilter(true)}
                  className="lg:hidden flex items-center gap-2 px-4 py-2 bg-[#3FE0D0] text-white rounded-xl font-medium"
                >
                  <Filter className="w-5 h-5" />
                  Filter
                </button>
                <p className="text-gray-600 font-medium">
                  {filtered.length} <span className="text-gray-400">produk ditemukan</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-[#3FE0D0] focus:outline-none text-sm font-medium"
                >
                  <option value="newest">Terbaru</option>
                  <option value="popular">Terpopuler</option>
                  <option value="rating">Rating Tertinggi</option>
                  <option value="price-low">Harga Terendah</option>
                  <option value="price-high">Harga Tertinggi</option>
                </select>

                {/* View mode */}
                <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-white shadow" : "text-gray-500"}`}
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 rounded-lg transition-all ${viewMode === "list" ? "bg-white shadow" : "text-gray-500"}`}
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Grid / List */}
            {filtered.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl shadow-md">
                <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Tidak ada produk ditemukan</h3>
                <p className="text-gray-600">Coba ubah filter atau kata kunci pencarian</p>
              </div>
            ) : viewMode === "grid" ? (
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
                  <ListCard key={p.id} p={p} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {showMobileFilter && (
        <div className="fixed inset-0 bg-black/50 z-50 lg:hidden">
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Filter Produk</h2>
                <button
                  onClick={() => setShowMobileFilter(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Cari produk..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3FE0D0] focus:outline-none"
                />
              </div>

              {/* Kategori */}
              <div className="mb-6">
                <h3 className="font-bold mb-3 text-gray-800">Kategori</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium ${
                      selectedCategory === "all"
                        ? "bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Semua Kategori
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium ${
                        selectedCategory === cat.id
                          ? "bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand */}
              <div className="mb-6">
                <h3 className="font-bold mb-3 text-gray-800">Brand</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedBrand("all")}
                    className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium ${
                      selectedBrand === "all"
                        ? "bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Semua Brand
                  </button>
                  {brands.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBrand(b.id)}
                      className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium ${
                        selectedBrand === b.id
                          ? "bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowMobileFilter(false)}
                className="w-full bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white py-4 rounded-xl font-bold hover:shadow-lg transition"
              >
                Terapkan Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
