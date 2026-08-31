import { Button } from "@/components/ui/button";

export type ProductCartFeedbackView =
  | Readonly<{ status: "unavailable" }>
  | Readonly<{ status: "retry-required"; message: string }>
  | Readonly<{
      status: "retryable";
      message: string;
      retryAfterSeconds?: number;
    }>
  | Readonly<{ status: "error"; message: string }>;

export function ProductCartFeedback({
  state,
  onRetryConflict,
  onRetry,
}: {
  readonly state: ProductCartFeedbackView;
  readonly onRetryConflict?: () => void;
  readonly onRetry?: () => void;
}) {
  if (state.status === "unavailable") {
    return (
      <div className="item-cart-error" role="status">
        <p>
          Ordering is unavailable until this storefront&apos;s ordering
          configuration is ready.
        </p>
      </div>
    );
  }

  if (state.status === "retry-required") {
    return (
      <div className="item-cart-error" role="alert">
        <p>{state.message}</p>
        <Button disabled={!onRetryConflict} onClick={onRetryConflict}>
          Retry add to order
        </Button>
      </div>
    );
  }

  if (state.status === "retryable") {
    return (
      <div className="item-cart-error">
        <p role="alert">{state.message}</p>
        <Button
          disabled={state.retryAfterSeconds !== undefined || !onRetry}
          onClick={onRetry}
        >
          {state.retryAfterSeconds !== undefined
            ? `Retry in ${state.retryAfterSeconds}s`
            : "Retry add to order"}
        </Button>
      </div>
    );
  }

  return (
    <div className="item-cart-error" role="alert">
      <p>{state.message}</p>
    </div>
  );
}
