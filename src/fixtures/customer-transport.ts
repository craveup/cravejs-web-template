import type {
  CustomerAddress,
  CustomerAddressInput,
  CustomerAddressUpdate,
} from "@craveup/storefront-sdk";

import type { StorefrontCustomerTransport } from "@/lib/storefront/customer";
import { StorefrontCustomerTransportError } from "@/lib/storefront/customer";

import {
  fixtureCustomer,
  fixtureSavedAddresses,
  fixtureSavedPayments,
} from "./customer";
import { fixtureOrderDetails, fixtureOrderHistory } from "./orders";

const fixtureMerchantSlug = "fixture-base";
const fixtureOtp = "123456";
const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{16,128}$/;

export interface FixtureCustomerTransportOptions {
  initiallyAuthenticated?: boolean;
}

function fixtureError(
  state: ConstructorParameters<typeof StorefrontCustomerTransportError>[0]["state"],
  code: string,
  message: string,
) {
  return new StorefrontCustomerTransportError({ state, code, message });
}

function unsupportedMutation(): never {
  throw fixtureError(
    "dependency-unavailable",
    "FIXTURE_MUTATION_UNAVAILABLE",
    "This customer fixture mutation is not available.",
  );
}

export function createFixtureCustomerTransport(
  options: FixtureCustomerTransportOptions = {},
): StorefrontCustomerTransport {
  let authenticated = options.initiallyAuthenticated ?? false;
  let challengeSequence = 0;
  let activeMethodId: string | null = null;
  let addressSequence = fixtureSavedAddresses.items.length;
  let addresses = fixtureSavedAddresses.items.map((address) => ({ ...address }));
  const completedAddressMutations = new Map<
    string,
    { signature: string; result: CustomerAddress | { success: true; addressId: string } }
  >();

  function requireMerchant(merchantSlug: string) {
    if (merchantSlug !== fixtureMerchantSlug) {
      throw fixtureError(
        "unavailable",
        "NOT_FOUND",
        "The customer fixture is unavailable.",
      );
    }
  }

  function requireAuthenticated(merchantSlug: string) {
    requireMerchant(merchantSlug);
    if (!authenticated) {
      throw fixtureError(
        "authentication-required",
        "CUSTOMER_AUTH_REQUIRED",
        "Please sign in to continue.",
      );
    }
  }

  function requireIdempotencyKey(value: string) {
    if (!idempotencyKeyPattern.test(value)) {
      throw fixtureError(
        "integration-error",
        "INVALID_IDEMPOTENCY_KEY",
        "The saved address action could not be started safely.",
      );
    }
  }

  function findAddress(addressId: string) {
    const address = addresses.find((candidate) => candidate.addressId === addressId);
    if (!address) {
      throw fixtureError(
        "unavailable",
        "NOT_FOUND",
        "The saved address is unavailable.",
      );
    }
    return address;
  }

  function mutationResult<T extends CustomerAddress | { success: true; addressId: string }>(
    key: string,
    signature: string,
    operation: () => T,
  ): T {
    requireIdempotencyKey(key);
    const completed = completedAddressMutations.get(key);
    if (completed) {
      if (completed.signature !== signature) {
        throw fixtureError(
          "integration-error",
          "IDEMPOTENCY_KEY_REUSED",
          "The saved address action could not be retried safely.",
        );
      }
      return completed.result as T;
    }
    const result = operation();
    completedAddressMutations.set(key, { signature, result });
    return result;
  }

  function createdAddress(payload: CustomerAddressInput): CustomerAddress {
    addressSequence += 1;
    return {
      ...payload,
      line2: payload.line2 ?? "",
      line3: payload.line3 ?? "",
      addressId: `fixture-address-${addressSequence}`,
      revision: 0,
      createdAt:
        fixtureSavedAddresses.items[0]?.createdAt ?? "2026-08-09T12:00:00.000Z",
    };
  }

  function updatedAddress(
    current: CustomerAddress,
    payload: CustomerAddressUpdate,
  ): CustomerAddress {
    return {
      ...current,
      ...payload,
      line2: payload.line2 ?? current.line2,
      line3: payload.line3 ?? current.line3,
      revision: current.revision + 1,
    };
  }

  async function requestOtp(input: {
    merchantSlug: string;
    identifierString: string;
  }) {
    requireMerchant(input.merchantSlug);
    const identifierString = input.identifierString.trim();
    if (identifierString.length < 3) {
      throw fixtureError(
        "validation",
        "VALIDATION_ERROR",
        "Enter a valid email address or phone number.",
      );
    }
    activeMethodId = `fixture-method-${++challengeSequence}`;
    return {
      merchantSlug: fixtureMerchantSlug,
      identifierString,
      methodId: activeMethodId,
      delivery: identifierString.includes("@")
        ? ("email" as const)
        : ("sms" as const),
    };
  }

  return {
    auth: {
      requestOtp,
      resendOtp(challenge) {
        requireMerchant(challenge.merchantSlug);
        return requestOtp({
          merchantSlug: challenge.merchantSlug,
          identifierString: challenge.identifierString,
        });
      },
      async verifyOtp({ challenge, otp }) {
        requireMerchant(challenge.merchantSlug);
        if (challenge.methodId !== activeMethodId || otp !== fixtureOtp) {
          throw fixtureError(
            "validation",
            "VALIDATION_ERROR",
            "Enter the current six-digit fixture code.",
          );
        }
        authenticated = true;
        activeMethodId = null;
        return {
          state: "authenticated",
          merchantSlug: fixtureMerchantSlug,
        };
      },
      async getProfile(merchantSlug) {
        requireAuthenticated(merchantSlug);
        return fixtureCustomer;
      },
      async logout(merchantSlug) {
        requireMerchant(merchantSlug);
        authenticated = false;
        activeMethodId = null;
      },
    },
    orders: {
      async list(merchantSlug, params) {
        requireAuthenticated(merchantSlug);
        const cursorMatch = params?.cursor?.match(
          /^fixture-orders-offset-(\d+)$/,
        );
        if (params?.cursor && !cursorMatch) {
          throw fixtureError(
            "validation",
            "VALIDATION_ERROR",
            "The order history cursor is invalid.",
          );
        }
        const offset = cursorMatch ? Number(cursorMatch[1]) : 0;
        const limit = Math.max(1, Math.min(params?.limit ?? 20, 50));
        const nextOffset = offset + limit;
        return {
          items: fixtureOrderHistory.items.slice(offset, nextOffset),
          nextCursor:
            nextOffset < fixtureOrderHistory.items.length
              ? `fixture-orders-offset-${nextOffset}`
              : null,
        };
      },
      async get(merchantSlug, orderId) {
        requireAuthenticated(merchantSlug);
        const order = fixtureOrderDetails[orderId];
        if (!order) {
          throw fixtureError(
            "unavailable",
            "NOT_FOUND",
            "The order fixture is unavailable.",
          );
        }
        return order;
      },
    },
    addresses: {
      async list(merchantSlug, params) {
        requireAuthenticated(merchantSlug);
        const limit = Math.min(Math.max(params?.limit ?? 20, 1), 50);
        const cursorMatch = params?.cursor?.match(/^fixture-address-cursor-(\d+)$/);
        if (params?.cursor && !cursorMatch) {
          throw fixtureError(
            "validation",
            "VALIDATION_ERROR",
            "The saved address cursor is invalid.",
          );
        }
        const offset = cursorMatch ? Number(cursorMatch[1]) : 0;
        const items = addresses.slice(offset, offset + limit).map((address) => ({
          ...address,
        }));
        const nextOffset = offset + items.length;
        return {
          items,
          nextCursor:
            nextOffset < addresses.length
              ? `fixture-address-cursor-${nextOffset}`
              : null,
        };
      },
      async create(merchantSlug, payload, config) {
        requireAuthenticated(merchantSlug);
        const signature = `create:${JSON.stringify(payload)}`;
        return mutationResult(config.idempotencyKey, signature, () => {
          const address = createdAddress(payload);
          addresses = [...addresses, address];
          return { ...address };
        });
      },
      async update(merchantSlug, addressId, payload, config) {
        requireAuthenticated(merchantSlug);
        const signature = `update:${addressId}:${config.revision}:${JSON.stringify(payload)}`;
        return mutationResult(config.idempotencyKey, signature, () => {
          const current = findAddress(addressId);
          if (current.revision !== config.revision) {
            throw fixtureError(
              "resource-conflict",
              "RESOURCE_CONFLICT",
              "The saved address changed. Refresh and try again.",
            );
          }
          const address = updatedAddress(current, payload);
          addresses = addresses.map((candidate) =>
            candidate.addressId === addressId ? address : candidate,
          );
          return { ...address };
        });
      },
      async delete(merchantSlug, addressId, config) {
        requireAuthenticated(merchantSlug);
        const signature = `delete:${addressId}`;
        return mutationResult(config.idempotencyKey, signature, () => {
          findAddress(addressId);
          addresses = addresses.filter(
            (candidate) => candidate.addressId !== addressId,
          );
          return { success: true as const, addressId };
        });
      },
    },
    savedPayments: {
      async list(merchantSlug) {
        requireAuthenticated(merchantSlug);
        return fixtureSavedPayments;
      },
      async delete(merchantSlug) {
        requireAuthenticated(merchantSlug);
        return unsupportedMutation();
      },
    },
  };
}

let fixtureCustomerTransport: StorefrontCustomerTransport | null = null;

export function getFixtureCustomerTransport(): StorefrontCustomerTransport {
  fixtureCustomerTransport ??= createFixtureCustomerTransport();
  return fixtureCustomerTransport;
}
