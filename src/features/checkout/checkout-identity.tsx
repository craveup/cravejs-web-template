"use client";

import type { StorefrontCustomer } from "@craveup/storefront-sdk";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { loadFixtureCustomerTransport } from "@/features/status/customer-transport-loader";
import { StorefrontCustomerTransportError } from "@/lib/storefront/customer";
import { useStorefrontCustomer } from "@/lib/storefront/use-customer";

import { getCheckoutIdentityMessages } from "./checkout-identity.messages";
import styles from "./checkout-identity.module.css";

const defaultResendDelaySeconds = 30;
const countryCodes = [
  { value: "+1", label: "United States (+1)", flag: "🇺🇸" },
  { value: "+44", label: "United Kingdom (+44)", flag: "🇬🇧" },
  { value: "+61", label: "Australia (+61)", flag: "🇦🇺" },
  { value: "+971", label: "United Arab Emirates (+971)", flag: "🇦🇪" },
] as const;

export type CheckoutIdentityCustomer = Pick<
  ReturnType<typeof useStorefrontCustomer>,
  "state" | "requestOtp" | "resendOtp" | "verifyOtp" | "refreshProfile"
>;

export interface CheckoutIdentityResult {
  readonly profile: StorefrontCustomer;
  readonly orderName?: string;
}

export interface CheckoutIdentityProps {
  readonly merchantSlug: string;
  readonly locale: string;
  readonly mode: "fixture" | "live";
  readonly backHref: string;
  readonly onComplete: (result: CheckoutIdentityResult) => void;
  readonly tableIdentifier?: string;
}

export interface CheckoutIdentityViewProps {
  readonly customer: CheckoutIdentityCustomer;
  readonly locale: string;
  readonly backHref: string;
  readonly onComplete: (result: CheckoutIdentityResult) => void;
  readonly resendDelaySeconds?: number;
  readonly tableIdentifier?: string;
}

function profileName(profile: StorefrontCustomer | null): string {
  if (!profile) return "";
  return [profile.customerName, profile.lastName].filter(Boolean).join(" ").trim();
}

function rateLimitSeconds(retryAfterMs: number | undefined): number {
  return retryAfterMs === undefined ? 1 : Math.max(Math.ceil(retryAfterMs / 1_000), 1);
}

function identifier(countryCode: string, phoneNumber: string): string | null {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `${countryCode}${digits}`;
}

export function CheckoutIdentity({
  merchantSlug,
  locale,
  mode,
  ...props
}: CheckoutIdentityProps) {
  const customer = useStorefrontCustomer({
    merchantSlug,
    ...(mode === "fixture" ? { getTransport: loadFixtureCustomerTransport } : {}),
  });
  return <CheckoutIdentityView customer={customer} locale={locale} {...props} />;
}

export function CheckoutIdentityView({
  customer,
  locale,
  backHref,
  onComplete,
  resendDelaySeconds = defaultResendDelaySeconds,
  tableIdentifier,
}: CheckoutIdentityViewProps) {
  const messages = getCheckoutIdentityMessages(locale);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [countryCode, setCountryCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpDigits, setOtpDigits] = useState(() => Array.from({ length: 6 }, () => ""));
  const [orderName, setOrderName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [resendRemaining, setResendRemaining] = useState(0);
  const [rateLimitRemaining, setRateLimitRemaining] = useState(0);
  const completedProfileRef = useRef<StorefrontCustomer | null>(null);
  const bootstrappedRef = useRef(false);
  const mountedRef = useRef(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const nameRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const challenge = customer.state.challenge;
  const refreshProfile = customer.refreshProfile;
  const requesting = customer.state.status === "requesting-code";
  const verifying = customer.state.status === "verifying";
  const authenticated = customer.state.status === "authenticated";
  const nameMissing = authenticated && customer.state.profile !== null && !profileName(customer.state.profile);
  const expired = customer.state.error?.state === "unavailable" && Boolean(challenge);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    void refreshProfile().catch(() => undefined).finally(() => {
      if (mountedRef.current) setBootstrapping(false);
    });
  }, [refreshProfile]);

  useEffect(() => {
    const profile = customer.state.profile;
    if (!authenticated || !profile || !profileName(profile) || completedProfileRef.current === profile) return;
    completedProfileRef.current = profile;
    onComplete({ profile });
  }, [authenticated, customer.state.profile, onComplete]);

  useEffect(() => {
    if (resendRemaining <= 0) return;
    const timeout = window.setTimeout(() => setResendRemaining((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearTimeout(timeout);
  }, [resendRemaining]);

  useEffect(() => {
    if (rateLimitRemaining <= 0) return;
    const timeout = window.setTimeout(() => setRateLimitRemaining((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearTimeout(timeout);
  }, [rateLimitRemaining]);

  useEffect(() => {
    if (localError || customer.state.error) errorRef.current?.focus();
  }, [customer.state.error, localError]);

  function applyRetryAfter(error: unknown) {
    if (error instanceof StorefrontCustomerTransportError && error.state === "rate-limited") {
      setRateLimitRemaining(rateLimitSeconds(error.retryAfterMs));
    }
  }

  function remoteError(): string | null {
    const error = customer.state.error;
    if (!error || (error.state === "authentication-required" && !challenge)) return null;
    if (error.state === "rate-limited") {
      return rateLimitRemaining > 0 ? messages.rateLimited : null;
    }
    if (error.state === "unavailable" && challenge) return messages.expiredChallenge;
    if (error.state === "authentication-required") return messages.sessionExpired;
    if (error.state === "validation") return challenge ? messages.verificationFailed : messages.requestFailed;
    return messages.genericError;
  }

  async function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = identifier(countryCode, phoneNumber);
    if (!normalized) {
      setLocalError(messages.phoneRequired);
      phoneRef.current?.focus();
      return;
    }
    setLocalError(null);
    try {
      await customer.requestOtp(normalized);
      setOtpDigits(Array.from({ length: 6 }, () => ""));
      setResendRemaining(Math.max(0, resendDelaySeconds));
      setRateLimitRemaining(0);
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
    } catch (error) {
      applyRetryAfter(error);
    }
  }

  async function submitOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const otp = otpDigits.join("");
    if (!/^\d{6}$/.test(otp)) {
      setLocalError(messages.otpRequired);
      otpRefs.current[otpDigits.findIndex((digit) => !digit)]?.focus();
      return;
    }
    setLocalError(null);
    try {
      await customer.verifyOtp({ otp });
      setRateLimitRemaining(0);
    } catch (error) {
      applyRetryAfter(error);
    }
  }

  async function resendCode() {
    setLocalError(null);
    try {
      await customer.resendOtp();
      setOtpDigits(Array.from({ length: 6 }, () => ""));
      setResendRemaining(Math.max(0, resendDelaySeconds));
      setRateLimitRemaining(0);
      otpRefs.current[0]?.focus();
    } catch (error) {
      applyRetryAfter(error);
    }
  }

  function updateOtp(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtpDigits((current) => current.map((item, position) => position === index ? digit : item));
    setLocalError(null);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function pasteOtp(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setOtpDigits(Array.from({ length: 6 }, (_, index) => pasted[index] ?? ""));
    otpRefs.current[Math.min(pasted.length, 6) - 1]?.focus();
  }

  function handleOtpKey(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = orderName.trim();
    if (!normalized || normalized.length > 100 || !customer.state.profile) {
      setLocalError(messages.nameRequired);
      nameRef.current?.focus();
      return;
    }
    setLocalError(null);
    onComplete({ profile: customer.state.profile, orderName: normalized });
  }

  const visibleError = localError ?? remoteError();
  const status = requesting
    ? challenge ? messages.resendingLabel : messages.sendingCodeLabel
    : verifying ? messages.verifyingLabel : "";
  const retryLabel =
    rateLimitRemaining > 0 ? messages.retryIn(rateLimitRemaining) : undefined;

  if (bootstrapping || (authenticated && !customer.state.profile)) {
    return <p className={styles.loading} role="status">{messages.loadingLabel}</p>;
  }

  const step = nameMissing ? "name" : challenge ? "code" : "phone";
  return (
    <section className={styles.surface} data-step={step} aria-busy={requesting || verifying}>
      <div className={styles.content}>
        <Link className={styles.back} href={backHref} aria-label={messages.backLabel}>
          <ArrowLeft aria-hidden="true" />
        </Link>

        {tableIdentifier && step === "phone" ? (
          <p className={styles.tableContext}>{messages.tableLabel(tableIdentifier)}</p>
        ) : null}

        {step === "phone" ? (
          <>
            <h1 className={styles.heading} aria-label={tableIdentifier ? messages.tablePhoneHeading : messages.phoneHeading}>
              <span className={styles.mobileCopy} aria-hidden="true">{messages.phoneHeading}</span>
              <span className={styles.desktopCopy} aria-hidden="true">{tableIdentifier ? messages.tablePhoneHeading : messages.phoneHeading}</span>
            </h1>
            <p className={styles.description}>
              <span className={styles.mobileCopy}>{messages.phoneDescription}</span>
              <span className={styles.desktopCopy}>{tableIdentifier ? messages.tablePhoneDescription : messages.phoneDescription}</span>
            </p>
          </>
        ) : challenge ? (
          <>
            <h1 className={styles.heading} aria-label={messages.codeDesktopHeading}>
              <span className={styles.mobileCopy} aria-hidden="true">{messages.codeMobileHeading(challenge.identifierString)}</span>
              <span className={styles.desktopCopy} aria-hidden="true">{messages.codeDesktopHeading}</span>
            </h1>
            <p className={styles.description}>
              <span className={styles.mobileCopy}>Enter the 6 digit number that was sent to you via SMS.</span>
              <span className={styles.desktopCopy}>{messages.codeDescription(challenge.identifierString)}</span>
            </p>
          </>
        ) : (
          <>
            <h1 className={styles.heading} aria-label={messages.nameMobileHeading}>
              <span className={styles.mobileCopy} aria-hidden="true">{messages.nameMobileHeading}</span>
              <span className={styles.desktopCopy} aria-hidden="true">{messages.nameDesktopHeading}</span>
            </h1>
            <p className={styles.description}>
              <span className={styles.mobileCopy}>{messages.nameMobileDescription}</span>
              <span className={styles.desktopCopy}>{messages.nameDesktopDescription}</span>
            </p>
          </>
        )}

        {visibleError ? <p className={styles.error} ref={errorRef} role="alert" tabIndex={-1}>{visibleError}</p> : null}

        {step === "phone" ? (
          <form className={styles.form} onSubmit={submitPhone} noValidate>
            <label className={styles.desktopLabel} htmlFor="checkout-mobile-number">{messages.phoneLabel}</label>
            <div className={styles.phoneField}>
              <label className={styles.countryControl}>
                <span className="sr-only">{messages.countryCodeLabel}</span>
                <span aria-hidden="true">{countryCodes.find((country) => country.value === countryCode)?.flag}</span>
                <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} aria-label={messages.countryCodeLabel}>
                  {countryCodes.map((country) => <option value={country.value} key={country.value}>{country.label}</option>)}
                </select>
              </label>
              <label className={styles.phoneInput} data-testid="checkout-phone-field">
                <span className="sr-only">{messages.phoneLabel}</span>
                <span className={styles.dialCode} aria-hidden="true">{countryCode}</span>
                <input
                  id="checkout-mobile-number"
                  ref={phoneRef}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={phoneNumber}
                  placeholder={messages.phonePlaceholder}
                  aria-label={messages.phoneLabel}
                  aria-invalid={localError === messages.phoneRequired}
                  onChange={(event) => { setPhoneNumber(event.target.value); setLocalError(null); }}
                />
              </label>
            </div>
            <div className={styles.action}>
              <Button
                type="submit"
                disabled={requesting || rateLimitRemaining > 0}
                aria-label={
                  requesting
                    ? messages.sendingCodeLabel
                    : retryLabel ?? messages.sendCodeLabel
                }
              >
                {requesting ? messages.sendingCodeLabel : retryLabel ?? (
                  <>
                    <span className={styles.mobileCopy} aria-hidden="true">{messages.continueLabel}</span>
                    <span className={styles.desktopCopy} aria-hidden="true">{messages.sendCodeLabel}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : challenge ? (
          <form className={styles.form} onSubmit={submitOtp} noValidate>
            <fieldset className={styles.otpGroup}>
              <legend className="sr-only">{messages.otpGroupLabel}</legend>
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => { otpRefs.current[index] = node; }}
                  value={digit}
                  aria-label={messages.otpDigitLabel(index + 1)}
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  onChange={(event) => updateOtp(index, event.target.value)}
                  onPaste={pasteOtp}
                  onKeyDown={(event) => handleOtpKey(index, event)}
                />
              ))}
            </fieldset>
            <button
              className={styles.resend}
              type="button"
              disabled={requesting || resendRemaining > 0 || rateLimitRemaining > 0}
              onClick={() => void resendCode()}
            >
              {expired ? messages.requestNewCodeLabel : requesting ? messages.resendingLabel : Math.max(resendRemaining, rateLimitRemaining) > 0 ? messages.resendIn(Math.max(resendRemaining, rateLimitRemaining)) : messages.resendLabel}
            </button>
            <div className={styles.action}><Button type="submit" disabled={verifying || expired || rateLimitRemaining > 0}>{verifying ? messages.verifyingLabel : retryLabel ?? messages.continueLabel}</Button></div>
          </form>
        ) : (
          <form className={styles.form} onSubmit={submitName} noValidate>
            <label className={styles.nameField}>
              <span className={styles.desktopLabel}>{messages.nameLabel}</span>
              <input
                ref={nameRef}
                value={orderName}
                maxLength={100}
                autoComplete="name"
                placeholder={messages.namePlaceholder}
                aria-label={messages.nameLabel}
                onChange={(event) => { setOrderName(event.target.value); setLocalError(null); }}
              />
            </label>
            <div className={styles.action}><Button type="submit">{messages.continueLabel}</Button></div>
          </form>
        )}
        <p className="sr-only" role="status" aria-live="polite">{status}</p>
      </div>
    </section>
  );
}
