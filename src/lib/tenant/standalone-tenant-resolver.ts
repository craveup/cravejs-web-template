import {
  StorefrontConfigError,
  validateStorefrontConfig,
  type StorefrontRuntimeEnvironment,
} from "../../config/validate-storefront-config";
import type { TenantResolver } from "./tenant-resolver";

export function createStandaloneTenantResolver(
  generatedConfig: unknown,
  environment: StorefrontRuntimeEnvironment,
): TenantResolver {
  const config = validateStorefrontConfig(generatedConfig, environment);
  if (config.profile !== "standalone-cli") {
    throw new StorefrontConfigError(
      "Standalone tenant resolver requires a standalone-cli config.",
    );
  }

  return {
    async resolve() {
      return config;
    },
  };
}
