export default async function hargaJualRequestRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const generateDocCode = async (tx, prefix, userCode) => {
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const req = new sql.Request(tx);
      req.input("Prefix", sql.VarChar(10), prefix);
      req.input("ExecDate", sql.VarChar(10), todayIso);
      req.input("UserCode", sql.VarChar(50), userCode || "Admin");
      req.input("BranchCode", sql.VarChar(10), "YZ");
      req.input("PadLength", sql.Int, 5);
      req.input("Separator", sql.VarChar(5), ".");
      req.output("NextNo", sql.Int);
      req.output("GeneratedCode", sql.VarChar(50));
      await req.execute("GWEN_GenerateDocCode");
      const code = req.parameters.GeneratedCode?.value;
      if (code) return code;
      throw new Error("GeneratedCode kosong");
    } catch (err) {
      fastify.log.error({ err }, "Failed to generate kode via GWEN_GenerateDocCode");
      const date = new Date();
      const yy = String(date.getFullYear()).slice(-2);
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const hh = String(date.getHours()).padStart(2, "0");
      const mi = String(date.getMinutes()).padStart(2, "0");
      const ss = String(date.getSeconds()).padStart(2, "0");
      const ms = String(date.getMilliseconds()).padStart(3, "0");
      return `${prefix}.${yy}${mm}${dd}${hh}${mi}${ss}${ms}`;
    }
  };

  const generateDetailCode = (prefix, index) => {
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
    return Number(((val - base) / base * 100).toFixed(2));
  };

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const requestedBy = String(body.requested_by || body.created_by || "Admin").trim() || "Admin";
    const catatan = body.catatan ? String(body.catatan).trim() : null;

    if (!items.length) {
      return reply.code(400).send({ message: "items wajib diisi" });
    }

    const kodeList = Array.from(
      new Set(
        items
          .map((it) => String(it.kode_barang_variant || "").trim())
          .filter((kode) => kode)
      )
    );
    if (!kodeList.length) {
      return reply.code(400).send({ message: "kode_barang_variant wajib diisi" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const kodeTRequest = await generateDocCode(tx, "HJR", requestedBy);
      if (!kodeTRequest) throw new Error("Gagal generate kode request");

      await new sql.Request(tx)
        .input("kode_t_request", sql.VarChar(50), kodeTRequest)
        .input("tgl_request", sql.DateTime2, new Date())
        .input("status_request", sql.Int, 0)
        .input("requested_by", sql.VarChar(100), requestedBy)
        .input("requested_at", sql.DateTime2, new Date())
        .input("catatan", sql.VarChar(255), catatan)
        .input("total_item", sql.Int, items.length)
        .query(
          `INSERT INTO dbo.GWEN_t_harga_jual_request (
            kode_t_request, tgl_request, status_request, requested_by, requested_at, catatan, total_item
          ) VALUES (
            @kode_t_request, @tgl_request, @status_request, @requested_by, @requested_at, @catatan, @total_item
          );`
        );

      const kodeParams = kodeList.map((_, idx) => `@kode${idx}`).join(", ");
      const mapReq = new sql.Request(tx);
      kodeList.forEach((kode, idx) => {
        mapReq.input(`kode${idx}`, sql.VarChar(50), kode);
      });
      const snapshotRes = await mapReq.query(
        `SELECT kode_barang_variant, harga_beli_sat_1, hpp_avg_sat_1
         FROM dbo.m_barang_varian
         WHERE kode_barang_variant IN (${kodeParams});`
      );
      const snapshotMap = new Map(
        (snapshotRes.recordset || []).map((row) => [
          String(row.kode_barang_variant),
          { harga_beli: row.harga_beli_sat_1, hpp: row.hpp_avg_sat_1 },
        ])
      );

      let detailIndex = 1;
      for (const item of items) {
        const kodeBarangVariant = String(item.kode_barang_variant || "").trim();
        const idKelas = Number(item.id_kelas_harga ?? 0);
        if (!kodeBarangVariant || !idKelas) continue;
        const detailCode = generateDetailCode("HJD", detailIndex++);
        const snap = snapshotMap.get(kodeBarangVariant) || {};
        const hargaBeli = item.harga_beli_snapshot ?? snap.harga_beli ?? null;
        const hpp = item.hpp_snapshot ?? snap.hpp ?? null;

        await new sql.Request(tx)
          .input("kode_d_request", sql.VarChar(50), detailCode)
          .input("kode_t_request", sql.VarChar(50), kodeTRequest)
          .input("kode_barang_variant", sql.VarChar(50), kodeBarangVariant)
          .input("id_kelas_harga", sql.Int, idKelas)
          .input("harga_1", sql.Decimal(20, 2), item.harga_1 ?? null)
          .input("harga_3", sql.Decimal(20, 2), item.harga_3 ?? null)
          .input("harga_6", sql.Decimal(20, 2), item.harga_6 ?? null)
          .input("harga_12", sql.Decimal(20, 2), item.harga_12 ?? null)
          .input("harga_beli_snapshot", sql.Decimal(20, 2), hargaBeli)
          .input("hpp_snapshot", sql.Decimal(20, 2), hpp)
          .input("rasio_1", sql.Decimal(10, 2), null)
          .input("rasio_3", sql.Decimal(10, 2), null)
          .input("rasio_6", sql.Decimal(10, 2), null)
          .input("rasio_12", sql.Decimal(10, 2), null)
          .input("status_item", sql.Int, 0)
          .query(
            `INSERT INTO dbo.GWEN_d_harga_jual_request (
              kode_d_request, kode_t_request, kode_barang_variant, id_kelas_harga,
              harga_1, harga_3, harga_6, harga_12,
              harga_beli_snapshot, hpp_snapshot,
              rasio_1, rasio_3, rasio_6, rasio_12,
              status_item
            ) VALUES (
              @kode_d_request, @kode_t_request, @kode_barang_variant, @id_kelas_harga,
              @harga_1, @harga_3, @harga_6, @harga_12,
              @harga_beli_snapshot, @hpp_snapshot,
              @rasio_1, @rasio_3, @rasio_6, @rasio_12,
              @status_item
            );`
          );
      }

      await tx.commit();
      return reply.code(201).send({ kode_t_request: kodeTRequest });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed create harga jual request");
      return reply.code(500).send({ message: "Gagal membuat request harga jual" });
    }
  });

  fastify.get("/", async (request, reply) => {
    const q = String(request.query?.q || "").trim();
    try {
      const req = pool.request();
      const hasSearch = q.length > 0;
      if (hasSearch) {
        req.input("q", sql.VarChar(200), `%${q}%`);
      }
      const whereClause = hasSearch
        ? `WHERE (
            t.kode_t_request LIKE @q
            OR t.requested_by LIKE @q
            OR EXISTS (
              SELECT 1
              FROM dbo.GWEN_d_harga_jual_request d
              JOIN dbo.m_barang_varian v ON v.kode_barang_variant = d.kode_barang_variant
              JOIN dbo.m_barang b ON b.id_barang = v.id_barang
              WHERE d.kode_t_request = t.kode_t_request
                AND (
                  b.nama LIKE @q
                  OR v.nama_varian LIKE @q
                  OR d.kode_barang_variant LIKE @q
                )
            )
          )`
        : "";

      const result = await req.query(
        `WITH detail_summary AS (
           SELECT
             d.kode_t_request,
             SUM(CASE WHEN ISNULL(d.status_item, 0) = 1 THEN 1 ELSE 0 END) AS approved_item,
             SUM(CASE WHEN ISNULL(d.status_item, 0) = 2 THEN 1 ELSE 0 END) AS rejected_item,
             SUM(CASE WHEN ISNULL(d.status_item, 0) = 0 THEN 1 ELSE 0 END) AS pending_item
           FROM dbo.GWEN_d_harga_jual_request d
           GROUP BY d.kode_t_request
         )
         SELECT
           t.kode_t_request,
           t.tgl_request,
           t.status_request,
           t.requested_by,
           t.requested_at,
           t.approved_by,
           t.approved_at,
           t.rejected_by,
           t.rejected_at,
           t.catatan,
           t.total_item,
           ISNULL(s.approved_item, 0) AS approved_item,
           ISNULL(s.rejected_item, 0) AS rejected_item,
           ISNULL(s.pending_item, 0) AS pending_item
         FROM dbo.GWEN_t_harga_jual_request t
         LEFT JOIN detail_summary s
           ON s.kode_t_request = t.kode_t_request
         ${whereClause}
         ORDER BY t.requested_at DESC, t.kode_t_request DESC;`
      );
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch harga jual requests");
      return reply.code(500).send({ message: "Gagal memuat request harga jual" });
    }
  });

  fastify.get("/:kode", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    if (!kode) return reply.code(400).send({ message: "kode wajib diisi" });
    try {
      const headerRes = await pool
        .request()
        .input("kode", sql.VarChar(50), kode)
        .query(
          `SELECT
            kode_t_request,
            tgl_request,
            status_request,
            requested_by,
            requested_at,
            approved_by,
            approved_at,
            rejected_by,
            rejected_at,
            catatan,
            total_item
          FROM dbo.GWEN_t_harga_jual_request
          WHERE kode_t_request = @kode;`
        );
      if (!headerRes.recordset?.length) {
        return reply.code(404).send({ message: "Request tidak ditemukan" });
      }

      const detailRes = await pool
        .request()
        .input("kode", sql.VarChar(50), kode)
        .query(
          `SELECT
            d.kode_d_request,
            d.kode_barang_variant,
            d.id_kelas_harga,
            d.harga_1,
            d.harga_3,
            d.harga_6,
            d.harga_12,
            d.harga_beli_snapshot,
            d.hpp_snapshot,
            d.rasio_1,
            d.rasio_3,
            d.rasio_6,
            d.rasio_12,
            d.status_item
          FROM dbo.GWEN_d_harga_jual_request d
          WHERE d.kode_t_request = @kode
          ORDER BY d.kode_barang_variant ASC, d.id_kelas_harga ASC;`
        );

      return reply.send({
        header: headerRes.recordset[0],
        detail: detailRes.recordset || [],
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch harga jual request detail");
      return reply.code(500).send({ message: "Gagal memuat detail request" });
    }
  });

  fastify.post("/:kode/approve", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    const body = request.body || {};
    const approvedBy = String(body.approved_by || body.updated_by || "Admin").trim() || "Admin";
    const catatan = body.catatan ? String(body.catatan).trim() : null;
    const selectedDetailCodes = Array.isArray(body.selected_detail_codes)
      ? body.selected_detail_codes.map((val) => String(val || "").trim()).filter(Boolean)
      : [];
    if (!kode) return reply.code(400).send({ message: "kode wajib diisi" });

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const headerRes = await new sql.Request(tx)
        .input("kode", sql.VarChar(50), kode)
        .query(
          `SELECT kode_t_request, status_request
           FROM dbo.GWEN_t_harga_jual_request
           WHERE kode_t_request = @kode;`
        );
      if (!headerRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Request tidak ditemukan" });
      }
      const status = Number(headerRes.recordset[0].status_request ?? 0);
      if (status === 1) {
        await tx.rollback();
        return reply.code(400).send({ message: "Request sudah disetujui" });
      }
      if (status === 2) {
        await tx.rollback();
        return reply.code(400).send({ message: "Request sudah ditolak" });
      }

      const allDetailRes = await new sql.Request(tx)
        .input("kode", sql.VarChar(50), kode)
        .query(
          `SELECT
            kode_d_request,
            status_item
          FROM dbo.GWEN_d_harga_jual_request
          WHERE kode_t_request = @kode;`
        );

      const approveReq = new sql.Request(tx).input("kode", sql.VarChar(50), kode);
      let approveFilter = "";
      if (selectedDetailCodes.length) {
        const params = selectedDetailCodes.map((_, idx) => `@kode_d_${idx}`).join(", ");
        selectedDetailCodes.forEach((val, idx) => {
          approveReq.input(`kode_d_${idx}`, sql.VarChar(50), val);
        });
        approveFilter = `AND kode_d_request IN (${params})`;
      }

      const detailRes = await approveReq.query(
        `SELECT
          kode_d_request,
          kode_barang_variant,
          id_kelas_harga,
          harga_1,
          harga_3,
          harga_6,
          harga_12,
          harga_beli_snapshot,
          hpp_snapshot
        FROM dbo.GWEN_d_harga_jual_request
        WHERE kode_t_request = @kode
          AND ISNULL(status_item, 0) <> 1
          ${approveFilter};`
      );

      if (!detailRes.recordset?.length) {
        await tx.rollback();
        return reply.code(400).send({ message: "Tidak ada item yang bisa disetujui." });
      }

      let idx = 1;
      for (const row of detailRes.recordset || []) {
        const hargaBeli = row.harga_beli_snapshot ?? null;
        const hpp = row.hpp_snapshot ?? null;
        const rasio1 = calcRasio(row.harga_1, hargaBeli);
        const rasio3 = calcRasio(row.harga_3, hargaBeli);
        const rasio6 = calcRasio(row.harga_6, hargaBeli);
        const rasio12 = calcRasio(row.harga_12, hargaBeli);

        await new sql.Request(tx)
          .input("rasio_1", sql.Decimal(10, 2), rasio1)
          .input("rasio_3", sql.Decimal(10, 2), rasio3)
          .input("rasio_6", sql.Decimal(10, 2), rasio6)
          .input("rasio_12", sql.Decimal(10, 2), rasio12)
          .input("kode_d_request", sql.VarChar(50), row.kode_d_request)
          .query(
            `UPDATE dbo.GWEN_d_harga_jual_request
             SET rasio_1 = @rasio_1,
                 rasio_3 = @rasio_3,
                 rasio_6 = @rasio_6,
                 rasio_12 = @rasio_12,
                 status_item = 1
             WHERE kode_d_request = @kode_d_request;`
          );

        const activeRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(50), row.kode_barang_variant)
          .input("id_kelas_harga", sql.Int, row.id_kelas_harga)
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
            .input("harga_1", sql.Decimal(20, 2), row.harga_1 ?? null)
            .input("harga_3", sql.Decimal(20, 2), row.harga_3 ?? null)
            .input("harga_6", sql.Decimal(20, 2), row.harga_6 ?? null)
            .input("harga_12", sql.Decimal(20, 2), row.harga_12 ?? null)
            .input("updated_by", sql.VarChar(100), approvedBy)
            .input("updated_at", sql.DateTime2, new Date())
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
          const kodeMn = generateDetailCode("MHJ", idx);
          await new sql.Request(tx)
            .input("kode_mn_harga_jual", sql.VarChar(50), kodeMn)
            .input("kode_barang_variant", sql.VarChar(50), row.kode_barang_variant)
            .input("id_kelas_harga", sql.Int, row.id_kelas_harga)
            .input("harga_1", sql.Decimal(20, 2), row.harga_1 ?? null)
            .input("harga_3", sql.Decimal(20, 2), row.harga_3 ?? null)
            .input("harga_6", sql.Decimal(20, 2), row.harga_6 ?? null)
            .input("harga_12", sql.Decimal(20, 2), row.harga_12 ?? null)
            .input("berlaku_mulai", sql.DateTime2, new Date())
            .input("is_active", sql.Int, 1)
            .input("updated_by", sql.VarChar(100), approvedBy)
            .input("updated_at", sql.DateTime2, new Date())
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

        const kodeHist = generateDetailCode("HHJ", idx++);
        await new sql.Request(tx)
          .input("kode_h_harga_jual", sql.VarChar(50), kodeHist)
          .input("kode_barang_variant", sql.VarChar(50), row.kode_barang_variant)
          .input("id_kelas_harga", sql.Int, row.id_kelas_harga)
          .input("harga_1", sql.Decimal(20, 2), row.harga_1 ?? null)
          .input("harga_3", sql.Decimal(20, 2), row.harga_3 ?? null)
          .input("harga_6", sql.Decimal(20, 2), row.harga_6 ?? null)
          .input("harga_12", sql.Decimal(20, 2), row.harga_12 ?? null)
          .input("harga_beli_snapshot", sql.Decimal(20, 2), hargaBeli)
          .input("hpp_snapshot", sql.Decimal(20, 2), hpp)
          .input("rasio_1", sql.Decimal(10, 2), rasio1)
          .input("rasio_3", sql.Decimal(10, 2), rasio3)
          .input("rasio_6", sql.Decimal(10, 2), rasio6)
          .input("rasio_12", sql.Decimal(10, 2), rasio12)
          .input("kode_t_request", sql.VarChar(50), kode)
          .input("changed_by", sql.VarChar(100), approvedBy)
          .input("changed_at", sql.DateTime2, new Date())
          .input("catatan", sql.VarChar(255), catatan)
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

      const summaryRes = await new sql.Request(tx)
        .input("kode", sql.VarChar(50), kode)
        .query(
          `SELECT
            COUNT(1) AS total_item,
            SUM(CASE WHEN ISNULL(status_item, 0) = 1 THEN 1 ELSE 0 END) AS approved_item
          FROM dbo.GWEN_d_harga_jual_request
          WHERE kode_t_request = @kode;`
        );
      const summaryRow = summaryRes.recordset?.[0] || {};
      const totalItem = Number(summaryRow.total_item || 0);
      const approvedItem = Number(summaryRow.approved_item || 0);

      if (totalItem > 0 && approvedItem === totalItem) {
        await new sql.Request(tx)
          .input("kode", sql.VarChar(50), kode)
          .input("status_request", sql.Int, 1)
          .input("approved_by", sql.VarChar(100), approvedBy)
          .input("approved_at", sql.DateTime2, new Date())
          .input("catatan", sql.VarChar(255), catatan)
          .query(
            `UPDATE dbo.GWEN_t_harga_jual_request
             SET status_request = @status_request,
                 approved_by = @approved_by,
                 approved_at = @approved_at,
                 catatan = ISNULL(@catatan, catatan)
             WHERE kode_t_request = @kode;`
          );
      }

      await tx.commit();
      return reply.send({ message: "Item terpilih disetujui" });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed approve harga jual request");
      return reply.code(500).send({ message: "Gagal menyetujui request" });
    }
  });

  fastify.post("/:kode/reject", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    const body = request.body || {};
    const rejectedBy = String(body.rejected_by || body.updated_by || "Admin").trim() || "Admin";
    const catatan = body.catatan ? String(body.catatan).trim() : null;
    if (!kode) return reply.code(400).send({ message: "kode wajib diisi" });

    try {
      const res = await pool
        .request()
        .input("kode", sql.VarChar(50), kode)
        .input("status_request", sql.Int, 2)
        .input("rejected_by", sql.VarChar(100), rejectedBy)
        .input("rejected_at", sql.DateTime2, new Date())
        .input("catatan", sql.VarChar(255), catatan)
        .query(
          `UPDATE dbo.GWEN_t_harga_jual_request
           SET status_request = @status_request,
               rejected_by = @rejected_by,
               rejected_at = @rejected_at,
               catatan = ISNULL(@catatan, catatan)
           WHERE kode_t_request = @kode;
           UPDATE dbo.GWEN_d_harga_jual_request
           SET status_item = 2
           WHERE kode_t_request = @kode AND ISNULL(status_item, 0) <> 1;`
        );
      if (!res.rowsAffected?.[0]) {
        return reply.code(404).send({ message: "Request tidak ditemukan" });
      }
      return reply.send({ message: "Request ditolak" });
    } catch (err) {
      fastify.log.error({ err }, "Failed reject harga jual request");
      return reply.code(500).send({ message: "Gagal menolak request" });
    }
  });

  fastify.post("/:kode/reject-items", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    const body = request.body || {};
    const rejectedBy = String(body.rejected_by || body.updated_by || "Admin").trim() || "Admin";
    const catatan = body.catatan ? String(body.catatan).trim() : null;
    const selectedDetailCodes = Array.isArray(body.selected_detail_codes)
      ? body.selected_detail_codes.map((val) => String(val || "").trim()).filter(Boolean)
      : [];
    if (!kode) return reply.code(400).send({ message: "kode wajib diisi" });
    if (!selectedDetailCodes.length) {
      return reply.code(400).send({ message: "selected_detail_codes wajib diisi" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const params = selectedDetailCodes.map((_, idx) => `@kode_d_${idx}`).join(", ");
      const req = new sql.Request(tx).input("kode", sql.VarChar(50), kode);
      selectedDetailCodes.forEach((val, idx) => {
        req.input(`kode_d_${idx}`, sql.VarChar(50), val);
      });

      await req.query(
        `UPDATE dbo.GWEN_d_harga_jual_request
         SET status_item = 2
         WHERE kode_t_request = @kode
           AND kode_d_request IN (${params})
           AND ISNULL(status_item, 0) = 0;`
      );

      const summaryRes = await new sql.Request(tx)
        .input("kode", sql.VarChar(50), kode)
        .query(
          `SELECT
            COUNT(1) AS total_item,
            SUM(CASE WHEN ISNULL(status_item, 0) = 1 THEN 1 ELSE 0 END) AS approved_item,
            SUM(CASE WHEN ISNULL(status_item, 0) = 2 THEN 1 ELSE 0 END) AS rejected_item,
            SUM(CASE WHEN ISNULL(status_item, 0) = 0 THEN 1 ELSE 0 END) AS pending_item
          FROM dbo.GWEN_d_harga_jual_request
          WHERE kode_t_request = @kode;`
        );
      const summaryRow = summaryRes.recordset?.[0] || {};
      const totalItem = Number(summaryRow.total_item || 0);
      const approvedItem = Number(summaryRow.approved_item || 0);
      const rejectedItem = Number(summaryRow.rejected_item || 0);
      const pendingItem = Number(summaryRow.pending_item || 0);

      let statusRequest = null;
      if (totalItem === 0) {
        statusRequest = 3;
      } else if (pendingItem === 0 && approvedItem === 0 && rejectedItem > 0) {
        statusRequest = 2;
      } else if (pendingItem === 0 && approvedItem === totalItem) {
        statusRequest = 1;
      }

      if (statusRequest !== null) {
        await new sql.Request(tx)
          .input("kode", sql.VarChar(50), kode)
          .input("status_request", sql.Int, statusRequest)
          .input("rejected_by", sql.VarChar(100), rejectedBy)
          .input("rejected_at", sql.DateTime2, new Date())
          .input("catatan", sql.VarChar(255), catatan)
          .query(
            `UPDATE dbo.GWEN_t_harga_jual_request
             SET status_request = @status_request,
                 rejected_by = @rejected_by,
                 rejected_at = @rejected_at,
                 catatan = ISNULL(@catatan, catatan)
             WHERE kode_t_request = @kode;`
          );
      }

      await tx.commit();
      return reply.send({ message: "Item terpilih ditolak" });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed reject harga jual request items");
      return reply.code(500).send({ message: "Gagal menolak item request" });
    }
  });

  fastify.post("/deactivate", async (request, reply) => {
    const body = request.body || {};
    const kodeList = Array.isArray(body.kode_list)
      ? body.kode_list.map((val) => String(val || "").trim()).filter(Boolean)
      : [];
    if (!kodeList.length) {
      return reply.code(400).send({ message: "kode_list wajib diisi" });
    }

    try {
      const params = kodeList.map((_, idx) => `@kode_${idx}`).join(", ");
      const req = pool.request();
      kodeList.forEach((kode, idx) => {
        req.input(`kode_${idx}`, sql.VarChar(50), kode);
      });
      await req.query(
        `UPDATE dbo.GWEN_t_harga_jual_request
         SET status_request = 3
         WHERE kode_t_request IN (${params});
         UPDATE dbo.GWEN_d_harga_jual_request
         SET status_item = 3
         WHERE kode_t_request IN (${params})
           AND ISNULL(status_item, 0) = 0;`
      );
      return reply.send({ message: "Request berhasil dinonaktifkan", count: kodeList.length });
    } catch (err) {
      fastify.log.error({ err }, "Failed deactivate harga jual request");
      return reply.code(500).send({ message: "Gagal menonaktifkan request" });
    }
  });

  fastify.post("/:kode/remove-items", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    const body = request.body || {};
    const kodeVarianList = Array.isArray(body.kode_barang_variant_list)
      ? body.kode_barang_variant_list.map((val) => String(val || "").trim()).filter(Boolean)
      : [];
    if (!kode) return reply.code(400).send({ message: "kode wajib diisi" });
    if (!kodeVarianList.length) {
      return reply.code(400).send({ message: "kode_barang_variant_list wajib diisi" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const params = kodeVarianList.map((_, idx) => `@kode_var_${idx}`).join(", ");
      const req = new sql.Request(tx).input("kode", sql.VarChar(50), kode);
      kodeVarianList.forEach((val, idx) => {
        req.input(`kode_var_${idx}`, sql.VarChar(50), val);
      });

      await req.query(
        `DELETE FROM dbo.GWEN_d_harga_jual_request
         WHERE kode_t_request = @kode
           AND kode_barang_variant IN (${params});`
      );

      const countRes = await new sql.Request(tx)
        .input("kode", sql.VarChar(50), kode)
        .query(
          `SELECT COUNT(1) AS total_item
           FROM dbo.GWEN_d_harga_jual_request
           WHERE kode_t_request = @kode;`
        );
      const totalItem = Number(countRes.recordset?.[0]?.total_item ?? 0);

      await new sql.Request(tx)
        .input("kode", sql.VarChar(50), kode)
        .input("total_item", sql.Int, totalItem)
        .input("status_request", sql.Int, totalItem === 0 ? 3 : null)
        .query(
          `UPDATE dbo.GWEN_t_harga_jual_request
           SET total_item = @total_item,
               status_request = ISNULL(@status_request, status_request)
           WHERE kode_t_request = @kode;`
        );

      await tx.commit();
      return reply.send({ message: "Item berhasil dikeluarkan", total_item: totalItem });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed remove request items");
      return reply.code(500).send({ message: "Gagal menghapus item request" });
    }
  });
}
