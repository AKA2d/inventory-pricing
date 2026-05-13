import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  ODOO_URL: z.string().url(),
  ODOO_DB: z.string().min(1),
  ODOO_USERNAME: z.string().min(1),
  ODOO_API_KEY: z.string().min(1),
  ODOO_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  ODOO_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  PRODUCT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  PRODUCT_SEARCH_LIMIT: z.coerce.number().int().min(1).max(200).default(75),
  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().min(12).optional(),
});

export const env = envSchema.parse(process.env);
