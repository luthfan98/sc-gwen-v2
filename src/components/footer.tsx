"use client";
import { Facebook, Instagram, Mail, MapPin, Phone, Sparkles, Twitter } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-11 h-11 rounded-xl overflow-hidden shadow-lg border border-[#3FE0D0]/30 hover:scale-110 transition-transform duration-300">
                  <Image
                    src="/logo_gwen_sq_500.png" // letakkan logo di public/logo.png
                    alt="Gwén Logo"
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
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Toko kosmetik terpercaya dengan produk 100% original dan gratis ongkir.
            </p>
            <div className="flex gap-3">
              <a href="#" className="p-2 bg-white/10 hover:bg-[#3FE0D0] rounded-lg transition-colors duration-300">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-white/10 hover:bg-[#3FE0D0] rounded-lg transition-colors duration-300">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-white/10 hover:bg-[#3FE0D0] rounded-lg transition-colors duration-300">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold mb-4 text-[#3FE0D0]">Menu</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#kategori" className="text-gray-400 hover:text-[#3FE0D0] transition-colors duration-300">Kategori</a></li>
              <li><a href="#brand" className="text-gray-400 hover:text-[#3FE0D0] transition-colors duration-300">Brand</a></li>
              <li><a href="#produk" className="text-gray-400 hover:text-[#3FE0D0] transition-colors duration-300">Produk</a></li>
              <li>
                <Link href="/cart" className="text-gray-400 hover:text-[#3FE0D0] transition-colors duration-300">
                  Keranjang
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="font-bold mb-4 text-[#3FE0D0]">Layanan</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-400 hover:text-[#3FE0D0] transition-colors duration-300">Cara Belanja</a></li>
              <li><a href="#" className="text-gray-400 hover:text-[#3FE0D0] transition-colors duration-300">FAQ</a></li>
              <li><a href="#" className="text-gray-400 hover:text-[#3FE0D0] transition-colors duration-300">Kebijakan Privasi</a></li>
              <li><a href="#" className="text-gray-400 hover:text-[#3FE0D0] transition-colors duration-300">Syarat & Ketentuan</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold mb-4 text-[#3FE0D0]">Kontak</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-gray-400">
                <Mail className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span>support@gwen.store</span>
              </li>
              <li className="flex items-start gap-2 text-gray-400">
                <Phone className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span>+62 812-3456-7890</span>
              </li>
              <li className="flex items-start gap-2 text-gray-400">
                <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span>Tegal, Jawa Tengah, Indonesia</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400">
          <p>© {new Date().getFullYear()} gwén Beauty Store. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-[#3FE0D0] transition-colors duration-300">Privacy Policy</a>
            <a href="#" className="hover:text-[#3FE0D0] transition-colors duration-300">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
