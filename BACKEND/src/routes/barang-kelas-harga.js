export default async function barangKelasHargaRoutes(fastify) {
  const { sql, pool } = fastify.mssql;
  const now = () => new Date();
  const kasirTargets = [
    { label: "Kasir 1", server: "gwenkasir1\\SQLEXPRESS", database: "db_gwen_kasir1" },
    { label: "Kasir 2", server: "gwenkasir2\\SQLEXPRESS", database: "db_gwen_kasir2" },
    { label: "Kasir 3", server: "gwenkasir3\\SQLEXPRESS", database: "db_gwen_kasir3" },
  ];

  const createKasirPool = (target) =>
    new sql.ConnectionPool({
      server: target.server,
      user: "sa",
      password: "resmi12",
      database: target.database,
      requestTimeout: 30000,
      connectionTimeout: 10000,
      pool: {
        max: 1,
        min: 0,
        idleTimeoutMillis: 10000,
      },
      options: {
        encrypt: false,
        trustServerCertificate: true,
        useUTC: true,
      },
    });

  const generateDetailCode = (prefix, index = 1) => {
    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    const ms = String(date.getMilliseconds()).padStart(3, "0");
    const idx = String(index).padStart(3, "0");
    return `${prefix}.${yy}${mm}${dd}${hh}${mi}${ss}${ms}${idx}`;
  };

  const calcRasio = (harga, hargaBeli) => {
    const base = Number(hargaBeli ?? 0);
    const val = Number(harga ?? 0);
    if (!base) return null;
    return Number((((val - base) / base) * 100).toFixed(2));
  };

  const innerSelectColumns = `
    h.kode_mn_harga_jual AS id,
    b.id_barang,
    h.id_kelas_harga,
    h.harga_1,
    h.harga_3,
    h.harga_6,
    h.harga_12,
    h.berlaku_mulai,
    CAST(NULL AS DATETIME2) AS berlaku_sampai,
    h.is_active,
    h.updated_by,
    h.updated_at,
    b.kode_barang,
    b.kode_merk,
    mk.nama_merk,
    b.nama AS nama_barang,
    v.kode_barang_variant,
    v.nama_varian,
    v.kode_varian,
    v.barcode_varian,
    v.harga_beli_sat_1,
    v.het_sat_1,
    v.hpp_avg_sat_1,
    ISNULL(sg.stok_gudang, 0) AS stok_gudang,
    ISNULL(st.stok_toko, 0) AS stok_toko,
    kh.kode_kelas_harga,
    kh.nama AS nama_kelas,
    kh.channel_code,
    ISNULL(b.status, 0) AS status_barang,
    ISNULL(v.is_aktif, 0) AS status_varian,
    req.last_request_status,
    req.last_request_at
  `;
  const outerSelectColumns = `
    id,
    id_barang,
    id_kelas_harga,
    harga_1,
    harga_3,
    harga_6,
    harga_12,
    berlaku_mulai,
    berlaku_sampai,
    is_active,
    updated_by,
    updated_at,
    kode_barang,
    kode_merk,
    nama_merk,
    nama_barang,
    kode_barang_variant,
    nama_varian,
    kode_varian,
    barcode_varian,
    harga_beli_sat_1,
    het_sat_1,
    hpp_avg_sat_1,
    stok_gudang,
    stok_toko,
    kode_kelas_harga,
    nama_kelas,
    channel_code,
    status_barang,
    status_varian,
    last_request_status,
    last_request_at
  `;
  const outerSelectColumnsWithAlias = outerSelectColumns
    .split(",")
    .map((col) => col.trim())
    .filter(Boolean)
    .map((col) => `r.${col}`)
    .join(",\n    ");

  fastify.get("/", async (_req, reply) => {
    try {
      const result = await pool
        .request()
        .query(
          `WITH ranked AS (
            SELECT
              ${innerSelectColumns},
              ROW_NUMBER() OVER (
                PARTITION BY h.kode_barang_variant, h.id_kelas_harga
                ORDER BY h.updated_at DESC, h.berlaku_mulai DESC, h.kode_mn_harga_jual DESC
              ) AS rn
            FROM dbo.GWEN_mn_barang_harga_jual_variant h
            LEFT JOIN dbo.m_barang_varian v ON v.kode_barang_variant = h.kode_barang_variant
            LEFT JOIN dbo.m_barang b ON b.id_barang = v.id_barang
            OUTER APPLY (
              SELECT SUM(g.stok) AS stok_gudang
              FROM dbo.GWEN_mn_barang_gudang_variant g
              WHERE g.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
            ) sg
            OUTER APPLY (
              SELECT SUM(t.stok_available) AS stok_toko
              FROM dbo.GWEN_mn_barang_toko_variant t
              WHERE t.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
            ) st
            OUTER APPLY (
              SELECT CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS INT) END AS kode_merk_int
            ) mapm
            LEFT JOIN dbo.m_merk mk ON mk.id_merk = mapm.kode_merk_int
            LEFT JOIN dbo.m_kelas_harga kh ON kh.id_kelas_harga = h.id_kelas_harga
            OUTER APPLY (
              SELECT TOP 1
                d.status_item AS last_request_status,
                t.requested_at AS last_request_at
              FROM dbo.GWEN_d_harga_jual_request d
              JOIN dbo.GWEN_t_harga_jual_request t
                ON t.kode_t_request = d.kode_t_request
              WHERE d.kode_barang_variant = h.kode_barang_variant
                AND d.id_kelas_harga = h.id_kelas_harga
              ORDER BY t.requested_at DESC, d.kode_d_request DESC
            ) req
          )
          SELECT ${outerSelectColumns}
          FROM ranked
          WHERE rn = 1
          ORDER BY berlaku_mulai DESC, updated_at DESC;`
        );
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch barang kelas harga");
      return reply.code(500).send({ message: "Failed to fetch barang kelas harga" });
    }
  });

  fastify.get("/recent", async (request, reply) => {
    const startRaw = String(request.query?.start || "").trim();
    const endRaw = String(request.query?.end || "").trim();
    const nowDate = new Date();

    let startDate = startRaw ? new Date(startRaw) : new Date(nowDate);
    if (!startRaw) startDate.setDate(startDate.getDate() - 7);
    let endDate = endRaw ? new Date(endRaw) : new Date(nowDate);

    if (Number.isNaN(startDate.getTime())) {
      startDate = new Date(nowDate);
      startDate.setDate(startDate.getDate() - 7);
    }
    if (Number.isNaN(endDate.getTime())) {
      endDate = new Date(nowDate);
    }

    if (startDate > endDate) {
      const tmp = startDate;
      startDate = endDate;
      endDate = tmp;
    }

    const endExclusive = new Date(endDate);
    endExclusive.setDate(endExclusive.getDate() + 1);

    try {
      const req = pool.request();
      req.input("start_date", sql.DateTime2, startDate);
      req.input("end_date", sql.DateTime2, endExclusive);

      const result = await req.query(
        `WITH approved_req AS (
           SELECT
             t.kode_t_request,
             t.approved_by,
             t.approved_at
           FROM dbo.GWEN_t_harga_jual_request t
           WHERE t.approved_at >= @start_date
             AND t.approved_at < @end_date
         ),
         change_ranked AS (
           SELECT
             h.kode_barang_variant,
             h.id_kelas_harga,
             h.changed_at,
             h.changed_by,
             h.kode_t_request,
             ROW_NUMBER() OVER (
               PARTITION BY h.kode_barang_variant, h.id_kelas_harga
               ORDER BY h.changed_at DESC, h.kode_h_harga_jual DESC
             ) AS rn
           FROM dbo.GWEN_h_harga_jual_variant h
           JOIN approved_req ar
             ON ar.kode_t_request = h.kode_t_request
         ),
         latest_change AS (
           SELECT *
           FROM change_ranked
           WHERE rn = 1
         ),
         ranked AS (
           SELECT
             ${innerSelectColumns},
             ROW_NUMBER() OVER (
               PARTITION BY h.kode_barang_variant, h.id_kelas_harga
               ORDER BY h.updated_at DESC, h.berlaku_mulai DESC, h.kode_mn_harga_jual DESC
             ) AS rn
           FROM dbo.GWEN_mn_barang_harga_jual_variant h
           LEFT JOIN dbo.m_barang_varian v ON v.kode_barang_variant = h.kode_barang_variant
           LEFT JOIN dbo.m_barang b ON b.id_barang = v.id_barang
           OUTER APPLY (
             SELECT SUM(g.stok) AS stok_gudang
             FROM dbo.GWEN_mn_barang_gudang_variant g
             WHERE g.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
           ) sg
           OUTER APPLY (
             SELECT SUM(t.stok_available) AS stok_toko
             FROM dbo.GWEN_mn_barang_toko_variant t
             WHERE t.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
           ) st
           OUTER APPLY (
             SELECT CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS INT) END AS kode_merk_int
           ) mapm
           LEFT JOIN dbo.m_merk mk ON mk.id_merk = mapm.kode_merk_int
           LEFT JOIN dbo.m_kelas_harga kh ON kh.id_kelas_harga = h.id_kelas_harga
           OUTER APPLY (
             SELECT TOP 1
               d.status_item AS last_request_status,
               t.requested_at AS last_request_at
             FROM dbo.GWEN_d_harga_jual_request d
             JOIN dbo.GWEN_t_harga_jual_request t
               ON t.kode_t_request = d.kode_t_request
             WHERE d.kode_barang_variant = h.kode_barang_variant
               AND d.id_kelas_harga = h.id_kelas_harga
             ORDER BY t.requested_at DESC, d.kode_d_request DESC
           ) req
         )
         SELECT
           ${outerSelectColumnsWithAlias},
           lc.changed_at,
           lc.changed_by,
           lc.kode_t_request,
           ar.approved_by,
           ar.approved_at
         FROM ranked r
         JOIN latest_change lc
           ON lc.kode_barang_variant = r.kode_barang_variant
          AND lc.id_kelas_harga = r.id_kelas_harga
         JOIN approved_req ar
           ON ar.kode_t_request = lc.kode_t_request
         WHERE r.rn = 1
         ORDER BY ar.approved_at DESC, lc.changed_at DESC, r.updated_at DESC;`
      );

      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch recent harga jual changes");
      return reply.code(500).send({ message: "Failed to fetch recent harga jual changes" });
    }
  });

  fastify.get("/summary", async (_req, reply) => {
    try {
      const result = await pool.request().query(
        `
        WITH latest AS (
          SELECT
            h.kode_barang_variant,
            h.id_kelas_harga,
            h.is_active,
            ROW_NUMBER() OVER (
              PARTITION BY h.kode_barang_variant, h.id_kelas_harga
              ORDER BY h.updated_at DESC, h.berlaku_mulai DESC, h.kode_mn_harga_jual DESC
            ) AS rn
          FROM dbo.GWEN_mn_barang_harga_jual_variant h
        ),
        latest_active AS (
          SELECT kode_barang_variant, id_kelas_harga, is_active
          FROM latest
          WHERE rn = 1
        )
        SELECT
          COALESCE(COUNT(DISTINCT CASE WHEN id_kelas_harga = 1 AND is_active = 1 THEN kode_barang_variant END), 0) AS kelas1_active_count,
          COALESCE(COUNT(DISTINCT CASE WHEN is_active = 1 THEN kode_barang_variant END), 0) AS varian_with_harga,
          (
            SELECT COUNT(DISTINCT v.kode_barang_variant)
            FROM dbo.m_barang_varian v
            WHERE ISNULL(v.is_aktif, 1) = 1
          ) AS total_varian,
          (
            SELECT COUNT(DISTINCT p.kode_barang_variant)
            FROM dbo.GWEN_d_pengadaan p
            WHERE ISNULL(p.is_active, 1) = 1
          ) AS total_pengadaan_varian,
          (
            SELECT COUNT(DISTINCT p.kode_barang_variant)
            FROM dbo.GWEN_d_pengadaan p
            JOIN latest_active la
              ON la.kode_barang_variant = p.kode_barang_variant
             AND la.is_active = 1
            WHERE ISNULL(p.is_active, 1) = 1
          ) AS pengadaan_varian_with_harga
        FROM latest_active;
        `
      );
      return reply.send(result.recordset?.[0] || {});
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch harga jual summary");
      return reply.code(500).send({ message: "Failed to fetch harga jual summary" });
    }
  });

  fastify.get("/coverage", async (_req, reply) => {
    try {
      const result = await pool.request().query(
        `
        WITH latest AS (
          SELECT
            h.kode_barang_variant,
            h.id_kelas_harga,
            h.is_active,
            ROW_NUMBER() OVER (
              PARTITION BY h.kode_barang_variant, h.id_kelas_harga
              ORDER BY h.updated_at DESC, h.berlaku_mulai DESC, h.kode_mn_harga_jual DESC
            ) AS rn
          FROM dbo.GWEN_mn_barang_harga_jual_variant h
        ),
        latest_active AS (
          SELECT kode_barang_variant, id_kelas_harga, is_active
          FROM latest
          WHERE rn = 1
        ),
        harga_active AS (
          SELECT DISTINCT kode_barang_variant
          FROM latest_active
          WHERE is_active = 1
        ),
        pengadaan_active AS (
          SELECT DISTINCT kode_barang_variant
          FROM dbo.GWEN_d_pengadaan
          WHERE ISNULL(is_active, 1) = 1
        )
        SELECT
          v.kode_barang_variant,
          b.kode_barang,
          b.nama AS nama_barang,
          v.nama_varian,
          mk.nama_merk,
          ISNULL(v.is_aktif, 1) AS status_varian,
          CASE WHEN ha.kode_barang_variant IS NULL THEN 0 ELSE 1 END AS sudah_setting_harga,
          CASE WHEN pa.kode_barang_variant IS NULL THEN 0 ELSE 1 END AS ada_di_pengadaan,
          ISNULL(sg.stok_gudang, 0) AS stok_gudang,
          ISNULL(st.stok_toko, 0) AS stok_toko,
          req.last_request_status,
          req.last_request_at
        FROM dbo.m_barang_varian v
        JOIN dbo.m_barang b ON b.id_barang = v.id_barang
        OUTER APPLY (
          SELECT CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS INT) END AS kode_merk_int
        ) mapm2
        LEFT JOIN dbo.m_merk mk ON mk.id_merk = mapm2.kode_merk_int
        LEFT JOIN harga_active ha
          ON ha.kode_barang_variant = v.kode_barang_variant
        LEFT JOIN pengadaan_active pa
          ON pa.kode_barang_variant = v.kode_barang_variant
        OUTER APPLY (
          SELECT SUM(g.stok) AS stok_gudang
          FROM dbo.GWEN_mn_barang_gudang_variant g
          WHERE g.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
        ) sg
        OUTER APPLY (
          SELECT SUM(t.stok_available) AS stok_toko
          FROM dbo.GWEN_mn_barang_toko_variant t
          WHERE t.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
        ) st
        OUTER APPLY (
          SELECT TOP 1
            d.status_item AS last_request_status,
            t.requested_at AS last_request_at
          FROM dbo.GWEN_d_harga_jual_request d
          JOIN dbo.GWEN_t_harga_jual_request t
            ON t.kode_t_request = d.kode_t_request
          WHERE d.kode_barang_variant = v.kode_barang_variant
          ORDER BY t.requested_at DESC, d.kode_d_request DESC
        ) req
        WHERE ISNULL(v.is_aktif, 1) = 1
        ORDER BY b.nama ASC, v.nama_varian ASC;
        `
      );
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch harga jual coverage");
      return reply.code(500).send({ message: "Failed to fetch harga jual coverage" });
    }
  });

  fastify.get("/history", async (request, reply) => {
    const kodeBarangVariant = String(request.query?.kode_barang_variant || "").trim();
    const idKelasHarga = request.query?.id_kelas_harga ? Number(request.query.id_kelas_harga) : null;
    if (!kodeBarangVariant) {
      return reply.code(400).send({ message: "kode_barang_variant wajib diisi" });
    }
    try {
      const req = pool.request();
      req.input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant);
      if (idKelasHarga) req.input("id_kelas_harga", sql.Int, idKelasHarga);

      const filterKelas = idKelasHarga ? "AND h.id_kelas_harga = @id_kelas_harga" : "";
      const result = await req.query(
        `SELECT TOP (300)
          h.kode_h_harga_jual,
          h.kode_barang_variant,
          h.id_kelas_harga,
          kh.kode_kelas_harga,
          kh.nama AS nama_kelas,
          kh.channel_code,
          h.harga_1,
          h.harga_3,
          h.harga_6,
          h.harga_12,
          h.harga_beli_snapshot,
          h.hpp_snapshot,
          h.rasio_1,
          h.rasio_3,
          h.rasio_6,
          h.rasio_12,
          h.kode_t_request,
          h.changed_by,
          h.changed_at,
          h.catatan
        FROM dbo.GWEN_h_harga_jual_variant h
        LEFT JOIN dbo.m_kelas_harga kh ON kh.id_kelas_harga = h.id_kelas_harga
        WHERE h.kode_barang_variant = @kode_barang_variant
          ${filterKelas}
        ORDER BY h.changed_at DESC, h.kode_h_harga_jual DESC;`
      );
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch history harga jual");
      return reply.code(500).send({ message: "Failed to fetch history harga jual" });
    }
  });

  fastify.get("/kasir-prices", async (request, reply) => {
    const kodeBarangVariant = String(request.query?.kode_barang_variant || "").trim();
    const barcodeVarian = String(request.query?.barcode_varian || "").trim();

    if (!kodeBarangVariant && !barcodeVarian) {
      return reply.code(400).send({ message: "kode_barang_variant atau barcode_varian wajib diisi" });
    }

    const results = [];
    for (const target of kasirTargets) {
      const targetPool = createKasirPool(target);
      try {
        await targetPool.connect();
        const result = await targetPool
          .request()
          .input("kode_barang_variant", sql.VarChar(100), kodeBarangVariant || null)
          .input("barcode_varian", sql.VarChar(100), barcodeVarian || null)
          .query(`
            WITH matched AS (
              SELECT TOP 1
                v.kode_barang_variant,
                v.barcode_varian,
                v.nama_varian,
                b.kode_barang,
                b.nama AS nama_barang
              FROM dbo.m_barang_varian v
              LEFT JOIN dbo.m_barang b ON b.id_barang = v.id_barang
              WHERE (@kode_barang_variant IS NOT NULL AND v.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT)
                 OR (@barcode_varian IS NOT NULL AND v.barcode_varian COLLATE DATABASE_DEFAULT = @barcode_varian COLLATE DATABASE_DEFAULT)
              ORDER BY v.updated_at DESC, v.id_varian DESC
            ),
            ranked AS (
              SELECT
                m.kode_barang,
                m.nama_barang,
                m.kode_barang_variant,
                m.barcode_varian,
                m.nama_varian,
                h.kode_mn_harga_jual,
                h.id_kelas_harga,
                kh.kode_kelas_harga,
                kh.channel_code,
                kh.nama AS nama_kelas,
                h.harga_1,
                h.harga_3,
                h.harga_6,
                h.harga_12,
                h.is_active,
                h.updated_by,
                h.updated_at,
                ROW_NUMBER() OVER (
                  PARTITION BY h.id_kelas_harga
                  ORDER BY h.updated_at DESC, h.berlaku_mulai DESC, h.kode_mn_harga_jual DESC
                ) AS rn
              FROM matched m
              LEFT JOIN dbo.GWEN_mn_barang_harga_jual_variant h
                ON h.kode_barang_variant COLLATE DATABASE_DEFAULT = m.kode_barang_variant COLLATE DATABASE_DEFAULT
              LEFT JOIN dbo.m_kelas_harga kh ON kh.id_kelas_harga = h.id_kelas_harga
            )
            SELECT
              kode_barang,
              nama_barang,
              kode_barang_variant,
              barcode_varian,
              nama_varian,
              kode_mn_harga_jual,
              id_kelas_harga,
              kode_kelas_harga,
              channel_code,
              nama_kelas,
              harga_1,
              harga_3,
              harga_6,
              harga_12,
              is_active,
              updated_by,
              updated_at
            FROM ranked
            WHERE rn = 1 OR id_kelas_harga IS NULL
            ORDER BY id_kelas_harga ASC;
          `);

        results.push({
          label: target.label,
          server: target.server,
          database: target.database,
          status: "ok",
          rows: result.recordset || [],
        });
      } catch (err) {
        fastify.log.warn({ err, target }, "Failed to fetch kasir price");
        results.push({
          label: target.label,
          server: target.server,
          database: target.database,
          status: "error",
          message: err?.message || "Gagal koneksi/query kasir",
          rows: [],
        });
      } finally {
        await targetPool.close().catch(() => {});
      }
    }

    return reply.send(results);
  });

  fastify.post("/kasir-prices/sync", async (request, reply) => {
    const body = request.body || {};
    const kodeBarangVariant = String(body.kode_barang_variant || "").trim();
    const database = String(body.database || "").trim();
    const updatedBy = String(body.updated_by || "Admin").trim() || "Admin";
    const target = kasirTargets.find((item) => item.database === database);

    if (!kodeBarangVariant) {
      return reply.code(400).send({ message: "kode_barang_variant wajib diisi" });
    }
    if (!target) {
      return reply.code(400).send({ message: "Database kasir tidak valid" });
    }

    try {
      const centralRes = await pool
        .request()
        .input("kode_barang_variant", sql.VarChar(100), kodeBarangVariant)
        .query(`
          WITH ranked AS (
            SELECT
              h.kode_barang_variant,
              h.id_kelas_harga,
              h.harga_1,
              h.harga_3,
              h.harga_6,
              h.harga_12,
              h.berlaku_mulai,
              h.is_active,
              ROW_NUMBER() OVER (
                PARTITION BY h.id_kelas_harga
                ORDER BY h.updated_at DESC, h.berlaku_mulai DESC, h.kode_mn_harga_jual DESC
              ) AS rn
            FROM dbo.GWEN_mn_barang_harga_jual_variant h
            WHERE h.kode_barang_variant = @kode_barang_variant
          )
          SELECT
            kode_barang_variant,
            id_kelas_harga,
            harga_1,
            harga_3,
            harga_6,
            harga_12,
            berlaku_mulai,
            is_active
          FROM ranked
          WHERE rn = 1
          ORDER BY id_kelas_harga;
        `);

      const centralRows = centralRes.recordset || [];
      if (!centralRows.length) {
        return reply.code(404).send({ message: "Harga pusat tidak ditemukan" });
      }

      const targetPool = createKasirPool(target);
      await targetPool.connect();
      const tx = new sql.Transaction(targetPool);
      try {
        await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
        const nowDate = new Date();
        let count = 0;

        for (let idx = 0; idx < centralRows.length; idx += 1) {
          const row = centralRows[idx];
          const existingRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(100), kodeBarangVariant)
            .input("id_kelas_harga", sql.Int, Number(row.id_kelas_harga))
            .query(`
              SELECT TOP 1 kode_mn_harga_jual
              FROM dbo.GWEN_mn_barang_harga_jual_variant
              WHERE kode_barang_variant = @kode_barang_variant
                AND id_kelas_harga = @id_kelas_harga
              ORDER BY updated_at DESC, berlaku_mulai DESC, kode_mn_harga_jual DESC;
            `);

          const req = new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(100), kodeBarangVariant)
            .input("id_kelas_harga", sql.Int, Number(row.id_kelas_harga))
            .input("harga_1", sql.Decimal(20, 2), row.harga_1 ?? null)
            .input("harga_3", sql.Decimal(20, 2), row.harga_3 ?? null)
            .input("harga_6", sql.Decimal(20, 2), row.harga_6 ?? null)
            .input("harga_12", sql.Decimal(20, 2), row.harga_12 ?? null)
            .input("berlaku_mulai", sql.DateTime2, row.berlaku_mulai || nowDate)
            .input("is_active", sql.Int, Number(row.is_active) === 1 ? 1 : 0)
            .input("updated_by", sql.VarChar(100), updatedBy)
            .input("updated_at", sql.DateTime2, nowDate);

          if (existingRes.recordset?.length) {
            await req
              .input("kode_mn_harga_jual", sql.VarChar(50), existingRes.recordset[0].kode_mn_harga_jual)
              .query(`
                UPDATE dbo.GWEN_mn_barang_harga_jual_variant
                SET harga_1 = @harga_1,
                    harga_3 = @harga_3,
                    harga_6 = @harga_6,
                    harga_12 = @harga_12,
                    berlaku_mulai = @berlaku_mulai,
                    is_active = @is_active,
                    updated_by = @updated_by,
                    updated_at = @updated_at
                WHERE kode_mn_harga_jual = @kode_mn_harga_jual;
              `);
          } else {
            await req
              .input("kode_mn_harga_jual", sql.VarChar(50), generateDetailCode("MHJ", idx + 1))
              .query(`
                INSERT INTO dbo.GWEN_mn_barang_harga_jual_variant (
                  kode_mn_harga_jual,
                  kode_barang_variant,
                  id_kelas_harga,
                  harga_1,
                  harga_3,
                  harga_6,
                  harga_12,
                  berlaku_mulai,
                  is_active,
                  updated_by,
                  updated_at
                ) VALUES (
                  @kode_mn_harga_jual,
                  @kode_barang_variant,
                  @id_kelas_harga,
                  @harga_1,
                  @harga_3,
                  @harga_6,
                  @harga_12,
                  @berlaku_mulai,
                  @is_active,
                  @updated_by,
                  @updated_at
                );
              `);
          }
          count += 1;
        }

        await tx.commit();
        await targetPool.close().catch(() => {});
        return reply.send({ message: "Harga kasir tersinkron", count, target: target.label });
      } catch (err) {
        await tx.rollback().catch(() => {});
        await targetPool.close().catch(() => {});
        throw err;
      }
    } catch (err) {
      fastify.log.error({ err }, "Failed sync kasir price");
      return reply.code(500).send({ message: err?.message || "Gagal sinkron harga kasir" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    if (!body.id_barang || !body.id_kelas_harga || !body.berlaku_mulai) {
      return reply.code(400).send({ message: "id_barang, id_kelas_harga, dan berlaku_mulai wajib diisi" });
    }
    try {
      const req = new sql.Request(pool);
      req.input("id_barang", sql.BigInt, Number(body.id_barang));
      req.input("id_kelas_harga", sql.BigInt, Number(body.id_kelas_harga));
      req.input("harga_1", sql.Decimal(18, 2), toDecimal(body.harga_1, 0));
      req.input("harga_3", sql.Decimal(18, 2), toDecimal(body.harga_3, 0));
      req.input("harga_6", sql.Decimal(18, 2), toDecimal(body.harga_6, 0));
      req.input("harga_12", sql.Decimal(18, 2), toDecimal(body.harga_12, 0));
      req.input("berlaku_mulai", sql.DateTime2, new Date(body.berlaku_mulai));
      req.input("berlaku_sampai", sql.DateTime2, body.berlaku_sampai ? new Date(body.berlaku_sampai) : null);
      req.input("is_active", sql.Bit, body.is_active ?? 1);
      req.input("created_by", sql.VarChar(100), body.created_by || "Admin");
      req.input("created_at", sql.DateTime2, body.created_at || now());
      req.input("updated_by", sql.VarChar(100), body.updated_by || body.created_by || "Admin");
      req.input("updated_at", sql.DateTime2, body.updated_at || now());

      const insertRes = await req.query(`
        INSERT INTO dbo.m_barang_harga_jual (
          id_barang, id_kelas_harga,
          harga_1, harga_3, harga_6, harga_12,
          berlaku_mulai, berlaku_sampai, is_active,
          created_by, created_at, updated_by, updated_at
        )
        OUTPUT INSERTED.id
        VALUES (
          @id_barang, @id_kelas_harga,
          @harga_1, @harga_3, @harga_6, @harga_12,
          @berlaku_mulai, @berlaku_sampai, @is_active,
          @created_by, @created_at, @updated_by, @updated_at
        );
      `);

      return reply.code(201).send({
        id: insertRes.recordset?.[0]?.id,
        ...body,
      });
    } catch (err) {
      if (err.number === 2627) {
        return reply.code(409).send({ message: "Data dengan kombinasi sama sudah ada" });
      }
      fastify.log.error({ err }, "Failed to create barang kelas harga");
      return reply.code(500).send({ message: "Failed to create barang kelas harga" });
    }
  });

  fastify.put("/live-edit", async (request, reply) => {
    const body = request.body || {};
    const kodeBarangVariant = String(body.kode_barang_variant || "").trim();
    const idKelasHarga = body.id_kelas_harga ? Number(body.id_kelas_harga) : null;
    const updatedBy = String(body.updated_by || "Admin").trim() || "Admin";
    const harga1 = body.harga_1;
    const harga3 = body.harga_3;
    const harga6 = body.harga_6;
    const harga12 = body.harga_12;
    const hetSat1 = body.het_sat_1;
    const nextIsActive = body.is_active;

    if (!kodeBarangVariant) {
      return reply.code(400).send({ message: "kode_barang_variant wajib diisi" });
    }
    if (idKelasHarga === null && hetSat1 === undefined) {
      return reply.code(400).send({ message: "id_kelas_harga wajib diisi untuk update harga" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
      const nowDate = new Date();

      if (hetSat1 !== undefined) {
        await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
          .input("het_sat_1", sql.Decimal(20, 2), hetSat1 === "" ? null : Number(hetSat1))
          .input("updated_by", sql.VarChar(100), updatedBy)
          .input("updated_at", sql.DateTime2, nowDate)
          .query(
            `UPDATE dbo.m_barang_varian
             SET het_sat_1 = @het_sat_1,
                 updated_by = @updated_by,
                 updated_at = @updated_at
             WHERE kode_barang_variant = @kode_barang_variant;`
          );
      }

      if (idKelasHarga !== null) {
        if (nextIsActive !== undefined && harga1 === undefined && harga3 === undefined && harga6 === undefined && harga12 === undefined) {
          const latestRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
            .input("id_kelas_harga", sql.Int, idKelasHarga)
            .query(
              `SELECT TOP 1 kode_mn_harga_jual
               FROM dbo.GWEN_mn_barang_harga_jual_variant
               WHERE kode_barang_variant = @kode_barang_variant
                 AND id_kelas_harga = @id_kelas_harga
               ORDER BY updated_at DESC, berlaku_mulai DESC, kode_mn_harga_jual DESC;`
            );

          if (!latestRes.recordset?.length) {
            await tx.rollback();
            return reply.code(404).send({ message: "Data harga jual tidak ditemukan" });
          }

          await new sql.Request(tx)
            .input("is_active", sql.Int, Number(nextIsActive) === 1 ? 1 : 0)
            .input("updated_by", sql.VarChar(100), updatedBy)
            .input("updated_at", sql.DateTime2, nowDate)
            .input("kode_mn_harga_jual", sql.VarChar(50), latestRes.recordset[0].kode_mn_harga_jual)
            .query(
              `UPDATE dbo.GWEN_mn_barang_harga_jual_variant
               SET is_active = @is_active,
                   updated_by = @updated_by,
                   updated_at = @updated_at
               WHERE kode_mn_harga_jual = @kode_mn_harga_jual;`
            );

          await tx.commit();
          return reply.send({ message: "Status harga jual saved" });
        }

        const varRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
          .query(
            `SELECT TOP 1 harga_beli_sat_1, hpp_avg_sat_1
             FROM dbo.m_barang_varian
             WHERE kode_barang_variant = @kode_barang_variant;`
          );
        const varRow = varRes.recordset?.[0] || {};
        const hargaBeli = varRow.harga_beli_sat_1 ?? null;
        const hpp = varRow.hpp_avg_sat_1 ?? null;

        const activeRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
          .input("id_kelas_harga", sql.Int, idKelasHarga)
          .query(
            `SELECT TOP 1 kode_mn_harga_jual
             FROM dbo.GWEN_mn_barang_harga_jual_variant
             WHERE kode_barang_variant = @kode_barang_variant
               AND id_kelas_harga = @id_kelas_harga
               AND is_active = 1
             ORDER BY updated_at DESC, kode_mn_harga_jual DESC;`
          );

        if (activeRes.recordset?.length) {
          await new sql.Request(tx)
            .input("harga_1", sql.Decimal(20, 2), harga1 === "" ? null : Number(harga1))
            .input("harga_3", sql.Decimal(20, 2), harga3 === "" ? null : Number(harga3))
            .input("harga_6", sql.Decimal(20, 2), harga6 === "" ? null : Number(harga6))
            .input("harga_12", sql.Decimal(20, 2), harga12 === "" ? null : Number(harga12))
            .input("updated_by", sql.VarChar(100), updatedBy)
            .input("updated_at", sql.DateTime2, nowDate)
            .input("kode_mn_harga_jual", sql.VarChar(50), activeRes.recordset[0].kode_mn_harga_jual)
            .query(
              `UPDATE dbo.GWEN_mn_barang_harga_jual_variant
               SET harga_1 = @harga_1,
                   harga_3 = @harga_3,
                   harga_6 = @harga_6,
                   harga_12 = @harga_12,
                   updated_by = @updated_by,
                   updated_at = @updated_at,
                   berlaku_mulai = ISNULL(berlaku_mulai, @updated_at)
               WHERE kode_mn_harga_jual = @kode_mn_harga_jual;`
            );
        } else {
          const kodeMn = generateDetailCode("MHJ", 1);
          await new sql.Request(tx)
            .input("kode_mn_harga_jual", sql.VarChar(50), kodeMn)
            .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
            .input("id_kelas_harga", sql.Int, idKelasHarga)
            .input("harga_1", sql.Decimal(20, 2), harga1 === "" ? null : Number(harga1))
            .input("harga_3", sql.Decimal(20, 2), harga3 === "" ? null : Number(harga3))
            .input("harga_6", sql.Decimal(20, 2), harga6 === "" ? null : Number(harga6))
            .input("harga_12", sql.Decimal(20, 2), harga12 === "" ? null : Number(harga12))
            .input("berlaku_mulai", sql.DateTime2, nowDate)
            .input("is_active", sql.Int, 1)
            .input("updated_by", sql.VarChar(100), updatedBy)
            .input("updated_at", sql.DateTime2, nowDate)
            .query(
              `INSERT INTO dbo.GWEN_mn_barang_harga_jual_variant (
                kode_mn_harga_jual, kode_barang_variant, id_kelas_harga,
                harga_1, harga_3, harga_6, harga_12,
                berlaku_mulai, is_active, updated_by, updated_at
              ) VALUES (
                @kode_mn_harga_jual, @kode_barang_variant, @id_kelas_harga,
                @harga_1, @harga_3, @harga_6, @harga_12,
                @berlaku_mulai, @is_active, @updated_by, @updated_at
              );`
            );
        }

        const rasio1 = calcRasio(harga1, hargaBeli);
        const rasio3 = calcRasio(harga3, hargaBeli);
        const rasio6 = calcRasio(harga6, hargaBeli);
        const rasio12 = calcRasio(harga12, hargaBeli);
        const kodeHist = generateDetailCode("HHJ", 1);
        await new sql.Request(tx)
          .input("kode_h_harga_jual", sql.VarChar(50), kodeHist)
          .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
          .input("id_kelas_harga", sql.Int, idKelasHarga)
          .input("harga_1", sql.Decimal(20, 2), harga1 === "" ? null : Number(harga1))
          .input("harga_3", sql.Decimal(20, 2), harga3 === "" ? null : Number(harga3))
          .input("harga_6", sql.Decimal(20, 2), harga6 === "" ? null : Number(harga6))
          .input("harga_12", sql.Decimal(20, 2), harga12 === "" ? null : Number(harga12))
          .input("harga_beli_snapshot", sql.Decimal(20, 2), hargaBeli)
          .input("hpp_snapshot", sql.Decimal(20, 2), hpp)
          .input("rasio_1", sql.Decimal(10, 2), rasio1)
          .input("rasio_3", sql.Decimal(10, 2), rasio3)
          .input("rasio_6", sql.Decimal(10, 2), rasio6)
          .input("rasio_12", sql.Decimal(10, 2), rasio12)
          .input("kode_t_request", sql.VarChar(50), "LIVE_EDIT")
          .input("changed_by", sql.VarChar(100), updatedBy)
          .input("changed_at", sql.DateTime2, nowDate)
          .input("catatan", sql.VarChar(255), "LIVE_EDIT")
          .query(
            `INSERT INTO dbo.GWEN_h_harga_jual_variant (
              kode_h_harga_jual, kode_barang_variant, id_kelas_harga,
              harga_1, harga_3, harga_6, harga_12,
              harga_beli_snapshot, hpp_snapshot,
              rasio_1, rasio_3, rasio_6, rasio_12,
              kode_t_request, changed_by, changed_at, catatan
            ) VALUES (
              @kode_h_harga_jual, @kode_barang_variant, @id_kelas_harga,
              @harga_1, @harga_3, @harga_6, @harga_12,
              @harga_beli_snapshot, @hpp_snapshot,
              @rasio_1, @rasio_3, @rasio_6, @rasio_12,
              @kode_t_request, @changed_by, @changed_at, @catatan
            );`
          );
      }

      await tx.commit();
      return reply.send({ message: "Live edit saved" });
    } catch (err) {
      await tx.rollback().catch(() => {});
      fastify.log.error({ err }, "Failed live edit harga jual");
      return reply.code(500).send({ message: "Gagal menyimpan live edit" });
    }
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};
    if (!id) return reply.code(400).send({ message: "id is required" });

    try {
      const req = new sql.Request(pool);
      req.input("id", sql.BigInt, Number(id));
      req.input("id_barang", sql.BigInt, body.id_barang ? Number(body.id_barang) : null);
      req.input("id_kelas_harga", sql.BigInt, body.id_kelas_harga ? Number(body.id_kelas_harga) : null);
      req.input("harga_1", sql.Decimal(18, 2), toDecimal(body.harga_1, null));
      req.input("harga_3", sql.Decimal(18, 2), toDecimal(body.harga_3, null));
      req.input("harga_6", sql.Decimal(18, 2), toDecimal(body.harga_6, null));
      req.input("harga_12", sql.Decimal(18, 2), toDecimal(body.harga_12, null));
      req.input("berlaku_mulai", sql.DateTime2, body.berlaku_mulai ? new Date(body.berlaku_mulai) : null);
      req.input("berlaku_sampai", sql.DateTime2, body.berlaku_sampai ? new Date(body.berlaku_sampai) : null);
      req.input("is_active", sql.Bit, body.is_active ?? 1);
      req.input("updated_by", sql.VarChar(100), body.updated_by || "Admin");
      req.input("updated_at", sql.DateTime2, body.updated_at || now());

      const result = await req.query(`
        UPDATE dbo.m_barang_harga_jual
        SET
          id_barang = COALESCE(@id_barang, id_barang),
          id_kelas_harga = COALESCE(@id_kelas_harga, id_kelas_harga),
          harga_1 = COALESCE(@harga_1, harga_1),
          harga_3 = COALESCE(@harga_3, harga_3),
          harga_6 = COALESCE(@harga_6, harga_6),
          harga_12 = COALESCE(@harga_12, harga_12),
          berlaku_mulai = COALESCE(@berlaku_mulai, berlaku_mulai),
          berlaku_sampai = @berlaku_sampai,
          is_active = @is_active,
          updated_by = @updated_by,
          updated_at = @updated_at
        WHERE id = @id;
      `);

      if (result.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Data tidak ditemukan" });
      }
      return reply.send({ message: "Data updated" });
    } catch (err) {
      if (err.number === 2627) {
        return reply.code(409).send({ message: "Data dengan kombinasi sama sudah ada" });
      }
      fastify.log.error({ err }, "Failed to update barang kelas harga");
      return reply.code(500).send({ message: "Failed to update barang kelas harga" });
    }
  });

  function toDecimal(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }
}
