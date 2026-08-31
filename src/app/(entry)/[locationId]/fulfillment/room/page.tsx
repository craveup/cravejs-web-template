import { notFound } from "next/navigation";

import { ConnectedRoomForm } from "@/features/fulfillment/details/connected-fulfillment-details";
import { FulfillmentDetailsShell } from "@/features/fulfillment/details/fulfillment-details-shell";
import { loadFulfillmentDetailsPage } from "@/features/fulfillment/details/load-fulfillment-details-page";
import { readAccountPageRuntime } from "@/features/status/account-page";
import { readFixtureRuntimeFromEnvironment } from "@/fixtures/fixture-runtime";

export default async function RoomPage({
  params,
  searchParams,
}: PageProps<"/[locationId]/fulfillment/room">) {
  const runtime = await readAccountPageRuntime();
  if (!runtime) notFound();
  const [{ locationId }, query] = await Promise.all([params, searchParams]);
  if (Array.isArray(query.room)) notFound();
  const data = await loadFulfillmentDetailsPage({
    locationId,
    runtime,
    fixtureRuntime: readFixtureRuntimeFromEnvironment(),
  });
  if (!data) notFound();
  const initialRoomIdentifier = query.room?.trim();

  return (
    <FulfillmentDetailsShell brand={data.brand} locationId={locationId}>
      <ConnectedRoomForm
        {...(initialRoomIdentifier ? { initialRoomIdentifier } : {})}
        locationId={locationId}
        runtime={data.runtime}
      />
    </FulfillmentDetailsShell>
  );
}
