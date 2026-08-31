type SessionRecordKind = "cart" | "customer" | "receipt";

const sessionKeyPrefix = "craveup:storefront";

export function isNonEmptyStoredString(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.trim() === value
  );
}

export function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const timestamp = Date.parse(value);
  return (
    !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return JSON.stringify(actualKeys) === JSON.stringify(sortedExpectedKeys);
}

export function storefrontSessionStorageKey(
  kind: SessionRecordKind,
  ...scope: readonly string[]
): string {
  if (scope.length === 0 || !scope.every(isNonEmptyStoredString)) {
    throw new TypeError("Storefront session scope must contain non-empty strings.");
  }

  return `${sessionKeyPrefix}:${kind}:v1:${scope
    .map((part) => encodeURIComponent(part))
    .join(":")}`;
}

function getBrowserSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readSessionRecord<T>(
  key: string,
  validate: (value: unknown) => value is T,
): T | null {
  const storage = getBrowserSessionStorage();
  if (!storage) return null;

  let storedValue: string | null;
  try {
    storedValue = storage.getItem(key);
  } catch {
    return null;
  }
  if (storedValue === null) return null;

  try {
    const value: unknown = JSON.parse(storedValue);
    if (validate(value)) return value;
  } catch {
    // Invalid records are removed below without exposing their contents.
  }

  removeSessionRecord(key);
  return null;
}

export function writeSessionRecord(
  key: string,
  record: object,
): void {
  const storage = getBrowserSessionStorage();
  if (!storage) return;

  try {
    storage.setItem(key, JSON.stringify(record));
  } catch {
    // Fail closed so an older capability or revision cannot survive a rejected write.
    removeSessionRecord(key);
  }
}

export function removeSessionRecord(key: string): void {
  const storage = getBrowserSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    // Removal remains best-effort when the browser denies storage access.
  }
}
