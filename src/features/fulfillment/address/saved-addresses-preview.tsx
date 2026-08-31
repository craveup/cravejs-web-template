"use client";

import {
  SavedAddresses,
  type SavedAddress,
} from "./saved-addresses";
import type { DeliveryPolicy } from "./serviceability";

export interface SavedAddressesPreviewProps {
  addresses: readonly SavedAddress[];
  policy: DeliveryPolicy;
  selectedId?: string;
}

export function SavedAddressesPreview(props: SavedAddressesPreviewProps) {
  return (
    <SavedAddresses
      {...props}
      onCreate={() => undefined}
      onSelect={() => undefined}
    />
  );
}
