import type {
  AddCartItemPayload,
  StorefrontCart,
} from "@craveup/storefront-sdk";

import {
  isStorefrontIdempotencyKey,
  isStorefrontRevision,
} from "@/lib/storefront/action-input";
import {
  StorefrontCartActionError,
  type StorefrontAddItemResult,
  type StorefrontCartItemMutationResult,
  type StorefrontCartActions,
  type StorefrontDeleteCartResult,
} from "@/lib/storefront/cart-actions";
import type { StorefrontErrorState } from "@/lib/storefront/error-state";

type MutationKind =
  | "add-item"
  | "update-item-quantity"
  | "remove-item"
  | "clear-cart";

export interface CartMutationReconciliationResult {
  readonly state: "reconciled";
  readonly cart: StorefrontCart;
}

type MutationResult =
  | StorefrontAddItemResult
  | StorefrontCartItemMutationResult
  | StorefrontDeleteCartResult
  | CartMutationReconciliationResult;

export interface CartMutationErrorView {
  readonly state: StorefrontErrorState["state"];
  readonly code: string;
  readonly message: string;
  readonly requestId?: string;
  readonly details?: StorefrontErrorState["details"];
  readonly retryAfterMs?: number;
  readonly method?: string;
  readonly routeTemplate?: string;
}

interface CartMutationSnapshotBase {
  readonly cart: StorefrontCart;
}

export type CartMutationSnapshot =
  | Readonly<CartMutationSnapshotBase & { state: "ready" }>
  | Readonly<
      CartMutationSnapshotBase & {
        state: "mutating";
        intentId: string;
        kind: MutationKind;
      }
    >
  | Readonly<
      CartMutationSnapshotBase & {
        state: "retry-required";
        intentId: string;
        kind: MutationKind;
        error: CartMutationErrorView;
      }
    >
  | Readonly<
      CartMutationSnapshotBase & {
        state: "retryable-failure";
        intentId: string;
        kind: MutationKind;
        error: CartMutationErrorView;
      }
    >
  | Readonly<
      CartMutationSnapshotBase & {
        state: "failed";
        intentId?: string;
        kind?: MutationKind;
        error: CartMutationErrorView;
      }
    >
  | Readonly<
      CartMutationSnapshotBase & {
        state: "terminal";
        error?: CartMutationErrorView;
      }
    >;

export class CartMutationCoordinatorError extends Error {
  readonly state: StorefrontErrorState["state"];
  readonly code: string;
  readonly requestId?: string;
  readonly details?: StorefrontErrorState["details"];
  readonly retryAfterMs?: number;
  readonly method?: string;
  readonly routeTemplate?: string;

  constructor(error: CartMutationErrorView) {
    super(error.message);
    this.name = "CartMutationCoordinatorError";
    this.state = error.state;
    this.code = error.code;
    this.requestId = error.requestId;
    this.details = error.details;
    this.retryAfterMs = error.retryAfterMs;
    this.method = error.method;
    this.routeTemplate = error.routeTemplate;
  }
}

interface MutationAttempt {
  readonly cart: StorefrontCart;
  readonly idempotencyKey: string;
}

interface MutationEntry {
  readonly intentId: string;
  readonly fingerprint: string;
  readonly kind: MutationKind;
  readonly execute: (attempt: MutationAttempt) => Promise<MutationResult>;
  generation: number;
  attempt?: MutationAttempt;
  promise?: Promise<MutationResult>;
  retainedForRetry: boolean;
  completedRevision?: number;
  recoveryMode?: "replay" | "reconcile";
  retryNotBefore?: number;
}

export interface AddCartMutationIntent {
  readonly intentId: string;
  readonly payload: AddCartItemPayload;
}

export interface ClearCartMutationIntent {
  readonly intentId: string;
}

export interface UpdateCartItemQuantityMutationIntent {
  readonly intentId: string;
  readonly itemId: string;
  readonly quantity: number;
}

export interface RemoveCartItemMutationIntent {
  readonly intentId: string;
  readonly itemId: string;
}

export interface CartMutationCoordinator {
  addItem(intent: AddCartMutationIntent): Promise<StorefrontAddItemResult>;
  updateItemQuantity(
    intent: UpdateCartItemQuantityMutationIntent,
  ): Promise<StorefrontCartItemMutationResult>;
  removeItem(
    intent: RemoveCartItemMutationIntent,
  ): Promise<StorefrontCartItemMutationResult>;
  clear(intent: ClearCartMutationIntent): Promise<StorefrontDeleteCartResult>;
  retryConflict(intentId: string): Promise<MutationResult>;
  retryLostResponse(intentId: string): Promise<MutationResult>;
  getSnapshot(): CartMutationSnapshot;
  subscribe(listener: () => void): () => void;
}

export interface CreateCartMutationCoordinatorInput {
  readonly actions: StorefrontCartActions;
  readonly initialCart: StorefrontCart;
  readonly createIdempotencyKey?: () => string;
  readonly now?: () => number;
}

function defaultIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function coordinatorError(
  code: string,
  message: string,
  state: StorefrontErrorState["state"] = "integration-error",
): CartMutationCoordinatorError {
  return new CartMutationCoordinatorError({ state, code, message });
}

function asCoordinatorError(error: unknown): CartMutationCoordinatorError {
  if (error instanceof CartMutationCoordinatorError) return error;
  if (error instanceof StorefrontCartActionError) {
    return new CartMutationCoordinatorError({
      state: error.state,
      code: error.code,
      message: error.message,
      requestId: error.requestId,
      details: error.details,
      retryAfterMs: error.retryAfterMs,
      method: error.method,
      routeTemplate: error.routeTemplate,
    });
  }
  return coordinatorError(
    "CART_MUTATION_FAILED",
    "The cart could not be updated. Try again.",
  );
}

function errorView(error: CartMutationCoordinatorError): CartMutationErrorView {
  return {
    state: error.state,
    code: error.code,
    message: error.message,
    requestId: error.requestId,
    details: error.details,
    retryAfterMs: error.retryAfterMs,
    method: error.method,
    routeTemplate: error.routeTemplate,
  };
}

function assertIntentId(intentId: string): void {
  if (!intentId || intentId.trim() !== intentId) {
    throw coordinatorError(
      "INVALID_CART_INTENT",
      "The cart action could not be started safely.",
      "validation",
    );
  }
}

function isEditable(cart: StorefrontCart): boolean {
  return cart.status === "OPEN";
}

function isExactReplayFailure(error: CartMutationCoordinatorError): boolean {
  return (
    error.code === "REQUEST_TIMEOUT" ||
    error.code === "NETWORK_ERROR" ||
    error.code === "RATE_LIMITED"
  );
}

function isRecoverableTransportFailure(
  error: CartMutationCoordinatorError,
): boolean {
  return (
    isExactReplayFailure(error) || error.code === "IDEMPOTENCY_IN_PROGRESS"
  );
}

function isRetryableReconciliationFailure(
  error: CartMutationCoordinatorError,
): boolean {
  return (
    error.state === "network-error" ||
    error.state === "rate-limited" ||
    error.state === "operation-pending" ||
    error.state === "dependency-unavailable"
  );
}

function cloneAddItemPayload(payload: AddCartItemPayload): AddCartItemPayload {
  return structuredClone(payload);
}

function sameCartScope(
  expected: StorefrontCart,
  returned: StorefrontCart,
): boolean {
  return (
    returned.id === expected.id &&
    returned.locationId === expected.locationId &&
    returned.merchantId === expected.merchantId
  );
}

function assertInitialCart(initialCart: StorefrontCart): void {
  if (!isStorefrontRevision(initialCart.revision)) {
    throw coordinatorError(
      "CART_REVISION_INVALID",
      "The initial cart revision is invalid.",
    );
  }
}

class CartMutationCoordinatorImpl implements CartMutationCoordinator {
  private cart: StorefrontCart;
  private snapshot: CartMutationSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly entries = new Map<string, MutationEntry>();
  private tail: Promise<unknown> = Promise.resolve();
  private generation = 0;

  constructor(
    private readonly actions: StorefrontCartActions,
    initialCart: StorefrontCart,
    private readonly createIdempotencyKey: () => string,
    private readonly now: () => number,
  ) {
    this.cart = initialCart;
    this.snapshot = isEditable(initialCart)
      ? { state: "ready", cart: initialCart }
      : { state: "terminal", cart: initialCart };
  }

  getSnapshot = (): CartMutationSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  reconcileInitialCart(initialCart: StorefrontCart): void {
    if (initialCart.revision <= this.cart.revision) return;
    if (
      this.snapshot.state === "mutating" ||
      this.snapshot.state === "retry-required" ||
      this.snapshot.state === "retryable-failure"
    ) {
      throw coordinatorError(
        "CART_COORDINATOR_BUSY",
        "Resolve the active cart action before applying refreshed cart state.",
        this.snapshot.state === "retry-required"
          ? "cart-conflict"
          : "integration-error",
      );
    }

    this.cart = initialCart;
    this.generation += 1;
    this.setSnapshot(
      isEditable(initialCart)
        ? { state: "ready", cart: initialCart }
        : { state: "terminal", cart: initialCart },
    );
  }

  addItem(intent: AddCartMutationIntent): Promise<StorefrontAddItemResult> {
    assertIntentId(intent.intentId);
    const payload = cloneAddItemPayload(intent.payload);
    const fingerprint = JSON.stringify({ kind: "add-item", payload });
    return this.enqueue({
      intentId: intent.intentId,
      fingerprint,
      kind: "add-item",
      execute: (attempt) =>
        this.actions.addItem({
          locationId: attempt.cart.locationId,
          cartId: attempt.cart.id,
          revision: attempt.cart.revision,
          idempotencyKey: attempt.idempotencyKey,
          payload,
        }),
      generation: this.generation,
      retainedForRetry: false,
    }) as Promise<StorefrontAddItemResult>;
  }

  updateItemQuantity(
    intent: UpdateCartItemQuantityMutationIntent,
  ): Promise<StorefrontCartItemMutationResult> {
    assertIntentId(intent.intentId);
    const fingerprint = JSON.stringify({
      kind: "update-item-quantity",
      itemId: intent.itemId,
      quantity: intent.quantity,
    });
    return this.enqueue({
      intentId: intent.intentId,
      fingerprint,
      kind: "update-item-quantity",
      execute: (attempt) =>
        this.actions.updateItemQuantity({
          locationId: attempt.cart.locationId,
          cartId: attempt.cart.id,
          revision: attempt.cart.revision,
          idempotencyKey: attempt.idempotencyKey,
          itemId: intent.itemId,
          quantity: intent.quantity,
        }),
      generation: this.generation,
      retainedForRetry: false,
    }) as Promise<StorefrontCartItemMutationResult>;
  }

  removeItem(
    intent: RemoveCartItemMutationIntent,
  ): Promise<StorefrontCartItemMutationResult> {
    assertIntentId(intent.intentId);
    const fingerprint = JSON.stringify({
      kind: "remove-item",
      itemId: intent.itemId,
    });
    return this.enqueue({
      intentId: intent.intentId,
      fingerprint,
      kind: "remove-item",
      execute: (attempt) =>
        this.actions.removeItem({
          locationId: attempt.cart.locationId,
          cartId: attempt.cart.id,
          revision: attempt.cart.revision,
          idempotencyKey: attempt.idempotencyKey,
          itemId: intent.itemId,
        }),
      generation: this.generation,
      retainedForRetry: false,
    }) as Promise<StorefrontCartItemMutationResult>;
  }

  clear(intent: ClearCartMutationIntent): Promise<StorefrontDeleteCartResult> {
    assertIntentId(intent.intentId);
    return this.enqueue({
      intentId: intent.intentId,
      fingerprint: JSON.stringify({ kind: "clear-cart" }),
      kind: "clear-cart",
      execute: (attempt) =>
        this.actions.delete({
          locationId: attempt.cart.locationId,
          cartId: attempt.cart.id,
          revision: attempt.cart.revision,
          idempotencyKey: attempt.idempotencyKey,
        }),
      generation: this.generation,
      retainedForRetry: false,
    }) as Promise<StorefrontDeleteCartResult>;
  }

  async retryConflict(intentId: string): Promise<MutationResult> {
    const entry = this.requireRetryEntry(intentId, "retry-required");
    entry.attempt = undefined;
    return this.scheduleRetry(entry);
  }

  async retryLostResponse(intentId: string): Promise<MutationResult> {
    const entry = this.requireRetryEntry(intentId, "retryable-failure");
    if (!entry.attempt) {
      return Promise.reject(
        coordinatorError(
          "CART_RETRY_UNAVAILABLE",
          "The cart action cannot be retried safely.",
        ),
      );
    }
    const retryAfterMs = Math.max((entry.retryNotBefore ?? 0) - this.now(), 0);
    if (retryAfterMs > 0) {
      const retryState =
        this.snapshot.state === "retryable-failure"
          ? this.snapshot.error.state
          : "unexpected";
      throw new CartMutationCoordinatorError({
        state: retryState,
        code: "CART_RETRY_DELAYED",
        message: "Wait before retrying this cart action.",
        retryAfterMs,
      });
    }
    return entry.recoveryMode === "reconcile"
      ? this.scheduleReconciliation(entry)
      : this.scheduleRetry(entry);
  }

  private requireRetryEntry(
    intentId: string,
    expectedState: "retry-required" | "retryable-failure",
  ): MutationEntry {
    assertIntentId(intentId);
    const entry = this.entries.get(intentId);
    if (
      !entry ||
      !entry.retainedForRetry ||
      this.snapshot.state !== expectedState ||
      this.snapshot.intentId !== intentId
    ) {
      throw coordinatorError(
        "CART_RETRY_UNAVAILABLE",
        "The cart action cannot be retried safely.",
      );
    }
    return entry;
  }

  private scheduleRetry(entry: MutationEntry): Promise<MutationResult> {
    entry.generation = this.generation;
    entry.retainedForRetry = false;
    entry.retryNotBefore = undefined;
    entry.promise = undefined;
    this.setSnapshot(
      isEditable(this.cart)
        ? { state: "ready", cart: this.cart }
        : { state: "terminal", cart: this.cart },
    );
    return this.schedule(entry);
  }

  private scheduleReconciliation(entry: MutationEntry): Promise<MutationResult> {
    entry.generation = this.generation;
    entry.retainedForRetry = false;
    entry.retryNotBefore = undefined;
    entry.promise = undefined;
    const promise = this.tail.then(() => this.reconcilePendingMutation(entry));
    entry.promise = promise;
    this.tail = promise.catch(() => undefined);
    return promise;
  }

  private enqueue(entry: MutationEntry): Promise<MutationResult> {
    const existing = this.entries.get(entry.intentId);
    if (existing) {
      if (existing.fingerprint !== entry.fingerprint || existing.kind !== entry.kind) {
        return Promise.reject(
          coordinatorError(
            "CART_INTENT_REUSED",
            "The cart action identifier belongs to another request.",
          ),
        );
      }
      if (existing.promise) {
        if (
          existing.completedRevision !== undefined &&
          existing.completedRevision !== this.cart.revision
        ) {
          return Promise.reject(
            coordinatorError(
              "CART_INTENT_STALE",
              "The cart changed after this action completed.",
              "cart-conflict",
            ),
          );
        }
        return existing.promise;
      }
    }

    if (
      this.snapshot.state === "retry-required" ||
      this.snapshot.state === "retryable-failure"
    ) {
      return Promise.reject(
        coordinatorError(
          "CART_RECOVERY_REQUIRED",
          "Resolve the previous cart action before starting another.",
          this.snapshot.state === "retry-required"
            ? "cart-conflict"
            : this.snapshot.error.state,
        ),
      );
    }

    if (this.snapshot.state === "terminal") {
      return Promise.reject(
        this.snapshot.error
          ? new CartMutationCoordinatorError(this.snapshot.error)
          : coordinatorError(
              "CART_IMMUTABLE",
              "This cart can no longer be changed.",
              "cart-immutable",
            ),
      );
    }

    this.entries.set(entry.intentId, entry);
    return this.schedule(entry);
  }

  private schedule(entry: MutationEntry): Promise<MutationResult> {
    const promise = this.tail.then(() => this.execute(entry));
    entry.promise = promise;
    this.tail = promise.catch(() => undefined);
    return promise;
  }

  private async execute(entry: MutationEntry): Promise<MutationResult> {
    if (entry.generation !== this.generation) {
      this.entries.delete(entry.intentId);
      throw coordinatorError(
        "CART_RETRY_REQUIRED",
        "The cart changed. Review it and retry your action.",
        "cart-conflict",
      );
    }
    if (!isEditable(this.cart)) {
      this.entries.delete(entry.intentId);
      throw coordinatorError(
        "CART_IMMUTABLE",
        "This cart can no longer be changed.",
        "cart-immutable",
      );
    }

    if (!entry.attempt) {
      const idempotencyKey = this.createIdempotencyKey();
      if (!isStorefrontIdempotencyKey(idempotencyKey)) {
        this.entries.delete(entry.intentId);
        throw coordinatorError(
          "INVALID_IDEMPOTENCY_KEY",
          "The cart action could not be started safely.",
        );
      }
      entry.attempt = { cart: this.cart, idempotencyKey };
    }

    this.setSnapshot({
      state: "mutating",
      cart: this.cart,
      intentId: entry.intentId,
      kind: entry.kind,
    });

    try {
      const result = await entry.execute(entry.attempt);
      this.assertReturnedCart(entry.attempt.cart, result.cart);
      this.cart = result.cart;

      if (result.state === "retry-required") {
        entry.retainedForRetry = true;
        this.generation += 1;
        entry.generation = this.generation;
        this.setSnapshot({
          state: "retry-required",
          cart: this.cart,
          intentId: entry.intentId,
          kind: entry.kind,
          error: result.error,
        });
        return result;
      }

      this.setSnapshot(
        isEditable(this.cart)
          ? { state: "ready", cart: this.cart }
          : { state: "terminal", cart: this.cart },
      );
      entry.completedRevision = this.cart.revision;
      return result;
    } catch (error) {
      const safeError = asCoordinatorError(error);
      if (isRecoverableTransportFailure(safeError)) {
        entry.retainedForRetry = true;
        entry.recoveryMode =
          safeError.code === "IDEMPOTENCY_IN_PROGRESS"
            ? "reconcile"
            : "replay";
        entry.retryNotBefore =
          safeError.state === "operation-pending" ||
          safeError.state === "rate-limited"
            ? this.now() + (safeError.retryAfterMs ?? 1_000)
            : undefined;
        this.generation += 1;
        entry.generation = this.generation;
        this.setSnapshot({
          state: "retryable-failure",
          cart: this.cart,
          intentId: entry.intentId,
          kind: entry.kind,
          error: errorView(safeError),
        });
        throw safeError;
      }

      this.entries.delete(entry.intentId);
      const terminal = safeError.code === "CART_IMMUTABLE";
      this.setSnapshot(
        terminal
          ? { state: "terminal", cart: this.cart, error: errorView(safeError) }
          : {
              state: "failed",
              cart: this.cart,
              intentId: entry.intentId,
              kind: entry.kind,
              error: errorView(safeError),
            },
      );
      throw safeError;
    }
  }

  private async reconcilePendingMutation(
    entry: MutationEntry,
  ): Promise<CartMutationReconciliationResult> {
    if (!entry.attempt) {
      throw coordinatorError(
        "CART_RETRY_UNAVAILABLE",
        "The cart action cannot be reconciled safely.",
      );
    }

    this.setSnapshot({
      state: "mutating",
      cart: this.cart,
      intentId: entry.intentId,
      kind: entry.kind,
    });

    try {
      const cart = await this.actions.get({
        locationId: entry.attempt.cart.locationId,
        cartId: entry.attempt.cart.id,
      });
      this.assertReadCart(entry.attempt.cart, cart);
      if (cart.revision === entry.attempt.cart.revision) {
        throw new CartMutationCoordinatorError({
          state: "operation-pending",
          code: "IDEMPOTENCY_IN_PROGRESS",
          message: "The cart action is still being processed.",
          retryAfterMs: 1_000,
        });
      }

      this.cart = cart;
      this.generation += 1;
      entry.generation = this.generation;
      entry.completedRevision = cart.revision;
      entry.recoveryMode = undefined;
      this.setSnapshot(
        isEditable(cart)
          ? { state: "ready", cart }
          : { state: "terminal", cart },
      );
      return { state: "reconciled", cart };
    } catch (error) {
      const safeError = asCoordinatorError(error);
      if (!isRetryableReconciliationFailure(safeError)) {
        this.entries.delete(entry.intentId);
        this.setSnapshot({
          state: "terminal",
          cart: this.cart,
          error: errorView(safeError),
        });
        throw safeError;
      }

      entry.retainedForRetry = true;
      entry.recoveryMode = "reconcile";
      entry.retryNotBefore =
        safeError.state === "operation-pending" ||
        safeError.state === "rate-limited" ||
        safeError.state === "dependency-unavailable"
          ? this.now() + (safeError.retryAfterMs ?? 1_000)
          : undefined;
      this.generation += 1;
      entry.generation = this.generation;
      this.setSnapshot({
        state: "retryable-failure",
        cart: this.cart,
        intentId: entry.intentId,
        kind: entry.kind,
        error: errorView(safeError),
      });
      throw safeError;
    }
  }

  private assertReturnedCart(
    attemptedCart: StorefrontCart,
    returnedCart: StorefrontCart,
  ): void {
    if (!sameCartScope(attemptedCart, returnedCart)) {
      throw coordinatorError(
        "CART_SCOPE_MISMATCH",
        "The returned cart does not match this ordering session.",
      );
    }
    if (!isStorefrontRevision(returnedCart.revision)) {
      throw coordinatorError(
        "CART_REVISION_INVALID",
        "The returned cart revision is invalid.",
      );
    }
    if (returnedCart.revision <= attemptedCart.revision) {
      throw coordinatorError(
        "CART_REVISION_NOT_ADVANCED",
        "The returned cart revision is not authoritative.",
      );
    }
  }

  private assertReadCart(
    attemptedCart: StorefrontCart,
    returnedCart: StorefrontCart,
  ): void {
    if (!sameCartScope(attemptedCart, returnedCart)) {
      throw coordinatorError(
        "CART_SCOPE_MISMATCH",
        "The returned cart does not match this ordering session.",
      );
    }
    if (!isStorefrontRevision(returnedCart.revision)) {
      throw coordinatorError(
        "CART_REVISION_INVALID",
        "The returned cart revision is invalid.",
      );
    }
    if (returnedCart.revision < attemptedCart.revision) {
      throw coordinatorError(
        "CART_REVISION_REGRESSED",
        "The returned cart revision is stale.",
        "cart-conflict",
      );
    }
  }

  private setSnapshot(snapshot: CartMutationSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}

const coordinatorsByActions = new WeakMap<
  StorefrontCartActions,
  Map<string, CartMutationCoordinatorImpl>
>();

function coordinatorScope(cart: StorefrontCart): string {
  return JSON.stringify([cart.merchantId, cart.locationId, cart.id]);
}

export function createCartMutationCoordinator({
  actions,
  initialCart,
  createIdempotencyKey = defaultIdempotencyKey,
  now = Date.now,
}: CreateCartMutationCoordinatorInput): CartMutationCoordinator {
  assertInitialCart(initialCart);
  const scope = coordinatorScope(initialCart);
  const scoped = coordinatorsByActions.get(actions) ?? new Map();
  const existing = scoped.get(scope);
  if (existing) {
    existing.reconcileInitialCart(initialCart);
    return existing;
  }

  const coordinator = new CartMutationCoordinatorImpl(
    actions,
    initialCart,
    createIdempotencyKey,
    now,
  );
  scoped.set(scope, coordinator);
  coordinatorsByActions.set(actions, scoped);
  return coordinator;
}
