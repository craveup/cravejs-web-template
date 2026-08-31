"use client";

import {
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StorefrontNewsletterConfig } from "@/config/storefront-config";
import type { NewsletterResource } from "@/features/newsletter/newsletter-resource";

import { getNewsletterSignupMessages } from "./newsletter-signup.messages";
import styles from "./newsletter-signup.module.css";

export interface NewsletterSignupProps {
  readonly copy: StorefrontNewsletterConfig;
  readonly locale: string;
  readonly resource: NewsletterResource;
}

export function NewsletterSignup({
  copy,
  locale,
  resource,
}: NewsletterSignupProps) {
  const snapshot = useSyncExternalStore(
    resource.subscribe,
    resource.getSnapshot,
    resource.getSnapshot,
  );
  const [locallyInvalid, setLocallyInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const headingId = useId();
  const consentId = useId();
  const issueId = useId();
  const messages = getNewsletterSignupMessages(locale);
  const pending = snapshot.status === "pending";
  const invalid = locallyInvalid || snapshot.status === "invalid";
  const issue = invalid
    ? messages.invalid
    : snapshot.status === "rate-limited"
      ? messages.rateLimited(snapshot.retryAfterMs)
      : snapshot.status === "error"
        ? messages.unavailable
        : undefined;

  useEffect(() => {
    if (snapshot.status === "invalid") inputRef.current?.focus();
    if (snapshot.status === "success") successRef.current?.focus();
  }, [snapshot.status]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const input = inputRef.current;
    if (!input) return;
    input.value = input.value.trim();
    if (!input.checkValidity()) {
      setLocallyInvalid(true);
      input.focus();
      return;
    }

    setLocallyInvalid(false);
    void resource.submit(input.value);
  }

  function handleChange() {
    setLocallyInvalid(false);
    if (
      snapshot.status !== "idle" &&
      snapshot.status !== "pending" &&
      snapshot.status !== "success"
    ) {
      resource.reset();
    }
  }

  return (
    <section
      aria-labelledby={headingId}
      className={styles.band}
      data-testid="long-form-newsletter"
    >
      <div className={styles.inner}>
        <h2 id={headingId}>{copy.heading}</h2>
        {snapshot.status === "success" ? (
          <p
            className={styles.response}
            ref={successRef}
            role="status"
            tabIndex={-1}
          >
            {copy.successMessage}
          </p>
        ) : (
          <form
            aria-busy={pending}
            aria-labelledby={headingId}
            className={styles.form}
            data-testid="newsletter-form"
            method="post"
            noValidate
            onSubmit={handleSubmit}
          >
            <label className="sr-only" htmlFor={`${headingId}-email`}>
              {copy.emailLabel}
            </label>
            <Input
              ref={inputRef}
              id={`${headingId}-email`}
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              placeholder={copy.emailLabel}
              disabled={pending}
              aria-invalid={invalid || undefined}
              aria-describedby={issue ? `${consentId} ${issueId}` : consentId}
              onChange={handleChange}
            />
            <Button disabled={pending} type="submit">
              {copy.submitLabel}
            </Button>
            <p className={styles.consent} id={consentId}>
              {copy.consentCopy}
            </p>
            {issue ? (
              <p className={styles.issue} id={issueId} role="alert">
                {issue}
              </p>
            ) : null}
            <p className="sr-only" role="status" aria-live="polite">
              {pending ? messages.pending : ""}
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
