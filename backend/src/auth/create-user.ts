import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { hash, argon2id } from "argon2";
import { z } from "zod";
const input = z
  .object({
    ADMIN_EMAIL: z.email(),
    ADMIN_NAME: z.string().min(2),
    ADMIN_PASSWORD: z.string().min(14).max(128),
    ADMIN_ROLE: z.enum(["ADMIN", "MEMBER"]).default("ADMIN"),
  })
  .parse(process.env);
const db = new PrismaClient();
async function main() {
  await db.user.create({
    data: {
      email: input.ADMIN_EMAIL.toLowerCase(),
      name: input.ADMIN_NAME,
      passwordHash: await hash(input.ADMIN_PASSWORD, { type: argon2id }),
      role: input.ADMIN_ROLE as Role,
    },
  });
  console.log("Usuario creado. No se modifican usuarios existentes.");
}
main()
  .catch(() => {
    console.error(
      "No se pudo crear el usuario. Comprueba configuración y email único.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
