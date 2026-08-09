import type { ReactNode } from "react";
import PenjualanGuard from "./penjualan-guard";


export const metadata = {
  title: "Gwen | Penjualan",
  description: "Portal penjualan Gwen dengan POS dan Inquiry.",
};

export default function PenjualanLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e2fff9] via-white to-[#c8f3ea] text-gray-900">
      <main className="">
        <PenjualanGuard>
          
          {children}
        </PenjualanGuard>
      </main>
    </div>
  );
}
