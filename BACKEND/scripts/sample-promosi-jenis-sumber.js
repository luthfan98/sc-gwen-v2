import sql from "mssql";
import { config } from "../src/config/index.js";

const main = async () => {
  const pool = await sql.connect(config.db);
  try {
    const res = await pool.request().query(`
      SELECT jenis_sumber, COUNT(1) AS total
      FROM dbo.GWEN_t_promosi
      GROUP BY jenis_sumber
      ORDER BY total DESC;
    `);
    console.log(res.recordset || []);
  } finally {
    await pool.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
