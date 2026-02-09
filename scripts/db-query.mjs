import pg from "pg";

const sql = process.argv.slice(2).join(" ").trim();
if (!sql) {
  console.error('Usage: SUPABASE_DB_URL="postgresql://..." node scripts/db-query.mjs "select 1"');
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Missing SUPABASE_DB_URL");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  // Supabase uses managed TLS; local dev environments sometimes fail CA validation.
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const res = await client.query(sql);
  console.log(JSON.stringify({ rowCount: res.rowCount, rows: res.rows }, null, 2));
} finally {
  await client.end();
}

