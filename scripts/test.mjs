import { build } from "esbuild";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
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
  const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit", env: { ...process.env, NODE_PATH: join(process.cwd(), "node_modules") } });
  process.exitCode = result.status ?? 1;
} finally { await rm(directory, { recursive: true, force: true }); }
