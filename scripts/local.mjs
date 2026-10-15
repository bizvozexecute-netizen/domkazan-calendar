import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.error) { console.error("Could not start local tooling. Check Docker Desktop/Compose."); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
run(process.execPath, ["scripts/setup-local.mjs"]);
const args = ["compose", "--env-file", ".env.local-test"];
const action = process.argv[2] ?? "up";
if (action === "up") {
  run("docker", [...args, "up", "--build", "-d", "--wait", "--wait-timeout", "180"]);
  run("docker", [...args, "run", "--rm", "seed"]);
  console.log("Local test environment: https://localhost:8443/admin and /test-catalog (self-signed local certificate).");
} else if (action === "down") run("docker", [...args, "down"]);
else if (action === "backup") run("docker", [...args, "run", "--rm", "backup"]);
else { console.error("Use up, down, or backup."); process.exit(1); }
