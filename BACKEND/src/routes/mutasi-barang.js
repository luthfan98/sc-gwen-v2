import { normalizeDateRange } from "../utils/date-range.js";
import { nowWib } from "../utils/wib-time.js";

export default async function mutasiBarangRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  fastify.post("/recalc", async (req, reply) => {
    const codes = Array.isArray(req.body?.codes) ? req.body.codes : [];
    const cleaned = codes.map((v) => String(v || "").trim()).filter(Boolean);
    if (!cleaned.length) {
      return reply.code(400).send({ message: "codes wajib diisi" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();
      const reqRows = new sql.Request(tx);
      const params = cleaned.map((_, idx) => `@kode_${idx}`);
      cleaned.forEach((val, idx) => reqRows.input(`kode_${idx}`, sql.VarChar(255), val));
      const rowsRes = await reqRows.query(
        `
        SELECT
          kode_h_stok_barang,
          kode_barang_variant,
          kode_gudang,
          created_at,
          tgl_transaksi,
          qty_masuk,
          qty_keluar,
          stok_awal_satuan_1,
          stok_akhir_satuan_1
        FROM dbo.GWEN_h_stok_barang_variant
        WHERE kode_h_stok_barang IN (${params.join(",")});
        `
      );
      const rows = rowsRes.recordset || [];
      if (!rows.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Data mutasi tidak ditemukan." });
      }

      const grouped = new Map();
      rows.forEach((row) => {
        const key = `${row.kode_barang_variant || ""}||${row.kode_gudang || ""}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(row);
      });

      let updatedCount = 0;
      for (const [key, groupRows] of grouped.entries()) {
        groupRows.sort((a, b) => {
          const aDate = new Date(a.created_at || a.tgl_transaksi || 0).getTime();
          const bDate = new Date(b.created_at || b.tgl_transaksi || 0).getTime();
          if (aDate !== bDate) return aDate - bDate;
          const aMasuk = Number(a.qty_masuk || 0) > 0 ? 0 : 1;
          const bMasuk = Number(b.qty_masuk || 0) > 0 ? 0 : 1;
          if (aMasuk !== bMasuk) return aMasuk - bMasuk;
          return String(a.kode_h_stok_barang).localeCompare(String(b.kode_h_stok_barang));
        });

        const first = groupRows[0];
        const prevReq = new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(255), first.kode_barang_variant || null)
          .input("kode_gudang", sql.VarChar(255), first.kode_gudang || null)
          .input("created_at", sql.DateTime2, first.created_at || first.tgl_transaksi || null)
          .input("kode_h", sql.VarChar(255), first.kode_h_stok_barang || null);
        const prevRes = await prevReq.query(
          `
          SELECT TOP 1 stok_akhir_satuan_1
          FROM dbo.GWEN_h_stok_barang_variant
          WHERE kode_barang_variant = @kode_barang_variant
            AND kode_gudang = @kode_gudang
            AND (
              created_at < @created_at
              OR (created_at = @created_at AND kode_h_stok_barang < @kode_h)
            )
          ORDER BY created_at DESC, kode_h_stok_barang DESC;
          `
        );
        let running = Number(prevRes.recordset?.[0]?.stok_akhir_satuan_1 ?? 0);

        for (const row of groupRows) {
          const masuk = Number(row.qty_masuk || 0);
          const keluar = Number(row.qty_keluar || 0);
          const stokAwal = running;
          const stokAkhir = stokAwal + masuk - keluar;
          running = stokAkhir;

          await new sql.Request(tx)
            .input("kode_h_stok_barang", sql.VarChar(255), row.kode_h_stok_barang)
            .input("stok_awal_satuan_1", sql.Decimal(20, 2), stokAwal)
            .input("stok_akhir_satuan_1", sql.Decimal(20, 2), stokAkhir)
            .input("updated_at", sql.DateTime2, nowWib())
            .query(
              `
              UPDATE dbo.GWEN_h_stok_barang_variant
              SET stok_awal_satuan_1 = @stok_awal_satuan_1,
                  stok_akhir_satuan_1 = @stok_akhir_satuan_1,
                  updated_at = @updated_at
              WHERE kode_h_stok_barang = @kode_h_stok_barang;
              `
            );
          updatedCount += 1;
        }
      }

      await tx.commit();
      return reply.send({ ok: true, updated_count: updatedCount });
    } catch (err) {
      await tx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed recalc mutasi barang");
      return reply.code(500).send({ message: "Gagal memperbaiki mutasi barang" });
    }
  });

  fastify.get("/", async (req, reply) => {
    try {
      const page = Math.max(1, Number(req.query?.page || 1));
      const rawPageSize = Number(req.query?.page_size ?? 50);
      const pageSize = Number.isFinite(rawPageSize) ? rawPageSize : 50;
      const noLimit = String(req.query?.no_limit || "").trim() === "1" || pageSize === 0;
      const keyword = String(req.query?.q || "").trim();
      const kodeGudang = String(req.query?.kode_gudang || "").trim();
      const kodeRef = String(req.query?.kode_ref || "").trim();
      const idBarang = Number(req.query?.id_barang ?? 0);
      const kodeBarangVariant = String(req.query?.kode_barang_variant || "").trim();
      const tipe = String(req.query?.tipe || "").trim().toUpperCase();
      const dateFrom = String(req.query?.date_from || "").trim();
      const dateTo = String(req.query?.date_to || "").trim();

      const dateRange = normalizeDateRange({
        from: dateFrom,
        to: dateTo,
        defaultDays: 30,
        maxSpanDays: 93,
      });
      if (dateRange.error) {
        return reply.code(400).send({ message: dateRange.error });
      }

      const request = pool.request();
      if (!noLimit) {
        request.input("offset", sql.Int, (page - 1) * pageSize);
        request.input("page_size", sql.Int, pageSize);
      }
      if (keyword) request.input("q", sql.VarChar(255), `%${keyword}%`);
      if (kodeGudang) request.input("kode_gudang", sql.VarChar(255), kodeGudang);
      if (kodeRef) request.input("kode_ref", sql.VarChar(255), `%${kodeRef}%`);
      if (Number.isFinite(idBarang) && idBarang > 0) request.input("id_barang", sql.Int, idBarang);
      if (kodeBarangVariant) request.input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant);
      request.input("date_from", sql.Date, dateRange.from);
      request.input("date_to", sql.Date, dateRange.to);

      const filters = [];
      if (keyword) {
        filters.push(
          "(v.nama_varian COLLATE DATABASE_DEFAULT LIKE @q OR v.barcode_varian COLLATE DATABASE_DEFAULT LIKE @q OR h.kode_barang_variant COLLATE DATABASE_DEFAULT LIKE @q)"
        );
      }
      if (kodeGudang) filters.push("h.kode_gudang COLLATE DATABASE_DEFAULT = @kode_gudang");
      if (kodeRef) filters.push("h.kode_ref_transaksi COLLATE DATABASE_DEFAULT LIKE @kode_ref");
      if (Number.isFinite(idBarang) && idBarang > 0) filters.push("v.id_barang = @id_barang");
      if (kodeBarangVariant) {
        filters.push("h.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant");
      }
      if (tipe === "MASUK") filters.push("ISNULL(h.qty_masuk, 0) > 0");
      if (tipe === "KELUAR") filters.push("ISNULL(h.qty_keluar, 0) > 0");
      filters.push("CONVERT(date, h.tgl_transaksi) >= @date_from");
      filters.push("CONVERT(date, h.tgl_transaksi) <= @date_to");
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

      const result = await request.query(
        `
        WITH base AS (
          SELECT
            h.kode_h_stok_barang,
            h.kode_ref_transaksi,
            h.tgl_transaksi,
            h.ket_transaksi,
            h.kode_barang_variant,
            h.qty_masuk,
            h.qty_keluar,
            h.qty_ke_satuan_1,
            h.stok_awal_satuan_1,
            h.stok_akhir_satuan_1,
            h.status,
            h.kode_gudang,
            g.nama AS nama_gudang,
            v.barcode_varian,
            v.nama_varian,
            h.satuan,
            h.created_by
          FROM dbo.GWEN_h_stok_barang_variant h
          LEFT JOIN dbo.m_barang_varian v
            ON v.kode_barang_variant COLLATE DATABASE_DEFAULT =
               h.kode_barang_variant COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.m_gudang g
            ON g.kode_gudang COLLATE DATABASE_DEFAULT =
               h.kode_gudang COLLATE DATABASE_DEFAULT
          ${whereClause}
        )
        SELECT
          *,
          (SELECT COUNT(1) FROM base) AS total_count
        FROM base
        ORDER BY tgl_transaksi ASC, kode_h_stok_barang ASC
        ${noLimit ? "" : "OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY"}
        ;
        `
      );

      const rows = result.recordset || [];
      const total = rows.length ? Number(rows[0].total_count ?? 0) : 0;
      const items = rows.map(({ total_count, ...rest }) => rest);
      return reply.send({ items, total });
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch mutasi barang");
      return reply.code(500).send({ message: "Gagal memuat mutasi barang" });
    }
  });

  fastify.put("/:kode", async (req, reply) => {
    const kode = String(req.params?.kode || "").trim();
    const body = req.body || {};
    if (!kode) {
      return reply.code(400).send({ message: "kode_h_stok_barang wajib diisi" });
    }
    const qtyMasuk = body.qty_masuk;
    const qtyKeluar = body.qty_keluar;
    if (qtyMasuk === undefined && qtyKeluar === undefined) {
      return reply.code(400).send({ message: "qty_masuk/qty_keluar wajib diisi" });
    }
    try {
      const reqDb = pool.request().input("kode", sql.VarChar(255), kode);
      if (qtyMasuk !== undefined) reqDb.input("qty_masuk", sql.Decimal(20, 2), Number(qtyMasuk || 0));
      if (qtyKeluar !== undefined) reqDb.input("qty_keluar", sql.Decimal(20, 2), Number(qtyKeluar || 0));
      reqDb.input("updated_at", sql.DateTime2, nowWib());

      const setParts = [];
      if (qtyMasuk !== undefined) setParts.push("qty_masuk = @qty_masuk");
      if (qtyKeluar !== undefined) setParts.push("qty_keluar = @qty_keluar");
      setParts.push("updated_at = @updated_at");

      const res = await reqDb.query(
        `
        UPDATE dbo.GWEN_h_stok_barang_variant
        SET ${setParts.join(", ")}
        WHERE kode_h_stok_barang = @kode;
        `
      );
      if (!res.rowsAffected?.[0]) {
        return reply.code(404).send({ message: "Mutasi tidak ditemukan" });
      }
      return reply.send({ ok: true });
    } catch (err) {
      fastify.log.error({ err }, "Failed update mutasi barang");
      return reply.code(500).send({ message: "Gagal update mutasi barang" });
    }
  });
}
