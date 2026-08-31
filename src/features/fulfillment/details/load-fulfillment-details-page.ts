import "server-only";

import type { AccountPageRuntime } from "@/features/status/account-page";
import type { FixtureRuntime } from "@/fixtures/fixture-runtime";

import { loadFulfillmentLocation } from "../server/load-fulfillment-location";
import type { FulfillmentDetailsRuntime } from "./fulfillment-details-runtime";

export async function loadFulfillmentDetailsPage(input: Readonly<{
  locationId: string;
  runtime: AccountPageRuntime;
  fixtureRuntime: FixtureRuntime | null;
}>): Promise<
  | Readonly<{
      brand: string;
      locationLabel: string;
      runtime: FulfillmentDetailsRuntime;
    }>
  | null
> {
  const location = await loadFulfillmentLocation(
    input.locationId,
    input.fixtureRuntime,
  );
  if (!location) return null;
  if (location.restaurantSlug !== input.runtime.merchantSlug) return null;
  return {
    brand: location.restaurantDisplayName,
    locationLabel: location.addressString,
    runtime: input.fixtureRuntime
      ? { mode: "fixture", runtime: input.fixtureRuntime }
      : { mode: "live", merchantSlug: input.runtime.merchantSlug },
  };
}
