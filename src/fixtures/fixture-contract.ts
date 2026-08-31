const sensitiveFixtureKeys = new Set([
  "accesstoken",
  "apikey",
  "authorization",
  "capability",
  "cartcapability",
  "checkouturl",
  "clientsecret",
  "customerjwt",
  "handofftoken",
  "jwt",
  "providertoken",
  "providersecret",
  "receipttoken",
  "secret",
  "token",
  "stripesecret",
]);

const sensitiveFixtureValues = [
  /\bbearer\s+\S+/i,
  /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /\b(?:pk|rk|sk)_(?:live|test)_[A-Za-z0-9_-]{8,}\b/i,
  /\bcrv_[A-Za-z0-9_-]{8,}\b/i,
  /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/,
  /[?#&](?:access_token|checkoutToken|receiptToken)=/i,
] as const;

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isSensitiveFixtureKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return (
    sensitiveFixtureKeys.has(normalized) ||
    normalized.endsWith("jwt") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("token")
  );
}

function childPath(path: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}

function fixtureContractError(path: string, reason: string): never {
  throw new Error(`Unsafe canonical fixture data at ${path}: ${reason}.`);
}

/**
 * Rejects secrets/capabilities and non-serializable values before fixture data
 * can become shared runtime or test truth. The reported path keeps failures
 * actionable without printing the sensitive value itself.
 */
export function assertFixtureDataSafe(value: unknown): void {
  const ancestors = new WeakSet<object>();

  function visit(current: unknown, path: string): void {
    if (current === null) return;
    if (current === undefined) {
      fixtureContractError(path, "undefined values are not serializable");
    }

    if (typeof current === "string") {
      if (sensitiveFixtureValues.some((pattern) => pattern.test(current))) {
        fixtureContractError(path, "credential-shaped value is forbidden");
      }
      return;
    }

    if (typeof current === "number") {
      if (!Number.isFinite(current)) {
        fixtureContractError(path, "numbers must be finite");
      }
      return;
    }

    if (typeof current === "boolean") return;
    if (typeof current !== "object") {
      fixtureContractError(path, `${typeof current} values are not serializable`);
    }

    if (!Array.isArray(current)) {
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        fixtureContractError(path, "only plain JSON objects are allowed");
      }
    }

    if (Object.getOwnPropertySymbols(current).length > 0) {
      fixtureContractError(path, "symbol-keyed properties are forbidden");
    }
    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index += 1) {
        if (!Object.hasOwn(current, index)) {
          fixtureContractError(`${path}[${index}]`, "sparse arrays are forbidden");
        }
      }
    }

    if (ancestors.has(current)) {
      fixtureContractError(path, "circular references are forbidden");
    }
    ancestors.add(current);

    for (const key of Object.getOwnPropertyNames(current)) {
      if (Array.isArray(current) && key === "length") continue;
      const nestedPath = childPath(path, key);
      if (isSensitiveFixtureKey(key)) {
        fixtureContractError(nestedPath, "sensitive key is forbidden");
      }
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (
        !descriptor ||
        descriptor.enumerable !== true ||
        !("value" in descriptor)
      ) {
        fixtureContractError(
          nestedPath,
          "hidden and accessor properties are forbidden",
        );
      }
      visit(descriptor.value, nestedPath);
    }

    ancestors.delete(current);
  }

  visit(value, "$");
}
