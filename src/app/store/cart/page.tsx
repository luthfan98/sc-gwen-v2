"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useCartStore } from "@/lib/cart-store";
import { formatIDR } from "@/lib/utils";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";

export default function CartPage() {
  // 👉 gunakan selector agar re-render saat items berubah
  const items   = useCartStore((s) => s.items);
  const inc     = useCartStore((s) => s.inc);
  const dec     = useCartStore((s) => s.dec);
  const remove  = useCartStore((s) => s.remove);
  const clear   = useCartStore((s) => s.clear);
  const hydrate = useCartStore((s) => s.hydrate);

  useEffect(() => { hydrate(); }, [hydrate]);

  // 👉 hitung subtotal/diskon/total dari items (bukan dari getter store)
  const { subtotal, diskon, grandTotal } = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const diskon   = Math.round(subtotal * 0.10); // 10%
    const grandTotal = subtotal - diskon;
    return { subtotal, diskon, grandTotal };
  }, [items]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3FE0D0]/10 via-white to-pink-50 py-12 px-4">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-10 text-center">Keranjang Belanja</h1>

        {items.length === 0 ? (
          <div className="text-center bg-white rounded-3xl shadow-lg p-10">
            <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 mb-2">Keranjang kamu masih kosong</p>
            <Link
              href="/"
              className="inline-block bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white px-6 py-3 rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              Belanja Sekarang
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* List Item */}
            <div className="lg:col-span-2 space-y-5">
              {items.map((i) => (
                <div
                  key={i.id}
                  className="flex flex-col sm:flex-row items-center gap-4 bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 p-4"
                >
                  <img src={i.image} alt={i.name} className="w-28 h-28 rounded-xl object-cover" />
                  <div className="flex-1 text-center sm:text-left">
                    <p className="font-semibold text-lg text-gray-800">{i.name}</p>
                    <p className="text-sm text-gray-500 mb-2">{formatIDR(i.price)}</p>

                    <div className="flex justify-center sm:justify-start items-center gap-3">
                      <button onClick={() => dec(i.id)} className="p-2 rounded-lg border-2 border-gray-200 hover:border-[#3FE0D0] transition">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="min-w-[40px] text-center font-semibold">{i.qty}</span>
                      <button onClick={() => inc(i.id)} className="p-2 rounded-lg border-2 border-gray-200 hover:border-[#3FE0D0] transition">
                        <Plus className="w-4 h-4" />
                      </button>

                      <button onClick={() => remove(i.id)} className="ml-4 text-sm text-red-500 hover:underline flex items-center gap-1">
                        <Trash2 className="w-4 h-4" /> Hapus
                      </button>
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                    <p className="font-bold text-gray-800">{formatIDR(i.price * i.qty)}</p>
                  </div>
                </div>
              ))}

              <button onClick={clear} className="flex items-center gap-2 text-sm text-red-600 hover:underline font-medium">
                <Trash2 className="w-4 h-4" />
                Kosongkan Keranjang
              </button>
            </div>

            {/* Ringkasan */}
            <aside className="bg-white rounded-3xl shadow-xl p-6 h-fit">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Ringkasan Belanja</h2>

              <div className="space-y-3 text-sm border-t border-b py-4">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-gray-800">{formatIDR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Diskon (10%)</span>
                  <span className="font-medium text-rose-500">- {formatIDR(diskon)}</span>
                </div>
                <div className="flex justify-between text-gray-800 font-semibold text-base">
                  <span>Total</span>
                  <span>{formatIDR(grandTotal)}</span>
                </div>
              </div>

              <button
                onClick={() => alert("Checkout dummy. (Fase 2 akan ditambah)")}
                className="mt-5 w-full bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white py-3.5 rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
              >
                Checkout Sekarang
              </button>

              <p className="text-xs text-gray-500 mt-3 text-center">* Harga belum termasuk ongkir</p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
