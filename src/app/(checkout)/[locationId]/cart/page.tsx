import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCartMessages } from "@/content/cart";
import { CartController } from "@/features/cart/cart-controller";
import { FixtureCartController } from "@/features/cart/fixture-cart-controller";
import { CartPage } from "@/features/cart/cart-page";
import { createCartPageView } from "@/features/cart/cart-view";
import {
  FixtureTablesideCartGuard,
  FixtureTablesideCartRecovery,
} from "@/features/cart/fixture-tableside-cart";
import {
  CatalogNotFoundError,
  loadDemoStoreHomeData,
} from "@/features/catalog/server/load-store-home";
import { describeFulfillment } from "@/features/fulfillment/detail";
import { resolveEntryIntent } from "@/features/fulfillment/entry/resolve-entry-intent";
import { readFixtureRuntimeFromEnvironment } from "@/fixtures/fixture-runtime";
import {
  getFixtureTablesideCart,
  fixtureTablesideCartStateFromCart,
  parseFixtureCartRevision,
} from "@/fixtures/tableside-cart-adapter";
import { storefrontPrivateRobots } from "@/lib/tenant/storefront-seo";

export const metadata: Metadata = {
  title: "Your cart | Crave Storefront",
  description: "Review your current order.",
  robots: storefrontPrivateRobots,
};

export default async function CartRoute({
  params,
  searchParams,
}: PageProps<"/[locationId]/cart">) {
  const fixtureRuntime = readFixtureRuntimeFromEnvironment();
  if (!fixtureRuntime) notFound();

  const [{ locationId }, query] = await Promise.all([params, searchParams]);
  let data;

  try {
    data = await loadDemoStoreHomeData(locationId);
  } catch (error) {
    if (error instanceof CatalogNotFoundError) notFound();
    throw error;
  }

  const entryIntent = resolveEntryIntent(query);
  const requestedRevision = query.revision === undefined
    ? 1
    : parseFixtureCartRevision(query.revision);
  const requestedCartId =
    typeof query.cartId === "string" ? query.cartId.trim() : undefined;
  const hasValidCartIdentity =
    query.cartId === undefined || Boolean(requestedCartId);
  const candidateTablesideFixture = entryIntent.kind === "table" && requestedRevision
    ? getFixtureTablesideCart(
        locationId,
        entryIntent.detail.tableIdentifier ?? "",
        requestedRevision,
      )
    : undefined;
  const tablesideFixture = candidateTablesideFixture &&
    hasValidCartIdentity &&
    (!requestedCartId || requestedCartId === candidateTablesideFixture.id)
    ? candidateTablesideFixture
    : undefined;
  const browseHref = `/${encodeURIComponent(locationId)}`;
  const expectedFixtureState = tablesideFixture
    ? fixtureTablesideCartStateFromCart(tablesideFixture)
    : undefined;
  const hasTablesideQuery =
    query.table !== undefined ||
    query.cartId !== undefined ||
    query.revision !== undefined;
  if (hasTablesideQuery && !expectedFixtureState) {
    return (
      <FixtureTablesideCartRecovery
        fallbackHref={browseHref}
        locationId={locationId}
      />
    );
  }
  const selectedCart = tablesideFixture ?? data.fixtureCart;
  const tableIdentifier = tablesideFixture?.tableServiceInfo?.tableNumber;
  const baseTablesideDescription = tableIdentifier
    ? describeFulfillment(
        { mode: "table-side", tableIdentifier },
        locationId,
      )
    : undefined;
  const tablesideDescription = baseTablesideDescription && tableIdentifier
    ? {
        ...baseTablesideDescription,
        changeHref: `${baseTablesideDescription.changeHref}?table=${encodeURIComponent(tableIdentifier)}`,
      }
    : undefined;
  const cart = createCartPageView(
    data.location,
    getCartMessages(fixtureRuntime.config.locale),
    selectedCart,
    tablesideDescription,
  );
  if (!selectedCart) {
    return <CartPage cart={cart} browseHref={browseHref} />;
  }
  const controller = expectedFixtureState ? (
    <CartController
      initialCart={selectedCart}
      runtime={{ mode: "fixture", runtime: fixtureRuntime }}
      locale={fixtureRuntime.config.locale}
      location={data.location}
      browseHref={browseHref}
      tablesideDescription={tablesideDescription}
    />
  ) : (
    <FixtureCartController
      initialCart={selectedCart}
      runtime={fixtureRuntime}
      locale={fixtureRuntime.config.locale}
      location={data.location}
      browseHref={browseHref}
      tablesideDescription={tablesideDescription}
    />
  );
  return expectedFixtureState ? (
    <FixtureTablesideCartGuard expectedState={expectedFixtureState}>
      {controller}
    </FixtureTablesideCartGuard>
  ) : (
    controller
  );
}
