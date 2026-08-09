import { normalizeDateRange } from "../utils/date-range.js";

export default async function posTransactionRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const parseLimit = (value, fallback = 200) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return fallback;
    return Math.min(1000, Math.floor(num));
  };

  fastify.get("/transactions", async (request, reply) => {
    const limit = parseLimit(request.query?.limit);
    try {                  
      const res = await pool
        .request()
        .input("limit", sql.Int, limit)
        .query(`SELECT TOP (@limit) * FROM dbo.pos_transactions_central;`);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch pos_transactions_central");
      return reply.code(500).send({ message: "Gagal memuat transactions" });
    }
  });

  fastify.get("/transactions-summary", async (request, reply) => {
    try {
      const range = normalizeDateRange({
        from: request.query?.from,
        to: request.query?.to,
        defaultDays: 30,
        maxSpanDays: 93,
      });
      if (range.error) {
        return reply.code(400).send({ message: range.error });
      }
      const req = pool.request();
      req.input("from", sql.Date, range.from);
      req.input("to", sql.Date, range.to);
      const res = await req.query(`
          SELECT
            t.central_trx_code,
            t.source_trx_code,
            t.uniq_code,
            t.source_kasir,
            t.created_at,
            t.cashier_name,
            t.customer_name,
            t.customer_id,
            t.customer_phone,
            t.method,
            t.fee_rate,
            t.fee_amount,
            t.manual_discount,
            t.manual_discount_note,
            t.total,
            t.status,
            t.discount,
            ISNULL(items.total_qty, 0) AS total_qty,
            audit.audit_status,
            audit.audit_note,
            audit.audited_by,
            audit.audited_at
          FROM dbo.pos_transactions_central t
          LEFT JOIN (
            SELECT central_trx_code, SUM(CAST(qty AS int)) AS total_qty
            FROM dbo.pos_transaction_items_central
            GROUP BY central_trx_code
          ) items ON items.central_trx_code = t.central_trx_code
          OUTER APPLY (
            SELECT TOP 1
              a.audit_status,
              a.audit_note,
              a.audited_by,
              a.audited_at
            FROM dbo.pos_transactions_central_audit a
            WHERE a.central_trx_code = t.central_trx_code
            ORDER BY a.audited_at DESC, a.id DESC
          ) audit
          WHERE CONVERT(date, t.created_at) >= @from
            AND CONVERT(date, t.created_at) <= @to
          ORDER BY t.created_at ASC;
        `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch transactions summary");
      return reply.code(500).send({ message: "Gagal memuat summary transaksi" });
    }
  });

  fastify.get("/transactions-inquiry", async (request, reply) => {
    const limitRaw = request.query?.limit;
    const limit = limitRaw != null && String(limitRaw).trim() !== "" ? parseLimit(limitRaw, 500) : null;
    const from = String(request.query?.from || "").trim();
    const to = String(request.query?.to || "").trim();
    const status = String(request.query?.status || "").trim();
    const method = String(request.query?.method || "").trim();
    const cashierRaw = String(request.query?.cashier || "").trim();
    const search = String(request.query?.search || "").trim().toLowerCase();
    try {
      const req = pool.request();
      if (limit != null) req.input("limit", sql.Int, limit);
      const whereParts = [];
      if (from) {
        req.input("from", sql.Date, from);
        whereParts.push("CONVERT(date, t.created_at) >= @from");
      }
      if (to) {
        req.input("to", sql.Date, to);
        whereParts.push("CONVERT(date, t.created_at) <= @to");
      }
      if (status) {
        req.input("status", sql.VarChar(50), status);
        whereParts.push("t.status = @status");
      }
      if (method) {
        req.input("method", sql.VarChar(100), method);
        whereParts.push("t.method = @method");
      }
      if (cashierRaw) {
        const cashiers = cashierRaw
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        if (cashiers.length) {
          cashiers.forEach((value, idx) => req.input(`cashier${idx}`, sql.VarChar(100), value));
          const cashierParams = cashiers.map((_, idx) => `@cashier${idx}`).join(", ");
          whereParts.push(`t.cashier_name IN (${cashierParams})`);
        }
      }
      if (search) {
        req.input("term", sql.VarChar(200), `%${search}%`);
        whereParts.push(`
          (
            LOWER(ISNULL(CAST(t.central_trx_code AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.source_trx_code AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.cashier_name AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.customer_name AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.customer_phone AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.method AS varchar(200)), '')) LIKE @term
          )
        `);
      }
      const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

      const topClause = limit != null ? "TOP (@limit)" : "";
      const res = await req.query(`
        WITH promo_discount AS (
          SELECT
            pu.central_trx_code,
            SUM(
              CASE
                WHEN UPPER(ISNULL(p.jenis_sumber, '')) IN ('DISTRIBUTOR', 'DIST', 'DISTRIBUSI')
                  THEN ISNULL(pu.discount, 0)
                ELSE 0
              END
            ) AS diskon_distributor,
            SUM(
              CASE
                WHEN UPPER(ISNULL(p.jenis_sumber, '')) IN ('DISTRIBUTOR', 'DIST', 'DISTRIBUSI')
                  THEN 0
                ELSE ISNULL(pu.discount, 0)
              END
            ) AS diskon_principle
          FROM dbo.pos_promo_usage_central pu
          LEFT JOIN dbo.GWEN_t_promosi p
            ON p.kode_t_promosi = pu.promo_code
          GROUP BY pu.central_trx_code
        )
        SELECT ${topClause}
          t.created_at,
          t.central_trx_code,
          t.source_trx_code,
          t.cashier_name,
          t.customer_name,
          t.method,
          t.subtotal AS penjualan_total,
          t.fee_amount AS charge_transaksi,
          ISNULL(promo.diskon_principle, 0) AS diskon_principle,
          ISNULL(promo.diskon_distributor, 0) AS diskon_distributor,
          CAST(0 AS DECIMAL(18, 2)) AS retur,
          t.manual_discount AS diskon_manual,
          t.total AS total_bersih,
          t.status,
          audit.audit_status
        FROM dbo.pos_transactions_central t
        LEFT JOIN promo_discount promo
          ON promo.central_trx_code = t.central_trx_code
        OUTER APPLY (
          SELECT TOP 1
            a.audit_status
          FROM dbo.pos_transactions_central_audit a
          WHERE a.central_trx_code = t.central_trx_code
          ORDER BY a.audited_at DESC, a.id DESC
        ) audit
        ${whereClause}
        ORDER BY t.created_at DESC, t.central_trx_code DESC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch transactions inquiry");
      return reply.code(500).send({ message: "Gagal memuat inquiry transaksi" });
    }
  });

  fastify.get("/transactions-inquiry-options", async (_request, reply) => {
    try {
      const res = await pool.request().query(`
        SET NOCOUNT ON;
        SELECT DISTINCT LTRIM(RTRIM(cashier_name)) AS cashier_name
        FROM dbo.pos_transactions_central
        WHERE cashier_name IS NOT NULL AND LTRIM(RTRIM(cashier_name)) <> ''
        ORDER BY cashier_name ASC;

        SELECT DISTINCT LTRIM(RTRIM(method)) AS method
        FROM dbo.pos_transactions_central
        WHERE method IS NOT NULL AND LTRIM(RTRIM(method)) <> ''
        ORDER BY method ASC;
      `);
      const cashiers =
        res.recordsets?.[0]?.map((row) => row.cashier_name).filter(Boolean) ?? [];
      const methods =
        res.recordsets?.[1]?.map((row) => row.method).filter(Boolean) ?? [];
      return reply.send({ cashiers, methods });
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch transactions inquiry options");
      return reply.code(500).send({ message: "Gagal memuat opsi inquiry transaksi" });
    }
  });

  fastify.get("/transactions-detail-export", async (request, reply) => {
    const from = String(request.query?.from || "").trim();
    const to = String(request.query?.to || "").trim();
    const trx = String(request.query?.trx || "").trim();
    const cashierRaw = String(request.query?.cashier || "").trim();
    const method = String(request.query?.method || "").trim();
    const status = String(request.query?.status || "").trim();
    const sortTotal = String(request.query?.sort_total || "").trim().toLowerCase();
    const search = String(request.query?.search || "").trim().toLowerCase();

    const cashiers = cashierRaw
      ? cashierRaw
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    try {
      let dateRange = null;
      if (!trx || from || to) {
        dateRange = normalizeDateRange({
          from,
          to,
          defaultDays: 30,
          maxSpanDays: 93,
        });
        if (dateRange.error) {
          return reply.code(400).send({ message: dateRange.error });
        }
      }

      const req = pool.request();
      const whereParts = [];

      if (trx) {
        req.input("trx", sql.VarChar(100), trx);
        whereParts.push("t.central_trx_code = @trx");
      }
      if (dateRange) {
        req.input("from", sql.Date, dateRange.from);
        req.input("to", sql.Date, dateRange.to);
        whereParts.push("CONVERT(date, t.created_at) >= @from");
        whereParts.push("CONVERT(date, t.created_at) <= @to");
      }
      if (cashiers.length > 0) {
        cashiers.forEach((value, idx) => {
          req.input(`cashier${idx}`, sql.VarChar(100), value);
        });
        const cashierParams = cashiers.map((_, idx) => `@cashier${idx}`).join(", ");
        whereParts.push(`t.cashier_name IN (${cashierParams})`);
      }
      if (method) {
        req.input("method", sql.VarChar(50), method);
        whereParts.push("t.method = @method");
      }
      if (status) {
        req.input("status", sql.VarChar(50), status);
        whereParts.push("t.status = @status");
      }
      if (search) {
        req.input("term", sql.VarChar(200), `%${search}%`);
        whereParts.push(`
          (
            LOWER(ISNULL(CAST(t.central_trx_code AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.source_trx_code AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.uniq_code AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.source_kasir AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.cashier_name AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.customer_name AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.customer_id AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.customer_phone AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.method AS varchar(200)), '')) LIKE @term OR
            LOWER(ISNULL(CAST(t.status AS varchar(200)), '')) LIKE @term
          )
        `);
      }

      const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
      const orderClause =
        sortTotal === "asc"
          ? "ORDER BY t.total ASC, t.created_at ASC, t.central_trx_code ASC, i.id ASC"
          : sortTotal === "desc"
          ? "ORDER BY t.total DESC, t.created_at ASC, t.central_trx_code ASC, i.id ASC"
          : "ORDER BY t.created_at ASC, t.central_trx_code ASC, i.id ASC";

      const res = await req.query(`
        WITH promo_codes AS (
          SELECT
            central_trx_code,
            STRING_AGG(promo_code, ', ') WITHIN GROUP (ORDER BY promo_code) AS promo_codes
          FROM (
            SELECT DISTINCT central_trx_code, promo_code
            FROM dbo.pos_promo_usage_central
            WHERE promo_code IS NOT NULL AND LTRIM(RTRIM(promo_code)) <> ''
          ) p
          GROUP BY central_trx_code
        )
        SELECT
          t.central_trx_code,
          t.source_trx_code,
          t.created_at,
          t.cashier_name,
          t.customer_name,
          t.customer_phone,
          t.method,
          t.status,
          i.item_name,
          i.barcode,
          i.qty,
          i.unit_price,
          i.line_discount,
          i.line_total,
          b.kode_supplier,
          s.nama AS supplier_name,
          b.kode_merk,
          m.nama_merk AS merk_name,
          pc.promo_codes
        FROM dbo.pos_transactions_central t
        LEFT JOIN dbo.pos_transaction_items_central i
          ON i.central_trx_code = t.central_trx_code
        OUTER APPLY (
          SELECT TOP 1 v.*
          FROM dbo.m_barang_varian v
          WHERE
            LTRIM(RTRIM(i.item_code)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_varian)) COLLATE DATABASE_DEFAULT
            OR LTRIM(RTRIM(i.item_code)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_barang_variant)) COLLATE DATABASE_DEFAULT
            OR LTRIM(RTRIM(i.barcode)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.barcode_varian)) COLLATE DATABASE_DEFAULT
          ORDER BY
            CASE
              WHEN LTRIM(RTRIM(i.barcode)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.barcode_varian)) COLLATE DATABASE_DEFAULT THEN 0
              ELSE 1
            END
        ) v
        LEFT JOIN dbo.m_barang b ON v.id_barang = b.id_barang
        LEFT JOIN dbo.m_supplier s ON
          b.kode_supplier COLLATE DATABASE_DEFAULT = s.kode_supplier COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.m_merk m ON
          CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS int) END = m.id_merk
        LEFT JOIN promo_codes pc ON pc.central_trx_code = t.central_trx_code
        ${whereClause}
        ${orderClause};
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed export transactions detail");
      return reply.code(500).send({ message: "Gagal memuat detail transaksi" });
    }
  });

  fastify.get("/transaction-items", async (request, reply) => {
    const limit = parseLimit(request.query?.limit);
    try {
      const res = await pool
        .request()
        .input("limit", sql.Int, limit)
        .query(`SELECT TOP (@limit) * FROM dbo.pos_transaction_items_central;`);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch pos_transaction_items_central");
      return reply.code(500).send({ message: "Gagal memuat transaction items" });
    }
  });

  fastify.get("/transaction-items-by-trx", async (request, reply) => {
    const trxCode = String(request.query?.trx || "").trim();
    if (!trxCode) return reply.send([]);
    try {
      const res = await pool
        .request()
        .input("trx", sql.VarChar, trxCode)
        .query(`
          SELECT
            i.*,
            b.kode_supplier,
            s.nama AS supplier_name,
            b.kode_merk,
            m.nama_merk AS merk_name
          FROM dbo.pos_transaction_items_central i
          OUTER APPLY (
            SELECT TOP 1 v.*
            FROM dbo.m_barang_varian v
            WHERE
              LTRIM(RTRIM(i.item_code)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_varian)) COLLATE DATABASE_DEFAULT
              OR LTRIM(RTRIM(i.item_code)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_barang_variant)) COLLATE DATABASE_DEFAULT
              OR LTRIM(RTRIM(i.barcode)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.barcode_varian)) COLLATE DATABASE_DEFAULT
            ORDER BY
              CASE
                WHEN LTRIM(RTRIM(i.barcode)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.barcode_varian)) COLLATE DATABASE_DEFAULT THEN 0
                ELSE 1
              END
          ) v
          LEFT JOIN dbo.m_barang b ON v.id_barang = b.id_barang
          LEFT JOIN dbo.m_supplier s ON
            b.kode_supplier COLLATE DATABASE_DEFAULT = s.kode_supplier COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.m_merk m ON
            CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS int) END = m.id_merk
          WHERE i.central_trx_code = @trx
          ORDER BY i.id ASC;
        `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch transaction items by trx");
      return reply.code(500).send({ message: "Gagal memuat detail item" });
    }
  });

  fastify.get("/transaction-items-summary", async (request, reply) => {
    const supplier = String(request.query?.supplier || "").trim();
    const merk = String(request.query?.merk || "").trim();
    const from = String(request.query?.from || "").trim();
    const to = String(request.query?.to || "").trim();
    try {
      const req = pool.request();
      const dateRange = normalizeDateRange({
        from,
        to,
        defaultDays: 30,
        maxSpanDays: 93,
      });
      if (dateRange.error) {
        return reply.code(400).send({ message: dateRange.error });
      }
      const dateJoin =
        "INNER JOIN dbo.pos_transactions_central t ON t.central_trx_code = i.central_trx_code";
      req.input("from", sql.Date, dateRange.from);
      req.input("to", sql.Date, dateRange.to);
      const dateWhere =
        "WHERE CONVERT(date, t.created_at) >= @from AND CONVERT(date, t.created_at) <= @to";

      const postWhereParts = [];
      if (supplier) {
        req.input("supplier", sql.VarChar, supplier);
        postWhereParts.push("b.kode_supplier COLLATE DATABASE_DEFAULT = @supplier");
      }
      if (merk) {
        req.input("merk", sql.VarChar, merk);
        postWhereParts.push("b.kode_merk COLLATE DATABASE_DEFAULT = @merk");
      }
      const postWhere = postWhereParts.length ? `WHERE ${postWhereParts.join(" AND ")}` : "";
      const res = await req.query(`
        WITH filtered AS (
          SELECT
            LTRIM(RTRIM(i.item_code)) COLLATE DATABASE_DEFAULT AS item_code_clean,
            LTRIM(RTRIM(i.barcode)) COLLATE DATABASE_DEFAULT AS barcode_clean,
            i.item_code,
            i.barcode,
            i.item_name,
            CAST(i.qty AS int) AS qty,
            CAST(i.line_total AS decimal(18,2)) AS line_total,
            CAST(i.line_discount AS decimal(18,2)) AS line_discount
          FROM dbo.pos_transaction_items_central i
          ${dateJoin}
          ${dateWhere}
        ),
        aggregated AS (
          SELECT
            item_code_clean,
            barcode_clean,
            item_code,
            barcode,
            item_name,
            SUM(qty) AS total_qty,
            SUM(line_total) AS total_sales,
            SUM(line_discount) AS total_discount
          FROM filtered
          GROUP BY item_code_clean, barcode_clean, item_code, barcode, item_name
        ),
        var_map AS (
          SELECT
            v.id_barang,
            v.kode_barang_variant,
            v.kode_varian,
            v.barcode_varian,
            LTRIM(RTRIM(v.barcode_varian)) COLLATE DATABASE_DEFAULT AS map_key,
            0 AS priority
          FROM dbo.m_barang_varian v
          WHERE v.barcode_varian IS NOT NULL AND LTRIM(RTRIM(v.barcode_varian)) <> ''
          UNION ALL
          SELECT
            v.id_barang,
            v.kode_barang_variant,
            v.kode_varian,
            v.barcode_varian,
            LTRIM(RTRIM(v.kode_barang_variant)) COLLATE DATABASE_DEFAULT,
            1 AS priority
          FROM dbo.m_barang_varian v
          WHERE v.kode_barang_variant IS NOT NULL AND LTRIM(RTRIM(v.kode_barang_variant)) <> ''
          UNION ALL
          SELECT
            v.id_barang,
            v.kode_barang_variant,
            v.kode_varian,
            v.barcode_varian,
            LTRIM(RTRIM(v.kode_varian)) COLLATE DATABASE_DEFAULT,
            2 AS priority
          FROM dbo.m_barang_varian v
          WHERE v.kode_varian IS NOT NULL AND LTRIM(RTRIM(v.kode_varian)) <> ''
        ),
        match_candidates AS (
          SELECT
            a.*,
            m.id_barang,
            m.kode_barang_variant,
            m.kode_varian,
            m.barcode_varian,
            m.priority
          FROM aggregated a
          LEFT JOIN var_map m ON m.map_key = a.barcode_clean
          UNION ALL
          SELECT
            a.*,
            m.id_barang,
            m.kode_barang_variant,
            m.kode_varian,
            m.barcode_varian,
            m.priority
          FROM aggregated a
          LEFT JOIN var_map m ON m.map_key = a.item_code_clean
        ),
        matched AS (
          SELECT *,
            ROW_NUMBER() OVER (
              PARTITION BY item_code, barcode, item_name
              ORDER BY priority ASC
            ) AS rn
          FROM match_candidates
        )
        SELECT
          COALESCE(
            mt.kode_barang_variant COLLATE DATABASE_DEFAULT,
            mt.item_code COLLATE DATABASE_DEFAULT
          ) AS item_key,
          mt.item_code,
          mt.barcode,
          mt.item_name,
          mt.kode_barang_variant,
          b.kode_supplier,
          s.nama AS supplier_name,
          b.kode_merk,
          mk.nama_merk AS merk_name,
          COALESCE(kh.harga_1, b.harga_jual_sat_1) AS harga_jual,
          ISNULL(st.stok_toko, 0) AS stok_toko,
          ISNULL(po.qty_po_tertinggi, 0) AS qty_po_tertinggi,
          mt.total_qty,
          mt.total_sales,
          mt.total_discount
        FROM matched mt
        LEFT JOIN dbo.m_barang b ON mt.id_barang = b.id_barang
        LEFT JOIN dbo.m_supplier s ON
          b.kode_supplier COLLATE DATABASE_DEFAULT = s.kode_supplier COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.m_merk mk ON
          CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS int) END = mk.id_merk
        OUTER APPLY (
          SELECT TOP 1 harga_1, harga_3, harga_6, harga_12
          FROM dbo.m_barang_kelas_harga
          WHERE id_barang = b.id_barang AND is_active = 1
          ORDER BY berlaku_mulai DESC
        ) kh
        OUTER APPLY (
          SELECT SUM(t.stok_available) AS stok_toko
          FROM dbo.GWEN_mn_barang_toko_variant t
          WHERE t.kode_barang_variant COLLATE DATABASE_DEFAULT = mt.kode_barang_variant COLLATE DATABASE_DEFAULT
        ) st
        OUTER APPLY (
          SELECT MAX(ISNULL(d.qty, 0)) AS qty_po_tertinggi
          FROM dbo.GWEN_d_pengadaan d
          WHERE d.kode_barang_variant COLLATE DATABASE_DEFAULT = mt.kode_barang_variant COLLATE DATABASE_DEFAULT
        ) po
        WHERE mt.rn = 1
        ${postWhere ? `AND ${postWhere.replace(/^WHERE\s+/i, "")}` : ""}
        ORDER BY mt.total_qty DESC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch transaction items summary");
      return reply.code(500).send({ message: "Gagal memuat transaksi per item" });
    }
  });

  fastify.get("/transaction-items-detail", async (request, reply) => {
    const itemKey = String(request.query?.item_key || "").trim();
    const from = String(request.query?.from || "").trim();
    const to = String(request.query?.to || "").trim();
    if (!itemKey) return reply.send([]);
    try {
      const dateRange = normalizeDateRange({
        from,
        to,
        defaultDays: 30,
        maxSpanDays: 93,
      });
      if (dateRange.error) {
        return reply.code(400).send({ message: dateRange.error });
      }
      const req = pool
        .request()
        .input("item_key", sql.VarChar, itemKey)
        .input("from", sql.Date, dateRange.from)
        .input("to", sql.Date, dateRange.to);
      const whereParts = [
        "COALESCE(v.kode_barang_variant COLLATE DATABASE_DEFAULT, i.item_code COLLATE DATABASE_DEFAULT) = @item_key",
        "CONVERT(date, t.created_at) BETWEEN @from AND @to",
      ];
      const where = `WHERE ${whereParts.join(" AND ")}`;
      const res = await req.query(`
        SELECT
          t.central_trx_code,
          t.created_at,
          t.status,
          t.customer_name,
          i.qty,
          i.line_total,
          i.line_discount
        FROM dbo.pos_transaction_items_central i
        OUTER APPLY (
          SELECT TOP 1 v.*
          FROM dbo.m_barang_varian v
          WHERE
            LTRIM(RTRIM(i.item_code)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_varian)) COLLATE DATABASE_DEFAULT
            OR LTRIM(RTRIM(i.item_code)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_barang_variant)) COLLATE DATABASE_DEFAULT
            OR LTRIM(RTRIM(i.barcode)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.barcode_varian)) COLLATE DATABASE_DEFAULT
          ORDER BY
            CASE
              WHEN LTRIM(RTRIM(i.barcode)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.barcode_varian)) COLLATE DATABASE_DEFAULT THEN 0
              ELSE 1
            END
        ) v
        INNER JOIN dbo.pos_transactions_central t
          ON t.central_trx_code = i.central_trx_code
        ${where}
        ORDER BY t.created_at ASC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch transaction items detail");
      return reply.code(500).send({ message: "Gagal memuat detail transaksi item" });
    }
  });

  fastify.post("/transactions-audit", async (request, reply) => {
    const body = request.body || {};
    const trxCode = String(body.trx_code || "").trim();
    const auditStatus = String(body.audit_status || "").trim().toUpperCase();
    const auditNote = body.audit_note ? String(body.audit_note).trim() : null;
    const auditedBy = body.audited_by ? String(body.audited_by).trim() : null;
    const sourcePage = body.source_page ? String(body.source_page).trim() : null;

    if (!trxCode) {
      return reply.code(400).send({ message: "trx_code wajib diisi" });
    }
    if (!auditStatus || !["SESUAI", "TIDAK_SESUAI"].includes(auditStatus)) {
      return reply.code(400).send({ message: "audit_status tidak valid" });
    }

    try {
      const req = pool.request();
      req.input("trx_code", sql.VarChar(100), trxCode);
      req.input("audit_status", sql.VarChar(20), auditStatus);
      req.input("audit_note", sql.NVarChar(500), auditNote);
      req.input("audited_by", sql.VarChar(100), auditedBy);
      req.input("source_page", sql.VarChar(100), sourcePage);
      await req.query(`
        INSERT INTO dbo.pos_transactions_central_audit (
          central_trx_code, audit_status, audit_note, audited_by, audited_at, source_page
        )
        VALUES (
          @trx_code, @audit_status, @audit_note, @audited_by, GETDATE(), @source_page
        );
      `);
      return reply.send({ ok: true });
    } catch (err) {
      fastify.log.error({ err }, "Failed save transactions audit");
      return reply.code(500).send({ message: "Gagal simpan audit" });
    }
  });

  fastify.get("/suppliers", async (request, reply) => {
    try {
      const res = await pool
        .request()
        .query(
          `SELECT kode_supplier, nama FROM dbo.m_supplier WHERE kode_supplier IS NOT NULL AND kode_supplier <> '' ORDER BY nama;`
        );
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch suppliers");
      return reply.code(500).send({ message: "Gagal memuat supplier" });
    }
  });

  fastify.get("/merks", async (request, reply) => {
    try {
      const res = await pool
        .request()
        .query(
          `SELECT CAST(id_merk AS varchar) AS kode_merk, nama_merk FROM dbo.m_merk WHERE id_merk IS NOT NULL ORDER BY nama_merk;`
        );
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch merks");
      return reply.code(500).send({ message: "Gagal memuat merk" });
    }
  });

  fastify.get("/promo-usage", async (request, reply) => {
    const limit = parseLimit(request.query?.limit);
    try {
      const res = await pool
        .request()
        .input("limit", sql.Int, limit)
        .query(`SELECT TOP (@limit) * FROM dbo.pos_promo_usage_central;`);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch pos_promo_usage_central");
      return reply.code(500).send({ message: "Gagal memuat promo usage" });
    }
  });

  fastify.get("/promo-program-options", async (request, reply) => {
    const kodeSupplier = String(request.query?.kode_supplier || "").trim();
    try {
      const reqDb = pool.request();
      if (kodeSupplier) reqDb.input("kode_supplier", sql.VarChar(100), kodeSupplier);
      const whereClause = kodeSupplier
        ? `WHERE EXISTS (
            SELECT 1
            FROM dbo.GWEN_d_promosi_rule_item ri
            JOIN dbo.GWEN_d_promosi_rule_group rg ON rg.kode_d_rule_group = ri.kode_d_rule_group
            JOIN dbo.m_barang_varian v ON v.kode_barang_variant = ri.kode_barang_variant
            JOIN dbo.m_barang b ON b.id_barang = v.id_barang
            WHERE rg.kode_t_promosi = p.kode_t_promosi
              AND b.kode_supplier = @kode_supplier
          )
          AND p.status_approval = 1`
        : "";
      const res = await reqDb.query(
        `
        SELECT DISTINCT
          p.kode_t_promosi,
          p.nama_promosi,
          p.budget_total,
          p.valid_from,
          p.valid_to
        FROM dbo.GWEN_t_promosi p
        ${whereClause || "WHERE p.status_approval = 1"}
        ORDER BY p.nama_promosi ASC, p.kode_t_promosi ASC;
        `
      );
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch promo program options");
      return reply.code(500).send({ message: "Gagal memuat program promosi" });
    }
  });

  fastify.get("/promo-usage-report", async (request, reply) => {
    const kodeSupplier = String(request.query?.kode_supplier || "").trim();
    const kodePromosi = String(request.query?.kode_promosi || "").trim();
    const dateFrom = String(request.query?.from || "").trim();
    const dateTo = String(request.query?.to || "").trim();
    if (!kodeSupplier && !kodePromosi) {
      return reply.code(400).send({ message: "kode_supplier atau kode_promosi wajib diisi" });
    }
    try {
      const dateRange = normalizeDateRange({
        from: dateFrom,
        to: dateTo,
        defaultDays: 30,
        maxSpanDays: 93,
      });
      if (dateRange.error) {
        return reply.code(400).send({ message: dateRange.error });
      }
      const reqDb = pool.request();
      if (kodeSupplier) reqDb.input("kode_supplier", sql.VarChar(100), kodeSupplier);
      if (kodePromosi) reqDb.input("kode_promosi", sql.VarChar(50), kodePromosi);
      reqDb.input("from", sql.Date, dateRange.from);
      reqDb.input("to", sql.Date, dateRange.to);

      const supplierFilter = kodeSupplier ? "AND b.kode_supplier = @kode_supplier" : "";
      const promoFilterItems = kodePromosi ? "AND pi.promo_code = @kode_promosi" : "";
      const promoFilterSummary = kodePromosi ? "AND mapped.promo_code = @kode_promosi" : "";
      const dateFilterItems =
        "AND CONVERT(date, p.created_at) >= @from AND CONVERT(date, p.created_at) <= @to";

      const itemsRes = await reqDb.query(
        `
        WITH promo_items AS (
          SELECT
            LTRIM(RTRIM(p.promo_code)) AS promo_code,
            p.source_trx_code,
            p.central_trx_code,
            LTRIM(RTRIM(p.kode_barang_variant)) AS kode_barang_variant,
            LTRIM(RTRIM(p.item_code)) AS item_code,
            LTRIM(RTRIM(p.barcode)) AS barcode,
            p.item_name,
            COALESCE(
              NULLIF(LTRIM(RTRIM(p.kode_barang_variant)), ''),
              NULLIF(LTRIM(RTRIM(p.item_code)), ''),
              NULLIF(LTRIM(RTRIM(p.barcode)), '')
            ) AS item_key,
            CAST(p.qty AS int) AS qty,
            CAST(p.unit_price AS decimal(18,2)) AS unit_price,
            CAST(p.discount AS decimal(18,2)) AS line_discount,
            p.created_at
          FROM dbo.pos_transaction_item_promos_central p
          WHERE ISNULL(p.is_active, 1) = 1
            ${dateFilterItems}
        ),
        benefit_map AS (
          SELECT
            kode_t_promosi,
            MAX(CASE WHEN diskon_persen IS NOT NULL AND diskon_persen > 0 THEN diskon_persen END) AS diskon_persen,
            MAX(CASE WHEN diskon_nominal IS NOT NULL AND diskon_nominal > 0 THEN diskon_nominal END) AS diskon_nominal
          FROM dbo.GWEN_d_promosi_benefit
          GROUP BY kode_t_promosi
        )
        SELECT
          pi.item_key,
          pi.item_name,
          pi.unit_price,
          CONVERT(varchar(19), MIN(pi.created_at), 120) AS trx_first_at,
          CONVERT(varchar(19), MAX(pi.created_at), 120) AS trx_last_at,
          STRING_AGG(
            CAST(COALESCE(NULLIF(LTRIM(RTRIM(pi.source_trx_code)), ''), pi.central_trx_code) AS NVARCHAR(MAX)),
            ', '
          ) WITHIN GROUP (ORDER BY COALESCE(NULLIF(LTRIM(RTRIM(pi.source_trx_code)), ''), pi.central_trx_code)) AS trx_codes,
          SUM(pi.qty) AS qty,
          SUM(pi.line_discount) AS total_discount,
          CASE
            WHEN ISNULL(SUM(pi.qty), 0) > 0 THEN ROUND(ISNULL(SUM(pi.line_discount), 0) / SUM(pi.qty), 2)
            ELSE 0
          END AS promo_discount_per_item,
          bm.diskon_persen,
          bm.diskon_nominal
        FROM promo_items pi
        LEFT JOIN benefit_map bm
          ON bm.kode_t_promosi = pi.promo_code
        OUTER APPLY (
          SELECT TOP 1 v.*
          FROM dbo.m_barang_varian v
          WHERE
            (pi.kode_barang_variant IS NOT NULL AND LTRIM(RTRIM(pi.kode_barang_variant)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_barang_variant)) COLLATE DATABASE_DEFAULT)
            OR LTRIM(RTRIM(pi.item_code)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_varian)) COLLATE DATABASE_DEFAULT
            OR LTRIM(RTRIM(pi.item_code)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_barang_variant)) COLLATE DATABASE_DEFAULT
            OR LTRIM(RTRIM(pi.barcode)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.barcode_varian)) COLLATE DATABASE_DEFAULT
          ORDER BY
            CASE
              WHEN pi.kode_barang_variant IS NOT NULL AND LTRIM(RTRIM(pi.kode_barang_variant)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_barang_variant)) COLLATE DATABASE_DEFAULT THEN 0
              WHEN LTRIM(RTRIM(pi.barcode)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.barcode_varian)) COLLATE DATABASE_DEFAULT THEN 1
              ELSE 2
            END
        ) v
        LEFT JOIN dbo.m_barang b ON v.id_barang = b.id_barang
        WHERE 1=1
          ${promoFilterItems}
          ${supplierFilter}
        GROUP BY
          pi.promo_code,
          pi.item_key,
          pi.item_name,
          pi.unit_price,
          bm.diskon_persen,
          bm.diskon_nominal
        ORDER BY MAX(pi.created_at) DESC;
        `
      );

      const summaryRes = await reqDb.query(
        `
        WITH promo_items AS (
          SELECT
            LTRIM(RTRIM(p.promo_code)) AS promo_code,
            COALESCE(NULLIF(LTRIM(RTRIM(p.source_trx_code)), ''), p.central_trx_code) AS trx_code,
            LTRIM(RTRIM(p.kode_barang_variant)) AS kode_barang_variant,
            LTRIM(RTRIM(p.item_code)) AS item_code,
            LTRIM(RTRIM(p.barcode)) AS barcode,
            CAST(p.qty AS int) AS qty,
            CAST(p.discount AS decimal(18,2)) AS line_discount,
            p.created_at
          FROM dbo.pos_transaction_item_promos_central p
          WHERE ISNULL(p.is_active, 1) = 1
            ${dateFilterItems}
        ),
        mapped AS (
          SELECT
            pi.trx_code,
            pi.qty,
            pi.line_discount,
            pi.promo_code,
            v.id_barang
          FROM promo_items pi
          OUTER APPLY (
            SELECT TOP 1 v.*
            FROM dbo.m_barang_varian v
            WHERE
              (pi.kode_barang_variant IS NOT NULL AND LTRIM(RTRIM(pi.kode_barang_variant)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_barang_variant)) COLLATE DATABASE_DEFAULT)
              OR LTRIM(RTRIM(pi.item_code)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_varian)) COLLATE DATABASE_DEFAULT
              OR LTRIM(RTRIM(pi.item_code)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_barang_variant)) COLLATE DATABASE_DEFAULT
              OR LTRIM(RTRIM(pi.barcode)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.barcode_varian)) COLLATE DATABASE_DEFAULT
            ORDER BY
              CASE
                WHEN pi.kode_barang_variant IS NOT NULL AND LTRIM(RTRIM(pi.kode_barang_variant)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.kode_barang_variant)) COLLATE DATABASE_DEFAULT THEN 0
                WHEN LTRIM(RTRIM(pi.barcode)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(v.barcode_varian)) COLLATE DATABASE_DEFAULT THEN 1
                ELSE 2
              END
          ) v
        )
        SELECT
          COUNT(DISTINCT trx_code) AS total_penggunaan,
          SUM(ISNULL(qty, 0)) AS total_qty,
          SUM(ISNULL(line_discount, 0)) AS total_nominal
        FROM mapped
        LEFT JOIN dbo.m_barang b ON mapped.id_barang = b.id_barang
        WHERE 1=1
          ${promoFilterSummary}
          ${supplierFilter};
        `
      );

      let budgetTotal = null;
      if (kodePromosi) {
        const budgetRes = await reqDb.query(
          `
          SELECT TOP 1 budget_total
          FROM dbo.GWEN_t_promosi
          WHERE kode_t_promosi = @kode_promosi;
          `
        );
        budgetTotal = Number(budgetRes.recordset?.[0]?.budget_total ?? 0);
      }
      const totalNominal = Number(summaryRes.recordset?.[0]?.total_nominal ?? 0);
      const budgetSisa = budgetTotal !== null ? Math.max(0, budgetTotal - totalNominal) : null;
      const budgetPersenSisa =
        budgetTotal && budgetTotal > 0 ? Math.max(0, Math.round((budgetSisa / budgetTotal) * 10000) / 100) : null;

      return reply.send({
        items: itemsRes.recordset || [],
        summary: {
          total_penggunaan: Number(summaryRes.recordset?.[0]?.total_penggunaan ?? 0),
          total_qty: Number(summaryRes.recordset?.[0]?.total_qty ?? 0),
          total_nominal: totalNominal,
          budget_total: budgetTotal,
          budget_sisa: budgetSisa,
          budget_persen_sisa: budgetPersenSisa,
        },
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch promo usage report");
      return reply.code(500).send({ message: "Gagal memuat laporan promosi" });
    }
  });

  fastify.get("/promo-usage-by-trx", async (request, reply) => {
    const trxCode = String(request.query?.trx || "").trim();
    if (!trxCode) return reply.send([]);
    try {
      const res = await pool
        .request()
        .input("trx", sql.VarChar, trxCode)
        .query(`
          SELECT *
          FROM dbo.pos_promo_usage_central
          WHERE central_trx_code = @trx
          ORDER BY created_at DESC;
        `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch promo usage by trx");
      return reply.code(500).send({ message: "Gagal memuat detail promo" });
    }
  });

  fastify.get("/lottery-codes", async (request, reply) => {
    const limit = parseLimit(request.query?.limit);
    try {
      const res = await pool
        .request()
        .input("limit", sql.Int, limit)
        .query(`SELECT TOP (@limit) * FROM dbo.pos_lottery_codes_central;`);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch pos_lottery_codes_central");
      return reply.code(500).send({ message: "Gagal memuat lottery codes" });
    }
  });

  fastify.get("/customer-points", async (request, reply) => {
    const limit = parseLimit(request.query?.limit);
    try {
      const res = await pool
        .request()
        .input("limit", sql.Int, limit)
        .query(`SELECT TOP (@limit) * FROM dbo.pos_customer_points_history;`);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch pos_customer_points_history");
      return reply.code(500).send({ message: "Gagal memuat customer points" });
    }
  });

  fastify.get("/lottery-codes-by-trx", async (request, reply) => {
    const trxCode = String(request.query?.trx || "").trim();
    if (!trxCode) return reply.send([]);
    try {
      const res = await pool
        .request()
        .input("trx", sql.VarChar, trxCode)
        .query(`
          SELECT *
          FROM dbo.pos_lottery_codes_central
          WHERE central_trx_code = @trx
          ORDER BY id ASC;
        `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch lottery codes by trx");
      return reply.code(500).send({ message: "Gagal memuat kode undian" });
    }
  });
}
