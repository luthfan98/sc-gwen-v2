"use client";

import { findProductBySlug, similarProducts, brands, categories } from "@/lib/data";
import { useCartStore } from "@/lib/cart-store";
import ProductCard from "@/components/product-card";
import { formatIDR } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  Minus,
  Package,
  Plus,
  Shield,
  ShoppingCart,
  Star,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function ProductDetail({ params }: { params: { slug: string } }) {
  const product = findProductBySlug(params.slug);
  const hydrate = useCartStore((s) => s.hydrate);
  const add = useCartStore((s) => s.add);

  const [selectedImage, setSelectedImage] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => hydrate(), [hydrate]);

  if (!product) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-xl font-semibold">Produk tidak ditemukan</h1>
        <Link href="/" className="text-pink-600 underline mt-2 inline-block">
          Kembali
        </Link>
      </div>
    );
  }

  const similars = similarProducts(product, 4);
  const brand = brands.find((b) => b.id === product.brandId);
  const category = categories.find((c) => c.id === product.categoryId);
  const images = [product.image, product.image, product.image];

  const handleAddToCart = () => {
    add(
      { id: product.id, name: product.name, price: product.price, image: product.image, slug: product.slug },
      quantity
    );
    alert(`Menambahkan ${quantity} ${product.name} ke keranjang`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-gray-500 hover:text-[#3FE0D0]">
              Home
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <Link href={`/#kategori`} className="text-gray-500 hover:text-[#3FE0D0]">
              {category?.name}
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-gray-800 font-medium">{product.name}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-[#3FE0D0] mb-6 transition-colors duration-300"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Kembali</span>
        </Link>

        <div className="grid lg:grid-cols-2 gap-12 bg-white rounded-3xl shadow-lg p-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-gray-100 aspect-square">
              <img
                src={images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setIsWishlisted(!isWishlisted)}
                className="absolute top-4 right-4 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:scale-110 transition-all duration-300"
              >
                <Heart
                  className={`w-6 h-6 ${
                    isWishlisted ? "fill-rose-500 text-rose-500" : "text-gray-400"
                  }`}
                />
              </button>
            </div>

            {/* Thumbnail Gallery */}
            <div className="grid grid-cols-3 gap-3">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`rounded-xl overflow-hidden aspect-square border-2 transition-all duration-300 ${
                    selectedImage === idx
                      ? "border-[#3FE0D0] shadow-lg"
                      : "border-gray-200 hover:border-[#3FE0D0]/50"
                  }`}
                >
                  <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Brand */}
            <div>
              <Link href={`/#brand`} className="text-sm text-[#3FE0D0] font-semibold hover:underline">
                {brand?.name}
              </Link>
            </div>

            {/* Title & Rating */}
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-3">{product.name}</h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${
                        i < Math.floor(product.rating ?? 4)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-lg font-semibold text-gray-700">{product.rating ?? 4.5}</span>
                <span className="text-gray-400">(1,234 reviews)</span>
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-[#3FE0D0]">
                  {formatIDR(product.price)}
                </span>
                <span className="text-xl text-gray-400 line-through">
                  {formatIDR(Math.round(product.price / 0.6))}
                </span>
              </div>
              <div className="inline-block bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold">
                Hemat 40%
              </div>
            </div>

            {/* Description */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-bold text-gray-800 mb-2">Deskripsi Produk</h3>
              <p className="text-gray-600 leading-relaxed">{product.shortDesc}</p>
              <p className="text-gray-600 leading-relaxed mt-3">{product.description}</p>
            </div>

            {/* Quantity Selector */}
            <div className="border-t pt-6">
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Jumlah</label>
              <div className="flex items-center gap-4">
                <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-3 hover:bg-gray-100 transition-colors duration-300"
                  >
                    <Minus className="w-5 h-5 text-gray-600" />
                  </button>
                  <span className="px-6 font-bold text-lg">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-3 hover:bg-gray-100 transition-colors duration-300"
                  >
                    <Plus className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                <span className="text-sm text-gray-500">
                  Stok: <strong className="text-gray-800">999</strong>
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6">
              <button
                onClick={handleAddToCart}
                className="flex-1 flex items-center justify-center gap-3 bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
              >
                <ShoppingCart className="w-6 h-6" />
                Tambah ke Keranjang
              </button>
              <Link
                href="/cart"
                className="px-6 py-4 border-2 border-[#3FE0D0] text-[#3FE0D0] rounded-xl font-bold hover:bg-[#3FE0D0] hover:text-white transition-all duration-300"
              >
                Lihat Keranjang
              </Link>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t">
              <div className="text-center">
                <div className="inline-flex p-3 bg-[#3FE0D0]/10 rounded-xl mb-2">
                  <Truck className="w-6 h-6 text-[#3FE0D0]" />
                </div>
                <p className="text-xs text-gray-600 font-medium">Gratis Ongkir</p>
              </div>
              <div className="text-center">
                <div className="inline-flex p-3 bg-[#3FE0D0]/10 rounded-xl mb-2">
                  <Shield className="w-6 h-6 text-[#3FE0D0]" />
                </div>
                <p className="text-xs text-gray-600 font-medium">100% Original</p>
              </div>
              <div className="text-center">
                <div className="inline-flex p-3 bg-[#3FE0D0]/10 rounded-xl mb-2">
                  <Package className="w-6 h-6 text-[#3FE0D0]" />
                </div>
                <p className="text-xs text-gray-600 font-medium">Packing Aman</p>
              </div>
            </div>
          </div>
        </div>

        {/* Similar Products */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Produk Serupa</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {similars.map((p) => (
              <ProductCard
                key={p.id}
                slug={p.slug}
                name={p.name}
                image={p.image}
                price={p.price}
                shortDesc={p.shortDesc}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
