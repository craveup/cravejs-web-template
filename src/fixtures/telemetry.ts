import type {
  RequestConfig,
  StorefrontAnalyticsEventRequest,
  StorefrontAnalyticsEventResponse,
} from "@craveup/storefront-sdk";

import {
  createStorefrontTelemetryActions,
  type StorefrontTelemetryClient,
  type StorefrontTelemetryPolicy,
} from "@/lib/storefront/telemetry";

import type { FixtureRuntime } from "./fixture-runtime";

export interface FixtureStorefrontTelemetryEvent {
  locationId: string;
  payload: StorefrontAnalyticsEventRequest;
  config?: RequestConfig;
}

export interface FixtureStorefrontTelemetry {
  actions: ReturnType<typeof createStorefrontTelemetryActions>;
  events(): readonly FixtureStorefrontTelemetryEvent[];
}

export function createFixtureStorefrontTelemetry(
  runtime: FixtureRuntime,
  policy: StorefrontTelemetryPolicy,
): FixtureStorefrontTelemetry {
  const recordedEvents: FixtureStorefrontTelemetryEvent[] = [];
  const client = {
    analyticsEvents: {
      async track(
        locationId: string,
        payload: StorefrontAnalyticsEventRequest,
        config?: RequestConfig,
      ): Promise<StorefrontAnalyticsEventResponse> {
        recordedEvents.push({ locationId, payload, config });
        return { status: "accepted" };
      },
    },
  } satisfies StorefrontTelemetryClient;

  return {
    actions: createStorefrontTelemetryActions(
      client,
      {
        profile: runtime.config.profile,
        tenantId: runtime.config.tenantId,
        merchantSlug: runtime.config.merchantSlug,
      },
      policy,
      { setMerchantScope: () => undefined },
    ),
    events: () => structuredClone(recordedEvents),
  };
}
