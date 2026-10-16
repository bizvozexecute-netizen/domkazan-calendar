import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const result = spawnSync("docker", ["compose", "--profile", "tools", "--profile", "worker",
  "--env-file", ".env.vpn-test", "-f", "compose.vpn-test.yaml",
  "config", "--format", "json"], { cwd: root, encoding: "utf8", maxBuffer: 2_000_000 });
if (result.status !== 0) throw new Error(`Compose validation failed: ${result.stderr.trim()}`);
const config = JSON.parse(result.stdout);
assert.equal(config.name, "domkazan-vpn-test");
assert.deepEqual(Object.keys(config.services).sort(),
  ["app", "backup", "migrate", "postgres", "proxy", "seed", "telegram-worker", "tls-init"].sort());
for (const [name, service] of Object.entries(config.services)) {
  assert.equal(service.build, undefined, `${name} must use a prebuilt image`);
  assert.ok(service.mem_limit > 0 && service.pids_limit > 0, `${name} needs memory and PID limits`);
  assert.ok(service.cpus > 0, `${name} needs a CPU quota`);
  assert.ok(!JSON.stringify(service).includes("/var/run/docker.sock"), "No Docker socket mount");
  if (name !== "proxy") assert.ok(!service.ports?.length, `${name} cannot publish ports`);
}
assert.deepEqual(config.services.proxy.ports.map((p) => [p.host_ip, String(p.published), p.target]),
  [["127.0.0.1", "9443", 443]]);
for (const name of ["app", "migrate", "seed", "telegram-worker", "tls-init"]) {
  assert.match(config.services[name].image, /^ghcr\.io\/bizvozexecute-netizen\/domkazan-calendar-(app|tools|tls)@sha256:[0-9a-f]{64}$/);
}
assert.equal(config.services.app.environment.TELEGRAM_BOT_TOKEN, "");
assert.equal(config.services.app.environment.TELEGRAM_CHAT_ID, "");
assert.equal(config.services.app.environment.APP_ORIGIN, "https://localhost:9443");
assert.equal(config.services.app.environment.TILDA_ORIGIN, "https://example.invalid");
assert.ok("database" in config.services.postgres.networks);
assert.equal(config.networks.database.internal, true);
assert.equal(config.networks.web.name, "domkazan-vpn-test_web");
assert.ok(config.volumes.postgres_data.name === "domkazan-vpn-test-postgres");
console.log("OK: isolated project, immutable images, resource limits, loopback-only proxy, no real Telegram.");
