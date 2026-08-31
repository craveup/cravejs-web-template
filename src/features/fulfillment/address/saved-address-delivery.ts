import type { CustomerAddress, StorefrontCart } from "@craveup/storefront-sdk";

import { toSdkDeliveryAddress } from "../sdk-contract";
import type { NormalizedAddress } from "../types";
import {
  applyDeliveryAddress,
  type DeliveryAddressRuntime,
} from "./delivery-address-runtime";
import { evaluateServiceability, type DeliveryPolicy } from "./serviceability";

export class SavedAddressSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SavedAddressSelectionError";
  }
}

export async function applySavedAddressToDelivery(input: Readonly<{
  address: CustomerAddress;
  locationId: string;
  policy: DeliveryPolicy;
  runtime: DeliveryAddressRuntime;
  normalize: (address: CustomerAddress) => Promise<NormalizedAddress>;
}>): Promise<StorefrontCart> {
  let normalized: NormalizedAddress;
  try {
    normalized = await input.normalize(input.address);
  } catch {
    throw new SavedAddressSelectionError(
      "This saved address could not be verified. Choose a new delivery address.",
    );
  }

  const serviceability = evaluateServiceability(normalized, input.policy);
  if (!serviceability.serviceable) {
    throw new SavedAddressSelectionError(
      `This saved address is outside ${input.policy.policyLabel}.`,
    );
  }
  const conversion = toSdkDeliveryAddress(normalized);
  if (!conversion.ready) {
    throw new SavedAddressSelectionError(
      "This saved address is incomplete. Choose a new delivery address.",
    );
  }

  try {
    const result = await applyDeliveryAddress(
      input.runtime,
      input.locationId,
      conversion.address,
    );
    if (result.state === "retry-required") {
      throw new SavedAddressSelectionError(
        "Your order changed. Review the current cart, then select the address again.",
      );
    }
    return result.cart;
  } catch (error) {
    if (error instanceof SavedAddressSelectionError) throw error;
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    throw new SavedAddressSelectionError(
      code === "CART_EXPIRED" || code === "NOT_FOUND"
        ? "Your ordering session expired. Return to the menu to start again."
        : "This saved address could not be applied. Review the cart and try again.",
    );
  }
}
