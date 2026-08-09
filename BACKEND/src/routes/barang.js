import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export default async function barangRoutes(fastify) {
  const { sql, pool } = fastify.mssql;
  const nowIso = () => new Date();

  const generateDocCode = async ({ prefix, tx, userCode = "88", branchCode = "GW", padLength = 5, separator = "." }) => {
    const req = tx ? new sql.Request(tx) : pool.request();
    req.input("Prefix", sql.VarChar(10), prefix);
    req.input("ExecDate", sql.Date, new Date());
    req.input("UserCode", sql.Char(2), userCode);
    req.input("BranchCode", sql.Char(2), branchCode);
    req.input("PadLength", sql.Int, padLength);
    req.input("Separator", sql.Char(1), separator);
    req.output("NextNo", sql.Int);
    req.output("GeneratedCode", sql.VarChar(50));
    const result = await req.execute("dbo.GWEN_GenerateDocCode");
    return result.output.GeneratedCode;
  };

  const generateKode = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    return `BRG.${yy}${mm}${dd}${hh}${mi}${ss}${ms}`;
  };

  const generateVarianKode = () => {
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    return `BGV.${rand}`;
  };

  const parseNumberSafe = (val) => {
    const num = Number(val);
    if (Number.isNaN(num)) return 0;
    return num;
  };

  const insertAuditBarang = async (tx, payload) => {
    const req = tx ? new sql.Request(tx) : pool.request();
    req.input("id_barang", sql.Int, payload.id_barang ?? null);
    req.input("kode_barang", sql.VarChar(100), payload.kode_barang ?? null);
    req.input("aksi", sql.VarChar(20), payload.aksi);
    req.input("before_json", sql.VarChar(sql.MAX), payload.before ? JSON.stringify(payload.before) : null);
    req.input("after_json", sql.VarChar(sql.MAX), payload.after ? JSON.stringify(payload.after) : null);
    req.input("changed_by", sql.VarChar(100), payload.changed_by ?? null);
    req.input("source", sql.VarChar(100), payload.source ?? "API");
    req.input("catatan", sql.VarChar(255), payload.catatan ?? null);
    await req.query(`
      INSERT INTO dbo.GWEN_audit_barang (
        id_barang, kode_barang, aksi, before_json, after_json, changed_by, source, catatan
      )
      VALUES (
        @id_barang, @kode_barang, @aksi, @before_json, @after_json, @changed_by, @source, @catatan
      );
    `);
  };

  const insertAuditVarian = async (tx, payload) => {
    const req = tx ? new sql.Request(tx) : pool.request();
    req.input("id_barang", sql.Int, payload.id_barang ?? null);
    req.input("kode_barang", sql.VarChar(100), payload.kode_barang ?? null);
    req.input("kode_barang_variant", sql.VarChar(50), payload.kode_barang_variant ?? null);
    req.input("aksi", sql.VarChar(20), payload.aksi);
    req.input("before_json", sql.VarChar(sql.MAX), payload.before ? JSON.stringify(payload.before) : null);
    req.input("after_json", sql.VarChar(sql.MAX), payload.after ? JSON.stringify(payload.after) : null);
    req.input("changed_by", sql.VarChar(100), payload.changed_by ?? null);
    req.input("source", sql.VarChar(100), payload.source ?? "API");
    req.input("catatan", sql.VarChar(255), payload.catatan ?? null);
    await req.query(`
      INSERT INTO dbo.GWEN_audit_barang_varian (
        id_barang, kode_barang, kode_barang_variant, aksi, before_json, after_json, changed_by, source, catatan
      )
      VALUES (
        @id_barang, @kode_barang, @kode_barang_variant, @aksi, @before_json, @after_json, @changed_by, @source, @catatan
      );
    `);
  };

  const syncHargaJualVarianStatus = async ({ tx, kodeBarangVariant, isActive, updatedBy }) => {
    const kode = String(kodeBarangVariant || "").trim();
    if (!kode) return;
    const activeFlag = Number(isActive ?? 0) === 1 ? 1 : 0;
    const updatedBySafe = String(updatedBy || "Admin").trim() || "Admin";
    const updatedAt = nowIso();
    const getReq = () => (tx ? new sql.Request(tx) : pool.request());

    if (activeFlag === 0) {
      const req = getReq();
      req.input("kode_barang_variant", sql.VarChar(50), kode);
      req.input("updated_by", sql.VarChar(100), updatedBySafe);
      req.input("updated_at", sql.DateTime2, updatedAt);
      await req.query(`
        UPDATE dbo.GWEN_mn_barang_harga_jual_variant
        SET is_active = 0,
            updated_by = @updated_by,
            updated_at = @updated_at
        WHERE kode_barang_variant = @kode_barang_variant
          AND ISNULL(is_active, 1) = 1;
      `);
      return;
    }

    const activeReq = getReq();
    activeReq.input("kode_barang_variant", sql.VarChar(50), kode);
    const activeRes = await activeReq.query(`
      SELECT TOP 1 kode_mn_harga_jual
      FROM dbo.GWEN_mn_barang_harga_jual_variant
      WHERE kode_barang_variant = @kode_barang_variant
        AND ISNULL(is_active, 1) = 1
      ORDER BY updated_at DESC, berlaku_mulai DESC, kode_mn_harga_jual DESC;
    `);
    if (activeRes.recordset?.length) return;

    const latestReq = getReq();
    latestReq.input("kode_barang_variant", sql.VarChar(50), kode);
    const latestRes = await latestReq.query(`
      SELECT TOP 1 kode_mn_harga_jual
      FROM dbo.GWEN_mn_barang_harga_jual_variant
      WHERE kode_barang_variant = @kode_barang_variant
      ORDER BY updated_at DESC, berlaku_mulai DESC, kode_mn_harga_jual DESC;
    `);
    const kodeMn = latestRes.recordset?.[0]?.kode_mn_harga_jual;
    if (!kodeMn) return;

    const updReq = getReq();
    updReq.input("kode_mn_harga_jual", sql.VarChar(50), kodeMn);
    updReq.input("updated_by", sql.VarChar(100), updatedBySafe);
    updReq.input("updated_at", sql.DateTime2, updatedAt);
    await updReq.query(`
      UPDATE dbo.GWEN_mn_barang_harga_jual_variant
      SET is_active = 1,
          updated_by = @updated_by,
          updated_at = @updated_at
      WHERE kode_mn_harga_jual = @kode_mn_harga_jual;
    `);
  };

  fastify.get("/template", async (_req, reply) => {
    const templatePath = path.resolve(process.cwd(), "../public/templates/Template Import Barang GWEN.xlsx");
    if (!fs.existsSync(templatePath)) {
      return reply.code(404).send({ message: "Template tidak ditemukan" });
    }
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", 'attachment; filename="Template Import Barang GWEN.xlsx"');
    return reply.send(fs.createReadStream(templatePath));
  });

  fastify.get("/", async (_req, reply) => {
    try {
      const baseRes = await pool
        .request()
        .query(
          `SELECT
            b.id_barang,
            b.kode_barang,
            b.kode_manual,
            b.nama,
            b.kode_supplier,
            b.kode_merk,
            b.kode_kategori,
            b.kode_gudang,
            b.barcode_global,
            b.satuan_1,
            b.margin_profit,
            b.buffer_stok,
            b.harga_jual_sat_1,
            b.status,
            b.is_discontinue,
            b.boleh_retur,
            b.barang_khusus,
            b.is_memiliki_varian,
            b.segmentasi_pasar,
            b.cocok_untuk,
            b.manfaat,
            b.deskripsi_produk,
            b.catatan_internal,
            b.created_by,
            b.created_at,
            b.updated_by,
            b.updated_at,
            ISNULL(st_base_toko.stok_available, 0) AS stok,
            ISNULL(st_base.buffer_min, b.buffer_stok) AS buffer_stok_agg,
            b.harga_beli_sat_1,
            b.het_sat_1,
            mm.nama_merk,
            ms.nama AS nama_supplier,
            mg.nama AS nama_gudang
          FROM dbo.m_barang b
          OUTER APPLY (
            SELECT CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS INT) END AS kode_merk_int
          ) mapm
          OUTER APPLY (
            SELECT
              SUM(s.stok_available) AS stok_available,
              MAX(s.buffer_min) AS buffer_min
            FROM dbo.mn_stok_gudang s
            WHERE s.kode_barang COLLATE DATABASE_DEFAULT = b.kode_barang COLLATE DATABASE_DEFAULT
              AND s.kode_varian = 'BASE'
          ) st_base
          OUTER APPLY (
            SELECT
              SUM(s.stok_available) AS stok_available
            FROM dbo.GWEN_mn_barang_toko_variant s
            WHERE s.kode_barang_variant COLLATE DATABASE_DEFAULT IN (
              SELECT v2.kode_barang_variant
              FROM dbo.m_barang_varian v2
              WHERE v2.id_barang = b.id_barang
                AND (v2.is_base = 1 OR v2.kode_varian = 'BASE')
            )
          ) st_base_toko
          LEFT JOIN dbo.m_merk mm ON mm.id_merk = mapm.kode_merk_int
          LEFT JOIN dbo.m_supplier ms ON b.kode_supplier COLLATE DATABASE_DEFAULT = ms.kode_supplier COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.m_gudang mg ON b.kode_gudang COLLATE DATABASE_DEFAULT = mg.kode_gudang COLLATE DATABASE_DEFAULT
          ORDER BY b.created_at DESC, b.id_barang DESC`
        );

      const mediaRes = await pool
        .request()
        .query(
          `SELECT id_media, id_barang, media_type, url_media, is_primary, urutan, created_at
           FROM dbo.m_barang_media`
        );

      const varianRes = await pool
        .request()
        .query(
          `SELECT
              v.id_varian,
              v.id_barang,
              v.nama_varian,
              v.kode_varian,
              v.kode_barang_variant,
              v.barcode_varian,
              v.warna_hex,
              v.foto_varian,
              v.is_aktif,
              v.is_base,
              v.created_by,
              v.created_at,
              v.updated_by,
              v.updated_at,
              v.harga_beli_sat_1,
              v.het_sat_1,
              ISNULL(st_toko.stok_available, 0) AS stok_available,
              ISNULL(st_toko.stok_available, 0) AS stok_toko,
              ISNULL(st_var.stok_gudang, 0) AS stok_gudang,
              ISNULL(st_var.buffer_min, 0) AS buffer_min,
              hj_off.harga_1 AS harga_jual_offline_1,
              hj_off.harga_3 AS harga_jual_offline_3,
              hj_off.harga_6 AS harga_jual_offline_6,
              hj_off.harga_12 AS harga_jual_offline_12
           FROM dbo.m_barang_varian v
           JOIN dbo.m_barang b ON b.id_barang = v.id_barang
           OUTER APPLY (
             SELECT
               SUM(ISNULL(s.stok, 0)) AS stok_gudang,
               MAX(ISNULL(s.minimum_stok, 0)) AS buffer_min
             FROM dbo.GWEN_mn_barang_gudang_variant s
             WHERE s.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
           ) st_var
           OUTER APPLY (
             SELECT
               SUM(t.stok_available) AS stok_available
             FROM dbo.GWEN_mn_barang_toko_variant t
             WHERE t.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
           ) st_toko
           OUTER APPLY (
             SELECT TOP 1
               h.harga_1,
               h.harga_3,
               h.harga_6,
               h.harga_12
             FROM dbo.GWEN_mn_barang_harga_jual_variant h
             JOIN dbo.m_kelas_harga kh ON kh.id_kelas_harga = h.id_kelas_harga
             WHERE h.kode_barang_variant = v.kode_barang_variant
               AND ISNULL(h.is_active, 1) = 1
               AND UPPER(kh.channel_code) = 'OFFLINE'
             ORDER BY h.updated_at DESC, h.berlaku_mulai DESC, h.kode_mn_harga_jual DESC
           ) hj_off
           WHERE ISNULL(v.is_aktif, 1) = 1`
        );

      const mediaByBarang = new Map();
      mediaRes.recordset?.forEach((m) => {
        if (!mediaByBarang.has(m.id_barang)) mediaByBarang.set(m.id_barang, []);
        mediaByBarang.get(m.id_barang).push(m);
      });

      const varianByBarang = new Map();
      varianRes.recordset?.forEach((v) => {
        if (!varianByBarang.has(v.id_barang)) varianByBarang.set(v.id_barang, []);
        varianByBarang.get(v.id_barang).push(v);
      });

      const result = (baseRes.recordset || []).map((row) => ({
        ...row,
        buffer_stok: row.buffer_stok_agg ?? row.buffer_stok,
        gambar_list: (mediaByBarang.get(row.id_barang) || [])
          .sort((a, b) => (a.is_primary === b.is_primary ? (a.urutan || 0) - (b.urutan || 0) : a.is_primary ? -1 : 1))
          .map((m) => m.url_media),
        variants: (varianByBarang.get(row.id_barang) || []).map((v) => ({
          nama: v.nama_varian,
          kode: v.kode_varian,
          kode_barang_variant: v.kode_barang_variant,
          barcode: v.barcode_varian,
          warna_hex: v.warna_hex,
          image: v.foto_varian,
          is_aktif: v.is_aktif,
          is_base: v.is_base,
          harga_beli_sat_1: v.harga_beli_sat_1,
          het_sat_1: v.het_sat_1,
          harga_jual_offline_1: v.harga_jual_offline_1,
          harga_jual_offline_3: v.harga_jual_offline_3,
          harga_jual_offline_6: v.harga_jual_offline_6,
          harga_jual_offline_12: v.harga_jual_offline_12,
          stok_available: v.stok_available,
          stok_toko: v.stok_toko,
          stok_gudang: v.stok_gudang,
          buffer_min: v.buffer_min,
        })),
      }));

      return reply.send(result);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch barang");
      return reply.code(500).send({ message: "Failed to fetch barang" });
    }
  });

  let cachedStockColumns;

  const resolveStockColumns = async () => {
    if (cachedStockColumns) return cachedStockColumns;
    const res = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME IN ('GWEN_mn_barang_gudang_variant','GWEN_mn_barang_toko_variant')
        AND COLUMN_NAME IN ('stok','stok_available');
    `);
    const rows = res.recordset || [];
    const hasGudangStok = rows.some(
      (row) => row.TABLE_NAME === "GWEN_mn_barang_gudang_variant" && row.COLUMN_NAME === "stok"
    );
    const hasGudangStokAvailable = rows.some(
      (row) => row.TABLE_NAME === "GWEN_mn_barang_gudang_variant" && row.COLUMN_NAME === "stok_available"
    );
    const hasTokoStokAvailable = rows.some(
      (row) => row.TABLE_NAME === "GWEN_mn_barang_toko_variant" && row.COLUMN_NAME === "stok_available"
    );
    const hasTokoStok = rows.some(
      (row) => row.TABLE_NAME === "GWEN_mn_barang_toko_variant" && row.COLUMN_NAME === "stok"
    );

    cachedStockColumns = {
      gudang: hasGudangStok ? "stok" : hasGudangStokAvailable ? "stok_available" : null,
      toko: hasTokoStokAvailable ? "stok_available" : hasTokoStok ? "stok" : null,
    };
    return cachedStockColumns;
  };

  fastify.get("/varian", async (_request, reply) => {
    try {
      const stockCols = await resolveStockColumns();
      const gudangStockSql = stockCols.gudang
        ? `SELECT SUM(sg.${stockCols.gudang}) AS stok_gudang
           FROM dbo.GWEN_mn_barang_gudang_variant sg
           WHERE sg.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT`
        : `SELECT CAST(0 AS DECIMAL(20, 2)) AS stok_gudang`;
      const tokoStockSql = stockCols.toko
        ? `SELECT SUM(st.${stockCols.toko}) AS stok_toko
           FROM dbo.GWEN_mn_barang_toko_variant st
           WHERE st.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT`
        : `SELECT CAST(0 AS DECIMAL(20, 2)) AS stok_toko`;

      const result = await pool.request().query(
        `SELECT
          v.id_varian,
          v.kode_barang_variant,
          v.nama_varian,
          v.kode_varian,
          v.barcode_varian,
          v.harga_beli_sat_1,
          v.hpp_avg_sat_1,
          v.het_sat_1 AS harga_het,
          v.is_aktif,
          b.id_barang,
          b.kode_barang,
          b.nama AS nama_barang,
          b.kode_merk,
          mk.nama_merk,
          b.kode_supplier,
          s.nama AS nama_supplier,
          lr.kode_t_request AS last_request_code,
          lr.status_request AS last_request_status,
          lr.requested_at AS last_request_at,
          hj_off.harga_1 AS harga_aktif_offline_1,
          hj_off.harga_3 AS harga_aktif_offline_3,
          hj_off.harga_6 AS harga_aktif_offline_6,
          hj_off.harga_12 AS harga_aktif_offline_12,
          hj_app.harga_1 AS harga_aktif_gwen_app_1,
          hj_app.harga_3 AS harga_aktif_gwen_app_3,
          hj_app.harga_6 AS harga_aktif_gwen_app_6,
          hj_app.harga_12 AS harga_aktif_gwen_app_12,
          hj_shopee.harga_1 AS harga_aktif_shopee_1,
          hj_shopee.harga_3 AS harga_aktif_shopee_3,
          hj_shopee.harga_6 AS harga_aktif_shopee_6,
          hj_shopee.harga_12 AS harga_aktif_shopee_12,
          hj_tiktok.harga_1 AS harga_aktif_tiktokshop_1,
          hj_tiktok.harga_3 AS harga_aktif_tiktokshop_3,
          hj_tiktok.harga_6 AS harga_aktif_tiktokshop_6,
          hj_tiktok.harga_12 AS harga_aktif_tiktokshop_12,
          ISNULL(gs.stok_gudang, 0) AS stok_gudang,
          ISNULL(ts.stok_toko, 0) AS stok_toko
        FROM dbo.m_barang_varian v
        JOIN dbo.m_barang b ON b.id_barang = v.id_barang
        LEFT JOIN dbo.m_supplier s ON s.kode_supplier COLLATE DATABASE_DEFAULT = b.kode_supplier COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.m_merk mk ON CAST(mk.id_merk AS VARCHAR(50)) = CAST(b.kode_merk AS VARCHAR(50))
        OUTER APPLY (
          SELECT TOP 1
            t.kode_t_request,
            d.status_item AS status_request,
            t.requested_at
          FROM dbo.GWEN_d_harga_jual_request d
          JOIN dbo.GWEN_t_harga_jual_request t ON t.kode_t_request = d.kode_t_request
          WHERE d.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
          ORDER BY t.requested_at DESC, t.kode_t_request DESC, d.kode_d_request DESC
        ) lr
        OUTER APPLY (
          SELECT TOP 1 h.harga_1, h.harga_3, h.harga_6, h.harga_12
          FROM dbo.GWEN_mn_barang_harga_jual_variant h
          JOIN dbo.m_kelas_harga kh ON kh.id_kelas_harga = h.id_kelas_harga
          WHERE h.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
            AND ISNULL(h.is_active, 1) = 1
            AND UPPER(kh.channel_code) = 'OFFLINE'
          ORDER BY h.updated_at DESC, h.berlaku_mulai DESC, h.kode_mn_harga_jual DESC
        ) hj_off
        OUTER APPLY (
          SELECT TOP 1 h.harga_1, h.harga_3, h.harga_6, h.harga_12
          FROM dbo.GWEN_mn_barang_harga_jual_variant h
          JOIN dbo.m_kelas_harga kh ON kh.id_kelas_harga = h.id_kelas_harga
          WHERE h.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
            AND ISNULL(h.is_active, 1) = 1
            AND UPPER(kh.channel_code) = 'GWEN_APP'
          ORDER BY h.updated_at DESC, h.berlaku_mulai DESC, h.kode_mn_harga_jual DESC
        ) hj_app
        OUTER APPLY (
          SELECT TOP 1 h.harga_1, h.harga_3, h.harga_6, h.harga_12
          FROM dbo.GWEN_mn_barang_harga_jual_variant h
          JOIN dbo.m_kelas_harga kh ON kh.id_kelas_harga = h.id_kelas_harga
          WHERE h.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
            AND ISNULL(h.is_active, 1) = 1
            AND UPPER(kh.channel_code) = 'SHOPEE'
          ORDER BY h.updated_at DESC, h.berlaku_mulai DESC, h.kode_mn_harga_jual DESC
        ) hj_shopee
        OUTER APPLY (
          SELECT TOP 1 h.harga_1, h.harga_3, h.harga_6, h.harga_12
          FROM dbo.GWEN_mn_barang_harga_jual_variant h
          JOIN dbo.m_kelas_harga kh ON kh.id_kelas_harga = h.id_kelas_harga
          WHERE h.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
            AND ISNULL(h.is_active, 1) = 1
            AND UPPER(kh.channel_code) = 'TIKTOKSHOP'
          ORDER BY h.updated_at DESC, h.berlaku_mulai DESC, h.kode_mn_harga_jual DESC
        ) hj_tiktok
        OUTER APPLY (
          ${gudangStockSql}
        ) gs
        OUTER APPLY (
          ${tokoStockSql}
        ) ts
        ORDER BY b.nama ASC, v.nama_varian ASC;`
      );
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch barang varian");
      return reply.code(500).send({ message: "Failed to fetch barang varian" });
    }
  });

  fastify.get("/supplier-options", async (_request, reply) => {
    try {
      const res = await pool.request().query(`
        SELECT
          b.kode_supplier,
          MAX(s.nama) AS nama_supplier
        FROM dbo.m_barang b
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = b.kode_supplier COLLATE DATABASE_DEFAULT
        WHERE b.kode_supplier IS NOT NULL
          AND LTRIM(RTRIM(b.kode_supplier)) <> ''
        GROUP BY b.kode_supplier
        ORDER BY MAX(s.nama), b.kode_supplier;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch supplier options");
      return reply.code(500).send({ message: "Failed to fetch supplier options" });
    }
  });

  fastify.post("/harga-beli-latest", async (request, reply) => {
    const body = request.body || {};
    const list = Array.isArray(body.kode_barang_variant_list) ? body.kode_barang_variant_list : [];
    const cleaned = list.map((v) => String(v || "").trim()).filter(Boolean);
    if (cleaned.length === 0) {
      return reply.send([]);
    }
    try {
      const req = pool.request();
      const params = cleaned.map((_, idx) => `@kode_${idx}`);
      cleaned.forEach((val, idx) => {
        req.input(`kode_${idx}`, sql.VarChar(50), val);
      });
      const res = await req.query(
        `
        WITH ranked AS (
          SELECT
            h.kode_barang_variant,
            h.harga_beli_sat_1,
            h.catatan,
            ROW_NUMBER() OVER (
              PARTITION BY h.kode_barang_variant
              ORDER BY h.created_at DESC, h.id DESC
            ) AS rn
          FROM dbo.GWEN_h_harga_beli_barang h
          WHERE h.kode_barang_variant IN (${params.join(",")})
        )
        SELECT
          kode_barang_variant,
          harga_beli_sat_1,
          catatan
        FROM ranked
        WHERE rn = 1;
        `
      );
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch latest harga beli");
      return reply.code(500).send({ message: "Failed fetch latest harga beli" });
    }
  });

  fastify.post("/varian/sync-harga-beli", async (request, reply) => {
    const body = request.body || {};
    const updatedBy = String(body.updated_by || "Admin").trim() || "Admin";
    const now = new Date();

    try {
      const res = await pool
        .request()
        .input("updated_by", sql.VarChar(100), updatedBy)
        .input("updated_at", sql.DateTime2, now)
        .query(
          `
          DECLARE @updated TABLE (
            kode_barang_variant VARCHAR(50),
            kode_barang VARCHAR(100),
            harga_beli_sat_1 DECIMAL(20, 2),
            kode_t_pengadaan VARCHAR(255),
            kode_d_pengadaan VARCHAR(255)
          );

          WITH latest_pengadaan AS (
            SELECT
              d.kode_barang_variant,
              d.harga_beli,
              d.kode_t_pengadaan,
              d.kode_d_pengadaan,
              ROW_NUMBER() OVER (
                PARTITION BY d.kode_barang_variant
                ORDER BY t.created_at DESC, t.tgl DESC, d.created_at DESC, d.kode_d_pengadaan DESC
              ) AS rn
            FROM dbo.GWEN_d_pengadaan d
            JOIN dbo.GWEN_t_pengadaan t ON t.kode_t_pengadaan = d.kode_t_pengadaan
            WHERE d.kode_barang_variant IS NOT NULL
              AND ISNULL(d.harga_beli, 0) > 0
          )
          UPDATE v
          SET
            v.harga_beli_sat_1 = lp.harga_beli,
            v.updated_by = @updated_by,
            v.updated_at = @updated_at
          OUTPUT
            inserted.kode_barang_variant,
            b.kode_barang,
            inserted.harga_beli_sat_1,
            lp.kode_t_pengadaan,
            lp.kode_d_pengadaan
          INTO @updated (
            kode_barang_variant,
            kode_barang,
            harga_beli_sat_1,
            kode_t_pengadaan,
            kode_d_pengadaan
          )
          FROM dbo.m_barang_varian v
          JOIN latest_pengadaan lp
            ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = lp.kode_barang_variant COLLATE DATABASE_DEFAULT
          JOIN dbo.m_barang b ON b.id_barang = v.id_barang
          WHERE lp.rn = 1
            AND ISNULL(v.harga_beli_sat_1, 0) <> ISNULL(lp.harga_beli, 0);

          SELECT
            kode_barang_variant,
            kode_barang,
            harga_beli_sat_1,
            kode_t_pengadaan,
            kode_d_pengadaan
          FROM @updated;
        `
        );

      const updatedCount = res.rowsAffected?.[0] || 0;
      const updatedRows = res.recordset || [];
      for (const row of updatedRows) {
        const kodeHistory = await generateDocCode({ prefix: "HBB" });
        await pool
          .request()
          .input("kode_h_harga_beli_barang", sql.VarChar(50), kodeHistory)
          .input("kode_barang_variant", sql.VarChar(50), row.kode_barang_variant)
          .input("kode_barang", sql.VarChar(100), row.kode_barang || null)
          .input("harga_beli_sat_1", sql.Decimal(20, 2), row.harga_beli_sat_1 || 0)
          .input("sumber", sql.VarChar(50), "SYNC_PENGADAAN")
          .input("kode_t_pengadaan", sql.VarChar(255), row.kode_t_pengadaan || null)
          .input("kode_d_pengadaan", sql.VarChar(255), row.kode_d_pengadaan || null)
          .input("catatan", sql.VarChar(255), "Sync harga beli dari pengadaan terakhir")
          .input("created_by", sql.VarChar(100), updatedBy)
          .input("created_at", sql.DateTime2, now)
          .query(
            `
            INSERT INTO dbo.GWEN_h_harga_beli_barang (
              kode_h_harga_beli_barang,
              kode_barang_variant,
              kode_barang,
              harga_beli_sat_1,
              sumber,
              kode_t_pengadaan,
              kode_d_pengadaan,
              catatan,
              created_by,
              created_at
            ) VALUES (
              @kode_h_harga_beli_barang,
              @kode_barang_variant,
              @kode_barang,
              @harga_beli_sat_1,
              @sumber,
              @kode_t_pengadaan,
              @kode_d_pengadaan,
              @catatan,
              @created_by,
              @created_at
            );
          `
          );
      }
      return reply.send({ message: "Sync harga beli selesai", updated_count: updatedCount });
    } catch (err) {
      fastify.log.error({ err }, "Failed sync harga beli varian");
      return reply.code(500).send({ message: "Gagal sync harga beli varian" });
    }
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params;
    if (!id) return reply.code(400).send({ message: "id is required" });
    try {
      const baseRes = await pool
        .request()
        .input("id_barang", sql.Int, Number(id))
        .query(
          `SELECT
            b.id_barang,
            b.kode_barang,
            b.kode_manual,
            b.nama,
            b.kode_supplier,
            b.kode_merk,
            b.kode_kategori,
            b.kode_gudang,
            b.barcode_global,
            b.satuan_1,
            b.margin_profit,
            b.buffer_stok,
            b.status,
            b.is_discontinue,
            b.boleh_retur,
            b.barang_khusus,
            b.is_memiliki_varian,
            b.segmentasi_pasar,
            b.cocok_untuk,
            b.manfaat,
            b.deskripsi_produk,
            b.catatan_internal,
            b.created_by,
            b.created_at,
            b.updated_by,
            b.updated_at,
            mm.nama_merk,
            ms.nama AS nama_supplier,
            mg.nama AS nama_gudang
          FROM dbo.m_barang b
          OUTER APPLY (
            SELECT CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS INT) END AS kode_merk_int
          ) mapm
          LEFT JOIN dbo.m_merk mm ON mm.id_merk = mapm.kode_merk_int
          LEFT JOIN dbo.m_supplier ms ON b.kode_supplier COLLATE DATABASE_DEFAULT = ms.kode_supplier COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.m_gudang mg ON b.kode_gudang COLLATE DATABASE_DEFAULT = mg.kode_gudang COLLATE DATABASE_DEFAULT
          WHERE b.id_barang = @id_barang`
        );

      if (!baseRes.recordset?.length) {
        return reply.code(404).send({ message: "Barang tidak ditemukan" });
      }

      const mediaRes = await pool
        .request()
        .input("id_barang", sql.Int, Number(id))
        .query(
          `SELECT id_media, id_barang, media_type, url_media, is_primary, urutan, created_at
           FROM dbo.m_barang_media WHERE id_barang = @id_barang`
        );

      const varianRes = await pool
        .request()
        .input("id_barang", sql.Int, Number(id))
        .query(
          `SELECT id_varian, id_barang, nama_varian, kode_varian, kode_barang_variant, barcode_varian, warna_hex,
                  foto_varian, is_aktif, created_by, created_at, updated_by, updated_at,
                  ISNULL(st_var.stok_gudang, 0) AS stok_gudang,
                  ISNULL(st_toko.stok_available, 0) AS stok_toko
           FROM dbo.m_barang_varian v
           OUTER APPLY (
             SELECT SUM(ISNULL(s.stok, 0)) AS stok_gudang
             FROM dbo.GWEN_mn_barang_gudang_variant s
             WHERE s.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
           ) st_var
           OUTER APPLY (
             SELECT SUM(t.stok_available) AS stok_available
             FROM dbo.GWEN_mn_barang_toko_variant t
             WHERE t.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
           ) st_toko
           WHERE v.id_barang = @id_barang`
        );

      const row = baseRes.recordset[0];
      const mediaList = (mediaRes.recordset || [])
        .sort((a, b) => (a.is_primary === b.is_primary ? (a.urutan || 0) - (b.urutan || 0) : a.is_primary ? -1 : 1))
        .map((m) => m.url_media);
      const variants = (varianRes.recordset || []).map((v) => ({
        nama: v.nama_varian,
        kode: v.kode_varian,
        kode_barang_variant: v.kode_barang_variant,
        barcode: v.barcode_varian,
        warna_hex: v.warna_hex,
        image: v.foto_varian,
        is_aktif: v.is_aktif,
        stok_gudang: v.stok_gudang ?? 0,
        stok_toko: v.stok_toko ?? 0,
      }));

      return reply.send({
        ...row,
        gambar_list: mediaList,
        variants,
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch barang detail");
      return reply.code(500).send({ message: "Failed to fetch barang" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const now = nowIso();

    if (!body.nama || !body.kode_manual) {
      return reply.code(400).send({ message: "nama dan kode_manual wajib diisi" });
    }

    const kodeBarang = body.kode_barang?.trim() || generateKode();
    const tx = new sql.Transaction(pool);

    try {
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

      const req = new sql.Request(tx);
      req.input("kode_barang", sql.VarChar(100), kodeBarang);
      req.input("kode_manual", sql.VarChar(100), body.kode_manual || null);
      req.input("nama", sql.VarChar(255), body.nama);
      req.input("kode_supplier", sql.VarChar(100), body.kode_supplier || null);
      req.input("kode_merk", sql.VarChar(100), body.kode_merk || null);
      req.input("kode_kategori", sql.VarChar(100), body.kode_kategori || null);
      req.input("kode_gudang", sql.VarChar(100), body.kode_gudang || null);
      req.input("barcode_global", sql.VarChar(255), body.barcode_global || null);
      req.input("satuan_1", sql.VarChar(50), body.satuan_1 || null);
      req.input("margin_profit", sql.Decimal(18, 2), body.margin_profit ?? 0);
      req.input("buffer_stok", sql.Int, body.buffer_stok ?? 0);
      req.input("status", sql.Int, body.status ?? 1);
      req.input("is_discontinue", sql.Int, body.is_discontinue ?? 0);
      req.input("boleh_retur", sql.Int, body.boleh_retur ?? 1);
      req.input("barang_khusus", sql.Int, mapBarangKhusus(body.barang_khusus));
      req.input("is_memiliki_varian", sql.Int, body.is_memiliki_varian ?? 0);
      req.input("segmentasi_pasar", sql.VarChar(sql.MAX), body.segmentasi_pasar || null);
      req.input("cocok_untuk", sql.VarChar(sql.MAX), body.cocok_untuk || null);
      req.input("manfaat", sql.VarChar(sql.MAX), body.manfaat || null);
      req.input("deskripsi_produk", sql.VarChar(sql.MAX), body.deskripsi_produk || body.deskripsi || null);
      req.input("catatan_internal", sql.VarChar(sql.MAX), body.catatan_internal || body.catatan || null);
      req.input("created_by", sql.VarChar(100), body.created_by || "Admin");
      req.input("created_at", sql.DateTime2, body.created_at || now);
      req.input("updated_by", sql.VarChar(100), body.updated_by || "Admin");
      req.input("updated_at", sql.DateTime2, body.updated_at || now);

      const insertBarang = await req.query(`
        DECLARE @out TABLE (id_barang BIGINT);
        INSERT INTO dbo.m_barang (
          kode_barang, kode_manual, nama, kode_supplier, kode_merk, kode_kategori,
          kode_gudang, barcode_global, satuan_1, margin_profit, buffer_stok, status,
          is_discontinue, boleh_retur, barang_khusus, is_memiliki_varian,
          segmentasi_pasar, cocok_untuk, manfaat, deskripsi_produk, catatan_internal,
          created_by, created_at, updated_by, updated_at
        )
        OUTPUT INSERTED.id_barang INTO @out(id_barang)
        VALUES (
          @kode_barang, @kode_manual, @nama, @kode_supplier, @kode_merk, @kode_kategori,
          @kode_gudang, @barcode_global, @satuan_1, @margin_profit, @buffer_stok, @status,
          @is_discontinue, @boleh_retur, @barang_khusus, @is_memiliki_varian,
          @segmentasi_pasar, @cocok_untuk, @manfaat, @deskripsi_produk, @catatan_internal,
          @created_by, @created_at, @updated_by, @updated_at
        );
        SELECT id_barang FROM @out;
      `);

      const idBarang = insertBarang.recordset?.[0]?.id_barang;
      if (!idBarang) throw new Error("Failed to create barang");

      const barangAfterRes = await new sql.Request(tx)
        .input("id_barang", sql.Int, idBarang)
        .query("SELECT * FROM dbo.m_barang WHERE id_barang = @id_barang");
      const barangAfter = barangAfterRes.recordset?.[0] || null;
      await insertAuditBarang(tx, {
        id_barang: idBarang,
        kode_barang: kodeBarang,
        aksi: "INSERT",
        before: null,
        after: barangAfter,
        changed_by: body.created_by || body.updated_by || "Admin",
      });

      const mediaList = Array.isArray(body.gambar_list) ? body.gambar_list : [];
      for (let i = 0; i < mediaList.length; i++) {
        const mReq = new sql.Request(tx);
        mReq.input("id_barang", sql.Int, idBarang);
        mReq.input("media_type", sql.VarChar(50), "image");
        mReq.input("url_media", sql.VarChar(sql.MAX), mediaList[i]);
        mReq.input("is_primary", sql.Int, i === 0 ? 1 : 0);
        mReq.input("urutan", sql.Int, i + 1);
        mReq.input("created_at", sql.DateTime2, now);
        await mReq.query(`
          INSERT INTO dbo.m_barang_media (id_barang, media_type, url_media, is_primary, urutan, created_at)
          VALUES (@id_barang, @media_type, @url_media, @is_primary, @urutan, @created_at);
        `);
      }

      let variants = Array.isArray(body.variants) ? body.variants : [];
      if (variants.length === 0) {
        variants = [
          {
            nama: body.nama,
            kode: "BASE",
            barcode: body.barcode_global || null,
            harga_beli: body.harga_beli_sat_1 ?? 0,
            het: body.het_sat_1 ?? 0,
            hpp: 0,
            is_base: 1,
          },
        ];
      }
      for (let idx = 0; idx < variants.length; idx++) {
        const variant = variants[idx];
        const variantCode =
          variant.kode ||
          variant.kode_varian ||
          `${generateVarianKode()}`;
        const kodeBarangVariant = await generateDocCode({ prefix: "BGV", tx });
        const hargaBeli = parseNumberSafe(
          variant.harga_beli ?? variant.hargaBeli ?? variant.harga_beli_sat_1 ?? 0
        );
        const het = parseNumberSafe(variant.het ?? variant.hargaHET ?? variant.het_sat_1 ?? 0);
        const hpp = 0;
        const vReq = new sql.Request(tx);
        vReq.input("id_barang", sql.Int, idBarang);
        vReq.input("nama_varian", sql.VarChar(255), variant.nama || null);
        vReq.input("kode_varian", sql.VarChar(255), variantCode);
        vReq.input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant);
        vReq.input("barcode_varian", sql.VarChar(255), variant.barcode || null);
        vReq.input("warna_hex", sql.VarChar(50), variant.warna_hex || null);
        vReq.input("foto_varian", sql.VarChar(255), variant.image || null);
        vReq.input("is_aktif", sql.Int, variant.is_aktif ?? 1);
        vReq.input("is_base", sql.Bit, variant.is_base ?? (variantCode === "BASE" ? 1 : 0));
        vReq.input("harga_beli", sql.Decimal(18, 2), hargaBeli);
        vReq.input("het", sql.Decimal(18, 2), het);
        vReq.input("hpp", sql.Decimal(18, 2), hpp);
        vReq.input("created_by", sql.VarChar(100), body.created_by || "Admin");
        vReq.input("created_at", sql.DateTime2, now);
        vReq.input("updated_by", sql.VarChar(100), body.updated_by || "Admin");
        vReq.input("updated_at", sql.DateTime2, now);

        await vReq.query(`
          INSERT INTO dbo.m_barang_varian (
            id_barang, nama_varian, kode_varian, kode_barang_variant, barcode_varian, warna_hex,
            foto_varian, is_aktif, is_base, created_by, created_at, updated_by, updated_at,
            harga_beli_sat_1, het_sat_1, hpp_avg_sat_1
          )
          VALUES (
            @id_barang, @nama_varian, @kode_varian, @kode_barang_variant, @barcode_varian, @warna_hex,
            @foto_varian, @is_aktif, @is_base, @created_by, @created_at, @updated_by, @updated_at,
            @harga_beli, @het, @hpp
          );
        `);

        const varAfterRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
          .query(
            "SELECT * FROM dbo.m_barang_varian WHERE kode_barang_variant = @kode_barang_variant"
          );
        const varAfter = varAfterRes.recordset?.[0] || null;
        await insertAuditVarian(tx, {
          id_barang: idBarang,
          kode_barang: kodeBarang,
          kode_barang_variant: kodeBarangVariant,
          aksi: "INSERT",
          before: null,
          after: varAfter,
          changed_by: body.created_by || body.updated_by || "Admin",
        });
      }

      await tx.commit();
      return reply.code(201).send({ id_barang: idBarang, kode_barang: kodeBarang });
    } catch (err) {
      await tx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed to create barang");
      return reply.code(500).send({ message: "Failed to create barang" });
    }
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};
    const now = nowIso();

    if (!id) return reply.code(400).send({ message: "id is required" });
    if (!body.nama || !body.kode_manual) {
      return reply.code(400).send({ message: "nama dan kode_manual wajib diisi" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

      const beforeBarangRes = await new sql.Request(tx)
        .input("id_barang", sql.Int, Number(id))
        .query("SELECT * FROM dbo.m_barang WHERE id_barang = @id_barang");
      const beforeBarang = beforeBarangRes.recordset?.[0] || null;

      // fetch kode_barang for default variant codes
      const kodeRes = await new sql.Request(tx)
        .input("id_barang", sql.Int, Number(id))
        .query("SELECT kode_barang FROM dbo.m_barang WHERE id_barang = @id_barang");
      const kodeBarang = kodeRes.recordset?.[0]?.kode_barang || `BRG-${id}`;

      const req = new sql.Request(tx);
      req.input("id_barang", sql.Int, Number(id));
      req.input("kode_manual", sql.VarChar(100), body.kode_manual || null);
      req.input("nama", sql.VarChar(255), body.nama);
      req.input("kode_supplier", sql.VarChar(100), body.kode_supplier || null);
      req.input("kode_merk", sql.VarChar(100), body.kode_merk || null);
      req.input("kode_kategori", sql.VarChar(100), body.kode_kategori || null);
      req.input("kode_gudang", sql.VarChar(100), body.kode_gudang || null);
      req.input("barcode_global", sql.VarChar(255), body.barcode_global || null);
      req.input("satuan_1", sql.VarChar(50), body.satuan_1 || null);
      req.input("margin_profit", sql.Decimal(18, 2), body.margin_profit ?? 0);
      req.input("buffer_stok", sql.Int, body.buffer_stok ?? 0);
      req.input("status", sql.Int, body.status ?? 1);
      req.input("is_discontinue", sql.Int, body.is_discontinue ?? 0);
      req.input("boleh_retur", sql.Int, body.boleh_retur ?? 1);
      req.input("barang_khusus", sql.Int, mapBarangKhusus(body.barang_khusus));
      req.input("is_memiliki_varian", sql.Int, body.is_memiliki_varian ?? 0);
      req.input("segmentasi_pasar", sql.VarChar(sql.MAX), body.segmentasi_pasar || null);
      req.input("cocok_untuk", sql.VarChar(sql.MAX), body.cocok_untuk || null);
      req.input("manfaat", sql.VarChar(sql.MAX), body.manfaat || null);
      req.input("deskripsi_produk", sql.VarChar(sql.MAX), body.deskripsi_produk || body.deskripsi || null);
      req.input("catatan_internal", sql.VarChar(sql.MAX), body.catatan_internal || body.catatan || null);
      req.input("updated_by", sql.VarChar(100), body.updated_by || "Admin");
      req.input("updated_at", sql.DateTime2, body.updated_at || now);

      const updateResult = await req.query(`
        UPDATE dbo.m_barang
        SET
          kode_manual = @kode_manual,
          nama = @nama,
          kode_supplier = @kode_supplier,
          kode_merk = @kode_merk,
          kode_kategori = @kode_kategori,
          kode_gudang = @kode_gudang,
          barcode_global = @barcode_global,
          satuan_1 = @satuan_1,
          margin_profit = @margin_profit,
          buffer_stok = @buffer_stok,
          status = @status,
          is_discontinue = @is_discontinue,
          boleh_retur = @boleh_retur,
          barang_khusus = @barang_khusus,
          is_memiliki_varian = @is_memiliki_varian,
          segmentasi_pasar = @segmentasi_pasar,
          cocok_untuk = @cocok_untuk,
          manfaat = @manfaat,
          deskripsi_produk = @deskripsi_produk,
          catatan_internal = @catatan_internal,
          updated_by = @updated_by,
          updated_at = @updated_at
        WHERE id_barang = @id_barang;
      `);

      if (updateResult.rowsAffected?.[0] === 0) {
        await tx.rollback();
        return reply.code(404).send({ message: "Barang tidak ditemukan" });
      }

      const afterBarangRes = await new sql.Request(tx)
        .input("id_barang", sql.Int, Number(id))
        .query("SELECT * FROM dbo.m_barang WHERE id_barang = @id_barang");
      const afterBarang = afterBarangRes.recordset?.[0] || null;
      const barangIsActive = Number(afterBarang?.status ?? 1) === 1;
      const updatedBy = body.updated_by || "Admin";
      const barangAksi =
        beforeBarang &&
        afterBarang &&
        Number(beforeBarang.status ?? 1) !== Number(afterBarang.status ?? 1) &&
        Number(afterBarang.status ?? 1) === 0
          ? "DEACTIVATE"
          : "UPDATE";
      await insertAuditBarang(tx, {
        id_barang: Number(id),
        kode_barang: kodeBarang,
        aksi: barangAksi,
        before: beforeBarang,
        after: afterBarang,
        changed_by: body.updated_by || "Admin",
      });

      // reset media & variants then recreate
      const delMediaReq = new sql.Request(tx);
      delMediaReq.input("id_barang", sql.Int, Number(id));
      await delMediaReq.query("DELETE FROM dbo.m_barang_media WHERE id_barang = @id_barang");

      const mediaList = Array.isArray(body.gambar_list) ? body.gambar_list : [];
      for (let i = 0; i < mediaList.length; i++) {
        const mReq = new sql.Request(tx);
        mReq.input("id_barang", sql.Int, Number(id));
        mReq.input("media_type", sql.VarChar(50), "image");
        mReq.input("url_media", sql.VarChar(sql.MAX), mediaList[i]);
        mReq.input("is_primary", sql.Int, i === 0 ? 1 : 0);
        mReq.input("urutan", sql.Int, i + 1);
        mReq.input("created_at", sql.DateTime2, now);
        await mReq.query(`
          INSERT INTO dbo.m_barang_media (id_barang, media_type, url_media, is_primary, urutan, created_at)
          VALUES (@id_barang, @media_type, @url_media, @is_primary, @urutan, @created_at);
        `);
      }

      const existingVarRes = await new sql.Request(tx)
        .input("id_barang", sql.Int, Number(id))
        .query(
          `SELECT kode_barang_variant, is_base
           FROM dbo.m_barang_varian
           WHERE id_barang = @id_barang`
        );
      const existingVariants = new Map(
        (existingVarRes.recordset || []).map((row) => [row.kode_barang_variant, row])
      );

      let variants = Array.isArray(body.variants) ? body.variants : [];
      if (variants.length === 0) {
        variants = [
          {
            nama: body.nama,
            kode: "BASE",
            barcode: body.barcode_global || null,
            harga_beli: body.harga_beli_sat_1 ?? 0,
            het: body.het_sat_1 ?? 0,
            hpp: body.hpp_avg_sat_1 ?? 0,
            is_base: 1,
          },
        ];
      }

      const keepKodeVariant = new Set();
      for (let idx = 0; idx < variants.length; idx++) {
        const variant = variants[idx];
        const variantCode =
          variant.kode ||
          variant.kode_varian ||
          `${generateVarianKode()}`;
        const hargaBeli = parseNumberSafe(variant.harga_beli ?? variant.hargaBeli ?? variant.harga_beli_sat_1);
        const het = parseNumberSafe(variant.het ?? variant.hargaHET ?? variant.het_sat_1);
        const hpp = 0;
        const kodeBarangVariant =
          variant.kode_barang_variant ||
          variant.kodeBarangVariant ||
          null;
        const desiredAktif = Number(variant.is_aktif ?? 1) === 1 ? 1 : 0;
        const effectiveAktif = barangIsActive ? desiredAktif : 0;

        if (kodeBarangVariant && existingVariants.has(kodeBarangVariant)) {
          keepKodeVariant.add(kodeBarangVariant);
          const beforeVarRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
            .query(
              "SELECT * FROM dbo.m_barang_varian WHERE kode_barang_variant = @kode_barang_variant"
            );
          const beforeVar = beforeVarRes.recordset?.[0] || null;
          const vReq = new sql.Request(tx);
          vReq.input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant);
          vReq.input("nama_varian", sql.VarChar(255), variant.nama || null);
          vReq.input("kode_varian", sql.VarChar(255), variantCode);
          vReq.input("barcode_varian", sql.VarChar(255), variant.barcode || null);
          vReq.input("warna_hex", sql.VarChar(50), variant.warna_hex || null);
          vReq.input("foto_varian", sql.VarChar(255), variant.image || null);
          vReq.input("is_aktif", sql.Int, variant.is_aktif ?? 1);
          vReq.input("is_base", sql.Bit, variant.is_base ?? (variantCode === "BASE" ? 1 : 0));
          vReq.input("harga_beli", sql.Decimal(18, 2), hargaBeli);
          vReq.input("het", sql.Decimal(18, 2), het);
          // HPP diupdate dari proses PO, bukan master barang
          vReq.input("updated_by", sql.VarChar(100), body.updated_by || "Admin");
          vReq.input("updated_at", sql.DateTime2, now);
          await vReq.query(`
            UPDATE dbo.m_barang_varian
            SET
              nama_varian = @nama_varian,
              kode_varian = @kode_varian,
              barcode_varian = @barcode_varian,
              warna_hex = @warna_hex,
              foto_varian = @foto_varian,
              is_aktif = @is_aktif,
              is_base = @is_base,
              harga_beli_sat_1 = COALESCE(@harga_beli, harga_beli_sat_1),
              het_sat_1 = COALESCE(@het, het_sat_1),
              updated_by = @updated_by,
              updated_at = @updated_at
            WHERE kode_barang_variant = @kode_barang_variant;
          `);
          const afterVarRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
            .query(
              "SELECT * FROM dbo.m_barang_varian WHERE kode_barang_variant = @kode_barang_variant"
            );
          const afterVar = afterVarRes.recordset?.[0] || null;
          const varAksi =
            beforeVar &&
            afterVar &&
            Number(beforeVar.is_aktif ?? 1) !== Number(afterVar.is_aktif ?? 1) &&
            Number(afterVar.is_aktif ?? 1) === 0
              ? "DEACTIVATE"
              : "UPDATE";
          await insertAuditVarian(tx, {
            id_barang: Number(id),
            kode_barang: kodeBarang,
            kode_barang_variant: kodeBarangVariant,
            aksi: varAksi,
            before: beforeVar,
            after: afterVar,
            changed_by: updatedBy,
          });
          await syncHargaJualVarianStatus({
            tx,
            kodeBarangVariant,
            isActive: effectiveAktif,
            updatedBy,
          });
          continue;
        }

        const newKodeBarangVariant = await generateDocCode({ prefix: "BGV", tx });
        keepKodeVariant.add(newKodeBarangVariant);
        const vReq = new sql.Request(tx);
        vReq.input("id_barang", sql.Int, Number(id));
        vReq.input("nama_varian", sql.VarChar(255), variant.nama || null);
        vReq.input("kode_varian", sql.VarChar(255), variantCode);
        vReq.input("kode_barang_variant", sql.VarChar(50), newKodeBarangVariant);
        vReq.input("barcode_varian", sql.VarChar(255), variant.barcode || null);
        vReq.input("warna_hex", sql.VarChar(50), variant.warna_hex || null);
        vReq.input("foto_varian", sql.VarChar(255), variant.image || null);
        vReq.input("is_aktif", sql.Int, variant.is_aktif ?? 1);
        vReq.input("is_base", sql.Bit, variant.is_base ?? (variantCode === "BASE" ? 1 : 0));
        vReq.input("harga_beli", sql.Decimal(18, 2), hargaBeli);
        vReq.input("het", sql.Decimal(18, 2), het);
        vReq.input("hpp", sql.Decimal(18, 2), hpp);
        vReq.input("created_by", sql.VarChar(100), body.updated_by || "Admin");
        vReq.input("created_at", sql.DateTime2, now);
        vReq.input("updated_by", sql.VarChar(100), body.updated_by || "Admin");
        vReq.input("updated_at", sql.DateTime2, now);

        await vReq.query(`
          INSERT INTO dbo.m_barang_varian (
            id_barang, nama_varian, kode_varian, kode_barang_variant, barcode_varian, warna_hex,
            foto_varian, is_aktif, is_base, created_by, created_at, updated_by, updated_at,
            harga_beli_sat_1, het_sat_1, hpp_avg_sat_1
          )
          VALUES (
            @id_barang, @nama_varian, @kode_varian, @kode_barang_variant, @barcode_varian, @warna_hex,
            @foto_varian, @is_aktif, @is_base, @created_by, @created_at, @updated_by, @updated_at,
            @harga_beli, @het, @hpp
          );
        `);

        const varAfterRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(50), newKodeBarangVariant)
          .query(
            "SELECT * FROM dbo.m_barang_varian WHERE kode_barang_variant = @kode_barang_variant"
          );
        const varAfter = varAfterRes.recordset?.[0] || null;
        await insertAuditVarian(tx, {
          id_barang: Number(id),
          kode_barang: kodeBarang,
          kode_barang_variant: newKodeBarangVariant,
          aksi: "INSERT",
          before: null,
          after: varAfter,
          changed_by: updatedBy,
        });
        await syncHargaJualVarianStatus({
          tx,
          kodeBarangVariant: newKodeBarangVariant,
          isActive: effectiveAktif,
          updatedBy,
        });
      }

      if (existingVariants.size > 0) {
        const toDeactivate = [...existingVariants.keys()].filter((k) => !keepKodeVariant.has(k));
        for (const kodeBarangVariant of toDeactivate) {
          const beforeVarRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
            .query(
              "SELECT * FROM dbo.m_barang_varian WHERE kode_barang_variant = @kode_barang_variant"
            );
          const beforeVar = beforeVarRes.recordset?.[0] || null;
          const vReq = new sql.Request(tx);
          vReq.input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant);
          vReq.input("updated_by", sql.VarChar(100), body.updated_by || "Admin");
          vReq.input("updated_at", sql.DateTime2, now);
          await vReq.query(`
            UPDATE dbo.m_barang_varian
            SET is_aktif = 0,
                updated_by = @updated_by,
                updated_at = @updated_at
            WHERE kode_barang_variant = @kode_barang_variant;
          `);
          const afterVarRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
            .query(
              "SELECT * FROM dbo.m_barang_varian WHERE kode_barang_variant = @kode_barang_variant"
            );
          const afterVar = afterVarRes.recordset?.[0] || null;
          await insertAuditVarian(tx, {
            id_barang: Number(id),
            kode_barang: kodeBarang,
            kode_barang_variant: kodeBarangVariant,
            aksi: "DEACTIVATE",
            before: beforeVar,
            after: afterVar,
            changed_by: updatedBy,
          });
          await syncHargaJualVarianStatus({
            tx,
            kodeBarangVariant,
            isActive: 0,
            updatedBy,
          });
        }
      }

      await tx.commit();
      return reply.send({ message: "Barang updated" });
    } catch (err) {
      await tx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed to update barang");
      return reply.code(500).send({ message: "Failed to update barang" });
    }
  });

  fastify.put("/:id/merk", async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};
    const kodeMerk = body.kode_merk || null;
    const updatedBy = body.updated_by || "Admin";
    if (!id) return reply.code(400).send({ message: "id wajib diisi" });

    try {
      const res = await pool
        .request()
        .input("id_barang", sql.Int, Number(id))
        .input("kode_merk", sql.VarChar(100), kodeMerk)
        .input("updated_by", sql.VarChar(100), updatedBy)
        .input("updated_at", sql.DateTime2, new Date())
        .query(`
          UPDATE dbo.m_barang
          SET kode_merk = @kode_merk,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE id_barang = @id_barang;
        `);
      if (res.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Barang tidak ditemukan" });
      }
      return reply.send({ message: "Merk updated" });
    } catch (err) {
      fastify.log.error({ err }, "Failed to update merk");
      return reply.code(500).send({ message: "Failed to update merk" });
    }
  });

  fastify.put("/bulk/supplier", async (request, reply) => {
    const body = request.body || {};
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const cleanedIds = ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
    const kodeSupplier = String(body.kode_supplier || "").trim();
    const updatedBy = String(body.updated_by || "Admin").trim() || "Admin";

    if (cleanedIds.length === 0) {
      return reply.code(400).send({ message: "ids wajib diisi" });
    }
    if (!kodeSupplier) {
      return reply.code(400).send({ message: "kode_supplier wajib diisi" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

      const supplierRes = await new sql.Request(tx)
        .input("kode_supplier", sql.VarChar(100), kodeSupplier)
        .query(`
          SELECT TOP (1) kode_supplier
          FROM dbo.m_supplier
          WHERE kode_supplier COLLATE DATABASE_DEFAULT = @kode_supplier COLLATE DATABASE_DEFAULT;
        `);

      if (!supplierRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Supplier tidak ditemukan" });
      }

      const req = new sql.Request(tx);
      const params = cleanedIds.map((id, idx) => {
        req.input(`id_${idx}`, sql.Int, id);
        return `@id_${idx}`;
      });
      req.input("kode_supplier", sql.VarChar(100), kodeSupplier);
      req.input("updated_by", sql.VarChar(100), updatedBy);
      req.input("updated_at", sql.DateTime2, new Date());

      const res = await req.query(`
        UPDATE dbo.m_barang
        SET kode_supplier = @kode_supplier,
            updated_by = @updated_by,
            updated_at = @updated_at
        WHERE id_barang IN (${params.join(", ")});
      `);

      await tx.commit();
      return reply.send({
        message: "Supplier barang berhasil diperbarui",
        updated_count: res.rowsAffected?.[0] || 0,
      });
    } catch (err) {
      await tx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed to bulk update supplier");
      return reply.code(500).send({ message: "Failed to bulk update supplier" });
    }
  });

  fastify.put("/varian/barcode", async (request, reply) => {
    const body = request.body || {};
    const kodeBarangVariant = String(body.kode_barang_variant || "").trim();
    const barcodeVarian = body.barcode_varian ? String(body.barcode_varian).trim() : null;
    const updatedBy = body.updated_by || "Admin";

    if (!kodeBarangVariant) {
      return reply.code(400).send({ message: "kode_barang_variant wajib diisi" });
    }

    try {
      const res = await pool
        .request()
        .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
        .input("barcode_varian", sql.VarChar(255), barcodeVarian)
        .input("updated_by", sql.VarChar(100), updatedBy)
        .input("updated_at", sql.DateTime2, new Date())
        .query(`
          UPDATE dbo.m_barang_varian
          SET barcode_varian = @barcode_varian,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT;
        `);
      if (res.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Varian tidak ditemukan" });
      }
      return reply.send({ message: "Barcode varian updated" });
    } catch (err) {
      fastify.log.error({ err }, "Failed to update barcode varian");
      return reply.code(500).send({ message: "Gagal update barcode varian" });
    }
  });

  fastify.put("/varian/nama", async (request, reply) => {
    const body = request.body || {};
    const kodeBarangVariant = String(body.kode_barang_variant || "").trim();
    const namaVarian = body.nama_varian ? String(body.nama_varian).trim() : null;
    const updatedBy = body.updated_by || "Admin";

    if (!kodeBarangVariant) {
      return reply.code(400).send({ message: "kode_barang_variant wajib diisi" });
    }

    try {
      const res = await pool
        .request()
        .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
        .input("nama_varian", sql.NVarChar(255), namaVarian)
        .input("updated_by", sql.VarChar(100), updatedBy)
        .input("updated_at", sql.DateTime2, new Date())
        .query(`
          UPDATE dbo.m_barang_varian
          SET nama_varian = @nama_varian,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT;
        `);
      if (res.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Varian tidak ditemukan" });
      }
      return reply.send({ message: "Nama varian updated" });
    } catch (err) {
      fastify.log.error({ err }, "Failed to update nama varian");
      return reply.code(500).send({ message: "Gagal update nama varian" });
    }
  });

  fastify.delete("/varian/:kodeBarangVariant", async (request, reply) => {
    const { kodeBarangVariant } = request.params;
    const body = request.body || {};
    const updatedBy = body.updated_by || "Admin";
    const kode = String(kodeBarangVariant || "").trim();
    if (!kode) {
      return reply.code(400).send({ message: "kode_barang_variant wajib diisi" });
    }

    try {
      const beforeRes = await pool
        .request()
        .input("kode_barang_variant", sql.VarChar(50), kode)
        .query("SELECT * FROM dbo.m_barang_varian WHERE kode_barang_variant = @kode_barang_variant");
      const beforeVar = beforeRes.recordset?.[0];
      if (!beforeVar) {
        return reply.code(404).send({ message: "Varian tidak ditemukan" });
      }

      const barangRes = await pool
        .request()
        .input("id_barang", sql.Int, Number(beforeVar.id_barang))
        .query("SELECT kode_barang FROM dbo.m_barang WHERE id_barang = @id_barang");
      const kodeBarang = barangRes.recordset?.[0]?.kode_barang || null;

      await pool
        .request()
        .input("kode_barang_variant", sql.VarChar(50), kode)
        .input("updated_by", sql.VarChar(100), updatedBy)
        .input("updated_at", sql.DateTime2, new Date())
        .query(`
          UPDATE dbo.m_barang_varian
          SET is_aktif = 0,
              updated_by = @updated_by,
              updated_at = @updated_at
          WHERE kode_barang_variant = @kode_barang_variant;
        `);

      const afterRes = await pool
        .request()
        .input("kode_barang_variant", sql.VarChar(50), kode)
        .query("SELECT * FROM dbo.m_barang_varian WHERE kode_barang_variant = @kode_barang_variant");
      const afterVar = afterRes.recordset?.[0] || null;

      await insertAuditVarian(null, {
        id_barang: beforeVar.id_barang ?? null,
        kode_barang: kodeBarang,
        kode_barang_variant: kode,
        aksi: "DEACTIVATE",
        before: beforeVar,
        after: afterVar,
        changed_by: updatedBy,
      });

      await syncHargaJualVarianStatus({
        tx: null,
        kodeBarangVariant: kode,
        isActive: 0,
        updatedBy,
      });

      return reply.send({ message: "Varian deactivated" });
    } catch (err) {
      fastify.log.error({ err }, "Failed to delete varian");
      return reply.code(500).send({ message: "Gagal menghapus varian" });
    }
  });

  fastify.put("/prices", async (request, reply) => {
    const body = request.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const updatedBy = body.updated_by || "Admin";

    if (items.length === 0) {
      return reply.code(400).send({ message: "items wajib diisi" });
    }

    const tx = new sql.Transaction(pool);
    const now = new Date();
    try {
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
      let updatedCount = 0;
      const notFound = [];

      for (const raw of items) {
        const kodeBarang = raw.kode_barang || raw.kodeBarang || null;
        const kodeVarian = raw.kode_varian || raw.kodeVarian || "BASE";
        const kodeBarangVariant = raw.kode_barang_variant || raw.kodeBarangVariant || null;
        const hargaBeli = parseNumberSafe(raw.harga_beli ?? raw.hargaBeli ?? raw.harga_beli_sat_1);
        const het = parseNumberSafe(raw.het ?? raw.hargaHET ?? raw.het_sat_1);

        let affectedVar = 0;
        if (kodeBarangVariant || (kodeVarian && kodeVarian !== "BASE")) {
          const varReq = new sql.Request(tx);
          if (kodeBarangVariant) varReq.input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant);
          varReq.input("kode_varian", sql.VarChar(255), kodeVarian);
          if (kodeBarang) varReq.input("kode_barang", sql.VarChar(100), kodeBarang);
          varReq.input("harga_beli", sql.Decimal(18, 2), hargaBeli);
          varReq.input("het", sql.Decimal(18, 2), het);
          varReq.input("updated_by", sql.VarChar(100), raw.updated_by || updatedBy);
          varReq.input("updated_at", sql.DateTime2, now);
          let varQuery;
          if (kodeBarangVariant) {
            varQuery = `
              UPDATE dbo.m_barang_varian
              SET harga_beli_sat_1 = @harga_beli,
                  het_sat_1 = @het,
                  updated_by = @updated_by,
                  updated_at = @updated_at
              WHERE kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT;
            `;
          } else if (kodeBarang) {
            varQuery = `
              UPDATE dbo.m_barang_varian
              SET harga_beli_sat_1 = @harga_beli,
                  het_sat_1 = @het,
                  updated_by = @updated_by,
                  updated_at = @updated_at
              WHERE kode_varian COLLATE DATABASE_DEFAULT = @kode_varian COLLATE DATABASE_DEFAULT
                AND id_barang IN (
                  SELECT id_barang FROM dbo.m_barang WHERE kode_barang COLLATE DATABASE_DEFAULT = @kode_barang COLLATE DATABASE_DEFAULT
                );
            `;
          } else {
            varQuery = `
              UPDATE dbo.m_barang_varian
              SET harga_beli_sat_1 = @harga_beli,
                  het_sat_1 = @het,
                  updated_by = @updated_by,
                  updated_at = @updated_at
              WHERE kode_varian COLLATE DATABASE_DEFAULT = @kode_varian COLLATE DATABASE_DEFAULT;
            `;
          }
          const resVar = await varReq.query(varQuery);
          affectedVar = resVar.rowsAffected?.[0] || 0;
          updatedCount += affectedVar;
        }

        let affectedBase = 0;
        if (kodeBarang) {
          const baseReq = new sql.Request(tx);
          baseReq.input("kode_barang", sql.VarChar(100), kodeBarang);
          baseReq.input("harga_beli", sql.Decimal(18, 2), hargaBeli);
          baseReq.input("het", sql.Decimal(18, 2), het);
          baseReq.input("updated_by", sql.VarChar(100), raw.updated_by || updatedBy);
          baseReq.input("updated_at", sql.DateTime2, now);
          const baseQuery = `
            UPDATE dbo.m_barang
            SET harga_beli_sat_1 = @harga_beli,
                het_sat_1 = @het,
                updated_by = @updated_by,
                updated_at = @updated_at
            WHERE kode_barang COLLATE DATABASE_DEFAULT = @kode_barang COLLATE DATABASE_DEFAULT;
          `;
          const resBase = await baseReq.query(baseQuery);
          affectedBase = resBase.rowsAffected?.[0] || 0;
          updatedCount += affectedBase;
        }

        if (affectedVar === 0 && affectedBase === 0) {
          notFound.push({ kode_barang: kodeBarang, kode_varian: kodeVarian });
        }
      }

      await tx.commit();
      return reply.send({ message: "Prices updated", updated_count: updatedCount, not_found: notFound });
    } catch (err) {
      await tx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed to update prices");
      return reply.code(500).send({ message: "Failed to update prices" });
    }
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params;
    if (!id) return reply.code(400).send({ message: "id is required" });

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

      const delVarReq = new sql.Request(tx);
      delVarReq.input("id_barang", sql.Int, Number(id));
      await delVarReq.query("DELETE FROM dbo.m_barang_varian WHERE id_barang = @id_barang");

      const delMediaReq = new sql.Request(tx);
      delMediaReq.input("id_barang", sql.Int, Number(id));
      await delMediaReq.query("DELETE FROM dbo.m_barang_media WHERE id_barang = @id_barang");

      const delBarangReq = new sql.Request(tx);
      delBarangReq.input("id_barang", sql.Int, Number(id));
      const result = await delBarangReq.query("DELETE FROM dbo.m_barang WHERE id_barang = @id_barang");

      if (result.rowsAffected?.[0] === 0) {
        await tx.rollback();
        return reply.code(404).send({ message: "Barang tidak ditemukan" });
      }

      await tx.commit();
      return reply.send({ message: "Barang deleted" });
    } catch (err) {
      await tx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed to delete barang");
      return reply.code(500).send({ message: "Failed to delete barang" });
    }
  });

  function mapBarangKhusus(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      if (value === "festive") return 1;
      if (value === "bonus") return 2;
      if (value === "regular") return 0;
    }
    return 0;
  }
}
