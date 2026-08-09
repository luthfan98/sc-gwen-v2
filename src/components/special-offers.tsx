"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { products } from "@/lib/data";
import { formatIDR } from "@/lib/utils";
import { Sparkles, ChevronRight, Star, ShoppingCart, ChevronLeft } from "lucide-react";

function usePromoProducts() {
  return useMemo(() => {
    return [...products]
      .sort((a, b) => ((b as any).rating ?? 0) - ((a as any).rating ?? 0))
      .slice(0, 12);
  }, []);
}

export default function SpecialOffers() {
  const promos = usePromoProducts();

  // === interaksi scroll =====
  const railRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startLeft, setStartLeft] = useState(0);

  // map wheel vertikal -> horizontal (biar di desktop bisa digeser)
  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!railRef.current) return;
    // kalau deltaY lebih dominan, geser kanan-kiri
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      railRef.current.scrollLeft += e.deltaY;
    }
  };

  // drag-to-scroll (desktop mouse / pointer)
  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!railRef.current) return;
    setDragging(true);
    setStartX(e.clientX);
    setStartLeft(railRef.current.scrollLeft);
    railRef.current.setPointerCapture(e.pointerId);
  };
  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!dragging || !railRef.current) return;
    const dx = e.clientX - startX;
    railRef.current.scrollLeft = startLeft - dx;
  };
  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    setDragging(false);
    railRef.current?.releasePointerCapture(e.pointerId);
  };

  // tombol panah opsional (geser per kartu)
  const scrollByCard = (dir: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>(".offer-card");
    const gap = 12; // gap-3
    const w = (card?.offsetWidth ?? 250) + gap;
    rail.scrollBy({ left: dir * w, behavior: "smooth" });
  };

  return (
    <section className="bg-white py-8">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Penawaran spesial</h2>
          <Link
            href="/products"
            className="text-sm font-semibold text-[#3FE0D0] hover:underline inline-flex items-center gap-1"
          >
            Lihat semua <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          {/* LEFT: Fixed banner (desktop) */}
          <div className="hidden lg:block">
            <PromoLeftCard />
          </div>

          {/* RIGHT: scroller */}
          <div className="relative rounded-2xl overflow-hidden bg-white">
            {/* arrows desktop */}
            <button
              aria-label="Prev"
              onClick={() => scrollByCard(-1)}
              className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 border shadow hover:shadow-lg active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              aria-label="Next"
              onClick={() => scrollByCard(1)}
              className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 border shadow hover:shadow-lg active:scale-95"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* gradient mask kiri/kanan agar rapi */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent z-10" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />

            {/* rail */}
            <div
              ref={railRef}
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="
                flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar px-1 py-1
                touch-pan-x select-none cursor-grab active:cursor-grabbing
              "
            >
              {/* Banner as first item on mobile */}
              <div className="lg:hidden snap-start shrink-0 w-[250px]">
                <PromoLeftCard />
              </div>

              {promos.map((p) => (
                <Link
                  href={`/product/${p.slug}`}
                  key={p.id}
                  className="offer-card snap-start shrink-0 w-[250px] bg-white border rounded-2xl shadow-sm hover:shadow-xl transition-all overflow-hidden"
                >
                  <div className="relative">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-40 object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2 bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                      30% OFF
                    </div>
                  </div>

                  <div className="p-3">
                    <p className="text-[13px] text-gray-700 line-clamp-2 min-h-[36px]">
                      {p.name}
                    </p>

                    <div className="mt-2">
                      <div className="text-gray-400 text-xs line-through">
                        {formatIDR(Math.round(p.price / 0.7))}
                      </div>
                      <div className="font-bold text-gray-900">
                        {formatIDR(p.price)}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        {(p as any).rating ?? 4.7}
                      </span>
                      {(p as any).sold && (
                        <span className="truncate">• Terjual {(p as any).sold}+</span>
                      )}
                    </div>

                    <div className="mt-3">
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#3FE0D0]">
                        <ShoppingCart className="w-4 h-4" />
                        Lihat detail
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

function PromoLeftCard() {
  return (
    <div
      className="h-full rounded-2xl overflow-hidden shadow-lg border"
      style={{
        background:
          "linear-gradient(135deg, rgba(63,224,208,1) 0%, rgba(45,212,196,1) 40%, rgba(255,255,255,1) 120%)",
      }}
    >
      <div className="p-5 text-white flex flex-col h-full">
        <div className="inline-flex items-center gap-2 text-[12px] font-semibold bg-white/20 rounded-full px-3 py-1 w-fit">
          <Sparkles className="w-4 h-4 text-white" />
          HOT PICKS
        </div>
        <h3 className="text-2xl font-extrabold mt-3 leading-tight">
          Diskon s.d. <br /> 500rb
        </h3>
        <p className="text-white/90 text-sm mt-2">Produk pilihan • Hari ini saja</p>
        <div className="mt-auto">
          <img
            src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80"
            alt="Promo visual"
            className="w-full h-32 object-cover rounded-xl mt-4"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}

/* CSS helper (pastikan ada di globals.css)
.no-scrollbar::-webkit-scrollbar{ display:none; }
.no-scrollbar{ -ms-overflow-style:none; scrollbar-width:none; }
*/
