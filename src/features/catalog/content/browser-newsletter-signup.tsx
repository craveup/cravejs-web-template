"use client";

import { useState } from "react";

import type { StorefrontNewsletterConfig } from "@/config/storefront-config";
import { createBrowserNewsletterResource } from "@/features/newsletter/browser-newsletter-resource";

import { NewsletterSignup } from "./newsletter-signup";

export interface BrowserNewsletterSignupProps {
  readonly copy: StorefrontNewsletterConfig;
  readonly locale: string;
}

export function BrowserNewsletterSignup({
  copy,
  locale,
}: BrowserNewsletterSignupProps) {
  const [resource] = useState(createBrowserNewsletterResource);
  return <NewsletterSignup copy={copy} locale={locale} resource={resource} />;
}
