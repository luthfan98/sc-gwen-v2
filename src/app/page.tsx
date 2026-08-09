"use client";
import Banner from "@/components/banner";
import CategoryList from "@/components/category-list";
import BrandList from "@/components/brand-list";
import ProductGrid from "@/components/product-grid";
import { useEffect } from "react";
import { useCartStore } from "@/lib/cart-store";
import PromoStrip from "@/components/promo-strip";
import SpecialOffers from "@/components/special-offers";
import Header from "@/components/header";
import Footer from "@/components/footer";

export default function HomePage() {
  const hydrate = useCartStore((s) => s.hydrate);
  useEffect(() => hydrate(), [hydrate]);

  const params = new URLSearchParams(typeof window !== "undefined" ? (window.location.hash.split("?")[1] || "") : "");
  const filterBrand = params.get("brand") || undefined;
  const filterCategory = params.get("category") || undefined;

  return (
    <>
      <Header />
      <main className="flex-1">
        <Banner />
        <CategoryList />
        <PromoStrip />
        <SpecialOffers />
        <BrandList />
        <ProductGrid filterBrand={filterBrand} filterCategory={filterCategory} />
      </main>
      <Footer />
    </>
  );
}
