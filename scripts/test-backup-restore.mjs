import "dotenv/config";
import { Client } from "pg";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";

const source = new URL(process.env.TEST_DATABASE_URL ?? "");
if (!source.pathname.endsWith("_test")) throw new Error("Use a dedicated TEST_DATABASE_URL ending in _test");
const target = `domkazan_restore_${randomBytes(8).toString("hex")}_test`;
const temporary = mkdtempSync(join(tmpdir(), "domkazan-backup-"));
const archive = join(temporary, "restore-check.dump");
const environment = { ...process.env, PGHOST: source.searchParams.get("host") || source.hostname,
  PGPORT: source.port || "5432", PGUSER: decodeURIComponent(source.username), PGPASSWORD: decodeURIComponent(source.password),
  PGDATABASE: source.pathname.slice(1) };
const maintenanceUrl = new URL(source); maintenanceUrl.pathname = "/postgres";
const maintenance = new Client({ connectionString: maintenanceUrl.href });
let ownTarget = false;
function command(script, args) {
  const result = spawnSync("sh", [resolve(script), ...args], { env: environment, stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(`Backup/restore operation failed: ${script} (no data or credentials logged)`);
}
async function fingerprint(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const hash = createHash("sha256");
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    for (const { tablename } of tables.rows) {
      const quoted = tablename.replaceAll('"', '""');
      const rows = await client.query(`SELECT row_to_json(t)::text AS data FROM "${quoted}" t ORDER BY row_to_json(t)::text`);
      hash.update(tablename); hash.update(JSON.stringify(rows.rows));
    }
    const constraints = await client.query("SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname");
    hash.update(JSON.stringify(constraints.rows));
    return hash.digest("hex");
  } finally { await client.end(); }
}
try {
  await maintenance.connect();
  if ((await maintenance.query("SELECT 1 FROM pg_database WHERE datname=$1", [target])).rowCount) throw new Error("Restore target already exists");
  const expected = await fingerprint(source.href);
  command("ops/backup.sh", [archive]);
  ownTarget = true;
  command("ops/restore.sh", [archive, target]);
  const restoredUrl = new URL(source); restoredUrl.pathname = `/${target}`;
  if (await fingerprint(restoredUrl.href) !== expected) throw new Error("Restored data or constraints differ");
  if (await fingerprint(source.href) !== expected) throw new Error("Source changed during the isolated check");
  console.log("Backup/restore verified: all public tables, migration history and constraints match; source unchanged.");
} finally {
  if (ownTarget) await maintenance.query(`DROP DATABASE IF EXISTS "${target}" WITH (FORCE)`);
  await maintenance.end();
  rmSync(temporary, { recursive: true, force: true });
}
