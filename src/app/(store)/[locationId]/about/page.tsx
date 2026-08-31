import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { baseStorefrontLongFormContent } from "@/content/storefront-long-form";
import { CatalogErrorScreen } from "@/features/catalog/browse/catalog-error-screen";
import { BrowserNewsletterSignup } from "@/features/catalog/content/browser-newsletter-signup";
import { FixtureNewsletterSignup } from "@/features/catalog/content/fixture-newsletter-signup";
import { StorefrontLongForm } from "@/features/catalog/content/storefront-content";
import type { StorefrontLongFormData } from "@/features/catalog/content/storefront-long-form-data";
import {
  CatalogSourceError,
  fixtureCatalogSource,
} from "@/features/catalog/server/catalog-source";
import { loadStorefrontLongFormData } from "@/features/catalog/server/load-storefront-long-form";
import { CatalogNotFoundError } from "@/features/catalog/server/load-store-home";
import { readRequestStorefrontRuntime } from "@/lib/tenant/server-storefront-runtime";
import {
  createStorefrontPageMetadata,
  storefrontPrivateRobots,
} from "@/lib/tenant/storefront-seo";

interface AboutPageProps {
  params: Promise<{ locationId: string }>;
}

export async function generateMetadata({
  params,
}: AboutPageProps): Promise<Metadata> {
  const [runtime, { locationId }] = await Promise.all([
    readRequestStorefrontRuntime(),
    params,
  ]);
  return runtime?.mode === "live"
    ? createStorefrontPageMetadata(runtime.config, {
        pathname: `/${encodeURIComponent(locationId)}/about`,
        title: "About | Order online",
        description: "Learn about this restaurant and browse featured dishes.",
      })
    : { robots: storefrontPrivateRobots };
}

export default async function AboutPage({ params }: AboutPageProps) {
  const [{ locationId }, runtime] = await Promise.all([
    params,
    readRequestStorefrontRuntime(),
  ]);
  if (!runtime) notFound();

  const source = runtime.mode === "fixture"
    ? fixtureCatalogSource
    : await (
        await import(
          "@/features/catalog/server/storefront-catalog-source"
        )
      ).getStorefrontCatalogSource(runtime.config.locale);
  let data: StorefrontLongFormData;

  try {
    data = await loadStorefrontLongFormData(
      locationId,
      source,
      baseStorefrontLongFormContent,
    );
  } catch (error) {
    if (error instanceof CatalogNotFoundError) notFound();
    if (error instanceof CatalogSourceError) {
      return (
        <CatalogErrorScreen
          kind={error.kind === "rate-limited" ? "rate-limited" : "error"}
        />
      );
    }
    throw error;
  }

  return (
    <StorefrontLongForm
      content={baseStorefrontLongFormContent}
      data={data}
      newsletter={
        runtime.config.newsletter
          ? runtime.mode === "fixture"
            ? (
                <FixtureNewsletterSignup
                  copy={runtime.config.newsletter}
                  locale={runtime.config.locale}
                  runtime={runtime}
                />
              )
            : (
                <BrowserNewsletterSignup
                  copy={runtime.config.newsletter}
                  locale={runtime.config.locale}
                />
              )
          : undefined
      }
    />
  );
}
