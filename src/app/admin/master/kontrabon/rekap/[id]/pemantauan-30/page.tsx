"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer, X } from "lucide-react";

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
  stokGudang: number;
  stokToko: number;
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

type PengadaanDetailResponse = {
  header?: {
    kode_t_pengadaan?: string;
    tgl?: string | null;
    deadline?: string | null;
    kode_supplier?: string | null;
    supplier_nama?: string | null;
    no_faktur_supplier?: string | null;
    total_akhir?: number | null;
    total_tagihan?: number | null;
    total_dibayar?: number | null;
    is_lunas?: number | boolean | null;
  } | null;
  items?: Array<{
    kode_barang_variant?: string | null;
    nama_barang?: string | null;
    nama_varian?: string | null;
    qty?: number | null;
    satuan?: string | null;
    harga_beli?: number | null;
    subtotal?: number | null;
  }>;
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

const slotStatusBadgeClass = (slot?: PemantauanSlot | null) => {
  if (!slot || slot.persen === null) return "border border-slate-200 bg-white/80 text-slate-500";
  if (slot.persen <= 30) {
    return slot.isCurrent
      ? "border border-amber-300 bg-amber-100 text-amber-900"
      : "border border-emerald-300 bg-emerald-100 text-emerald-900";
  }
  return slot.isCurrent
    ? "border border-rose-300 bg-rose-100 text-rose-900"
    : "border border-slate-300 bg-slate-200 text-slate-800";
};

const slotGroupBorderClass = (slot: string) => {
  const normalized = String(slot || "").trim().toUpperCase();
  return normalized === "K1" ? "border-r-2 border-r-slate-500" : "border-r-2 border-r-slate-400";
};

export default function Pemantauan30Page() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [payload, setPayload] = useState<PemantauanResponse>({ header: null, cards: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<PemantauanSlot | null>(null);
  const [pengadaanDetail, setPengadaanDetail] = useState<PengadaanDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

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

  const openPengadaanDetail = async (slot: PemantauanSlot) => {
    setSelectedSlot(slot);
    setPengadaanDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/pengadaan/${encodeURIComponent(slot.kodeTPengadaan)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PengadaanDetailResponse;
      setPengadaanDetail(data);
    } catch {
      setDetailError("Gagal memuat detail pengadaan.");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef3ff] px-6 py-6">
      <style jsx global>{`
        @keyframes skeleton-pulse {
          0% {
            opacity: 0.55;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.55;
          }
        }
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }
          body {
            background: #fff !important;
          }
          main {
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            break-inside: auto;
            page-break-inside: auto;
          }
          .print-card > div:first-child {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          table {
            break-inside: auto;
            page-break-inside: auto;
          }
          thead {
            display: table-header-group;
          }
          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="mx-auto max-w-[1800px] print:max-w-none">
        <div className="no-print fixed bottom-6 right-6 z-40">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>

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

        <div className="mt-6 grid gap-4 md:grid-cols-4 print:mt-3 print:gap-2">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal Rekap</div>
            <div className="mt-2 text-lg font-bold text-slate-900">{formatDate(payload.header?.tgl_rekap)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grand Total</div>
            <div className="mt-2 text-lg font-bold text-slate-900">{formatCurrency(payload.header?.grand_total)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Nota</div>
            <div className="mt-2 text-lg font-bold text-slate-900">{payload.cards.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alert ≤ 30%</div>
            <div className="mt-2 text-lg font-bold text-amber-700">
              {summary.alertRows} / {summary.totalRows} item
            </div>
          </div>
        </div>

        {loading && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`summary-skeleton-${index}`} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <div className="h-3 w-24 rounded bg-slate-200 [animation:skeleton-pulse_1.4s_ease-in-out_infinite]" />
                  <div className="mt-4 h-8 w-36 rounded bg-slate-200 [animation:skeleton-pulse_1.4s_ease-in-out_infinite]" />
                </div>
              ))}
            </div>

            {Array.from({ length: 2 }).map((_, cardIndex) => (
              <section
                key={`card-skeleton-${cardIndex}`}
                className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-100 px-5 py-4">
                  <div className="space-y-3">
                    <div className="h-7 w-80 rounded bg-slate-200 [animation:skeleton-pulse_1.4s_ease-in-out_infinite]" />
                    <div className="h-4 w-72 rounded bg-slate-200 [animation:skeleton-pulse_1.4s_ease-in-out_infinite]" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-48 rounded bg-slate-200 [animation:skeleton-pulse_1.4s_ease-in-out_infinite]" />
                    <div className="h-4 w-40 rounded bg-slate-200 [animation:skeleton-pulse_1.4s_ease-in-out_infinite]" />
                    <div className="h-5 w-32 rounded bg-slate-200 [animation:skeleton-pulse_1.4s_ease-in-out_infinite]" />
                  </div>
                </div>
                <div className="p-5">
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="grid grid-cols-8 gap-0 border-b border-slate-200 bg-slate-50">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <div key={`header-cell-${cardIndex}-${index}`} className="h-12 border-r border-slate-200 bg-slate-100 [animation:skeleton-pulse_1.4s_ease-in-out_infinite]" />
                      ))}
                    </div>
                    {Array.from({ length: 5 }).map((_, rowIndex) => (
                      <div key={`row-${cardIndex}-${rowIndex}`} className="grid grid-cols-8 gap-0 border-b border-slate-100 last:border-b-0">
                        {Array.from({ length: 8 }).map((_, colIndex) => (
                          <div key={`cell-${cardIndex}-${rowIndex}-${colIndex}`} className="h-14 border-r border-slate-100 bg-white px-3 py-3">
                            <div className="h-full rounded bg-slate-100 [animation:skeleton-pulse_1.4s_ease-in-out_infinite]" />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
        {error && <div className="mt-6 rounded-2xl bg-white px-5 py-8 text-sm text-rose-600 shadow-sm">{error}</div>}

        {!loading && !error && (
          <div className="mt-6 space-y-6 print:mt-2 print:space-y-3">
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

                <div className="overflow-hidden">
                  <table className="w-full table-fixed border-collapse text-[12px] leading-tight">
                    <colgroup>
                      <col className="w-[24%]" />
                      <col className="w-[11%]" />
                      {Array.from({ length: 25 }).map((_, index) => (
                        <col key={`slot-col-${index}`} className="w-[2.2%]" />
                      ))}
                      <col className="w-[5%]" />
                      <col className="w-[5%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-[#daedff] text-slate-900">
                        <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left">Nama Barang</th>
                        <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left">Supplier</th>
                        {slotOrder.map((slot) => (
                          <th
                            key={slot}
                            colSpan={5}
                            className={`border border-slate-300 px-3 py-2 text-center ${slotGroupBorderClass(slot)}`}
                          >
                            Pengadaan {slot}
                          </th>
                        ))}
                        <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-center">Stok Gudang</th>
                        <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-center">Stok Toko</th>
                      </tr>
                      <tr className="bg-slate-50 text-slate-700">
                        {slotOrder.flatMap((slot) => [
                          <th key={`${slot}-status`} className="border border-slate-300 px-2 py-2 text-center">S</th>,
                          <th key={`${slot}-po`} className="border border-slate-300 px-2 py-2 text-center">PO</th>,
                          <th key={`${slot}-pct`} className="border border-slate-300 px-2 py-2 text-center">%</th>,
                          <th key={`${slot}-sisa`} className="border border-slate-300 px-2 py-2 text-center">Sisa</th>,
                          <th key={`${slot}-umur`} className={`border border-slate-300 px-2 py-2 text-center ${slotGroupBorderClass(slot)}`}>Umur</th>,
                        ])}
                      </tr>
                    </thead>
                    <tbody>
                      {card.data.map((row) => (
                        <tr key={`${card.kodeTPengadaan}-${row.kodeBarangVariant}`} className="align-top">
                          <td className="border border-slate-300 px-3 py-2 text-slate-900">
                            <div className="break-words font-semibold leading-snug">{row.namaBarang}</div>
                            <div className="mt-1 break-all text-[11px] text-slate-500">{row.kodeBarangVariant}</div>
                          </td>
                          <td className="border border-slate-300 px-3 py-2 break-words leading-snug">{row.namaSupplier || "-"}</td>
                          {slotOrder.flatMap((slotName) => {
                            const slot = row.slots.find((item) => item.slot === slotName) || null;
                            const slotClass = slotCellClass(slot);
                            return [
                              <td key={`${row.kodeBarangVariant}-${slotName}-status`} className={`border border-slate-300 px-1 py-2 text-center ${slotClass}`}>
                                {slot ? (
                                  <button
                                    type="button"
                                    onClick={() => openPengadaanDetail(slot)}
                                    className={`inline-flex max-w-full items-center justify-center rounded-full px-1.5 py-1 text-[10px] font-semibold transition hover:brightness-95 ${slotStatusBadgeClass(slot)}`}
                                  >
                                    {slot.statusBayar === "Lunas" ? "L" : "B"}
                                  </button>
                                ) : "-"}
                              </td>,
                              <td key={`${row.kodeBarangVariant}-${slotName}-po`} className={`border border-slate-300 px-1 py-2 text-center ${slotClass}`}>
                                <span className="break-words">
                                  {slot ? formatNumber(slot.qty) : "-"}
                                </span>
                              </td>,
                              <td key={`${row.kodeBarangVariant}-${slotName}-pct`} className={`border border-slate-300 px-1 py-2 text-center font-semibold ${slotClass}`}>
                                {slot?.persen !== null && slot?.persen !== undefined ? `${formatNumber(slot.persen)}%` : "-"}
                              </td>,
                              <td key={`${row.kodeBarangVariant}-${slotName}-sisa`} className={`border border-slate-300 px-1 py-2 text-center ${slotClass}`}>
                                {slot ? formatNumber(slot.sisa) : "-"}
                              </td>,
                              <td
                                key={`${row.kodeBarangVariant}-${slotName}-umur`}
                                className={`border border-slate-300 px-1 py-2 text-center ${slotClass} ${slotGroupBorderClass(slotName)}`}
                              >
                                {slot?.umurHari !== null && slot?.umurHari !== undefined ? `${slot.umurHari} hari` : "-"}
                              </td>,
                            ];
                          })}
                          <td className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-900">
                            {formatNumber(row.stokGudang)}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-900">
                            {formatNumber(row.stokToko)}
                          </td>
                        </tr>
                      ))}
                      {card.data.length === 0 && (
                        <tr>
                          <td colSpan={29} className="border border-slate-300 px-4 py-6 text-center text-slate-500">
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

      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-lg font-bold text-slate-900">Detail Pengadaan {selectedSlot.kodeTPengadaan}</div>
                <div className="text-sm text-slate-600">Status bayar: {selectedSlot.statusBayar}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSlot(null);
                  setPengadaanDetail(null);
                  setDetailError(null);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-72px)] overflow-auto px-5 py-4">
              {detailLoading && <div className="py-8 text-sm text-slate-500">Memuat detail pengadaan...</div>}
              {detailError && <div className="py-8 text-sm text-rose-600">{detailError}</div>}

              {!detailLoading && !detailError && (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supplier</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {pengadaanDetail?.header?.supplier_nama || pengadaanDetail?.header?.kode_supplier || "-"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{formatDate(pengadaanDetail?.header?.tgl)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Faktur Supplier</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{pengadaanDetail?.header?.no_faktur_supplier || "-"}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(pengadaanDetail?.header?.total_akhir)}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Tagihan</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(pengadaanDetail?.header?.total_tagihan)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Dibayar</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(pengadaanDetail?.header?.total_dibayar)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
                      <div className="mt-2">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBayarClass(selectedSlot.statusBayar)}`}>
                          {selectedSlot.statusBayar}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          <th className="border-b border-slate-200 px-3 py-2 text-left">Barang</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-left">Varian</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-left">Kode Varian</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-right">Qty</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-left">Satuan</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-right">Harga Beli</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pengadaanDetail?.items || []).map((item, index) => (
                          <tr key={`${item.kode_barang_variant || "row"}-${index}`} className="border-t border-slate-100">
                            <td className="px-3 py-2">{item.nama_barang || "-"}</td>
                            <td className="px-3 py-2">{item.nama_varian || "-"}</td>
                            <td className="px-3 py-2 text-xs text-slate-500">{item.kode_barang_variant || "-"}</td>
                            <td className="px-3 py-2 text-right">{formatNumber(item.qty)}</td>
                            <td className="px-3 py-2">{item.satuan || "-"}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(item.harga_beli)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(item.subtotal)}</td>
                          </tr>
                        ))}
                        {(pengadaanDetail?.items || []).length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                              Tidak ada detail item pengadaan.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
