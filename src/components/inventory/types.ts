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
};

export type SearchResponse = {
  rows: InventoryRow[];
  total: number;
  source: "odoo" | "cache";
  warning?: string;
};
