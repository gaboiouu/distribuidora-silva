import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(48),
  CORS_ORIGIN: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});
export const config = schema.parse(process.env);
