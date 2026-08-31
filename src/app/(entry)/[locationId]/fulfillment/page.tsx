import { notFound } from "next/navigation";

import { FulfillmentDetailsShell } from "@/features/fulfillment/details/fulfillment-details-shell";
import { ConnectedModePicker } from "@/features/fulfillment/mode/connected-mode-picker";
import { loadStorePicker } from "@/features/fulfillment/stores/load-store-picker";
import { readAccountPageRuntime } from "@/features/status/account-page";
import { readFixtureRuntimeFromEnvironment } from "@/fixtures/fixture-runtime";

export default async function FulfillmentModePage({
  params,
}: {
  readonly params: Promise<{ locationId: string }>;
}) {
  const runtime = await readAccountPageRuntime();
  if (!runtime) notFound();
  const { locationId } = await params;
  const directory = await loadStorePicker(runtime);
  const store = directory?.stores.find((candidate) => candidate.id === locationId);
  const enabledModes = store?.enabledModes ?? [];
  if (!directory || !store || enabledModes.length === 0) notFound();
  const fixtureRuntime = readFixtureRuntimeFromEnvironment();

  return (
    <FulfillmentDetailsShell brand={directory.merchantName} locationId={locationId}>
      <ConnectedModePicker
        detail={{ mode: enabledModes[0] ?? "takeout" }}
        enabledModes={enabledModes}
        locationId={locationId}
        runtime={
          fixtureRuntime
            ? { mode: "fixture", runtime: fixtureRuntime }
            : { mode: "live", merchantSlug: runtime.merchantSlug }
        }
      />
    </FulfillmentDetailsShell>
  );
}
