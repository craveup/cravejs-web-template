import type { Metadata, MetadataRoute } from "next";

import type { ResolvedStorefrontConfig } from "../../config/storefront-config";

interface StorefrontSeoRuntime {
  readonly mode: "fixture" | "live";
  readonly config: ResolvedStorefrontConfig;
}

const nonPublicRoutes = [
  "/account/",
  "/addresses",
  "/design-system-preview",
  "/fulfillment-preview",
  "/*/cart",
  "/*/checkout",
  "/*/fulfillment",
] as const;

export const storefrontPrivateRobots = {
  index: false,
  follow: false,
} as const;

export function createRestaurantStructuredData(
  config: ResolvedStorefrontConfig,
  location: Readonly<{
    id: string;
    name: string;
    addressLabel?: string;
  }>,
) {
  const url = new URL(
    `/${encodeURIComponent(location.id)}`,
    config.canonicalOrigin,
  ).href;
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: location.name,
    ...(location.addressLabel ? { address: location.addressLabel } : {}),
    url,
    hasMenu: url,
  } as const;
}

export function createStorefrontPageMetadata(
  config: ResolvedStorefrontConfig,
  page: Readonly<{
    pathname: `/${string}`;
    title: string;
    description: string;
  }>,
): Metadata {
  const canonical = new URL(page.pathname, config.canonicalOrigin).href;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: page.title,
      description: page.description,
    },
    robots: { index: true, follow: true },
  };
}

export function createStorefrontRobots(
  runtime: StorefrontSeoRuntime | null,
): MetadataRoute.Robots {
  if (!runtime || runtime.mode === "fixture") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...nonPublicRoutes],
    },
    sitemap: new URL("/sitemap.xml", runtime.config.canonicalOrigin).href,
  };
}

export function createStorefrontSitemap(
  config: ResolvedStorefrontConfig,
  locationIds: readonly string[],
): MetadataRoute.Sitemap {
  const origin = config.canonicalOrigin;
  const locations = Array.from(
    new Set(locationIds.filter((locationId) => locationId.length > 0)),
  ).sort();

  return [
    { url: new URL("/stores", origin).href },
    ...locations.flatMap((locationId) => {
      const path = `/${encodeURIComponent(locationId)}`;
      return [
        { url: new URL(path, origin).href },
        { url: new URL(`${path}/about`, origin).href },
      ];
    }),
  ];
}
