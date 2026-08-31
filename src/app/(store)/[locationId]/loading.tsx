import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { CatalogPageState } from "@/features/catalog/browse/catalog-page-state";

export default function StoreLoading() {
  return (
    <StorefrontShell
      header={
        <StorefrontHeader
          brand="Your Restaurant"
          items={[{ id: "menu", label: "Menu", href: "#menu" }]}
        />
      }
      leading={<Skeleton className="skeleton-leading" />}
      rail={<Skeleton className="skeleton-rail" />}
    >
      <CatalogPageState kind="loading" />
    </StorefrontShell>
  );
}
