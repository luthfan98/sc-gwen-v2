export default async function etalaseRoutes(fastify) {
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

  fastify.get("/", async (_req, reply) => {
    try {
      const etalaseRes = await pool.request().query(`
        SELECT
          kode_etalase,
          nama,
          lokasi,
          status,
          status_cadangan,
          created_by,
          created_at,
          updated_by,
          updated_at,
          is_show,
          kode_merk,
          kapasitas,
          biaya_sewa_default,
          satuan_sewa,
          is_disewakan
        FROM dbo.m_etalase
        ORDER BY nama ASC, kode_etalase ASC;
      `);

      const subsRes = await pool.request().query(`
        SELECT
          kode_etalase_sub,
          kode_etalase,
          nama,
          posisi,
          kapasitas,
          status,
          status_cadangan,
          created_by,
          created_at,
          updated_by,
          updated_at,
          is_show
        FROM dbo.m_etalase_sub
        ORDER BY kode_etalase, nama ASC;
      `);

      const subsByEtalase = new Map();
      for (const sub of subsRes.recordset || []) {
        const key = String(sub.kode_etalase);
        if (!subsByEtalase.has(key)) subsByEtalase.set(key, []);
        subsByEtalase.get(key).push(sub);
      }

      const items = (etalaseRes.recordset || []).map((row) => ({
        ...row,
        subs: subsByEtalase.get(String(row.kode_etalase)) || [],
      }));

      return reply.send(items);
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch etalase");
      return reply.code(500).send({ message: "Gagal memuat etalase" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const nama = String(body.nama || "").trim();
    const lokasi = String(body.lokasi || "").trim();
    const status = Number(body.status ?? 1);
    const isShow = Number(body.is_show ?? 1);
    const kodeMerk = body.kode_merk ? String(body.kode_merk).trim() : null;
    const kapasitas = Number(body.kapasitas ?? 0) || 0;
    const biayaSewa = Number(body.biaya_sewa_default ?? 0) || 0;
    const satuanSewa = body.satuan_sewa ? String(body.satuan_sewa).trim() : null;
    const isDisewakan = Number(body.is_disewakan ?? 1);
    const createdBy = String(body.created_by || "Admin").trim() || "Admin";
    const subs = Array.isArray(body.subs) ? body.subs : [];

    if (!nama) {
      return reply.code(400).send({ message: "nama wajib diisi" });
    }

    const tx = new sql.Transaction(pool);
    try {
      await tx.begin();
      const kodeEtalase = body.kode_etalase
        ? String(body.kode_etalase).trim()
        : await generateDocCode(tx, "ETL", createdBy);

      await new sql.Request(tx)
        .input("kode_etalase", sql.VarChar(50), kodeEtalase)
        .input("nama", sql.VarChar(255), nama)
        .input("lokasi", sql.VarChar(255), lokasi || null)
        .input("status", sql.Int, status)
        .input("status_cadangan", sql.Int, null)
        .input("created_by", sql.VarChar(255), createdBy)
        .input("created_at", sql.DateTime2, new Date())
        .input("updated_by", sql.VarChar(255), createdBy)
        .input("updated_at", sql.DateTime2, new Date())
        .input("is_show", sql.Int, isShow)
        .input("kode_merk", sql.VarChar(50), kodeMerk)
        .input("kapasitas", sql.Decimal(20, 2), kapasitas)
        .input("biaya_sewa_default", sql.Decimal(20, 2), biayaSewa)
        .input("satuan_sewa", sql.VarChar(50), satuanSewa)
        .input("is_disewakan", sql.Int, isDisewakan)
        .query(
          `INSERT INTO dbo.m_etalase (
            kode_etalase,
            nama,
            lokasi,
            status,
            status_cadangan,
            created_by,
            created_at,
            updated_by,
            updated_at,
            is_show,
            kode_merk,
            kapasitas,
            biaya_sewa_default,
            satuan_sewa,
            is_disewakan
          ) VALUES (
            @kode_etalase,
            @nama,
            @lokasi,
            @status,
            @status_cadangan,
            @created_by,
            @created_at,
            @updated_by,
            @updated_at,
            @is_show,
            @kode_merk,
            @kapasitas,
            @biaya_sewa_default,
            @satuan_sewa,
            @is_disewakan
          );`
        );

      for (const sub of subs) {
        const subNama = String(sub.nama || "").trim();
        if (!subNama) continue;
        const kodeEtalaseSub = sub.kode_etalase_sub
          ? String(sub.kode_etalase_sub).trim()
          : await generateDocCode(tx, "ETS", createdBy);
        await new sql.Request(tx)
          .input("kode_etalase_sub", sql.VarChar(50), kodeEtalaseSub)
          .input("kode_etalase", sql.VarChar(50), kodeEtalase)
          .input("nama", sql.VarChar(255), subNama)
          .input("posisi", sql.VarChar(255), sub.posisi || null)
          .input("kapasitas", sql.Decimal(20, 2), Number(sub.kapasitas ?? 0) || 0)
          .input("status", sql.Int, Number(sub.status ?? 1))
          .input("status_cadangan", sql.Int, null)
          .input("created_by", sql.VarChar(255), createdBy)
          .input("created_at", sql.DateTime2, new Date())
          .input("updated_by", sql.VarChar(255), createdBy)
          .input("updated_at", sql.DateTime2, new Date())
          .input("is_show", sql.Int, Number(sub.is_show ?? 1))
          .query(
            `INSERT INTO dbo.m_etalase_sub (
              kode_etalase_sub,
              kode_etalase,
              nama,
              posisi,
              kapasitas,
              status,
              status_cadangan,
              created_by,
              created_at,
              updated_by,
              updated_at,
              is_show
            ) VALUES (
              @kode_etalase_sub,
              @kode_etalase,
              @nama,
              @posisi,
              @kapasitas,
              @status,
              @status_cadangan,
              @created_by,
              @created_at,
              @updated_by,
              @updated_at,
              @is_show
            );`
          );
      }

      await tx.commit();
      return reply.code(201).send({ kode_etalase: kodeEtalase });
    } catch (err) {
      await tx.rollback();
      fastify.log.error({ err }, "Failed to create etalase");
      return reply.code(500).send({ message: "Gagal menambah etalase" });
    }
  });
}
