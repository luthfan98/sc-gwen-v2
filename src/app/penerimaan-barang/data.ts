export type POStatus = "Selesai" | "Belum";

export type POItem = {
  sku: string;
  name: string;
  qtyOrdered: number;
  qtyReceived: number;
  unit: string;
};

export type PO = {
  id: string;
  supplier: string;
  date: string;
  status: POStatus;
  totalItems: number;
  totalQty: number;
  items: POItem[];
};

export const poList: PO[] = [
  {
    id: "PO-2025-0012",
    supplier: "PT Glow Supplier",
    date: "2025-12-01",
    status: "Selesai",
    totalItems: 3,
    totalQty: 24,
    items: [
      { sku: "SKU-GLW-01", name: "Glowree Bright Serum 30ml", qtyOrdered: 12, qtyReceived: 12, unit: "pcs" },
      { sku: "SKU-LIP-02", name: "Veluxe Lip Matte #Rose", qtyOrdered: 6, qtyReceived: 6, unit: "pcs" },
      { sku: "SKU-SS-04", name: "UV Shield Sunscreen SPF50", qtyOrdered: 6, qtyReceived: 6, unit: "pcs" },
    ],
  },
  {
    id: "PO-2025-0013",
    supplier: "Natura Distribusi",
    date: "2025-12-03",
    status: "Belum",
    totalItems: 2,
    totalQty: 30,
    items: [
      { sku: "SKU-TNR-03", name: "Hydra Mist Toner 100ml", qtyOrdered: 20, qtyReceived: 0, unit: "pcs" },
      { sku: "SKU-CLN-05", name: "Hydra Gel Cleanser", qtyOrdered: 10, qtyReceived: 0, unit: "pcs" },
    ],
  },
  {
    id: "PO-2025-0014",
    supplier: "BeautyHub Indonesia",
    date: "2025-12-05",
    status: "Belum",
    totalItems: 4,
    totalQty: 40,
    items: [
      { sku: "SKU-MSK-11", name: "Soothing Sheet Mask", qtyOrdered: 15, qtyReceived: 5, unit: "pcs" },
      { sku: "SKU-SCR-08", name: "Gentle Face Scrub", qtyOrdered: 10, qtyReceived: 0, unit: "pcs" },
      { sku: "SKU-CRM-09", name: "Nourish Night Cream 20g", qtyOrdered: 8, qtyReceived: 0, unit: "pcs" },
      { sku: "SKU-SPR-07", name: "Hydra Fresh Face Spray", qtyOrdered: 7, qtyReceived: 0, unit: "pcs" },
    ],
  },
  {
    id: "PO-2025-0015",
    supplier: "PT Shine Logistik",
    date: "2025-12-07",
    status: "Selesai",
    totalItems: 2,
    totalQty: 18,
    items: [
      { sku: "SKU-PRM-15", name: "Prime Skin Primer", qtyOrdered: 10, qtyReceived: 10, unit: "pcs" },
      { sku: "SKU-MST-21", name: "Deep Moist Serum", qtyOrdered: 8, qtyReceived: 8, unit: "pcs" },
    ],
  },
];
