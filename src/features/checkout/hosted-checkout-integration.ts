import type { ResolvedStorefrontConfig } from "@/config/storefront-config";
import type { StorefrontCheckoutActions } from "@/lib/storefront/checkout-actions";

import {
  createHostedCheckoutHandoff,
  type CreateHostedCheckoutHandoffInput,
  type HostedCheckoutHandoff,
  type PrepareCheckout,
} from "./hosted-checkout";

export type StorefrontHostedCheckoutConfig = Readonly<
  Pick<ResolvedStorefrontConfig, "merchantSlug" | "checkoutOrigins">
>;

export type CreateStorefrontHostedCheckoutHandoffInput = Omit<
  CreateHostedCheckoutHandoffInput,
  "checkoutOrigins" | "prepareCheckout"
> &
  Readonly<{
    config: StorefrontHostedCheckoutConfig;
    checkoutActions: StorefrontCheckoutActions;
  }>;

export function createStorefrontHostedCheckoutHandoff(
  input: CreateStorefrontHostedCheckoutHandoffInput,
): HostedCheckoutHandoff {
  const merchantSlug = input.config.merchantSlug;
  const prepareCheckout: PrepareCheckout = (prepareInput) =>
    input.checkoutActions.prepare({
      merchantSlug,
      locationId: prepareInput.locationId,
      cartId: prepareInput.cartId,
      revision: prepareInput.revision,
      idempotencyKey: prepareInput.idempotencyKey,
    });

  return createHostedCheckoutHandoff({
    checkoutOrigins: input.config.checkoutOrigins,
    prepareCheckout,
    navigateTopLevel: input.navigateTopLevel,
    ...(input.now ? { now: input.now } : {}),
    ...(input.scheduleWork ? { scheduleWork: input.scheduleWork } : {}),
  });
}
