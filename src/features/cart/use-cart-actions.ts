"use client";

import type { StorefrontCart } from "@craveup/storefront-sdk";
import { useCallback, useRef, useState } from "react";

import { CartMutationCoordinatorError } from "./cart-mutation-coordinator";
import {
  loadCartMutationCoordinator,
  type CartActionRuntime,
} from "./cart-runtime";

type RecoveryKind = "conflict" | "lost-response";

export type CartActionState = Readonly<{
  cart: StorefrontCart;
  pendingItemId?: string;
  pending: boolean;
  announceCart?: boolean;
  message?: string;
  recovery?: RecoveryKind;
}>;

function safeMessage(error: unknown): string {
  if (!(error instanceof CartMutationCoordinatorError)) {
    return "We could not update your order. Try again.";
  }
  if (error.state === "network-error") {
    return "We could not confirm the update. Check your connection before retrying.";
  }
  if (error.state === "rate-limited" || error.state === "dependency-unavailable") {
    return "Ordering is temporarily unavailable. Try again shortly.";
  }
  if (error.state === "cart-immutable") {
    return "This order can no longer be changed.";
  }
  return "We could not update your order. Try again.";
}

export function useCartActions(
  runtime: CartActionRuntime,
  initialCart: StorefrontCart,
) {
  const [state, setState] = useState<CartActionState>({
    cart: initialCart,
    pending: false,
  });
  const active = useRef<Promise<void> | undefined>(undefined);
  const recoveryIntentId = useRef<string | undefined>(undefined);
  const coordinatorRef = useRef<
    Awaited<ReturnType<typeof loadCartMutationCoordinator>> | undefined
  >(undefined);

  const run = useCallback(
    (input: {
      readonly itemId?: string;
      readonly execute: (
        coordinator: Awaited<ReturnType<typeof loadCartMutationCoordinator>>,
        intentId: string,
      ) => Promise<{ readonly state: string; readonly cart: StorefrontCart }>;
    }): Promise<void> => {
      if (active.current) return active.current;
      const intentId = globalThis.crypto.randomUUID();
      setState((current) => ({
        cart: current.cart,
        pending: true,
        ...(input.itemId ? { pendingItemId: input.itemId } : {}),
      }));
      const request = loadCartMutationCoordinator(runtime, initialCart)
        .then((coordinator) => {
          coordinatorRef.current = coordinator;
          return input.execute(coordinator, intentId);
        })
        .then((result) => {
          if (result.state === "retry-required") {
            recoveryIntentId.current = intentId;
            setState({
              cart: result.cart,
              pending: false,
              message: "Your order changed. Review it, then retry your update.",
              recovery: "conflict",
            });
            return;
          }
          recoveryIntentId.current = undefined;
          setState({ cart: result.cart, pending: false, announceCart: true });
        })
        .catch((error: unknown) => {
          const snapshot = coordinatorRef.current?.getSnapshot();
          const lostResponse = snapshot?.state === "retryable-failure";
          recoveryIntentId.current = lostResponse ? intentId : undefined;
          setState({
            cart: snapshot?.cart ?? initialCart,
            pending: false,
            message: safeMessage(error),
            ...(lostResponse ? { recovery: "lost-response" } : {}),
          });
        })
        .finally(() => {
          active.current = undefined;
        });
      active.current = request;
      return request;
    },
    [initialCart, runtime],
  );

  const updateItemQuantity = useCallback(
    (itemId: string, quantity: number) =>
      run({
        itemId,
        execute: (coordinator, intentId) =>
          coordinator.updateItemQuantity({ intentId, itemId, quantity }),
      }),
    [run],
  );
  const removeItem = useCallback(
    (itemId: string) =>
      run({
        itemId,
        execute: (coordinator, intentId) =>
          coordinator.removeItem({ intentId, itemId }),
      }),
    [run],
  );
  const clear = useCallback(
    () =>
      run({
        execute: (coordinator, intentId) => coordinator.clear({ intentId }),
      }),
    [run],
  );
  const retry = useCallback((): Promise<void> => {
    if (active.current) return active.current;
    const intentId = recoveryIntentId.current;
    if (!intentId || !state.recovery) return Promise.resolve();
    setState((current) => ({ cart: current.cart, pending: true }));
    const request = loadCartMutationCoordinator(runtime, initialCart)
      .then((coordinator) =>
        {
          coordinatorRef.current = coordinator;
          return state.recovery === "conflict"
            ? coordinator.retryConflict(intentId)
            : coordinator.retryLostResponse(intentId);
        },
      )
      .then((result) => {
        if (result.state === "retry-required") {
          setState({
            cart: result.cart,
            pending: false,
            message: "Your order changed again. Review it before retrying.",
            recovery: "conflict",
          });
          return;
        }
        recoveryIntentId.current = undefined;
        setState({ cart: result.cart, pending: false, announceCart: true });
      })
      .catch((error: unknown) => {
        const snapshot = coordinatorRef.current?.getSnapshot();
        const recovery =
          snapshot?.state === "retry-required"
            ? "conflict"
            : snapshot?.state === "retryable-failure"
              ? "lost-response"
              : undefined;
        recoveryIntentId.current = recovery ? intentId : undefined;
        setState({
          cart: snapshot?.cart ?? initialCart,
          pending: false,
          message: safeMessage(error),
          ...(recovery ? { recovery } : {}),
        });
      })
      .finally(() => {
        active.current = undefined;
      });
    active.current = request;
    return request;
  }, [initialCart, runtime, state.recovery]);

  return { state, updateItemQuantity, removeItem, clear, retry } as const;
}
