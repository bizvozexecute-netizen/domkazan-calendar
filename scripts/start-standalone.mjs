import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(".next/standalone");
if (!existsSync(`${root}/server.js`)) throw new Error("Run npm run build first");
cpSync("public", `${root}/public`, { recursive: true });
cpSync(".next/static", `${root}/.next/static`, { recursive: true });
const child = spawn(process.execPath, [`${root}/server.js`], { stdio: "inherit", env: process.env });
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("exit", (code) => { process.exitCode = code ?? 1; });
