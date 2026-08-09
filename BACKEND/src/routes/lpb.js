export default async function lpbRoutes(fastify) {
  const { sql, pool } = fastify.mssql;
  const formatDateOnly = (value) => {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
    return String(value || "").slice(0, 10);
  };

  const resolveLpb = async (param, req) => {
    const raw = String(param || "").trim();
    if (!raw) return null;
    if (raw.toUpperCase().startsWith("LPB")) {
      const res = await req
        .input("kode_lpb", sql.VarChar(40), raw)
        .query(
          `
          SELECT TOP 1 kode_lpb, kode_t_rpo
          FROM dbo.GWEN_t_lpb
          WHERE RTRIM(LTRIM(kode_lpb)) = RTRIM(LTRIM(@kode_lpb));
        `
        );
      return res.recordset?.[0] || null;
    }
    const res = await req
      .input("kode_t_rpo", sql.VarChar(30), raw)
      .query(
        `
        SELECT TOP 1 kode_lpb, kode_t_rpo
        FROM dbo.GWEN_t_lpb
        WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo));
      `
      );
    return res.recordset?.[0] || null;
  };

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

  const generateFallbackCode = (prefix) => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${prefix}.${yy}${mm}${dd}${hh}${mi}${ss}`;
  };

  fastify.post("/from-rpo/:kode", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const createdBy = String(body.created_by || "Admin").trim();
    if (!kode) return reply.code(400).send({ message: "kode_t_rpo wajib diisi" });

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

      const existing = await new sql.Request(tx)
        .input("kode_t_rpo", sql.VarChar(30), kode.trim())
        .query("SELECT TOP 1 kode_lpb FROM dbo.GWEN_t_lpb WHERE kode_t_rpo = @kode_t_rpo");

      let kodeLpb = existing.recordset?.[0]?.kode_lpb || null;
      if (!kodeLpb) {
        let generated = null;
        try {
          generated = await generateDocCode({ prefix: "LPB", tx });
        } catch {
          generated = generateFallbackCode("LPB");
        }
        kodeLpb = generated;

        const rpoHeader = await new sql.Request(tx)
          .input("kode_t_rpo", sql.VarChar(30), kode.trim())
          .query(`
            SELECT TOP 1 t.kode_t_rpo, t.kode_supplier, s.nama AS supplier_nama
            FROM dbo.GWEN_t_rpo t
            LEFT JOIN dbo.m_supplier s
              ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
            WHERE RTRIM(LTRIM(t.kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
              AND t.is_active = 1;
          `);
        if (!rpoHeader.recordset?.length) {
          await tx.rollback();
          return reply.code(404).send({ message: "RPO tidak ditemukan" });
        }
        const header = rpoHeader.recordset[0];

        await new sql.Request(tx)
          .input("kode_lpb", sql.VarChar(40), kodeLpb)
          .input("kode_t_rpo", sql.VarChar(30), header.kode_t_rpo)
          .input("kode_supplier", sql.VarChar(30), header.kode_supplier)
          .input("tgl_lpb", sql.Date, new Date())
          .input("status", sql.VarChar(20), "DRAFT")
          .input("created_by", sql.NVarChar(100), createdBy)
          .input("updated_by", sql.NVarChar(100), createdBy)
          .query(`
            INSERT INTO dbo.GWEN_t_lpb (
              kode_lpb, kode_t_rpo, kode_supplier, tgl_lpb, status, created_by, updated_by
            )
            VALUES (
              @kode_lpb, @kode_t_rpo, @kode_supplier, @tgl_lpb, @status, @created_by, @updated_by
            );
          `);

        const rpoItems = await new sql.Request(tx)
          .input("kode_t_rpo", sql.VarChar(30), kode.trim())
          .query(`
            SELECT
              d.kode_barang_variant,
              d.qty,
              d.catatan,
              v.barcode_varian,
              v.nama_varian,
              b.nama AS barang_nama
            FROM dbo.GWEN_d_rpo d
            LEFT JOIN dbo.m_barang_varian v
              ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT
            LEFT JOIN dbo.m_barang b
              ON b.id_barang = v.id_barang
            WHERE RTRIM(LTRIM(d.kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
              AND d.is_active = 1
            ORDER BY d.created_at ASC, d.kode_d_rpo ASC;
          `);

        let urut = 1;
        for (const row of rpoItems.recordset || []) {
          let kodeDLpb;
          try {
            kodeDLpb = await generateDocCode({ prefix: "DLB", tx });
          } catch {
            kodeDLpb = `DLB.${String(urut).padStart(6, "0")}`;
          }
          urut += 1;
          await new sql.Request(tx)
            .input("kode_d_lpb", sql.VarChar(40), kodeDLpb)
            .input("kode_lpb", sql.VarChar(40), kodeLpb)
            .input("kode_barang_variant", sql.VarChar(50), row.kode_barang_variant || "")
            .input("barcode_varian", sql.VarChar(255), row.barcode_varian || null)
            .input("nama_barang", sql.NVarChar(255), row.barang_nama || row.nama_varian || null)
            .input("catatan", sql.VarChar(255), row.catatan || null)
            .input("qty_rpo", sql.Int, Number(row.qty ?? 0))
            .input("qty", sql.Int, Number(row.qty ?? 0))
            .input("status", sql.Int, 1)
            .input("created_by", sql.NVarChar(100), createdBy)
            .input("updated_by", sql.NVarChar(100), createdBy)
            .query(`
              INSERT INTO dbo.GWEN_d_lpb (
                kode_d_lpb, kode_lpb, kode_barang_variant, barcode_varian, nama_barang, catatan, qty_rpo, qty, status, created_by, updated_by
              )
              VALUES (
                @kode_d_lpb, @kode_lpb, @kode_barang_variant, @barcode_varian, @nama_barang, @catatan, @qty_rpo, @qty, @status, @created_by, @updated_by
              );
            `);
        }
      }

      if (kodeLpb) {
        await new sql.Request(tx)
          .input("kode_lpb", sql.VarChar(40), kodeLpb)
          .input("kode_t_rpo", sql.VarChar(30), kode.trim())
          .query(`
            UPDATE d
            SET d.qty_rpo = r.qty
            FROM dbo.GWEN_d_lpb d
            JOIN dbo.GWEN_t_lpb h ON h.kode_lpb = d.kode_lpb
            JOIN dbo.GWEN_d_rpo r
              ON RTRIM(LTRIM(r.kode_t_rpo)) = RTRIM(LTRIM(h.kode_t_rpo))
             AND RTRIM(LTRIM(r.kode_barang_variant)) = RTRIM(LTRIM(d.kode_barang_variant))
            WHERE d.kode_lpb = @kode_lpb
              AND RTRIM(LTRIM(h.kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
              AND (d.qty_rpo = 0 OR d.qty_rpo IS NULL);
          `);
      }

      const headerRes = await new sql.Request(tx)
        .input("kode_lpb", sql.VarChar(40), kodeLpb)
        .query(`
          SELECT h.kode_lpb, h.kode_t_rpo, h.kode_supplier, h.tgl_lpb, h.status, h.created_by, h.created_at, h.updated_by, h.updated_at,
            s.nama AS supplier_nama
          FROM dbo.GWEN_t_lpb h
          LEFT JOIN dbo.m_supplier s
            ON s.kode_supplier COLLATE DATABASE_DEFAULT = h.kode_supplier COLLATE DATABASE_DEFAULT
          WHERE h.kode_lpb = @kode_lpb;
        `);
        const detailRes = await new sql.Request(tx)
          .input("kode_lpb", sql.VarChar(40), kodeLpb)
          .query(`
          SELECT
            d.kode_d_lpb,
            d.kode_lpb,
            d.kode_barang_variant,
            d.barcode_varian,
            d.nama_barang,
            d.catatan,
            d.qty_rpo,
            d.qty,
            d.status,
            b.nama AS barang_nama,
            v.nama_varian
          FROM dbo.GWEN_d_lpb d
          LEFT JOIN dbo.m_barang_varian v
            ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.m_barang b
            ON b.id_barang = v.id_barang
          WHERE d.kode_lpb = @kode_lpb
          ORDER BY d.created_at ASC, d.kode_d_lpb ASC;
        `);

      const headerRow = headerRes.recordset?.[0] || null;
      const catatanRes = await new sql.Request(tx)
        .input("kode_t_rpo", sql.VarChar(30), headerRow?.kode_t_rpo || kode.trim())
        .query(`
          SELECT kode_barang_variant, catatan
          FROM dbo.GWEN_d_rpo
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
            AND is_active = 1;
        `);

      const expiredRes = await new sql.Request(tx)
        .input("kode_lpb", sql.VarChar(40), kodeLpb)
        .query(`
          SELECT kode_barang_variant, expired_date
          FROM dbo.GWEN_d_lpb_expired
          WHERE RTRIM(LTRIM(kode_lpb)) = RTRIM(LTRIM(@kode_lpb));
        `);

      const catatanMap = new Map();
      (catatanRes.recordset || []).forEach((row) => {
        const key = String(row.kode_barang_variant || "").trim();
        if (!key) return;
        catatanMap.set(key, row.catatan || null);
      });

      const expiredMap = new Map();
      (expiredRes.recordset || []).forEach((row) => {
        const key = String(row.kode_barang_variant || "").trim();
        if (!key) return;
        if (!expiredMap.has(key)) expiredMap.set(key, []);
        expiredMap.get(key).push(formatDateOnly(row.expired_date));
      });

      const items = (detailRes.recordset || []).map((row) => ({
        ...row,
        nama_barang: row.barang_nama || row.nama_barang || null,
        catatan: row.catatan || catatanMap.get(String(row.kode_barang_variant || "").trim()) || null,
        expired_dates: expiredMap.get(String(row.kode_barang_variant || "").trim()) || [],
      }));

      await tx.commit();
      return reply.send({ header: headerRow, items });
    } catch (err) {
      await tx.rollback().catch(() => {});
      request.log.error({ err }, "Failed create LPB from RPO");
      return reply.code(500).send({ message: "Gagal membuat LPB" });
    }
  });

  fastify.get("/", async (_request, reply) => {
    try {
      const headerRes = await pool.request().query(
        `
        SELECT
          h.kode_lpb,
          h.kode_t_rpo,
          h.kode_supplier,
          h.tgl_lpb,
          h.status,
          h.verifikasi_by,
          h.verifikasi_at,
          h.created_at,
          s.nama AS supplier_nama,
          (SELECT COUNT(1) FROM dbo.GWEN_d_lpb d WHERE d.kode_lpb = h.kode_lpb) AS total_item,
          (SELECT SUM(ISNULL(d.qty, 0)) FROM dbo.GWEN_d_lpb d WHERE d.kode_lpb = h.kode_lpb) AS total_qty
        FROM dbo.GWEN_t_lpb h
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = h.kode_supplier COLLATE DATABASE_DEFAULT
        ORDER BY h.created_at DESC, h.kode_lpb DESC;
      `
      );
      return reply.send(headerRes.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch LPB list");
      return reply.code(500).send({ message: "Gagal memuat daftar LPB" });
    }
  });

  fastify.get("/:kode", async (request, reply) => {
    const { kode } = request.params;
    if (!kode) return reply.code(400).send({ message: "kode wajib diisi" });
    try {
      const baseReq = pool.request();
      const resolved = await resolveLpb(kode, baseReq);
      if (!resolved) {
        return reply.code(404).send({ message: "LPB tidak ditemukan" });
      }
      const headerRes = await pool
        .request()
        .input("kode_lpb", sql.VarChar(40), resolved.kode_lpb)
        .query(`
          SELECT TOP 1 h.kode_lpb, h.kode_t_rpo, h.kode_supplier, h.tgl_lpb, h.status, h.created_by, h.created_at, h.updated_by, h.updated_at,
            s.nama AS supplier_nama
          FROM dbo.GWEN_t_lpb h
          LEFT JOIN dbo.m_supplier s
            ON s.kode_supplier COLLATE DATABASE_DEFAULT = h.kode_supplier COLLATE DATABASE_DEFAULT
          WHERE RTRIM(LTRIM(h.kode_lpb)) = RTRIM(LTRIM(@kode_lpb));
        `);
      if (!headerRes.recordset?.length) {
        return reply.code(404).send({ message: "LPB tidak ditemukan" });
      }
      const headerRow = headerRes.recordset[0];
      const header = headerRow ? { ...headerRow } : null;
      await pool
        .request()
        .input("kode_lpb", sql.VarChar(40), header.kode_lpb)
        .input("kode_t_rpo", sql.VarChar(30), header.kode_t_rpo)
        .query(`
          UPDATE d
          SET d.qty_rpo = r.qty
          FROM dbo.GWEN_d_lpb d
          JOIN dbo.GWEN_d_rpo r
            ON RTRIM(LTRIM(r.kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
           AND RTRIM(LTRIM(r.kode_barang_variant)) = RTRIM(LTRIM(d.kode_barang_variant))
          WHERE d.kode_lpb = @kode_lpb
            AND (d.qty_rpo = 0 OR d.qty_rpo IS NULL);
        `);
      const detailRes = await pool
        .request()
        .input("kode_lpb", sql.VarChar(40), header.kode_lpb)
        .query(`
          SELECT
            d.kode_d_lpb,
            d.kode_lpb,
            d.kode_barang_variant,
            d.barcode_varian,
            d.nama_barang,
            d.catatan,
            d.qty_rpo,
            d.qty,
            d.status,
            b.nama AS barang_nama,
            v.nama_varian
          FROM dbo.GWEN_d_lpb d
          LEFT JOIN dbo.m_barang_varian v
            ON v.kode_barang_variant COLLATE DATABASE_DEFAULT = d.kode_barang_variant COLLATE DATABASE_DEFAULT
          LEFT JOIN dbo.m_barang b
            ON b.id_barang = v.id_barang
          WHERE d.kode_lpb = @kode_lpb
          ORDER BY d.created_at ASC, d.kode_d_lpb ASC;
        `);

      const catatanRes = await pool
        .request()
        .input("kode_t_rpo", sql.VarChar(30), header.kode_t_rpo)
        .query(`
          SELECT kode_barang_variant, catatan
          FROM dbo.GWEN_d_rpo
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo))
            AND is_active = 1;
        `);

      const expiredRes = await pool
        .request()
        .input("kode_lpb", sql.VarChar(40), header.kode_lpb)
        .query(`
          SELECT kode_barang_variant, expired_date
          FROM dbo.GWEN_d_lpb_expired
          WHERE RTRIM(LTRIM(kode_lpb)) = RTRIM(LTRIM(@kode_lpb));
        `);

      const catatanMap = new Map();
      (catatanRes.recordset || []).forEach((row) => {
        const key = String(row.kode_barang_variant || "").trim();
        if (!key) return;
        catatanMap.set(key, row.catatan || null);
      });

      const expiredMap = new Map();
      (expiredRes.recordset || []).forEach((row) => {
        const key = String(row.kode_barang_variant || "").trim();
        if (!key) return;
        if (!expiredMap.has(key)) expiredMap.set(key, []);
        expiredMap.get(key).push(formatDateOnly(row.expired_date));
      });

      const items = (detailRes.recordset || []).map((row) => ({
        ...row,
        nama_barang: row.barang_nama || row.nama_barang || null,
        catatan: row.catatan || catatanMap.get(String(row.kode_barang_variant || "").trim()) || null,
        expired_dates: expiredMap.get(String(row.kode_barang_variant || "").trim()) || [],
      }));

      return reply.send({ header, items });
    } catch (err) {
      request.log.error({ err }, "Failed fetch LPB");
      return reply.code(500).send({ message: "Gagal memuat LPB" });
    }
  });

  fastify.put("/:kode/items", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodeDLpb = body.kode_d_lpb ? String(body.kode_d_lpb).trim() : "";
    const kodeBarangVariant = String(body.kode_barang_variant || "").trim();
    const barcodeVarian = body.barcode_varian ? String(body.barcode_varian).trim() : null;
    const namaBarang = body.nama_barang ? String(body.nama_barang).trim() : null;
    const catatan = body.catatan ? String(body.catatan).trim() : null;
    const qty = Number(body.qty ?? 0);
    const qtyRpoRaw = body.qty_rpo;
    const hasQtyRpo = qtyRpoRaw !== undefined && qtyRpoRaw !== null;
    const qtyRpo = Number(qtyRpoRaw ?? 0);
    const updatedBy = String(body.updated_by || "Admin").trim();
    const status = body.status !== undefined && body.status !== null ? Number(body.status) : 1;

    if (!kode || (!kodeBarangVariant && !kodeDLpb)) {
      return reply.code(400).send({ message: "kode dan kode_barang_variant/kode_d_lpb wajib diisi" });
    }
    if (Number.isNaN(qty) || qty < 0) {
      return reply.code(400).send({ message: "qty tidak valid" });
    }
    if (hasQtyRpo && (Number.isNaN(qtyRpo) || qtyRpo < 0)) {
      return reply.code(400).send({ message: "qty_rpo tidak valid" });
    }

    try {
      const baseReq = pool.request();
      const resolved = await resolveLpb(kode, baseReq);
      if (!resolved) {
        return reply.code(404).send({ message: "LPB tidak ditemukan" });
      }
      const kodeLpb = resolved.kode_lpb;

      let existing = null;
      if (kodeDLpb) {
        const existingById = await pool
          .request()
          .input("kode_lpb", sql.VarChar(40), kodeLpb)
          .input("kode_d_lpb", sql.VarChar(40), kodeDLpb)
          .query(`
            SELECT TOP 1 kode_d_lpb
            FROM dbo.GWEN_d_lpb
            WHERE kode_lpb = @kode_lpb
              AND kode_d_lpb = @kode_d_lpb;
          `);
        existing = existingById.recordset?.[0] || null;
      } else {
        const existingByVariant = await pool
          .request()
          .input("kode_lpb", sql.VarChar(40), kodeLpb)
          .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
          .query(`
            SELECT TOP 1 kode_d_lpb
            FROM dbo.GWEN_d_lpb
            WHERE kode_lpb = @kode_lpb
              AND kode_barang_variant = @kode_barang_variant;
          `);
        existing = existingByVariant.recordset?.[0] || null;
      }

      if (existing?.kode_d_lpb) {
        const req = pool
          .request()
          .input("kode_d_lpb", sql.VarChar(40), existing.kode_d_lpb)
          .input("barcode_varian", sql.VarChar(255), barcodeVarian)
          .input("nama_barang", sql.NVarChar(255), namaBarang)
          .input("catatan", sql.VarChar(255), catatan)
          .input("qty", sql.Int, Math.floor(qty))
          .input("status", sql.Int, status)
          .input("updated_by", sql.NVarChar(100), updatedBy)
          .input("updated_at", sql.DateTime2, new Date());
        if (hasQtyRpo) {
          req.input("qty_rpo", sql.Int, Math.floor(qtyRpo));
        }
        await req.query(`
            UPDATE dbo.GWEN_d_lpb
            SET barcode_varian = @barcode_varian,
                nama_barang = @nama_barang,
                catatan = @catatan,
                qty = @qty,
                ${hasQtyRpo ? "qty_rpo = @qty_rpo," : ""}
                status = @status,
                updated_by = @updated_by,
                updated_at = @updated_at
            WHERE kode_d_lpb = @kode_d_lpb;
          `);
        return reply.send({ message: "Item updated" });
      }

      let newKodeDLpb;
      try {
        newKodeDLpb = await generateDocCode({ prefix: "DLB" });
      } catch {
        newKodeDLpb = generateFallbackCode("DLB");
      }
      await pool
        .request()
        .input("kode_d_lpb", sql.VarChar(40), newKodeDLpb)
        .input("kode_lpb", sql.VarChar(40), kodeLpb)
        .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
        .input("barcode_varian", sql.VarChar(255), barcodeVarian)
        .input("nama_barang", sql.NVarChar(255), namaBarang)
        .input("catatan", sql.VarChar(255), catatan)
        .input("qty_rpo", sql.Int, Math.floor(hasQtyRpo ? qtyRpo : 0))
        .input("qty", sql.Int, Math.floor(qty))
        .input("status", sql.Int, status)
        .input("created_by", sql.NVarChar(100), updatedBy)
        .input("updated_by", sql.NVarChar(100), updatedBy)
        .query(`
          INSERT INTO dbo.GWEN_d_lpb (
            kode_d_lpb, kode_lpb, kode_barang_variant, barcode_varian, nama_barang, catatan, qty_rpo, qty, status, created_by, updated_by
          )
          VALUES (
            @kode_d_lpb, @kode_lpb, @kode_barang_variant, @barcode_varian, @nama_barang, @catatan, @qty_rpo, @qty, @status, @created_by, @updated_by
          );
        `);
      return reply.send({ message: "Item added" });
    } catch (err) {
      request.log.error({ err }, "Failed upsert LPB item");
      return reply.code(500).send({ message: "Gagal menyimpan item LPB" });
    }
  });

  fastify.delete("/:kode/items/:item", async (request, reply) => {
    const { kode, item } = request.params;
    if (!kode || !item) return reply.code(400).send({ message: "kode dan kode_d_lpb wajib diisi" });
    try {
      const baseReq = pool.request();
      const resolved = await resolveLpb(kode, baseReq);
      if (!resolved) {
        return reply.code(404).send({ message: "LPB tidak ditemukan" });
      }
      const kodeLpb = resolved.kode_lpb;
      const res = await pool
        .request()
        .input("kode_lpb", sql.VarChar(40), kodeLpb)
        .input("kode_d_lpb", sql.VarChar(40), item)
        .query(`
          DELETE FROM dbo.GWEN_d_lpb
          WHERE kode_lpb = @kode_lpb AND kode_d_lpb = @kode_d_lpb;
        `);
      if (res.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Item tidak ditemukan" });
      }
      return reply.send({ message: "Item deleted" });
    } catch (err) {
      request.log.error({ err }, "Failed delete LPB item");
      return reply.code(500).send({ message: "Gagal menghapus item LPB" });
    }
  });

  fastify.put("/:kode/save", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const updatedBy = String(body.updated_by || "Admin").trim();
    const verifikasiBy = body.verifikasi_by ? String(body.verifikasi_by).trim() : updatedBy;
    if (!kode) return reply.code(400).send({ message: "kode wajib diisi" });
    try {
      const baseReq = pool.request();
      const resolved = await resolveLpb(kode, baseReq);
      if (!resolved) {
        return reply.code(404).send({ message: "LPB tidak ditemukan" });
      }
      const res = await pool
        .request()
        .input("kode_t_rpo", sql.VarChar(30), resolved.kode_t_rpo)
        .input("updated_by", sql.NVarChar(100), updatedBy)
        .input("updated_at", sql.DateTime2, new Date())
        .input("verifikasi_by", sql.NVarChar(100), verifikasiBy)
        .input("verifikasi_at", sql.DateTime2, new Date())
        .query(`
          UPDATE dbo.GWEN_t_lpb
          SET status = 'SAVED',
              updated_by = @updated_by,
              updated_at = @updated_at,
              verifikasi_by = @verifikasi_by,
              verifikasi_at = @verifikasi_at
          WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo));
        `);
      if (res.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "LPB tidak ditemukan" });
      }
      const kodeLpb = resolved.kode_lpb;
      if (kodeLpb) {
        await pool
          .request()
          .input("kode_t_rpo", sql.VarChar(30), resolved.kode_t_rpo)
          .input("kode_lpb", sql.VarChar(40), kodeLpb)
          .input("updated_at", sql.DateTime2, new Date())
          .query(`
            UPDATE dbo.GWEN_t_rpo
            SET kode_lpb = @kode_lpb,
                updated_at = @updated_at
            WHERE RTRIM(LTRIM(kode_t_rpo)) = RTRIM(LTRIM(@kode_t_rpo));
          `);
      }
      return reply.send({ message: "LPB tersimpan" });
    } catch (err) {
      request.log.error({ err }, "Failed save LPB");
      return reply.code(500).send({ message: "Gagal menyimpan LPB" });
    }
  });

  fastify.put("/:kode/expired", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    const kodeBarangVariant = String(body.kode_barang_variant || "").trim();
    const expiredDates = Array.isArray(body.expired_dates) ? body.expired_dates : [];
    if (!kode || !kodeBarangVariant) {
      return reply.code(400).send({ message: "kode dan kode_barang_variant wajib diisi" });
    }
    try {
      const baseReq = pool.request();
      const resolved = await resolveLpb(kode, baseReq);
      if (!resolved) {
        return reply.code(404).send({ message: "LPB tidak ditemukan" });
      }
      const kodeLpb = resolved.kode_lpb;
      const tx = new sql.Transaction(pool);
      await tx.begin();
      await new sql.Request(tx)
        .input("kode_lpb", sql.VarChar(40), kodeLpb)
        .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
        .query(
          `
          DELETE FROM dbo.GWEN_d_lpb_expired
          WHERE RTRIM(LTRIM(kode_lpb)) = RTRIM(LTRIM(@kode_lpb))
            AND RTRIM(LTRIM(kode_barang_variant)) = RTRIM(LTRIM(@kode_barang_variant));
        `
        );
      for (const date of expiredDates) {
        const value = String(date || "").trim();
        if (!value) continue;
        await new sql.Request(tx)
          .input("kode_lpb", sql.VarChar(40), kodeLpb)
          .input("kode_t_rpo", sql.VarChar(30), resolved.kode_t_rpo)
          .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
          .input("expired_date", sql.Date, value)
          .input("created_at", sql.DateTime, new Date())
          .query(
            `
            INSERT INTO dbo.GWEN_d_lpb_expired (kode_lpb, kode_t_rpo, kode_barang_variant, expired_date, created_at)
            VALUES (@kode_lpb, @kode_t_rpo, @kode_barang_variant, @expired_date, @created_at);
          `
          );
      }
      await tx.commit();
      return reply.send({ message: "Expired LPB tersimpan" });
    } catch (err) {
      request.log.error({ err }, "Failed update LPB expired");
      return reply.code(500).send({ message: "Gagal menyimpan expired LPB" });
    }
  });
}
