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

  fastify.post("/:kode/pelunasan", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    const body = request.body || {};
    const nominalBayar = Number(body.nominal_bayar || 0);
    const sumberPembayaran = String(body.sumber_pembayaran || "").trim().toUpperCase();
    const tglBayar = body.tgl_bayar ? new Date(body.tgl_bayar) : new Date();
    const bank = String(body.bank || "").trim() || null;
    const noReferensi = String(body.no_referensi || "").trim() || null;
    const catatan = String(body.catatan || "").trim() || null;
    const createdBy = String(body.created_by || "Admin").trim() || "Admin";

    if (!kode) return reply.code(400).send({ message: "Kode tagihan wajib diisi" });
    if (!Number.isFinite(nominalBayar) || nominalBayar <= 0) {
      return reply.code(400).send({ message: "Nominal pembayaran harus lebih besar dari 0" });
    }
    if (!sumberPembayaran) {
      return reply.code(400).send({ message: "Sumber pembayaran wajib dipilih" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();

      const tagihanRes = await new sql.Request(tx)
        .input("kode_t_tagihan", sql.VarChar(255), kode)
        .query(`
          SELECT
            kode_t_tagihan,
            kode_t_pengadaan,
            kode_supplier,
            nama_supplier,
            total_tagihan,
            ISNULL(total_dibayar, 0) AS total_dibayar,
            is_lunas,
            is_void
          FROM dbo.GWEN_t_tagihan WITH (UPDLOCK, ROWLOCK)
          WHERE kode_t_tagihan = @kode_t_tagihan;
        `);

      const tagihan = tagihanRes.recordset?.[0];
      if (!tagihan) {
        throw new Error("VALIDATION:Tagihan tidak ditemukan");
      }
      if (tagihan.is_void) {
        throw new Error("VALIDATION:Tagihan ini sudah dibatalkan (void)");
      }

      const totalTagihan = Number(tagihan.total_tagihan || 0);
      const totalDibayarAwal = Number(tagihan.total_dibayar || 0);
      const sisaTagihan = Math.max(0, totalTagihan - totalDibayarAwal);

      if (sisaTagihan <= 0) {
        throw new Error("VALIDATION:Tagihan ini sudah lunas");
      }
      if (nominalBayar > sisaTagihan) {
        throw new Error(
          `VALIDATION:Nominal pembayaran (Rp ${nominalBayar.toLocaleString("id-ID")}) melebihi sisa tagihan (Rp ${sisaTagihan.toLocaleString("id-ID")})`
        );
      }

      const kodeSupplier = String(tagihan.kode_supplier || "").trim();
      const namaSupplier = String(tagihan.nama_supplier || "").trim();

      if (sumberPembayaran === "DEPOSIT_RETUR") {
        if (!kodeSupplier) {
          throw new Error("VALIDATION:Kode supplier pada tagihan tidak valid");
        }

        const depositRes = await new sql.Request(tx)
          .input("kode_supplier", sql.VarChar(255), kodeSupplier)
          .query(`
            SELECT kode_supplier, saldo_deposit
            FROM dbo.GWEN_m_supplier_deposit WITH (UPDLOCK, ROWLOCK)
            WHERE kode_supplier = @kode_supplier;
          `);

        const saldoAwal = Number(depositRes.recordset?.[0]?.saldo_deposit || 0);
        if (saldoAwal < nominalBayar) {
          throw new Error(
            `VALIDATION:Saldo deposit retur tidak mencukupi. Saldo saat ini: Rp ${saldoAwal.toLocaleString("id-ID")}, dibutuhkan: Rp ${nominalBayar.toLocaleString("id-ID")}`
          );
        }

        const saldoAkhir = saldoAwal - nominalBayar;
        const yyMMdd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
        const kodeMutasi = `MUT.DEP.OUT.${yyMMdd}.${Date.now().toString().slice(-6)}`;

        await new sql.Request(tx)
          .input("kode_mutasi", sql.VarChar(100), kodeMutasi)
          .input("tgl_mutasi", sql.DateTime, tglBayar)
          .input("kode_supplier", sql.VarChar(255), kodeSupplier)
          .input("nama_supplier", sql.NVarChar(255), namaSupplier)
          .input("tipe_mutasi", sql.VarChar(50), "KELUAR")
          .input("kode_ref", sql.VarChar(255), kode)
          .input("saldo_awal", sql.Decimal(20, 2), saldoAwal)
          .input("nominal", sql.Decimal(20, 2), nominalBayar)
          .input("saldo_akhir", sql.Decimal(20, 2), saldoAkhir)
          .input("keterangan", sql.NVarChar(500), catatan || `Pelunasan Tagihan ${kode}`)
          .input("created_by", sql.VarChar(255), createdBy)
          .input("created_at", sql.DateTime, new Date())
          .query(`
            INSERT INTO dbo.GWEN_t_supplier_deposit_ledger (
              kode_mutasi, tgl_mutasi, kode_supplier, nama_supplier, tipe_mutasi, kode_ref,
              saldo_awal, nominal, saldo_akhir, keterangan, created_by, created_at
            ) VALUES (
              @kode_mutasi, @tgl_mutasi, @kode_supplier, @nama_supplier, @tipe_mutasi, @kode_ref,
              @saldo_awal, @nominal, @saldo_akhir, @keterangan, @created_by, @created_at
            );
          `);

        await new sql.Request(tx)
          .input("kode_supplier", sql.VarChar(255), kodeSupplier)
          .input("saldo_deposit", sql.Decimal(20, 2), saldoAkhir)
          .input("updated_by", sql.VarChar(255), createdBy)
          .query(`
            UPDATE dbo.GWEN_m_supplier_deposit
            SET saldo_deposit = @saldo_deposit,
                updated_at = GETDATE(),
                updated_by = @updated_by
            WHERE kode_supplier = @kode_supplier;
          `);
      }

      const kodeBayar = `BAY.${kode}.${Date.now().toString().slice(-4)}`;
      await new sql.Request(tx)
        .input("kode_pembayaran", sql.VarChar(100), kodeBayar)
        .input("kode_t_tagihan", sql.VarChar(255), kode)
        .input("tgl_bayar", sql.DateTime, tglBayar)
        .input("nominal_bayar", sql.Decimal(20, 2), nominalBayar)
        .input("sumber_pembayaran", sql.VarChar(50), sumberPembayaran)
        .input("bank", sql.VarChar(255), bank)
        .input("no_referensi", sql.VarChar(255), noReferensi)
        .input("catatan", sql.NVarChar(500), catatan)
        .input("created_by", sql.VarChar(255), createdBy)
        .query(`
          INSERT INTO dbo.GWEN_t_tagihan_pembayaran_history (
            kode_pembayaran, kode_t_tagihan, tgl_bayar, nominal_bayar, sumber_pembayaran,
            bank, no_referensi, catatan, created_by, created_at
          ) VALUES (
            @kode_pembayaran, @kode_t_tagihan, @tgl_bayar, @nominal_bayar, @sumber_pembayaran,
            @bank, @no_referensi, @catatan, @created_by, GETDATE()
          );
        `);

      const totalDibayarBaru = totalDibayarAwal + nominalBayar;
      const isLunas = totalDibayarBaru >= totalTagihan ? 1 : 0;
      await new sql.Request(tx)
        .input("kode_t_tagihan", sql.VarChar(255), kode)
        .input("total_dibayar", sql.Decimal(20, 2), totalDibayarBaru)
        .input("is_lunas", sql.Int, isLunas)
        .input("tgl_lunas", sql.DateTime, isLunas ? tglBayar : null)
        .input("metode_bayar", sql.VarChar(255), sumberPembayaran)
        .input("bank", sql.VarChar(255), bank)
        .input("updated_by", sql.VarChar(255), createdBy)
        .query(`
          UPDATE dbo.GWEN_t_tagihan
          SET total_dibayar = @total_dibayar,
              is_lunas = @is_lunas,
              tgl_lunas = CASE WHEN @is_lunas = 1 THEN @tgl_lunas ELSE tgl_lunas END,
              metode_bayar = @metode_bayar,
              bank = COALESCE(@bank, bank),
              updated_by = @updated_by,
              updated_at = GETDATE()
          WHERE kode_t_tagihan = @kode_t_tagihan;
        `);

      if (tagihan.kode_t_pengadaan) {
        const kodePbt = `PBT.${new Date().toISOString().slice(2, 10).replace(/-/g, "")}.${Date.now().toString().slice(-6)}`;
        await new sql.Request(tx)
          .input("kode_t_pembayaran_tagihan", sql.VarChar(255), kodePbt)
          .input("kode_t_pengadaan", sql.VarChar(255), tagihan.kode_t_pengadaan)
          .input("jenis_pembayaran", sql.NVarChar(50), sumberPembayaran === "DEPOSIT_RETUR" ? "DEPOSIT RETUR" : "PELUNASAN")
          .input("jumlah_dibayar", sql.Decimal(20, 2), nominalBayar)
          .input("keterangan", sql.NVarChar(255), catatan || `Pelunasan Tagihan ${kode}`)
          .input("created_by", sql.VarChar(100), createdBy)
          .query(`
            INSERT INTO dbo.GWEN_t_pembayaran_tagihan (
              kode_t_pembayaran_tagihan, kode_t_pengadaan, jenis_pembayaran, jumlah_dibayar,
              keterangan, status, created_by, created_at
            ) VALUES (
              @kode_t_pembayaran_tagihan, @kode_t_pengadaan, @jenis_pembayaran, @jumlah_dibayar,
              @keterangan, 1, @created_by, GETDATE()
            );
          `);
      }

      await tx.commit();
      return reply.send({
        message: "Pelunasan tagihan berhasil disimpan",
        kode_t_tagihan: kode,
        nominal_bayar: nominalBayar,
        total_dibayar: totalDibayarBaru,
        is_lunas: isLunas === 1,
      });
    } catch (err) {
      try {
        await tx.rollback();
      } catch {}
      if (String(err?.message || "").startsWith("VALIDATION:")) {
        return reply.code(400).send({ message: String(err.message).replace("VALIDATION:", "") });
      }
      fastify.log.error({ err }, "Failed to process pelunasan tagihan");
      return reply.code(500).send({ message: "Gagal memproses pelunasan tagihan" });
    }
  });

  fastify.get("/:kode/pembayaran", async (request, reply) => {
    const kode = String(request.params?.kode || "").trim();
    if (!kode) return reply.code(400).send({ message: "Kode tagihan wajib diisi" });

    try {
      const res = await pool
        .request()
        .input("kode_t_tagihan", sql.VarChar(255), kode)
        .query(`
          SELECT
            id_pembayaran,
            kode_pembayaran,
            kode_t_tagihan,
            tgl_bayar,
            nominal_bayar,
            sumber_pembayaran,
            bank,
            no_referensi,
            catatan,
            created_by,
            created_at
          FROM dbo.GWEN_t_tagihan_pembayaran_history
          WHERE kode_t_tagihan = @kode_t_tagihan
          ORDER BY tgl_bayar DESC, id_pembayaran DESC;
        `);
      return reply.send(res.recordset || []);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch payment history");
      return reply.code(500).send({ message: "Gagal memuat riwayat pembayaran" });
    }
  });
}
