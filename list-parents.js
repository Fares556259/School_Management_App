const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function list() {
  const res = await pool.query('SELECT id, phone, name, password FROM "Parent" LIMIT 10');
  console.log("Parents in DB:");
  res.rows.forEach(p => console.log(`- ${p.name}: [${p.phone}] | Pass Set: ${!!p.password}`));
  await pool.end();
}
list().catch(console.error);
