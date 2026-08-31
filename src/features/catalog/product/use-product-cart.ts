"use client";

import type { StorefrontCart } from "@craveup/storefront-sdk";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CartMutationCoordinatorError,
  type CartMutationErrorView,
} from "@/features/cart/cart-mutation-coordinator";
import { toStorefrontErrorState } from "@/lib/storefront/error-state";
import { StorefrontOrderingSessionError } from "@/lib/storefront/ordering-session";

import type { ItemCustomizationIntent, ModifierGroupValidationError } from "./item-types";
import {
  loadProductCartAction,
  type ProductCartRuntime,
} from "./product-cart-runtime";

export type ProductCartState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "pending" }>
  | Readonly<{
      status: "retry-required";
      message: string;
      groupError?: ModifierGroupValidationError;
    }>
  | Readonly<{
      status: "error";
      message: string;
      groupError?: ModifierGroupValidationError;
    }>
  | Readonly<{
      status: "retryable";
      message: string;
      retryAfterSeconds?: number;
    }>
  | Readonly<{ status: "succeeded"; cart: StorefrontCart }>;

type ProductCartRecovery = Readonly<{
  scope: string;
  action?: Awaited<ReturnType<typeof loadProductCartAction>>;
  intent: ItemCustomizationIntent;
  retryNotBefore?: number;
}>;

function errorState(error: unknown) {
  return error instanceof CartMutationCoordinatorError ||
    error instanceof StorefrontOrderingSessionError
    ? error.state
    : toStorefrontErrorState(error).state;
}

function isRetryableError(error: unknown): boolean {
  return [
    "network-error",
    "rate-limited",
    "dependency-unavailable",
    "operation-pending",
  ].includes(errorState(error));
}

function retryDelayMs(error: unknown): number | undefined {
  const safeError =
    error instanceof CartMutationCoordinatorError ||
    error instanceof StorefrontOrderingSessionError
      ? error
      : toStorefrontErrorState(error);
  if (
    safeError.state !== "rate-limited" &&
    safeError.state !== "dependency-unavailable" &&
    safeError.state !== "operation-pending"
  ) {
    return undefined;
  }
  return safeError.retryAfterMs ?? 1_000;
}

function messageForError(error: unknown): string {
  const state =
    error instanceof CartMutationCoordinatorError ||
    error instanceof StorefrontOrderingSessionError
      ? error.state
      : toStorefrontErrorState(error).state;
  if (state === "network-error") {
    return "We could not reach the restaurant. Check your connection and try again.";
  }
  if (state === "rate-limited" || state === "dependency-unavailable") {
    return "Ordering is temporarily unavailable. Try again shortly.";
  }
  if (state === "cart-immutable") {
    return "This order can no longer be changed. Start a new order to continue.";
  }
  return "We could not add this item. Review your choices and try again.";
}

function validationGroup(
  error: Pick<CartMutationErrorView, "details">,
): ModifierGroupValidationError | undefined {
  const modifierGroupId = error.details?.modifierGroupId;
  if (typeof modifierGroupId !== "string") return undefined;
  return {
    modifierGroupId,
    message: "Review the required choices in this section.",
  };
}

export function useProductCart(
  runtime: ProductCartRuntime | undefined,
  locationId: string,
  productId: string,
  categoryId?: string,
) {
  const [scopedState, setScopedState] = useState<{
    readonly scope: string;
    readonly value: ProductCartState;
  }>();
  const activeRequest = useRef<
    Readonly<{ scope: string; promise: Promise<void> }> | undefined
  >(undefined);
  const recovery = useRef<ProductCartRecovery | undefined>(undefined);
  const scope = runtime
    ? `${runtime.mode}:${runtime.mode === "fixture" ? runtime.runtime.config.profile : "live"}:${runtime.mode === "fixture" ? runtime.runtime.config.merchantSlug : runtime.merchantSlug}:${locationId}:${productId}`
    : `disabled:${locationId}:${productId}`;

  const state =
    scopedState?.scope === scope
      ? scopedState.value
      : ({ status: "idle" } as const);
  const retryAfterSeconds =
    state.status === "retryable" ? state.retryAfterSeconds : undefined;
  const setState = useCallback(
    (value: ProductCartState) => setScopedState({ scope, value }),
    [scope],
  );
  useEffect(() => {
    if (state.status !== "retryable" || retryAfterSeconds === undefined) {
      return;
    }
    const timer = window.setTimeout(() => {
      setScopedState((current) => {
        if (
          current?.scope !== scope ||
          current.value.status !== "retryable" ||
          current.value.retryAfterSeconds === undefined
        ) {
          return current;
        }
        return {
          scope,
          value:
            current.value.retryAfterSeconds <= 1
              ? {
                  status: "retryable",
                  message: current.value.message,
                }
              : {
                  ...current.value,
                  retryAfterSeconds: current.value.retryAfterSeconds - 1,
                },
        };
      });
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [retryAfterSeconds, scope, state.status]);

  const submit = useCallback(
    (intent: ItemCustomizationIntent): Promise<void> => {
      if (!runtime) return Promise.resolve();
      if (activeRequest.current?.scope === scope) {
        return activeRequest.current.promise;
      }

      setState({ status: "pending" });
      let loadedAction: Awaited<ReturnType<typeof loadProductCartAction>> | undefined;
      const request = loadProductCartAction(runtime, locationId)
        .then((action) => {
          loadedAction = action;
          return action.add(intent, categoryId);
        })
        .then((result) => {
          recovery.current = undefined;
          if (result.state === "succeeded") {
            setState({ status: "succeeded", cart: result.cart });
            return;
          }
          setState({
            status: "retry-required",
            message: "Your order changed. Review it, then retry this item.",
            ...(validationGroup(result.error)
              ? { groupError: validationGroup(result.error) }
              : {}),
          });
        })
        .catch((error: unknown) => {
          if (isRetryableError(error)) {
            const retryDelay = retryDelayMs(error);
            recovery.current = {
              scope,
              ...(loadedAction ? { action: loadedAction } : {}),
              intent,
              ...(retryDelay !== undefined
                ? { retryNotBefore: Date.now() + retryDelay }
                : {}),
            };
            setState({
              status: "retryable",
              message: messageForError(error),
              ...(retryDelay !== undefined
                ? { retryAfterSeconds: Math.max(Math.ceil(retryDelay / 1_000), 1) }
                : {}),
            });
            return;
          }
          recovery.current = undefined;
          setState({ status: "error", message: messageForError(error) });
        })
        .finally(() => {
          if (activeRequest.current?.scope === scope) {
            activeRequest.current = undefined;
          }
        });
      activeRequest.current = { scope, promise: request };
      return request;
    },
    [categoryId, locationId, runtime, scope, setState],
  );

  const retryConflict = useCallback((): Promise<void> => {
    if (!runtime || activeRequest.current?.scope === scope) {
      return activeRequest.current?.promise ?? Promise.resolve();
    }
    setState({ status: "pending" });
    const request = loadProductCartAction(runtime, locationId)
      .then((action) => action.retryConflict())
      .then((result) => {
        if (result.state === "succeeded") {
          setState({ status: "succeeded", cart: result.cart });
          return;
        }
        setState({
          status: "retry-required",
          message: "Your order changed again. Review it before retrying.",
        });
      })
      .catch((error: unknown) => {
        setState({ status: "error", message: messageForError(error) });
      })
      .finally(() => {
        if (activeRequest.current?.scope === scope) {
          activeRequest.current = undefined;
        }
      });
    activeRequest.current = { scope, promise: request };
    return request;
  }, [locationId, runtime, scope, setState]);

  const retry = useCallback((): Promise<void> => {
    if (!runtime || activeRequest.current?.scope === scope) {
      return activeRequest.current?.promise ?? Promise.resolve();
    }
    const retained = recovery.current;
    if (!retained || retained.scope !== scope) return Promise.resolve();
    if ((retained.retryNotBefore ?? 0) > Date.now()) return Promise.resolve();

    setState({ status: "pending" });
    let loadedAction = retained.action;
    const request = (loadedAction
      ? loadedAction.retryLostResponse()
      : loadProductCartAction(runtime, locationId).then((action) => {
          loadedAction = action;
          return action.add(retained.intent, categoryId);
        }))
      .then((result) => {
        recovery.current = undefined;
        if (result.state === "succeeded") {
          setState({ status: "succeeded", cart: result.cart });
          return;
        }
        setState({
          status: "retry-required",
          message: "Your order changed. Review it, then retry this item.",
          ...(validationGroup(result.error)
            ? { groupError: validationGroup(result.error) }
            : {}),
        });
      })
      .catch((error: unknown) => {
        if (isRetryableError(error)) {
          const retryDelay = retryDelayMs(error);
          recovery.current = {
            scope,
            ...(loadedAction ? { action: loadedAction } : {}),
            intent: retained.intent,
            ...(retryDelay !== undefined
              ? { retryNotBefore: Date.now() + retryDelay }
              : {}),
          };
          setState({
            status: "retryable",
            message: messageForError(error),
            ...(retryDelay !== undefined
              ? { retryAfterSeconds: Math.max(Math.ceil(retryDelay / 1_000), 1) }
              : {}),
          });
          return;
        }
        recovery.current = undefined;
        setState({ status: "error", message: messageForError(error) });
      })
      .finally(() => {
        if (activeRequest.current?.scope === scope) {
          activeRequest.current = undefined;
        }
      });
    activeRequest.current = { scope, promise: request };
    return request;
  }, [categoryId, locationId, runtime, scope, setState]);

  return { state, submit, retryConflict, retry } as const;
}
