"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Barcode,
  Droplets,
  Info,
  PackageOpen,
  Search,
  Sparkles,
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  type: string;
  sku: string;
  barcode: string;
  price: number;
  description: string;
  image: string;
};

type UsageRecommendation = {
  skinType: string;
  bodyType: string;
  concerns: string;
  tips: string;
};

const sampleProducts: Product[] = [
  {
    id: "BRG-001",
    name: "Glowree Bright Serum 30ml",
    type: "Skincare",
    sku: "SKU-GLW-01",
    barcode: "8999887766554",
    price: 165000,
    description:
      "Serum pencerah dengan 5% niacinamide untuk membantu menyamarkan noda hitam dan meratakan warna kulit.",
    image: "https://picsum.photos/seed/serum1/640/640",
  },
  {
    id: "BRG-002",
    name: "Veluxe Lip Matte #Rose",
    type: "Makeup",
    sku: "SKU-LIP-02",
    barcode: "8999112233445",
    price: 92000,
    description:
      "Lip matte ringan dengan hasil velvet, tidak membuat bibir kering, dan warna Rose yang natural sehari-hari.",
    image: "https://picsum.photos/seed/lip1/640/640",
  },
  {
    id: "BRG-003",
    name: "UV Shield Sunscreen SPF50",
    type: "Skincare",
    sku: "SKU-SS-04",
    barcode: "8999000012345",
    price: 112000,
    description:
      "Sunscreen ringan SPF50 PA++++ dengan perlindungan UVA/UVB dan finish tidak lengket, nyaman dipakai harian.",
    image: "https://picsum.photos/seed/sunscreen1/640/640",
  },
];

function findProduct(query: string): Product | null {
  const cleaned = query.trim().toLowerCase();
  if (!cleaned) return null;

  const exactBarcode = sampleProducts.find(
    (p) => p.barcode.toLowerCase() === cleaned
  );
  if (exactBarcode) return exactBarcode;

  const exactSku = sampleProducts.find(
    (p) =>
      p.sku.toLowerCase() === cleaned || p.id.toLowerCase() === cleaned
  );
  if (exactSku) return exactSku;

  return (
    sampleProducts.find(
      (p) =>
        p.name.toLowerCase().includes(cleaned) ||
        p.sku.toLowerCase().includes(cleaned) ||
        p.barcode.toLowerCase().includes(cleaned)
    ) || null
  );
}

function getUsageRecommendation(product: Product): UsageRecommendation {
  switch (product.id) {
    case "BRG-001":
      return {
        skinType: "Normal • Kombinasi • Kusam",
        bodyType:
          "Cocok untuk usia produktif (18–40 th) dengan aktivitas indoor dan outdoor.",
        concerns:
          "Kulit kusam, warna tidak merata, bekas jerawat ringan, dan tekstur kulit kasar.",
        tips:
          "Gunakan 3–4 tetes setelah toner pada kulit yang kering, 1–2 kali sehari. Wajib diikuti sunscreen pada pagi/siang hari.",
      };
    case "BRG-002":
      return {
        skinType: "Semua tipe kulit bibir",
        bodyType:
          "Cocok untuk yang sering beraktivitas di ruangan AC atau banyak ngobrol.",
        concerns:
          "Bibir tampak pucat, ingin tampilan natural tapi tetap rapi untuk kerja atau kuliah.",
        tips:
          "Gunakan tipis di tengah bibir lalu ratakan ke luar untuk efek gradasi. Untuk tampilan intens, lapisi 2–3 kali.",
      };
    case "BRG-003":
      return {
        skinType: "Normal • Berminyak • Kombinasi • Acne-prone",
        bodyType:
          "Aktif di luar ruangan, sering naik motor, atau sering terpapar layar gadget.",
        concerns:
          "Takut kulit belang, flek muncul, atau kulit terasa perih saat terkena matahari.",
        tips:
          "Gunakan 2 jari penuh untuk wajah dan leher, 15 menit sebelum keluar rumah. Ulangi setiap 3–4 jam untuk hasil maksimal.",
      };
    default:
      return {
        skinType: "Semua tipe kulit (umum)",
        bodyType: "Dapat digunakan oleh pria maupun wanita, remaja hingga dewasa.",
        concerns:
          "Perawatan harian dasar, menjaga kulit tetap bersih dan terhidrasi.",
        tips:
          "Gunakan rutin sesuai petunjuk pemakaian di kemasan dan kombinasikan dengan sunscreen setiap pagi.",
      };
  }
}

export default function CekHargaPage() {
  const [query, setQuery] = useState("");
  const [touched, setTouched] = useState(false);
  const router = useRouter();

  const result = useMemo(() => findProduct(query), [query]);
  const recommendation = useMemo(
    () => (result ? getUsageRecommendation(result) : null),
    [result]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("penjualan_auth");
      document.cookie = "penjualan_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "kosmetik-admin-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "kosmetik-admin-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    } catch (err) {
      console.warn("Unable to clear auth flag", err);
    }
    router.push("/logout");
  };

  const notFound = touched && !result && query.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e8fff6] via-white to-[#dff7f0] text-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#0f756b]/10 border border-[#0f756b]/20 flex items-center justify-center text-[#0f756b]">
              <Barcode className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">
                Cek Harga
              </p>
              <h1 className="text-2xl font-bold text-gray-900">
                Pindai barcode atau cari SKU
              </h1>
              <p className="text-sm text-gray-600">
                Ketik atau tempel hasil scan barcode, lalu tekan Enter. Detail
                produk tampil lengkap dengan foto, jenis, dan harga.
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-red-50"
          >
            Logout
          </button>
        </div>

        {/* FORM INPUT */}
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-[#0f756b]/15 bg-white/90 shadow-lg shadow-[#3fe0d0]/15 p-5 space-y-3"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute left-3 top-2.5 text-gray-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Scan / ketik barcode, SKU, atau nama produk"
                className="w-full rounded-2xl border border-gray-200 bg-white px-10 py-3 text-base text-gray-900 shadow-sm outline-none transition focus:border-[#0f756b] focus:ring-2 focus:ring-[#0f756b]/25"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0f756b] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#0f756b]/30 transition hover:-translate-y-0.5 hover:shadow-lg hover:bg-[#0d6a62]"
            >
              <Sparkles className="h-4 w-4" />
              Cari / Enter
            </button>
          </div>
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <Info className="h-4 w-4 text-[#0f756b]" />
            Dukungan barcode: cukup scan, kolom ini otomatis terisi sebelum Anda
            tekan Enter.
          </p>
        </form>

        {/* HASIL PRODUK */}
        {result && (
          <div className="space-y-4">
            {/* Detail utama: foto kiri, info kanan */}
            <section className="rounded-3xl border border-[#0f756b]/15 bg-white/95 p-5 shadow-lg shadow-[#3fe0d0]/15">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <PackageOpen className="h-4 w-4 text-[#0f756b]" />
                  Detail Produk
                </div>
                <span className="text-[11px] text-gray-500">
                  Data masih dummy untuk kebutuhan demo
                </span>
              </div>

              <div className="flex flex-col md:flex-row gap-5 items-start">
                {/* FOTO – kecil di kiri */}
                <div className="relative w-full max-w-[230px] md:w-[230px] flex-shrink-0 self-stretch">
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-6 -top-6 w-20 h-20 bg-[#3FE0D0]/20 blur-3xl" />
                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#0f756b]/20 blur-3xl" />
                  </div>
                  <div className="relative w-full aspect-[4/5] overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-[#f5fffb] via-white to-[#e4fbf4] shadow-inner">
                    <img
                      src={result.image}
                      alt={result.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>

                {/* INFO DI KANAN */}
                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-[#0f756b]/10 text-[#0f756b] text-[11px] font-semibold border border-[#0f756b]/20">
                      {result.type || "Produk"}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-[11px] font-semibold border border-gray-200">
                      SKU: {result.sku}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-[11px] font-semibold border border-gray-200">
                      Kode: {result.id}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {result.name}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                      {result.description}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#0f756b]/15 bg-gradient-to-r from-[#f0fffb] via-white to-[#e4fbf4] p-4 shadow-sm flex flex-col gap-1.5">
                    <span className="text-sm text-gray-600">Harga</span>
                    <span className="text-3xl font-bold text-[#0f756b]">
                      Rp {result.price.toLocaleString("id-ID")}
                    </span>
                    <p className="text-xs text-gray-500">
                      Harga eceran terbaru (dummy). Sesuaikan dengan harga real
                      dari sistem POS Anda.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <Barcode className="h-4 w-4 text-[#0f756b]" />
                      <span className="text-gray-600">Barcode:</span>
                      <span className="font-semibold text-gray-900">
                        {result.barcode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[#0f756b]" />
                      <span className="text-gray-600">Status:</span>
                      <span className="font-semibold text-gray-900">
                        Aktif • Tersedia (dummy)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* REKOMENDASI PENGGUNAAN */}
            {recommendation && (
              <section className="rounded-3xl border border-indigo-100 bg-white/95 p-5 shadow-md shadow-indigo-100/60">
                <div className="flex items-center gap-2 mb-3">
                  <Droplets className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-base font-semibold text-gray-900">
                    Rekomendasi Penggunaan
                  </h3>
                </div>

                <div className="grid gap-4 md:grid-cols-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-500">
                      Tipe Kulit / Area
                    </p>
                    <p className="text-gray-800">{recommendation.skinType}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-500">
                      Cocok Untuk
                    </p>
                    <p className="text-gray-800">{recommendation.bodyType}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-500">
                      Fokus Manfaat
                    </p>
                    <p className="text-gray-800">{recommendation.concerns}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900 flex gap-2">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>{recommendation.tips}</p>
                </div>
              </section>
            )}
          </div>
        )}

        {/* NOT FOUND */}
        {notFound && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5" />
            <div>
              Produk tidak ditemukan. Coba barcode lain, SKU lain, atau pastikan
              ejaan nama produk sudah benar.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
