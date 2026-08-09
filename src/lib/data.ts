export type Category = { id: string; name: string; slug: string };
export type Brand = { id: string; name: string; slug: string };
export type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  categoryId: string;
  brandId: string;
  shortDesc: string;
  description: string;
  rating: number;
};

export const categories: Category[] = [
  { id: 'c1', name: 'Skincare', slug: 'skincare' },
  { id: 'c2', name: 'Makeup', slug: 'makeup' },
  { id: 'c3', name: 'Body Care', slug: 'body-care' },
  { id: 'c4', name: 'Hair Care', slug: 'hair-care' }
];

export const brands: Brand[] = [
  { id: 'b1', name: 'Glowree', slug: 'glowree' },
  { id: 'b2', name: 'Veluxe', slug: 'veluxe' },
  { id: 'b3', name: 'Derma+Lab', slug: 'derma-lab' },
  { id: 'b4', name: 'Purely', slug: 'purely' }
];

export const products: Product[] = [
  {
    id: "p1",
    slug: "glowree-bright-serum",
    name: "Glowree Bright Serum 30ml",
    price: 149000,
    image:
      "https://www.static-src.com/wcsstore/Indraprastha/images/catalog/full//103/MTA-14088657/vaseline_vaseline-hb-firm-glow-srm-180ml-_full01.jpg",
    categoryId: "c1",
    brandId: "b1",
    shortDesc: "Serum pencerah dengan Niacinamide",
    description:
      "Serum pencerah wajah dengan 5% Niacinamide + Licorice untuk menyamarkan noda hitam dan meratakan warna kulit.",
    rating: 4.8,
  },
  {
    id: "p2",
    slug: "veluxe-lip-matte",
    name: "Veluxe Lip Matte #Rose",
    price: 99000,
    image:
      "https://d2jlkn4m127vak.cloudfront.net/medias/products/slides-2-1648539251.webp",
    categoryId: "c2",
    brandId: "b2",
    shortDesc: "Lip matte ringan & tahan lama",
    description:
      "Lipstik matte dengan tekstur ringan, hasil velvet, tidak membuat bibir kering, transfer minimal.",
    rating: 4.9,
  },
  {
    id: "p3",
    slug: "dermalab-sunscreen-spf50",
    name: "Derma Lab Sunscreen SPF50",
    price: 129000,
    image:
      "https://www.dermalab.com.sg/wp-content/uploads/2024/02/Vitamin-E-Serum-Sunscreen_810x855.jpg",
    categoryId: "c1",
    brandId: "b3",
    shortDesc: "Sunscreen non-whitecast",
    description:
      "Sunscreen SPF50 PA++++ dengan tekstur gel ringan, cepat meresap, dan tidak meninggalkan whitecast.",
    rating: 4.7,
  },
  {
    id: "p4",
    slug: "purely-body-lotion",
    name: "Purely Body Lotion 250ml",
    price: 79000,
    image:
      "https://mcgrocer.com/cdn/shop/files/dove-purely-pampering-shea-butter-nourishing-lotion-250ml-41787198079214.jpg?v=1739189776",
    categoryId: "c3",
    brandId: "b4",
    shortDesc: "Lotion melembapkan seharian",
    description:
      "Body lotion dengan hyaluronic dan shea butter untuk kulit lembut dan lembap sepanjang hari.",
    rating: 4.6,
  },
  {
    id: "p5",
    slug: "glowree-gentle-cleanser",
    name: "Glowree Gentle Cleanser",
    price: 69000,
    image:
      "https://favo.id/cdn/shop/files/HSUWAJ1023_Hanasui-Glow-Expert-Gentle-Cleanser---60-gr.jpg?v=1757319997",
    categoryId: "c1",
    brandId: "b1",
    shortDesc: "Cleanser lembut pH-balanced",
    description:
      "Pembersih wajah pH seimbang yang membersihkan tanpa membuat kulit terasa kering atau tertarik.",
    rating: 4.8,
  },
  {
    id: "p6",
    slug: "veluxe-eyeshadow-palette",
    name: "Veluxe Eyeshadow Palette",
    price: 215000,
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTOu84uw6lQ2HfwUT2sgmQ-8T4NfD2DeH9rjQ&s",
    categoryId: "c2",
    brandId: "b2",
    shortDesc: "Palette 12 warna pigmented",
    description:
      "Eyeshadow palette dengan 12 warna highly pigmented untuk berbagai look makeup.",
    rating: 4.9,
  },
  {
    id: "p7",
    slug: "dermalab-moisturizer",
    name: "Derma Lab Moisturizer",
    price: 175000,
    image:
      "https://www.dermalab.com.sg/wp-content/uploads/2024/02/Ceramide-Repair-Cream_810x855.jpg",
    categoryId: "c1",
    brandId: "b3",
    shortDesc: "Pelembab harian ringan",
    description:
      "Moisturizer ringan dengan ceramide untuk menjaga skin barrier dan melembapkan kulit.",
    rating: 4.7,
  },
  {
    id: "p8",
    slug: "purely-hair-mask",
    name: "Purely Hair Mask",
    price: 89000,
    image:
      "https://cdn11.bigcommerce.com/s-ay2gdfjici/images/stencil/original/products/130/1948/purc-hair-mask-for-damaged-hair-treat0ment-6.76-fl-oz-200ml__90770.1619412789.jpg",
    categoryId: "c4",
    brandId: "b4",
    shortDesc: "Masker rambut nourishing",
    description:
      "Hair mask dengan argan oil untuk rambut lebih lembut, berkilau dan mudah diatur.",
    rating: 4.5,
  },
];


export function findProductBySlug(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function similarProducts(product: Product, limit = 4) {
  const pool = products.filter(
    (p) =>
      p.id !== product.id &&
      (p.categoryId === product.categoryId || p.brandId === product.brandId)
  );
  return pool.slice(0, limit);
}
