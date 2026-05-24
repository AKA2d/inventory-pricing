"use client";

import { startTransition, useEffect, useState } from "react";
import { AlertTriangle, DatabaseZap, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { InventoryGrid } from "@/components/inventory/inventory-grid";
import { Pagination } from "@/components/inventory/pagination";
import { SearchBar } from "@/components/inventory/search-bar";
import type {
  InventoryRow,
  SearchResponse,
} from "@/components/inventory/types";
import { Button } from "@/components/ui/button";

type DashboardProps = {
  canEdit: boolean;
  username: string;
};

type ErrorPayload = {
  error?: {
    message?: string;
  };
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

type SortDirection = "asc" | "desc";

const DEFAULT_PAGE_SIZE = 10;

function sortRows(
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

export function InventoryDashboard({ canEdit, username }: DashboardProps) {
  const [searchText, setSearchText] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [result, setResult] = useState<SearchResponse>({
    rows: [],
    total: 0,
    source: "cache",
  });
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [aedPrice, setAedPrice] = useState<string>("");
  const [updatingAedPrice, setUpdatingAedPrice] = useState(false);
  const [currentAedPrice, setCurrentAedPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!submittedQuery) return;

    const load = async () => {
      setIsSearching(true);

      try {
        const response = await fetch(
          `/api/products/search?${new URLSearchParams({
            q: submittedQuery,
            page: String(page),
            pageSize: String(pageSize),
          })}`,
          { cache: "no-store" },
        );

        const payload = (await response.json()) as
          | SearchResponse
          | ErrorPayload;
        if (!response.ok)
          throw new Error(
            (payload as ErrorPayload).error?.message ?? "Search failed.",
          );

        setResult(payload as SearchResponse);
        if ((payload as SearchResponse).warning) {
          toast.warning((payload as SearchResponse).warning);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Search failed.");
      } finally {
        setIsSearching(false);
      }
    };

    load();
  }, [page, pageSize, submittedQuery]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const resp = await fetch("/api/jobs/update-aed-price");
        if (!resp.ok) return;
        const payload = await resp.json();
        if (!mounted) return;
        const value = payload?.value?.price;
        setCurrentAedPrice(typeof value === "number" ? value : null);
      } catch (err) {
        // ignore
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSearch = () => {
    const next = searchText.trim();
    if (!next) {
      toast.error("Enter a product name or barcode.");
      return;
    }

    startTransition(() => {
      setPage(1);
      setSubmittedQuery(next);
    });
  };

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  };

  const handleSave = async (
    updates: Array<{
      productId: string;
      uaePriceAed: number | null;
      irPriceIrr: number | null;
    }>,
  ) => {
    setIsSaving(true);

    const previous = result;
    setResult((current) => ({
      ...current,
      rows: current.rows.map((row) => {
        const update = updates.find((item) => item.productId === row.productId);
        if (!update) return row;
        const now = new Date().toISOString();
        return {
          ...row,
          uaePriceAed: update.uaePriceAed,
          irPriceIrr: update.irPriceIrr,
          uaeUpdatedAt: now,
          irUpdatedAt: now,
        };
      }),
    }));

    try {
      const response = await fetch("/api/prices", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          (payload as ErrorPayload).error?.message ?? "Failed to save prices.",
        );
      }

      // server returns canonical rows for updated products
      if (payload?.rows && Array.isArray(payload.rows)) {
        setResult((current) => ({
          ...current,
          rows: current.rows.map((r) => {
            const updated = (payload.rows as InventoryRow[]).find(
              (x) => x.productId === r.productId,
            );
            return updated ?? r;
          }),
        }));
      }

      toast.success("Prices saved.");
    } catch (error) {
      setResult(previous);
      toast.error(
        error instanceof Error ? error.message : "Failed to save prices.",
      );
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshCache = async () => {
    setRefreshingCache(true);
    try {
      const response = await fetch("/api/jobs/refresh-stale-cache", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        refreshed?: number;
      } & ErrorPayload;
      if (!response.ok)
        throw new Error(payload.error?.message ?? "Failed to refresh cache.");
      toast.success(`Refreshed ${payload.refreshed ?? 0} stale cache entries.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh cache.",
      );
    } finally {
      setRefreshingCache(false);
    }
  };

  const sortedRows = sortRows(result.rows, sortField, sortDirection);
  const gridStateKey = `${submittedQuery}:${page}:${pageSize}:${sortedRows
    .map(
      (row) =>
        `${row.productId}:${row.uaePriceAed ?? "null"}:${row.irPriceIrr ?? "null"}:${row.uaeUpdatedAt ?? "null"}:${row.irUpdatedAt ?? "null"}`,
    )
    .join("|")}`;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-sky-700 dark:text-sky-300">
              Inventory pricing workspace
            </p>
            <h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
              Search products and maintain regional prices
            </h1>
            <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Search runs only when you press Enter or click Search. Results are
              cached locally and fall back cleanly if Odoo is unavailable.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
              Signed in as{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {username}
              </span>
            </div>
            <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
              {canEdit ? "Admin access" : "Viewer access"}
            </div>
            {canEdit ? (
              <Button
                variant="secondary"
                onClick={handleRefreshCache}
                disabled={refreshingCache}
              >
                <RefreshCw
                  className={`size-4 ${refreshingCache ? "animate-spin" : ""}`}
                  aria-hidden
                />
                Refresh stale cache
              </Button>
            ) : null}
            {canEdit ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="AED price"
                  className="w-28 rounded-md border border-slate-200 px-2 py-1 text-sm dark:border-slate-700"
                  value={aedPrice}
                  onChange={(e) => setAedPrice(e.target.value)}
                  data-testid="aed-price-input"
                />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    if (aedPrice.trim() === "") {
                      toast.error("Enter a price");
                      return;
                    }

                    const parsed = Number(aedPrice);
                    if (Number.isNaN(parsed) || parsed < 0) {
                      toast.error("Invalid price");
                      return;
                    }

                    setUpdatingAedPrice(true);
                    try {
                      const resp = await fetch("/api/jobs/update-aed-price", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ price: parsed }),
                      });
                      const payload = await resp.json();
                      if (!resp.ok)
                        throw new Error(
                          payload.error?.message ??
                            "Failed to update AED price.",
                        );
                      toast.success("AED price updated");
                      setAedPrice("");
                      // refresh displayed current price
                      setCurrentAedPrice(parsed);
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Failed to update AED price.",
                      );
                    } finally {
                      setUpdatingAedPrice(false);
                    }
                  }}
                  disabled={updatingAedPrice}
                >
                  Update AED price
                </Button>
                <div className="text-sm text-slate-600">
                  {currentAedPrice == null ? (
                    <span className="text-slate-400">No AED price</span>
                  ) : (
                    <span>Current: {currentAedPrice}</span>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <SearchBar
        value={searchText}
        isSearching={isSearching}
        onChange={setSearchText}
        onSearch={handleSearch}
      />
      {true ? (
        <>
          <section className="flex flex-wrap items-center gap-3 text-sm">
            <div className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-slate-50 dark:bg-slate-50 dark:text-slate-950">
              <DatabaseZap className="size-4" aria-hidden />
              Source:{" "}
              {result.source === "odoo" ? "Odoo + cache" : "Cache fallback"}
            </div>
            {result.warning ? (
              <div className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                <AlertTriangle className="size-4" aria-hidden />
                {result.warning}
              </div>
            ) : null}
          </section>

          <InventoryGrid
            key={gridStateKey}
            rows={sortedRows}
            canEdit={canEdit}
            saving={isSaving}
            onSave={handleSave}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={result.total}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPage(1);
              setPageSize(nextPageSize);
            }}
          />
        </>
      ) : (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
          Run a search by product name or barcode to load cached or live Odoo
          inventory data.
        </section>
      )}
    </div>
  );
}
