import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "password",
    "apiKey",
    "headers.authorization",
    "ODOO_API_KEY",
    "SESSION_SECRET",
  ],
});
