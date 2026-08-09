import sql from "mssql";
import { config } from "../src/config/index.js";

const main = async () => {
  const pool = await sql.connect(config.db);
  try {
    const res = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'GWEN_mn_barang_gudang_variant'
      ORDER BY ORDINAL_POSITION;
    `);
    console.log(res.recordset);
  } finally {
    await pool.close();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
