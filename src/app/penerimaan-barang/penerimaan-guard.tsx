"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function PenerimaanGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/penerimaan-barang/login")) {
      setAllowed(true);
      return;
    }

    setAllowed(true);
  }, [pathname, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
