const publicApiUrlEnvironmentVariable = "NEXT_PUBLIC_CRAVEUP_API_URL";
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export class StorefrontClientConfigError extends Error {
  constructor(reason: string) {
    super(
      `Invalid ${publicApiUrlEnvironmentVariable}: ${reason}. Configure an exact public Storefront API origin.`,
    );
    this.name = "StorefrontClientConfigError";
  }
}

function fail(reason: string): never {
  throw new StorefrontClientConfigError(reason);
}

export function resolveStorefrontApiBaseUrl(
  value: string | undefined = process.env.NEXT_PUBLIC_CRAVEUP_API_URL,
): string {
  if (typeof value !== "string" || value.length === 0) {
    fail("a value is required");
  }
  if (value.trim() !== value) {
    fail("surrounding whitespace is not allowed");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail("the value must be an absolute HTTP(S) URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    fail("the value must use HTTP(S)");
  }
  if (!url.hostname || url.hostname.includes("*")) {
    fail("wildcard or missing hosts are not allowed");
  }
  if (url.username || url.password) {
    fail("credentials are not allowed");
  }
  if (url.protocol !== "https:" && !loopbackHosts.has(url.hostname)) {
    fail("HTTPS is required except for exact loopback development hosts");
  }
  if (value !== url.origin) {
    fail("paths, query strings, fragments, and trailing slashes are not allowed");
  }

  return url.origin;
}
