import { normalizeDateRange } from "../utils/date-range.js";

export default async function rekapanHarianRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  fastify.get("/", async (req, reply) => {
    const kodeSupplier = String(req.query?.kode_supplier || "").trim();
    const kodeMerk = String(req.query?.kode_merk || "").trim();
    const fromRaw = String(req.query?.from || "").trim();
    const toRaw = String(req.query?.to || "").trim();

    const dateRange = normalizeDateRange({
      from: fromRaw,
      to: toRaw,
      defaultDays: 30,
      maxSpanDays: 93,
    });
    if (dateRange.error) {
      return reply.code(400).send({ message: dateRange.error });
    }
    const fromDate = dateRange.fromDate;
    const toDate = dateRange.toDate;

    const pad2 = (n) => String(n).padStart(2, "0");
    const dateKeys = [];
    const cursor = new Date(Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()));
    const end = new Date(Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()));
    while (cursor <= end) {
      const y = cursor.getUTCFullYear();
      const m = pad2(cursor.getUTCMonth() + 1);
      const d = pad2(cursor.getUTCDate());
      dateKeys.push(`${y}-${m}-${d}`);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    try {
      const reqDb = pool.request();
      reqDb.input("from", sql.Date, fromDate);
      reqDb.input("to", sql.Date, toDate);
      if (kodeSupplier) reqDb.input("kode_supplier", sql.VarChar(100), kodeSupplier);
      if (kodeMerk) reqDb.input("kode_merk", sql.VarChar(100), kodeMerk);

      const supplierFilter = kodeSupplier ? "AND b.kode_supplier = @kode_supplier" : "";
      const merkFilter = kodeMerk ? "AND b.kode_merk = @kode_merk" : "";

      const res = await reqDb.query(
        `
        WITH base AS (
          SELECT
            v.kode_barang_variant,
            b.kode_supplier,
            ms.nama AS nama_supplier,
            b.kode_merk,
            mm.nama_merk,
            b.nama AS nama_barang,
            v.nama_varian,
            CONVERT(varchar(10), CAST(h.tgl_transaksi AS date), 23) AS tgl_key,
            h.stok_akhir_satuan_1,
            ROW_NUMBER() OVER (
              PARTITION BY v.kode_barang_variant, CAST(h.tgl_transaksi AS date)
              ORDER BY h.tgl_transaksi DESC, h.kode_h_stok_barang DESC
            ) AS rn
          FROM dbo.GWEN_h_stok_barang_variant h
          JOIN dbo.m_barang_varian v
            ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = h.kode_barang_variant COLLATE DATABASE_DEFAULT
          JOIN dbo.m_barang b ON b.id_barang = v.id_barang
          OUTER APPLY (
            SELECT CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS INT) END AS kode_merk_int
          ) mapm
          LEFT JOIN dbo.m_merk mm ON mm.id_merk = mapm.kode_merk_int
          LEFT JOIN dbo.m_supplier ms
            ON ms.kode_supplier COLLATE DATABASE_DEFAULT = b.kode_supplier COLLATE DATABASE_DEFAULT
          WHERE h.kode_gudang LIKE 'MTO%'
            AND CAST(h.tgl_transaksi AS date) >= @from
            AND CAST(h.tgl_transaksi AS date) <= @to
            ${supplierFilter}
            ${merkFilter}
        )
        SELECT
          kode_barang_variant,
          nama_supplier,
          nama_merk,
          nama_barang,
          nama_varian,
          tgl_key,
          stok_akhir_satuan_1
        FROM base
        WHERE rn = 1
        ORDER BY nama_supplier ASC, nama_merk ASC, nama_barang ASC, nama_varian ASC, tgl_key ASC;
        `
      );

      const rows = res.recordset || [];
      const grouped = new Map();
      for (const row of rows) {
        const key = String(row.kode_barang_variant || "");
        if (!key) continue;
        if (!grouped.has(key)) {
          grouped.set(key, {
            kode_barang_variant: key,
            nama_supplier: row.nama_supplier || "-",
            nama_merk: row.nama_merk || "-",
            nama_barang_varian: `${row.nama_barang || "-"}${row.nama_varian ? ` ${row.nama_varian}` : ""}`,
            values: Object.fromEntries(dateKeys.map((d) => [d, 0])),
          });
        }
        const tglKey = row.tgl_key || null;
        if (tglKey && grouped.get(key)) {
          grouped.get(key).values[tglKey] = Number(row.stok_akhir_satuan_1 ?? 0);
        }
      }

      return reply.send({
        dates: dateKeys,
        rows: Array.from(grouped.values()),
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch rekapan harian");
      return reply.code(500).send({ message: "Gagal memuat rekapan harian" });
    }
  });
}
