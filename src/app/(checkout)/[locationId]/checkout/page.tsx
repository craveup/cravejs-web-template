import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CatalogNotFoundError,
  loadDemoStoreHomeData,
  loadStoreHomeData,
} from "@/features/catalog/server/load-store-home";
import { getStorefrontCatalogSource } from "@/features/catalog/server/storefront-catalog-source";
import { CheckoutIdentityRoute } from "@/features/checkout/checkout-identity-route";
import { CheckoutShell } from "@/features/checkout/checkout-shell";
import { loadCheckoutAdjustmentConfig } from "@/features/checkout/load-checkout-adjustment-config";
import type { CheckoutOrderTimes } from "@/features/checkout/scheduling/checkout-scheduling";
import { resolveEntryIntent } from "@/features/fulfillment/entry/resolve-entry-intent";
import { loadOrderTimes } from "@/features/fulfillment/time/load-order-times";
import { fixtureTimeline } from "@/fixtures/reference-now";
import { toStorefrontErrorState } from "@/lib/storefront/error-state";
import { readRequestStorefrontRuntime } from "@/lib/tenant/server-storefront-runtime";
import { storefrontPrivateRobots } from "@/lib/tenant/storefront-seo";

export const metadata: Metadata = {
  title: "Checkout | Crave Storefront",
  description: "Verify your details before secure checkout.",
  robots: storefrontPrivateRobots,
};

async function loadCheckoutOrderTimes(input: {
  readonly locationId: string;
  readonly locale: string;
  readonly timeZone: string;
  readonly mode: "fixture" | "live";
}): Promise<CheckoutOrderTimes> {
  try {
    return await loadOrderTimes(input);
  } catch (error) {
    const safe = toStorefrontErrorState(error);
    const state = safe.state === "rate-limited"
      ? "rate-limited"
      : safe.state === "dependency-unavailable" || safe.state === "network-error"
        ? "unavailable"
        : "error";
    return {
      state,
      ...(safe.retryAfterMs !== undefined
        ? { retryAfterSeconds: Math.ceil(safe.retryAfterMs / 1_000) }
        : {}),
      allowAsap: false,
      scheduleAllowed: false,
      requireScheduledOrders: true,
      days: [],
    };
  }
}

export default async function CheckoutPage({
  params,
  searchParams,
}: PageProps<"/[locationId]/checkout">) {
  const storefrontRuntime = await readRequestStorefrontRuntime();
  if (!storefrontRuntime) notFound();
  const { config } = storefrontRuntime;
  const mode = storefrontRuntime.mode;
  const fixtureRuntime = mode === "fixture" ? storefrontRuntime : null;

  const [{ locationId }, query] = await Promise.all([params, searchParams]);
  const entryIntent = resolveEntryIntent(query);
  if (entryIntent.kind === "invalid" || entryIntent.kind === "room") notFound();
  const tableIdentifier = entryIntent.kind === "table"
    ? entryIntent.detail.tableIdentifier
    : undefined;

  let brand = "Your Restaurant";
  let locationAddress: string | undefined;
  const gratuityPromise = loadCheckoutAdjustmentConfig(locationId, mode);
  const orderTimesPromise = tableIdentifier
    ? Promise.resolve(null)
    : loadCheckoutOrderTimes({
        locationId,
        locale: config.locale,
        timeZone: config.timeZone,
        mode,
      });
  try {
    const store = mode === "fixture"
      ? await loadDemoStoreHomeData(locationId)
      : await loadStoreHomeData(
          locationId,
          await getStorefrontCatalogSource(config.locale),
        );
    brand = store.location.name;
    locationAddress = store.location.addressLabel;
  } catch (error) {
    if (error instanceof CatalogNotFoundError) notFound();
    throw error;
  }

  const encodedLocation = encodeURIComponent(locationId);
  const backHref = tableIdentifier
    ? `/${encodedLocation}/cart?table=${encodeURIComponent(tableIdentifier)}`
    : `/${encodedLocation}/cart`;
  const [gratuity, orderTimes] = await Promise.all([
    gratuityPromise,
    orderTimesPromise,
  ]);
  const adjustmentRuntime = fixtureRuntime
    ? { mode: "fixture" as const, runtime: fixtureRuntime }
    : { mode: "live" as const, merchantSlug: config.merchantSlug };
  const handoffRuntime = fixtureRuntime
    ? {
        mode: "fixture" as const,
        runtime: fixtureRuntime,
        referenceNowMs: Date.parse(fixtureTimeline.now),
      }
    : { mode: "live" as const, merchantSlug: config.merchantSlug };

  return (
    <CheckoutShell brand={brand} brandHref={`/${encodedLocation}`}>
      <CheckoutIdentityRoute
        adjustmentRuntime={adjustmentRuntime}
        checkoutConfig={{
          merchantSlug: config.merchantSlug,
          checkoutOrigins: config.checkoutOrigins,
        }}
        handoffRuntime={handoffRuntime}
        merchantSlug={config.merchantSlug}
        locale={config.locale}
        mode={mode}
        backHref={backHref}
        locationId={locationId}
        gratuity={gratuity}
        {...(orderTimes
          ? {
              orderTimes,
              orderTimeRuntime: fixtureRuntime
                ? { mode: "fixture" as const, runtime: fixtureRuntime }
                : { mode: "live" as const, merchantSlug: config.merchantSlug },
            }
          : {})}
        {...(locationAddress ? { locationAddress } : {})}
        {...(tableIdentifier ? { tableIdentifier } : {})}
      />
    </CheckoutShell>
  );
}
