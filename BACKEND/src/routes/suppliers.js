export default async function supplierRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const requiredFields = ["nama", "siteCode", "branchCode", "created_by"];
  const contactRequired = ["nama", "tipe", "nilai"];

  fastify.get("/", async (_request, reply) => {
    try {
      const result = await pool
        .request()
        .query(
          `SELECT TOP (200)
            id_supplier, kode_supplier, nama, tipe, jenis, npwp, alamat, kota, provinsi, kode_pos, negara,
            telp_1, telp_2, fax, email, catatan, status, status_cadangan, created_by, created_at,
            updated_by, updated_at, deposit, [top], limit_kredit, kredit_terpakai, sisa_kredit,
            supplier_status, approved_by, approved_at, rejected_by, rejected_at, pkp,
            periode_kunjungan_salesman, nama_bank, no_rekening, atas_nama, cabang,
            ISNULL(item_counts.total_item, 0) AS total_item,
            ISNULL(brand_counts.total_brand, 0) AS total_brand
          FROM dbo.m_supplier s
          OUTER APPLY (
            SELECT COUNT(1) AS total_item
            FROM dbo.m_barang b
            WHERE b.kode_supplier COLLATE DATABASE_DEFAULT = s.kode_supplier COLLATE DATABASE_DEFAULT
          ) item_counts
          OUTER APPLY (
            SELECT COUNT(DISTINCT COALESCE(NULLIF(mm.nama_merk, ''), NULLIF(b.kode_merk, ''))) AS total_brand
            FROM dbo.m_barang b
            OUTER APPLY (
              SELECT CASE WHEN ISNUMERIC(b.kode_merk) = 1 THEN CAST(b.kode_merk AS INT) END AS kode_merk_int
            ) mapm
            LEFT JOIN dbo.m_merk mm ON mm.id_merk = mapm.kode_merk_int
            WHERE b.kode_supplier COLLATE DATABASE_DEFAULT = s.kode_supplier COLLATE DATABASE_DEFAULT
              AND COALESCE(NULLIF(mm.nama_merk, ''), NULLIF(b.kode_merk, '')) IS NOT NULL
          ) brand_counts
          ORDER BY created_at DESC, id_supplier DESC`
        );

      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch suppliers");
      return reply.code(500).send({ message: "Failed to fetch suppliers" });
    }
  });

  fastify.get("/by-code/:kode", async (request, reply) => {
    const { kode } = request.params;
    if (!kode) return reply.code(400).send({ message: "kode_supplier is required" });
    try {
      const res = await pool
        .request()
        .input("kode_supplier", sql.VarChar(50), kode)
        .query(
          `SELECT TOP (1)
            id_supplier, kode_supplier, nama, tipe, jenis, npwp, alamat, kota, provinsi, kode_pos, negara,
            telp_1, telp_2, fax, email, catatan, status, status_cadangan, created_by, created_at,
            updated_by, updated_at, deposit, [top], limit_kredit, kredit_terpakai, sisa_kredit,
            supplier_status, approved_by, approved_at, rejected_by, rejected_at, pkp,
            periode_kunjungan_salesman, nama_bank, no_rekening, atas_nama, cabang, nama_npwp
          FROM dbo.m_supplier
          WHERE kode_supplier = @kode_supplier`
        );
      if (!res.recordset?.length) return reply.code(404).send({ message: "Supplier not found" });
      return reply.send(res.recordset[0]);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch supplier detail");
      return reply.code(500).send({ message: "Failed to fetch supplier detail" });
    }
  });

  fastify.get("/contacts", async (request, reply) => {
    const { kode_supplier, q, active } = request.query || {};
    try {
      const req = pool.request();
      const filters = [];
      if (kode_supplier) {
        req.input("kode_supplier", sql.VarChar(50), String(kode_supplier));
        filters.push("c.kode_supplier = @kode_supplier");
      }
      if (q) {
        req.input("q", sql.NVarChar(255), `%${String(q)}%`);
        filters.push(
          "(c.nama LIKE @q OR c.jabatan LIKE @q OR c.nilai LIKE @q OR c.label LIKE @q OR s.nama LIKE @q)"
        );
      }
      if (active !== undefined) {
        req.input("is_active", sql.Bit, Number(active) ? 1 : 0);
        filters.push("ISNULL(c.is_active, 0) = @is_active");
      }
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const res = await req.query(
        `
        SELECT TOP (1000)
          c.id_contact,
          c.kode_supplier,
          s.nama AS nama_supplier,
          c.nama,
          c.jabatan,
          c.tipe,
          c.nilai,
          c.label,
          c.is_active,
          c.created_by,
          c.created_at,
          c.updated_by,
          c.updated_at
        FROM dbo.m_supplier_contact c
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = c.kode_supplier COLLATE DATABASE_DEFAULT
        ${whereClause}
        ORDER BY c.created_at DESC, c.id_contact DESC
      `
      );
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch supplier contacts");
      return reply.code(500).send({ message: "Failed to fetch contacts" });
    }
  });

  fastify.get("/:kode/contacts", async (request, reply) => {
    const { kode } = request.params;
    if (!kode) return reply.code(400).send({ message: "kode_supplier is required" });
    try {
      const res = await pool
        .request()
        .input("kode_supplier", sql.VarChar(50), kode)
        .query(
          `SELECT TOP (1000)
            id_contact, kode_supplier, nama, jabatan, tipe, nilai, label, is_active,
            created_by, created_at, updated_by, updated_at
           FROM dbo.m_supplier_contact
           WHERE kode_supplier = @kode_supplier
           ORDER BY created_at DESC, id_contact DESC`
        );
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch supplier contacts");
      return reply.code(500).send({ message: "Failed to fetch contacts" });
    }
  });

  fastify.post("/:kode/contacts", async (request, reply) => {
    const { kode } = request.params;
    const body = request.body || {};
    if (!kode) return reply.code(400).send({ message: "kode_supplier is required" });
    for (const f of contactRequired) {
      if (!body[f]) return reply.code(400).send({ message: `Field ${f} is required` });
    }
    const now = new Date();
    try {
      const req = new sql.Request(pool);
      req.input("kode_supplier", sql.VarChar(50), kode);
      req.input("nama", sql.VarChar(255), body.nama || null);
      req.input("jabatan", sql.VarChar(255), body.jabatan || null);
      req.input("tipe", sql.VarChar(50), body.tipe || null);
      req.input("nilai", sql.VarChar(255), body.nilai || null);
      req.input("label", sql.VarChar(255), body.label || null);
      req.input("is_active", sql.Bit, body.is_active ?? 1);
      req.input("created_by", sql.VarChar(100), body.created_by || "Admin");
      req.input("created_at", sql.DateTime2, body.created_at || now);
      req.input("updated_by", sql.VarChar(100), body.updated_by || "Admin");
      req.input("updated_at", sql.DateTime2, body.updated_at || now);

      const insertRes = await req.query(`
        DECLARE @out TABLE (id_contact BIGINT);
        INSERT INTO dbo.m_supplier_contact (
          kode_supplier, nama, jabatan, tipe, nilai, label, is_active,
          created_by, created_at, updated_by, updated_at
        )
        OUTPUT INSERTED.id_contact INTO @out(id_contact)
        VALUES (
          @kode_supplier, @nama, @jabatan, @tipe, @nilai, @label, @is_active,
          @created_by, @created_at, @updated_by, @updated_at
        );
        SELECT id_contact FROM @out;
      `);

      const insertedId = insertRes.recordset?.[0]?.id_contact;
      return reply.code(201).send({
        id_contact: insertedId,
        kode_supplier: kode,
        nama: body.nama,
        jabatan: body.jabatan || null,
        tipe: body.tipe,
        nilai: body.nilai,
        label: body.label || null,
        is_active: body.is_active ?? 1,
        created_by: body.created_by || "Admin",
        created_at: body.created_at || now,
        updated_by: body.updated_by || "Admin",
        updated_at: body.updated_at || now,
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to create supplier contact");
      return reply.code(500).send({ message: "Failed to create contact" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    for (const field of requiredFields) {
      if (!body[field]) {
        return reply.code(400).send({ message: `Field ${field} is required` });
      }
    }

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);

    const siteCode = String(body.siteCode).toUpperCase();
    const branchCode = String(body.branchCode).toUpperCase();

    const prefix = `SUP.${dd}${mm}${yy}${siteCode}${branchCode}`;

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

      const numberReq = new sql.Request(tx);
      const prefixRes = await numberReq
        .input("prefix", sql.VarChar(50), prefix)
        .query(
          "SELECT MAX(CAST(SUBSTRING(kode_supplier, LEN(@prefix) + 1, 5) AS INT)) AS maxNum FROM dbo.m_supplier WITH (UPDLOCK, HOLDLOCK) WHERE kode_supplier LIKE @prefix + '%'"
        );

      const nextNum = (prefixRes.recordset?.[0]?.maxNum || 0) + 1;
      const kode_supplier = `${prefix}${String(nextNum).padStart(5, "0")}`;

      const req = new sql.Request(tx);
      req.input("kode_supplier", sql.VarChar(50), kode_supplier);
      req.input("nama", sql.VarChar(255), body.nama || null);
      req.input("tipe", sql.VarChar(50), body.tipe || null);
      req.input("npwp", sql.VarChar(50), body.npwp || null);
      req.input("alamat", sql.VarChar(255), body.alamat || null);
      req.input("kota", sql.VarChar(100), body.kota || null);
      req.input("provinsi", sql.VarChar(100), body.provinsi || null);
      req.input("kode_pos", sql.VarChar(20), body.kode_pos || null);
      req.input("negara", sql.VarChar(50), body.negara || null);
      req.input("telp_1", sql.VarChar(50), body.telp_1 || null);
      req.input("telp_2", sql.VarChar(50), body.telp_2 || null);
      req.input("fax", sql.VarChar(50), body.fax || null);
      req.input("email", sql.VarChar(100), body.email || null);
      req.input("catatan", sql.VarChar(sql.MAX), body.catatan || null);
      req.input("status", sql.Int, body.status ?? null);
      req.input("status_cadangan", sql.Int, body.status_cadangan ?? null);
      req.input("created_by", sql.VarChar(100), body.created_by);
      req.input("created_at", sql.DateTime2, body.created_at || now);
      req.input("updated_by", sql.VarChar(100), body.updated_by || null);
      req.input("updated_at", sql.DateTime2, body.updated_at || now);
      req.input("jenis", sql.VarChar(50), body.jenis || null);
      req.input("deposit", sql.Decimal(18, 2), body.deposit ?? 0);
      req.input("top", sql.Int, body.top ?? null);
      req.input("limit_kredit", sql.Decimal(18, 2), body.limit_kredit ?? 0);
      req.input("kredit_terpakai", sql.Decimal(18, 2), body.kredit_terpakai ?? 0);
      req.input("sisa_kredit", sql.Decimal(18, 2), body.sisa_kredit ?? 0);
      req.input("supplier_status", sql.Int, body.supplier_status ?? null);
      req.input("approved_by", sql.VarChar(100), body.approved_by || null);
      req.input("approved_at", sql.DateTime2, body.approved_at || null);
      req.input("rejected_by", sql.VarChar(100), body.rejected_by || null);
      req.input("rejected_at", sql.DateTime2, body.rejected_at || null);
      req.input("pkp", sql.Int, body.pkp ?? null);
      req.input(
        "periode_kunjungan_salesman",
        sql.VarChar(50),
        body.periode_kunjungan_salesman || null
      );
      req.input("nama_bank", sql.VarChar(100), body.nama_bank || null);
      req.input("no_rekening", sql.VarChar(100), body.no_rekening || null);
      req.input("atas_nama", sql.VarChar(100), body.atas_nama || null);
      req.input("cabang", sql.VarChar(50), body.cabang || branchCode);

      const insertQuery = `
        INSERT INTO dbo.m_supplier (
          kode_supplier, nama, tipe, npwp, alamat, kota, provinsi, kode_pos, negara,
          telp_1, telp_2, fax, email, catatan, status, status_cadangan, created_by,
          created_at, updated_by, updated_at, jenis, deposit, [top], limit_kredit,
          kredit_terpakai, sisa_kredit, supplier_status, approved_by, approved_at,
          rejected_by, rejected_at, pkp, periode_kunjungan_salesman, nama_bank,
          no_rekening, atas_nama, cabang
        )
        VALUES (
          @kode_supplier, @nama, @tipe, @npwp, @alamat, @kota, @provinsi, @kode_pos, @negara,
          @telp_1, @telp_2, @fax, @email, @catatan, @status, @status_cadangan, @created_by,
          @created_at, @updated_by, @updated_at, @jenis, @deposit, @top, @limit_kredit,
          @kredit_terpakai, @sisa_kredit, @supplier_status, @approved_by, @approved_at,
          @rejected_by, @rejected_at, @pkp, @periode_kunjungan_salesman, @nama_bank,
          @no_rekening, @atas_nama, @cabang
        );
        SELECT SCOPE_IDENTITY() AS id_supplier, @kode_supplier AS kode_supplier;
      `;

      const result = await req.query(insertQuery);
      await tx.commit();

      const inserted = result.recordset?.[0];
      return reply.code(201).send({
        ...body,
        id_supplier: inserted?.id_supplier,
        kode_supplier,
        created_at: body.created_at || now,
        updated_at: now
      });
    } catch (err) {
      await tx.rollback().catch(() => {});
      if (err.number === 2627) {
        return reply.code(409).send({ message: "kode_supplier already exists" });
      }
      fastify.log.error({ err }, "Failed to insert supplier");
      return reply.code(500).send({ message: "Failed to create supplier" });
    }
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};
    if (!id) return reply.code(400).send({ message: "id is required" });

    const now = new Date();
    const req = new sql.Request(pool);
    req.input("id_supplier", sql.Int, Number(id));
    const keepNull = (val) => (val === undefined ? null : val);
    req.input("nama", sql.VarChar(255), body.nama === undefined ? null : body.nama);
    req.input("tipe", sql.VarChar(50), keepNull(body.tipe));
    req.input("npwp", sql.VarChar(50), keepNull(body.npwp));
    req.input("alamat", sql.VarChar(255), keepNull(body.alamat));
    req.input("kota", sql.VarChar(100), keepNull(body.kota));
    req.input("provinsi", sql.VarChar(100), keepNull(body.provinsi));
    req.input("kode_pos", sql.VarChar(20), keepNull(body.kode_pos));
    req.input("negara", sql.VarChar(50), keepNull(body.negara));
    req.input("telp_1", sql.VarChar(50), keepNull(body.telp_1));
    req.input("telp_2", sql.VarChar(50), keepNull(body.telp_2));
    req.input("fax", sql.VarChar(50), keepNull(body.fax));
    req.input("email", sql.VarChar(100), keepNull(body.email));
    req.input("catatan", sql.VarChar(sql.MAX), keepNull(body.catatan));
    req.input("status", sql.Int, keepNull(body.status));
    req.input("status_cadangan", sql.Int, keepNull(body.status_cadangan));
    req.input("updated_by", sql.VarChar(100), body.updated_by || body.created_by || null);
    req.input("updated_at", sql.DateTime2, body.updated_at || now);
    req.input("jenis", sql.VarChar(50), keepNull(body.jenis));
    req.input("deposit", sql.Decimal(18, 2), body.deposit === undefined ? null : body.deposit);
    req.input("top", sql.Int, keepNull(body.top));
    req.input("limit_kredit", sql.Decimal(18, 2), body.limit_kredit === undefined ? null : body.limit_kredit);
    req.input("kredit_terpakai", sql.Decimal(18, 2), body.kredit_terpakai === undefined ? null : body.kredit_terpakai);
    req.input("sisa_kredit", sql.Decimal(18, 2), body.sisa_kredit === undefined ? null : body.sisa_kredit);
    req.input("supplier_status", sql.Int, keepNull(body.supplier_status));
    req.input("approved_by", sql.VarChar(100), keepNull(body.approved_by));
    req.input("approved_at", sql.DateTime2, keepNull(body.approved_at));
    req.input("rejected_by", sql.VarChar(100), keepNull(body.rejected_by));
    req.input("rejected_at", sql.DateTime2, keepNull(body.rejected_at));
    req.input("pkp", sql.Int, keepNull(body.pkp));
    req.input(
      "periode_kunjungan_salesman",
      sql.VarChar(50),
      keepNull(body.periode_kunjungan_salesman)
    );
    req.input("nama_bank", sql.VarChar(100), keepNull(body.nama_bank));
    req.input("no_rekening", sql.VarChar(100), keepNull(body.no_rekening));
    req.input("atas_nama", sql.VarChar(100), keepNull(body.atas_nama));
    req.input("cabang", sql.VarChar(50), keepNull(body.cabang));

    try {
      const result = await req.query(`
        UPDATE dbo.m_supplier
        SET
          nama = COALESCE(@nama, nama),
          tipe = COALESCE(@tipe, tipe),
          npwp = COALESCE(@npwp, npwp),
          alamat = COALESCE(@alamat, alamat),
          kota = COALESCE(@kota, kota),
          provinsi = COALESCE(@provinsi, provinsi),
          kode_pos = COALESCE(@kode_pos, kode_pos),
          negara = COALESCE(@negara, negara),
          telp_1 = COALESCE(@telp_1, telp_1),
          telp_2 = COALESCE(@telp_2, telp_2),
          fax = COALESCE(@fax, fax),
          email = COALESCE(@email, email),
          catatan = COALESCE(@catatan, catatan),
          status = COALESCE(@status, status),
          status_cadangan = COALESCE(@status_cadangan, status_cadangan),
          updated_by = @updated_by,
          updated_at = @updated_at,
          jenis = COALESCE(@jenis, jenis),
          deposit = COALESCE(@deposit, deposit),
          [top] = COALESCE(@top, [top]),
          limit_kredit = COALESCE(@limit_kredit, limit_kredit),
          kredit_terpakai = COALESCE(@kredit_terpakai, kredit_terpakai),
          sisa_kredit = COALESCE(@sisa_kredit, sisa_kredit),
          supplier_status = COALESCE(@supplier_status, supplier_status),
          approved_by = COALESCE(@approved_by, approved_by),
          approved_at = COALESCE(@approved_at, approved_at),
          rejected_by = COALESCE(@rejected_by, rejected_by),
          rejected_at = COALESCE(@rejected_at, rejected_at),
          pkp = COALESCE(@pkp, pkp),
          periode_kunjungan_salesman = COALESCE(@periode_kunjungan_salesman, periode_kunjungan_salesman),
          nama_bank = COALESCE(@nama_bank, nama_bank),
          no_rekening = COALESCE(@no_rekening, no_rekening),
          atas_nama = COALESCE(@atas_nama, atas_nama),
          cabang = COALESCE(@cabang, cabang)
        WHERE id_supplier = @id_supplier;
      `);

      if (result.rowsAffected?.[0] === 0) {
        return reply.code(404).send({ message: "Supplier not found" });
      }

      return reply.send({ message: "Supplier updated" });
    } catch (err) {
      fastify.log.error({ err }, "Failed to update supplier");
      return reply.code(500).send({ message: "Failed to update supplier" });
    }
  });
}
