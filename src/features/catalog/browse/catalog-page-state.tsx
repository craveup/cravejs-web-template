import { Skeleton } from "@/components/ui/skeleton";

export type CatalogPageStateKind = "empty" | "error" | "loading" | "rate-limited";

export function CatalogPageState({ kind }: { kind: CatalogPageStateKind }) {
  if (kind === "loading") {
    return (
      <div
        className="catalog-state catalog-loading"
        role="status"
        aria-label="Loading menu"
        aria-busy="true"
      >
        <Skeleton className="skeleton-heading" />
        <div className="skeleton-grid">
          <Skeleton />
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      </div>
    );
  }

  const copy = {
    empty: {
      title: "The menu is taking a break",
      body: "There are no dishes available to browse right now.",
    },
    error: {
      title: "We could not load the menu",
      body: "Refresh the page to try again.",
    },
    "rate-limited": {
      title: "Please try again shortly",
      body: "The menu is receiving more requests than usual.",
    },
  }[kind];

  return (
    <section className="catalog-state" role={kind === "empty" ? "status" : "alert"}>
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
    </section>
  );
}
