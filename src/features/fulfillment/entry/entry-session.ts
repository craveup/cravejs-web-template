import type { StartOrderingSessionRequest } from "@craveup/storefront-sdk";

import { toStartOrderingSessionRequest } from "../sdk-contract";
import type { FulfillmentDetail } from "../types";
import type { EntryIntent } from "./resolve-entry-intent";

export interface EntrySessionBootstrapRequest {
  locationId: string;
  detail: FulfillmentDetail;
  payload: StartOrderingSessionRequest;
}

export type StartEntrySession = (
  request: EntrySessionBootstrapRequest,
) => Promise<{ detail: FulfillmentDetail }>;

export function createEntrySessionBootstrapRequest(
  locationId: string,
  intent: EntryIntent,
  existingCartId?: string | null,
): EntrySessionBootstrapRequest | null {
  if (intent.kind === "invalid") return null;

  return {
    locationId,
    detail: intent.detail,
    payload: toStartOrderingSessionRequest({
      mode: intent.detail.mode,
      existingCartId,
      channel: intent.kind === "direct" ? "web" : "qr",
    }),
  };
}
