import { notFound } from "next/navigation";

import { ConnectedTableConfirmation } from "@/features/fulfillment/details/connected-fulfillment-details";
import { FulfillmentDetailsShell } from "@/features/fulfillment/details/fulfillment-details-shell";
import { loadFulfillmentDetailsPage } from "@/features/fulfillment/details/load-fulfillment-details-page";
import { readAccountPageRuntime } from "@/features/status/account-page";
import { readFixtureRuntimeFromEnvironment } from "@/fixtures/fixture-runtime";

export default async function TablePage({
  params,
  searchParams,
}: PageProps<"/[locationId]/fulfillment/table">) {
  const runtime = await readAccountPageRuntime();
  if (!runtime) notFound();
  const [{ locationId }, query] = await Promise.all([params, searchParams]);
  if (Array.isArray(query.table)) notFound();
  const data = await loadFulfillmentDetailsPage({
    locationId,
    runtime,
    fixtureRuntime: readFixtureRuntimeFromEnvironment(),
  });
  if (!data) notFound();
  const initialTableIdentifier = query.table?.trim();

  return (
    <FulfillmentDetailsShell brand={data.brand} locationId={locationId}>
      <ConnectedTableConfirmation
        {...(initialTableIdentifier ? { initialTableIdentifier } : {})}
        locationId={locationId}
        locationLabel={data.locationLabel}
        runtime={data.runtime}
      />
    </FulfillmentDetailsShell>
  );
}
