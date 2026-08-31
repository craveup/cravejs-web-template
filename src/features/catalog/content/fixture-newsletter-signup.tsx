"use client";

import { useState } from "react";

import type { StorefrontNewsletterConfig } from "@/config/storefront-config";
import type { FixtureRuntime } from "@/fixtures/fixture-runtime";
import {
  createFixtureStorefrontNewsletterResource,
  type FixtureNewsletterScenario,
} from "@/fixtures/newsletter-resource";

import { NewsletterSignup } from "./newsletter-signup";

export interface FixtureNewsletterSignupProps {
  readonly copy: StorefrontNewsletterConfig;
  readonly locale: string;
  readonly runtime: FixtureRuntime;
  readonly scenario?: FixtureNewsletterScenario;
}

export function FixtureNewsletterSignup({
  copy,
  locale,
  runtime,
  scenario,
}: FixtureNewsletterSignupProps) {
  const [resource] = useState(() =>
    createFixtureStorefrontNewsletterResource(
      runtime,
      scenario ? { scenario } : undefined,
    ),
  );
  return <NewsletterSignup copy={copy} locale={locale} resource={resource} />;
}
