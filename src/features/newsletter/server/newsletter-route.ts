import "server-only";

import type { StorefrontRuntime } from "../../../lib/tenant/storefront-runtime";

export interface NewsletterProviderAdapter {
  subscribe(input: {
    readonly tenantId: string;
    readonly email: string;
  }): Promise<void>;
}

export type NewsletterRateLimitDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterMs?: number };

export interface NewsletterRateLimitAdapter {
  check(tenantId: string): Promise<NewsletterRateLimitDecision>;
}

interface NewsletterRouteDependencies {
  readonly resolveRuntime: (
    headers: Headers,
  ) => Promise<StorefrontRuntime | null>;
  readonly provider: NewsletterProviderAdapter | null;
  readonly rateLimit: NewsletterRateLimitAdapter;
}

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
} as const;

function jsonResponse(
  body: unknown,
  status: number,
  retryAfter?: string,
): Response {
  const headers = new Headers(responseHeaders);
  if (retryAfter !== undefined) {
    headers.set("Retry-After", retryAfter);
  }

  return Response.json(body, { status, headers });
}

function unavailableResponse(): Response {
  return jsonResponse({ code: "NEWSLETTER_UNAVAILABLE" }, 503);
}

function invalidEmailResponse(): Response {
  return jsonResponse({ code: "INVALID_EMAIL" }, 400);
}

function readRetryAfter(decision: {
  readonly allowed: false;
  readonly retryAfterMs?: number;
}): string | undefined {
  const milliseconds = decision.retryAfterMs;
  if (
    milliseconds === undefined ||
    !Number.isInteger(milliseconds) ||
    milliseconds < 1_000 ||
    milliseconds > 3_600_000
  ) {
    return undefined;
  }

  return String(Math.ceil(milliseconds / 1_000));
}

function isValidEmail(email: string): boolean {
  if (email.length === 0 || email.length > 254 || /\s/.test(email)) {
    return false;
  }

  const addressParts = email.split("@");
  if (addressParts.length !== 2) {
    return false;
  }

  const [localPart, domain] = addressParts;
  const localSegments = localPart.split(".");
  const domainLabels = domain.split(".");

  return (
    localPart.length <= 64 &&
    localSegments.every((segment) =>
      /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+$/.test(segment),
    ) &&
    domainLabels.length >= 2 &&
    domainLabels.every(
      (label) =>
        label.length <= 63 &&
        /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label),
    )
  );
}

async function readEmail(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type");
  if (
    contentType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json"
  ) {
    return null;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }

  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "email") {
    return null;
  }

  const email = (body as Record<string, unknown>).email;
  if (typeof email !== "string") {
    return null;
  }

  const trimmedEmail = email.trim();
  return isValidEmail(trimmedEmail) ? trimmedEmail : null;
}

export function createNewsletterPostHandler(
  dependencies: NewsletterRouteDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const runtime = await dependencies.resolveRuntime(request.headers);
      if (!runtime?.config.newsletter) {
        return unavailableResponse();
      }

      const email = await readEmail(request);
      if (email === null) {
        return invalidEmailResponse();
      }

      if (!dependencies.provider) {
        return unavailableResponse();
      }

      const rateLimitDecision = await dependencies.rateLimit.check(
        runtime.config.tenantId,
      );
      if (!rateLimitDecision.allowed) {
        return jsonResponse(
          { code: "RATE_LIMITED" },
          429,
          readRetryAfter(rateLimitDecision),
        );
      }

      await dependencies.provider.subscribe({
        tenantId: runtime.config.tenantId,
        email,
      });
      return jsonResponse({ status: "subscribed" }, 200);
    } catch {
      return unavailableResponse();
    }
  };
}
