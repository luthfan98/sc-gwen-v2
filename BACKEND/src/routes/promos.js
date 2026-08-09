import crypto from "node:crypto";

export default async function promoRoutes(fastify) {
  const { sql, pool } = fastify.mssql;
  const kasirTargets = [
    { server: "gwenkasir1\\SQLEXPRESS", database: "db_gwen_kasir1" },
    { server: "gwenkasir2\\SQLEXPRESS", database: "db_gwen_kasir2" },
    { server: "gwenkasir3\\SQLEXPRESS", database: "db_gwen_kasir3" },
    { server: "gwenkasir4\\SQLEXPRESS", database: "db_gwen_kasir4" },
  ];

  const createKasirPool = (target) =>
    new sql.ConnectionPool({
      server: target.server,
      user: "sa",
      password: "resmi12",
      database: target.database,
      requestTimeout: 60000,
      connectionTimeout: 30000,
      pool: {
        max: 2,
        min: 0,
        idleTimeoutMillis: 30000,
      },
      options: {
        encrypt: false,
        trustServerCertificate: true,
        useUTC: true,
      },
    });

  const parseDate = (value) => {
    if (!value) return null;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  };

  const parseTime = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    if (!text) return null;
    return text.length === 5 ? `${text}:00` : text;
  };

  const formatTimeForDb = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(11, 19);
    }
    const text = String(value).trim();
    if (!text) return null;
    if (/^\d{2}:\d{2}$/.test(text)) return `${text}:00`;
    if (/^\d{2}:\d{2}:\d{2}$/.test(text)) return text;
    const dt = new Date(text);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toISOString().slice(11, 19);
    }
    return null;
  };

  const normalizeDateTimeForDb = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    const dt = new Date(value);
    if (!Number.isNaN(dt.getTime())) return dt;
    return null;
  };

  const normalizeHeader = (body, defaults = {}) => ({
    nama_promosi: String(body.nama_promosi || "").trim(),
    deskripsi: body.deskripsi ? String(body.deskripsi).trim() : null,
    valid_from: parseDate(body.valid_from),
    valid_to: parseDate(body.valid_to),
    time_from: parseTime(body.time_from),
    time_to: parseTime(body.time_to),
    jenis_sumber: body.jenis_sumber ? String(body.jenis_sumber).trim() : null,
    status_aktif: body.status_aktif === 0 || body.status_aktif === false ? 0 : 1,
    status_approval:
      body.status_approval === 1 || body.status_approval === 2
        ? Number(body.status_approval)
        : 0,
    budget_total: body.budget_total != null ? Number(body.budget_total) : null,
    max_total_item: body.max_total_item != null ? Number(body.max_total_item) : null,
    max_total_redeem_trx: body.max_total_redeem_trx != null ? Number(body.max_total_redeem_trx) : null,
    redeem_mode: body.redeem_mode ? String(body.redeem_mode).trim() : "ONCE",
    max_redeem_times_per_trx:
      body.max_redeem_times_per_trx != null ? Number(body.max_redeem_times_per_trx) : null,
    max_redeem_per_customer:
      body.max_redeem_per_customer != null ? Number(body.max_redeem_per_customer) : null,
    redeem_scope_per_customer: body.redeem_scope_per_customer
      ? String(body.redeem_scope_per_customer).trim()
      : null,
    payment_scope: body.payment_scope ? String(body.payment_scope).trim() : "ALL",
    created_by: String(body.created_by || defaults.created_by || "Admin").trim(),
    updated_by: String(body.updated_by || defaults.updated_by || "Admin").trim(),
  });

  const validateHeader = (header) => {
    if (!header.nama_promosi) return "nama_promosi wajib diisi";
    if (!header.valid_from || !header.valid_to) return "valid_from dan valid_to wajib diisi";
    if (header.valid_from > header.valid_to) return "valid_from tidak boleh lebih besar dari valid_to";
    if ((header.time_from && !header.time_to) || (!header.time_from && header.time_to)) {
      return "time_from dan time_to harus diisi berpasangan";
    }
    if (header.time_from && header.time_to && header.time_from > header.time_to) {
      return "time_from tidak boleh lebih besar dari time_to";
    }
    return null;
  };

  const generateDocCode = async (trx, prefix) => {
    try {
      const req = trx.request();
      req.input("Prefix", sql.VarChar(10), prefix);
      req.input("ExecDate", sql.Date, null);
      req.input("UserCode", sql.Char(2), "88");
      req.input("BranchCode", sql.Char(2), "GW");
      req.input("PadLength", sql.Int, 6);
      req.input("Separator", sql.Char(1), ".");
      req.output("NextNo", sql.Int);
      req.output("GeneratedCode", sql.VarChar(50));
      const res = await req.execute("GWEN_GenerateDocCode");
      if (res.output?.GeneratedCode) return res.output.GeneratedCode;
    } catch (err) {
      fastify.log.error({ err }, "Failed generate doc code");
    }
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    return `${prefix}.${stamp}${rand}`;
  };

  const generateDetailCode = (prefix) => {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 17);
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    return `${prefix}.${stamp}${rand}`;
  };

  const insertChildren = async (trx, kodePromosi, payload) => {
    const targetToko = Array.isArray(payload.target_toko) ? payload.target_toko : [];
    for (const kode_toko of targetToko) {
      await trx
        .request()
        .input("kode_d_target_toko", sql.VarChar(50), generateDetailCode("PTK"))
        .input("kode_t_promosi", sql.VarChar(50), kodePromosi)
        .input("kode_toko", sql.VarChar(50), String(kode_toko))
        .query(
          `INSERT INTO dbo.GWEN_d_promosi_target_toko
           (kode_d_target_toko, kode_t_promosi, kode_toko)
           VALUES (@kode_d_target_toko, @kode_t_promosi, @kode_toko);`
        );
    }

    const paymentMethods = Array.isArray(payload.payment_methods) ? payload.payment_methods : [];
    for (const kode_payment_method of paymentMethods) {
      await trx
        .request()
        .input("kode_d_promosi_payment_method", sql.VarChar(50), generateDetailCode("PPM"))
        .input("kode_t_promosi", sql.VarChar(50), kodePromosi)
        .input("kode_payment_method", sql.VarChar(30), String(kode_payment_method))
        .query(
          `INSERT INTO dbo.GWEN_d_promosi_payment_method
           (kode_d_promosi_payment_method, kode_t_promosi, kode_payment_method)
           VALUES (@kode_d_promosi_payment_method, @kode_t_promosi, @kode_payment_method);`
        );
    }

    const ruleGroups = Array.isArray(payload.rule_groups) ? payload.rule_groups : [];
    for (const group of ruleGroups) {
      const kodeGroup = generateDetailCode("PRG");
      await trx
        .request()
        .input("kode_d_rule_group", sql.VarChar(50), kodeGroup)
        .input("kode_t_promosi", sql.VarChar(50), kodePromosi)
        .input("group_no", sql.Int, Number(group.group_no || 1))
        .input("group_operator", sql.VarChar(10), String(group.group_operator || "AND"))
        .input("rule_type", sql.VarChar(30), String(group.rule_type || "ITEM_COMBO"))
        .input("min_total_qty", sql.Int, group.min_total_qty != null ? Number(group.min_total_qty) : null)
        .input("min_total_value", sql.Decimal(18, 2), group.min_total_value != null ? Number(group.min_total_value) : null)
        .input("max_redeem_qty", sql.Int, group.max_redeem_qty != null ? Number(group.max_redeem_qty) : null)
        .input("max_redeem_value", sql.Decimal(18, 2), group.max_redeem_value != null ? Number(group.max_redeem_value) : null)
        .query(
          `INSERT INTO dbo.GWEN_d_promosi_rule_group
           (kode_d_rule_group, kode_t_promosi, group_no, group_operator, rule_type, min_total_qty, min_total_value,
            max_redeem_qty, max_redeem_value)
           VALUES (@kode_d_rule_group, @kode_t_promosi, @group_no, @group_operator, @rule_type,
                   @min_total_qty, @min_total_value, @max_redeem_qty, @max_redeem_value);`
        );

      const items = Array.isArray(group.items) ? group.items : [];
      for (const item of items) {
        await trx
          .request()
          .input("kode_d_rule_item", sql.VarChar(50), generateDetailCode("PRI"))
          .input("kode_d_rule_group", sql.VarChar(50), kodeGroup)
          .input("kode_barang_variant", sql.VarChar(50), String(item.kode_barang_variant || ""))
          .input("min_qty", sql.Int, Number(item.min_qty || 1))
          .input("max_qty", sql.Int, item.max_qty != null ? Number(item.max_qty) : null)
          .query(
            `INSERT INTO dbo.GWEN_d_promosi_rule_item
             (kode_d_rule_item, kode_d_rule_group, kode_barang_variant, min_qty, max_qty)
             VALUES (@kode_d_rule_item, @kode_d_rule_group, @kode_barang_variant, @min_qty, @max_qty);`
          );
      }
    }

    const benefits = Array.isArray(payload.benefits) ? payload.benefits : [];
    for (const benefit of benefits) {
      const kodeBenefit = generateDetailCode("PBF");
      await trx
        .request()
        .input("kode_d_benefit", sql.VarChar(50), kodeBenefit)
        .input("kode_t_promosi", sql.VarChar(50), kodePromosi)
        .input("benefit_type", sql.VarChar(30), String(benefit.benefit_type || "DISKON_NOMINAL"))
        .input("diskon_persen", sql.Decimal(10, 2), benefit.diskon_persen != null ? Number(benefit.diskon_persen) : null)
        .input("diskon_nominal", sql.Decimal(18, 2), benefit.diskon_nominal != null ? Number(benefit.diskon_nominal) : null)
        .input("apply_scope", sql.VarChar(30), String(benefit.apply_scope || "APPLY_TO_CART"))
        .input(
          "max_discount_value_per_trx",
          sql.Decimal(18, 2),
          benefit.max_discount_value_per_trx != null ? Number(benefit.max_discount_value_per_trx) : null
        )
        .input("rounding_mode", sql.VarChar(10), String(benefit.rounding_mode || "ROUND"))
        .input("rounding_step", sql.Int, Number(benefit.rounding_step || 1))
        .query(
          `INSERT INTO dbo.GWEN_d_promosi_benefit
           (kode_d_benefit, kode_t_promosi, benefit_type, diskon_persen, diskon_nominal, apply_scope,
            max_discount_value_per_trx, rounding_mode, rounding_step)
           VALUES (@kode_d_benefit, @kode_t_promosi, @benefit_type, @diskon_persen, @diskon_nominal, @apply_scope,
                   @max_discount_value_per_trx, @rounding_mode, @rounding_step);`
        );

      const bonusItems = Array.isArray(benefit.bonus_items) ? benefit.bonus_items : [];
      for (const item of bonusItems) {
        await trx
          .request()
          .input("kode_d_bonus_item", sql.VarChar(50), generateDetailCode("PBI"))
          .input("kode_d_benefit", sql.VarChar(50), kodeBenefit)
          .input("kode_barang_variant", sql.VarChar(50), String(item.kode_barang_variant || ""))
          .input("qty_bonus", sql.Int, Number(item.qty_bonus || 1))
          .query(
            `INSERT INTO dbo.GWEN_d_promosi_bonus_item
             (kode_d_bonus_item, kode_d_benefit, kode_barang_variant, qty_bonus)
             VALUES (@kode_d_bonus_item, @kode_d_benefit, @kode_barang_variant, @qty_bonus);`
          );
      }
    }

    const banners = Array.isArray(payload.banners) ? payload.banners : [];
    for (const banner of banners) {
      await trx
        .request()
        .input("kode_d_banner", sql.VarChar(50), generateDetailCode("PBN"))
        .input("kode_t_promosi", sql.VarChar(50), kodePromosi)
        .input("is_show_tv", sql.Bit, banner.is_show_tv === 0 ? 0 : 1)
        .input("tv_priority", sql.Int, banner.tv_priority != null ? Number(banner.tv_priority) : null)
        .input("banner_type", sql.VarChar(10), String(banner.banner_type || "IMAGE"))
        .input("banner_url", sql.VarChar(500), String(banner.banner_url || ""))
        .input("banner_title", sql.VarChar(120), banner.banner_title ? String(banner.banner_title) : null)
        .input("banner_subtitle", sql.VarChar(200), banner.banner_subtitle ? String(banner.banner_subtitle) : null)
        .input("banner_cta", sql.VarChar(80), banner.banner_cta ? String(banner.banner_cta) : null)
        .input("banner_valid_from", sql.DateTime2, parseDate(banner.banner_valid_from))
        .input("banner_valid_to", sql.DateTime2, parseDate(banner.banner_valid_to))
        .input("is_active", sql.Bit, banner.is_active === 0 ? 0 : 1)
        .input("created_by", sql.VarChar(100), String(banner.created_by || "Admin"))
        .query(
          `INSERT INTO dbo.GWEN_d_promosi_banner
           (kode_d_banner, kode_t_promosi, is_show_tv, tv_priority, banner_type, banner_url, banner_title,
            banner_subtitle, banner_cta, banner_valid_from, banner_valid_to, is_active, created_by)
           VALUES (@kode_d_banner, @kode_t_promosi, @is_show_tv, @tv_priority, @banner_type, @banner_url,
                   @banner_title, @banner_subtitle, @banner_cta, @banner_valid_from, @banner_valid_to,
                   @is_active, @created_by);`
        );
    }
  };

  const deleteChildren = async (trx, kodePromosi) => {
    await trx
      .request()
      .input("kode_t_promosi", sql.VarChar(50), kodePromosi)
      .query(
        `DELETE FROM dbo.GWEN_d_promosi_bonus_item
         WHERE kode_d_benefit IN (
           SELECT kode_d_benefit FROM dbo.GWEN_d_promosi_benefit WHERE kode_t_promosi = @kode_t_promosi
         );
         DELETE FROM dbo.GWEN_d_promosi_benefit WHERE kode_t_promosi = @kode_t_promosi;
         DELETE FROM dbo.GWEN_d_promosi_rule_item
         WHERE kode_d_rule_group IN (
           SELECT kode_d_rule_group FROM dbo.GWEN_d_promosi_rule_group WHERE kode_t_promosi = @kode_t_promosi
         );
         DELETE FROM dbo.GWEN_d_promosi_rule_group WHERE kode_t_promosi = @kode_t_promosi;
         DELETE FROM dbo.GWEN_d_promosi_payment_method WHERE kode_t_promosi = @kode_t_promosi;
         DELETE FROM dbo.GWEN_d_promosi_target_toko WHERE kode_t_promosi = @kode_t_promosi;
         DELETE FROM dbo.GWEN_d_promosi_banner WHERE kode_t_promosi = @kode_t_promosi;`
      );
  };

  const fetchPromoDetail = async (kode) => {
    const headerRes = await pool
      .request()
      .input("kode_t_promosi", sql.VarChar(50), kode)
      .query(`SELECT * FROM dbo.GWEN_t_promosi WHERE kode_t_promosi = @kode_t_promosi;`);
    if (!headerRes.recordset?.length) return null;

    const payload = {
      header: headerRes.recordset[0],
      target_toko: [],
      payment_methods: [],
      rule_groups: [],
      benefits: [],
      banners: [],
    };

    const targetRes = await pool
      .request()
      .input("kode_t_promosi", sql.VarChar(50), kode)
      .query(`SELECT kode_toko FROM dbo.GWEN_d_promosi_target_toko WHERE kode_t_promosi = @kode_t_promosi;`);
    payload.target_toko = targetRes.recordset?.map((row) => row.kode_toko) || [];

    const paymentRes = await pool
      .request()
      .input("kode_t_promosi", sql.VarChar(50), kode)
      .query(
        `SELECT kode_payment_method
         FROM dbo.GWEN_d_promosi_payment_method
         WHERE kode_t_promosi = @kode_t_promosi;`
      );
    payload.payment_methods = paymentRes.recordset?.map((row) => row.kode_payment_method) || [];

    const groupsRes = await pool
      .request()
      .input("kode_t_promosi", sql.VarChar(50), kode)
      .query(
        `SELECT * FROM dbo.GWEN_d_promosi_rule_group
         WHERE kode_t_promosi = @kode_t_promosi
         ORDER BY group_no;`
      );
    const itemsRes = await pool
      .request()
      .input("kode_t_promosi", sql.VarChar(50), kode)
      .query(
        `SELECT
           ri.*,
           v.nama_varian,
           v.kode_varian,
           v.barcode_varian,
           b.nama AS nama_barang,
           b.kode_barang
         FROM dbo.GWEN_d_promosi_rule_item ri
         JOIN dbo.GWEN_d_promosi_rule_group rg
           ON rg.kode_d_rule_group = ri.kode_d_rule_group
         LEFT JOIN dbo.m_barang_varian v
           ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = ri.kode_barang_variant COLLATE DATABASE_DEFAULT
         LEFT JOIN dbo.m_barang b
           ON b.id_barang = v.id_barang
         WHERE rg.kode_t_promosi = @kode_t_promosi;`
      );
    payload.rule_groups =
      groupsRes.recordset?.map((group) => ({
        ...group,
        items: itemsRes.recordset?.filter((item) => item.kode_d_rule_group === group.kode_d_rule_group) || [],
      })) || [];

    const benefitRes = await pool
      .request()
      .input("kode_t_promosi", sql.VarChar(50), kode)
      .query(
        `SELECT * FROM dbo.GWEN_d_promosi_benefit
         WHERE kode_t_promosi = @kode_t_promosi;`
      );
    const bonusRes = await pool
      .request()
      .input("kode_t_promosi", sql.VarChar(50), kode)
      .query(
        `SELECT bi.*
         FROM dbo.GWEN_d_promosi_bonus_item bi
         JOIN dbo.GWEN_d_promosi_benefit b
           ON b.kode_d_benefit = bi.kode_d_benefit
         WHERE b.kode_t_promosi = @kode_t_promosi;`
      );
    payload.benefits =
      benefitRes.recordset?.map((benefit) => ({
        ...benefit,
        bonus_items: bonusRes.recordset?.filter((row) => row.kode_d_benefit === benefit.kode_d_benefit) || [],
      })) || [];

    const bannerRes = await pool
      .request()
      .input("kode_t_promosi", sql.VarChar(50), kode)
      .query(
        `SELECT * FROM dbo.GWEN_d_promosi_banner
         WHERE kode_t_promosi = @kode_t_promosi
         ORDER BY created_at DESC;`
      );
    payload.banners = bannerRes.recordset || [];

    return payload;
  };

  const upsertPromoHeaderToTarget = async (trx, header) => {
    const req = trx.request();
    req.input("kode_t_promosi", sql.VarChar(50), header.kode_t_promosi);
    req.input("nama_promosi", sql.VarChar(200), header.nama_promosi);
    req.input("deskripsi", sql.VarChar(255), header.deskripsi || null);
    req.input("valid_from", sql.DateTime2, normalizeDateTimeForDb(header.valid_from));
    req.input("valid_to", sql.DateTime2, normalizeDateTimeForDb(header.valid_to));
    req.input("time_from", sql.VarChar(8), formatTimeForDb(header.time_from));
    req.input("time_to", sql.VarChar(8), formatTimeForDb(header.time_to));
    req.input("jenis_sumber", sql.VarChar(20), header.jenis_sumber || null);
    req.input("status_aktif", sql.Bit, Number(header.status_aktif) === 1 ? 1 : 0);
    req.input("status_approval", sql.Int, Number(header.status_approval || 0));
    req.input("budget_total", sql.Decimal(18, 2), header.budget_total != null ? Number(header.budget_total) : null);
    req.input("max_total_item", sql.Int, header.max_total_item != null ? Number(header.max_total_item) : null);
    req.input("max_total_redeem_trx", sql.Int, header.max_total_redeem_trx != null ? Number(header.max_total_redeem_trx) : null);
    req.input("redeem_mode", sql.VarChar(10), header.redeem_mode || "ONCE");
    req.input("max_redeem_times_per_trx", sql.Int, header.max_redeem_times_per_trx != null ? Number(header.max_redeem_times_per_trx) : null);
    req.input("max_redeem_per_customer", sql.Int, header.max_redeem_per_customer != null ? Number(header.max_redeem_per_customer) : null);
    req.input("redeem_scope_per_customer", sql.VarChar(20), header.redeem_scope_per_customer || null);
    req.input("payment_scope", sql.VarChar(10), header.payment_scope || "ALL");
    req.input("created_by", sql.VarChar(100), header.created_by || "Admin");
    req.input("created_at", sql.DateTime2, normalizeDateTimeForDb(header.created_at));
    req.input("updated_by", sql.VarChar(100), header.updated_by || "Admin");
    req.input("updated_at", sql.DateTime2, normalizeDateTimeForDb(header.updated_at));
    req.input("approved_by", sql.VarChar(100), header.approved_by || null);
    req.input("approved_at", sql.DateTime2, normalizeDateTimeForDb(header.approved_at));
    req.input("rejected_by", sql.VarChar(100), header.rejected_by || null);
    req.input("rejected_at", sql.DateTime2, normalizeDateTimeForDb(header.rejected_at));
    req.input("catatan_approval", sql.VarChar(255), header.catatan_approval || null);
    req.input("is_archived", sql.Bit, Number(header.is_archived) === 1 ? 1 : 0);
    req.input("archived_by", sql.VarChar(100), header.archived_by || null);
    req.input("archived_at", sql.DateTime2, normalizeDateTimeForDb(header.archived_at));
    req.input("archive_note", sql.VarChar(255), header.archive_note || null);

    const existsRes = await req.query(
      `SELECT TOP 1 kode_t_promosi FROM dbo.GWEN_t_promosi WHERE kode_t_promosi = @kode_t_promosi;`
    );
    if (existsRes.recordset?.length) {
      await trx
        .request()
        .input("kode_t_promosi", sql.VarChar(50), header.kode_t_promosi)
        .input("nama_promosi", sql.VarChar(200), header.nama_promosi)
        .input("deskripsi", sql.VarChar(255), header.deskripsi || null)
        .input("valid_from", sql.DateTime2, normalizeDateTimeForDb(header.valid_from))
        .input("valid_to", sql.DateTime2, normalizeDateTimeForDb(header.valid_to))
        .input("time_from", sql.VarChar(8), formatTimeForDb(header.time_from))
        .input("time_to", sql.VarChar(8), formatTimeForDb(header.time_to))
        .input("jenis_sumber", sql.VarChar(20), header.jenis_sumber || null)
        .input("status_aktif", sql.Bit, Number(header.status_aktif) === 1 ? 1 : 0)
        .input("status_approval", sql.Int, Number(header.status_approval || 0))
        .input("budget_total", sql.Decimal(18, 2), header.budget_total != null ? Number(header.budget_total) : null)
        .input("max_total_item", sql.Int, header.max_total_item != null ? Number(header.max_total_item) : null)
        .input("max_total_redeem_trx", sql.Int, header.max_total_redeem_trx != null ? Number(header.max_total_redeem_trx) : null)
        .input("redeem_mode", sql.VarChar(10), header.redeem_mode || "ONCE")
        .input("max_redeem_times_per_trx", sql.Int, header.max_redeem_times_per_trx != null ? Number(header.max_redeem_times_per_trx) : null)
        .input("max_redeem_per_customer", sql.Int, header.max_redeem_per_customer != null ? Number(header.max_redeem_per_customer) : null)
        .input("redeem_scope_per_customer", sql.VarChar(20), header.redeem_scope_per_customer || null)
        .input("payment_scope", sql.VarChar(10), header.payment_scope || "ALL")
        .input("updated_by", sql.VarChar(100), header.updated_by || "Admin")
        .input("updated_at", sql.DateTime2, normalizeDateTimeForDb(header.updated_at) || new Date())
        .input("approved_by", sql.VarChar(100), header.approved_by || null)
        .input("approved_at", sql.DateTime2, normalizeDateTimeForDb(header.approved_at))
        .input("rejected_by", sql.VarChar(100), header.rejected_by || null)
        .input("rejected_at", sql.DateTime2, normalizeDateTimeForDb(header.rejected_at))
        .input("catatan_approval", sql.VarChar(255), header.catatan_approval || null)
        .input("is_archived", sql.Bit, Number(header.is_archived) === 1 ? 1 : 0)
        .input("archived_by", sql.VarChar(100), header.archived_by || null)
        .input("archived_at", sql.DateTime2, normalizeDateTimeForDb(header.archived_at))
        .input("archive_note", sql.VarChar(255), header.archive_note || null)
        .query(
          `UPDATE dbo.GWEN_t_promosi
           SET nama_promosi = @nama_promosi,
               deskripsi = @deskripsi,
               valid_from = @valid_from,
               valid_to = @valid_to,
               time_from = @time_from,
               time_to = @time_to,
               jenis_sumber = @jenis_sumber,
               status_aktif = @status_aktif,
               status_approval = @status_approval,
               budget_total = @budget_total,
               max_total_item = @max_total_item,
               max_total_redeem_trx = @max_total_redeem_trx,
               redeem_mode = @redeem_mode,
               max_redeem_times_per_trx = @max_redeem_times_per_trx,
               max_redeem_per_customer = @max_redeem_per_customer,
               redeem_scope_per_customer = @redeem_scope_per_customer,
               payment_scope = @payment_scope,
               updated_by = @updated_by,
               updated_at = @updated_at,
               approved_by = @approved_by,
               approved_at = @approved_at,
               rejected_by = @rejected_by,
               rejected_at = @rejected_at,
               catatan_approval = @catatan_approval,
               is_archived = @is_archived,
               archived_by = @archived_by,
               archived_at = @archived_at,
               archive_note = @archive_note
           WHERE kode_t_promosi = @kode_t_promosi;`
        );
      return;
    }

    await trx
      .request()
      .input("kode_t_promosi", sql.VarChar(50), header.kode_t_promosi)
      .input("nama_promosi", sql.VarChar(200), header.nama_promosi)
      .input("deskripsi", sql.VarChar(255), header.deskripsi || null)
      .input("valid_from", sql.DateTime2, normalizeDateTimeForDb(header.valid_from))
      .input("valid_to", sql.DateTime2, normalizeDateTimeForDb(header.valid_to))
      .input("time_from", sql.VarChar(8), formatTimeForDb(header.time_from))
      .input("time_to", sql.VarChar(8), formatTimeForDb(header.time_to))
      .input("jenis_sumber", sql.VarChar(20), header.jenis_sumber || null)
      .input("status_aktif", sql.Bit, Number(header.status_aktif) === 1 ? 1 : 0)
      .input("status_approval", sql.Int, Number(header.status_approval || 0))
      .input("budget_total", sql.Decimal(18, 2), header.budget_total != null ? Number(header.budget_total) : null)
      .input("max_total_item", sql.Int, header.max_total_item != null ? Number(header.max_total_item) : null)
      .input("max_total_redeem_trx", sql.Int, header.max_total_redeem_trx != null ? Number(header.max_total_redeem_trx) : null)
      .input("redeem_mode", sql.VarChar(10), header.redeem_mode || "ONCE")
      .input("max_redeem_times_per_trx", sql.Int, header.max_redeem_times_per_trx != null ? Number(header.max_redeem_times_per_trx) : null)
      .input("max_redeem_per_customer", sql.Int, header.max_redeem_per_customer != null ? Number(header.max_redeem_per_customer) : null)
      .input("redeem_scope_per_customer", sql.VarChar(20), header.redeem_scope_per_customer || null)
      .input("payment_scope", sql.VarChar(10), header.payment_scope || "ALL")
      .input("created_by", sql.VarChar(100), header.created_by || "Admin")
      .input("created_at", sql.DateTime2, normalizeDateTimeForDb(header.created_at) || new Date())
      .input("updated_by", sql.VarChar(100), header.updated_by || "Admin")
      .input("updated_at", sql.DateTime2, normalizeDateTimeForDb(header.updated_at) || new Date())
      .input("approved_by", sql.VarChar(100), header.approved_by || null)
      .input("approved_at", sql.DateTime2, normalizeDateTimeForDb(header.approved_at))
      .input("rejected_by", sql.VarChar(100), header.rejected_by || null)
      .input("rejected_at", sql.DateTime2, normalizeDateTimeForDb(header.rejected_at))
      .input("catatan_approval", sql.VarChar(255), header.catatan_approval || null)
      .input("is_archived", sql.Bit, Number(header.is_archived) === 1 ? 1 : 0)
      .input("archived_by", sql.VarChar(100), header.archived_by || null)
      .input("archived_at", sql.DateTime2, normalizeDateTimeForDb(header.archived_at))
      .input("archive_note", sql.VarChar(255), header.archive_note || null)
      .query(
        `INSERT INTO dbo.GWEN_t_promosi (
           kode_t_promosi, nama_promosi, deskripsi, valid_from, valid_to, time_from, time_to, jenis_sumber,
           status_aktif, status_approval, budget_total, max_total_item, max_total_redeem_trx,
           redeem_mode, max_redeem_times_per_trx, max_redeem_per_customer, redeem_scope_per_customer,
           payment_scope, created_by, created_at, updated_by, updated_at,
           approved_by, approved_at, rejected_by, rejected_at, catatan_approval,
           is_archived, archived_by, archived_at, archive_note
         )
         VALUES (
           @kode_t_promosi, @nama_promosi, @deskripsi, @valid_from, @valid_to, @time_from, @time_to, @jenis_sumber,
           @status_aktif, @status_approval, @budget_total, @max_total_item, @max_total_redeem_trx,
           @redeem_mode, @max_redeem_times_per_trx, @max_redeem_per_customer, @redeem_scope_per_customer,
           @payment_scope, @created_by, @created_at, @updated_by, @updated_at,
           @approved_by, @approved_at, @rejected_by, @rejected_at, @catatan_approval,
           @is_archived, @archived_by, @archived_at, @archive_note
         );`
      );
  };

  fastify.get("/", async (request, reply) => {
    const { status, aktif, toko, q, barcode, bundle_only, date_from, date_to } = request.query || {};
    try {
      const req = pool.request();
      req.input("q", sql.VarChar(200), q ? `%${q}%` : null);
      req.input("status", sql.Int, status != null ? Number(status) : null);
      req.input("aktif", sql.Int, aktif != null ? Number(aktif) : null);
      req.input("kode_toko", sql.VarChar(50), toko || null);
      req.input("barcode", sql.VarChar(100), barcode ? String(barcode).trim() : null);
      req.input("date_from", sql.Date, date_from ? parseDate(String(date_from)) : null);
      req.input("date_to", sql.Date, date_to ? parseDate(String(date_to)) : null);
      req.input(
        "bundle_only",
        sql.Bit,
        bundle_only != null && String(bundle_only).trim() !== ""
          ? Number(bundle_only) ? 1 : 0
          : null
      );

      const res = await req.query(
        `SELECT
           p.kode_t_promosi,
           p.nama_promosi,
           p.deskripsi,
           p.valid_from,
           p.valid_to,
           p.time_from,
           p.time_to,
           p.jenis_sumber,
           p.status_aktif,
           p.status_approval,
           p.approved_at,
           p.budget_total,
           COALESCE(promo_usage.total_discount, p.budget_terpakai, 0) AS budget_terpakai,
           p.max_total_item,
           p.total_item_terpakai,
           p.max_total_redeem_trx,
           p.total_redeem_trx_used,
           p.payment_scope,
           (
             SELECT STRING_AGG(t.kode_toko, ',')
             FROM dbo.GWEN_d_promosi_target_toko t
             WHERE t.kode_t_promosi = p.kode_t_promosi
           ) AS target_toko,
           (
             SELECT STRING_AGG(
               CONCAT(
                 b.benefit_type,
                 ':',
                 CASE
                   WHEN b.benefit_type = 'DISKON_PERSEN' THEN CAST(ISNULL(b.diskon_persen, 0) AS VARCHAR(20)) + '%'
                   WHEN b.benefit_type = 'DISKON_NOMINAL' THEN CAST(ISNULL(b.diskon_nominal, 0) AS VARCHAR(20))
                   ELSE ''
                 END
               ),
               ','
             )
             FROM dbo.GWEN_d_promosi_benefit b
             WHERE b.kode_t_promosi = p.kode_t_promosi
           ) AS benefit_info,
           p.is_archived,
           p.created_by,
           p.created_at,
           p.updated_by,
           p.updated_at
         FROM dbo.GWEN_t_promosi p
         LEFT JOIN (
           SELECT
             LTRIM(RTRIM(promo_code)) AS promo_code,
             SUM(CAST(ISNULL(discount, 0) AS decimal(18,2))) AS total_discount
           FROM dbo.pos_transaction_item_promos_central
           WHERE ISNULL(is_active, 1) = 1
           GROUP BY LTRIM(RTRIM(promo_code))
         ) promo_usage ON promo_usage.promo_code = p.kode_t_promosi
         WHERE (@q IS NULL OR p.nama_promosi LIKE @q OR p.deskripsi LIKE @q)
           AND (@status IS NULL OR p.status_approval = @status)
           AND (@aktif IS NULL OR p.status_aktif = @aktif)
           AND (@date_from IS NULL OR CONVERT(date, p.valid_to) >= @date_from)
           AND (@date_to IS NULL OR CONVERT(date, p.valid_from) <= @date_to)
           AND (@kode_toko IS NULL OR EXISTS (
             SELECT 1 FROM dbo.GWEN_d_promosi_target_toko t
             WHERE t.kode_t_promosi = p.kode_t_promosi AND t.kode_toko = @kode_toko
           ))
           AND (
             @barcode IS NULL OR EXISTS (
               SELECT 1
               FROM dbo.GWEN_d_promosi_rule_item ri
               JOIN dbo.GWEN_d_promosi_rule_group rg ON rg.kode_d_rule_group = ri.kode_d_rule_group
               JOIN dbo.m_barang_varian v ON v.kode_barang_variant = ri.kode_barang_variant
               WHERE rg.kode_t_promosi = p.kode_t_promosi
                 AND (
                   LTRIM(RTRIM(v.barcode_varian)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(@barcode)) COLLATE DATABASE_DEFAULT
                   OR LTRIM(RTRIM(v.kode_varian)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(@barcode)) COLLATE DATABASE_DEFAULT
                   OR LTRIM(RTRIM(v.kode_barang_variant)) COLLATE DATABASE_DEFAULT = LTRIM(RTRIM(@barcode)) COLLATE DATABASE_DEFAULT
                 )
             )
           )
           AND (
             @barcode IS NULL OR (
               ISNULL(p.status_approval, 0) = 1
               AND ISNULL(p.status_aktif, 0) = 1
               AND CONVERT(date, GETDATE()) BETWEEN CONVERT(date, p.valid_from) AND CONVERT(date, p.valid_to)
               AND (
                 p.time_from IS NULL OR p.time_to IS NULL
                 OR CONVERT(time, GETDATE()) BETWEEN CONVERT(time, p.time_from) AND CONVERT(time, p.time_to)
               )
             )
           )
           AND (
             @bundle_only IS NULL OR @bundle_only = 0 OR EXISTS (
               SELECT 1
               FROM dbo.GWEN_d_promosi_rule_group rg
               WHERE rg.kode_t_promosi = p.kode_t_promosi
                 AND rg.rule_type = 'ITEM_COMBO'
                 AND (
                   ISNULL(rg.min_total_qty, 0) > 1
                   OR EXISTS (
                     SELECT 1
                     FROM dbo.GWEN_d_promosi_rule_item ri
                     WHERE ri.kode_d_rule_group = rg.kode_d_rule_group
                       AND ISNULL(ri.min_qty, 0) > 1
                   )
                   OR EXISTS (
                     SELECT 1
                     FROM dbo.GWEN_d_promosi_benefit b
                     WHERE b.kode_t_promosi = p.kode_t_promosi
                       AND b.benefit_type = 'BONUS_ITEM'
                   )
                 )
             )
           )
         ORDER BY p.created_at DESC, p.kode_t_promosi DESC;`
      );
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch promosi list");
      return reply.code(500).send({ message: "Gagal memuat promosi" });
    }
  });

  fastify.get("/:id", async (request, reply) => {
    const kode = String(request.params?.id || "").trim();
    if (!kode) return reply.code(400).send({ message: "kode promosi tidak valid" });

    try {
      const headerRes = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .query(`SELECT * FROM dbo.GWEN_t_promosi WHERE kode_t_promosi = @kode_t_promosi;`);
      if (!headerRes.recordset?.length) {
        return reply.code(404).send({ message: "Promosi tidak ditemukan" });
      }

      const payload = {
        header: headerRes.recordset[0],
        target_toko: [],
        payment_methods: [],
        rule_groups: [],
        benefits: [],
        banners: [],
      };

      const targetRes = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .query(`SELECT kode_toko FROM dbo.GWEN_d_promosi_target_toko WHERE kode_t_promosi = @kode_t_promosi;`);
      payload.target_toko = targetRes.recordset?.map((row) => row.kode_toko) || [];

      const paymentRes = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .query(
          `SELECT kode_payment_method
           FROM dbo.GWEN_d_promosi_payment_method
           WHERE kode_t_promosi = @kode_t_promosi;`
        );
      payload.payment_methods = paymentRes.recordset?.map((row) => row.kode_payment_method) || [];

      const groupsRes = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .query(
          `SELECT * FROM dbo.GWEN_d_promosi_rule_group
           WHERE kode_t_promosi = @kode_t_promosi
           ORDER BY group_no;`
        );
      const itemsRes = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .query(
          `SELECT
             ri.*,
             v.nama_varian,
             v.kode_varian,
             v.barcode_varian,
             b.nama AS nama_barang,
             b.kode_barang
           FROM dbo.GWEN_d_promosi_rule_item ri
           JOIN dbo.GWEN_d_promosi_rule_group rg
             ON rg.kode_d_rule_group = ri.kode_d_rule_group
           LEFT JOIN dbo.m_barang_varian v
             ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = ri.kode_barang_variant COLLATE DATABASE_DEFAULT
           LEFT JOIN dbo.m_barang b
             ON b.id_barang = v.id_barang
           WHERE rg.kode_t_promosi = @kode_t_promosi;`
        );
      payload.rule_groups =
        groupsRes.recordset?.map((group) => ({
          ...group,
          items: itemsRes.recordset?.filter((item) => item.kode_d_rule_group === group.kode_d_rule_group) || [],
        })) || [];

      const benefitRes = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .query(
          `SELECT * FROM dbo.GWEN_d_promosi_benefit
           WHERE kode_t_promosi = @kode_t_promosi;`
        );
      const bonusRes = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .query(
          `SELECT bi.*
           FROM dbo.GWEN_d_promosi_bonus_item bi
           JOIN dbo.GWEN_d_promosi_benefit b
             ON b.kode_d_benefit = bi.kode_d_benefit
           WHERE b.kode_t_promosi = @kode_t_promosi;`
        );
      payload.benefits =
        benefitRes.recordset?.map((benefit) => ({
          ...benefit,
          bonus_items: bonusRes.recordset?.filter((row) => row.kode_d_benefit === benefit.kode_d_benefit) || [],
        })) || [];

      const bannerRes = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .query(
          `SELECT * FROM dbo.GWEN_d_promosi_banner
           WHERE kode_t_promosi = @kode_t_promosi
           ORDER BY created_at DESC;`
        );
      payload.banners = bannerRes.recordset || [];

      return reply.send(payload);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch promosi detail");
      return reply.code(500).send({ message: "Gagal memuat detail promosi" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const header = normalizeHeader(body);
    const validationError = validateHeader(header);
    if (validationError) return reply.code(400).send({ message: validationError });

    const paymentMethods = Array.isArray(body.payment_methods) ? body.payment_methods : [];
    if (header.payment_scope === "SELECTED" && paymentMethods.length === 0) {
      return reply.code(400).send({ message: "payment_methods wajib diisi untuk payment_scope SELECTED" });
    }

    if (header.time_from && header.time_to && !header.max_redeem_per_customer) {
      header.max_redeem_per_customer = 1;
      header.redeem_scope_per_customer = header.redeem_scope_per_customer || "PER_DAY";
    }

    const trx = new sql.Transaction(pool);
    try {
      await trx.begin();
      const kodePromosi = await generateDocCode(trx, "PRM");
      const now = new Date();

      await trx
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kodePromosi)
        .input("nama_promosi", sql.VarChar(200), header.nama_promosi)
        .input("deskripsi", sql.VarChar(255), header.deskripsi)
        .input("valid_from", sql.DateTime2, header.valid_from)
        .input("valid_to", sql.DateTime2, header.valid_to)
        .input("time_from", sql.VarChar(8), header.time_from)
        .input("time_to", sql.VarChar(8), header.time_to)
        .input("jenis_sumber", sql.VarChar(20), header.jenis_sumber)
        .input("status_aktif", sql.Bit, header.status_aktif)
        .input("status_approval", sql.Int, header.status_approval)
        .input("budget_total", sql.Decimal(18, 2), header.budget_total)
        .input("max_total_item", sql.Int, header.max_total_item)
        .input("max_total_redeem_trx", sql.Int, header.max_total_redeem_trx)
        .input("redeem_mode", sql.VarChar(10), header.redeem_mode)
        .input("max_redeem_times_per_trx", sql.Int, header.max_redeem_times_per_trx)
        .input("max_redeem_per_customer", sql.Int, header.max_redeem_per_customer)
        .input("redeem_scope_per_customer", sql.VarChar(20), header.redeem_scope_per_customer)
        .input("payment_scope", sql.VarChar(10), header.payment_scope)
        .input("created_by", sql.VarChar(100), header.created_by)
        .input("created_at", sql.DateTime2, now)
        .input("updated_by", sql.VarChar(100), header.updated_by)
        .input("updated_at", sql.DateTime2, now)
        .query(
          `INSERT INTO dbo.GWEN_t_promosi (
             kode_t_promosi, nama_promosi, deskripsi, valid_from, valid_to, time_from, time_to, jenis_sumber,
             status_aktif, status_approval, budget_total, max_total_item, max_total_redeem_trx,
             redeem_mode, max_redeem_times_per_trx, max_redeem_per_customer, redeem_scope_per_customer,
             payment_scope, created_by, created_at, updated_by, updated_at
           )
           VALUES (
             @kode_t_promosi, @nama_promosi, @deskripsi, @valid_from, @valid_to, @time_from, @time_to,
             @jenis_sumber, @status_aktif, @status_approval, @budget_total, @max_total_item, @max_total_redeem_trx,
             @redeem_mode, @max_redeem_times_per_trx, @max_redeem_per_customer, @redeem_scope_per_customer,
             @payment_scope, @created_by, @created_at, @updated_by, @updated_at
           );`
        );

      await insertChildren(trx, kodePromosi, body);
      await trx.commit();
      return reply.code(201).send({ kode_t_promosi: kodePromosi });
    } catch (err) {
      await trx.rollback();
      fastify.log.error({ err }, "Failed create promosi");
      return reply.code(500).send({ message: "Gagal membuat promosi" });
    }
  });

  fastify.put("/:id", async (request, reply) => {
    const kode = String(request.params?.id || "").trim();
    if (!kode) return reply.code(400).send({ message: "kode promosi tidak valid" });

    const body = request.body || {};
    const header = normalizeHeader(body);
    const validationError = validateHeader(header);
    if (validationError) return reply.code(400).send({ message: validationError });

    const paymentMethods = Array.isArray(body.payment_methods) ? body.payment_methods : [];
    if (header.payment_scope === "SELECTED" && paymentMethods.length === 0) {
      return reply.code(400).send({ message: "payment_methods wajib diisi untuk payment_scope SELECTED" });
    }

    if (header.time_from && header.time_to && !header.max_redeem_per_customer) {
      header.max_redeem_per_customer = 1;
      header.redeem_scope_per_customer = header.redeem_scope_per_customer || "PER_DAY";
    }

    const trx = new sql.Transaction(pool);
    try {
      await trx.begin();

      const now = new Date();
      const updateRes = await trx
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .input("nama_promosi", sql.VarChar(200), header.nama_promosi)
        .input("deskripsi", sql.VarChar(255), header.deskripsi)
        .input("valid_from", sql.DateTime2, header.valid_from)
        .input("valid_to", sql.DateTime2, header.valid_to)
        .input("time_from", sql.VarChar(8), header.time_from)
        .input("time_to", sql.VarChar(8), header.time_to)
        .input("jenis_sumber", sql.VarChar(20), header.jenis_sumber)
        .input("status_aktif", sql.Bit, header.status_aktif)
        .input("budget_total", sql.Decimal(18, 2), header.budget_total)
        .input("max_total_item", sql.Int, header.max_total_item)
        .input("max_total_redeem_trx", sql.Int, header.max_total_redeem_trx)
        .input("redeem_mode", sql.VarChar(10), header.redeem_mode)
        .input("max_redeem_times_per_trx", sql.Int, header.max_redeem_times_per_trx)
        .input("max_redeem_per_customer", sql.Int, header.max_redeem_per_customer)
        .input("redeem_scope_per_customer", sql.VarChar(20), header.redeem_scope_per_customer)
        .input("payment_scope", sql.VarChar(10), header.payment_scope)
        .input("updated_by", sql.VarChar(100), header.updated_by)
        .input("updated_at", sql.DateTime2, now)
        .query(
          `UPDATE dbo.GWEN_t_promosi
           SET nama_promosi = @nama_promosi,
               deskripsi = @deskripsi,
               valid_from = @valid_from,
               valid_to = @valid_to,
               time_from = @time_from,
               time_to = @time_to,
               jenis_sumber = @jenis_sumber,
               status_aktif = @status_aktif,
               budget_total = @budget_total,
               max_total_item = @max_total_item,
               max_total_redeem_trx = @max_total_redeem_trx,
               redeem_mode = @redeem_mode,
               max_redeem_times_per_trx = @max_redeem_times_per_trx,
               max_redeem_per_customer = @max_redeem_per_customer,
               redeem_scope_per_customer = @redeem_scope_per_customer,
               payment_scope = @payment_scope,
               updated_by = @updated_by,
               updated_at = @updated_at
           WHERE kode_t_promosi = @kode_t_promosi;`
        );
      if (!updateRes.rowsAffected?.[0]) {
        await trx.rollback();
        return reply.code(404).send({ message: "Promosi tidak ditemukan" });
      }

      await deleteChildren(trx, kode);
      await insertChildren(trx, kode, body);
      await trx.commit();
      return reply.send({ kode_t_promosi: kode });
    } catch (err) {
      const originalErr = err;
      try {
        await trx.rollback();
      } catch (rollbackErr) {
        fastify.log.error({ err: rollbackErr }, "Failed rollback update promosi");
      }
      fastify.log.error({ err: originalErr }, "Failed update promosi");
      const message =
        originalErr?.originalError?.info?.message ||
        originalErr?.originalError?.message ||
        originalErr?.message ||
        "Gagal update promosi";
      return reply.code(500).send({ message });
    }
  });

  fastify.put("/:id/time", async (request, reply) => {
    const kode = String(request.params?.id || "").trim();
    if (!kode) return reply.code(400).send({ message: "kode promosi tidak valid" });

    const body = request.body || {};
    const timeFrom = parseTime(body.time_from);
    const timeTo = parseTime(body.time_to);
    if ((timeFrom && !timeTo) || (!timeFrom && timeTo)) {
      return reply.code(400).send({ message: "time_from dan time_to harus diisi berpasangan" });
    }
    if (timeFrom && timeTo && timeFrom > timeTo) {
      return reply.code(400).send({ message: "time_from tidak boleh lebih besar dari time_to" });
    }

    try {
      const res = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .input("time_from", sql.VarChar(8), timeFrom)
        .input("time_to", sql.VarChar(8), timeTo)
        .input("updated_by", sql.VarChar(100), String(body.updated_by || "Admin"))
        .input("updated_at", sql.DateTime2, new Date())
        .query(
          `UPDATE dbo.GWEN_t_promosi
           SET time_from = @time_from,
               time_to = @time_to,
               updated_by = @updated_by,
               updated_at = @updated_at
           WHERE kode_t_promosi = @kode_t_promosi;`
        );
      if (!res.rowsAffected?.[0]) {
        return reply.code(404).send({ message: "Promosi tidak ditemukan" });
      }
      return reply.send({ kode_t_promosi: kode, time_from: timeFrom, time_to: timeTo });
    } catch (err) {
      fastify.log.error({ err }, "Failed update promosi time");
      return reply.code(500).send({ message: "Gagal update jam promosi" });
    }
  });

  fastify.post("/:id/approve", async (request, reply) => {
    const kode = String(request.params?.id || "").trim();
    const body = request.body || {};
    const approvedBy = String(body.approved_by || "Admin").trim();
    const now = new Date();
    if (!kode) return reply.code(400).send({ message: "kode promosi tidak valid" });

    try {
      const res = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .input("approved_by", sql.VarChar(100), approvedBy)
        .input("approved_at", sql.DateTime2, now)
        .query(
          `UPDATE dbo.GWEN_t_promosi
           SET status_approval = 1,
               approved_by = @approved_by,
               approved_at = @approved_at,
               rejected_by = NULL,
               rejected_at = NULL
           WHERE kode_t_promosi = @kode_t_promosi;`
        );
      if (!res.rowsAffected?.[0]) {
        return reply.code(404).send({ message: "Promosi tidak ditemukan" });
      }
      return reply.send({ kode_t_promosi: kode, status_approval: 1 });
    } catch (err) {
      fastify.log.error({ err }, "Failed approve promosi");
      return reply.code(500).send({ message: "Gagal approve promosi" });
    }
  });

  fastify.post("/:id/reject", async (request, reply) => {
    const kode = String(request.params?.id || "").trim();
    const body = request.body || {};
    const rejectedBy = String(body.rejected_by || "Admin").trim();
    const note = body.catatan_approval ? String(body.catatan_approval) : null;
    const now = new Date();
    if (!kode) return reply.code(400).send({ message: "kode promosi tidak valid" });

    try {
      const res = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .input("rejected_by", sql.VarChar(100), rejectedBy)
        .input("rejected_at", sql.DateTime2, now)
        .input("catatan_approval", sql.VarChar(255), note)
        .query(
          `UPDATE dbo.GWEN_t_promosi
           SET status_approval = 2,
               rejected_by = @rejected_by,
               rejected_at = @rejected_at,
               catatan_approval = @catatan_approval
           WHERE kode_t_promosi = @kode_t_promosi;`
        );
      if (!res.rowsAffected?.[0]) {
        return reply.code(404).send({ message: "Promosi tidak ditemukan" });
      }
      return reply.send({ kode_t_promosi: kode, status_approval: 2 });
    } catch (err) {
      fastify.log.error({ err }, "Failed reject promosi");
      return reply.code(500).send({ message: "Gagal reject promosi" });
    }
  });

  fastify.post("/:id/archive", async (request, reply) => {
    const kode = String(request.params?.id || "").trim();
    const body = request.body || {};
    const archivedBy = String(body.archived_by || "Admin").trim();
    const note = body.archive_note ? String(body.archive_note) : null;
    const now = new Date();
    if (!kode) return reply.code(400).send({ message: "kode promosi tidak valid" });

    try {
      const res = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .input("archived_by", sql.VarChar(100), archivedBy)
        .input("archived_at", sql.DateTime2, now)
        .input("archive_note", sql.VarChar(255), note)
        .query(
          `UPDATE dbo.GWEN_t_promosi
           SET is_archived = 1,
               archived_by = @archived_by,
               archived_at = @archived_at,
               archive_note = @archive_note
           WHERE kode_t_promosi = @kode_t_promosi;`
        );
      if (!res.rowsAffected?.[0]) {
        return reply.code(404).send({ message: "Promosi tidak ditemukan" });
      }
      return reply.send({ kode_t_promosi: kode, is_archived: 1 });
    } catch (err) {
      fastify.log.error({ err }, "Failed archive promosi");
      return reply.code(500).send({ message: "Gagal archive promosi" });
    }
  });

  fastify.post("/:id/unarchive", async (request, reply) => {
    const kode = String(request.params?.id || "").trim();
    if (!kode) return reply.code(400).send({ message: "kode promosi tidak valid" });

    try {
      const res = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .query(
          `UPDATE dbo.GWEN_t_promosi
           SET is_archived = 0,
               archived_by = NULL,
               archived_at = NULL,
               archive_note = NULL
           WHERE kode_t_promosi = @kode_t_promosi;`
        );
      if (!res.rowsAffected?.[0]) {
        return reply.code(404).send({ message: "Promosi tidak ditemukan" });
      }
      return reply.send({ kode_t_promosi: kode, is_archived: 0 });
    } catch (err) {
      fastify.log.error({ err }, "Failed unarchive promosi");
      return reply.code(500).send({ message: "Gagal unarchive promosi" });
    }
  });

  fastify.post("/:id/reactivate", async (request, reply) => {
    const kode = String(request.params?.id || "").trim();
    if (!kode) return reply.code(400).send({ message: "kode promosi tidak valid" });

    const body = request.body || {};
    const updatedBy = String(body.updated_by || body.approved_by || "Admin").trim();
    const allowedUsers = new Set(["natalia", "yudha", "uphan"]);
    if (!allowedUsers.has(updatedBy.toLowerCase())) {
      return reply.code(403).send({ message: "Fitur ini hanya untuk username natalia, yudha, uphan" });
    }
    const now = new Date();

    try {
      const res = await pool
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .input("updated_by", sql.VarChar(100), updatedBy)
        .input("updated_at", sql.DateTime2, now)
        .input("approved_by", sql.VarChar(100), updatedBy)
        .input("approved_at", sql.DateTime2, now)
        .query(
          `UPDATE dbo.GWEN_t_promosi
           SET status_aktif = 1,
               status_approval = 1,
               approved_by = @approved_by,
               approved_at = @approved_at,
               rejected_by = NULL,
               rejected_at = NULL,
               catatan_approval = NULL,
               is_archived = 0,
               archived_by = NULL,
               archived_at = NULL,
               archive_note = NULL,
               updated_by = @updated_by,
               updated_at = @updated_at
           WHERE kode_t_promosi = @kode_t_promosi;`
        );
      if (!res.rowsAffected?.[0]) {
        return reply.code(404).send({ message: "Promosi tidak ditemukan" });
      }
      return reply.send({
        kode_t_promosi: kode,
        status_aktif: 1,
        status_approval: 1,
        is_archived: 0,
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed reactivate promosi");
      return reply.code(500).send({ message: "Gagal mengaktifkan kembali promosi" });
    }
  });

  fastify.post("/:id/sync-to-kasir", async (request, reply) => {
    const kode = String(request.params?.id || "").trim();
    if (!kode) return reply.code(400).send({ message: "kode promosi tidak valid" });

    try {
      const payload = await fetchPromoDetail(kode);
      if (!payload?.header) {
        return reply.code(404).send({ message: "Promosi tidak ditemukan" });
      }

      const results = [];
      for (const target of kasirTargets) {
        const targetPool = createKasirPool(target);
        try {
          await targetPool.connect();
          const trx = new sql.Transaction(targetPool);
          await trx.begin();
          try {
            await upsertPromoHeaderToTarget(trx, payload.header);
            await deleteChildren(trx, kode);
            await insertChildren(trx, kode, payload);
            await trx.commit();
            results.push({
              server: target.server,
              database: target.database,
              ok: true,
            });
          } catch (err) {
            await trx.rollback().catch(() => {});
            throw err;
          }
        } catch (err) {
          results.push({
            server: target.server,
            database: target.database,
            ok: false,
            error: err?.originalError?.info?.message || err?.message || "Gagal sync promosi",
          });
        } finally {
          await targetPool.close().catch(() => {});
        }
      }

      const hasFailure = results.some((row) => !row.ok);
      return reply.code(hasFailure ? 207 : 200).send({
        kode_t_promosi: kode,
        results,
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed sync promosi to kasir");
      return reply.code(500).send({ message: err.message || "Gagal sync promosi ke kasir" });
    }
  });

  fastify.delete("/:id", async (request, reply) => {
    const kode = String(request.params?.id || "").trim();
    if (!kode) return reply.code(400).send({ message: "kode promosi tidak valid" });
    const trx = new sql.Transaction(pool);
    try {
      await trx.begin();
      await deleteChildren(trx, kode);
      const res = await trx
        .request()
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .query(`DELETE FROM dbo.GWEN_t_promosi WHERE kode_t_promosi = @kode_t_promosi;`);
      if (!res.rowsAffected?.[0]) {
        await trx.rollback();
        return reply.code(404).send({ message: "Promosi tidak ditemukan" });
      }
      await trx.commit();
      return reply.send({ kode_t_promosi: kode });
    } catch (err) {
      await trx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed delete promosi");
      return reply.code(500).send({ message: "Gagal menghapus promosi" });
    }
  });

  fastify.post("/:id/banners", async (request, reply) => {
    const kode = String(request.params?.id || "").trim();
    const body = request.body || {};
    if (!kode) return reply.code(400).send({ message: "kode promosi tidak valid" });
    if (!body.banner_url) return reply.code(400).send({ message: "banner_url wajib diisi" });

    try {
      const kodeBanner = generateDetailCode("PBN");
      await pool
        .request()
        .input("kode_d_banner", sql.VarChar(50), kodeBanner)
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .input("is_show_tv", sql.Bit, body.is_show_tv === 0 ? 0 : 1)
        .input("tv_priority", sql.Int, body.tv_priority != null ? Number(body.tv_priority) : null)
        .input("banner_type", sql.VarChar(10), String(body.banner_type || "IMAGE"))
        .input("banner_url", sql.VarChar(500), String(body.banner_url))
        .input("banner_title", sql.VarChar(120), body.banner_title ? String(body.banner_title) : null)
        .input("banner_subtitle", sql.VarChar(200), body.banner_subtitle ? String(body.banner_subtitle) : null)
        .input("banner_cta", sql.VarChar(80), body.banner_cta ? String(body.banner_cta) : null)
        .input("banner_valid_from", sql.DateTime2, parseDate(body.banner_valid_from))
        .input("banner_valid_to", sql.DateTime2, parseDate(body.banner_valid_to))
        .input("is_active", sql.Bit, body.is_active === 0 ? 0 : 1)
        .input("created_by", sql.VarChar(100), String(body.created_by || "Admin"))
        .query(
          `INSERT INTO dbo.GWEN_d_promosi_banner
           (kode_d_banner, kode_t_promosi, is_show_tv, tv_priority, banner_type, banner_url,
            banner_title, banner_subtitle, banner_cta, banner_valid_from, banner_valid_to, is_active, created_by)
           VALUES (@kode_d_banner, @kode_t_promosi, @is_show_tv, @tv_priority, @banner_type, @banner_url,
                   @banner_title, @banner_subtitle, @banner_cta, @banner_valid_from, @banner_valid_to,
                   @is_active, @created_by);`
        );
      return reply.code(201).send({ kode_d_banner: kodeBanner });
    } catch (err) {
      fastify.log.error({ err }, "Failed add banner promosi");
      return reply.code(500).send({ message: "Gagal menambahkan banner" });
    }
  });

  fastify.delete("/:id/banners/:bannerId", async (request, reply) => {
    const kode = String(request.params?.id || "").trim();
    const bannerId = String(request.params?.bannerId || "").trim();
    if (!kode || !bannerId) return reply.code(400).send({ message: "param tidak valid" });

    try {
      const res = await pool
        .request()
        .input("kode_d_banner", sql.VarChar(50), bannerId)
        .input("kode_t_promosi", sql.VarChar(50), kode)
        .query(
          `UPDATE dbo.GWEN_d_promosi_banner
           SET is_active = 0
           WHERE kode_d_banner = @kode_d_banner AND kode_t_promosi = @kode_t_promosi;`
        );
      if (!res.rowsAffected?.[0]) {
        return reply.code(404).send({ message: "Banner tidak ditemukan" });
      }
      return reply.send({ kode_d_banner: bannerId, is_active: 0 });
    } catch (err) {
      fastify.log.error({ err }, "Failed disable banner promosi");
      return reply.code(500).send({ message: "Gagal menonaktifkan banner" });
    }
  });
}
