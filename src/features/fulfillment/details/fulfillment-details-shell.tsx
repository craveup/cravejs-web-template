import type { ReactNode } from "react";

import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontSkipLink } from "@/components/shell/storefront-skip-link";

export function FulfillmentDetailsShell({
  brand,
  children,
  locationId,
}: {
  readonly brand: string;
  readonly children: ReactNode;
  readonly locationId: string;
}) {
  const href = `/${encodeURIComponent(locationId)}`;
  return (
    <div className="storefront-shell">
      <StorefrontSkipLink />
      <StorefrontHeader
        brand={brand}
        brandHref={href}
        items={[
          { id: "menu", label: "Menu", href },
          { id: "locations", label: "Locations", href: "/stores" },
        ]}
        cartLabel="Cart"
      />
      <div id="storefront-main" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
