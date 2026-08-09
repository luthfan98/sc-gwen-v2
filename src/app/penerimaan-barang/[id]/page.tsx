"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BadgeCheck, PackageCheck, PackageOpen } from "lucide-react";
import { poList } from "../data";

type ItemRow = {
  sku: string;
  name: string;
  barcode?: string | null;
  variant?: string | null;
  kodeBarangVariant?: string | null;
  kodeDRpo?: string | null;
  expiredDates?: string[];
  qtyOrdered: number;
  qtyReceived: number;
  unit: string;
};

export default function PenerimaanDetailPage() {
  const params = useParams<{ id: string }>();
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const decodedId = decodeURIComponent(params?.id ?? "");
  const [po, setPo] = useState<{ id: string; supplier: string; date: string; totalItems: number; totalQty: number } | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanIndex, setScanIndex] = useState<number | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [scanMode, setScanMode] = useState<"row" | "search">("row");
  const [searchQuery, setSearchQuery] = useState("");
  const [scanRestartKey, setScanRestartKey] = useState(0);
  const [cameraPermission, setCameraPermission] = useState<"unknown" | "granted" | "denied" | "prompt">("unknown");
  const [cameraChecking, setCameraChecking] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const saveTimersRef = useRef<Record<string, number>>({});

  const receivedCount = useMemo(() => items.reduce((sum, it) => sum + it.qtyReceived, 0), [items]);
  const status = useMemo(
    () => (items.length > 0 && items.every((it) => it.qtyReceived >= it.qtyOrdered) ? "Selesai" : "Belum"),
    [items]
  );
  const filteredItems = useMemo(() => {
    const key = searchQuery.trim().toLowerCase();
    if (!key) return items;
    return items.filter((item) => {
      const name = item.name?.toLowerCase() || "";
      const barcode = String(item.barcode || "").toLowerCase();
      const sku = String(item.sku || "").toLowerCase();
      return name.includes(key) || barcode.includes(key) || sku.includes(key);
    });
  }, [items, searchQuery]);
  const formatTanggal = (value: string) => {
    if (!value || value === "-") return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("id-ID");
  };

  const stopScanner = () => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!scanOpen) {
      stopScanner();
      return;
    }
    setScanError(null);
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScanError("Browser tidak mendukung kamera.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const Detector = (window as any).BarcodeDetector;
        if (!Detector) {
          setScanError("Barcode detector tidak tersedia. Gunakan input manual.");
          return;
        }
        const detector = new Detector({ formats: ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e"] });
        scanTimerRef.current = window.setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes?.length) {
              const value = codes[0]?.rawValue || "";
              if (value) {
                applyBarcode(value);
              }
            }
          } catch {
            // ignore detection errors
          }
        }, 500);
      } catch (err) {
        setScanError("Gagal membuka kamera.");
      }
    };
    start();
    return () => stopScanner();
  }, [scanOpen, scanRestartKey]);

  useEffect(() => {
    if (!scanOpen || !navigator.permissions?.query) return;
    let active = true;
    const checkPermission = async () => {
      setCameraChecking(true);
      try {
        const status = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (!active) return;
        setCameraPermission(status.state);
        status.onchange = () => setCameraPermission(status.state);
      } catch {
        if (active) setCameraPermission("unknown");
      } finally {
        if (active) setCameraChecking(false);
      }
    };
    checkPermission();
    return () => {
      active = false;
    };
  }, [scanOpen]);

  const refreshCamera = () => {
    setScanError(null);
    stopScanner();
    setScanRestartKey((v) => v + 1);
  };

  const showToast = (next: { type: "success" | "error"; message: string }) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    let active = true;
    const fetchDetail = async () => {
      if (!decodedId) {
        setError("ID RPO tidak valid.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/rpo/${encodeURIComponent(decodedId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const header = payload?.header || {};
        const rows = Array.isArray(payload?.items) ? payload.items : [];
        const mappedItems: ItemRow[] = rows.map((it: any, idx: number) => ({
          sku: it.kode_barang_variant || it.kode_varian || it.kode_barang || `ITEM-${idx + 1}`,
          name: it.barang_nama || it.nama_barang || it.nama || "-",
          barcode: it.barcode_varian || it.barcode_global || null,
          variant: it.kode_barang_variant || it.nama_varian || it.kode_varian || null,
          kodeBarangVariant: it.kode_barang_variant || null,
          kodeDRpo: it.kode_d_rpo || null,
          expiredDates: Array.isArray(it.expired_dates) ? it.expired_dates : [],
          qtyOrdered: Number(it.qty ?? 0),
          qtyReceived: Number(it.qty_diterima ?? it.qty_received ?? 0),
          unit: it.satuan || it.unit || "pcs",
        }));
        const totalQty =
          Number(header.total_barang) ||
          mappedItems.reduce((sum, item) => sum + (Number(item.qtyOrdered) || 0), 0);
        const totalItems = Number(header.total_item) || mappedItems.length;
        if (!active) return;
        setPo({
          id: header.kode_t_rpo || decodedId,
          supplier: header.supplier_nama || header.kode_supplier || "-",
          date: header.tgl ? String(header.tgl).slice(0, 10) : "-",
          totalItems,
          totalQty,
        });
        setItems(mappedItems);
      } catch (err) {
        const fallback = poList.find((p) => p.id === decodedId);
        if (fallback && active) {
          setPo({
            id: fallback.id,
            supplier: fallback.supplier,
            date: fallback.date,
            totalItems: fallback.totalItems,
            totalQty: fallback.totalQty,
          });
          setItems(fallback.items.map((it) => ({ ...it })));
        } else if (active) {
          setError("Data RPO tidak ditemukan.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchDetail();
    return () => {
      active = false;
    };
  }, [API_BASE, decodedId]);

  if (!decodedId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
          ID RPO tidak valid.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
          Memuat detail RPO...
        </div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <Link
          href="/penerimaan-barang"
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error || "Data tidak ditemukan."}
        </div>
      </div>
    );
  }

  const handleQtyChange = (sku: string, value: number) => {
    setSaved(false);
    setItems((prev) =>
      prev.map((it) =>
        it.sku === sku
          ? {
              ...it,
              qtyReceived: Math.max(0, Math.min(value, it.qtyOrdered)),
            }
          : it
      )
    );

    const target = items.find((it) => it.sku === sku);
    if (!target?.kodeDRpo || !po?.id) return;
    const timerKey = target.kodeDRpo;
    if (saveTimersRef.current[timerKey]) {
      window.clearTimeout(saveTimersRef.current[timerKey]);
    }
    saveTimersRef.current[timerKey] = window.setTimeout(async () => {
      const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
      let updatedBy = "Admin";
      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession);
          updatedBy = parsed?.username || parsed?.name || updatedBy;
        } catch {
          // ignore parse error
        }
      }
      try {
        const res = await fetch(`${API_BASE}/rpo/${encodeURIComponent(po.id)}/received-qty`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kode_d_rpo: target.kodeDRpo,
            qty_diterima: Math.max(0, Math.floor(value)),
            updated_by: updatedBy,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showToast({ type: "success", message: "Qty diterima tersimpan." });
      } catch (err) {
        showToast({ type: "error", message: "Gagal menyimpan qty diterima." });
      }
    }, 600);
  };

  const updateExpiredDates = (kodeBarangVariant: string, dates: string[]) => {
    setItems((prev) =>
      prev.map((it) =>
        it.kodeBarangVariant === kodeBarangVariant ? { ...it, expiredDates: dates } : it
      )
    );
  };

  const queueExpiredSave = (kodeBarangVariant: string, dates: string[]) => {
    if (!po?.id || !kodeBarangVariant) return;
    const timerKey = `expired:${kodeBarangVariant}`;
    if (saveTimersRef.current[timerKey]) {
      window.clearTimeout(saveTimersRef.current[timerKey]);
    }
    saveTimersRef.current[timerKey] = window.setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/rpo/${encodeURIComponent(po.id)}/expired`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kode_barang_variant: kodeBarangVariant,
            expired_dates: dates.filter((d) => d),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showToast({ type: "success", message: "Expired tersimpan." });
      } catch (err) {
        showToast({ type: "error", message: "Gagal menyimpan expired." });
      }
    }, 700);
  };

  const openScanner = (index: number) => {
    setScanError(null);
    setManualBarcode("");
    setScanIndex(index);
    setScanMode("row");
    setScanOpen(true);
  };

  const openSearchScanner = () => {
    setScanError(null);
    setManualBarcode("");
    setScanIndex(null);
    setScanMode("search");
    setScanOpen(true);
  };

  const applyBarcode = (value: string) => {
    if (scanMode === "search") {
      setSearchQuery(value);
      setScanOpen(false);
      return;
    }
    if (scanIndex === null) return;
    setItems((prev) => prev.map((item, idx) => (idx === scanIndex ? { ...item, barcode: value } : item)));
    setScanOpen(false);
    const target = items[scanIndex];
    const kodeBarangVariant = target?.kodeBarangVariant || target?.sku;
    if (!kodeBarangVariant) {
      setScanError("Kode varian tidak ditemukan untuk update barcode.");
      return;
    }
    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let updatedBy = "Admin";
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        updatedBy = parsed?.username || parsed?.name || updatedBy;
      } catch {
        // ignore parse error
      }
    }
    fetch(`${API_BASE}/barang/varian/barcode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kode_barang_variant: kodeBarangVariant,
        barcode_varian: value,
        updated_by: updatedBy,
      }),
    }).then(async (res) => {
      if (!res.ok) {
        setScanError("Gagal update barcode varian.");
      }
    }).catch(() => {
      setScanError("Gagal update barcode varian.");
    });
  };

  const handleSave = () => {
    if (!po?.id) return;
    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let updatedBy = "Admin";
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        updatedBy = parsed?.username || parsed?.name || updatedBy;
      } catch {
        // ignore parse error
      }
    }
    setSaved(true);
    fetch(`${API_BASE}/rpo/${encodeURIComponent(po.id)}/validasi-gudang`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ validasi_gudang_by: updatedBy }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showToast({ type: "success", message: "Validasi gudang tersimpan." });
      })
      .catch(() => {
        showToast({ type: "error", message: "Gagal menyimpan validasi gudang." });
      })
      .finally(() => {
        setTimeout(() => setSaved(false), 1500);
      });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/penerimaan-barang"
            className="mt-1 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#0f756b]">
              Detail PO
            </p>
            <h1 className="text-2xl font-bold text-gray-900">{po.id}</h1>
            <p className="text-sm text-gray-600">
              {po.supplier} • {formatTanggal(po.date)}
            </p>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            status === "Selesai"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-amber-50 text-amber-700 border-amber-100"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="rounded-2xl border border-[#0f756b]/15 bg-white/90 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total item</p>
          <p className="text-2xl font-bold text-gray-900">{po.totalItems}</p>
        </div>
        <div className="rounded-2xl border border-[#0f756b]/15 bg-white/90 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Qty dipesan</p>
          <p className="text-2xl font-bold text-gray-900">{po.totalQty} pcs</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-emerald-700" />
          <div>
            <p className="text-xs text-emerald-700">Qty diterima</p>
            <p className="text-xl font-bold text-emerald-800">{receivedCount} pcs</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[#0f756b]/15 bg-white/95 shadow-lg shadow-[#3fe0d0]/10 p-4 lg:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <PackageOpen className="h-4 w-4 text-[#0f756b]" />
          Item dalam Nota
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama barang, barcode, atau kode"
            className="flex-1 min-w-[220px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            onClick={openSearchScanner}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Scan Barcode
          </button>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">Nama Barang</th>
                <th className="px-3 py-2 text-left">Barcode</th>
                <th className="px-3 py-2 text-left">Expired</th>
                <th className="px-3 py-2 text-right">Qty PO</th>
                <th className="px-3 py-2 text-right">Qty Diterima</th>
                <th className="px-3 py-2 text-left">Satuan</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map((item, index) => {
                const selesai = item.qtyReceived >= item.qtyOrdered;
                const displayExpired = item.expiredDates && item.expiredDates.length > 0 ? item.expiredDates : [""];
                return (
                  <tr key={`${item.sku}-${index}`} className="hover:bg-gray-50/80">
                    <td className="px-3 py-2 font-semibold text-gray-900">{index + 1}</td>
                    <td className="px-3 py-2 text-gray-700">{item.name}</td>
                    <td className="px-3 py-2 text-gray-600">
                      <div className="flex items-center gap-2">
                        <span>{item.barcode || "-"}</span>
                        <button
                          onClick={() => openScanner(index)}
                          className="px-2 py-1 rounded-md border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Ubah
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      <div className="space-y-2">
                        {displayExpired.map((dateValue, idx) => (
                          <div key={`${item.sku}-exp-${idx}`} className="flex items-center gap-2">
                            <input
                              type="date"
                              value={dateValue}
                              onChange={(e) => {
                                const next = [...displayExpired];
                                next[idx] = e.target.value;
                                const sanitized = next.filter((d) => d);
                                updateExpiredDates(item.kodeBarangVariant || item.sku, sanitized);
                                queueExpiredSave(item.kodeBarangVariant || item.sku, sanitized);
                              }}
                              className="rounded-md border border-gray-200 px-2 py-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = displayExpired.filter((_, i) => i !== idx);
                                const sanitized = next.filter((d) => d);
                                updateExpiredDates(item.kodeBarangVariant || item.sku, sanitized);
                                queueExpiredSave(item.kodeBarangVariant || item.sku, sanitized);
                              }}
                              className="px-2 py-1 rounded-md border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50"
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...displayExpired, ""];
                            updateExpiredDates(item.kodeBarangVariant || item.sku, next.filter((d) => d));
                          }}
                          className="px-2 py-1 rounded-md border border-dashed border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50"
                        >
                          + Tambah
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">{item.qtyOrdered}</td>
                    <td className="px-3 py-2 text-right text-gray-900 font-semibold">
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          min={0}
                          max={item.qtyOrdered}
                          value={item.qtyReceived}
                          onChange={(e) => handleQtyChange(item.sku, Number(e.target.value))}
                          onFocus={(e) => e.currentTarget.select()}
                          onClick={(e) => e.currentTarget.select()}
                          className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-right text-sm"
                        />
                        <span className="text-xs text-gray-500">{item.unit}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{item.unit}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold border ${
                          selesai
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-amber-50 text-amber-700 border-amber-100"
                        }`}
                      >
                        <PackageCheck className="h-3.5 w-3.5" />
                        {selesai ? "Sudah lengkap" : "Belum lengkap"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-500">
            Masukkan qty diterima sesuai fisik barang, lalu simpan untuk membuat nota penerimaan.
          </p>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f756b] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#0f756b]/30 transition hover:-translate-y-0.5 hover:shadow-lg hover:bg-[#0d6a62]"
          >
            Simpan & Buat Nota
          </button>
        </div>

      {saved && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 space-y-2">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4" />
              <span className="font-semibold">Nota penerimaan tersimpan (dummy)</span>
            </div>
            <div className="text-xs text-emerald-800/90">
              ID PO: <span className="font-semibold">{po.id}</span> • Supplier: {po.supplier}
            </div>
            <div className="grid gap-2 md:grid-cols-2 text-xs">
              {items.map((it) => (
                <div key={it.sku} className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 border border-emerald-100">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{it.name}</p>
                    <p className="text-gray-500">
                      {it.sku} • PO {it.qtyOrdered} {it.unit}
                    </p>
                  </div>
                  <div className="text-right font-semibold text-emerald-700">
                    {it.qtyReceived} {it.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setScanOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Scan Barcode</p>
                <h3 className="text-lg font-bold text-gray-900">Kamera</h3>
              </div>
              <button
                onClick={() => setScanOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Tutup
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
              <video ref={videoRef} className="w-full h-56 object-cover" muted playsInline />
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <span>Status izin: {cameraChecking ? "memeriksa..." : cameraPermission}</span>
              <button
                onClick={refreshCamera}
                className="ml-auto px-2 py-1 rounded-md border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Refresh Kamera
              </button>
            </div>

            {scanError && (
              <div className="mt-3 text-xs text-rose-600">{scanError}</div>
            )}

            <div className="mt-3">
              <label className="text-xs text-gray-500">Input manual</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Masukkan barcode"
                />
                <button
                  onClick={() => manualBarcode && applyBarcode(manualBarcode)}
                  className="px-3 py-2 rounded-lg bg-[#0f756b] text-white text-sm font-semibold hover:bg-[#0d6a62]"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg border ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
