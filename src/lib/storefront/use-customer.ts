"use client";

import type {
  CustomerAddressInput,
  CustomerAddressUpdate,
  StorefrontCustomer,
} from "@craveup/storefront-sdk";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createStorefrontCustomerTransport,
  StorefrontCustomerTransportError,
  toStorefrontCustomerTransportError,
  type StorefrontCustomerChallenge,
  type StorefrontCustomerTransport,
} from "./customer";

export type StorefrontCustomerStatus =
  | "signed-out"
  | "requesting-code"
  | "code-required"
  | "verifying"
  | "authenticated"
  | "error";

export interface StorefrontCustomerState {
  readonly status: StorefrontCustomerStatus;
  readonly challenge: StorefrontCustomerChallenge | null;
  readonly profile: StorefrontCustomer | null;
  readonly error: StorefrontCustomerTransportError | null;
}

export type StorefrontCustomerTransportLoader = () =>
  | StorefrontCustomerTransport
  | Promise<StorefrontCustomerTransport>;

export interface UseStorefrontCustomerOptions {
  readonly merchantSlug: string;
  readonly getTransport?: StorefrontCustomerTransportLoader;
}

interface ScopedStorefrontCustomerState {
  readonly merchantSlug: string;
  readonly state: StorefrontCustomerState;
}

let browserTransportPromise: Promise<StorefrontCustomerTransport> | null = null;

async function getBrowserCustomerTransport(): Promise<StorefrontCustomerTransport> {
  browserTransportPromise ??= import("./browser-client").then(
    ({ storefrontClient }) =>
      createStorefrontCustomerTransport(storefrontClient),
  );
  return browserTransportPromise;
}

function initialCustomerState(): StorefrontCustomerState {
  return {
    status: "signed-out",
    challenge: null,
    profile: null,
    error: null,
  };
}

function missingChallengeError(): StorefrontCustomerTransportError {
  return new StorefrontCustomerTransportError({
    state: "validation",
    code: "CHALLENGE_REQUIRED",
    message: "Request a new verification code.",
  });
}

export function useStorefrontCustomer({
  merchantSlug,
  getTransport = getBrowserCustomerTransport,
}: UseStorefrontCustomerOptions) {
  const [scopedState, setScopedState] = useState<ScopedStorefrontCustomerState>(
    () => ({ merchantSlug, state: initialCustomerState() }),
  );
  const stateRef = useRef(scopedState);
  const merchantRef = useRef(merchantSlug);
  const operationSequenceRef = useRef(0);

  if (scopedState.merchantSlug !== merchantSlug) {
    setScopedState({ merchantSlug, state: initialCustomerState() });
  }

  const state =
    scopedState.merchantSlug === merchantSlug
      ? scopedState.state
      : initialCustomerState();

  const updateState = useCallback((next: StorefrontCustomerState) => {
    const scoped = {
      merchantSlug: merchantRef.current,
      state: next,
    };
    stateRef.current = scoped;
    setScopedState(scoped);
  }, []);

  useEffect(() => {
    merchantRef.current = merchantSlug;
    operationSequenceRef.current += 1;
    stateRef.current = { merchantSlug, state: initialCustomerState() };
  }, [merchantSlug]);

  const beginOperation = useCallback(
    () => (operationSequenceRef.current += 1),
    [],
  );

  const isCurrentOperation = useCallback(
    (operationMerchant: string, operationSequence: number) =>
      merchantRef.current === operationMerchant &&
      operationSequenceRef.current === operationSequence,
    [],
  );

  const currentState = useCallback(
    () =>
      stateRef.current.merchantSlug === merchantRef.current
        ? stateRef.current.state
        : initialCustomerState(),
    [],
  );

  const currentTransport = useCallback(
    async () => await getTransport(),
    [getTransport],
  );

  const fail = useCallback(
    (
      error: unknown,
      previous: StorefrontCustomerState,
      operationMerchant: string,
      operationSequence: number,
    ) => {
      const safeError = toStorefrontCustomerTransportError(error);
      if (isCurrentOperation(operationMerchant, operationSequence)) {
        updateState({
          status: "error",
          challenge: previous.challenge,
          profile: previous.profile,
          error: safeError,
        });
      }
      return safeError;
    },
    [isCurrentOperation, updateState],
  );

  const requestOtp = useCallback(
    async (identifierString: string) => {
      const previous = currentState();
      const operationMerchant = merchantRef.current;
      const operationSequence = beginOperation();
      updateState({
        status: "requesting-code",
        challenge: null,
        profile: null,
        error: null,
      });
      try {
        const transport = await currentTransport();
        const challenge = await transport.auth.requestOtp({
          merchantSlug: operationMerchant,
          identifierString,
        });
        if (isCurrentOperation(operationMerchant, operationSequence)) {
          updateState({
            status: "code-required",
            challenge,
            profile: null,
            error: null,
          });
        }
        return challenge;
      } catch (error) {
        throw fail(error, previous, operationMerchant, operationSequence);
      }
    },
    [
      beginOperation,
      currentState,
      currentTransport,
      fail,
      isCurrentOperation,
      updateState,
    ],
  );

  const resendOtp = useCallback(async () => {
    const previous = currentState();
    const operationMerchant = merchantRef.current;
    const operationSequence = beginOperation();
    if (!previous.challenge) {
      const error = missingChallengeError();
      fail(error, previous, operationMerchant, operationSequence);
      throw error;
    }

    updateState({ ...previous, status: "requesting-code", error: null });
    try {
      const transport = await currentTransport();
      const challenge = await transport.auth.resendOtp(previous.challenge);
      if (isCurrentOperation(operationMerchant, operationSequence)) {
        updateState({
          status: "code-required",
          challenge,
          profile: null,
          error: null,
        });
      }
      return challenge;
    } catch (error) {
      throw fail(error, previous, operationMerchant, operationSequence);
    }
  }, [
    beginOperation,
    currentState,
    currentTransport,
    fail,
    isCurrentOperation,
    updateState,
  ]);

  const verifyOtp = useCallback(
    async (input: {
      otp: string;
      customerName?: string;
      lastName?: string;
    }) => {
      const previous = currentState();
      const operationMerchant = merchantRef.current;
      const operationSequence = beginOperation();
      if (!previous.challenge) {
        const error = missingChallengeError();
        fail(error, previous, operationMerchant, operationSequence);
        throw error;
      }

      updateState({ ...previous, status: "verifying", error: null });
      let transport: StorefrontCustomerTransport;
      try {
        transport = await currentTransport();
        await transport.auth.verifyOtp({
          challenge: previous.challenge,
          ...input,
        });
      } catch (error) {
        throw fail(error, previous, operationMerchant, operationSequence);
      }

      if (isCurrentOperation(operationMerchant, operationSequence)) {
        updateState({
          status: "authenticated",
          challenge: null,
          profile: null,
          error: null,
        });
      }

      try {
        const profile = await transport.auth.getProfile(
          previous.challenge.merchantSlug,
        );
        if (isCurrentOperation(operationMerchant, operationSequence)) {
          updateState({
            status: "authenticated",
            challenge: null,
            profile,
            error: null,
          });
        }
        return profile;
      } catch (error) {
        const safeError = toStorefrontCustomerTransportError(error);
        if (isCurrentOperation(operationMerchant, operationSequence)) {
          updateState({
            status:
              safeError.state === "authentication-required"
                ? "error"
                : "authenticated",
            challenge: null,
            profile: null,
            error: safeError,
          });
        }
        throw safeError;
      }
    },
    [
      beginOperation,
      currentState,
      currentTransport,
      fail,
      isCurrentOperation,
      updateState,
    ],
  );

  const refreshProfile = useCallback(async () => {
    const previous = currentState();
    const operationMerchant = merchantRef.current;
    const operationSequence = beginOperation();
    try {
      const transport = await currentTransport();
      const profile = await transport.auth.getProfile(operationMerchant);
      if (isCurrentOperation(operationMerchant, operationSequence)) {
        updateState({
          status: "authenticated",
          challenge: null,
          profile,
          error: null,
        });
      }
      return profile;
    } catch (error) {
      throw fail(error, previous, operationMerchant, operationSequence);
    }
  }, [
    beginOperation,
    currentState,
    currentTransport,
    fail,
    isCurrentOperation,
    updateState,
  ]);

  const logout = useCallback(async () => {
    const operationMerchant = merchantRef.current;
    const operationSequence = beginOperation();
    try {
      const transport = await currentTransport();
      await transport.auth.logout(operationMerchant);
    } finally {
      if (isCurrentOperation(operationMerchant, operationSequence)) {
        updateState(initialCustomerState());
      }
    }
  }, [beginOperation, currentTransport, isCurrentOperation, updateState]);

  const withTransport = useCallback(
    async <T,>(
      operation: (
        transport: StorefrontCustomerTransport,
        merchant: string,
      ) => Promise<T>,
    ) => {
      const merchant = merchantRef.current;
      const transport = await currentTransport();
      return operation(transport, merchant);
    },
    [currentTransport],
  );

  const orders = useMemo(
    () => ({
      list: (params?: { limit?: number; cursor?: string }) =>
        withTransport((transport, merchant) =>
          transport.orders.list(merchant, params),
        ),
      get: (orderId: string) =>
        withTransport((transport, merchant) =>
          transport.orders.get(merchant, orderId),
        ),
    }),
    [withTransport],
  );

  const addresses = useMemo(
    () => ({
      list: (params?: { limit?: number; cursor?: string }) =>
        withTransport((transport, merchant) =>
          transport.addresses.list(merchant, params),
        ),
      create: (
        payload: CustomerAddressInput,
        config: { idempotencyKey: string },
      ) =>
        withTransport((transport, merchant) =>
          transport.addresses.create(merchant, payload, config),
        ),
      update: (
        addressId: string,
        payload: CustomerAddressUpdate,
        config: { revision: number; idempotencyKey: string },
      ) =>
        withTransport((transport, merchant) =>
          transport.addresses.update(
            merchant,
            addressId,
            payload,
            config,
          ),
        ),
      delete: (
        addressId: string,
        config: { idempotencyKey: string },
      ) =>
        withTransport((transport, merchant) =>
          transport.addresses.delete(merchant, addressId, config),
        ),
    }),
    [withTransport],
  );

  const savedPayments = useMemo(
    () => ({
      list: () =>
        withTransport((transport, merchant) =>
          transport.savedPayments.list(merchant),
        ),
      delete: (paymentId: string) =>
        withTransport((transport, merchant) =>
          transport.savedPayments.delete(merchant, paymentId),
        ),
    }),
    [withTransport],
  );

  return {
    state,
    requestOtp,
    resendOtp,
    verifyOtp,
    refreshProfile,
    logout,
    orders,
    addresses,
    savedPayments,
  };
}
