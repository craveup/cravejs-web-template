export interface CheckoutIdentityMessages {
  readonly backLabel: string;
  readonly phoneHeading: string;
  readonly tablePhoneHeading: string;
  readonly phoneDescription: string;
  readonly tablePhoneDescription: string;
  readonly phoneLabel: string;
  readonly phonePlaceholder: string;
  readonly countryCodeLabel: string;
  readonly sendCodeLabel: string;
  readonly sendingCodeLabel: string;
  readonly codeMobileHeading: (identifier: string) => string;
  readonly codeDesktopHeading: string;
  readonly codeDescription: (identifier: string) => string;
  readonly otpGroupLabel: string;
  readonly otpDigitLabel: (position: number) => string;
  readonly continueLabel: string;
  readonly verifyingLabel: string;
  readonly resendLabel: string;
  readonly resendIn: (seconds: number) => string;
  readonly resendingLabel: string;
  readonly requestNewCodeLabel: string;
  readonly nameMobileHeading: string;
  readonly nameDesktopHeading: string;
  readonly nameMobileDescription: string;
  readonly nameDesktopDescription: string;
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  readonly phoneRequired: string;
  readonly otpRequired: string;
  readonly nameRequired: string;
  readonly requestFailed: string;
  readonly verificationFailed: string;
  readonly expiredChallenge: string;
  readonly rateLimited: string;
  readonly retryIn: (seconds: number) => string;
  readonly sessionExpired: string;
  readonly genericError: string;
  readonly loadingLabel: string;
  readonly tableLabel: (identifier: string) => string;
}

const enUs: CheckoutIdentityMessages = {
  backLabel: "Back to cart",
  phoneHeading: "Verify your number",
  tablePhoneHeading: "Your number",
  phoneDescription: "To verify, we'll send you a 6 digit number via SMS. You'll only have to do this once.",
  tablePhoneDescription: "So we can send the receipt and find you at the table.",
  phoneLabel: "Mobile number",
  phonePlaceholder: "555 000 0000",
  countryCodeLabel: "Country code",
  sendCodeLabel: "Send the code",
  sendingCodeLabel: "Sending the code…",
  codeMobileHeading: (identifier) => `Verifying ${identifier}`,
  codeDesktopHeading: "Enter the code",
  codeDescription: (identifier) => `Sent to ${identifier}.`,
  otpGroupLabel: "Verification code",
  otpDigitLabel: (position) => `Verification code digit ${position} of 6`,
  continueLabel: "Continue",
  verifyingLabel: "Verifying…",
  resendLabel: "Resend the code",
  resendIn: (seconds) => `Resend the code in ${seconds} ${seconds === 1 ? "second" : "seconds"}`,
  resendingLabel: "Sending a new code…",
  requestNewCodeLabel: "Request a new code",
  nameMobileHeading: "Enter your name",
  nameDesktopHeading: "What name is the order under?",
  nameMobileDescription: "We'll put this on the order so our team knows who it is for.",
  nameDesktopDescription: "We call it out at the counter.",
  nameLabel: "Your name",
  namePlaceholder: "Your name",
  phoneRequired: "Enter a valid mobile number.",
  otpRequired: "Enter the six-digit verification code.",
  nameRequired: "Enter the name for this order.",
  requestFailed: "We couldn't send a code. Check your number and try again.",
  verificationFailed: "We couldn't verify that code. Check it and try again.",
  expiredChallenge: "This verification code has expired. Request a new code.",
  rateLimited: "Too many attempts. Try again shortly.",
  retryIn: (seconds) => `Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}`,
  sessionExpired: "Your session expired. Verify your number again to continue.",
  genericError: "Something went wrong. Please try again.",
  loadingLabel: "Checking your customer session…",
  tableLabel: (identifier) => `Table ${identifier}`,
};

const byLocale: Readonly<Record<string, CheckoutIdentityMessages>> = {
  "en-US": enUs,
};

export function getCheckoutIdentityMessages(locale: string) {
  return byLocale[locale] ?? enUs;
}
