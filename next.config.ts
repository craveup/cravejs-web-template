import type { NextConfig } from "next";

interface StorefrontSecurityPolicyInput {
  readonly apiOrigin?: string;
  readonly assetOrigins: readonly string[];
  readonly development: boolean;
}

interface StorefrontResponseHeader {
  readonly key: string;
  readonly value: string;
}

function exactHttpsOrigin(value: string, field: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${field} must contain absolute HTTPS origins.`);
  }

  if (url.protocol !== "https:" || value !== url.origin) {
    throw new Error(`${field} must contain exact HTTPS origins.`);
  }
  return url.origin;
}

function exactApiOrigin(value: string, development: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("apiOrigin must be an absolute HTTP(S) origin.");
  }

  const loopback = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  const allowedProtocol =
    url.protocol === "https:" ||
    (development && url.protocol === "http:" && loopback.has(url.hostname));
  if (!allowedProtocol || value !== url.origin) {
    throw new Error(
      "apiOrigin must be exact HTTPS, except for an exact development loopback origin.",
    );
  }
  return url.origin;
}

function uniqueOrigins(values: readonly string[], field: string): string[] {
  return Array.from(
    new Set(values.map((value) => exactHttpsOrigin(value, field))),
  ).sort();
}

export function createStorefrontSecurityPolicy({
  apiOrigin,
  assetOrigins,
  development,
}: StorefrontSecurityPolicyInput): string {
  const connectSources = [
    "'self'",
    ...(apiOrigin ? [exactApiOrigin(apiOrigin, development)] : []),
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
    "https://places.googleapis.com",
  ];
  const imageSources = [
    "'self'",
    "data:",
    "blob:",
    ...uniqueOrigins(assetOrigins, "assetOrigins"),
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
  ];

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""} https://maps.googleapis.com https://maps.gstatic.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src ${imageSources.join(" ")}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSources.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function createStorefrontSecurityHeaders(
  input: StorefrontSecurityPolicyInput,
): readonly StorefrontResponseHeader[] {
  return [
    {
      key: "Content-Security-Policy",
      value: createStorefrontSecurityPolicy(input),
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
    },
    ...(input.development
      ? []
      : [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]),
  ];
}

export function readConfiguredAssetOrigins(
  environment: Readonly<Record<string, string | undefined>>,
  profile: string | undefined,
): readonly string[] {
  const selectedConfig =
    profile === "hosted-multitenant"
      ? environment.STOREFRONT_HOSTED_TENANTS_JSON
      : profile === "standalone-cli"
        ? environment.STOREFRONT_STANDALONE_CONFIG_JSON
        : undefined;
  const serializedConfigs = selectedConfig ? [selectedConfig] : [];
  const origins: string[] = [];

  for (const serialized of serializedConfigs) {
    let value: unknown;
    try {
      value = JSON.parse(serialized) as unknown;
    } catch {
      throw new Error("Storefront profile configuration must be valid JSON.");
    }

    const records =
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      "profile" in value
        ? [value]
        : typeof value === "object" && value !== null && !Array.isArray(value)
          ? Object.values(value)
          : [];
    for (const record of records) {
      if (
        typeof record === "object" &&
        record !== null &&
        "assetOrigins" in record &&
        Array.isArray(record.assetOrigins)
      ) {
        origins.push(
          ...record.assetOrigins.filter(
            (origin: unknown): origin is string => typeof origin === "string",
          ),
        );
      }
    }
  }

  return uniqueOrigins(origins, "assetOrigins");
}

const development = process.env.NODE_ENV === "development";
const assetOrigins = readConfiguredAssetOrigins(
  process.env,
  process.env.STOREFRONT_PROFILE,
);
const apiOrigin = process.env.NEXT_PUBLIC_CRAVEUP_API_URL;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: assetOrigins.map((origin) => {
      const url = new URL(origin);
      return {
        protocol: "https" as const,
        hostname: url.hostname,
        port: url.port,
        pathname: "/**",
      };
    }),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...createStorefrontSecurityHeaders({
          apiOrigin,
          assetOrigins,
          development,
        })],
      },
    ];
  },
};

export default nextConfig;
