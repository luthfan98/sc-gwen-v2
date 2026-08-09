"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

type PemantauanHeader = {
  id: number;
  tgl_rekap: string | null;
  grand_total: number | null;
};

type PemantauanSlot = {
  slot: string;
  kodeTPengadaan: string;
  statusBayar: string;
  qty: number;
  satuan: string | null;
  sisa: number;
  persen: number | null;
  umurHari: number | null;
  isCurrent: boolean;
};

type PemantauanRow = {
  kodeBarangVariant: string;
  kodeBarang: string | null;
  namaBarang: string;
  namaSupplier: string | null;
  stokSaatIni: number;
  qtyPengadaan: number;
  satuanPengadaan: string | null;
  slots: PemantauanSlot[];
};

type PemantauanCard = {
  rekapNo: number;
  nomorKontrabon: string;
  namaSupplier: string | null;
  total: number;
  noFaktur: string | null;
  tglFaktur: string | null;
  tglKontrabon: string | null;
  rencanaTfDari: string | null;
  rencanaTfSampai: string | null;
  kodeTPengadaan: string;
  umurNotaHari: number | null;
  data: PemantauanRow[];
};

type PemantauanResponse = {
  header: PemantauanHeader | null;
  cards: PemantauanCard[];
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
};

const formatCurrency = (value?: number | null) => {
  const safe = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number.isFinite(safe) ? safe : 0);
};

const formatNumber = (value?: number | null) => {
  const safe = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(
    Number.isFinite(safe) ? safe : 0
  );
};

const slotCellClass = (slot?: PemantauanSlot | null) => {
  if (!slot || slot.persen === null) return "bg-slate-50 text-slate-500";
  if (slot.persen <= 30) {
    return slot.isCurrent
      ? "bg-amber-200 text-amber-950"
      : "bg-emerald-200 text-emerald-950";
  }
  return slot.isCurrent ? "bg-rose-200 text-rose-950" : "bg-slate-100 text-slate-800";
};

const statusBayarClass = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "lunas" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800";
};

export default function Pemantauan30Page() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [payload, setPayload] = useState<PemantauanResponse>({ header: null, cards: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/kontrabon/rekap/${encodeURIComponent(id)}/pemantauan-30`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PemantauanResponse;
        setPayload({
          header: data?.header || null,
          cards: Array.isArray(data?.cards) ? data.cards : [],
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Gagal memuat pemantauan kontrabon 30%.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [id]);

  const summary = useMemo(() => {
    const totalRows = payload.cards.reduce((acc, card) => acc + card.data.length, 0);
    const alertRows = payload.cards.reduce(
      (acc, card) =>
        acc +
        card.data.filter((row) =>
          row.slots.some((slot) => slot.isCurrent && slot.persen !== null && slot.persen <= 30)
        ).length,
      0
    );
    return { totalRows, alertRows };
  }, [payload.cards]);

  const slotOrder = ["K5", "K4", "K3", "K2", "K1"];

  return (
    <div className="min-h-screen bg-[#eef3ff] px-6 py-6">
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
          }
          body {
            background: #fff !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="mx-auto max-w-[1800px]">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pemantauan Kontrabon 30%</h1>
            <p className="mt-1 text-sm text-slate-600">
              Basis data dari `server-home-gwen`, ditampilkan per pengadaan dalam rekap.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal Rekap</div>
            <div className="mt-2 text-lg font-bold text-slate-900">{formatDate(payload.header?.tgl_rekap)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grand Total</div>
            <div className="mt-2 text-lg font-bold text-slate-900">{formatCurrency(payload.header?.grand_total)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Kartu</div>
            <div className="mt-2 text-lg font-bold text-slate-900">{payload.cards.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alert ≤ 30%</div>
            <div className="mt-2 text-lg font-bold text-amber-700">
              {summary.alertRows} / {summary.totalRows} item
            </div>
          </div>
        </div>

        {loading && <div className="mt-6 rounded-2xl bg-white px-5 py-8 text-sm text-slate-500 shadow-sm">Memuat data...</div>}
        {error && <div className="mt-6 rounded-2xl bg-white px-5 py-8 text-sm text-rose-600 shadow-sm">{error}</div>}

        {!loading && !error && (
          <div className="mt-6 space-y-6">
            {payload.cards.map((card, index) => (
              <section key={`${card.nomorKontrabon}-${card.kodeTPengadaan}-${index}`} className="print-card overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-100 px-5 py-3">
                  <div>
                    <div className="text-lg font-bold text-slate-900">
                      No KB: {card.nomorKontrabon} | Pengadaan: {card.kodeTPengadaan}
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      Supplier: {card.namaSupplier || "-"} | Umur nota: {card.umurNotaHari ?? "-"} hari dari {formatDate(card.tglFaktur)}
                    </div>
                  </div>
                  <div className="text-right text-sm text-slate-700">
                    <div>TF: {formatDate(card.rencanaTfDari)} - {formatDate(card.rencanaTfSampai)}</div>
                    <div>No Faktur: {card.noFaktur || "-"}</div>
                    <div className="font-semibold text-slate-900">Total: {formatCurrency(card.total)}</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[2250px] w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#daedff] text-slate-900">
                        <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left">Nama Barang</th>
                        <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left">Supplier</th>
                        {slotOrder.map((slot) => (
                          <th key={slot} colSpan={5} className="border border-slate-300 px-3 py-2 text-center">
                            Pengadaan {slot}
                          </th>
                        ))}
                        <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-center">Stok Saat Ini</th>
                      </tr>
                      <tr className="bg-slate-50 text-slate-700">
                        {slotOrder.flatMap((slot) => [
                          <th key={`${slot}-status`} className="border border-slate-300 px-2 py-2 text-center">Status</th>,
                          <th key={`${slot}-po`} className="border border-slate-300 px-2 py-2 text-center">PO</th>,
                          <th key={`${slot}-pct`} className="border border-slate-300 px-2 py-2 text-center">%</th>,
                          <th key={`${slot}-sisa`} className="border border-slate-300 px-2 py-2 text-center">Sisa</th>,
                          <th key={`${slot}-umur`} className="border border-slate-300 px-2 py-2 text-center">Umur</th>,
                        ])}
                      </tr>
                    </thead>
                    <tbody>
                      {card.data.map((row) => (
                        <tr key={`${card.kodeTPengadaan}-${row.kodeBarangVariant}`} className="align-top">
                          <td className="border border-slate-300 px-3 py-2 text-slate-900">
                            <div className="font-semibold">{row.namaBarang}</div>
                            <div className="text-xs text-slate-500">{row.kodeBarangVariant}</div>
                          </td>
                          <td className="border border-slate-300 px-3 py-2">{row.namaSupplier || "-"}</td>
                          {slotOrder.flatMap((slotName) => {
                            const slot = row.slots.find((item) => item.slot === slotName) || null;
                            const slotClass = slotCellClass(slot);
                            return [
                              <td key={`${row.kodeBarangVariant}-${slotName}-status`} className={`border border-slate-300 px-2 py-2 text-center ${slotClass}`}>
                                {slot ? (
                                  <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusBayarClass(slot.statusBayar)}`}>
                                    {slot.statusBayar}
                                  </span>
                                ) : "-"}
                              </td>,
                              <td key={`${row.kodeBarangVariant}-${slotName}-po`} className={`border border-slate-300 px-2 py-2 text-center ${slotClass}`}>
                                {slot ? `${formatNumber(slot.qty)} ${slot.satuan || ""}`.trim() : "-"}
                              </td>,
                              <td key={`${row.kodeBarangVariant}-${slotName}-pct`} className={`border border-slate-300 px-2 py-2 text-center font-semibold ${slotClass}`}>
                                {slot?.persen !== null && slot?.persen !== undefined ? `${formatNumber(slot.persen)}%` : "-"}
                              </td>,
                              <td key={`${row.kodeBarangVariant}-${slotName}-sisa`} className={`border border-slate-300 px-2 py-2 text-center ${slotClass}`}>
                                {slot ? formatNumber(slot.sisa) : "-"}
                              </td>,
                              <td key={`${row.kodeBarangVariant}-${slotName}-umur`} className={`border border-slate-300 px-2 py-2 text-center ${slotClass}`}>
                                {slot?.umurHari !== null && slot?.umurHari !== undefined ? `${slot.umurHari} hari` : "-"}
                              </td>,
                            ];
                          })}
                          <td className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-900">
                            {formatNumber(row.stokSaatIni)}
                          </td>
                        </tr>
                      ))}
                      {card.data.length === 0 && (
                        <tr>
                          <td colSpan={28} className="border border-slate-300 px-4 py-6 text-center text-slate-500">
                            Tidak ada detail barang untuk pengadaan ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}

            {payload.cards.length === 0 && (
              <div className="rounded-2xl bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-sm">
                Belum ada data pemantauan untuk rekap ini.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
