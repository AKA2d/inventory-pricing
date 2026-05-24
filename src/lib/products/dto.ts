import { z } from "zod";

export const productSearchSchema = z.object({
  q: z.string().trim().min(1).max(120),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});

export const priceUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        productId: z.string().min(1),
        uaePriceAed: z
          .number()
          .int()
          .nonnegative()
          .max(999_999_999_999)
          .nullable()
          .optional(),
        irPriceIrr: z
          .number()
          .int()
          .nonnegative()
          .max(999_999_999_999)
          .nullable()
          .optional(),
        shippingCost: z
          .number()
          .int()
          .nonnegative()
          .max(999_999_999_999)
          .nullable()
          .optional(),
        lowestPrice: z
          .number()
          .int()
          .nonnegative()
          .max(999_999_999_999)
          .nullable()
          .optional(),
        highestPrice: z
          .number()
          .int()
          .nonnegative()
          .max(999_999_999_999)
          .nullable()
          .optional(),
        uaeProfitMargin: z.number().nonnegative().nullable().optional(),
        irProfitMargin: z.number().nonnegative().nullable().optional(),
        lastSellingPrice: z
          .number()
          .int()
          .nonnegative()
          .max(999_999_999_999)
          .nullable()
          .optional(),
        priceRatio: z.number().nonnegative().nullable().optional(),
      }),
    )
    .min(1)
    .max(100),
});

export type ProductRowDto = {
  productId: string;
  odooId: number;
  name: string;
  barcode: string | null;
  qtyAvailable: string;
  uaePriceAed: number | null;
  uaeUpdatedAt: string | null;
  irPriceIrr: number | null;
  irUpdatedAt: string | null;
  shippingCost: number | null;
  lowestPrice: number | null;
  highestPrice: number | null;
  uaeProfitMargin: number | null;
  irProfitMargin: number | null;
  lastSellingPrice: number | null;
  priceRatio?: number | null;
};
