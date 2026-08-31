import { notFound } from "next/navigation";

import { ConnectedDeliveryAddressForm } from "@/features/fulfillment/address/connected-delivery-address-form";
import { FulfillmentDetailsShell } from "@/features/fulfillment/details/fulfillment-details-shell";
import { loadDeliveryAddressPage } from "@/features/fulfillment/address/load-delivery-address-page";
import { readAccountPageRuntime } from "@/features/status/account-page";
import { readFixtureRuntimeFromEnvironment } from "@/fixtures/fixture-runtime";

export default async function DeliveryAddressPage({
  params,
}: PageProps<"/[locationId]/fulfillment/address">) {
  const runtime = await readAccountPageRuntime();
  if (!runtime) notFound();
  const { locationId } = await params;
  const data = await loadDeliveryAddressPage({
    locationId,
    runtime,
    fixtureRuntime: readFixtureRuntimeFromEnvironment(),
  });
  if (!data) notFound();
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

  return (
    <FulfillmentDetailsShell brand={data.brand} locationId={locationId}>
      <ConnectedDeliveryAddressForm
        {...(googleMapsApiKey ? { googleMapsApiKey } : {})}
        locationId={locationId}
        policy={data.policy}
        runtime={data.runtime}
      />
    </FulfillmentDetailsShell>
  );
}
