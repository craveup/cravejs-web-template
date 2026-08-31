const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{16,128}$/;

export function isStorefrontIdempotencyKey(value: string): boolean {
  return idempotencyKeyPattern.test(value);
}

export function isStorefrontRevision(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
