import type { ResolvedStorefrontConfig } from "../config/storefront-config";
import { isStorefrontProfile } from "../config/storefront-profile";
import type { StorefrontRuntimeEnvironment } from "../config/validate-storefront-config";
import { fixtureModeLabel } from "./fixture-mode";
import {
  fixtureHostedConfig,
  fixtureStandaloneConfig,
} from "./storefront-config";

export { createFixtureStorefrontActions } from "./storefront-actions";
export {
  createFixtureStorefrontCheckoutActions,
  type FixtureCheckoutPrepareScenario,
  type FixtureStorefrontCheckoutOptions,
} from "./checkout-actions";
export { createFixtureStorefrontLoyaltyActions } from "./loyalty-actions";
export { createFixtureStorefrontTelemetry } from "./telemetry";

export interface FixtureRuntimeOptions {
  profile: unknown;
  tenant: unknown;
}

export interface FixtureRuntime {
  mode: "fixture";
  label: typeof fixtureModeLabel;
  networkPolicy: "deny";
  tenant: "fixture-base";
  config: ResolvedStorefrontConfig;
}

export class FixtureRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FixtureRuntimeError";
  }
}

export function resolveFixtureRuntime(
  options: FixtureRuntimeOptions,
  environment: StorefrontRuntimeEnvironment,
): FixtureRuntime {
  if (environment === "production") {
    throw new FixtureRuntimeError(
      "Fixture mode is unavailable in production.",
    );
  }
  if (!isStorefrontProfile(options.profile)) {
    throw new FixtureRuntimeError("Fixture mode requires a supported profile.");
  }
  if (options.tenant !== "fixture-base") {
    throw new FixtureRuntimeError(
      "Fixture mode requires the canonical fixture-base tenant.",
    );
  }

  const config =
    options.profile === "hosted-multitenant"
      ? fixtureHostedConfig
      : fixtureStandaloneConfig;
  return {
    mode: "fixture",
    label: fixtureModeLabel,
    networkPolicy: "deny",
    tenant: "fixture-base",
    config,
  };
}

export function readFixtureRuntime(
  processEnvironment: Readonly<Record<string, string | undefined>>,
  environment: StorefrontRuntimeEnvironment,
): FixtureRuntime | null {
  const mode = processEnvironment.STOREFRONT_RUNTIME_MODE;
  if (mode === undefined) {
    return null;
  }
  if (mode !== "fixture") {
    throw new FixtureRuntimeError("Unknown storefront runtime mode.");
  }
  if (processEnvironment.STOREFRONT_FIXTURE_NETWORK !== "deny") {
    throw new FixtureRuntimeError(
      "Fixture mode requires the deny-network policy.",
    );
  }

  return resolveFixtureRuntime(
    {
      profile: processEnvironment.STOREFRONT_PROFILE,
      tenant: processEnvironment.STOREFRONT_FIXTURE_TENANT,
    },
    environment,
  );
}

export function readFixtureRuntimeFromEnvironment(
  processEnvironment: Readonly<Record<string, string | undefined>> = process.env,
): FixtureRuntime | null {
  const environment = processEnvironment.NODE_ENV;
  if (
    environment !== "development" &&
    environment !== "production" &&
    environment !== "test"
  ) {
    throw new FixtureRuntimeError(
      "Fixture runtime requires a supported Node environment.",
    );
  }

  return readFixtureRuntime(processEnvironment, environment);
}
