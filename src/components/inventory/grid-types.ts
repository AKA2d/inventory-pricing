import type { InventoryRow } from "@/components/inventory/types";

export type DraftPrice = {
  uaePriceAed: string;
  irPriceIrr: string;
  shippingCost: string;
  lowestPrice: string;
  highestPrice: string;
  uaeProfitMargin: string;
  irProfitMargin: string;
  lastSellingPrice: string;
  priceRatio: string;
};

export type DraftPriceField = keyof DraftPrice;

export type SortField =
  | "odooId"
  | "name"
  | "barcode"
  | "qtyAvailable"
  | "uaePriceAed"
  | "uaeUpdatedAt"
  | "irPriceIrr"
  | "irUpdatedAt";

export type SortDirection = "asc" | "desc";

export type PriceUpdate = {
  productId: string;
  uaePriceAed?: number | null;
  irPriceIrr?: number | null;
  shippingCost?: number | null;
  lowestPrice?: number | null;
  highestPrice?: number | null;
  uaeProfitMargin?: number | null;
  irProfitMargin?: number | null;
  lastSellingPrice?: number | null;
  priceRatio?: number | null;
};

export type PriceInputHandlers = {
  onFocusField: (productId: string, field: DraftPriceField) => void;
  onBlurField: (productId: string, field: DraftPriceField) => void;
  onChangeField: (
    productId: string,
    field: DraftPriceField,
    value: string,
  ) => void;
  onSubmitRow: (productId: string) => Promise<void>;
};

export type PriceInputContext = PriceInputHandlers & {
  canEdit: boolean;
  saving: boolean;
  drafts: Record<string, DraftPrice>;
  activeField: { productId: string; field: DraftPriceField } | null;
};

export type InventoryGridProps = {
  rows: InventoryRow[];
  canEdit: boolean;
  saving: boolean;
  onSave: (updates: PriceUpdate[]) => Promise<void>;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
};
