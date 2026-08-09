import {
  formatWibSqlDateTime,
  logWibConversion,
  wibDateOnly,
  wibStamp,
} from "../utils/wib-time.js";

export default async function penerimaanPemindahanRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const generateStockCode = (prefix) => `${prefix}.${wibStamp()}`;

  const generateDocCode = async (tx, prefix, userCode) => {
    try {
      const todayIso = wibDateOnly();
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
      return generateStockCode(prefix);
    }
  };

  const generateDetailCode = (prefix, index) => {
    const idx = String(index).padStart(3, "0");
    return `${prefix}.${wibStamp()}${idx}`;
  };

  fastify.get("/", async (_req, reply) => {
    try {
      const result = await pool.request().query(`
        WITH kirim AS (
          SELECT kode_t_pemindahan,
                 SUM(ISNULL(jml_baik_pindah, 0) + ISNULL(jml_rusak_pindah, 0)) AS total_kirim
          FROM dbo.GWEN_d_pemindahan
          GROUP BY kode_t_pemindahan
        ),
        terima AS (
          SELECT t.kode_t_pemindahan,
                 SUM(ISNULL(d.jml_baik_terima, 0) + ISNULL(d.jml_rusak_terima, 0)) AS total_terima
          FROM dbo.GWEN_t_penerimaan_pemindahan t
          JOIN dbo.GWEN_d_penerimaan_pemindahan d ON d.kode_t_penerimaan = t.kode_t_penerimaan
          GROUP BY t.kode_t_pemindahan
        )
        SELECT
          t.kode_t_pemindahan,
          last_pr.kode_t_penerimaan,
          t.tipe_lokasi_dari,
          t.kode_lokasi_dari,
          t.tipe_lokasi_tujuan,
          t.kode_lokasi_tujuan,
          t.tgl,
          t.created_by,
          ISNULL(k.total_kirim, 0) AS total_kirim,
          ISNULL(tr.total_terima, 0) AS total_terima,
          CASE
            WHEN ISNULL(k.total_kirim, 0) = 0 THEN 0
            ELSE CAST(ROUND((ISNULL(tr.total_terima, 0) * 100.0) / NULLIF(k.total_kirim, 0), 0) AS INT)
          END AS persen_terima
        FROM dbo.GWEN_t_pemindahan t
        OUTER APPLY (
          SELECT TOP 1 kode_t_penerimaan
          FROM dbo.GWEN_t_penerimaan_pemindahan p
          WHERE p.kode_t_pemindahan = t.kode_t_pemindahan
          ORDER BY p.created_at DESC, p.kode_t_penerimaan DESC
        ) last_pr
        LEFT JOIN kirim k ON k.kode_t_pemindahan = t.kode_t_pemindahan
        LEFT JOIN terima tr ON tr.kode_t_pemindahan = t.kode_t_pemindahan
        ORDER BY t.created_at DESC, t.kode_t_pemindahan DESC;
      `);
      return reply.send(result.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch penerimaan pemindahan list");
      return reply.code(500).send({ message: "Gagal memuat penerimaan pemindahan" });
    }
  });

  fastify.get("/:kode", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    if (!kode) {
      return reply.code(400).send({ message: "kode pemindahan wajib diisi" });
    }
    try {
      const headerRes = await pool
        .request()
        .input("kode", sql.VarChar(50), kode)
        .query(
          `SELECT
            kode_t_pemindahan,
            tipe_lokasi_dari,
            kode_lokasi_dari,
            tipe_lokasi_tujuan,
            kode_lokasi_tujuan,
            catatan,
            tgl,
            created_by
          FROM dbo.GWEN_t_pemindahan
          WHERE kode_t_pemindahan = @kode;`
        );
      if (!headerRes.recordset?.length) {
        return reply.code(404).send({ message: "Pemindahan tidak ditemukan" });
      }

      const detailRes = await pool
        .request()
        .input("kode", sql.VarChar(50), kode)
        .query(
          `WITH terima AS (
            SELECT
              kode_d_pemindahan,
              SUM(ISNULL(jml_baik_terima, 0)) AS total_terima,
              SUM(ISNULL(jml_rusak_terima, 0)) AS total_rusak_terima
            FROM dbo.GWEN_d_penerimaan_pemindahan
            GROUP BY kode_d_pemindahan
          )
          SELECT
            d.kode_d_pemindahan,
            d.kode_barang,
            d.kode_barang_variant,
            d.jml_baik_pindah,
            d.jml_rusak_pindah,
            d.satuan_jml_baik,
            ISNULL(t.total_terima, 0) AS qty_diterima,
            ISNULL(t.total_rusak_terima, 0) AS qty_rusak_diterima,
            b.nama AS nama_barang,
            v.nama_varian
          FROM dbo.GWEN_d_pemindahan d
          LEFT JOIN terima t ON t.kode_d_pemindahan = d.kode_d_pemindahan
          LEFT JOIN dbo.m_barang_varian v ON v.kode_barang_variant = d.kode_barang_variant
          LEFT JOIN dbo.m_barang b ON b.id_barang = v.id_barang
          WHERE d.kode_t_pemindahan = @kode
          ORDER BY b.nama ASC, v.nama_varian ASC;`
        );

      return reply.send({
        header: headerRes.recordset[0],
        detail: detailRes.recordset || [],
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch penerimaan pemindahan detail");
      return reply.code(500).send({ message: "Gagal memuat penerimaan pemindahan" });
    }
  });

  fastify.get("/:kode/print", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    if (!kode) {
      return reply.code(400).send({ message: "kode wajib diisi" });
    }
    try {
      const byPenerimaan = kode.startsWith("TPR.");
      let headerRes;
      try {
        headerRes = await pool
          .request()
          .input("kode", sql.VarChar(50), kode)
          .query(
            `SELECT TOP 1
              t.kode_t_penerimaan,
              t.kode_t_pemindahan,
              t.tgl_terima,
              t.diterima_by,
              t.catatan,
              p.tipe_lokasi_dari,
              p.kode_lokasi_dari,
              p.tipe_lokasi_tujuan,
              p.kode_lokasi_tujuan,
              COALESCE(gd.nama, td.nama_toko) AS nama_lokasi_dari,
              COALESCE(gt.nama, tt.nama_toko) AS nama_lokasi_tujuan
            FROM dbo.GWEN_t_penerimaan_pemindahan t
            JOIN dbo.GWEN_t_pemindahan p ON p.kode_t_pemindahan = t.kode_t_pemindahan
            LEFT JOIN dbo.m_gudang gd
              ON p.tipe_lokasi_dari = 'GUDANG'
             AND gd.kode_gudang = p.kode_lokasi_dari
            LEFT JOIN dbo.m_toko td
              ON p.tipe_lokasi_dari = 'TOKO'
             AND td.kode_toko = p.kode_lokasi_dari
            LEFT JOIN dbo.m_gudang gt
              ON p.tipe_lokasi_tujuan = 'GUDANG'
             AND gt.kode_gudang = p.kode_lokasi_tujuan
            LEFT JOIN dbo.m_toko tt
              ON p.tipe_lokasi_tujuan = 'TOKO'
             AND tt.kode_toko = p.kode_lokasi_tujuan
            WHERE ${byPenerimaan ? "t.kode_t_penerimaan" : "t.kode_t_pemindahan"} = @kode
            ORDER BY t.tgl_terima DESC, t.kode_t_penerimaan DESC;`
          );
      } catch (err) {
        fastify.log.warn({ err }, "Fallback header penerimaan tanpa nama lokasi");
        headerRes = await pool
          .request()
          .input("kode", sql.VarChar(50), kode)
          .query(
            `SELECT TOP 1
              t.kode_t_penerimaan,
              t.kode_t_pemindahan,
              t.tgl_terima,
              t.diterima_by,
              t.catatan,
              p.tipe_lokasi_dari,
              p.kode_lokasi_dari,
              p.tipe_lokasi_tujuan,
              p.kode_lokasi_tujuan
            FROM dbo.GWEN_t_penerimaan_pemindahan t
            JOIN dbo.GWEN_t_pemindahan p ON p.kode_t_pemindahan = t.kode_t_pemindahan
            WHERE ${byPenerimaan ? "t.kode_t_penerimaan" : "t.kode_t_pemindahan"} = @kode
            ORDER BY t.tgl_terima DESC, t.kode_t_penerimaan DESC;`
          );
      }

      if (!headerRes.recordset?.length) {
        return reply.code(404).send({ message: "Penerimaan tidak ditemukan" });
      }

      const detailRes = await pool
        .request()
        .input("kode", sql.VarChar(50), kode)
        .query(
          `SELECT
            d.kode_d_pemindahan,
            d.kode_barang_variant,
            SUM(ISNULL(d.jml_baik_terima, 0)) AS qty_terima,
            SUM(ISNULL(d.jml_rusak_terima, 0)) AS qty_rusak_terima,
            MAX(d.satuan_jml_baik) AS satuan_jml_baik,
            b.nama AS nama_barang,
            v.nama_varian
          FROM dbo.GWEN_d_penerimaan_pemindahan d
          JOIN dbo.GWEN_t_penerimaan_pemindahan t ON t.kode_t_penerimaan = d.kode_t_penerimaan
          LEFT JOIN dbo.m_barang_varian v ON v.kode_barang_variant = d.kode_barang_variant
          LEFT JOIN dbo.m_barang b ON b.id_barang = v.id_barang
          WHERE ${byPenerimaan ? "t.kode_t_penerimaan" : "t.kode_t_pemindahan"} = @kode
          GROUP BY d.kode_d_pemindahan, d.kode_barang_variant, b.nama, v.nama_varian
          ORDER BY b.nama ASC, v.nama_varian ASC;`
        );

      return reply.send({
        header: headerRes.recordset[0],
        detail: detailRes.recordset || [],
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch penerimaan pemindahan print");
      return reply.code(500).send({ message: "Gagal memuat print penerimaan" });
    }
  });

  fastify.post("/:kode", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    const body = request.body || {};
    const diterimaBy = String(body.diterima_by || body.created_by || "Admin").trim() || "Admin";
    const catatan = body.catatan ? String(body.catatan).trim() : null;
    const items = Array.isArray(body.items) ? body.items : [];
    if (!kode) {
      return reply.code(400).send({ message: "kode pemindahan wajib diisi" });
    }
    if (!items.length) {
      return reply.code(400).send({ message: "items wajib diisi" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const headerRes = await new sql.Request(tx)
        .input("kode", sql.VarChar(50), kode)
        .query(
          `SELECT
            kode_t_pemindahan,
            tipe_lokasi_tujuan,
            kode_lokasi_tujuan
          FROM dbo.GWEN_t_pemindahan
          WHERE kode_t_pemindahan = @kode;`
        );
      if (!headerRes.recordset?.length) {
        await tx.rollback();
        return reply.code(404).send({ message: "Pemindahan tidak ditemukan" });
      }
      const header = headerRes.recordset[0];
      const tujuanTipe = String(header.tipe_lokasi_tujuan || "").trim();
      const tujuanKode = String(header.kode_lokasi_tujuan || "").trim();

      const kodeTPenerimaan = await generateDocCode(tx, "TPR", diterimaBy);
      if (!kodeTPenerimaan) {
        throw new Error("Gagal generate kode penerimaan");
      }
      const nowRes = await new sql.Request(tx).query(
        "SELECT SYSDATETIME() AS now_local, SYSUTCDATETIME() AS now_utc;"
      );
      const receivedAt = nowRes.recordset?.[0]?.now_local || new Date();
      logWibConversion(fastify.log, {
        route: "penerimaan-pemindahan.create",
        field: "db_now_local",
        source: "SYSDATETIME()",
        converted_wib: formatWibSqlDateTime(receivedAt),
        sql_value: formatWibSqlDateTime(receivedAt),
      });

      await new sql.Request(tx)
        .input("kode_t_penerimaan", sql.VarChar(50), kodeTPenerimaan)
        .input("kode_t_pemindahan", sql.VarChar(50), kode)
        .input("tgl_terima", sql.DateTime2, receivedAt)
        .input("diterima_by", sql.VarChar(255), diterimaBy)
        .input("catatan", sql.VarChar(255), catatan)
        .input("status", sql.Int, 1)
        .input("created_by", sql.VarChar(255), diterimaBy)
        .input("created_at", sql.DateTime2, receivedAt)
        .input("updated_by", sql.VarChar(255), diterimaBy)
        .input("updated_at", sql.DateTime2, receivedAt)
        .query(
          `INSERT INTO dbo.GWEN_t_penerimaan_pemindahan (
            kode_t_penerimaan,
            kode_t_pemindahan,
            tgl_terima,
            diterima_by,
            catatan,
            status,
            created_by,
            created_at,
            updated_by,
            updated_at
          ) VALUES (
            @kode_t_penerimaan,
            @kode_t_pemindahan,
            @tgl_terima,
            @diterima_by,
            @catatan,
            @status,
            @created_by,
            @created_at,
            @updated_by,
            @updated_at
          );`
        );

      let detailIndex = 1;
      for (const item of items) {
        const kodeDetail = String(item.kode_d_pemindahan || "").trim();
        const qtyTerimaBaik = Number(item.qty_terima || 0);
        const qtyTerimaRusak = Number(item.qty_rusak_terima || 0);
        if (!kodeDetail || (qtyTerimaBaik <= 0 && qtyTerimaRusak <= 0)) continue;

        const remainRes = await new sql.Request(tx)
          .input("kode_d_pemindahan", sql.VarChar(50), kodeDetail)
          .query(
            `WITH terima AS (
              SELECT
                kode_d_pemindahan,
                SUM(ISNULL(jml_baik_terima, 0)) AS total_terima,
                SUM(ISNULL(jml_rusak_terima, 0)) AS total_rusak_terima
              FROM dbo.GWEN_d_penerimaan_pemindahan
              WHERE kode_d_pemindahan = @kode_d_pemindahan
              GROUP BY kode_d_pemindahan
            )
            SELECT
              d.kode_barang_variant,
              d.kode_barang,
              d.jml_baik_pindah,
              d.jml_rusak_pindah,
              d.satuan_jml_baik,
              ISNULL(t.total_terima, 0) AS total_terima,
              ISNULL(t.total_rusak_terima, 0) AS total_rusak_terima
            FROM dbo.GWEN_d_pemindahan d
            LEFT JOIN terima t ON t.kode_d_pemindahan = d.kode_d_pemindahan
            WHERE d.kode_d_pemindahan = @kode_d_pemindahan;`
          );
        if (!remainRes.recordset?.length) {
          throw new Error("Detail pemindahan tidak ditemukan");
        }
        const detail = remainRes.recordset[0];
        const qtyKirimBaik = Number(detail.jml_baik_pindah ?? 0);
        const qtyKirimRusak = Number(detail.jml_rusak_pindah ?? 0);
        const qtySudahBaik = Number(detail.total_terima ?? 0);
        const qtySudahRusak = Number(detail.total_rusak_terima ?? 0);
        const sisaBaik = qtyKirimBaik - qtySudahBaik;
        const sisaRusak = qtyKirimRusak - qtySudahRusak;
        if (qtyTerimaBaik > sisaBaik) {
          throw new Error("Qty terima (baik) melebihi sisa pemindahan");
        }
        if (qtyTerimaRusak > sisaRusak) {
          throw new Error("Qty terima (rusak) melebihi sisa pemindahan");
        }

        const kodeDPenerimaan = generateDetailCode("DPR", detailIndex++);
        await new sql.Request(tx)
          .input("kode_d_penerimaan", sql.VarChar(50), kodeDPenerimaan)
          .input("kode_t_penerimaan", sql.VarChar(50), kodeTPenerimaan)
          .input("kode_d_pemindahan", sql.VarChar(50), kodeDetail)
          .input("kode_barang", sql.VarChar(50), detail.kode_barang || null)
          .input("kode_barang_variant", sql.VarChar(50), detail.kode_barang_variant || null)
          .input("jml_baik_terima", sql.Decimal(20, 2), qtyTerimaBaik)
          .input("satuan_jml_baik", sql.VarChar(50), detail.satuan_jml_baik || "PCS")
          .input("jml_rusak_terima", sql.Decimal(20, 2), qtyTerimaRusak)
          .input("satuan_jml_rusak", sql.VarChar(50), detail.satuan_jml_baik || "PCS")
          .input("catatan", sql.VarChar(255), null)
          .input("created_by", sql.VarChar(255), diterimaBy)
          .input("created_at", sql.DateTime2, receivedAt)
          .input("updated_by", sql.VarChar(255), diterimaBy)
          .input("updated_at", sql.DateTime2, receivedAt)
          .query(
            `INSERT INTO dbo.GWEN_d_penerimaan_pemindahan (
              kode_d_penerimaan,
              kode_t_penerimaan,
              kode_d_pemindahan,
              kode_barang,
              kode_barang_variant,
              jml_baik_terima,
              satuan_jml_baik,
              jml_rusak_terima,
              satuan_jml_rusak,
              catatan,
              created_by,
              created_at,
              updated_by,
              updated_at
            ) VALUES (
              @kode_d_penerimaan,
              @kode_t_penerimaan,
              @kode_d_pemindahan,
              @kode_barang,
              @kode_barang_variant,
              @jml_baik_terima,
              @satuan_jml_baik,
              @jml_rusak_terima,
              @satuan_jml_rusak,
              @catatan,
              @created_by,
              @created_at,
              @updated_by,
              @updated_at
            );`
          );

        if (tujuanTipe === "GUDANG") {
          const stokRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(50), detail.kode_barang_variant || null)
            .input("kode_gudang", sql.VarChar(50), tujuanKode)
            .query(
              `SELECT TOP 1 stok, qty_baik, qty_rusak
               FROM dbo.GWEN_mn_barang_gudang_variant
               WHERE kode_barang_variant = @kode_barang_variant
                 AND kode_gudang = @kode_gudang;`
            );
          const stokAwalTotal = Number(stokRes.recordset?.[0]?.stok ?? 0);
          const stokAwalBaik = Number(stokRes.recordset?.[0]?.qty_baik ?? stokAwalTotal);
          const stokAwalRusak = Number(stokRes.recordset?.[0]?.qty_rusak ?? 0);
          const stokAkhirBaik = stokAwalBaik + qtyTerimaBaik;
          const stokAkhirRusak = stokAwalRusak + qtyTerimaRusak;
          const stokAkhirTotal = stokAkhirBaik + stokAkhirRusak;

          if (stokRes.recordset?.length) {
            await new sql.Request(tx)
              .input("stok", sql.Decimal(20, 2), stokAkhirTotal)
              .input("qty_baik", sql.Decimal(20, 2), stokAkhirBaik)
              .input("qty_rusak", sql.Decimal(20, 2), stokAkhirRusak)
              .input("updated_by", sql.VarChar(255), diterimaBy)
              .input("updated_at", sql.DateTime2, receivedAt)
              .input("kode_barang_variant", sql.VarChar(50), detail.kode_barang_variant || null)
              .input("kode_gudang", sql.VarChar(50), tujuanKode)
              .query(
                `UPDATE dbo.GWEN_mn_barang_gudang_variant
                 SET stok = @stok,
                     qty_baik = @qty_baik,
                     qty_rusak = @qty_rusak,
                     updated_by = @updated_by,
                     updated_at = @updated_at
                 WHERE kode_barang_variant = @kode_barang_variant
                   AND kode_gudang = @kode_gudang;`
              );
          } else {
            const kodeMn = generateStockCode("STK");
            await new sql.Request(tx)
              .input("kode_mn_barang_gudang", sql.VarChar(255), kodeMn)
              .input("kode_barang_variant", sql.VarChar(50), detail.kode_barang_variant || null)
              .input("kode_gudang", sql.VarChar(50), tujuanKode)
              .input("minimum_stok", sql.Decimal(20, 2), 0)
              .input("status", sql.Int, 1)
              .input("status_cadangan", sql.Int, null)
              .input("created_by", sql.VarChar(255), diterimaBy)
              .input("created_at", sql.DateTime2, receivedAt)
              .input("updated_by", sql.VarChar(255), diterimaBy)
              .input("updated_at", sql.DateTime2, receivedAt)
              .input("stok", sql.Decimal(20, 2), stokAkhirTotal)
              .input("qty_baik", sql.Decimal(20, 2), stokAkhirBaik)
              .input("qty_rusak", sql.Decimal(20, 2), stokAkhirRusak)
              .input("is_sync", sql.Int, 0)
              .input("is_show", sql.Int, 1)
              .query(
                `INSERT INTO dbo.GWEN_mn_barang_gudang_variant (
                  kode_mn_barang_gudang, kode_barang_variant, kode_gudang, minimum_stok, status, status_cadangan,
                  created_by, created_at, updated_by, updated_at, stok, qty_baik, qty_rusak, is_sync, is_show
                ) VALUES (
                  @kode_mn_barang_gudang, @kode_barang_variant, @kode_gudang, @minimum_stok, @status, @status_cadangan,
                  @created_by, @created_at, @updated_by, @updated_at, @stok, @qty_baik, @qty_rusak, @is_sync, @is_show
                );`
              );
          }
        } else if (tujuanTipe === "TOKO") {
          const stokRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(50), detail.kode_barang_variant || null)
            .input("kode_toko", sql.VarChar(50), tujuanKode)
            .query(
              `SELECT TOP 1 stok_available, qty_baik, qty_rusak
               FROM dbo.GWEN_mn_barang_toko_variant
               WHERE kode_barang_variant = @kode_barang_variant
                 AND kode_toko = @kode_toko;`
            );
          const stokAwalBaik = Number(stokRes.recordset?.[0]?.qty_baik ?? stokRes.recordset?.[0]?.stok_available ?? 0);
          const stokAwalRusak = Number(stokRes.recordset?.[0]?.qty_rusak ?? 0);
          const stokAkhirBaik = stokAwalBaik + qtyTerimaBaik;
          const stokAkhirRusak = stokAwalRusak + qtyTerimaRusak;
          if (stokRes.recordset?.length) {
            await new sql.Request(tx)
              .input("stok_available", sql.Decimal(20, 2), stokAkhirBaik)
              .input("qty_baik", sql.Decimal(20, 2), stokAkhirBaik)
              .input("qty_rusak", sql.Decimal(20, 2), stokAkhirRusak)
              .input("updated_at", sql.DateTime2, receivedAt)
              .input("kode_barang_variant", sql.VarChar(50), detail.kode_barang_variant || null)
              .input("kode_toko", sql.VarChar(50), tujuanKode)
              .query(
                `UPDATE dbo.GWEN_mn_barang_toko_variant
                 SET stok_available = @stok_available,
                     qty_baik = @qty_baik,
                     qty_rusak = @qty_rusak,
                     updated_at = @updated_at
                 WHERE kode_barang_variant = @kode_barang_variant
                   AND kode_toko = @kode_toko;`
              );
          } else {
            await new sql.Request(tx)
              .input("kode_barang_variant", sql.VarChar(50), detail.kode_barang_variant || null)
              .input("kode_toko", sql.VarChar(50), tujuanKode)
              .input("stok_available", sql.Decimal(20, 2), stokAkhirBaik)
              .input("qty_baik", sql.Decimal(20, 2), stokAkhirBaik)
              .input("qty_rusak", sql.Decimal(20, 2), stokAkhirRusak)
              .input("buffer_min", sql.Decimal(20, 2), 0)
              .input("status", sql.Int, 1)
              .input("updated_at", sql.DateTime2, receivedAt)
              .query(
                `INSERT INTO dbo.GWEN_mn_barang_toko_variant (
                  kode_barang_variant, kode_toko, stok_available, qty_baik, qty_rusak, buffer_min, status, updated_at
                ) VALUES (
                  @kode_barang_variant, @kode_toko, @stok_available, @qty_baik, @qty_rusak, @buffer_min, @status, @updated_at
                );`
              );
          }
        } else if (tujuanTipe === "ETALASE") {
          const stokRes = await new sql.Request(tx)
            .input("kode_barang_variant", sql.VarChar(50), detail.kode_barang_variant || null)
            .input("kode_etalase", sql.VarChar(50), tujuanKode)
            .query(
              `SELECT TOP 1 stok
               FROM dbo.GWEN_mn_barang_etalase_variant
               WHERE kode_barang_variant = @kode_barang_variant
                 AND kode_etalase = @kode_etalase;`
            );
          const stokAwal = Number(stokRes.recordset?.[0]?.stok ?? 0);
          const stokAkhir = stokAwal + qtyTerimaBaik + qtyTerimaRusak;
          if (stokRes.recordset?.length) {
            await new sql.Request(tx)
              .input("stok", sql.Decimal(20, 2), stokAkhir)
              .input("updated_by", sql.VarChar(255), diterimaBy)
              .input("updated_at", sql.DateTime2, receivedAt)
              .input("kode_barang_variant", sql.VarChar(50), detail.kode_barang_variant || null)
              .input("kode_etalase", sql.VarChar(50), tujuanKode)
              .query(
                `UPDATE dbo.GWEN_mn_barang_etalase_variant
                 SET stok = @stok,
                     updated_by = @updated_by,
                     updated_at = @updated_at
                 WHERE kode_barang_variant = @kode_barang_variant
                   AND kode_etalase = @kode_etalase;`
              );
          } else {
            const kodeMn = generateStockCode("ETL");
            await new sql.Request(tx)
              .input("kode_mn_barang_etalase", sql.VarChar(255), kodeMn)
              .input("kode_barang_variant", sql.VarChar(50), detail.kode_barang_variant || null)
              .input("kode_etalase", sql.VarChar(50), tujuanKode)
              .input("minimum_stok", sql.Decimal(20, 2), 0)
              .input("status", sql.Int, 1)
              .input("status_cadangan", sql.Int, null)
              .input("created_by", sql.VarChar(255), diterimaBy)
              .input("created_at", sql.DateTime2, receivedAt)
              .input("updated_by", sql.VarChar(255), diterimaBy)
              .input("updated_at", sql.DateTime2, receivedAt)
              .input("stok", sql.Decimal(20, 2), stokAkhir)
              .input("is_sync", sql.Int, 0)
              .input("is_show", sql.Int, 1)
              .query(
                `INSERT INTO dbo.GWEN_mn_barang_etalase_variant (
                  kode_mn_barang_etalase, kode_barang_variant, kode_etalase, minimum_stok, status, status_cadangan,
                  created_by, created_at, updated_by, updated_at, stok, is_sync, is_show
                ) VALUES (
                  @kode_mn_barang_etalase, @kode_barang_variant, @kode_etalase, @minimum_stok, @status, @status_cadangan,
                  @created_by, @created_at, @updated_by, @updated_at, @stok, @is_sync, @is_show
                );`
              );
          }
        }

        const qtyTotalTerima = qtyTerimaBaik + qtyTerimaRusak;
        const kodeHist = generateStockCode("HST");
        const histRes = await new sql.Request(tx)
          .input("kode_barang_variant", sql.VarChar(255), detail.kode_barang_variant || null)
          .input("kode_gudang", sql.VarChar(255), tujuanKode)
          .query(
            `SELECT TOP 1 stok_akhir_satuan_1
             FROM dbo.GWEN_h_stok_barang_variant
             WHERE kode_barang_variant = @kode_barang_variant
               AND kode_gudang = @kode_gudang
             ORDER BY tgl_transaksi DESC, id DESC;`
          );
        const stokAwalSatuan1 = Number(histRes.recordset?.[0]?.stok_akhir_satuan_1 ?? 0);
        const stokAkhirSatuan1 = stokAwalSatuan1 + qtyTotalTerima;
        await new sql.Request(tx)
          .input("kode_h_stok_barang", sql.VarChar(255), kodeHist)
          .input("kode_ref_transaksi", sql.VarChar(255), kodeTPenerimaan)
          .input("tgl_transaksi", sql.DateTime, receivedAt)
          .input("ket_transaksi", sql.VarChar(sql.MAX), "TERIMA PEMINDAHAN")
          .input("kode_barang_variant", sql.VarChar(255), detail.kode_barang_variant || null)
          .input("qty_masuk", sql.Decimal(20, 2), qtyTotalTerima)
          .input("status", sql.VarChar(255), "MASUK")
          .input("status_cadangan", sql.VarChar(255), null)
          .input("created_by", sql.VarChar(255), diterimaBy)
          .input("created_at", sql.DateTime, receivedAt)
          .input("updated_by", sql.VarChar(255), diterimaBy)
          .input("updated_at", sql.DateTime, receivedAt)
          .input("kode_gudang", sql.VarChar(255), tujuanKode)
          .input("satuan", sql.VarChar(255), detail.satuan_jml_baik || "PCS")
          .input("qty_ke_satuan_1", sql.Decimal(20, 2), qtyTotalTerima)
          .input("stok_awal_satuan_1", sql.Decimal(20, 2), stokAwalSatuan1)
          .input("stok_akhir_satuan_1", sql.Decimal(20, 2), stokAkhirSatuan1)
          .input("qty_keluar", sql.Decimal(20, 2), 0)
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

      const progressRes = await new sql.Request(tx)
        .input("kode", sql.VarChar(50), kode)
        .query(
          `WITH kirim AS (
            SELECT SUM(ISNULL(jml_baik_pindah, 0) + ISNULL(jml_rusak_pindah, 0)) AS total_kirim
            FROM dbo.GWEN_d_pemindahan
            WHERE kode_t_pemindahan = @kode
          ),
          terima AS (
            SELECT SUM(ISNULL(d.jml_baik_terima, 0) + ISNULL(d.jml_rusak_terima, 0)) AS total_terima
            FROM dbo.GWEN_t_penerimaan_pemindahan t
            JOIN dbo.GWEN_d_penerimaan_pemindahan d ON d.kode_t_penerimaan = t.kode_t_penerimaan
            WHERE t.kode_t_pemindahan = @kode
          )
          SELECT ISNULL(k.total_kirim, 0) AS total_kirim, ISNULL(tr.total_terima, 0) AS total_terima
          FROM kirim k CROSS JOIN terima tr;`
        );
      const totalKirim = Number(progressRes.recordset?.[0]?.total_kirim ?? 0);
      const totalTerima = Number(progressRes.recordset?.[0]?.total_terima ?? 0);
      if (totalKirim > 0 && totalTerima >= totalKirim) {
        await new sql.Request(tx)
          .input("kode", sql.VarChar(50), kode)
          .input("status_pemindahan", sql.Int, 2)
          .input("updated_by", sql.VarChar(255), diterimaBy)
          .input("updated_at", sql.DateTime2, receivedAt)
          .query(
            `UPDATE dbo.GWEN_t_pemindahan
             SET status_pemindahan = @status_pemindahan,
                 updated_by = @updated_by,
                 updated_at = @updated_at
             WHERE kode_t_pemindahan = @kode;`
          );
      }

      await tx.commit();
      return reply.code(201).send({ kode_t_penerimaan: kodeTPenerimaan });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed to receive pemindahan");
      return reply.code(500).send({ message: "Gagal menerima pemindahan" });
    }
  });
}

