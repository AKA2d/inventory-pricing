import { EditablePriceField } from "@/components/inventory/editable-price-field";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { InventoryRow } from "@/components/inventory/types";
import type { PriceInputContext } from "@/components/inventory/grid-types";

type InventoryMobileListProps = {
  rows: InventoryRow[];
  input: PriceInputContext;
};

const mobileEditableFields = [
  { field: "uaePriceAed", label: "UAE price", currency: "AED" },
  { field: "irPriceIrr", label: "IR price", currency: "IRR" },
  { field: "shippingCost", label: "Shipping", currency: "SHP" },
  { field: "lowestPrice", label: "Comp lowest", currency: "CMP" },
  { field: "highestPrice", label: "Comp highest", currency: "CMP" },
  { field: "lastSellingPrice", label: "Last sell", currency: "IRR" },
  { field: "uaeProfitMargin", label: "UAE margin", currency: "%" },
  { field: "irProfitMargin", label: "IR margin", currency: "%" },
  { field: "priceRatio", label: "Price ratio", currency: "" },
] as const;

const viewerHiddenFields = new Set([
  "uaePriceAed",
  "shippingCost",
  "uaeProfitMargin",
  "irProfitMargin",
]);

export function InventoryMobileList({ rows, input }: InventoryMobileListProps) {
  const visibleFields = input.canEdit
    ? mobileEditableFields
    : mobileEditableFields.filter(({ field }) => !viewerHiddenFields.has(field));

  return (
    <div className="grid gap-3 lg:hidden">
      {rows.map((row, index) => (
        <article
          key={row.productId}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Row {index + 1}
              </p>
              <h3 className="font-medium text-slate-950 dark:text-slate-100">
                {row.name}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Odoo #{row.odooId}
              </p>
            </div>
            <div className="text-right text-sm text-slate-500 dark:text-slate-400">
              <p>Barcode</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {row.barcode ?? "-"}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-400">Inventory</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {formatNumber(row.qtyAvailable)}
              </dd>
            </div>
            {input.canEdit ? (
              <DateDetail label="UAE updated" value={row.uaeUpdatedAt} />
            ) : null}
            <DateDetail label="IR updated" value={row.irUpdatedAt} />
          </dl>

          <div className="mt-4 grid gap-3">
            {visibleFields.map(({ field, label, currency }) => (
              <div key={field}>
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                  {label}
                </p>
                <EditablePriceField
                  row={row}
                  field={field}
                  currency={currency}
                  input={input}
                />
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function DateDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-slate-700 dark:text-slate-200">
        {formatDateTime(value)}
      </dd>
    </div>
  );
}
