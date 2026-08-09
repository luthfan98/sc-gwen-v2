export default async function tagihanRoutes(fastify) {
  const { sql, pool } = fastify.mssql;

  const generateDocCode = async ({ prefix, tx, userCode = "88", branchCode = "GW", padLength = 5, separator = "." }) => {
    const req = tx ? new sql.Request(tx) : pool.request();
    const res = await req
      .input("prefix", sql.VarChar(10), prefix)
      .query(
        `
        SELECT TOP 1 kode_t_tagihan AS kode
        FROM dbo.GWEN_t_tagihan
        WHERE kode_t_tagihan LIKE @prefix + '%' 
        ORDER BY created_at DESC, kode_t_tagihan DESC;
      `
      );
    const last = res.recordset?.[0]?.kode || "";
    let next = 1;
    if (last) {
      const parts = String(last).split(separator);
      const tail = parts[parts.length - 1];
      const asNum = Number(tail);
      if (!Number.isNaN(asNum)) next = asNum + 1;
    }
    return `${prefix}${separator}${userCode}${branchCode}${String(next).padStart(padLength, "0")}`;
  };

  const generateDetailCode = async ({ prefix, tx, padLength = 6, separator = "." }) => {
    const req = tx ? new sql.Request(tx) : pool.request();
    const res = await req
      .input("prefix", sql.VarChar(10), prefix)
      .query(
        `
        SELECT TOP 1 kode_d_tagihan AS kode
        FROM dbo.GWEN_d_tagihan
        WHERE kode_d_tagihan LIKE @prefix + '%'
        ORDER BY created_at DESC, kode_d_tagihan DESC;
      `
      );
    const last = res.recordset?.[0]?.kode || "";
    let next = 1;
    if (last) {
      const parts = String(last).split(separator);
      const tail = parts[parts.length - 1];
      const asNum = Number(tail);
      if (!Number.isNaN(asNum)) next = asNum + 1;
    }
    return `${prefix}${separator}${String(next).padStart(padLength, "0")}`;
  };

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const kode_t_pengadaan = String(body.kode_t_pengadaan || "").trim();
    const kode_supplier = String(body.kode_supplier || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];
    const created_by = String(body.created_by || "Admin").trim() || "Admin";
    const now = new Date();

    if (!kode_t_pengadaan || !kode_supplier || items.length === 0) {
      return reply.code(400).send({ message: "kode_t_pengadaan, kode_supplier, dan items wajib diisi" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();
      const pengadaanRes = await new sql.Request(tx)
        .input("kode_t_pengadaan", sql.VarChar(255), kode_t_pengadaan)
        .query(
          `
          SELECT TOP 1 kode_t_pengadaan
          FROM dbo.GWEN_t_pengadaan
          WHERE kode_t_pengadaan = @kode_t_pengadaan
            AND ISNULL(status, 1) = 1;
        `
        );
      if (!pengadaanRes.recordset?.length) {
        await tx.rollback();
        return reply.code(400).send({ message: "PO tidak ditemukan atau sudah nonaktif" });
      }

      const kode_t_tagihan = await generateDocCode({ prefix: "TGH", tx });

      const subtotal = Number(body.subtotal ?? 0);
      const diskon = Number(body.diskon ?? 0);
      const total_stlh_diskon = Number(body.total_stlh_diskon ?? subtotal - diskon);
      const total_sblm_ppn = Number(body.total_sblm_ppn ?? total_stlh_diskon);
      const ppn = Number(body.ppn ?? 0);
      const total_tagihan = Number(body.total_tagihan ?? total_sblm_ppn + ppn);

      await new sql.Request(tx)
        .input("kode_t_tagihan", sql.VarChar(255), kode_t_tagihan)
        .input("kode_t_pengadaan", sql.VarChar(255), kode_t_pengadaan)
        .input("kode_t_rpo", sql.VarChar(255), body.kode_t_rpo || null)
        .input("kode_lpb", sql.VarChar(255), body.kode_lpb || null)
        .input("kode_supplier", sql.VarChar(255), kode_supplier || null)
        .input("nama_supplier", sql.VarChar(255), body.nama_supplier || null)
        .input("no_invoice", sql.VarChar(255), body.no_invoice || null)
        .input("no_faktur_supplier", sql.VarChar(255), body.no_faktur_supplier || null)
        .input("tgl", sql.DateTime, body.tgl ? new Date(body.tgl) : now)
        .input("tgl_jatuh_tempo", sql.DateTime, body.tgl_jatuh_tempo ? new Date(body.tgl_jatuh_tempo) : null)
        .input("subtotal", sql.Decimal(20, 2), subtotal)
        .input("diskon", sql.Decimal(20, 2), diskon)
        .input("total_stlh_diskon", sql.Decimal(20, 2), total_stlh_diskon)
        .input("total_sblm_ppn", sql.Decimal(20, 2), total_sblm_ppn)
        .input("ppn", sql.Decimal(20, 2), ppn)
        .input("total_tagihan", sql.Decimal(20, 2), total_tagihan)
        .input("total_dibayar", sql.Decimal(20, 2), Number(body.total_dibayar ?? 0))
        .input("is_lunas", sql.Int, body.is_lunas ? 1 : 0)
        .input("tgl_lunas", sql.DateTime, body.tgl_lunas ? new Date(body.tgl_lunas) : null)
        .input("catatan", sql.VarChar(255), body.catatan || null)
        .input("metode_bayar", sql.VarChar(255), body.metode_bayar || null)
        .input("bank", sql.VarChar(255), body.bank || null)
        .input("status_verifikasi", sql.Int, body.status_verifikasi ?? 0)
        .input("verifikasi_by", sql.VarChar(255), body.verifikasi_by || null)
        .input("verifikasi_at", sql.DateTime, body.verifikasi_at ? new Date(body.verifikasi_at) : null)
        .input("is_void", sql.Int, body.is_void ?? 0)
        .input("void_by", sql.VarChar(255), body.void_by || null)
        .input("void_at", sql.DateTime, body.void_at ? new Date(body.void_at) : null)
        .input("status", sql.Int, body.status ?? 1)
        .input("status_cadangan", sql.Int, body.status_cadangan ?? null)
        .input("created_by", sql.VarChar(255), created_by)
        .input("created_at", sql.DateTime, now)
        .input("updated_by", sql.VarChar(255), created_by)
        .input("updated_at", sql.DateTime, now)
        .input("no_faktur_pajak_pembelian", sql.VarChar(255), body.no_faktur_pajak_pembelian || null)
        .input("tgl_faktur_pajak_pembelian", sql.DateTime, body.tgl_faktur_pajak_pembelian ? new Date(body.tgl_faktur_pajak_pembelian) : null)
        .input("ket", sql.VarChar(sql.MAX), body.ket || null)
        .query(
          `
          INSERT INTO dbo.GWEN_t_tagihan (
            kode_t_tagihan, kode_t_pengadaan, kode_t_rpo, kode_lpb, kode_supplier, nama_supplier, no_invoice,
            no_faktur_supplier, tgl, tgl_jatuh_tempo, subtotal, diskon, total_stlh_diskon, total_sblm_ppn, ppn,
            total_tagihan, total_dibayar, is_lunas, tgl_lunas, catatan, metode_bayar, bank, status_verifikasi,
            verifikasi_by, verifikasi_at, is_void, void_by, void_at, status, status_cadangan, created_by, created_at,
            updated_by, updated_at, no_faktur_pajak_pembelian, tgl_faktur_pajak_pembelian, ket
          ) VALUES (
            @kode_t_tagihan, @kode_t_pengadaan, @kode_t_rpo, @kode_lpb, @kode_supplier, @nama_supplier, @no_invoice,
            @no_faktur_supplier, @tgl, @tgl_jatuh_tempo, @subtotal, @diskon, @total_stlh_diskon, @total_sblm_ppn, @ppn,
            @total_tagihan, @total_dibayar, @is_lunas, @tgl_lunas, @catatan, @metode_bayar, @bank, @status_verifikasi,
            @verifikasi_by, @verifikasi_at, @is_void, @void_by, @void_at, @status, @status_cadangan, @created_by, @created_at,
            @updated_by, @updated_at, @no_faktur_pajak_pembelian, @tgl_faktur_pajak_pembelian, @ket
          );
        `
        );

      for (const it of items) {
        const kode_d_tagihan = await generateDetailCode({ prefix: "DTG", tx, padLength: 6 });
        const qty = Number(it.qty ?? 0);
        const harga = Number(it.harga_satuan ?? it.harga_beli ?? 0);
        const subtotalItem = Number(it.subtotal ?? qty * harga);
        const totalItem = Number(it.total ?? subtotalItem);
        await new sql.Request(tx)
          .input("kode_d_tagihan", sql.VarChar(255), kode_d_tagihan)
          .input("kode_t_tagihan", sql.VarChar(255), kode_t_tagihan)
          .input("kode_t_pengadaan", sql.VarChar(255), kode_t_pengadaan)
          .input("kode_d_pengadaan", sql.VarChar(255), it.kode_d_pengadaan || null)
          .input("kode_barang_variant", sql.VarChar(255), it.kode_barang_variant || null)
          .input("barcode_varian", sql.VarChar(255), it.barcode_varian || null)
          .input("nama_barang", sql.VarChar(255), it.nama_barang || null)
          .input("qty", sql.Decimal(20, 2), qty)
          .input("satuan", sql.VarChar(255), it.satuan || "PCS")
          .input("harga_satuan", sql.Decimal(20, 2), harga)
          .input("subtotal", sql.Decimal(20, 2), subtotalItem)
          .input("diskon_total", sql.Decimal(20, 2), Number(it.diskon_total ?? 0))
          .input("ppn_total", sql.Decimal(20, 2), Number(it.ppn_total ?? 0))
          .input("total", sql.Decimal(20, 2), totalItem)
          .input("catatan_item", sql.VarChar(255), it.catatan_item || null)
          .input("kode_parent", sql.VarChar(255), it.kode_parent || null)
          .input("status", sql.Int, it.status ?? 1)
          .input("status_cadangan", sql.Int, it.status_cadangan ?? null)
          .input("created_by", sql.VarChar(255), created_by)
          .input("created_at", sql.DateTime, now)
          .input("updated_by", sql.VarChar(255), created_by)
          .input("updated_at", sql.DateTime, now)
          .query(
            `
            INSERT INTO dbo.GWEN_d_tagihan (
              kode_d_tagihan, kode_t_tagihan, kode_t_pengadaan, kode_d_pengadaan, kode_barang_variant, barcode_varian,
              nama_barang, qty, satuan, harga_satuan, subtotal, diskon_total, ppn_total, total, catatan_item, kode_parent,
              status, status_cadangan, created_by, created_at, updated_by, updated_at
            ) VALUES (
              @kode_d_tagihan, @kode_t_tagihan, @kode_t_pengadaan, @kode_d_pengadaan, @kode_barang_variant, @barcode_varian,
              @nama_barang, @qty, @satuan, @harga_satuan, @subtotal, @diskon_total, @ppn_total, @total, @catatan_item, @kode_parent,
              @status, @status_cadangan, @created_by, @created_at, @updated_by, @updated_at
            );
          `
          );
      }

      await tx.commit();
      return reply.send({ message: "Tagihan tersimpan", kode_t_tagihan });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed save tagihan");
      return reply.code(500).send({ message: "Gagal menyimpan tagihan" });
    }
  });

  fastify.get("/", async (_request, reply) => {
    try {
      const res = await pool.request().query(
        `
        SELECT
          t.kode_t_tagihan,
          t.kode_t_pengadaan,
          t.kode_t_rpo,
          t.kode_lpb,
          t.kode_supplier,
          COALESCE(
            s.nama COLLATE DATABASE_DEFAULT,
            t.nama_supplier COLLATE DATABASE_DEFAULT,
            t.kode_supplier COLLATE DATABASE_DEFAULT
          ) AS supplier_nama,
          t.no_invoice,
          t.no_faktur_supplier,
          t.tgl,
          t.tgl_jatuh_tempo,
          t.subtotal,
          t.diskon,
          t.total_stlh_diskon,
          t.total_sblm_ppn,
          t.ppn,
          t.total_tagihan,
          t.total_dibayar,
          CASE
            WHEN ISNULL(t.total_tagihan, 0) > 0
              AND ISNULL(t.total_dibayar, 0) >= ISNULL(t.total_tagihan, 0)
              THEN 1
            ELSE 0
          END AS is_lunas,
          t.tgl_lunas,
          t.status_verifikasi,
          t.verifikasi_by,
          t.verifikasi_at,
          t.status,
          t.created_at
        FROM dbo.GWEN_t_tagihan t
        LEFT JOIN dbo.m_supplier s
          ON s.kode_supplier COLLATE DATABASE_DEFAULT = t.kode_supplier COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.GWEN_t_kontrabon k
          ON k.no_kontrabon = t.no_invoice
        WHERE ISNULL(t.is_void, 0) = 0
          AND ISNULL(t.status, 1) = 1
          AND (
            k.no_kontrabon IS NULL
            OR k.kode_t_pengadaan IS NULL
            OR LTRIM(RTRIM(k.kode_t_pengadaan)) = ''
            OR (
              ',' + REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(k.kode_t_pengadaan, ''), '[', ''), ']', ''), CHAR(34), ''), CHAR(39), '') + ','
              LIKE '%,' + LTRIM(RTRIM(ISNULL(t.kode_t_pengadaan, ''))) + ',%'
            )
          )
        ORDER BY t.created_at DESC, t.kode_t_tagihan DESC;
        `
      );
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed fetch tagihan list");
      return reply.code(500).send({ message: "Gagal memuat data tagihan" });
    }
  });
}
