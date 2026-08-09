"use client";
import { Sparkles, ShoppingBag, Heart, Shield } from "lucide-react";

export default function AuthSidePanel({
  theme = "tosca", // "tosca" | "pink"
  title,
  subtitle,
}: { theme?: "tosca" | "pink"; title: string; subtitle: string }) {
  const bg =
    theme === "tosca"
      ? "from-[#3FE0D0] to-[#2DD4C4]"
      : "from-pink-500 to-rose-500";

  return (
    <div className="relative">
      <div className={`absolute inset-0 bg-gradient-to-br ${bg} rounded-3xl transform rotate-3 opacity-20`} />
      <div className={`relative bg-gradient-to-br ${bg} rounded-3xl p-12 text-white`}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <span className="text-3xl font-bold">gwen</span>
        </div>

        <h2 className="text-4xl font-bold mb-4">{title}</h2>
        <p className="text-lg text-white/90 mb-8">{subtitle}</p>

        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold">10,000+ Produk</p>
              <p className="text-sm text-white/80">Koleksi lengkap</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold">100% Original</p>
              <p className="text-sm text-white/80">Jaminan keaslian</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold">Gratis Ongkir</p>
              <p className="text-sm text-white/80">Pengiriman cepat</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
