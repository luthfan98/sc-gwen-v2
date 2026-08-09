export default async function gudangRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const trimOrNull = (value) => {
    const v = String(value ?? "").trim();
    return v ? v : null;
  };

  const parseIntOrDefault = (value, fallback = 0) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.trunc(num);
  };

  const parseDecimalOrNull = (value) => {
    if (value === "" || value === null || typeof value === "undefined") return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return num;
  };

  const generateKodeGudang = async () => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = String(now.getFullYear());
    const prefix = `GUD.${dd}${mm}${yyyy}GW`;

    const result = await pool
      .request()
      .input("prefix", sql.VarChar(32), `${prefix}%`)
      .query(`
        SELECT TOP (1) kode_gudang
        FROM dbo.m_gudang
        WHERE kode_gudang LIKE @prefix
        ORDER BY id_gudang DESC;
      `);

    const lastCode = String(result.recordset?.[0]?.kode_gudang || "");
    let next = 1;
    const match = lastCode.match(/(\d+)\s*$/);
    if (match?.[1]) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) {
        next = parsed + 1;
      }
    }
    return `${prefix}${String(next).padStart(3, "0")}`;
  };

  fastify.get("/", async (_req, reply) => {
    try {
      const result = await pool
        .request()
        .query(
          `SELECT TOP (1000)
            id_gudang,
            kode_gudang,
            nama,
            alamat,
            telp,
            fax,
            kode_gudang_induk,
            volume,
            nilai,
            kode_site,
            status,
            status_cadangan,
            created_by,
            created_at,
            updated_by,
            updated_at,
            jenis_gudang,
            kode_kelas_harga_beli,
            volume_terpakai,
            prefix,
            is_gudang_bs,
            panjang,
            lebar,
            tinggi
          FROM dbo.m_gudang
          ORDER BY id_gudang DESC`
        );
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch gudang");
      return reply.code(500).send({ message: "Failed to fetch gudang" });
    }
  });

  fastify.post("/", async (req, reply) => {
    const body = req.body || {};
    const nama = trimOrNull(body.nama);
    const kodeSite = trimOrNull(body.kode_site);
    const jenisGudang = trimOrNull(body.jenis_gudang);
    if (!nama) {
      return reply.code(400).send({ message: "nama wajib diisi" });
    }
    if (!kodeSite) {
      return reply.code(400).send({ message: "kode_site wajib diisi" });
    }
    if (!jenisGudang) {
      return reply.code(400).send({ message: "jenis_gudang wajib diisi" });
    }

    try {
      let kodeGudang = trimOrNull(body.kode_gudang);
      if (!kodeGudang) {
        kodeGudang = await generateKodeGudang();
      }

      const existsRes = await pool
        .request()
        .input("kode_gudang", sql.VarChar(255), kodeGudang)
        .query(`SELECT TOP (1) id_gudang FROM dbo.m_gudang WHERE kode_gudang = @kode_gudang;`);
      if (existsRes.recordset?.length) {
        return reply.code(409).send({ message: `kode_gudang ${kodeGudang} sudah digunakan` });
      }

      const now = new Date();
      const createdBy = trimOrNull(body.created_by) || "Admin";
      const updatedBy = trimOrNull(body.updated_by) || createdBy;
      const status = parseIntOrDefault(body.status, 1);
      const statusCadangan = parseIntOrDefault(body.status_cadangan, 0);
      const isGudangBs = parseIntOrDefault(body.is_gudang_bs, 0);

      const insertRes = await pool
        .request()
        .input("kode_gudang", sql.VarChar(255), kodeGudang)
        .input("nama", sql.VarChar(sql.MAX), nama)
        .input("alamat", sql.VarChar(sql.MAX), trimOrNull(body.alamat))
        .input("telp", sql.VarChar(sql.MAX), trimOrNull(body.telp))
        .input("fax", sql.VarChar(sql.MAX), trimOrNull(body.fax))
        .input("kode_gudang_induk", sql.VarChar(255), trimOrNull(body.kode_gudang_induk))
        .input("volume", sql.Decimal(20, 2), parseDecimalOrNull(body.volume))
        .input("nilai", sql.Decimal(20, 2), parseDecimalOrNull(body.nilai))
        .input("kode_site", sql.VarChar(255), kodeSite)
        .input("status", sql.Int, status)
        .input("status_cadangan", sql.Int, statusCadangan)
        .input("created_by", sql.VarChar(255), createdBy)
        .input("created_at", sql.DateTime, now)
        .input("updated_by", sql.VarChar(255), updatedBy)
        .input("updated_at", sql.DateTime, now)
        .input("jenis_gudang", sql.VarChar(255), jenisGudang)
        .input("kode_kelas_harga_beli", sql.VarChar(255), trimOrNull(body.kode_kelas_harga_beli))
        .input("volume_terpakai", sql.Decimal(20, 2), parseDecimalOrNull(body.volume_terpakai))
        .input("prefix", sql.VarChar(255), trimOrNull(body.prefix))
        .input("is_gudang_bs", sql.Int, isGudangBs)
        .input("panjang", sql.VarChar(50), trimOrNull(body.panjang))
        .input("lebar", sql.VarChar(50), trimOrNull(body.lebar))
        .input("tinggi", sql.VarChar(50), trimOrNull(body.tinggi))
        .query(`
          DECLARE @out TABLE (id_gudang INT);

          INSERT INTO dbo.m_gudang (
            kode_gudang,
            nama,
            alamat,
            telp,
            fax,
            kode_gudang_induk,
            volume,
            nilai,
            kode_site,
            status,
            status_cadangan,
            created_by,
            created_at,
            updated_by,
            updated_at,
            jenis_gudang,
            kode_kelas_harga_beli,
            volume_terpakai,
            prefix,
            is_gudang_bs,
            panjang,
            lebar,
            tinggi
          )
          OUTPUT INSERTED.id_gudang INTO @out(id_gudang)
          VALUES (
            @kode_gudang,
            @nama,
            @alamat,
            @telp,
            @fax,
            @kode_gudang_induk,
            @volume,
            @nilai,
            @kode_site,
            @status,
            @status_cadangan,
            @created_by,
            @created_at,
            @updated_by,
            @updated_at,
            @jenis_gudang,
            @kode_kelas_harga_beli,
            @volume_terpakai,
            @prefix,
            @is_gudang_bs,
            @panjang,
            @lebar,
            @tinggi
          );

          SELECT TOP (1) id_gudang FROM @out;
        `);

      return reply.code(201).send({
        id_gudang: Number(insertRes.recordset?.[0]?.id_gudang || 0),
        kode_gudang: kodeGudang,
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to create gudang");
      return reply.code(500).send({ message: "Failed to create gudang" });
    }
  });

  fastify.get("/:kode/stock", async (req, reply) => {
    const kodeGudang = String(req.params?.kode || "").trim();
    if (!kodeGudang) {
      return reply.code(400).send({ message: "kode_gudang wajib diisi" });
    }

    try {
      const page = Math.max(1, Number(req.query?.page || 1));
      const rawPageSize = Number(req.query?.page_size ?? 50);
      const pageSize = Number.isFinite(rawPageSize) ? rawPageSize : 50;
      const noLimit = String(req.query?.no_limit || "").trim() === "1" || pageSize === 0;
      const keyword = String(req.query?.q || "").trim();
      const onlyAvailable = String(req.query?.only_available || "").trim() === "1";
      const kodeMerk = String(req.query?.kode_merk || "").trim();
      const kodeSupplier = String(req.query?.kode_supplier || "").trim();

      const request = pool.request();
      request.input("kode_gudang", sql.VarChar(100), kodeGudang);
      if (!noLimit) {
        request.input("offset", sql.Int, (page - 1) * pageSize);
        request.input("page_size", sql.Int, pageSize);
      }
      if (keyword) {
        request.input("q", sql.VarChar(255), `%${keyword}%`);
      }
      if (kodeMerk) {
        request.input("kode_merk", sql.VarChar(100), kodeMerk);
      }
      if (kodeSupplier) {
        request.input("kode_supplier", sql.VarChar(100), kodeSupplier);
      }
      const filters = ["sa.kode_gudang = @kode_gudang"];
      if (keyword) {
        filters.push(
          "(b.nama LIKE @q OR v.nama_varian LIKE @q OR v.barcode_varian LIKE @q OR sa.kode_barang_variant LIKE @q)"
        );
      }
      if (kodeMerk) {
        filters.push("b.kode_merk = @kode_merk");
      }
      if (kodeSupplier) {
        filters.push("b.kode_supplier = @kode_supplier");
      }
      if (onlyAvailable) {
        filters.push("(ISNULL(sa.qty_baik, 0) + ISNULL(sa.qty_rusak, 0)) > 0");
      }
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

      const result = await request.query(
        `
        WITH stock_agg AS (
          SELECT
            s.kode_barang_variant,
            s.kode_gudang,
            SUM(ISNULL(s.stok, 0)) AS stok,
            SUM(
              CASE
                WHEN s.qty_baik IS NOT NULL THEN s.qty_baik
                ELSE ISNULL(s.stok, 0)
              END
            ) AS qty_baik,
            SUM(ISNULL(s.qty_rusak, 0)) AS qty_rusak,
            MAX(ISNULL(s.minimum_stok, 0)) AS minimum_stok,
            MAX(ISNULL(s.status, 1)) AS status,
            MAX(ISNULL(s.is_show, 1)) AS is_show
          FROM dbo.GWEN_mn_barang_gudang_variant s
          GROUP BY s.kode_barang_variant, s.kode_gudang
        ),
        base AS (
          SELECT
            sa.kode_barang_variant,
            sa.kode_gudang,
            sa.stok,
            sa.qty_baik,
            sa.qty_rusak,
            sa.minimum_stok,
            sa.status,
            sa.is_show,
            v.nama_varian,
            v.kode_varian,
            v.barcode_varian,
            b.kode_barang,
            b.nama AS nama_barang,
            b.satuan_1,
            b.kode_supplier,
            b.kode_merk,
            mm.nama_merk,
            ms.nama AS nama_supplier
          FROM stock_agg sa
          LEFT JOIN dbo.m_barang_varian v ON v.kode_barang_variant = sa.kode_barang_variant
          LEFT JOIN dbo.m_barang b ON b.id_barang = v.id_barang
          OUTER APPLY (
            SELECT CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS INT) END AS kode_merk_int
          ) mapm
          LEFT JOIN dbo.m_merk mm ON mm.id_merk = mapm.kode_merk_int
          LEFT JOIN dbo.m_supplier ms
            ON ms.kode_supplier COLLATE DATABASE_DEFAULT = b.kode_supplier COLLATE DATABASE_DEFAULT
          ${whereClause}
        )
        SELECT
          *,
          (SELECT COUNT(1) FROM base) AS total_count
        FROM base
        ORDER BY nama_barang ASC, nama_varian ASC
        ${noLimit ? "" : "OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY"}
        ;
        `
      );
      const rows = result.recordset || [];
      const total = rows.length ? Number(rows[0].total_count ?? 0) : 0;
      const items = rows.map(({ total_count, ...rest }) => rest);
      return reply.send({ items, total });
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch gudang stock");
      return reply.code(500).send({ message: "Failed to fetch gudang stock" });
    }
  });
}
