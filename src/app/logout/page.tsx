"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const ADMIN_SESSION_KEY = "kosmetik-admin-session";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const adminSession = typeof window !== "undefined" ? localStorage.getItem(ADMIN_SESSION_KEY) : null;
    const hasAdminCookie =
      typeof document !== "undefined" &&
      (document.cookie.includes("kosmetik-admin-auth=") || document.cookie.includes("kosmetik-admin-role="));
    const target = adminSession || hasAdminCookie ? "/admin/login" : "/penjualan/login";

    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie = "penjualan_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "kosmetik-admin-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "kosmetik-admin-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }

    router.replace(target);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fffb] via-white to-[#e5f7f3] flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-700 bg-white/80 border border-gray-100 px-4 py-3 rounded-xl shadow-sm">
        <Loader2 className="w-5 h-5 animate-spin text-[#0f756b]" />
        <span>Keluar dari sesi...</span>
      </div>
    </div>
  );
}
