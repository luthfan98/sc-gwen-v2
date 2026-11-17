"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ArrowLeft,
  Building2,
  Calendar,
  SlidersHorizontal,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type SupplierDepositSummary = {
  kode_supplier: string;
  nama_supplier: string;
  saldo_deposit: number;
  updated_at?: string | null;
  updated_by?: string | null;
};

type ReturSupplierDoc = {
  kode_t_retur_supplier: string;
  tgl: string;
  kode_supplier: string;
  nama_supplier: string;
  total_nominal: number;
  catatan?: string | null;
  status_retur?: string | null;
  is_used: boolean;
  used_reference?: string | null;
};

type DepositLedgerRow = {
  id_ledger: number;
  kode_mutasi: string;
  tgl_mutasi: string;
  kode_supplier: string;
  nama_supplier: string;
  tipe_mutasi: "MASUK" | "KELUAR";
  kode_ref?: string | null;
  saldo_awal: number;
  nominal: number;
  saldo_akhir: number;
  keterangan?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

const formatIDR = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0);

export default function DepositSupplierPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

  const [activeTab, setActiveTab] = useState<"summary" | "ledger">("summary");

  // Summary state
  const [summaryList, setSummaryList] = useState<SupplierDepositSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summarySearch, setSummarySearch] = useState("");

  // Ledger state
  const [ledgerRows, setLedgerRows] = useState<DepositLedgerRow[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerSupplierFilter, setLedgerSupplierFilter] = useState("");
  const [ledgerTipeMutasi, setLedgerTipeMutasi] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [backfillLoading, setBackfillLoading] = useState(false);

  // Modal Adjust State
  const [adjustSupplier, setAdjustSupplier] = useState<SupplierDepositSummary | null>(null);
  const [adjustReturList, setAdjustReturList] = useState<ReturSupplierDoc[]>([]);
  const [adjustReturLoading, setAdjustReturLoading] = useState(false);
  const [adjustActionLoading, setAdjustActionLoading] = useState<string | null>(null);
  const [adjustTab, setAdjustTab] = useState<"retur" | "manual">("retur");
  const [manualTipe, setManualTipe] = useState<"MASUK" | "KELUAR">("KELUAR");
  const [manualNominal, setManualNominal] = useState("");
  const [manualKeterangan, setManualKeterangan] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/supplier-deposit/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummaryList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed load deposit summary", err);
    } finally {
      setSummaryLoading(false);
    }
  }, [API_BASE]);

  const fetchLedger = useCallback(
    async (supp = ledgerSupplierFilter, q = ledgerSearch, mutasi = ledgerTipeMutasi, p = ledgerPage) => {
      setLedgerLoading(true);
      try {
        const params = new URLSearchParams();
        if (supp) params.set("kode_supplier", supp);
        if (q) params.set("search", q);
        if (mutasi) params.set("tipe_mutasi", mutasi);
        params.set("page", String(p));
        params.set("page_size", "25");
        const res = await fetch(`${API_BASE}/supplier-deposit/ledger?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setLedgerRows(data?.items || []);
          setLedgerTotal(data?.total || 0);
          setLedgerPage(p);
        }
      } catch (err) {
        console.error("Failed load deposit ledger", err);
      } finally {
        setLedgerLoading(false);
      }
    },
    [API_BASE, ledgerPage, ledgerSearch, ledgerSupplierFilter, ledgerTipeMutasi]
  );

  useEffect(() => {
    fetchSummary();
    fetchLedger("", "", "", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunBackfill = async () => {
    if (!confirm("Jalankan sinkronisasi / backfill seluruh data retur supplier ke saldo deposit?")) return;
    setBackfillLoading(true);
    try {
      const res = await fetch(`${API_BASE}/supplier-deposit/backfill`, { method: "POST" });
      const data = await res.json();
      alert(`Backfill selesai: ${data?.insertedCount ?? 0} data baru dimasukkan, ${data?.skippedCount ?? 0} dilewati.`);
      fetchSummary();
      fetchLedger(ledgerSupplierFilter, ledgerSearch, ledgerTipeMutasi, 1);
    } catch {
      alert("Gagal menjalankan backfill deposit.");
    } finally {
      setBackfillLoading(false);
    }
  };

  const fetchRetursForAdjust = useCallback(
    async (kodeSupplier: string) => {
      setAdjustReturLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/supplier-deposit/available-retur/${encodeURIComponent(kodeSupplier)}`
        );
        if (res.ok) {
          const data = await res.json();
          setAdjustReturList(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed load retur list for adjust", err);
      } finally {
        setAdjustReturLoading(false);
      }
    },
    [API_BASE]
  );

  const handleOpenAdjustModal = (supplier: SupplierDepositSummary) => {
    setAdjustSupplier(supplier);
    setAdjustTab("retur");
    setManualNominal("");
    setManualKeterangan("");
    fetchRetursForAdjust(supplier.kode_supplier);
  };

  const handleCloseAdjustModal = () => {
    setAdjustSupplier(null);
    setAdjustReturList([]);
  };

  const handleToggleReturStatus = async (retur: ReturSupplierDoc) => {
    if (!adjustSupplier) return;
    const nextAction = retur.is_used ? "MARK_UNUSED" : "MARK_USED";
    const confirmMsg = retur.is_used
      ? `Batalkan status sudah digunakan untuk retur ${retur.kode_t_retur_supplier}?\nSaldo deposit supplier akan DITAMBAHKAN kembali sebesar ${formatIDR(
          retur.total_nominal
        )}.`
      : `Ubah status retur ${retur.kode_t_retur_supplier} menjadi SUDAH DIGUNAKAN?\nSaldo deposit supplier akan DIKURANGI sebesar ${formatIDR(
          retur.total_nominal
        )} dan tidak muncul lagi di pilihan Kontrabon.`;

    if (!confirm(confirmMsg)) return;

    setAdjustActionLoading(retur.kode_t_retur_supplier);
    try {
      const res = await fetch(`${API_BASE}/supplier-deposit/adjust-retur`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_supplier: adjustSupplier.kode_supplier,
          kode_t_retur_supplier: retur.kode_t_retur_supplier,
          action: nextAction,
          keterangan: `Penyesuaian status dokumen retur oleh admin (${
            nextAction === "MARK_USED" ? "Tandai Digunakan" : "Batalkan Penggunaan"
          })`,
          created_by: "Admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data?.message || "Gagal mengubah status retur.");
        return;
      }

      alert(data.message);
      setAdjustSupplier((prev) =>
        prev ? { ...prev, saldo_deposit: data.saldo_deposit } : null
      );
      fetchSummary();
      fetchRetursForAdjust(adjustSupplier.kode_supplier);
      fetchLedger(adjustSupplier.kode_supplier, "", "", 1);
    } catch (err) {
      console.error("Failed toggle retur status", err);
      alert("Terjadi kesalahan saat menghubungi server.");
    } finally {
      setAdjustActionLoading(null);
    }
  };

  const handleManualNominalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustSupplier) return;
    const cleanNominal = Number(manualNominal.replace(/[^0-9]/g, "") || 0);
    if (cleanNominal <= 0) {
      alert("Nominal penyesuaian harus lebih dari 0.");
      return;
    }

    if (
      !confirm(
        `Konfirmasi penyesuaian saldo manual (${manualTipe}) sebesar ${formatIDR(
          cleanNominal
        )} untuk ${adjustSupplier.nama_supplier}?\nRiwayat mutasi audit akan dicatat di buku besar.`
      )
    ) {
      return;
    }

    setManualSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/supplier-deposit/adjust-nominal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_supplier: adjustSupplier.kode_supplier,
          tipe_mutasi: manualTipe,
          nominal: cleanNominal,
          keterangan: manualKeterangan.trim(),
          created_by: "Admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data?.message || "Gagal menyesuaikan saldo deposit.");
        return;
      }

      alert(data.message);
      setManualNominal("");
      setManualKeterangan("");
      setAdjustSupplier((prev) =>
        prev ? { ...prev, saldo_deposit: data.saldo_deposit } : null
      );
      fetchSummary();
      fetchLedger(adjustSupplier.kode_supplier, "", "", 1);
    } catch (err) {
      console.error("Failed manual nominal adjust", err);
      alert("Terjadi kesalahan saat menghubungi server.");
    } finally {
      setManualSubmitting(false);
    }
  };

  const totalSaldoSemua = useMemo(() => {
    return summaryList.reduce((sum, s) => sum + Number(s.saldo_deposit || 0), 0);
  }, [summaryList]);

  const filteredSummary = useMemo(() => {
    const q = summarySearch.toLowerCase().trim();
    if (!q) return summaryList;
    return summaryList.filter(
      (s) =>
        s.kode_supplier.toLowerCase().includes(q) ||
        (s.nama_supplier || "").toLowerCase().includes(q)
    );
  }, [summaryList, summarySearch]);

  const selectedSupplierInfo = useMemo(() => {
    if (!ledgerSupplierFilter) return null;
    return summaryList.find((s) => s.kode_supplier === ledgerSupplierFilter) || null;
  }, [summaryList, ledgerSupplierFilter]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/purchasing/tagihan"
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Tagihan
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Buku Besar Deposit Retur Supplier</h1>
          <p className="text-sm text-gray-600 mt-1">
            Audit trail saldo klaim retur pembelian dan penggunaannya pada pelunasan tagihan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunBackfill}
            disabled={backfillLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-semibold shadow-sm hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${backfillLoading ? "animate-spin" : ""}`} />
            {backfillLoading ? "Menyelaraskan..." : "Sinkronisasi Retur Lama"}
          </button>
        </div>
      </div>

      {/* KPI Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider font-semibold opacity-90">Total Saldo Deposit Toko</p>
            <Wallet className="w-6 h-6 opacity-80" />
          </div>
          <p className="text-3xl font-extrabold mt-3">{formatIDR(totalSaldoSemua)}</p>
          <p className="text-xs opacity-90 mt-1">Total piutang/klaim retur kita di seluruh supplier</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Supplier Dengan Saldo</p>
            <Building2 className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-3">{summaryList.length}</p>
          <p className="text-xs text-gray-500 mt-1">Supplier aktif yang memiliki deposit retur</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">Total Mutasi Audit</p>
            <BookOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-3">{ledgerTotal}</p>
          <p className="text-xs text-gray-500 mt-1">Baris mutasi tercatat (masuk retur & pelunasan)</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("summary")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "summary"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Ringkasan Saldo Supplier ({summaryList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ledger")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "ledger"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Buku Besar Mutasi (Audit Trail)
        </button>
      </div>

      {/* Tab 1: Ringkasan Saldo Per Supplier */}
      {activeTab === "summary" && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 w-full max-w-md bg-white">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                value={summarySearch}
                onChange={(e) => setSummarySearch(e.target.value)}
                placeholder="Cari kode atau nama supplier..."
                className="w-full outline-none text-sm"
              />
            </div>
            <button
              type="button"
              onClick={fetchSummary}
              className="p-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${summaryLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Kode Supplier</th>
                  <th className="px-4 py-3">Nama Supplier</th>
                  <th className="px-4 py-3 text-right">Saldo Deposit Tersedia</th>
                  <th className="px-4 py-3">Update Terakhir</th>
                  <th className="px-4 py-3 text-center">Aksi Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summaryLoading && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      Memuat ringkasan deposit...
                    </td>
                  </tr>
                )}
                {!summaryLoading && filteredSummary.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      Tidak ada supplier dengan saldo deposit ditemukan.
                    </td>
                  </tr>
                )}
                {!summaryLoading &&
                  filteredSummary.map((s) => (
                    <tr key={s.kode_supplier} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{s.kode_supplier}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{s.nama_supplier}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 text-base">
                        {formatIDR(Number(s.saldo_deposit || 0))}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {s.updated_at ? new Date(s.updated_at).toLocaleDateString("id-ID") : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAdjustModal(s)}
                            className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-all inline-flex items-center gap-1 shadow-xs"
                            title="Adjust Nominal & Status Retur"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            Adjust Deposit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLedgerSupplierFilter(s.kode_supplier);
                              setLedgerSearch("");
                              setLedgerTipeMutasi("");
                              setActiveTab("ledger");
                              fetchLedger(s.kode_supplier, "", "", 1);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-all inline-flex items-center gap-1"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Lihat Mutasi
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Buku Besar Mutasi (Audit Trail) */}
      {activeTab === "ledger" && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
          {ledgerSupplierFilter && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-emerald-900">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  Menampilkan riwayat mutasi: <strong className="font-semibold">{selectedSupplierInfo?.nama_supplier || ledgerSupplierFilter}</strong>
                  {selectedSupplierInfo && (
                    <span className="ml-2 font-mono text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                      Saldo: {formatIDR(Number(selectedSupplierInfo.saldo_deposit || 0))}
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLedgerSupplierFilter("");
                  fetchLedger("", ledgerSearch, ledgerTipeMutasi, 1);
                }}
                className="text-emerald-700 hover:text-emerald-900 underline font-medium text-xs"
              >
                Tampilkan Semua Supplier
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-white">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchLedger(ledgerSupplierFilter, ledgerSearch, ledgerTipeMutasi, 1)}
                placeholder="Cari No. Mutasi / No. Dokumen..."
                className="w-full outline-none text-sm"
              />
            </div>
            <div>
              <select
                value={ledgerSupplierFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setLedgerSupplierFilter(val);
                  fetchLedger(val, ledgerSearch, ledgerTipeMutasi, 1);
                }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
              >
                <option value="">Semua Supplier</option>
                {summaryList.map((s) => (
                  <option key={s.kode_supplier} value={s.kode_supplier}>
                    {s.nama_supplier}
                  </option>
                ))}
              </select>
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
            <div className="flex items-center justify-end gap-2">
              {(ledgerSupplierFilter || ledgerSearch || ledgerTipeMutasi) && (
                <button
                  type="button"
                  onClick={() => {
                    setLedgerSupplierFilter("");
                    setLedgerSearch("");
                    setLedgerTipeMutasi("");
                    fetchLedger("", "", "", 1);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Reset Filter
                </button>
              )}
              <button
                type="button"
                onClick={() => fetchLedger(ledgerSupplierFilter, ledgerSearch, ledgerTipeMutasi, 1)}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
              >
                Cari
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-3">Tanggal</th>
                  <th className="px-3 py-3">No. Mutasi</th>
                  <th className="px-3 py-3">Supplier</th>
                  <th className="px-3 py-3">Tipe</th>
                  <th className="px-3 py-3">No. Dokumen Ref</th>
                  <th className="px-3 py-3 text-right">Saldo Awal</th>
                  <th className="px-3 py-3 text-right">Nominal Mutasi</th>
                  <th className="px-3 py-3 text-right">Saldo Akhir</th>
                  <th className="px-3 py-3">Keterangan</th>
                  <th className="px-3 py-3">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledgerLoading && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                      Memuat data buku besar...
                    </td>
                  </tr>
                )}
                {!ledgerLoading && ledgerRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                      Tidak ada data mutasi ditemukan.
                    </td>
                  </tr>
                )}
                {!ledgerLoading &&
                  ledgerRows.map((item) => {
                    const isMasuk = item.tipe_mutasi === "MASUK";
                    return (
                      <tr key={item.id_ledger} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                          {item.tgl_mutasi ? new Date(item.tgl_mutasi).toLocaleString("id-ID") : "-"}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">
                          {item.kode_mutasi}
                        </td>
                        <td className="px-3 py-2.5 text-gray-800 text-xs font-medium max-w-[140px] truncate" title={item.nama_supplier}>
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
                        <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[200px] truncate" title={item.keterangan || ""}>
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
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
            <span>Total {ledgerTotal} transaksi mutasi</span>
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
                disabled={ledgerPage * 25 >= ledgerTotal || ledgerLoading}
                onClick={() => fetchLedger(ledgerSupplierFilter, ledgerSearch, ledgerTipeMutasi, ledgerPage + 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup: Adjust Deposit & Dokumen Retur */}
      {adjustSupplier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3 bg-gradient-to-r from-gray-50 to-white">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-amber-600" />
                  <h3 className="text-lg font-bold text-gray-900">Adjust Nominal Deposit Retur</h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Supplier: <strong className="text-gray-800">{adjustSupplier.nama_supplier}</strong> ({adjustSupplier.kode_supplier})
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[11px] uppercase tracking-wider text-gray-500 block font-medium">Saldo Deposit Saat Ini</span>
                  <span className="font-extrabold text-emerald-700 text-base sm:text-lg">
                    {formatIDR(Number(adjustSupplier.saldo_deposit || 0))}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCloseAdjustModal}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 px-5 pt-3 border-b border-gray-200 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setAdjustTab("retur")}
                className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  adjustTab === "retur"
                    ? "border-amber-600 text-amber-800"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <FileText className="w-4 h-4" />
                Daftar Dokumen Retur ({adjustReturList.length})
              </button>
              <button
                type="button"
                onClick={() => setAdjustTab("manual")}
                className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  adjustTab === "manual"
                    ? "border-amber-600 text-amber-800"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Koreksi Saldo Manual (Buku Besar)
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {adjustTab === "retur" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-600">
                      Daftar seluruh dokumen retur ke supplier ini. Anda dapat menandai retur yang sudah digunakan atau membatalkan penggunaannya.
                    </p>
                    <button
                      type="button"
                      onClick={() => fetchRetursForAdjust(adjustSupplier.kode_supplier)}
                      disabled={adjustReturLoading}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${adjustReturLoading ? "animate-spin" : ""}`} />
                      Refresh Retur
                    </button>
                  </div>

                  {adjustReturLoading && (
                    <div className="py-12 text-center text-sm text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600 mb-2" />
                      Memuat daftar dokumen retur...
                    </div>
                  )}

                  {!adjustReturLoading && adjustReturList.length === 0 && (
                    <div className="py-12 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      Tidak ada dokumen retur yang tercatat untuk supplier ini.
                    </div>
                  )}

                  {!adjustReturLoading && adjustReturList.length > 0 && (
                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                      <table className="min-w-full text-xs text-left">
                        <thead className="bg-gray-50 uppercase tracking-wider text-gray-500 font-semibold">
                          <tr>
                            <th className="px-3 py-2.5">No. Dokumen Retur</th>
                            <th className="px-3 py-2.5">Tanggal</th>
                            <th className="px-3 py-2.5">Catatan / Alasan</th>
                            <th className="px-3 py-2.5 text-right">Nominal Retur</th>
                            <th className="px-3 py-2.5 text-center">Status Kegunaan</th>
                            <th className="px-3 py-2.5 text-center">Aksi Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {adjustReturList.map((retur) => (
                            <tr
                              key={retur.kode_t_retur_supplier}
                              className={`hover:bg-gray-50 transition-colors ${
                                retur.is_used ? "bg-gray-50/60" : ""
                              }`}
                            >
                              <td className="px-3 py-2.5 font-mono font-bold text-gray-900 whitespace-nowrap">
                                {retur.kode_t_retur_supplier}
                              </td>
                              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                                {retur.tgl ? new Date(retur.tgl).toLocaleDateString("id-ID") : "-"}
                              </td>
                              <td className="px-3 py-2.5 text-gray-600 max-w-[200px] truncate" title={retur.catatan || ""}>
                                {retur.catatan || "-"}
                              </td>
                              <td className="px-3 py-2.5 text-right font-extrabold text-emerald-800 text-sm whitespace-nowrap">
                                {formatIDR(Number(retur.total_nominal || 0))}
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                {retur.is_used ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                      <CheckCircle2 className="w-3 h-3 text-slate-600" />
                                      Sudah Digunakan
                                    </span>
                                    {retur.used_reference && (
                                      <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[130px]">
                                        {retur.used_reference}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                    <AlertCircle className="w-3 h-3 text-emerald-600" />
                                    Belum Digunakan (Tersedia)
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                {retur.is_used ? (
                                  <button
                                    type="button"
                                    disabled={adjustActionLoading === retur.kode_t_retur_supplier}
                                    onClick={() => handleToggleReturStatus(retur)}
                                    className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold transition-all inline-flex items-center gap-1 disabled:opacity-50"
                                    title="Batalkan penggunaan dan kembalikan ke saldo deposit"
                                  >
                                    {adjustActionLoading === retur.kode_t_retur_supplier ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    )}
                                    Batalkan (Tandai Belum Digunakan)
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={adjustActionLoading === retur.kode_t_retur_supplier}
                                    onClick={() => handleToggleReturStatus(retur)}
                                    className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-semibold transition-all inline-flex items-center gap-1 disabled:opacity-50"
                                    title="Tandai sudah digunakan dan potong saldo deposit"
                                  >
                                    {adjustActionLoading === retur.kode_t_retur_supplier ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />
                                    )}
                                    Ubah Status (Sudah Digunakan)
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Audit Trail Terintegrasi:</strong> Setiap kali status diubah menjadi <em>"Sudah Digunakan"</em>, saldo deposit otomatis dipotong dan tercatat sebagai mutasi <code>KELUAR</code> di buku besar. Sebaliknya jika dibatalkan, saldo akan dikembalikan dan tercatat sebagai mutasi <code>MASUK</code>.
                    </div>
                  </div>
                </div>
              )}

              {adjustTab === "manual" && (
                <form onSubmit={handleManualNominalSubmit} className="space-y-4 max-w-xl mx-auto py-2">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
                    Gunakan fitur ini jika ada perbedaan nominal saldo akibat pembulatan, kompensasi khusus, atau penyesuaian non-dokumen retur. Setiap penyesuaian wajib mencantumkan keterangan dan tercatat di buku besar audit.
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 block">Jenis Penyesuaian Saldo</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label
                        className={`border rounded-xl p-3 flex items-center gap-2 cursor-pointer transition-all ${
                          manualTipe === "KELUAR"
                            ? "border-rose-400 bg-rose-50/70 text-rose-900 font-semibold"
                            : "border-gray-200 hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name="manualTipe"
                          value="KELUAR"
                          checked={manualTipe === "KELUAR"}
                          onChange={() => setManualTipe("KELUAR")}
                          className="text-rose-600"
                        />
                        <div>
                          <p className="text-xs font-bold">KELUAR (Kurangi Saldo)</p>
                          <p className="text-[11px] opacity-80">Saldo deposit dipotong</p>
                        </div>
                      </label>

                      <label
                        className={`border rounded-xl p-3 flex items-center gap-2 cursor-pointer transition-all ${
                          manualTipe === "MASUK"
                            ? "border-emerald-400 bg-emerald-50/70 text-emerald-900 font-semibold"
                            : "border-gray-200 hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name="manualTipe"
                          value="MASUK"
                          checked={manualTipe === "MASUK"}
                          onChange={() => setManualTipe("MASUK")}
                          className="text-emerald-600"
                        />
                        <div>
                          <p className="text-xs font-bold">MASUK (Tambah Saldo)</p>
                          <p className="text-[11px] opacity-80">Saldo deposit ditambahkan</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 block">Nominal Penyesuaian (Rp)</label>
                    <input
                      type="text"
                      value={manualNominal}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        setManualNominal(raw ? Number(raw).toLocaleString("id-ID") : "");
                      }}
                      placeholder="Contoh: 500.000"
                      required
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-base font-bold text-gray-900 outline-none focus:border-amber-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 block">Keterangan / Alasan Penyesuaian</label>
                    <textarea
                      value={manualKeterangan}
                      onChange={(e) => setManualKeterangan(e.target.value)}
                      placeholder="Jelaskan alasan dilakukannya koreksi manual saldo deposit ini..."
                      rows={3}
                      required
                      className="w-full rounded-xl border border-gray-300 p-3 text-xs outline-none focus:border-amber-600"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setManualNominal("");
                        setManualKeterangan("");
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                    >
                      Reset Form
                    </button>
                    <button
                      type="submit"
                      disabled={manualSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {manualSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Simpan Penyesuaian Saldo
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Data perubahan disinkronkan langsung ke database secara real-time.
              </span>
              <button
                type="button"
                onClick={handleCloseAdjustModal}
                className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

