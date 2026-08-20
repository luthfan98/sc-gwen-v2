"use client";

import { CheckCircle2, History, Plus, RefreshCcw, Trash2, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Select, { type CSSObjectWithLabel, type SingleValue } from "react-select";
import Swal from "sweetalert2";

const getCurrentUsername = () => {
  const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
  if (!rawSession) return "Admin";
  try {
    const parsed = JSON.parse(rawSession);
    return String(parsed?.username || parsed?.name || "Admin").trim() || "Admin";
  } catch {
    return "Admin";
  }
};

const readApiErrorMessage = async (res: Response) => {
  const fallback = `HTTP ${res.status}`;
  const raw = await res.text().catch(() => "");
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    const detail =
      parsed?.detail ||
      parsed?.error ||
      parsed?.message ||
      (Array.isArray(parsed?.errors) ? parsed.errors.join(", ") : "");
    return String(detail || raw || fallback);
  } catch {
    return raw || fallback;
  }
};

const showValidationAlert = (text: string) =>
  Swal.fire({
    icon: "warning",
    title: "Data belum lengkap",
    text,
    confirmButtonText: "OK",
  });

type PengadaanPreviewSlot = {
  slot: string;
  kodeTPengadaan: string;
  statusBayar: string;
  qty: number;
  sisa: number;
  persen: number | null;
  umurHari: number | null;
  isCurrent: boolean;
} | null;

type PengadaanPreviewRow = {
  kodeBarangVariant: string;
  namaBarang: string;
  namaSupplier: string | null;
  stokGudang: number;
  stokToko: number;
  slots: PengadaanPreviewSlot[];
};

type PengadaanPreviewPayload = {
  header?: {
    kode_t_pengadaan?: string;
    nama_supplier?: string | null;
    total_akhir?: number | null;
    no_faktur_supplier?: string | null;
    tgl?: string | null;
  } | null;
  limit?: number;
  slot_order?: string[];
  rows?: PengadaanPreviewRow[];
};

export default function HistoryKontrabonPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingKontrabon, setEditingKontrabon] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<"paid" | "unpaid">("unpaid");
  const [searchTerm, setSearchTerm] = useState("");
  const [suppliers, setSuppliers] = useState<
    { kode_supplier: string; nama: string; status?: number | null; supplier_status?: number | null }[]
  >([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierValue, setSupplierValue] = useState<{ value: string; label: string } | null>(null);
  const [rekeningLoading, setRekeningLoading] = useState(false);
  const [rekeningList, setRekeningList] = useState<
    {
      id: number;
      kode_supplier: string | null;
      nama_supplier: string | null;
      nama_bank: string | null;
      no_rekening: string | null;
      atas_nama: string | null;
      cabang: string | null;
      status: number | boolean;
    }[]
  >([]);
  const [rekeningValue, setRekeningValue] = useState<{ value: number; label: string } | null>(null);
  const [pengadaanLoading, setPengadaanLoading] = useState(false);
  const [pengadaanList, setPengadaanList] = useState<
    {
      kode_t_pengadaan: string;
      kode_t_rpo: string | null;
      kode_supplier: string | null;
      total_akhir: number | null;
      total_dibayar: number | null;
      total_tagihan?: number | null;
      is_lunas?: number | boolean | null;
      status_paid?: string | null;
    }[]
  >([]);
  const [pengadaanRows, setPengadaanRows] = useState<
    { id: string; kode_t_pengadaan: string; nominal: string }[]
  >([{ id: "row-1", kode_t_pengadaan: "", nominal: "" }]);
  const [pengadaanPreviewMap, setPengadaanPreviewMap] = useState<Record<string, PengadaanPreviewPayload>>({});
  const [pengadaanPreviewLoading, setPengadaanPreviewLoading] = useState<Record<string, boolean>>({});
  const [nominalFakturInput, setNominalFakturInput] = useState("");
  const [nominalFakturManual, setNominalFakturManual] = useState(false);
  const [nomorKontrabon, setNomorKontrabon] = useState("");
  const [kodeLoading, setKodeLoading] = useState(false);
  const [generatingTagihan, setGeneratingTagihan] = useState<Record<string, boolean>>({});
  const [biayaLainRows, setBiayaLainRows] = useState<
    { id: string; tanda: string; jenis: string; nominal: string; keterangan: string }[]
  >([]);
  const [tglKontrabon, setTglKontrabon] = useState("");
  const [tglFaktur, setTglFaktur] = useState("");
  const [tglPpj, setTglPpj] = useState("");
  const [rencanaTfDari, setRencanaTfDari] = useState("");
  const [rencanaTfSampai, setRencanaTfSampai] = useState("");
  const [noFaktur, setNoFaktur] = useState("");
  const [tglFakturPajak, setTglFakturPajak] = useState("");
  const [noFakturPajak, setNoFakturPajak] = useState("");
  const [savingKontrabon, setSavingKontrabon] = useState(false);
  const [kontrabonItems, setKontrabonItems] = useState<any[]>([]);
  const [kontrabonLoading, setKontrabonLoading] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

  useEffect(() => {
    const fetchSuppliers = async () => {
      setSupplierLoading(true);
      try {
        const res = await fetch(`${API_BASE}/suppliers`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const mapped = Array.isArray(data)
          ? data.map((row: any) => ({
              kode_supplier: row.kode_supplier,
              nama: row.nama || row.nama_supplier || row.supplier || "",
              status: row.status ?? null,
              supplier_status: row.supplier_status ?? null,
            }))
          : [];
        setSuppliers(mapped);
      } catch (err) {
        console.error("Failed fetch suppliers", err);
        setSuppliers([]);
      } finally {
        setSupplierLoading(false);
      }
    };
    fetchSuppliers();
  }, [API_BASE]);

  const supplierOptions = useMemo(
    () =>
      suppliers
        .filter((s) => Number(s.status ?? 0) === 1)
        .map((s) => ({ value: s.kode_supplier, label: s.nama })),
    [suppliers]
  );

  const supplierNameMap = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((supplier) => {
      const code = String(supplier.kode_supplier || "").trim();
      const name = String(supplier.nama || "").trim();
      if (code && name) map.set(code, name);
    });
    return map;
  }, [suppliers]);

  const rekeningOptions = useMemo(
    () =>
      rekeningList
        .filter((r) => Number(r.status ?? 0) === 1)
        .map((r) => ({
          value: r.id,
          label: `${r.nama_bank || "-"} - ${r.no_rekening || "-"}`,
        })),
    [rekeningList]
  );

  const selectedRekening = rekeningValue
    ? rekeningList.find((r) => r.id === rekeningValue.value) || null
    : null;

  const parsePengadaanCodes = (raw?: string | null) => {
    if (!raw) return [];
    const trimmed = String(raw).trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => String(c || "").trim()).filter((c) => c);
      }
    } catch {
      // fallback to raw string
    }
    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c);
    }
    return [trimmed];
  };

  const parseTagihanCodes = (raw?: string | null) => {
    if (!raw) return [];
    return String(raw)
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c);
  };

  const splitSlashList = (raw?: string | null) =>
    String(raw || "")
      .split(/[\/\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);

  const renderSlashList = (raw?: string | null) => {
    const items = splitSlashList(raw);
    if (items.length === 0) return "-";
    if (items.length === 1) return items[0];
    return (
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div key={`${item}-${idx}`}>{item}</div>
        ))}
      </div>
    );
  };

  const renderSlashSubList = (raw?: string | null) => {
    const items = splitSlashList(raw);
    if (items.length === 0) return null;
    return (
      <div className="mt-0.5 space-y-0.5">
        {items.map((item, idx) => (
          <div key={`${item}-${idx}`} className="text-gray-600">
            • {item}
          </div>
        ))}
      </div>
    );
  };

  const isPengadaanPaid = (item?: {
    is_lunas?: number | boolean | null;
    status_paid?: string | null;
  } | null) => {
    const statusPaid = String(item?.status_paid || "").trim().toLowerCase();
    return Number(item?.is_lunas ?? 0) === 1 || item?.is_lunas === true || statusPaid === "paid";
  };

  const paidPengadaanSet = useMemo(() => {
    const set = new Set<string>();
    pengadaanList.forEach((item) => {
      const code = String(item?.kode_t_pengadaan || "").trim();
      if (code && isPengadaanPaid(item)) {
        set.add(code);
      }
    });
    if (editingKontrabon?.kode_t_pengadaan) {
      const currentCodes = parsePengadaanCodes(editingKontrabon.kode_t_pengadaan);
      currentCodes.forEach((code) => set.delete(code));
    }
    return set;
  }, [pengadaanList, editingKontrabon]);

  const getAvailablePengadaan = (currentId: string) => {
    const currentRow = pengadaanRows.find((row) => row.id === currentId);
    const currentCode = currentRow?.kode_t_pengadaan || "";
    const selectedCodes = new Set(
      pengadaanRows
        .filter((row) => row.id !== currentId)
        .map((row) => row.kode_t_pengadaan)
        .filter((code) => code)
    );
    return pengadaanList.filter((item) => {
      const code = String(item.kode_t_pengadaan || "").trim();
      if (!code) return false;
      if (selectedCodes.has(code)) return false;
      if (paidPengadaanSet.has(code) && code !== currentCode) return false;
      return true;
    });
  };

  const fetchRekeningForSupplier = async (kodeSupplier: string) => {
    setRekeningLoading(true);
    try {
      const res = await fetch(`${API_BASE}/rekening-supplier`);
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : [];
      setRekeningList(
        list.filter((row: any) => String(row.kode_supplier || "") === String(kodeSupplier || ""))
      );
    } catch (err) {
      console.error("Failed fetch rekening supplier", err);
      setRekeningList([]);
    } finally {
      setRekeningLoading(false);
    }
  };

  const fetchKontrabonDetail = async (noKontrabon: string) => {
    const res = await fetch(`${API_BASE}/kontrabon/${encodeURIComponent(noKontrabon)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const fetchPengadaanForSupplier = async (kodeSupplier: string, extraCodes: string[] = []) => {
    setPengadaanLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/pengadaan?kode_supplier=${encodeURIComponent(kodeSupplier)}`
      );
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : [];
      const map = new Map<string, any>();
      list.forEach((row: any) => {
        if (row?.kode_t_pengadaan) map.set(String(row.kode_t_pengadaan), row);
      });
      const missingCodes = extraCodes
        .map((code) => String(code || "").trim())
        .filter((code) => code && !map.has(code));
      if (missingCodes.length) {
        const detailResults = await Promise.all(
          missingCodes.map((code) =>
            fetch(`${API_BASE}/pengadaan/${encodeURIComponent(code)}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        );
        detailResults.forEach((data, idx) => {
          const code = missingCodes[idx];
          const header = data?.header || null;
          if (!header) return;
          map.set(code, {
            kode_t_pengadaan: code,
            total_akhir: header?.total_akhir ?? null,
            kode_t_rpo: header?.kode_t_rpo ?? null,
            kode_supplier: header?.kode_supplier ?? kodeSupplier,
            total_dibayar: header?.total_dibayar ?? null,
            total_tagihan: header?.total_tagihan ?? null,
            is_lunas: header?.is_lunas ?? null,
            status_paid: header?.status_paid ?? null,
          });
        });
      }
      setPengadaanList(Array.from(map.values()));
    } catch (err) {
      console.error("Failed fetch pengadaan list", err);
      setPengadaanList([]);
    } finally {
      setPengadaanLoading(false);
    }
  };

  const fetchPengadaanPreview = useCallback(async (kodePengadaan: string) => {
    const kode = String(kodePengadaan || "").trim();
    if (!kode) return;
    setPengadaanPreviewLoading((prev) => ({ ...prev, [kode]: true }));
    try {
      const res = await fetch(`${API_BASE}/kontrabon/pengadaan/${encodeURIComponent(kode)}/rasio-preview?limit=3`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PengadaanPreviewPayload;
      setPengadaanPreviewMap((prev) => ({ ...prev, [kode]: data || {} }));
    } catch (err) {
      console.error("Failed fetch pengadaan preview", err);
      setPengadaanPreviewMap((prev) => ({ ...prev, [kode]: { rows: [], slot_order: ["K3", "K2", "K1"] } }));
    } finally {
      setPengadaanPreviewLoading((prev) => ({ ...prev, [kode]: false }));
    }
  }, [API_BASE]);

  const toDateInput = (value?: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  const formatCurrency = (value?: number | null) => {
    const safe = Number(value ?? 0);
    if (!Number.isFinite(safe)) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(safe);
  };

  const formatNumber = (value?: number | null) => {
    const safe = Number(value ?? 0);
    if (!Number.isFinite(safe)) return "0";
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(safe);
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  };

  const previewSlotCellClass = (slot?: PengadaanPreviewSlot) => {
    if (!slot || slot.persen === null) return "bg-slate-50 text-slate-500";
    if (slot.persen <= 30) return "bg-emerald-200 text-emerald-950";
    return "bg-rose-200 text-rose-950";
  };

  const previewSlotBadgeClass = (slot?: PengadaanPreviewSlot) => {
    if (!slot || slot.persen === null) return "border border-slate-200 bg-white/80 text-slate-500";
    if (slot.persen <= 30) return "border border-emerald-300 bg-emerald-100 text-emerald-900";
    return "border border-rose-300 bg-rose-100 text-rose-900";
  };

  const previewCurrentBorderClass = (slot: PengadaanPreviewSlot, position: "first" | "middle" | "last") => {
    if (!slot?.isCurrent) return "";
    if (position === "first") return "border-l-2 border-y-2 border-l-sky-700 border-y-sky-700";
    if (position === "last") return "border-r-2 border-y-2 border-r-sky-700 border-y-sky-700";
    return "border-y-2 border-y-sky-700";
  };

  const handleDisableKontrabon = async (no_kontrabon: string) => {
    if (!no_kontrabon) return;
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Nonaktifkan kontrabon?",
      text: `Kontrabon ${no_kontrabon} akan dinonaktifkan.`,
      showCancelButton: true,
      confirmButtonText: "Ya, nonaktifkan",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;
    const updatedBy = getCurrentUsername();
    try {
      const res = await fetch(
        `${API_BASE}/kontrabon/${encodeURIComponent(no_kontrabon)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: 0, updated_by: updatedBy }),
        }
      );
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      fetchKontrabon();
    } catch (err) {
      console.error("Failed disable kontrabon", err);
      await Swal.fire({
        icon: "error",
        title: "Gagal menonaktifkan kontrabon",
        text: err instanceof Error ? err.message : "Terjadi kesalahan saat menonaktifkan kontrabon.",
        confirmButtonText: "OK",
      });
    }
  };

  const handleGenerateTagihan = async (row: any) => {
    const noKontrabon = String(row?.no_kontrabon || "").trim();
    if (!noKontrabon) return;
    const confirm = await Swal.fire({
      icon: "question",
      title: "Generate tagihan?",
      text: `Buat tagihan untuk kontrabon ${noKontrabon}?`,
      showCancelButton: true,
      confirmButtonText: "Ya, generate",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;
    const createdBy = getCurrentUsername();
    setGeneratingTagihan((prev) => ({ ...prev, [noKontrabon]: true }));
    try {
      const res = await fetch(
        `${API_BASE}/kontrabon/${encodeURIComponent(noKontrabon)}/generate-tagihan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ created_by: createdBy }),
        }
      );
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const payload = await res.json();
      fetchKontrabon();
      await Swal.fire({
        icon: "success",
        title: "Generate tagihan selesai",
        text: `Dibuat: ${payload?.created_count ?? 0}, dilewati: ${payload?.skipped_pengadaan?.length ?? 0}`,
        confirmButtonText: "OK",
      });
    } catch (err) {
      console.error("Failed generate tagihan", err);
      await Swal.fire({
        icon: "error",
        title: "Gagal generate tagihan",
        text: err instanceof Error ? err.message : "Terjadi kesalahan saat generate tagihan.",
        confirmButtonText: "OK",
      });
    } finally {
      setGeneratingTagihan((prev) => ({ ...prev, [noKontrabon]: false }));
    }
  };

  const parseBiayaLainTotal = (raw?: string | null) => {
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return 0;
      return parsed.reduce((sum: number, item: any) => {
        const nominal = Number(item?.nominal ?? 0);
        if (!nominal) return sum;
        return item?.jenis === "+" ? sum + nominal : sum - nominal;
      }, 0);
    } catch {
      return 0;
    }
  };

  const getTagihanTotal = useCallback((row: any) => {
    const derived = Number(row?.total_tagihan_aktif ?? 0);
    if (Number.isFinite(derived) && derived > 0) return derived;
    return Number(row?.nominal_total ?? 0);
  }, []);

  const getNominalFaktur = useCallback((row: any) => {
    const derived = Number(row?.nominal_faktur ?? 0);
    if (Number.isFinite(derived) && derived > 0) return derived;
    return getTagihanTotal(row);
  }, [getTagihanTotal]);

  const getNominalTotal = useCallback((row: any) => {
    const derived = Number(row?.nominal_total ?? 0);
    if (Number.isFinite(derived) && derived > 0) return derived;
    const tagihanTotal = getTagihanTotal(row);
    const biayaLainTotal = parseBiayaLainTotal(row?.biaya_lain);
    return tagihanTotal + biayaLainTotal;
  }, [getTagihanTotal]);

  const summaryStats = useMemo(() => {
    const paidItems = kontrabonItems.filter(
      (item) => String(item.status_paid || "").toLowerCase() === "paid"
    );
    const unpaidItems = kontrabonItems.filter(
      (item) => String(item.status_paid || "").toLowerCase() !== "paid"
    );
    const paidTotal = paidItems.reduce(
      (sum, item) => sum + getNominalTotal(item),
      0
    );
    const unpaidTotal = unpaidItems.reduce(
      (sum, item) => sum + getNominalTotal(item),
      0
    );
    return {
      paidTotal,
      unpaidTotal,
      paidCount: paidItems.length,
      unpaidCount: unpaidItems.length,
      kontrabonCount: kontrabonItems.length,
    };
  }, [kontrabonItems, getNominalTotal]);

  const parseNumber = (value: string) => {
    const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getPengadaanGrossAmount = useCallback((
    row: { nominal?: string | null } | undefined,
    item?: {
      total_akhir?: number | null;
    } | null
  ) => {
    const totalAkhir = Number(item?.total_akhir ?? 0);
    if (Number.isFinite(totalAkhir) && totalAkhir > 0) return totalAkhir;
    return parseNumber(row?.nominal || "");
  }, []);

  const getPengadaanDisplayAmount = (
    row: { nominal?: string | null } | undefined,
    item?: {
      total_akhir?: number | null;
      total_tagihan?: number | null;
    } | null
  ) => {
    return getPengadaanGrossAmount(row, item);
  };

  const nominalFakturTotal = useMemo(() => {
    return pengadaanRows.reduce((sum, row) => {
      if (!row.kode_t_pengadaan) return sum;
      const found = pengadaanList.find((item) => item.kode_t_pengadaan === row.kode_t_pengadaan);
      return sum + getPengadaanGrossAmount(row, found);
    }, 0);
  }, [getPengadaanGrossAmount, pengadaanRows, pengadaanList]);

  const paidBadge = (value?: string | null) => {
    const label = value || "-";
    const normalized = label.toLowerCase();
    const isPaid =
      normalized === "paid" ||
      normalized === "lunas" ||
      normalized === "terbayar";
    const badgeClass = isPaid ? "bg-emerald-600" : "bg-rose-600";
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold text-white ${badgeClass}`}>
        {label}
      </span>
    );
  };

  const isPaidStatus = (value?: string | null) => {
    const normalized = String(value || "").toLowerCase();
    return normalized === "paid" || normalized === "lunas" || normalized === "terbayar";
  };

  const filteredKontrabonItems = useMemo(() => {
    const normalize = (value: any) => String(value ?? "").toLowerCase().trim();
    const dateText = (value?: string | null) => {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return [date.toLocaleDateString("id-ID"), date.toISOString().slice(0, 10)].join(" ");
    };
    const query = normalize(searchTerm);

    return kontrabonItems.filter((item) => {
      const statusMatches =
        statusFilter === "paid" ? isPaidStatus(item.status_paid) : !isPaidStatus(item.status_paid);
      if (!statusMatches) return false;
      if (!query) return true;

      const supplierName =
        supplierNameMap.get(String(item.kode_supplier || "").trim()) ||
        item.nama_supplier ||
        item.kode_supplier ||
        "";
      const biayaLainText = (() => {
        try {
          const parsed = item.biaya_lain ? JSON.parse(item.biaya_lain) : [];
          if (!Array.isArray(parsed)) return String(item.biaya_lain || "");
          return parsed
            .map((row: any) => `${row?.jenis || ""} ${row?.nominal || ""} ${row?.keterangan || ""} ${row?.tipe || ""}`)
            .join(" ");
        } catch {
          return String(item.biaya_lain || "");
        }
      })();
      const searchable = [
        item.no_kontrabon,
        item.no_faktur,
        item.no_faktur_supplier_list,
        item.kode_t_pengadaan,
        item.kode_t_tagihan_list,
        item.status_paid,
        item.tgl_bayar,
        item.kode_supplier,
        supplierName,
        biayaLainText,
        formatCurrency(getNominalFaktur(item)),
        formatCurrency(getNominalTotal(item)),
        dateText(item.tgl_faktur),
        dateText(item.tgl_kontrabon),
        dateText(item.tgl_bayar),
      ]
        .map(normalize)
        .join(" ");

      return searchable.includes(query);
    });
  }, [kontrabonItems, statusFilter, searchTerm, supplierNameMap, getNominalFaktur, getNominalTotal]);

  const nominalFakturValue = useMemo(() => {
    return nominalFakturManual ? parseNumber(nominalFakturInput) : nominalFakturTotal;
  }, [nominalFakturManual, nominalFakturInput, nominalFakturTotal]);

  const biayaLainTotal = useMemo(() => {
    return biayaLainRows.reduce((sum, row) => {
      const nominal = Number(row.nominal || 0);
      if (!nominal) return sum;
      return row.tanda === "+" ? sum + nominal : sum - nominal;
    }, 0);
  }, [biayaLainRows]);

  const totalNominalAkhir = useMemo(
    () => nominalFakturValue + biayaLainTotal,
    [nominalFakturValue, biayaLainTotal]
  );

  const selectedPreviewCodes = useMemo(
    () =>
      [...new Set(
        pengadaanRows
          .map((row) => String(row.kode_t_pengadaan || "").trim())
          .filter(Boolean)
      )],
    [pengadaanRows]
  );

  useEffect(() => {
    if (!nominalFakturManual) {
      setNominalFakturInput(nominalFakturTotal ? String(nominalFakturTotal) : "");
    }
  }, [nominalFakturTotal, nominalFakturManual]);

  useEffect(() => {
    if (!showModal || editingKontrabon) return;
    setKodeLoading(true);
    fetch(`${API_BASE}/kontrabon/next-code`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setNomorKontrabon(data?.kode || ""))
      .catch((err) => {
        console.error("Failed fetch kontrabon code", err);
        setNomorKontrabon("");
      })
      .finally(() => setKodeLoading(false));
  }, [showModal, editingKontrabon, API_BASE]);

  useEffect(() => {
    document.body.classList.add("kontrabon-no-x");
    return () => {
      document.body.classList.remove("kontrabon-no-x");
    };
  }, []);

  const fetchKontrabon = useCallback(async () => {
    setKontrabonLoading(true);
    try {
      const res = await fetch(`${API_BASE}/kontrabon`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setKontrabonItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed fetch kontrabon list", err);
      setKontrabonItems([]);
    } finally {
      setKontrabonLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchKontrabon();
  }, [fetchKontrabon]);

  useEffect(() => {
    if (!showModal) return;
    selectedPreviewCodes.forEach((code) => {
      if (pengadaanPreviewMap[code] || pengadaanPreviewLoading[code]) return;
      fetchPengadaanPreview(code);
    });
  }, [showModal, selectedPreviewCodes, pengadaanPreviewMap, pengadaanPreviewLoading, fetchPengadaanPreview]);

  return (
    <div className="min-h-screen bg-slate-100/60 p-4 md:p-6 space-y-6 overflow-x-hidden">
      <style jsx global>{`
        body.kontrabon-no-x {
          overflow-x: hidden;
        }
      `}</style>
      <div className="space-y-1">
        <p className="text-sm text-gray-500">Master Kontrabon</p>
        <h1 className="text-2xl font-bold text-gray-900">History Kontrabon</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 text-white p-4 shadow-lg">
          <p className="text-sm uppercase tracking-wide text-white/80">Total Paid</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(summaryStats.paidTotal)}</p>
          <p className="mt-3 text-sm text-white/70">{summaryStats.paidCount} Nota</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-red-400 text-white p-4 shadow-lg">
          <p className="text-sm uppercase tracking-wide text-white/80">Total Belum Paid</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(summaryStats.unpaidTotal)}</p>
          <p className="mt-3 text-sm text-white/70">{summaryStats.unpaidCount} Nota</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 text-white p-4 shadow-lg">
          <p className="text-sm uppercase tracking-wide text-white/80">Total Kontrabon</p>
          <p className="mt-2 text-2xl font-semibold">{summaryStats.kontrabonCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
            onClick={fetchKontrabon}
            type="button"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm ${
              statusFilter === "paid" ? "bg-emerald-600" : "bg-emerald-500/60"
            }`}
            onClick={() => setStatusFilter("paid")}
          >
            <CheckCircle2 className="h-4 w-4" />
            Tampilkan Sudah Lunas
          </button>
          <button
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm ${
              statusFilter === "unpaid" ? "bg-amber-600" : "bg-amber-500/60"
            }`}
            onClick={() => setStatusFilter("unpaid")}
          >
            <XCircle className="h-4 w-4" />
            Tampilkan Belum Lunas
          </button>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
          onClick={() => setShowModal(true)}
          type="button"
        >
          <Plus className="h-4 w-4" />
          Tambah
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm w-full max-w-[calc(100vw-330px)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Riwayat Kontrabon</p>
              <p className="text-base font-semibold text-gray-800">History Kontrabon</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Search:</span>
            <input
              className="rounded-md border border-gray-200 px-2 py-1 text-xs"
              placeholder="Cari..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="w-full max-h-[520px] max-w-[calc(100vw-350px)] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr className="uppercase tracking-wide text-xs">
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">No Kontrabon</th>
                <th className="px-4 py-3">No Faktur</th>
                <th className="px-4 py-3">No Purchase</th>
                <th className="px-4 py-3">Tanggal Faktur</th>
                <th className="px-4 py-3">Tanggal Kontrabon</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Nominal Faktur</th>
                <th className="px-4 py-3">Nominal Tambahan</th>
                <th className="px-4 py-3">Nominal Total</th>
                <th className="px-4 py-3">Status Bayar</th>
                <th className="px-4 py-3">Tanggal Bayar</th>
                <th className="px-4 py-3">ID Tagihan</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredKontrabonItems.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={14}>
                    {kontrabonLoading ? "Memuat data..." : "Belum ada data history kontrabon."}
                  </td>
                </tr>
              ) : (
                filteredKontrabonItems.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        className="h-9 w-9 rounded-md bg-rose-600 text-white inline-flex items-center justify-center"
                        onClick={() => handleDisableKontrabon(row.no_kontrabon)}
                        aria-label="Hapus kontrabon"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{row.no_kontrabon || "-"}</td>
                    <td className="px-4 py-3 text-gray-700 break-words">
                      {renderSlashList(row.no_faktur)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 break-words">
                      {(() => {
                        if (!row.kode_t_pengadaan) return "-";
                        try {
                          const parsed = JSON.parse(row.kode_t_pengadaan);
                          if (Array.isArray(parsed)) {
                            return (
                              <div className="space-y-1">
                                {parsed.map((code: string) => (
                                  <div key={code}>{code}</div>
                                ))}
                              </div>
                            );
                          }
                        } catch {
                          // fallback to raw string
                        }
                        return renderSlashList(row.kode_t_pengadaan);
                      })()}
                    </td>
                    <td className="px-4 py-3 text-gray-700 break-words">
                      {row.tgl_faktur ? new Date(row.tgl_faktur).toLocaleDateString("id-ID") : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 break-words">
                      {row.tgl_kontrabon
                        ? new Date(row.tgl_kontrabon).toLocaleDateString("id-ID")
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {supplierNameMap.get(String(row.kode_supplier || "").trim()) ||
                        row.nama_supplier ||
                        row.kode_supplier ||
                        "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 break-words">
                      {formatCurrency(getNominalFaktur(row))}
                    </td>
                    <td className="px-4 py-3 text-gray-700 break-words">
                      {(() => {
                        if (!row.biaya_lain) return "-";
                        try {
                          const parsed = JSON.parse(row.biaya_lain);
                          if (!Array.isArray(parsed) || parsed.length === 0) return "-";
                          return (
                            <div className="space-y-1">
                              {parsed.map((item: any, idx: number) => (
                                <div key={`${row.id}-biaya-${idx}`} className="text-xs text-gray-700">
                                  {item?.jenis || "-"} {formatCurrency(Number(item?.nominal ?? 0))}
                                  {renderSlashSubList(item?.keterangan)}
                                </div>
                              ))}
                            </div>
                          );
                        } catch {
                          return "-";
                        }
                      })()}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-semibold">
                      {formatCurrency(getNominalTotal(row))}
                    </td>
                    <td className="px-4 py-3">{paidBadge(row.status_paid)}</td>
                    <td className="px-4 py-3 text-gray-700 break-words">
                      {row.tgl_bayar ? new Date(row.tgl_bayar).toLocaleDateString("id-ID") : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 break-words">
                      {(() => {
                        const pengadaanCodes = parsePengadaanCodes(row.kode_t_pengadaan);
                        const tagihanCodes = parseTagihanCodes(row.kode_t_tagihan_list);
                        const isMissingTagihan =
                          pengadaanCodes.length > 0 && tagihanCodes.length < pengadaanCodes.length;
                        return (
                          <div className="space-y-2">
                            <div>{renderSlashList(row.kode_t_tagihan_list)}</div>
                            {isMissingTagihan && (
                              <button
                                className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${
                                  generatingTagihan[row.no_kontrabon]
                                    ? "bg-gray-400"
                                    : "bg-emerald-600 hover:bg-emerald-700"
                                }`}
                                disabled={Boolean(generatingTagihan[row.no_kontrabon])}
                                onClick={() => handleGenerateTagihan(row)}
                              >
                                {generatingTagihan[row.no_kontrabon]
                                  ? "Generating..."
                                  : "Generate Tagihan"}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
                          onClick={async () => {
                            setEditingKontrabon(row);
                            setShowModal(true);
                            const supplierOption =
                              supplierOptions.find((opt) => String(opt.value) === String(row.kode_supplier)) ||
                              (row.kode_supplier
                                ? { value: row.kode_supplier, label: row.kode_supplier }
                                : null);
                            setSupplierValue(supplierOption);
                            setRekeningList(
                              row.id_rekening
                                ? [
                                    {
                                      id: row.id_rekening,
                                      kode_supplier: row.kode_supplier || null,
                                      nama_supplier: null,
                                      nama_bank: row.nama_bank || null,
                                      no_rekening: row.no_rekening || null,
                                      atas_nama: row.atas_nama || null,
                                      cabang: row.cabang || null,
                                      status: 1,
                                    },
                                  ]
                                : []
                            );
                            setRekeningValue(
                              row.id_rekening
                                ? {
                                    value: row.id_rekening,
                                    label: `${row.nama_bank || "-"} - ${row.no_rekening || "-"}`,
                                  }
                                : null
                            );
                            setNomorKontrabon(row.no_kontrabon || "");
                            setNoFaktur(row.no_faktur || "");
                            setTglKontrabon(toDateInput(row.tgl_kontrabon));
                            setTglFaktur(toDateInput(row.tgl_faktur));
                            setTglPpj(toDateInput(row.tgl_ppj));
                            setRencanaTfDari(toDateInput(row.rencana_tf_dari));
                            setRencanaTfSampai(toDateInput(row.rencana_tf_sampai));
                            setNominalFakturManual(true);
                            setTglFakturPajak(toDateInput(row.tanggal_faktur_pajak));
                            setNoFakturPajak(row.nomor_faktur_pajak || "");
                            try {
                              const parsed = row.biaya_lain ? JSON.parse(row.biaya_lain) : [];
                              const mapped = Array.isArray(parsed)
                                ? parsed.map((item: any) => ({
                                    id: `row-${Date.now()}-${Math.random()}`,
                                    tanda: item?.jenis || "-",
                                    jenis: item?.tipe || "",
                                    nominal: item?.nominal || "",
                                    keterangan: item?.keterangan || "",
                                  }))
                                : [];
                              setBiayaLainRows(mapped);
                            } catch {
                              setBiayaLainRows([]);
                            }
                            try {
                              const detail = await fetchKontrabonDetail(row.no_kontrabon);
                              const tagihanRows = Array.isArray(detail?.tagihan) ? detail.tagihan : [];
                              const nominalByPengadaan = new Map<string, number>();
                              tagihanRows.forEach((item: any) => {
                                const kodeT = String(item?.kode_t_pengadaan || "").trim();
                                if (!kodeT) return;
                                const totalTagihan = Number(item?.total_tagihan ?? 0);
                                nominalByPengadaan.set(
                                  kodeT,
                                  (nominalByPengadaan.get(kodeT) || 0) + totalTagihan
                                );
                              });
                              const parsed = detail?.header?.kode_t_pengadaan
                                ? parsePengadaanCodes(detail.header.kode_t_pengadaan)
                                : row.kode_t_pengadaan
                                ? parsePengadaanCodes(row.kode_t_pengadaan)
                                : [];
                              const list = Array.isArray(parsed) ? parsed : [];
                              const mappedRows = list.length
                                ? list.map((code: string) => ({
                                    id: `row-${Date.now()}-${code}`,
                                    kode_t_pengadaan: code,
                                    nominal: String(nominalByPengadaan.get(code) ?? ""),
                                  }))
                                : [{ id: "row-1", kode_t_pengadaan: "", nominal: "" }];
                              setPengadaanRows(mappedRows);
                              setNominalFakturInput(String(getNominalFaktur(detail?.header || row) || ""));
                              if (row.kode_supplier) {
                                fetchPengadaanForSupplier(row.kode_supplier, list);
                              }
                            } catch {
                              const parsed = row.kode_t_pengadaan ? parsePengadaanCodes(row.kode_t_pengadaan) : [];
                              const list = Array.isArray(parsed) ? parsed : [];
                              setPengadaanRows(
                                list.length
                                  ? list.map((code: string) => ({
                                      id: `row-${Date.now()}-${code}`,
                                      kode_t_pengadaan: code,
                                      nominal: "",
                                    }))
                                  : [{ id: "row-1", kode_t_pengadaan: "", nominal: "" }]
                              );
                              if (row.kode_supplier) {
                                fetchPengadaanForSupplier(row.kode_supplier, list);
                              }
                              setNominalFakturInput(String(getNominalFaktur(row) || ""));
                            }
                            if (row.kode_supplier) {
                              fetchRekeningForSupplier(row.kode_supplier);
                            }
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                          onClick={() =>
                            window.open(
                              `/admin/master/kontrabon/history/print?no=${encodeURIComponent(
                                row.no_kontrabon
                              )}`,
                              "_blank"
                            )
                          }
                        >
                          Cetak
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4">
          <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1800px] items-stretch justify-center gap-4 overflow-hidden">
          <div className="flex h-full w-full max-w-[1100px] flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#0f756b] text-white">
                  {editingKontrabon ? "?" : "+"}
                </span>
                {editingKontrabon ? "Edit Data" : "Tambah Data"}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingKontrabon(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                X
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <div className="space-y-2">
                <label className="text-sm text-gray-600">Supplier</label>
                <Select
                  instanceId="kontrabon-supplier"
                  options={supplierOptions}
                  value={supplierValue}
                    onChange={(option: SingleValue<{ value: string; label: string }>) => {
                      const next = option ?? null;
                      setSupplierValue(next);
                      setRekeningValue(null);
                      setRekeningList([]);
                      setPengadaanList([]);
                      setPengadaanRows([{ id: "row-1", kode_t_pengadaan: "", nominal: "" }]);
                      setNominalFakturManual(false);
                      setNominalFakturInput("");
                      if (!next?.value) return;
                      fetchRekeningForSupplier(next.value);
                      setPengadaanPreviewMap({});
                      setPengadaanPreviewLoading({});
                      fetchPengadaanForSupplier(next.value);
                    }}
                    placeholder={supplierLoading ? "Memuat supplier..." : "Pilih Supplier ..."}
                    isClearable
                    isLoading={supplierLoading}
                  classNamePrefix="react-select"
                  styles={{
                    control: (base: CSSObjectWithLabel) => ({
                      ...base,
                      minHeight: 44,
                      borderRadius: 8,
                      borderColor: "#e5e7eb",
                      boxShadow: "none",
                    }),
                    valueContainer: (base: CSSObjectWithLabel) => ({
                      ...base,
                      padding: "0 12px",
                    }),
                    input: (base: CSSObjectWithLabel) => ({
                      ...base,
                      margin: 0,
                      padding: 0,
                    }),
                    indicatorsContainer: (base: CSSObjectWithLabel) => ({
                      ...base,
                      height: 44,
                    }),
                    menu: (base: CSSObjectWithLabel) => ({
                      ...base,
                      zIndex: 60,
                    }),
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-600">Rekening</label>
                <Select
                  instanceId="kontrabon-rekening"
                  options={rekeningOptions}
                  value={rekeningValue}
                    onChange={(option: SingleValue<{ value: number; label: string }>) => {
                      const next = option ?? null;
                      setRekeningValue(next);
                    }}
                  placeholder={rekeningLoading ? "Memuat rekening..." : "Pilih Rekening"}
                  isClearable
                  isLoading={rekeningLoading}
                  isDisabled={!supplierValue}
                  classNamePrefix="react-select"
                  styles={{
                    control: (base: CSSObjectWithLabel) => ({
                      ...base,
                      minHeight: 44,
                      borderRadius: 8,
                      borderColor: "#e5e7eb",
                      boxShadow: "none",
                    }),
                    valueContainer: (base: CSSObjectWithLabel) => ({
                      ...base,
                      padding: "0 12px",
                    }),
                    input: (base: CSSObjectWithLabel) => ({
                      ...base,
                      margin: 0,
                      padding: 0,
                    }),
                    indicatorsContainer: (base: CSSObjectWithLabel) => ({
                      ...base,
                      height: 44,
                    }),
                    menu: (base: CSSObjectWithLabel) => ({
                      ...base,
                      zIndex: 60,
                    }),
                  }}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Nama Bank</label>
                  <input
                    className="w-full rounded-lg bg-gray-100 px-3 py-2.5 text-sm text-gray-700"
                    placeholder="Nama bank"
                    value={selectedRekening?.nama_bank || ""}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Rekening Bank</label>
                  <input
                    className="w-full rounded-lg bg-gray-100 px-3 py-2.5 text-sm text-gray-700"
                    placeholder="Rekening bank"
                    value={selectedRekening?.no_rekening || ""}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Atas Nama Rekening</label>
                  <input
                    className="w-full rounded-lg bg-gray-100 px-3 py-2.5 text-sm text-gray-700"
                    placeholder="Atas nama rekening"
                    value={selectedRekening?.atas_nama || ""}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Cabang</label>
                  <input
                    className="w-full rounded-lg bg-gray-100 px-3 py-2.5 text-sm text-gray-700"
                    placeholder="Cabang"
                    value={selectedRekening?.cabang || ""}
                    disabled
                  />
                </div>
              </div>

              <div className="rounded-lg border-2 border-dashed border-gray-300 p-3">
                <label className="text-sm text-gray-600">Nomor Pengadaan</label>
                <div className="mt-2 grid gap-3">
                  {pengadaanRows.map((row) => (
                    <div key={row.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <div className="grid gap-2 md:grid-cols-[auto,1.6fr,1fr]">
                        <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPengadaanRows((prev) =>
                              prev.length === 1
                                ? prev.map((item) =>
                                    item.id === row.id
                                      ? { ...item, kode_t_pengadaan: "", nominal: "" }
                                      : item
                                  )
                                : prev.filter((item) => item.id !== row.id)
                            );
                            setNominalFakturManual(false);
                            setNominalFakturInput("");
                          }}
                          className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white"
                        >
                          -
                        </button>
                        <div className="flex w-full items-center gap-2">
                          <div className="flex-1">
                            {(() => {
                              const available = getAvailablePengadaan(row.id);
                              const selectedItem = pengadaanList.find(
                                (item) => item.kode_t_pengadaan === row.kode_t_pengadaan
                              );
                              const selectValue = row.kode_t_pengadaan
                                ? {
                                    value: row.kode_t_pengadaan,
                                    label: `${row.kode_t_pengadaan} • ${formatCurrency(
                                      getPengadaanDisplayAmount(row, selectedItem)
                                    )}`,
                                  }
                                : null;
                              const options = available.map((opt) => ({
                                value: opt.kode_t_pengadaan,
                                label: `${opt.kode_t_pengadaan} • ${formatCurrency(
                                  getPengadaanDisplayAmount(
                                    pengadaanRows.find((item) => item.kode_t_pengadaan === opt.kode_t_pengadaan),
                                    opt
                                  )
                                )}`,
                              }));
                              return (
                            <Select
                              instanceId={`kontrabon-pengadaan-${row.id}`}
                              options={options}
                              value={selectValue}
                              onChange={(option: SingleValue<{ value: string; label: string }>) => {
                                const nextCode = option?.value || "";
                                setPengadaanRows((prev) =>
                                  prev.map((item) =>
                                    item.id === row.id
                                      ? { ...item, kode_t_pengadaan: nextCode }
                                      : item
                                  )
                                );
                                if (nextCode) {
                                  fetchPengadaanPreview(nextCode);
                                }
                                setNominalFakturManual(false);
                                setNominalFakturInput("");
                              }}
                              placeholder={pengadaanLoading ? "Memuat..." : "Pilih ..."}
                              isClearable
                              isLoading={pengadaanLoading}
                              classNamePrefix="react-select"
                              styles={{
                                control: (base: CSSObjectWithLabel) => ({
                                  ...base,
                                  minHeight: 40,
                                  borderRadius: 8,
                                  borderColor: "#e5e7eb",
                                  boxShadow: "none",
                                }),
                                valueContainer: (base: CSSObjectWithLabel) => ({
                                  ...base,
                                  padding: "0 12px",
                                }),
                                input: (base: CSSObjectWithLabel) => ({
                                  ...base,
                                  margin: 0,
                                  padding: 0,
                                }),
                                indicatorsContainer: (base: CSSObjectWithLabel) => ({
                                  ...base,
                                  height: 40,
                                }),
                                menu: (base: CSSObjectWithLabel) => ({
                                  ...base,
                                  zIndex: 60,
                                }),
                              }}
                              />
                              );
                            })()}
                          </div>
                          {(() => {
                            const selected = pengadaanList.find(
                              (item) => item.kode_t_pengadaan === row.kode_t_pengadaan
                            );
                            return (
                              <input
                                className="h-10 w-44 rounded-lg bg-gray-100 px-3 text-sm text-gray-700"
                                value={
                                  selected
                                    ? formatCurrency(getPengadaanDisplayAmount(row, selected))
                                    : ""
                                }
                                placeholder="Total akhir PEN"
                                readOnly
                              />
                            );
                          })()}
                        </div>
                      </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setPengadaanRows((prev) => [
                        ...prev,
                        {
                          id: `row-${Date.now()}`,
                          kode_t_pengadaan: "",
                          nominal: "",
                        },
                      ])
                    }
                    className="w-full rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-gray-700"
                  >
                    + Tambah
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Tanggal Kontrabon</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                    value={tglKontrabon}
                    onChange={(e) => setTglKontrabon(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Tanggal Faktur</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                    value={tglFaktur}
                    onChange={(e) => setTglFaktur(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Tanggal PPJ</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                    value={tglPpj}
                    onChange={(e) => setTglPpj(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Rencana Trf</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                    value={rencanaTfDari}
                    onChange={(e) => setRencanaTfDari(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Rencana Trf Sampai</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                    value={rencanaTfSampai}
                    onChange={(e) => setRencanaTfSampai(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-lg border-2 border-dashed border-red-300 bg-red-50/40 px-3 py-2 text-sm text-gray-700">
                Total Nominal TF pada tanggal tersebut
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Nomor Faktur</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                    value={noFaktur}
                    onChange={(e) => setNoFaktur(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Nomor Kontrabon</label>
                  <input
                    className="w-full rounded-lg bg-gray-100 px-3 py-2.5 text-sm text-gray-700"
                    value={kodeLoading ? "Memuat..." : nomorKontrabon}
                    readOnly
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Tanggal Faktur Pajak</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                    value={tglFakturPajak}
                    onChange={(e) => setTglFakturPajak(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Nomor Faktur Pajak</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                    value={noFakturPajak}
                    onChange={(e) => setNoFakturPajak(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-600">Nominal Faktur</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  value={nominalFakturInput}
                  onChange={(e) => {
                    setNominalFakturManual(true);
                    setNominalFakturInput(e.target.value);
                  }}
                />
              </div>

              <div className="space-y-4">
                <div className="text-center text-sm font-semibold text-gray-700">Biaya Lain</div>
                {biayaLainRows.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs font-semibold text-gray-500">
                      <span className="w-12" />
                      <span className="w-40">Jenis</span>
                      <span className="flex-1">Biaya Lain</span>
                      <span className="flex-1">Keterangan Biaya</span>
                      <span className="w-12" />
                    </div>
                    {biayaLainRows.map((row) => (
                      <div key={row.id} className="flex items-end gap-3">
                        <div className="w-12">
                          <select
                            className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
                            value={row.tanda}
                            onChange={(e) =>
                              setBiayaLainRows((prev) =>
                                prev.map((item) =>
                                  item.id === row.id ? { ...item, tanda: e.target.value } : item
                                )
                              )
                            }
                          >
                            <option value="-">-</option>
                            <option value="+">+</option>
                          </select>
                        </div>
                        <div className="w-40">
                          <select
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            value={row.jenis}
                            onChange={(e) =>
                              setBiayaLainRows((prev) =>
                                prev.map((item) =>
                                  item.id === row.id ? { ...item, jenis: e.target.value } : item
                                )
                              )
                            }
                          >
                            <option value="">Pilih ...</option>
                            <option value="TUNAI">TUNAI</option>
                            <option value="CHEQUE">CHEQUE</option>
                            <option value="GIRO">GIRO</option>
                            <option value="DEPOSIT RETUR">DEPOSIT RETUR</option>
                            <option value="DEPOSIT KUPON">DEPOSIT KUPON</option>
                            <option value="BIAYA/DLL">BIAYA/DLL</option>
                          </select>
                        </div>
                        <div className="flex-1">
                          <input
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            placeholder="Biaya lain"
                            value={row.nominal}
                            onChange={(e) =>
                              setBiayaLainRows((prev) =>
                                prev.map((item) =>
                                  item.id === row.id ? { ...item, nominal: e.target.value } : item
                                )
                              )
                            }
                            type="number"
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            placeholder="Keterangan"
                            value={row.keterangan}
                            onChange={(e) =>
                              setBiayaLainRows((prev) =>
                                prev.map((item) =>
                                  item.id === row.id
                                    ? { ...item, keterangan: e.target.value }
                                    : item
                                )
                              )
                            }
                          />
                        </div>
                        <div className="w-12">
                          <button
                            type="button"
                            onClick={() =>
                              setBiayaLainRows((prev) => prev.filter((item) => item.id !== row.id))
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500 text-white"
                          >
                            X
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setBiayaLainRows((prev) => [
                        ...prev,
                        {
                          id: `row-${Date.now()}`,
                          tanda: "-",
                          jenis: "",
                          nominal: "",
                          keterangan: "",
                        },
                      ])
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-gray-600"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-600">Total Nominal</label>
                <input
                  className="w-full rounded-lg bg-gray-100 px-3 py-3 text-lg font-semibold text-gray-800"
                  value={formatCurrency(totalNominalAkhir)}
                  readOnly
                />
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-gray-100 bg-white px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingKontrabon(null);
                  setPengadaanPreviewMap({});
                  setPengadaanPreviewLoading({});
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingKontrabon) return;
                  setSupplierValue(null);
                  setRekeningValue(null);
                  setRekeningList([]);
                  setPengadaanRows([{ id: "row-1", kode_t_pengadaan: "", nominal: "" }]);
                  setPengadaanList([]);
                  setPengadaanPreviewMap({});
                  setPengadaanPreviewLoading({});
                  setNominalFakturManual(false);
                  setNominalFakturInput("");
                  setBiayaLainRows([]);
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600"
              >
                Clear Form
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={savingKontrabon}
                onClick={async () => {
                  const kodePengadaan = pengadaanRows
                    .map((row) => row.kode_t_pengadaan)
                    .filter((code) => code);
                  if (!supplierValue?.value) return showValidationAlert("Supplier wajib diisi.");
                  if (!rekeningValue?.value) return showValidationAlert("Rekening wajib diisi.");
                  if (kodePengadaan.length === 0) return showValidationAlert("Nomor pengadaan wajib dipilih.");
                  if (!tglKontrabon) return showValidationAlert("Tanggal kontrabon wajib diisi.");
                  if (!tglFaktur) return showValidationAlert("Tanggal faktur wajib diisi.");
                  if (!tglPpj) return showValidationAlert("Tanggal PPJ wajib diisi.");
                  if (!rencanaTfDari) return showValidationAlert("Rencana transfer wajib diisi.");
                  if (!rencanaTfSampai) return showValidationAlert("Rencana transfer sampai wajib diisi.");
                  if (!noFaktur) return showValidationAlert("Nomor faktur wajib diisi.");
                  if (!nomorKontrabon) return showValidationAlert("Nomor kontrabon belum tersedia.");

                  setSavingKontrabon(true);
                  try {
                    const username = getCurrentUsername();
                    const biayaLainPayload = biayaLainRows.map((row) => ({
                      jenis: row.tanda,
                      nominal: row.nominal || "0",
                      keterangan: row.keterangan || "",
                      tipe: row.jenis || "",
                    }));

                    const res = await fetch(
                      editingKontrabon
                        ? `${API_BASE}/kontrabon/${encodeURIComponent(nomorKontrabon)}`
                        : `${API_BASE}/kontrabon`,
                      {
                        method: editingKontrabon ? "PUT" : "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(
                          editingKontrabon
                            ? {
                                no_faktur: noFaktur,
                                tgl_kontrabon: tglKontrabon,
                                tgl_faktur: tglFaktur,
                                tgl_ppj: tglPpj,
                                rencana_tf_dari: rencanaTfDari,
                                rencana_tf_sampai: rencanaTfSampai,
                                nominal_faktur: nominalFakturValue,
                                nominal_total: totalNominalAkhir,
                                biaya_lain: biayaLainPayload,
                                no_faktur_pajak: noFakturPajak,
                                tgl_faktur_pajak: tglFakturPajak,
                                kode_t_pengadaan_list: kodePengadaan,
                                id_rekening: rekeningValue?.value || null,
                                no_rekening: selectedRekening?.no_rekening || "",
                                atas_nama: selectedRekening?.atas_nama || "",
                                nama_bank: selectedRekening?.nama_bank || "",
                                cabang: selectedRekening?.cabang || "",
                                updated_by: username,
                              }
                            : {
                                kode_supplier: supplierValue.value,
                                nama_supplier: supplierValue.label,
                                no_kontrabon: nomorKontrabon,
                                no_faktur: noFaktur,
                                id_rekening: rekeningValue.value,
                                no_rekening: selectedRekening?.no_rekening || "",
                                atas_nama: selectedRekening?.atas_nama || "",
                                nama_bank: selectedRekening?.nama_bank || "",
                                cabang: selectedRekening?.cabang || "",
                                tgl_kontrabon: tglKontrabon,
                                tgl_faktur: tglFaktur,
                                tgl_ppj: tglPpj,
                                rencana_tf_dari: rencanaTfDari,
                                rencana_tf_sampai: rencanaTfSampai,
                                nominal_faktur: nominalFakturValue,
                                nominal_total: totalNominalAkhir,
                                biaya_lain: biayaLainPayload,
                                kode_t_pengadaan_list: kodePengadaan,
                                no_faktur_pajak: noFakturPajak,
                                tgl_faktur_pajak: tglFakturPajak,
                                created_by: username,
                              }
                        ),
                      }
                    );

                    if (!res.ok) {
                      const msg = await readApiErrorMessage(res);
                      throw new Error(msg || "Gagal menyimpan kontrabon");
                    }

                    const data = await res.json();
                    if (data?.no_kontrabon) setNomorKontrabon(data.no_kontrabon);
                    await Swal.fire({
                      icon: "success",
                      title: editingKontrabon ? "Kontrabon berhasil diupdate" : "Kontrabon berhasil dibuat",
                      text: data?.no_kontrabon
                        ? `Nomor kontrabon: ${data.no_kontrabon}`
                        : "Data kontrabon sudah tersimpan.",
                      confirmButtonText: "OK",
                    });
                    setShowModal(false);
                    setEditingKontrabon(null);
                    fetchKontrabon();
                  } catch (err: any) {
                    console.error("Failed save kontrabon", err);
                    await Swal.fire({
                      icon: "error",
                      title: editingKontrabon ? "Gagal update kontrabon" : "Gagal membuat kontrabon",
                      text: err?.message || "Terjadi kesalahan saat menyimpan kontrabon.",
                      confirmButtonText: "OK",
                    });
                  } finally {
                    setSavingKontrabon(false);
                  }
                }}
              >
                {savingKontrabon
                  ? "Menyimpan..."
                  : editingKontrabon
                  ? "Simpan Perubahan"
                  : "Buat Kontrabon"}
              </button>
            </div>
          </div>
          {selectedPreviewCodes.length > 0 && (
            <div className="flex h-full w-full max-w-[760px] flex-col rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <div className="text-base font-semibold text-slate-900">Rasio Pengadaan</div>
                  <div className="text-xs text-slate-500">{selectedPreviewCodes.length} PEN dipilih</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-5">
                  {selectedPreviewCodes.map((previewCode) => {
                    const preview = pengadaanPreviewMap[previewCode];
                    const slotOrder = Array.isArray(preview?.slot_order) && preview.slot_order.length
                      ? preview.slot_order
                      : ["K3", "K2", "K1"];
                    const previewRows = Array.isArray(preview?.rows) ? preview.rows : [];
                    return (
                      <section key={previewCode} className="space-y-3 rounded-xl border border-slate-200 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              Rasio Pengadaan: {previewCode}
                            </div>
                            <div className="mt-1 text-xs text-slate-600">
                              Supplier: {preview?.header?.nama_supplier || "-"} | Tanggal: {formatDate(preview?.header?.tgl)}
                            </div>
                          </div>
                          <div className="text-right text-xs text-slate-600">
                            <div>No Faktur: {preview?.header?.no_faktur_supplier || "-"}</div>
                            <div className="font-semibold text-slate-900">
                              Total: {formatCurrency(preview?.header?.total_akhir)}
                            </div>
                          </div>
                        </div>
                        {pengadaanPreviewLoading[previewCode] ? (
                          <div className="rounded-lg border border-slate-200 px-4 py-6 text-sm text-slate-500">
                            Memuat rasio 3 pengadaan terakhir...
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="min-w-[980px] w-full border-collapse text-[11px] leading-tight">
                              <thead>
                                <tr className="bg-slate-100 text-slate-900">
                                  <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left">Nama Barang</th>
                                  <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left">Supplier</th>
                                  {slotOrder.map((slot) => (
                                    <th key={slot} colSpan={5} className="border border-slate-300 px-2 py-2 text-center">
                                      Pengadaan {slot}
                                    </th>
                                  ))}
                                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 text-center">Gudang</th>
                                  <th rowSpan={2} className="border border-slate-300 px-2 py-2 text-center">Toko</th>
                                </tr>
                                <tr className="bg-slate-50 text-slate-700">
                                  {slotOrder.flatMap((slot) => [
                                    <th key={`${previewCode}-${slot}-status`} className="border border-slate-300 px-2 py-2 text-center">S</th>,
                                    <th key={`${previewCode}-${slot}-po`} className="border border-slate-300 px-2 py-2 text-center">PO</th>,
                                    <th key={`${previewCode}-${slot}-pct`} className="border border-slate-300 px-2 py-2 text-center">%</th>,
                                    <th key={`${previewCode}-${slot}-sisa`} className="border border-slate-300 px-2 py-2 text-center">Sisa</th>,
                                    <th key={`${previewCode}-${slot}-umur`} className="border border-slate-300 px-2 py-2 text-center">Umur</th>,
                                  ])}
                                </tr>
                              </thead>
                              <tbody>
                                {previewRows.length === 0 ? (
                                  <tr>
                                    <td colSpan={19} className="border border-slate-300 px-4 py-6 text-center text-slate-500">
                                      Tidak ada data rasio untuk pengadaan ini.
                                    </td>
                                  </tr>
                                ) : (
                                  previewRows.map((previewRow) => (
                                    <tr key={`${previewCode}-${previewRow.kodeBarangVariant}`} className="align-top">
                                      <td className="border border-slate-300 px-3 py-2 text-slate-900">
                                        <div className="font-semibold leading-snug">{previewRow.namaBarang}</div>
                                        <div className="mt-1 break-all text-[10px] text-slate-500">{previewRow.kodeBarangVariant}</div>
                                      </td>
                                      <td className="border border-slate-300 px-3 py-2">{previewRow.namaSupplier || "-"}</td>
                                      {slotOrder.flatMap((slotName) => {
                                        const slot = previewRow.slots[slotOrder.indexOf(slotName)] || null;
                                        const slotClass = previewSlotCellClass(slot);
                                        return [
                                          <td key={`${previewRow.kodeBarangVariant}-${previewCode}-${slotName}-status`} className={`border border-slate-300 px-1 py-2 text-center ${slotClass} ${previewCurrentBorderClass(slot, "first")}`}>
                                            {slot ? (
                                              <span className={`inline-flex rounded-full px-1.5 py-1 text-[10px] font-semibold ${previewSlotBadgeClass(slot)}`}>
                                                {slot.statusBayar === "Lunas" ? "L" : "B"}
                                              </span>
                                            ) : "-"}
                                          </td>,
                                          <td key={`${previewRow.kodeBarangVariant}-${previewCode}-${slotName}-po`} className={`border border-slate-300 px-1 py-2 text-center ${slotClass} ${previewCurrentBorderClass(slot, "middle")}`}>
                                            {slot ? formatNumber(slot.qty) : "-"}
                                          </td>,
                                          <td key={`${previewRow.kodeBarangVariant}-${previewCode}-${slotName}-pct`} className={`border border-slate-300 px-1 py-2 text-center font-semibold ${slotClass} ${previewCurrentBorderClass(slot, "middle")}`}>
                                            {slot?.persen !== null && slot?.persen !== undefined ? `${formatNumber(slot.persen)}%` : "-"}
                                          </td>,
                                          <td key={`${previewRow.kodeBarangVariant}-${previewCode}-${slotName}-sisa`} className={`border border-slate-300 px-1 py-2 text-center ${slotClass} ${previewCurrentBorderClass(slot, "middle")}`}>
                                            {slot ? formatNumber(slot.sisa) : "-"}
                                          </td>,
                                          <td key={`${previewRow.kodeBarangVariant}-${previewCode}-${slotName}-umur`} className={`border border-slate-300 px-1 py-2 text-center ${slotClass} ${previewCurrentBorderClass(slot, "last")}`}>
                                            {slot?.umurHari !== null && slot?.umurHari !== undefined ? `${slot.umurHari} hari` : "-"}
                                          </td>,
                                        ];
                                      })}
                                      <td className="border border-slate-300 px-2 py-2 text-center font-semibold text-slate-900">
                                        {formatNumber(previewRow.stokGudang)}
                                      </td>
                                      <td className="border border-slate-300 px-2 py-2 text-center font-semibold text-slate-900">
                                        {formatNumber(previewRow.stokToko)}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
