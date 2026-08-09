"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";

type RequestHeader = {
  kode_t_request: string;
  tgl_request: string;
  status_request: number;
  requested_by?: string | null;
  requested_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  catatan?: string | null;
  total_item?: number | null;
};

type RequestDetail = {
  kode_d_request: string;
  kode_barang_variant: string;
  id_kelas_harga: number;
  harga_1: number | null;
  harga_3: number | null;
  harga_6: number | null;
  harga_12: number | null;
  harga_beli_snapshot: number | null;
  hpp_snapshot: number | null;
  rasio_1: number | null;
  rasio_3: number | null;
  rasio_6: number | null;
  rasio_12: number | null;
  status_item?: number | null;
};

type VarianMap = {
  kode_barang_variant: string;
  nama_barang: string;
  nama_varian: string;
  barcode_varian?: string;
  harga_het?: number | null;
};

type KelasHarga = {
  id_kelas_harga: number;
  channel_code: string;
  nama: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const formatNumber = (val: number | null | undefined) => {
  if (val === null || val === undefined) return "-";
  return val.toLocaleString("id-ID");
};

const calcRasio = (harga: number | null, base: number | null) => {
  if (!base) return null;
  if (harga === null || harga === undefined) return null;
  return Number((((harga - base) / base) * 100).toFixed(2));
};

const getKelasTone = (channelCode: string) => {
  const code = channelCode.toLowerCase();
  if (code.includes("offline")) {
    return { header: "bg-emerald-50 text-emerald-800", cell: "bg-emerald-50/40" };
  }
  if (code.includes("gwen") || code.includes("app")) {
    return { header: "bg-orange-50 text-orange-800", cell: "bg-orange-50/40" };
  }
  if (code.includes("shopee")) {
    return { header: "bg-indigo-50 text-indigo-800", cell: "bg-indigo-50/40" };
  }
  if (code.includes("tiktok")) {
    return { header: "bg-pink-50 text-pink-800", cell: "bg-pink-50/40" };
  }
  return { header: "bg-slate-50 text-slate-700", cell: "bg-slate-50/30" };
};

const formatStatus = (status?: number | null) => {
  if (status === 1) return { label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (status === 2) return { label: "Rejected", className: "bg-rose-50 text-rose-700 border-rose-200" };
  return { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" };
};

export default function HargaJualApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const kode = typeof params?.kode === "string" ? params.kode : "";
  const [header, setHeader] = useState<RequestHeader | null>(null);
  const [detail, setDetail] = useState<RequestDetail[]>([]);
  const [varianMap, setVarianMap] = useState<Map<string, VarianMap>>(new Map());
  const [kelasHarga, setKelasHarga] = useState<Map<number, KelasHarga>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());

  const fetchDetail = async () => {
    if (!kode) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/harga-jual-request/${encodeURIComponent(kode)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHeader(data?.header || null);
      setDetail(Array.isArray(data?.detail) ? data.detail : []);
    } catch (err) {
      console.error("Failed fetch detail request", err);
      setHeader(null);
      setDetail([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [kode]);

  useEffect(() => {
    const loadMaps = async () => {
      try {
        const [varianRes, kelasRes] = await Promise.all([
          fetch(`${API_BASE}/barang/varian`),
          fetch(`${API_BASE}/kelas-harga`),
        ]);
        const varianData = varianRes.ok ? await varianRes.json() : [];
        const kelasData = kelasRes.ok ? await kelasRes.json() : [];

        const varian = new Map<string, VarianMap>();
        (Array.isArray(varianData) ? varianData : []).forEach((v: any) => {
          varian.set(String(v.kode_barang_variant), {
            kode_barang_variant: String(v.kode_barang_variant),
            nama_barang: String(v.nama_barang || ""),
            nama_varian: String(v.nama_varian || ""),
            barcode_varian: String(v.barcode_varian || ""),
            harga_het: v.harga_het ?? null,
          });
        });
        setVarianMap(varian);

        const kelas = new Map<number, KelasHarga>();
        (Array.isArray(kelasData) ? kelasData : []).forEach((k: any) => {
          kelas.set(Number(k.id_kelas_harga), {
            id_kelas_harga: Number(k.id_kelas_harga),
            channel_code: String(k.channel_code || ""),
            nama: String(k.nama || k.channel_code || ""),
          });
        });
        setKelasHarga(kelas);
      } catch (err) {
        console.error("Failed load maps", err);
      }
    };
    loadMaps();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, RequestDetail[]>();
    detail.forEach((row) => {
      const key = row.kode_barang_variant;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(row);
    });
    return Array.from(map.entries());
  }, [detail]);

  const pendingVariantCodes = useMemo(
    () => grouped.filter(([, rows]) => rows.some((row) => Number(row.status_item ?? 0) === 0)).map(([kode]) => kode),
    [grouped]
  );

  const totalRows = grouped.length;
  const selectedCount = selectedVariants.size;
  const allSelected = pendingVariantCodes.length > 0 && selectedCount === pendingVariantCodes.length;

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedVariants(new Set());
      return;
    }
    setSelectedVariants(new Set(pendingVariantCodes));
  };

  const toggleVariant = (kodeVarian: string, checked: boolean) => {
    setSelectedVariants((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(kodeVarian);
      } else {
        next.delete(kodeVarian);
      }
      return next;
    });
  };

  const kelasList = useMemo(() => {
    const ids = new Set(detail.map((row) => row.id_kelas_harga));
    return Array.from(ids)
      .map((id) => kelasHarga.get(id))
      .filter((k): k is KelasHarga => Boolean(k))
      .sort((a, b) => a.id_kelas_harga - b.id_kelas_harga);
  }, [detail, kelasHarga]);

  const getDetailByKelas = (rows: RequestDetail[]) => {
    const map = new Map<number, RequestDetail>();
    rows.forEach((row) => {
      map.set(row.id_kelas_harga, row);
    });
    return map;
  };

  const handleApprove = async () => {
    if (!kode) return;
    if (selectedVariants.size === 0) {
      await Swal.fire({ icon: "warning", title: "Pilih item dulu" });
      return;
    }
    const confirm = await Swal.fire({
      icon: "question",
      title: "Setujui request?",
      text: "Harga jual untuk item terpilih akan diupdate ke harga aktif.",
      showCancelButton: true,
      confirmButtonText: "Approve",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;

    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let approvedBy = "Admin";
    if (rawSession) {
      try {
        const session = JSON.parse(rawSession);
        approvedBy = session?.username || session?.name || approvedBy;
      } catch {
        // ignore
      }
    }

    setSaving(true);
    try {
      const selectedDetailCodes = detail
        .filter((row) => selectedVariants.has(row.kode_barang_variant))
        .map((row) => row.kode_d_request);
      const res = await fetch(`${API_BASE}/harga-jual-request/${encodeURIComponent(kode)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: approvedBy, selected_detail_codes: selectedDetailCodes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      await Swal.fire({ icon: "success", title: "Approved", timer: 1200, showConfirmButton: false });
      setSelectedVariants(new Set());
      await fetchDetail();
    } catch (err) {
      console.error("Failed approve request", err);
      Swal.fire({ icon: "error", title: "Gagal approve" });
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!kode) return;
    if (selectedVariants.size === 0) {
      await Swal.fire({ icon: "warning", title: "Pilih item dulu" });
      return;
    }
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Tolak item terpilih?",
      text: "Item terpilih akan ditolak.",
      showCancelButton: true,
      confirmButtonText: "Reject",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;

    const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
    let rejectedBy = "Admin";
    if (rawSession) {
      try {
        const session = JSON.parse(rawSession);
        rejectedBy = session?.username || session?.name || rejectedBy;
      } catch {
        // ignore
      }
    }

    setSaving(true);
    try {
      const selectedDetailCodes = detail
        .filter((row) => selectedVariants.has(row.kode_barang_variant))
        .map((row) => row.kode_d_request);
      const res = await fetch(`${API_BASE}/harga-jual-request/${encodeURIComponent(kode)}/reject-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejected_by: rejectedBy, selected_detail_codes: selectedDetailCodes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      await Swal.fire({ icon: "success", title: "Rejected", timer: 1200, showConfirmButton: false });
      setSelectedVariants(new Set());
      await fetchDetail();
    } catch (err) {
      console.error("Failed reject request", err);
      Swal.fire({ icon: "error", title: "Gagal reject" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveItems = async () => {
    if (!kode) return;
    if (selectedVariants.size === 0) {
      await Swal.fire({ icon: "warning", title: "Pilih item dulu" });
      return;
    }
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Keluarkan item dari list?",
      text: "Item terpilih akan dihapus dari daftar pengajuan.",
      showCancelButton: true,
      confirmButtonText: "Keluarkan",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/harga-jual-request/${encodeURIComponent(kode)}/remove-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode_barang_variant_list: Array.from(selectedVariants) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      await Swal.fire({ icon: "success", title: "Item dikeluarkan", timer: 1200, showConfirmButton: false });
      setSelectedVariants(new Set());
      await fetchDetail();
    } catch (err) {
      console.error("Failed remove items", err);
      Swal.fire({ icon: "error", title: "Gagal menghapus item" });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("id-ID");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Approval Harga Jual</p>
          <h1 className="text-2xl font-bold text-gray-900">{kode || "Detail Request"}</h1>
          <p className="text-xs text-gray-500">Tanggal: {formatDate(header?.requested_at || header?.tgl_request)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            Dipilih {selectedCount} dari {totalRows}
          </div>
          <button
            type="button"
            onClick={() => router.push("/admin/master/harga-jual/approval")}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleRemoveItems}
            disabled={saving || header?.status_request !== 0 || selectedVariants.size === 0}
            className="px-4 py-2 rounded-lg border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-50 disabled:opacity-60"
          >
            Keluarkan dari list
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={saving || header?.status_request !== 0}
            className="px-4 py-2 rounded-lg border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50 disabled:opacity-60"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={saving || header?.status_request !== 0 || selectedVariants.size === 0}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-60"
          >
            Approve
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-600">Detail harga jual</p>
          <p className="text-sm text-gray-500">Total item: {detail.length}</p>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-center" rowSpan={2}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th className="px-3 py-2" rowSpan={2}>
                  Barang
                </th>
                <th className="px-3 py-2" rowSpan={2}>
                  Varian
                </th>
                <th className="px-3 py-2" rowSpan={2}>
                  Barcode Varian
                </th>
                <th className="px-3 py-2" rowSpan={2}>
                  Status
                </th>
                <th className="px-3 py-2 text-right" rowSpan={2}>
                  Harga Beli
                </th>
                <th className="px-3 py-2 text-right" rowSpan={2}>
                  Harga HET
                </th>
                {kelasList.map((kelas) => {
                  const tone = getKelasTone(kelas.channel_code);
                  return (
                    <th
                      key={kelas.id_kelas_harga}
                      className={`px-3 py-2 text-center font-semibold ${tone.header}`}
                      colSpan={4}
                    >
                      {`Harga Jual ${kelas.nama || kelas.channel_code || kelas.id_kelas_harga}`}
                    </th>
                  );
                })}
              </tr>
              <tr>
                {kelasList.map((kelas) => {
                  const tone = getKelasTone(kelas.channel_code);
                  return (
                    <Fragment key={`sub-${kelas.id_kelas_harga}`}>
                      <th className={`px-3 py-2 text-right ${tone.header}`}>1 PCS</th>
                      <th className={`px-3 py-2 text-right ${tone.header}`}>3 PCS</th>
                      <th className={`px-3 py-2 text-right ${tone.header}`}>6 PCS</th>
                      <th className={`px-3 py-2 text-right ${tone.header}`}>12 PCS</th>
                    </Fragment>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={6 + kelasList.length * 4} className="px-4 py-6 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && detail.length === 0 && (
                <tr>
                  <td colSpan={6 + kelasList.length * 4} className="px-4 py-6 text-center text-gray-500">
                    Tidak ada detail.
                  </td>
                </tr>
              )}
              {!loading &&
                grouped.map(([kodeVarian, rows]) => {
                  const varian = varianMap.get(kodeVarian);
                  const byKelas = getDetailByKelas(rows);
                  const hargaBeli =
                    rows.find((row) => row.harga_beli_snapshot !== null)?.harga_beli_snapshot ?? null;
                  const isChecked = selectedVariants.has(kodeVarian);
                  const statusInfo = formatStatus(
                    rows.some((row) => Number(row.status_item ?? 0) === 0)
                      ? 0
                      : rows.some((row) => Number(row.status_item ?? 0) === 2)
                      ? 2
                      : 1
                  );
                  return (
                    <tr key={kodeVarian} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-center">
                        {rows.some((row) => Number(row.status_item ?? 0) === 0) ? (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => toggleVariant(kodeVarian, e.target.checked)}
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-900">{varian?.nama_barang || "-"}</td>
                      <td className="px-3 py-2 text-gray-700">{varian?.nama_varian || kodeVarian}</td>
                      <td className="px-3 py-2 text-gray-700">{varian?.barcode_varian || "-"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">
                        {formatNumber(hargaBeli)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">
                        {formatNumber(varian?.harga_het ?? null)}
                      </td>
                      {kelasList.map((kelas) => {
                        const row = byKelas.get(kelas.id_kelas_harga);
                        const rasio1 = row?.rasio_1 ?? calcRasio(row?.harga_1 ?? null, row?.harga_beli_snapshot ?? null);
                        const rasio3 = row?.rasio_3 ?? calcRasio(row?.harga_3 ?? null, row?.harga_beli_snapshot ?? null);
                        const rasio6 = row?.rasio_6 ?? calcRasio(row?.harga_6 ?? null, row?.harga_beli_snapshot ?? null);
                        const rasio12 = row?.rasio_12 ?? calcRasio(row?.harga_12 ?? null, row?.harga_beli_snapshot ?? null);
                        const tone = getKelasTone(kelas.channel_code);
                        return (
                          <Fragment key={`${kodeVarian}-${kelas.id_kelas_harga}`}>
                            <td className={`px-3 py-2 text-right ${tone.cell}`}>
                              <div className="text-gray-900">{formatNumber(row?.harga_1 ?? null)}</div>
                              <div className="text-[11px] text-gray-500">{rasio1 !== null ? `${rasio1}%` : "-"}</div>
                            </td>
                            <td className={`px-3 py-2 text-right ${tone.cell}`}>
                              <div className="text-gray-900">{formatNumber(row?.harga_3 ?? null)}</div>
                              <div className="text-[11px] text-gray-500">{rasio3 !== null ? `${rasio3}%` : "-"}</div>
                            </td>
                            <td className={`px-3 py-2 text-right ${tone.cell}`}>
                              <div className="text-gray-900">{formatNumber(row?.harga_6 ?? null)}</div>
                              <div className="text-[11px] text-gray-500">{rasio6 !== null ? `${rasio6}%` : "-"}</div>
                            </td>
                            <td className={`px-3 py-2 text-right ${tone.cell}`}>
                              <div className="text-gray-900">{formatNumber(row?.harga_12 ?? null)}</div>
                              <div className="text-[11px] text-gray-500">{rasio12 !== null ? `${rasio12}%` : "-"}</div>
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
