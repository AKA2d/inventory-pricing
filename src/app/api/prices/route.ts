import { PriceField } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";
import { priceUpdateSchema } from "@/lib/products/dto";
import { prisma } from "@/lib/prisma";
import { toRow } from "@/lib/products/service";

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

    const updatedIds: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (const update of body.updates) {
        // ensure regional price row exists
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

        // audit & update uae price
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

        // audit & update ir price
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

        // fetch current cached product to inspect existing lastSellingPrice/priceRatio
        const currentCached = await tx.cachedProduct.findUnique({
          where: { id: update.productId },
        });

        // compute lastSellingPrice automatically if both IR price and IR profit margin are provided
        let computedLastSelling: number | null = null;
        const effectiveIrPrice = data.irPriceIrr ?? current!.irPriceIrr;
        const effectiveIrProfit =
          data.irProfitMargin ?? current!.irProfitMargin ?? null;
        if (effectiveIrPrice != null && effectiveIrProfit != null) {
          // effectiveIrPrice is bigint | null; convert to number and multiply by decimal
          const priceNumber = Number(effectiveIrPrice as bigint);
          const profitNumber = Number(effectiveIrProfit.toString());
          computedLastSelling = Math.round(
            (priceNumber * profitNumber) / 100 + priceNumber,
          );
        }

        // lastSellingPrice precedence: explicit update.lastSellingPrice > computed > null
        const finalLastSelling = nextLastSellingPrice ?? computedLastSelling;

        // cachedProduct updates (we batch lastSellingPrice and priceRatio into a single update)
        const cachedData: {
          lastSellingPrice?: number | null;
          priceRatio?: Prisma.Decimal | null;
        } = {};

        if (finalLastSelling != null)
          cachedData.lastSellingPrice = finalLastSelling;

        // priceRatio handling
        const nextPriceRatioFromPayload =
          update.priceRatio == null
            ? null
            : new Prisma.Decimal(update.priceRatio);

        console.log(update);
        if (update.priceRatio != null) {
          // explicit payload controls ratio (allow clearing by sending null)
          cachedData.priceRatio = nextPriceRatioFromPayload;
          console.log("from payload");
        } else if (
          "irPriceIrr" in update &&
          (currentCached?.priceRatio === null ||
            currentCached?.priceRatio === undefined)
        ) {
          console.log("computing price ratio");
          // only compute on first IR price submission when no ratio exists yet
          let computedPriceRatio: Prisma.Decimal | null = null;
          const effectiveUaePrice = data.uaePriceAed ?? current!.uaePriceAed;
          const effectiveIrPriceForRatio =
            data.irPriceIrr ?? current!.irPriceIrr ?? null;
          let uaeSource: string | null = null;
          let uaeValue: bigint | number | null = effectiveUaePrice ?? null;
          if (uaeValue == null) {
            // try global AED price from cache metadata
            const meta = await tx.cacheMetadata.findUnique({
              where: { key: "aed_price_of_the_day" },
            });
            if (meta?.value) {
              try {
                const parsed = JSON.parse(meta.value as unknown as string);
                if (parsed) {
                  if (typeof parsed.price === "number") {
                    uaeValue = parsed.price;
                    uaeSource = "global";
                  } else if (
                    typeof parsed.price === "string" &&
                    !Number.isNaN(Number(parsed.price))
                  ) {
                    uaeValue = Number(parsed.price);
                    uaeSource = "global";
                  }
                }
              } catch (e) {
                // ignore parse errors
              }
            }
          }

          if (uaeValue != null && effectiveIrPriceForRatio != null) {
            const uae = new Prisma.Decimal(
              typeof uaeValue === "bigint"
                ? uaeValue.toString()
                : String(uaeValue),
            );
            const irr = new Prisma.Decimal(
              typeof effectiveIrPriceForRatio === "bigint"
                ? effectiveIrPriceForRatio.toString()
                : String(effectiveIrPriceForRatio),
            );
            if (!uae.eq(0)) computedPriceRatio = irr.div(uae);
          }

          if (computedPriceRatio != null)
            cachedData.priceRatio = computedPriceRatio;
        }

        if (Object.keys(cachedData).length > 0) {
          await tx.cachedProduct.update({
            where: { id: update.productId },
            data: cachedData,
          });
        }

        // update competitors price if provided
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
        updatedIds.push(update.productId);
      }
    });

    // load fresh rows for updated products and return them to client
    const fresh = await prisma.cachedProduct.findMany({
      where: { id: { in: Array.from(new Set(updatedIds)) } },
      include: { price: true, competitorPrice: true },
    });

    const dtoRows = fresh.map((p) => toRow(p as any));
    return Response.json({ ok: true, rows: dtoRows });
  } catch (error) {
    return errorResponse(error);
  }
}
