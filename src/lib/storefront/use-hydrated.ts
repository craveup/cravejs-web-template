"use client";

import { useSyncExternalStore } from "react";

const subscribeToHydration = () => () => undefined;

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
}
