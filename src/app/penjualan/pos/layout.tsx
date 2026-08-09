import type { ReactNode } from "react";
import PenjualanGuard from "../penjualan-guard";

export default function PenjualanPOSLayout({ children }: { children: ReactNode }) {
  return (
    <PenjualanGuard>
      {children}
    </PenjualanGuard>
  );
}
