import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { ItemDetailResourceState } from "@/features/catalog/product/item-detail-resource-state";

export default function ItemRouteLoading() {
  return (
    <StorefrontShell
      variant="item"
      header={
        <StorefrontHeader
          brand="Your Restaurant"
          items={[{ id: "menu", label: "Menu", href: "#menu" }]}
        />
      }
    >
      <ItemDetailResourceState state={{ status: "loading" }} menuHref="#menu" />
    </StorefrontShell>
  );
}
