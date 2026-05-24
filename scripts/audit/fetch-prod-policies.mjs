#!/usr/bin/env node
import fs from "node:fs";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const r = await client.query(
  "SELECT schemaname, tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY 1,2,3",
);
await client.end();
fs.mkdirSync(".tmp", { recursive: true });
fs.writeFileSync(
  ".tmp/prod-policies-mcp.json",
  JSON.stringify(
    { generated_at: new Date().toISOString().slice(0, 10), source: "DATABASE_URL prod", policies: r.rows },
    null,
    2,
  ),
);
console.log("saved", r.rows.length);
