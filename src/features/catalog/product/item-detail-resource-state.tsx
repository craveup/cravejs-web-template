import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export type ItemDetailResourceStateView =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "error"; message: string }>
  | Readonly<{ status: "not-found" }>;

export function ItemDetailResourceState({
  state,
  menuHref,
  onRetry,
}: {
  readonly state: ItemDetailResourceStateView;
  readonly menuHref: string;
  readonly onRetry?: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div
        className="item-detail-loading"
        role="status"
        aria-label="Loading item"
        aria-busy="true"
      >
        <Skeleton className="item-detail-image-skeleton" />
        <div>
          <Skeleton className="item-detail-heading-skeleton" />
          <Skeleton className="item-detail-copy-skeleton" />
          <Skeleton className="item-detail-options-skeleton" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="item-detail-state" role="alert">
        <h1>We could not load this item</h1>
        <p>{state.message}</p>
        <Button disabled={!onRetry} onClick={onRetry}>
          Try again
        </Button>
        <Link href={menuHref}>Back to menu</Link>
      </div>
    );
  }

  return (
    <div className="item-detail-state">
      <h1>Item not found</h1>
      <p>This item is no longer on the menu.</p>
      <Link href={menuHref}>Back to menu</Link>
    </div>
  );
}
