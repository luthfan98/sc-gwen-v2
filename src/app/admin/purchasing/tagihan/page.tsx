"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Filter, ReceiptText, Plus, Save } from "lucide-react";

type TagihanRow = {
  kode_t_tagihan: string;
  kode_t_pengadaan?: string | null;
  kode_t_rpo?: string | null;
  kode_lpb?: string | null;
  kode_supplier?: string | null;
  supplier_nama?: string | null;
  no_invoice?: string | null;
  no_faktur_supplier?: string | null;
  tgl?: string | null;
  tgl_jatuh_tempo?: string | null;
  total_tagihan?: number;
  total_dibayar?: number;
  is_lunas?: number | boolean | null;
  status_verifikasi?: number | boolean | null;
  verifikasi_by?: string | null;
  verifikasi_at?: string | null;
};

const formatIDR = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

export default function ListingTagihanPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [rows, setRows] = useState<TagihanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("semua");
  const [modalOpen, setModalOpen] = useState(false);
  const [poCode, setPoCode] = useState("");
  const [poOptions, setPoOptions] = useState<any[]>([]);
  const [poHeader, setPoHeader] = useState<any | null>(null);
  const [poItems, setPoItems] = useState<any[]>([]);
  const [form, setForm] = useState({
    no_invoice: "",
    no_faktur_supplier: "",
    tgl: new Date().toISOString().slice(0, 10),
    tgl_jatuh_tempo: "",
    catatan: "",
    diskon: "0",
    ppn: "0",
  });
  const [saving, setSaving] = useState(false);
  const [loadingPo, setLoadingPo] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    const fetchList = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/tagihan`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRows(
          Array.isArray(data)
            ? data.map((row: any) => ({
                kode_t_tagihan: row.kode_t_tagihan || "-",
                kode_t_pengadaan: row.kode_t_pengadaan || null,
                kode_t_rpo: row.kode_t_rpo || null,
                kode_lpb: row.kode_lpb || null,
                kode_supplier: row.kode_supplier || null,
                supplier_nama: row.supplier_nama || row.kode_supplier || "-",
                no_invoice: row.no_invoice || null,
                no_faktur_supplier: row.no_faktur_supplier || null,
                tgl: row.tgl ? String(row.tgl).slice(0, 10) : null,
                tgl_jatuh_tempo: row.tgl_jatuh_tempo ? String(row.tgl_jatuh_tempo).slice(0, 10) : null,
                total_tagihan: Number(row.total_tagihan ?? 0),
                total_dibayar: Number(row.total_dibayar ?? 0),
                is_lunas: row.is_lunas,
                status_verifikasi: row.status_verifikasi,
                verifikasi_by: row.verifikasi_by || null,
                verifikasi_at: row.verifikasi_at ? String(row.verifikasi_at).slice(0, 10) : null,
              }))
            : []
        );
      } catch (err) {
        console.error("Failed load tagihan list", err);
        setError("Gagal memuat daftar tagihan.");
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [API_BASE]);

  useEffect(() => {
    const fetchPoOptions = async () => {
      try {
        const res = await fetch(`${API_BASE}/pengadaan`);
        if (!res.ok) return;
        const data = await res.json();
        setPoOptions(Array.isArray(data) ? data : []);
      } catch {
        setPoOptions([]);
      }
    };
    fetchPoOptions();
  }, [API_BASE]);

  const resetModal = () => {
    setPoCode("");
    setPoHeader(null);
    setPoItems([]);
    setForm({
      no_invoice: "",
      no_faktur_supplier: "",
      tgl: new Date().toISOString().slice(0, 10),
      tgl_jatuh_tempo: "",
      catatan: "",
      diskon: "0",
      ppn: "0",
    });
    setModalError(null);
  };

  const openModal = () => {
    resetModal();
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const handleLoadPo = async () => {
    const kode = poCode.trim();
    if (!kode) {
      setModalError("Isi nomor PO terlebih dahulu.");
      return;
    }
    setLoadingPo(true);
    setModalError(null);
    try {
      const res = await fetch(`${API_BASE}/pengadaan/${encodeURIComponent(kode)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPoHeader(data?.header || null);
      const items = Array.isArray(data?.items) ? data.items : [];
      setPoItems(items);
      if (data?.header?.deadline) {
        setForm((prev) => ({ ...prev, tgl_jatuh_tempo: String(data.header.deadline).slice(0, 10) }));
      }
    } catch (err) {
      setModalError("Gagal memuat data PO.");
      setPoHeader(null);
      setPoItems([]);
    } finally {
      setLoadingPo(false);
    }
  };

  const subtotal = useMemo(() => {
    return poItems.reduce((sum, it) => sum + Number(it.subtotal ?? (it.qty || 0) * (it.harga_beli || 0)), 0);
  }, [poItems]);
  const diskon = Number(form.diskon || 0);
  const totalStlhDiskon = subtotal - diskon;
  const totalSblmPpn = totalStlhDiskon;
  const ppn = Number(form.ppn || 0);
  const totalTagihan = totalSblmPpn + ppn;

  const handleSave = async () => {
    if (!poHeader || poItems.length === 0) {
      setModalError("Data PO belum lengkap.");
      return;
    }
    if (!form.tgl) {
      setModalError("Tanggal tagihan wajib diisi.");
      return;
    }
    setSaving(true);
    setModalError(null);
    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let username = "Admin";
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        username = parsed?.username || parsed?.name || username;
      } catch {
        // ignore parse error
      }
    }
    try {
      const res = await fetch(`${API_BASE}/tagihan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_t_pengadaan: poHeader.kode_t_pengadaan,
          kode_t_rpo: poHeader.kode_t_rpo || null,
          kode_supplier: poHeader.kode_supplier || null,
          nama_supplier: poHeader.supplier_nama || null,
          no_invoice: form.no_invoice || null,
          no_faktur_supplier: form.no_faktur_supplier || null,
          tgl: form.tgl,
          tgl_jatuh_tempo: form.tgl_jatuh_tempo || null,
          catatan: form.catatan || null,
          subtotal,
          diskon,
          total_stlh_diskon: totalStlhDiskon,
          total_sblm_ppn: totalSblmPpn,
          ppn,
          total_tagihan: totalTagihan,
          items: poItems.map((it) => ({
            kode_d_pengadaan: it.kode_d_pengadaan || null,
            kode_barang_variant: it.kode_barang_variant || null,
            barcode_varian: it.barcode_varian || null,
            nama_barang: it.nama_barang || null,
            qty: Number(it.qty ?? 0),
            satuan: it.satuan || "PCS",
            harga_satuan: Number(it.harga_beli ?? 0),
            subtotal: Number(it.subtotal ?? (it.qty || 0) * (it.harga_beli || 0)),
            total: Number(it.subtotal ?? (it.qty || 0) * (it.harga_beli || 0)),
            diskon_total: 0,
            ppn_total: 0,
          })),
          created_by: username,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeModal();
      const fresh = await fetch(`${API_BASE}/tagihan`);
      if (fresh.ok) {
        const data = await fresh.json();
        setRows(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setModalError("Gagal menyimpan tagihan.");
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => {
    const totalTagihan = rows.reduce((sum, r) => sum + (Number(r.total_tagihan) || 0), 0);
    const totalDibayar = rows.reduce((sum, r) => sum + (Number(r.total_dibayar) || 0), 0);
    const lunasCount = rows.filter((r) => Boolean(r.is_lunas)).length;
    const belumCount = rows.length - lunasCount;
    return { totalTagihan, totalDibayar, lunasCount, belumCount };
  }, [rows]);

  const filtered = useMemo(() => {
    const key = search.toLowerCase();
    return rows.filter((r) => {
      const matchText =
        r.kode_t_tagihan.toLowerCase().includes(key) ||
        String(r.no_invoice || "").toLowerCase().includes(key) ||
        String(r.no_faktur_supplier || "").toLowerCase().includes(key) ||
        String(r.supplier_nama || "").toLowerCase().includes(key);
      const isLunas = Boolean(r.is_lunas);
      const matchStatus =
        statusFilter === "semua" ||
        (statusFilter === "lunas" && isLunas) ||
        (statusFilter === "belum" && !isLunas);
      return matchText && matchStatus;
    });
  }, [rows, search, statusFilter]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <p className="text-sm text-gray-500">Purchasing</p>
        <h1 className="text-2xl font-bold text-gray-900">Listing Tagihan</h1>
        <p className="text-sm text-gray-600 mt-1">Daftar tagihan supplier yang tersimpan.</p>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Tambah Tagihan
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Tagihan</p>
          <div className="flex items-end justify-between mt-2">
            <div>
              <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
              <p className="text-sm text-gray-600">Total dokumen</p>
            </div>
            <p className="text-lg font-semibold text-emerald-600">{formatIDR(summary.totalTagihan)}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Pembayaran</p>
          <div className="flex items-end justify-between mt-2">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {summary.lunasCount}/{summary.belumCount}
              </p>
              <p className="text-sm text-gray-600">Lunas / Belum</p>
            </div>
            <p className="text-lg font-semibold text-sky-600">{formatIDR(summary.totalDibayar)}</p>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Detail Tagihan</p>
                <h3 className="text-lg font-bold text-gray-900">Tambah Tagihan</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Tutup
              </button>
            </div>

            {modalError && <div className="mb-3 text-sm text-rose-600">{modalError}</div>}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="block text-sm text-gray-600">
                  No. PO
                  <div className="mt-1 flex gap-2">
                    <select
                      value={poCode}
                      onChange={(e) => setPoCode(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Pilih PO</option>
                      {poOptions.map((opt) => (
                        <option key={opt.kode_t_pengadaan} value={opt.kode_t_pengadaan}>
                          {opt.kode_t_pengadaan}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleLoadPo}
                      disabled={loadingPo}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {loadingPo ? "Memuat..." : "Load"}
                    </button>
                  </div>
                </label>
                <label className="block text-sm text-gray-600">
                  Supplier
                  <input
                    value={poHeader?.supplier_nama || poHeader?.kode_supplier || ""}
                    readOnly
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50"
                  />
                </label>
                <label className="block text-sm text-gray-600">
                  No. Tagihan
                  <input
                    value="(Auto)"
                    readOnly
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50"
                  />
                </label>
                <label className="block text-sm text-gray-600">
                  No. Faktur Supplier
                  <input
                    value={form.no_faktur_supplier}
                    onChange={(e) => setForm((prev) => ({ ...prev, no_faktur_supplier: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm text-gray-600">
                  Catatan
                  <textarea
                    value={form.catatan}
                    onChange={(e) => setForm((prev) => ({ ...prev, catatan: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    rows={3}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <label className="block text-sm text-gray-600">
                  No. Invoice
                  <input
                    value={form.no_invoice}
                    onChange={(e) => setForm((prev) => ({ ...prev, no_invoice: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm text-gray-600">
                  Tgl Ditagih
                  <input
                    type="date"
                    value={form.tgl}
                    onChange={(e) => setForm((prev) => ({ ...prev, tgl: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm text-gray-600">
                  Tgl Jatuh Tempo
                  <input
                    type="date"
                    value={form.tgl_jatuh_tempo}
                    onChange={(e) => setForm((prev) => ({ ...prev, tgl_jatuh_tempo: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm text-gray-600">
                    Diskon
                    <input
                      type="number"
                      value={form.diskon}
                      onChange={(e) => setForm((prev) => ({ ...prev, diskon: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-right"
                    />
                  </label>
                  <label className="block text-sm text-gray-600">
                    PPN
                    <input
                      type="number"
                      value={form.ppn}
                      onChange={(e) => setForm((prev) => ({ ...prev, ppn: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-right"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-500">Subtotal</p>
                    <p className="font-semibold text-gray-900">{formatIDR(subtotal)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-500">Total Tagihan</p>
                    <p className="font-semibold text-gray-900">{formatIDR(totalTagihan)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Nama Item</th>
                      <th className="px-3 py-2 text-right">Jumlah</th>
                      <th className="px-3 py-2">Satuan</th>
                      <th className="px-3 py-2 text-right">Harga</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {poItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-3 text-center text-gray-500">
                          Item PO belum dimuat.
                        </td>
                      </tr>
                    )}
                    {poItems.map((it, idx) => (
                      <tr key={`${it.kode_d_pengadaan || idx}`}>
                        <td className="px-3 py-2 text-gray-800">{it.nama_varian || it.nama_barang || "-"}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{it.qty}</td>
                        <td className="px-3 py-2 text-gray-700">{it.satuan || "PCS"}</td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {formatIDR(Number(it.harga_beli ?? 0))}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 font-semibold">
                          {formatIDR(Number(it.subtotal ?? (it.qty || 0) * (it.harga_beli || 0)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0f756b] text-white text-sm font-semibold hover:bg-[#0d6a62] disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor tagihan / invoice / supplier"
              className="w-full outline-none"
            />
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white text-sm outline-none w-full"
            >
              <option value="semua">Semua status</option>
              <option value="lunas">Lunas</option>
              <option value="belum">Belum lunas</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-3 w-12 text-center">No.</th>
                <th className="px-3 py-3">Kode</th>
                <th className="px-3 py-3">Supplier</th>
                <th className="px-3 py-3">No Invoice</th>
                <th className="px-3 py-3">No Faktur Supplier</th>
                <th className="px-3 py-3">Tanggal</th>
                <th className="px-3 py-3">Jatuh Tempo</th>
                <th className="px-3 py-3 text-right">Total Tagihan</th>
                <th className="px-3 py-3 text-right">Total Dibayar</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={11}>
                    Memuat data...
                  </td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-rose-600" colSpan={11}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={11}>
                    Tidak ada data tagihan.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filtered.map((r, idx) => {
                  const rowNum = filtered.length - idx;
                  const isLunas = Boolean(r.is_lunas);
                  const isVerified = Boolean(r.status_verifikasi) || Boolean(r.verifikasi_by);
                  return (
                    <tr key={r.kode_t_tagihan} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-center text-gray-700">{rowNum}</td>
                      <td className="px-3 py-3 font-semibold text-gray-900">{r.kode_t_tagihan}</td>
                      <td className="px-3 py-3 text-gray-800">{r.supplier_nama || "-"}</td>
                      <td className="px-3 py-3 text-gray-700">{r.no_invoice || "-"}</td>
                      <td className="px-3 py-3 text-gray-700">{r.no_faktur_supplier || "-"}</td>
                      <td className="px-3 py-3 text-gray-700">{r.tgl || "-"}</td>
                      <td className="px-3 py-3 text-gray-700">{r.tgl_jatuh_tempo || "-"}</td>
                      <td className="px-3 py-3 text-right text-gray-900 font-semibold">
                        {formatIDR(Number(r.total_tagihan ?? 0))}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-800">
                        {formatIDR(Number(r.total_dibayar ?? 0))}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                            isLunas
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          <ReceiptText className="w-3 h-3" />
                          {isLunas ? "LUNAS" : "BELUM"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-700">
                        {isVerified ? `Terverifikasi${r.verifikasi_by ? ` (${r.verifikasi_by})` : ""}` : "Belum"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
