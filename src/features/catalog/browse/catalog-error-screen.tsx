import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontShell } from "@/components/shell/storefront-shell";

import { CatalogPageState } from "./catalog-page-state";

export type CatalogErrorScreenKind = "error" | "rate-limited";

export function CatalogErrorScreen({
  kind,
}: {
  readonly kind: CatalogErrorScreenKind;
}) {
  return (
    <StorefrontShell
      header={
        <StorefrontHeader
          brand="Your Restaurant"
          items={[{ id: "menu", label: "Menu", href: "#menu" }]}
        />
      }
    >
      <CatalogPageState kind={kind} />
    </StorefrontShell>
  );
}
