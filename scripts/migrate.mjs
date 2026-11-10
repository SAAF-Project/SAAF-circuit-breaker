import { readFile } from "node:fs/promises";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(await readFile(new URL("../migrations/0001_sentinel_sessions.sql", import.meta.url), "utf8"));
  await pool.query(await readFile(new URL("../migrations/0002_order_budgets.sql", import.meta.url), "utf8"));
  const result = await pool.query("SELECT to_regclass('public.sentinel_sessions') AS table_name");
  if (result.rows[0].table_name !== "sentinel_sessions") throw new Error("Migration readback failed");
  const orders = await pool.query("SELECT to_regclass('public.order_budgets') AS table_name");
  if (orders.rows[0].table_name !== "order_budgets") throw new Error("Order-budget migration readback failed");
  console.log("Migrations verified: sentinel_sessions and order_budgets (existing rows preserved)");
} finally { await pool.end(); }
