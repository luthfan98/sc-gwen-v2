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
} from "lucide-react";

type SupplierDepositSummary = {
  kode_supplier: string;
  nama_supplier: string;
  saldo_deposit: number;
  updated_at?: string | null;
  updated_by?: string | null;
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
  }, [fetchSummary, fetchLedger]);

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
                        <button
                          type="button"
                          onClick={() => {
                            setLedgerSupplierFilter(s.kode_supplier);
                            setActiveTab("ledger");
                            fetchLedger(s.kode_supplier, "", "", 1);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-all inline-flex items-center gap-1"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          Lihat Mutasi
                        </button>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-white">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchLedger(ledgerSupplierFilter, ledgerSearch, ledgerTipeMutasi, 1)}
                placeholder="Cari No. Mutasi / No. Dokumen / Supplier..."
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
            <div className="flex items-center justify-end gap-2">
              {ledgerSupplierFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setLedgerSupplierFilter("");
                    fetchLedger("", ledgerSearch, ledgerTipeMutasi, 1);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Reset Filter Supplier
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
    </div>
  );
}

