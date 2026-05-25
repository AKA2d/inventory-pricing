import { PriceInputCell } from "@/components/inventory/price-input-cell";
import { formatNumber } from "@/lib/utils";
import type { InventoryRow } from "@/components/inventory/types";
import type {
  DraftPriceField,
  PriceInputContext,
} from "@/components/inventory/grid-types";

type EditablePriceFieldProps = {
  row: InventoryRow;
  field: DraftPriceField;
  currency: string;
  fallback?: string | number | null;
  input: PriceInputContext;
};

export function EditablePriceField({
  row,
  field,
  currency,
  fallback,
  input,
}: EditablePriceFieldProps) {
  if (!input.canEdit) {
    return <span>{formatDisplayValue(fallback ?? row[field])}</span>;
  }

  return (
    <PriceInputCell
      productId={row.productId}
      field={field}
      currency={currency}
      value={input.drafts[row.productId]?.[field] ?? ""}
      canEdit={input.canEdit}
      saving={input.saving}
      isActive={
        input.activeField?.productId === row.productId &&
        input.activeField.field === field
      }
      onFocusField={input.onFocusField}
      onBlurField={input.onBlurField}
      onChangeField={input.onChangeField}
      onSubmitRow={input.onSubmitRow}
    />
  );
}

function formatDisplayValue(value: string | number | null | undefined) {
  if (typeof value === "number") return formatNumber(value) || "-";
  return value ?? "-";
}
