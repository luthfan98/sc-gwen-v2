"use client";

import { LogIn, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PenjualanLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");

  const handleLogin = () => {
    localStorage.setItem("penjualan_auth", "true");
    localStorage.setItem("penjualan_user", username.trim() || "Kasir Demo");
    router.push("/penjualan");
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-[#0f756b]/15 bg-white/80 backdrop-blur-xl p-6 shadow-xl shadow-[#3fe0d0]/15 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#0f756b]/10 border border-[#0f756b]/20 flex items-center justify-center text-[#0f756b] font-bold shadow-sm">
            GW
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">Gwen Retail</p>
            <p className="text-sm font-semibold text-gray-900">Login Penjualan</p>
          </div>
        </div>

        <form className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-800" htmlFor="user">
              Username
            </label>
            <input
              id="user"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-900 focus:outline-none focus:border-[#0f756b]"
              placeholder="admin"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-800" htmlFor="pass">
              Password
            </label>
            <input
              id="pass"
              type="password"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-900 focus:outline-none focus:border-[#0f756b]"
              placeholder="••••••••"
            />
          </div>
          <button
            type="button"
            onClick={handleLogin}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0f756b] text-white font-semibold px-4 py-3 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition"
          >
            <LogIn className="w-4 h-4" />
            Masuk
          </button>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Akses terbatas untuk tim kasir/inquiry.
          </p>
        </form>

        <div className="text-center text-xs text-gray-600">
          <Link href="/penjualan" className="text-[#0f756b] font-semibold hover:underline">
            Kembali ke Penjualan
          </Link>
        </div>
      </div>
    </div>
  );
}
