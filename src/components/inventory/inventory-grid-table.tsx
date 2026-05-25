import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { EditablePriceField } from "@/components/inventory/editable-price-field";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { InventoryRow } from "@/components/inventory/types";
import type {
  PriceInputContext,
  SortDirection,
  SortField,
} from "@/components/inventory/grid-types";

type InventoryGridTableProps = {
  rows: InventoryRow[];
  input: PriceInputContext;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
};

type GridColumn = {
  key: string;
  label: string;
  width?: string;
  sortable?: SortField;
  renderCell: (row: InventoryRow, rowIndex: number) => ReactNode;
};

export function InventoryGridTable({
  rows,
  input,
  sortField,
  sortDirection,
  onSortChange,
}: InventoryGridTableProps) {
  const columns = getColumns(input);

  return (
    <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={{ width: column.width ?? "auto" }} />
          ))}
        </colgroup>
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="border-b border-slate-200 px-2 py-2 font-medium dark:border-slate-800"
              >
                {column.sortable ? (
                  <SortButton
                    label={column.label}
                    sortable={column.sortable}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSortChange={onSortChange}
                  />
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={row.productId}
              className="border-b border-slate-100 align-top last:border-b-0 dark:border-slate-800/70"
            >
              {columns.map((column) => (
                <td key={column.key} className="px-2 py-2">
                  {column.renderCell(row, rowIndex)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortButton({
  label,
  sortable,
  sortField,
  sortDirection,
  onSortChange,
}: {
  label: string;
  sortable: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSortChange(sortable)}
      className="flex items-center gap-2 text-left transition hover:text-slate-900 dark:hover:text-slate-100"
    >
      <span>{label}</span>
      {sortField === sortable ? (
        sortDirection === "asc" ? (
          <ChevronUp className="size-4" aria-hidden />
        ) : (
          <ChevronDown className="size-4" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="size-4 text-slate-400" aria-hidden />
      )}
    </button>
  );
}

function getColumns(input: PriceInputContext): GridColumn[] {
  const sharedColumns: GridColumn[] = [
    { key: "index", label: "#", width: "3rem", renderCell: (_, i) => i + 1 },
    {
      key: "odooId",
      label: "Odoo ID",
      width: "5rem",
      sortable: "odooId",
      renderCell: (row) => (
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {row.odooId}
        </span>
      ),
    },
    {
      key: "name",
      label: "Product name",
      width: "26rem",
      sortable: "name",
      renderCell: (row) => (
        <div className="font-medium text-slate-950 dark:text-slate-100">
          <div className="max-w-104 truncate">{row.name}</div>
        </div>
      ),
    },
    {
      key: "barcode",
      label: "Barcode",
      width: "8rem",
      sortable: "barcode",
      renderCell: (row) => (
        <div className="max-w-32 truncate text-slate-600 dark:text-slate-300">
          {row.barcode ?? "-"}
        </div>
      ),
    },
    {
      key: "qtyAvailable",
      label: "Inventory",
      width: "6rem",
      sortable: "qtyAvailable",
      renderCell: (row) => (
        <div className="tabular-nums text-slate-700 dark:text-slate-200">
          {formatNumber(row.qtyAvailable)}
        </div>
      ),
    },
  ];

  const adminColumns: GridColumn[] = [
    editableColumn("uaePriceAed", "UAE price", "10rem", "AED", input, {
      sortable: "uaePriceAed",
    }),
    dateColumn("uaeUpdatedAt", "UAE updated", "7rem"),
    editableColumn("shippingCost", "Shipping", "10rem", "SHP", input),
    editableColumn("uaeProfitMargin", "UAE margin", "7rem", "%", input),
    editableColumn("irProfitMargin", "IR margin", "7rem", "%", input),
  ];

  return [
    ...sharedColumns,
    ...(input.canEdit ? adminColumns : []),
    editableColumn("irPriceIrr", "IR price", "10rem", "IRR", input, {
      sortable: "irPriceIrr",
    }),
    dateColumn("irUpdatedAt", "IR updated", "7rem"),
    editableColumn("lowestPrice", "Comp lowest", "10rem", "CMP", input),
    editableColumn("highestPrice", "Comp highest", "10rem", "CMP", input),
    editableColumn("lastSellingPrice", "Last sell", "10rem", "IRR", input),
    editableColumn("priceRatio", "Price ratio", "10rem", "", input),
  ];
}

function editableColumn(
  key: keyof InventoryRow & Parameters<typeof EditablePriceField>[0]["field"],
  label: string,
  width: string,
  currency: string,
  input: PriceInputContext,
  options: { sortable?: SortField } = {},
): GridColumn {
  return {
    key,
    label,
    width,
    sortable: options.sortable,
    renderCell: (row) => (
      <EditablePriceField
        row={row}
        field={key}
        currency={currency}
        input={input}
      />
    ),
  };
}

function dateColumn(key: "uaeUpdatedAt" | "irUpdatedAt", label: string, width: string): GridColumn {
  return {
    key,
    label,
    width,
    sortable: key,
    renderCell: (row) => (
      <div className="text-slate-600 dark:text-slate-300">
        {formatDateTime(row[key])}
      </div>
    ),
  };
}
