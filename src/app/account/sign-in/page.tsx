import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  AccountPageShell,
  readAccountPageRuntime,
} from "@/features/status/account-page";
import { AccountSignIn } from "@/features/status/account-sign-in";
import { storefrontPrivateRobots } from "@/lib/tenant/storefront-seo";

export const metadata: Metadata = {
  title: "Sign in | Crave Storefront",
  description: "Sign in to view customer details and past orders.",
  robots: storefrontPrivateRobots,
};

interface AccountSignInPageProps {
  readonly searchParams?: Promise<{
    readonly returnTo?: string | readonly string[];
  }>;
}

export default async function AccountSignInPage({
  searchParams,
}: AccountSignInPageProps) {
  const runtime = await readAccountPageRuntime();
  if (!runtime) {
    notFound();
  }
  const requestedReturnTo = (await searchParams)?.returnTo;
  const returnTo =
    requestedReturnTo === "/addresses" ? "/addresses" : undefined;

  return (
    <AccountPageShell accountHref="/account/sign-in">
      <AccountSignIn
        merchantSlug={runtime.merchantSlug}
        locale={runtime.locale}
        mode={runtime.mode}
        {...(returnTo ? { returnTo } : {})}
      />
    </AccountPageShell>
  );
}
