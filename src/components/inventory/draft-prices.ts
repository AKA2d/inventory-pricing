import type { InventoryRow } from "@/components/inventory/types";
import type { DraftPrice, PriceUpdate } from "@/components/inventory/grid-types";

export const draftFields = [
  "uaePriceAed",
  "irPriceIrr",
  "shippingCost",
  "lowestPrice",
  "highestPrice",
  "uaeProfitMargin",
  "irProfitMargin",
  "lastSellingPrice",
  "priceRatio",
] as const;

export const decimalDraftFields = new Set<keyof DraftPrice>([
  "uaeProfitMargin",
  "irProfitMargin",
  "priceRatio",
]);

export const wholeNumberDraftFields: Array<keyof DraftPrice> = [
  "uaePriceAed",
  "irPriceIrr",
  "shippingCost",
  "lowestPrice",
  "highestPrice",
  "lastSellingPrice",
];

export const emptyDraftPrice: DraftPrice = {
  uaePriceAed: "",
  irPriceIrr: "",
  shippingCost: "",
  lowestPrice: "",
  highestPrice: "",
  uaeProfitMargin: "",
  irProfitMargin: "",
  lastSellingPrice: "",
  priceRatio: "",
};

function draftFromRow(row: InventoryRow): DraftPrice {
  return {
    uaePriceAed: row.uaePriceAed == null ? "" : String(row.uaePriceAed),
    irPriceIrr: row.irPriceIrr == null ? "" : String(row.irPriceIrr),
    shippingCost: row.shippingCost == null ? "" : String(row.shippingCost),
    lowestPrice: row.lowestPrice == null ? "" : String(row.lowestPrice),
    highestPrice: row.highestPrice == null ? "" : String(row.highestPrice),
    uaeProfitMargin:
      row.uaeProfitMargin == null ? "" : String(row.uaeProfitMargin),
    irProfitMargin: row.irProfitMargin == null ? "" : String(row.irProfitMargin),
    lastSellingPrice:
      row.lastSellingPrice == null ? "" : String(row.lastSellingPrice),
    priceRatio: row.priceRatio == null ? "" : String(row.priceRatio),
  };
}

export function initialDraft(rows: InventoryRow[]) {
  return Object.fromEntries(
    rows.map((row) => [row.productId, draftFromRow(row)]),
  ) as Record<string, DraftPrice>;
}

export function getDraftValue(
  drafts: Record<string, DraftPrice>,
  productId: string,
): DraftPrice {
  return drafts[productId] ?? emptyDraftPrice;
}

export function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (char) => String(char.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 1632));
}

export function sanitizeDraftValue(field: keyof DraftPrice, value: string) {
  const allowed = decimalDraftFields.has(field) ? /[^\d.]/g : /[^\d]/g;
  return normalizeDigits(value).replace(allowed, "");
}

export function parseNullableInt(value: string) {
  if (!value.trim()) return null;
  return Number.parseInt(normalizeDigits(value), 10);
}

export function parseNullableNumber(value: string) {
  if (!value.trim()) return null;
  return Number.parseFloat(normalizeDigits(value));
}

export function isValidWholeNumberInput(value: string) {
  const normalized = normalizeDigits(value).trim();
  return normalized === "" || /^\d+$/.test(normalized);
}

export function isValidDecimalInput(value: string) {
  const normalized = normalizeDigits(value).trim();
  return normalized === "" || /^\d+(?:\.\d+)?$/.test(normalized);
}

export function buildPriceUpdates(
  rows: InventoryRow[],
  drafts: Record<string, DraftPrice>,
): PriceUpdate[] {
  return rows.map((row) => {
    const draft = getDraftValue(drafts, row.productId);

    return {
      productId: row.productId,
      uaePriceAed: parseNullableInt(draft.uaePriceAed),
      irPriceIrr: parseNullableInt(draft.irPriceIrr),
      shippingCost: parseNullableInt(draft.shippingCost),
      lowestPrice: parseNullableInt(draft.lowestPrice),
      highestPrice: parseNullableInt(draft.highestPrice),
      uaeProfitMargin: parseNullableNumber(draft.uaeProfitMargin),
      irProfitMargin: parseNullableNumber(draft.irProfitMargin),
      lastSellingPrice: parseNullableInt(draft.lastSellingPrice),
      priceRatio: parseNullableNumber(draft.priceRatio),
    };
  });
}
