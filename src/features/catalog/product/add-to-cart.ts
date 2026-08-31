import type {
  AddCartItemPayload,
  SelectedModifierTypes,
  StorefrontCart,
} from "@craveup/storefront-sdk";

import type {
  CartMutationCoordinator,
  CartMutationErrorView,
} from "@/features/cart/cart-mutation-coordinator";

import type {
  ItemCustomizationIntent,
  ItemModifierSelectionIntent,
} from "./item-types";

export type ProductCartActionResult =
  | Readonly<{ state: "succeeded"; cart: StorefrontCart }>
  | Readonly<{
      state: "retry-required";
      cart: StorefrontCart;
      error: CartMutationErrorView;
    }>;

export interface ProductCartAction {
  add(
    intent: ItemCustomizationIntent,
    categoryId?: string,
  ): Promise<ProductCartActionResult>;
  retryConflict(): Promise<ProductCartActionResult>;
  retryLostResponse(): Promise<ProductCartActionResult>;
}

interface CreateProductCartActionInput {
  readonly coordinator: CartMutationCoordinator;
  readonly createIntentId?: () => string;
}

function serializeSelections(
  selections: readonly ItemModifierSelectionIntent[],
): SelectedModifierTypes[] {
  const groups = new Map<string, SelectedModifierTypes>();

  for (const selection of selections) {
    let group = groups.get(selection.modifierGroupId);
    if (!group) {
      group = {
        groupId: selection.modifierGroupId,
        selectedOptions: [],
      };
      groups.set(selection.modifierGroupId, group);
    }

    const children = serializeSelections(selection.childSelections);
    group.selectedOptions.push({
      optionId: selection.modifierOptionId,
      quantity: selection.quantity,
      ...(children.length ? { children } : {}),
    });
  }

  return [...groups.values()];
}

export function toAddCartItemPayload(
  intent: ItemCustomizationIntent,
  categoryId?: string,
): AddCartItemPayload {
  const specialInstructions = intent.specialInstructions?.trim();

  return {
    productId: intent.productId,
    quantity: intent.quantity,
    ...(specialInstructions ? { specialInstructions } : {}),
    itemUnavailableAction: "remove_item",
    selections: serializeSelections(intent.modifierSelections),
    ...(categoryId ? { categoryId } : {}),
  };
}

function asProductResult(
  result: Awaited<ReturnType<CartMutationCoordinator["retryConflict"]>>,
): ProductCartActionResult {
  if (result.state === "succeeded" || result.state === "retry-required") {
    return result;
  }
  if (result.state === "reconciled") {
    return { state: "succeeded", cart: result.cart };
  }
  throw new TypeError("The product cart action returned an unexpected result.");
}

export function createProductCartAction({
  coordinator,
  createIntentId = () => globalThis.crypto.randomUUID(),
}: CreateProductCartActionInput): ProductCartAction {
  let conflictIntentId: string | undefined;
  let lostResponseIntentId: string | undefined;

  return {
    async add(intent, categoryId) {
      const intentId = createIntentId();
      try {
        const result = await coordinator.addItem({
          intentId,
          payload: toAddCartItemPayload(intent, categoryId),
        });
        conflictIntentId =
          result.state === "retry-required" ? intentId : undefined;
        lostResponseIntentId = undefined;
        return result;
      } catch (error) {
        const snapshot = coordinator.getSnapshot();
        lostResponseIntentId =
          snapshot.state === "retryable-failure" &&
          snapshot.intentId === intentId
            ? intentId
            : undefined;
        throw error;
      }
    },

    async retryConflict() {
      if (!conflictIntentId) {
        throw new TypeError("There is no product cart conflict to retry.");
      }
      const result = asProductResult(
        await coordinator.retryConflict(conflictIntentId),
      );
      if (result.state === "succeeded") conflictIntentId = undefined;
      return result;
    },

    async retryLostResponse() {
      if (!lostResponseIntentId) {
        throw new TypeError("There is no product cart response to recover.");
      }
      const result = asProductResult(
        await coordinator.retryLostResponse(lostResponseIntentId),
      );
      if (result.state === "succeeded") lostResponseIntentId = undefined;
      return result;
    },
  };
}
