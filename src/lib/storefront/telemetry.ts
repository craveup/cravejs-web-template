import {
  StorefrontAnalyticsEvents,
  type RequestConfig,
  type StorefrontAnalyticsEvent,
  type StorefrontAnalyticsEventRequest,
  type StorefrontAnalyticsEventResponse,
} from "@craveup/storefront-sdk";

import {
  isStorefrontProfile,
  type StorefrontProfile,
} from "@/config/storefront-profile";

import { isStorefrontIdempotencyKey } from "./action-input";
import {
  toStorefrontErrorState,
  type StorefrontErrorState,
} from "./error-state";

export type StorefrontTelemetryConsent = "granted" | "denied" | "unknown";

export interface StorefrontTelemetryPolicy {
  getConsent(): StorefrontTelemetryConsent;
  shouldSample(event: {
    eventType: StorefrontAnalyticsEvent;
    profile: StorefrontProfile;
  }): boolean;
}

export interface StorefrontTelemetryClient {
  analyticsEvents: {
    track(
      locationId: string,
      payload: StorefrontAnalyticsEventRequest,
      config?: RequestConfig,
    ): Promise<StorefrontAnalyticsEventResponse>;
  };
}

export interface StorefrontTelemetryContext {
  profile: StorefrontProfile;
  tenantId: string;
  merchantSlug: string;
}

export interface StorefrontTelemetrySessionAdapters {
  setMerchantScope(merchantSlug: string): void;
}

export interface TrackStorefrontTelemetryInput {
  locationId: string;
  cartId: string;
  eventType: StorefrontAnalyticsEvent;
  routeTemplate?: string;
  idempotencyKey: string;
}

export type TrackStorefrontTelemetryResult =
  | { state: "accepted" }
  | {
      state: "skipped";
      reason:
        | "consent-not-granted"
        | "policy-unavailable"
        | "sampled-out";
    }
  | { state: "failed"; error: StorefrontErrorState };

export interface StorefrontTelemetryActions {
  track(
    input: TrackStorefrontTelemetryInput,
  ): Promise<TrackStorefrontTelemetryResult>;
}

const allowedEvents = new Set<unknown>(Object.values(StorefrontAnalyticsEvents));
const maximumIdentifierLength = 128;
const safeIdentifierPattern = /^[A-Za-z0-9:_-]+$/;
const safeMerchantSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedRouteTemplates = new Set([
  "/:locationId",
  "/:locationId/fulfillment",
  "/:locationId/cart",
  "/:locationId/checkout",
]);

function validationError(code: string): TrackStorefrontTelemetryResult {
  return {
    state: "failed",
    error: {
      state: "validation",
      code,
      message: "The telemetry request is invalid.",
    },
  };
}

function isSafeIdentifier(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= maximumIdentifierLength &&
    value.trim() === value &&
    safeIdentifierPattern.test(value)
  );
}

function isSafeRouteTemplate(value: string): boolean {
  return allowedRouteTemplates.has(value);
}

function validateInput(
  input: TrackStorefrontTelemetryInput,
): TrackStorefrontTelemetryResult | null {
  if (!allowedEvents.has(input.eventType)) {
    return validationError("INVALID_TELEMETRY_EVENT");
  }
  if (!isSafeIdentifier(input.locationId)) {
    return validationError("INVALID_LOCATION_ID");
  }
  if (!isSafeIdentifier(input.cartId)) {
    return validationError("INVALID_CART_ID");
  }
  if (
    input.routeTemplate !== undefined &&
    !isSafeRouteTemplate(input.routeTemplate)
  ) {
    return validationError("INVALID_ROUTE_TEMPLATE");
  }
  if (!isStorefrontIdempotencyKey(input.idempotencyKey)) {
    return validationError("INVALID_IDEMPOTENCY_KEY");
  }

  return null;
}

function isValidContext(context: StorefrontTelemetryContext): boolean {
  return (
    isStorefrontProfile(context.profile) &&
    isSafeIdentifier(context.tenantId) &&
    context.merchantSlug.length <= maximumIdentifierLength &&
    safeMerchantSlugPattern.test(context.merchantSlug)
  );
}

export function createStorefrontTelemetryActions(
  client: StorefrontTelemetryClient,
  context: StorefrontTelemetryContext,
  policy: StorefrontTelemetryPolicy,
  sessions: StorefrontTelemetrySessionAdapters,
): StorefrontTelemetryActions {
  return {
    async track(input) {
      if (!isValidContext(context)) {
        return validationError("INVALID_TELEMETRY_CONTEXT");
      }
      const invalid = validateInput(input);
      if (invalid) return invalid;

      let consent: StorefrontTelemetryConsent;
      try {
        consent = policy.getConsent();
      } catch {
        return { state: "skipped", reason: "policy-unavailable" };
      }
      if (consent !== "granted") {
        return { state: "skipped", reason: "consent-not-granted" };
      }

      let sampleDecision: unknown;
      try {
        sampleDecision = policy.shouldSample({
          eventType: input.eventType,
          profile: context.profile,
        });
      } catch {
        return { state: "skipped", reason: "policy-unavailable" };
      }
      if (sampleDecision === false) {
        return { state: "skipped", reason: "sampled-out" };
      }
      if (sampleDecision !== true) {
        return { state: "skipped", reason: "policy-unavailable" };
      }

      const metadata = {
        profile: context.profile,
        tenantId: context.tenantId,
        ...(input.routeTemplate
          ? { routeTemplate: input.routeTemplate }
          : {}),
      };

      try {
        sessions.setMerchantScope(context.merchantSlug);
        await client.analyticsEvents.track(
          input.locationId,
          {
            cartId: input.cartId,
            eventType: input.eventType,
            metadata,
          },
          { idempotencyKey: input.idempotencyKey },
        );
        return { state: "accepted" };
      } catch (error) {
        return { state: "failed", error: toStorefrontErrorState(error) };
      }
    },
  };
}
