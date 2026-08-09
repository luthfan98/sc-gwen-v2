"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function UserBadge() {
  const pathname = usePathname();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/penjualan/login")) return;
    const auth = localStorage.getItem("penjualan_auth") === "true";
    if (!auth) return;
    const savedName = localStorage.getItem("penjualan_user") || "Kasir Demo";
    setName(savedName);
  }, [pathname]);

  if (!name) return null;

  return (
    <div className="mb-4 flex justify-end">
      <span className="px-3 py-2 rounded-xl bg-[#0f756b]/10 text-[#0f756b] border border-[#0f756b]/15 text-sm font-semibold">
        Masuk sebagai {name}
      </span>
    </div>
  );
}
