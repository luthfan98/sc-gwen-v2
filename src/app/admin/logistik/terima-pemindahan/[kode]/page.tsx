"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Inbox, ArrowLeft } from "lucide-react";
import Swal from "sweetalert2";

type Header = {
  kode_t_pemindahan: string;
  tipe_lokasi_dari: string;
  kode_lokasi_dari: string;
  tipe_lokasi_tujuan: string;
  kode_lokasi_tujuan: string;
  catatan: string | null;
  tgl: string;
  created_by: string | null;
};

type DetailRow = {
  kode_d_pemindahan: string;
  kode_barang_variant: string | null;
  kode_barang: string | null;
  nama_barang: string | null;
  nama_varian: string | null;
  jml_baik_pindah: number | null;
  jml_rusak_pindah: number | null;
  satuan_jml_baik: string | null;
  qty_diterima: number | null;
  qty_rusak_diterima: number | null;
};

export default function TerimaPemindahanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const kode = typeof params?.kode === "string" ? params.kode : "";
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [header, setHeader] = useState<Header | null>(null);
  const [detail, setDetail] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catatan, setCatatan] = useState("");
  const [gudangOptions, setGudangOptions] = useState<{ kode_gudang: string; nama: string }[]>([]);
  const [tokoOptions, setTokoOptions] = useState<{ kode_toko: string; nama_toko: string }[]>([]);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!kode) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/penerimaan-pemindahan/${encodeURIComponent(kode)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setHeader(data?.header || null);
        setDetail(Array.isArray(data?.detail) ? data.detail : []);
        setCatatan(data?.header?.catatan || "");
      } catch (err) {
        console.error("Failed fetch detail pemindahan", err);
        setHeader(null);
        setDetail([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [API_BASE, kode]);

  useEffect(() => {
    const fetchGudang = async () => {
      try {
        const res = await fetch(`${API_BASE}/gudang`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options = (Array.isArray(data) ? data : [])
          .filter((item) => Number(item?.status) === 1)
          .map((item) => ({ kode_gudang: String(item.kode_gudang), nama: String(item.nama || item.kode_gudang) }));
        setGudangOptions(options);
      } catch {
        setGudangOptions([]);
      }
    };
    const fetchToko = async () => {
      try {
        const res = await fetch(`${API_BASE}/toko`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const options = (Array.isArray(data) ? data : [])
          .filter((item) => Number(item?.status) === 1)
          .map((item) => ({ kode_toko: String(item.kode_toko), nama_toko: String(item.nama_toko || item.kode_toko) }));
        setTokoOptions(options);
      } catch {
        setTokoOptions([]);
      }
    };
    fetchGudang();
    fetchToko();
  }, [API_BASE]);

  const rows = useMemo(
    () =>
      detail.map((row) => {
        const qtyKirimBaik = Number(row.jml_baik_pindah ?? 0);
        const qtyKirimRusak = Number(row.jml_rusak_pindah ?? 0);
        const qtyTerimaBaik = Number(row.qty_diterima ?? 0);
        const qtyTerimaRusak = Number(row.qty_rusak_diterima ?? 0);
        const sisaBaik = Math.max(0, qtyKirimBaik - qtyTerimaBaik);
        const sisaRusak = Math.max(0, qtyKirimRusak - qtyTerimaRusak);
        return {
          ...row,
          qtyKirimBaik,
          qtyKirimRusak,
          qtyTerimaBaik,
          qtyTerimaRusak,
          sisaBaik,
          sisaRusak,
        };
      }),
    [detail]
  );

  const [qtyInputs, setQtyInputs] = useState<Record<string, number>>({});
  const [qtyRusakInputs, setQtyRusakInputs] = useState<Record<string, number>>({});

  useEffect(() => {
    const initial: Record<string, number> = {};
    const initialRusak: Record<string, number> = {};
    rows.forEach((row) => {
      initial[row.kode_d_pemindahan] = row.sisaBaik;
      initialRusak[row.kode_d_pemindahan] = row.sisaRusak;
    });
    setQtyInputs(initial);
    setQtyRusakInputs(initialRusak);
  }, [rows]);

  const totalSisaBaik = rows.reduce((sum, row) => sum + (qtyInputs[row.kode_d_pemindahan] || 0), 0);
  const totalSisaRusak = rows.reduce((sum, row) => sum + (qtyRusakInputs[row.kode_d_pemindahan] || 0), 0);

  const getLokasiNama = (tipe?: string | null, kode?: string | null) => {
    if (!tipe || !kode) return "-";
    const typeUpper = tipe.toUpperCase();
    if (typeUpper === "GUDANG") {
      return gudangOptions.find((item) => item.kode_gudang === kode)?.nama || kode;
    }
    if (typeUpper === "TOKO") {
      return tokoOptions.find((item) => item.kode_toko === kode)?.nama_toko || kode;
    }
    return kode;
  };

  const handleSubmit = async () => {
    if (!header) return;
    const items = rows
      .map((row) => ({
        kode_d_pemindahan: row.kode_d_pemindahan,
        qty_terima: Number(qtyInputs[row.kode_d_pemindahan] || 0),
        qty_rusak_terima: Number(qtyRusakInputs[row.kode_d_pemindahan] || 0),
      }))
      .filter((row) => row.qty_terima > 0 || row.qty_rusak_terima > 0);
    if (items.length === 0) {
      window.alert("Tidak ada qty penerimaan yang diinput.");
      return;
    }

    const confirm = await Swal.fire({
      icon: "question",
      title: "Terima pemindahan?",
      text: "Qty yang diinput akan menambah stok tujuan.",
      showCancelButton: true,
      confirmButtonText: "Terima",
      cancelButtonText: "Batal",
      confirmButtonColor: "#16a34a",
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      const rawSession = typeof window !== "undefined" ? localStorage.getItem("kosmetik-admin-session") : null;
      let createdBy = "Admin";
      if (rawSession) {
        try {
          const session = JSON.parse(rawSession);
          createdBy = session?.username || session?.name || createdBy;
        } catch {
          // ignore parse
        }
      }

      const res = await fetch(`${API_BASE}/penerimaan-pemindahan/${encodeURIComponent(kode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diterima_by: createdBy,
          catatan,
          items,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      await Swal.fire({
        icon: "success",
        title: "Penerimaan tersimpan",
        text: "Stok tujuan sudah diperbarui.",
        timer: 1200,
        showConfirmButton: false,
      });
      router.replace("/admin/logistik/terima-pemindahan");
    } catch (err) {
      console.error("Failed receive pemindahan", err);
      window.alert("Gagal menyimpan penerimaan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fffb] via-white to-[#e5f7f3] p-4 md:p-6 space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#3FE0D0]/15 text-[#0f756b] flex items-center justify-center">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Terima Pemindahan</p>
            <h1 className="text-2xl font-bold text-gray-900">{header?.kode_t_pemindahan || kode}</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3 text-sm">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-500">Dari</p>
            <p className="font-semibold text-gray-900">
              {getLokasiNama(header?.tipe_lokasi_dari, header?.kode_lokasi_dari)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Tujuan</p>
            <p className="font-semibold text-gray-900">
              {getLokasiNama(header?.tipe_lokasi_tujuan, header?.kode_lokasi_tujuan)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Tanggal</p>
            <p className="font-semibold text-gray-900">
              {header?.tgl ? new Date(header.tgl).toLocaleDateString("id-ID") : "-"}
            </p>
          </div>
        </div>
        <div>
          <p className="text-gray-500">Catatan</p>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 min-h-[80px]"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Detail Barang</h2>
          <div className="text-sm text-gray-500">
            Total diterima: {totalSisaBaik} baik / {totalSisaRusak} rusak
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Nama Barang</th>
                <th className="px-4 py-2">Nama Varian</th>
                <th className="px-4 py-2">Kirim Baik</th>
                <th className="px-4 py-2">Kirim Rusak</th>
                <th className="px-4 py-2">Terima Baik</th>
                <th className="px-4 py-2">Terima Rusak</th>
                <th className="px-4 py-2">Sisa Baik</th>
                <th className="px-4 py-2">Sisa Rusak</th>
                <th className="px-4 py-2">Input Baik</th>
                <th className="px-4 py-2">Input Rusak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-gray-500">
                    Memuat detail...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-gray-500">
                    Tidak ada detail pemindahan.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.kode_d_pemindahan}>
                    <td className="px-4 py-2 font-semibold text-gray-900">{row.nama_barang || "-"}</td>
                    <td className="px-4 py-2 text-gray-700">{row.nama_varian || "-"}</td>
                    <td className="px-4 py-2">{row.qtyKirimBaik}</td>
                    <td className="px-4 py-2">{row.qtyKirimRusak}</td>
                    <td className="px-4 py-2">{row.qtyTerimaBaik}</td>
                    <td className="px-4 py-2">{row.qtyTerimaRusak}</td>
                    <td className="px-4 py-2">{row.sisaBaik}</td>
                    <td className="px-4 py-2">{row.sisaRusak}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        max={row.sisaBaik}
                        value={qtyInputs[row.kode_d_pemindahan] ?? 0}
                        onChange={(e) =>
                          setQtyInputs((prev) => ({
                            ...prev,
                            [row.kode_d_pemindahan]: Math.min(row.sisaBaik, Number(e.target.value) || 0),
                          }))
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-24 border border-gray-200 rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        max={row.sisaRusak}
                        value={qtyRusakInputs[row.kode_d_pemindahan] ?? 0}
                        onChange={(e) =>
                          setQtyRusakInputs((prev) => ({
                            ...prev,
                            [row.kode_d_pemindahan]: Math.min(row.sisaRusak, Number(e.target.value) || 0),
                          }))
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-24 border border-gray-200 rounded px-2 py-1"
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803d] disabled:opacity-60"
          >
            Terima Pemindahan
          </button>
        </div>
      </div>
    </div>
  );
}
