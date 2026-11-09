"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Filter,
  ReceiptText,
  Plus,
  Save,
  CreditCard,
  History,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
} from "lucide-react";

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

  // Tambah Tagihan Modal state
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

  // Pelunasan Modal state
  const [pelunasanModalOpen, setPelunasanModalOpen] = useState(false);
  const [selectedTagihan, setSelectedTagihan] = useState<TagihanRow | null>(null);
  const [sumberBayar, setSumberBayar] = useState("DEPOSIT_RETUR");
  const [nominalBayar, setNominalBayar] = useState("");
  const [tglBayar, setTglBayar] = useState(new Date().toISOString().slice(0, 10));
  const [bankBayar, setBankBayar] = useState("");
  const [noRefBayar, setNoRefBayar] = useState("");
  const [catatanBayar, setCatatanBayar] = useState("");
  const [saldoDeposit, setSaldoDeposit] = useState<number | null>(null);
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [pelunasanSaving, setPelunasanSaving] = useState(false);
  const [pelunasanError, setPelunasanError] = useState<string | null>(null);

  // Riwayat Pembayaran Modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Buku Besar Deposit Ledger Modal state
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [ledgerItems, setLedgerItems] = useState<any[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerSupplierFilter, setLedgerSupplierFilter] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerTipeMutasi, setLedgerTipeMutasi] = useState("");

  const getUsername = () => {
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
    return username;
  };

  const fetchList = useCallback(async () => {
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
  }, [API_BASE]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

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
    } catch {
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
    const username = getUsername();
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
      fetchList();
    } catch {
      setModalError("Gagal menyimpan tagihan.");
    } finally {
      setSaving(false);
    }
  };

  // Pelunasan Handlers
  const fetchSupplierDeposit = async (kodeSupplier: string) => {
    setLoadingDeposit(true);
    try {
      const res = await fetch(`${API_BASE}/supplier-deposit/saldo/${encodeURIComponent(kodeSupplier)}`);
      if (res.ok) {
        const data = await res.json();
        setSaldoDeposit(Number(data?.saldo_deposit || 0));
      } else {
        setSaldoDeposit(0);
      }
    } catch {
      setSaldoDeposit(0);
    } finally {
      setLoadingDeposit(false);
    }
  };

  const openPelunasan = async (tagihan: TagihanRow) => {
    setSelectedTagihan(tagihan);
    const sisa = Math.max(0, (tagihan.total_tagihan || 0) - (tagihan.total_dibayar || 0));
    setNominalBayar(String(sisa));
    setTglBayar(new Date().toISOString().slice(0, 10));
    setSumberBayar("DEPOSIT_RETUR");
    setBankBayar("");
    setNoRefBayar("");
    setCatatanBayar("");
    setPelunasanError(null);
    setPelunasanModalOpen(true);

    if (tagihan.kode_supplier) {
      await fetchSupplierDeposit(tagihan.kode_supplier);
    } else {
      setSaldoDeposit(0);
    }
  };

  const closePelunasan = () => {
    if (pelunasanSaving) return;
    setPelunasanModalOpen(false);
  };

  const handleSavePelunasan = async () => {
    if (!selectedTagihan) return;
    const nominal = Number(nominalBayar);
    if (!nominal || nominal <= 0) {
      setPelunasanError("Nominal pembayaran harus lebih besar dari 0");
      return;
    }
    const sisa = Math.max(0, (selectedTagihan.total_tagihan || 0) - (selectedTagihan.total_dibayar || 0));
    if (nominal > sisa) {
      setPelunasanError(`Nominal tidak boleh melebihi sisa tagihan (${formatIDR(sisa)})`);
      return;
    }
    if (sumberBayar === "DEPOSIT_RETUR" && saldoDeposit !== null && nominal > saldoDeposit) {
      setPelunasanError(`Nominal melebihi saldo deposit retur tersedia (${formatIDR(saldoDeposit)})`);
      return;
    }

    setPelunasanSaving(true);
    setPelunasanError(null);
    try {
      const username = getUsername();
      const res = await fetch(`${API_BASE}/tagihan/${encodeURIComponent(selectedTagihan.kode_t_tagihan)}/pelunasan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tgl_bayar: tglBayar,
          nominal_bayar: nominal,
          sumber_pembayaran: sumberBayar,
          bank: bankBayar || null,
          no_referensi: noRefBayar || null,
          catatan: catatanBayar || null,
          created_by: username,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setPelunasanModalOpen(false);
      fetchList();
    } catch (err: any) {
      setPelunasanError(err.message || "Gagal memproses pelunasan");
    } finally {
      setPelunasanSaving(false);
    }
  };

  // Riwayat Pembayaran Handlers
  const openHistory = async (tagihan: TagihanRow) => {
    setSelectedTagihan(tagihan);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/tagihan/${encodeURIComponent(tagihan.kode_t_tagihan)}/pembayaran`);
      if (res.ok) {
        const data = await res.json();
        setPaymentHistory(Array.isArray(data) ? data : []);
      } else {
        setPaymentHistory([]);
      }
    } catch {
      setPaymentHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Ledger / Buku Besar Handlers
  const fetchLedger = useCallback(async (supp = "", q = "", mutasi = "", p = 1) => {
    setLedgerLoading(true);
    try {
      const params = new URLSearchParams();
      if (supp) params.set("kode_supplier", supp);
      if (q) params.set("search", q);
      if (mutasi) params.set("tipe_mutasi", mutasi);
      params.set("page", String(p));
      params.set("page_size", "20");
      const res = await fetch(`${API_BASE}/supplier-deposit/ledger?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerItems(data?.items || []);
        setLedgerTotal(data?.total || 0);
        setLedgerPage(p);
      }
    } catch (err) {
      console.error("Failed load deposit ledger", err);
    } finally {
      setLedgerLoading(false);
    }
  }, [API_BASE]);

  const openLedgerModal = (kodeSupplier = "") => {
    setLedgerSupplierFilter(kodeSupplier);
    setLedgerSearch("");
    setLedgerTipeMutasi("");
    setLedgerPage(1);
    setLedgerModalOpen(true);
    fetchLedger(kodeSupplier, "", "", 1);
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

  const sisaTagihanSelected = selectedTagihan
    ? Math.max(0, (selectedTagihan.total_tagihan || 0) - (selectedTagihan.total_dibayar || 0))
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <p className="text-sm text-gray-500">Purchasing</p>
        <h1 className="text-2xl font-bold text-gray-900">Listing Tagihan & Pelunasan</h1>
        <p className="text-sm text-gray-600 mt-1">Daftar tagihan supplier dan pelunasan sumber dana (termasuk Deposit Retur).</p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => openLedgerModal()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold shadow-sm hover:bg-emerald-100 transition-all text-sm"
        >
          <BookOpen className="w-4 h-4 text-emerald-600" />
          Buku Besar Deposit Supplier
        </button>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg transition-all text-sm"
        >
          <Plus className="w-4 h-4" />
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

      {/* Modal Tambah Tagihan */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-gray-100 p-5 max-h-[90vh] overflow-y-auto">
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

            {modalError && <div className="mb-3 text-sm text-rose-600 font-semibold">{modalError}</div>}

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

      {/* Modal Pelunasan Tagihan */}
      {pelunasanModalOpen && selectedTagihan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closePelunasan} />
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-100 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Form Pelunasan</p>
                <h3 className="text-xl font-bold text-gray-900">Pelunasan Tagihan Pembelian</h3>
              </div>
              <button
                type="button"
                onClick={closePelunasan}
                disabled={pelunasanSaving}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pelunasanError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
                <span>{pelunasanError}</span>
              </div>
            )}

            {/* Info Tagihan Box */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200 text-sm">
              <div>
                <p className="text-xs text-gray-500">No. Tagihan</p>
                <p className="font-semibold text-gray-900">{selectedTagihan.kode_t_tagihan}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Supplier</p>
                <p className="font-semibold text-gray-900 truncate" title={selectedTagihan.supplier_nama || ""}>
                  {selectedTagihan.supplier_nama || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Tagihan</p>
                <p className="font-semibold text-gray-900">{formatIDR(selectedTagihan.total_tagihan || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Sisa Tagihan</p>
                <p className="font-bold text-emerald-700 text-base">{formatIDR(sisaTagihanSelected)}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Sumber / Metode Pembayaran
                </label>
                <select
                  value={sumberBayar}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSumberBayar(val);
                    if (val === "DEPOSIT_RETUR" && selectedTagihan.kode_supplier) {
                      fetchSupplierDeposit(selectedTagihan.kode_supplier);
                    }
                  }}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="DEPOSIT_RETUR">💳 DEPOSIT RETUR SUPPLIER</option>
                  <option value="TRANSFER_BANK">🏦 TRANSFER BANK</option>
                  <option value="KAS_TUNAI">💵 KAS TUNAI</option>
                  <option value="GIRO">📑 BILYET GIRO</option>
                  <option value="LAINNYA">LAINNYA</option>
                </select>
              </div>

              {/* Box Saldo Deposit Retur */}
              {sumberBayar === "DEPOSIT_RETUR" && (
                <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-sm">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                          Saldo Deposit Retur Supplier Saat Ini
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-0.5">
                          {loadingDeposit ? "Memuat saldo..." : formatIDR(saldoDeposit || 0)}
                        </p>
                      </div>
                    </div>
                    {saldoDeposit !== null && saldoDeposit > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const maxBisa = Math.min(sisaTagihanSelected, saldoDeposit);
                          setNominalBayar(String(maxBisa));
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all"
                      >
                        Gunakan Maksimal
                      </button>
                    )}
                  </div>
                  {saldoDeposit !== null && saldoDeposit <= 0 && !loadingDeposit && (
                    <p className="mt-2 text-xs text-rose-600 font-semibold">
                      ⚠️ Supplier ini tidak memiliki saldo deposit retur aktif. Silakan pilih sumber pembayaran lain.
                    </p>
                  )}
                </div>
              )}

              {/* Bank & Referensi if Transfer/Giro */}
              {(sumberBayar === "TRANSFER_BANK" || sumberBayar === "GIRO") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Bank</label>
                    <input
                      value={bankBayar}
                      onChange={(e) => setBankBayar(e.target.value)}
                      placeholder="Contoh: BCA / Mandiri"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">No. Ref / Bukti Transfer</label>
                    <input
                      value={noRefBayar}
                      onChange={(e) => setNoRefBayar(e.target.value)}
                      placeholder="Nomor referensi / transaksi"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal Pelunasan</label>
                  <input
                    type="date"
                    value={tglBayar}
                    onChange={(e) => setTglBayar(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Nominal Pelunasan (Rp)
                  </label>
                  <input
                    type="number"
                    value={nominalBayar}
                    onChange={(e) => setNominalBayar(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold text-gray-900"
                    placeholder="0"
                  />
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>Sisa: {formatIDR(sisaTagihanSelected)}</span>
                    <button
                      type="button"
                      onClick={() => setNominalBayar(String(sisaTagihanSelected))}
                      className="text-emerald-600 hover:underline font-semibold"
                    >
                      Bayar Lunas
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Catatan Pelunasan</label>
                <textarea
                  value={catatanBayar}
                  onChange={(e) => setCatatanBayar(e.target.value)}
                  placeholder="Catatan / keterangan tambahan pelunasan..."
                  rows={2}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={closePelunasan}
                disabled={pelunasanSaving}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePelunasan}
                disabled={pelunasanSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-md transition-all disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                {pelunasanSaving ? "Memproses Pelunasan..." : "Konfirmasi & Simpan Pelunasan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Riwayat Pembayaran Tagihan */}
      {historyModalOpen && selectedTagihan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setHistoryModalOpen(false)} />
          <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-gray-100 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Riwayat Pembayaran</p>
                <h3 className="text-lg font-bold text-gray-900">Tagihan: {selectedTagihan.kode_t_tagihan}</h3>
                <p className="text-xs text-gray-600">{selectedTagihan.supplier_nama}</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4">
              {loadingHistory ? (
                <p className="py-6 text-center text-sm text-gray-500">Memuat riwayat pembayaran...</p>
              ) : paymentHistory.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">
                  Belum ada catatan riwayat pembayaran untuk tagihan ini.
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2.5">Tanggal</th>
                        <th className="px-3 py-2.5">Kode Pembayaran</th>
                        <th className="px-3 py-2.5">Sumber Dana</th>
                        <th className="px-3 py-2.5 text-right">Nominal</th>
                        <th className="px-3 py-2.5">Bank / Ref</th>
                        <th className="px-3 py-2.5">Petugas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paymentHistory.map((p) => (
                        <tr key={p.id_pembayaran} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-gray-700">
                            {p.tgl_bayar ? String(p.tgl_bayar).slice(0, 10) : "-"}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs font-semibold text-gray-900">
                            {p.kode_pembayaran}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                p.sumber_pembayaran === "DEPOSIT_RETUR"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {p.sumber_pembayaran}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                            {formatIDR(Number(p.nominal_bayar || 0))}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">
                            {p.bank ? `${p.bank} ` : ""}
                            {p.no_referensi ? `(${p.no_referensi})` : "-"}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{p.created_by || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Buku Besar Deposit Supplier (Audit Trail) */}
      {ledgerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setLedgerModalOpen(false)} />
          <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-gray-100 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Buku Besar Mutasi Deposit Supplier</h3>
                  <p className="text-xs text-gray-500">Audit trail seluruh penambahan (Retur) dan pemotongan (Pelunasan Tagihan).</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLedgerModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-white text-sm">
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchLedger(ledgerSupplierFilter, ledgerSearch, ledgerTipeMutasi, 1)}
                  placeholder="Cari No. Mutasi / No. Dokumen / Keterangan..."
                  className="w-full outline-none text-sm"
                />
              </div>
              <div>
                <select
                  value={ledgerTipeMutasi}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLedgerTipeMutasi(val);
                    fetchLedger(ledgerSupplierFilter, ledgerSearch, val, 1);
                  }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Semua Tipe Mutasi</option>
                  <option value="MASUK">MASUK (Dari Retur Supplier)</option>
                  <option value="KELUAR">KELUAR (Pelunasan Tagihan)</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => fetchLedger(ledgerSupplierFilter, ledgerSearch, ledgerTipeMutasi, 1)}
                  className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                >
                  Filter Data
                </button>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="mt-4 overflow-x-auto border border-gray-200 rounded-xl">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-3">Tanggal</th>
                    <th className="px-3 py-3">No. Mutasi</th>
                    <th className="px-3 py-3">Supplier</th>
                    <th className="px-3 py-3">Tipe</th>
                    <th className="px-3 py-3">No. Dokumen Ref</th>
                    <th className="px-3 py-3 text-right">Saldo Awal</th>
                    <th className="px-3 py-3 text-right">Nominal</th>
                    <th className="px-3 py-3 text-right">Saldo Akhir</th>
                    <th className="px-3 py-3">Keterangan</th>
                    <th className="px-3 py-3">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledgerLoading && (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-gray-500">
                        Memuat data buku besar...
                      </td>
                    </tr>
                  )}
                  {!ledgerLoading && ledgerItems.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-gray-500">
                        Tidak ada riwayat mutasi deposit ditemukan.
                      </td>
                    </tr>
                  )}
                  {!ledgerLoading &&
                    ledgerItems.map((item) => {
                      const isMasuk = item.tipe_mutasi === "MASUK";
                      return (
                        <tr key={item.id_ledger} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                            {item.tgl_mutasi ? new Date(item.tgl_mutasi).toLocaleString("id-ID") : "-"}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">
                            {item.kode_mutasi}
                          </td>
                          <td className="px-3 py-2.5 text-gray-800 text-xs max-w-[140px] truncate" title={item.nama_supplier}>
                            {item.nama_supplier}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isMasuk
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : "bg-rose-100 text-rose-800 border border-rose-300"
                              }`}
                            >
                              {isMasuk ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                              {item.tipe_mutasi}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-700 whitespace-nowrap">
                            {item.kode_ref || "-"}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-gray-600 whitespace-nowrap">
                            {formatIDR(Number(item.saldo_awal || 0))}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right text-xs font-bold whitespace-nowrap ${
                              isMasuk ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            {isMasuk ? "+" : "-"}
                            {formatIDR(Number(item.nominal || 0))}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-900 whitespace-nowrap">
                            {formatIDR(Number(item.saldo_akhir || 0))}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[180px] truncate" title={item.keterangan}>
                            {item.keterangan || "-"}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                            {item.created_by || "-"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
              <span>Total {ledgerTotal} riwayat mutasi</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={ledgerPage <= 1 || ledgerLoading}
                  onClick={() => fetchLedger(ledgerSupplierFilter, ledgerSearch, ledgerTipeMutasi, ledgerPage - 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                >
                  Prev
                </button>
                <span>Halaman {ledgerPage}</span>
                <button
                  type="button"
                  disabled={ledgerPage * 20 >= ledgerTotal || ledgerLoading}
                  onClick={() => fetchLedger(ledgerSupplierFilter, ledgerSearch, ledgerTipeMutasi, ledgerPage + 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setLedgerModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Tagihan */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor tagihan / invoice / supplier"
              className="w-full outline-none text-sm"
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
                <th className="px-3 py-3">Kode Tagihan</th>
                <th className="px-3 py-3">Supplier</th>
                <th className="px-3 py-3">No Invoice</th>
                <th className="px-3 py-3">No Faktur Supplier</th>
                <th className="px-3 py-3">Tanggal</th>
                <th className="px-3 py-3">Jatuh Tempo</th>
                <th className="px-3 py-3 text-right">Total Tagihan</th>
                <th className="px-3 py-3 text-right">Total Dibayar</th>
                <th className="px-3 py-3 text-right">Sisa Tagihan</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-center">Aksi Pelunasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={12}>
                    Memuat data...
                  </td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td className="px-3 py-4 text-center text-rose-600" colSpan={12}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={12}>
                    Tidak ada data tagihan.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filtered.map((r, idx) => {
                  const rowNum = filtered.length - idx;
                  const isLunas = Boolean(r.is_lunas);
                  const totalTag = Number(r.total_tagihan ?? 0);
                  const totalBayar = Number(r.total_dibayar ?? 0);
                  const sisa = Math.max(0, totalTag - totalBayar);

                  return (
                    <tr key={r.kode_t_tagihan} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 text-center text-gray-700">{rowNum}</td>
                      <td className="px-3 py-3 font-semibold text-gray-900 font-mono text-xs">{r.kode_t_tagihan}</td>
                      <td className="px-3 py-3 text-gray-800 font-medium">
                        <div>{r.supplier_nama || "-"}</div>
                        {r.kode_supplier && (
                          <button
                            type="button"
                            onClick={() => openLedgerModal(r.kode_supplier || "")}
                            className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <Wallet className="w-3 h-3" /> Cek Deposit
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-700">{r.no_invoice || "-"}</td>
                      <td className="px-3 py-3 text-gray-700">{r.no_faktur_supplier || "-"}</td>
                      <td className="px-3 py-3 text-gray-700">{r.tgl || "-"}</td>
                      <td className="px-3 py-3 text-gray-700">{r.tgl_jatuh_tempo || "-"}</td>
                      <td className="px-3 py-3 text-right text-gray-900 font-semibold">
                        {formatIDR(totalTag)}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-800">
                        {formatIDR(totalBayar)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-700">
                        {formatIDR(sisa)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isLunas
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          <ReceiptText className="w-3 h-3" />
                          {isLunas ? "LUNAS" : "BELUM"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isLunas && (
                            <button
                              type="button"
                              onClick={() => openPelunasan(r)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              Pelunasan
                            </button>
                          )}
                          {totalBayar > 0 && (
                            <button
                              type="button"
                              onClick={() => openHistory(r)}
                              title="Lihat Riwayat Pembayaran"
                              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
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
