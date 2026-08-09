"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

const ADMIN_SESSION_KEY = "kosmetik-admin-session";
const getDashboardTarget = (roleName?: string | null) =>
  String(roleName || "").toLowerCase() === "staff_pramuniaga" ? "/admin/dashboard-pramuniaga" : "/admin/dashboard";

export default function AdminIndexPage() {
  const router = useRouter();

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(ADMIN_SESSION_KEY) : null;
    let target = "/admin/login";

    if (raw) {
      try {
        const session = JSON.parse(raw);
        if (session?.loggedIn) {
          target = getDashboardTarget(session?.role?.name);
        }
      } catch {
        // ignore parse error and redirect to login
      }
    }

    router.replace(target);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fffb] via-white to-[#e5f7f3] flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-700 bg-white/80 border border-gray-100 px-4 py-3 rounded-xl shadow-sm">
        <Loader2 className="w-5 h-5 animate-spin text-[#0f756b]" />
        <span>Mengalihkan ke halaman admin...</span>
      </div>
    </div>
  );
}
