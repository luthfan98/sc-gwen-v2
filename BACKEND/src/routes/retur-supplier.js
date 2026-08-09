import { nowWib } from "../utils/wib-time.js";

const STATUS_LIST = ["Draft", "Diproses", "Selesai"];
const CANCEL_RETURE_KET = "BATAL RETUR SUPPLIER";

function normalizeStatus(value, fallback = "Draft") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const found = STATUS_LIST.find((x) => x.toLowerCase() === raw.toLowerCase());
  return found || fallback;
}

function parsePositiveNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function parseNonNegativeNumber(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

function parseLimit(value, fallback = 50, max = 200) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(max, Math.floor(num));
}

export default async function returSupplierRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const ensureTables = async () => {
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.GWEN_t_retur_supplier', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.GWEN_t_retur_supplier (
          kode_t_retur_supplier VARCHAR(255) NOT NULL PRIMARY KEY,
          kode_t_pengadaan VARCHAR(255) NULL,
          tgl DATETIME NOT NULL,
          kode_supplier VARCHAR(255) NOT NULL,
          nama_supplier NVARCHAR(255) NULL,
          kode_gudang VARCHAR(100) NULL,
          nama_gudang NVARCHAR(255) NULL,
          catatan NVARCHAR(500) NULL,
          status_retur VARCHAR(30) NOT NULL CONSTRAINT DF_GWEN_t_retur_supplier_status DEFAULT ('Draft'),
          total_item INT NOT NULL CONSTRAINT DF_GWEN_t_retur_supplier_total_item DEFAULT (0),
          total_qty DECIMAL(20, 2) NOT NULL CONSTRAINT DF_GWEN_t_retur_supplier_total_qty DEFAULT (0),
          total_nominal DECIMAL(20, 2) NOT NULL CONSTRAINT DF_GWEN_t_retur_supplier_total_nominal DEFAULT (0),
          created_by VARCHAR(255) NULL,
          created_at DATETIME NOT NULL,
          updated_by VARCHAR(255) NULL,
          updated_at DATETIME NOT NULL
        );
      END;
    `);

    await pool.request().query(`
      IF OBJECT_ID(N'dbo.GWEN_d_retur_supplier', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.GWEN_d_retur_supplier (
          kode_d_retur_supplier VARCHAR(255) NOT NULL PRIMARY KEY,
          kode_t_retur_supplier VARCHAR(255) NOT NULL,
          kode_t_pengadaan VARCHAR(255) NULL,
          kode_d_pengadaan VARCHAR(255) NULL,
          kode_gudang VARCHAR(100) NULL,
          kode_barang_variant VARCHAR(255) NOT NULL,
          barcode_varian VARCHAR(255) NULL,
          nama_barang NVARCHAR(255) NULL,
          nama_varian NVARCHAR(255) NULL,
          qty DECIMAL(20, 2) NOT NULL,
          satuan VARCHAR(50) NOT NULL CONSTRAINT DF_GWEN_d_retur_supplier_satuan DEFAULT ('PCS'),
          harga_beli DECIMAL(20, 2) NOT NULL CONSTRAINT DF_GWEN_d_retur_supplier_harga DEFAULT (0),
          subtotal DECIMAL(20, 2) NOT NULL CONSTRAINT DF_GWEN_d_retur_supplier_subtotal DEFAULT (0),
          alasan_retur NVARCHAR(255) NULL,
          created_by VARCHAR(255) NULL,
          created_at DATETIME NOT NULL,
          updated_by VARCHAR(255) NULL,
          updated_at DATETIME NOT NULL,
          CONSTRAINT FK_GWEN_d_retur_supplier_header
            FOREIGN KEY (kode_t_retur_supplier)
            REFERENCES dbo.GWEN_t_retur_supplier (kode_t_retur_supplier)
            ON DELETE CASCADE
        );
      END;
    `);

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_GWEN_t_retur_supplier_created_at'
          AND object_id = OBJECT_ID(N'dbo.GWEN_t_retur_supplier')
      )
      BEGIN
        CREATE INDEX IX_GWEN_t_retur_supplier_created_at
          ON dbo.GWEN_t_retur_supplier (created_at DESC, kode_t_retur_supplier DESC);
      END;
    `);

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_GWEN_d_retur_supplier_header'
          AND object_id = OBJECT_ID(N'dbo.GWEN_d_retur_supplier')
      )
      BEGIN
        CREATE INDEX IX_GWEN_d_retur_supplier_header
          ON dbo.GWEN_d_retur_supplier (kode_t_retur_supplier, kode_barang_variant);
      END;
    `);

    await pool.request().query(`
      IF COL_LENGTH('dbo.GWEN_t_retur_supplier', 'kode_gudang') IS NULL
      BEGIN
        ALTER TABLE dbo.GWEN_t_retur_supplier ADD kode_gudang VARCHAR(100) NULL;
      END;
      IF COL_LENGTH('dbo.GWEN_t_retur_supplier', 'nama_gudang') IS NULL
      BEGIN
        ALTER TABLE dbo.GWEN_t_retur_supplier ADD nama_gudang NVARCHAR(255) NULL;
      END;
      IF COL_LENGTH('dbo.GWEN_d_retur_supplier', 'kode_gudang') IS NULL
      BEGIN
        ALTER TABLE dbo.GWEN_d_retur_supplier ADD kode_gudang VARCHAR(100) NULL;
      END;
      IF COL_LENGTH('dbo.GWEN_d_retur_supplier', 'is_batal_retur') IS NULL
      BEGIN
        ALTER TABLE dbo.GWEN_d_retur_supplier
          ADD is_batal_retur BIT NOT NULL CONSTRAINT DF_GWEN_d_retur_supplier_is_batal DEFAULT (0);
      END;
      IF COL_LENGTH('dbo.GWEN_d_retur_supplier', 'batal_retur_by') IS NULL
      BEGIN
        ALTER TABLE dbo.GWEN_d_retur_supplier ADD batal_retur_by VARCHAR(255) NULL;
      END;
      IF COL_LENGTH('dbo.GWEN_d_retur_supplier', 'batal_retur_at') IS NULL
      BEGIN
        ALTER TABLE dbo.GWEN_d_retur_supplier ADD batal_retur_at DATETIME NULL;
      END;
      IF COL_LENGTH('dbo.GWEN_d_retur_supplier', 'alasan_batal_retur') IS NULL
      BEGIN
        ALTER TABLE dbo.GWEN_d_retur_supplier ADD alasan_batal_retur NVARCHAR(255) NULL;
      END;
    `);
  };

  const generateHeaderCode = async ({ tx, prefix = "RTS", userCode = "88", branchCode = "GW", padLength = 5 }) => {
    const req = tx ? new sql.Request(tx) : pool.request();
    const res = await req
      .input("prefix", sql.VarChar(20), `${prefix}.${userCode}${branchCode}`)
      .query(`
        SELECT TOP 1 kode_t_retur_supplier AS kode
        FROM dbo.GWEN_t_retur_supplier
        WHERE kode_t_retur_supplier LIKE @prefix + '%'
        ORDER BY created_at DESC, kode_t_retur_supplier DESC;
      `);

    const last = String(res.recordset?.[0]?.kode || "");
    let next = 1;
    if (last) {
      const m = last.match(/(\d+)\s*$/);
      if (m?.[1]) {
        const n = Number(m[1]);
        if (Number.isFinite(n)) next = n + 1;
      }
    }
    return `${prefix}.${userCode}${branchCode}${String(next).padStart(padLength, "0")}`;
  };

  const generateDetailCode = async ({ tx, prefix = "DRS", padLength = 6 }) => {
    const req = tx ? new sql.Request(tx) : pool.request();
    const res = await req
      .input("prefix", sql.VarChar(20), `${prefix}.`)
      .query(`
        SELECT TOP 1 kode_d_retur_supplier AS kode
        FROM dbo.GWEN_d_retur_supplier
        WHERE kode_d_retur_supplier LIKE @prefix + '%'
        ORDER BY created_at DESC, kode_d_retur_supplier DESC;
      `);

    const last = String(res.recordset?.[0]?.kode || "");
    let next = 1;
    if (last) {
      const m = last.match(/(\d+)\s*$/);
      if (m?.[1]) {
        const n = Number(m[1]);
        if (Number.isFinite(n)) next = n + 1;
      }
    }
    return `${prefix}.${String(next).padStart(padLength, "0")}`;
  };

  const generateCancelHistoryCode = ({ kodeRetur, index }) =>
    `HST.${kodeRetur}.BTL.${Date.now()}${String(index + 1).padStart(2, "0")}`;

  await ensureTables();

  fastify.get("/options/suppliers", async (request, reply) => {
    const search = String(request.query?.search || "").trim();
    try {
      const req = pool.request().input("search", sql.VarChar(200), search);
      const res = await req.query(`
        SELECT DISTINCT
          s.kode_supplier,
          s.nama
        FROM dbo.m_supplier s
        WHERE s.kode_supplier IS NOT NULL
          AND LTRIM(RTRIM(s.kode_supplier)) <> ''
          AND (
            @search = '' OR
            s.kode_supplier COLLATE DATABASE_DEFAULT LIKE '%' + @search + '%' OR
            s.nama COLLATE DATABASE_DEFAULT LIKE '%' + @search + '%'
          )
        ORDER BY s.nama ASC, s.kode_supplier ASC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch retur supplier options");
      return reply.code(500).send({ message: "Gagal memuat opsi supplier" });
    }
  });

  fastify.get("/options/gudang", async (request, reply) => {
    const search = String(request.query?.search || "").trim();
    try {
      const req = pool.request().input("search", sql.VarChar(200), search);
      const res = await req.query(`
        SELECT TOP (300)
          g.kode_gudang,
          g.nama,
          g.jenis_gudang
        FROM dbo.m_gudang g
        WHERE ISNULL(g.status, 1) = 1
          AND g.kode_gudang IS NOT NULL
          AND LTRIM(RTRIM(g.kode_gudang)) <> ''
          AND (
            @search = '' OR
            g.kode_gudang COLLATE DATABASE_DEFAULT LIKE '%' + @search + '%' OR
            g.nama COLLATE DATABASE_DEFAULT LIKE '%' + @search + '%'
          )
        ORDER BY g.nama ASC, g.kode_gudang ASC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch retur supplier gudang options");
      return reply.code(500).send({ message: "Gagal memuat opsi gudang" });
    }
  });

  fastify.get("/options/merks", async (request, reply) => {
    const kodeSupplier = String(request.query?.kode_supplier || "").trim();
    const search = String(request.query?.search || "").trim();
    if (!kodeSupplier) {
      return reply.code(400).send({ message: "kode_supplier wajib diisi" });
    }
    try {
      const req = pool
        .request()
        .input("kode_supplier", sql.VarChar(100), kodeSupplier)
        .input("search", sql.VarChar(200), search);
      const res = await req.query(`
        SELECT DISTINCT
          b.kode_merk,
          COALESCE(mm.nama_merk, b.kode_merk) AS nama_merk
        FROM dbo.m_barang b
        OUTER APPLY (
          SELECT CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS INT) END AS kode_merk_int
        ) mapm
        LEFT JOIN dbo.m_merk mm ON mm.id_merk = mapm.kode_merk_int
        WHERE b.kode_supplier COLLATE DATABASE_DEFAULT = @kode_supplier COLLATE DATABASE_DEFAULT
          AND b.kode_merk IS NOT NULL
          AND LTRIM(RTRIM(b.kode_merk)) <> ''
          AND (
            @search = '' OR
            b.kode_merk COLLATE DATABASE_DEFAULT LIKE '%' + @search + '%' OR
            COALESCE(mm.nama_merk, b.kode_merk) COLLATE DATABASE_DEFAULT LIKE '%' + @search + '%'
          )
        ORDER BY COALESCE(mm.nama_merk, b.kode_merk) ASC, b.kode_merk ASC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch retur supplier merk options");
      return reply.code(500).send({ message: "Gagal memuat opsi merk" });
    }
  });

  fastify.get("/options/variants", async (request, reply) => {
    const kodeSupplier = String(request.query?.kode_supplier || "").trim();
    const kodeMerk = String(request.query?.kode_merk || "").trim();
    const kodeGudang = String(request.query?.kode_gudang || "").trim();
    const search = String(request.query?.search || "").trim();
    const limit = parseLimit(request.query?.limit, 50, 200);
    if (!kodeSupplier) {
      return reply.code(400).send({ message: "kode_supplier wajib diisi" });
    }
    if (!kodeGudang) {
      return reply.code(400).send({ message: "kode_gudang wajib diisi" });
    }
    try {
      const req = pool
        .request()
        .input("limit", sql.Int, limit)
        .input("kode_supplier", sql.VarChar(100), kodeSupplier)
        .input("kode_gudang", sql.VarChar(100), kodeGudang)
        .input("search", sql.VarChar(200), search);
      if (kodeMerk) {
        req.input("kode_merk", sql.VarChar(100), kodeMerk);
      }
      const res = await req.query(`
        SELECT TOP (@limit)
          v.kode_barang_variant,
          v.nama_varian,
          v.barcode_varian,
          b.nama AS nama_barang,
          b.kode_barang,
          b.kode_merk,
          COALESCE(mm.nama_merk, b.kode_merk) AS nama_merk,
          COALESCE(NULLIF(v.harga_beli_sat_1, 0), NULLIF(b.harga_beli_sat_1, 0), 0) AS harga_beli_default,
          ISNULL(stok.stok_saat_ini, 0) AS stok_saat_ini
        FROM dbo.m_barang_varian v
        JOIN dbo.m_barang b ON b.id_barang = v.id_barang
        OUTER APPLY (
          SELECT CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS INT) END AS kode_merk_int
        ) mapm
        LEFT JOIN dbo.m_merk mm ON mm.id_merk = mapm.kode_merk_int
        OUTER APPLY (
          SELECT SUM(ISNULL(s.stok, 0)) AS stok_saat_ini
          FROM dbo.GWEN_mn_barang_gudang_variant s
          WHERE s.kode_barang_variant COLLATE DATABASE_DEFAULT = v.kode_barang_variant COLLATE DATABASE_DEFAULT
            AND s.kode_gudang COLLATE DATABASE_DEFAULT = @kode_gudang COLLATE DATABASE_DEFAULT
        ) stok
        WHERE b.kode_supplier COLLATE DATABASE_DEFAULT = @kode_supplier COLLATE DATABASE_DEFAULT
          ${kodeMerk ? "AND b.kode_merk COLLATE DATABASE_DEFAULT = @kode_merk COLLATE DATABASE_DEFAULT" : ""}
          AND ISNULL(v.is_aktif, 1) = 1
          AND (
            @search = '' OR
            v.kode_barang_variant COLLATE DATABASE_DEFAULT LIKE '%' + @search + '%' OR
            v.barcode_varian COLLATE DATABASE_DEFAULT LIKE '%' + @search + '%' OR
            v.nama_varian COLLATE DATABASE_DEFAULT LIKE '%' + @search + '%' OR
            b.nama COLLATE DATABASE_DEFAULT LIKE '%' + @search + '%'
          )
        ORDER BY b.nama ASC, v.nama_varian ASC, v.kode_barang_variant ASC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch retur supplier variant options");
      return reply.code(500).send({ message: "Gagal memuat opsi barang variant" });
    }
  });

  fastify.get("/", async (request, reply) => {
    const query = request.query || {};
    const search = String(query.search || "").trim();
    const status = String(query.status || "").trim();
    try {
      const req = pool
        .request()
        .input("search", sql.VarChar(255), search)
        .input("status", sql.VarChar(30), status);
      const res = await req.query(`
        SELECT
          t.kode_t_retur_supplier,
          t.kode_t_pengadaan,
          t.tgl,
          t.kode_supplier,
          t.kode_gudang,
          COALESCE(
            g.nama COLLATE DATABASE_DEFAULT,
            t.nama_gudang COLLATE DATABASE_DEFAULT,
            t.kode_gudang COLLATE DATABASE_DEFAULT
          ) AS nama_gudang,
          COALESCE(
            s.nama COLLATE DATABASE_DEFAULT,
            t.nama_supplier COLLATE DATABASE_DEFAULT,
            t.kode_supplier COLLATE DATABASE_DEFAULT
          ) AS nama_supplier,
          t.catatan,
          t.status_retur,
          t.total_item,
          t.total_qty,
          t.total_nominal,
          t.created_by,
          t.created_at,
          t.updated_at
        FROM dbo.GWEN_t_retur_supplier t
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.m_gudang g
          ON g.kode_gudang COLLATE DATABASE_DEFAULT = t.kode_gudang COLLATE DATABASE_DEFAULT
        WHERE
          (@search = '' OR
            t.kode_t_retur_supplier COLLATE DATABASE_DEFAULT LIKE '%' + @search + '%' OR
            t.kode_supplier COLLATE DATABASE_DEFAULT LIKE '%' + @search + '%' OR
            COALESCE(
              s.nama COLLATE DATABASE_DEFAULT,
              t.nama_supplier COLLATE DATABASE_DEFAULT,
              t.kode_supplier COLLATE DATABASE_DEFAULT
            ) LIKE '%' + @search + '%')
          AND (@status = '' OR t.status_retur = @status)
        ORDER BY t.created_at DESC, t.kode_t_retur_supplier DESC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch retur supplier list");
      return reply.code(500).send({ message: "Gagal memuat data retur supplier" });
    }
  });

  fastify.get("/source/pengadaan/:kode", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    if (!kode) return reply.code(400).send({ message: "kode pengadaan wajib diisi" });
    try {
      const req = pool.request().input("kode_t_pengadaan", sql.VarChar(255), kode);
      const res = await req.query(`
        SELECT
          d.kode_d_pengadaan,
          d.kode_t_pengadaan,
          d.kode_barang_variant,
          d.barcode_varian,
          COALESCE(
            d.nama_barang COLLATE DATABASE_DEFAULT,
            b.nama COLLATE DATABASE_DEFAULT
          ) AS nama_barang,
          COALESCE(
            d.nama_varian COLLATE DATABASE_DEFAULT,
            v.nama_varian COLLATE DATABASE_DEFAULT
          ) AS nama_varian,
          d.qty,
          d.satuan,
          d.harga_beli,
          d.subtotal
        FROM dbo.GWEN_d_pengadaan d
        LEFT JOIN dbo.m_barang_varian v
          ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.m_barang b
          ON b.id_barang = v.id_barang
        WHERE d.kode_t_pengadaan = @kode_t_pengadaan
        ORDER BY d.created_at ASC, d.kode_d_pengadaan ASC;
      `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch source pengadaan for retur supplier");
      return reply.code(500).send({ message: "Gagal memuat item pengadaan" });
    }
  });

  fastify.post("/:kode/cancel-items", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    const body = request.body || {};
    const itemCodes = Array.isArray(body.item_codes)
      ? body.item_codes.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const canceledBy = String(body.canceled_by || body.updated_by || "Admin").trim() || "Admin";
    const alasan = String(body.alasan || "").trim() || null;

    if (!kode) return reply.code(400).send({ message: "kode retur supplier wajib diisi" });
    if (!itemCodes.length) return reply.code(400).send({ message: "Pilih minimal 1 item retur untuk dibatalkan" });

    const uniqueItemCodes = [...new Set(itemCodes)];
    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const headerRes = await new sql.Request(tx)
        .input("kode_t_retur_supplier", sql.VarChar(255), kode)
        .query(`
          SELECT TOP 1 kode_t_retur_supplier, kode_gudang
          FROM dbo.GWEN_t_retur_supplier WITH (UPDLOCK, ROWLOCK)
          WHERE kode_t_retur_supplier = @kode_t_retur_supplier;
        `);
      const header = headerRes.recordset?.[0] || null;
      if (!header) throw new Error("VALIDATION:Retur supplier tidak ditemukan.");

      const detailReq = new sql.Request(tx).input("kode_t_retur_supplier", sql.VarChar(255), kode);
      const detailParams = uniqueItemCodes.map((itemCode, idx) => {
        const name = `kode_d_${idx}`;
        detailReq.input(name, sql.VarChar(255), itemCode);
        return `@${name}`;
      });
      const detailRes = await detailReq.query(`
        SELECT
          d.kode_d_retur_supplier,
          d.kode_t_retur_supplier,
          d.kode_gudang,
          d.kode_barang_variant,
          d.qty,
          d.satuan,
          d.subtotal,
          ISNULL(d.is_batal_retur, 0) AS is_batal_retur
        FROM dbo.GWEN_d_retur_supplier d WITH (UPDLOCK, ROWLOCK)
        WHERE d.kode_t_retur_supplier = @kode_t_retur_supplier
          AND d.kode_d_retur_supplier IN (${detailParams.join(",")});
      `);
      const details = detailRes.recordset || [];
      if (details.length !== uniqueItemCodes.length) {
        throw new Error("VALIDATION:Sebagian item retur tidak ditemukan pada dokumen ini.");
      }
      if (details.some((item) => Number(item.is_batal_retur || 0) === 1)) {
        throw new Error("VALIDATION:Sebagian item yang dipilih sudah pernah dibatalkan.");
      }

      const now = nowWib();
      for (let idx = 0; idx < details.length; idx += 1) {
        const item = details[idx];
        const kodeDetail = String(item.kode_d_retur_supplier || "").trim();
        const kodeBarangVariant = String(item.kode_barang_variant || "").trim();
        const kodeGudang = String(item.kode_gudang || header.kode_gudang || "").trim();
        const qtyBatal = Number(item.qty || 0);
        if (!kodeBarangVariant || !kodeGudang || !Number.isFinite(qtyBatal) || qtyBatal <= 0) {
          throw new Error(`VALIDATION:Data item ${kodeDetail} tidak valid untuk pembatalan.`);
        }

        const stokRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
          .input("kode_gudang", sql.VarChar(100), kodeGudang)
          .query(`
            SELECT TOP 1
              kode_mn_barang_gudang,
              ISNULL(stok, 0) AS stok,
              CASE
                WHEN qty_baik IS NULL THEN ISNULL(stok, 0)
                ELSE ISNULL(qty_baik, 0)
              END AS qty_baik,
              ISNULL(qty_rusak, 0) AS qty_rusak
            FROM dbo.GWEN_mn_barang_gudang_variant WITH (UPDLOCK, ROWLOCK)
            WHERE kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT
              AND kode_gudang COLLATE DATABASE_DEFAULT = @kode_gudang COLLATE DATABASE_DEFAULT
            ORDER BY updated_at DESC, created_at DESC, kode_mn_barang_gudang ASC;
          `);
        const stokRow = stokRes.recordset?.[0] || null;
        if (!stokRow) {
          throw new Error(`VALIDATION:Stok varian ${kodeBarangVariant} pada gudang ${kodeGudang} tidak ditemukan.`);
        }

        const qtyBaikAwal = Number(stokRow.qty_baik) || 0;
        const qtyRusak = Number(stokRow.qty_rusak) || 0;
        const qtyBaikAkhir = qtyBaikAwal + qtyBatal;
        const stokAkhir = qtyBaikAkhir + qtyRusak;

        await new sql.Request(tx)
          .input("stok", sql.Decimal(20, 2), stokAkhir)
          .input("qty_baik", sql.Decimal(20, 2), qtyBaikAkhir)
          .input("qty_rusak", sql.Decimal(20, 2), qtyRusak)
          .input("updated_by", sql.VarChar(255), canceledBy)
          .input("updated_at", sql.DateTime, now)
          .input("kode_mn_barang_gudang", sql.VarChar(255), String(stokRow.kode_mn_barang_gudang || ""))
          .query(`
            UPDATE dbo.GWEN_mn_barang_gudang_variant
            SET stok = @stok,
                qty_baik = @qty_baik,
                qty_rusak = @qty_rusak,
                updated_by = @updated_by,
                updated_at = @updated_at
            WHERE kode_mn_barang_gudang = @kode_mn_barang_gudang;
          `);

        const histRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
          .input("kode_gudang", sql.VarChar(100), kodeGudang)
          .query(`
            SELECT TOP 1 stok_akhir_satuan_1
            FROM dbo.GWEN_h_stok_barang_variant
            WHERE kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT
              AND kode_gudang COLLATE DATABASE_DEFAULT = @kode_gudang COLLATE DATABASE_DEFAULT
            ORDER BY tgl_transaksi DESC, id DESC;
          `);
        const stokAwalHist = Number(histRes.recordset?.[0]?.stok_akhir_satuan_1 ?? qtyBaikAwal + qtyRusak);
        const stokAkhirHist = stokAwalHist + qtyBatal;
        const kodeHist = generateCancelHistoryCode({ kodeRetur: kode, index: idx });

        await new sql.Request(tx)
          .input("kode_h_stok_barang", sql.VarChar(255), kodeHist)
          .input("kode_ref_transaksi", sql.VarChar(255), kode)
          .input("tgl_transaksi", sql.DateTime, now)
          .input("ket_transaksi", sql.VarChar(sql.MAX), CANCEL_RETURE_KET)
          .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
          .input("qty_masuk", sql.Decimal(20, 2), qtyBatal)
          .input("status", sql.VarChar(255), "MASUK")
          .input("status_cadangan", sql.VarChar(255), null)
          .input("created_by", sql.VarChar(255), canceledBy)
          .input("created_at", sql.DateTime, now)
          .input("updated_by", sql.VarChar(255), canceledBy)
          .input("updated_at", sql.DateTime, now)
          .input("kode_gudang", sql.VarChar(255), kodeGudang)
          .input("satuan", sql.VarChar(255), String(item.satuan || "PCS"))
          .input("qty_ke_satuan_1", sql.Decimal(20, 2), qtyBatal)
          .input("stok_awal_satuan_1", sql.Decimal(20, 2), stokAwalHist)
          .input("stok_akhir_satuan_1", sql.Decimal(20, 2), stokAkhirHist)
          .input("qty_keluar", sql.Decimal(20, 2), 0)
          .input("kode_sales", sql.VarChar(255), null)
          .input("ket_inquiry", sql.VarChar(sql.MAX), `Batal detail retur supplier ${kodeDetail}`)
          .query(`
            INSERT INTO dbo.GWEN_h_stok_barang_variant (
              kode_h_stok_barang, kode_ref_transaksi, tgl_transaksi, ket_transaksi, kode_barang_variant, qty_masuk,
              status, status_cadangan, created_by, created_at, updated_by, updated_at, kode_gudang, satuan,
              qty_ke_satuan_1, stok_awal_satuan_1, stok_akhir_satuan_1, qty_keluar, kode_sales, ket_inquiry
            ) VALUES (
              @kode_h_stok_barang, @kode_ref_transaksi, @tgl_transaksi, @ket_transaksi, @kode_barang_variant, @qty_masuk,
              @status, @status_cadangan, @created_by, @created_at, @updated_by, @updated_at, @kode_gudang, @satuan,
              @qty_ke_satuan_1, @stok_awal_satuan_1, @stok_akhir_satuan_1, @qty_keluar, @kode_sales, @ket_inquiry
            );
          `);

        await new sql.Request(tx)
          .input("kode_d_retur_supplier", sql.VarChar(255), kodeDetail)
          .input("updated_by", sql.VarChar(255), canceledBy)
          .input("updated_at", sql.DateTime, now)
          .input("alasan_batal_retur", sql.NVarChar(255), alasan)
          .query(`
            UPDATE dbo.GWEN_d_retur_supplier
            SET is_batal_retur = 1,
                batal_retur_by = @updated_by,
                batal_retur_at = @updated_at,
                alasan_batal_retur = @alasan_batal_retur,
                updated_by = @updated_by,
                updated_at = @updated_at
            WHERE kode_d_retur_supplier = @kode_d_retur_supplier;
          `);
      }

      await new sql.Request(tx)
        .input("kode_t_retur_supplier", sql.VarChar(255), kode)
        .input("updated_by", sql.VarChar(255), canceledBy)
        .input("updated_at", sql.DateTime, now)
        .query(`
          UPDATE t
          SET total_item = x.total_item,
              total_qty = x.total_qty,
              total_nominal = x.total_nominal,
              updated_by = @updated_by,
              updated_at = @updated_at
          FROM dbo.GWEN_t_retur_supplier t
          CROSS APPLY (
            SELECT
              COUNT(1) AS total_item,
              ISNULL(SUM(ISNULL(d.qty, 0)), 0) AS total_qty,
              ISNULL(SUM(ISNULL(d.subtotal, 0)), 0) AS total_nominal
            FROM dbo.GWEN_d_retur_supplier d
            WHERE d.kode_t_retur_supplier = t.kode_t_retur_supplier
              AND ISNULL(d.is_batal_retur, 0) = 0
          ) x
          WHERE t.kode_t_retur_supplier = @kode_t_retur_supplier;
        `);

      await tx.commit();
      return reply.send({
        message: "Item retur supplier berhasil dibatalkan",
        kode_t_retur_supplier: kode,
        canceled_items: details.map((item) => item.kode_d_retur_supplier),
      });
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // ignore rollback error
      }
      if (String(err?.message || "").startsWith("VALIDATION:")) {
        return reply.code(400).send({ message: String(err.message).replace("VALIDATION:", "") });
      }
      fastify.log.error({ err }, "Failed cancel retur supplier items");
      return reply.code(500).send({ message: "Gagal membatalkan item retur supplier" });
    }
  });

  fastify.get("/:kode", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    if (!kode) return reply.code(400).send({ message: "kode retur supplier wajib diisi" });
    try {
      const headerReq = pool.request().input("kode_t_retur_supplier", sql.VarChar(255), kode);
      const headerRes = await headerReq.query(`
        SELECT
          t.kode_t_retur_supplier,
          t.kode_t_pengadaan,
          t.tgl,
          t.kode_supplier,
          t.kode_gudang,
          COALESCE(
            g.nama COLLATE DATABASE_DEFAULT,
            t.nama_gudang COLLATE DATABASE_DEFAULT,
            t.kode_gudang COLLATE DATABASE_DEFAULT
          ) AS nama_gudang,
          COALESCE(
            s.nama COLLATE DATABASE_DEFAULT,
            t.nama_supplier COLLATE DATABASE_DEFAULT,
            t.kode_supplier COLLATE DATABASE_DEFAULT
          ) AS nama_supplier,
          t.catatan,
          t.status_retur,
          t.total_item,
          t.total_qty,
          t.total_nominal,
          t.created_by,
          t.created_at,
          t.updated_by,
          t.updated_at
        FROM dbo.GWEN_t_retur_supplier t
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.m_gudang g
          ON g.kode_gudang COLLATE DATABASE_DEFAULT = t.kode_gudang COLLATE DATABASE_DEFAULT
        WHERE t.kode_t_retur_supplier = @kode_t_retur_supplier;
      `);

      if (!headerRes.recordset?.length) {
        return reply.code(404).send({ message: "Retur supplier tidak ditemukan" });
      }

      const detailReq = pool.request().input("kode_t_retur_supplier", sql.VarChar(255), kode);
      const detailRes = await detailReq.query(`
        SELECT
          d.kode_d_retur_supplier,
          d.kode_t_retur_supplier,
          d.kode_t_pengadaan,
          d.kode_d_pengadaan,
          d.kode_gudang,
          d.kode_barang_variant,
          d.barcode_varian,
          COALESCE(
            d.nama_barang COLLATE DATABASE_DEFAULT,
            b.nama COLLATE DATABASE_DEFAULT
          ) AS nama_barang,
          COALESCE(
            d.nama_varian COLLATE DATABASE_DEFAULT,
            v.nama_varian COLLATE DATABASE_DEFAULT
          ) AS nama_varian,
          d.qty,
          d.satuan,
          d.harga_beli,
          d.subtotal,
          d.alasan_retur,
          ISNULL(d.is_batal_retur, 0) AS is_batal_retur,
          d.batal_retur_by,
          d.batal_retur_at,
          d.alasan_batal_retur
        FROM dbo.GWEN_d_retur_supplier d
        LEFT JOIN dbo.m_barang_varian v
          ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.m_barang b
          ON b.id_barang = v.id_barang
        WHERE d.kode_t_retur_supplier = @kode_t_retur_supplier
        ORDER BY d.created_at ASC, d.kode_d_retur_supplier ASC;
      `);

      return reply.send({
        header: headerRes.recordset[0],
        items: detailRes.recordset || [],
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch detail retur supplier");
      return reply.code(500).send({ message: "Gagal memuat detail retur supplier" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const kodeSupplier = String(body.kode_supplier || "").trim();
    const kodeGudang = String(body.kode_gudang || "").trim();
    const kodeTPengadaan = String(body.kode_t_pengadaan || "").trim() || null;
    const catatan = String(body.catatan || "").trim() || null;
    const createdBy = String(body.created_by || "Admin").trim() || "Admin";
    const items = Array.isArray(body.items) ? body.items : [];
    const tgl = body.tgl ? new Date(body.tgl) : nowWib();
    const statusRetur = normalizeStatus(body.status_retur, "Draft");

    if (!kodeSupplier) {
      return reply.code(400).send({ message: "kode_supplier wajib diisi" });
    }
    if (!kodeGudang) {
      return reply.code(400).send({ message: "kode_gudang wajib diisi" });
    }
    if (!items.length) {
      return reply.code(400).send({ message: "items wajib diisi minimal 1 item" });
    }
    if (Number.isNaN(tgl.getTime())) {
      return reply.code(400).send({ message: "tgl tidak valid" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const supplierReq = new sql.Request(tx).input("kode_supplier", sql.VarChar(255), kodeSupplier);
      const supplierRes = await supplierReq.query(`
        SELECT TOP 1 nama
        FROM dbo.m_supplier
        WHERE kode_supplier COLLATE DATABASE_DEFAULT = @kode_supplier COLLATE DATABASE_DEFAULT;
      `);
      const namaSupplier =
        String(body.nama_supplier || "").trim() || String(supplierRes.recordset?.[0]?.nama || "").trim() || null;

      const gudangReq = new sql.Request(tx).input("kode_gudang", sql.VarChar(100), kodeGudang);
      const gudangRes = await gudangReq.query(`
        SELECT TOP 1 nama
        FROM dbo.m_gudang
        WHERE kode_gudang COLLATE DATABASE_DEFAULT = @kode_gudang COLLATE DATABASE_DEFAULT;
      `);
      const namaGudang = String(gudangRes.recordset?.[0]?.nama || "").trim() || null;
      if (!namaGudang) {
        throw new Error(`VALIDATION:Kode gudang ${kodeGudang} tidak ditemukan.`);
      }

      const normalizedItems = [];
      const requestedQtyPerVariant = new Map();
      const stockPerVariantCache = new Map();
      for (let idx = 0; idx < items.length; idx += 1) {
        const raw = items[idx] || {};
        const kodeBarangVariant = String(raw.kode_barang_variant || "").trim();
        const qty = parsePositiveNumber(raw.qty);

        if (!kodeBarangVariant) {
          throw new Error(`VALIDATION:Item ke-${idx + 1} belum memiliki kode_barang_variant.`);
        }
        if (!qty) {
          throw new Error(`VALIDATION:Qty item ke-${idx + 1} wajib lebih besar dari 0.`);
        }

        const requestedQty = Number(requestedQtyPerVariant.get(kodeBarangVariant) || 0) + qty;
        requestedQtyPerVariant.set(kodeBarangVariant, requestedQty);

        let stokSaatIni = Number(stockPerVariantCache.get(kodeBarangVariant));
        if (!Number.isFinite(stokSaatIni)) {
          const stokReq = new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant)
            .input("kode_gudang", sql.VarChar(100), kodeGudang);
          const stokRes = await stokReq.query(`
            SELECT SUM(ISNULL(stok, 0)) AS stok_saat_ini
            FROM dbo.GWEN_mn_barang_gudang_variant
            WHERE kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT
              AND kode_gudang COLLATE DATABASE_DEFAULT = @kode_gudang COLLATE DATABASE_DEFAULT;
          `);
          stokSaatIni = Number(stokRes.recordset?.[0]?.stok_saat_ini ?? 0);
          stockPerVariantCache.set(kodeBarangVariant, stokSaatIni);
        }

        if (requestedQty > stokSaatIni) {
          throw new Error(
            `VALIDATION:Qty total retur ${kodeBarangVariant} (${requestedQty}) melebihi stok gudang ${kodeGudang} (${stokSaatIni}).`
          );
        }

        const variantReq = new sql.Request(tx).input("kode_barang_variant", sql.VarChar(255), kodeBarangVariant);
        const variantRes = await variantReq.query(`
          SELECT TOP 1
            v.kode_barang_variant,
            v.barcode_varian,
            v.nama_varian,
            b.kode_supplier,
            b.nama AS nama_barang,
            COALESCE(NULLIF(v.harga_beli_sat_1, 0), NULLIF(b.harga_beli_sat_1, 0), 0) AS harga_beli_default
          FROM dbo.m_barang_varian v
          JOIN dbo.m_barang b ON b.id_barang = v.id_barang
          WHERE v.kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT;
        `);

        const variant = variantRes.recordset?.[0] || null;
        const namaBarang = String(raw.nama_barang || "").trim() || String(variant?.nama_barang || "").trim() || null;
        const namaVarian = String(raw.nama_varian || "").trim() || String(variant?.nama_varian || "").trim() || null;
        const barcodeVarian =
          String(raw.barcode_varian || "").trim() || String(variant?.barcode_varian || "").trim() || null;

        if (!variant) {
          throw new Error(`VALIDATION:Kode varian ${kodeBarangVariant} tidak ditemukan di master barang.`);
        }
        if (
          variant?.kode_supplier &&
          String(variant.kode_supplier).trim().toLowerCase() !== kodeSupplier.toLowerCase()
        ) {
          throw new Error(`VALIDATION:Varian ${kodeBarangVariant} bukan milik supplier ${kodeSupplier}.`);
        }

        const hargaInput = Number(raw.harga_beli);
        const hargaBeli = Number.isFinite(hargaInput)
          ? parseNonNegativeNumber(hargaInput, 0)
          : parseNonNegativeNumber(variant?.harga_beli_default, 0);
        const subtotal = Number((qty * hargaBeli).toFixed(2));

        normalizedItems.push({
          kode_t_pengadaan: String(raw.kode_t_pengadaan || "").trim() || kodeTPengadaan,
          kode_d_pengadaan: String(raw.kode_d_pengadaan || "").trim() || null,
          kode_gudang: kodeGudang,
          kode_barang_variant: kodeBarangVariant,
          barcode_varian: barcodeVarian,
          nama_barang: namaBarang,
          nama_varian: namaVarian,
          qty,
          satuan: String(raw.satuan || "").trim() || "PCS",
          harga_beli: hargaBeli,
          subtotal,
          alasan_retur: String(raw.alasan_retur || "").trim() || null,
        });
      }

      const totalItem = normalizedItems.length;
      const totalQty = normalizedItems.reduce((sum, row) => sum + row.qty, 0);
      const totalNominal = normalizedItems.reduce((sum, row) => sum + row.subtotal, 0);
      const now = nowWib();
      const kodeHeader = await generateHeaderCode({ tx, prefix: "RTS" });

      await new sql.Request(tx)
        .input("kode_t_retur_supplier", sql.VarChar(255), kodeHeader)
        .input("kode_t_pengadaan", sql.VarChar(255), kodeTPengadaan)
        .input("tgl", sql.DateTime, tgl)
        .input("kode_supplier", sql.VarChar(255), kodeSupplier)
        .input("nama_supplier", sql.NVarChar(255), namaSupplier)
        .input("kode_gudang", sql.VarChar(100), kodeGudang)
        .input("nama_gudang", sql.NVarChar(255), namaGudang)
        .input("catatan", sql.NVarChar(500), catatan)
        .input("status_retur", sql.VarChar(30), statusRetur)
        .input("total_item", sql.Int, totalItem)
        .input("total_qty", sql.Decimal(20, 2), totalQty)
        .input("total_nominal", sql.Decimal(20, 2), totalNominal)
        .input("created_by", sql.VarChar(255), createdBy)
        .input("created_at", sql.DateTime, now)
        .input("updated_by", sql.VarChar(255), createdBy)
        .input("updated_at", sql.DateTime, now)
        .query(`
          INSERT INTO dbo.GWEN_t_retur_supplier (
            kode_t_retur_supplier, kode_t_pengadaan, tgl, kode_supplier, nama_supplier, kode_gudang, nama_gudang, catatan, status_retur,
            total_item, total_qty, total_nominal, created_by, created_at, updated_by, updated_at
          ) VALUES (
            @kode_t_retur_supplier, @kode_t_pengadaan, @tgl, @kode_supplier, @nama_supplier, @kode_gudang, @nama_gudang, @catatan, @status_retur,
            @total_item, @total_qty, @total_nominal, @created_by, @created_at, @updated_by, @updated_at
          );
        `);

      for (let itemIndex = 0; itemIndex < normalizedItems.length; itemIndex += 1) {
        const item = normalizedItems[itemIndex];
        const kodeDetail = await generateDetailCode({ tx, prefix: "DRS" });
        await new sql.Request(tx)
          .input("kode_d_retur_supplier", sql.VarChar(255), kodeDetail)
          .input("kode_t_retur_supplier", sql.VarChar(255), kodeHeader)
          .input("kode_t_pengadaan", sql.VarChar(255), item.kode_t_pengadaan || null)
          .input("kode_d_pengadaan", sql.VarChar(255), item.kode_d_pengadaan)
          .input("kode_gudang", sql.VarChar(100), item.kode_gudang || kodeGudang)
          .input("kode_barang_variant", sql.VarChar(255), item.kode_barang_variant)
          .input("barcode_varian", sql.VarChar(255), item.barcode_varian)
          .input("nama_barang", sql.NVarChar(255), item.nama_barang)
          .input("nama_varian", sql.NVarChar(255), item.nama_varian)
          .input("qty", sql.Decimal(20, 2), item.qty)
          .input("satuan", sql.VarChar(50), item.satuan)
          .input("harga_beli", sql.Decimal(20, 2), item.harga_beli)
          .input("subtotal", sql.Decimal(20, 2), item.subtotal)
          .input("alasan_retur", sql.NVarChar(255), item.alasan_retur)
          .input("created_by", sql.VarChar(255), createdBy)
          .input("created_at", sql.DateTime, now)
          .input("updated_by", sql.VarChar(255), createdBy)
          .input("updated_at", sql.DateTime, now)
          .query(`
            INSERT INTO dbo.GWEN_d_retur_supplier (
              kode_d_retur_supplier, kode_t_retur_supplier, kode_t_pengadaan, kode_d_pengadaan, kode_gudang, kode_barang_variant,
              barcode_varian, nama_barang, nama_varian, qty, satuan, harga_beli, subtotal, alasan_retur,
              created_by, created_at, updated_by, updated_at
            ) VALUES (
              @kode_d_retur_supplier, @kode_t_retur_supplier, @kode_t_pengadaan, @kode_d_pengadaan, @kode_gudang, @kode_barang_variant,
              @barcode_varian, @nama_barang, @nama_varian, @qty, @satuan, @harga_beli, @subtotal, @alasan_retur,
              @created_by, @created_at, @updated_by, @updated_at
            );
          `);

        const qtyRetur = Number(item.qty || 0);
        const gudangItem = String(item.kode_gudang || kodeGudang).trim();
        const stokRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(255), item.kode_barang_variant)
          .input("kode_gudang", sql.VarChar(100), gudangItem)
          .query(
            `SELECT
               kode_mn_barang_gudang,
               ISNULL(stok, 0) AS stok,
               CASE
                 WHEN qty_baik IS NULL THEN ISNULL(stok, 0)
                 ELSE ISNULL(qty_baik, 0)
               END AS qty_baik,
               ISNULL(qty_rusak, 0) AS qty_rusak
             FROM dbo.GWEN_mn_barang_gudang_variant WITH (UPDLOCK, ROWLOCK)
             WHERE kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT
               AND kode_gudang COLLATE DATABASE_DEFAULT = @kode_gudang COLLATE DATABASE_DEFAULT
             ORDER BY updated_at DESC, created_at DESC, kode_mn_barang_gudang ASC;`
          );
        const stokRows = stokRes.recordset || [];
        if (!stokRows.length) {
          throw new Error(
            `VALIDATION:Stok varian ${item.kode_barang_variant} pada gudang ${gudangItem} tidak ditemukan.`
          );
        }

        const stokAwalBaik = stokRows.reduce((sum, row) => sum + (Number(row.qty_baik) || 0), 0);
        const stokAwalRusak = stokRows.reduce((sum, row) => sum + (Number(row.qty_rusak) || 0), 0);
        const stokAwalTotal = stokAwalBaik + stokAwalRusak;

        if (qtyRetur > stokAwalBaik) {
          throw new Error(
            `VALIDATION:Qty retur ${item.kode_barang_variant} (${qtyRetur}) melebihi stok baik gudang (${stokAwalBaik}).`
          );
        }

        let sisaRetur = qtyRetur;
        for (const stokRow of stokRows) {
          if (sisaRetur <= 0) break;
          const qtyBaikAwalRow = Number(stokRow.qty_baik) || 0;
          const qtyRusakAwalRow = Number(stokRow.qty_rusak) || 0;
          if (qtyBaikAwalRow <= 0) continue;

          const qtyAmbilRow = Math.min(qtyBaikAwalRow, sisaRetur);
          const qtyBaikAkhirRow = qtyBaikAwalRow - qtyAmbilRow;
          const stokAkhirRow = qtyBaikAkhirRow + qtyRusakAwalRow;

          await new sql.Request(tx)
            .input("stok", sql.Decimal(20, 2), stokAkhirRow)
            .input("qty_baik", sql.Decimal(20, 2), qtyBaikAkhirRow)
            .input("qty_rusak", sql.Decimal(20, 2), qtyRusakAwalRow)
            .input("updated_by", sql.VarChar(255), createdBy)
            .input("updated_at", sql.DateTime, now)
            .input("kode_mn_barang_gudang", sql.VarChar(255), String(stokRow.kode_mn_barang_gudang || ""))
            .query(
              `UPDATE dbo.GWEN_mn_barang_gudang_variant
               SET stok = @stok,
                   qty_baik = @qty_baik,
                   qty_rusak = @qty_rusak,
                   updated_by = @updated_by,
                   updated_at = @updated_at
               WHERE kode_mn_barang_gudang = @kode_mn_barang_gudang;`
            );

          sisaRetur -= qtyAmbilRow;
        }

        if (sisaRetur > 0) {
          throw new Error(
            `VALIDATION:Stok baik varian ${item.kode_barang_variant} tidak cukup untuk dipotong ${qtyRetur}.`
          );
        }

        const histRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(255), item.kode_barang_variant)
          .input("kode_gudang", sql.VarChar(100), gudangItem)
          .query(
            `SELECT TOP 1 stok_akhir_satuan_1
             FROM dbo.GWEN_h_stok_barang_variant
             WHERE kode_barang_variant COLLATE DATABASE_DEFAULT = @kode_barang_variant COLLATE DATABASE_DEFAULT
               AND kode_gudang COLLATE DATABASE_DEFAULT = @kode_gudang COLLATE DATABASE_DEFAULT
             ORDER BY tgl_transaksi DESC, id DESC;`
          );
        const stokAwalHist = Number(histRes.recordset?.[0]?.stok_akhir_satuan_1 ?? stokAwalTotal);
        const stokAkhirHist = stokAwalHist - qtyRetur;
        const kodeHist = `HST.${kodeHeader}.${String(itemIndex + 1).padStart(3, "0")}`;

        await new sql.Request(tx)
          .input("kode_h_stok_barang", sql.VarChar(255), kodeHist)
          .input("kode_ref_transaksi", sql.VarChar(255), kodeHeader)
          .input("tgl_transaksi", sql.DateTime, now)
          .input("ket_transaksi", sql.VarChar(sql.MAX), "RETUR SUPPLIER")
          .input("kode_barang_variant", sql.VarChar(255), item.kode_barang_variant)
          .input("qty_masuk", sql.Decimal(20, 2), 0)
          .input("status", sql.VarChar(255), "KELUAR")
          .input("status_cadangan", sql.VarChar(255), null)
          .input("created_by", sql.VarChar(255), createdBy)
          .input("created_at", sql.DateTime, now)
          .input("updated_by", sql.VarChar(255), createdBy)
          .input("updated_at", sql.DateTime, now)
          .input("kode_gudang", sql.VarChar(255), gudangItem)
          .input("satuan", sql.VarChar(255), item.satuan || "PCS")
          .input("qty_ke_satuan_1", sql.Decimal(20, 2), qtyRetur)
          .input("stok_awal_satuan_1", sql.Decimal(20, 2), stokAwalHist)
          .input("stok_akhir_satuan_1", sql.Decimal(20, 2), stokAkhirHist)
          .input("qty_keluar", sql.Decimal(20, 2), qtyRetur)
          .input("kode_sales", sql.VarChar(255), null)
          .input("ket_inquiry", sql.VarChar(sql.MAX), null)
          .query(
            `INSERT INTO dbo.GWEN_h_stok_barang_variant (
              kode_h_stok_barang, kode_ref_transaksi, tgl_transaksi, ket_transaksi, kode_barang_variant, qty_masuk,
              status, status_cadangan, created_by, created_at, updated_by, updated_at, kode_gudang, satuan,
              qty_ke_satuan_1, stok_awal_satuan_1, stok_akhir_satuan_1, qty_keluar, kode_sales, ket_inquiry
            ) VALUES (
              @kode_h_stok_barang, @kode_ref_transaksi, @tgl_transaksi, @ket_transaksi, @kode_barang_variant, @qty_masuk,
              @status, @status_cadangan, @created_by, @created_at, @updated_by, @updated_at, @kode_gudang, @satuan,
              @qty_ke_satuan_1, @stok_awal_satuan_1, @stok_akhir_satuan_1, @qty_keluar, @kode_sales, @ket_inquiry
            );`
          );
      }

      await tx.commit();
      return reply.send({ message: "Retur supplier tersimpan", kode_t_retur_supplier: kodeHeader });
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // ignore rollback error
      }
      if (String(err?.message || "").startsWith("VALIDATION:")) {
        return reply.code(400).send({ message: String(err.message).replace("VALIDATION:", "") });
      }
      fastify.log.error({ err }, "Failed create retur supplier");
      return reply.code(500).send({ message: "Gagal menyimpan retur supplier" });
    }
  });
}
