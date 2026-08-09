import ProductCard from "./product-card";
import { products } from "@/lib/data";

type Props = {
  filterBrand?: string;
  filterCategory?: string;
};

export default function ProductGrid({ filterBrand, filterCategory }: Props) {
  const list = products.filter((p) => {
    return (
      (!filterBrand || p.brandId.includes(filterBrand)) &&
      (!filterCategory || p.categoryId.includes(filterCategory))
    );
  });

  return (
    <section id="produk" className="mx-auto max-w-7xl px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Produk Terbaru</h2>
          <p className="text-gray-600">Koleksi terbaru untuk kecantikan Anda</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {list.map((p) => (
          <ProductCard 
            key={p.id} 
            slug={p.slug}
            name={p.name}
            image={p.image}
            price={p.price}
            shortDesc={p.shortDesc}
            rating={p.rating}
          />
        ))}
      </div>
    </section>
  );
}
