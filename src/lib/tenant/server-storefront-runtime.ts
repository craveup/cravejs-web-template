import "server-only";

import { headers } from "next/headers";

import { readFixtureRuntimeFromEnvironment } from "../../fixtures/fixture-runtime";
import {
  resolveStorefrontRuntime,
  type StorefrontRuntime,
} from "./storefront-runtime";

interface RequestHeaders {
  get(name: string): string | null;
}

export async function readRequestStorefrontRuntime(
  processEnvironment: Readonly<Record<string, string | undefined>> = process.env,
  providedHeaders?: RequestHeaders,
): Promise<StorefrontRuntime | null> {
  const fixtureRuntime = readFixtureRuntimeFromEnvironment(processEnvironment);
  if (fixtureRuntime) {
    return fixtureRuntime;
  }

  const requestHeaders = providedHeaders ?? (await headers());
  return resolveStorefrontRuntime(
    {
      host: requestHeaders.get("host") ?? "",
      pathname: "/",
    },
    processEnvironment,
  );
}
