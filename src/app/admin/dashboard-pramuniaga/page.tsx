"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Undo2,
  Sparkles,
  ShoppingBag,
  ArrowUpRight,
  Inbox,
  ArrowLeftRight,
  ListChecks,
  LogOut,
} from "lucide-react";

const ADMIN_SESSION_KEY = "kosmetik-admin-session";

export default function PramuniagaDashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("Pramuniaga");
  const [roleName, setRoleName] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) {
      router.replace("/admin/login");
      return;
    }
    try {
      const data = JSON.parse(raw);
      if (!data?.loggedIn) {
        router.replace("/admin/login");
        return;
      }
      const roleValue = String(data?.role?.name || "").toLowerCase();
      if (roleValue !== "staff_pramuniaga") {
        router.replace("/admin/dashboard");
        return;
      }
      setUserName(data?.name || data?.username || "Pramuniaga");
      setRoleName(data?.role?.name || null);
    } catch {
      router.replace("/admin/login");
    }
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Yakin ingin logout?");
      if (!ok) return;
    }
    router.push("/logout");
  };

  const quickActions = [
    {
      title: "Master Etalase",
      description: "Kelola etalase toko.",
      href: "/admin/master/etalase",
      icon: ShoppingBag,
    },
    {
      title: "Terima Pemindahan",
      description: "Konfirmasi barang masuk ke toko.",
      href: "/admin/logistik/terima-pemindahan",
      icon: Inbox,
    },
    {
      title: "Kirim Pemindahan",
      description: "Buat pemindahan stok ke lokasi.",
      href: "/admin/logistik/pemindahan-stok",
      icon: ArrowLeftRight,
    },
    {
      title: "Inquiry Stok",
      description: "Cek stok barang cepat.",
      href: "/admin/transaksi/inquiry-stok",
      icon: ListChecks,
    },
    {
      title: "Inquiry Penjualan",
      description: "Cari transaksi dan status order.",
      href: "/admin/penjualan/inquiry",
      icon: Search,
    },
    {
      title: "Retur Penjualan",
      description: "Proses retur dari pelanggan.",
      href: "/admin/penjualan/retur-customer",
      icon: Undo2,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fffb] via-white to-[#e5f7f3]">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.15)] p-[1px]">
          <div className="rounded-3xl bg-white p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3FE0D0] to-[#2DD4C4] flex items-center justify-center shadow-lg">
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Dashboard Pramuniaga</p>
                  <h1 className="text-2xl font-bold text-gray-900">Hai, {userName}</h1>
                  {roleName && <p className="text-xs text-gray-400">{roleName}</p>}
                </div>
              </div>
              <div className="hidden md:flex items-center gap-3">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#3FE0D0]/10 text-[#0f756b] border border-[#3FE0D0]/30 text-sm font-semibold">
                  <Sparkles className="w-4 h-4" />
                  Fokus layanan toko
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  Keluar
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="md:hidden mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              Keluar
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Akses cepat</p>
              <h2 className="text-xl font-bold text-gray-900">Mulai kerja hari ini</h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">Pramuniaga</span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group border border-gray-100 rounded-2xl p-4 bg-gray-50 hover:border-[#3FE0D0]/40 hover:bg-white transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-[#0f756b]" />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
