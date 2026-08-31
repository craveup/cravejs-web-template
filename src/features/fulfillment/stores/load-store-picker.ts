import type { AccountPageRuntime } from "@/features/status/account-page";

import { loadStorePickerData } from "./store-picker-data";

export async function loadStorePicker(runtime: AccountPageRuntime) {
  if (runtime.mode === "fixture") {
    const [{ createFixtureStoreDirectory }, { readFixtureRuntimeFromEnvironment }] =
      await Promise.all([
        import("@/fixtures/store-directory"),
        import("@/fixtures/fixture-runtime"),
      ]);
    const fixtureRuntime = readFixtureRuntimeFromEnvironment();
    if (!fixtureRuntime) return null;
    return loadStorePickerData(
      runtime.merchantSlug,
      createFixtureStoreDirectory(fixtureRuntime),
    );
  }

  const { getStorefrontServerStoreDirectory } = await import(
    "@/lib/storefront/server-store-directory"
  );
  return loadStorePickerData(
    runtime.merchantSlug,
    await getStorefrontServerStoreDirectory(),
  );
}
