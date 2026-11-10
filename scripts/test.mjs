import { build } from "esbuild";
import { mkdtemp, readdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { spawnSync } from "node:child_process";

const base = process.env.TMPDIR || process.cwd();
const directory = await mkdtemp(join(base, "saaf-tests-"));
try {
  const names = (await readdir("tests")).filter((name) => name.endsWith(".test.ts")).sort();
  if (!names.length) throw new Error("No tests discovered");
  const files = [];
  for (const name of names) {
    const file = join(directory, name.replace(/\.ts$/, ".cjs"));
    await build({ entryPoints: [join("tests", name)], outfile: file, bundle: true, platform: "node", format: "cjs", packages: "external" });
    files.push(file);
  }
  const run = (entries, databaseUrl) => spawnSync(process.execPath, ["--test", ...entries], {
    stdio: "inherit", env: { ...process.env, ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}), NODE_PATH: join(process.cwd(), "node_modules") },
  }).status ?? 1;
  if (!process.env.DATABASE_URL) {
    process.exitCode = run(files);
  } else {
    // Every test file gets a NEW disposable database. Never seed/reset the supplied database.
    // Test role must have CREATEDB; CI uses an ephemeral PostgreSQL service.
    const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await admin.connect();
    try {
      const source = await readFile("src/db/index.ts", "utf8");
      const ddl = /const BOOTSTRAP_DDL = `([\s\S]*?)`;/m.exec(source)?.[1];
      if (!ddl || ddl.includes("${")) throw new Error("Cannot extract static test bootstrap DDL");
      let failures = 0;
      for (const file of files) {
        const name = `saaf_test_${randomUUID().replaceAll("-", "")}`;
        const url = new URL(process.env.DATABASE_URL);
        url.pathname = `/${name}`;
        await admin.query(`CREATE DATABASE "${name}"`);
        try {
          const setup = new pg.Client({ connectionString: url.toString() });
          await setup.connect();
          try { await setup.query(ddl); } finally { await setup.end(); }
          failures += run([file], url.toString()) ? 1 : 0;
        } finally { await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); }
      }
      process.exitCode = failures ? 1 : 0;
    } finally { await admin.end(); }
  }
} finally { await rm(directory, { recursive: true, force: true }); }
