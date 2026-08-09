"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, Lock, User, Eye, EyeOff, Sparkles } from "lucide-react";
import Link from "next/link";
import AuthSidePanel from "@/components/auth/AuthSidePanel";

const KEY = "kosmetik-user";

export default function RegisterPage() {
  const r = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Password dan konfirmasi password tidak cocok!");
      return;
    }
    if (!acceptTerms) {
      alert("Harap setujui syarat dan ketentuan");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const userData = { name, email, password, createdAt: new Date().toISOString() };
      localStorage.setItem(KEY, JSON.stringify(userData));
      alert("Registrasi berhasil! Silakan login.");
      r.push("/login");
      setIsLoading(false);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-[#3FE0D0]/10 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Form */}
        <div className="w-full order-2 lg:order-1">
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

              <h1 className="text-3xl font-bold text-gray-800 mb-2">Buat Akun Baru</h1>
              <p className="text-gray-600">Daftar sekarang dan nikmati berbagai keuntungan</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#3FE0D0] focus:outline-none transition-colors duration-300"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Konfirmasi Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password"
                    className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#3FE0D0] focus:outline-none transition-colors duration-300"
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Toggle confirm password"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="w-4 h-4 mt-1 rounded border-gray-300 text-[#3FE0D0]"
                />
                <label className="text-sm text-gray-600">
                  Saya setuju dengan{" "}
                  <a href="#" className="text-[#3FE0D0] hover:underline font-medium">
                    Syarat & Ketentuan
                  </a>{" "}
                  dan{" "}
                  <a href="#" className="text-[#3FE0D0] hover:underline font-medium">
                    Kebijakan Privasi
                  </a>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? "Memproses..." : "Daftar Sekarang"}
              </button>
            </form>

            <p className="text-center text-gray-600 mt-6">
              Sudah punya akun?{" "}
              <Link href="/login" className="text-[#3FE0D0] hover:underline font-semibold">
                Login
              </Link>
            </p>
          </div>
        </div>

        {/* Panel ilustrasi */}
        <div className="hidden lg:block order-1 lg:order-2">
          <AuthSidePanel
            theme="pink"
            title="Bergabung Bersama Kami!"
            subtitle="Dapatkan akses ke ribuan produk kecantikan original dengan harga terbaik."
          />
        </div>
      </div>
    </div>
  );
}
