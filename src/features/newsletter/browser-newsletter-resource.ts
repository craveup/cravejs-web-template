"use client";

import {
  createNewsletterResource,
  type NewsletterResource,
  type NewsletterTransportOutcome,
} from "./newsletter-resource";

const newsletterPath = "/api/storefront/newsletter";
const maximumRetryAfterSeconds = 60 * 60;

function hasExactEntry(
  value: unknown,
  key: "code" | "status",
  expected: string,
): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    (value as Record<string, unknown>)[key] === expected
  );
}

function readRetryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter || !/^[1-9]\d{0,3}$/.test(retryAfter)) return undefined;

  const seconds = Number(retryAfter);
  return seconds <= maximumRetryAfterSeconds ? seconds * 1_000 : undefined;
}

async function submitNewsletter(email: string): Promise<NewsletterTransportOutcome> {
  let response: Response;
  try {
    response = await fetch(newsletterPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    return { status: "error" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: "error" };
  }

  if (response.status === 200 && hasExactEntry(body, "status", "subscribed")) {
    return { status: "success" };
  }
  if (response.status === 400 && hasExactEntry(body, "code", "INVALID_EMAIL")) {
    return { status: "invalid" };
  }
  if (response.status === 429 && hasExactEntry(body, "code", "RATE_LIMITED")) {
    const retryAfterMs = readRetryAfterMs(response);
    return retryAfterMs === undefined
      ? { status: "rate-limited" }
      : { status: "rate-limited", retryAfterMs };
  }
  if (
    response.status === 503 &&
    hasExactEntry(body, "code", "NEWSLETTER_UNAVAILABLE")
  ) {
    return { status: "error" };
  }

  return { status: "error" };
}

export function createBrowserNewsletterResource(): NewsletterResource {
  return createNewsletterResource(submitNewsletter);
}
