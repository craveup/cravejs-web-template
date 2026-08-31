import {
  StorefrontApiError,
  StorefrontTimeoutError,
} from "@craveup/storefront-sdk";

export type FulfillmentMutationKind = "table" | "room";

export function describeFulfillmentMutationError(
  error: unknown,
  kind: FulfillmentMutationKind,
) {
  const detailLabel = `${kind} details`;
  const capitalizedDetailLabel = `${kind === "table" ? "Table" : "Room"} details`;

  if (error instanceof StorefrontTimeoutError) {
    return `The ${detailLabel} update may have completed. Refresh the cart before retrying.`;
  }

  const code =
    error instanceof StorefrontApiError ||
    (typeof error === "object" && error !== null && "code" in error)
      ? String(error.code)
      : "";
  if (code) {
    switch (code) {
      case "VALIDATION_ERROR":
        return `Review the ${detailLabel} and try again.`;
      case "RATE_LIMITED":
        return "Too many attempts. Wait before trying again.";
      case "CART_CONFLICT":
        return "The cart changed elsewhere. Refresh it, review the current details, then retry.";
      case "CART_IMMUTABLE":
        return `This cart can no longer change ${detailLabel}.`;
      case "NOT_FOUND":
        return "This cart is unavailable or expired. Start a new order.";
      case "IDEMPOTENCY_IN_PROGRESS":
        return "This cart update is still processing. Refresh the cart before trying again.";
      case "DEPENDENCY_UNAVAILABLE":
        return `${capitalizedDetailLabel} are temporarily unavailable. Try again later.`;
    }
  }

  return `${capitalizedDetailLabel} could not be saved. Review them and try again.`;
}
