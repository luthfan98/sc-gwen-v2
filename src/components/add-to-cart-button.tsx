"use client";

import { useCartStore } from "@/lib/cart-store";

type Props = {
  id: string;
  name: string;
  price: number;
  image: string;
  slug: string;
};

export default function AddToCartButton(props: Props) {
  const add = useCartStore((s) => s.add);
  return (
    <button
      onClick={() => add(props, 1)}
      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-pink-500 text-white text-sm font-medium hover:opacity-90"
    >
      Masukkan Keranjang
    </button>
  );
}
