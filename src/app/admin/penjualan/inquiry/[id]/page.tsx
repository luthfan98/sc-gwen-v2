"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Home, Printer, User } from "lucide-react";

type InquiryStatus = "Selesai" | "Proses" | "Batal";
type Inquiry = {
  id: string;
  customer: string;
  cashier: string;
  total: number;
  status: InquiryStatus;
  date: string;
  items: { name: string; qty: number; price: number }[];
};

function createSeededRandom(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function generateDummyInquiries(year: number, monthIndex: number, seed: number): Inquiry[] {
  const rng = createSeededRandom(seed);
  const customers = ["Walk-in", "Anisa Rahma", "Bima Nugraha", "Citra Ayu", "Rina Putri", "Dimas Arya"];
  const products = [
    { name: "Glowree Bright Serum 30ml", price: 165000 },
    { name: "Veluxe Lip Matte #Rose", price: 82000 },
    { name: "Hydra Mist Toner 100ml", price: 78000 },
    { name: "UV Shield Sunscreen SPF50", price: 112000 },
    { name: "Glossy Lip Tint #Cherry", price: 42000 },
    { name: "Aloe Soothing Gel 250ml", price: 98000 },
    { name: "Nourish Night Cream 20g", price: 110000 },
    { name: "Hydra Gel Cleanser", price: 70000 },
  ];

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const prefix = `INV-${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
  const result: Inquiry[] = [];
  let counter = 1;

  for (let day = 1; day <= daysInMonth; day++) {
    const trxPerDay = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < trxPerDay; i++) {
      const hour = 9 + Math.floor(rng() * 9);
      const minute = Math.floor(rng() * 60);
      const dateStr = new Date(year, monthIndex, day, hour, minute).toISOString();

      const itemCount = 1 + Math.floor(rng() * 3);
      const items = Array.from({ length: itemCount }, () => {
        const prod = pick(rng, products);
        const qty = 1 + Math.floor(rng() * 3);
        return { name: prod.name, qty, price: prod.price };
      });
      const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
      const statuses: InquiryStatus[] = ["Selesai", "Selesai", "Proses", "Selesai", "Selesai", "Batal"];
      const status = pick(rng, statuses);

      result.push({
        id: `${prefix}${String(counter).padStart(3, "0")}`,
        customer: pick(rng, customers),
        cashier: "Admin",
        total,
        status,
        date: dateStr,
        items,
      });

      counter++;
    }
  }

  return result;
}

export default function InquiryDetail({ params }: { params: { id: string } }) {
  const match = params.id.match(/^INV-(\d{4})-(\d{2})-\d{3}$/);
  if (!match) return notFound();

  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const seed = Number(`${year}${match[2]}`);
  const tx = generateDummyInquiries(year, monthIdx, seed).find((d) => d.id === params.id);
  if (!tx) return notFound();

  const handlePrint = () => {
    const win = window.open("", "PRINT", "height=600,width=400");
    if (!win) return;
    const itemsHtml = tx.items
      .map(
        (it) =>
          `<tr><td>${it.name}</td><td style="text-align:center;">${it.qty}</td><td style="text-align:right;">Rp ${it.price.toLocaleString(
            "id-ID"
          )}</td><td style="text-align:right;">Rp ${(it.qty * it.price).toLocaleString("id-ID")}</td></tr>`
      )
      .join("");
    win.document.write(`
      <html>
        <head>
          <title>Nota ${tx.id}</title>
          <style>
            @page { size: 7cm auto; margin: 6mm; }
            body { font-family: monospace; color: #111; margin: 0; padding: 0; }
            .paper { width: 7cm; margin: 0 auto; padding: 8px 6px; }
            h1 { font-size: 16px; margin: 0 0 2px 0; text-align: center; letter-spacing: 0.08em; }
            .muted { color: #555; font-size: 12px; text-align: center; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
            td { padding: 2px 0; }
            .totals td { padding-top: 6px; font-weight: 700; border-top: 1px dashed #ccc; }
          </style>
        </head>
        <body>
          <div class="paper">
            <h1>GWEN</h1>
            <div class="muted">Nota kecil · ${tx.id}</div>
            <div class="muted">${new Date(tx.date).toLocaleString("id-ID")}</div>
            <div style="margin-top:8px; font-size:12px; line-height:1.4;">
              Customer: <strong>${tx.customer}</strong><br/>
              Kasir: <strong>${tx.cashier}</strong><br/>
              Status: <strong>${tx.status}</strong>
            </div>
            <table>
              <thead>
                <tr><td>Item</td><td style="text-align:center;">Qty</td><td style="text-align:right;">Harga</td><td style="text-align:right;">Sub</td></tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot class="totals">
                <tr><td colspan="3">Total</td><td style="text-align:right;">Rp ${tx.total.toLocaleString("id-ID")}</td></tr>
              </tfoot>
            </table>
            <p style="margin-top:12px;font-size:12px; text-align:center;">Terima kasih telah berbelanja.</p>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e2fff9] via-white to-[#c8f3ea] text-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-10 lg:py-14 space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#0f756b]/10 border border-[#0f756b]/20 flex items-center justify-center text-[#0f756b] font-bold shadow-sm">
              GW
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">Gwen Retail</span>
              <span className="text-sm font-semibold text-gray-900">Detail Transaksi</span>
            </div>
          </div>
          <Link
            href="/admin/penjualan/inquiry"
            className="px-3 py-2 rounded-xl text-sm font-semibold text-[#0f756b] border border-[#0f756b]/25 bg-white hover:bg-emerald-50 transition inline-flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Kembali
          </Link>
        </header>

        <div className="bg-white/85 backdrop-blur-xl border border-[#0f756b]/15 rounded-3xl shadow-xl shadow-[#3fe0d0]/15 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-[#0f756b]/10 text-[#0f756b] border border-[#0f756b]/20 flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">ID Transaksi</p>
              <p className="text-lg font-bold text-gray-900">{tx.id}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
            <div className="bg-white/80 border border-gray-100 rounded-2xl p-3">
              <p className="text-xs text-gray-500">Customer</p>
              <p className="font-semibold text-gray-900">{tx.customer}</p>
            </div>
            <div className="bg-white/80 border border-gray-100 rounded-2xl p-3 flex items-center gap-2">
              <User className="w-4 h-4 text-[#0f756b]" />
              <div>
                <p className="text-xs text-gray-500">Kasir</p>
                <p className="font-semibold text-gray-900">{tx.cashier}</p>
              </div>
            </div>
            <div className="bg-white/80 border border-gray-100 rounded-2xl p-3">
              <p className="text-xs text-gray-500">Status</p>
              <p className="font-semibold">{tx.status}</p>
            </div>
            <div className="bg-white/80 border border-gray-100 rounded-2xl p-3">
              <p className="text-xs text-gray-500">Waktu</p>
              <p className="font-semibold text-gray-900">
                {new Date(tx.date).toLocaleString("id-ID")}
              </p>
            </div>
            <div className="bg-white/80 border border-gray-100 rounded-2xl p-3">
              <p className="text-xs text-gray-500">Total</p>
              <p className="font-semibold text-[#0f756b] text-lg">Rp {tx.total.toLocaleString("id-ID")}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left">Qty</th>
                  <th className="px-3 py-2 text-left">Harga</th>
                  <th className="px-3 py-2 text-left">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {tx.items.map((item, idx) => (
                  <tr key={`${tx.id}-${idx}`}>
                    <td className="px-3 py-2 text-gray-900 font-semibold">{item.name}</td>
                    <td className="px-3 py-2 text-gray-700">{item.qty}</td>
                    <td className="px-3 py-2 text-gray-700">Rp {item.price.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2 text-gray-900 font-semibold">
                      Rp {(item.price * item.qty).toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-white text-[#0f756b] border border-[#0f756b]/25 text-sm font-semibold hover:bg-emerald-50 transition inline-flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Cetak
            </button>
            <Link
              href="/admin/penjualan/inquiry"
              className="px-4 py-2 rounded-lg bg-[#0f756b] text-white font-semibold shadow-md hover:shadow-lg text-sm"
            >
              Kembali ke daftar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
