"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardCheck,
  PackageOpen,
  UserRoundSearch,
  ReceiptText,
  Trash2,
  ShieldCheck,
} from "lucide-react";

type Customer = { id: string; name: string };
type Sale = {
  id: string;
  customerId: string;
  date: string;
};
type SaleItem = {
  id: string;
  saleId: string;
  name: string;
  sku: string;
  qty: number;
  price: number;
};

// dummy data
const customers: Customer[] = [
  { id: "CUST-001", name: "Anisa Rahma" },
  { id: "CUST-002", name: "Bima Nugraha" },
  { id: "CUST-003", name: "Walk-in" },
];

const sales: Sale[] = [
  { id: "INV-2025-0101", customerId: "CUST-001", date: "12/02/2025" },
  { id: "INV-2025-0103", customerId: "CUST-003", date: "12/02/2025" },
  { id: "INV-2025-0097", customerId: "CUST-002", date: "11/02/2025" },
];

const saleItems: SaleItem[] = [
  {
    id: "IT-1",
    saleId: "INV-2025-0101",
    name: "Glowree Bright Serum 30ml",
    sku: "SKU-GLW-01",
    qty: 2,
    price: 165000,
  },
  {
    id: "IT-2",
    saleId: "INV-2025-0101",
    name: "Veluxe Lip Matte #Rose",
    sku: "SKU-LIP-02",
    qty: 1,
    price: 92000,
  },
  {
    id: "IT-3",
    saleId: "INV-2025-0103",
    name: "Hydra Mist Toner 100ml",
    sku: "SKU-TNR-03",
    qty: 1,
    price: 78000,
  },
  {
    id: "IT-4",
    saleId: "INV-2025-0097",
    name: "UV Shield Sunscreen SPF50",
    sku: "SKU-SS-04",
    qty: 3,
    price: 112000,
  },
];

type DraftItem = {
  itemId: string;
  name: string;
  sku: string;
  qtyJual: number;
  qtyRetur: number;
  reason: string;
  price: number;
};

export default function ReturBaruPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedSale, setSelectedSale] = useState<string>("");
  const [qtyInput, setQtyInput] = useState<Record<string, number>>({});
  const [reasonInput, setReasonInput] = useState<Record<string, string>>({});
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [saved, setSaved] = useState(false);

  const salesForCustomer = useMemo(
    () => sales.filter((s) => s.customerId === selectedCustomer),
    [selectedCustomer]
  );

  const itemsForSale = useMemo(
    () => saleItems.filter((i) => i.saleId === selectedSale),
    [selectedSale]
  );

  const totalDraft = draftItems.reduce(
    (sum, x) => sum + x.qtyRetur * x.price,
    0
  );

  const handleAddToDraft = (item: SaleItem) => {
    const qty = qtyInput[item.id] ?? 0;
    if (!qty || qty <= 0) return;
    if (qty > item.qty) {
      alert("Qty retur tidak boleh lebih besar dari qty jual.");
      return;
    }

    const reason = reasonInput[item.id] ?? "";

    setDraftItems((prev) => {
      // jika sudah ada, update
      const existing = prev.find((p) => p.itemId === item.id);
      if (existing) {
        return prev.map((p) =>
          p.itemId === item.id
            ? {
                ...p,
                qtyRetur: qty,
                reason,
              }
            : p
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          sku: item.sku,
          qtyJual: item.qty,
          qtyRetur: qty,
          reason,
          price: item.price,
        },
      ];
    });
  };

  const handleRemoveDraft = (itemId: string) => {
    setDraftItems((prev) => prev.filter((x) => x.itemId !== itemId));
  };

  const handleSave = () => {
    if (!selectedCustomer || !selectedSale || draftItems.length === 0) {
      alert("Lengkapi customer, invoice, dan minimal 1 item retur terlebih dahulu.");
      return;
    }
    // di sini nanti panggil API untuk simpan
    console.log("Simpan retur:", {
      customer: selectedCustomer,
      sale: selectedSale,
      items: draftItems,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* HEADER */}
      <Link
          href="/penjualan/retur"
          className="mt-1 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke daftar retur
        </Link>
      <div className="flex items-start gap-3">
        
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">
            Retur Penjualan
          </p>
          <h1 className="text-2xl font-bold text-gray-900">
            Pengajuan Retur Baru
          </h1>
          <p className="text-sm text-gray-600">
            Pilih customer dan invoice terlebih dahulu, lalu tentukan item dan
            qty yang akan diretur.
          </p>
        </div>
      </div>

      {/* FORM ATAS: PILIH CUSTOMER & PENJUALAN */}
      <div className="rounded-3xl border border-[#0f756b]/15 bg-white/90 p-5 shadow-lg shadow-[#3fe0d0]/10 space-y-4">
        <div className="flex items-center gap-2">
          <UserRoundSearch className="h-5 w-5 text-[#0f756b]" />
          <h2 className="text-base font-semibold text-gray-900">
            Langkah 1 • Pilih Customer & Penjualan
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-gray-700">
            Customer
            <select
              value={selectedCustomer}
              onChange={(e) => {
                setSelectedCustomer(e.target.value);
                setSelectedSale("");
                setDraftItems([]);
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm outline-none transition focus:border-[#0f756b] focus:ring-2 focus:ring-[#0f756b]/30"
            >
              <option value="">Pilih customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium text-gray-700">
            Kode Penjualan (Invoice)
            <select
              value={selectedSale}
              onChange={(e) => {
                setSelectedSale(e.target.value);
                setDraftItems([]);
              }}
              disabled={!selectedCustomer}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm outline-none transition disabled:bg-gray-50 disabled:text-gray-400 focus:border-[#0f756b] focus:ring-2 focus:ring-[#0f756b]/30"
            >
              <option value="">
                {selectedCustomer
                  ? "Pilih kode penjualan"
                  : "Pilih customer dulu"}
              </option>
              {salesForCustomer.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} • {s.date}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* LIST ITEM PENJUALAN */}
      <div className="rounded-3xl border border-gray-200 bg-white/95 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <PackageOpen className="h-5 w-5 text-[#0f756b]" />
          <h2 className="text-base font-semibold text-gray-900">
            Langkah 2 • Pilih Item yang Diretur
          </h2>
        </div>
        <p className="text-xs text-gray-500">
          Atur qty retur per item, lalu klik &quot;Tambahkan ke Retur&quot;
          untuk memasukkan ke draft di bawah.
        </p>

        <div className="overflow-hidden rounded-2xl border border-gray-100">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Nama Barang</th>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-right">Qty Jual</th>
                <th className="px-3 py-2 text-right">Qty Retur</th>
                <th className="px-3 py-2 text-left">Alasan</th>
                <th className="px-3 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {itemsForSale.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-4 text-center text-sm text-gray-500"
                  >
                    Pilih customer dan kode penjualan untuk melihat item.
                  </td>
                </tr>
              )}
              {itemsForSale.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-gray-800 font-medium">
                    {item.name}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{item.sku}</td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {item.qty}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      max={item.qty}
                      value={qtyInput[item.id] ?? ""}
                      onChange={(e) =>
                        setQtyInput((prev) => ({
                          ...prev,
                          [item.id]: Number(e.target.value),
                        }))
                      }
                      className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1 text-right text-xs md:text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      placeholder="Alasan singkat"
                      value={reasonInput[item.id] ?? ""}
                      onChange={(e) =>
                        setReasonInput((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs md:text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleAddToDraft(item)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#0f756b] px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#0d6a62]"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      Tambahkan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRAFT RETUR DI BAWAH + TOMBOL SIMPAN */}
      <div className="rounded-3xl border border-[#0f756b]/20 bg-white/95 p-5 shadow-lg shadow-[#3fe0d0]/10 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-[#0f756b]" />
            <h2 className="text-base font-semibold text-gray-900">
              Langkah 3 • Draft Retur
            </h2>
          </div>
          <div className="text-sm text-gray-600">
            Total nominal retur:{" "}
            <span className="font-semibold text-gray-900">
              Rp {totalDraft.toLocaleString("id-ID")}
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Nama Barang</th>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-right">Qty Jual</th>
                <th className="px-3 py-2 text-right">Qty Retur</th>
                <th className="px-3 py-2 text-left">Alasan</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
                <th className="px-3 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {draftItems.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-sm text-gray-500"
                  >
                    Belum ada item di draft retur. Tambahkan item terlebih
                    dahulu.
                  </td>
                </tr>
              )}
              {draftItems.map((d) => (
                <tr key={d.itemId}>
                  <td className="px-3 py-2 text-gray-800 font-medium">
                    {d.name}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{d.sku}</td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {d.qtyJual}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900 font-semibold">
                    {d.qtyRetur}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{d.reason}</td>
                  <td className="px-3 py-2 text-right text-gray-900 font-semibold">
                    Rp {(d.qtyRetur * d.price).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleRemoveDraft(d.itemId)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 border border-red-100 hover:bg-red-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Retur baru akan benar-benar diproses setelah Anda menekan tombol{" "}
            <span className="font-semibold text-gray-700">Simpan Retur</span>.
          </p>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f756b] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#0f756b]/30 transition hover:-translate-y-0.5 hover:shadow-lg hover:bg-[#0d6a62]"
          >
            <ClipboardCheck className="h-4 w-4" />
            Simpan Retur
          </button>
        </div>

        {saved && (
          <div className="mt-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Retur tersimpan (dummy). Nantinya akan diarahkan kembali ke daftar
            retur.
          </div>
        )}
      </div>
    </div>
  );
}
