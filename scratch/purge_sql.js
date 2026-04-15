const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No database connection string found in environment.');
    return;
  }

  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database for purge...');

    const queries = [
      'UPDATE "Admin" SET "img" = NULL WHERE "img" ILIKE \'%cloudinary%\';',
      'UPDATE "Staff" SET "img" = NULL WHERE "img" ILIKE \'%cloudinary%\';',
      'UPDATE "Student" SET "img" = NULL WHERE "img" ILIKE \'%cloudinary%\';',
      'UPDATE "Teacher" SET "img" = NULL WHERE "img" ILIKE \'%cloudinary%\';',
      'UPDATE "GradeSheet" SET "proofUrl" = NULL WHERE "proofUrl" ILIKE \'%cloudinary%\';',
      'UPDATE "ExamPeriodConfig" SET "pdfUrl" = NULL WHERE "pdfUrl" ILIKE \'%cloudinary%\';',
      'UPDATE "Expense" SET "img" = NULL WHERE "img" ILIKE \'%cloudinary%\';',
      'UPDATE "Income" SET "img" = NULL WHERE "img" ILIKE \'%cloudinary%\';',
      'UPDATE "Payment" SET "img" = NULL WHERE "img" ILIKE \'%cloudinary%\';',
      'UPDATE "Notice" SET "pdfUrl" = NULL WHERE "pdfUrl" ILIKE \'%cloudinary%\';',
    ];

    for (let i = 0; i < queries.length; i++) {
      const sql = queries[i];
      try {
        const res = await client.query(sql);
        console.log('Updated ' + res.rowCount + ' rows in ' + sql.split('"')[1]);
      } catch (err) {
        console.error('Error in query: ' + sql + ' - ' + err.message);
      }
    }

    console.log('Database purge complete.');
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.end();
  }
}

main();
