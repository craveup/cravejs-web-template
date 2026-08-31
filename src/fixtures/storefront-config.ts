import type { ResolvedStorefrontConfig } from "../config/storefront-config";

export const fixtureProjectId =
  "123e4567-e89b-42d3-a456-426614174000" as const;

const sharedFixtureConfig = {
  merchantSlug: "fixture-base",
  canonicalOrigin: "https://fixture-base.example.test",
  apiBaseUrl: "https://api.example.test",
  assetOrigins: [],
  checkoutOrigins: ["https://checkout.fixture.example.test"],
  themeId: "base",
  locale: "en-US",
  timeZone: "America/Los_Angeles",
  templateRelease: "0.1.0",
  configSchemaVersion: "1.0.0",
  capabilities: {
    loyalty: false,
  },
  newsletter: {
    heading: "Stay in the loop",
    emailLabel: "Email address",
    submitLabel: "Subscribe",
    consentCopy: "Get restaurant news and offers in your inbox.",
    successMessage: "Thanks for subscribing.",
  },
} as const;

export const fixtureHostedConfig = {
  ...sharedFixtureConfig,
  profile: "hosted-multitenant",
  tenantId: "tenant-fixture-base",
  projectId: null,
} as const satisfies ResolvedStorefrontConfig;

export const fixtureStandaloneConfig = {
  ...sharedFixtureConfig,
  profile: "standalone-cli",
  tenantId: `standalone:${fixtureProjectId}`,
  projectId: fixtureProjectId,
} as const satisfies ResolvedStorefrontConfig;
