"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, ShieldCheck } from "lucide-react";

export default function PenerimaanLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/penerimaan-barang";

  const handleLogin = () => {
    localStorage.setItem("penerimaan_auth", "true");
    router.replace(redirect);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-[#0f756b]/15 bg-white/90 shadow-xl shadow-[#3fe0d0]/15 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-[#0f756b]/10 text-[#0f756b] border border-[#0f756b]/20 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">
              Penerimaan Barang
            </p>
            <h1 className="text-xl font-bold text-gray-900">Login dulu ya</h1>
            <p className="text-sm text-gray-600">
              Akses khusus untuk staf gudang penerimaan.
            </p>
          </div>
        </div>

        <button
          onClick={handleLogin}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0f756b] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#0f756b]/30 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <LogIn className="h-4 w-4" />
          Login & Masuk
        </button>
      </div>
    </div>
  );
}
