"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  Sparkles,
  ChevronRight,
  ClipboardList,
  Building2,
  Warehouse,
  Tags,
  Users,
  Truck,
  Package,
  PackageCheck,
  UserRound,
  Handshake,
  ShoppingBag,
  BadgePercent,
  ReceiptText,
  Grid2x2,
  Tag,
  CarFront,
  ArrowLeftRight,
  Inbox,
  ClipboardCheck,
  ListChecks,
  Search,
  Activity,
  ShieldCheck,
  FilePlus,
  Files,
  RotateCcw,
  FileCheck2,
  CreditCard,
  Undo2,
  NotebookPen,
  BookOpenCheck,
  BarChart3,
  FileText,
  ShoppingCart,
  BadgeDollarSign,
  Gift,
  ListTree,
  Landmark,
  History,
  Phone,
  Barcode,
  ChevronsDown,
  ChevronsUp,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

type NavIcon = ComponentType<{ className?: string }>;
type NavChild = { label: string; href: string; icon?: NavIcon };
type NavGroup = { label: string; href?: string; icon?: NavIcon; children?: NavChild[] };

const navGroups: NavGroup[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  {
    label: "Transaksi",
    icon: ReceiptText,
    children: [
      { label: "History Transaksi", href: "/admin/transaksi/history", icon: FileText },
      { label: "Detail Transaksi", href: "/admin/transaksi/detail-transaksi", icon: FileText },
      { label: "RILIS RPO Cepat", href: "/admin/transaksi/rilis-rpo-cepat", icon: FileText },
      { label: "Mutasi Barang", href: "/admin/transaksi/mutasi-barang", icon: Activity },
      { label: "Inquiry Stok", href: "/admin/transaksi/inquiry-stok", icon: Search },
      { label: "Program Promosi", href: "/admin/transaksi/program-promosi", icon: Gift },
      { label: "Rekapan Harian", href: "/admin/transaksi/rekapan-harian", icon: BookOpenCheck },
      { label: "Transaksi per Item", href: "/admin/transaksi/per-item", icon: FileText },
    ],
  },
  {
    label: "Inquiry",
    icon: Search,
    children: [
      { label: "Inquiry Pengadaan", href: "/admin/transaksi/inquiry-pengadaan", icon: Search },
      { label: "Inquiry Penjualan", href: "/admin/penjualan/inquiry", icon: Search },
    ],
  },
  {
    label: "Master",
    icon: ListTree,
    children: [
      { label: "Master Site", href: "/admin/master/site", icon: Building2 },
      { label: "Master Gudang", href: "/admin/master/gudang", icon: Warehouse },
      { label: "Master Sales", href: "/admin/master/sales", icon: BadgeDollarSign },
      { label: "Master Users", href: "/admin/master/users", icon: Users },
      { label: "Master Armada", href: "/admin/master/armada", icon: Truck },
      { label: "Master Barang", href: "/admin/master/barang", icon: Package },
      { label: "Buat Barcode", href: "/admin/master/barang/barcode", icon: Barcode },
      { label: "Master Customer", href: "/admin/master/customer", icon: UserRound },
      { label: "Master Supplier", href: "/admin/master/supplier", icon: Handshake },
      { label: "Master Kontak Supplier", href: "/admin/master/kontak-supplier", icon: Phone },
      { label: "Master Etalase", href: "/admin/master/etalase", icon: ShoppingBag },
      { label: "Master Merk", href: "/admin/master/merk", icon: Tag },
      { label: "Master Klasifikasi", href: "/admin/master/klasifikasi", icon: ListTree },
      { label: "Master Supir", href: "/admin/master/supir", icon: CarFront },
    ],
  },
  {
    label: "Promosi",
    icon: Gift,
    children: [
      { label: "Master Promosi", href: "/admin/master/promosi", icon: Gift },
      { label: "Voucher", href: "/admin/master/promosi/voucher", icon: Tag },
      { label: "Diskon Refraksi", href: "/admin/master/promosi/refraksi", icon: BadgePercent },
      { label: "Program Bundling", href: "/admin/master/promosi/bundling", icon: Gift },
    ],
  },
  {
    label: "Master Harga",
    icon: Tags,
    children: [
      { label: "Master Kelas Harga", href: "/admin/master/kelas-harga", icon: Tags },
      { label: "Master Harga Jual", href: "/admin/master/harga-jual", icon: ReceiptText },
      { label: "Master Channel", href: "/admin/master/channel", icon: Tag },
      { label: "Harga Barang per Kelas", href: "/admin/master/barang-kelas-harga", icon: BadgeDollarSign },
      { label: "Channel Pricing Rule", href: "/admin/master/channel-pricing-rule", icon: BadgePercent },
    ],
  },
  {
    label: "Kontrabon",
    icon: ReceiptText,
    children: [
      { label: "Rekening Supplier", href: "/admin/master/kontrabon/rekening-supplier", icon: Landmark },
      { label: "History Kontrabon", href: "/admin/master/kontrabon/history", icon: History },
      { label: "Rekap Kontrabon", href: "/admin/master/kontrabon/rekap", icon: BarChart3 },
    ],
  },
  {
    label: "Logistik",
    icon: Warehouse,
    children: [
      { label: "Penerimaan Barang", href: "/penerimaan-barang", icon: PackageCheck },
      { label: "Pemindahan Stok", href: "/admin/logistik/pemindahan-stok", icon: ArrowLeftRight },
      { label: "Terima Pemindahan", href: "/admin/logistik/terima-pemindahan", icon: Inbox },
      { label: "Opnam Stok", href: "/admin/logistik/opnam-stok", icon: ClipboardCheck },
      { label: "Listing Stok", href: "/admin/logistik/listing-stok", icon: ListChecks },
      { label: "Inquiry Stok", href: "/admin/logistik/inquiry-stok", icon: Search },
      { label: "Pemantauan Stok", href: "/admin/logistik/pemantauan-stok", icon: Activity },
      { label: "Buffer Stok", href: "/admin/logistik/buffer-stok", icon: ShieldCheck },
    ],
  },
  {
    label: "Purchasing",
    icon: ClipboardList,
    children: [
      { label: "Permintaan Pengadaan", href: "/admin/purchasing/permintaan-pengadaan", icon: FilePlus },
      { label: "Edit Harga Beli/HET", href: "/admin/purchasing/harga", icon: Tag },
      { label: "Listing Purchasing", href: "/admin/purchasing/listing", icon: Files },
      { label: "Listing Tagihan", href: "/admin/purchasing/tagihan", icon: ReceiptText },
      { label: "Kontrabon", href: "/admin/purchasing/kontrabon", icon: FileText },
      { label: "Retur ke Supplier", href: "/admin/purchasing/retur-supplier", icon: RotateCcw },
      { label: "Inquiry Purchasing", href: "/admin/purchasing/inquiry", icon: Search },
      { label: "Inquiry Tagihan Supplier", href: "/admin/purchasing/inquiry-tagihan", icon: FileCheck2 },
    ],
  },
  {
    label: "Penjualan",
    icon: ShoppingCart,
    children: [
      { label: "POS", href: "/admin/penjualan/pos", icon: CreditCard },
      { label: "Retur Customer", href: "/admin/penjualan/retur-customer", icon: Undo2 },
      { label: "Inquiry Penjualan", href: "/admin/penjualan/inquiry", icon: Search },
    ],
  },
  {
    label: "Akuntansi",
    icon: NotebookPen,
    children: [
      { label: "Jurnal Umum", href: "/admin/akuntansi/jurnal-umum", icon: NotebookPen },
      { label: "Master Akun Jurnal", href: "/admin/akuntansi/master-akun", icon: BookOpenCheck },
      { label: "Laporan Akuntansi", href: "/admin/akuntansi/laporan", icon: BarChart3 },
      { label: "Laporan Penagihan Hutang", href: "/admin/akuntansi/laporan-penagihan-hutang", icon: FileText },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminName, setAdminName] = useState<string>("Admin");
  const [roleName, setRoleName] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const isPOSPage = pathname?.startsWith("/admin/penjualan/pos");
  const isPrintPage =
    pathname?.startsWith("/admin/master/kontrabon/history/print") ||
    (pathname?.startsWith("/admin/master/kontrabon/rekap/") && pathname?.endsWith("/print"));
  const isKontrabonPemantauanPage =
    pathname?.startsWith("/admin/master/kontrabon/rekap/") && pathname?.endsWith("/pemantauan-30");
  const roleLower = (roleName || "").toLowerCase();
  const isWarehouseStaff =
    roleLower.includes("staff_gudang") || roleLower.includes("staff gudang") || roleLower.includes("gudang");
  const isPramuniaga = roleLower === "staff_pramuniaga";
  const hideSidebar =
    isWarehouseStaff ||
    isPramuniaga ||
    pathname === "/admin/purchasing/permintaan-pengadaan/new" ||
    pathname === "/admin/dashboard-pramuniaga" ||
    pathname?.startsWith("/admin/logistik/terima-pemindahan") ||
    isKontrabonPemantauanPage ||
    isPrintPage;
  const navGroupsForRole = useMemo(() => {
    const dashboardHref = isPramuniaga ? "/admin/dashboard-pramuniaga" : "/admin/dashboard";
    return navGroups.map((group) => {
      if (group.label === "Dashboard") {
        return { ...group, href: dashboardHref };
      }
      return group;
    });
  }, [isPramuniaga]);

  useEffect(() => {
    const raw = localStorage.getItem("kosmetik-admin-session");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        const hasLogin = Boolean(data?.loggedIn);
        if (hasLogin) {
          setAdminName(data.username || data.name || "Admin");
          if (data?.role?.name) setRoleName(data.role.name);
          setIsAuthenticated(true);
        } else {
          setAdminName("Admin");
          setRoleName(null);
          setIsAuthenticated(false);
        }
      } catch {
        setAdminName("Admin");
        setRoleName(null);
        setIsAuthenticated(false);
      }
    } else {
      setAdminName("Admin");
      setRoleName(null);
      setIsAuthenticated(false);
    }
    setAuthChecked(true);
  }, [pathname]);

  const isActive = (href: string) => {
    if (!pathname) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  const isLoginPage = pathname === "/admin/login";
  const shouldBlock = !isLoginPage && authChecked && !isAuthenticated;

  useEffect(() => {
    if (shouldBlock) {
      if (typeof window !== "undefined") {
        window.location.replace("/admin/login");
      } else {
        router.replace("/admin/login");
      }
    }
  }, [shouldBlock, router]);

  useEffect(() => {
    const found = navGroupsForRole.find(
      (group) =>
        (group.href && isActive(group.href)) ||
        group.children?.some((child) => isActive(child.href))
    );
    if (found?.children) {
      setOpenGroup(found.label);
    }
    setProfileMenuOpen(false);
    setHeaderCollapsed(true);
  }, [pathname, navGroupsForRole]);

  useEffect(() => {
    const shouldCollapse = pathname?.startsWith("/admin/master/harga-jual/new");
    if (shouldCollapse) {
      setSidebarCollapsed(true);
    }
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      setSidebarCollapsed(false);
    }
  }, [mobileOpen]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie = "kosmetik-admin-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "kosmetik-admin-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    router.replace("/admin/login");
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!authChecked || !isAuthenticated) {
    return <>{null}</>;
  }

  const isSuperAdmin = roleLower === "super_admin";
  const isItSupport = roleLower === "it_support";

  const filteredNavGroups = navGroupsForRole
    .map((group) => {
      if (isItSupport) {
        if (group.label !== "Master") return { ...group, children: [] };
        const onlyUsers = group.children?.filter((child) => child.href === "/admin/master/users") || [];
        return { ...group, children: onlyUsers };
      }
      if (!group.children) return group;
      const children = group.children.filter((child) => {
        if (child.href === "/admin/master/users") {
          return isSuperAdmin;
        }
        return true;
      });
      return { ...group, children };
    })
    .filter((group) => {
      if (!group.children) return !isItSupport;
      return group.children.length > 0;
    });

  const renderNav = (onClickItem?: () => void) => (
    <nav className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
      {filteredNavGroups.map((group) => {
        const GroupIcon = group.icon ?? Grid2x2;
        const hasChildren = !!group.children?.length;
        const isGroupActive =
          (group.href && isActive(group.href)) ||
          group.children?.some((child) => isActive(child.href));
        const isGroupOpen = hasChildren && openGroup === group.label;

        return (
          <div key={group.label} className="space-y-2">
            {hasChildren ? (
              <button
                type="button"
                onClick={() =>
                  setOpenGroup((prev) => (prev === group.label ? null : group.label))
                }
                title={group.label}
                className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"} ${
                  sidebarCollapsed ? "px-3" : "px-4"
                } py-3 rounded-xl text-sm font-semibold transition-all border ${
                  isGroupActive
                    ? "bg-[#3FE0D0]/15 text-[#0f756b] border-[#3FE0D0]/30"
                    : "text-gray-700 hover:bg-gray-50 border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <GroupIcon className="w-5 h-5" />
                  {!sidebarCollapsed && <span>{group.label}</span>}
                </div>
                {!sidebarCollapsed && (
                  <ChevronRight
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      isGroupOpen ? "rotate-90 text-[#0f756b]" : ""
                    }`}
                  />
                )}
              </button>
            ) : (
              group.href && (
                <Link
                  href={group.href}
                  onClick={onClickItem}
                  title={group.label}
                  className={`flex items-center ${
                    sidebarCollapsed ? "justify-center px-3" : "gap-3 px-4"
                  } py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive(group.href)
                      ? "bg-[#3FE0D0]/15 text-[#0f756b] border border-[#3FE0D0]/30"
                      : "text-gray-600 hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <GroupIcon className="w-5 h-5" />
                  {!sidebarCollapsed && group.label}
                </Link>
              )
            )}

            {!sidebarCollapsed && group.children && isGroupOpen && (
              <div className="space-y-1">
                {group.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={onClickItem}
                    title={child.label}
                    className={`flex items-center gap-3 pl-10 pr-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive(child.href)
                        ? "bg-[#3FE0D0]/15 text-[#0f756b] border border-[#3FE0D0]/30"
                        : "text-gray-600 hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    {child.icon && <child.icon className="w-4 h-4" />}
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  const Sidebar = (
    <aside
      className={`${sidebarCollapsed ? "w-20" : "w-72"} transition-all duration-300 flex-shrink-0 bg-white border-r border-gray-100 hidden lg:flex flex-col`}
    >
      <div className={`px-4 py-5 border-b border-gray-100 flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : ""}`}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3FE0D0] to-[#2DD4C4] flex items-center justify-center shadow-md">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div>
            
            <p className="text-lg font-bold text-gray-900">Gwen Panel</p>
            <p className="text-xs text-gray-500">{adminName}</p>
            {roleName && <p className="text-[10px] text-gray-400">{roleName}</p>}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!isLoginPage && headerCollapsed && (
            <button
              type="button"
              onClick={() => setHeaderCollapsed(false)}
              aria-label="Tampilkan header"
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:border-[#3FE0D0]/50 hover:text-[#0f756b] transition-colors"
            >
              <ChevronsDown className="w-4 h-4 text-[#0f756b]" />
            </button>
          )}
          <button
            type="button"
            aria-label={sidebarCollapsed ? "Buka sidebar" : "Tutup sidebar"}
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:border-[#3FE0D0]/50 hover:text-[#0f756b] transition-colors"
          >
            {sidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {renderNav()}

      <div className="px-4 pb-6">
        <button
          type="button"
          onClick={handleLogout}
          className={`w-full flex items-center ${
            sidebarCollapsed ? "justify-center px-0" : "gap-3 px-4"
          } py-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 border border-gray-100`}
          title="Keluar"
        >
          <LogOut className="w-5 h-5" />
          {!sidebarCollapsed && "Keluar"}
        </button>
      </div>
    </aside>
  );

  if (isPOSPage || isPrintPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f2fffb] via-white to-[#e5f7f3]">
        <div className="w-full">{children}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fffb] via-white to-[#e5f7f3]">
      <div className="flex min-h-screen">
        {!hideSidebar && Sidebar}

        {/* Mobile sidebar drawer */}
        {!hideSidebar && (
          <div
            className={`fixed inset-0 z-40 bg-black/40 lg:hidden transition-opacity ${
              mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
            onClick={() => setMobileOpen(false)}
          >
            <div
              className={`absolute left-0 top-0 h-full ${
                sidebarCollapsed ? "w-20" : "w-72"
              } bg-white shadow-2xl transform transition-transform duration-300 ${
                mobileOpen ? "translate-x-0" : "-translate-x-full"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3FE0D0] to-[#2DD4C4] flex items-center justify-center shadow-md">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    
                    <p className="text-lg font-bold text-gray-900">Gwen Panel</p>
                  </div>
                </div>
                <button onClick={() => setMobileOpen(false)} aria-label="Close sidebar">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              {renderNav(() => setMobileOpen(false))}
            </div>
          </div>
        )}

        <main className="flex-1 flex flex-col min-h-screen">
          {!isLoginPage && headerCollapsed && null}

          {!isLoginPage && !headerCollapsed && (
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100">
              <div className="flex items-center justify-between px-4 md:px-6 py-3">
                <div className="flex items-center gap-3">
                  {!hideSidebar && (
                    <button
                      className="lg:hidden p-2 rounded-lg border border-gray-200 text-gray-700"
                      onClick={() => setMobileOpen(true)}
                      aria-label="Open sidebar"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Admin Panel</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {isLoginPage ? "Masuk ke akun admin" : "Kelola toko dengan tenang"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 relative" ref={profileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setHeaderCollapsed(true)}
                    className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-full bg-gray-50 border border-gray-200 text-gray-700 hover:border-[#3FE0D0]/40"
                  >
                    <ChevronsUp className="w-4 h-4" />
                    Sembunyikan
                  </button>

                  <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-full bg-[#3FE0D0]/15 text-[#0f756b] border border-[#3FE0D0]/30 text-sm font-semibold">
                    <Sparkles className="w-4 h-4" />
                    Mode aman
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((v) => !v)}
                    className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-full px-3 py-2 hover:border-[#3FE0D0]/40 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3FE0D0] to-[#2DD4C4] text-white flex items-center justify-center text-sm font-bold uppercase">
                      {adminName.slice(0, 2)}
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-xs text-gray-500">Admin</p>
                      <p className="text-sm font-semibold text-gray-800">{adminName}</p>
                    </div>
                  </button>

                  {profileMenuOpen && (
                    <div className="absolute right-0 top-full mt-3 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900">{adminName}</p>
                        <p className="text-xs text-gray-500">Admin panel</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="w-4 h-4" />
                        Keluar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>
          )}

          <div className="flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
