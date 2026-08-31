import { notFound } from "next/navigation";

import { FulfillmentDetailsShell } from "@/features/fulfillment/details/fulfillment-details-shell";
import { ConnectedOrderTimePicker } from "@/features/fulfillment/time/connected-order-time-picker";
import { loadOrderTimes } from "@/features/fulfillment/time/load-order-times";
import { readAccountPageRuntime } from "@/features/status/account-page";
import { readFixtureRuntimeFromEnvironment } from "@/fixtures/fixture-runtime";

export default async function OrderTimePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ locationId: string }>;
  readonly searchParams: Promise<{ state?: string | string[] }>;
}) {
  const runtime = await readAccountPageRuntime();
  if (!runtime) notFound();
  const fixtureRuntime = readFixtureRuntimeFromEnvironment();
  const { locationId } = await params;
  const query = await searchParams;
  const data = await loadOrderTimes({
    locationId,
    locale: runtime.locale,
    timeZone: runtime.timeZone,
    mode: runtime.mode,
    forceClosed: fixtureRuntime !== null && query.state === "closed",
  });

  return (
    <FulfillmentDetailsShell brand="Your Restaurant" locationId={locationId}>
      <ConnectedOrderTimePicker
        allowAsap={data.allowAsap && data.state === "ready"}
        days={data.days}
        initialState={data.state}
        locationId={locationId}
        readinessReason={data.readinessReason}
        runtime={
          fixtureRuntime
            ? { mode: "fixture", runtime: fixtureRuntime }
            : { mode: "live", merchantSlug: runtime.merchantSlug }
        }
      />
    </FulfillmentDetailsShell>
  );
}
