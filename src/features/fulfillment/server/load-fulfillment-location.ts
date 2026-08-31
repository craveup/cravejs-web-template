import "server-only";

import type { StorefrontLocation } from "@craveup/storefront-sdk";

import type { FixtureRuntime } from "@/fixtures/fixture-runtime";

export async function resolveLiveFulfillmentLocation(
  locationId: string,
  getById: (locationId: string) => Promise<StorefrontLocation>,
): Promise<StorefrontLocation | null> {
  try {
    return await getById(locationId);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "NOT_FOUND"
    ) {
      return null;
    }
    throw error;
  }
}

export async function loadFulfillmentLocation(
  locationId: string,
  fixtureRuntime: FixtureRuntime | null,
): Promise<StorefrontLocation | null> {
  if (fixtureRuntime) {
    const { fixtureLocation } = await import("@/fixtures/location");
    return locationId === fixtureLocation.id ? fixtureLocation : null;
  }
  const { storefrontServerClient } = await import(
    "@/lib/storefront/server-client"
  );
  return resolveLiveFulfillmentLocation(
    locationId,
    storefrontServerClient.locations.getById.bind(
      storefrontServerClient.locations,
    ),
  );
}
