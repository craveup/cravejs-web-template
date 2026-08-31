import type {
  HostedCheckoutMessageKey,
  HostedCheckoutSnapshot,
} from "./hosted-checkout";

const issueMessages: Record<HostedCheckoutMessageKey, string> = {
  "checkout.handoff.invalidAttempt":
    "Secure checkout could not start safely. Refresh and try again.",
  "checkout.handoff.invalidContext":
    "Your order context changed. Review your cart before trying again.",
  "checkout.handoff.notReady":
    "Complete the checkout details before continuing.",
  "checkout.handoff.contextChanged":
    "Your order changed. Review the latest cart before trying again.",
  "checkout.handoff.invalidResponse":
    "Secure checkout returned an invalid response. Try again later.",
  "checkout.handoff.invalidUrl":
    "Secure checkout returned an invalid destination. Try again later.",
  "checkout.handoff.unapprovedOrigin":
    "Secure checkout returned an unapproved destination. Try again later.",
  "checkout.handoff.invalidExpiry":
    "Secure checkout returned an invalid expiry. Try again later.",
  "checkout.handoff.expired":
    "The secure checkout link expired. Start checkout again.",
  "checkout.handoff.prepareFailed":
    "Secure checkout is temporarily unavailable. Try again.",
  "checkout.handoff.outcomeUnknown":
    "We could not confirm whether secure checkout was prepared. Retry this same attempt.",
  "checkout.handoff.navigationFailed":
    "Secure checkout could not open. Try again.",
};

export interface SecureCheckoutActionMessages {
  readonly note: string;
  readonly preparing: string;
  readonly opening: string;
  readonly handedOff: string;
  issue(snapshot: Extract<
    HostedCheckoutSnapshot,
    { state: "failed" | "outcome-unknown" }
  >): string;
}

const englishMessages: SecureCheckoutActionMessages = {
  note: "Payment is completed on Crave's secure hosted checkout.",
  preparing: "Preparing secure checkout\u2026",
  opening: "Opening secure checkout\u2026",
  handedOff:
    "Secure checkout opened. Your order is not complete until hosted checkout confirms it.",
  issue: (snapshot) => issueMessages[snapshot.issue.messageKey],
};

export function getSecureCheckoutActionMessages(
  _locale: string,
): SecureCheckoutActionMessages {
  void _locale;
  return englishMessages;
}
