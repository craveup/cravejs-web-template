"use client";

import { useState } from "react";

import type { CheckoutAdjustmentRuntime } from "./checkout-adjustment-runtime";
import {
  CheckoutIdentity,
  type CheckoutIdentityResult,
} from "./checkout-identity";
import { PickupCheckoutPreflight } from "./pickup-checkout-preflight";
import type { CheckoutGratuityState } from "./load-checkout-adjustment-config";
import type { CheckoutOrderTimes } from "./scheduling/checkout-scheduling";
import type { OrderTimeRuntime } from "@/features/fulfillment/time/order-time-runtime";
import type { StorefrontHostedCheckoutConfig } from "./hosted-checkout-integration";
import type { CheckoutHandoffRuntime } from "./secure-checkout-action";
import { TablesideCheckoutPreflight } from "./tableside-checkout-preflight";

export interface CheckoutIdentityRouteProps {
  readonly merchantSlug: string;
  readonly locale: string;
  readonly mode: "fixture" | "live";
  readonly backHref: string;
  readonly locationId: string;
  readonly locationAddress?: string;
  readonly tableIdentifier?: string;
  readonly adjustmentRuntime: CheckoutAdjustmentRuntime;
  readonly checkoutConfig: StorefrontHostedCheckoutConfig;
  readonly handoffRuntime: CheckoutHandoffRuntime;
  readonly gratuity: CheckoutGratuityState;
  readonly orderTimes?: CheckoutOrderTimes;
  readonly orderTimeRuntime?: OrderTimeRuntime;
}

export function CheckoutIdentityRoute(props: CheckoutIdentityRouteProps) {
  const scopeKey = JSON.stringify([
    props.merchantSlug,
    props.locationId,
    props.tableIdentifier ?? null,
    props.checkoutConfig.checkoutOrigins,
  ]);
  return <ScopedCheckoutIdentityRoute key={scopeKey} {...props} />;
}

function ScopedCheckoutIdentityRoute(props: CheckoutIdentityRouteProps) {
  const [identity, setIdentity] = useState<CheckoutIdentityResult | null>(null);

  if (identity) {
    if (props.tableIdentifier) {
      return (
        <TablesideCheckoutPreflight
          backHref={props.backHref}
          checkoutConfig={props.checkoutConfig}
          handoffRuntime={props.handoffRuntime}
          identity={identity}
          locale={props.locale}
          locationId={props.locationId}
          merchantSlug={props.merchantSlug}
          mode={props.mode}
          tableIdentifier={props.tableIdentifier}
        />
      );
    }
    if (!props.orderTimes || !props.orderTimeRuntime) {
      throw new TypeError("Pickup checkout scheduling configuration is required.");
    }
    return (
      <PickupCheckoutPreflight
        adjustmentRuntime={props.adjustmentRuntime}
        backHref={props.backHref}
        gratuity={props.gratuity}
        identity={identity}
        locationAddress={props.locationAddress}
        locationId={props.locationId}
        locale={props.locale}
        merchantSlug={props.merchantSlug}
        mode={props.mode}
        orderTimes={props.orderTimes}
        orderTimeRuntime={props.orderTimeRuntime}
      />
    );
  }
  return (
    <CheckoutIdentity
      merchantSlug={props.merchantSlug}
      locale={props.locale}
      mode={props.mode}
      backHref={props.backHref}
      {...(props.tableIdentifier ? { tableIdentifier: props.tableIdentifier } : {})}
      onComplete={setIdentity}
    />
  );
}
