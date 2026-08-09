"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type RekapHeader = {
  id: number;
  tgl_rekap: string | null;
  status_rekap: string | null;
  status: number | null;
  approved_by: string | null;
  approved_at: string | null;
  catatan: string | null;
};

type RekapItem = {
  no: number;
  nokontrabon: string | null;
  username: string | null;
  namasupp: string | null;
  tglbeli: string | null;
  total: number | null;
  gt: number | null;
  norek: string | null;
  atasnama: string | null;
  namabank: string | null;
  cabang: string | null;
  stspaid: string | null;
  top: number | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateTime = (value?: Date) =>
  value
    ? value.toLocaleString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "-";

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(
    Math.ceil(Number(value ?? 0))
  );

export default function KontrabonRekapPrintPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [header, setHeader] = useState<RekapHeader | null>(null);
  const [items, setItems] = useState<RekapItem[]>([]);
  const [printedBy, setPrintedBy] = useState("Administrator");

  useEffect(() => {
    const raw = localStorage.getItem("kosmetik-admin-session");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data?.username) setPrintedBy(data.username);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const fetchDetail = async () => {
      try {
        const res = await fetch(`${API_BASE}/kontrabon/rekap/${encodeURIComponent(id)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setHeader(data?.header || null);
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        setHeader(null);
        setItems([]);
      }
    };
    fetchDetail();
    return () => controller.abort();
  }, [id]);

  const grandTotal = useMemo(
    () => items.reduce((sum, row) => sum + Number(row.gt ?? row.total ?? 0), 0),
    [items]
  );

  return (
    <div style={{ background: "#fff", minHeight: "100vh", padding: "12px", fontSize: "11pt" }}>
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
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="print-root">
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

        <div className="print-area" style={{ width: "100%", background: "#fff", padding: "6mm 9mm" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ fontWeight: 700, fontSize: "12pt" }}>GWEN Cosmetic</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: "12pt" }}>Daftar Pembayaran Supplier</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5pt", marginBottom: "12px" }}>
            <div>Tanggal Cetak : {formatDateTime(new Date())}.</div>
            <div>Dicetak Oleh : {printedBy}</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11pt", fontWeight: 700, marginBottom: "6px" }}>
            
            <div>Tanggal Rekap : {formatDate(header?.tgl_rekap)}</div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", tableLayout: "auto" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", whiteSpace: "nowrap" }}>Username</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", whiteSpace: "nowrap" }}>Tgl Beli</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", whiteSpace: "nowrap" }}>TOP</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", whiteSpace: "nowrap" }}>Nama Supplier</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", whiteSpace: "nowrap" }}>Nominal Transfer</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", whiteSpace: "nowrap" }}>Logam Kupon</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", whiteSpace: "nowrap" }}>No Rek</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", whiteSpace: "nowrap" }}>Atas Nama</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", whiteSpace: "nowrap" }}>Bank</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", whiteSpace: "nowrap" }}>Cabang</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left", whiteSpace: "nowrap" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.no}>
                  <td style={{ border: "1px solid #000", padding: "6px", whiteSpace: "nowrap" }}>-</td>
                  <td style={{ border: "1px solid #000", padding: "6px", whiteSpace: "nowrap" }}>{formatDate(row.tglbeli)}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", whiteSpace: "nowrap" }}>{row.top ?? "-"}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", whiteSpace: "nowrap" }}>{row.namasupp || "-"}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", whiteSpace: "nowrap" }}>{formatCurrency(row.gt ?? row.total)}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", whiteSpace: "nowrap" }}>0</td>
                  <td style={{ border: "1px solid #000", padding: "6px", whiteSpace: "nowrap" }}>{row.norek || "-"}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", whiteSpace: "nowrap" }}>{row.atasnama || "-"}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", whiteSpace: "nowrap" }}>{row.namabank || "-"}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", whiteSpace: "nowrap" }}>{row.cabang || "-"}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", whiteSpace: "nowrap" }}>{row.stspaid || "Not Paid"}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>
                    Tidak ada data.
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={5} style={{ border: "1px solid #000", padding: "8px" }} />
                <td colSpan={3} style={{ border: "1px solid #000", padding: "8px", fontWeight: 800, fontSize: "13.5pt" }}>
                  Grand Total : {formatCurrency(grandTotal)}
                </td>
                <td colSpan={1} style={{ border: "1px solid #000", padding: "8px", fontWeight: 700 }}>
                  ACC Owner
                </td>
                <td colSpan={2} style={{ border: "1px solid #000", padding: "8px", fontWeight: 700 }}>
                  ACC Pimpinan
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ border: "1px solid #000", marginTop: "10px", padding: "10px", minHeight: "60px" }}>
            <strong>Catatan :</strong>
            <div style={{ marginTop: "6px", whiteSpace: "pre-wrap" }}>
              {header?.catatan?.trim() || "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
