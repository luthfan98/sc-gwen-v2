"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileDown, FileText, Printer, RefreshCcw, X } from "lucide-react";

type TransactionSummary = {
  central_trx_code: string;
  source_trx_code?: string | null;
  uniq_code?: string | null;
  source_kasir?: string | null;
  created_at: string;
  cashier_name: string | null;
  customer_name: string | null;
  customer_id: string | null;
  customer_phone: string | null;
  method: string | null;
  fee_rate?: number | null;
  fee_amount?: number | null;
  manual_discount?: number | null;
  manual_discount_note?: string | null;
  total: number | null;
  total_qty: number | null;
  status: string | null;
  discount: number | null;
  audit_status?: string | null;
  audit_note?: string | null;
  audited_by?: string | null;
  audited_at?: string | null;
};

type PromoUsageRow = {
  promo_code: string | null;
  promo_name: string | null;
  qty: number | null;
  discount: number | null;
  total: number | null;
};

type TransactionItemRow = {
  item_code: string | null;
  barcode: string | null;
  item_name: string | null;
  kode_supplier?: string | null;
  supplier_name?: string | null;
  kode_merk?: string | null;
  merk_name?: string | null;
  qty: number | null;
  unit_price: number | null;
  line_total: number | null;
  line_discount: number | null;
};

type LotteryCodeRow = {
  code: string | null;
  customer_name: string | null;
};

export default function HistoryTransaksiPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const FILTER_STORAGE_KEY = "history-transaksi-filters";
  const [rows, setRows] = useState<TransactionSummary[]>([]);
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
  const [filterCashier, setFilterCashier] = useState<string[]>([]);
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortTotal, setSortTotal] = useState<"none" | "asc" | "desc">("none");
  const [searchTerm, setSearchTerm] = useState("");
  const [hasFetched, setHasFetched] = useState(false);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [cashierOpen, setCashierOpen] = useState(false);
  const [exportingHeader, setExportingHeader] = useState(false);
  const [exportingDetail, setExportingDetail] = useState(false);
  const [auditNotes, setAuditNotes] = useState<Record<string, string>>({});
  const [auditSaving, setAuditSaving] = useState<Record<string, boolean>>({});
  const [exportDetailProgress, setExportDetailProgress] = useState<{
    open: boolean;
    total: number;
    done: number;
    current: string;
    errorCount: number;
    finished: boolean;
  }>({
    open: false,
    total: 0,
    done: 0,
    current: "",
    errorCount: 0,
    finished: false,
  });

  const [customerDetail, setCustomerDetail] = useState<TransactionSummary | null>(null);
  const [trxDetail, setTrxDetail] = useState<{
    trx: TransactionSummary;
    items: TransactionItemRow[];
    promos: PromoUsageRow[];
    lotteryCodes: LotteryCodeRow[];
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [promoDetail, setPromoDetail] = useState<{
    trxCode: string;
    promoRows: PromoUsageRow[];
    loading: boolean;
    error: string | null;
    totalDiscount?: number;
    manualDiscount?: number;
    manualNote?: string | null;
    promoDiscountSum?: number;
    otherDiscount?: number;
  } | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      const url = `${API_BASE}/pos/transactions-summary?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      setHasFetched(true);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Gagal memuat data.");
      setHasFetched(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.filterFrom) setFilterFrom(parsed.filterFrom);
      if (parsed?.filterTo) setFilterTo(parsed.filterTo);
      if (Array.isArray(parsed?.filterCashier)) setFilterCashier(parsed.filterCashier);
      if (parsed?.filterMethod) setFilterMethod(parsed.filterMethod);
      if (parsed?.filterStatus) setFilterStatus(parsed.filterStatus);
      if (parsed?.sortTotal) setSortTotal(parsed.sortTotal);
      if (parsed?.searchTerm !== undefined) setSearchTerm(parsed.searchTerm);
    } catch {
      // ignore malformed storage
    } finally {
      setFiltersHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!filtersHydrated) return;
    const payload = {
      filterFrom,
      filterTo,
      filterCashier,
      filterMethod,
      filterStatus,
      sortTotal,
      searchTerm,
    };
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(payload));
  }, [filterFrom, filterTo, filterCashier, filterMethod, filterStatus, sortTotal, searchTerm, filtersHydrated]);

  useEffect(() => {
    if (rows.length === 0) return;
    setAuditNotes((prev) => {
      const next = { ...prev };
      rows.forEach((row) => {
        if (row.central_trx_code && next[row.central_trx_code] === undefined) {
          next[row.central_trx_code] = row.audit_note || "";
        }
      });
      return next;
    });
  }, [rows]);

  useEffect(() => {
    const loadPromoDetail = async () => {
      if (!promoDetail) return;
      setPromoDetail((prev) => (prev ? { ...prev, loading: true, error: null } : prev));
      try {
        const url = `${API_BASE}/pos/promo-usage-by-trx?trx=${encodeURIComponent(
          promoDetail.trxCode
        )}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const promoRows = Array.isArray(data) ? data : [];
        const promoDiscountSum = promoRows.reduce((acc, row) => acc + Number(row.discount || 0), 0);
        setPromoDetail((prev) =>
          prev
            ? {
                ...prev,
                promoRows,
                promoDiscountSum,
                otherDiscount:
                  Number(prev.totalDiscount || 0) -
                  promoDiscountSum -
                  Number(prev.manualDiscount || 0),
                loading: false,
              }
            : prev
        );
      } catch (err: any) {
        setPromoDetail((prev) =>
          prev ? { ...prev, loading: false, error: err?.message || "Gagal memuat detail promo." } : prev
        );
      }
    };

    loadPromoDetail();
  }, [promoDetail?.trxCode, API_BASE]);

  useEffect(() => {
    const loadTrxDetail = async () => {
      if (!trxDetail) return;
      try {
        const [itemsRes, promosRes, lotteryRes] = await Promise.all([
          fetch(
            `${API_BASE}/pos/transaction-items-by-trx?trx=${encodeURIComponent(
              trxDetail.trx.central_trx_code
            )}`
          ),
          fetch(
            `${API_BASE}/pos/promo-usage-by-trx?trx=${encodeURIComponent(
              trxDetail.trx.central_trx_code
            )}`
          ),
          fetch(
            `${API_BASE}/pos/lottery-codes-by-trx?trx=${encodeURIComponent(
              trxDetail.trx.central_trx_code
            )}`
          ),
        ]);
        if (!itemsRes.ok) throw new Error(`HTTP ${itemsRes.status}`);
        if (!promosRes.ok) throw new Error(`HTTP ${promosRes.status}`);
        if (!lotteryRes.ok) throw new Error(`HTTP ${lotteryRes.status}`);
        const items = await itemsRes.json();
        const promos = await promosRes.json();
        const lotteryCodes = await lotteryRes.json();
        setTrxDetail((prev) =>
          prev
            ? {
                ...prev,
                items: Array.isArray(items) ? items : [],
                promos: Array.isArray(promos) ? promos : [],
                lotteryCodes: Array.isArray(lotteryCodes) ? lotteryCodes : [],
                loading: false,
                error: null,
              }
            : prev
        );
      } catch (err: any) {
        setTrxDetail((prev) =>
          prev ? { ...prev, loading: false, error: err?.message || "Gagal memuat detail." } : prev
        );
      }
    };

    loadTrxDetail();
  }, [trxDetail?.trx.central_trx_code, API_BASE]);

  const formatDateTime = (value: string | null) => {
    if (!value) return "-";
    const cleaned = value.replace("T", " ").trim();
    const [datePart, timePartRaw] = cleaned.split(" ");
    if (!datePart) return value;
    const [yyyy, mm, dd] = datePart.split("-");
    if (!yyyy || !mm || !dd) return value;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    const monthName = months[Number(mm) - 1] ?? mm;
    let timePart = timePartRaw || "00:00:00";
    if (timePart.includes(".")) timePart = timePart.split(".")[0];
    const [hh = "00", min = "00"] = timePart.split(":");
    return `${dd} ${monthName} ${yyyy}, ${hh}.${min}`;
  };

  const formatIDR = (value: number | string | null) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(
      Number(value || 0)
    );

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

  const saveAudit = async (trx: TransactionSummary, status: "SESUAI" | "TIDAK_SESUAI") => {
    const trxCode = trx.central_trx_code;
    if (!trxCode) return;
    setAuditSaving((prev) => ({ ...prev, [trxCode]: true }));
    try {
      const res = await fetch(`${API_BASE}/pos/transactions-audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trx_code: trxCode,
          audit_status: status,
          audit_note: auditNotes[trxCode] || "",
          audited_by: getUsername(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      setRows((prev) =>
        prev.map((row) =>
          row.central_trx_code === trxCode
            ? {
                ...row,
                audit_status: status,
                audit_note: auditNotes[trxCode] || "",
                audited_by: getUsername(),
                audited_at: new Date().toISOString(),
              }
            : row
        )
      );
    } catch (err) {
      console.error("Failed save audit", err);
      alert("Gagal simpan audit");
    } finally {
      setAuditSaving((prev) => ({ ...prev, [trxCode]: false }));
    }
  };

  const escapeCsvValue = (value: string | number | null | undefined) => {
    const raw = value === null || value === undefined ? "" : String(value);
    if (raw.includes('"') || raw.includes(",") || raw.includes("\n")) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const getDeviceLabel = (trx: TransactionSummary) => {
    const sourceKasir = String(trx.source_kasir || "").trim();
    if (!sourceKasir) return "-";
    return sourceKasir;
  };

  const downloadCsv = (filename: string, rowsCsv: Array<Array<string | number | null | undefined>>) => {
    const lines = rowsCsv.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
    const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportHeader = () => {
    setExportingHeader(true);
    try {
      const filename = `header-transaksi-${filterFrom || "all"}-${filterTo || "all"}.csv`;
      const rowsCsv: Array<Array<string | number | null | undefined>> = [
        [
          "Trx Code",
          "Tanggal",
          "Kasir",
          "Customer",
          "Phone",
          "Metode",
          "Charge",
          "Total",
          "Total Qty",
          "Status",
          "Diskon",
        ],
        ...filteredRows.map((row) => [
          row.central_trx_code,
          row.created_at,
          row.cashier_name,
          row.customer_name,
          row.customer_phone,
          row.method,
          row.fee_amount,
          row.total,
          row.total_qty,
          row.status,
          row.discount,
        ]),
      ];
      downloadCsv(filename, rowsCsv);
    } finally {
      setExportingHeader(false);
    }
  };

  const handleExportDetail = async () => {
    if (filteredRows.length === 0) return;
    setExportingDetail(true);
    setExportDetailProgress({
      open: true,
      total: 3,
      done: 0,
      current: "Menyiapkan export...",
      errorCount: 0,
      finished: false,
    });
    try {
      const filename = `detail-penjualan-${filterFrom || "all"}-${filterTo || "all"}.csv`;
      const rowsCsv: Array<Array<string | number | null | undefined>> = [
        [
          "Trx Code",
          "Tanggal",
          "Kasir",
          "Customer",
          "Phone",
          "Metode",
          "Status",
          "Nama Item",
          "Barcode",
          "Supplier",
          "Merk",
          "Qty",
          "Harga",
          "Diskon Item",
          "Total",
          "Kode Promo",
        ],
      ];

      const params = new URLSearchParams();
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      if (filterCashier.length > 0) params.set("cashier", filterCashier.join(","));
      if (filterMethod !== "all") params.set("method", filterMethod);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      if (sortTotal !== "none") params.set("sort_total", sortTotal);

      setExportDetailProgress((prev) => ({
        ...prev,
        done: 0,
        current: "Mengambil data dari server...",
      }));

      const res = await fetch(`${API_BASE}/pos/transactions-detail-export?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const detailRows = Array.isArray(data) ? data : [];

      setExportDetailProgress((prev) => ({
        ...prev,
        done: 1,
        current: `Menyusun file (${detailRows.length.toLocaleString("id-ID")} baris)`,
      }));

      detailRows.forEach((row: any) => {
        rowsCsv.push([
          row.central_trx_code,
          row.created_at,
          row.cashier_name,
          row.customer_name,
          row.customer_phone,
          row.method,
          row.status,
          row.item_name,
          row.barcode,
          row.supplier_name || row.kode_supplier || "",
          row.merk_name || row.kode_merk || "",
          row.qty,
          row.unit_price,
          row.line_discount,
          row.line_total,
          row.promo_codes || "",
        ]);
      });

      setExportDetailProgress((prev) => ({
        ...prev,
        done: 2,
        current: "Mengunduh file...",
      }));

      downloadCsv(filename, rowsCsv);
    } catch (err) {
      console.error("Failed export detail", err);
      setExportDetailProgress((prev) => ({
        ...prev,
        errorCount: prev.errorCount + 1,
        current: "Gagal mengambil data",
      }));
      alert("Gagal export detail. Silakan coba lagi.");
    } finally {
      setExportingDetail(false);
      setExportDetailProgress((prev) => ({
        ...prev,
        done: prev.total,
        finished: true,
        current: "",
      }));
    }
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const headerRows = filteredRows
      .map(
        (row, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${row.central_trx_code || ""}</td>
            <td>${formatDateTime(row.created_at)}</td>
            <td>${row.cashier_name || ""}</td>
            <td>${row.customer_name || ""}</td>
            <td>${row.method || ""}</td>
            <td>${formatIDR(row.total || 0)}</td>
            <td>${formatIDR(row.fee_amount || 0)}</td>
            <td>${Number(row.total_qty || 0)}</td>
            <td>${row.status || ""}</td>
            <td>${formatIDR(row.discount || 0)}</td>
          </tr>
        `
      )
      .join("");
    const html = `
      <html>
        <head>
          <title>History Transaksi</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            h2 { margin: 0 0 12px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background: #f3f4f6; text-transform: uppercase; font-size: 10px; letter-spacing: 0.12em; }
          </style>
        </head>
        <body>
          <h2>History Transaksi</h2>
          <div>Periode: ${filterFrom || "-"} s/d ${filterTo || "-"}</div>
          <br />
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Trx Code</th>
                <th>Tanggal</th>
                <th>Kasir</th>
                <th>Customer</th>
                <th>Metode</th>
                <th>Total</th>
                <th>Charge</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Diskon</th>
              </tr>
            </thead>
            <tbody>
              ${headerRows}
            </tbody>
          </table>
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const columns = useMemo(
    () => [
      "No",
      "Trx Code",
      "Source Trx",
      "Uniq Code",
      "Device",
      "Tanggal",
      "Nama Kasir",
      "Nama Customer",
      "Metode Bayar",
      "Total Transaksi",
      "Charge",
      "Total Qty",
      "Status Transaksi",
      "Nominal Diskon",
      "Audit",
      "Detail",
    ],
    []
  );

  const cashierOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      if (row.cashier_name) set.add(row.cashier_name);
    });
    return Array.from(set).sort();
  }, [rows]);

  const methodOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      if (row.method) set.add(row.method);
    });
    return Array.from(set).sort();
  }, [rows]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      if (row.status) set.add(row.status);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const getDatePart = (value: string | null) => {
      if (!value) return null;
      const cleaned = value.replace("T", " ").trim();
      const [datePart] = cleaned.split(" ");
      return datePart || null;
    };

    const fromDate = filterFrom || null;
    const toDate = filterTo || null;

    const term = searchTerm.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const datePart = getDatePart(row.created_at);
      if (fromDate && datePart && datePart < fromDate) return false;
      if (toDate && datePart && datePart > toDate) return false;
      if (filterCashier.length > 0 && !filterCashier.includes(String(row.cashier_name || ""))) return false;
      if (filterMethod !== "all" && row.method !== filterMethod) return false;
      if (filterStatus !== "all" && row.status !== filterStatus) return false;
      if (term) {
        const haystack = [
          row.central_trx_code,
          row.source_trx_code,
          row.uniq_code,
          row.source_kasir,
          getDeviceLabel(row),
          row.cashier_name,
          row.customer_name,
          row.customer_id,
          row.customer_phone,
          row.method,
          row.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
    if (sortTotal === "none") return filtered;
    const multiplier = sortTotal === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => (Number(a.total || 0) - Number(b.total || 0)) * multiplier);
  }, [rows, filterFrom, filterTo, filterCashier, filterMethod, filterStatus, sortTotal, searchTerm]);

  const totalTransaksiSum = useMemo(
    () => filteredRows.reduce((acc, r) => acc + Number(r.total || 0), 0),
    [filteredRows]
  );
  const totalDiskonSum = useMemo(
    () => filteredRows.reduce((acc, r) => acc + Number(r.discount || 0), 0),
    [filteredRows]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-100 bg-white/90 shadow-sm px-6 py-5 md:px-7 md:py-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Menu Transaksi</p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">History Transaksi</h1>
            <p className="text-sm text-slate-500">Data header transaksi dari pusat.</p>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400">Transaksi Sukses</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatIDR(
              filteredRows
                .filter((r) => (r.status || "").toLowerCase() === "sukses")
                .reduce((acc, r) => acc + Number(r.total || 0), 0)
            )}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {filteredRows.filter((r) => (r.status || "").toLowerCase() === "sukses").length} Nota
          </p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total Diskon</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatIDR(filteredRows.reduce((acc, r) => acc + Number(r.discount || 0), 0))}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400">Transaksi Batal</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatIDR(
              filteredRows
                .filter((r) => (r.status || "").toLowerCase() !== "sukses")
                .reduce((acc, r) => acc + Number(r.total || 0), 0)
            )}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {filteredRows.filter((r) => (r.status || "").toLowerCase() !== "sukses").length} Nota
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Data</p>
            <p className="text-base font-semibold text-slate-800">Header Transaksi</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={!hasFetched || filteredRows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              type="button"
              onClick={handleExportHeader}
              disabled={!hasFetched || exportingHeader || filteredRows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <FileDown className="w-4 h-4" />
              {exportingHeader ? "Exporting..." : "Export Header"}
            </button>
            <button
              type="button"
              onClick={handleExportDetail}
              disabled={!hasFetched || exportingDetail || filteredRows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 shadow-sm hover:bg-amber-100 disabled:opacity-60"
            >
              <FileDown className="w-4 h-4" />
              {exportingDetail ? "Exporting..." : "Export Detail"}
            </button>
            <button
              type="button"
              onClick={fetchRows}
              disabled={!hasFetched}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Pencarian</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari trx, kasir, customer, phone..."
                className="w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Tanggal Dari</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Tanggal Sampai</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Nama Kasir</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCashierOpen((prev) => !prev)}
                  className="flex w-56 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
                >
                  <span className="truncate">
                    {filterCashier.length === 0 ? "Semua" : `${filterCashier.length} dipilih`}
                  </span>
                  <span className="text-slate-400">▾</span>
                </button>
                {cashierOpen && (
                  <div className="absolute z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    <label className="flex items-center gap-2 px-2 py-1 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={filterCashier.length === 0}
                        onChange={() => setFilterCashier([])}
                      />
                      Semua
                    </label>
                    <div className="my-1 h-px bg-slate-100" />
                    <div className="max-h-48 overflow-auto pr-1">
                      {cashierOptions.map((name) => {
                        const checked = filterCashier.includes(name);
                        return (
                          <label key={name} className="flex items-center gap-2 px-2 py-1 text-xs text-slate-700">
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
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Metode Bayar</label>
              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
              >
                <option value="all">Semua</option>
                {methodOptions.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Status Transaksi</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
              >
                <option value="all">Semua</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Total Transaksi</label>
              <select
                value={sortTotal}
                onChange={(e) => setSortTotal(e.target.value as "none" | "asc" | "desc")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
              >
                <option value="none">Default</option>
                <option value="asc">ASC</option>
                <option value="desc">DESC</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] uppercase tracking-widest text-slate-400">Tampilkan</label>
              <button
                type="button"
                onClick={fetchRows}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-700 shadow-sm hover:bg-teal-100 disabled:opacity-60"
              >
                {loading ? "Memuat..." : "Tampilkan"}
              </button>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Filter tanggal otomatis dari jam 00:00 sampai 23:59.
          </div>
        </div>

        {!hasFetched ? (
          <div className="py-10 text-center text-sm text-gray-500">
            Klik tombol <span className="font-semibold">Tampilkan</span> untuk memuat data.
          </div>
        ) : loading ? (
          <div className="w-full overflow-auto max-h-[60vh]">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest sticky top-0 z-10">
                <tr>
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-3">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="px-3 py-3" colSpan={columns.length}>
                      <div className="h-4 w-full rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="py-10 text-center text-sm text-rose-600">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">Tidak ada data.</div>
        ) : (
          <div className="w-full overflow-auto max-h-[60vh]">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest sticky top-0 z-10">
                <tr>
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-3">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, idx) => (
                  <tr
                    key={row.central_trx_code}
                    className={`hover:bg-slate-50 ${
                      (row.status || "").toLowerCase() !== "sukses"
                        ? "bg-rose-200/60"
                        : idx % 2 === 0
                        ? "bg-white"
                        : "bg-slate-50/40"
                    }`}
                  >
                    <td className="px-3 py-2 text-gray-700">{idx + 1}</td>
                    <td className="px-3 py-2 text-gray-700">{row.central_trx_code}</td>
                    <td className="px-3 py-2 text-gray-700">{row.source_trx_code || "-"}</td>
                    <td className="px-3 py-2 text-gray-700">{row.uniq_code || "-"}</td>
                    <td className="px-3 py-2 text-gray-700">{getDeviceLabel(row)}</td>
                    <td className="px-3 py-2 text-gray-700">{formatDateTime(row.created_at)}</td>
                    <td className="px-3 py-2 text-gray-700">{row.cashier_name || "-"}</td>
                    <td className="px-3 py-2 text-gray-700">
                      <button
                        type="button"
                        onClick={() => setCustomerDetail(row)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {row.customer_name || "-"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{row.method || "-"}</td>
                    <td className="px-3 py-2 text-gray-700">{formatIDR(row.total || 0)}</td>
                    <td className="px-3 py-2 text-gray-700">{formatIDR(row.fee_amount || 0)}</td>
                    <td className="px-3 py-2 text-gray-700">{Number(row.total_qty || 0)}</td>
                    <td className="px-3 py-2 text-gray-700">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          row.status?.toLowerCase() === "sukses"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-600 text-yellow-200"
                        }`}
                      >
                        {row.status || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      <button
                        type="button"
                        onClick={() =>
                          setPromoDetail({
                            trxCode: row.central_trx_code,
                            promoRows: [],
                            loading: true,
                            error: null,
                            totalDiscount: Number(row.discount || 0),
                            manualDiscount: Number(row.manual_discount || 0),
                            manualNote: row.manual_discount_note || null,
                            promoDiscountSum: 0,
                            otherDiscount:
                              Number(row.discount || 0) - Number(row.manual_discount || 0),
                          })
                        }
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {formatIDR(row.discount || 0)}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveAudit(row, "SESUAI")}
                          disabled={auditSaving[row.central_trx_code]}
                          className={`rounded-full px-3 py-1 text-[10px] font-semibold border ${
                            row.audit_status === "SESUAI"
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                          }`}
                        >
                          Sesuai
                        </button>
                        <button
                          type="button"
                          onClick={() => saveAudit(row, "TIDAK_SESUAI")}
                          disabled={auditSaving[row.central_trx_code]}
                          className={`rounded-full px-3 py-1 text-[10px] font-semibold border ${
                            row.audit_status === "TIDAK_SESUAI"
                              ? "bg-rose-600 text-white border-rose-600"
                              : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                          }`}
                        >
                          Tidak Sesuai
                        </button>
                        <input
                          type="text"
                          placeholder="Catatan audit"
                          value={auditNotes[row.central_trx_code] ?? ""}
                          onChange={(e) =>
                            setAuditNotes((prev) => ({
                              ...prev,
                              [row.central_trx_code]: e.target.value,
                            }))
                          }
                          className="min-w-[180px] rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-700"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      <Link
                        href={`/admin/transaksi/history/${encodeURIComponent(row.central_trx_code)}`}
                        className="inline-flex items-center rounded-full border border-amber-700 bg-amber-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-amber-700"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/90 text-slate-700 sticky bottom-0 z-10">
                <tr className="border-t border-slate-200">
                  <td className="px-3 py-3 font-semibold" colSpan={9}>
                    Total
                  </td>
                  <td className="px-3 py-3 font-semibold">{formatIDR(totalTransaksiSum)}</td>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 font-semibold">{formatIDR(totalDiskonSum)}</td>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {customerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Detail Customer</h2>
              <button
                type="button"
                onClick={() => setCustomerDetail(null)}
                className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Nama:</span> {customerDetail.customer_name || "-"}
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">ID Customer:</span> {customerDetail.customer_id || "-"}
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Phone:</span> {customerDetail.customer_phone || "-"}
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setCustomerDetail(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {trxDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-6xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Detail Transaksi</h2>
                <p className="text-xs text-slate-500">{trxDetail.trx.central_trx_code}</p>
              </div>
              <button
                type="button"
                onClick={() => setTrxDetail(null)}
                className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-slate-500">Tanggal:</span>{" "}
                  {formatDateTime(trxDetail.trx.created_at)}
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-slate-500">Kasir:</span> {trxDetail.trx.cashier_name || "-"}
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-slate-500">Metode Bayar:</span> {trxDetail.trx.method || "-"}
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-slate-500">Total Transaksi:</span>{" "}
                  {formatIDR(trxDetail.trx.total || 0)}
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-slate-500">Total Qty:</span>{" "}
                  {Number(trxDetail.trx.total_qty || 0)}
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-slate-500">Diskon:</span>{" "}
                  {formatIDR(trxDetail.trx.discount || 0)}
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-slate-500">Diskon Manual:</span>{" "}
                  {formatIDR(trxDetail.trx.manual_discount || 0)}
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 md:col-span-2">
                  <span className="text-slate-500">Catatan Diskon Manual:</span>{" "}
                  {trxDetail.trx.manual_discount_note || "-"}
                </div>
              </div>

              {trxDetail.loading ? (
                <div className="py-6 text-center text-sm text-slate-500">Memuat detail transaksi...</div>
              ) : trxDetail.error ? (
                <div className="py-6 text-center text-sm text-rose-600">{trxDetail.error}</div>
              ) : (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">Items</p>
                    <div className="mt-2 w-full overflow-auto">
                      <table className="w-full min-w-[700px] text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest">
                          <tr>
                            <th className="px-3 py-2">Nama Item</th>
                            <th className="px-3 py-2">Barcode</th>
                            <th className="px-3 py-2">Qty</th>
                            <th className="px-3 py-2">Harga</th>
                            <th className="px-3 py-2">Diskon</th>
                            <th className="px-3 py-2">Kode Promo</th>
                            <th className="px-3 py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {trxDetail.items.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-3 py-3 text-center text-slate-500">
                                Tidak ada item.
                              </td>
                            </tr>
                          ) : (
                            trxDetail.items.map((item, idx) => {
                              const promoCodes =
                                trxDetail.promos.length === 0
                                  ? "-"
                                  : Array.from(
                                      new Set(
                                        trxDetail.promos
                                          .map((promo) => promo.promo_code || "")
                                          .filter(Boolean)
                                      )
                                    ).join(", ");
                              return (
                                <tr key={`${item.item_code ?? "item"}-${idx}`}>
                                  <td className="px-3 py-2 text-slate-700">{item.item_name || "-"}</td>
                                  <td className="px-3 py-2 text-slate-700">{item.barcode || "-"}</td>
                                  <td className="px-3 py-2 text-slate-700">{item.qty ?? 0}</td>
                                  <td className="px-3 py-2 text-slate-700">
                                    {formatIDR(item.unit_price || 0)}
                                  </td>
                                  <td className="px-3 py-2 text-slate-700">
                                    {formatIDR(item.line_discount || 0)}
                                  </td>
                                  <td className="px-3 py-2 text-slate-700">{promoCodes}</td>
                                  <td className="px-3 py-2 text-slate-700">
                                    {formatIDR(item.line_total || 0)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {trxDetail.promos.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400">Promosi</p>
                      <div className="mt-2 w-full overflow-auto">
                        <table className="w-full min-w-[600px] text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest">
                            <tr>
                              <th className="px-3 py-2">Nama Promo</th>
                              <th className="px-3 py-2">Qty</th>
                              <th className="px-3 py-2">Kode Promo</th>
                              <th className="px-3 py-2">Diskon</th>
                              <th className="px-3 py-2">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {trxDetail.promos.map((promo, idx) => (
                              <tr key={`${promo.promo_code ?? "promo"}-${idx}`}>
                                <td className="px-3 py-2 text-slate-700">{promo.promo_name || "-"}</td>
                                <td className="px-3 py-2 text-slate-700">{promo.qty ?? 0}</td>
                                <td className="px-3 py-2 text-slate-700">{promo.promo_code || "-"}</td>
                                <td className="px-3 py-2 text-slate-700">
                                  {formatIDR(promo.discount || 0)}
                                </td>
                                <td className="px-3 py-2 text-slate-700">
                                  {formatIDR(promo.total || 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {trxDetail.lotteryCodes.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400">Kode Undian</p>
                      <div className="mt-2 w-full overflow-auto">
                        <table className="w-full min-w-[500px] text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest">
                            <tr>
                              <th className="px-3 py-2">Kode</th>
                              <th className="px-3 py-2">Customer</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {trxDetail.lotteryCodes.map((lot, idx) => (
                              <tr key={`${lot.code ?? "lot"}-${idx}`}>
                                <td className="px-3 py-2 text-slate-700">{lot.code || "-"}</td>
                                <td className="px-3 py-2 text-slate-700">
                                  {lot.customer_name || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setTrxDetail(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {promoDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Detail Diskon</h2>
                <p className="text-xs text-slate-500">{promoDetail.trxCode}</p>
              </div>
              <button
                type="button"
                onClick={() => setPromoDetail(null)}
                className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              {promoDetail.loading ? (
                <div className="py-6 text-center text-sm text-gray-500">Memuat detail promo...</div>
              ) : promoDetail.error ? (
                <div className="py-6 text-center text-sm text-rose-600">{promoDetail.error}</div>
              ) : promoDetail.promoRows.length === 0 ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="text-slate-500">Diskon Total:</span>{" "}
                    {formatIDR(promoDetail.totalDiscount || 0)}
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="text-slate-500">Diskon Promo:</span>{" "}
                    {formatIDR(promoDetail.promoDiscountSum || 0)}
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="text-slate-500">Diskon Lainnya:</span>{" "}
                    {formatIDR(promoDetail.otherDiscount || 0)}
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="text-slate-500">Diskon Manual:</span>{" "}
                    {formatIDR(promoDetail.manualDiscount || 0)}
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="text-slate-500">Catatan Manual:</span>{" "}
                    {promoDetail.manualNote || "-"}
                  </div>
                  <div className="py-2 text-center text-sm text-gray-500">Tidak ada detail promo.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <span className="text-slate-500">Diskon Total:</span>{" "}
                      {formatIDR(promoDetail.totalDiscount || 0)}
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <span className="text-slate-500">Diskon Promo:</span>{" "}
                      {formatIDR(promoDetail.promoDiscountSum || 0)}
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <span className="text-slate-500">Diskon Lainnya:</span>{" "}
                      {formatIDR(promoDetail.otherDiscount || 0)}
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <span className="text-slate-500">Diskon Manual:</span>{" "}
                      {formatIDR(promoDetail.manualDiscount || 0)}
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 md:col-span-2">
                      <span className="text-slate-500">Catatan Manual:</span>{" "}
                      {promoDetail.manualNote || "-"}
                    </div>
                  </div>
                  <div className="w-full overflow-auto">
                    <table className="w-full min-w-[600px] text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest">
                        <tr>
                          <th className="px-3 py-2">Kode Promo</th>
                          <th className="px-3 py-2">Nama Promo</th>
                          <th className="px-3 py-2">Qty</th>
                          <th className="px-3 py-2">Diskon</th>
                          <th className="px-3 py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {promoDetail.promoRows.map((row, idx) => (
                          <tr key={`${row.promo_code ?? "promo"}-${idx}`} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700">{row.promo_code || "-"}</td>
                            <td className="px-3 py-2 text-gray-700">{row.promo_name || "-"}</td>
                            <td className="px-3 py-2 text-gray-700">{row.qty ?? 0}</td>
                            <td className="px-3 py-2 text-gray-700">{formatIDR(row.discount || 0)}</td>
                            <td className="px-3 py-2 text-gray-700">{formatIDR(row.total || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setPromoDetail(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {exportDetailProgress.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Export Detail Penjualan</h2>
                <p className="text-xs text-slate-500">
                  {exportDetailProgress.finished ? "Selesai" : "Sedang memproses..."}
                </p>
              </div>
              {exportDetailProgress.finished && (
                <button
                  type="button"
                  onClick={() =>
                    setExportDetailProgress((prev) => ({
                      ...prev,
                      open: false,
                    }))
                  }
                  className="rounded-full border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Progress:</span>{" "}
                {exportDetailProgress.done} / {exportDetailProgress.total}
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Trx:</span>{" "}
                {exportDetailProgress.current || (exportDetailProgress.finished ? "-" : "Memulai")}
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Error:</span> {exportDetailProgress.errorCount}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-teal-500 transition-all"
                  style={{
                    width:
                      exportDetailProgress.total > 0
                        ? `${Math.round((exportDetailProgress.done / exportDetailProgress.total) * 100)}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
            {exportDetailProgress.finished && (
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setExportDetailProgress((prev) => ({
                      ...prev,
                      open: false,
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
