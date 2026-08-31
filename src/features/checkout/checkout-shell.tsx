import type { ReactNode } from "react";

import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontSkipLink } from "@/components/shell/storefront-skip-link";

import styles from "./checkout-shell.module.css";

export function CheckoutShell({
  brand,
  brandHref,
  children,
}: {
  readonly brand: string;
  readonly brandHref: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={`storefront-shell ${styles.shell}`}>
      <StorefrontSkipLink />
      <StorefrontHeader
        brand={brand}
        brandHref={brandHref}
        items={[
          { id: "menu", label: "Menu", href: brandHref },
          { id: "locations", label: "Locations", href: "/stores" },
          { id: "catering", label: "Catering", href: `${brandHref}/catering` },
          { id: "about", label: "About", href: `${brandHref}/about` },
        ]}
        actionItems={[{ id: "account", label: "Account", href: "/account/sign-in" }]}
        desktopAction={{ id: "account", label: "Account", href: "/account/sign-in" }}
      />
      <main id="storefront-main" tabIndex={-1}>{children}</main>
    </div>
  );
}
