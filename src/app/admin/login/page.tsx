"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { User, Lock, Eye, EyeOff, ShieldCheck, Sparkles, KeyRound } from "lucide-react";
import Link from "next/link";
import AuthSidePanel from "@/components/auth/AuthSidePanel";
import Swal from "sweetalert2";

const ADMIN_SESSION_KEY = "kosmetik-admin-session";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const getDashboardTarget = (roleName?: string | null) =>
  String(roleName || "").toLowerCase() === "staff_pramuniaga" ? "/admin/dashboard-pramuniaga" : "/admin/dashboard";

export default function AdminLoginPage() {
  const r = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const hasAuthCookie = typeof document !== "undefined" && document.cookie.includes("kosmetik-admin-auth=1");
    if (hasAuthCookie) {
      const roleCookie = document.cookie
        .split("; ")
        .find((item) => item.startsWith("kosmetik-admin-role="))
        ?.split("=")[1];
      const roleValue = roleCookie ? decodeURIComponent(roleCookie) : "";
      window.location.replace(getDashboardTarget(roleValue));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const user = payload?.user;
      const role = payload?.role;
      if (!user?.username) throw new Error("Invalid response");
      localStorage.setItem(
        ADMIN_SESSION_KEY,
        JSON.stringify({
          loggedIn: true,
          username: user.username,
          name: user.name,
          role,
          lastLogin: new Date().toISOString(),
        })
      );
      const roleValue = String(role?.name || "").toLowerCase();
      document.cookie = "kosmetik-admin-auth=1; path=/; max-age=86400; SameSite=Lax";
      document.cookie = `kosmetik-admin-role=${encodeURIComponent(roleValue)}; path=/; max-age=86400; SameSite=Lax`;
      const target = getDashboardTarget(roleValue);
      Swal.fire({
        icon: "success",
        title: "Berhasil masuk",
        text: "Mengalihkan ke dashboard...",
        showConfirmButton: false,
        timer: 1000,
        timerProgressBar: true,
        didOpen: () => {
          Swal.showLoading();
        },
      }).then(() => {
        if (typeof window !== "undefined") {
          window.location.replace(target);
        } else {
          r.push(target);
        }
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Login gagal",
        text: "Username atau password admin tidak sesuai.",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fffb] via-white to-[#e5f7f3] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        <div className="w-full">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#3FE0D0] to-[#2DD4C4] rounded-xl flex items-center justify-center shadow-md">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold">
                    Admin Area
                  </p>
                  <h1 className="text-2xl font-bold text-gray-800">Panel Gwen</h1>
                </div>
              </div>
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-[#3FE0D0]/10 text-[#0f756b] border border-[#3FE0D0]/30">
                Secure Access
              </span>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#3FE0D0]/20 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#0f756b]" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-gray-800">Login Admin</p>
                <p className="text-gray-500">Gunakan akun yang terdaftar di database.</p>
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Username Admin</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#3FE0D0] focus:outline-none transition-colors duration-300"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password admin"
                    className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#3FE0D0] focus:outline-none transition-colors duration-300"
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Toggle password"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm text-gray-600 bg-[#3FE0D0]/10 border border-[#3FE0D0]/30 rounded-xl p-4">
                <KeyRound className="w-5 h-5 text-[#0f756b]" />
                <p>Login menggunakan akun admin yang tersimpan di database.</p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? "Memproses..." : "Masuk ke Admin"}
              </button>
            </form>

            <p className="text-center text-gray-600 mt-6">
              Mau login sebagai user biasa?{" "}
              <Link href="/login" className="text-[#3FE0D0] hover:underline font-semibold">
                Halaman Login User
              </Link>
            </p>
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="relative">
            <div className="absolute inset-0 blur-3xl bg-[#3FE0D0]/20 -z-10" />
            <AuthSidePanel
              theme="tosca"
              title="Kendalikan Toko dengan Mudah"
              subtitle="Pantau order, stok, dan promo dengan tampilan panel admin yang bersih dan fokus."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
