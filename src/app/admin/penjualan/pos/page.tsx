"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useRouter } from "next/navigation";

import {
  ShoppingCart,
  Search,
  CreditCard,
  Wallet,
  QrCode,
  UserRoundSearch,
  PackageSearch,
  Trash2,
  Minus,
  Plus,
  ScanLine,
  Percent,
  ReceiptText,
  Save,
  Printer,
  LogOut,
  ChevronRight,
  Sparkles,
  BadgeCheck,
  Tag,
  MapPin,
  X,
} from "lucide-react";

type Customer = { id: string; name: string; phone: string; address: string; tier: string; points: number; category: string };
type Product = {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  stock: number;
  unit: string;
  discount?: number;
  image: string;
  image2?: string;
};
type CartItem = Product & { qty: number };

type PaymentMethod = "cash" | "card" | "ewallet" | "qris";

const promoBanners = [
  {
    id: "promo-1",
    title: "Diskon Member 15%",
    desc: "Khusus skincare favorit setiap hari Senin.",
    image: "https://img.freepik.com/vektor-gratis/templat-promosi-banner-modern-flash-sale_260559-196.jpg",
    badge: "Member Only",
  },
  {
    id: "promo-2",
    title: "Buy 2 Get 1",
    desc: "Semua lip cream pilihan, stok terbatas.",
    image: "https://img.freepik.com/vektor-gratis/desain-templat-banner-obral-kilat_87202-1099.jpg",
    badge: "Flash Deal",
  },
  {
    id: "promo-3",
    title: "Gratis Pouch Cantik",
    desc: "Minimal belanja Rp300K untuk kategori body care.",
    image: "https://img.freepik.com/vektor-gratis/latar-belakang-super-sale_23-2147820882.jpg",
    badge: "Gift",
  },
];

const promoVideos = [
  { id: "vid-1", url: "/gwen.mp4" },
  // { id: "vid-2", url: "/gwen-2.mp4" },
  // { id: "vid-3", url: "/gwen-3.mp4" },
];

const dummyCustomers: Customer[] = [
  { id: "CUST-001", name: "Anisa Rahma", phone: "0812-1111-2222", address: "Jl. Melati No. 12, Bandung", tier: "Gold", points: 1200, category: "VIP" },
  { id: "CUST-002", name: "Bima Nugraha", phone: "0813-3333-4444", address: "Jl. Dipatiukur No. 8, Bandung", tier: "Silver", points: 640, category: "Member" },
  { id: "CUST-003", name: "Citra Ayu", phone: "0817-7777-9999", address: "Jl. Asia Afrika No. 21, Bandung", tier: "Member", points: 210, category: "Reguler" },
];

const baseProducts: Product[] = [
  {
    id: "BRG-001",
    name: "TIMEPHORIA Pandora Cheek Liquid Blush Serene Peace 5g",
    sku: "SKU-TMP-01",
    price: 89000,
    stock: 25,
    unit: "pcs",
    image: "https://i.ibb.co.com/6c2LBPPL/Pandora-cheek-blush.jpg",
    image2: "https://i.ibb.co.com/zhnSYgHb/Whats-App-Image-2025-12-06-at-10-22-39.jpg",
  },
  {
    id: "BRG-002",
    name: "Veluxe Lip Matte #Rose",
    sku: "SKU-LIP-02",
    price: 92000,
    stock: 40,
    unit: "pcs",
    discount: 10,
    image: "https://picsum.photos/seed/lip/160/160",
  },
  {
    id: "BRG-003",
    name: "Hydra Mist Toner 100ml",
    sku: "SKU-TNR-03",
    price: 78000,
    stock: 30,
    unit: "pcs",
    image: "https://picsum.photos/seed/toner/160/160",
  },
  {
    id: "BRG-004",
    name: "UV Shield Sunscreen SPF50",
    sku: "SKU-SS-04",
    price: 112000,
    stock: 18,
    unit: "pcs",
    image: "https://picsum.photos/seed/sunscreen/160/160",
  },

  // Tambahan baru
  {
    id: "BRG-005",
    name: "Aqua Glow Moisturizer 50ml",
    sku: "SKU-MST-05",
    price: 98000,
    stock: 22,
    unit: "pcs",
    image: "https://picsum.photos/seed/moist/160/160",
  },
  {
    id: "BRG-006",
    name: "Silky Matte Foundation #Ivory",
    sku: "SKU-FDN-06",
    price: 125000,
    stock: 15,
    unit: "pcs",
    discount: 5,
    image: "https://picsum.photos/seed/foundation/160/160",
  },
  {
    id: "BRG-007",
    name: "Cleansing Balm Pure Melt",
    sku: "SKU-CLB-07",
    price: 89000,
    stock: 27,
    unit: "pcs",
    image: "https://picsum.photos/seed/balm/160/160",
  },
  {
    id: "BRG-008",
    name: "Hair Serum Keratin Boost",
    sku: "SKU-HSR-08",
    price: 56000,
    stock: 35,
    unit: "pcs",
    image: "https://picsum.photos/seed/hairserum/160/160",
  },
  {
    id: "BRG-009",
    name: "Velvet Cheek Blush #Coral",
    sku: "SKU-BLS-09",
    price: 72000,
    stock: 20,
    unit: "pcs",
    image: "https://picsum.photos/seed/blush/160/160",
  },
  {
    id: "BRG-010",
    name: "Aloe Soothing Gel 250ml",
    sku: "SKU-ALG-10",
    price: 45000,
    stock: 60,
    unit: "pcs",
    image: "https://picsum.photos/seed/aloe/160/160",
  },
  {
    id: "BRG-011",
    name: "Nourish Night Cream 20g",
    sku: "SKU-NCR-11",
    price: 110000,
    stock: 17,
    unit: "pcs",
    image: "https://picsum.photos/seed/nightcream/160/160",
  },
  {
    id: "BRG-012",
    name: "Brightening Body Lotion 200ml",
    sku: "SKU-BDL-12",
    price: 65000,
    stock: 34,
    unit: "pcs",
    image: "https://picsum.photos/seed/bodylotion/160/160",
  },
  {
    id: "BRG-013",
    name: "Hydra Gel Cleanser",
    sku: "SKU-HGC-13",
    price: 52000,
    stock: 29,
    unit: "pcs",
    image: "https://picsum.photos/seed/cleanser/160/160",
  },
  {
    id: "BRG-014",
    name: "Glossy Lip Tint #Cherry",
    sku: "SKU-LPT-14",
    price: 49000,
    stock: 23,
    unit: "pcs",
    image: "https://picsum.photos/seed/liptint/160/160",
  },
  {
    id: "BRG-015",
    name: "Mineral Compact Powder #Beige",
    sku: "SKU-CMP-15",
    price: 88000,
    stock: 14,
    unit: "pcs",
    image: "https://picsum.photos/seed/compact/160/160",
  },
  {
    id: "BRG-016",
    name: "Rejuvenate Eye Cream 15g",
    sku: "SKU-ECR-16",
    price: 135000,
    stock: 12,
    unit: "pcs",
    image: "https://picsum.photos/seed/eyecream/160/160",
  },
  {
    id: "BRG-017",
    name: "Fine Brow Pencil #DarkBrown",
    sku: "SKU-BRW-17",
    price: 39000,
    stock: 50,
    unit: "pcs",
    image: "https://picsum.photos/seed/brow/160/160",
  },
  {
    id: "BRG-018",
    name: "Chamomile Facial Wash 100ml",
    sku: "SKU-FWS-18",
    price: 59000,
    stock: 32,
    unit: "pcs",
    image: "https://picsum.photos/seed/facialwash/160/160",
  },
  {
    id: "BRG-019",
    name: "Glow Booster Ampoule 10ml",
    sku: "SKU-AMP-19",
    price: 74000,
    stock: 19,
    unit: "pcs",
    discount: 15,
    image: "https://picsum.photos/seed/ampoule/160/160",
  },
  {
    id: "BRG-020",
    name: "Velvet Matte Lipstick #Nude",
    sku: "SKU-LPS-20",
    price: 57000,
    stock: 28,
    unit: "pcs",
    image: "https://picsum.photos/seed/lipstick/160/160",
  },

  // 20 more
  {
    id: "BRG-021",
    name: "Soothing Face Mist 80ml",
    sku: "SKU-FMT-21",
    price: 53000,
    stock: 40,
    unit: "pcs",
    image: "https://picsum.photos/seed/facemist/160/160",
  },
  {
    id: "BRG-022",
    name: "Deep Repair Hair Mask",
    sku: "SKU-HMK-22",
    price: 67000,
    stock: 22,
    unit: "pcs",
    image: "https://picsum.photos/seed/hairmask/160/160",
  },
  {
    id: "BRG-023",
    name: "Clay Mask Detox 50g",
    sku: "SKU-CLY-23",
    price: 43000,
    stock: 45,
    unit: "pcs",
    image: "https://picsum.photos/seed/claymask/160/160",
  },
  {
    id: "BRG-024",
    name: "Hydra Shampoo 300ml",
    sku: "SKU-SHP-24",
    price: 49000,
    stock: 37,
    unit: "pcs",
    image: "https://picsum.photos/seed/shampoo/160/160",
  },
  {
    id: "BRG-025",
    name: "Soft Hand Cream Rose 40g",
    sku: "SKU-HCR-25",
    price: 25000,
    stock: 60,
    unit: "pcs",
    image: "https://picsum.photos/seed/handcream/160/160",
  },
  {
    id: "BRG-026",
    name: "Nourish Body Scrub 200ml",
    sku: "SKU-BDS-26",
    price: 56000,
    stock: 31,
    unit: "pcs",
    image: "https://picsum.photos/seed/bodyscrub/160/160",
  },
  {
    id: "BRG-027",
    name: "Cool Mint Tooth Gel 100g",
    sku: "SKU-TTG-27",
    price: 19000,
    stock: 70,
    unit: "pcs",
    image: "https://picsum.photos/seed/toothgel/160/160",
  },
  {
    id: "BRG-028",
    name: "Natural Deodorant Roll 50ml",
    sku: "SKU-DEO-28",
    price: 23000,
    stock: 55,
    unit: "pcs",
    image: "https://picsum.photos/seed/deodorant/160/160",
  },
  {
    id: "BRG-029",
    name: "Aromatherapy Body Oil 100ml",
    sku: "SKU-ARO-29",
    price: 42000,
    stock: 26,
    unit: "pcs",
    discount: 8,
    image: "https://picsum.photos/seed/bodyoil/160/160",
  },
  {
    id: "BRG-030",
    name: "Refreshing Face Wipes 20s",
    sku: "SKU-WIP-30",
    price: 15000,
    stock: 80,
    unit: "pcs",
    image: "https://picsum.photos/seed/facewipes/160/160",
  },
  {
    id: "BRG-031",
    name: "Creamy Body Wash 250ml",
    sku: "SKU-BWS-31",
    price: 29000,
    stock: 44,
    unit: "pcs",
    image: "https://picsum.photos/seed/bodywash/160/160",
  },
  {
    id: "BRG-032",
    name: "Coconut Hair Oil 75ml",
    sku: "SKU-HRO-32",
    price: 35000,
    stock: 33,
    unit: "pcs",
    image: "https://picsum.photos/seed/coconutoil/160/160",
  },
  {
    id: "BRG-033",
    name: "SPF Lip Balm Mint",
    sku: "SKU-LBM-33",
    price: 17000,
    stock: 90,
    unit: "pcs",
    image: "https://picsum.photos/seed/lipbalm/160/160",
  },
  {
    id: "BRG-034",
    name: "Hydra Facial Mask Sheet",
    sku: "SKU-MSK-34",
    price: 14000,
    stock: 100,
    unit: "pcs",
    image: "https://picsum.photos/seed/masksheet/160/160",
  },
  {
    id: "BRG-035",
    name: "Floral Body Mist 150ml",
    sku: "SKU-BMT-35",
    price: 39000,
    stock: 28,
    unit: "pcs",
    image: "https://picsum.photos/seed/bodymist/160/160",
  },
  {
    id: "BRG-036",
    name: "Hydrate Lip Serum 5ml",
    sku: "SKU-LSM-36",
    price: 26000,
    stock: 42,
    unit: "pcs",
    image: "https://picsum.photos/seed/lipserum/160/160",
  },
  {
    id: "BRG-037",
    name: "Keratin Repair Conditioner 250ml",
    sku: "SKU-CND-37",
    price: 38000,
    stock: 36,
    unit: "pcs",
    image: "https://picsum.photos/seed/conditioner/160/160",
  },
  {
    id: "BRG-038",
    name: "Acne Spot Treatment Gel 20g",
    sku: "SKU-ACN-38",
    price: 27000,
    stock: 25,
    unit: "pcs",
    image: "https://picsum.photos/seed/acne/160/160",
  },
  {
    id: "BRG-039",
    name: "Glowing Night Serum 20ml",
    sku: "SKU-GNS-39",
    price: 96000,
    stock: 30,
    unit: "pcs",
    image: "https://picsum.photos/seed/nightserum/160/160",
  },
  {
    id: "BRG-040",
    name: "Velvet Hair Mist 120ml",
    sku: "SKU-HMT-40",
    price: 45000,
    stock: 40,
    unit: "pcs",
    image: "https://picsum.photos/seed/hairmist/160/160",
  },
];

const dummyProducts: Product[] = baseProducts.map((p) => ({
  ...p,
  barcode: p.sku,
  image2: p.image2 || getSecondaryImage(p.image),
}));

const dummyDrafts = [
  { id: "DR-001", customer: "Anisa Rahma", total: 245000, items: 3, updatedAt: "12:45" },
  { id: "DR-002", customer: "Walk-in", total: 98000, items: 1, updatedAt: "12:32" },
  { id: "DR-003", customer: "Bima Nugraha", total: 310000, items: 4, updatedAt: "12:15" },
];

export default function POSPage() {
  const router = useRouter();
  const [customerQuery, setCustomerQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [paymentModal, setPaymentModal] = useState(false);
  const [payInput, setPayInput] = useState("");
  const [cardInfo, setCardInfo] = useState({ number: "", bank: "", name: "" });
  const [qrCountdown, setQrCountdown] = useState(120);
  const [successToast, setSuccessToast] = useState(false);
  const reloadTimeout = useRef<number | null>(null);
  const [cashierName] = useState("Admin");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerModal, setCustomerModal] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [draftModal, setDraftModal] = useState(false);
  const [draftSearch, setDraftSearch] = useState("");
  const [promoIndexTop, setPromoIndexTop] = useState(0);
  const [promoIndexBottom, setPromoIndexBottom] = useState(1);
  const [qtyModal, setQtyModal] = useState<{ id: string; value: string; name: string; stock: number } | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("penjualan_auth");
      document.cookie = "penjualan_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "kosmetik-admin-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "kosmetik-admin-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    router.push("/penjualan/login");
  };

  useEffect(() => {
    const videoLength = Math.max(1, promoVideos.length);
    const timer = setInterval(() => {
      setPromoIndexTop((prev) => (prev + 1) % promoBanners.length);
      setPromoIndexBottom((prev) => (prev + 1) % videoLength);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (qtyModal && qtyInputRef.current) {
      qtyInputRef.current.focus();
      qtyInputRef.current.select();
    }
    // hanya fokus+select saat modal dibuka untuk item baru, bukan setiap perubahan nilai
  }, [qtyModal?.id]);

  const filteredCustomers = useMemo(() => {
    return dummyCustomers.filter((cust) =>
      `${cust.name} ${cust.phone}`.toLowerCase().includes(customerQuery.toLowerCase())
    );
  }, [customerQuery]);

  const filteredProducts = useMemo(() => {
    return dummyProducts.filter((p) =>
      `${p.name} ${p.sku} ${p.id} ${p.barcode ?? ""}`.toLowerCase().includes(productQuery.toLowerCase())
    );
  }, [productQuery]);

  const filteredDrafts = useMemo(() => {
    const term = draftSearch.toLowerCase();
    return dummyDrafts.filter((d) => `${d.id} ${d.customer}`.toLowerCase().includes(term));
  }, [draftSearch]);

  const addToCart = (product: Product, qty = 1) => {
    const qtyToAdd = Math.max(1, Math.min(qty, product.stock));
    setCart((prev) => {
      const existing = prev.find((c) => c.id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.id === product.id ? { ...c, qty: Math.min(c.qty + qtyToAdd, product.stock) } : c
        );
      }
      return [...prev, { ...product, qty: qtyToAdd }];
    });
  };

  const addByBarcode = () => {
    const parsed = parseBarcodeInput(barcode);
    if (!parsed.code) return;
    const product = dummyProducts.find(
      (p) =>
        p.id.toLowerCase() === parsed.code.toLowerCase() ||
        p.sku.toLowerCase() === parsed.code.toLowerCase() ||
        (p.barcode && p.barcode.toLowerCase() === parsed.code.toLowerCase())
    );
    if (product) addToCart(product, parsed.qty);
    setBarcode("");
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, qty: Math.max(1, Math.min(item.qty + delta, item.stock)) } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const applyQtyEdit = () => {
    if (!qtyModal) return;
    const qtyNumber = Math.max(1, Math.min(Number(qtyModal.value) || 0, qtyModal.stock));
    setCart((prev) =>
      prev.map((item) => (item.id === qtyModal.id ? { ...item, qty: qtyNumber } : item))
    );
    setQtyModal(null);
  };

  const removeItem = (id: string) => setCart((prev) => prev.filter((item) => item.id !== id));

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const promoDiscount = cart.reduce((sum, item) => sum + ((item.discount || 0) / 100) * item.price * item.qty, 0);
  const tax = subtotal * 0.1;
  const total = subtotal - promoDiscount + tax;

  useEffect(() => {
    if (payment === "cash") {
      setPayInput("");
    } else {
      setPayInput(total.toString());
    }
  }, [payment, total]);

  const handleConfirmPayment = () => {
    setPaymentModal(false);
    setSuccessToast(true);
    if (reloadTimeout.current) {
      clearTimeout(reloadTimeout.current);
    }
    reloadTimeout.current = window.setTimeout(() => {
      window.location.reload();
    }, 3000);
    window.setTimeout(() => setSuccessToast(false), 2800);
  };

  useEffect(() => {
    if (paymentModal && (payment === "qris" || payment === "ewallet")) {
      setQrCountdown(120);
      const timer = setInterval(() => {
        setQrCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [paymentModal, payment]);

  useEffect(() => {
    return () => {
      if (reloadTimeout.current) {
        clearTimeout(reloadTimeout.current);
      }
    };
  }, []);

  return (
    <div className="bg-gradient-to-br from-[#defcf3] via-white to-[#c0f0e7] text-gray-900 h-screen overflow-hidden">
      <div className="w-full h-full px-0 flex flex-col">
        {/* HEADER */}
        <div className="sticky top-0 z-20 bg-gradient-to-r from-[#0f756b] via-[#12a695] to-[#3FE0D0] text-white shadow-md shadow-emerald-900/40">
          <div className="px-6 py-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3 font-semibold">
              <span className="w-9 h-9 rounded-2xl bg-white/18 text-white flex items-center justify-center shadow-lg shadow-emerald-900/40 border border-white/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-bold">Gwen Retail POS</span>
                <span className="text-xs text-white/80">Frontdesk Mode</span>
              </div>
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-white/15 text-white border border-white/35 shadow-sm">
                Mode Kasir
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/90">
              <span className="px-3 py-1.5 rounded-full bg-white/15 border border-white/30 font-semibold shadow-sm shadow-emerald-900/30">
                Kasir: {cashierName}
              </span>
              <span className="hidden sm:inline text-white/70">|</span>
              <span className="hidden sm:inline">F1 Bantuan</span>
              <span className="hidden sm:inline">F2 Pembayaran</span>
              <button
                onClick={handleLogout}
                className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/15 border border-white/30 text-white font-semibold hover:bg-white/25 hover:-translate-y-0.5 transition"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.7fr_1.5fr_0.8fr] flex-1 min-h-0 px-4 py-4 lg:px-6">
          {/* KOLOM PROMO */}
            <div className="h-full">
              <div className="h-full relative bg-gradient-to-b from-[#f4fffc] via-white/90 to-[#e5fff6] backdrop-blur-xl 
                  border border-[#0f756b]/20 rounded-3xl p-4 shadow-xl shadow-[#3fe0d0]/25 flex flex-col gap-4 overflow-hidden">

                {/* Dekorasi cahaya */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute top-0 left-0 w-36 h-36 bg-[#3FE0D0]/25 blur-3xl rounded-full opacity-70" />
                  <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#0f756b]/20 blur-3xl rounded-full opacity-60" />
                </div>

                {/* HEADER */}
                <div className="relative flex items-center justify-between text-sm font-semibold text-gray-800 pb-3 
                    border-b border-dashed border-[#0f756b]/25">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-2xl bg-[#0f756b]/10 border border-[#0f756b]/20">
                      <Sparkles className="w-4 h-4 text-[#0f756b]" />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-[11px] tracking-[0.16em] uppercase text-gray-500">Promo</span>
                      <span className="text-sm font-semibold text-gray-800">Highlight Hari Ini</span>
                    </div>
                  </div>

                  <span className="text-[11px] text-gray-500 font-medium bg-white/60 px-2 py-1 rounded-lg border border-gray-200">
                    Auto-cycle 4s
                  </span>
                </div>

                {/* BODY — 2 Slider */}
                <div className="relative grid gap-4 auto-rows-fr flex-1 min-h-0">
                  <PromoSlider 
                    activeIndex={promoIndexTop} 
                    onDotClick={setPromoIndexTop} 
                  />
                  <PromoVideoSlider 
                    activeIndex={promoIndexBottom}
                    onDotClick={setPromoIndexBottom}
                  />
                </div>
              </div>
            </div>


          {/* KOLOM TENGAH (SCAN + KERANJANG) */}
            <div className="space-y-4 overflow-hidden">
              {/* SCAN / CUSTOMER */}
              <div className="bg-gradient-to-b from-[#f5fffb] via-white/90 to-[#ecfffb] backdrop-blur-xl border border-[#0f756b]/20 rounded-3xl p-5 space-y-4 shadow-xl shadow-[#3fe0d0]/20">
                {/* HEADER */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pb-3 border-b border-dashed border-[#0f756b]/20">
                  <div className="flex items-center gap-3 text-sm font-semibold text-gray-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#0f756b]/10 text-[#0f756b] border border-[#0f756b]/15">
                      <UserRoundSearch className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                        Scan & Customer
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {selectedCustomer ? selectedCustomer.name : "Customer belum dipilih"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCustomerModal(true)}
                      className="px-3.5 py-2 rounded-xl border border-[#0f756b]/25 bg-white/80 text-gray-800 hover:-translate-y-0.5 hover:shadow-md hover:border-[#3FE0D0]/60 transition-all text-sm font-semibold"
                    >
                      Cari Customer
                    </button>
                    <button
                      onClick={() => setProductModal(true)}
                      className="px-3.5 py-2 rounded-xl border border-[#0f756b]/30 bg-[#3FE0D0]/18 text-[#0f756b] hover:-translate-y-0.5 hover:shadow-md hover:border-[#3FE0D0]/60 transition-all text-sm font-semibold"
                    >
                      Cari Produk
                    </button>
                  </div>
                </div>

                {/* BODY */}
                <div className="grid md:grid-cols-[1.2fr,1fr] gap-3">
                  <div className="relative">
                    <input
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addByBarcode();
                        }
                      }}
                      placeholder="Scan / ketik barcode atau SKU"
                      className="w-full rounded-2xl border border-[#0f756b]/20 bg-white/90 px-4 py-3 pl-11 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-[#0f756b] shadow-inner"
                    />
                    <ScanLine className="w-4 h-4 text-[#0f756b] absolute left-3.5 top-3.5" />
                  </div>
                 
                </div>
              </div>

              {/* KERANJANG */}
              <div className="bg-gradient-to-b from-[#f5fffb] via-white/90 to-[#ecfffb] backdrop-blur-xl border border-[#0f756b]/20 rounded-3xl p-5 space-y-4 shadow-xl shadow-[#3fe0d0]/20 overflow-hidden">
                {/* HEADER */}
                <div className="flex items-center justify-between text-sm font-semibold text-gray-800 pb-3 border-b border-dashed border-[#0f756b]/20">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#0f756b]/10 text-[#0f756b] border border-[#0f756b]/15">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                        Keranjang
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        Item dipilih
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-white/90 border border-[#0f756b]/20 text-[11px] text-gray-700">
                      {cart.length} item
                    </span>
                  </div>
                  <button
                    onClick={() => setProductModal(true)}
                    className="text-[#0f756b] text-sm font-semibold hover:underline flex items-center gap-1"
                  >
                    + Tambah produk
                  </button>
                </div>

                {/* BODY */}
                <div
                  className="overflow-y-auto pr-1"
                  style={{
                    height: "calc(100vh - 375px)" // sesuaikan nilai ini
                  }}
                >
                  {cart.length === 0 ? (
                    <div className="text-sm text-gray-500 flex items-center gap-2 px-2 py-3 rounded-2xl bg-white/80 border border-dashed border-[#0f756b]/25">
                      <ChevronRight className="w-4 h-4 text-[#0f756b]" />
                      <span>Belum ada item, scan atau cari produk terlebih dahulu.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...cart].reverse().map((item) => {
                        const rightImage = item.image2 || getSecondaryImage(item.image);
                        return (
                          <div
                            key={item.id}
                            className="flex gap-3 border border-[#0f756b]/18 rounded-2xl p-3 bg-gradient-to-r from-white to-[#f1fffb] shadow-sm hover:shadow-md hover:border-[#3FE0D0]/50 transition-all"
                          >
                            <div className="flex-shrink-0 flex flex-col items-center gap-1">
                              <div className="flex items-center gap-2">
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-16 h-16 rounded-xl object-cover border border-[#0f756b]/20"
                                />
                                <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#0f756b]/20 bg-white shadow-sm">
                                  <img
                                    src={rightImage}
                                    alt={`${item.name} foto kanan`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.sku}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={() => updateQty(item.id, -1)}
                                  className="p-1 rounded-lg border border-[#0f756b]/15 bg-white/85 hover:bg-white shadow-sm"
                                  aria-label="Kurangi"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    setQtyModal({
                                      id: item.id,
                                      value: String(item.qty),
                                      name: item.name,
                                      stock: item.stock,
                                    })
                                  }
                                  className="px-3 py-1 rounded-lg bg-white border border-white/70 text-sm font-semibold shadow-inner hover:border-[#0f756b]/40 hover:shadow-md transition"
                                  aria-label="Edit jumlah"
                                >
                                  {item.qty}
                                </button>
                                <button
                                  onClick={() => updateQty(item.id, 1)}
                                  className="p-1 rounded-lg border border-[#0f756b]/15 bg-white/85 hover:bg-white shadow-sm"
                                  aria-label="Tambah"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                                <span className="text-xs text-gray-500">Stok {item.stock}</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end justify-between gap-2">
                              <div className="text-right">
                                <p className="text-sm font-semibold text-gray-900">
                                  Rp {formatIDR(item.price * item.qty)}
                                </p>
                                {item.discount ? (
                                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                    <Percent className="w-3 h-3" />
                                    Diskon {item.discount}%
                                  </p>
                                ) : null}
                              </div>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="text-xs text-red-600 inline-flex items-center gap-1 self-end hover:text-red-700"
                              >
                                <Trash2 className="w-3 h-3" /> Hapus
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>


          {/* KOLOM KANAN (CUSTOMER INFO + RINGKASAN) */}
          <div className="space-y-4 overflow-hidden">
            {/* INFORMASI CUSTOMER */}
            <div className="bg-gradient-to-br from-[#f5fffb] via-white/90 to-[#e8fff8] backdrop-blur-xl border border-[#0f756b]/20 rounded-3xl p-5 shadow-lg shadow-[#3fe0d0]/15">
              {/* HEADER */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-dashed border-[#0f756b]/20">
                <div className="flex items-center gap-3 text-sm font-semibold text-gray-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#0f756b]/10 text-[#0f756b] border border-[#0f756b]/15">
                    <UserRoundSearch className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                      Customer
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      Informasi Customer
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setCustomerModal(true)}
                  className="px-3 py-2 rounded-xl border border-[#3FE0D0]/70 bg-[#3FE0D0]/10 text-[#0f756b] hover:-translate-y-0.5 hover:shadow-md hover:bg-[#3FE0D0]/20 transition-all text-xs font-semibold"
                >
                  Pilih Customer
                </button>
              </div>

              {/* BODY */}
              {selectedCustomer ? (
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">
                      {selectedCustomer.name}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-semibold border border-amber-300 shadow-sm">
                      {selectedCustomer.category}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>

                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <MapPin className="w-4 h-4 mt-0.5 text-[#0f756b]" />
                    <span>{selectedCustomer.address}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-dashed border-[#0f756b]/20 text-xs">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Tag className="w-4 h-4 text-[#0f756b]" />
                      <span>{selectedCustomer.tier}</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-[#0f756b]/10 text-[#0f756b] border border-[#0f756b]/25">
                      <BadgeCheck className="w-3 h-3" />
                      <span className="font-semibold">{selectedCustomer.points} pts</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <UserRoundSearch className="w-4 h-4 text-gray-400" />
                  <span>Belum ada customer dipilih</span>
                </div>
              )}
            </div>


            {/* RINGKASAN PEMBAYARAN + BAYAR */}
            <div className="space-y-3">
              {/* KARTU RINGKASAN PEMBAYARAN */}
              <div className="relative rounded-3xl bg-gradient-to-br from-[#0f756b] via-[#0d685f] to-[#0b5a52] text-teal-50 border border-[#12a695]/80 shadow-xl shadow-teal-900/50 p-5 md:p-6 space-y-5 overflow-hidden">
                {/* dekorasi */}
                <div className="pointer-events-none absolute inset-0 opacity-50">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#12a695]/60 blur-3xl rounded-full" />
                  <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-amber-300/45 blur-3xl rounded-full" />
                </div>

                {/* HEADER */}
                <div className="relative flex items-center justify-between text-sm font-semibold">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/15 border border-white/40 shadow-sm">
                      <ReceiptText className="w-4 h-4 text-teal-50" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/85">
                        Ringkasan
                      </span>
                      <span className="text-sm font-semibold text-white">
                        Pembayaran
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-teal-50">
                    <div className="w-9 h-9 rounded-full bg-white/22 text-white flex items-center justify-center text-xs font-bold uppercase border border-white/65 shadow-sm shadow-black/40">
                      {cashierName.slice(0, 2)}
                    </div>
                    <div className="text-left leading-tight">
                      <p className="text-[11px] text-teal-100/80">Kasir</p>
                      <p className="text-sm font-semibold text-white">
                        {cashierName}
                      </p>
                    </div>
                  </div>
                </div>

                {/* METODE PEMBAYARAN */}
                <div className="relative grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <PaymentOption
                    label="Cash"
                    icon={<Wallet className="w-4 h-4" />}
                    active={payment === "cash"}
                    onClick={() => setPayment("cash")}
                  />
                  <PaymentOption
                    label="Kartu"
                    icon={<CreditCard className="w-4 h-4" />}
                    active={payment === "card"}
                    onClick={() => setPayment("card")}
                  />
                  <PaymentOption
                    label="E-Wallet"
                    icon={<QrCode className="w-4 h-4" />}
                    active={payment === "ewallet"}
                    onClick={() => setPayment("ewallet")}
                  />
                  <PaymentOption
                    label="QRIS"
                    icon={<QrCode className="w-4 h-4" />}
                    active={payment === "qris"}
                    onClick={() => setPayment("qris")}
                  />
                </div>

                {/* RINCIAN TOTAL */}
                <div className="relative space-y-2 text-sm">
                  <Row label="Subtotal" value={subtotal} light />
                  <Row label="Diskon" value={-promoDiscount} highlight light />
                  <Row label="PPN 10%" value={tax} light />

                  <div className="flex items-center justify-between pt-3 border-t border-dashed border-white/45">
                    <span className="text-base font-semibold text-teal-50">
                      Total Bayar
                    </span>
                    <span className="text-lg font-extrabold tracking-tight text-white">
                      Rp {formatIDR(total)}
                    </span>
                  </div>
                </div>

                {/* TOMBOL DI DALAM CARD: PRINT + SIMPAN */}
                <div className="relative flex flex-col md:flex-row items-stretch md:items-center justify-end gap-2 pt-3">
                  {/* Print Last – putih penuh, kontras tinggi */}
                  <button
                    className="flex-1 md:flex-none md:min-w-[140px] px-4 py-3 rounded-xl bg-white text-[#0f756b] font-semibold border border-white shadow-md shadow-black/20 hover:bg-emerald-50 hover:-translate-y-0.5 hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Print Last
                  </button>

                  {/* Simpan Draft – putih soft + border dashed */}
                  <button
                    className="flex-1 md:flex-none md:min-w-[140px] px-4 py-3 rounded-xl bg-white/95 text-[#0f756b] font-medium border border-dashed border-amber-300 shadow-sm hover:bg-white hover:-translate-y-0.5 hover:shadow-md transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Save className="w-4 h-4" />
                    Simpan Draft
                  </button>

                  {/* Open Draft */}
                  <button
                    onClick={() => setDraftModal(true)}
                    className="flex-1 md:flex-none md:min-w-[140px] px-4 py-3 rounded-xl bg-[#0f756b] text-white font-semibold border border-[#0f756b] shadow-md shadow-emerald-900/30 hover:bg-[#0e6a62] hover:-translate-y-0.5 hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Save className="w-4 h-4 rotate-180" />
                    Buka Draft
                  </button>
                </div>
              </div>

              {/* TOMBOL BAYAR DI BAWAH CARD – ORANYE KONTRAS */}
              <button
                className="w-full px-4 py-3 rounded-2xl bg-gradient-to-r from-orange-500 via-orange-500 to-orange-600 text-white font-semibold flex items-center justify-center gap-2 text-sm border border-orange-600 shadow-lg shadow-orange-300/80 hover:bg-orange-600 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                onClick={() => {
                  setPayInput(payment === "cash" ? "" : total.toString());
                  setPaymentModal(true);
                }}
              >
                <CreditCard className="w-4 h-4" />
                Bayar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL CUSTOMER */}
      {customerModal && (
        <Modal title="Pilih Customer" onClose={() => setCustomerModal(false)}>
          <div className="space-y-3">
            <div className="relative">
              <input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Cari nama / no. HP"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 pl-10 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-[#3FE0D0]"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
            <div className="max-h-80 overflow-auto space-y-2">
              {filteredCustomers.map((cust) => (
                <button
                  key={cust.id}
                  onClick={() => {
                    setSelectedCustomer(cust);
                    setCustomerModal(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-[#3FE0D0]/70 hover:bg-[#3FE0D0]/10 text-left transition-all"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{cust.name}</p>
                    <p className="text-xs text-gray-500">{cust.phone}</p>
                  </div>
                  <span className="text-xs text-[#0f756b] font-semibold">
                    {cust.tier} | {cust.points} pts
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL PRODUK */}
      {productModal && (
        <Modal title="Cari Produk" onClose={() => setProductModal(false)}>
          <div className="space-y-3">
            <div className="relative">
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Ketik nama / SKU"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 pl-10 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-[#3FE0D0]"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
            <div className="max-h-96 overflow-auto grid sm:grid-cols-2 gap-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    addToCart(product);
                    setProductModal(false);
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:border-[#3FE0D0]/70 hover:shadow-sm text-left transition-all"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-14 h-14 rounded-lg object-cover border border-gray-100"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.sku}</p>
                    <p className="text-sm font-semibold text-gray-900">
                      Rp {formatIDR(product.price)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL PEMBAYARAN */}
      {paymentModal && (
        <Modal title="Pembayaran" onClose={() => setPaymentModal(false)}>
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#f0fffb] via-white to-[#e4fff8] border border-[#0f756b]/15 rounded-2xl px-4 py-3 shadow-sm">
              <div className="text-sm text-gray-700">
                <p className="text-xs text-gray-500">Metode</p>
                <p className="font-semibold text-gray-900 capitalize">{payment}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-bold text-[#0f756b]">Rp {formatIDR(total)}</p>
              </div>
            </div>

            {/* CASH */}
            {payment === "cash" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-800" htmlFor="nominal-bayar">
                    Nominal Bayar
                  </label>
                  <input
                    id="nominal-bayar"
                    type="number"
                    value={payInput}
                    onChange={(e) => setPayInput(e.target.value)}
                    className="w-full rounded-xl border border-[#0f756b]/20 bg-white px-4 py-3 text-lg font-semibold text-gray-900 focus:outline-none focus:border-[#0f756b] shadow-inner"
                    placeholder="Masukkan jumlah dibayar"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white/80 border border-[#0f756b]/15 rounded-2xl p-3">
                    <p className="text-gray-500 text-xs">Dibayar</p>
                    <p className="text-base font-bold text-gray-900">Rp {formatIDR(Number(payInput) || 0)}</p>
                  </div>
                  <div className="bg-white/80 border border-[#0f756b]/15 rounded-2xl p-3">
                    <p className="text-gray-500 text-xs">Kembalian</p>
                    <p className="text-base font-bold text-emerald-700">Rp {formatIDR(Math.max(0, (Number(payInput) || 0) - total))}</p>
                  </div>
                </div>
              </div>
            )}

            {/* CARD */}
            {payment === "card" && (
              <div className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-800" htmlFor="card-number">
                      Nomor Kartu
                    </label>
                    <input
                      id="card-number"
                      type="text"
                      inputMode="numeric"
                      value={cardInfo.number}
                      onChange={(e) => setCardInfo((prev) => ({ ...prev, number: e.target.value }))}
                      className="w-full rounded-xl border border-[#0f756b]/20 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:border-[#0f756b] shadow-inner"
                      placeholder="XXXX XXXX XXXX"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-800" htmlFor="card-bank">
                      Bank
                    </label>
                    <input
                      id="card-bank"
                      type="text"
                      value={cardInfo.bank}
                      onChange={(e) => setCardInfo((prev) => ({ ...prev, bank: e.target.value }))}
                      className="w-full rounded-xl border border-[#0f756b]/20 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:border-[#0f756b] shadow-inner"
                      placeholder="BCA / Mandiri / BNI"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-800" htmlFor="card-name">
                    Nama Pemilik
                  </label>
                  <input
                    id="card-name"
                    type="text"
                    value={cardInfo.name}
                    onChange={(e) => setCardInfo((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-xl border border-[#0f756b]/20 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:border-[#0f756b] shadow-inner"
                    placeholder="Nama di kartu"
                  />
                </div>
                <div className="bg-white/85 border border-[#0f756b]/15 rounded-2xl p-3 text-sm flex items-center justify-between">
                  <span className="text-gray-600">Nominal</span>
                  <span className="text-base font-bold text-[#0f756b]">Rp {formatIDR(total)}</span>
                </div>
              </div>
            )}

            {/* QRIS / E-WALLET */}
            {(payment === "qris" || payment === "ewallet") && (
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-[#0f756b] via-[#12a695] to-[#3FE0D0] rounded-3xl p-6 text-white shadow-xl flex flex-col items-center gap-4">
                  <div className="text-center space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/80">
                      {payment === "qris" ? "QRIS" : "E-Wallet"}
                    </p>
                    <p className="text-lg font-semibold">Scan untuk melanjutkan pembayaran</p>
                  </div>
                  <div className="bg-white rounded-3xl p-3 shadow-2xl border border-white/40">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(`POS-${payment}-${total}`)}`}
                      alt="QR Pembayaran"
                      className="h-60 w-60 object-contain"
                    />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs uppercase text-white/80">Total</p>
                    <p className="text-2xl font-extrabold drop-shadow-sm">Rp {formatIDR(total)}</p>
                    <p className={`text-xs font-semibold ${qrCountdown === 0 ? "text-red-100" : "text-white/90"}`}>
                      Kadaluarsa dalam {formatCountdown(qrCountdown)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setPaymentModal(false)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmPayment}
                className="px-4 py-2 rounded-lg bg-[#0f756b] text-white font-semibold shadow-md hover:shadow-lg text-sm"
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </Modal>
      )}

      {draftModal && (
        <Modal title="Draft Transaksi" onClose={() => setDraftModal(false)}>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">Pilih draft transaksi yang belum selesai.</div>
            <div className="relative">
              <input
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Cari ID / customer"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 pl-10 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-[#3FE0D0]"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Customer</th>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-left">Total</th>
                    <th className="px-3 py-2 text-left">Update</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredDrafts.map((draft) => (
                    <tr key={draft.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold text-gray-900">{draft.id}</td>
                      <td className="px-3 py-2 text-gray-700">{draft.customer}</td>
                      <td className="px-3 py-2 text-gray-700">{draft.items} item</td>
                      <td className="px-3 py-2 font-semibold text-gray-900">Rp {formatIDR(draft.total)}</td>
                      <td className="px-3 py-2 text-gray-500">{draft.updatedAt}</td>
                      <td className="px-3 py-2 text-right">
                        <button className="px-3 py-1.5 rounded-lg bg-[#0f756b] text-white text-xs font-semibold shadow-sm hover:shadow-md hover:bg-[#0d6a62] transition">
                          Lanjutkan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {successToast && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    {/* BACKDROP GELAP + BLUR */}
    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />

    {/* WRAPPER CARD */}
    <div className="relative z-10 w-full max-w-sm px-4 pointer-events-none">
      <div
        className="relative bg-white/98 rounded-3xl shadow-2xl border border-emerald-200 px-6 py-6 flex flex-col items-center gap-4 text-emerald-800 pointer-events-auto"
        style={{ animation: "swalPop 0.42s ease-out" }}
      >
        {/* CONFETTI KECIL DI SEKITAR CARD */}
        <span
          className="absolute -top-3 -left-2 w-2 h-4 bg-emerald-400 rounded-sm"
          style={{ animation: "confetti 0.9s ease-out forwards" }}
        />
        <span
          className="absolute -top-4 left-1/2 w-2 h-4 bg-amber-400 rounded-sm"
          style={{ animation: "confetti 1s ease-out 0.1s forwards" }}
        />
        <span
          className="absolute -top-2 -right-2 w-2 h-4 bg-pink-400 rounded-sm"
          style={{ animation: "confetti 0.95s ease-out 0.15s forwards" }}
        />
        <span
          className="absolute bottom-0 left-3 w-2 h-4 bg-cyan-400 rounded-sm"
          style={{ animation: "confetti 1s ease-out 0.2s forwards" }}
        />
        <span
          className="absolute bottom-1 right-4 w-2 h-4 bg-violet-400 rounded-sm"
          style={{ animation: "confetti 0.9s ease-out 0.25s forwards" }}
        />

        {/* ICON */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-emerald-300/70 blur-xl" />
          <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 border-4 border-white text-white flex items-center justify-center text-3xl font-black shadow-xl">
            ✓
          </div>
        </div>

        {/* TITLE + TEXT (mirip SweetAlert2) */}
        <div className="text-center space-y-1">
          <p className="text-xl font-extrabold text-emerald-800">
            Transaksi Berhasil
          </p>
          <p className="text-sm text-emerald-700/80">
            Terimakasih sudah berbelanja di toko kami!
          </p>
        </div>

        {/* PROGRESS BAR TIMER */}
        <div className="w-full h-1.5 rounded-full bg-emerald-100 overflow-hidden mt-1">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-400"
            style={{ animation: "swalBar 2.8s linear forwards" }}
          />
        </div>

        {/* OPTIONAL: TOMBOL CLOSE MANUAL */}
        {/* 
        <button
          onClick={() => setSuccessToast(false)}
          className="mt-1 text-xs text-emerald-700/80 hover:text-emerald-900"
        >
          Tutup sekarang
        </button>
        */}
      </div>
    </div>

    {/* ANIMASI KEYFRAMES KHUSUS ALERT INI */}
    <style jsx>{`
      @keyframes swalPop {
        0% {
          transform: scale(0.7) translateY(20px);
          opacity: 0;
        }
        55% {
          transform: scale(1.03) translateY(0);
          opacity: 1;
        }
        100% {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
      }
      @keyframes swalBar {
        from {
          width: 0%;
        }
        to {
          width: 100%;
        }
      }
      @keyframes confetti {
        0% {
          transform: translateY(-6px) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(10px) rotate(260deg);
          opacity: 0;
        }
      }
    `}</style>
  </div>
)}



      {/* MODAL EDIT QTY */}
      {qtyModal && (
        <Modal title="Ubah Jumlah" onClose={() => setQtyModal(null)}>
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              {qtyModal.name}
              <div className="text-xs text-gray-500">Stok tersedia: {qtyModal.stock}</div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-800" htmlFor="qty-input">
                Jumlah
              </label>
              <input
                id="qty-input"
                type="number"
                min={1}
                max={qtyModal.stock}
                value={qtyModal.value}
                ref={qtyInputRef}
                onChange={(e) =>
                  setQtyModal((prev) => (prev ? { ...prev, value: e.target.value } : prev))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyQtyEdit();
                  }
                }}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-900 focus:outline-none focus:border-[#3FE0D0]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setQtyModal(null)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold"
              >
                Batal
              </button>
              <button
                onClick={applyQtyEdit}
                className="px-4 py-2 rounded-lg bg-[#0f756b] text-white font-semibold shadow-md hover:shadow-lg text-sm"
              >
                Simpan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PromoSlider({
  activeIndex,
  onDotClick,
}: {
  activeIndex: number;
  onDotClick: (idx: number) => void;
}) {
  return (
    <div className="relative bg-white/80 backdrop-blur-xl border border-[#0f756b]/20 rounded-3xl shadow-xl shadow-[#3fe0d0]/20 overflow-hidden aspect-square w-full">
      {/* LIGHT EFFECT BACKGROUND */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#3FE0D0]/25 blur-3xl opacity-60" />
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-[#0f756b]/20 blur-3xl opacity-50" />
      </div>

      <div className="relative h-full w-full z-10">
        <div
          className="flex h-full w-full transition-transform duration-500 ease-out"
          style={{
            width: `${promoBanners.length * 100}%`,
            transform: `translateX(-${activeIndex * 100}%)`,
          }}
        >
          {promoBanners.map((promo) => (
            <div
              key={promo.id}
              className="relative w-full h-full flex-shrink-0"
            >
              {/* IMAGE FULL AREA – STRETCH */}
              <img
                src={promo.image}
                alt={promo.title}
                className="absolute inset-0 w-full h-full object-fill"
              />

              {/* GRADIENT UNTUK TEKS */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />

              {/* TEXT OVERLAY */}
              <div className="relative z-10 h-full w-full flex flex-col justify-end p-4">
                <span className="text-[10px] font-semibold tracking-wide text-[#0fefc9] px-2 py-1 rounded-full 
                    bg-black/40 border border-[#3FE0D0]/60 shadow-sm shadow-black/40 w-fit">
                  {promo.badge}
                </span>

                <p className="text-lg font-extrabold text-white mt-2 leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                  {promo.title}
                </p>

                <p className="text-xs text-teal-50/90 mt-1 max-w-[85%] drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
                  {promo.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* DOT INDICATOR */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-20">
          {promoBanners.map((promo, idx) => (
            <button
              key={promo.id}
              onClick={() => onDotClick(idx)}
              className={`h-2.5 w-2.5 rounded-full border border-[#0f756b]/40 transition-all
                ${
                  activeIndex === idx
                    ? "bg-[#0f756b] shadow-sm shadow-[#0f756b]/50 scale-110"
                    : "bg-white/80 hover:bg-white"
                }`}
              aria-label={`Promo ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


function PromoVideoSlider({ activeIndex, onDotClick }: { activeIndex: number; onDotClick: Dispatch<SetStateAction<number>> }) {
  const videos = promoVideos;
  const videoRefs = useRef<HTMLVideoElement[]>([]);
  const videoCount = videos.length;
  const normalizedIndex = videoCount ? activeIndex % videoCount : 0;
  const hasMultiple = videoCount > 1;

  // Saat index berubah, pastikan video aktif di-play dari awal
  useEffect(() => {
    if (!hasMultiple && videoCount === 1) return; // single video sudah pakai loop

    const video = videoRefs.current[normalizedIndex];
    if (video) {
      video.currentTime = 0;
      const p = video.play();
      if (p && typeof p.then === "function") {
        p.catch(() => {
          // abaikan error autoplay (misalnya browser blok), ini POS internal
        });
      }
    }
  }, [normalizedIndex, hasMultiple, videoCount]);

  const handleEnded = (idx: number) => {
    // kalau cuma 1 video, biarkan loop bawaan <video>
    if (!hasMultiple) return;
    if (idx !== normalizedIndex) return;

    onDotClick((normalizedIndex + 1) % videoCount);
  };

  if (!videoCount) return null;

  return (
    <div className="relative bg-white/75 backdrop-blur-xl border border-[#0f756b]/18 rounded-3xl shadow-lg shadow-[#3fe0d0]/15 overflow-hidden h-full">
      {/* LIGHT OVERLAY */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#3FE0D0]/20 blur-3xl opacity-60" />
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-[#0f756b]/20 blur-3xl opacity-50" />
      </div>

      <div className="relative h-full min-h-[180px] z-10">
        {/* STACKED VIDEOS (fade in / fade out) */}
        <div className="relative h-full w-full">
          {videos.map((vid, idx) => (
            <video
              key={vid.id}
              ref={(el) => {
                if (el) videoRefs.current[idx] = el;
              }}
              src={vid.url}
              autoPlay={hasMultiple ? idx === normalizedIndex : true}
              muted
              loop={!hasMultiple} // kalau multiple, loop playlist; kalau satu, loop video
              playsInline
              onEnded={() => handleEnded(idx)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700
                ${idx === normalizedIndex ? "opacity-100" : "opacity-0"}`}
            />
          ))}
        </div>

        {/* Dots – hanya tampil kalau video lebih dari satu */}
        {hasMultiple && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-20">
            {videos.map((v, idx) => (
              <button
                key={v.id}
                onClick={() => onDotClick(idx)}
                className={`h-2.5 w-2.5 rounded-full border border-[#0f756b]/40 transition-all
                  ${
                    normalizedIndex === idx
                      ? "bg-[#0f756b] shadow-sm shadow-[#0f756b]/50 scale-110"
                      : "bg-white/80 hover:bg-white"
                  }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentOption({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between md:justify-center gap-2 px-3 py-2.5 rounded-2xl border text-xs md:text-sm font-semibold transition-all
        ${
          active
            ? "bg-white text-[#0f756b] border-amber-300 shadow-md shadow-black/15 hover:bg-amber-50 hover:border-amber-200"
            : "bg-white/8 text-teal-50/90 border-white/35 hover:bg-white/18 hover:text-white hover:border-white/80"
        }`}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-xl
          ${
            active
              ? "bg-amber-100 text-amber-700"
              : "bg-white/15 text-teal-50"
          }`}
      >
        {icon}
      </span>
      <span className="whitespace-nowrap">{label}</span>

      {/* indikator kecil di kanan */}
      <span
        className={`h-2 w-2 rounded-full ${
          active ? "bg-amber-400" : "bg-white/35"
        }`}
      />
    </button>
  );
}

function Row({
  label,
  value,
  highlight,
  light,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  light?: boolean;
}) {
  const labelColor = light
    ? highlight
      ? "text-amber-100"
      : "text-emerald-50/80"
    : highlight
    ? "text-amber-600"
    : "text-gray-600";

  const valueColor = light
    ? highlight
      ? "text-amber-100"
      : "text-white"
    : highlight
    ? "text-amber-600"
    : "text-gray-900";

  return (
    <div className="flex items-center justify-between text-sm">
      <span className={`font-medium ${labelColor}`}>{label}</span>
      <span className={`font-semibold ${valueColor}`}>
        {value < 0 ? "-" : ""}Rp {formatIDR(Math.abs(value))}
      </span>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function formatIDR(value: number) {
  return value.toLocaleString("id-ID");
}

function formatCountdown(value: number) {
  const mins = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const secs = (value % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function parseBarcodeInput(raw: string) {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d+)x(.+)$/i);
  if (match) {
    return { qty: Math.max(1, Number(match[1]) || 1), code: match[2].trim() };
  }
  return { qty: 1, code: trimmed };
}

function getSecondaryImage(url: string) {
  if (url.includes("seed/")) {
    const match = url.match(/seed\/([^/]+)/);
    if (match?.[1]) {
      return url.replace(match[0], `seed/${match[1]}-alt`);
    }
  }
  const hasQuery = url.includes("?");
  return `${url}${hasQuery ? "&" : "?"}alt=1`;
}
