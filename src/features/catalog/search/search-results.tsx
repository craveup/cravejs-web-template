"use client";

import { Search, X } from "lucide-react";
import { type FormEvent, useDeferredValue, useMemo, useState } from "react";

import { MenuItemCard } from "@/components/ui/menu-item-card";

import type { CatalogSearchIndex } from "../catalog-types";
import { filterMenu } from "./filter-menu";
import { tokenizeQuery } from "./normalize-query";

export interface CatalogSearchProps {
  index: CatalogSearchIndex;
  initialQuery?: string;
}

function syncQueryToAddressBar(query: string) {
  const url = new URL(window.location.href);
  const trimmed = query.trim();
  if (trimmed) url.searchParams.set("q", trimmed);
  else url.searchParams.delete("q");
  window.history.replaceState(window.history.state, "", url);
}

export function CatalogSearch({ index, initialQuery = "" }: CatalogSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState<string>();
  const deferredQuery = useDeferredValue(query);
  const active = tokenizeQuery(deferredQuery).length > 0;
  const results = useMemo(
    () => filterMenu(index, deferredQuery, { categoryId }),
    [categoryId, deferredQuery, index],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    syncQueryToAddressBar(query);
  }

  function clear() {
    setQuery("");
    setCategoryId(undefined);
    syncQueryToAddressBar("");
  }

  return (
    <section
      className="catalog-search"
      data-active={active}
      data-results={active ? results.length : undefined}
      aria-label="Search the menu"
    >
      <form className="catalog-search-form" role="search" onSubmit={submit}>
        <Search aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the menu"
          aria-label="Search the menu"
        />
        {query ? (
          <button type="button" onClick={clear} aria-label="Clear search">
            <X aria-hidden="true" />
          </button>
        ) : null}
      </form>

      {active ? (
        <div className="catalog-search-results">
          {results.length ? (
            <div className="search-category-chips" aria-label="Filter search results">
              <button
                type="button"
                aria-pressed={!categoryId}
                onClick={() => setCategoryId(undefined)}
              >
                All
              </button>
              {index.categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  aria-pressed={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          ) : null}

          {results.length ? (
            <div>
              <h2 className="search-results-heading" role="status" aria-live="polite">
                {results.length} {results.length === 1 ? "result" : "results"} for “{deferredQuery.trim()}”
              </h2>
              <div className="search-result-list" role="list" aria-label="Search results">
                {results.map((item, index) => (
                  <div role="listitem" key={item.id}>
                    <MenuItemCard {...item} layout="list" eager={index === 0} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="search-empty" role="status" aria-live="polite">
              <h2>No dishes match “{deferredQuery.trim()}”</h2>
              <p>Try a different word, or browse a category below.</p>
              <div className="search-empty-categories">
                {index.categories.map((category) => (
                  <a
                    href={`#category-${category.id}`}
                    key={category.id}
                    onClick={clear}
                  >
                    {category.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
