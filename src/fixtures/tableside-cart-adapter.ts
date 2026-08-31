import { StorefrontApiError, type StorefrontCart } from "@craveup/storefront-sdk";

import { fixtureTablesideCart } from "./cart";
import {
  hasExactKeys,
  isNonEmptyStoredString,
  isRecord,
  readSessionRecord,
  writeSessionRecord,
} from "@/lib/storefront/session-storage";

const fixtureTableIdentifiers = new Set(["12", "13"]);
const fixtureCartRecordVersion = 2 as const;
const maxFixtureMutationReplays = 16;

export interface FixtureCartMutationState {
  cartId: string;
  tableIdentifier: string;
  revision: number;
}

export interface FixtureTablesideCartState extends FixtureCartMutationState {
  locationId: string;
}

export interface FixtureCartMutationOptions {
  idempotencyKey: string;
}

interface FixtureTableMutationReplay {
  idempotencyKey: string;
  currentCart: FixtureCartMutationState;
  requestedTableIdentifier: string;
  result: FixtureTablesideCartState;
}

interface FixtureTablesideCartRecord extends FixtureTablesideCartState {
  version: typeof fixtureCartRecordVersion;
  replays: FixtureTableMutationReplay[];
}

function fixtureCartStateKey(locationId: string): string {
  return `craveup:storefront:fixture-cart:v1:${encodeURIComponent(locationId)}`;
}

function isFixtureTablesideCartRecord(
  value: unknown,
  locationId: string,
): value is FixtureTablesideCartRecord {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "version",
      "cartId",
      "locationId",
      "tableIdentifier",
      "revision",
      "replays",
    ]) &&
    value.version === fixtureCartRecordVersion &&
    value.cartId === fixtureTablesideCart.id &&
    value.locationId === locationId &&
    isNonEmptyStoredString(value.tableIdentifier) &&
    fixtureTableIdentifiers.has(value.tableIdentifier) &&
    Number.isSafeInteger(value.revision) &&
    Number(value.revision) >= 1 &&
    Array.isArray(value.replays) &&
    value.replays.length <= maxFixtureMutationReplays &&
    value.replays.every((replay) =>
      isFixtureTableMutationReplay(replay, locationId),
    )
  );
}

function isFixtureCartMutationState(
  value: unknown,
): value is FixtureCartMutationState {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["cartId", "tableIdentifier", "revision"]) &&
    value.cartId === fixtureTablesideCart.id &&
    isNonEmptyStoredString(value.tableIdentifier) &&
    fixtureTableIdentifiers.has(value.tableIdentifier) &&
    Number.isSafeInteger(value.revision) &&
    Number(value.revision) >= 1
  );
}

function isFixtureTablesideCartState(
  value: unknown,
  locationId: string,
): value is FixtureTablesideCartState {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "cartId",
      "locationId",
      "tableIdentifier",
      "revision",
    ]) &&
    value.locationId === locationId &&
    isFixtureCartMutationState({
      cartId: value.cartId,
      tableIdentifier: value.tableIdentifier,
      revision: value.revision,
    })
  );
}

function isFixtureIdempotencyKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9._:-]{16,128}$/.test(value)
  );
}

function isFixtureTableMutationReplay(
  value: unknown,
  locationId: string,
): value is FixtureTableMutationReplay {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "idempotencyKey",
      "currentCart",
      "requestedTableIdentifier",
      "result",
    ]) &&
    isFixtureIdempotencyKey(value.idempotencyKey) &&
    isFixtureCartMutationState(value.currentCart) &&
    isNonEmptyStoredString(value.requestedTableIdentifier) &&
    fixtureTableIdentifiers.has(value.requestedTableIdentifier) &&
    isFixtureTablesideCartState(value.result, locationId)
  );
}

function withoutVersion(
  record: FixtureTablesideCartRecord,
): FixtureTablesideCartState {
  return {
    cartId: record.cartId,
    locationId: record.locationId,
    tableIdentifier: record.tableIdentifier,
    revision: record.revision,
  };
}

function readFixtureTablesideCartRecord(
  locationId: string,
): FixtureTablesideCartRecord | undefined {
  return readSessionRecord(
    fixtureCartStateKey(locationId),
    (value): value is FixtureTablesideCartRecord =>
      isFixtureTablesideCartRecord(value, locationId),
  ) ?? undefined;
}

function writeFixtureTablesideCartRecord(
  state: FixtureTablesideCartState,
  replays: FixtureTableMutationReplay[],
): void {
  writeSessionRecord(fixtureCartStateKey(state.locationId), {
    version: fixtureCartRecordVersion,
    ...state,
    replays,
  } satisfies FixtureTablesideCartRecord);
}

export function fixtureTablesideCartStateFromCart(
  cart: StorefrontCart,
): FixtureTablesideCartState | undefined {
  const tableIdentifier = cart.tableServiceInfo?.tableNumber?.trim() ?? "";
  if (
    cart.id !== fixtureTablesideCart.id ||
    cart.locationId !== fixtureTablesideCart.locationId ||
    !fixtureTableIdentifiers.has(tableIdentifier) ||
    !Number.isSafeInteger(cart.revision) ||
    cart.revision < 1
  ) {
    return undefined;
  }

  return {
    cartId: cart.id,
    locationId: cart.locationId,
    tableIdentifier,
    revision: cart.revision,
  };
}

export function fixtureTablesideCartStatesMatch(
  first: FixtureTablesideCartState,
  second: FixtureTablesideCartState,
): boolean {
  return (
    first.cartId === second.cartId &&
    first.locationId === second.locationId &&
    first.tableIdentifier === second.tableIdentifier &&
    first.revision === second.revision
  );
}

export function fixtureTablesideCartHref(
  state: FixtureTablesideCartState,
): string {
  return `/${encodeURIComponent(state.locationId)}/cart?table=${encodeURIComponent(state.tableIdentifier)}&cartId=${encodeURIComponent(state.cartId)}&revision=${state.revision}`;
}

export function claimFixtureTablesideCartState(
  locationId: string,
): FixtureTablesideCartState | undefined {
  const stored = readFixtureTablesideCartRecord(locationId);
  if (stored) return withoutVersion(stored);

  const initialState = fixtureTablesideCartStateFromCart(fixtureTablesideCart);
  if (!initialState || initialState.locationId !== locationId) return undefined;
  writeFixtureTablesideCartRecord(initialState, []);
  const claimed = readFixtureTablesideCartRecord(locationId);
  return claimed ? withoutVersion(claimed) : initialState;
}

function cartConflict(): StorefrontApiError {
  return new StorefrontApiError(
    409,
    "CART_CONFLICT",
    "The fixture cart changed elsewhere. Refresh and try again.",
    "fixture-cart-conflict",
    undefined,
    "POST",
    "/fixture/cart/:cartId/table",
    undefined,
  );
}

function idempotencyConflict(): StorefrontApiError {
  return new StorefrontApiError(
    409,
    "IDEMPOTENCY_CONFLICT",
    "The idempotency key was already used for another fixture cart request.",
    "fixture-idempotency-conflict",
    undefined,
    "POST",
    "/fixture/cart/:cartId/table",
    undefined,
  );
}

function mutationRequestsMatch(
  replay: FixtureTableMutationReplay,
  currentCart: FixtureCartMutationState,
  requestedTableIdentifier: string,
): boolean {
  return (
    replay.currentCart.cartId === currentCart.cartId &&
    replay.currentCart.tableIdentifier === currentCart.tableIdentifier &&
    replay.currentCart.revision === currentCart.revision &&
    replay.requestedTableIdentifier === requestedTableIdentifier
  );
}

export function parseFixtureCartRevision(value: unknown): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 1
    ? revision
    : undefined;
}

export function getFixtureTablesideCart(
  locationId: string,
  tableIdentifier: string,
  revision = fixtureTablesideCart.revision,
): StorefrontCart | undefined {
  if (locationId !== fixtureTablesideCart.locationId) return undefined;
  if (!Number.isSafeInteger(revision) || revision < 1) return undefined;

  const normalizedTableIdentifier = tableIdentifier.trim();
  if (!fixtureTableIdentifiers.has(normalizedTableIdentifier)) return undefined;

  return {
    ...fixtureTablesideCart,
    revision,
    fulfillmentIdentifier: normalizedTableIdentifier,
    tableServiceInfo: { tableNumber: normalizedTableIdentifier },
  };
}

export async function setFixtureTable(
  locationId: string,
  currentCart: FixtureCartMutationState,
  tableIdentifier: string,
  options: FixtureCartMutationOptions,
): Promise<StorefrontCart> {
  if (currentCart.cartId !== fixtureTablesideCart.id) {
    throw new Error("The fixture cart identity does not match.");
  }
  if (!Number.isSafeInteger(currentCart.revision) || currentCart.revision < 1) {
    throw new Error("The fixture cart revision is invalid.");
  }
  if (!isFixtureIdempotencyKey(options.idempotencyKey)) {
    throw new Error("The fixture idempotency key is invalid.");
  }

  const requestedTableIdentifier = tableIdentifier.trim();
  let authoritativeRecord = readFixtureTablesideCartRecord(locationId);
  if (!authoritativeRecord) {
    claimFixtureTablesideCartState(locationId);
    authoritativeRecord = readFixtureTablesideCartRecord(locationId);
  }
  const replay = authoritativeRecord?.replays.find(
    (candidate) => candidate.idempotencyKey === options.idempotencyKey,
  );
  if (replay) {
    if (!mutationRequestsMatch(replay, currentCart, requestedTableIdentifier)) {
      throw idempotencyConflict();
    }
    const replayedCart = getFixtureTablesideCart(
      replay.result.locationId,
      replay.result.tableIdentifier,
      replay.result.revision,
    );
    if (!replayedCart || replayedCart.id !== replay.result.cartId) {
      throw new Error("The fixture idempotency result is invalid.");
    }
    return replayedCart;
  }

  const authoritativeState = authoritativeRecord
    ? withoutVersion(authoritativeRecord)
    : undefined;
  if (
    !authoritativeState ||
    authoritativeState.cartId !== currentCart.cartId ||
    authoritativeState.tableIdentifier !== currentCart.tableIdentifier ||
    authoritativeState.revision !== currentCart.revision
  ) {
    throw cartConflict();
  }

  const cart = getFixtureTablesideCart(
    locationId,
    requestedTableIdentifier,
    authoritativeState.revision + 1,
  );
  if (!cart) {
    throw new Error("The requested fixture table is unavailable.");
  }
  const nextState = fixtureTablesideCartStateFromCart(cart);
  if (!nextState) {
    throw new Error("The fixture cart response is invalid.");
  }
  const nextReplay = {
    idempotencyKey: options.idempotencyKey,
    currentCart: { ...currentCart },
    requestedTableIdentifier,
    result: nextState,
  } satisfies FixtureTableMutationReplay;
  const nextReplays = [
    ...(authoritativeRecord?.replays ?? []),
    nextReplay,
  ].slice(-maxFixtureMutationReplays);
  writeFixtureTablesideCartRecord(nextState, nextReplays);
  const storedRecord = readFixtureTablesideCartRecord(locationId);
  const storedReplay = storedRecord?.replays.find(
    (candidate) => candidate.idempotencyKey === options.idempotencyKey,
  );
  if (
    !storedRecord ||
    !fixtureTablesideCartStatesMatch(storedRecord, nextState) ||
    !storedReplay ||
    !mutationRequestsMatch(storedReplay, currentCart, requestedTableIdentifier)
  ) {
    throw new Error("The fixture cart state could not be persisted.");
  }
  return cart;
}
