"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

// Gambar relevan (landscape)
const promos = [
  {
    id: 1,
    title: "Diskon s.d 50%",
    subtitle: "Skincare pilihan sepanjang minggu",
    image:
      "https://images.unsplash.com/photo-1643747238009-6863ea63e78d?q=80&w=1117&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    colorFrom: "#3FE0D0",
    colorTo: "#2DD4C4",
    link: "/#produk?category=skincare",
    cta: "Belanja Skincare",
  },
  {
    id: 2,
    title: "Flash Sale",
    subtitle: "Makeup favorit, harga terbaik hari ini!",
    image:
      "https://images.unsplash.com/photo-1739980034839-513ef5a16b73?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    colorFrom: "#f43f5e", // rose-500
    colorTo: "#ec4899",   // pink-500
    link: "/#produk?category=makeup&flashsale=true",
    cta: "Ambil Sekarang",
  },
  {
    id: 3,
    title: "Gratis Ongkir",
    subtitle: "Body care min. belanja Rp100rb",
    image:
      "https://images.unsplash.com/photo-1630398777649-cdfc7c5e8a24?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    colorFrom: "#f59e0b", // amber-500
    colorTo: "#fb923c",   // orange-400
    link: "/#produk?category=body-care",
    cta: "Lihat Body Care",
  },
  {
    id: 4,
    title: "Cashback 10%",
    subtitle: "Khusus member baru—daftar & dapatkan",
    image:
      "https://images.unsplash.com/photo-1741896136071-3f8c1d472aa8?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    colorFrom: "#6366f1", // indigo-500
    colorTo: "#60a5fa",   // blue-400
    link: "/register",
    cta: "Daftar Sekarang",
  },
];

export default function PromoStrip() {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Auto-slide: scroll ke posisi slide aktif
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const active = el.children[index] as HTMLElement | undefined;
    if (active) {
      el.scrollTo({
        left: active.offsetLeft,
        behavior: "smooth",
      });
    }
  }, [index]);

  // Interval autoplay
  useEffect(() => {
    const t = setInterval(
      () => setIndex((i) => (i + 1) % promos.length),
      5000
    );
    return () => clearInterval(t);
  }, []);

  return (
    <section className="bg-white py-6">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            
            Promo Spesial Hari Ini
          </h2>
          <div className="flex gap-1">
            {promos.map((_, i) => (
              <button
                key={i}
                aria-label={`Ke slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === index ? "bg-[#3FE0D0]" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Wrapper yang meng-clipping konten di luar padding utama */}
        <div className="relative rounded-3xl overflow-hidden">
          {/* Scroller: di-clip, ada gap antar slide, tapi tidak keluar area utama */}
          <div
            ref={scrollerRef}
            className="flex overflow-x-auto scroll-smooth snap-x snap-mandatory no-scrollbar"
          >
            {promos.map((p) => (
              // Slide: width = container, diberi padding dalam agar ada GAP rapi
              <div key={p.id} className="snap-start shrink-0 w-full">
                {/* Card konten */}
                <div
                  className="h-full w-full rounded-2xl shadow-lg overflow-hidden"
                  style={{
                    background: `linear-gradient(90deg, ${p.colorFrom}, ${p.colorTo})`,
                  }}
                >
                  <div className="grid sm:grid-cols-2">
                    {/* Teks */}
                    <div className="p-6 sm:p-8 text-white flex flex-col justify-center">
                      <h3 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                        {p.title}
                      </h3>
                      <p className="mt-2 text-white/90">{p.subtitle}</p>
                      <div className="mt-5">
                        <Link
                          href={p.link}
                          className="inline-block bg-white text-gray-900 px-5 py-2.5 rounded-full font-semibold hover:shadow-lg transition"
                        >
                          {p.cta}
                        </Link>
                      </div>
                    </div>
                    {/* Gambar */}
                    <div className="relative">
                      <img
                        src={p.image}
                        alt={p.title}
                        className="w-full h-48 sm:h-64 object-cover"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* gradient mask halus di kiri/kanan (opsional, bikin lebih rapi) */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent" />
        </div>
      </div>
    </section>
  );
}

/* tailwind helpers (tambahkan di globals.css kalau belum ada)
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
*/
