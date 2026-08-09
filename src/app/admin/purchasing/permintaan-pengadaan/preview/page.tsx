"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Swal from "sweetalert2";

type SiteInfo = {
  nama?: string;
  npwp?: string;
  alamat?: string;
  kota?: string;
  kode_pos?: string;
  provinsi?: string;
  negara?: string;
  no_telp?: string;
  email?: string;
  nama_header_print?: string;
  alamat_header_print?: string;
  nama_rekening?: string;
  nama_bank?: string;
  cabang_bank?: string;
  nomor_rekening?: string;
};

type Item = {
  id: string;
  parentId: string;
  supplier: string;
  nama: string;
  variant: string;
  barcodeVarian?: string | null;
  barcodeGlobal?: string | null;
  kodeBarangVariant?: string | null;
  hargaBeli: number | null;
  hargaHET: number | null;
  hargaNett?: number | null;
  disc1?: number | null;
  disc2?: number | null;
  disc3?: number | null;
  hargaStatus?: string;
  lastHargaBeli?: number | null;
  statusVarian?: number | null;
  qtyOrder: number;
  catatan?: string;
};

type StoredState = {
  nomorAuto?: string;
  tanggalAuto?: string;
  supplier?: string;
  supplierCode?: string;
  statusRpo?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  isRilis?: boolean;
  rilisBy?: string | null;
  rilisAt?: string | null;
  requestPengirimanDari?: string | null;
  requestPengirimanSampai?: string | null;
  createdBy?: string | null;
  rpoList?: Item[];
  waRecipients?: { id: string; label: string; phone?: string }[];
};

type SupplierInfo = {
  nama?: string;
  kode_supplier?: string;
  alamat?: string;
  kota?: string;
  provinsi?: string;
  kode_pos?: string;
  negara?: string;
  telp_1?: string;
  telp_2?: string;
  email?: string;
  npwp?: string;
  nama_npwp?: string;
  nama_bank?: string;
  no_rekening?: string;
  atas_nama?: string;
  cabang?: string;
};

const STORAGE_KEY = "permintaan-pengadaan-new";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const LOGO_URL = process.env.NEXT_PUBLIC_LOGO_URL ?? "/logo_gwen_sq_500.png";

const formatIDR = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

const clampPercent = (val: number | null | undefined) => {
  if (val === null || val === undefined || Number.isNaN(val)) return 0;
  if (val < 0) return 0;
  if (val > 100) return 100;
  return val;
};

const calculateItemTotals = (item: Item) => {
  const qty = item.qtyOrder ?? 0;
  const harga = item.hargaBeli ?? 0;
  const gross = harga * qty;
  const d1 = clampPercent(item.disc1);
  const d2 = clampPercent(item.disc2);
  const d3 = clampPercent(item.disc3);
  const afterD1 = gross * (1 - d1 / 100);
  const afterD2 = afterD1 * (1 - d2 / 100);
  const afterD3 = afterD2 * (1 - d3 / 100);
  const net = Math.max(afterD3, 0);
  const diskon = gross - net;
  return { gross, net, diskon };
};

export default function PreviewPermintaanPengadaanPage() {
  const searchParams = useSearchParams();
  const kodeParam = searchParams.get("kode");
  const [data, setData] = useState<StoredState>({});
  const [site, setSite] = useState<SiteInfo>({});
  const [supplierInfo, setSupplierInfo] = useState<SupplierInfo>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [printOrientation, setPrintOrientation] = useState<"landscape" | "portrait">("landscape");
  const [pendingPrint, setPendingPrint] = useState(false);
  const [autoPrinted, setAutoPrinted] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const showKodeVarian = searchParams.get("show_kode") === "1";
  const autoPrint = searchParams.get("print") === "1";
  const autoOrientation = searchParams.get("orientation");

  const rpoListFiltered = useMemo(() => {
    const list = data.rpoList || [];
    if (!kodeParam) return list;
    return list.filter((it: any) => (it as any).kode_t_rpo === kodeParam);
  }, [data.rpoList, kodeParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (kodeParam) return;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setData(parsed || {});
    } catch (err) {
      console.error("Failed to read session preview", err);
    }
  }, [kodeParam]);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!kodeParam) return;
      setLoadingDetail(true);
      setDetailError(null);
      setData({});
      try {
      const res = await fetch(`${API_BASE}/rpo/${encodeURIComponent(kodeParam)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const header = payload.header || {};
      const items = Array.isArray(payload.items) ? payload.items : [];
        const mappedItems: Item[] = items.map((it: any, idx: number) => ({
          id: `${it.kode_barang_variant || it.kode_varian || it.kode_barang || "ITEM"}-${idx}`,
        parentId: it.kode_barang || it.kode_varian || it.kode_barang_variant || String(idx),
        supplier: header.supplier_nama || header.kode_supplier || "",
        nama: it.barang_nama_master || it.nama_barang || it.barang_nama || it.kode_barang || it.kode_barang_variant || "",
        variant: it.nama_varian || it.kode_varian || it.barang_nama || it.kode_barang_variant || "",
        barcodeVarian: it.barcode_varian || null,
        barcodeGlobal: it.barcode_global || null,
        kodeBarangVariant: it.kode_barang_variant || null,
        hargaBeli: it.harga_beli ?? null,
        hargaHET: it.het ?? null,
        hargaNett: it.harga_nett ?? null,
        qtyOrder: it.qty ?? 0,
        catatan: it.catatan || "",
        hargaStatus: it.status_harga || null,
        lastHargaBeli: it.harga_beli_terakhir ?? null,
        statusVarian: typeof it.status_varian === "number" ? it.status_varian : it.status_varian != null ? Number(it.status_varian) : null,
        disc1: it.disc_1 ?? 0,
        disc2: it.disc_2 ?? 0,
        disc3: it.disc_3 ?? 0,
        kode_t_rpo: it.kode_t_rpo || header.kode_t_rpo || null,
      }));
      setData({
        nomorAuto: header.kode_t_rpo,
        tanggalAuto: header.tgl,
        supplier: header.supplier_nama || header.kode_supplier,
        supplierCode: header.kode_supplier,
        statusRpo: header.status_rpo ?? null,
        approvedBy: header.approved_by ?? null,
        approvedAt: header.approved_at ?? null,
        isRilis: Boolean(header.is_rilis),
        rilisBy: header.rilis_by ?? null,
        rilisAt: header.rilis_at ?? null,
        requestPengirimanDari: header.request_pengiriman_dari ?? null,
        requestPengirimanSampai: header.request_pengiriman_sampai ?? null,
        createdBy: header.created_by ?? null,
        rpoList: mappedItems.filter((it) => (it as any).kode_t_rpo === kodeParam),
        waRecipients: [],
      });
      } catch (err) {
        console.error("Failed load RPO detail", err);
        setData({});
        setDetailError("Gagal memuat data RPO");
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [kodeParam]);

  useEffect(() => {
    const fetchSite = async () => {
      try {
        const res = await fetch(`${API_BASE}/site`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const s: SiteInfo = await res.json();
        setSite(s || {});
      } catch (err) {
        console.error("Failed load site info", err);
      }
    };
    fetchSite();
  }, []);

  useEffect(() => {
    const fetchSupplier = async () => {
      if (!data.supplierCode) return;
      try {
        const res = await fetch(`${API_BASE}/suppliers/by-code/${encodeURIComponent(data.supplierCode)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const sup: SupplierInfo = await res.json();
        setSupplierInfo(sup || {});
      } catch (err) {
        console.error("Failed load supplier info", err);
      }
    };
    fetchSupplier();
  }, [data.supplierCode]);

  const grouped = useMemo(() => {
    const list = rpoListFiltered;
    const map = new Map<string, { id: string; nama: string; barcodeGlobal?: string | null; items: Item[] }>();
    list.forEach((it) => {
      if (!map.has(it.parentId)) {
        map.set(it.parentId, { id: it.parentId, nama: it.nama, barcodeGlobal: it.barcodeGlobal || null, items: [] });
      }
      map.get(it.parentId)!.items.push(it);
    });
    return Array.from(map.values());
  }, [rpoListFiltered]);

  const totals = useMemo(
    () =>
      rpoListFiltered.reduce(
        (acc, item) => {
          const t = calculateItemTotals(item);
          acc.gross += t.gross;
          acc.net += t.net;
          acc.diskon += t.diskon;
          return acc;
        },
        { gross: 0, net: 0, diskon: 0 }
      ),
    [rpoListFiltered]
  );

  const totalNominal = totals.net;

  const extractCode = (item: Item) => {
    const parts = item.id.split("-");
    return parts.length >= 3 ? parts[2] : "-";
  };

  const formatAddress = (obj: { alamat?: string; kota?: string; provinsi?: string; kode_pos?: string; negara?: string }) =>
    [obj.alamat, [obj.kota, obj.provinsi, obj.kode_pos].filter(Boolean).join(", "), obj.negara]
      .filter((s) => s && s.trim())
      .join("\n");

  const formatLine = (label: string, value?: string | null) => `${label}: ${value && String(value).trim() ? value : "-"}`;

  const qrSrc = useMemo(() => {
    if (!data.nomorAuto) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.nomorAuto)}`;
  }, [data.nomorAuto]);

  const handlePrint = (orientation: "landscape" | "portrait") => {
    setPrintOrientation(orientation);
    setPendingPrint(true);
  };

  useEffect(() => {
    if (!pendingPrint) return;
    if (typeof window === "undefined") return;
    const id = window.setTimeout(() => {
      window.print();
      setPendingPrint(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [pendingPrint, printOrientation]);

  useEffect(() => {
    if (!autoPrint || loadingDetail || autoPrinted) return;
    const nextOrientation = autoOrientation === "portrait" ? "portrait" : "landscape";
    setPrintOrientation(nextOrientation);
    setAutoPrinted(true);
    setPendingPrint(true);
  }, [autoPrint, autoOrientation, autoPrinted, loadingDetail]);

  const dpp = totals.net * (11 / 12);
  const isApproved = (data.statusRpo || "").toUpperCase() === "APPROVED";
  const isReleased = Boolean(data.isRilis);

  const handleApprove = async () => {
    if (!kodeParam || approving) return;
    const totalText = formatIDR(totalNominal);
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Approve RPO?",
      text: `Yakin ingin approve RPO ${kodeParam} dengan total nota ${totalText}?`,
      showCancelButton: true,
      confirmButtonText: "Approve",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;
    setApproving(true);
    setApproveError(null);
    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let approvedBy = "Admin";
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        approvedBy = parsed?.username || parsed?.name || approvedBy;
      } catch {
        // ignore parse error
      }
    }
    try {
      const res = await fetch(`${API_BASE}/rpo/${encodeURIComponent(kodeParam)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: approvedBy }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((prev) => ({
        ...prev,
        statusRpo: "APPROVED",
        approvedBy,
        approvedAt: new Date().toISOString(),
      }));
      Swal.fire({
        icon: "success",
        title: "RPO disetujui",
        text: `RPO ${kodeParam} berhasil di-approve.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Failed approve RPO", err);
      setApproveError("Gagal approve RPO.");
      Swal.fire({
        icon: "error",
        title: "Gagal approve",
        text: "Tidak dapat menyetujui RPO. Coba lagi.",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleRelease = async () => {
    if (!kodeParam || releasing) return;
    const totalText = formatIDR(totalNominal);
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Rilis RPO?",
      text: `Yakin ingin rilis RPO ${kodeParam} dengan total nota ${totalText}?`,
      showCancelButton: true,
      confirmButtonText: "Rilis",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;
    setReleasing(true);
    setReleaseError(null);
    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let rilisBy = "Admin";
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        rilisBy = parsed?.username || parsed?.name || rilisBy;
      } catch {
        // ignore parse error
      }
    }
    try {
      const res = await fetch(`${API_BASE}/rpo/${encodeURIComponent(kodeParam)}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rilis_by: rilisBy,
          tanggal_barang_datang: data.requestPengirimanDari || undefined,
          request_pengiriman_dari: data.requestPengirimanDari || undefined,
          request_pengiriman_sampai: data.requestPengirimanSampai || data.requestPengirimanDari || undefined,
        }),
      });
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const payload = await res.json();
          if (payload?.message) message = payload.message;
        } catch {
          // ignore response parse error
        }
        throw new Error(message);
      }
      setData((prev) => ({
        ...prev,
        isRilis: true,
        rilisBy,
        rilisAt: new Date().toISOString(),
      }));
      Swal.fire({
        icon: "success",
        title: "RPO dirilis",
        text: `RPO ${kodeParam} berhasil dirilis.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Failed release RPO", err);
      setReleaseError(err instanceof Error ? err.message : "Gagal rilis RPO.");
      Swal.fire({
        icon: "error",
        title: "Gagal rilis",
        text: err instanceof Error ? err.message : "Tidak dapat merilis RPO. Coba lagi.",
      });
    } finally {
      setReleasing(false);
    }
  };

  if (!kodeParam) {
    return (
      <div className="p-6">
        <div className="p-4 rounded border border-amber-200 bg-amber-50 text-amber-800">
          Kode RPO tidak diberikan. Buka halaman ini melalui tombol Preview pada daftar RPO.
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-gray-100 overflow-auto text-gray-900 flex justify-center print-container">
      <div className="flex flex-col items-center w-full">
        <div className="w-full max-w-5xl mt-4 px-4">
          {loadingDetail && (
            <div className="mb-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              Memuat data RPO {kodeParam}...
            </div>
          )}
          {detailError && (
            <div className="mb-2 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {detailError}
            </div>
          )}
          {approveError && (
            <div className="mb-2 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {approveError}
            </div>
          )}
          {releaseError && (
            <div className="mb-2 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {releaseError}
            </div>
          )}
        </div>
        <div className="flex justify-end mt-4 no-print" style={{ width: printOrientation === "portrait" ? "21cm" : "29.7cm" }}>
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={approving || isApproved || loadingDetail}
              className={`px-4 py-2 text-sm font-semibold text-white rounded shadow ${
                approving || isApproved || loadingDetail ? "bg-emerald-300 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {isApproved ? "Approved" : approving ? "Approving..." : "Approve"}
            </button>
            {isApproved && (
              <button
                onClick={handleRelease}
                disabled={releasing || isReleased || loadingDetail}
                className={`px-4 py-2 text-sm font-semibold text-white rounded shadow ${
                  releasing || isReleased || loadingDetail ? "bg-sky-300 cursor-not-allowed" : "bg-sky-600 hover:bg-sky-700"
                }`}
              >
                {isReleased ? "Released" : releasing ? "Releasing..." : "Rilis"}
              </button>
            )}
            <button
              onClick={() => handlePrint("portrait")}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow"
            >
              Print Portrait
            </button>
            <button
              onClick={() => handlePrint("landscape")}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-600 hover:bg-slate-700 rounded shadow"
            >
              Print Landscape
            </button>
          </div>
        </div>
        <div
          className="print-page relative bg-white px-6 py-8 shadow-sm my-6"
          style={{ width: printOrientation === "portrait" ? "21cm" : "29.7cm" }}
        >
          <div className="space-y-6 relative z-10">
            <div className="flex justify-between items-center border-b pb-4">
              <div className="flex items-start gap-3">
                <img src={LOGO_URL} alt="Logo" className="w-12 h-12 object-contain" />
                <div className="max-w-[360px]">
                  <h1 className="text-xl font-bold">{site.nama_header_print || site.nama || "Permintaan Pengadaan"}</h1>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {site.alamat_header_print || site.alamat || "-"}
                  </p>
                  {(site.no_telp || site.email) && (
                    <div className="space-y-1 mt-1">
                      {site.no_telp && <p className="text-sm text-gray-600">{formatLine("Telp", site.no_telp)}</p>}
                      {site.email && <p className="text-sm text-gray-600">{formatLine("Email", site.email)}</p>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 min-w-[200px] justify-end">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Nomor RPO</p>
                  <p className="font-bold text-lg">{data.nomorAuto || "-"}</p>
                  <p className="text-sm text-gray-600">Tanggal: {data.tanggalAuto || "-"}</p>
                  <p className="text-sm text-gray-600">Penginput RPO: {data.createdBy || "-"}</p>
                  <p className="text-sm text-gray-600">
                    Request Kirim:{" "}
                    {(data.requestPengirimanDari || "-").toString().slice(0, 10)} s/d{" "}
                    {(data.requestPengirimanSampai || "-").toString().slice(0, 10)}
                  </p>
                </div>
                {qrSrc && <img src={qrSrc} alt="QR RPO" className="w-24 h-24" />}
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden relative z-10">
              <div className="grid grid-cols-3 text-sm bg-gray-100 border-b">
                <div className="px-3 py-2 font-semibold text-gray-800 border-r">ORDERED FROM</div>
                <div className="px-3 py-2 font-semibold text-gray-800 border-r">DELIVERED TO</div>
                <div className="px-3 py-2 font-semibold text-gray-800">FAKTUR PAJAK</div>
              </div>
              <div className="grid grid-cols-3 text-sm">
                <div className="px-3 py-2 border-r whitespace-pre-line">
                  <div className="font-semibold">{site.nama_header_print || site.nama || "-"}</div>
                  <div className="text-gray-700">{formatAddress(site) || "-"}</div>
                  <div className="text-gray-700 mt-1">{formatLine("Telp", site.no_telp)}</div>
                </div>
                <div className="px-3 py-2 border-r whitespace-pre-line">
                  <div className="font-semibold">{supplierInfo.nama || data.supplier || "-"}</div>
                  <div className="text-gray-700">{formatAddress(supplierInfo) || "-"}</div>
                  <div className="text-gray-700 mt-1">
                    {formatLine("Telp", [supplierInfo.telp_1, supplierInfo.telp_2].filter(Boolean).join(" / "))}
                  </div>
                </div>
                <div className="px-3 py-2 whitespace-pre-line">
                  <div className="font-semibold">{formatLine("COMPANY", supplierInfo.nama)}</div>
                  <div className="text-gray-700">{formatLine("ADDRESS", formatAddress(supplierInfo) || "-")}</div>
                  <div className="text-gray-700">{formatLine("NAMA NPWP", supplierInfo.nama_npwp)}</div>
                  <div className="text-gray-700">{formatLine("NPWP", supplierInfo.npwp)}</div>
                  <div className="text-gray-700">
                    {formatLine(
                      "BANK",
                      supplierInfo.nama_bank ? `${supplierInfo.nama_bank}${supplierInfo.cabang ? ` (${supplierInfo.cabang})` : ""}` : ""
                    )}
                  </div>
                  <div className="text-gray-700">{formatLine("NO. REKENING", supplierInfo.no_rekening)}</div>
                  <div className="text-gray-700">{formatLine("ATAS NAMA", supplierInfo.atas_nama)}</div>
                </div>
              </div>
            </div>

            <div className="border rounded-2xl overflow-hidden relative z-10">
              <table className="min-w-full text-xs border border-gray-300 preview-table">
            <thead className="bg-gray-100 text-gray-700 border-b border-gray-300">
              <tr>
                {showKodeVarian && (
                  <th className="px-2 py-2 text-left w-28 border-r border-gray-300">Kode Varian</th>
                )}
                <th className="px-2 py-2 text-left w-10 border-r border-gray-300">No</th>
                <th className="px-2 py-2 text-left border-r border-gray-300 w-[360px]">Article Description</th>
                <th className="px-2 py-2 text-right w-20 border-r border-gray-300">Qty Order</th>
                <th className="px-2 py-2 text-left w-16 border-r border-gray-300">Satuan</th>
                    <th className="px-2 py-2 text-right w-24 border-r border-gray-300">HET</th>
                    <th className="px-2 py-2 text-right w-28 border-r border-gray-300">Price (Unit)</th>
                    <th className="px-2 py-2 text-right w-20 border-r border-gray-300">Disc 1 (%)</th>
                    <th className="px-2 py-2 text-right w-20 border-r border-gray-300">Disc 2 (%)</th>
                    <th className="px-2 py-2 text-right w-20 border-r border-gray-300">Disc 3 (%)</th>
                    <th className="px-2 py-2 text-right w-24 border-r border-gray-300">Harga Nett</th>
                    <th className="px-2 py-2 text-left w-28 border-r border-gray-300">Status Harga</th>
                    <th className="px-2 py-2 text-left w-40 border-r border-gray-300">Catatan</th>
                    <th className="px-2 py-2 text-right w-32">Total Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(() => {
                    let idx = 1;
                    const totalCols = showKodeVarian ? 14 : 13;
                    return grouped.flatMap((group) => [
                      <tr key={group.id} className="bg-teal-50 border-b border-gray-200">
                        <td className="px-2 py-2 font-semibold text-teal-800" colSpan={totalCols}>
                          {group.nama}{" "}
                          <span className="text-xs text-gray-500 ml-1">
                            ({group.items.length} varian)
                            {group.barcodeGlobal ? ` - ${group.barcodeGlobal}` : ""}
                          </span>
                        </td>
                      </tr>,
                      ...group.items.map((item) => (
                        (() => {
                          const isBase = (item.variant || "").toUpperCase() === "BASE";
                          const variantDisplay =
                            group.items.length === 1 && isBase ? item.nama || group.nama || item.variant : item.variant;
                          const isInactive = item.statusVarian === 0;
                          const totalsForItem = calculateItemTotals(item);
                          const hargaNettVal =
                            item.hargaNett != null
                              ? item.hargaNett
                              : item.qtyOrder
                                ? totalsForItem.net / item.qtyOrder
                                : null;
                          return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          {showKodeVarian && (
                            <td className="px-2 py-2 border-r border-gray-200">
                              <span className={isInactive ? "line-through text-gray-400" : ""}>
                                {item.kodeBarangVariant || "-"}
                              </span>
                            </td>
                          )}
                          <td className="px-2 py-2 text-center border-r border-gray-200">{idx++}</td>
                          <td className="px-2 py-2 border-r border-gray-200 whitespace-normal break-words w-[360px]">
                            <div className={`font-semibold ${isInactive ? "line-through text-gray-400" : ""}`}>
                              {variantDisplay}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right border-r border-gray-200">{item.qtyOrder ?? 0}</td>
                          <td className="px-2 py-2 text-left border-r border-gray-200">PCS</td>
                          <td className="px-2 py-2 text-right border-r border-gray-200">
                            {item.hargaHET !== null ? formatIDR(item.hargaHET) : "-"}
                          </td>
                          <td className="px-2 py-2 text-right border-r border-gray-200">
                            {item.hargaBeli !== null ? formatIDR(item.hargaBeli) : "-"}
                          </td>
                          <td className="px-2 py-2 text-right border-r border-gray-200">
                            {item.disc1 != null ? `${clampPercent(item.disc1).toLocaleString("id-ID")} %` : "-"}
                          </td>
                          <td className="px-2 py-2 text-right border-r border-gray-200">
                            {item.disc2 != null ? `${clampPercent(item.disc2).toLocaleString("id-ID")} %` : "-"}
                          </td>
                          <td className="px-2 py-2 text-right border-r border-gray-200">
                            {item.disc3 != null ? `${clampPercent(item.disc3).toLocaleString("id-ID")} %` : "-"}
                          </td>
                          <td className="px-2 py-2 text-right border-r border-gray-200">
                            {hargaNettVal != null ? formatIDR(hargaNettVal) : "-"}
                          </td>
                          <td className="px-2 py-2 border-r border-gray-200">
                            <div className="flex flex-col">
                              <span>{item.hargaStatus || "-"}</span>
                              {(item.hargaStatus === "NAIK" || item.hargaStatus === "TURUN") && item.lastHargaBeli != null && (
                                <span className="text-[10px] text-gray-500">Dari {formatIDR(item.lastHargaBeli)}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 border-r border-gray-200">{item.catatan || "-"}</td>
                          <td className="px-2 py-2 text-right font-semibold">
                            {formatIDR(totalsForItem.net)}
                          </td>
                        </tr>
                          );
                        })()
                      )),
                    ]);
                  })()}
                  {(data.rpoList?.length || 0) === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-gray-500" colSpan={showKodeVarian ? 13 : 12}>
                        Tidak ada data.
                      </td>
                    </tr>
                  )}
                  {grouped.length > 0 && (
                    <tr className="bg-gray-50">
                      <td
                        className="px-2 py-2 border-r border-gray-200"
                        colSpan={showKodeVarian ? 6 : 5}
                      ></td>
                      <td className="px-2 py-2 border-r border-gray-200" colSpan={3}>
                        <div className="flex justify-between font-semibold text-gray-800">
                          <span>Global Disc :</span>
                          <span>{formatIDR(totals.diskon)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 border-r border-gray-200" colSpan={5}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex gap-6 justify-between text-sm text-gray-800">
              <div className="space-y-1 flex-1">
                <p className="font-semibold">Note:</p>
                <p>TIDAK DITERIMA BARANG DILUAR PO</p>
                <p>TIDAK DITERIMA BARANG JIKA NEAR EXPIRED ( MINIMAL 2 TAHUN )</p>
              </div>
              <div className="space-y-3 flex-1 max-w-sm">
                <div className="border border-gray-500 rounded-md p-3 shadow-sm bg-white">
                  <div className="text-sm text-gray-600">Total Purchase</div>
                  <div className="text-2xl font-bold text-gray-900">{formatIDR(totals.net)}</div>
                </div>
                <div className="space-y-1 text-sm text-gray-800">                 
                  <div className="flex justify-between">
                    <span>Order Negotiation</span>
                    <span>0.00 % (-)</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span>DPP PPN (11/12 x Total Purchase)</span>
                    <span>{formatIDR(dpp)}</span>
                  </div>
                </div>
                <div className="border border-gray-400 mt-2">
                  <div className="grid grid-cols-3 bg-gray-100 text-center text-xs font-semibold border-b border-gray-400">
                    <div className="py-2 border-r border-gray-400">SUPPLIER</div>
                    <div className="py-2 border-r border-gray-400">MANAGER</div>
                    <div className="py-2">MD / BUYER</div>
                  </div>
                  <div className="grid grid-cols-3 text-center h-16">
                    <div className="border-r border-gray-400"></div>
                    <div className="border-r border-gray-400"></div>
                    <div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @page {
          size: ${printOrientation === "portrait" ? "21cm 29.7cm" : "29.7cm 21cm"};
          margin: 0.5cm;
        }
        @media print {
          @page {
            margin: 0.5cm;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: visible !important;
            width: auto !important;
          }
          .print-container {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-page {
            width: ${printOrientation === "portrait" ? "21cm" : "29.7cm"};
            background: white;
            position: relative;
            overflow: visible !important;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200' viewBox='0 0 400 200'%3E%3Ctext x='20' y='120' transform='rotate(-15 200 100)' fill='rgba(0,0,0,0.08)' font-size='72' font-family='Arial' font-weight='700'%3EDRAFT%3C/text%3E%3C/svg%3E");
            background-repeat: repeat;
            background-size: 12cm 6cm;
          }
          .watermark {
            display: none !important;
          }
          tr,
          td,
          th {
            page-break-inside: avoid;
          }
          .preview-table td,
          .preview-table th {
            padding-block: calc(var(--spacing, 8px) * 0.5) !important;
            padding-inline: calc(var(--spacing, 8px) * 0.75) !important;
          }
          .preview-table {
            font-size: ${printOrientation === "portrait" ? "9px" : "11px"};
          }
        }
        @media screen {
          .print-page {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200' viewBox='0 0 400 200'%3E%3Ctext x='20' y='120' transform='rotate(-15 200 100)' fill='rgba(0,0,0,0.08)' font-size='72' font-family='Arial' font-weight='700'%3EDRAFT%3C/text%3E%3C/svg%3E");
            background-repeat: repeat;
            background-size: 12cm 6cm;
          }
          .preview-table td,
          .preview-table th {
            padding-block: calc(var(--spacing, 8px) * 0.5) !important;
            padding-inline: calc(var(--spacing, 8px) * 0.75) !important;
          }
        }
      `}</style>
    </div>
  );
}
