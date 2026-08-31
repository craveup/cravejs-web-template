import {
  StorefrontConfigError,
  validateStorefrontConfig,
  type StorefrontRuntimeEnvironment,
} from "../../config/validate-storefront-config";
import type {
  HostedTenantRegistry,
  TenantResolver,
} from "./tenant-resolver";

function normalizeHost(value: string): string | null {
  if (!value || value.trim() !== value || value.length > 253) {
    return null;
  }
  if (
    value.includes("*") ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("@") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    return null;
  }

  try {
    const url = new URL(`http://${value.toLowerCase()}`);
    const hostname = url.hostname.endsWith(".")
      ? url.hostname.slice(0, -1)
      : url.hostname;

    return hostname && !hostname.includes("*") ? hostname : null;
  } catch {
    return null;
  }
}

export function createHostedTenantResolver(
  registry: HostedTenantRegistry,
  environment: StorefrontRuntimeEnvironment,
): TenantResolver {
  return {
    async resolve(request) {
      const host = normalizeHost(request.host);
      if (!host) {
        return null;
      }

      const registryConfig = await registry.getByHost(host);
      if (registryConfig === null) {
        return null;
      }

      const config = validateStorefrontConfig(registryConfig, environment);
      if (config.profile !== "hosted-multitenant") {
        throw new StorefrontConfigError(
          "Hosted tenant registry must resolve a hosted-multitenant config.",
        );
      }

      return config;
    },
  };
}
