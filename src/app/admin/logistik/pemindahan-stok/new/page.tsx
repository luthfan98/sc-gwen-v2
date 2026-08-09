"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Plus, Trash2, Send, Save } from "lucide-react";
import Swal from "sweetalert2";

type ItemRow = {
  id: string;
  kodeBarang: string;
  kodeBarangVariant: string;
  barcodeVarian: string;
  namaBarang: string;
  namaVarian: string;
  qtyStokBaik: number;
  qtyStokRusak: number;
  qtyPindahBaik: number;
  qtyPindahRusak: number;
  satuan: string;
};

type StockItem = {
  kode_barang_variant: string | null;
  kode_gudang: string | null;
  kode_toko: string | null;
  stok: number | null;
  qty_baik: number | null;
  qty_rusak: number | null;
  minimum_stok: number | null;
  status: number | null;
  is_show: number | null;
  nama_varian: string | null;
  kode_varian: string | null;
  barcode_varian: string | null;
  kode_barang: string | null;
  nama_barang: string | null;
  satuan_1: string | null;
  kode_merk: string | null;
  nama_merk: string | null;
};

export default function PemindahanStokNewPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().slice(0, 10));
  const [lokasiAsal, setLokasiAsal] = useState("");
  const [lokasiTujuan, setLokasiTujuan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [gudangOptions, setGudangOptions] = useState<{ kode_gudang: string; nama: string }[]>([]);
  const [tokoOptions, setTokoOptions] = useState<{ kode_toko: string; nama_toko: string }[]>([]);
  const [gudangLoading, setGudangLoading] = useState(false);
  const [tokoLoading, setTokoLoading] = useState(false);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Record<string, boolean>>({});
  const [merkOptions, setMerkOptions] = useState<{ id_merk: number; nama_merk: string }[]>([]);
  const [merkLoading, setMerkLoading] = useState(false);
  const [merkFilter, setMerkFilter] = useState<string>("ALL");
  const [stockSearch, setStockSearch] = useState("");

  const totalQtyBaik = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.qtyPindahBaik) || 0), 0),
    [rows]
  );
  const totalQtyRusak = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.qtyPindahRusak) || 0), 0),
    [rows]
  );
  const filteredStockItems = useMemo(() => stockItems, [stockItems]);
  const getQtyStokBaik = (item: StockItem) => {
    const stok = Number(item.stok ?? 0) || 0;
    const qtyBaik = Number(item.qty_baik ?? 0) || 0;
    if (lokasiAsalParsed.tipe === "TOKO") {
      return stok;
    }
    return item.qty_baik === null || typeof item.qty_baik === "undefined" ? stok : qtyBaik;
  };
  const getQtyStokRusak = (item: StockItem) => Number(item.qty_rusak ?? 0) || 0;
  const parseLokasi = (value: string) => {
    const [tipe, kode] = value.split("::");
    if (!tipe || !kode) return { tipe: "", kode: "" };
    return { tipe, kode };
  };
  const lokasiAsalParsed = useMemo(() => parseLokasi(lokasiAsal), [lokasiAsal]);
  const lokasiTujuanParsed = useMemo(() => parseLokasi(lokasiTujuan), [lokasiTujuan]);
  const allStockChecked = useMemo(() => {
    if (filteredStockItems.length === 0) return false;
    return filteredStockItems.every((item) => {
      const key = item.kode_barang_variant || item.barcode_varian || "";
      return key && selectedStock[key];
    });
  }, [filteredStockItems, selectedStock]);
  const lokasiAsalOptions = useMemo(
    () => [
      ...gudangOptions.map((item) => ({
        value: `GUDANG::${item.kode_gudang}`,
        label: `Gudang: ${item.nama} (${item.kode_gudang})`,
      })),
      ...tokoOptions.map((item) => ({
        value: `TOKO::${item.kode_toko}`,
        label: `Toko: ${item.nama_toko} (${item.kode_toko})`,
      })),
    ],
    [gudangOptions, tokoOptions]
  );
  const lokasiTujuanOptions = useMemo(
    () =>
      lokasiAsalOptions.filter(
        (item) =>
          !(lokasiAsalParsed.tipe && lokasiAsalParsed.kode) ||
          item.value !== `${lokasiAsalParsed.tipe}::${lokasiAsalParsed.kode}`
      ),
    [lokasiAsalOptions, lokasiAsalParsed.tipe, lokasiAsalParsed.kode]
  );

  useEffect(() => {
    const fetchGudang = async () => {
      setGudangLoading(true);
      try {
        const res = await fetch(`${API_BASE}/gudang`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options = (Array.isArray(data) ? data : [])
          .filter((item) => Number(item?.status) === 1)
          .map((item) => ({ kode_gudang: String(item.kode_gudang), nama: String(item.nama || item.kode_gudang) }));
        setGudangOptions(options);
      } catch (err) {
        console.error("Failed fetch gudang", err);
        setGudangOptions([]);
      } finally {
        setGudangLoading(false);
      }
    };
    fetchGudang();
  }, [API_BASE]);

  useEffect(() => {
    const fetchToko = async () => {
      setTokoLoading(true);
      try {
        const res = await fetch(`${API_BASE}/toko`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options = (Array.isArray(data) ? data : [])
          .filter((item) => Number(item?.status) === 1)
          .map((item) => ({ kode_toko: String(item.kode_toko), nama_toko: String(item.nama_toko || item.kode_toko) }));
        setTokoOptions(options);
      } catch (err) {
        console.error("Failed fetch toko", err);
        setTokoOptions([]);
      } finally {
        setTokoLoading(false);
      }
    };
    fetchToko();
  }, [API_BASE]);

  useEffect(() => {
    const fetchStock = async () => {
      if (!lokasiAsalParsed.tipe || !lokasiAsalParsed.kode) {
        setStockItems([]);
        setStockError(null);
        return;
      }
      setSelectedStock({});
      setStockLoading(true);
      setStockError(null);
      try {
        const params = new URLSearchParams({ page_size: "0", no_limit: "1" });
        if (stockSearch.trim()) params.set("q", stockSearch.trim());
        if (merkFilter !== "ALL") params.set("kode_merk", merkFilter);
        const endpoint =
          lokasiAsalParsed.tipe === "TOKO"
            ? `${API_BASE}/toko/${encodeURIComponent(lokasiAsalParsed.kode)}/stock?${params.toString()}`
            : `${API_BASE}/gudang/${encodeURIComponent(lokasiAsalParsed.kode)}/stock?${params.toString()}`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setStockItems(data);
        } else {
          setStockItems(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (err) {
        console.error("Failed fetch lokasi stock", err);
        setStockItems([]);
        setStockError("Gagal memuat stok lokasi asal.");
      } finally {
        setStockLoading(false);
      }
    };
    fetchStock();
  }, [API_BASE, lokasiAsalParsed.tipe, lokasiAsalParsed.kode, stockSearch, merkFilter]);

  useEffect(() => {
    const fetchMerk = async () => {
      setMerkLoading(true);
      try {
        const res = await fetch(`${API_BASE}/merk`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options = (Array.isArray(data) ? data : []).map((item) => ({
          id_merk: Number(item.id_merk),
          nama_merk: String(item.nama_merk || item.id_merk),
        }));
        setMerkOptions(options);
      } catch (err) {
        console.error("Failed fetch merk", err);
        setMerkOptions([]);
      } finally {
        setMerkLoading(false);
      }
    };
    fetchMerk();
  }, [API_BASE]);

  const updateRow = (id: string, patch: Partial<ItemRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleSave = () => {
    window.alert("Draft pemindahan disimpan (sementara belum terhubung API).");
  };

  const handleSubmit = async () => {
    if (!lokasiAsalParsed.tipe || !lokasiAsalParsed.kode) {
      window.alert("Pilih lokasi asal terlebih dahulu.");
      return;
    }
    if (!lokasiTujuanParsed.tipe || !lokasiTujuanParsed.kode) {
      window.alert("Pilih lokasi tujuan terlebih dahulu.");
      return;
    }
    if (lokasiAsalParsed.tipe === lokasiTujuanParsed.tipe && lokasiAsalParsed.kode === lokasiTujuanParsed.kode) {
      window.alert("Lokasi asal dan lokasi tujuan tidak boleh sama.");
      return;
    }
    if (rows.length === 0) {
      window.alert("Belum ada barang yang dipindahkan.");
      return;
    }
    const invalidQty = rows.find((row) => {
      const baik = Number(row.qtyPindahBaik || 0);
      const rusak = Number(row.qtyPindahRusak || 0);
      if (baik < 0 || rusak < 0) return true;
      if (baik > row.qtyStokBaik) return true;
      if (rusak > row.qtyStokRusak) return true;
      if (baik === 0 && rusak === 0) return true;
      return false;
    });
    if (invalidQty) {
      window.alert("Qty pemindahan harus valid dan tidak melebihi stok (baik/rusak).");
      return;
    }

    const confirm = await Swal.fire({
      icon: "question",
      title: "Buat pemindahan?",
      text: "Data pemindahan akan disimpan dan siap dicetak.",
      showCancelButton: true,
      confirmButtonText: "Ya, buat",
      cancelButtonText: "Batal",
      confirmButtonColor: "#16a34a",
    });
    if (!confirm.isConfirmed) return;

    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let createdBy = "Admin";
    if (rawSession) {
      try {
        const session = JSON.parse(rawSession);
        createdBy = session?.username || session?.name || createdBy;
      } catch {
        // ignore parse
      }
    }

    try {
      const res = await fetch(`${API_BASE}/pemindahan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tgl: tanggal,
          gudang_asal: lokasiAsalParsed.tipe === "GUDANG" ? lokasiAsalParsed.kode : undefined,
          lokasi_asal_tipe: lokasiAsalParsed.tipe,
          lokasi_asal_kode: lokasiAsalParsed.kode,
          tujuan_tipe: lokasiTujuanParsed.tipe,
          tujuan_kode: lokasiTujuanParsed.kode,
          catatan,
          created_by: createdBy,
          items: rows.map((row) => ({
            kode_barang: row.kodeBarang,
            kode_barang_variant: row.kodeBarangVariant,
            nama_barang: row.namaBarang,
            nama_varian: row.namaVarian,
            qty_baik_pindah: row.qtyPindahBaik,
            qty_rusak_pindah: row.qtyPindahRusak,
            satuan: row.satuan,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      const kodePemindahan = data?.kode_t_pemindahan || "";
      await Swal.fire({
        icon: "success",
        title: "Pemindahan dibuat",
        text: kodePemindahan ? `Kode: ${kodePemindahan}` : "Pemindahan berhasil dibuat.",
        showConfirmButton: false,
        timer: 1200,
        timerProgressBar: true,
      });
      setRows([]);
      if (kodePemindahan) {
        window.location.replace(`/admin/logistik/pemindahan-stok/print/${encodeURIComponent(kodePemindahan)}`);
      }
    } catch (err) {
      console.error("Failed create pemindahan", err);
      window.alert(err instanceof Error ? err.message : "Gagal membuat pemindahan.");
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    filteredStockItems.forEach((item) => {
      const key = item.kode_barang_variant || item.barcode_varian;
      if (key) {
        next[key] = checked;
      }
    });
    setSelectedStock(next);
  };

  const toggleSelectItem = (key: string, checked: boolean) => {
    setSelectedStock((prev) => ({ ...prev, [key]: checked }));
  };

  const handleAddSelected = () => {
    const nextRows: ItemRow[] = [];
    filteredStockItems.forEach((item, index) => {
      const key = item.kode_barang_variant || item.barcode_varian || "";
      if (!key || !selectedStock[key]) return;
      const qtyStokBaik = getQtyStokBaik(item);
      const qtyStokRusak = getQtyStokRusak(item);
      nextRows.push({
        id: `row-${Date.now()}-${index}`,
        kodeBarang: item.kode_barang || "",
        kodeBarangVariant: item.kode_barang_variant || "",
        barcodeVarian: item.barcode_varian || "",
        namaBarang: item.nama_barang || "",
        namaVarian: item.nama_varian || "",
        qtyStokBaik,
        qtyStokRusak,
        qtyPindahBaik: qtyStokBaik > 0 ? 1 : 0,
        qtyPindahRusak: 0,
        satuan: item.satuan_1 || "PCS",
      });
    });
    if (nextRows.length > 0) {
      setRows((prev) => [...prev, ...nextRows]);
    }
    setStockModalOpen(false);
    setSelectedStock({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fffb] via-white to-[#e5f7f3] p-4 md:p-6 space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Logistik</p>
            <h1 className="text-2xl font-bold text-gray-900">Pemindahan Stok</h1>
          </div>
        </div>
        <div className="w-full md:w-auto">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <p className="text-xs uppercase tracking-wide text-emerald-600">Total QTY Dipindah</p>
            <p className="text-xl font-semibold text-emerald-800">
              {totalQtyBaik} baik / {totalQtyRusak} rusak
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Informasi Pemindahan</h2>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <label className="space-y-1">
            <span className="text-gray-600">Tanggal</span>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Lokasi Asal</span>
            <select
              value={lokasiAsal}
              onChange={(e) => {
                const next = e.target.value;
                setLokasiAsal(next);
                setRows([]);
                setSelectedStock({});
                if (next && lokasiTujuan === next) {
                  setLokasiTujuan("");
                }
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">
                {gudangLoading || tokoLoading ? "Memuat lokasi..." : "Pilih gudang/toko asal"}
              </option>
              {lokasiAsalOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Lokasi Tujuan</span>
            <select
              value={lokasiTujuan}
              onChange={(e) => setLokasiTujuan(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">
                {gudangLoading || tokoLoading ? "Memuat tujuan..." : "Pilih gudang/toko tujuan"}
              </option>
              {lokasiTujuanOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-4">
            <span className="text-gray-600">Catatan</span>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan pemindahan..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 min-h-[90px]"
            />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Daftar Barang</h2>
            <button
              type="button"
              onClick={() => {
                if (!lokasiAsalParsed.tipe || !lokasiAsalParsed.kode) {
                  window.alert("Pilih lokasi asal terlebih dahulu.");
                  return;
                }
                setStockModalOpen(true);
                setStockSearch("");
              }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#16a34a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#15803d]"
          >
            <Plus className="w-4 h-4" />
            Tambah Barang
          </button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-1">No</th>
                <th className="px-4 py-1">Nama Barang</th>
                <th className="px-4 py-1">Nama Varian</th>
                <th className="px-4 py-1">Barcode</th>
                <th className="px-4 py-1">Qty Stok Baik</th>
                <th className="px-4 py-1">Qty Stok Rusak</th>
                <th className="px-4 py-1">Satuan</th>
                <th className="px-4 py-1">Qty Pindah Baik</th>
                <th className="px-4 py-1">Qty Pindah Rusak</th>
                <th className="px-4 py-1 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-1 text-gray-700">{idx + 1}</td>
                  <td className="px-4 py-1">
                    <input
                      value={row.namaBarang}
                      readOnly
                      className="w-full border border-gray-200 rounded px-2 py-1 bg-gray-50 text-gray-700"
                    />
                  </td>
                  <td className="px-4 py-1">
                    <input
                      value={row.namaVarian}
                      readOnly
                      className="w-full border border-gray-200 rounded px-2 py-1 bg-gray-50 text-gray-700"
                    />
                  </td>
                  <td className="px-4 py-1">
                    <input
                      value={row.barcodeVarian || "-"}
                      readOnly
                      className="w-36 border border-gray-200 rounded px-2 py-1 bg-gray-50 font-mono text-xs text-gray-700"
                    />
                  </td>
                  <td className="px-4 py-1">
                    <input
                      type="number"
                      min={0}
                      value={row.qtyStokBaik}
                      readOnly
                      className="w-24 border border-gray-200 rounded px-2 py-1 bg-gray-50 text-gray-700"
                    />
                  </td>
                  <td className="px-4 py-1">
                    <input
                      type="number"
                      min={0}
                      value={row.qtyStokRusak}
                      readOnly
                      className="w-24 border border-gray-200 rounded px-2 py-1 bg-gray-50 text-gray-700"
                    />
                  </td>
                  <td className="px-4 py-1">
                    <input
                      value={row.satuan}
                      readOnly
                      className="w-24 border border-gray-200 rounded px-2 py-1 bg-gray-50 text-gray-700"
                    />
                  </td>
                  <td className="px-4 py-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateRow(row.id, { qtyPindahBaik: row.qtyStokBaik || 0 })}
                        className="w-7 h-7 flex items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100"
                      >
                        F
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={row.qtyStokBaik}
                        value={row.qtyPindahBaik}
                        onChange={(e) => updateRow(row.id, { qtyPindahBaik: Number(e.target.value) || 0 })}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-28 border border-gray-200 rounded px-2 py-1"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-1">
                    <input
                      type="number"
                      min={0}
                      max={row.qtyStokRusak}
                      value={row.qtyPindahRusak}
                      onChange={(e) => updateRow(row.id, { qtyPindahRusak: Number(e.target.value) || 0 })}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-28 border border-gray-200 rounded px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="w-4 h-4" />
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    Belum ada barang yang dipindahkan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 justify-end">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Save className="w-4 h-4" />
          Simpan Draft
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="inline-flex items-center gap-2 rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803d]"
        >
          <Send className="w-4 h-4" />
          Buat Pemindahan
        </button>
      </div>

      {stockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !stockLoading && setStockModalOpen(false)}
          />
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pilih Barang</p>
                <h3 className="text-lg font-bold text-gray-900">
                  Stok {lokasiAsalParsed.tipe || "-"} {lokasiAsalParsed.kode || "-"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStockModalOpen(false)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allStockChecked}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  disabled={filteredStockItems.length === 0}
                />
                Pilih semua
              </label>
              <div className="flex items-center gap-3">
                <input
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  placeholder="Cari nama / barcode"
                  className="border border-gray-200 rounded-md px-2 py-1 text-sm"
                />
                <label className="text-gray-500">Filter merk</label>
                <select
                  value={merkFilter}
                  onChange={(e) => setMerkFilter(e.target.value)}
                  className="border border-gray-200 rounded-md px-2 py-1 text-sm bg-white"
                >
                  <option value="ALL">{merkLoading ? "Memuat merk..." : "Semua merk"}</option>
                  {merkOptions.map((item) => (
                    <option key={item.id_merk} value={String(item.id_merk)}>
                      {item.nama_merk}
                    </option>
                  ))}
                </select>
                <span className="text-gray-500">{filteredStockItems.length} item</span>
              </div>
            </div>

            <div className="overflow-auto max-h-[420px] border border-gray-100 rounded-xl">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">No</th>
                    <th className="px-4 py-3">Pilih</th>
                    <th className="px-4 py-3">Nama Barang</th>
                    <th className="px-4 py-3">Nama Varian</th>
                    <th className="px-4 py-3">Barcode</th>
                    <th className="px-4 py-3">Qty Baik</th>
                    <th className="px-4 py-3">Qty Rusak</th>
                    <th className="px-4 py-3">Satuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stockLoading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                        Memuat stok lokasi asal...
                      </td>
                    </tr>
                  )}
                  {!stockLoading && stockError && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-rose-600">
                        {stockError}
                      </td>
                    </tr>
                  )}
                  {!stockLoading && !stockError && filteredStockItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                        Tidak ada stok untuk filter ini.
                      </td>
                    </tr>
                  )}
                  {!stockLoading &&
                    !stockError &&
                    filteredStockItems.map((item, idx) => {
                      const key = item.kode_barang_variant || item.barcode_varian || `row-${idx}`;
                      return (
                        <tr key={key} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedStock[key])}
                              onChange={(e) => toggleSelectItem(key, e.target.checked)}
                            />
                          </td>
                          <td className="px-4 py-3 text-gray-900">{item.nama_barang || "-"}</td>
                          <td className="px-4 py-3 text-gray-700">{item.nama_varian || "-"}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{item.barcode_varian || "-"}</td>
                          <td className="px-4 py-3 text-gray-700">{getQtyStokBaik(item)}</td>
                          <td className="px-4 py-3 text-gray-700">{getQtyStokRusak(item)}</td>
                          <td className="px-4 py-3 text-gray-700">{item.satuan_1 || "PCS"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStockModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddSelected}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600"
                disabled={stockItems.length === 0}
              >
                Tambahkan ke list
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
