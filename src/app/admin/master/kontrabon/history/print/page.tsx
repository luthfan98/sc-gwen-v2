"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type KontrabonHeader = {
  no_kontrabon: string;
  no_faktur: string | null;
  kode_supplier: string | null;
  supplier_nama: string | null;
  no_rekening: string | null;
  atas_nama: string | null;
  nama_bank: string | null;
  cabang: string | null;
  tgl_kontrabon: string | null;
  tgl_faktur: string | null;
  rencana_tf_dari: string | null;
  rencana_tf_sampai: string | null;
  nominal_faktur: number | null;
  biaya_lain: string | null;
  nominal_total: number | null;
  created_by: string | null;
  created_at: string | null;
};

type TagihanRow = {
  kode_t_tagihan: string;
  kode_t_pengadaan: string | null;
  no_faktur_supplier: string | null;
  tgl: string | null;
  total_tagihan: number | null;
  catatan: string | null;
  pengadaan_no_faktur_supplier?: string | null;
  pengadaan_tgl?: string | null;
  pengadaan_total_akhir?: number | null;
};

const formatCurrency = (value?: number | null) => {
  const safe = Number(value ?? 0);
  if (!Number.isFinite(safe)) return "Rp 0";
  const rounded = Math.ceil(safe);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(rounded);
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID");
};

const splitDisplayList = (value?: string | null) =>
  String(value || "")
    .split(/[\/\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

export default function KontrabonPrintPage() {
  const searchParams = useSearchParams();
  const no = searchParams.get("no");
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const [header, setHeader] = useState<KontrabonHeader | null>(null);
  const [tagihan, setTagihan] = useState<TagihanRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!no) return;
    setLoading(true);
    fetch(`${API_BASE}/kontrabon/${encodeURIComponent(no)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setHeader(data?.header || null);
        setTagihan(Array.isArray(data?.tagihan) ? data.tagihan : []);
      })
      .finally(() => setLoading(false));
  }, [API_BASE, no]);

  const biayaLainDetail = useMemo(() => {
    if (!header?.biaya_lain) return [];
    try {
      const parsed = JSON.parse(header.biaya_lain);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }, [header]);

  const biayaLainTotal = useMemo(() => {
    return biayaLainDetail.reduce((sum: number, item: any) => {
      const nominal = Number(item?.nominal ?? 0);
      if (!Number.isFinite(nominal)) return sum;
      return item?.jenis === "+" ? sum + nominal : sum - nominal;
    }, 0);
  }, [biayaLainDetail]);

  const totalTagihan = useMemo(() => {
    const sumTagihan = tagihan.reduce((sum, row) => sum + Number(row.total_tagihan ?? 0), 0);
    if (sumTagihan > 0) return sumTagihan;
    return Number(header?.nominal_total ?? 0);
  }, [header?.nominal_total, tagihan]);

  const totalPengadaan = useMemo(() => {
    return tagihan.reduce((sum, row) => sum + Number(row.pengadaan_total_akhir ?? 0), 0);
  }, [tagihan]);

  const nominalFaktur = useMemo(() => {
    const headerNominalFaktur = Number(header?.nominal_faktur ?? 0);
    if (headerNominalFaktur > 0) return headerNominalFaktur;
    return totalTagihan;
  }, [header?.nominal_faktur, totalTagihan]);

  const totalAkhir = useMemo(() => {
    const headerTotal = Number(header?.nominal_total ?? 0);
    if (headerTotal > 0) return headerTotal;
    return totalTagihan + biayaLainTotal;
  }, [biayaLainTotal, header?.nominal_total, totalTagihan]);

  const usePengadaanNominal = useMemo(() => {
    const target = Number(header?.nominal_faktur ?? header?.nominal_total ?? 0);
    return totalPengadaan > 0 && Math.round(totalPengadaan) === Math.round(target);
  }, [header?.nominal_faktur, header?.nominal_total, totalPengadaan]);

  const fakturList = useMemo(() => {
    const headerFaktur = splitDisplayList(header?.no_faktur);
    if (headerFaktur.length > 0) return headerFaktur;

    return tagihan
      .flatMap((row) => splitDisplayList(row.pengadaan_no_faktur_supplier || row.no_faktur_supplier))
      .filter(Boolean);
  }, [header?.no_faktur, tagihan]);

  const getRowNominal = (row: TagihanRow) =>
    usePengadaanNominal && Number(row.pengadaan_total_akhir ?? 0) > 0
      ? Number(row.pengadaan_total_akhir ?? 0)
      : Number(row.total_tagihan ?? 0);

  if (!no) {
    return <div style={{ padding: "16px" }}>No kontrabon tidak ditemukan.</div>;
  }

  return (
    <div className="print-root" style={{ background: "#fff", minHeight: "100vh", padding: "12px", fontSize: "11pt" }}>
      <style jsx global>{`
        @page {
          margin: 0;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          body {
            margin: 0;
          }
          .print-root {
            padding: 0 !important;
          }
          .print-area,
          .print-area * {
            visibility: visible;
          }
          .print-area {
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "6px" }}>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print"
          style={{ border: "1px solid #333", padding: "2px 8px", fontSize: "10pt" }}
        >
          Cetak
        </button>
      </div>

      <div className="print-area" style={{ width: "21.5cm", background: "#fff", height: "13.8cm", padding: "6mm 9mm", fontSize: "11pt" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "8mm",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "12pt", fontWeight: 600 }}>CV. Sinar Inti Lestari (GWEN)</span>
            <div style={{ display: "flex", flexDirection: "column", marginTop: "5px" }}>
              <span style={{ fontSize: "9.75pt", fontWeight: 600 }}>JL. Professor Muhammad Yamin No.88 </span>
              <span style={{ fontSize: "9.75pt", fontWeight: 600 }}>Slawi - Tegal</span>
              <span style={{ fontSize: "9.75pt", fontWeight: 600 }}>
                Tel. -
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "35px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "11pt" }}>
                No <span style={{ marginLeft: "23px" }}>: {header?.no_kontrabon || "-"}</span>
              </span>
              <span style={{ fontSize: "11pt" }}>
                Tgl <span style={{ marginLeft: "21px" }}>: {formatDate(header?.tgl_kontrabon)}</span>
              </span>
            </div>
            {header?.no_kontrabon && (
              <img
                alt="QR Kontrabon"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(
                  header.no_kontrabon
                )}`}
                style={{ width: "60px", height: "60px" }}
              />
            )}
          </div>
          <span
            style={{
              float: "left",
              marginTop: "1.2cm",
              marginLeft: "9cm",
              fontSize: "12pt",
              fontWeight: 600,
              position: "absolute",
            }}
          >
            KONTRABON
          </span>
        </div>

        <hr style={{ borderStyle: "double" }} />

        <table style={{ width: "100%" }}>
          <tbody>
            <tr>
              <td>
                <table>
                  <tbody>
                    <tr>
                      <td>Nama Supplier</td>
                      <td>: {header?.supplier_nama || header?.kode_supplier || "-"}</td>
                    </tr>
                    <tr>
                      <td>Nomor Rekening</td>
                      <td>: {header?.no_rekening || "-"}</td>
                    </tr>
                    <tr>
                      <td>Cabang</td>
                      <td>: {header?.cabang || "-"}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td>
                <table>
                  <tbody>
                    <tr>
                      <td>Nama Bank</td>
                      <td>: {header?.nama_bank || "-"}</td>
                    </tr>
                    <tr>
                      <td>Atas Nama</td>
                      <td>: {header?.atas_nama || "-"}</td>
                    </tr>
                    <tr>
                      <td>Rencana Transfer</td>
                      <td>
                        : {formatDate(header?.rencana_tf_dari)} s/d {formatDate(header?.rencana_tf_sampai)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        <table
          style={{
            marginTop: "10px",
            width: "fit-content",
            maxWidth: "100%",
            border: "1px solid #000",
            verticalAlign: "top",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #000",
                  borderRight: "1px solid #000",
                  padding: "4px 6px",
                }}
              >
                No Faktur
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #000",
                  borderRight: "1px solid #000",
                  padding: "4px 6px",
                }}
              >
                Tanggal Faktur
              </th>
              <th style={{ borderBottom: "1px solid #000", borderRight: "1px solid #000", padding: "4px 6px" }}>
                PO GWEN
              </th>
              <th style={{ borderBottom: "1px solid #000", borderRight: "1px solid #000", padding: "4px 6px" }}>
                Tanggal Terima
              </th>
              <th style={{ borderBottom: "1px solid #000", borderRight: "1px solid #000", padding: "4px 6px" }}>
                Nominal Faktur
              </th>
              <th style={{ borderBottom: "1px solid #000", borderRight: "1px solid #000", padding: "4px 6px" }}>
                Biaya Tambahan
              </th>
              <th style={{ borderBottom: "1px solid #000", padding: "4px 6px" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                style={{
                  borderRight: "1px solid #000",
                  borderBottom: "1px solid #000",
                  verticalAlign: "top",
                  padding: "4px 6px",
                }}
              >
                {fakturList.length === 0 && <div>-</div>}
                {fakturList.map((faktur, idx) => (
                  <div key={`faktur-${idx}-${faktur}`}>{faktur}</div>
                ))}
              </td>
              <td
                style={{
                  borderRight: "1px solid #000",
                  borderBottom: "1px solid #000",
                  verticalAlign: "top",
                  padding: "4px 6px",
                }}
              >
                {formatDate(header?.tgl_faktur)}
              </td>
              <td
                style={{
                  borderRight: "1px solid #000",
                  borderBottom: "1px solid #000",
                  verticalAlign: "top",
                  padding: "4px 6px",
                  fontSize: "10pt",
                }}
              >
                {tagihan.length === 0 && <div>-</div>}
                {tagihan.map((row) => (
                  <div key={row.kode_t_tagihan}>{row.kode_t_pengadaan || "-"}</div>
                ))}
              </td>
              <td
                style={{
                  borderRight: "1px solid #000",
                  borderBottom: "1px solid #000",
                  verticalAlign: "top",
                  padding: "4px 6px",
                }}
              >
                {formatDate(header?.tgl_kontrabon)}
              </td>
              <td
                style={{
                  borderRight: "1px solid #000",
                  borderBottom: "1px solid #000",
                  verticalAlign: "top",
                  padding: "4px 6px",
                  textAlign: "right",
                  fontSize: "10pt",
                }}
              >
                {tagihan.length === 0 && <div>{formatCurrency(nominalFaktur)}</div>}
                {tagihan.map((row) => (
                  <div key={`nominal-${row.kode_t_tagihan}`}>{formatCurrency(getRowNominal(row))}</div>
                ))}
              </td>
              <td
                style={{
                  fontSize: "10pt",
                  borderRight: "1px solid #000",
                  borderBottom: "1px solid #000",
                  verticalAlign: "top",
                  padding: "4px 6px",
                }}
              >
                {biayaLainDetail.length === 0 && <span>-</span>}
                {biayaLainDetail.map((item: any, idx: number) => (
                  <span key={`biaya-${idx}`}>
                    ({item?.jenis || "-"}) {formatCurrency(Number(item?.nominal ?? 0))},{" "}
                    {item?.keterangan || ""} <br />
                    <hr />
                  </span>
                ))}
              </td>
              <td
                style={{
                  borderBottom: "1px solid #000",
                  verticalAlign: "top",
                  padding: "4px 6px",
                }}
              >
                {formatCurrency(totalAkhir)}
              </td>
            </tr>
            <tr>
              <td
                colSpan={2}
                style={{
                  borderRight: "1px solid #000",
                  borderBottom: "1px solid #000",
                  verticalAlign: "top",
                  padding: "4px 6px",
                }}
              >
                Ttd Bag. Pembelian<br /><br /><br /><br />
              </td>
              <td
                colSpan={2}
                style={{
                  borderRight: "1px solid #000",
                  borderBottom: "1px solid #000",
                  verticalAlign: "top",
                  padding: "4px 6px",
                }}
              >
                Ttd Salesman
              </td>
              <td colSpan={3} style={{ verticalAlign: "middle", borderBottom: "1px solid #000" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "15px", fontWeight: 600 }}>Grand Total :</span>
                  <span style={{ fontSize: "21px", fontWeight: 700, textAlign: "center", marginRight: "50px" }}>
                    {formatCurrency(totalAkhir)}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <span>
          Tanggal Cetak {formatDate(header?.created_at)} || Oleh : {header?.created_by || "-"}
        </span>
        <br />
        <span style={{ fontStyle: "italic", fontSize: "11pt" }}>
          *Note: Kontrabon bisa dibatalkan secara sepihak oleh GWEN apabila ada permasalahan pada barang atau stok
        </span>
      </div>

      {loading && <div style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>Memuat data...</div>}
    </div>
  );
}
