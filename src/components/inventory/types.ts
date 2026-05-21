export type InventoryRow = {
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

export type SearchResponse = {
  rows: InventoryRow[];
  total: number;
  source: "odoo" | "cache";
  warning?: string;
};
