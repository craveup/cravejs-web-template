import type {
  AddCartItemPayload,
  RequestConfig,
  StorefrontCart,
} from "@craveup/storefront-sdk";

import {
  isStorefrontIdempotencyKey,
  isStorefrontRevision,
} from "./action-input";
import {
  toStorefrontErrorState,
  type StorefrontErrorState,
} from "./error-state";

interface StorefrontCartClient {
  readonly cart: {
    get(
      locationId: string,
      cartId: string,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    addItem(
      locationId: string,
      cartId: string,
      payload: AddCartItemPayload,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    updateItemQuantity(
      locationId: string,
      cartId: string,
      itemId: string,
      quantity: number,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    removeItem(
      locationId: string,
      cartId: string,
      itemId: string,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
    delete(
      locationId: string,
      cartId: string,
      config?: RequestConfig,
    ): Promise<StorefrontCart>;
  };
}

interface CartMutationIdentity {
  readonly locationId: string;
  readonly cartId: string;
  readonly revision: number;
  readonly idempotencyKey: string;
}

export interface AddStorefrontCartItemInput extends CartMutationIdentity {
  readonly payload: AddCartItemPayload;
}

export interface UpdateStorefrontCartItemQuantityInput
  extends CartMutationIdentity {
  readonly itemId: string;
  readonly quantity: number;
}

export interface RemoveStorefrontCartItemInput extends CartMutationIdentity {
  readonly itemId: string;
}

export interface ReadStorefrontCartInput {
  readonly locationId: string;
  readonly cartId: string;
}

export type StorefrontAddItemResult =
  | Readonly<{ state: "succeeded"; cart: StorefrontCart }>
  | Readonly<{
      state: "retry-required";
      cart: StorefrontCart;
      error: StorefrontErrorState;
    }>;

export type StorefrontCartItemMutationResult = StorefrontAddItemResult;

export type DeleteStorefrontCartInput = CartMutationIdentity;

export type StorefrontDeleteCartResult =
  | Readonly<{ state: "deleted"; cart: StorefrontCart }>
  | Readonly<{
      state: "retry-required";
      cart: StorefrontCart;
      error: StorefrontErrorState;
    }>;

export class StorefrontCartActionError extends Error {
  readonly state: StorefrontErrorState["state"];
  readonly code: string;
  readonly requestId?: string;
  readonly details?: StorefrontErrorState["details"];
  readonly retryAfterMs?: number;
  readonly method?: string;
  readonly routeTemplate?: string;

  constructor(error: StorefrontErrorState) {
    super(error.message);
    this.name = "StorefrontCartActionError";
    this.state = error.state;
    this.code = error.code;
    this.requestId = error.requestId;
    this.details = error.details;
    this.retryAfterMs = error.retryAfterMs;
    this.method = error.method;
    this.routeTemplate = error.routeTemplate;
  }
}

export interface StorefrontCartActions {
  get(input: ReadStorefrontCartInput): Promise<StorefrontCart>;
  addItem(input: AddStorefrontCartItemInput): Promise<StorefrontAddItemResult>;
  updateItemQuantity(
    input: UpdateStorefrontCartItemQuantityInput,
  ): Promise<StorefrontCartItemMutationResult>;
  removeItem(
    input: RemoveStorefrontCartItemInput,
  ): Promise<StorefrontCartItemMutationResult>;
  delete(
    input: DeleteStorefrontCartInput,
  ): Promise<StorefrontDeleteCartResult>;
}

function assertMutationIdentity(input: CartMutationIdentity): void {
  if (
    !input.locationId ||
    input.locationId.trim() !== input.locationId ||
    !input.cartId ||
    input.cartId.trim() !== input.cartId ||
    !isStorefrontRevision(input.revision)
  ) {
    throw new StorefrontCartActionError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The cart mutation request is invalid.",
    });
  }
  if (!isStorefrontIdempotencyKey(input.idempotencyKey)) {
    throw new StorefrontCartActionError({
      state: "integration-error",
      code: "INVALID_IDEMPOTENCY_KEY",
      message: "The cart mutation could not be started safely.",
    });
  }
}

function assertCartIdentity(input: ReadStorefrontCartInput): void {
  if (
    !input.locationId ||
    input.locationId.trim() !== input.locationId ||
    !input.cartId ||
    input.cartId.trim() !== input.cartId
  ) {
    throw new StorefrontCartActionError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The cart request is invalid.",
    });
  }
}

function assertItemId(itemId: string): void {
  if (!itemId || itemId.trim() !== itemId) {
    throw new StorefrontCartActionError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The cart item request is invalid.",
    });
  }
}

function assertItemQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new StorefrontCartActionError({
      state: "validation",
      code: "VALIDATION_ERROR",
      message: "The cart item quantity is invalid.",
    });
  }
}

function actionError(error: unknown): StorefrontCartActionError {
  return error instanceof StorefrontCartActionError
    ? error
    : new StorefrontCartActionError(toStorefrontErrorState(error));
}

export function createStorefrontCartActions(
  client: StorefrontCartClient,
): StorefrontCartActions {
  async function mutateItem(
    input: CartMutationIdentity,
    mutation: () => Promise<StorefrontCart>,
  ): Promise<StorefrontCartItemMutationResult> {
    assertMutationIdentity(input);
    try {
      return { state: "succeeded", cart: await mutation() };
    } catch (error) {
      const safeError = toStorefrontErrorState(error);
      if (safeError.code !== "CART_CONFLICT") {
        throw new StorefrontCartActionError(safeError);
      }
      try {
        const cart = await client.cart.get(input.locationId, input.cartId);
        return { state: "retry-required", cart, error: safeError };
      } catch {
        throw new StorefrontCartActionError(safeError);
      }
    }
  }

  return {
    async get(input: ReadStorefrontCartInput): Promise<StorefrontCart> {
      assertCartIdentity(input);
      try {
        return await client.cart.get(input.locationId, input.cartId);
      } catch (error) {
        throw actionError(error);
      }
    },

    async addItem(
      input: AddStorefrontCartItemInput,
    ): Promise<StorefrontAddItemResult> {
      assertMutationIdentity(input);

      try {
        const cart = await client.cart.addItem(
          input.locationId,
          input.cartId,
          input.payload,
          {
            idempotencyKey: input.idempotencyKey,
            revision: input.revision,
          },
        );
        return { state: "succeeded", cart } as const;
      } catch (error) {
        const safeError = toStorefrontErrorState(error);
        if (safeError.code !== "CART_CONFLICT") {
          throw new StorefrontCartActionError(safeError);
        }

        try {
          const cart = await client.cart.get(
            input.locationId,
            input.cartId,
          );
          return {
            state: "retry-required",
            cart,
            error: safeError,
          } as const;
        } catch {
          throw new StorefrontCartActionError(safeError);
        }
      }
    },

    async updateItemQuantity(
      input: UpdateStorefrontCartItemQuantityInput,
    ): Promise<StorefrontCartItemMutationResult> {
      assertItemId(input.itemId);
      assertItemQuantity(input.quantity);
      return mutateItem(input, () =>
        client.cart.updateItemQuantity(
          input.locationId,
          input.cartId,
          input.itemId,
          input.quantity,
          {
            idempotencyKey: input.idempotencyKey,
            revision: input.revision,
          },
        ),
      );
    },

    async removeItem(
      input: RemoveStorefrontCartItemInput,
    ): Promise<StorefrontCartItemMutationResult> {
      assertItemId(input.itemId);
      return mutateItem(input, () =>
        client.cart.removeItem(
          input.locationId,
          input.cartId,
          input.itemId,
          {
            idempotencyKey: input.idempotencyKey,
            revision: input.revision,
          },
        ),
      );
    },

    async delete(
      input: DeleteStorefrontCartInput,
    ): Promise<StorefrontDeleteCartResult> {
      assertMutationIdentity(input);

      try {
        const cart = await client.cart.delete(
          input.locationId,
          input.cartId,
          {
            idempotencyKey: input.idempotencyKey,
            revision: input.revision,
          },
        );
        return { state: "deleted", cart };
      } catch (error) {
        const safeError = toStorefrontErrorState(error);
        if (safeError.code !== "CART_CONFLICT") {
          throw actionError(error);
        }

        try {
          const cart = await client.cart.get(input.locationId, input.cartId);
          return { state: "retry-required", cart, error: safeError };
        } catch {
          throw new StorefrontCartActionError(safeError);
        }
      }
    },
  };
}
