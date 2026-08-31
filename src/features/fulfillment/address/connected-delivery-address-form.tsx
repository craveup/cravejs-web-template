"use client";

import { DeliveryAddressForm } from "./delivery-address-form";
import {
  applyDeliveryAddress,
  type DeliveryAddressRuntime,
} from "./delivery-address-runtime";
import type { DeliveryPolicy } from "./serviceability";

export function ConnectedDeliveryAddressForm({
  googleMapsApiKey,
  locationId,
  policy,
  runtime,
}: {
  readonly googleMapsApiKey?: string;
  readonly locationId: string;
  readonly policy: DeliveryPolicy;
  readonly runtime: DeliveryAddressRuntime;
}) {
  return (
    <DeliveryAddressForm
      googleMapsApiKey={googleMapsApiKey}
      policy={policy}
      onSubmitAddress={async ({ sdkAddress }) => {
        const result = await applyDeliveryAddress(runtime, locationId, sdkAddress);
        if (result.state === "retry-required") {
          throw Object.assign(new Error(result.error?.message ?? "Cart conflict."), {
            code: "CART_CONFLICT",
          });
        }
        return result.cart;
      }}
    />
  );
}
