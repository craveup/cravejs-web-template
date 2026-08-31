import type { CatalogSearchIndex, CatalogItemView } from "../catalog-types";
import { normalizeSearchText, tokenizeQuery } from "./normalize-query";

export interface FilterMenuOptions {
  categoryId?: string;
}

export function filterMenu(
  index: CatalogSearchIndex,
  query: string,
  options: FilterMenuOptions = {},
): CatalogItemView[] {
  const tokens = tokenizeQuery(query);
  if (!tokens.length) return [];

  return index.items.filter((item) => {
    if (options.categoryId && item.categoryId !== options.categoryId) return false;

    const document = normalizeSearchText(
      [item.name, item.description, item.categoryName].filter(Boolean).join(" "),
    );
    return tokens.every((token) => document.includes(token));
  });
}
