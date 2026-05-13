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
        uaePriceAed: z.number().int().nonnegative().nullable().optional(),
        irPriceIrr: z.number().int().nonnegative().nullable().optional(),
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
};
