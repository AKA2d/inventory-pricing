import { env } from "@/lib/config/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { OdooJsonRpcError } from "@/lib/odoo/types";

type JsonRpcResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: OdooJsonRpcError;
};

let cachedUid: number | null = null;

export class OdooError extends AppError {
  constructor(message: string, code = "ODOO_ERROR", details?: unknown) {
    super(message, 502, code, details);
  }
}

export class OdooClient {
  private requestId = 1;

  async executeKw<T>(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
  ) {
    const uid = await this.authenticate();
    return this.withRetry(() =>
      this.rpc<T>(
        "object",
        "execute_kw",
        [env.ODOO_DB, uid, env.ODOO_API_KEY, model, method, args, kwargs],
        model,
      ),
    );
  }

  private async authenticate() {
    if (cachedUid) return cachedUid;

    const uid = await this.withRetry(() =>
      this.rpc<number | false>("common", "authenticate", [
        env.ODOO_DB,
        env.ODOO_USERNAME,
        env.ODOO_API_KEY,
        {},
      ]),
    );

    if (!uid) {
      throw new OdooError("Odoo authentication failed.", "ODOO_AUTH_FAILED");
    }

    cachedUid = uid;
    return uid;
  }

  private async withRetry<T>(fn: () => Promise<T>) {
    let lastError: unknown;

    for (let attempt = 0; attempt <= env.ODOO_MAX_RETRIES; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === env.ODOO_MAX_RETRIES) break;
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }

    throw lastError;
  }

  private async rpc<T>(
    service: string,
    method: string,
    args: unknown[],
    model?: string,
  ) {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.ODOO_TIMEOUT_MS);

    try {
      const response = await fetch(
        `${env.ODOO_URL.replace(/\/$/, "")}/jsonrpc`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: { service, method, args },
            id: this.requestId++,
          }),
          signal: controller.signal,
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new OdooError(
          `Odoo HTTP ${response.status}.`,
          "ODOO_HTTP_ERROR",
          { status: response.status },
        );
      }

      const body = (await response.json()) as JsonRpcResponse<T>;
      if (body.error) {
        if (body.error.data?.name?.includes("AccessDenied")) cachedUid = null;
        throw new OdooError(body.error.message, "ODOO_RPC_ERROR", body.error);
      }

      await this.logRequest(method, model, started, "ok");
      logger.info(
        { method, model, durationMs: Date.now() - started },
        "odoo request completed",
      );
      return body.result as T;
    } catch (error) {
      const code =
        error instanceof OdooError ? error.code : "ODOO_NETWORK_ERROR";
      await this.logRequest(method, model, started, "error", code);
      logger.error(
        { error, method, model, durationMs: Date.now() - started },
        "odoo request failed",
      );
      if (error instanceof OdooError) throw error;
      throw new OdooError("Odoo is unavailable.", code, error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async logRequest(
    method: string,
    model: string | undefined,
    started: number,
    status: string,
    errorCode?: string,
  ) {
    try {
      await prisma.odooRequestLog.create({
        data: {
          method,
          model,
          durationMs: Date.now() - started,
          status,
          errorCode,
        },
      });
    } catch (error) {
      logger.warn({ error }, "failed to persist odoo request log");
    }
  }
}

export const odooClient = new OdooClient();
