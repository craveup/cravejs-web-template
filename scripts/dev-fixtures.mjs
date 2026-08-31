import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";

import { fixtureModeLabel } from "../src/fixtures/fixture-mode.ts";

const require = createRequire(import.meta.url);
const supportedProfiles = new Set([
  "hosted-multitenant",
  "standalone-cli",
]);

export const fixtureCliModeLabel = fixtureModeLabel;

export function parseFixtureCliArgs(args) {
  const values = new Map();

  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];

    if (option !== "--profile" && option !== "--tenant") {
      throw new Error(`Unknown fixture option "${String(option)}".`);
    }
    if (values.has(option)) {
      throw new Error(`Fixture option "${option}" is duplicated.`);
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`Fixture option "${option}" requires a value.`);
    }

    values.set(option, value);
  }

  const profile = values.get("--profile");
  const tenant = values.get("--tenant");
  if (!profile) {
    throw new Error("Fixture development requires --profile.");
  }
  if (!supportedProfiles.has(profile)) {
    throw new Error(`Unsupported fixture profile "${profile}".`);
  }
  if (!tenant) {
    throw new Error("Fixture development requires --tenant.");
  }
  if (tenant !== "fixture-base") {
    throw new Error(`Unsupported fixture tenant "${tenant}".`);
  }

  return { profile, tenant };
}

export function assertFixtureDevelopmentEnvironment(nodeEnvironment) {
  if (nodeEnvironment === "production") {
    throw new Error("Fixture development cannot run in production.");
  }
}

export function buildFixtureProcessEnvironment(options, baseEnvironment) {
  return {
    ...baseEnvironment,
    STOREFRONT_RUNTIME_MODE: "fixture",
    STOREFRONT_PROFILE: options.profile,
    STOREFRONT_FIXTURE_TENANT: options.tenant,
    STOREFRONT_FIXTURE_NETWORK: "deny",
    // Explicitly override ambient .env keys so offline fixtures never load Places.
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "",
  };
}

export function buildFixtureDevelopmentArgs(nextBin) {
  return [nextBin, "dev", "--webpack", "--hostname", "127.0.0.1"];
}

export async function startFixtureDevelopment(
  options,
  baseEnvironment = process.env,
) {
  assertFixtureDevelopmentEnvironment(baseEnvironment.NODE_ENV);

  const nextBin = require.resolve("next/dist/bin/next");
  const child = spawn(process.execPath, buildFixtureDevelopmentArgs(nextBin), {
    cwd: process.cwd(),
    env: buildFixtureProcessEnvironment(options, baseEnvironment),
    stdio: "inherit",
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };
  const onInterrupt = () => forwardSignal("SIGINT");
  const onTerminate = () => forwardSignal("SIGTERM");
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);

  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      process.removeListener("SIGINT", onInterrupt);
      process.removeListener("SIGTERM", onTerminate);
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

const isMainModule =
  process.argv[1] !== undefined &&
  resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  try {
    const options = parseFixtureCliArgs(process.argv.slice(2));
    console.log(fixtureCliModeLabel);
    console.log(`Profile: ${options.profile} | Tenant: ${options.tenant}`);
    process.exitCode = await startFixtureDevelopment(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    console.error(`Fixture development failed: ${message}`);
    process.exitCode = 1;
  }
}
