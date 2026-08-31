import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogErrorScreen } from "@/features/catalog/browse/catalog-error-screen";
import { resolveStoreVariant } from "@/features/catalog/browse/resolve-store-variant";
import { StoreHome } from "@/features/catalog/browse/store-home";
import {
  createCatalogSearchIndex,
  type StoreHomeData,
} from "@/features/catalog/catalog-types";
import { CatalogSearch } from "@/features/catalog/search/search-results";
import { EntryBanner } from "@/features/fulfillment/entry/entry-banner";
import { EntrySessionBootstrap } from "@/features/fulfillment/entry/entry-session-bootstrap";
import { resolveEntryIntent } from "@/features/fulfillment/entry/resolve-entry-intent";
import { readFixtureRuntimeFromEnvironment } from "@/fixtures/fixture-runtime";
import { CatalogSourceError } from "@/features/catalog/server/catalog-source";
import {
  CatalogNotFoundError,
  loadDemoStoreHomeData,
  loadStoreHomeData,
} from "@/features/catalog/server/load-store-home";
import { getStorefrontCatalogSource } from "@/features/catalog/server/storefront-catalog-source";
import { readAccountPageRuntime } from "@/features/status/account-page";
import { readRequestStorefrontRuntime } from "@/lib/tenant/server-storefront-runtime";
import {
  createRestaurantStructuredData,
  createStorefrontPageMetadata,
  storefrontPrivateRobots,
} from "@/lib/tenant/storefront-seo";

interface StorePageProps {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{
    q?: string | string[];
    variant?: string | string[];
    table?: string | string[];
    room?: string | string[];
    theme?: string | string[];
  }>;
}

export async function generateMetadata({
  params,
}: StorePageProps): Promise<Metadata> {
  const [runtime, { locationId }] = await Promise.all([
    readRequestStorefrontRuntime(),
    params,
  ]);
  return runtime?.mode === "live"
    ? createStorefrontPageMetadata(runtime.config, {
        pathname: `/${encodeURIComponent(locationId)}`,
        title: "Menu | Order online",
        description: "Browse the menu and start your order.",
      })
    : { robots: storefrontPrivateRobots };
}

export default async function StorePage({ params, searchParams }: StorePageProps) {
  const fixtureRuntime = readFixtureRuntimeFromEnvironment();
  const pageRuntime = await readAccountPageRuntime();
  if (!pageRuntime) notFound();

  const { locationId } = await params;
  const query = await searchParams;
  const queryParam = query.q;
  const initialQuery = Array.isArray(queryParam) ? queryParam[0] : queryParam;
  const variant = resolveStoreVariant(locationId, query.variant);
  const intent = resolveEntryIntent(query);

  let outcome: { data: StoreHomeData } | { error: "error" | "rate-limited" };
  try {
    outcome = {
      data: fixtureRuntime
        ? await loadDemoStoreHomeData(locationId)
        : await loadStoreHomeData(
            locationId,
            await getStorefrontCatalogSource(pageRuntime.locale),
          ),
    };
  } catch (error) {
    if (error instanceof CatalogNotFoundError) notFound();
    if (error instanceof CatalogSourceError) {
      outcome = { error: error.kind === "rate-limited" ? "rate-limited" : "error" };
    } else {
      throw error;
    }
  }

  if ("error" in outcome) return <CatalogErrorScreen kind={outcome.error} />;

  const { data } = outcome;
  const requestRuntime = await readRequestStorefrontRuntime();
  const structuredData = requestRuntime?.mode === "live"
    ? createRestaurantStructuredData(requestRuntime.config, data.location)
    : null;
  return (
    <>
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      <StoreHome
        data={data}
        variant={variant}
        entryContextSlot={
          <>
            <EntryBanner intent={intent} locationId={locationId} />
            <EntrySessionBootstrap
              intent={intent}
              locationId={locationId}
              locale={pageRuntime.locale}
              runtime={
                fixtureRuntime
                  ? { kind: "fixture", runtime: fixtureRuntime }
                  : { kind: "live", merchantSlug: pageRuntime.merchantSlug }
              }
            />
          </>
        }
        fulfillmentMode={intent.kind === "invalid" ? "takeout" : intent.detail.mode}
        searchSlot={
          <CatalogSearch index={createCatalogSearchIndex(data)} initialQuery={initialQuery} />
        }
      />
    </>
  );
}
