import { createHash } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/config/env";
import { OdooError } from "@/lib/odoo/client";
import { fetchOdooProductsByIds, searchOdooProducts } from "@/lib/odoo/product-service";
import { prisma } from "@/lib/prisma";
import { tokenizeSearch } from "@/lib/search/tokens";
import type { ProductRowDto } from "@/lib/products/dto";

const TTL_MS = env.PRODUCT_CACHE_TTL_SECONDS * 1000;

function bigIntToNumber(value: bigint | null | undefined) {
  return value == null ? null : Number(value);
}

type CachedProductWithPrice = Prisma.CachedProductGetPayload<{ include: { price: true } }>;

function toRow(product: CachedProductWithPrice): ProductRowDto {
  return {
    productId: product.id,
    odooId: product.odooId,
    name: product.name,
    barcode: product.barcode,
    qtyAvailable: product.qtyAvailable.toString(),
    uaePriceAed: bigIntToNumber(product.price?.uaePriceAed),
    uaeUpdatedAt: product.price?.uaeUpdatedAt?.toISOString() ?? null,
    irPriceIrr: bigIntToNumber(product.price?.irPriceIrr),
    irUpdatedAt: product.price?.irUpdatedAt?.toISOString() ?? null,
  };
}

function cacheWhere(tokens: string[]): Prisma.CachedProductWhereInput {
  return {
    AND: tokens.map((token) => ({
      OR: [
        { name: { contains: token, mode: "insensitive" } },
        { barcode: { contains: token, mode: "insensitive" } },
      ],
    })),
  };
}

async function cachedRows(tokens: string[], page: number, pageSize: number) {
  const where = cacheWhere(tokens);
  const [items, total] = await prisma.$transaction([
    prisma.cachedProduct.findMany({
      where,
      include: { price: true },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cachedProduct.count({ where }),
  ]);

  if (items.length > 0) {
    await prisma.cachedProduct.updateMany({
      where: { id: { in: items.map((item) => item.id) } },
      data: { lastAccessedAt: new Date() },
    });
  }

  return { rows: items.map(toRow), total };
}

export async function searchProducts(query: string, page: number, pageSize: number) {
  const tokens = tokenizeSearch(query);
  if (tokens.length === 0) return { rows: [], total: 0, source: "cache" as const };

  try {
    const odooProducts = await searchOdooProducts(tokens, Math.max(page * pageSize, pageSize));
    const staleAt = new Date(Date.now() + TTL_MS);

    await prisma.$transaction(
      odooProducts.map((product) =>
        prisma.cachedProduct.upsert({
          where: { odooId: product.id },
          create: {
            odooId: product.id,
            name: product.name,
            barcode: product.barcode || null,
            qtyAvailable: new Prisma.Decimal(product.qty_available),
            sourceHash: createHash("sha256").update(JSON.stringify(product)).digest("hex"),
            staleAt,
            price: { create: {} },
          },
          update: {
            name: product.name,
            barcode: product.barcode || null,
            qtyAvailable: new Prisma.Decimal(product.qty_available),
            sourceHash: createHash("sha256").update(JSON.stringify(product)).digest("hex"),
            lastFetchedAt: new Date(),
            lastAccessedAt: new Date(),
            staleAt,
          },
        }),
      ),
    );

    return { ...(await cachedRows(tokens, page, pageSize)), source: "odoo" as const };
  } catch (error) {
    if (!(error instanceof OdooError)) throw error;
    return { ...(await cachedRows(tokens, page, pageSize)), source: "cache" as const, warning: "Odoo unavailable; showing cached matches." };
  }
}

export async function refreshStaleProducts(limit = 50) {
  const stale = await prisma.cachedProduct.findMany({
    where: { staleAt: { lte: new Date() } },
    take: limit,
    orderBy: { lastAccessedAt: "desc" },
  });

  if (stale.length === 0) return 0;

  try {
    const fresh = await fetchOdooProductsByIds(stale.map((product) => product.odooId));
    const staleAt = new Date(Date.now() + TTL_MS);

    await prisma.$transaction(
      fresh.map((product) =>
        prisma.cachedProduct.update({
          where: { odooId: product.id },
          data: {
            name: product.name,
            barcode: product.barcode || null,
            qtyAvailable: new Prisma.Decimal(product.qty_available),
            sourceHash: createHash("sha256").update(JSON.stringify(product)).digest("hex"),
            lastFetchedAt: new Date(),
            lastAccessedAt: new Date(),
            staleAt,
          },
        }),
      ),
    );
  } catch (error) {
    if (!(error instanceof OdooError)) throw error;
  }

  return stale.length;
}
