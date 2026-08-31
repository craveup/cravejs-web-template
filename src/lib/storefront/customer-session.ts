import {
  getActiveStorefrontMerchant,
} from "./session-store";
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

const customerRecordVersion = 1 as const;

interface CustomerSessionRecord {
  version: typeof customerRecordVersion;
  merchantSlug: string;
  jwt: string;
  savedAt: string;
}

export function customerSessionStorageKey(merchantSlug: string): string {
  return storefrontSessionStorageKey("customer", merchantSlug);
}

function isCustomerSessionRecord(
  value: unknown,
  merchantSlug: string,
): value is CustomerSessionRecord {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["version", "merchantSlug", "jwt", "savedAt"]) &&
    value.version === customerRecordVersion &&
    value.merchantSlug === merchantSlug &&
    isNonEmptyStoredString(value.jwt) &&
    isIsoTimestamp(value.savedAt)
  );
}

export function setCustomerToken(merchantSlug: string, jwt: string): void {
  if (
    !isNonEmptyStoredString(merchantSlug) ||
    !isNonEmptyStoredString(jwt)
  ) {
    throw new TypeError("Storefront customer session is invalid.");
  }

  const record: CustomerSessionRecord = {
    version: customerRecordVersion,
    merchantSlug,
    jwt,
    savedAt: new Date().toISOString(),
  };
  writeSessionRecord(customerSessionStorageKey(merchantSlug), record);
}

export function getCustomerToken(merchantSlug?: string): string | null {
  const scope = merchantSlug ?? getActiveStorefrontMerchant();
  if (!scope) return null;

  return (
    readSessionRecord(
      customerSessionStorageKey(scope),
      (value): value is CustomerSessionRecord =>
        isCustomerSessionRecord(value, scope),
    )?.jwt ?? null
  );
}

export function clearCustomerToken(merchantSlug?: string): void {
  const scope = merchantSlug ?? getActiveStorefrontMerchant();
  if (!scope) return;
  removeSessionRecord(customerSessionStorageKey(scope));
}
