import type { InventoryRow } from "@/components/inventory/types";
import type { SortDirection, SortField } from "@/components/inventory/grid-types";

export function sortRows(
  rows: InventoryRow[],
  field: SortField,
  direction: SortDirection,
) {
  const sorted = [...rows].sort((left, right) => {
    const leftValue = left[field];
    const rightValue = right[field];

    if (field === "qtyAvailable") {
      return Number(left.qtyAvailable) - Number(right.qtyAvailable);
    }

    if (
      field === "odooId" ||
      field === "uaePriceAed" ||
      field === "irPriceIrr"
    ) {
      return Number(leftValue ?? -1) - Number(rightValue ?? -1);
    }

    if (field === "uaeUpdatedAt" || field === "irUpdatedAt") {
      return (
        new Date(leftValue ?? 0).getTime() - new Date(rightValue ?? 0).getTime()
      );
    }

    return String(leftValue ?? "").localeCompare(
      String(rightValue ?? ""),
      undefined,
      { sensitivity: "base" },
    );
  });

  return direction === "asc" ? sorted : sorted.reverse();
}
