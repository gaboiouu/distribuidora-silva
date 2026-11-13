import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const [target, action] = process.argv.slice(2);
if (!["development", "staging", "production"].includes(target) || !["start", "migrate"].includes(action)) {
  throw new Error("Uso: node scripts/run-env.mjs <development|staging|production> <start|migrate>");
}

const envFile = resolve(root, `.env.${target}`);
if (!existsSync(envFile)) throw new Error(`Falta ${envFile}. Crea el archivo desde el ejemplo del entorno.`);
const values = dotenv.parse(readFileSync(envFile));
if (values.APP_ENV !== target) throw new Error(`APP_ENV del archivo debe ser ${target}`);
if (values.NODE_ENV !== (target === "development" ? "development" : "production")) {
  throw new Error(`NODE_ENV incorrecto para ${target}`);
}
for (const key of ["DATABASE_URL", "DIRECT_URL", "JWT_SECRET", "CORS_ORIGIN"]) {
  if (!values[key] || values[key].includes("REPLACE_") || values[key].includes("ep-xxxx")) {
    throw new Error(`Configura ${key} en ${envFile}`);
  }
}
const dbIdentity = (url) => {
  const parsed = new URL(url);
  return `${parsed.hostname.replace("-pooler.", ".")}${parsed.pathname}`;
};
if (dbIdentity(values.DATABASE_URL) !== dbIdentity(values.DIRECT_URL)) {
  throw new Error("DATABASE_URL y DIRECT_URL deben apuntar a la misma rama de Neon");
}
for (const other of ["development", "staging", "production"].filter((name) => name !== target)) {
  const path = resolve(root, `.env.${other}`);
  if (!existsSync(path)) continue;
  const otherValues = dotenv.parse(readFileSync(path));
  if (otherValues.DIRECT_URL && dbIdentity(otherValues.DIRECT_URL) === dbIdentity(values.DIRECT_URL)) {
    throw new Error(`${target} y ${other} apuntan a la misma rama de base de datos`);
  }
}
const command = action === "migrate" ? ["prisma", "migrate", "deploy"] : ["node", "dist/main.js"];
const executable = command[0] === "prisma" ? resolve(root, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma") : command[0];
const args = command.slice(1);
console.log(`Entorno ${target}: ${action}`);
const child = spawn(executable, args, { cwd: root, env: { ...process.env, ...values }, stdio: "inherit", shell: process.platform === "win32" && command[0] === "prisma" });
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
