import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const example = new URL("../.env.example", import.meta.url);
const destination = new URL("../.env", import.meta.url);
const template = await readFile(example, "utf8");
const configuration = template.replace(
  "REPLACE_WITH_AT_LEAST_48_RANDOM_CHARACTERS",
  randomBytes(48).toString("hex"),
);

try {
  await writeFile(destination, configuration, { flag: "wx", mode: 0o600 });
  console.log("Creado backend/.env con una clave JWT aleatoria. Configura DATABASE_URL y DIRECT_URL con tu base PostgreSQL.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("backend/.env ya existe. Se conserva su configuración.");
}
