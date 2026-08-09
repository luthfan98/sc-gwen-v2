"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Image,
  Video,
  Package,
  Tags,
  ClipboardList,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react";
import Swal from "sweetalert2";

type FormBarang = {
  kode_manual: string;
  nama: string;
  supplier: string;
  merk: string;
  tipe: string;
  barcode_global: string;
  kode_gudang: string;
  satuan_1: string;
  satuan_2: string;
  rasio_1_ke_2: string;
  harga_beli_sat_1: string;
  hpp_avg_sat_1: string;
  margin_profit: string;
  stok: string;
  buffer_stok: string;
  poin: string;
  panjang: string;
  lebar: string;
  tinggi: string;
  berat: string;
  status: string;
  boleh_retur: string;
  is_barang_khusus: string;
  segmentasi_pasar: string;
  cocok_untuk: string;
  manfaat: string;
  deskripsi: string;
  catatan: string;
  gambar_list: string;
  video_url: string;
  has_varian: string; // "0" = tidak, "1" = punya varian
};

type VariantRow = {
  id: string;
  nama: string;
  kode: string;
  barcode: string;
  warna_hex: string;
  imageFile: File | null;
  imagePreview: string | null;
  is_aktif?: number;
  kode_barang_variant?: string | null;
  harga_beli?: number | null;
  het?: number | null;
  stok_gudang?: number | null;
  stok_toko?: number | null;
};

type Option = { label: string; value: string };
type VariantEditable = Omit<VariantRow, "id" | "imageFile" | "imagePreview">;

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg width="640" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="400" fill="#f3f4f6"/><rect x="60" y="60" width="520" height="280" rx="16" fill="#e5e7eb"/><path d="M210 250l60-70 70 90 40-40 60 70H210z" fill="#d1d5db"/><circle cx="250" cy="160" r="28" fill="#c7ced6"/><rect x="90" y="90" width="460" height="220" rx="12" stroke="#cbd5e1" stroke-width="4" fill="none"/><rect x="60" y="60" width="520" height="280" rx="16" stroke="#d1d5db" stroke-width="4" fill="none"/></svg>`
  );

const initialForm: FormBarang = {
  kode_manual: "",
  nama: "",
  supplier: "",
  merk: "",
  tipe: "",
  barcode_global: "",
  kode_gudang: "",
  satuan_1: "pcs",
  satuan_2: "",
  rasio_1_ke_2: "",
  harga_beli_sat_1: "",
  hpp_avg_sat_1: "",
  margin_profit: "0",
  stok: "0",
  buffer_stok: "0",
  poin: "",
  panjang: "",
  lebar: "",
  tinggi: "",
  berat: "",
  status: "1",
  boleh_retur: "1",
  is_barang_khusus: "regular",
  segmentasi_pasar: "",
  cocok_untuk: "",
  manfaat: "",
  deskripsi: "",
  catatan: "",
  gambar_list: "",
  video_url: "",
  has_varian: "0",
};

function MasterBarangNewPageInner() {
  const [form, setForm] = useState<FormBarang>(initialForm);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [tab, setTab] = useState<"info" | "logistik" | "deskripsi">("info");
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serverHasVarian, setServerHasVarian] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const searchParams = useSearchParams();
  const params = useParams();
  const routeId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : null;
  const searchId = searchParams.get("id");
  const requestedId = routeId ?? searchId;
  const isEditMode = Boolean(requestedId);
  const [supplierOptions, setSupplierOptions] = useState<Option[]>([{ label: "Pilih Supplier", value: "" }]);
  const [merkOptions, setMerkOptions] = useState<Option[]>([{ label: "Pilih Merk", value: "" }]);
  const [kategoriOptions, setKategoriOptions] = useState<Option[]>([{ label: "Pilih Kategori", value: "" }]);
  const [gudangOptions, setGudangOptions] = useState<Option[]>([{ label: "Pilih Gudang", value: "" }]);

  const images = useMemo(
    () =>
      imagePreviews.length > 0
        ? imagePreviews
        : form.gambar_list
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean),
    [form.gambar_list, imagePreviews]
  );
  const mainImage = images[0];

  const handleChange = (field: keyof FormBarang, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addVariant = () => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    setVariants((prev) => [
      ...prev,
      {
        id,
        nama: "",
        kode: "",
        barcode: "",
        warna_hex: "#ffffff",
        imageFile: null,
        imagePreview: null,
        is_aktif: 1,
      },
    ]);
    setForm((prev) => ({ ...prev, has_varian: "1" }));
  };

  const updateVariant = <K extends keyof VariantEditable>(
    id: string,
    field: K,
    value: VariantEditable[K]
  ) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const parseErrorMessage = async (res: Response) => {
    const raw = await res.text();
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.message) return parsed.message as string;
    } catch {
      /* ignore parse failure */
    }
    return raw || `Error ${res.status}`;
  };

  const updateVariantImage = (id: string, file: File | null) => {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        if (v.imagePreview) URL.revokeObjectURL(v.imagePreview);
        return {
          ...v,
          imageFile: file,
          imagePreview: file ? URL.createObjectURL(file) : null,
        };
      })
    );
  };

  const removeVariant = async (id: string) => {
    const target = variants.find((v) => v.id === id);
    if (!target) return;

    const confirm = await Swal.fire({
      title: "Hapus varian ini?",
      text: "Varian akan dinonaktifkan dan tidak bisa dipakai lagi.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#ef4444",
    });
    if (!confirm.isConfirmed) return;

    if (editingId && target.kode_barang_variant) {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
      try {
        const res = await fetch(
          `${API_BASE}/barang/varian/${encodeURIComponent(target.kode_barang_variant)}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ updated_by: "Admin" }),
          }
        );
        if (!res.ok) {
          const msg = await parseErrorMessage(res);
          throw new Error(msg);
        }
      } catch (err: any) {
        console.error("Failed delete varian", err);
        Swal.fire({
          icon: "error",
          title: "Gagal",
          text: err?.message || "Gagal menghapus varian.",
        });
        return;
      }
    }

    setVariants((prev) => {
      const removed = prev.find((v) => v.id === id);
      if (removed?.imagePreview) URL.revokeObjectURL(removed.imagePreview);
      const updated = prev.filter((v) => v.id !== id);
      if (updated.length === 0) {
        setForm((f) => ({ ...f, has_varian: "0" }));
      }
      return updated;
    });
  };

  useEffect(() => {
    if (imageFiles.length === 0) {
      setImagePreviews([]);
      return;
    }
    const urls = imageFiles.map((file) => URL.createObjectURL(file));
    setImagePreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [imageFiles]);

  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
    const fetchOptions = async () => {
      try {
        const [supRes, merkRes, katRes, gudRes] = await Promise.all([
          fetch(`${API_BASE}/suppliers`),
          fetch(`${API_BASE}/merk`),
          fetch(`${API_BASE}/klasifikasi`),
          fetch(`${API_BASE}/gudang`),
        ]);
        if (supRes.ok) {
          const data = await supRes.json();
          if (Array.isArray(data)) {
            const opts = data
              .filter((s: any) => s.kode_supplier && s.nama && Number(s.status ?? 1) === 1)
              .map((s: any) => ({ label: s.nama, value: s.kode_supplier }));
            setSupplierOptions([{ label: "Pilih Supplier", value: "" }, ...opts]);
          }
        }
        if (merkRes.ok) {
          const data = await merkRes.json();
          if (Array.isArray(data)) {
            const opts = data
              .filter((m: any) => m.nama_merk)
              .map((m: any) => ({ label: m.nama_merk, value: m.id_merk?.toString() || m.id_merk || m.nama_merk }));
            setMerkOptions([{ label: "Pilih Merk", value: "" }, ...opts]);
          }
        }
        if (katRes.ok) {
          const data = await katRes.json();
          if (Array.isArray(data)) {
            const opts = data
              .filter((k: any) => k.kode_klasifikasi && k.nama)
              .map((k: any) => ({ label: k.nama, value: k.kode_klasifikasi }));
            setKategoriOptions([{ label: "Pilih Kategori", value: "" }, ...opts]);
          }
        }
        if (gudRes.ok) {
          const data = await gudRes.json();
          if (Array.isArray(data)) {
            const opts = data
              .filter((g: any) => (g.kode_gudang || g.kode)?.length && (g.nama || g.nama_gudang))
              .map((g: any) => ({
                label: g.nama || g.nama_gudang,
                value: g.kode_gudang || g.kode,
              }));
            setGudangOptions([{ label: "Pilih Gudang", value: "" }, ...opts]);
            setForm((prev) => {
              if (editingId || prev.kode_gudang || opts.length === 0) return prev;
              return { ...prev, kode_gudang: String(opts[0].value || "") };
            });
          }
        }
      } catch (err) {
        console.error("Failed fetch options barang", err);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    const id = requestedId;
    if (!id) return;
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`${API_BASE}/barang/${id}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setEditingId(id);
        const mappedVariants: VariantRow[] = (data.variants || []).map((v: any) => ({
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
          nama: v.nama || v.nama_varian || "",
          kode: v.kode || v.kode_varian || "",
          barcode: v.barcode || v.barcode_varian || "",
          warna_hex: v.warna_hex || "#ffffff",
          imageFile: null,
          imagePreview: v.image || v.foto_varian || null,
          is_aktif: Number(v.is_aktif ?? 1),
          kode_barang_variant: v.kode_barang_variant || null,
          harga_beli: Number(v.harga_beli_sat_1 ?? v.harga_beli ?? 0),
          het: Number(v.het_sat_1 ?? v.harga_het ?? v.het ?? 0),
          stok_gudang: Number(v.stok_gudang ?? 0),
          stok_toko: Number(v.stok_toko ?? 0),
        }));

        const hasVariantFlag =
          Boolean(data.is_memiliki_varian) ||
          data.is_memiliki_varian === 1 ||
          data.is_memiliki_varian === "1" ||
          data.is_memiliki_varian === true ||
          data.is_memiliki_varian === "true" ||
          (data.variants || []).length > 0;
        setServerHasVarian(hasVariantFlag);

        setForm((prev) => ({
          ...prev,
          kode_manual: data.kode_manual || "",
          nama: data.nama || "",
          supplier: data.kode_supplier || "",
          merk: data.kode_merk || "",
          tipe: data.kode_kategori || "",
          barcode_global: data.barcode_global || "",
          kode_gudang: data.kode_gudang || "",
          satuan_1: data.satuan_1 || "pcs",
          harga_beli_sat_1: "",
          margin_profit: String(data.margin_profit ?? "0"),
          buffer_stok: String(data.buffer_stok ?? "0"),
          status: String(data.status ?? "1"),
          boleh_retur: String(data.boleh_retur ?? "1"),
          is_barang_khusus:
            data.barang_khusus === 1 ? "festive" : data.barang_khusus === 2 ? "bonus" : "regular",
          segmentasi_pasar: data.segmentasi_pasar || "",
          cocok_untuk: data.cocok_untuk || "",
          manfaat: data.manfaat || "",
          deskripsi: data.deskripsi_produk || "",
          catatan: data.catatan_internal || "",
          gambar_list: (data.gambar_list || []).join(", "),
          video_url: "",
          has_varian: hasVariantFlag ? "1" : "0",
        }));

        setVariants(mappedVariants);
        if (data.gambar_list?.length) {
          setImagePreviews(data.gambar_list);
        }
      } catch (err) {
        console.error("Failed fetch barang detail", err);
        Swal.fire({ icon: "error", title: "Gagal", text: "Gagal memuat data barang." });
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetail();
  }, [requestedId]);

  useEffect(() => {
    if (!videoFile) {
      setVideoPreview(null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  useEffect(() => {
    const shouldHaveVariant = serverHasVarian || variants.length > 0;
    if (shouldHaveVariant && form.has_varian !== "1") {
      setForm((prev) => ({ ...prev, has_varian: "1" }));
    }
  }, [serverHasVarian, variants.length, form.has_varian]);

  const handleDeleteImage = async (index: number) => {
    const confirm = await Swal.fire({
      title: "Hapus gambar?",
      text: "Gambar akan dihapus dari daftar upload.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#ef4444",
    });
    if (!confirm.isConfirmed) return;

    if (imageFiles.length > 0) {
      setImageFiles((prev) => prev.filter((_, i) => i !== index));
    } else {
      const remaining = images.filter((_, i) => i !== index);
      handleChange("gambar_list", remaining.join(", "));
      setImagePreviews(remaining);
    }
  };

  const uploadFile = async (file: File) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/uploads${editingId ? `?barang_id=${editingId}` : ""}`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res);
      throw new Error(msg);
    }
    const data = await res.json();
    return data.url as string;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

    try {
      // Upload images
      const uploadedImages: string[] = [];
      for (const file of imageFiles) {
        const url = await uploadFile(file);
        uploadedImages.push(url);
      }
      // Merge with manual URLs
      const manualImgs = form.gambar_list
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const allImages = [...uploadedImages, ...manualImgs];

      // Upload variant images
      const mappedVariants = [];
      for (const v of variants) {
        let imgUrl: string | null = v.imagePreview ?? null;
        if (v.imageFile) {
          imgUrl = await uploadFile(v.imageFile);
        }
        mappedVariants.push({
          nama: v.nama,
          kode: v.kode,
          barcode: v.barcode,
          warna_hex: v.warna_hex,
          image: imgUrl,
          is_aktif: v.is_aktif ?? 1,
          kode_barang_variant: v.kode_barang_variant || null,
          harga_beli: v.harga_beli ?? 0,
          het: v.het ?? 0,
        });
      }

      const payload = {
        kode_manual: form.kode_manual,
        nama: form.nama,
        kode_supplier: form.supplier || null,
        kode_merk: form.merk || null,
        kode_kategori: form.tipe || null,
        kode_gudang: form.kode_gudang || null,
        barcode_global: form.barcode_global || null,
        satuan_1: form.satuan_1 || null,
        margin_profit: parseFloat(form.margin_profit || "0"),
        buffer_stok: parseInt(form.buffer_stok || "0", 10),
        status: Number(form.status || 1),
        is_discontinue: form.is_barang_khusus === "bonus" ? 1 : 0,
        boleh_retur: Number(form.boleh_retur || 1),
        barang_khusus:
          form.is_barang_khusus === "festive"
            ? 1
            : form.is_barang_khusus === "bonus"
            ? 2
            : 0,
        is_memiliki_varian: Number(form.has_varian || 0),
        segmentasi_pasar: form.segmentasi_pasar || null,
        cocok_untuk: form.cocok_untuk || null,
        manfaat: form.manfaat || null,
        deskripsi_produk: form.deskripsi || null,
        catatan_internal: form.catatan || null,
        gambar_list: allImages,
        variants: mappedVariants,
        created_by: "Admin",
        updated_by: "Admin",
      };

      const res = await fetch(`${API_BASE}/barang${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await parseErrorMessage(res);
        throw new Error(msg || "Gagal menyimpan barang");
      }

      await Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Barang berhasil disimpan.",
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
      setTimeout(() => window.close(), 2000);
    } catch (err: any) {
      console.error("Failed save barang", err);
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: err?.message || "Gagal menyimpan barang.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    const confirm = await Swal.fire({
      title: "Hapus barang ini?",
      text: "Data barang beserta media dan variannya akan dihapus permanen.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#ef4444",
    });
    if (!confirm.isConfirmed) return;

    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/barang/${editingId}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Gagal menghapus barang");
      }
      await Swal.fire({
        icon: "success",
        title: "Terhapus",
        text: "Barang berhasil dihapus.",
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
      setTimeout(() => window.close(), 1800);
    } catch (err: any) {
      console.error("Failed delete barang", err);
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: err?.message || "Gagal menghapus barang.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {detailLoading && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 animate-pulse space-y-3">
            <div className="h-4 w-48 bg-gray-200 rounded" />
            <div className="h-8 w-full bg-gray-200 rounded" />
            <div className="grid md:grid-cols-2 gap-3">
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-200 rounded" />
            </div>
            <div className="h-64 bg-gray-100 rounded" />
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/master/barang"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </Link>
            <div>
              <p className="text-sm text-gray-500">Master Data / Barang</p>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditMode ? "Edit Barang" : "Tambah Barang"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-2">
              <ClipboardList className="w-4 h-4" />
              Form full-page (marketplace style)
            </div>
            {editingId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? "Menghapus..." : "Hapus Barang"}
              </button>
            )}
          </div>
        </div>

        {/* Form body */}
        <form
          onSubmit={handleSubmit}
          className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] items-start"
        >
          {/* Left: Media preview */}
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-800 font-semibold">
                  <Image className="w-4 h-4 text-[#0f756b]" />
                  Media Produk
                </div>
                <span className="text-xs text-gray-500">Foto & Video</span>
              </div>

              <div className="aspect-[4/5] w-full max-h-[480px] rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center">
                {detailLoading ? (
                  <div className="w-full h-full bg-gray-100 animate-pulse" />
                ) : (
                  <img
                    src={mainImage || PLACEHOLDER_IMAGE}
                    alt="Preview utama"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              {form.video_url && (
                <div className="rounded-xl overflow-hidden border border-gray-100">
                  <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 text-sm text-gray-700">
                    <Video className="w-4 h-4 text-[#0f756b]" />
                    Preview Video
                  </div>
                  <div className="aspect-video bg-black">
                    <video src={form.video_url} className="w-full h-full" controls />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FileInput
                  label="Upload Foto (multi)"
                  accept="image/*"
                  multiple
                  onFiles={(files) => setImageFiles(Array.from(files))}
                />
                <FileInput
                  label="Upload Video"
                  accept="video/*"
                  onFiles={(files) => setVideoFile(files[0] || null)}
                />
              </div>

              {images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((src, idx) => (
                    <div key={src} className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const reordered = [src, ...images.filter((i) => i !== src)];
                          setImagePreviews(reordered);
                        }}
                        className={`w-14 h-14 rounded-lg overflow-hidden border block ${
                          src === mainImage ? "border-[#3FE0D0]" : "border-gray-200"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt="thumb"
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(idx);
                        }}
                        className="absolute -top-2 -right-2 bg-white border border-gray-200 rounded-full p-1 shadow-sm hover:bg-red-50"
                        aria-label="Hapus gambar"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Form fields in tabs */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
              {/* Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3">
                {[
                  { key: "info", label: "Informasi Produk" },
                  { key: "logistik", label: "Logistik & Status" },
                  { key: "deskripsi", label: "Deskripsi & Catatan" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key as typeof tab)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      tab === t.key
                        ? "bg-[#3FE0D0]/15 text-[#0f756b] border border-[#3FE0D0]/30"
                        : "text-gray-600 border border-transparent hover:bg-gray-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="p-5 space-y-4">
                {/* Tab Informasi Produk */}
                {tab === "info" && (
                  <>
                    <div className="flex items-center gap-2 text-gray-800 font-semibold mb-1">
                      <Package className="w-4 h-4 text-[#0f756b]" />
                      Informasi Produk
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Input
                          label="Nama Produk"
                          value={form.nama}
                          onChange={(v) => handleChange("nama", v)}
                          placeholder="Nama lengkap produk"
                          required
                        />
                      </div>
                      <Input
                        label="Kode Manual"
                        value={form.kode_manual}
                        onChange={(v) => handleChange("kode_manual", v)}
                        placeholder="SKU internal"
                      />
                      <SearchableSelect
                        label="Supplier"
                        value={form.supplier}
                        onChange={(v) => handleChange("supplier", v)}
                        options={supplierOptions}
                        placeholder="Cari nama supplier"
                      />
                      <FilterSelect
                        label="Merk"
                        value={form.merk}
                        onChange={(v) => handleChange("merk", v)}
                        options={merkOptions}
                        searchPlaceholder="Cari nama merk"
                      />
                      <SearchableSelect
                        label="Kategori"
                        value={form.tipe}
                        onChange={(v) => handleChange("tipe", v)}
                        options={kategoriOptions}
                        placeholder="Cari nama kategori"
                      />
                      <Input
                        label="Barcode Global"
                        value={form.barcode_global}
                        onChange={(v) => handleChange("barcode_global", v)}
                        placeholder="EAN/UPC"
                      />
                    </div>

                    {/* Checkbox: produk punya varian atau tidak */}
                    <div className="pt-2">
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-[#0f756b] focus:ring-[#3FE0D0]"
                          checked={form.has_varian === "1"}
                          onChange={(e) =>
                            handleChange("has_varian", e.target.checked ? "1" : "0")
                          }
                        />
                        Produk ini memiliki varian (warna/ukuran, dll)
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Jika dicentang, detail varian bisa langsung diisi di bawah.
                      </p>

                      {form.has_varian === "1" && (
                        <div className="mt-6 space-y-3 border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-gray-800 font-semibold">
                              <Tags className="w-4 h-4 text-[#0f756b]" />
                              Varian Produk
                            </div>
                            <button
                              type="button"
                              onClick={addVariant}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-[#3FE0D0] text-xs font-semibold text-[#0f756b] hover:bg-[#3FE0D0]/10"
                            >
                              <Plus className="w-3 h-3" />
                              Tambah Varian
                            </button>
                          </div>

                          <p className="text-xs text-gray-500">
                            Contoh varian: warna (Red, Nude), ukuran (S, M, L), shade, dsb.
                            Setiap varian dapat punya satu foto khusus.
                          </p>

                          <div className="space-y-2">
                            {variants.length === 0 && (
                              <div className="text-xs text-gray-400 italic border border-dashed border-gray-200 rounded-lg px-3 py-2">
                                Belum ada varian. Klik &quot;Tambah Varian&quot; untuk
                                menambahkan.
                              </div>
                            )}

                            {variants.map((v, idx) => {
                              const isActive = Number(v.is_aktif ?? 1) === 1;
                              return (
                                <div
                                  key={v.id}
                                  className="border border-gray-100 rounded-xl p-3 bg-white flex flex-col md:flex-row items-stretch gap-3"
                                >
                                {/* KIRI: Foto varian (clickable untuk pilih file) */}
                                <div className="flex-shrink-0 flex flex-col items-center gap-1 w-24">
                                  <label className="block w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden cursor-pointer relative">
                                    {v.imagePreview ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={v.imagePreview}
                                        alt={`Preview ${v.nama || "varian"}`}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 text-center px-1">
                                        Tambah Foto
                                      </div>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) =>
                                        updateVariantImage(v.id, e.target.files?.[0] || null)
                                      }
                                      className="hidden"
                                    />
                                  </label>
                                  <span className="text-[10px] font-medium text-gray-500">
                                    Foto Varian
                                  </span>
                                </div>

                                {/* TENGAH: Info produk varian */}
                                <div className="flex-1 space-y-3">
                                  {/* Baris 1: Nama varian (full width) */}
                                  <div>
                                    <Input
                                      label={`Nama Varian #${idx + 1}`}
                                      value={v.nama}
                                      onChange={(val) => updateVariant(v.id, "nama", val)}
                                      placeholder="Contoh: Shade Rose / Size M / Red Nude 01"
                                    />
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                                        isActive
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : "bg-gray-100 text-gray-600 border-gray-200"
                                      }`}
                                    >
                                      {isActive ? "Aktif" : "Nonaktif"}
                                    </span>
                                    <label className="text-xs font-semibold text-gray-700">
                                      Status Varian
                                      <select
                                        value={String(v.is_aktif ?? 1)}
                                        onChange={(e) =>
                                          updateVariant(v.id, "is_aktif", Number(e.target.value))
                                        }
                                        className="ml-2 rounded-lg border-2 border-gray-200 px-2 py-1 text-xs font-semibold focus:border-[#3FE0D0] focus:outline-none bg-white"
                                      >
                                        <option value="1">Aktif</option>
                                        <option value="0">Nonaktif</option>
                                      </select>
                                    </label>
                                  </div>

                                  {/* Baris 2: Kode & Barcode */}
                                  <div className="grid md:grid-cols-2 gap-3">
                                    <Input
                                      label="Kode Varian / SKU"
                                      value={v.kode}
                                      onChange={(val) => updateVariant(v.id, "kode", val)}
                                      placeholder="SKU-ROSE-01"
                                    />
                                    <Input
                                      label="Barcode Varian"
                                      value={v.barcode}
                                      onChange={(val) => updateVariant(v.id, "barcode", val)}
                                      placeholder="EAN/UPC"
                                    />
                                  </div>
                                  <div className="grid md:grid-cols-3 gap-3">
                                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                                      <span className="text-gray-500">Stok Gudang:</span>{" "}
                                      {Number(v.stok_gudang ?? 0).toLocaleString("id-ID")}
                                    </div>
                                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                                      <span className="text-gray-500">Stok Toko:</span>{" "}
                                      {Number(v.stok_toko ?? 0).toLocaleString("id-ID")}
                                    </div>
                                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                                      <span className="text-gray-500">Total Stok:</span>{" "}
                                      {Number((v.stok_gudang ?? 0) + (v.stok_toko ?? 0)).toLocaleString("id-ID")}
                                    </div>
                                  </div>
                                  <div className="max-w-md">
                                    <Input
                                      label="Key (kode_barang_variant)"
                                      value={v.kode_barang_variant || "-"}
                                      onChange={() => {}}
                                      readOnly
                                    />
                                  </div>

                                  {/* Baris 3: Warna saja */}
                                  <div className="max-w-md">
                                    <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
                                      Warna Varian
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="color"
                                          value={v.warna_hex}
                                          onChange={(e) =>
                                            updateVariant(v.id, "warna_hex", e.target.value)
                                          }
                                          className="h-8 w-10 cursor-pointer border border-gray-200 rounded"
                                        />
                                        <input
                                          type="text"
                                          value={v.warna_hex}
                                          onChange={(e) =>
                                            updateVariant(v.id, "warna_hex", e.target.value)
                                          }
                                          className="flex-1 rounded-lg border-2 border-gray-200 px-2 py-1 text-xs focus:border-[#3FE0D0] focus:outline-none"
                                          placeholder="#FFFFFF"
                                        />
                                      </div>
                                    </label>
                                  </div>
                                </div>

                                {!isEditMode && (
                                  <div className="flex-shrink-0 flex items-start md:items-center justify-end">
                                    <button
                                      type="button"
                                      onClick={() => removeVariant(v.id)}
                                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-red-500 hover:bg-red-50"
                                      aria-label="Hapus varian"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              );
                            })}


                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Tab Logistik & Status */}
                {tab === "logistik" && (
                  <>
                    <div className="flex items-center gap-2 text-gray-800 font-semibold mb-1">
                      <CheckCircle2 className="w-4 h-4 text-[#0f756b]" />
                      Logistik & Status
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <Select
                        label="Nama Gudang"
                        value={form.kode_gudang}
                        onChange={(v) => handleChange("kode_gudang", v)}
                        options={gudangOptions}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <Input
                        label="Panjang (cm)"
                        value={form.panjang}
                        onChange={(v) => handleChange("panjang", v)}
                      />
                      <Input
                        label="Lebar (cm)"
                        value={form.lebar}
                        onChange={(v) => handleChange("lebar", v)}
                      />
                      <Input
                        label="Tinggi (cm)"
                        value={form.tinggi}
                        onChange={(v) => handleChange("tinggi", v)}
                      />
                      <Input
                        label="Berat (gr)"
                        value={form.berat}
                        onChange={(v) => handleChange("berat", v)}
                      />
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <Select
                        label="Status"
                        value={form.status}
                        onChange={(v) => handleChange("status", v)}
                        options={[
                          { label: "Aktif", value: "1" },
                          { label: "Nonaktif", value: "0" },
                        ]}
                      />
                      <Select
                        label="Boleh Retur"
                        value={form.boleh_retur}
                        onChange={(v) => handleChange("boleh_retur", v)}
                        options={[
                          { label: "Ya", value: "1" },
                          { label: "Tidak", value: "0" },
                        ]}
                      />
                      <Select
                        label="Barang Khusus"
                        value={form.is_barang_khusus}
                        onChange={(v) => handleChange("is_barang_khusus", v)}
                        options={[
                          { label: "Regular", value: "regular" },
                          { label: "Festive", value: "festive" },
                          { label: "Bonus", value: "bonus" },
                        ]}
                      />
                    </div>
                  </>
                )}

                {/* Tab Deskripsi & Catatan */}
                {tab === "deskripsi" && (
                  <div className="space-y-4">
                    <Textarea
                      label="Segmentasi Pasar"
                      value={form.segmentasi_pasar}
                      onChange={(v) => handleChange("segmentasi_pasar", v)}
                      placeholder="Target pasar utama: usia, gender, channel, kelas harga, dsb."
                      minRows={4}
                    />
                    <Textarea
                      label="Cocok Untuk"
                      value={form.cocok_untuk}
                      onChange={(v) => handleChange("cocok_untuk", v)}
                      placeholder="Contoh: kulit kering/sensitif, semua jenis kulit, ibu hamil, dsb."
                      minRows={3}
                    />
                    <Textarea
                      label="Manfaat"
                      value={form.manfaat}
                      onChange={(v) => handleChange("manfaat", v)}
                      placeholder="Benefit utama produk dalam bullet/kalimat"
                      minRows={4}
                    />
                    <Textarea
                      label="Deskripsi Produk (bisa rich text / bullet)"
                      value={form.deskripsi}
                      onChange={(v) => handleChange("deskripsi", v)}
                      placeholder="Deskripsi lengkap produk, manfaat, cara pakai, ingredients, dsb."
                      minRows={8}
                    />
                    <Textarea
                      label="Catatan Internal"
                      value={form.catatan}
                      onChange={(v) => handleChange("catatan", v)}
                      placeholder="Catatan gudang / buyer / QC"
                      minRows={5}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Link
                href="/admin/master/barang"
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Batal
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#3FE0D0] to-[#2DD4C4] text-white font-semibold shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Menyimpan..." : "Simpan Barang"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  step,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  step?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        step={step}
        readOnly={readOnly}
        className={`w-full rounded-lg border-2 px-3 py-2.5 transition-colors focus:outline-none ${
          readOnly
            ? "border-gray-100 bg-gray-50 text-gray-500"
            : "border-gray-200 focus:border-[#3FE0D0]"
        }`}
      />
    </label>
  );
}

function FileInput({
  label,
  accept,
  multiple,
  onFiles,
}: {
  label: string;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: FileList) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
        }}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none transition-colors"
      />
    </label>
  );
}

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  allowCustom = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  allowCustom?: boolean;
}) {
  const listId = `${label.replace(/\s+/g, "-").toLowerCase()}-options`;
  const display = useMemo(() => {
    if (value === "") return "";
    return options.find((o) => o.value === value)?.label || value;
  }, [options, value]);
  const [inputValue, setInputValue] = useState(display);

  useEffect(() => {
    setInputValue(display);
  }, [display]);

  const findMatch = (inputVal: string) =>
    options.find((opt) => opt.label === inputVal || opt.value === inputVal);

  const handleChangeValue = (inputVal: string) => {
    setInputValue(inputVal);
    const match = findMatch(inputVal);
    if (match) {
      onChange(match.value);
      return;
    }
    if (inputVal === "") {
      onChange("");
      return;
    }
    if (allowCustom) {
      onChange(inputVal);
    }
  };

  const handleBlur = () => {
    if (allowCustom) return;
    const match = findMatch(inputValue);
    if (!match) {
      setInputValue(display);
    }
  };
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <input
        list={listId}
        value={inputValue}
        onChange={(e) => handleChangeValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none transition-colors"
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.label}>
            {opt.label}
          </option>
        ))}
      </datalist>
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none transition-colors bg-white"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  searchPlaceholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const key = query.trim().toLowerCase();
    if (!key) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(key));
  }, [options, query]);

  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none transition-colors"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 focus:border-[#3FE0D0] focus:outline-none transition-colors bg-white"
      >
        {filtered.length === 0 && (
          <option value="" disabled>
            Tidak ada hasil
          </option>
        )}
        {filtered.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  minRows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-3 focus:border-[#3FE0D0] focus:outline-none transition-colors"
      />
    </label>
  );
}

export default function MasterBarangNewPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-600">Memuat form...</div>}>
      <MasterBarangNewPageInner />
    </Suspense>
  );
}
