import { themeIds } from "../styles/themes";
import {
  validateStorefrontLocale,
  validateStorefrontTimeZone,
} from "./storefront-regional-semantics.mjs";
import {
  storefrontConfigSchemaVersion,
  type ResolvedStorefrontConfig,
  type StorefrontCapabilities,
  type StorefrontNewsletterConfig,
} from "./storefront-config";
import { isStorefrontProfile } from "./storefront-profile";

export type StorefrontRuntimeEnvironment =
  | "development"
  | "production"
  | "test";

export class StorefrontConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorefrontConfigError";
  }
}

const configFields = new Set([
  "profile",
  "tenantId",
  "projectId",
  "merchantSlug",
  "canonicalOrigin",
  "apiBaseUrl",
  "assetOrigins",
  "checkoutOrigins",
  "themeId",
  "locale",
  "timeZone",
  "templateRelease",
  "configSchemaVersion",
  "capabilities",
  "newsletter",
]);

const newsletterFields = [
  "heading",
  "emailLabel",
  "submitLabel",
  "consentCopy",
  "successMessage",
] as const;
const newsletterFieldSet: ReadonlySet<string> = new Set(newsletterFields);
const newsletterFieldMaximumLengths: Readonly<
  Record<keyof StorefrontNewsletterConfig, number>
> = {
  heading: 120,
  emailLabel: 120,
  submitLabel: 120,
  consentCopy: 500,
  successMessage: 500,
};

const themeIdSet: ReadonlySet<string> = new Set(themeIds);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function fail(field: string, reason: string): never {
  throw new StorefrontConfigError(`Invalid storefront config field "${field}": ${reason}.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(
  record: Record<string, unknown>,
  field: string,
): string {
  const value = record[field];

  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    fail(field, "expected a non-empty string without surrounding whitespace");
  }

  return value;
}

function validateUrl(
  value: string,
  field: string,
  environment: StorefrontRuntimeEnvironment,
  originOnly: boolean,
  httpsOnly = environment === "production",
): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    fail(field, "expected an absolute URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    fail(field, "expected an HTTP(S) URL");
  }
  if (httpsOnly && url.protocol !== "https:") {
    fail(field, "expected an HTTPS URL");
  }
  if (!url.hostname || url.hostname.includes("*")) {
    fail(field, "wildcard or missing hosts are not allowed");
  }
  if (url.username || url.password) {
    fail(field, "credentials are not allowed in URLs");
  }
  if (url.search || url.hash) {
    fail(field, "query strings and fragments are not allowed");
  }
  if (originOnly && value !== url.origin) {
    fail(field, "expected an exact origin without a path");
  }

  return value;
}

function validateOrigins(
  value: unknown,
  field: "assetOrigins" | "checkoutOrigins",
  environment: StorefrontRuntimeEnvironment,
  allowEmpty: boolean,
): readonly string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail(
      field,
      allowEmpty
        ? "expected an array of exact HTTPS origins"
        : "expected at least one exact HTTPS origin",
    );
  }

  const origins = value.map((origin) => {
    if (typeof origin !== "string") {
      fail(field, "every origin must be a string");
    }

    return validateUrl(origin, field, environment, true, true);
  });

  if (new Set(origins).size !== origins.length) {
    fail(field, "duplicate origins are not allowed");
  }

  return origins;
}

function validateCapabilities(value: unknown): StorefrontCapabilities {
  if (!isRecord(value)) {
    fail("capabilities", "expected an object");
  }

  const fields = Object.keys(value);
  if (fields.length !== 1 || fields[0] !== "loyalty") {
    fail("capabilities", "only the loyalty capability is supported");
  }
  if (typeof value.loyalty !== "boolean") {
    fail("capabilities.loyalty", "expected a boolean");
  }

  return { loyalty: value.loyalty };
}

function validateNewsletter(value: unknown): StorefrontNewsletterConfig | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    fail("newsletter", "expected null or an object");
  }

  const fields = Object.keys(value);
  if (
    fields.length !== newsletterFields.length ||
    fields.some((field) => !newsletterFieldSet.has(field))
  ) {
    fail("newsletter", "expected exactly the supported public copy fields");
  }

  const readField = (
    field: keyof StorefrontNewsletterConfig,
  ): string => {
    const copy = value[field];
    if (
      typeof copy !== "string" ||
      copy.length === 0 ||
      copy.trim() !== copy ||
      copy.length > newsletterFieldMaximumLengths[field]
    ) {
      fail(
        `newsletter.${field}`,
        `expected a trimmed, non-empty string up to ${newsletterFieldMaximumLengths[field]} characters`,
      );
    }

    return copy;
  };

  return {
    heading: readField("heading"),
    emailLabel: readField("emailLabel"),
    submitLabel: readField("submitLabel"),
    consentCopy: readField("consentCopy"),
    successMessage: readField("successMessage"),
  };
}

function validateLocale(value: string): string {
  try {
    return validateStorefrontLocale(value);
  } catch {
    fail("locale", "expected a valid BCP 47 locale");
  }
}

function validateTimeZone(value: string): string {
  try {
    return validateStorefrontTimeZone(value);
  } catch {
    fail("timeZone", "expected a valid IANA time zone");
  }
}

export function validateStorefrontConfig(
  input: unknown,
  environment: StorefrontRuntimeEnvironment,
): ResolvedStorefrontConfig {
  if (!isRecord(input)) {
    throw new StorefrontConfigError("Storefront config must be an object.");
  }

  for (const field of Object.keys(input)) {
    if (!configFields.has(field)) {
      throw new StorefrontConfigError(
        `Unsupported storefront config field "${field}".`,
      );
    }
  }

  if (!isStorefrontProfile(input.profile)) {
    fail("profile", "expected hosted-multitenant or standalone-cli");
  }
  if (!["development", "production", "test"].includes(environment)) {
    throw new StorefrontConfigError("Invalid storefront runtime environment.");
  }

  const tenantId = readNonEmptyString(input, "tenantId");
  const merchantSlug = readNonEmptyString(input, "merchantSlug");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(merchantSlug)) {
    fail("merchantSlug", "expected a lowercase URL-safe slug");
  }

  const canonicalOrigin = validateUrl(
    readNonEmptyString(input, "canonicalOrigin"),
    "canonicalOrigin",
    environment,
    true,
  );
  const apiBaseUrl = validateUrl(
    readNonEmptyString(input, "apiBaseUrl"),
    "apiBaseUrl",
    environment,
    true,
  );
  const assetOrigins = validateOrigins(
    input.assetOrigins,
    "assetOrigins",
    environment,
    true,
  );
  const checkoutOrigins = validateOrigins(
    input.checkoutOrigins,
    "checkoutOrigins",
    environment,
    false,
  );
  const themeId = readNonEmptyString(input, "themeId");
  if (!themeIdSet.has(themeId)) {
    fail("themeId", "expected a supported generated theme");
  }

  const locale = validateLocale(readNonEmptyString(input, "locale"));
  const timeZone = validateTimeZone(readNonEmptyString(input, "timeZone"));
  const templateRelease = readNonEmptyString(input, "templateRelease");
  if (!semverPattern.test(templateRelease)) {
    fail("templateRelease", "expected an exact semantic version");
  }
  if (input.configSchemaVersion !== storefrontConfigSchemaVersion) {
    fail("configSchemaVersion", `expected ${storefrontConfigSchemaVersion}`);
  }

  let projectId: string | null;
  if (input.profile === "hosted-multitenant") {
    if (input.projectId !== null) {
      fail("projectId", "hosted profiles require null");
    }
    projectId = null;
  } else {
    if (typeof input.projectId !== "string" || !uuidPattern.test(input.projectId)) {
      fail("projectId", "standalone profiles require an RFC 4122 UUID");
    }
    projectId = input.projectId;
    if (tenantId !== `standalone:${projectId}`) {
      fail("tenantId", "must match the immutable standalone project namespace");
    }
  }

  return {
    profile: input.profile,
    tenantId,
    projectId,
    merchantSlug,
    canonicalOrigin,
    apiBaseUrl,
    assetOrigins,
    checkoutOrigins,
    themeId,
    locale,
    timeZone,
    templateRelease,
    configSchemaVersion: storefrontConfigSchemaVersion,
    capabilities: validateCapabilities(input.capabilities),
    newsletter: validateNewsletter(input.newsletter),
  };
}
