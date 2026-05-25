import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  DraftPriceField,
  PriceInputHandlers,
} from "@/components/inventory/grid-types";

type PriceInputCellProps = PriceInputHandlers & {
  productId: string;
  field: DraftPriceField;
  currency: string;
  value: string;
  canEdit: boolean;
  saving: boolean;
  isActive: boolean;
};

export function PriceInputCell({
  productId,
  field,
  currency,
  value,
  canEdit,
  saving,
  isActive,
  onFocusField,
  onBlurField,
  onChangeField,
  onSubmitRow,
}: PriceInputCellProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-6 text-xs font-medium uppercase tracking-wide text-slate-400">
        {currency}
      </span>
      <Input
        value={value}
        onChange={(event) => onChangeField(productId, field, event.target.value)}
        onFocus={(event) => {
          onFocusField(productId, field);
          event.target.select();
        }}
        onBlur={() => onBlurField(productId, field)}
        onKeyDown={async (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            await onSubmitRow(productId);
          }
        }}
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={!canEdit || saving}
        data-product-id={productId}
        data-field={field}
        className="h-7 w-full text-right text-sm"
      />
      {canEdit && isActive ? (
        <Button
          type="button"
          variant="secondary"
          className="h-7 px-1"
          disabled={saving}
          onMouseDown={(event) => event.preventDefault()}
          onClick={async () => {
            await onSubmitRow(productId);
          }}
        >
          {saving ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
        </Button>
      ) : null}
    </div>
  );
}
