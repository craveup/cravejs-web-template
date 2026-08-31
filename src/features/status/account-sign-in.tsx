"use client";

import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { StorefrontCustomerTransportError } from "@/lib/storefront/customer";
import { useStorefrontCustomer } from "@/lib/storefront/use-customer";
import { useHydrated } from "@/lib/storefront/use-hydrated";

import { loadFixtureCustomerTransport } from "./customer-transport-loader";
import {
  getAccountSignInMessages,
  type AccountSignInMessages,
} from "./account-sign-in.messages";
import styles from "./account-sign-in.module.css";

const defaultResendDelaySeconds = 30;

export type AccountSignInCustomer = Pick<
  ReturnType<typeof useStorefrontCustomer>,
  | "state"
  | "requestOtp"
  | "resendOtp"
  | "verifyOtp"
  | "refreshProfile"
  | "logout"
>;

export interface AccountSignInProps {
  readonly merchantSlug: string;
  readonly locale: string;
  readonly mode: "fixture" | "live";
  readonly returnTo?: "/addresses";
}

export interface AccountSignInViewProps {
  readonly customer: AccountSignInCustomer;
  readonly locale: string;
  readonly resendDelaySeconds?: number;
  readonly returnTo?: "/addresses";
}

function rateLimitSeconds(
  retryAfterMs: number | undefined,
  remainingSeconds: number,
): number {
  if (retryAfterMs === undefined) return Math.max(remainingSeconds, 1);
  return Math.max(Math.ceil(retryAfterMs / 1_000), 1);
}

function remoteErrorMessage(
  customer: AccountSignInCustomer,
  messages: AccountSignInMessages,
  rateLimitRemaining: number,
): string | null {
  const { error, challenge } = customer.state;
  if (!error) return null;
  if (error.state === "authentication-required" && !challenge) return null;
  if (error.state === "rate-limited") {
    if (rateLimitRemaining <= 0) return null;
    return messages.rateLimited(rateLimitRemaining);
  }
  if (error.state === "unavailable" && challenge) {
    return messages.expiredChallenge;
  }
  if (error.state === "authentication-required") {
    return messages.sessionExpired;
  }
  if (error.state === "validation") {
    return challenge
      ? messages.verificationFailed
      : messages.requestFailed;
  }
  if (error.state === "unexpected" || error.state === "integration-error") {
    return messages.genericError;
  }
  return challenge ? messages.verificationFailed : messages.requestFailed;
}

function profileName(customer: AccountSignInCustomer): string | null {
  const profile = customer.state.profile;
  if (!profile) return null;
  const name = [profile.customerName, profile.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || null;
}

function profileIdentifier(customer: AccountSignInCustomer): string | null {
  const profile = customer.state.profile;
  return profile?.customerEmail || profile?.phoneNumber || null;
}

export function AccountSignIn({
  merchantSlug,
  locale,
  mode,
  returnTo,
}: AccountSignInProps) {
  const customer = useStorefrontCustomer({
    merchantSlug,
    ...(mode === "fixture"
      ? { getTransport: loadFixtureCustomerTransport }
      : {}),
  });

  return (
    <AccountSignInView
      customer={customer}
      locale={locale}
      returnTo={returnTo}
    />
  );
}

export function AccountSignInView({
  customer,
  locale,
  resendDelaySeconds = defaultResendDelaySeconds,
  returnTo,
}: AccountSignInViewProps) {
  const messages = getAccountSignInMessages(locale);
  const hydrated = useHydrated();
  const [identifier, setIdentifier] = useState(
    customer.state.challenge?.identifierString ?? "",
  );
  const [otp, setOtp] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [resendRemaining, setResendRemaining] = useState(0);
  const [rateLimitRemaining, setRateLimitRemaining] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const identifierRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const authenticatedHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusedRemoteErrorRef = useRef<StorefrontCustomerTransportError | null>(
    null,
  );
  const bootstrappedRef = useRef(false);
  const challenge = customer.state.challenge;
  const authenticated = customer.state.status === "authenticated";
  const requesting = customer.state.status === "requesting-code";
  const verifying = customer.state.status === "verifying";
  const expired =
    customer.state.error?.state === "unavailable" && Boolean(challenge);
  const remoteError = remoteErrorMessage(
    customer,
    messages,
    rateLimitRemaining,
  );
  const visibleError = localError ?? remoteError;

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    void customer.refreshProfile().catch(() => undefined);
  }, [customer]);

  useEffect(() => {
    if (resendRemaining <= 0) return;
    const timeout = window.setTimeout(() => {
      setResendRemaining((seconds) => Math.max(seconds - 1, 0));
    }, 1_000);
    return () => window.clearTimeout(timeout);
  }, [resendRemaining]);

  useEffect(() => {
    if (rateLimitRemaining <= 0) return;
    const timeout = window.setTimeout(() => {
      setRateLimitRemaining((seconds) => Math.max(seconds - 1, 0));
    }, 1_000);
    return () => window.clearTimeout(timeout);
  }, [rateLimitRemaining]);

  useEffect(() => {
    if (
      challenge &&
      (customer.state.status === "code-required" ||
        customer.state.status === "error")
    ) {
      otpRef.current?.focus();
    }
  }, [challenge, customer.state.status]);

  useEffect(() => {
    const error = customer.state.error;
    if (
      remoteError &&
      error &&
      focusedRemoteErrorRef.current !== error
    ) {
      focusedRemoteErrorRef.current = error;
      errorRef.current?.focus();
    }
  }, [customer.state.error, remoteError]);

  useEffect(() => {
    if (authenticated) authenticatedHeadingRef.current?.focus();
  }, [authenticated]);

  async function submitIdentifier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = identifier.trim();
    if (normalized.length < 3 || normalized.length > 254) {
      setLocalError(messages.identifierRequired);
      identifierRef.current?.focus();
      return;
    }

    setLocalError(null);
    try {
      const nextChallenge = await customer.requestOtp(normalized);
      setRateLimitRemaining(0);
      setIdentifier(nextChallenge.identifierString);
      setOtp("");
      setResendRemaining(Math.max(resendDelaySeconds, 0));
    } catch (error) {
      applyRetryAfter(error);
      // The shared hook retains only the safe mapped error state.
    }
  }

  async function submitOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setLocalError(messages.otpRequired);
      otpRef.current?.focus();
      return;
    }

    setLocalError(null);
    try {
      await customer.verifyOtp({ otp });
      setRateLimitRemaining(0);
    } catch (error) {
      applyRetryAfter(error);
      // The shared hook retains only the safe mapped error state.
    }
  }

  function applyRetryAfter(error: unknown) {
    if (
      error instanceof StorefrontCustomerTransportError &&
      error.state === "rate-limited"
    ) {
      setRateLimitRemaining(rateLimitSeconds(error.retryAfterMs, 0));
    }
  }

  async function resendCode() {
    setLocalError(null);
    try {
      await customer.resendOtp();
      setRateLimitRemaining(0);
      setOtp("");
      setResendRemaining(Math.max(resendDelaySeconds, 0));
    } catch (error) {
      applyRetryAfter(error);
      // The shared hook retains only the safe mapped error state.
    }
  }

  async function signOut() {
    if (signingOut) return;
    setLocalError(null);
    setSigningOut(true);
    try {
      await customer.logout();
    } catch {
      // Logout still clears the merchant-bound local session in the transport.
    } finally {
      setSigningOut(false);
      window.setTimeout(() => identifierRef.current?.focus(), 0);
    }
  }

  const statusMessage = requesting
    ? challenge
      ? messages.resendingLabel
      : messages.sendingCodeLabel
    : verifying
      ? messages.verifyingLabel
      : signingOut
        ? messages.signingOutLabel
      : null;

  return (
    <section
      className={styles.surface}
      aria-labelledby="account-sign-in-heading"
      aria-busy={requesting || verifying}
    >
      <h1 className={styles.heading} id="account-sign-in-heading">
        <span className={styles.mobileCopy}>{messages.mobileHeading}</span>
        <span className={styles.desktopCopy}>{messages.desktopHeading}</span>
      </h1>
      <p className={styles.description}>
        <span className={styles.mobileCopy}>{messages.mobileDescription}</span>
        <span className={styles.desktopCopy}>{messages.desktopDescription}</span>
      </p>

      {visibleError ? (
        <p
          className={styles.errorSummary}
          ref={errorRef}
          role="alert"
          aria-live={
            customer.state.error?.state === "rate-limited" ? "off" : undefined
          }
          tabIndex={-1}
        >
          {visibleError}
        </p>
      ) : null}

      {authenticated ? (
        <div className={styles.authenticated}>
          <h2 ref={authenticatedHeadingRef} tabIndex={-1}>
            {messages.signedInHeading}
          </h2>
          {profileName(customer) ? (
            <p className={styles.profileName}>{profileName(customer)}</p>
          ) : (
            <p className={styles.profileIdentifier}>
              {messages.signedInFallback}
            </p>
          )}
          {profileIdentifier(customer) ? (
            <p className={styles.profileIdentifier}>
              {profileIdentifier(customer)}
            </p>
          ) : null}
          <ButtonLink href={returnTo ?? "/account/orders"}>
            {returnTo
              ? messages.returnToSavedAddressesLabel
              : messages.viewOrdersLabel}
          </ButtonLink>
          <button
            className={styles.secondaryAction}
            type="button"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            {signingOut ? messages.signingOutLabel : messages.signOutLabel}
          </button>
        </div>
      ) : challenge ? (
        <form className={styles.form} onSubmit={submitOtp} noValidate>
          <p className={styles.delivery}>
            {messages.codeSent(challenge.delivery, challenge.identifierString)}
          </p>
          <div className={styles.field}>
            <label htmlFor="account-verification-code">
              {messages.otpLabel}
            </label>
            <input
              id="account-verification-code"
              ref={otpRef}
              disabled={!hydrated}
              value={otp}
              onChange={(event) => {
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                setLocalError(null);
              }}
              aria-invalid={localError === messages.otpRequired}
              aria-describedby={
                localError === messages.otpRequired
                  ? "account-otp-error"
                  : undefined
              }
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              placeholder={messages.otpPlaceholder}
            />
            {localError === messages.otpRequired ? (
              <span
                className={styles.fieldError}
                id="account-otp-error"
              >
                {localError}
              </span>
            ) : null}
          </div>
          <Button
            className={styles.submit}
            type="submit"
            disabled={
              !hydrated ||
              requesting ||
              verifying ||
              expired ||
              rateLimitRemaining > 0
            }
          >
            {verifying ? messages.verifyingLabel : messages.verifyLabel}
          </Button>
          <div className={styles.actions}>
            {expired ? (
              <button
                className={styles.secondaryAction}
                type="button"
                disabled={requesting || rateLimitRemaining > 0}
                onClick={() => void resendCode()}
              >
                {messages.requestNewCodeLabel}
              </button>
            ) : (
              <button
                className={styles.secondaryAction}
                type="button"
                disabled={
                  requesting ||
                  resendRemaining > 0 ||
                  rateLimitRemaining > 0
                }
                onClick={() => void resendCode()}
              >
                {requesting
                  ? messages.resendingLabel
                  : Math.max(resendRemaining, rateLimitRemaining) > 0
                    ? messages.resendIn(
                        Math.max(resendRemaining, rateLimitRemaining),
                      )
                    : messages.resendLabel}
              </button>
            )}
          </div>
        </form>
      ) : (
        <form className={styles.form} onSubmit={submitIdentifier} noValidate>
          <div className={styles.field}>
            <label htmlFor="account-identifier">
              {messages.identifierLabel}
            </label>
            <input
              id="account-identifier"
              ref={identifierRef}
              disabled={!hydrated}
              value={identifier}
              onChange={(event) => {
                setIdentifier(event.target.value);
                setLocalError(null);
              }}
              aria-invalid={localError === messages.identifierRequired}
              aria-describedby={
                localError === messages.identifierRequired
                  ? "account-identifier-error"
                  : undefined
              }
              autoComplete="username"
              maxLength={254}
              placeholder={messages.identifierPlaceholder}
            />
            {localError === messages.identifierRequired ? (
              <span
                className={styles.fieldError}
                id="account-identifier-error"
              >
                {localError}
              </span>
            ) : null}
          </div>
          <Button
            className={styles.submit}
            type="submit"
            disabled={!hydrated || requesting || rateLimitRemaining > 0}
          >
            {requesting
              ? messages.sendingCodeLabel
              : messages.continueLabel}
          </Button>
          <p className={styles.terms}>{messages.termsNotice}</p>
        </form>
      )}

      <p className={styles.status} role="status" aria-live="polite">
        {statusMessage}
      </p>
    </section>
  );
}
