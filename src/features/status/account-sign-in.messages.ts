export interface AccountSignInMessages {
  readonly mobileHeading: string;
  readonly desktopHeading: string;
  readonly mobileDescription: string;
  readonly desktopDescription: string;
  readonly identifierLabel: string;
  readonly identifierPlaceholder: string;
  readonly continueLabel: string;
  readonly sendingCodeLabel: string;
  readonly termsNotice: string;
  readonly otpLabel: string;
  readonly otpPlaceholder: string;
  readonly codeSent: (delivery: "email" | "sms", identifier: string) => string;
  readonly verifyLabel: string;
  readonly verifyingLabel: string;
  readonly resendLabel: string;
  readonly resendIn: (seconds: number) => string;
  readonly resendingLabel: string;
  readonly requestNewCodeLabel: string;
  readonly identifierRequired: string;
  readonly otpRequired: string;
  readonly requestFailed: string;
  readonly verificationFailed: string;
  readonly expiredChallenge: string;
  readonly rateLimited: (seconds: number) => string;
  readonly sessionExpired: string;
  readonly genericError: string;
  readonly signedInHeading: string;
  readonly signedInFallback: string;
  readonly viewOrdersLabel: string;
  readonly returnToSavedAddressesLabel: string;
  readonly signOutLabel: string;
  readonly signingOutLabel: string;
}

const enUsAccountSignInMessages: AccountSignInMessages = {
  mobileHeading: "Sign in or create an account",
  desktopHeading: "Sign in",
  mobileDescription: "So we can save your order and your favourites.",
  desktopDescription:
    "Save your details and see past orders. You can order without an account.",
  identifierLabel: "Email address or mobile number",
  identifierPlaceholder: "name@example.com or +1 555 000 0000",
  continueLabel: "Continue",
  sendingCodeLabel: "Sending code…",
  termsNotice: "By continuing you agree to our Terms and Privacy Policy.",
  otpLabel: "Verification code",
  otpPlaceholder: "Six-digit code",
  codeSent: (delivery, identifier) =>
    `We sent a six-digit code by ${delivery} to ${identifier}.`,
  verifyLabel: "Verify code",
  verifyingLabel: "Verifying…",
  resendLabel: "Resend code",
  resendIn: (seconds) =>
    `Resend code in ${seconds} ${seconds === 1 ? "second" : "seconds"}`,
  resendingLabel: "Sending a new code…",
  requestNewCodeLabel: "Request a new code",
  identifierRequired: "Enter an email address or mobile number.",
  otpRequired: "Enter the six-digit verification code.",
  requestFailed: "We couldn't send a code. Check your details and try again.",
  verificationFailed: "We couldn't verify that code. Check it and try again.",
  expiredChallenge: "This verification code has expired. Request a new code.",
  rateLimited: (seconds) =>
    `Too many attempts. Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`,
  sessionExpired: "Your session expired. Sign in again to continue.",
  genericError: "Something went wrong. Please try again.",
  signedInHeading: "You're signed in",
  signedInFallback: "Your customer session is active.",
  viewOrdersLabel: "View your orders",
  returnToSavedAddressesLabel: "Return to saved addresses",
  signOutLabel: "Sign out",
  signingOutLabel: "Signing out…",
};

const accountSignInMessagesByLocale: Readonly<
  Record<string, AccountSignInMessages>
> = {
  "en-US": enUsAccountSignInMessages,
};

export function getAccountSignInMessages(
  locale: string,
): AccountSignInMessages {
  return accountSignInMessagesByLocale[locale] ?? enUsAccountSignInMessages;
}
