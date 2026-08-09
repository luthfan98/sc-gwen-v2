"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function PenjualanGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/penjualan/login")) {
      setAllowed(true);
      return;
    }

    const authed = typeof window !== "undefined" && localStorage.getItem("penjualan_auth") === "true";
    if (!authed) {
      router.replace("/penjualan/login");
      return;
    }
    setAllowed(true);
  }, [pathname, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
