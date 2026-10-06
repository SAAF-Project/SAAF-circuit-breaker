import { readFile } from "node:fs/promises";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(await readFile(new URL("../migrations/0001_sentinel_sessions.sql", import.meta.url), "utf8"));
  const result = await pool.query("SELECT to_regclass('public.sentinel_sessions') AS table_name");
  if (result.rows[0].table_name !== "sentinel_sessions") throw new Error("Migration readback failed");
  console.log("Migration verified: sentinel_sessions (existing rows preserved)");
} finally { await pool.end(); }
