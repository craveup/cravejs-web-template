import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontSkipLink } from "@/components/shell/storefront-skip-link";
import { loadStorePicker } from "@/features/fulfillment/stores/load-store-picker";
import { StoreList } from "@/features/fulfillment/stores/store-list";
import { readAccountPageRuntime } from "@/features/status/account-page";
import { readRequestStorefrontRuntime } from "@/lib/tenant/server-storefront-runtime";
import {
  createStorefrontPageMetadata,
  storefrontPrivateRobots,
} from "@/lib/tenant/storefront-seo";
import { StorefrontStoreDirectoryError } from "@/lib/storefront/store-directory";

export async function generateMetadata(): Promise<Metadata> {
  const runtime = await readRequestStorefrontRuntime();
  return runtime?.mode === "live"
    ? createStorefrontPageMetadata(runtime.config, {
        pathname: "/stores",
        title: "Locations | Order online",
        description: "Choose a restaurant location and start your order.",
      })
    : { robots: storefrontPrivateRobots };
}

function StorePickerHeader({
  brand,
  firstLocationId,
}: {
  readonly brand: string;
  readonly firstLocationId?: string;
}) {
  const menuHref = firstLocationId ? `/${encodeURIComponent(firstLocationId)}` : "/stores";
  return (
    <StorefrontHeader
      brand={brand}
      brandHref={menuHref}
      items={[
        { id: "menu", label: "Menu", href: menuHref },
        { id: "locations", label: "Locations", href: "/stores" },
      ]}
      cartLabel="Cart"
    />
  );
}

function StorePickerError({ rateLimited }: { readonly rateLimited: boolean }) {
  return (
    <main className="catalog-state">
      <h1>{rateLimited ? "Store search is busy" : "Stores are unavailable"}</h1>
      <p>
        {rateLimited
          ? "Please wait a moment, then try again."
          : "We couldn’t load the store list. Please try again."}
      </p>
      <Link className="primary-button" href="/stores">
        Try again
      </Link>
    </main>
  );
}

export default async function StoresPage() {
  const runtime = await readAccountPageRuntime();
  if (!runtime) notFound();

  let outcome:
    | { readonly data: NonNullable<Awaited<ReturnType<typeof loadStorePicker>>> }
    | { readonly error: StorefrontStoreDirectoryError };
  try {
    const data = await loadStorePicker(runtime);
    if (!data) notFound();
    outcome = { data };
  } catch (error) {
    if (!(error instanceof StorefrontStoreDirectoryError)) throw error;
    outcome = { error };
  }

  if ("error" in outcome) {
    return (
      <div className="storefront-shell" data-variant="store-picker-error">
        <StorefrontSkipLink />
        <StorePickerHeader brand="Storefront" />
        <div id="storefront-main" tabIndex={-1}>
          <StorePickerError rateLimited={outcome.error.state === "rate-limited"} />
        </div>
      </div>
    );
  }

  const { data } = outcome;
  const firstLocationId = data.stores[0]?.id;
  return (
    <div className="storefront-shell" data-variant="store-picker">
      <StorefrontSkipLink />
      <StorePickerHeader
        brand={data.merchantName}
        firstLocationId={firstLocationId}
      />
      <div id="storefront-main" tabIndex={-1}>
        <StoreList
          stores={data.stores}
          distanceRuntime={
            runtime.mode === "fixture"
              ? {
                  mode: "fixture",
                  merchantSlug: runtime.merchantSlug,
                  networkPolicy: "deny",
                }
              : { mode: "live" }
          }
        />
      </div>
    </div>
  );
}
