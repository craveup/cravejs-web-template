"use client";

import type { FulfillmentDetail, FulfillmentMode } from "../types";
import { ModePicker } from "./mode-picker";
import {
  switchFulfillmentMode,
  type ModeSwitchRuntime,
} from "./mode-switch-runtime";

export function ConnectedModePicker({
  detail,
  enabledModes,
  locationId,
  runtime,
}: {
  readonly detail: FulfillmentDetail;
  readonly enabledModes: readonly FulfillmentMode[];
  readonly locationId: string;
  readonly runtime: ModeSwitchRuntime;
}) {
  return (
    <ModePicker
      detail={detail}
      enabledModes={enabledModes}
      locationId={locationId}
      onRequestMode={(request) =>
        switchFulfillmentMode(runtime, locationId, request.requestedMode)
      }
    />
  );
}
