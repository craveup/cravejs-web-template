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

const receiptRecordVersion = 1 as const;

interface ReceiptSessionRecord {
  version: typeof receiptRecordVersion;
  receiptId: string;
  token: string;
  savedAt: string;
}

export function receiptSessionStorageKey(receiptId: string): string {
  return storefrontSessionStorageKey("receipt", receiptId);
}

function isReceiptSessionRecord(
  value: unknown,
  receiptId: string,
): value is ReceiptSessionRecord {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["version", "receiptId", "token", "savedAt"]) &&
    value.version === receiptRecordVersion &&
    value.receiptId === receiptId &&
    isNonEmptyStoredString(value.token) &&
    isIsoTimestamp(value.savedAt)
  );
}

export function setReceiptToken(receiptId: string, token: string): void {
  if (!isNonEmptyStoredString(receiptId) || !isNonEmptyStoredString(token)) {
    throw new TypeError("Storefront receipt session is invalid.");
  }

  const record: ReceiptSessionRecord = {
    version: receiptRecordVersion,
    receiptId,
    token,
    savedAt: new Date().toISOString(),
  };
  writeSessionRecord(receiptSessionStorageKey(receiptId), record);
}

export function getReceiptToken(receiptId: string): string | null {
  if (!isNonEmptyStoredString(receiptId)) return null;

  return (
    readSessionRecord(
      receiptSessionStorageKey(receiptId),
      (value): value is ReceiptSessionRecord =>
        isReceiptSessionRecord(value, receiptId),
    )?.token ?? null
  );
}

export function clearReceiptToken(receiptId: string): void {
  if (!isNonEmptyStoredString(receiptId)) return;
  removeSessionRecord(receiptSessionStorageKey(receiptId));
}

export function captureReceiptTokenFromFragment(
  receiptId: string,
): string | null {
  if (typeof window === "undefined" || !isNonEmptyStoredString(receiptId)) {
    return null;
  }

  const fragment = window.location.hash.slice(1);
  const fragmentParams = new URLSearchParams(fragment);
  if (!fragmentParams.has("receiptToken")) return null;

  const token = fragmentParams.get("receiptToken");
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  try {
    window.history.replaceState(window.history.state, "", cleanUrl);
  } catch {
    return null;
  }

  if (!isNonEmptyStoredString(token)) return null;
  setReceiptToken(receiptId, token);
  return token;
}
