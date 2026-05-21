import { PriceField } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";
import { priceUpdateSchema } from "@/lib/products/dto";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Login required." } },
        { status: 401 },
      );
    }

    if (session.role !== "ADMIN") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Admin role required." } },
        { status: 403 },
      );
    }

    const body = priceUpdateSchema.parse(await request.json());
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      for (const update of body.updates) {
        // ensure regional price row exists and load current values
        await tx.regionalPrice.upsert({
          where: { productId: update.productId },
          create: { productId: update.productId },
          update: {},
        });
        const current = await tx.regionalPrice.findUnique({
          where: { productId: update.productId },
        });
        const currentComp = await tx.competitorsPrice.findUnique({
          where: { productId: update.productId },
        });

        const data: {
          uaePriceAed?: bigint | null;
          uaeUpdatedAt?: Date | null;
          irPriceIrr?: bigint | null;
          irUpdatedAt?: Date | null;
          shippingCost?: number | null;
          uaeProfitMargin?: Prisma.Decimal | null;
          irProfitMargin?: Prisma.Decimal | null;
          lastSellingPrice?: number | null;
        } = {};

        const compData: {
          lowestPrice?: bigint | null;
          highestPrice?: bigint | null;
        } = {};

        const nextLastSellingPrice =
          update.lastSellingPrice == null
            ? null
            : Number(update.lastSellingPrice);

        const nextUaePrice =
          update.uaePriceAed == null ? null : BigInt(update.uaePriceAed);
        const nextIrPrice =
          update.irPriceIrr == null ? null : BigInt(update.irPriceIrr);
        const nextShippingCost =
          update.shippingCost == null ? null : Number(update.shippingCost);
        const nextLowestPrice =
          update.lowestPrice == null ? null : BigInt(update.lowestPrice);
        const nextHighestPrice =
          update.highestPrice == null ? null : BigInt(update.highestPrice);
        const nextUaeProfit =
          update.uaeProfitMargin == null
            ? null
            : new Prisma.Decimal(update.uaeProfitMargin);
        const nextIrProfit =
          update.irProfitMargin == null
            ? null
            : new Prisma.Decimal(update.irProfitMargin);

        if ("uaePriceAed" in update && nextUaePrice !== current!.uaePriceAed) {
          data.uaePriceAed = nextUaePrice;
          data.uaeUpdatedAt = now;
          await tx.priceAuditLog.create({
            data: {
              productId: update.productId,
              changedField: PriceField.UAE_PRICE,
              previousValue: current!.uaePriceAed,
              newValue: data.uaePriceAed,
              changedById: session.userId,
            },
          });
        }

        if ("irPriceIrr" in update && nextIrPrice !== current!.irPriceIrr) {
          data.irPriceIrr = nextIrPrice;
          data.irUpdatedAt = now;
          await tx.priceAuditLog.create({
            data: {
              productId: update.productId,
              changedField: PriceField.IR_PRICE,
              previousValue: current!.irPriceIrr,
              newValue: data.irPriceIrr,
              changedById: session.userId,
            },
          });
        }

        // shipping cost
        if (
          "shippingCost" in update &&
          nextShippingCost !== current!.shippingCost
        ) {
          data.shippingCost = nextShippingCost;
        }

        // profit margins
        if (
          "uaeProfitMargin" in update &&
          (current!.uaeProfitMargin == null
            ? null
            : Number(current!.uaeProfitMargin.toString())) !==
            nextUaeProfit?.toNumber?.()
        ) {
          data.uaeProfitMargin = nextUaeProfit;
        }

        if (
          "irProfitMargin" in update &&
          (current!.irProfitMargin == null
            ? null
            : Number(current!.irProfitMargin.toString())) !==
            nextIrProfit?.toNumber?.()
        ) {
          data.irProfitMargin = nextIrProfit;
        }

        // update regional price fields
        if (Object.keys(data).length > 0) {
          await tx.regionalPrice.update({
            where: { productId: update.productId },
            data,
          });
        }

        // compute lastSellingPrice automatically if both IR price and IR profit margin are provided
        let computedLastSelling: number | null = null;
        const effectiveIrPrice = data.irPriceIrr ?? current!.irPriceIrr;
        const effectiveIrProfit =
          data.irProfitMargin ?? current!.irProfitMargin ?? null;
        if (effectiveIrPrice != null && effectiveIrProfit != null) {
          // effectiveIrPrice is bigint | null; convert to number and multiply by decimal
          const priceNumber = Number(effectiveIrPrice as bigint);
          const profitNumber = Number(effectiveIrProfit.toString());
          computedLastSelling = Math.round(priceNumber * profitNumber);
        }

        // lastSellingPrice precedence: explicit update.lastSellingPrice > computed > null
        const finalLastSelling = nextLastSellingPrice ?? computedLastSelling;
        if (finalLastSelling != null) {
          await tx.cachedProduct.update({
            where: { id: update.productId },
            data: { lastSellingPrice: finalLastSelling },
          });
        }
        // compute priceRatio when IR price is submitted or available and UAE price is available
        // priceRatio = irPriceIrr / uaePriceAed
        let computedPriceRatio: Prisma.Decimal | null = null;
        const effectiveUaePrice = data.uaePriceAed ?? current!.uaePriceAed;
        const effectiveIrPriceForRatio =
          data.irPriceIrr ?? current!.irPriceIrr ?? null;
        if (effectiveUaePrice != null && effectiveIrPriceForRatio != null) {
          const uae = new Prisma.Decimal(String(Number(effectiveUaePrice)));
          const irr = new Prisma.Decimal(
            String(Number(effectiveIrPriceForRatio)),
          );
          // avoid division by zero
          if (!uae.eq(0)) {
            computedPriceRatio = irr.div(uae);
          }
        }
        if (computedPriceRatio != null) {
          await tx.cachedProduct.update({
            where: { id: update.productId },
            data: { priceRatio: computedPriceRatio },
          });
        }
        // update competitors price if provided
        // competitors lowest/highest
        if (
          "lowestPrice" in update &&
          nextLowestPrice !== currentComp?.lowestPrice
        ) {
          compData.lowestPrice = nextLowestPrice;
        }
        if (
          "highestPrice" in update &&
          nextHighestPrice !== currentComp?.highestPrice
        ) {
          compData.highestPrice = nextHighestPrice;
        }

        if (Object.keys(compData).length > 0) {
          await tx.competitorsPrice.upsert({
            where: { productId: update.productId },
            create: { productId: update.productId, ...compData },
            update: compData,
          });
        }
      }
    });

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
