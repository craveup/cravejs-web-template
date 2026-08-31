import {
  createNewsletterResource,
  type NewsletterResource,
  type NewsletterTransportOutcome,
} from "@/features/newsletter/newsletter-resource";

import type { FixtureRuntime } from "./fixture-runtime";

export type FixtureNewsletterScenario =
  | "success"
  | "invalid"
  | "rate-limited"
  | "unavailable";

export interface FixtureStorefrontNewsletterOptions {
  readonly scenario?: FixtureNewsletterScenario;
}

const fixtureNewsletterOutcomes = {
  success: { status: "success" },
  invalid: { status: "invalid" },
  "rate-limited": { status: "rate-limited", retryAfterMs: 60_000 },
  unavailable: { status: "error" },
} as const satisfies Record<FixtureNewsletterScenario, NewsletterTransportOutcome>;

/**
 * Creates a zero-network newsletter resource for fixture presentation. The
 * default succeeds; scenarios exist only for local fixture composition.
 */
export function createFixtureStorefrontNewsletterResource(
  runtime: FixtureRuntime,
  options: FixtureStorefrontNewsletterOptions = {},
): NewsletterResource {
  const scenario = options.scenario ?? "success";

  return createNewsletterResource(() =>
    runtime.config.newsletter
      ? fixtureNewsletterOutcomes[scenario]
      : fixtureNewsletterOutcomes.unavailable,
  );
}
