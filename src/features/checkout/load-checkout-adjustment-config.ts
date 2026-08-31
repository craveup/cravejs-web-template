import "server-only";

import type { WaiterTipConfigResponse } from "@craveup/storefront-sdk";

export type CheckoutGratuityState =
  | Readonly<{ state: "available"; config: WaiterTipConfigResponse }>
  | Readonly<{ state: "unavailable" }>;

export async function loadCheckoutAdjustmentConfig(
  locationId: string,
  mode: "fixture" | "live",
): Promise<CheckoutGratuityState> {
  if (mode === "fixture") {
    const { fixtureGratuityConfig } = await import("@/fixtures/gratuity");
    return { state: "available", config: fixtureGratuityConfig };
  }
  const { storefrontServerClient } = await import(
    "@/lib/storefront/server-client"
  );
  try {
    return {
      state: "available",
      config: await storefrontServerClient.locations.getGratuity(locationId),
    };
  } catch {
    return { state: "unavailable" };
  }
}
