const { Client } = require('pg');

async function testConnection() {
  const connectionString = "postgresql://postgres.hvkqjfihjvnqvdmotdzo:p-%21P%40T.iq%407G%23%2BQ@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=no-verify";
  const client = new Client({ connectionString });
  
  console.log("Connecting to DIRECT Port 5432...");
  try {
    await client.connect();
    console.log("Success: Connected to 5432");
    const res = await client.query('SELECT NOW()');
    console.log("Query Result:", res.rows[0]);
    await client.end();
  } catch (err) {
    console.error("Error connecting to 5432:", err.message);
  }

  const poolerString = "postgresql://postgres.hvkqjfihjvnqvdmotdzo:p-%21P%40T.iq%407G%23%2BQ@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=no-verify";
  const clientPooler = new Client({ connectionString: poolerString });
  console.log("\nConnecting to POOLER Port 6543...");
  try {
    await clientPooler.connect();
    console.log("Success: Connected to 6543");
    const res = await clientPooler.query('SELECT NOW()');
    console.log("Query Result:", res.rows[0]);
    await clientPooler.end();
  } catch (err) {
    console.error("Error connecting to 6543:", err.message);
  }
}

testConnection();
