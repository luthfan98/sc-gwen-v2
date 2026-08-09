"use client";

import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { Filter, RefreshCw, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";

type MutasiRow = {
  kode_h_stok_barang: string;
  kode_ref_transaksi: string | null;
  tgl_transaksi: string | null;
  ket_transaksi: string | null;
  kode_barang_variant: string | null;
  barcode_varian: string | null;
  nama_barang: string | null;
  nama_varian: string | null;
  qty_masuk: number | null;
  qty_keluar: number | null;
  stok_awal_satuan_1: number | null;
  stok_akhir_satuan_1: number | null;
  satuan: string | null;
  kode_gudang: string | null;
  nama_gudang: string | null;
  created_by: string | null;
};

type GudangOption = { kode_gudang: string; nama: string };
type TokoOption = { kode_toko: string; nama_toko: string };
type BarangOption = { id_barang: number; kode_barang: string; nama_barang: string };
type VarianOption = { id_barang: number; kode_barang_variant: string; nama_varian: string; barcode_varian: string | null };

const getTodayStr = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getPastDateStr = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function MutasiBarangPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const searchParams = useSearchParams();
  const isEditMode = searchParams?.get("edit") === "true";
  const [items, setItems] = useState<MutasiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [gudangOptions, setGudangOptions] = useState<GudangOption[]>([]);
  const [tokoOptions, setTokoOptions] = useState<TokoOption[]>([]);
  const [barangOptions, setBarangOptions] = useState<BarangOption[]>([]);
  const [varianOptions, setVarianOptions] = useState<VarianOption[]>([]);
  const [gudangFilter, setGudangFilter] = useState<string>("ALL");
  const [tipeFilter, setTipeFilter] = useState<string>("ALL");
  const [selectedBarang, setSelectedBarang] = useState<{ value: number; label: string } | null>(null);
  const [selectedVarian, setSelectedVarian] = useState<{ value: string; label: string } | null>(null);
  const [keyword, setKeyword] = useState("");
  const [kodeRef, setKodeRef] = useState("");
  const [dateFrom, setDateFrom] = useState(() => getPastDateStr(30));
  const [dateTo, setDateTo] = useState(() => getTodayStr());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [fixing, setFixing] = useState(false);
  const [savingRow, setSavingRow] = useState<Record<string, boolean>>({});

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const rangeStart = total ? (safePage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(safePage * pageSize, total);

  useEffect(() => {
    const fetchGudang = async () => {
      try {
        const res = await fetch(`${API_BASE}/gudang`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options = (Array.isArray(data) ? data : [])
          .filter((item) => Number(item?.status) === 1)
          .map((item) => ({ kode_gudang: String(item.kode_gudang), nama: String(item.nama || item.kode_gudang) }));
        setGudangOptions(options);
      } catch {
        setGudangOptions([]);
      }
    };
    const fetchToko = async () => {
      try {
        const res = await fetch(`${API_BASE}/toko`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options = (Array.isArray(data) ? data : [])
          .filter((item) => Number(item?.status) === 1)
          .map((item) => ({
            kode_toko: String(item.kode_toko),
            nama_toko: String(item.nama_toko || item.kode_toko),
          }));
        setTokoOptions(options);
      } catch {
        setTokoOptions([]);
      }
    };
    fetchGudang();
    fetchToko();
  }, [API_BASE]);

  const lokasiOptions = useMemo(
    () => [
      ...gudangOptions.map((g) => ({
        value: g.kode_gudang,
        label: `Gudang: ${g.nama} (${g.kode_gudang})`,
      })),
      ...tokoOptions.map((t) => ({
        value: t.kode_toko,
        label: `Toko: ${t.nama_toko} (${t.kode_toko})`,
      })),
    ],
    [gudangOptions, tokoOptions]
  );

  useEffect(() => {
    const fetchBarangVarian = async () => {
      try {
        const res = await fetch(`${API_BASE}/barang/varian`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list: VarianOption[] = (Array.isArray(data) ? data : []).map((row: any) => ({
          id_barang: Number(row.id_barang || 0),
          kode_barang_variant: String(row.kode_barang_variant || ""),
          nama_varian: String(row.nama_varian || ""),
          barcode_varian: row.barcode_varian ? String(row.barcode_varian) : null,
        }));
        setVarianOptions(list);

        const barangMap = new Map<number, BarangOption>();
        (Array.isArray(data) ? data : []).forEach((row: any) => {
          const id = Number(row.id_barang || 0);
          if (!id) return;
          if (!barangMap.has(id)) {
            barangMap.set(id, {
              id_barang: id,
              kode_barang: String(row.kode_barang || ""),
              nama_barang: String(row.nama_barang || ""),
            });
          }
        });
        setBarangOptions(Array.from(barangMap.values()));
      } catch {
        setBarangOptions([]);
        setVarianOptions([]);
      }
    };
    fetchBarangVarian();
  }, [API_BASE]);

  const fetchData = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        page_size: String(pageSize),
      });
      if (keyword.trim()) params.set("q", keyword.trim());
      if (kodeRef.trim()) params.set("kode_ref", kodeRef.trim());
      if (gudangFilter !== "ALL") params.set("kode_gudang", gudangFilter);
      if (tipeFilter !== "ALL") params.set("tipe", tipeFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (selectedBarang?.value) params.set("id_barang", String(selectedBarang.value));
      if (selectedVarian?.value) params.set("kode_barang_variant", selectedVarian.value);
      const res = await fetch(`${API_BASE}/mutasi-barang?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total ?? 0));
    } catch (err) {
      console.error("Failed fetch mutasi barang", err);
      setItems([]);
      setTotal(0);
      setError("Gagal memuat mutasi barang.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasSearched) return;
    fetchData(safePage);
  }, [page, pageSize, keyword, kodeRef, gudangFilter, tipeFilter, dateFrom, dateTo, selectedBarang, selectedVarian, hasSearched]);

  useEffect(() => {
    setPage(1);
  }, [keyword, kodeRef, gudangFilter, tipeFilter, dateFrom, dateTo, pageSize, selectedBarang, selectedVarian]);

  const fmtDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("id-ID");
  };

  const fmtNum = (value?: number | null) => {
    if (value === null || value === undefined) return "-";
    return Number(value).toLocaleString("id-ID");
  };

  const rows = useMemo(() => items, [items]);

  const applyFilters = () => {
    setHasSearched(true);
    setPage(1);
    fetchData(1);
  };

  const saveQty = async (kode: string, qtyMasuk: number | null, qtyKeluar: number | null) => {
    if (!kode) return;
    setSavingRow((prev) => ({ ...prev, [kode]: true }));
    try {
      const res = await fetch(`${API_BASE}/mutasi-barang/${encodeURIComponent(kode)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qty_masuk: qtyMasuk ?? 0,
          qty_keluar: qtyKeluar ?? 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      alert(err?.message || "Gagal update qty mutasi.");
    } finally {
      setSavingRow((prev) => ({ ...prev, [kode]: false }));
    }
  };

  const handleFixMutasi = async () => {
    if (rows.length === 0) return;
    const confirm = window.confirm("Perbaiki mutasi untuk data yang sedang tampil?");
    if (!confirm) return;
    setFixing(true);
    try {
      const res = await fetch(`${API_BASE}/mutasi-barang/recalc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: rows.map((r) => r.kode_h_stok_barang) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      await fetchData(safePage);
      alert("Mutasi berhasil diperbaiki.");
    } catch (err: any) {
      alert(err?.message || "Gagal memperbaiki mutasi.");
    } finally {
      setFixing(false);
    }
  };

  const barangSelectOptions = useMemo(
    () =>
      barangOptions.map((b) => ({
        value: b.id_barang,
        label: `${b.nama_barang || "-"}${b.kode_barang ? ` (${b.kode_barang})` : ""}`,
      })),
    [barangOptions]
  );

  const varianSelectOptions = useMemo(() => {
    if (!selectedBarang?.value) return [];
    return varianOptions
      .filter((v) => v.id_barang === selectedBarang.value)
      .map((v) => ({
        value: v.kode_barang_variant,
        label: `${v.nama_varian || "-"}${v.barcode_varian ? ` (${v.barcode_varian})` : ""}`,
      }));
  }, [varianOptions, selectedBarang]);

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      minHeight: "40px",
      borderRadius: "0.75rem",
      borderColor: "#e5e7eb",
      boxShadow: "none",
      fontSize: "0.875rem",
    }),
    menu: (base: any) => ({ ...base, zIndex: 50 }),
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500">Transaksi</p>
          <h1 className="text-2xl font-bold text-gray-900">Mutasi Barang</h1>
        </div>
        <button
          type="button"
          onClick={applyFilters}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold shadow-sm hover:bg-gray-50 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
        {isEditMode && (
          <button
            type="button"
            onClick={handleFixMutasi}
            disabled={fixing || rows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 font-semibold shadow-sm hover:bg-amber-100 transition-all disabled:opacity-60"
          >
            {fixing ? "Memperbaiki..." : "Perbaiki Mutasi"}
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 text-sm text-gray-600 font-semibold">
          <Filter className="w-4 h-4" />
          Filter
        </div>
        <div className="px-4 py-4 grid gap-3 md:grid-cols-6 text-sm">
          <label className="md:col-span-2 space-y-1">
            <span className="text-xs text-gray-500">Barang</span>
            <Select
              instanceId="barang-select"
              value={selectedBarang}
              onChange={(opt) => {
                setSelectedBarang(opt as any);
                setSelectedVarian(null);
              }}
              options={barangSelectOptions}
              styles={selectStyles}
              placeholder="Pilih barang"
              isClearable
            />
          </label>
          <label className="md:col-span-2 space-y-1">
            <span className="text-xs text-gray-500">Varian</span>
            <Select
              instanceId="varian-select"
              value={selectedVarian}
              onChange={(opt) => setSelectedVarian(opt as any)}
              options={varianSelectOptions}
              styles={selectStyles}
              placeholder={selectedBarang ? "Pilih varian" : "Pilih barang dulu"}
              isDisabled={!selectedBarang}
              isClearable
            />
          </label>
          <label className="md:col-span-2 space-y-1">
            <span className="text-xs text-gray-500">Cari barang / varian / barcode</span>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 bg-white">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Cari..."
                className="w-full bg-transparent outline-none"
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Kode Ref</span>
            <input
              value={kodeRef}
              onChange={(e) => setKodeRef(e.target.value)}
              placeholder="TPM/TPR/PEN/..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Gudang / Toko</span>
            <select
              value={gudangFilter}
              onChange={(e) => setGudangFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 bg-white"
            >
              <option value="ALL">Semua Lokasi</option>
              {lokasiOptions.map((loc) => (
                <option key={loc.value} value={loc.value}>
                  {loc.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Tipe</span>
            <select
              value={tipeFilter}
              onChange={(e) => setTipeFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 bg-white"
            >
              <option value="ALL">Semua</option>
              <option value="MASUK">Masuk</option>
              <option value="KELUAR">Keluar</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Dari Tanggal</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">Sampai Tanggal</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={applyFilters}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
        <div className="px-4 pb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
          <div>
            {hasSearched ? (
              <>Menampilkan {rangeStart} - {rangeEnd} dari {total} data</>
            ) : (
              <>Gunakan filter lalu klik Terapkan.</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>Per halaman</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border border-gray-200 px-2 py-1 text-sm"
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
              className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Prev
            </button>
            <span>
              Hal {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
              className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {error && (
          <div className="bg-rose-50 border-b border-rose-100 text-rose-700 text-sm px-4 py-3">{error}</div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Kode History</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Gudang</th>
                <th className="px-4 py-3">Kode Ref</th>
                <th className="px-4 py-3">Barang</th>
                <th className="px-4 py-3">Varian</th>
                <th className="px-4 py-3">Barcode</th>
                <th className="px-4 py-3 text-right">Masuk</th>
                <th className="px-4 py-3 text-right">Keluar</th>
                <th className="px-4 py-3 text-right">Stok Awal (Satuan 1)</th>
                <th className="px-4 py-3 text-right">Stok Akhir (Satuan 1)</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && hasSearched && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                    Belum ada data mutasi.
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && !hasSearched && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                    Gunakan filter lalu klik Terapkan untuk menampilkan data.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.kode_h_stok_barang} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{row.kode_h_stok_barang}</td>
                    <td className="px-4 py-2">{fmtDate(row.tgl_transaksi)}</td>
                    <td className="px-4 py-2">
                      {row.nama_gudang || row.kode_gudang || "-"}
                    </td>
                    <td className="px-4 py-2">{row.kode_ref_transaksi || "-"}</td>
                    <td className="px-4 py-2 font-semibold text-gray-900">{row.nama_barang || "-"}</td>
                    <td className="px-4 py-2 text-gray-700">{row.nama_varian || "-"}</td>
                    <td className="px-4 py-2 text-gray-600">{row.barcode_varian || "-"}</td>
                    <td className="px-4 py-2 text-right bg-emerald-50 text-emerald-700 font-semibold">
                      {isEditMode ? (
                        <input
                          type="number"
                          min={0}
                          value={Number(row.qty_masuk ?? 0)}
                          onChange={(e) => {
                            const next = Number(e.target.value || 0);
                            setItems((prev) =>
                              prev.map((it) =>
                                it.kode_h_stok_barang === row.kode_h_stok_barang
                                  ? { ...it, qty_masuk: next }
                                  : it
                              )
                            );
                          }}
                          onBlur={() => saveQty(row.kode_h_stok_barang, row.qty_masuk, row.qty_keluar)}
                          className="w-24 rounded-md border border-emerald-200 bg-white px-2 py-1 text-right text-xs text-emerald-700"
                        />
                      ) : (
                        fmtNum(row.qty_masuk)
                      )}
                    </td>
                    <td className="px-4 py-2 text-right bg-rose-50 text-rose-700 font-semibold">
                      {isEditMode ? (
                        <input
                          type="number"
                          min={0}
                          value={Number(row.qty_keluar ?? 0)}
                          onChange={(e) => {
                            const next = Number(e.target.value || 0);
                            setItems((prev) =>
                              prev.map((it) =>
                                it.kode_h_stok_barang === row.kode_h_stok_barang
                                  ? { ...it, qty_keluar: next }
                                  : it
                              )
                            );
                          }}
                          onBlur={() => saveQty(row.kode_h_stok_barang, row.qty_masuk, row.qty_keluar)}
                          className="w-24 rounded-md border border-rose-200 bg-white px-2 py-1 text-right text-xs text-rose-700"
                        />
                      ) : (
                        fmtNum(row.qty_keluar)
                      )}
                    </td>
                    <td className="px-4 py-2 text-right bg-sky-50 text-sky-700 font-semibold">
                      {fmtNum(row.stok_awal_satuan_1)}
                    </td>
                    <td className="px-4 py-2 text-right bg-sky-50 text-sky-700 font-semibold">
                      {fmtNum(row.stok_akhir_satuan_1)}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{row.ket_transaksi || "-"}</td>
                    <td className="px-4 py-2 text-gray-600">{row.created_by || "-"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
