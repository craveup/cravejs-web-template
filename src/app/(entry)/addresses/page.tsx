import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontSkipLink } from "@/components/shell/storefront-skip-link";
import { ConnectedSavedAddressesScreen } from "@/features/fulfillment/address/connected-saved-addresses-screen";
import { loadDeliveryAddressPage } from "@/features/fulfillment/address/load-delivery-address-page";
import { SavedAddressesScreen } from "@/features/fulfillment/address/saved-addresses-screen";
import { readAccountPageRuntime } from "@/features/status/account-page";
import { readFixtureRuntimeFromEnvironment } from "@/fixtures/fixture-runtime";
import { storefrontPrivateRobots } from "@/lib/tenant/storefront-seo";

export const metadata: Metadata = {
  title: "Saved addresses | Crave Storefront",
  description: "Manage delivery addresses for your storefront account.",
  robots: storefrontPrivateRobots,
};

export default async function SavedAddressesPage({
  searchParams,
}: PageProps<"/addresses">) {
  const runtime = await readAccountPageRuntime();
  if (!runtime) notFound();
  const fixtureRuntime = readFixtureRuntimeFromEnvironment();
  const query = await searchParams;
  const requestedLocation = query.locationId;
  if (Array.isArray(requestedLocation)) notFound();
  const delivery = requestedLocation
    ? await loadDeliveryAddressPage({
        locationId: requestedLocation,
        runtime,
        fixtureRuntime,
      })
    : null;
  if (requestedLocation && !delivery) notFound();
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const encodedLocation = requestedLocation
    ? encodeURIComponent(requestedLocation)
    : undefined;

  const screen = delivery && requestedLocation ? (
    <ConnectedSavedAddressesScreen
      {...(googleMapsApiKey ? { googleMapsApiKey } : {})}
      locationId={requestedLocation}
      locale={runtime.locale}
      merchantSlug={runtime.merchantSlug}
      mode={runtime.mode}
      policy={delivery.policy}
      runtime={delivery.runtime}
    />
  ) : (
    <SavedAddressesScreen
      merchantSlug={runtime.merchantSlug}
      locale={runtime.locale}
      mode={runtime.mode}
    />
  );

  const brandHref = encodedLocation ? `/${encodedLocation}` : "/";
  const menuHref = encodedLocation ? `/${encodedLocation}` : "/";

  return (
    <div className="storefront-shell">
      <StorefrontSkipLink />
      <StorefrontHeader
        brand={delivery?.brand ?? "Your Restaurant"}
        brandHref={brandHref}
        items={[
          { id: "menu", label: "Menu", href: menuHref },
          { id: "locations", label: "Locations", href: "/stores" },
        ]}
        actionItems={[
          { id: "account", label: "Account", href: "/account/sign-in" },
        ]}
        cartLabel="Cart"
      />
      <div id="storefront-main" tabIndex={-1}>
        {screen}
      </div>
    </div>
  );
}
