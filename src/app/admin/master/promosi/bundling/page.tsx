"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import Select, { components, type ActionMeta, type MultiValue, type OptionProps } from "react-select";
import { BadgePercent, CalendarClock, Filter, Gift, ListChecks, Plus, XCircle } from "lucide-react";

export default function PromoBundlingPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [tab, setTab] = useState<"list" | "create">("list");
  const [tokoOptions, setTokoOptions] = useState<{ kode_toko: string; nama_toko: string }[]>([]);
  const [selectedToko, setSelectedToko] = useState<Set<string>>(new Set());
  const [selectAllToko, setSelectAllToko] = useState(true);
  const allTokoOption = useMemo(() => ({ value: "__ALL__", label: "Semua toko" }), []);
  const [items, setItems] = useState<
    {
      kode_barang_variant: string;
      nama_barang: string;
      nama_varian: string;
      nama_merk: string | null;
      kode_supplier: string | null;
      nama_supplier: string | null;
      barcode_varian?: string | null;
      stok_gudang?: number | null;
      stok_toko?: number | null;
    }[]
  >([]);
  const [supplierOptions, setSupplierOptions] = useState<{ kode_supplier: string; nama_supplier: string }[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [filterMerk, setFilterMerk] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());
  const [namaPromo, setNamaPromo] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [jamMulai, setJamMulai] = useState("");
  const [jamSelesai, setJamSelesai] = useState("");
  const [jenisDiskon, setJenisDiskon] = useState<"PERSEN" | "NOMINAL" | "BONUS">("PERSEN");
  const [nilaiDiskon, setNilaiDiskon] = useState("");
  const [qtyMinimum, setQtyMinimum] = useState(1);
  const [qtyMaksimum, setQtyMaksimum] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [gunakanKelipatan, setGunakanKelipatan] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [itemMinQty, setItemMinQty] = useState<Record<string, string>>({});
  const [itemMaxQty, setItemMaxQty] = useState<Record<string, string>>({});
  const [selectedBonusItems, setSelectedBonusItems] = useState<Set<string>>(new Set());
  const [bonusQty, setBonusQty] = useState<Record<string, string>>({});
  const [promoRows, setPromoRows] = useState<any[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState("");
  const [statusApprovalFilter, setStatusApprovalFilter] = useState("semua");
  const [statusAktifFilter, setStatusAktifFilter] = useState("semua");
  const [statusBerlakuFilter, setStatusBerlakuFilter] = useState("semua");
  const [showBudgetAlertOnly, setShowBudgetAlertOnly] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSearch, setDetailSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingHeader, setEditingHeader] = useState<any | null>(null);
  const [timeEditOpen, setTimeEditOpen] = useState(false);
  const [timeEditId, setTimeEditId] = useState<string | null>(null);
  const [timeEditFrom, setTimeEditFrom] = useState("");
  const [timeEditTo, setTimeEditTo] = useState("");
  const [timeEditSaving, setTimeEditSaving] = useState(false);
  const [timeEditError, setTimeEditError] = useState<string | null>(null);

  const toLocalDateStr = (value: Date) => {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getValidityLabel = (row: any) => {
    if (Number(row?.status_aktif ?? 0) !== 1) return "Tidak Berlaku";
    if (Number(row?.status_approval ?? -1) === 2) return "Tidak Berlaku";
    const todayStr = toLocalDateStr(new Date());
    if (!row?.valid_to) return "-";
    const end = new Date(row.valid_to);
    if (Number.isNaN(end.getTime())) return "-";
    const endStr = toLocalDateStr(end);
    return endStr < todayStr ? "Expired" : "Berlaku";
  };

  const getBudgetInfo = (row: any) => {
    const total = Number(row?.budget_total ?? 0);
    const used = Number(row?.budget_terpakai ?? 0);
    const percent = total > 0 && Number.isFinite(total) ? (used / total) * 100 : 0;
    return {
      total,
      used,
      percent,
      isOver: percent > 100,
      isNear: percent >= 90 && percent <= 100,
    };
  };

  const getUsername = () => {
    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let username = "Admin";
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        username = parsed?.username || parsed?.name || username;
      } catch {
        // ignore
      }
    }
    return username;
  };

  const handleViewDetail = async (kode: string) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDetailData(data);
      setDetailSearch("");
      setDetailOpen(true);
    } catch (err) {
      Swal.fire("Gagal memuat detail promo", String(err), "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (kode: string) => {
    const confirm = await Swal.fire({
      title: "Approve promo ini?",
      text: "Status approval akan diubah menjadi Approved.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Approve",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: getUsername() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await Swal.fire("Berhasil approve", "", "success");
      setPromoRows((prev) =>
        prev.map((row) => (row.kode_t_promosi === kode ? { ...row, status_approval: 1 } : row))
      );
    } catch (err) {
      Swal.fire("Gagal approve promo", String(err), "error");
    }
  };

  const handleReject = async (kode: string) => {
    const result = await Swal.fire({
      title: "Reject promo ini?",
      input: "text",
      inputLabel: "Catatan (opsional)",
      inputPlaceholder: "Alasan reject",
      showCancelButton: true,
      confirmButtonText: "Reject",
      cancelButtonText: "Batal",
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejected_by: getUsername(),
          catatan_approval: result.value || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await Swal.fire("Berhasil reject", "", "success");
      setPromoRows((prev) =>
        prev.map((row) => (row.kode_t_promosi === kode ? { ...row, status_approval: 2 } : row))
      );
    } catch (err) {
      Swal.fire("Gagal reject promo", String(err), "error");
    }
  };

  const handleEdit = async (kode: string) => {
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const header = data?.header || {};
      const ruleGroups = Array.isArray(data?.rule_groups) ? data.rule_groups : [];
      const firstGroup = ruleGroups[0] || {};
      const items = Array.isArray(firstGroup.items) ? firstGroup.items : [];
      const benefits = Array.isArray(data?.benefits) ? data.benefits : [];
      const firstBenefit = benefits[0] || {};

      setEditingId(String(header.kode_t_promosi || kode));
      setEditingHeader(header);
      setNamaPromo(header.nama_promosi || "");
      setDeskripsi(header.deskripsi || "");
      setTanggalMulai(toInputDate(header.valid_from));
      setTanggalSelesai(toInputDate(header.valid_to));
      setJamMulai(toInputTime(header.time_from));
      setJamSelesai(toInputTime(header.time_to));
      setQtyMinimum(Number(firstGroup.min_total_qty ?? 1));
      setQtyMaksimum(header.max_total_item != null ? String(header.max_total_item) : "");
      setGunakanKelipatan(firstGroup.max_redeem_qty == null);
      setBudgetMax(header.budget_total != null ? String(header.budget_total) : "");

      if (firstBenefit.benefit_type === "BONUS_ITEM") {
        setJenisDiskon("BONUS");
        setNilaiDiskon("");
        const bonusList = Array.isArray(firstBenefit.bonus_items) ? firstBenefit.bonus_items : [];
        const bonusSet = new Set(
          bonusList.map((b: any) => String(b?.kode_barang_variant || "")).filter(Boolean)
        );
        setSelectedBonusItems(bonusSet);
        setBonusQty(
          bonusList.reduce((acc: Record<string, string>, b: any) => {
            if (b?.kode_barang_variant) {
              acc[String(b.kode_barang_variant)] = String(b.qty_bonus ?? 1);
            }
            return acc;
          }, {})
        );
      } else if (firstBenefit.benefit_type === "DISKON_NOMINAL") {
        setJenisDiskon("NOMINAL");
        setNilaiDiskon(firstBenefit.diskon_nominal != null ? String(firstBenefit.diskon_nominal) : "");
        setSelectedBonusItems(new Set());
        setBonusQty({});
      } else {
        setJenisDiskon("PERSEN");
        setNilaiDiskon(firstBenefit.diskon_persen != null ? String(firstBenefit.diskon_persen) : "");
        setSelectedBonusItems(new Set());
        setBonusQty({});
      }

      const targets = Array.isArray(data?.target_toko) ? data.target_toko : [];
      setSelectedToko(new Set(targets.map((t: any) => String(t))));
      setSelectAllToko(targets.length > 0 && targets.length === tokoOptions.length);

      const selected = new Set(items.map((it: any) => String(it.kode_barang_variant)));
      setSelectedItems(selected);
      setPendingItems(new Set());
      setItemMinQty(
        items.reduce((acc: Record<string, string>, it: any) => {
          if (it.kode_barang_variant && it.min_qty != null) {
            acc[String(it.kode_barang_variant)] = String(it.min_qty);
          }
          return acc;
        }, {})
      );
      setItemMaxQty(
        items.reduce((acc: Record<string, string>, it: any) => {
          if (it.kode_barang_variant && it.max_qty != null) {
            acc[String(it.kode_barang_variant)] = String(it.max_qty);
          }
          return acc;
        }, {})
      );

      setTab("create");
    } catch (err) {
      Swal.fire("Gagal memuat data promo", String(err), "error");
    }
  };

  const openTimeEdit = (row: any) => {
    setTimeEditId(String(row?.kode_t_promosi || ""));
    setTimeEditFrom(formatTime(row?.time_from) === "-" ? "" : formatTime(row?.time_from));
    setTimeEditTo(formatTime(row?.time_to) === "-" ? "" : formatTime(row?.time_to));
    setTimeEditError(null);
    setTimeEditOpen(true);
  };

  const closeTimeEdit = () => {
    setTimeEditOpen(false);
    setTimeEditId(null);
    setTimeEditFrom("");
    setTimeEditTo("");
    setTimeEditError(null);
  };

  const handleSaveTimeEdit = async () => {
    if (!timeEditId) return;
    if ((timeEditFrom && !timeEditTo) || (!timeEditFrom && timeEditTo)) {
      setTimeEditError("Jam mulai dan jam selesai harus diisi berpasangan.");
      return;
    }
    setTimeEditSaving(true);
    setTimeEditError(null);
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(timeEditId)}/time`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          time_from: toSqlTime(timeEditFrom),
          time_to: toSqlTime(timeEditTo),
          updated_by: getUsername(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      setPromoRows((prev) =>
        prev.map((row) =>
          row.kode_t_promosi === timeEditId
            ? { ...row, time_from: toSqlTime(timeEditFrom), time_to: toSqlTime(timeEditTo) }
            : row
        )
      );
      closeTimeEdit();
    } catch (err: any) {
      setTimeEditError(err?.message || "Gagal menyimpan jam.");
    } finally {
      setTimeEditSaving(false);
    }
  };

  const handleDelete = async (kode: string) => {
    const confirm = await Swal.fire({
      title: "Hapus promo ini?",
      text: "Data promosi akan dihapus permanen.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/promos/${encodeURIComponent(kode)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await Swal.fire("Berhasil dihapus", "", "success");
      setPromoRows((prev) => prev.filter((row) => row.kode_t_promosi !== kode));
    } catch (err) {
      Swal.fire("Gagal menghapus promo", String(err), "error");
    }
  };

  useEffect(() => {
    const fetchToko = async () => {
      try {
        const res = await fetch(`${API_BASE}/toko`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
              .filter((row) => Number(row?.status ?? 1) === 1)
              .map((row) => ({
                kode_toko: String(row.kode_toko || ""),
                nama_toko: String(row.nama_toko || row.kode_toko || ""),
              }))
              .filter((row) => row.kode_toko)
          : [];
        setTokoOptions(list);
        if (selectAllToko) {
          setSelectedToko(new Set(list.map((t) => t.kode_toko)));
        }
      } catch (err) {
        console.error("Failed fetch toko", err);
        setTokoOptions([]);
      }
    };
    fetchToko();
  }, [API_BASE, selectAllToko]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(`${API_BASE}/barang/varian`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
              .filter((row) => Number(row?.is_aktif ?? 1) === 1)
              .map((row) => ({
                kode_barang_variant: String(row.kode_barang_variant || ""),
                nama_barang: String(row.nama_barang || "").trim(),
                nama_varian: String(row.nama_varian || "").trim(),
                nama_merk: row.nama_merk ? String(row.nama_merk).trim() : null,
                kode_supplier: row.kode_supplier ? String(row.kode_supplier).trim() : null,
                nama_supplier: row.nama_supplier ? String(row.nama_supplier).trim() : null,
                barcode_varian: row.barcode_varian ? String(row.barcode_varian).trim() : null,
                stok_gudang: row.stok_gudang ?? null,
                stok_toko: row.stok_toko ?? null,
              }))
              .filter((row) => row.kode_barang_variant)
          : [];
        setItems(list);
      } catch (err) {
        console.error("Failed fetch barang varian", err);
        setItems([]);
      }
    };
    fetchItems();
  }, [API_BASE]);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch(`${API_BASE}/barang/supplier-options`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
              .map((row) => ({
                kode_supplier: String(row.kode_supplier || "").trim(),
                nama_supplier: String(row.nama_supplier || row.kode_supplier || "").trim(),
              }))
              .filter((row) => row.kode_supplier)
          : [];
        setSupplierOptions(list);
      } catch (err) {
        console.error("Failed fetch supplier options", err);
        setSupplierOptions([]);
      }
    };
    fetchSuppliers();
  }, [API_BASE]);

  useEffect(() => {
    if (tab !== "list") return;

    const fetchPromos = async () => {
      setPromoLoading(true);
      setPromoError(null);
      try {
        const params = new URLSearchParams();
        const q = listQuery.trim();
        const isBarcode = q !== "" && /^[0-9]{6,}$/.test(q);
        if (q) {
          if (isBarcode) {
            params.set("barcode", q);
          } else {
            params.set("q", q);
          }
        }
        params.set("bundle_only", "1");
        if (statusApprovalFilter !== "semua") params.set("status", statusApprovalFilter);
        if (statusAktifFilter !== "semua") params.set("aktif", statusAktifFilter);

        const url = params.toString() ? `${API_BASE}/promos?${params.toString()}` : `${API_BASE}/promos`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        if (statusBerlakuFilter === "semua") {
          setPromoRows(list);
        } else {
          const todayStr = toLocalDateStr(new Date());
          const filtered = list.filter((row) => {
            if (statusBerlakuFilter === "tidak_berlaku") {
              return Number(row?.status_approval ?? -1) === 2 || Number(row?.status_aktif ?? 0) !== 1;
            }
            if (!row?.valid_to) return false;
            const end = new Date(row.valid_to);
            if (Number.isNaN(end.getTime())) return false;
            const endStr = toLocalDateStr(end);
            return statusBerlakuFilter === "berlaku" ? endStr >= todayStr : endStr < todayStr;
          });
          setPromoRows(filtered);
        }
      } catch (err) {
        console.error("Failed fetch promo list", err);
        setPromoError("Gagal memuat daftar promo.");
        setPromoRows([]);
      } finally {
        setPromoLoading(false);
      }
    };

    fetchPromos();
  }, [API_BASE, listQuery, statusAktifFilter, statusApprovalFilter, statusBerlakuFilter, tab]);

  const tokoSelectOptions = useMemo(
    () => [
      allTokoOption,
      ...tokoOptions.map((toko) => ({
        value: toko.kode_toko,
        label: `${toko.nama_toko} (${toko.kode_toko})`,
      })),
    ],
    [allTokoOption, tokoOptions]
  );

  const selectedTokoValues = useMemo(() => {
    if (selectAllToko) {
      return [allTokoOption];
    }
    const selectedList = tokoSelectOptions.filter(
      (opt) => opt.value !== allTokoOption.value && selectedToko.has(opt.value)
    );
    return selectedList;
  }, [allTokoOption, selectAllToko, selectedToko, tokoSelectOptions]);

  const bonusItemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: item.kode_barang_variant,
        label: `${item.nama_barang}${item.nama_varian ? ` - ${item.nama_varian}` : ""} (${item.kode_barang_variant})`,
      })),
    [items]
  );

  const selectedBonusValues = useMemo(
    () => bonusItemOptions.filter((opt) => selectedBonusItems.has(opt.value)),
    [bonusItemOptions, selectedBonusItems]
  );

  const handleBonusChange = (
    value: MultiValue<{ value: string; label: string }>
  ) => {
    const nextSet = new Set((value || []).map((opt) => opt.value));
    setSelectedBonusItems(nextSet);
    setBonusQty((prev) => {
      const next: Record<string, string> = {};
      nextSet.forEach((kode) => {
        next[kode] = prev[kode] ?? "1";
      });
      return next;
    });
  };

  const handleTokoChange = (
    value: MultiValue<{ value: string; label: string }>,
    actionMeta: ActionMeta<{ value: string; label: string }>
  ) => {
    const nextSelected = Array.isArray(value) ? value : [];
    const hasAll = nextSelected.some((opt) => opt.value === allTokoOption.value);

    if (hasAll && actionMeta.action === "select-option" && actionMeta.option?.value !== allTokoOption.value) {
      const filtered = nextSelected.filter((opt) => opt.value !== allTokoOption.value);
      const nextSet = new Set(filtered.map((opt) => opt.value));
      setSelectAllToko(false);
      setSelectedToko(nextSet);
      return;
    }

    if (hasAll) {
      setSelectAllToko(true);
      setSelectedToko(new Set(tokoOptions.map((t) => t.kode_toko)));
      return;
    }

    const nextSet = new Set(nextSelected.map((opt) => opt.value));
    const isAll = tokoOptions.length > 0 && nextSet.size === tokoOptions.length;
    setSelectAllToko(isAll);
    setSelectedToko(isAll ? new Set(tokoOptions.map((t) => t.kode_toko)) : nextSet);
  };

  const selectStyles = {
    control: (base: Record<string, unknown>) => ({
      ...base,
      minHeight: 44,
      borderColor: "#e5e7eb",
      boxShadow: "none",
      ":hover": { borderColor: "#cbd5e1" },
    }),
    valueContainer: (base: Record<string, unknown>) => ({
      ...base,
      paddingTop: 4,
      paddingBottom: 4,
    }),
    input: (base: Record<string, unknown>) => ({
      ...base,
      margin: 0,
      padding: 0,
    }),
    option: (base: Record<string, unknown>, state: { isFocused: boolean; isSelected: boolean }) => ({
      ...base,
      backgroundColor: state.isSelected ? "#e6fffb" : state.isFocused ? "#f3f4f6" : "white",
      color: "#111827",
    }),
    multiValue: (base: Record<string, unknown>) => ({
      ...base,
      backgroundColor: "#e6fffb",
    }),
    multiValueLabel: (base: Record<string, unknown>) => ({
      ...base,
      color: "#0f756b",
      fontWeight: 600,
    }),
    multiValueRemove: (base: Record<string, unknown>) => ({
      ...base,
      color: "#0f756b",
      ":hover": { backgroundColor: "#c1f3ec", color: "#0f756b" },
    }),
  };

  const CheckboxOption = (props: OptionProps<{ value: string; label: string }, true>) => (
    <components.Option {...props}>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={props.isSelected} readOnly />
        <span className="text-sm">{props.label}</span>
      </div>
    </components.Option>
  );

  const merkOptions = useMemo(() => {
    const map = new Map<string, string>();
    const supplierKey = filterSupplier.trim().toLowerCase();
    items.forEach((row) => {
      const rowSupplier = row.kode_supplier ? row.kode_supplier.trim().toLowerCase() : "";
      if (supplierKey && rowSupplier !== supplierKey) return;
      if (row.nama_merk) map.set(row.nama_merk.trim(), row.nama_merk.trim());
    });
    return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  }, [filterSupplier, items]);

  const filteredItems = useMemo(() => {
    const keyword = itemSearch.trim().toLowerCase();
    const filterMerkValue = filterMerk.trim().toLowerCase();
    const filterSupplierValue = filterSupplier.trim().toLowerCase();
    return items.filter((row) => {
      const rowMerk = row.nama_merk ? row.nama_merk.trim().toLowerCase() : "";
      const rowSupplier = row.kode_supplier ? row.kode_supplier.trim().toLowerCase() : "";
      if (filterMerkValue && rowMerk !== filterMerkValue) return false;
      if (filterSupplierValue && rowSupplier !== filterSupplierValue) return false;
      if (!keyword) return true;
      return (
        row.nama_barang.toLowerCase().includes(keyword) ||
        row.nama_varian.toLowerCase().includes(keyword) ||
        row.kode_barang_variant.toLowerCase().includes(keyword)
      );
    });
  }, [filterMerk, filterSupplier, itemSearch, items]);

  const shouldShowItems = filterMerk !== "" || filterSupplier !== "";
  const isMerkEnabled = filterSupplier !== "";

  const selectedItemsList = useMemo(
    () => items.filter((row) => selectedItems.has(row.kode_barang_variant)),
    [items, selectedItems]
  );

  const bonusItemsList = useMemo(
    () => items.filter((row) => selectedBonusItems.has(row.kode_barang_variant)),
    [items, selectedBonusItems]
  );

  const availableItems = useMemo(
    () => filteredItems.filter((row) => !selectedItems.has(row.kode_barang_variant)),
    [filteredItems, selectedItems]
  );

  const promoRowsWithBudget = useMemo(
    () =>
      promoRows.map((row) => ({
        ...row,
        __budget: getBudgetInfo(row),
      })),
    [promoRows]
  );

  const budgetStats = useMemo(() => {
    const activeRows = promoRowsWithBudget.filter((row) => {
      if (Number(row?.status_approval ?? 0) !== 1) return false;
      if (Number(row?.status_aktif ?? 0) !== 1) return false;
      return getValidityLabel(row) === "Berlaku";
    });
    const near = activeRows.filter((row) => row.__budget?.isNear).length;
    const over = activeRows.filter((row) => row.__budget?.isOver).length;
    return { near, over };
  }, [promoRowsWithBudget]);

  const displayedPromoRows = useMemo(() => {
    if (!showBudgetAlertOnly) return promoRowsWithBudget;
    return promoRowsWithBudget.filter((row) => {
      if (!row.__budget?.isNear && !row.__budget?.isOver) return false;
      if (Number(row?.status_approval ?? 0) !== 1) return false;
      if (Number(row?.status_aktif ?? 0) !== 1) return false;
      return getValidityLabel(row) === "Berlaku";
    });
  }, [promoRowsWithBudget, showBudgetAlertOnly]);

  const isAllPendingChecked = useMemo(() => {
    if (!shouldShowItems || availableItems.length === 0) return false;
    return availableItems.every((row) => pendingItems.has(row.kode_barang_variant));
  }, [availableItems, pendingItems, shouldShowItems]);

  const handleSavePromo = async () => {
    if (isSaving) return;
    if (!namaPromo.trim()) {
      await Swal.fire("Nama promo wajib diisi", "", "warning");
      return;
    }
    if (!tanggalMulai || !tanggalSelesai) {
      await Swal.fire("Tanggal mulai dan selesai wajib diisi", "", "warning");
      return;
    }
    if ((jamMulai && !jamSelesai) || (!jamMulai && jamSelesai)) {
      await Swal.fire("Jam mulai dan selesai harus diisi berpasangan", "", "warning");
      return;
    }
    if (selectedItems.size === 0) {
      await Swal.fire("Pilih item bundling terlebih dahulu", "", "warning");
      return;
    }
    if (jenisDiskon === "BONUS") {
      if (selectedBonusItems.size === 0) {
        await Swal.fire("Pilih item bonus terlebih dahulu", "", "warning");
        return;
      }
      const invalidBonus = Array.from(selectedBonusItems).some((kode) => {
        const qty = Number(bonusQty[kode] ?? 1);
        return !Number.isFinite(qty) || qty <= 0;
      });
      if (invalidBonus) {
        await Swal.fire("Qty bonus wajib diisi", "", "warning");
        return;
      }
    } else if (!nilaiDiskon || Number.isNaN(Number(nilaiDiskon))) {
      await Swal.fire("Nilai diskon wajib diisi", "", "warning");
      return;
    }

    const parsePositiveInt = (value: string | number | null | undefined) => {
      if (value === null || value === undefined || value === "") return null;
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0) return null;
      return Math.floor(num);
    };

    const ruleItems = Array.from(selectedItems).map((kode) => ({
      kode_barang_variant: kode,
      min_qty: parsePositiveInt(itemMinQty[kode]) ?? 1,
      max_qty: parsePositiveInt(itemMaxQty[kode]),
    }));

    const benefits =
      jenisDiskon === "BONUS"
        ? [
            {
              benefit_type: "BONUS_ITEM",
              bonus_items: Array.from(selectedBonusItems).map((kode) => ({
                kode_barang_variant: kode,
                qty_bonus: parsePositiveInt(bonusQty[kode]) ?? 1,
              })),
            },
          ]
        : [
            {
              benefit_type: jenisDiskon === "PERSEN" ? "DISKON_PERSEN" : "DISKON_NOMINAL",
              diskon_persen: jenisDiskon === "PERSEN" ? Number(nilaiDiskon) : null,
              diskon_nominal: jenisDiskon === "NOMINAL" ? Number(nilaiDiskon) : null,
              apply_scope: "APPLY_TO_RULE_ITEMS",
              rounding_mode: "ROUND",
              rounding_step: 1,
            },
          ];

    const payload = {
      nama_promosi: namaPromo.trim(),
      deskripsi: deskripsi.trim() || null,
      valid_from: tanggalMulai,
      valid_to: tanggalSelesai,
      time_from: toSqlTime(jamMulai),
      time_to: toSqlTime(jamSelesai),
      jenis_sumber: "INTERNAL",
      status_aktif: editingHeader?.status_aktif ?? 1,
      status_approval: editingHeader?.status_approval ?? 0,
      updated_by: getUsername(),
      budget_total: budgetMax === "" ? null : Number(budgetMax),
      max_total_item: parsePositiveInt(qtyMaksimum),
      target_toko: Array.from(selectedToko),
      rule_groups: [
        {
          group_no: 1,
          group_operator: "AND",
          rule_type: "ITEM_COMBO",
          min_total_qty: 1,
          max_redeem_qty: gunakanKelipatan ? null : 1,
          items: ruleItems,
        },
      ],
      benefits,
    };

    setIsSaving(true);
    try {
      const url = editingId ? `${API_BASE}/promos/${encodeURIComponent(editingId)}` : `${API_BASE}/promos`;
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      await Swal.fire(editingId ? "Promo berhasil diperbarui" : "Promo berhasil disimpan", "", "success");
      setTab("list");
      setEditingId(null);
      setEditingHeader(null);
    } catch (err) {
      await Swal.fire(editingId ? "Gagal memperbarui promo" : "Gagal menyimpan promo", String(err), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#f3fffb] via-white to-[#e6fbf6] p-4 md:p-6 space-y-6 overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-[#5fe7d7]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-[#0f756b]/10 blur-3xl" />

      <div className="relative bg-white/90 backdrop-blur border border-[#d7f2ee] rounded-3xl shadow-[0_12px_30px_-24px_rgba(15,117,107,0.6)] p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0f756b] to-[#35d8c8] text-white flex items-center justify-center shadow-sm">
            <BadgePercent className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#3c7f77]">Promosi</p>
            <h1 className="text-2xl font-bold text-gray-900">Program Bundling</h1>
            <p className="text-sm text-gray-500">Atur promo bundling berdasarkan kombinasi item dan qty.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("list")}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
              tab === "list"
                ? "bg-[#e6fffb] text-[#0f756b] border-[#b9ede6]"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Daftar Promo
          </button>
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`px-5 py-2 rounded-full text-sm font-semibold border transition ${
              tab === "create"
                ? "bg-[#0f756b] text-white border-[#0f756b] shadow-sm"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Plus className="w-4 h-4 inline-block mr-1" />
            Buat Promo
          </button>
        </div>
      </div>

      {tab === "list" ? (
        <>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600">
                <Filter className="w-4 h-4" />
                <span>Filter</span>
              </div>
              <input
                placeholder="Cari promo / kode / barcode"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[220px] flex-1"
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
              />
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[160px]"
                value={statusApprovalFilter}
                onChange={(e) => setStatusApprovalFilter(e.target.value)}
              >
                <option value="semua">Status Approval</option>
                <option value="0">Pending</option>
                <option value="1">Approved</option>
                <option value="2">Rejected</option>
              </select>
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[160px]"
                value={statusAktifFilter}
                onChange={(e) => setStatusAktifFilter(e.target.value)}
              >
                <option value="semua">Status Aktif</option>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[160px]"
                value={statusBerlakuFilter}
                onChange={(e) => setStatusBerlakuFilter(e.target.value)}
              >
                <option value="semua">Status Berlaku</option>
                <option value="berlaku">Berlaku</option>
                <option value="expired">Expired</option>
                <option value="tidak_berlaku">Tidak Berlaku</option>
              </select>
              <label className="ml-auto flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={showBudgetAlertOnly}
                  onChange={(e) => setShowBudgetAlertOnly(e.target.checked)}
                />
                Tampilkan promo mendekati/di atas 100%
              </label>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Mendekati 100%</p>
              <p className="mt-2 text-2xl font-semibold text-amber-800">{budgetStats.near}</p>
              <p className="text-xs text-amber-700">Promo aktif yang mendekati 100% budget.</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-rose-700">Di Atas 100%</p>
              <p className="mt-2 text-2xl font-semibold text-rose-800">{budgetStats.over}</p>
              <p className="text-xs text-rose-700">Promo aktif yang melebihi 100% budget.</p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Daftar Promo</p>
                <p className="text-base font-semibold text-gray-800">Program Bundling</p>
              </div>
            </div>
            <div className="p-4">
              {promoLoading ? (
                <div className="py-10 text-center text-sm text-gray-500">Memuat daftar promo...</div>
              ) : promoError ? (
                <div className="py-10 text-center text-sm text-rose-600">{promoError}</div>
              ) : displayedPromoRows.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">Belum ada data promo bundling.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Kode</th>
                        <th className="px-4 py-3 text-left">Nama Promo</th>
                        <th className="px-4 py-3 text-left">Periode</th>
                        <th className="px-4 py-3 text-left">Berlaku</th>
                        <th className="px-4 py-3 text-left">Target Toko</th>
                        <th className="px-4 py-3 text-left">Benefit</th>
                        <th className="px-4 py-3 text-right">Budget</th>
                        <th className="px-4 py-3 text-left">Jam</th>
                        <th className="px-4 py-3 text-center">Approval</th>
                        <th className="px-4 py-3 text-center">Aktif</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {displayedPromoRows.map((row) => (
                        <tr key={row.kode_t_promosi} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{row.kode_t_promosi}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{row.nama_promosi || "-"}</div>
                            <div className="text-xs text-gray-500">{row.deskripsi || "-"}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatDate(row.valid_from)} - {formatDate(row.valid_to)}
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const label = getValidityLabel(row);
                              if (label === "Berlaku") {
                                return (
                                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                    Berlaku
                                  </span>
                                );
                              }
                              if (label === "Tidak Berlaku") {
                                return (
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                    Tidak Berlaku
                                  </span>
                                );
                              }
                              if (label === "Expired") {
                                return (
                                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                    Expired
                                  </span>
                                );
                              }
                              return <span className="text-xs text-gray-500">-</span>;
                            })()}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatTargetToko(row.target_toko)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatBenefit(row.benefit_info)}
                          </td>
                          <td className="px-4 py-3 text-right">
                              {(() => {
                                const budget = formatBudget(row);
                                if (budget === "-") {
                                  return <span className="text-gray-500">-</span>;
                                }
                                return (
                                  <span
                                    className={
                                      budget.isOver
                                        ? "rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"
                                        : "text-gray-700"
                                    }
                                  >
                                    {budget.text}
                                  </span>
                                );
                              })()}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            <div className="flex items-center gap-2">
                              <span>
                                {row.time_from || row.time_to
                                  ? `${formatTime(row.time_from)} - ${formatTime(row.time_to)}`
                                  : "-"}
                              </span>
                              <button
                                type="button"
                                onClick={() => openTimeEdit(row)}
                                className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                                title="Edit jam"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.status_approval === 1 ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                  Approved
                                </span>
                                <span className="text-[11px] text-gray-500">{formatDateTime(row.approved_at)}</span>
                              </div>
                            ) : row.status_approval === 2 ? (
                              <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {Number(row.status_aktif ?? 0) === 1 ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                Nonaktif
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleViewDetail(row.kode_t_promosi)}
                                disabled={detailLoading}
                                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                Detail
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEdit(row.kode_t_promosi)}
                                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                Edit
                              </button>
                              {Number(row.status_approval ?? 0) === 0 && (
                                <>
                              <button
                                type="button"
                                onClick={() => handleApprove(row.kode_t_promosi)}
                                disabled={Number(row.status_approval ?? 0) === 1}
                                className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(row.kode_t_promosi)}
                                disabled={Number(row.status_approval ?? 0) === 2}
                                className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                              >
                                Reject
                              </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDelete(row.kode_t_promosi)}
                                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                              >
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white/95 backdrop-blur border border-[#d7f2ee] rounded-3xl shadow-[0_12px_30px_-24px_rgba(15,117,107,0.5)] p-6 space-y-6">
          <div className="flex items-center gap-3 text-sm font-semibold text-[#0f756b]">
            <div className="h-9 w-9 rounded-xl bg-[#e6fffb] flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#3c7f77]">Informasi Promo</p>
              <p className="text-base font-semibold text-gray-800">Detail Bundling</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Nama Promo</span>
              <input
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                placeholder="Nama promo"
                value={namaPromo}
                onChange={(e) => setNamaPromo(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Deskripsi</span>
              <input
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                placeholder="Deskripsi singkat"
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Tanggal Mulai</span>
              <input
                type="date"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={tanggalMulai}
                onChange={(e) => setTanggalMulai(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Tanggal Selesai</span>
              <input
                type="date"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={tanggalSelesai}
                onChange={(e) => setTanggalSelesai(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Jam Mulai</span>
              <input
                type="time"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={jamMulai}
                onChange={(e) => setJamMulai(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Jam Selesai</span>
              <input
                type="time"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={jamSelesai}
                onChange={(e) => setJamSelesai(e.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Jenis Benefit</span>
              <select
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={jenisDiskon}
                onChange={(e) => {
                  const value = e.target.value as "PERSEN" | "NOMINAL" | "BONUS";
                  setJenisDiskon(value);
                  if (value === "BONUS") {
                    setNilaiDiskon("");
                  }
                }}
              >
                <option value="PERSEN">Persentase</option>
                <option value="NOMINAL">Potongan Nominal</option>
                <option value="BONUS">Bonus Item (Gratis)</option>
              </select>
            </label>
            {jenisDiskon !== "BONUS" && (
              <label className="space-y-1 text-sm">
                <span className="text-gray-600">Nilai Diskon</span>
                <input
                  className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                  placeholder="Contoh: 10 / 2000"
                  value={nilaiDiskon}
                  onChange={(e) => setNilaiDiskon(e.target.value)}
                />
              </label>
            )}
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Batas Redeem Promo (Opsional)</span>
              <input
                type="number"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={qtyMaksimum}
                onChange={(e) => setQtyMaksimum(e.target.value)}
                min={1}
                placeholder="Opsional"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Gunakan Kelipatan</span>
              <select
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={gunakanKelipatan ? "1" : "0"}
                onChange={(e) => setGunakanKelipatan(e.target.value === "1")}
              >
                <option value="1">Ya</option>
                <option value="0">Tidak</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Budget Max (Opsional)</span>
              <input
                type="number"
                className="w-full h-11 rounded-xl border border-gray-200 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                min={0}
                placeholder="Contoh: 5000000"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-gray-600">Target Toko</span>
              <Select
                isMulti
                closeMenuOnSelect={false}
                hideSelectedOptions={false}
                options={tokoSelectOptions}
                value={selectedTokoValues}
                onChange={handleTokoChange}
                isOptionSelected={(option) =>
                  option.value === allTokoOption.value ? selectAllToko : selectedToko.has(option.value)
                }
                styles={selectStyles}
                placeholder="Pilih toko"
                noOptionsMessage={() => "Tidak ada toko."}
                components={{ Option: CheckboxOption }}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-gray-200 p-4 bg-gradient-to-br from-white to-[#f8fffd]">
            <div className="flex items-center gap-3 text-sm font-semibold text-gray-700 mb-3">
              <div className="h-8 w-8 rounded-lg bg-[#e6fffb] text-[#0f756b] flex items-center justify-center">
                <ListChecks className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#3c7f77]">Item Bundling</p>
                <p className="text-sm font-semibold text-gray-800">Pilih Item Bundling</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <span>Daftar Item</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#0f756b] hover:underline disabled:text-gray-400 disabled:no-underline"
                      disabled={pendingItems.size === 0}
                      onClick={() => {
                        if (pendingItems.size === 0) return;
                        const next = new Set(selectedItems);
                        pendingItems.forEach((kode) => next.add(kode));
                        setSelectedItems(next);
                        setItemMinQty((prev) => {
                          const nextMap = { ...prev };
                          pendingItems.forEach((kode) => {
                            if (!nextMap[kode]) nextMap[kode] = "1";
                          });
                          return nextMap;
                        });
                        setPendingItems(new Set());
                      }}
                    >
                      Pilih Item
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3 border-b border-gray-100 bg-white">
                  <div className="grid gap-2 md:grid-cols-[160px_160px_1fr]">
                    <select
                      className="rounded-xl border border-gray-200 px-3 h-11 text-sm"
                      value={filterSupplier}
                      onChange={(e) => {
                        setFilterSupplier(e.target.value);
                        if (e.target.value === "") {
                          setFilterMerk("");
                        }
                        if (e.target.value === "" && filterMerk === "") {
                          setItemSearch("");
                        }
                      }}
                    >
                      <option value="">Pilih Supplier</option>
                      {supplierOptions.map((supplier) => (
                        <option key={supplier.kode_supplier} value={supplier.kode_supplier}>
                          {supplier.nama_supplier || supplier.kode_supplier}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-xl border border-gray-200 px-3 h-11 text-sm"
                      value={filterMerk}
                      onChange={(e) => {
                        setFilterMerk(e.target.value);
                        if (e.target.value === "" && filterSupplier === "") {
                          setItemSearch("");
                        }
                      }}
                      disabled={!isMerkEnabled}
                    >
                      <option value="">Filter Merk</option>
                      {merkOptions.map((merk) => (
                        <option key={merk} value={merk}>
                          {merk}
                        </option>
                      ))}
                    </select>
                    <input
                      className="rounded-xl border border-gray-200 px-3 h-11 text-sm"
                      placeholder="Cari barang / varian"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      disabled={!shouldShowItems}
                    />
                  </div>
                  {!shouldShowItems ? (
                    <div className="mt-2 text-xs text-gray-500">
                      Pilih supplier terlebih dahulu untuk menampilkan item.
                    </div>
                  ) : null}
                </div>
                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white sticky top-0 z-10">
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="px-4 py-2 w-8">
                          <input
                            type="checkbox"
                            checked={isAllPendingChecked}
                            onChange={(e) => {
                              if (!shouldShowItems) return;
                              const next = new Set(pendingItems);
                              if (e.target.checked) {
                                availableItems.forEach((row) => next.add(row.kode_barang_variant));
                              } else {
                                availableItems.forEach((row) => next.delete(row.kode_barang_variant));
                              }
                              setPendingItems(next);
                            }}
                            disabled={!shouldShowItems || availableItems.length === 0}
                          />
                        </th>
                        <th className="px-4 py-2">Nama Barang</th>
                        <th className="px-4 py-2">Nama Varian</th>
                        <th className="px-4 py-2">Barcode</th>
                        <th className="px-4 py-2">Merk</th>
                        <th className="px-4 py-2">Supplier</th>
                        <th className="px-4 py-2 text-right">Stok Gudang</th>
                        <th className="px-4 py-2 text-right">Stok Toko</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!shouldShowItems ? (
                        <tr>
                          <td className="px-4 py-4 text-gray-500" colSpan={7}>
                            Item belum ditampilkan.
                          </td>
                        </tr>
                      ) : availableItems.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-gray-500" colSpan={7}>
                            Tidak ada item.
                          </td>
                        </tr>
                      ) : (
                        availableItems.map((row) => (
                          <tr key={row.kode_barang_variant} className="border-b border-gray-100 last:border-0">
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={pendingItems.has(row.kode_barang_variant)}
                                onChange={(e) => {
                                  const next = new Set(pendingItems);
                                  if (e.target.checked) {
                                    next.add(row.kode_barang_variant);
                                  } else {
                                    next.delete(row.kode_barang_variant);
                                  }
                                  setPendingItems(next);
                                }}
                              />
                            </td>
                          <td className="px-4 py-2 text-gray-800">{row.nama_barang}</td>
                          <td className="px-4 py-2 text-gray-800">{row.nama_varian}</td>
                          <td className="px-4 py-2 text-gray-600">{row.barcode_varian || "-"}</td>
                          <td className="px-4 py-2 text-gray-600">{row.nama_merk || "-"}</td>
                            <td className="px-4 py-2 text-gray-600">{row.nama_supplier || "-"}</td>
                            <td className="px-4 py-2 text-right text-gray-700">{formatNumber(row.stok_gudang)}</td>
                            <td className="px-4 py-2 text-right text-gray-700">{formatNumber(row.stok_toko)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span>Item Bundling Terpilih</span>
                  <span className="rounded-full bg-[#e6fffb] px-2 py-0.5 text-[11px] font-semibold text-[#0f756b]">
                    {selectedItemsList.length} item
                  </span>
                </div>
                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white sticky top-0 z-10">
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="px-4 py-2">Nama Barang</th>
                        <th className="px-4 py-2">Nama Varian</th>
                        <th className="px-4 py-2">Barcode</th>
                        <th className="px-4 py-2 text-center">Min Qty</th>
                        <th className="px-4 py-2 text-center">Max Qty</th>
                        <th className="px-4 py-2 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItemsList.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-gray-500" colSpan={6}>
                            Belum ada item dipilih.
                          </td>
                        </tr>
                      ) : (
                        selectedItemsList.map((row) => (
                          <tr key={row.kode_barang_variant} className="border-b border-gray-100 last:border-0">
                            <td className="px-4 py-2 text-gray-800">{row.nama_barang}</td>
                            <td className="px-4 py-2 text-gray-800">{row.nama_varian}</td>
                            <td className="px-4 py-2 text-gray-600">{row.barcode_varian || "-"}</td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="number"
                                className="w-20 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 text-center"
                                placeholder="1"
                                min={1}
                                value={itemMinQty[row.kode_barang_variant] ?? "1"}
                                onChange={(e) =>
                                  setItemMinQty((prev) => ({
                                    ...prev,
                                    [row.kode_barang_variant]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="number"
                                className="w-20 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 text-center"
                                placeholder="-"
                                min={1}
                                value={itemMaxQty[row.kode_barang_variant] ?? ""}
                                onChange={(e) =>
                                  setItemMaxQty((prev) => ({
                                    ...prev,
                                    [row.kode_barang_variant]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                className="text-xs font-semibold text-rose-600 hover:underline"
                                onClick={() => {
                                  const next = new Set(selectedItems);
                                  next.delete(row.kode_barang_variant);
                                  setSelectedItems(next);
                                  setItemMinQty((prev) => {
                                    const { [row.kode_barang_variant]: _removed, ...rest } = prev;
                                    return rest;
                                  });
                                  setItemMaxQty((prev) => {
                                    const { [row.kode_barang_variant]: _removed, ...rest } = prev;
                                    return rest;
                                  });
                                }}
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {jenisDiskon === "BONUS" && (
            <div className="rounded-2xl border border-gray-200 p-4 bg-gradient-to-br from-white to-[#f8fffd] mt-6">
              <div className="flex items-center gap-3 text-sm font-semibold text-gray-700 mb-3">
                <div className="h-8 w-8 rounded-lg bg-[#e6fffb] text-[#0f756b] flex items-center justify-center">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#3c7f77]">Bonus</p>
                  <p className="text-sm font-semibold text-gray-800">Item Bonus (Gratis)</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-sm text-gray-600">Pilih Item Bonus</span>
                  <Select
                    isMulti
                    options={bonusItemOptions}
                    value={selectedBonusValues}
                    onChange={handleBonusChange}
                    styles={selectStyles}
                    classNamePrefix="select"
                    placeholder="Cari item bonus..."
                  />
                </div>
                <div className="overflow-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full text-xs">
                    <thead className="bg-white sticky top-0 z-10">
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="px-4 py-2">Nama Barang</th>
                        <th className="px-4 py-2">Nama Varian</th>
                        <th className="px-4 py-2">Barcode</th>
                        <th className="px-4 py-2 text-center">Qty Bonus</th>
                        <th className="px-4 py-2 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bonusItemsList.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-gray-500" colSpan={5}>
                            Belum ada item bonus dipilih.
                          </td>
                        </tr>
                      ) : (
                        bonusItemsList.map((row) => (
                          <tr key={`bonus-${row.kode_barang_variant}`} className="border-b border-gray-100 last:border-0">
                            <td className="px-4 py-2 text-gray-800">{row.nama_barang}</td>
                            <td className="px-4 py-2 text-gray-800">{row.nama_varian}</td>
                            <td className="px-4 py-2 text-gray-600">{row.barcode_varian || "-"}</td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="number"
                                className="w-20 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 text-center"
                                placeholder="1"
                                min={1}
                                value={bonusQty[row.kode_barang_variant] ?? "1"}
                                onChange={(e) =>
                                  setBonusQty((prev) => ({
                                    ...prev,
                                    [row.kode_barang_variant]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                className="text-xs font-semibold text-rose-600 hover:underline"
                                onClick={() => {
                                  const next = new Set(selectedBonusItems);
                                  next.delete(row.kode_barang_variant);
                                  setSelectedBonusItems(next);
                                  setBonusQty((prev) => {
                                    const { [row.kode_barang_variant]: _removed, ...rest } = prev;
                                    return rest;
                                  });
                                }}
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-500">
              {selectedItemsList.length} item dipilih.
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">
              Batal
            </button>
            <button
              className="rounded-full bg-[#0f756b] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 shadow-sm"
              onClick={handleSavePromo}
              disabled={isSaving}
            >
              {isSaving ? "Menyimpan..." : "Simpan Promo"}
            </button>
            </div>
          </div>
        </div>
      )}

      {detailOpen && detailData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-xs text-gray-500">Detail Promo</p>
                <h2 className="text-lg font-semibold text-gray-900">{detailData?.header?.nama_promosi || "-"}</h2>
                <p className="text-sm text-gray-600">
                  {formatDate(detailData?.header?.valid_from)} - {formatDate(detailData?.header?.valid_to)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Kode Promo</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.kode_t_promosi || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Status Aktif</p>
                  <p className="font-semibold text-gray-900">
                    {Number(detailData?.header?.status_aktif ?? 0) === 1 ? "Aktif" : "Nonaktif"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Status Approval</p>
                  <p className="font-semibold text-gray-900">
                    {detailData?.header?.status_approval === 1
                      ? "Approved"
                      : detailData?.header?.status_approval === 2
                        ? "Rejected"
                        : "Pending"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 md:col-span-2">
                  <p className="text-xs text-gray-500">Deskripsi</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.deskripsi || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Jenis Sumber</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.jenis_sumber || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Budget Max</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.budget_total)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Budget Terpakai</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.budget_terpakai)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Max Total Item</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.max_total_item)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Total Item Terpakai</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.total_item_terpakai)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Max Redeem / Trx</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.max_total_redeem_trx)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Redeem Trx Used</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.total_redeem_trx_used)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Redeem Mode</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.redeem_mode || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Max Redeem / Trx</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.max_redeem_times_per_trx)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Max Redeem / Customer</p>
                  <p className="font-semibold text-gray-900">{formatNumber(detailData?.header?.max_redeem_per_customer)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Scope Redeem Customer</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.redeem_scope_per_customer || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Payment Scope</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.payment_scope || "-"}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Dibuat Oleh</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.created_by || "-"}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(detailData?.header?.created_at)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Diupdate Oleh</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.updated_by || "-"}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(detailData?.header?.updated_at)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Approved By</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.approved_by || "-"}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(detailData?.header?.approved_at)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Rejected By</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.rejected_by || "-"}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(detailData?.header?.rejected_at)}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 md:col-span-2">
                  <p className="text-xs text-gray-500">Catatan Approval</p>
                  <p className="font-semibold text-gray-900">{detailData?.header?.catatan_approval || "-"}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <p className="text-xs text-gray-500 mb-2">Target Toko</p>
                  <div className="flex flex-wrap gap-2">
                    {(detailData?.target_toko || []).length ? (
                      detailData.target_toko.map((t: any) => (
                        <span key={t} className="rounded-full bg-[#e6fffb] px-2 py-0.5 text-xs font-semibold text-[#0f756b]">
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-600">-</span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <p className="text-xs text-gray-500 mb-2">Payment Methods</p>
                  <div className="flex flex-wrap gap-2">
                    {(detailData?.payment_methods || []).length ? (
                      detailData.payment_methods.map((t: any) => (
                        <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-600">-</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Rule Groups</p>
                <div className="overflow-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Group No</th>
                        <th className="px-3 py-2">Operator</th>
                        <th className="px-3 py-2">Rule Type</th>
                        <th className="px-3 py-2 text-center">Min Qty</th>
                        <th className="px-3 py-2 text-center">Min Value</th>
                        <th className="px-3 py-2 text-center">Max Qty</th>
                        <th className="px-3 py-2 text-center">Max Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(detailData?.rule_groups || []).length ? (
                        detailData.rule_groups.map((g: any) => (
                          <tr key={g.kode_d_rule_group || g.group_no}>
                            <td className="px-3 py-2">{g.group_no ?? "-"}</td>
                            <td className="px-3 py-2">{g.group_operator || "-"}</td>
                            <td className="px-3 py-2">{g.rule_type || "-"}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(g.min_total_qty)}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(g.min_total_value)}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(g.max_redeem_qty)}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(g.max_redeem_value)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-4 text-center text-gray-500" colSpan={7}>
                            Tidak ada rule group.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Benefits</p>
                <div className="overflow-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2 text-center">Diskon %</th>
                        <th className="px-3 py-2 text-center">Diskon Nominal</th>
                        <th className="px-3 py-2">Apply Scope</th>
                        <th className="px-3 py-2 text-center">Max Discount</th>
                        <th className="px-3 py-2 text-center">Rounding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(detailData?.benefits || []).length ? (
                        detailData.benefits.map((b: any) => (
                          <tr key={b.kode_d_benefit || b.benefit_type}>
                            <td className="px-3 py-2">{b.benefit_type || "-"}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(b.diskon_persen)}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(b.diskon_nominal)}</td>
                            <td className="px-3 py-2">{b.apply_scope || "-"}</td>
                            <td className="px-3 py-2 text-center">{formatNumber(b.max_discount_value_per_trx)}</td>
                            <td className="px-3 py-2 text-center">
                              {b.rounding_mode || "-"} {b.rounding_step ? `(${b.rounding_step})` : ""}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-4 text-center text-gray-500" colSpan={6}>
                            Tidak ada benefit.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Bonus Items</p>
                <div className="overflow-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Kode Varian</th>
                        <th className="px-3 py-2">Qty Bonus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(() => {
                        const bonusItems =
                          detailData?.benefits
                            ?.flatMap((b: any) => b.bonus_items || [])
                            ?.filter((b: any) => b) || [];
                        if (bonusItems.length === 0) {
                          return (
                            <tr>
                              <td className="px-3 py-4 text-center text-gray-500" colSpan={2}>
                                Tidak ada bonus item.
                              </td>
                            </tr>
                          );
                        }
                        return bonusItems.map((bi: any, idx: number) => (
                          <tr key={bi.kode_d_bonus_item || `${bi.kode_barang_variant}-${idx}`}>
                            <td className="px-3 py-2">{bi.kode_barang_variant || "-"}</td>
                            <td className="px-3 py-2">{formatNumber(bi.qty_bonus)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-800">Detail Item Bundling</p>
                  <input
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    placeholder="Cari nama varian / barcode"
                    className="w-full md:w-72 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f756b]/20"
                  />
                </div>
                <div className="overflow-auto border border-gray-200 rounded-xl max-h-[45vh]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Kode Varian</th>
                        <th className="px-3 py-2">Nama Barang</th>
                        <th className="px-3 py-2">Nama Varian</th>
                        <th className="px-3 py-2">Barcode</th>
                        <th className="px-3 py-2 text-center">Min Qty</th>
                        <th className="px-3 py-2 text-center">Max Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(() => {
                        const keyword = detailSearch.trim().toLowerCase();
                        const allItems = detailData?.rule_groups?.flatMap((g: any) => g.items || []) || [];
                        const filteredItems = keyword
                          ? allItems.filter((item: any) => {
                              const namaVarian = String(item.nama_varian || item.kode_varian || "").toLowerCase();
                              const barcode = String(item.barcode_varian || "").toLowerCase();
                              return namaVarian.includes(keyword) || barcode.includes(keyword);
                            })
                          : allItems;

                        if (filteredItems.length === 0) {
                          return (
                            <tr>
                              <td className="px-3 py-4 text-center text-gray-500" colSpan={6}>
                                Tidak ada item bundling.
                              </td>
                            </tr>
                          );
                        }

                        return filteredItems.map((item: any) => (
                          <tr key={item.kode_d_rule_item || `${item.kode_barang_variant}-${item.kode_d_rule_group}`}>
                            <td className="px-3 py-2 text-gray-700">{item.kode_barang_variant || "-"}</td>
                            <td className="px-3 py-2 text-gray-800">{item.nama_barang || "-"}</td>
                            <td className="px-3 py-2 text-gray-800">{item.nama_varian || item.kode_varian || "-"}</td>
                            <td className="px-3 py-2 text-gray-700">{item.barcode_varian || "-"}</td>
                            <td className="px-3 py-2 text-center text-gray-700">{item.min_qty ?? "-"}</td>
                            <td className="px-3 py-2 text-center text-gray-700">{item.max_qty ?? "-"}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {timeEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-xs text-gray-500">Edit Jam Berlaku</p>
                <p className="text-sm font-semibold text-gray-900">{timeEditId || "-"}</p>
              </div>
              <button
                type="button"
                onClick={closeTimeEdit}
                className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {timeEditError && (
                <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {timeEditError}
                </div>
              )}
              <label className="space-y-1 text-sm">
                <span className="text-gray-600">Jam Mulai</span>
                <input
                  type="time"
                  value={timeEditFrom}
                  onChange={(e) => setTimeEditFrom(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600">Jam Selesai</span>
                <input
                  type="time"
                  value={timeEditTo}
                  onChange={(e) => setTimeEditTo(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={closeTimeEdit}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTimeEdit}
                disabled={timeEditSaving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {timeEditSaving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("id-ID");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("id-ID");
}

function formatNumber(value: any) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("id-ID");
}

function toInputDate(value: string | null | undefined) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toInputTime(value: string | null | undefined) {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";
  return text.length >= 5 ? text.slice(0, 5) : text;
}

function formatTime(value: any) {
  if (!value) return "-";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(11, 16);
  }
  const text = String(value).trim();
  if (!text) return "-";
  if (text.includes("T") && text.length >= 16) {
    return text.slice(11, 16);
  }
  return text.length >= 5 ? text.slice(0, 5) : text;
}

function formatTargetToko(value: any) {
  if (!value) return "-";
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",").map((v) => v.trim()).filter(Boolean)
      : [];
  if (!list.length) return "-";
  const top = list.slice(0, 3).join(", ");
  if (list.length <= 3) return top;
  return `${top} +${list.length - 3}`;
}

function formatBenefit(value: any) {
  if (!value) return "-";
  const list =
    typeof value === "string"
      ? value.split(",").map((v) => v.trim()).filter(Boolean)
      : Array.isArray(value)
        ? value
        : [];
  if (!list.length) return "-";
  if (list.length <= 1) return list[0];
  return list.join(", ");
}

function formatBudget(row: any) {
  if (!row) return "-";
  const total = Number(row.budget_total ?? 0);
  if (!Number.isFinite(total) || total <= 0) return "-";
  const used = Number(row.budget_terpakai ?? 0);
  const pct = total > 0 ? (used / total) * 100 : 0;
  const pctText = pct.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  const usedText = `Rp ${Number.isFinite(used) ? used.toLocaleString("id-ID") : "0"}`;
  const totalText = `Rp ${total.toLocaleString("id-ID")}`;
  return {
    text: `${usedText} / ${totalText} (${pctText}%)`,
    isOver: pct > 100,
  };
}

function toSqlTime(value: string | null | undefined) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length === 5 ? `${text}:00` : text;
}
