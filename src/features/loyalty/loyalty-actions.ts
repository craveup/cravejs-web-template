import type {
  LoyaltyClaim,
  LoyaltyClaimReason,
  LoyaltyClaimSubmission,
  LoyaltyLedger,
  LoyaltyQuote,
  RequestConfig,
  StorefrontCart,
} from "@craveup/storefront-sdk";

import {
  isStorefrontIdempotencyKey,
  isStorefrontRevision,
} from "@/lib/storefront/action-input";
import { runInStorefrontCustomerScope } from "@/lib/storefront/customer-scope";
import {
  toStorefrontErrorState,
  type StorefrontErrorState,
} from "@/lib/storefront/error-state";

export interface StorefrontLoyaltyContext {
  readonly tenantId: string;
  readonly merchantSlug: string;
  readonly profileEnabled: boolean;
}

export interface StorefrontLoyaltySessionAdapters {
  readonly setMerchantScope: (merchantSlug: string) => void;
  readonly clearCustomerToken: (merchantSlug: string) => void;
}

export interface StorefrontLoyaltyClient {
  readonly cart: {
    get(
      locationId: string,
      cartId: string,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
  };
  readonly loyalty: {
    quote(
      locationId: string,
      cartId: string,
      config?: RequestConfig,
    ): Promise<LoyaltyQuote>;
    redeem(
      locationId: string,
      cartId: string,
      rewardId: string,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    cancel(
      locationId: string,
      cartId: string,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    ledger(
      params?: { limit?: number; cursor?: string },
      config?: RequestConfig,
    ): Promise<LoyaltyLedger>;
    readonly claims: {
      submit(
        payload: {
          orderId: string;
          reason: LoyaltyClaimReason;
          note?: string;
        },
        config?: RequestConfig,
      ): Promise<LoyaltyClaimSubmission>;
      list(config?: RequestConfig): Promise<{ claims: LoyaltyClaim[] }>;
    };
  };
}

interface NonBlockingLoyaltyState {
  readonly blocking: false;
}

export interface DisabledLoyaltyState extends NonBlockingLoyaltyState {
  readonly state: "disabled";
  readonly reason: "profile-disabled" | "merchant-disabled";
}

export interface UnavailableLoyaltyState extends NonBlockingLoyaltyState {
  readonly state: "unavailable";
  readonly reason: "provider-unavailable";
  readonly error?: StorefrontErrorState;
}

export type StorefrontLoyaltyQuoteResult =
  | DisabledLoyaltyState
  | UnavailableLoyaltyState
  | Readonly<
      NonBlockingLoyaltyState & {
        state: "enabled";
        quote: LoyaltyQuote;
      }
    >;

export type StorefrontLoyaltyLedgerResult =
  | DisabledLoyaltyState
  | UnavailableLoyaltyState
  | Readonly<
      NonBlockingLoyaltyState & {
        state: "enabled";
        ledger: LoyaltyLedger;
      }
    >;

export type StorefrontLoyaltyClaimsResult =
  | DisabledLoyaltyState
  | UnavailableLoyaltyState
  | Readonly<
      NonBlockingLoyaltyState & {
        state: "enabled";
        claims: readonly LoyaltyClaim[];
      }
    >;

export type StorefrontLoyaltyClaimSubmissionResult =
  | DisabledLoyaltyState
  | UnavailableLoyaltyState
  | Readonly<
      NonBlockingLoyaltyState & {
        state: "submitted";
        claim: LoyaltyClaimSubmission;
      }
    >;

export type StorefrontLoyaltyMutationResult =
  | DisabledLoyaltyState
  | (UnavailableLoyaltyState & { readonly cart?: StorefrontCart })
  | Readonly<
      NonBlockingLoyaltyState & {
        state: "reconciliation-required";
        error: StorefrontErrorState;
        cart?: StorefrontCart;
      }
    >
  | Readonly<
      NonBlockingLoyaltyState & {
        state: "applied" | "cancelled";
        cart: StorefrontCart;
      }
    >;

interface StorefrontLoyaltyCartScope {
  readonly locationId: string;
  readonly cartId: string;
}

export interface StorefrontRedeemLoyaltyInput
  extends StorefrontLoyaltyCartScope {
  readonly rewardId: string;
  readonly revision: number;
  readonly idempotencyKey: string;
}

export interface StorefrontCancelLoyaltyInput
  extends StorefrontLoyaltyCartScope {
  readonly revision: number;
  readonly idempotencyKey: string;
}

export interface StorefrontReconcileLoyaltyCartInput
  extends StorefrontLoyaltyCartScope {
  readonly revision: number;
}

export type StorefrontLoyaltyCartReconciliationResult = Readonly<
  NonBlockingLoyaltyState & {
    state: "reconciled";
    cart: StorefrontCart;
  }
>;

export interface StorefrontSubmitLoyaltyClaimInput {
  readonly orderId: string;
  readonly reason: LoyaltyClaimReason;
  readonly note?: string;
  readonly idempotencyKey: string;
}

export interface StorefrontLoyaltyActions {
  readonly cart: {
    quote(
      input: StorefrontLoyaltyCartScope,
    ): Promise<StorefrontLoyaltyQuoteResult>;
    redeem(
      input: StorefrontRedeemLoyaltyInput,
    ): Promise<StorefrontLoyaltyMutationResult>;
    cancel(
      input: StorefrontCancelLoyaltyInput,
    ): Promise<StorefrontLoyaltyMutationResult>;
    reconcile(
      input: StorefrontReconcileLoyaltyCartInput,
    ): Promise<StorefrontLoyaltyCartReconciliationResult>;
  };
  readonly account: {
    ledger(params?: {
      limit?: number;
      cursor?: string;
    }): Promise<StorefrontLoyaltyLedgerResult>;
    readonly claims: {
      list(): Promise<StorefrontLoyaltyClaimsResult>;
      submit(
        input: StorefrontSubmitLoyaltyClaimInput,
      ): Promise<StorefrontLoyaltyClaimSubmissionResult>;
    };
  };
}

export class StorefrontLoyaltyActionError extends Error {
  readonly state: StorefrontErrorState["state"];
  readonly code: string;
  readonly requestId?: string;
  readonly details?: StorefrontErrorState["details"];
  readonly retryAfterMs?: number;
  readonly method?: string;
  readonly routeTemplate?: string;

  constructor(error: StorefrontErrorState) {
    super(error.message);
    this.name = "StorefrontLoyaltyActionError";
    this.state = error.state;
    this.code = error.code;
    this.requestId = error.requestId;
    this.details = error.details;
    this.retryAfterMs = error.retryAfterMs;
    this.method = error.method;
    this.routeTemplate = error.routeTemplate;
  }
}

const merchantSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const orderIdPattern = /^[a-f\d]{24}$/;
const claimReasons = new Set<LoyaltyClaimReason>([
  "missing_points",
  "incorrect_points",
  "other",
]);

function validationError(code: string, message: string) {
  return new StorefrontLoyaltyActionError({
    state: "validation",
    code,
    message,
  });
}

function requireIdentifier(
  value: string,
  code: string,
  maximumLength = 128,
): void {
  if (!value || value.length > maximumLength || value.trim() !== value) {
    throw validationError(code, "The loyalty request is invalid.");
  }
}

function requireContext(context: StorefrontLoyaltyContext): void {
  requireIdentifier(context.tenantId, "INVALID_TENANT_SCOPE");
  if (!merchantSlugPattern.test(context.merchantSlug)) {
    throw validationError(
      "INVALID_MERCHANT_SCOPE",
      "The loyalty merchant scope is invalid.",
    );
  }
}

function requireCartScope(input: StorefrontLoyaltyCartScope): void {
  requireIdentifier(input.locationId, "INVALID_LOCATION_ID");
  requireIdentifier(input.cartId, "INVALID_CART_ID");
}

function requireMutation(
  input: StorefrontCancelLoyaltyInput,
): void {
  requireCartScope(input);
  if (!isStorefrontRevision(input.revision)) {
    throw validationError(
      "INVALID_REVISION",
      "The cart changed. Refresh and try again.",
    );
  }
  if (!isStorefrontIdempotencyKey(input.idempotencyKey)) {
    throw validationError(
      "INVALID_IDEMPOTENCY_KEY",
      "The loyalty action could not be started safely.",
    );
  }
}

function requireLedgerParams(params?: {
  limit?: number;
  cursor?: string;
}): void {
  if (
    params?.limit !== undefined &&
    (!Number.isSafeInteger(params.limit) || params.limit < 1 || params.limit > 50)
  ) {
    throw validationError(
      "INVALID_LEDGER_LIMIT",
      "The loyalty ledger request is invalid.",
    );
  }
  if (
    params?.cursor !== undefined &&
    (!params.cursor ||
      params.cursor.length > 512 ||
      params.cursor.trim() !== params.cursor)
  ) {
    throw validationError(
      "INVALID_LEDGER_CURSOR",
      "The loyalty ledger request is invalid.",
    );
  }
}

function requireClaim(input: StorefrontSubmitLoyaltyClaimInput): void {
  if (
    !orderIdPattern.test(input.orderId) ||
    !claimReasons.has(input.reason) ||
    (input.note !== undefined &&
      (!input.note ||
        input.note.trim() !== input.note ||
        input.note.length > 1_000))
  ) {
    throw validationError(
      "INVALID_LOYALTY_CLAIM",
      "The loyalty claim request is invalid.",
    );
  }
  if (!isStorefrontIdempotencyKey(input.idempotencyKey)) {
    throw validationError(
      "INVALID_IDEMPOTENCY_KEY",
      "The loyalty claim could not be submitted safely.",
    );
  }
}

function disabled(
  reason: DisabledLoyaltyState["reason"],
): DisabledLoyaltyState {
  return { state: "disabled", reason, blocking: false };
}

function unavailable(
  error?: StorefrontErrorState,
): UnavailableLoyaltyState {
  return {
    state: "unavailable",
    reason: "provider-unavailable",
    blocking: false,
    ...(error ? { error } : {}),
  };
}

function loyaltyError(error: unknown): StorefrontLoyaltyActionError {
  return error instanceof StorefrontLoyaltyActionError
    ? error
    : new StorefrontLoyaltyActionError(toStorefrontErrorState(error));
}

function integrationError(code: string, message: string) {
  return new StorefrontLoyaltyActionError({
    state: "integration-error",
    code,
    message,
  });
}

function assertCartScope(
  input: StorefrontLoyaltyCartScope,
  cart: StorefrontCart,
): void {
  if (cart.id !== input.cartId || cart.locationId !== input.locationId) {
    throw integrationError(
      "LOYALTY_CART_SCOPE_MISMATCH",
      "The loyalty response does not match this ordering session.",
    );
  }
  if (!isStorefrontRevision(cart.revision)) {
    throw integrationError(
      "LOYALTY_CART_REVISION_INVALID",
      "The loyalty response has an invalid cart revision.",
    );
  }
}

function assertMutationCart(
  input: StorefrontCancelLoyaltyInput,
  cart: StorefrontCart,
): void {
  assertCartScope(input, cart);
  if (cart.revision <= input.revision) {
    throw integrationError(
      "LOYALTY_CART_REVISION_NOT_ADVANCED",
      "The loyalty response did not advance the cart revision.",
    );
  }
}

function assertReconciledCart(
  input: StorefrontReconcileLoyaltyCartInput,
  cart: StorefrontCart,
): void {
  assertCartScope(input, cart);
  if (cart.revision < input.revision) {
    throw integrationError(
      "LOYALTY_CART_REVISION_REGRESSED",
      "The refreshed loyalty cart revision is stale.",
    );
  }
}

export function reconcileLoyaltyLedger(
  current: LoyaltyLedger | undefined,
  incoming: LoyaltyLedger,
  strategy: "append" | "refresh",
): LoyaltyLedger {
  if (strategy === "refresh" || !current || !incoming.enabled) {
    return incoming;
  }

  // Ledger entries have no public stable identifier. Preserve every row from
  // each cursor page rather than guessing identity and dropping valid twins.
  const entries = [...(current.entries ?? []), ...(incoming.entries ?? [])];

  return {
    enabled: true,
    ...(incoming.balances !== undefined
      ? { balances: incoming.balances }
      : current.balances !== undefined
        ? { balances: current.balances }
        : {}),
    ...(entries.length > 0 ? { entries } : {}),
    ...(incoming.nextCursor !== undefined
      ? { nextCursor: incoming.nextCursor }
      : {}),
  };
}

export function createStorefrontLoyaltyActions(
  client: StorefrontLoyaltyClient,
  context: StorefrontLoyaltyContext,
  sessions: StorefrontLoyaltySessionAdapters,
): StorefrontLoyaltyActions {
  requireContext(context);

  async function authorized<T>(operation: () => Promise<T>): Promise<T> {
    return await runInStorefrontCustomerScope(
      sessions,
      context.merchantSlug,
      async () => {
        try {
          return await operation();
        } catch (error) {
          const safeError = loyaltyError(error);
          if (safeError.state === "authentication-required") {
            sessions.clearCustomerToken(context.merchantSlug);
          }
          throw safeError;
        }
      },
    );
  }

  async function quote(
    input: StorefrontLoyaltyCartScope,
  ): Promise<StorefrontLoyaltyQuoteResult> {
    requireCartScope(input);
    if (!context.profileEnabled) return disabled("profile-disabled");

    try {
      const response = await authorized(() =>
        client.loyalty.quote(input.locationId, input.cartId),
      );
      if (!response.enabled) return disabled("merchant-disabled");
      if (response.available !== true) return unavailable();
      return { state: "enabled", blocking: false, quote: response };
    } catch (error) {
      const safeError = loyaltyError(error);
      if (safeError.state === "dependency-unavailable") {
        return unavailable(safeError);
      }
      throw safeError;
    }
  }

  async function reconcile(
    input: StorefrontReconcileLoyaltyCartInput,
  ): Promise<StorefrontLoyaltyCartReconciliationResult> {
    requireCartScope(input);
    if (!isStorefrontRevision(input.revision)) {
      throw validationError(
        "INVALID_REVISION",
        "The cart changed. Refresh and try again.",
      );
    }

    try {
      const cart = await authorized(() =>
        client.cart.get(input.locationId, input.cartId),
      );
      assertReconciledCart(input, cart);
      return { state: "reconciled", blocking: false, cart };
    } catch (error) {
      throw loyaltyError(error);
    }
  }

  async function tryReconcileCart(
    input: StorefrontReconcileLoyaltyCartInput,
  ): Promise<StorefrontCart | undefined> {
    try {
      return (await reconcile(input)).cart;
    } catch (error) {
      const safeError = loyaltyError(error);
      if (
        safeError.state === "network-error" ||
        safeError.state === "rate-limited" ||
        safeError.state === "operation-pending" ||
        safeError.state === "dependency-unavailable" ||
        (safeError.state === "unexpected" &&
          safeError.code !== "INVALID_RESPONSE")
      ) {
        return undefined;
      }
      throw safeError;
    }
  }

  async function mutate(
    input: StorefrontCancelLoyaltyInput,
    successState: "applied" | "cancelled",
    operation: () => Promise<StorefrontCart>,
  ): Promise<StorefrontLoyaltyMutationResult> {
    requireMutation(input);
    const capability = await quote(input);
    if (capability.state !== "enabled") return capability;

    try {
      const cart = await authorized(operation);
      assertMutationCart(input, cart);
      return { state: successState, blocking: false, cart };
    } catch (error) {
      const safeError = loyaltyError(error);
      if (
        safeError.state === "dependency-unavailable" ||
        safeError.state === "network-error" ||
        safeError.state === "unexpected" ||
        safeError.state === "operation-pending" ||
        safeError.state === "cart-conflict"
      ) {
        const cart = await tryReconcileCart(input);
        if (safeError.state === "dependency-unavailable") {
          return {
            ...unavailable(safeError),
            ...(cart ? { cart } : {}),
          };
        }
        return {
          state: "reconciliation-required",
          blocking: false,
          error: safeError,
          ...(cart ? { cart } : {}),
        };
      }
      throw safeError;
    }
  }

  async function ledger(
    params?: { limit?: number; cursor?: string },
  ): Promise<StorefrontLoyaltyLedgerResult> {
    requireLedgerParams(params);
    if (!context.profileEnabled) return disabled("profile-disabled");

    try {
      const response = await authorized(() => client.loyalty.ledger(params));
      if (!response.enabled) return disabled("merchant-disabled");
      return { state: "enabled", blocking: false, ledger: response };
    } catch (error) {
      const safeError = loyaltyError(error);
      if (safeError.state === "dependency-unavailable") {
        return unavailable(safeError);
      }
      throw safeError;
    }
  }

  async function accountCapability(): Promise<
    DisabledLoyaltyState | UnavailableLoyaltyState | null
  > {
    const result = await ledger({ limit: 1 });
    return result.state === "enabled" ? null : result;
  }

  return {
    cart: {
      quote,
      reconcile,
      async redeem(input) {
        requireIdentifier(input.rewardId, "INVALID_REWARD_ID");
        return await mutate(input, "applied", () =>
          client.loyalty.redeem(
            input.locationId,
            input.cartId,
            input.rewardId,
            {
              revision: input.revision,
              idempotencyKey: input.idempotencyKey,
            },
          ),
        );
      },
      async cancel(input) {
        return await mutate(input, "cancelled", () =>
          client.loyalty.cancel(input.locationId, input.cartId, {
            revision: input.revision,
            idempotencyKey: input.idempotencyKey,
          }),
        );
      },
    },
    account: {
      ledger,
      claims: {
        async list() {
          const capability = await accountCapability();
          if (capability) return capability;
          try {
            const response = await authorized(() =>
              client.loyalty.claims.list(),
            );
            return {
              state: "enabled",
              blocking: false,
              claims: response.claims,
            };
          } catch (error) {
            const safeError = loyaltyError(error);
            if (safeError.state === "dependency-unavailable") {
              return unavailable(safeError);
            }
            throw safeError;
          }
        },
        async submit(input) {
          requireClaim(input);
          const capability = await accountCapability();
          if (capability) return capability;
          try {
            const claim = await authorized(() =>
              client.loyalty.claims.submit(
                {
                  orderId: input.orderId,
                  reason: input.reason,
                  ...(input.note ? { note: input.note } : {}),
                },
                { idempotencyKey: input.idempotencyKey },
              ),
            );
            return { state: "submitted", blocking: false, claim };
          } catch (error) {
            const safeError = loyaltyError(error);
            if (safeError.state === "dependency-unavailable") {
              return unavailable(safeError);
            }
            throw safeError;
          }
        },
      },
    },
  };
}
