import type { CatalogCategoryView } from "../catalog-types";

export interface CategoryNavigationProps {
  categories: CatalogCategoryView[];
  includeFeatured?: boolean;
}

export function CategoryNavigation({
  categories,
  includeFeatured = true,
}: CategoryNavigationProps) {
  return (
    <nav className="category-navigation" aria-label="Menu categories">
      <span className="category-navigation-label">Menu</span>
      {includeFeatured ? <a href="#most-ordered">Most ordered</a> : null}
      {categories.map((category) => (
        <a href={`#category-${category.id}`} key={category.id}>
          {category.name}
        </a>
      ))}
    </nav>
  );
}

export function CategoryChips({
  categories,
  includeFeatured = true,
}: CategoryNavigationProps) {
  return (
    <nav className="category-chips" aria-label="Jump to menu category">
      {includeFeatured ? <a href="#most-ordered">Most ordered</a> : null}
      {categories.map((category) => (
        <a href={`#category-${category.id}`} key={category.id}>
          {category.name}
        </a>
      ))}
    </nav>
  );
}
