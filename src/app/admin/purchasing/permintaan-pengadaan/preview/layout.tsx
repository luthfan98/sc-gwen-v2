import React from "react";

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  // Preview page without shared header/sidebar
  return <>{children}</>;
}
