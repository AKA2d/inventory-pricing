"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { InventoryRow } from "@/components/inventory/types";

type DraftPrice = {
  uaePriceAed: string;
  irPriceIrr: string;
};

type SortField =
  | "odooId"
  | "name"
  | "barcode"
  | "qtyAvailable"
  | "uaePriceAed"
  | "uaeUpdatedAt"
  | "irPriceIrr"
  | "irUpdatedAt";

type InventoryGridProps = {
  rows: InventoryRow[];
  canEdit: boolean;
  saving: boolean;
  onSave: (
    updates: Array<{
      productId: string;
      uaePriceAed: number | null;
      irPriceIrr: number | null;
    }>,
  ) => Promise<void>;
  sortField: SortField;
  sortDirection: "asc" | "desc";
  onSortChange: (field: SortField) => void;
};

type PriceInputCellProps = {
  row: InventoryRow;
  field: keyof DraftPrice;
  currency: string;
  value: string;
  canEdit: boolean;
  saving: boolean;
  isActive: boolean;
  onFocusField: (productId: string, field: keyof DraftPrice) => void;
  onBlurField: (productId: string, field: keyof DraftPrice) => void;
  onChangeField: (
    productId: string,
    field: keyof DraftPrice,
    value: string,
  ) => void;
  onSubmitRow: (productId: string) => Promise<void>;
};

const sortableColumns: Array<{ key: SortField | null; label: string }> = [
  { key: null, label: "#" },
  { key: "odooId", label: "Odoo ID" },
  { key: "name", label: "Product name" },
  { key: "barcode", label: "Barcode" },
  { key: "qtyAvailable", label: "Inventory" },
  { key: "uaePriceAed", label: "UAE price" },
  { key: "uaeUpdatedAt", label: "UAE updated" },
  { key: "irPriceIrr", label: "IR price" },
  { key: "irUpdatedAt", label: "IR updated" },
];

function initialDraft(rows: InventoryRow[]) {
  return Object.fromEntries(
    rows.map((row) => [
      row.productId,
      {
        uaePriceAed: row.uaePriceAed == null ? "" : String(row.uaePriceAed),
        irPriceIrr: row.irPriceIrr == null ? "" : String(row.irPriceIrr),
      },
    ]),
  ) as Record<string, DraftPrice>;
}

function getDraftValue(
  drafts: Record<string, DraftPrice>,
  productId: string,
): DraftPrice {
  return drafts[productId] ?? { uaePriceAed: "", irPriceIrr: "" };
}

function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (char) => String(char.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 1632));
}

function sanitizeInteger(value: string) {
  return normalizeDigits(value).replace(/[^\d]/g, "");
}

function parseNullableInt(value: string) {
  if (!value.trim()) return null;
  return Number.parseInt(normalizeDigits(value), 10);
}

function isValidWholeNumberInput(value: string) {
  const normalized = normalizeDigits(value).trim();
  if (normalized === "") return true;
  return /^\d+$/.test(normalized);
}

function PriceInputCell({
  row,
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
    <div className="flex items-center gap-2">
      <span className="w-8 text-xs font-medium uppercase tracking-wide text-slate-400">
        {currency}
      </span>
      <Input
        value={value}
        onChange={(event) =>
          onChangeField(row.productId, field, event.target.value)
        }
        onFocus={(event) => {
          onFocusField(row.productId, field);
          event.target.select();
        }}
        onBlur={() => {
          onBlurField(row.productId, field);
        }}
        onKeyDown={async (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            await onSubmitRow(row.productId);
          }
        }}
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={!canEdit || saving}
        data-product-id={row.productId}
        data-field={field}
        className="h-8 min-w-[8rem] text-right"
      />
      {canEdit && isActive ? (
        <Button
          type="button"
          variant="secondary"
          className="h-8 px-2"
          disabled={saving}
          onMouseDown={(event) => event.preventDefault()}
          onClick={async () => {
            await onSubmitRow(row.productId);
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

export function InventoryGrid({
  rows,
  canEdit,
  saving,
  onSave,
  sortField,
  sortDirection,
  onSortChange,
}: InventoryGridProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftPrice>>(() =>
    initialDraft(rows),
  );
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const lastFocusedRef = useRef<{
    productId: string;
    field: keyof DraftPrice;
  } | null>(null);
  const [activeField, setActiveField] = useState<{
    productId: string;
    field: keyof DraftPrice;
  } | null>(null);

  useEffect(() => {
    if (!lastFocusedRef.current) return;
    const { productId, field } = lastFocusedRef.current;
    const element = document.querySelector<HTMLInputElement>(
      `input[data-product-id="${productId}"][data-field="${field}"]`,
    );
    element?.focus();
    element?.select();
  }, [saving]);

  const updateField = (
    productId: string,
    field: keyof DraftPrice,
    value: string,
  ) => {
    const sanitized = sanitizeInteger(value);
    setDrafts((current) => ({
      ...current,
      [productId]: {
        ...getDraftValue(current, productId),
        [field]: sanitized,
      },
    }));
    setDirtyIds((current) => new Set(current).add(productId));
  };

  const dirtyRows = rows.filter((row) => dirtyIds.has(row.productId));

  const rowsForIds = (rowIds: string[]) =>
    rows.filter((row) => rowIds.includes(row.productId));

  const buildUpdates = (targetRows: InventoryRow[]) =>
    targetRows.map((row) => {
      const draft = getDraftValue(drafts, row.productId);

      return {
        productId: row.productId,
        uaePriceAed: parseNullableInt(draft.uaePriceAed),
        irPriceIrr: parseNullableInt(draft.irPriceIrr),
      };
    });

  const submitRows = async (targetRows: InventoryRow[]) => {
    const invalid = targetRows.find((row) => {
      const draft = getDraftValue(drafts, row.productId);
      return [draft.uaePriceAed, draft.irPriceIrr].some(
        (value) => !isValidWholeNumberInput(value),
      );
    });

    if (invalid) {
      toast.error("Only whole-number prices are allowed.");
      return;
    }

    await onSave(buildUpdates(targetRows));

    setDirtyIds((current) => {
      const next = new Set(current);
      for (const row of targetRows) next.delete(row.productId);
      return next;
    });
  };

  const submitAllDirtyRows = async () => {
    await submitRows(dirtyRows);
  };

  const submitSingleRow = async (productId: string) => {
    await submitRows(rowsForIds([productId]));
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {rows.length} rows loaded
          {dirtyIds.size > 0 ? ` • ${dirtyIds.size} unsaved` : ""}
        </p>
        {canEdit ? (
          <Button
            onClick={submitAllDirtyRows}
            disabled={saving || dirtyIds.size === 0}
          >
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Save
          </Button>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
        <table className="min-w-full table-fixed border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              {sortableColumns.map((column) => (
                <th
                  key={column.label}
                  className="border-b border-slate-200 px-3 py-3 font-medium dark:border-slate-800"
                >
                  {column.key ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.key as SortField)}
                      className="flex items-center gap-2 text-left transition hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      <span>{column.label}</span>
                      {sortField === column.key ? (
                        sortDirection === "asc" ? (
                          <ChevronUp className="size-4" aria-hidden />
                        ) : (
                          <ChevronDown className="size-4" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown
                          className="size-4 text-slate-400"
                          aria-hidden
                        />
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.productId}
                className="border-b border-slate-100 align-top last:border-b-0 dark:border-slate-800/70"
              >
                <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-200">
                  {row.odooId}
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium text-slate-950 dark:text-slate-100">
                    {row.name}
                  </div>
                </td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                  {row.barcode ?? "—"}
                </td>
                <td className="px-3 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                  {formatNumber(row.qtyAvailable)}
                </td>
                <td className="px-3 py-3">
                  {canEdit ? (
                    <PriceInputCell
                      row={row}
                      field="uaePriceAed"
                      currency="AED"
                      value={drafts[row.productId]?.uaePriceAed ?? ""}
                      canEdit={canEdit}
                      saving={saving}
                      isActive={
                        activeField?.productId === row.productId &&
                        activeField.field === "uaePriceAed"
                      }
                      onFocusField={(productId, field) => {
                        lastFocusedRef.current = { productId, field };
                        setActiveField({ productId, field });
                      }}
                      onBlurField={(productId, field) => {
                        setActiveField((current) =>
                          current?.productId === productId &&
                          current.field === field
                            ? null
                            : current,
                        );
                      }}
                      onChangeField={updateField}
                      onSubmitRow={submitSingleRow}
                    />
                  ) : (
                    <span>{formatNumber(row.uaePriceAed) || "—"}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                  {formatDateTime(row.uaeUpdatedAt)}
                </td>
                <td className="px-3 py-3">
                  {canEdit ? (
                    <PriceInputCell
                      row={row}
                      field="irPriceIrr"
                      currency="IRR"
                      value={drafts[row.productId]?.irPriceIrr ?? ""}
                      canEdit={canEdit}
                      saving={saving}
                      isActive={
                        activeField?.productId === row.productId &&
                        activeField.field === "irPriceIrr"
                      }
                      onFocusField={(productId, field) => {
                        lastFocusedRef.current = { productId, field };
                        setActiveField({ productId, field });
                      }}
                      onBlurField={(productId, field) => {
                        setActiveField((current) =>
                          current?.productId === productId &&
                          current.field === field
                            ? null
                            : current,
                        );
                      }}
                      onChangeField={updateField}
                      onSubmitRow={submitSingleRow}
                    />
                  ) : (
                    <span>{formatNumber(row.irPriceIrr) || "—"}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                  {formatDateTime(row.irUpdatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                  {row.barcode ?? "—"}
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
              <div>
                <dt className="text-slate-400">UAE updated</dt>
                <dd className="text-slate-700 dark:text-slate-200">
                  {formatDateTime(row.uaeUpdatedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">IR updated</dt>
                <dd className="text-slate-700 dark:text-slate-200">
                  {formatDateTime(row.irUpdatedAt)}
                </dd>
              </div>
            </dl>
            <div className="mt-4 grid gap-3">
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                  UAE price
                </p>
                {canEdit ? (
                  <PriceInputCell
                    row={row}
                    field="uaePriceAed"
                    currency="AED"
                    value={drafts[row.productId]?.uaePriceAed ?? ""}
                    canEdit={canEdit}
                    saving={saving}
                    isActive={
                      activeField?.productId === row.productId &&
                      activeField.field === "uaePriceAed"
                    }
                    onFocusField={(productId, field) => {
                      lastFocusedRef.current = { productId, field };
                      setActiveField({ productId, field });
                    }}
                    onBlurField={(productId, field) => {
                      setActiveField((current) =>
                        current?.productId === productId &&
                        current.field === field
                          ? null
                          : current,
                      );
                    }}
                    onChangeField={updateField}
                    onSubmitRow={submitSingleRow}
                  />
                ) : (
                  <p className="font-medium">
                    {formatNumber(row.uaePriceAed) || "—"}
                  </p>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                  IR price
                </p>
                {canEdit ? (
                  <PriceInputCell
                    row={row}
                    field="irPriceIrr"
                    currency="IRR"
                    value={drafts[row.productId]?.irPriceIrr ?? ""}
                    canEdit={canEdit}
                    saving={saving}
                    isActive={
                      activeField?.productId === row.productId &&
                      activeField.field === "irPriceIrr"
                    }
                    onFocusField={(productId, field) => {
                      lastFocusedRef.current = { productId, field };
                      setActiveField({ productId, field });
                    }}
                    onBlurField={(productId, field) => {
                      setActiveField((current) =>
                        current?.productId === productId &&
                        current.field === field
                          ? null
                          : current,
                      );
                    }}
                    onChangeField={updateField}
                    onSubmitRow={submitSingleRow}
                  />
                ) : (
                  <p className="font-medium">
                    {formatNumber(row.irPriceIrr) || "—"}
                  </p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
