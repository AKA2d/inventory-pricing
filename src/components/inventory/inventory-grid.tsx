"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { InventoryRow } from "@/components/inventory/types";

type DraftPrice = {
  uaePriceAed: string;
  irPriceIrr: string;
};

type InventoryGridProps = {
  rows: InventoryRow[];
  canEdit: boolean;
  saving: boolean;
  onSave: (updates: Array<{ productId: string; uaePriceAed: number | null; irPriceIrr: number | null }>) => Promise<void>;
};

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

function sanitizeInteger(value: string) {
  return value.replace(/[^\d]/g, "");
}

function parseNullableInt(value: string) {
  if (!value.trim()) return null;
  return Number.parseInt(value, 10);
}

export function InventoryGrid({ rows, canEdit, saving, onSave }: InventoryGridProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftPrice>>(() => initialDraft(rows));
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const lastFocusedRef = useRef<{ productId: string; field: keyof DraftPrice } | null>(null);

  useEffect(() => {
    if (!lastFocusedRef.current) return;
    const { productId, field } = lastFocusedRef.current;
    const element = document.querySelector<HTMLInputElement>(`input[data-product-id="${productId}"][data-field="${field}"]`);
    element?.focus();
    element?.select();
  }, [saving]);

  const updateField = (productId: string, field: keyof DraftPrice, value: string) => {
    const sanitized = sanitizeInteger(value);
    setDrafts((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [field]: sanitized,
      },
    }));
    setDirtyIds((current) => new Set(current).add(productId));
  };

  const dirtyRows = rows.filter((row) => dirtyIds.has(row.productId));

  const submit = async () => {
    const invalid = dirtyRows.find((row) => {
      const draft = drafts[row.productId];
      return [draft.uaePriceAed, draft.irPriceIrr].some((value) => value !== "" && !/^\d+$/.test(value));
    });

    if (invalid) {
      toast.error("Only whole-number prices are allowed.");
      return;
    }

    await onSave(
      dirtyRows.map((row) => ({
        productId: row.productId,
        uaePriceAed: parseNullableInt(drafts[row.productId].uaePriceAed),
        irPriceIrr: parseNullableInt(drafts[row.productId].irPriceIrr),
      })),
    );

    setDirtyIds(new Set());
  };

  const PriceInput = ({
    row,
    field,
    currency,
  }: {
    row: InventoryRow;
    field: keyof DraftPrice;
    currency: string;
  }) => (
    <div className="flex items-center gap-2">
      <span className="w-8 text-xs font-medium uppercase tracking-wide text-slate-400">{currency}</span>
      <Input
        value={drafts[row.productId]?.[field] ?? ""}
        onChange={(event) => updateField(row.productId, field, event.target.value)}
        onFocus={(event) => {
          lastFocusedRef.current = { productId: row.productId, field };
          event.target.select();
        }}
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={!canEdit || saving}
        data-product-id={row.productId}
        data-field={field}
        className="h-8 min-w-[8rem] text-right"
      />
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {rows.length} rows loaded
          {dirtyIds.size > 0 ? ` • ${dirtyIds.size} unsaved` : ""}
        </p>
        {canEdit ? (
          <Button onClick={submit} disabled={saving || dirtyIds.size === 0}>
            {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            Save
          </Button>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
        <table className="min-w-full table-fixed border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              {["#", "Odoo ID", "Product name", "Barcode", "Inventory", "UAE price", "UAE updated", "IR price", "IR updated"].map((label) => (
                <th key={label} className="border-b border-slate-200 px-3 py-3 font-medium dark:border-slate-800">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.productId} className="border-b border-slate-100 align-top last:border-b-0 dark:border-slate-800/70">
                <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-200">{row.odooId}</td>
                <td className="px-3 py-3">
                  <div className="font-medium text-slate-950 dark:text-slate-100">{row.name}</div>
                </td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{row.barcode ?? "—"}</td>
                <td className="px-3 py-3 tabular-nums text-slate-700 dark:text-slate-200">{formatNumber(row.qtyAvailable)}</td>
                <td className="px-3 py-3">
                  {canEdit ? <PriceInput row={row} field="uaePriceAed" currency="AED" /> : <span>{formatNumber(row.uaePriceAed) || "—"}</span>}
                </td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(row.uaeUpdatedAt)}</td>
                <td className="px-3 py-3">
                  {canEdit ? <PriceInput row={row} field="irPriceIrr" currency="IRR" /> : <span>{formatNumber(row.irPriceIrr) || "—"}</span>}
                </td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(row.irUpdatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {rows.map((row, index) => (
          <article key={row.productId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Row {index + 1}</p>
                <h3 className="font-medium text-slate-950 dark:text-slate-100">{row.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Odoo #{row.odooId}</p>
              </div>
              <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                <p>Barcode</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{row.barcode ?? "—"}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-400">Inventory</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{formatNumber(row.qtyAvailable)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">UAE updated</dt>
                <dd className="text-slate-700 dark:text-slate-200">{formatDateTime(row.uaeUpdatedAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">IR updated</dt>
                <dd className="text-slate-700 dark:text-slate-200">{formatDateTime(row.irUpdatedAt)}</dd>
              </div>
            </dl>
            <div className="mt-4 grid gap-3">
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">UAE price</p>
                {canEdit ? <PriceInput row={row} field="uaePriceAed" currency="AED" /> : <p className="font-medium">{formatNumber(row.uaePriceAed) || "—"}</p>}
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">IR price</p>
                {canEdit ? <PriceInput row={row} field="irPriceIrr" currency="IRR" /> : <p className="font-medium">{formatNumber(row.irPriceIrr) || "—"}</p>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
