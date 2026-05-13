import { env } from "@/lib/config/env";
import { odooClient } from "@/lib/odoo/client";
import type { OdooProduct } from "@/lib/odoo/types";

function productDomain(tokens: string[]) {
  if (tokens.length === 1) {
    return ["|", ["name", "ilike", tokens[0]], ["barcode", "ilike", tokens[0]]];
  }

  return tokens.reduce<unknown[]>((domain, token, index) => {
    const tokenClause = ["|", ["name", "ilike", token], ["barcode", "ilike", token]];
    if (index === 0) return tokenClause;
    return ["&", ...domain, ...tokenClause];
  }, []);
}

export async function searchOdooProducts(tokens: string[], limit = env.PRODUCT_SEARCH_LIMIT) {
  if (tokens.length === 0) return [];

  return odooClient.executeKw<OdooProduct[]>(
    "product.product",
    "search_read",
    [productDomain(tokens)],
    {
      fields: ["id", "name", "barcode", "qty_available"],
      limit,
      order: "name asc",
    },
  );
}

export async function fetchOdooProductsByIds(ids: number[]) {
  if (ids.length === 0) return [];

  return odooClient.executeKw<OdooProduct[]>(
    "product.product",
    "search_read",
    [[["id", "in", ids]]],
    {
      fields: ["id", "name", "barcode", "qty_available"],
      limit: ids.length,
    },
  );
}
