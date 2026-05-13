import { PriceField } from "@/generated/prisma/enums";
import { getSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";
import { priceUpdateSchema } from "@/lib/products/dto";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Login required." } }, { status: 401 });
    }

    if (session.role !== "ADMIN") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Admin role required." } }, { status: 403 });
    }

    const body = priceUpdateSchema.parse(await request.json());
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      for (const update of body.updates) {
        const current = await tx.regionalPrice.upsert({
          where: { productId: update.productId },
          create: { productId: update.productId },
          update: {},
        });

        const data: {
          uaePriceAed?: bigint | null;
          uaeUpdatedAt?: Date | null;
          irPriceIrr?: bigint | null;
          irUpdatedAt?: Date | null;
        } = {};

        const nextUaePrice = update.uaePriceAed == null ? null : BigInt(update.uaePriceAed);
        const nextIrPrice = update.irPriceIrr == null ? null : BigInt(update.irPriceIrr);

        if ("uaePriceAed" in update && nextUaePrice !== current.uaePriceAed) {
          data.uaePriceAed = nextUaePrice;
          data.uaeUpdatedAt = now;
          await tx.priceAuditLog.create({
            data: {
              productId: update.productId,
              changedField: PriceField.UAE_PRICE,
              previousValue: current.uaePriceAed,
              newValue: data.uaePriceAed,
              changedById: session.userId,
            },
          });
        }

        if ("irPriceIrr" in update && nextIrPrice !== current.irPriceIrr) {
          data.irPriceIrr = nextIrPrice;
          data.irUpdatedAt = now;
          await tx.priceAuditLog.create({
            data: {
              productId: update.productId,
              changedField: PriceField.IR_PRICE,
              previousValue: current.irPriceIrr,
              newValue: data.irPriceIrr,
              changedById: session.userId,
            },
          });
        }

        if (Object.keys(data).length > 0) {
          await tx.regionalPrice.update({
            where: { productId: update.productId },
            data,
          });
        }
      }
    });

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
