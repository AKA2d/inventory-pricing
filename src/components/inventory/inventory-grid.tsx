"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  buildPriceUpdates,
  getDraftValue,
  initialDraft,
  isValidDecimalInput,
  isValidWholeNumberInput,
  sanitizeDraftValue,
  wholeNumberDraftFields,
} from "@/components/inventory/draft-prices";
import { InventoryGridTable } from "@/components/inventory/inventory-grid-table";
import { InventoryMobileList } from "@/components/inventory/inventory-mobile-list";
import type { InventoryRow } from "@/components/inventory/types";
import type {
  DraftPrice,
  DraftPriceField,
  InventoryGridProps,
  PriceInputContext,
} from "@/components/inventory/grid-types";

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
  const [activeField, setActiveField] = useState<{
    productId: string;
    field: DraftPriceField;
  } | null>(null);
  const lastFocusedRef = useRef<{
    productId: string;
    field: DraftPriceField;
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
    field: DraftPriceField,
    value: string,
  ) => {
    setDrafts((current) => ({
      ...current,
      [productId]: {
        ...getDraftValue(current, productId),
        [field]: sanitizeDraftValue(field, value),
      },
    }));
    setDirtyIds((current) => new Set(current).add(productId));
  };

  const rowsForIds = (rowIds: string[]) =>
    rows.filter((row) => rowIds.includes(row.productId));

  const submitRows = async (targetRows: InventoryRow[]) => {
    if (targetRows.length === 0) return;

    if (hasInvalidWholeNumber(targetRows, drafts)) {
      toast.error(
        "Only whole-number prices are allowed for price/shipping/competitor fields.",
      );
      return;
    }

    if (hasInvalidDecimal(targetRows, drafts)) {
      toast.error("Profit margins and ratios must be numeric.");
      return;
    }

    await onSave(buildPriceUpdates(targetRows, drafts));

    setDirtyIds((current) => {
      const next = new Set(current);
      for (const row of targetRows) next.delete(row.productId);
      return next;
    });
  };

  const input: PriceInputContext = {
    canEdit,
    saving,
    drafts,
    activeField,
    onFocusField: (productId, field) => {
      lastFocusedRef.current = { productId, field };
      setActiveField({ productId, field });
    },
    onBlurField: (productId, field) => {
      setActiveField((current) =>
        current?.productId === productId && current.field === field
          ? null
          : current,
      );
    },
    onChangeField: updateField,
    onSubmitRow: async (productId) => {
      await submitRows(rowsForIds([productId]));
    },
  };

  const dirtyRows = rows.filter((row) => dirtyIds.has(row.productId));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {rows.length} rows loaded
          {dirtyIds.size > 0 ? ` - ${dirtyIds.size} unsaved` : ""}
        </p>
        {canEdit ? (
          <Button
            onClick={async () => submitRows(dirtyRows)}
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

      <InventoryGridTable
        rows={rows}
        input={input}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={onSortChange}
      />
      <InventoryMobileList rows={rows} input={input} />
    </section>
  );
}

function hasInvalidWholeNumber(
  rows: InventoryRow[],
  drafts: Record<string, DraftPrice>,
) {
  return rows.some((row) => {
    const draft = getDraftValue(drafts, row.productId);
    return wholeNumberDraftFields.some(
      (field) => !isValidWholeNumberInput(draft[field]),
    );
  });
}

function hasInvalidDecimal(
  rows: InventoryRow[],
  drafts: Record<string, DraftPrice>,
) {
  return rows.some((row) => {
    const draft = getDraftValue(drafts, row.productId);
    return [draft.uaeProfitMargin, draft.irProfitMargin, draft.priceRatio].some(
      (value) => !isValidDecimalInput(value),
    );
  });
}
