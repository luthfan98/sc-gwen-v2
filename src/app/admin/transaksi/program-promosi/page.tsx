"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { Download, Printer, Search } from "lucide-react";

type Option = { value: string; label: string };

const ALL_SUPPLIERS_OPTION: Option = { value: "__ALL_SUPPLIERS__", label: "All Supplier" };

type PromoUsageRow = {
  item_key?: string | null;
  trx_first_at?: string | null;
  trx_last_at?: string | null;
  trx_codes?: string | null;
  item_name?: string | null;
  unit_price?: number | null;
  promo_discount_per_item?: number | null;
  qty?: number | null;
  total_discount?: number | null;
  diskon_persen?: number | null;
  diskon_nominal?: number | null;
};

type Summary = {
  total_penggunaan: number;
  total_qty: number;
  total_nominal: number;
  budget_total: number | null;
  budget_sisa: number | null;
  budget_persen_sisa: number | null;
};

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

export default function ProgramPromosiPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [supplierOptions, setSupplierOptions] = useState<Option[]>([]);
  const [promoOptions, setPromoOptions] = useState<Option[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Option | null>(null);
  const [selectedPromo, setSelectedPromo] = useState<Option | null>(null);
  const [filterFrom, setFilterFrom] = useState(() => getPastDateStr(30));
  const [filterTo, setFilterTo] = useState(() => getTodayStr());
  const [rows, setRows] = useState<PromoUsageRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [openTrx, setOpenTrx] = useState<Record<string, boolean>>({});
  const isAllSupplierSelected = selectedSupplier?.value === ALL_SUPPLIERS_OPTION.value;

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/pos/suppliers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const options = (Array.isArray(data) ? data : [])
        .filter((s) => String(s?.kode_supplier || "").trim())
        .map((s) => ({ value: String(s.kode_supplier), label: String(s.nama || s.kode_supplier) }))
        .sort((a, b) => a.label.localeCompare(b.label, "id"));
      setSupplierOptions(options);
    } catch (err) {
      console.error("Failed fetch suppliers", err);
      setSupplierOptions([]);
    }
  }, [API_BASE]);

  const fetchPromoOptions = useCallback(
    async (kodeSupplier?: string) => {
      try {
        const url = kodeSupplier
          ? `${API_BASE}/pos/promo-program-options?kode_supplier=${encodeURIComponent(kodeSupplier)}`
          : `${API_BASE}/pos/promo-program-options`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options = (Array.isArray(data) ? data : [])
          .filter((p) => String(p?.kode_t_promosi || "").trim())
          .map((p) => ({
            value: String(p.kode_t_promosi),
            label: `${
              p.nama_promosi || p.kode_t_promosi
            } ${p.valid_from && p.valid_to ? `(${new Date(p.valid_from).toLocaleDateString("id-ID")} - ${new Date(p.valid_to).toLocaleDateString("id-ID")})` : ""}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, "id"));
        setPromoOptions(options);
      } catch (err) {
        console.error("Failed fetch promo options", err);
        setPromoOptions([]);
      }
    },
    [API_BASE]
  );

  useEffect(() => {
    fetchSuppliers();
    fetchPromoOptions();
  }, [fetchSuppliers, fetchPromoOptions]);

  useEffect(() => {
    if (selectedSupplier?.value && selectedSupplier.value !== ALL_SUPPLIERS_OPTION.value) {
      fetchPromoOptions(selectedSupplier.value);
    } else {
      fetchPromoOptions();
    }
    setSelectedPromo(null);
  }, [selectedSupplier, fetchPromoOptions]);

  const handleApply = async () => {
    setApplied(true);
    if (!isAllSupplierSelected && !selectedSupplier?.value && !selectedPromo?.value) {
      setError("Pilih supplier atau program promosi terlebih dahulu.");
      setRows([]);
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (isAllSupplierSelected) {
        params.set("all_supplier", "1");
      } else if (selectedSupplier?.value) {
        params.set("kode_supplier", selectedSupplier.value);
      }
      if (selectedPromo?.value) params.set("kode_promosi", selectedPromo.value);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      const res = await fetch(`${API_BASE}/pos/promo-usage-report?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data?.items) ? data.items : []);
      setSummary(data?.summary ?? null);
    } catch (err) {
      console.error("Failed fetch promo report", err);
      setError("Gagal memuat data promosi.");
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!rows.length) return;
    const headers = [
      "Tanggal",
      "Kode TRX",
      "Nama Item",
      "Harga Jual Satuan",
      "Nominal Promo",
      "Jenis Potongan",
      "QTY",
      "Total Diskon",
    ];
    const lines = [headers.join(",")];
    rows.forEach((row) => {
      const values = [
        formatPeriode(row.trx_first_at, row.trx_last_at),
        row.trx_codes || "-",
        row.item_name || "",
        Number(row.unit_price ?? 0),
        Number(row.promo_discount_per_item ?? 0),
        getJenisPotongan(row),
        Number(row.qty ?? 0),
        Number(row.total_discount ?? 0),
      ].map((value) => {
        const str = String(value ?? "");
        return `"${str.replace(/"/g, '""')}"`;
      });
      lines.push(values.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `program-promosi.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatPeriode = (first?: string | null, last?: string | null) => {
    const firstFmt = formatTanggal(first);
    const lastFmt = formatTanggal(last);
    if (!firstFmt && !lastFmt) return "";
    if (firstFmt && (!lastFmt || lastFmt === firstFmt)) return firstFmt;
    if (!firstFmt && lastFmt) return lastFmt;
    return `${firstFmt} - ${lastFmt}`;
  };

  const splitTrxCodes = (value?: string | null) => {
    if (!value) return [];
    return String(value)
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);
  };

  const getRowKey = (row: PromoUsageRow, idx: number) =>
    String(row.item_key || row.item_name || `row-${idx}`);

  const formatTanggal = (value?: string | null) => {
    if (!value) return "";
    let raw = String(value).trim();
    if (!raw) return "";
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

  const getJenisPotongan = (row: PromoUsageRow) => {
    const persen = Number(row.diskon_persen ?? 0);
    const nominal = Number(row.diskon_nominal ?? 0);
    if (persen > 0) {
      return `${persen.toLocaleString("id-ID")}%`;
    }
    if (nominal > 0) {
      return `Rp ${nominal.toLocaleString("id-ID")}`;
    }
    const unitPrice = Number(row.unit_price ?? 0);
    const promoPerItem = Number(row.promo_discount_per_item ?? 0);
    if (unitPrice > 0 && promoPerItem > 0) {
      const pct = (promoPerItem / unitPrice) * 100;
      if (pct > 0 && pct <= 100) {
        const text = pct.toFixed(2).replace(/\.00$/, "");
        return `${text}%`;
      }
    }
    if (promoPerItem > 0) {
      return `Rp ${promoPerItem.toLocaleString("id-ID")}`;
    }
    return "-";
  };

  const formatIDR = (value: number | string | null | undefined) =>
    `Rp ${Number(value ?? 0).toLocaleString("id-ID")}`;

  const handlePrint = () => {
    if (!rows.length) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const headerRows = rows
      .map(
        (row, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${formatPeriode(row.trx_first_at, row.trx_last_at) || "-"}</td>
            <td>${row.trx_codes || "-"}</td>
            <td>${row.item_name || "-"}</td>
            <td>${formatIDR(row.unit_price ?? 0)}</td>
            <td>${formatIDR(row.promo_discount_per_item ?? 0)}</td>
            <td>${getJenisPotongan(row)}</td>
            <td>${Number(row.qty ?? 0).toLocaleString("id-ID")}</td>
            <td>${formatIDR(row.total_discount ?? 0)}</td>
          </tr>
        `
      )
      .join("");
    const html = `
      <html>
        <head>
          <title>Program Promosi</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            h2 { margin: 0 0 12px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; text-transform: uppercase; font-size: 10px; letter-spacing: 0.12em; }
            .meta { margin-bottom: 12px; font-size: 12px; }
            .meta div { margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <h2>Laporan Program Promosi</h2>
          <div class="meta">
            <div>Supplier: ${selectedSupplier?.label || "-"}</div>
            <div>Program: ${selectedPromo?.label || "-"}</div>
            <div>Periode: ${filterFrom || "-"} s/d ${filterTo || "-"}</div>
            <div>Dicetak: ${new Date().toLocaleString("id-ID")}</div>
          </div>
          ${
            summary
              ? `
            <div class="meta">
              <div>Total Penggunaan: ${(summary.total_penggunaan ?? 0).toLocaleString("id-ID")} trx</div>
              <div>Total Qty: ${(summary.total_qty ?? 0).toLocaleString("id-ID")}</div>
              <div>Total Nominal: ${formatIDR(summary.total_nominal ?? 0)}</div>
              <div>Budget: ${
                summary.budget_total !== null ? formatIDR(summary.budget_total ?? 0) : "-"
              }</div>
              <div>Sisa: ${
                summary.budget_sisa !== null
                  ? `${formatIDR(summary.budget_sisa ?? 0)} (${summary.budget_persen_sisa ?? 0}%)`
                  : "-"
              }</div>
            </div>
          `
              : ""
          }
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                <th>Kode TRX</th>
                <th>Nama Item</th>
                <th>Harga Jual Satuan</th>
                <th>Nominal Promo</th>
                <th>Jenis Potongan</th>
                <th>QTY</th>
                <th>Total Diskon</th>
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

  const summaryCards = useMemo(() => {
    const totalPenggunaan = summary?.total_penggunaan ?? 0;
    const totalQty = summary?.total_qty ?? 0;
    const totalNominal = summary?.total_nominal ?? 0;
    const budgetTotal = summary?.budget_total ?? null;
    const budgetSisa = summary?.budget_sisa ?? null;
    const budgetPersen = summary?.budget_persen_sisa ?? null;
    return [
      {
        label: "Total Penggunaan",
        value: `${totalPenggunaan.toLocaleString("id-ID")} trx`,
      },
      {
        label: "Total Qty",
        value: totalQty.toLocaleString("id-ID"),
      },
      {
        label: "Total Nominal",
        value: `Rp ${totalNominal.toLocaleString("id-ID")}`,
      },
      {
        label: "Budget Promosi",
        value:
          budgetTotal !== null
            ? `Rp ${Number(budgetTotal ?? 0).toLocaleString("id-ID")}`
            : "-",
        sub:
          budgetTotal !== null
            ? `Sisa ${Number(budgetSisa ?? 0).toLocaleString("id-ID")} (${budgetPersen ?? 0}%)`
            : "Pilih program promosi",
      },
    ];
  }, [summary]);

  const tableTotals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.qty += Number(row.qty ?? 0);
          acc.diskon += Number(row.promo_discount_per_item ?? 0);
          acc.totalDiskon += Number(row.total_discount ?? 0);
          return acc;
        },
        { qty: 0, diskon: 0, totalDiskon: 0 }
      ),
    [rows]
  );

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Menu Transaksi</p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Program Promosi</h1>
        <p className="text-sm text-slate-500">Pantau penggunaan program promosi berdasarkan supplier.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Supplier</label>
            <Select
              value={selectedSupplier}
              onChange={(opt) => setSelectedSupplier(opt as Option)}
              options={[ALL_SUPPLIERS_OPTION, ...supplierOptions]}
              placeholder="Pilih supplier"
              isClearable
              classNamePrefix="select"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Program Promosi</label>
            <Select
              value={selectedPromo}
              onChange={(opt) => setSelectedPromo(opt as Option)}
              options={promoOptions}
              placeholder="Pilih program promosi"
              isClearable
              classNamePrefix="select"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Tanggal Dari</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">Tanggal Sampai</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
            />
          </div>
          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
            >
              <Search className="h-4 w-4" />
              Terapkan
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </section>

      {applied && (
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{card.value}</p>
              {card.sub && <p className="mt-1 text-xs text-slate-500">{card.sub}</p>}
            </div>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Data Program Promosi</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={!rows.length || loading}
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
              disabled={!rows.length || loading}
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
        {!applied && (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Pilih filter lalu klik Terapkan untuk memuat data.
          </div>
        )}
        {applied && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">Kode TRX</th>
                  <th className="px-3 py-2 text-left">Nama Item</th>
                  <th className="px-3 py-2 text-right">Harga Jual Satuan</th>
                  <th className="px-3 py-2 text-right">Nominal Promo</th>
                  <th className="px-3 py-2 text-left">Jenis Potongan</th>
                  <th className="px-3 py-2 text-right">QTY</th>
                  <th className="px-3 py-2 text-right">Total Diskon</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                      Memuat data...
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                      Tidak ada data.
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((row, idx) => (
                    <tr
                      key={`${getRowKey(row, idx)}-${idx}`}
                      className="border-b border-slate-100"
                    >
                      <td className="px-3 py-2">
                        {formatPeriode(row.trx_first_at, row.trx_last_at) || "-"}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {(() => {
                          const codes = splitTrxCodes(row.trx_codes);
                          if (codes.length === 0) return "-";
                          const rowKey = getRowKey(row, idx);
                          const isOpen = Boolean(openTrx[rowKey]);
                          return (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenTrx((prev) => ({ ...prev, [rowKey]: !isOpen }))
                                }
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <span>{isOpen ? "Tutup" : "Lihat"} kode</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  {codes.length}
                                </span>
                              </button>
                              {isOpen && (
                                <div className="space-y-1">
                                  {codes.map((code) => (
                                    <div key={code} className="text-xs text-slate-700">
                                      {code}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2">{row.item_name || "-"}</td>
                      <td className="px-3 py-2 text-right">Rp {Number(row.unit_price ?? 0).toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2 text-right">
                        Rp {Number(row.promo_discount_per_item ?? 0).toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2">{getJenisPotongan(row)}</td>
                      <td className="px-3 py-2 text-right">{Number(row.qty ?? 0).toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2 text-right bg-amber-50">
                        Rp {Number(row.total_discount ?? 0).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-slate-50/90 text-slate-700">
                  <tr className="border-t border-slate-200">
                    <td className="px-3 py-3 font-semibold" colSpan={4}>
                      Total
                    </td>
                    <td className="px-3 py-3 font-semibold text-right">
                      Rp {tableTotals.diskon.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 font-semibold text-right">
                      {tableTotals.qty.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-3 font-semibold text-right">
                      Rp {tableTotals.totalDiskon.toLocaleString("id-ID")}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
