export interface NewsletterSignupMessages {
  readonly invalid: string;
  readonly pending: string;
  readonly unavailable: string;
  rateLimited(retryAfterMs?: number): string;
}

export function getNewsletterSignupMessages(
  locale: string,
): NewsletterSignupMessages {
  const numberFormatter = new Intl.NumberFormat(locale);
  return {
    invalid: "Enter a valid email address.",
    pending: "Subscription request in progress.",
    unavailable: "Subscriptions are temporarily unavailable. Try again later.",
    rateLimited(retryAfterMs) {
      if (retryAfterMs === undefined) {
        return "Please wait before trying again.";
      }
      const seconds = Math.ceil(retryAfterMs / 1_000);
      const unit = seconds === 1 ? "second" : "seconds";
      return `Please wait ${numberFormatter.format(seconds)} ${unit} before trying again.`;
    },
  };
}
