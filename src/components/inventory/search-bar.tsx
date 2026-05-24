"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchBarProps = {
  value: string;
  isSearching: boolean;
  onChange: (value: string) => void;
  onSearch: () => void;
};

export function SearchBar({
  value,
  isSearching,
  onChange,
  onSearch,
}: SearchBarProps) {
  return (
    <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center">
      <div className="relative w-full flex-1 xl:max-w-4xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSearch();
            }
          }}
          placeholder="Search by product name or barcode"
          className="h-11 w-full pl-9"
          aria-label="Search inventory products"
        />
      </div>
      <Button
        onClick={onSearch}
        disabled={isSearching}
        className="h-11 px-5 xl:self-stretch"
      >
        {isSearching ? "Searching..." : "Search"}
      </Button>
    </div>
  );
}
