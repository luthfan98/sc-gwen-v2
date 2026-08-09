"use client";

import { create } from "zustand";

export type CartItem = {
  id: string; // product id
  name: string;
  price: number;
  image: string;
  slug: string;
  qty: number;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  remove: (id: string) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  clear: () => void;
  count: number;
  total: number;
  hydrate: () => void;
};

const STORAGE_KEY = "kosmetik-cart";

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  add: (item, qty = 1) => {
    const exists = get().items.find((i) => i.id === item.id);
    let next = [];
    if (exists) {
      next = get().items.map((i) => (i.id === item.id ? { ...i, qty: i.qty + qty } : i));
    } else {
      next = [...get().items, { ...item, qty }];
    }
    set({ items: next });
    persist(next);
  },
  remove: (id) => {
    const next = get().items.filter((i) => i.id !== id);
    set({ items: next });
    persist(next);
  },
  inc: (id) => {
    const next = get().items.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i));
    set({ items: next });
    persist(next);
  },
  dec: (id) => {
    const next = get().items
      .map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty - 1) } : i));
    set({ items: next });
    persist(next);
  },
  clear: () => {
    set({ items: [] });
    persist([]);
  },
  get count() {
    return get().items.reduce((a, b) => a + b.qty, 0);
  },
  get total() {
    return get().items.reduce((a, b) => a + b.price * b.qty, 0);
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) set({ items: JSON.parse(raw) });
    } catch {}
  },
}));

function persist(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
