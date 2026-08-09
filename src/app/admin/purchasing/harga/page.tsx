"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Save, Search, RefreshCw } from "lucide-react";

type Barang = {
  id_barang: number;
  kode_barang: string;
  nama: string;
  supplier?: string;
  nama_supplier?: string;
  kode_supplier?: string;
  nama_merk?: string;
  kode_merk?: string;
  variants?: {
    nama?: string;
    kode?: string;
    harga_beli_sat_1?: number | null;
    het_sat_1?: number | null;
  }[];
  harga_beli_sat_1?: number | null;
  het_sat_1?: number | null;
};

type Row = {
  id: string;
  kodeBarang: string;
  kodeBarangVariant: string;
  kodeVarian: string;
  nama: string;
  variant: string;
  supplier: string;
  hargaBeli: number | null;
  hargaHET: number | null;
  originalHargaBeli: number | null;
  originalHargaHET: number | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const parseNumberInput = (val: string | number): number | null => {
  if (typeof val === "number") return val;
  const cleaned = val.replace(/\./g, "").replace(/,/g, ".");
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
};

const formatNumberInput = (val: number | null | undefined) => {
  if (val === null || val === undefined || Number.isNaN(val)) return "";
  return val.toLocaleString("id-ID");
};

const formatIDR = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

export default function HargaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [lastResult, setLastResult] = useState<{ updated?: number; notFound?: number } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [merkOptions, setMerkOptions] = useState<{ label: string; value: string }[]>([]);
  const [merkFilter, setMerkFilter] = useState<string>("");

  const loadMerk = async () => {
    try {
      const res = await fetch(`${API_BASE}/merk`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const opts = Array.isArray(data)
        ? data
            .map((m: any) => ({
              label: m.nama_merk || m.nama || m.kode_merk || "-",
              value: m.kode_merk || String(m.id_merk || "") || m.nama_merk || "",
            }))
            .filter((m: any) => m.value)
        : [];
      setMerkOptions(opts);
    } catch (err) {
      console.error("Failed load merk", err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/barang`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Barang[] = await res.json();
      const flattened: Row[] = [];
      data.forEach((b) => {
        const supplier = (b as any).nama_supplier || (b as any).kode_supplier || b.supplier || "-";
        const merk = b.nama_merk || (b as any).merk || "";
        const kodeMerk = b.kode_merk || (b as any).kodeMerk || "";
        const matchMerk = !merkFilter || kodeMerk === merkFilter || merk === merkFilter;
        if (!matchMerk) return;
        if (Array.isArray(b.variants) && b.variants.length > 0) {
          b.variants.forEach((v, idx) => {
            const kodeVar = v.kode_barang_variant || v.kode || v.kode_varian || `VAR-${idx}`;
            flattened.push({
              id: v.kode_barang_variant || `${b.kode_barang}-${kodeVar}`,
              kodeBarang: b.kode_barang,
              kodeBarangVariant: v.kode_barang_variant || "",
              kodeVarian: kodeVar || "BASE",
              nama: b.nama || "",
              variant: v.nama || b.nama || "",
              supplier,
              merk,
              hargaBeli: v.harga_beli_sat_1 ?? null,
              hargaHET: v.het_sat_1 ?? null,
              originalHargaBeli: v.harga_beli_sat_1 ?? null,
              originalHargaHET: v.het_sat_1 ?? null,
            });
          });
        } else {
          flattened.push({
            id: `${b.kode_barang}-BASE`,
            kodeBarang: b.kode_barang,
            kodeBarangVariant: "",
            kodeVarian: "BASE",
            nama: b.nama || "",
            variant: b.nama || "",
            supplier,
            merk,
            hargaBeli: b.harga_beli_sat_1 ?? null,
            hargaHET: b.het_sat_1 ?? null,
            originalHargaBeli: b.harga_beli_sat_1 ?? null,
            originalHargaHET: b.het_sat_1 ?? null,
          });
        }
      });
      setRows(flattened);
    } catch (err) {
      console.error("Failed load barang", err);
      setError("Gagal memuat data barang");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMerk();
  }, []);

  const filteredRows = useMemo(() => {
    const key = search.toLowerCase();
    const sorted = [...rows].sort((a, b) =>
      sortDir === "asc"
        ? a.variant.localeCompare(b.variant, "id")
        : b.variant.localeCompare(a.variant, "id")
    );
    if (!key) return sorted;
    return sorted.filter((r) => `${r.nama} ${r.variant} ${r.supplier}`.toLowerCase().includes(key));
  }, [rows, search, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, sortDir]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  useEffect(() => {
    setLastResult(null);
  }, [merkFilter]);

  const dirtyCount = useMemo(
    () =>
      rows.filter(
        (r) => r.hargaBeli !== r.originalHargaBeli || r.hargaHET !== r.originalHargaHET
      ).length,
    [rows]
  );

  const updateRow = (id: string, field: "hargaBeli" | "hargaHET", value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const num = parseNumberInput(value);
        return { ...r, [field]: num };
      })
    );
  };

  const handleSave = async () => {
    setLastResult(null);
    const payload = rows
      .filter((r) => r.hargaBeli !== r.originalHargaBeli || r.hargaHET !== r.originalHargaHET)
      .map((r) => ({
        kode_barang: r.kodeBarang,
        kode_barang_variant: r.kodeBarangVariant,
        kode_varian: r.kodeVarian,
        harga_beli: r.hargaBeli ?? 0,
        het: r.hargaHET ?? 0,
      }));
    if (payload.length === 0) {
      alert("Tidak ada perubahan harga.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/barang/prices`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload, updated_by: "Admin" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setLastResult({ updated: result.updated_count, notFound: result.not_found?.length || 0 });
      setRows((prev) =>
        prev.map((r) => {
          const updated = payload.find(
            (p) => p.kode_barang_variant === r.kodeBarangVariant || (p.kode_barang === r.kodeBarang && (p.kode_varian || "BASE") === r.kodeVarian)
          );
          if (!updated) return r;
          return {
            ...r,
            hargaBeli: updated.harga_beli,
            hargaHET: updated.het,
            originalHargaBeli: updated.harga_beli,
            originalHargaHET: updated.het,
          };
        })
      );
      await loadData();
    } catch (err) {
      console.error("Failed save prices", err);
      alert("Gagal menyimpan harga. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Purchasing</p>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Edit Harga Beli & HET</h1>
          <p className="text-sm text-gray-600">Fokus mengubah harga beli dan HET tanpa mengubah data lain. Pilih merk lalu muat data.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-sm"
          >
            <ArrowDownUp className="w-4 h-4" />
            {sortDir === "asc" ? "Urut A-Z" : "Urut Z-A"}
          </button>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Muat Ulang
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || dirtyCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold shadow hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Menyimpan..." : `Simpan Perubahan (${dirtyCount})`}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama barang/varian/supplier"
              className="w-full outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={merkFilter}
              onChange={(e) => setMerkFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Pilih Merk (kosongkan untuk semua)</option>
              {merkOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Muat Data
            </button>
          </div>
          <div className="text-sm text-gray-600">
            {loading ? "Memuat..." : `${filteredRows.length} item ditampilkan`}
            {lastResult && (
              <span className="ml-2 text-xs text-gray-500">
                Disimpan: {lastResult.updated ?? 0}, Tidak ditemukan: {lastResult.notFound ?? 0}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50"
            >
              Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left w-12">No</th>
                <th className="px-3 py-2 text-left">Nama Barang / Varian</th>
                <th className="px-3 py-2 text-left w-40">Supplier</th>
                <th className="px-3 py-2 text-right w-40">Harga Beli</th>
                <th className="px-3 py-2 text-right w-40">HET</th>
                <th className="px-3 py-2 text-right w-32">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedRows.map((row, idx) => {
                const isDirty = row.hargaBeli !== row.originalHargaBeli || row.hargaHET !== row.originalHargaHET;
                return (
                  <tr key={row.id} className={isDirty ? "bg-amber-50" : ""}>
                    <td className="px-3 py-2 text-gray-700">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-gray-900">{row.variant}</div>
                      <div className="text-xs text-gray-500">{row.nama}</div>
                      <div className="text-[11px] text-gray-400">{row.kodeBarang} / {row.kodeVarian}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{row.supplier || "-"}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-gray-500">Rp</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatNumberInput(row.hargaBeli)}
                          onChange={(e) => updateRow(row.id, "hargaBeli", e.target.value)}
                          className="w-full max-w-[140px] text-right border border-gray-200 rounded px-2 py-1 bg-white"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-gray-500">Rp</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatNumberInput(row.hargaHET)}
                          onChange={(e) => updateRow(row.id, "hargaHET", e.target.value)}
                          className="w-full max-w-[140px] text-right border border-gray-200 rounded px-2 py-1 bg-white"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-600">
                      {isDirty ? "Belum disimpan" : "Tersimpan"}
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={6}>
                    Tidak ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
