"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, ShieldCheck, Users } from "lucide-react";

type Customer = {
  id_customer: string | number;
  nama: string;
  no_ktp: string;
  no_hp: string;
  alamat: string;
  foto_url?: string | null;
};

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "/api"}/customers`;

export default function MasterCustomerPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = (Array.isArray(data) ? data : []).map((row: any, idx: number) => ({
          id_customer: row.id_customer ?? row.id ?? row.customer_id ?? `${idx}`,
          nama: String(row.nama ?? row.name ?? row.customer_name ?? "-"),
          no_ktp: String(row.no_ktp ?? row.ktp ?? row.no_ktp_customer ?? ""),
          no_hp: String(row.no_hp ?? row.hp ?? row.telepon ?? row.telp ?? row.customer_phone ?? ""),
          alamat: String(row.alamat ?? row.address ?? row.alamat_customer ?? ""),
          foto_url: row.foto_url ?? row.photo_url ?? row.foto ?? null,
        }));
        setItems(list);
      } catch (err) {
        console.error("Failed fetch customers", err);
        setItems([]);
        setError("Gagal memuat customer dari server.");
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const totalLabel = useMemo(() => {
    if (loading) return "Memuat customer...";
    return `Total ${items.length} customer`;
  }, [loading, items.length]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Master Data</p>
          <h1 className="text-2xl font-bold text-gray-900">Master Customer</h1>
        </div>
        <Link
          href="/admin/master/customer/new"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Tambah Customer (Tab Baru)
        </Link>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Daftar Customer</p>
              <p className="text-base font-semibold text-gray-800">{totalLabel}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="w-4 h-4" />
            Data server
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 text-sm text-rose-600 border-b border-rose-100 bg-rose-50">
            {error}
          </div>
        )}

        <div className="overflow-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-3">Foto</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">No KTP</th>
                <th className="px-4 py-3">No HP</th>
                <th className="px-4 py-3">Alamat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Tidak ada data customer.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((cust) => (
                  <tr key={cust.id_customer} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {cust.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cust.foto_url}
                          alt={cust.nama}
                          className="w-12 h-12 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-100 border border-dashed border-gray-200 text-[10px] text-gray-400 flex items-center justify-center">
                          No Foto
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{cust.nama}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800">{cust.no_ktp || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800">{cust.no_hp || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800 max-w-sm">{cust.alamat || "-"}</div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
