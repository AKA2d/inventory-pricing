import { PriceField } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toRow } from "@/lib/products/service";
import type { PriceUpdateInput } from "@/lib/products/dto";
import type { SessionUser } from "@/lib/auth/session";

type RegionalPriceUpdateData = {
  uaePriceAed?: bigint | null;
  uaeUpdatedAt?: Date | null;
  irPriceIrr?: bigint | null;
  irUpdatedAt?: Date | null;
  shippingCost?: bigint | null;
  uaeProfitMargin?: Prisma.Decimal | null;
  irProfitMargin?: Prisma.Decimal | null;
};

type CompetitorPriceUpdateData = {
  lowestPrice?: bigint | null;
  highestPrice?: bigint | null;
};

type CachedProductUpdateData = {
  lastSellingPrice?: bigint | null;
  priceRatio?: Prisma.Decimal | null;
};

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const AED_PRICE_KEY = "aed_price_of_the_day";

export async function updateProductPrices(
  updates: PriceUpdateInput[],
  session: SessionUser,
) {
  const now = new Date();
  const updatedIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      await updateProductPrice(tx, update, session, now);
      updatedIds.push(update.productId);
    }
  });

  const fresh = await prisma.cachedProduct.findMany({
    where: { id: { in: Array.from(new Set(updatedIds)) } },
    include: { price: true, competitorPrice: true },
  });

  return fresh.map(toRow);
}

async function updateProductPrice(
  tx: TransactionClient,
  update: PriceUpdateInput,
  session: SessionUser,
  now: Date,
) {
  await tx.regionalPrice.upsert({
    where: { productId: update.productId },
    create: { productId: update.productId },
    update: {},
  });

  const [current, currentComp] = await Promise.all([
    tx.regionalPrice.findUniqueOrThrow({
      where: { productId: update.productId },
    }),
    tx.competitorsPrice.findUnique({
      where: { productId: update.productId },
    }),
  ]);

  const regionalData = await buildRegionalPriceUpdate(
    tx,
    update,
    current,
    session,
    now,
  );
  const cachedData = await buildCachedProductUpdate(
    tx,
    update,
    current,
    regionalData,
  );
  const competitorData = buildCompetitorPriceUpdate(update, currentComp);

  if (Object.keys(regionalData).length > 0) {
    await tx.regionalPrice.update({
      where: { productId: update.productId },
      data: regionalData,
    });
  }

  if (Object.keys(cachedData).length > 0) {
    await tx.cachedProduct.update({
      where: { id: update.productId },
      data: cachedData,
    });
  }

  if (Object.keys(competitorData).length > 0) {
    await tx.competitorsPrice.upsert({
      where: { productId: update.productId },
      create: { productId: update.productId, ...competitorData },
      update: competitorData,
    });
  }
}

async function buildRegionalPriceUpdate(
  tx: TransactionClient,
  update: PriceUpdateInput,
  current: Awaited<ReturnType<TransactionClient["regionalPrice"]["findUniqueOrThrow"]>>,
  session: SessionUser,
  now: Date,
) {
  const data: RegionalPriceUpdateData = {};
  const nextUaePrice = toBigIntOrNull(update.uaePriceAed);
  const nextIrPrice = toBigIntOrNull(update.irPriceIrr);
  const nextShippingCost = toBigIntOrNull(update.shippingCost);
  const nextUaeProfit = toDecimalOrNull(update.uaeProfitMargin);
  const nextIrProfit = toDecimalOrNull(update.irProfitMargin);

  if ("uaePriceAed" in update && nextUaePrice !== current.uaePriceAed) {
    data.uaePriceAed = nextUaePrice;
    data.uaeUpdatedAt = now;
    await createPriceAudit(tx, {
      productId: update.productId,
      field: PriceField.UAE_PRICE,
      previousValue: current.uaePriceAed,
      newValue: nextUaePrice,
      userId: session.userId,
    });
  }

  if ("irPriceIrr" in update && nextIrPrice !== current.irPriceIrr) {
    data.irPriceIrr = nextIrPrice;
    data.irUpdatedAt = now;
    await createPriceAudit(tx, {
      productId: update.productId,
      field: PriceField.IR_PRICE,
      previousValue: current.irPriceIrr,
      newValue: nextIrPrice,
      userId: session.userId,
    });
  }

  if ("shippingCost" in update && nextShippingCost !== current.shippingCost) {
    data.shippingCost = nextShippingCost;
  }

  if (
    "uaeProfitMargin" in update &&
    !decimalEquals(current.uaeProfitMargin, nextUaeProfit)
  ) {
    data.uaeProfitMargin = nextUaeProfit;
  }

  if (
    "irProfitMargin" in update &&
    !decimalEquals(current.irProfitMargin, nextIrProfit)
  ) {
    data.irProfitMargin = nextIrProfit;
  }

  return data;
}

async function buildCachedProductUpdate(
  tx: TransactionClient,
  update: PriceUpdateInput,
  current: Awaited<ReturnType<TransactionClient["regionalPrice"]["findUniqueOrThrow"]>>,
  regionalData: RegionalPriceUpdateData,
) {
  const data: CachedProductUpdateData = {};
  const lastSellingPrice = calculateLastSellingPrice(
    update,
    current,
    regionalData,
  );
  const priceRatio = await resolvePriceRatio(
    tx,
    update,
    current,
    regionalData,
  );

  if (lastSellingPrice != null) {
    data.lastSellingPrice = lastSellingPrice;
  }

  if (priceRatio !== undefined) {
    data.priceRatio = priceRatio;
  }

  return data;
}

function buildCompetitorPriceUpdate(
  update: PriceUpdateInput,
  currentComp: Awaited<ReturnType<TransactionClient["competitorsPrice"]["findUnique"]>>,
) {
  const data: CompetitorPriceUpdateData = {};
  const nextLowestPrice = toBigIntOrNull(update.lowestPrice);
  const nextHighestPrice = toBigIntOrNull(update.highestPrice);

  if ("lowestPrice" in update && nextLowestPrice !== currentComp?.lowestPrice) {
    data.lowestPrice = nextLowestPrice;
  }

  if (
    "highestPrice" in update &&
    nextHighestPrice !== currentComp?.highestPrice
  ) {
    data.highestPrice = nextHighestPrice;
  }

  return data;
}

function calculateLastSellingPrice(
  update: PriceUpdateInput,
  current: Awaited<ReturnType<TransactionClient["regionalPrice"]["findUniqueOrThrow"]>>,
  regionalData: RegionalPriceUpdateData,
) {
  const effectiveIrPrice = regionalData.irPriceIrr ?? current.irPriceIrr;
  const effectiveIrProfit =
    regionalData.irProfitMargin ?? current.irProfitMargin ?? null;

  if (effectiveIrPrice != null && effectiveIrProfit != null) {
    const priceNumber = Number(effectiveIrPrice);
    const profitNumber = Number(effectiveIrProfit.toString());
    return BigInt(Math.round((priceNumber * profitNumber) / 100 + priceNumber));
  }

  return toBigIntOrNull(update.lastSellingPrice);
}

async function resolvePriceRatio(
  tx: TransactionClient,
  update: PriceUpdateInput,
  current: Awaited<ReturnType<TransactionClient["regionalPrice"]["findUniqueOrThrow"]>>,
  regionalData: RegionalPriceUpdateData,
) {
  if (!("irPriceIrr" in update)) {
    return undefined;
  }

  const effectiveIrPrice = regionalData.irPriceIrr ?? current.irPriceIrr ?? null;
  const currentAedPrice = await readCurrentAedPrice(tx);

  if (currentAedPrice == null || effectiveIrPrice == null) return undefined;
  if (currentAedPrice.eq(0)) return undefined;

  return new Prisma.Decimal(effectiveIrPrice.toString()).div(currentAedPrice);
}

async function readCurrentAedPrice(tx: TransactionClient) {
  const meta = await tx.cacheMetadata.findUnique({
    where: { key: AED_PRICE_KEY },
  });
  const price = readCachedAedPrice(meta?.value);
  return price == null ? null : new Prisma.Decimal(String(price));
}

function readCachedAedPrice(value: unknown) {
  if (!value) return null;

  const parsed =
    typeof value === "string" ? safelyParseJson(value) : (value as { price?: unknown });
  const price = parsed?.price;

  if (typeof price === "number") return price;
  if (typeof price === "string" && !Number.isNaN(Number(price))) {
    return Number(price);
  }

  return null;
}

function safelyParseJson(value: string) {
  try {
    return JSON.parse(value) as { price?: unknown };
  } catch {
    return null;
  }
}

function createPriceAudit(
  tx: TransactionClient,
  input: {
    productId: string;
    field: PriceField;
    previousValue: bigint | null;
    newValue: bigint | null;
    userId: string;
  },
) {
  return tx.priceAuditLog.create({
    data: {
      productId: input.productId,
      changedField: input.field,
      previousValue: input.previousValue,
      newValue: input.newValue,
      changedById: input.userId,
    },
  });
}

function toBigIntOrNull(value: number | null | undefined) {
  return value == null ? null : BigInt(value);
}

function toDecimalOrNull(value: number | null | undefined) {
  return value == null ? null : new Prisma.Decimal(value);
}

function decimalEquals(
  left: Prisma.Decimal | null,
  right: Prisma.Decimal | null,
) {
  if (left == null || right == null) return left === right;
  return left.eq(right);
}
