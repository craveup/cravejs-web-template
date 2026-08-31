"use client";

import { useEffect, useRef, useState } from "react";

import {
  StorefrontOrderingSessionError,
  type StorefrontOrderingSessionResult,
} from "@/lib/storefront/ordering-session";
import {
  toStorefrontErrorState,
  type StorefrontErrorState,
} from "@/lib/storefront/error-state";

import type { EntryIntent } from "./resolve-entry-intent";
import { getEntrySessionBootstrapMessages } from "./entry-session-bootstrap.messages";
import {
  runEntrySession,
  type EntrySessionRuntime,
} from "./entry-session-runtime";
import styles from "./entry-banner.module.css";

interface EntrySessionBootstrapProps {
  readonly intent: EntryIntent;
  readonly locationId: string;
  readonly locale: string;
  readonly runtime: EntrySessionRuntime;
}

type BootstrapState =
  | Readonly<{ status: "pending"; recovery: boolean }>
  | Readonly<{
      status: "ready";
      result: StorefrontOrderingSessionResult;
      recovery: boolean;
    }>
  | Readonly<{
      status: "error";
      error: StorefrontErrorState;
      recovery: boolean;
    }>;

const retryableStates = new Set<StorefrontErrorState["state"]>([
  "rate-limited",
  "dependency-unavailable",
  "network-error",
  "operation-pending",
  "unexpected",
]);

const newOrderStates = new Set<StorefrontErrorState["state"]>([
  "access-denied",
  "cart-conflict",
  "cart-immutable",
]);

function normalizeError(error: unknown): StorefrontErrorState {
  if (error instanceof StorefrontOrderingSessionError) {
    return {
      state: error.state,
      code: error.code,
      message: error.message,
      ...(error.requestId ? { requestId: error.requestId } : {}),
      ...(error.details ? { details: error.details } : {}),
      ...(error.retryAfterMs !== undefined
        ? { retryAfterMs: error.retryAfterMs }
        : {}),
      ...(error.method ? { method: error.method } : {}),
      ...(error.routeTemplate ? { routeTemplate: error.routeTemplate } : {}),
    };
  }
  return toStorefrontErrorState(error);
}

function runtimeKey(runtime: EntrySessionRuntime): string {
  return runtime.kind === "fixture"
    ? `fixture:${runtime.runtime.config.profile}:${runtime.runtime.config.merchantSlug}`
    : `live:${runtime.merchantSlug}`;
}

export function EntrySessionBootstrap({
  intent,
  locationId,
  locale,
  runtime,
}: EntrySessionBootstrapProps) {
  const validIntent = intent.kind === "invalid" ? null : intent;
  const messages = getEntrySessionBootstrapMessages(
    locale,
    validIntent?.detail.mode ?? "takeout",
  );
  const [attemptNumber, setAttemptNumber] = useState(0);
  const [state, setState] = useState<BootstrapState>({
    status: "pending",
    recovery: false,
  });
  const [rateLimitRemaining, setRateLimitRemaining] = useState(0);
  const idempotencyKey = useRef<string | undefined>(undefined);
  const requestScope = useRef<string | undefined>(undefined);
  const resetExistingCart = useRef(false);
  const recoveryFocus = useRef(false);
  const pendingStatusRef = useRef<HTMLSpanElement>(null);
  const readyStatusRef = useRef<HTMLSpanElement>(null);
  const errorRef = useRef<HTMLSpanElement>(null);
  const attempt = useRef<{
    key: string;
    promise: Promise<StorefrontOrderingSessionResult>;
  } | undefined>(undefined);
  const intentKey = validIntent ? JSON.stringify(validIntent) : "invalid";
  const scopeKey = `${runtimeKey(runtime)}:${locationId}:${intentKey}`;
  const requestKey = `${scopeKey}:${attemptNumber}`;

  useEffect(() => {
    if (rateLimitRemaining <= 0) return;
    const timeout = window.setTimeout(() => {
      setRateLimitRemaining((seconds) => Math.max(seconds - 1, 0));
    }, 1_000);
    return () => window.clearTimeout(timeout);
  }, [rateLimitRemaining]);

  useEffect(() => {
    if (!validIntent) return;

    if (requestScope.current !== scopeKey) {
      requestScope.current = scopeKey;
      idempotencyKey.current = undefined;
      attempt.current = undefined;
      resetExistingCart.current = false;
      setRateLimitRemaining(0);
      setState({ status: "pending", recovery: false });
    }
    if (!idempotencyKey.current) {
      idempotencyKey.current = globalThis.crypto.randomUUID();
    }
    if (attempt.current?.key !== requestKey) {
      attempt.current = {
        key: requestKey,
        promise: runEntrySession(runtime, {
          locationId,
          intent: validIntent,
          idempotencyKey: idempotencyKey.current,
          ...(resetExistingCart.current ? { resetExistingCart: true } : {}),
        }),
      };
    }

    let active = true;
    void attempt.current.promise.then(
      (result) => {
        if (active) {
          resetExistingCart.current = false;
          setRateLimitRemaining(0);
          setState({
            status: "ready",
            result,
            recovery: recoveryFocus.current,
          });
        }
      },
      (error: unknown) => {
        if (active) {
          const normalized = normalizeError(error);
          setRateLimitRemaining(
            normalized.state === "rate-limited" ||
              normalized.state === "operation-pending"
              ? Math.max(Math.ceil((normalized.retryAfterMs ?? 1_000) / 1_000), 1)
              : 0,
          );
          setState({
            status: "error",
            error: normalized,
            recovery: recoveryFocus.current,
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [locationId, requestKey, runtime, scopeKey, validIntent]);

  useEffect(() => {
    if (!state.recovery) return;
    if (state.status === "pending") {
      pendingStatusRef.current?.focus();
      return;
    }
    if (state.status === "ready") readyStatusRef.current?.focus();
    if (state.status === "error") errorRef.current?.focus();
    recoveryFocus.current = false;
  }, [state.recovery, state.status]);

  if (!validIntent) return null;
  if (state.status === "pending") {
    if (state.recovery) {
      return (
        <div className={styles.banner}>
          <span
            className={styles.focusedStatus}
            ref={pendingStatusRef}
            role="status"
            tabIndex={-1}
          >
            <strong>{messages.restarting}</strong>
          </span>
        </div>
      );
    }
    return (
      <span className="sr-only" role="status" aria-live="polite">
        {messages.starting}
      </span>
    );
  }
  if (state.status === "ready") {
    if (state.recovery) {
      return (
        <div className={styles.banner}>
          <span
            className={styles.focusedStatus}
            ref={readyStatusRef}
            role="status"
            tabIndex={-1}
          >
            <strong>{messages.ready}</strong>
          </span>
        </div>
      );
    }
    return (
      <span
        className="sr-only"
        ref={readyStatusRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
      >
        {messages.ready}
      </span>
    );
  }

  const startsNewOrder = newOrderStates.has(state.error.state);
  const canRetry = startsNewOrder || retryableStates.has(state.error.state);
  const retryBlocked =
    (state.error.state === "rate-limited" ||
      state.error.state === "operation-pending") &&
    rateLimitRemaining > 0;
  const retryLabel = startsNewOrder
    ? messages.startNewOrderLabel
    : retryBlocked
      ? messages.retryIn(rateLimitRemaining)
      : messages.retryLabel;
  return (
    <div className={`${styles.banner} ${styles.invalid}`}>
      <span
        className={state.recovery ? styles.focusedStatus : undefined}
        ref={errorRef}
        role="alert"
        tabIndex={-1}
      >
        <strong>{messages.error[state.error.state]}</strong>
      </span>
      {canRetry ? (
        <button
          className={styles.retry}
          type="button"
          disabled={retryBlocked}
          onClick={() => {
            if (retryBlocked) return;
            resetExistingCart.current = startsNewOrder;
            if (startsNewOrder) {
              idempotencyKey.current = undefined;
            }
            attempt.current = undefined;
            setRateLimitRemaining(0);
            recoveryFocus.current = true;
            setState({ status: "pending", recovery: true });
            setAttemptNumber((value) => value + 1);
          }}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
