import type { ReactNode } from "react";
import PenerimaanGuard from "./penerimaan-guard";

export const metadata = {
  title: "Penerimaan Barang",
  description: "Pantau dan proses penerimaan barang dari PO.",
};

export default function PenerimaanLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eaf7ff] via-white to-[#dff7f0] text-gray-900">
      <PenerimaanGuard>{children}</PenerimaanGuard>
    </div>
  );
}
