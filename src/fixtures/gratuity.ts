import type { WaiterTipConfigResponse } from "@craveup/storefront-sdk";

export const fixtureGratuityConfig = {
  enabled: true,
  shouldAllowCustomTip: true,
  tipPercentage: ["15", "18", "20"],
  defaultTipPercentage: "18",
  description: "Tips are optional and go to the restaurant team.",
} satisfies WaiterTipConfigResponse;
