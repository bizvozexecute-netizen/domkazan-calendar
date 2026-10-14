import { randomBytes, scryptSync } from "node:crypto";

if (!process.stdin.isTTY) {
  console.error("Run this script in an interactive terminal.");
  process.exit(1);
}

process.stdout.write("New admin password: ");
let password = "";
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (key) => {
  if (key === "\u0003") process.exit(130);
  if (key === "\r" || key === "\n") {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write("\n");
    if (password.length < 12) {
      console.error("Use at least 12 characters.");
      process.exitCode = 1;
      return;
    }
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    console.log(`ADMIN_PASSWORD_HASH="scrypt:${salt}:${hash}"`);
    password = "";
    return;
  }
  if (key === "\u007f") password = password.slice(0, -1);
  else password += key;
});
