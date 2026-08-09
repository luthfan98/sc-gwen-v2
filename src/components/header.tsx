"use client";

import Link from "next/link";
import Image from "next/image";
import { useCartStore } from "@/lib/cart-store";
import { Menu, ShoppingCart, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  // ambil items langsung agar bisa hitung count dinamis
  const { items } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // hitung total item di cart (jumlah qty, bukan sekadar panjang array)
  const count = items.reduce((sum, item) => sum + (item.qty || 1), 0);

  useEffect(() => setMounted(true), []);

  if (isAdminRoute) return null;

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b border-gray-100 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/store" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl overflow-hidden shadow-lg border border-[#3FE0D0]/30 hover:scale-110 transition-transform duration-300">
              <Image
                src="/logo_gwen_sq_500.png"
                alt="Gwen Logo"
                width={44}
                height={44}
                className="object-cover w-full h-full"
                priority
              />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] bg-clip-text text-transparent">
              gwen
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/store/kategori" className="text-gray-700 hover:text-[#3FE0D0] font-medium transition-colors duration-300">
              Kategori
            </Link>
            <Link href="/store/brand" className="text-gray-700 hover:text-[#3FE0D0] font-medium transition-colors duration-300">
              Brand
            </Link>
            <Link href="/store/products" className="text-gray-700 hover:text-[#3FE0D0] font-medium transition-colors duration-300">
              Produk
            </Link>
            <Link href="/store/login" className="text-gray-700 hover:text-[#3FE0D0] font-medium transition-colors duration-300">
              Login
            </Link>
            <Link href="/store/register" className="px-6 py-2 bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white rounded-full font-medium hover:shadow-lg hover:scale-105 transition-all duration-300">
              Register
            </Link>
          </nav>

          {/* Cart & Mobile Menu */}
          <div className="flex items-center gap-4">
            {/* Cart */}
            <Link href="/store/cart" className="relative p-2 hover:bg-gray-100 rounded-full transition-colors duration-300">
              <ShoppingCart className="w-6 h-6 text-gray-700" />
              {mounted && count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gradient-to-br from-pink-500 to-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md">
                  {count}
                </span>
              )}
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors duration-300"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-700" />
              ) : (
                <Menu className="w-6 h-6 text-gray-700" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden mt-4 pb-4 flex flex-col gap-3 border-t pt-4">
            <Link href="/store/kategori" className="px-4 py-2 text-gray-700 hover:bg-[#3FE0D0]/10 hover:text-[#3FE0D0] rounded-lg transition-all duration-300">
              Kategori
            </Link>
            <Link href="/store/brand" className="px-4 py-2 text-gray-700 hover:bg-[#3FE0D0]/10 hover:text-[#3FE0D0] rounded-lg transition-all duration-300">
              Brand
            </Link>
            <Link href="/store/products" className="px-4 py-2 text-gray-700 hover:bg-[#3FE0D0]/10 hover:text-[#3FE0D0] rounded-lg transition-all duration-300">
              Produk
            </Link>
            <Link href="/store/login" className="px-4 py-2 text-gray-700 hover:bg-[#3FE0D0]/10 hover:text-[#3FE0D0] rounded-lg transition-all duration-300">
              Login
            </Link>
            <Link href="/store/register" className="mx-4 px-6 py-3 bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white text-center rounded-full font-medium hover:shadow-lg transition-all duration-300">
              Register
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
