const sql = require("mssql");

const DB_CONFIG = {
  server: process.env.DB_HOST || "server-home-gwen",
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME || "db_gwen_v2",
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "resmi12",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

const APPLY = process.argv.includes("--apply");
const REPAIR_USER = "system-repair";

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const parsePengadaanCodes = (raw) => {
  if (!raw) return [];
  const trimmed = String(raw).trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || "").trim()).filter(Boolean);
    }
  } catch {
    // fallback
  }
  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((item) => item.trim().replace(/^"+|"+$/g, ""))
      .filter(Boolean);
  }
  return [trimmed.replace(/^"+|"+$/g, "")].filter(Boolean);
};

const generateDocCode = async ({ tx, prefix = "TAG", userCode = "88", branchCode = "GW", padLength = 5, separator = "." }) => {
  const req = new sql.Request(tx);
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

const fetchPaidKontrabons = async (pool) => {
  const res = await pool.request().query(`
    SELECT
      id,
      no_kontrabon,
      kode_t_pengadaan,
      kode_supplier,
      nama_bank,
      no_faktur,
      nomor_faktur_pajak,
      tanggal_faktur_pajak,
      tgl_faktur,
      rencana_tf_sampai,
      tgl_bayar,
      catatan_tambahan,
      created_at
    FROM dbo.GWEN_t_kontrabon
    WHERE ISNULL(status, 1) = 1
      AND LTRIM(RTRIM(ISNULL(status_paid, ''))) = 'Paid'
    ORDER BY id ASC;
  `);
  return res.recordset || [];
};

const fetchActiveTagihan = async (pool) => {
  const res = await pool.request().query(`
    SELECT
      kode_t_tagihan,
      kode_t_pengadaan,
      no_invoice,
      total_tagihan,
      total_dibayar,
      is_lunas,
      is_void,
      status
    FROM dbo.GWEN_t_tagihan
    WHERE ISNULL(status, 1) = 1
      AND ISNULL(is_void, 0) = 0;
  `);
  return res.recordset || [];
};

const fetchPengadaanMap = async (pool) => {
  const res = await pool.request().query(`
    SELECT
      kode_t_pengadaan,
      kode_t_rpo,
      kode_supplier,
      total,
      diskon,
      total_stlh_diskon,
      total_sblm_ppn,
      ppn,
      total_akhir,
      no_faktur_supplier
    FROM dbo.GWEN_t_pengadaan;
  `);
  const map = new Map();
  for (const row of res.recordset || []) {
    const code = String(row.kode_t_pengadaan || "").trim();
    if (code && !map.has(code)) map.set(code, row);
  }
  return map;
};

const updateExistingTagihanAsPaid = async (tx, kontrabon, row, now) => {
  await new sql.Request(tx)
    .input("kode_t_tagihan", sql.VarChar(255), row.kode_t_tagihan)
    .input("total_dibayar", sql.Decimal(20, 2), roundMoney(row.total_tagihan))
    .input("tgl_lunas", sql.DateTime, kontrabon.tgl_bayar ? new Date(kontrabon.tgl_bayar) : now)
    .input("updated_by", sql.VarChar(255), REPAIR_USER)
    .input("updated_at", sql.DateTime2, now)
    .query(`
      UPDATE dbo.GWEN_t_tagihan
      SET total_dibayar = @total_dibayar,
          is_lunas = 1,
          tgl_lunas = @tgl_lunas,
          updated_by = @updated_by,
          updated_at = @updated_at
      WHERE kode_t_tagihan = @kode_t_tagihan;
    `);
};

const createMissingPaidTagihan = async (tx, kontrabon, pengadaan, missingAmount, now) => {
  const kodeTagihan = await generateDocCode({ tx, prefix: "TAG" });
  const totalAkhir = roundMoney(pengadaan.total_akhir ?? pengadaan.total_sblm_ppn ?? pengadaan.total ?? 0);
  const ratio = totalAkhir > 0 ? missingAmount / totalAkhir : 0;
  const subtotalRaw = roundMoney(pengadaan.total ?? pengadaan.total_akhir ?? 0);
  const diskonRaw = roundMoney(pengadaan.diskon ?? 0);
  const totalStlhDiskonRaw = roundMoney(pengadaan.total_stlh_diskon ?? subtotalRaw - diskonRaw);
  const totalSblmPpnRaw = roundMoney(pengadaan.total_sblm_ppn ?? totalStlhDiskonRaw);
  const subtotal = roundMoney(subtotalRaw * ratio);
  const diskon = roundMoney(diskonRaw * ratio);
  const totalStlhDiskon = roundMoney(totalStlhDiskonRaw * ratio);
  const totalSblmPpn = roundMoney(totalSblmPpnRaw * ratio);
  const ppn = roundMoney(missingAmount - totalSblmPpn);

  await new sql.Request(tx)
    .input("kode_t_tagihan", sql.VarChar(255), kodeTagihan)
    .input("kode_t_pengadaan", sql.VarChar(255), pengadaan.kode_t_pengadaan)
    .input("kode_t_rpo", sql.VarChar(255), pengadaan.kode_t_rpo || null)
    .input("kode_lpb", sql.VarChar(255), null)
    .input("kode_supplier", sql.VarChar(255), pengadaan.kode_supplier || kontrabon.kode_supplier || null)
    .input("nama_supplier", sql.VarChar(255), null)
    .input("no_invoice", sql.VarChar(255), kontrabon.no_kontrabon)
    .input("no_faktur_supplier", sql.VarChar(255), pengadaan.no_faktur_supplier || kontrabon.no_faktur || null)
    .input("tgl", sql.DateTime, kontrabon.tgl_faktur ? new Date(kontrabon.tgl_faktur) : now)
    .input("tgl_jatuh_tempo", sql.DateTime, kontrabon.rencana_tf_sampai ? new Date(kontrabon.rencana_tf_sampai) : null)
    .input("subtotal", sql.Decimal(20, 2), subtotal)
    .input("diskon", sql.Decimal(20, 2), diskon)
    .input("total_stlh_diskon", sql.Decimal(20, 2), totalStlhDiskon)
    .input("total_sblm_ppn", sql.Decimal(20, 2), totalSblmPpn)
    .input("ppn", sql.Decimal(20, 2), ppn)
    .input("total_tagihan", sql.Decimal(20, 2), missingAmount)
    .input("total_dibayar", sql.Decimal(20, 2), missingAmount)
    .input("is_lunas", sql.Int, 1)
    .input("tgl_lunas", sql.DateTime, kontrabon.tgl_bayar ? new Date(kontrabon.tgl_bayar) : now)
    .input("catatan", sql.VarChar(255), kontrabon.catatan_tambahan || "Repaired from paid kontrabon audit")
    .input("metode_bayar", sql.VarChar(255), null)
    .input("bank", sql.VarChar(255), kontrabon.nama_bank || null)
    .input("status_verifikasi", sql.Int, 0)
    .input("verifikasi_by", sql.VarChar(255), null)
    .input("verifikasi_at", sql.DateTime, null)
    .input("is_void", sql.Int, 0)
    .input("void_by", sql.VarChar(255), null)
    .input("void_at", sql.DateTime, null)
    .input("status", sql.Int, 1)
    .input("status_cadangan", sql.Int, 1)
    .input("created_by", sql.VarChar(255), REPAIR_USER)
    .input("created_at", sql.DateTime2, now)
    .input("updated_by", sql.VarChar(255), REPAIR_USER)
    .input("updated_at", sql.DateTime2, now)
    .input("no_faktur_pajak_pembelian", sql.VarChar(255), kontrabon.nomor_faktur_pajak || null)
    .input("tgl_faktur_pajak_pembelian", sql.DateTime, kontrabon.tanggal_faktur_pajak ? new Date(kontrabon.tanggal_faktur_pajak) : null)
    .input("ket", sql.VarChar(sql.MAX), "Repair missing paid tagihan from kontrabon")
    .query(`
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
    `);

  return { kode_t_tagihan: kodeTagihan, kode_t_pengadaan: pengadaan.kode_t_pengadaan, total_tagihan: missingAmount };
};

async function main() {
  const pool = await sql.connect(DB_CONFIG);
  try {
    const [kontrabons, activeTagihan, pengadaanMap] = await Promise.all([
      fetchPaidKontrabons(pool),
      fetchActiveTagihan(pool),
      fetchPengadaanMap(pool),
    ]);

    const tagihanByInvoice = new Map();
    const aggregateByPengadaan = new Map();
    for (const row of activeTagihan) {
      const invoice = String(row.no_invoice || "").trim();
      const pengadaan = String(row.kode_t_pengadaan || "").trim();
      if (invoice) {
        if (!tagihanByInvoice.has(invoice)) tagihanByInvoice.set(invoice, []);
        tagihanByInvoice.get(invoice).push(row);
      }
      if (pengadaan) {
        if (!aggregateByPengadaan.has(pengadaan)) {
          aggregateByPengadaan.set(pengadaan, { totalTagihan: 0, totalDibayar: 0 });
        }
        const agg = aggregateByPengadaan.get(pengadaan);
        agg.totalTagihan = roundMoney(agg.totalTagihan + roundMoney(row.total_tagihan ?? 0));
        agg.totalDibayar = roundMoney(agg.totalDibayar + roundMoney(row.total_dibayar ?? 0));
      }
    }

    const anomalies = [];
    for (const kontrabon of kontrabons) {
      const codes = parsePengadaanCodes(kontrabon.kode_t_pengadaan);
      const invoiceRows = tagihanByInvoice.get(String(kontrabon.no_kontrabon || "").trim()) || [];
      const invoiceCodeSet = new Set(invoiceRows.map((row) => String(row.kode_t_pengadaan || "").trim()).filter(Boolean));
      const missingCodes = codes.filter((code) => !invoiceCodeSet.has(code));
      const unpaidRows = invoiceRows.filter((row) => {
        const totalTagihan = roundMoney(row.total_tagihan ?? 0);
        const totalDibayar = roundMoney(row.total_dibayar ?? 0);
        return totalTagihan > 0 && (totalDibayar < totalTagihan || Number(row.is_lunas ?? 0) !== 1);
      });
      if (missingCodes.length === 0 && unpaidRows.length === 0) continue;
      anomalies.push({ kontrabon, missingCodes, unpaidRows });
    }

    const summary = {
      apply: APPLY,
      paidKontrabon: kontrabons.length,
      kontrabonWithIssues: anomalies.length,
      missingTagihan: anomalies.reduce((sum, item) => sum + item.missingCodes.length, 0),
      unpaidTagihanRows: anomalies.reduce((sum, item) => sum + item.unpaidRows.length, 0),
      createdTagihan: 0,
      updatedTagihan: 0,
      skipped: 0,
    };

    const audit = [];
    for (const item of anomalies) {
      const { kontrabon, missingCodes, unpaidRows } = item;
      const itemReport = {
        no_kontrabon: kontrabon.no_kontrabon,
        missing_codes: [],
        updated_rows: [],
        skipped: [],
      };

      if (APPLY) {
        const tx = new sql.Transaction(pool);
        await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
        try {
          const now = new Date();
          for (const row of unpaidRows) {
            await updateExistingTagihanAsPaid(tx, kontrabon, row, now);
            summary.updatedTagihan += 1;
            itemReport.updated_rows.push({
              kode_t_tagihan: row.kode_t_tagihan,
              kode_t_pengadaan: row.kode_t_pengadaan,
              from_total_dibayar: roundMoney(row.total_dibayar ?? 0),
              to_total_dibayar: roundMoney(row.total_tagihan ?? 0),
            });
          }

          for (const kodePengadaan of missingCodes) {
            const pengadaan = pengadaanMap.get(kodePengadaan);
            if (!pengadaan) {
              summary.skipped += 1;
              itemReport.skipped.push({ kode_t_pengadaan: kodePengadaan, reason: "pengadaan_not_found" });
              continue;
            }
            const agg = aggregateByPengadaan.get(kodePengadaan) || { totalTagihan: 0, totalDibayar: 0 };
            const totalAkhir = roundMoney(pengadaan.total_akhir ?? pengadaan.total_sblm_ppn ?? pengadaan.total ?? 0);
            const missingAmount = roundMoney(totalAkhir - agg.totalTagihan);
            if (missingAmount <= 0) {
              summary.skipped += 1;
              itemReport.skipped.push({
                kode_t_pengadaan: kodePengadaan,
                reason: "no_missing_amount",
                total_akhir: totalAkhir,
                total_tagihan_aktif: agg.totalTagihan,
                total_dibayar_aktif: agg.totalDibayar,
              });
              continue;
            }
            const created = await createMissingPaidTagihan(tx, kontrabon, pengadaan, missingAmount, now);
            summary.createdTagihan += 1;
            itemReport.missing_codes.push({ ...created, repaired: true });
          }
          await tx.commit();
        } catch (err) {
          await tx.rollback().catch(() => {});
          throw err;
        }
      } else {
        for (const row of unpaidRows) {
          itemReport.updated_rows.push({
            kode_t_tagihan: row.kode_t_tagihan,
            kode_t_pengadaan: row.kode_t_pengadaan,
            from_total_dibayar: roundMoney(row.total_dibayar ?? 0),
            to_total_dibayar: roundMoney(row.total_tagihan ?? 0),
          });
        }
        for (const kodePengadaan of missingCodes) {
          const pengadaan = pengadaanMap.get(kodePengadaan);
          if (!pengadaan) {
            summary.skipped += 1;
            itemReport.skipped.push({ kode_t_pengadaan: kodePengadaan, reason: "pengadaan_not_found" });
            continue;
          }
          const agg = aggregateByPengadaan.get(kodePengadaan) || { totalTagihan: 0, totalDibayar: 0 };
          const totalAkhir = roundMoney(pengadaan.total_akhir ?? pengadaan.total_sblm_ppn ?? pengadaan.total ?? 0);
          const missingAmount = roundMoney(totalAkhir - agg.totalTagihan);
          if (missingAmount <= 0) {
            summary.skipped += 1;
            itemReport.skipped.push({
              kode_t_pengadaan: kodePengadaan,
              reason: "no_missing_amount",
              total_akhir: totalAkhir,
              total_tagihan_aktif: agg.totalTagihan,
              total_dibayar_aktif: agg.totalDibayar,
            });
            continue;
          }
          itemReport.missing_codes.push({
            kode_t_pengadaan: kodePengadaan,
            total_tagihan: missingAmount,
            repaired: false,
          });
        }
      }

      audit.push(itemReport);
    }

    console.log(JSON.stringify({ summary, audit }, null, 2));
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
