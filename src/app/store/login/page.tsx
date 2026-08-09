"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff, Sparkles } from "lucide-react";
import Link from "next/link";
import AuthSidePanel from "@/components/auth/AuthSidePanel";

const KEY = "kosmetik-user";

export default function LoginPage() {
  const r = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // kalau sudah login, redirect (dummy check)
    const raw = localStorage.getItem(KEY);
    if (raw) {
      // bisa tambahkan flag "loggedIn" terpisah kalau mau
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      const userData = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!userData) {
        alert("Akun tidak ditemukan. Silakan register terlebih dahulu.");
        setIsLoading(false);
        return;
      }
      if (userData.email === email && userData.password === password) {
        alert("Login berhasil! Selamat datang kembali.");
        r.push("/");
      } else {
        alert("Email atau password salah!");
      }
      setIsLoading(false);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3FE0D0]/10 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Panel ilustrasi */}
        <div className="hidden lg:block">
          <AuthSidePanel
            theme="tosca"
            title="Selamat Datang Kembali!"
            subtitle="Login untuk melanjutkan pengalaman belanja kosmetik terbaik Anda."
          />
        </div>

        {/* Form */}
        <div className="w-full">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-4 lg:hidden">
                <div className="w-10 h-10 bg-gradient-to-br from-[#3FE0D0] to-[#2DD4C4] rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] bg-clip-text text-transparent">
                  gwén
                </span>
              </div>

              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Login ke Akun Anda
              </h1>
              <p className="text-gray-600">
                Masukkan email dan password untuk melanjutkan
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#3FE0D0] focus:outline-none transition-colors duration-300"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? "Memproses..." : "Login"}
              </button>
            </form>

            <p className="text-center text-gray-600 mt-6">
              Belum punya akun?{" "}
              <Link href="/register" className="text-[#3FE0D0] hover:underline font-semibold">
                Daftar Sekarang
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
