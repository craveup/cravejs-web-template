import type {
  StorefrontCartSession,
  StorefrontSessionStore,
} from "@craveup/storefront-sdk";

import {
  hasExactKeys,
  isIsoTimestamp,
  isNonEmptyStoredString,
  isRecord,
  readSessionRecord,
  removeSessionRecord,
  storefrontSessionStorageKey,
  writeSessionRecord,
} from "./session-storage";

const cartRecordVersion = 1 as const;

// This is a stale browser-record ceiling, not the authoritative API cart expiry.
export const CART_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CartSessionRecord {
  version: typeof cartRecordVersion;
  merchantSlug: string;
  locationId: string;
  cartId: string;
  capability?: string;
  revision: number;
  savedAt: string;
}

let activeMerchantSlug: string | null = null;

export function setActiveStorefrontMerchant(merchantSlug: string | null): void {
  if (merchantSlug !== null && !isNonEmptyStoredString(merchantSlug)) {
    throw new TypeError("Storefront merchant scope must be a non-empty string.");
  }

  activeMerchantSlug = typeof window === "undefined" ? null : merchantSlug;
}

export function getActiveStorefrontMerchant(): string | null {
  return activeMerchantSlug;
}

export function cartSessionStorageKey(
  merchantSlug: string,
  locationId: string,
): string {
  return storefrontSessionStorageKey("cart", merchantSlug, locationId);
}

function isCartSessionRecord(
  value: unknown,
  merchantSlug: string,
  locationId: string,
  now: number,
): value is CartSessionRecord {
  if (!isRecord(value)) return false;

  const hasCapability = Object.hasOwn(value, "capability");
  const expectedKeys = [
    "version",
    "merchantSlug",
    "locationId",
    "cartId",
    ...(hasCapability ? ["capability"] : []),
    "revision",
    "savedAt",
  ];
  if (!hasExactKeys(value, expectedKeys)) return false;
  if (
    value.version !== cartRecordVersion ||
    value.merchantSlug !== merchantSlug ||
    value.locationId !== locationId ||
    !isNonEmptyStoredString(value.cartId) ||
    (hasCapability && !isNonEmptyStoredString(value.capability)) ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 0 ||
    !isIsoTimestamp(value.savedAt)
  ) {
    return false;
  }

  const savedAt = Date.parse(value.savedAt);
  return savedAt <= now && now - savedAt <= CART_SESSION_MAX_AGE_MS;
}

function requireCartSessionInput(
  session: StorefrontCartSession,
): asserts session is StorefrontCartSession {
  if (
    !isNonEmptyStoredString(session.locationId) ||
    !isNonEmptyStoredString(session.cartId) ||
    (session.accessToken !== undefined &&
      !isNonEmptyStoredString(session.accessToken)) ||
    !Number.isSafeInteger(session.revision) ||
    session.revision < 0
  ) {
    throw new TypeError("Storefront cart session is invalid.");
  }
}

function getCartSessionForMerchant(
  merchantSlug: string,
  locationId: string,
): StorefrontCartSession | null {
  if (
    !isNonEmptyStoredString(merchantSlug) ||
    !isNonEmptyStoredString(locationId)
  ) {
    return null;
  }

  const record = readSessionRecord(
    cartSessionStorageKey(merchantSlug, locationId),
    (value): value is CartSessionRecord =>
      isCartSessionRecord(value, merchantSlug, locationId, Date.now()),
  );
  if (!record) return null;

  return {
    merchantSlug: record.merchantSlug,
    locationId: record.locationId,
    cartId: record.cartId,
    ...(record.capability ? { accessToken: record.capability } : {}),
    revision: record.revision,
  };
}

function getCartSession(locationId: string): StorefrontCartSession | null {
  return activeMerchantSlug
    ? getCartSessionForMerchant(activeMerchantSlug, locationId)
    : null;
}

function setCartSessionForMerchant(
  merchantSlug: string,
  session: StorefrontCartSession,
): void {
  requireCartSessionInput(session);
  if (typeof window === "undefined") return;

  if (!isNonEmptyStoredString(merchantSlug)) {
    throw new TypeError("Storefront merchant scope is required before cart storage.");
  }
  if (session.merchantSlug && session.merchantSlug !== merchantSlug) {
    throw new TypeError("Storefront cart session merchant scope does not match.");
  }

  const record: CartSessionRecord = {
    version: cartRecordVersion,
    merchantSlug,
    locationId: session.locationId,
    cartId: session.cartId,
    ...(session.accessToken ? { capability: session.accessToken } : {}),
    revision: session.revision,
    savedAt: new Date().toISOString(),
  };
  writeSessionRecord(
    cartSessionStorageKey(merchantSlug, session.locationId),
    record,
  );
}

function setCartSession(session: StorefrontCartSession): void {
  if (typeof window === "undefined") return;
  const merchantSlug = session.merchantSlug ?? activeMerchantSlug;
  if (!merchantSlug) {
    throw new TypeError("Storefront merchant scope is required before cart storage.");
  }
  setCartSessionForMerchant(merchantSlug, session);
}

function clearActiveCartSession(locationId: string): void {
  if (!activeMerchantSlug || !isNonEmptyStoredString(locationId)) return;
  clearCartSession(activeMerchantSlug, locationId);
}

export function clearCartSession(
  merchantSlug: string,
  locationId: string,
): void {
  removeSessionRecord(cartSessionStorageKey(merchantSlug, locationId));
}

export const browserCartSessionStore = {
  get: getCartSession,
  set: setCartSession,
  clear: clearActiveCartSession,
} satisfies StorefrontSessionStore;

export function createMerchantCartSessionStore(
  merchantSlug: string,
): StorefrontSessionStore {
  if (!isNonEmptyStoredString(merchantSlug)) {
    throw new TypeError("Storefront merchant scope must be a non-empty string.");
  }
  return {
    get: (locationId) => getCartSessionForMerchant(merchantSlug, locationId),
    set: (session) => setCartSessionForMerchant(merchantSlug, session),
    clear: (locationId) => clearCartSession(merchantSlug, locationId),
  };
}
