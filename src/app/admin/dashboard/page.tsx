"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Users,
  ClipboardList,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  Warehouse,
  ArrowLeftRight,
  Inbox,
  ClipboardCheck,
  ListChecks,
  Search,
  Activity,
  ShieldCheck,
} from "lucide-react";

const ADMIN_SESSION_KEY = "kosmetik-admin-session";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

type DashboardStats = {
  draft_rpo: number;
  pending_release: number;
  released_rpo: number;
  total_barang: number;
  total_users: number;
};

type RpoItem = {
  kode_t_rpo: string;
  tgl: string;
  supplier_nama?: string;
  total_akhir: number;
  status_rpo?: string;
  is_rilis?: boolean;
};

export default function AdminDashboardPage() {
  const r = useRouter();
  const [adminName, setAdminName] = useState<string | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingDraft, setPendingDraft] = useState<RpoItem[]>([]);
  const [pendingRelease, setPendingRelease] = useState<RpoItem[]>([]);
  const [recentRpo, setRecentRpo] = useState<RpoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ADMIN_SESSION_KEY);
    document.cookie = "kosmetik-admin-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "kosmetik-admin-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    r.push("/admin/login");
  };

  useEffect(() => {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) {
      r.push("/admin/login");
      return;
    }
    const data = JSON.parse(raw);
    if (!data?.loggedIn) {
      r.push("/admin/login");
      return;
    }
    const roleValue = String(data?.role?.name || "").toLowerCase();
    if (roleValue === "staff_pramuniaga") {
      r.replace("/admin/dashboard-pramuniaga");
      return;
    }
    setAdminName(data.username || "Admin");
    setRoleName(data?.role?.name || null);
  }, [r]);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/dashboard/summary`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStats(data?.stats || null);
        setPendingDraft(Array.isArray(data?.pending?.draft) ? data.pending.draft : []);
        setPendingRelease(Array.isArray(data?.pending?.release) ? data.pending.release : []);
        setRecentRpo(Array.isArray(data?.recent) ? data.recent : []);
      } catch (err) {
        console.error("Failed load dashboard", err);
        setError("Gagal memuat dashboard.");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const roleLower = (roleName || "").toLowerCase();
  const isSuperAdmin = useMemo(() => roleLower.includes("super"), [roleLower]);
  const isWarehouseStaff = useMemo(
    () => roleLower.includes("staff_gudang") || roleLower.includes("staff gudang") || roleLower.includes("gudang"),
    [roleLower]
  );

  const quickStats = useMemo(() => {
    const valueOrZero = (val?: number) => (typeof val === "number" ? val : 0);
    return [
      { title: "RPO Draft", value: valueOrZero(stats?.draft_rpo), icon: ClipboardList },
      { title: "Menunggu Rilis", value: valueOrZero(stats?.pending_release), icon: CheckCircle2 },
      { title: "RPO Dirilis", value: valueOrZero(stats?.released_rpo), icon: ArrowUpRight },
      { title: "Produk Aktif", value: valueOrZero(stats?.total_barang), icon: Package },
      { title: "User Aktif", value: valueOrZero(stats?.total_users), icon: Users },
    ].slice(0, 4);
  }, [stats]);

  const formatIDR = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

  const formatTanggal = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString("id-ID");
  };

  if (isWarehouseStaff) {
    const warehouseActions = [
      {
        title: "LPB",
        description: "Daftar lembar penerimaan barang.",
        href: "/penerimaan-barang",
        icon: ClipboardList,
      },
      {
        title: "Penerimaan Barang Supplier",
        description: "Penerimaan barang langsung dari supplier.",
        href: "/penerimaan-barang/supplier",
        icon: Package,
      },
      {
        title: "Pemindahan Stok",
        description: "Pindahkan stok antar lokasi gudang.",
        href: "/admin/logistik/pemindahan-stok",
        icon: ArrowLeftRight,
      },
      {
        title: "Terima Pemindahan",
        description: "Konfirmasi barang masuk dari gudang lain.",
        href: "/admin/logistik/terima-pemindahan",
        icon: Inbox,
      },
      {
        title: "Opnam Stok",
        description: "Cek fisik dan cocokkan catatan.",
        href: "/admin/logistik/opnam-stok",
        icon: ClipboardCheck,
      },
      {
        title: "Listing Stok",
        description: "Lihat stok per lokasi dengan cepat.",
        href: "/admin/logistik/listing-stok",
        icon: ListChecks,
      },
      {
        title: "Inquiry Stok",
        description: "Cari stok barang secara cepat.",
        href: "/admin/transaksi/inquiry-stok",
        icon: Search,
      },
      {
        title: "Pemantauan Stok",
        description: "Pantau pergerakan dan saldo stok.",
        href: "/admin/logistik/pemantauan-stok",
        icon: Activity,
      },
      {
        title: "Buffer Stok",
        description: "Tetapkan batas aman ketersediaan.",
        href: "/admin/logistik/buffer-stok",
        icon: ShieldCheck,
      },
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f0fffb] via-white to-[#e5f7f3]">
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.15)] p-[1px]">
            <div className="rounded-3xl bg-white p-6 md:p-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3FE0D0] to-[#2DD4C4] flex items-center justify-center shadow-lg">
                    <Warehouse className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Dashboard Staff Gudang</p>
                    <h1 className="text-2xl font-bold text-gray-900">Hai, {adminName ?? "Staff"}</h1>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#3FE0D0]/10 text-[#0f756b] border border-[#3FE0D0]/30 text-sm font-semibold">
                    <Sparkles className="w-4 h-4" />
                    Fokus operasional
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50"
                  >
                    Logout
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mt-8">
                <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50">
                  <p className="text-sm text-gray-500">Total Produk</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.total_barang ?? 0}</p>
                </div>
                <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50">
                  <p className="text-sm text-gray-500">RPO Menunggu Rilis</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.pending_release ?? 0}</p>
                </div>
                <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50">
                  <p className="text-sm text-gray-500">RPO Dirilis</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.released_rpo ?? 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500">Akses cepat</p>
                <h2 className="text-xl font-bold text-gray-900">Tugas utama gudang</h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                Harian
              </span>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {warehouseActions.map((item) => (
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

          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500">RPO terbaru</p>
                <h2 className="text-xl font-bold text-gray-900">Pantau pengadaan masuk</h2>
              </div>
            </div>
            {loading && <p className="text-sm text-gray-500">Memuat data dashboard...</p>}
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {!loading && !error && (
              <div className="space-y-3">
                {recentRpo.length === 0 && <p className="text-sm text-gray-500">Belum ada data RPO.</p>}
                {recentRpo.map((row) => (
                  <div
                    key={row.kode_t_rpo}
                    className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{row.kode_t_rpo}</p>
                      <p className="text-xs text-gray-500">
                        {row.supplier_nama || "-"} | {formatTanggal(row.tgl)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{formatIDR(row.total_akhir || 0)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fffb] via-white to-[#e5f7f3]">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.15)] p-[1px]">
          <div className="rounded-3xl bg-white p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3FE0D0] to-[#2DD4C4] flex items-center justify-center shadow-lg">
                    <LayoutDashboard className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{isSuperAdmin ? "Dashboard Admin" : "Dashboard Operasional"}</p>
                    <h1 className="text-2xl font-bold text-gray-900">Hai, {adminName ?? "Admin"}</h1>
                  </div>
                </div>
              <div className="flex items-center gap-2">
                <span className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#3FE0D0]/10 text-[#0f756b] border border-[#3FE0D0]/30 text-sm font-semibold">
                  <Sparkles className="w-4 h-4" />
                  Mode cepat
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50"
                >
                  Logout
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              {quickStats.map((item) => (
                <div
                  key={item.title}
                  className="border border-gray-100 rounded-2xl p-4 bg-gray-50 hover:-translate-y-1 transition-transform duration-300 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-500">{item.title}</p>
                    <item.icon className="w-5 h-5 text-[#0f756b]" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500">{isSuperAdmin ? "Pending RPO" : "RPO Terbaru"}</p>
                <h2 className="text-xl font-bold text-gray-900">Fokus pada yang kritikal</h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                Real-time
              </span>
            </div>

            {loading && <p className="text-sm text-gray-500">Memuat data dashboard...</p>}
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {!loading && !error && (
              <div className="space-y-6">
                {isSuperAdmin && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">Draft</p>
                      <span className="text-xs text-gray-500">{pendingDraft.length} item</span>
                    </div>
                    {pendingDraft.length === 0 && <p className="text-sm text-gray-500">Tidak ada draft.</p>}
                    {pendingDraft.map((row) => (
                      <div
                        key={row.kode_t_rpo}
                        className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{row.kode_t_rpo}</p>
                          <p className="text-xs text-gray-500">
                            {row.supplier_nama || "-"} • {formatTanggal(row.tgl)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{formatIDR(row.total_akhir || 0)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {isSuperAdmin && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">Approved, belum rilis</p>
                      <span className="text-xs text-gray-500">{pendingRelease.length} item</span>
                    </div>
                    {pendingRelease.length === 0 && <p className="text-sm text-gray-500">Tidak ada pending release.</p>}
                    {pendingRelease.map((row) => (
                      <div
                        key={row.kode_t_rpo}
                        className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{row.kode_t_rpo}</p>
                          <p className="text-xs text-gray-500">
                            {row.supplier_nama || "-"} • {formatTanggal(row.tgl)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{formatIDR(row.total_akhir || 0)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {!isSuperAdmin && (
                  <div className="space-y-3">
                    {recentRpo.length === 0 && <p className="text-sm text-gray-500">Belum ada data RPO.</p>}
                    {recentRpo.map((row) => (
                      <div
                        key={row.kode_t_rpo}
                        className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{row.kode_t_rpo}</p>
                          <p className="text-xs text-gray-500">
                            {row.supplier_nama || "-"} • {formatTanggal(row.tgl)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{formatIDR(row.total_akhir || 0)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-[#3FE0D0] to-[#2DD4C4] rounded-3xl text-white shadow-2xl p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 blur-3xl" />
            <div className="relative space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] font-semibold text-white/80">Ringkas</p>
                  <h3 className="text-xl font-bold">Fokus Harian</h3>
                </div>
              </div>
              <p className="text-white/90">
                {isSuperAdmin
                  ? "Pantau draft dan RPO yang menunggu rilis agar proses purchasing tidak tertahan."
                  : "Pantau RPO terbaru dan indikator operasional penting sepanjang hari."}
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {isSuperAdmin ? "Prioritas: approval & rilis" : "Prioritas: monitoring harian"}
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
