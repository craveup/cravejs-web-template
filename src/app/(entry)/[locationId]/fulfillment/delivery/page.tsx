import { DeliveryHandoff } from "@/features/fulfillment/address/delivery-handoff";

export default async function DeliveryDetailsPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;
  return <DeliveryHandoff locationId={locationId} />;
}
