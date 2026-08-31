import { isStorefrontProfile } from "../../config/storefront-profile";
import type {
  ResolvedStorefrontConfig,
} from "../../config/storefront-config";
import type { StorefrontRuntimeEnvironment } from "../../config/validate-storefront-config";
import {
  readFixtureRuntime,
  type FixtureRuntime,
} from "../../fixtures/fixture-runtime";
import { createHostedTenantResolver } from "./hosted-tenant-resolver";
import { createStandaloneTenantResolver } from "./standalone-tenant-resolver";
import type {
  HostedTenantRegistry,
  TenantResolutionRequest,
} from "./tenant-resolver";

export type StorefrontRuntime =
  | FixtureRuntime
  | {
      readonly mode: "live";
      readonly config: ResolvedStorefrontConfig;
    };

export class StorefrontRuntimeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorefrontRuntimeError";
  }
}

function readEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): StorefrontRuntimeEnvironment {
  const value = environment.NODE_ENV;
  if (value === "development" || value === "production" || value === "test") {
    return value;
  }

  throw new StorefrontRuntimeError(
    "Storefront runtime requires NODE_ENV to be development, production, or test.",
  );
}

function parseJsonEnvironmentValue(
  environment: Readonly<Record<string, string | undefined>>,
  field: "STOREFRONT_HOSTED_TENANTS_JSON" | "STOREFRONT_STANDALONE_CONFIG_JSON",
): unknown {
  const value = environment[field];
  if (!value) {
    throw new StorefrontRuntimeError(
      `Storefront profile requires ${field}.`,
    );
  }

  try {
    return JSON.parse(value) as unknown;
  } catch (cause) {
    throw new StorefrontRuntimeError(
      `Storefront profile could not parse ${field} as JSON.`,
      { cause },
    );
  }
}

function createEnvironmentHostedRegistry(
  value: unknown,
): HostedTenantRegistry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new StorefrontRuntimeError(
      "STOREFRONT_HOSTED_TENANTS_JSON must be a host-to-config object.",
    );
  }

  const tenants = value as Record<string, unknown>;
  return {
    async getByHost(host) {
      return Object.hasOwn(tenants, host) ? tenants[host] : null;
    },
  };
}

export async function resolveStorefrontRuntime(
  request: TenantResolutionRequest,
  processEnvironment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<StorefrontRuntime | null> {
  const environment = readEnvironment(processEnvironment);
  const fixtureRuntime = readFixtureRuntime(processEnvironment, environment);
  if (fixtureRuntime) {
    return fixtureRuntime;
  }

  const profile = processEnvironment.STOREFRONT_PROFILE;
  if (!isStorefrontProfile(profile)) {
    throw new StorefrontRuntimeError(
      "Live storefront runtime requires STOREFRONT_PROFILE to be hosted-multitenant or standalone-cli.",
    );
  }

  const resolver =
    profile === "hosted-multitenant"
      ? createHostedTenantResolver(
          createEnvironmentHostedRegistry(
            parseJsonEnvironmentValue(
              processEnvironment,
              "STOREFRONT_HOSTED_TENANTS_JSON",
            ),
          ),
          environment,
        )
      : createStandaloneTenantResolver(
          parseJsonEnvironmentValue(
            processEnvironment,
            "STOREFRONT_STANDALONE_CONFIG_JSON",
          ),
          environment,
        );
  const config = await resolver.resolve(request);

  if (
    config &&
    processEnvironment.NEXT_PUBLIC_CRAVEUP_API_URL !== config.apiBaseUrl
  ) {
    throw new StorefrontRuntimeError(
      "NEXT_PUBLIC_CRAVEUP_API_URL must exactly match the resolved storefront config apiBaseUrl so server and browser SDK clients share one public API origin.",
    );
  }

  return config ? { mode: "live", config } : null;
}
