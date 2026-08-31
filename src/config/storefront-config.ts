import type { StorefrontProfile } from "./storefront-profile";

export const storefrontConfigSchemaVersion = "1.0.0" as const;

export interface StorefrontCapabilities {
  loyalty: boolean;
}

export interface StorefrontNewsletterConfig {
  readonly heading: string;
  readonly emailLabel: string;
  readonly submitLabel: string;
  readonly consentCopy: string;
  readonly successMessage: string;
}

export interface ResolvedStorefrontConfig {
  profile: StorefrontProfile;
  tenantId: string;
  projectId: string | null;
  merchantSlug: string;
  canonicalOrigin: string;
  apiBaseUrl: string;
  assetOrigins: readonly string[];
  checkoutOrigins: readonly string[];
  themeId: string;
  locale: string;
  timeZone: string;
  templateRelease: string;
  configSchemaVersion: typeof storefrontConfigSchemaVersion;
  capabilities: StorefrontCapabilities;
  readonly newsletter: StorefrontNewsletterConfig | null;
}
