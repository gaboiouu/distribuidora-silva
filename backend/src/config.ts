import "dotenv/config";
import { z } from "zod";
const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().url().optional(),
);
const schema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(48),
  CORS_ORIGIN: z
    .string()
    .refine(
      (v) =>
        v.split(",").every((u) => z.string().url().safeParse(u.trim()).success),
      "Debe ser una o más URLs válidas separadas por coma",
    ),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  BILLING_PROVIDER: z.enum(["DISABLED", "NUBEFACT"]).default("DISABLED"),
  NUBEFACT_API_URL: optionalUrl.refine(
    (url) =>
      !url ||
      (new URL(url).protocol === "https:" &&
        new URL(url).hostname === "api.nubefact.com"),
    "Usa la ruta HTTPS de api.nubefact.com entregada por NubeFact",
  ),
  NUBEFACT_TOKEN: optionalText,
  SUNAT_FACTURA_SERIE: z
    .string()
    .regex(/^F[A-Z0-9]{3}$/)
    .default("F001"),
  SUNAT_BOLETA_SERIE: z
    .string()
    .regex(/^B[A-Z0-9]{3}$/)
    .default("B001"),
  SUNAT_NC_FACTURA_SERIE: z
    .string()
    .regex(/^F[A-Z0-9]{3}$/)
    .default("FC01"),
  SUNAT_NC_BOLETA_SERIE: z
    .string()
    .regex(/^B[A-Z0-9]{3}$/)
    .default("BC01"),
  SUNAT_GUIA_SERIE: z
    .string()
    .regex(/^T[A-Z0-9]{3}$/)
    .default("T001"),
});
export const config = schema.parse(process.env);
if (config.APP_ENV !== "development" && config.NODE_ENV !== "production") {
  throw new Error(`APP_ENV=${config.APP_ENV} requiere NODE_ENV=production`);
}
if (config.APP_ENV === "production" && config.NODE_ENV !== "production") {
  throw new Error("Producción requiere NODE_ENV=production");
}
