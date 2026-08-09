"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

type InquiryRow = {
  created_at: string;
  central_trx_code: string;
  source_trx_code?: string | null;
  cashier_name?: string | null;
  method?: string | null;
  customer_name?: string | null;
  penjualan_total?: number | null;
  charge_transaksi?: number | null;
  diskon_principle?: number | null;
  diskon_distributor?: number | null;
  retur?: number | null;
  diskon_manual?: number | null;
  total_bersih?: number | null;
  status?: string | null;
  audit_status?: string | null;
};

const formatIDR = (val: number | null | undefined) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    Number(val ?? 0)
  );

const formatDateTime = (val?: string | null) => {
  if (!val) return "-";
  let raw = String(val).trim();
  if (!raw) return "-";
  raw = raw.replace("T", " ").replace("Z", "");
  if (raw.includes(".")) raw = raw.split(".")[0];
  const [datePart, timePart] = raw.split(" ");
  if (!datePart) return raw;
  if (datePart.includes("/")) {
    return timePart ? `${datePart} ${timePart}` : datePart;
  }
  const [yyyy, mm, dd] = datePart.split("-");
  if (yyyy && mm && dd) {
    const dateFmt = `${dd}/${mm}/${yyyy}`;
    return timePart ? `${dateFmt} ${timePart}` : dateFmt;
  }
  return raw;
};

export default function InquiryPenjualanPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const getTodayStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const [filterFrom, setFilterFrom] = useState(getTodayStr);
  const [filterTo, setFilterTo] = useState(getTodayStr);
  const [filterStatus, setFilterStatus] = useState("Sukses");
  const [filterMethod, setFilterMethod] = useState<string[]>([]);
  const [filterCashier, setFilterCashier] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [cashierOpen, setCashierOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [auditSaving, setAuditSaving] = useState<Record<string, boolean>>({});
  const [cashierOptions, setCashierOptions] = useState<string[]>([]);
  const [methodOptions, setMethodOptions] = useState<string[]>([]);
  const cashierRef = useRef<HTMLDivElement | null>(null);
  const methodRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await fetch(`${API_BASE}/pos/transactions-inquiry-options`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCashierOptions(Array.isArray(data?.cashiers) ? data.cashiers : []);
        setMethodOptions(Array.isArray(data?.methods) ? data.methods : []);
      } catch (err) {
        console.error("Failed fetch inquiry options", err);
        setCashierOptions([]);
        setMethodOptions([]);
      }
    };
    fetchOptions();
  }, [API_BASE]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (cashierOpen && cashierRef.current && !cashierRef.current.contains(target)) {
        setCashierOpen(false);
      }
      if (methodOpen && methodRef.current && !methodRef.current.contains(target)) {
        setMethodOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [cashierOpen, methodOpen]);

  const totals = rows.reduce(
    (acc, row) => {
      acc.penjualan_total += Number(row.penjualan_total ?? 0);
      acc.charge_transaksi += Number(row.charge_transaksi ?? 0);
      acc.diskon_principle += Number(row.diskon_principle ?? 0);
      acc.diskon_distributor += Number(row.diskon_distributor ?? 0);
      acc.retur += Number(row.retur ?? 0);
      acc.diskon_manual += Number(row.diskon_manual ?? 0);
      acc.total_bersih += Number(row.total_bersih ?? 0);
      return acc;
    },
    {
      penjualan_total: 0,
      charge_transaksi: 0,
      diskon_principle: 0,
      diskon_distributor: 0,
      retur: 0,
      diskon_manual: 0,
      total_bersih: 0,
    }
  );

  const auditSummary = rows.reduce(
    (acc, row) => {
      const status = String(row.audit_status || "").toUpperCase();
      if (status === "SESUAI") acc.sesuai += 1;
      else if (status === "TIDAK_SESUAI") acc.tidakSesuai += 1;
      else acc.belum += 1;
      return acc;
    },
    { sesuai: 0, tidakSesuai: 0, belum: 0 }
  );

  const exportXlsx = () => {
    if (!rows.length) return;
    const exportRows = rows.map((row) => ({
      "Waktu Transaksi": formatDateTime(row.created_at),
      "Kode Transaksi": row.central_trx_code || "-",
      "Kode TRX": row.source_trx_code || "-",
      Customer: row.customer_name || "-",
      Kasir: row.cashier_name || "-",
      Metode: row.method || "-",
      "Penjualan Total": Number(row.penjualan_total ?? 0),
      "Charge Transaksi (+)": Number(row.charge_transaksi ?? 0),
      "Diskon Principle": Number(row.diskon_principle ?? 0),
      "Diskon Distributor": Number(row.diskon_distributor ?? 0),
      Retur: Number(row.retur ?? 0),
      "Diskon Manual": Number(row.diskon_manual ?? 0),
      "Total Bersih": Number(row.total_bersih ?? 0),
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inquiry Penjualan");
    const safe = (value: string) => value.replace(/[^0-9A-Za-z-]/g, "-");
    const fromLabel = filterFrom ? safe(filterFrom) : "all";
    const toLabel = filterTo ? safe(filterTo) : "all";
    XLSX.writeFile(wb, `inquiry-penjualan_${fromLabel}_${toLabel}.xlsx`);
  };

  const getUsername = () => {
    if (typeof window === "undefined") return "Admin";
    const rawSession = localStorage.getItem("kosmetik-admin-session");
    if (!rawSession) return "Admin";
    try {
      const parsed = JSON.parse(rawSession);
      return parsed?.username || parsed?.name || "Admin";
    } catch {
      return "Admin";
    }
  };

  const handleAuditChange = async (row: InquiryRow, value: string) => {
    const trxCode = row.central_trx_code;
    if (!trxCode) return;
    if (value !== "SESUAI" && value !== "TIDAK_SESUAI") return;
    const prevStatus = row.audit_status ?? null;
    setAuditSaving((prev) => ({ ...prev, [trxCode]: true }));
    setRows((prev) =>
      prev.map((r) => (r.central_trx_code === trxCode ? { ...r, audit_status: value } : r))
    );
    try {
      const res = await fetch(`${API_BASE}/pos/transactions-audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trx_code: trxCode,
          audit_status: value,
          audit_note: "",
          audited_by: getUsername(),
          source_page: "inquiry_penjualan",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
    } catch (err) {
      setRows((prev) =>
        prev.map((r) => (r.central_trx_code === trxCode ? { ...r, audit_status: prevStatus } : r))
      );
      alert("Gagal menyimpan audit.");
    } finally {
      setAuditSaving((prev) => ({ ...prev, [trxCode]: false }));
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterMethod.length > 0) params.set("method", filterMethod.join(","));
      if (filterCashier.length > 0) params.set("cashier", filterCashier.join(","));
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`${API_BASE}/pos/transactions-inquiry?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
        setHasFetched(true);
    } catch (err) {
      console.error("Failed fetch inquiry penjualan", err);
      setError("Gagal memuat inquiry penjualan.");
      setRows([]);
      setHasFetched(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Penjualan</p>
          <h1 className="text-2xl font-bold text-gray-900">Inquiry Penjualan</h1>
          <p className="text-sm text-gray-600 mt-1">Data transaksi dari table central.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2">
            <p className="text-[11px] uppercase tracking-wide text-emerald-700">Omset</p>
            <p className="text-sm font-semibold text-emerald-800">{formatIDR(totals.penjualan_total)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-600">Total Bersih</p>
            <p className="text-sm font-semibold text-slate-800">{formatIDR(totals.total_bersih)}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-2">
            <p className="text-[11px] uppercase tracking-wide text-emerald-700">Sesuai</p>
            <p className="text-sm font-semibold text-emerald-800">{auditSummary.sesuai}</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2">
            <p className="text-[11px] uppercase tracking-wide text-rose-700">Tidak Sesuai</p>
            <p className="text-sm font-semibold text-rose-800">{auditSummary.tidakSesuai}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-600">Belum Audit</p>
            <p className="text-sm font-semibold text-gray-800">{auditSummary.belum}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Tanggal dari
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Tanggal sampai
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Status
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[140px]"
            >
              <option value="all">Semua</option>
              <option value="Sukses">Sukses</option>
              <option value="Batal">Batal</option>
            </select>
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Metode
            <div className="relative" ref={methodRef}>
              <button
                type="button"
                onClick={() => setMethodOpen((prev) => !prev)}
                className="flex min-w-[180px] items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              >
                <span className="truncate">
                  {filterMethod.length === 0 ? "Semua" : `${filterMethod.length} dipilih`}
                </span>
                <span className="text-gray-400">▾</span>
              </button>
              {methodOpen && (
                <div className="absolute z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                  <label className="flex items-center gap-2 px-2 py-1 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={filterMethod.length === 0}
                      onChange={() => setFilterMethod([])}
                    />
                    Semua
                  </label>
                  <div className="my-1 h-px bg-gray-100" />
                  <div className="max-h-48 overflow-auto pr-1">
                    {methodOptions.map((name) => {
                      const checked = filterMethod.includes(name);
                      return (
                        <label key={name} className="flex items-center gap-2 px-2 py-1 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setFilterMethod((prev) =>
                                checked ? prev.filter((m) => m !== name) : [...prev, name]
                              )
                            }
                          />
                          <span className="truncate">{name}</span>
                        </label>
                      );
                    })}
                    {methodOptions.length === 0 && (
                      <div className="px-2 py-2 text-xs text-gray-500">Belum ada data metode.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Kasir
            <div className="relative" ref={cashierRef}>
              <button
                type="button"
                onClick={() => setCashierOpen((prev) => !prev)}
                className="flex min-w-[180px] items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              >
                <span className="truncate">
                  {filterCashier.length === 0 ? "Semua" : `${filterCashier.length} dipilih`}
                </span>
                <span className="text-gray-400">▾</span>
              </button>
              {cashierOpen && (
                <div className="absolute z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                  <label className="flex items-center gap-2 px-2 py-1 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={filterCashier.length === 0}
                      onChange={() => setFilterCashier([])}
                    />
                    Semua
                  </label>
                  <div className="my-1 h-px bg-gray-100" />
                  <div className="max-h-48 overflow-auto pr-1">
                    {cashierOptions.map((name) => {
                      const checked = filterCashier.includes(name);
                      return (
                        <label key={name} className="flex items-center gap-2 px-2 py-1 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setFilterCashier((prev) =>
                                checked ? prev.filter((c) => c !== name) : [...prev, name]
                              )
                            }
                          />
                          <span className="truncate">{name}</span>
                        </label>
                      );
                    })}
                    {cashierOptions.length === 0 && (
                      <div className="px-2 py-2 text-xs text-gray-500">Belum ada data kasir.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Search
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kode trx / customer"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[180px]"
            />
          </label>
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0f756b] text-white text-sm font-semibold shadow-sm hover:bg-[#0d6a62]"
          >
            Tampilkan
          </button>
          <button
            type="button"
            onClick={exportXlsx}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 disabled:opacity-50"
          >
            Export XLSX
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterFrom("");
              setFilterTo("");
              setFilterStatus("all");
              setFilterMethod([]);
              setFilterCashier([]);
              setSearch("");
              setRows([]);
              setError(null);
              setHasFetched(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-3" rowSpan={2}>
                  Waktu Transaksi
                </th>
                <th className="px-3 py-3" rowSpan={2}>
                  Kode Transaksi
                </th>
                <th className="px-3 py-3" rowSpan={2}>
                  Kode TRX
                </th>
                <th className="px-3 py-3" rowSpan={2}>
                  Customer
                </th>
                <th className="px-3 py-3" rowSpan={2}>
                  Kasir
                </th>
                <th className="px-3 py-3" rowSpan={2}>
                  Metode
                </th>
                <th className="px-3 py-3 text-right" rowSpan={2}>
                  Penjualan Total
                </th>
                <th className="px-3 py-3 text-right" rowSpan={2}>
                  Charge Transaksi (+)
                </th>
                <th className="px-3 py-3 text-center" colSpan={2}>
                  Potongan Diskon
                </th>
                <th className="px-3 py-3 text-right" rowSpan={2}>
                  Retur
                </th>
                <th className="px-3 py-3 text-right" rowSpan={2}>
                  Diskon Manual
                </th>
                <th className="px-3 py-3 text-right" rowSpan={2}>
                  Total Bersih
                </th>
                <th className="px-3 py-3 text-center" rowSpan={2}>
                  Audit
                </th>
              </tr>
              <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 text-right">Principle</th>
                <th className="px-3 py-2 text-right">Distributor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={14}>
                    Memuat data...
                  </td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td className="px-3 py-6 text-center text-rose-600" colSpan={14}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={14}>
                    {hasFetched ? "Belum ada data untuk ditampilkan." : "Klik Tampilkan untuk memuat data."}
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                rows.map((row) => (
                  <tr key={row.central_trx_code} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-700">{formatDateTime(row.created_at)}</td>
                    <td className="px-3 py-3 font-semibold text-gray-900">{row.central_trx_code}</td>
                    <td className="px-3 py-3 text-gray-700">{row.source_trx_code || "-"}</td>
                    <td className="px-3 py-3 text-gray-700">{row.customer_name || "-"}</td>
                    <td className="px-3 py-3 text-gray-700">{row.cashier_name || "-"}</td>
                    <td className="px-3 py-3 text-gray-700">{row.method || "-"}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{formatIDR(row.penjualan_total)}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{formatIDR(row.charge_transaksi)}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{formatIDR(row.diskon_principle)}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{formatIDR(row.diskon_distributor)}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{formatIDR(row.retur)}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{formatIDR(row.diskon_manual)}</td>
                    <td className="px-3 py-3 text-right text-gray-900">{formatIDR(row.total_bersih)}</td>
                    <td className="px-3 py-3 text-center">
                      {(() => {
                        const value =
                          row.audit_status === "SESUAI"
                            ? "SESUAI"
                            : row.audit_status === "TIDAK_SESUAI"
                              ? "TIDAK_SESUAI"
                              : "";
                        const cls =
                          value === "SESUAI"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : value === "TIDAK_SESUAI"
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-gray-200 bg-gray-50 text-gray-600";
                        return (
                          <select
                            value={value}
                            onChange={(e) => handleAuditChange(row, e.target.value)}
                            disabled={auditSaving[row.central_trx_code]}
                            className={`rounded-lg border px-2 py-1 text-xs font-semibold ${cls}`}
                          >
                            <option value="">Belum</option>
                            <option value="SESUAI">Sesuai</option>
                            <option value="TIDAK_SESUAI">Tidak Sesuai</option>
                          </select>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr className="border-t border-gray-200">
                  <td className="px-3 py-3 font-semibold text-gray-700" colSpan={6}>
                    Total
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">
                    {formatIDR(totals.penjualan_total)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">
                    {formatIDR(totals.charge_transaksi)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">
                    {formatIDR(totals.diskon_principle)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">
                    {formatIDR(totals.diskon_distributor)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">{formatIDR(totals.retur)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">
                    {formatIDR(totals.diskon_manual)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">
                    {formatIDR(totals.total_bersih)}
                  </td>
                  <td className="px-3 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
