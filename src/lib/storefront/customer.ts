import type {
  CursorPage,
  CustomerAddress,
  CustomerAddressInput,
  CustomerAddressUpdate,
  CustomerLoginRequest,
  CustomerLoginResponse,
  CustomerOtpRequest,
  CustomerOtpResponse,
  PublicOrderDetail,
  PublicOrderSummary,
  RequestConfig,
  SavedPaymentMethod,
  StorefrontCustomer,
} from "@craveup/storefront-sdk";

import {
  clearCustomerToken,
  setCustomerToken,
} from "./customer-session";
import {
  isStorefrontIdempotencyKey,
  isStorefrontRevision,
} from "./action-input";
import { runInStorefrontCustomerScope } from "./customer-scope";
import {
  toStorefrontErrorState,
  type StorefrontErrorState,
} from "./error-state";
import { setActiveStorefrontMerchant } from "./session-store";

export interface StorefrontCustomerChallenge {
  readonly merchantSlug: string;
  readonly identifierString: string;
  readonly methodId: string;
  readonly delivery: CustomerLoginResponse["delivery"];
}

export interface StorefrontCustomerSessionAdapters {
  readonly setMerchantScope: (merchantSlug: string) => void;
  readonly setToken: (merchantSlug: string, token: string) => void;
  readonly clearToken: (merchantSlug: string) => void;
}

export interface StorefrontCustomerClient {
  readonly customer: {
    login(
      payload: CustomerLoginRequest,
      config?: RequestConfig,
    ): Promise<CustomerLoginResponse>;
    verifyOtp(
      payload: CustomerOtpRequest,
      config?: RequestConfig,
    ): Promise<CustomerOtpResponse>;
    getProfile(config?: RequestConfig): Promise<StorefrontCustomer>;
    logout(config?: RequestConfig): Promise<{ success: true }>;
    readonly orders: {
      list(
        params?: { limit?: number; cursor?: string },
        config?: RequestConfig,
      ): Promise<CursorPage<PublicOrderSummary>>;
      get(
        orderId: string,
        config?: RequestConfig,
      ): Promise<PublicOrderDetail>;
    };
    readonly addresses: {
      list(
        params?: { limit?: number; cursor?: string },
        config?: RequestConfig,
      ): Promise<CursorPage<CustomerAddress>>;
      create(
        payload: CustomerAddressInput,
        config?: RequestConfig,
      ): Promise<CustomerAddress>;
      update(
        addressId: string,
        payload: CustomerAddressUpdate,
        config?: RequestConfig,
      ): Promise<CustomerAddress>;
      delete(
        addressId: string,
        config?: RequestConfig,
      ): Promise<{ success: true; addressId: string }>;
    };
    readonly savedPayments: {
      list(config?: RequestConfig): Promise<SavedPaymentMethod[]>;
      delete(
        paymentId: string,
        config?: RequestConfig,
      ): Promise<{ success: true }>;
    };
  };
}

export interface StorefrontCustomerTransport {
  readonly auth: {
    requestOtp(input: {
      merchantSlug: string;
      identifierString: string;
    }): Promise<StorefrontCustomerChallenge>;
    resendOtp(
      challenge: StorefrontCustomerChallenge,
    ): Promise<StorefrontCustomerChallenge>;
    verifyOtp(input: {
      challenge: StorefrontCustomerChallenge;
      otp: string;
      customerName?: string;
      lastName?: string;
    }): Promise<{
      readonly state: "authenticated";
      readonly merchantSlug: string;
    }>;
    getProfile(merchantSlug: string): Promise<StorefrontCustomer>;
    logout(merchantSlug: string): Promise<void>;
  };
  readonly orders: {
    list(
      merchantSlug: string,
      params?: { limit?: number; cursor?: string },
    ): Promise<CursorPage<PublicOrderSummary>>;
    get(
      merchantSlug: string,
      orderId: string,
    ): Promise<PublicOrderDetail>;
  };
  readonly addresses: {
    list(
      merchantSlug: string,
      params?: { limit?: number; cursor?: string },
    ): Promise<CursorPage<CustomerAddress>>;
    create(
      merchantSlug: string,
      payload: CustomerAddressInput,
      config: { idempotencyKey: string },
    ): Promise<CustomerAddress>;
    update(
      merchantSlug: string,
      addressId: string,
      payload: CustomerAddressUpdate,
      config: { revision: number; idempotencyKey: string },
    ): Promise<CustomerAddress>;
    delete(
      merchantSlug: string,
      addressId: string,
      config: { idempotencyKey: string },
    ): Promise<{ success: true; addressId: string }>;
  };
  readonly savedPayments: {
    list(merchantSlug: string): Promise<SavedPaymentMethod[]>;
    delete(
      merchantSlug: string,
      paymentId: string,
    ): Promise<{ success: true }>;
  };
}

export class StorefrontCustomerTransportError extends Error {
  readonly state: StorefrontErrorState["state"];
  readonly code: string;
  readonly requestId?: string;
  readonly details?: StorefrontErrorState["details"];
  readonly retryAfterMs?: number;
  readonly method?: string;
  readonly routeTemplate?: string;

  constructor(error: StorefrontErrorState) {
    super(error.message);
    this.name = "StorefrontCustomerTransportError";
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

const browserCustomerSessionAdapters = {
  setMerchantScope: setActiveStorefrontMerchant,
  setToken: setCustomerToken,
  clearToken: clearCustomerToken,
} satisfies StorefrontCustomerSessionAdapters;

function validationError(code: string, message: string) {
  return new StorefrontCustomerTransportError({
    state: "validation",
    code,
    message,
  });
}

function integrationError(code: string, message: string) {
  return new StorefrontCustomerTransportError({
    state: "integration-error",
    code,
    message,
  });
}

function requireMerchantSlug(merchantSlug: string): void {
  if (!merchantSlugPattern.test(merchantSlug)) {
    throw validationError(
      "INVALID_MERCHANT_SCOPE",
      "The customer merchant scope is invalid.",
    );
  }
}

function requireIdentifier(identifierString: string): void {
  if (!identifierString || identifierString.trim() !== identifierString) {
    throw validationError(
      "INVALID_IDENTIFIER",
      "Enter a valid email address or phone number.",
    );
  }
}

function requireChallenge(challenge: StorefrontCustomerChallenge): void {
  requireMerchantSlug(challenge.merchantSlug);
  requireIdentifier(challenge.identifierString);
  if (
    !challenge.methodId ||
    challenge.methodId.trim() !== challenge.methodId ||
    (challenge.delivery !== "email" && challenge.delivery !== "sms")
  ) {
    throw validationError(
      "INVALID_CHALLENGE",
      "The verification challenge is invalid or expired.",
    );
  }
}

function requireOtp(otp: string): void {
  if (!/^\d{6}$/.test(otp)) {
    throw validationError(
      "INVALID_OTP",
      "Enter the six-digit verification code.",
    );
  }
}

function requireOptionalName(value: string | undefined): void {
  if (value !== undefined && (!value || value.trim() !== value)) {
    throw validationError(
      "INVALID_CUSTOMER_NAME",
      "The customer name is invalid.",
    );
  }
}

function requireIdentifierValue(value: string, code: string): void {
  if (!value || value.trim() !== value) {
    throw validationError(code, "The requested customer resource is invalid.");
  }
}

function requireIdempotencyKey(value: string): void {
  if (!isStorefrontIdempotencyKey(value)) {
    throw validationError(
      "INVALID_IDEMPOTENCY_KEY",
      "The customer change could not be started safely.",
    );
  }
}

function requireRevision(value: number): void {
  if (!isStorefrontRevision(value)) {
    throw validationError(
      "INVALID_REVISION",
      "The saved address changed. Refresh and try again.",
    );
  }
}

export function toStorefrontCustomerTransportError(
  error: unknown,
): StorefrontCustomerTransportError {
  return error instanceof StorefrontCustomerTransportError
    ? error
    : new StorefrontCustomerTransportError(toStorefrontErrorState(error));
}

function challengeFrom(
  input: CustomerLoginRequest,
  response: CustomerLoginResponse,
): StorefrontCustomerChallenge {
  return {
    merchantSlug: input.merchantSlug,
    identifierString: input.identifierString,
    methodId: response.methodId,
    delivery: response.delivery,
  };
}

export function createStorefrontCustomerTransport(
  client: StorefrontCustomerClient,
  sessions: StorefrontCustomerSessionAdapters =
    browserCustomerSessionAdapters,
): StorefrontCustomerTransport {
  async function anonymous<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw toStorefrontCustomerTransportError(error);
    }
  }

  async function authorized<T>(
    merchantSlug: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    requireMerchantSlug(merchantSlug);

    return await runInStorefrontCustomerScope(
      sessions,
      merchantSlug,
      async () => {
        try {
          return await operation();
        } catch (error) {
          const safeError = toStorefrontCustomerTransportError(error);
          if (safeError.state === "authentication-required") {
            sessions.clearToken(merchantSlug);
          }
          throw safeError;
        }
      },
    );
  }

  async function requestOtp(input: CustomerLoginRequest) {
    requireMerchantSlug(input.merchantSlug);
    requireIdentifier(input.identifierString);
    const response = await anonymous(() => client.customer.login(input));
    const challenge = challengeFrom(input, response);
    requireChallenge(challenge);
    return challenge;
  }

  return {
    auth: {
      requestOtp,
      resendOtp(challenge) {
        requireChallenge(challenge);
        return requestOtp({
          merchantSlug: challenge.merchantSlug,
          identifierString: challenge.identifierString,
        });
      },
      async verifyOtp(input) {
        requireChallenge(input.challenge);
        requireOtp(input.otp);
        requireOptionalName(input.customerName);
        requireOptionalName(input.lastName);

        try {
          await runInStorefrontCustomerScope(
            sessions,
            input.challenge.merchantSlug,
            async () => {
              const response = await anonymous(() =>
                client.customer.verifyOtp({
                  merchantSlug: input.challenge.merchantSlug,
                  identifierString: input.challenge.identifierString,
                  methodId: input.challenge.methodId,
                  otp: input.otp,
                  ...(input.customerName
                    ? { customerName: input.customerName }
                    : {}),
                  ...(input.lastName ? { lastName: input.lastName } : {}),
                }),
              );
              if (
                !response.token ||
                response.token.trim() !== response.token
              ) {
                throw integrationError(
                  "INVALID_CUSTOMER_SESSION",
                  "The customer session response was invalid.",
                );
              }
              sessions.setToken(
                input.challenge.merchantSlug,
                response.token,
              );
            },
          );
        } catch (error) {
          if (error instanceof StorefrontCustomerTransportError) {
            throw error;
          }
          throw integrationError(
            "CUSTOMER_SESSION_PERSISTENCE_FAILED",
            "The customer session could not be stored safely.",
          );
        }

        return {
          state: "authenticated",
          merchantSlug: input.challenge.merchantSlug,
        } as const;
      },
      getProfile: (merchantSlug) =>
        authorized(merchantSlug, () => client.customer.getProfile()),
      async logout(merchantSlug) {
        requireMerchantSlug(merchantSlug);
        return await runInStorefrontCustomerScope(
          sessions,
          merchantSlug,
          async () => {
            try {
              await client.customer.logout();
            } catch (error) {
              throw toStorefrontCustomerTransportError(error);
            } finally {
              sessions.clearToken(merchantSlug);
            }
          },
        );
      },
    },
    orders: {
      list: (merchantSlug, params) =>
        authorized(merchantSlug, () => client.customer.orders.list(params)),
      async get(merchantSlug, orderId) {
        requireIdentifierValue(orderId, "INVALID_ORDER_ID");
        return await authorized(merchantSlug, () =>
          client.customer.orders.get(orderId),
        );
      },
    },
    addresses: {
      list: (merchantSlug, params) =>
        authorized(merchantSlug, () =>
          client.customer.addresses.list(params),
        ),
      async create(merchantSlug, payload, config) {
        requireIdempotencyKey(config.idempotencyKey);
        return await authorized(merchantSlug, () =>
          client.customer.addresses.create(payload, config),
        );
      },
      async update(merchantSlug, addressId, payload, config) {
        requireIdentifierValue(addressId, "INVALID_ADDRESS_ID");
        requireRevision(config.revision);
        requireIdempotencyKey(config.idempotencyKey);
        return await authorized(merchantSlug, () =>
          client.customer.addresses.update(addressId, payload, config),
        );
      },
      async delete(merchantSlug, addressId, config) {
        requireIdentifierValue(addressId, "INVALID_ADDRESS_ID");
        requireIdempotencyKey(config.idempotencyKey);
        return await authorized(merchantSlug, () =>
          client.customer.addresses.delete(addressId, config),
        );
      },
    },
    savedPayments: {
      list: (merchantSlug) =>
        authorized(merchantSlug, () =>
          client.customer.savedPayments.list(),
        ),
      async delete(merchantSlug, paymentId) {
        requireIdentifierValue(paymentId, "INVALID_PAYMENT_ID");
        return await authorized(merchantSlug, () =>
          client.customer.savedPayments.delete(paymentId),
        );
      },
    },
  };
}
