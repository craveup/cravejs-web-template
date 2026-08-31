import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StorefrontHeader } from "@/components/shell/storefront-header";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { ItemDetailClient } from "@/features/catalog/product/item-detail-client";
import type { ProductCartRuntime } from "@/features/catalog/product/product-cart-runtime";
import { readAccountPageRuntime } from "@/features/status/account-page";
import {
  CatalogSourceError,
  createFixtureCatalogSource,
} from "@/features/catalog/server/catalog-source";
import { readFixtureRuntimeFromEnvironment } from "@/fixtures/fixture-runtime";
import {
  CatalogItemNotFoundError,
  loadItemRouteData,
} from "@/features/catalog/server/load-item-route";
import { CatalogNotFoundError } from "@/features/catalog/server/load-store-home";
import { readRequestStorefrontRuntime } from "@/lib/tenant/server-storefront-runtime";
import {
  createStorefrontPageMetadata,
  storefrontPrivateRobots,
} from "@/lib/tenant/storefront-seo";

interface ItemPageProps {
  params: Promise<{ locationId: string; productId: string }>;
}

export async function generateMetadata({
  params,
}: ItemPageProps): Promise<Metadata> {
  const [runtime, { locationId, productId }] = await Promise.all([
    readRequestStorefrontRuntime(),
    params,
  ]);
  return runtime?.mode === "live"
    ? createStorefrontPageMetadata(runtime.config, {
        pathname: `/${encodeURIComponent(locationId)}/items/${encodeURIComponent(productId)}`,
        title: "Menu item | Order online",
        description: "Review this menu item, available options, and availability.",
      })
    : { robots: storefrontPrivateRobots };
}

export default async function ItemPage({ params }: ItemPageProps) {
  const { locationId, productId } = await params;
  const fixtureRuntime = readFixtureRuntimeFromEnvironment();
  const sharedRuntime = await readAccountPageRuntime();
  if (!sharedRuntime) notFound();
  const catalogMode = fixtureRuntime ? "fixture" : "live";
  const source = fixtureRuntime
    ? createFixtureCatalogSource(sharedRuntime.locale)
    : await (
        await import(
          "@/features/catalog/server/storefront-catalog-source"
        )
      ).getStorefrontCatalogSource(sharedRuntime.locale);
  let routeData;

  try {
    routeData = await loadItemRouteData(locationId, productId, source);
  } catch (error) {
    if (error instanceof CatalogNotFoundError || error instanceof CatalogItemNotFoundError) {
      notFound();
    }
    if (error instanceof CatalogSourceError) throw error;
    throw error;
  }

  const menuHref = `/${encodeURIComponent(locationId)}#menu`;
  const cartRuntime: ProductCartRuntime | undefined = fixtureRuntime
    ? { mode: "fixture", runtime: fixtureRuntime }
    : sharedRuntime?.mode === "live"
      ? { mode: "live", merchantSlug: sharedRuntime.merchantSlug }
      : undefined;
  return (
    <StorefrontShell
      variant="item"
      header={
        <StorefrontHeader
          brand={routeData.store.location.name}
          brandHref={menuHref}
          items={[{ id: "menu", label: "Menu", href: menuHref }]}
          addressLabel={routeData.store.location.addressLabel}
          cartLabel="Cart"
        />
      }
    >
      <ItemDetailClient
        locationId={locationId}
        productId={productId}
        menuHref={menuHref}
        similarItems={routeData.similarItems}
        recommendations={routeData.recommendations}
        catalogMode={catalogMode}
        locale={sharedRuntime.locale}
        cartRuntime={cartRuntime}
        categoryId={routeData.item.categoryId}
      />
    </StorefrontShell>
  );
}
