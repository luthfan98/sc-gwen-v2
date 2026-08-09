"use client";

import Link from "next/link";
import { useState } from "react";
import { ShoppingCart, Heart, Star } from "lucide-react";
import { formatIDR } from "@/lib/utils";
import { useCartStore } from "@/lib/cart-store";

type Props = {
  slug: string;
  name: string;
  price: number;
  image: string;
  shortDesc: string;
  rating?: number; // jadikan opsional, fallback di bawah
};

export default function ProductCard({
  slug,
  name,
  price,
  image,
  shortDesc,
  rating,
}: Props) {
  const [isLiked, setIsLiked] = useState(false);
  const add = useCartStore((s) => s.add);

  const r = typeof rating === "number" ? rating : 4.5;

  const onAdd = () => {
    add({ id: slug, // jika punya id terpisah, ganti ke id produk
          name,
          price,
          image,
          slug }, 1);
  };

  return (
    <article className="group relative bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
      {/* media */}
      <div className="relative overflow-hidden">
        <Link href={`/product/${slug}`} aria-label={`Lihat detail ${name}`}>
          <div className="aspect-[4/5] w-full bg-gray-50 overflow-hidden">
            <img
              src={image}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          </div>
        </Link>

        {/* like */}
        <button
          type="button"
          onClick={() => setIsLiked((v) => !v)}
          aria-label={isLiked ? "Hapus dari favorit" : "Tambah ke favorit"}
          className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:scale-110 transition-transform duration-300"
        >
          <Heart
            className={`w-5 h-5 ${
              isLiked ? "fill-rose-500 text-rose-500" : "text-gray-400"
            }`}
          />
        </button>

        {/* badge promo (dummy 40%) */}
        <div className="absolute bottom-3 left-3 bg-[#3FE0D0] text-white px-3 py-1 rounded-full text-xs font-semibold">
          40% OFF
        </div>
      </div>

      {/* body */}
      <div className="p-4">
        {/* rating */}
        <div className="flex items-center gap-1 mb-1">
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-semibold text-gray-700">{r.toFixed(1)}</span>
          <span className="text-xs text-gray-400 ml-1">(150+)</span>
        </div>

        {/* title */}
        <Link
          href={`/product/${slug}`}
          className="block font-semibold text-gray-900 mb-1 line-clamp-2 group-hover:text-[#3FE0D0] transition-colors duration-300"
        >
          {name}
        </Link>

        {/* short desc */}
        <p className="text-sm text-gray-500 mb-3 line-clamp-1">{shortDesc}</p>

        {/* price + add button */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-gray-400 line-through">
              {formatIDR(Math.round(price / 0.6))}
            </p>
            <p className="text-lg font-bold text-[#3FE0D0]">{formatIDR(price)}</p>
          </div>

          <button
            type="button"
            onClick={onAdd}
            aria-label={`Tambah ${name} ke keranjang`}
            className="p-2.5 bg-gradient-to-br from-[#3FE0D0] to-[#2DD4C4] text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-300"
          >
            <ShoppingCart className="w-5 h-5" />
          </button>
        </div>
      </div>
    </article>
  );
}
