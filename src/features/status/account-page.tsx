import type { ReactNode } from "react";

import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontSkipLink } from "@/components/shell/storefront-skip-link";
import { readRequestStorefrontRuntime } from "@/lib/tenant/server-storefront-runtime";

export interface AccountPageRuntime {
  readonly merchantSlug: string;
  readonly locale: string;
  readonly timeZone: string;
  readonly mode: "fixture" | "live";
}

export async function readAccountPageRuntime(): Promise<AccountPageRuntime | null> {
  const runtime = await readRequestStorefrontRuntime();
  if (!runtime) {
    return null;
  }

  return {
    merchantSlug: runtime.config.merchantSlug,
    locale: runtime.config.locale,
    timeZone: runtime.config.timeZone,
    mode: runtime.mode,
  };
}

export function AccountPageShell({
  accountHref,
  children,
}: {
  readonly accountHref: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="storefront-shell">
      <StorefrontSkipLink />
      <StorefrontHeader
        brand="Your Restaurant"
        brandHref="/"
        items={[
          { id: "menu", label: "Menu", href: "/" },
          { id: "locations", label: "Locations", href: "/stores" },
        ]}
        actionItems={[
          { id: "account", label: "Account", href: accountHref },
        ]}
        desktopAction={{
          id: "account",
          label: "Account",
          href: accountHref,
        }}
      />
      <main id="storefront-main" tabIndex={-1}>{children}</main>
    </div>
  );
}
