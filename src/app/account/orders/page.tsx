import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  AccountPageShell,
  readAccountPageRuntime,
} from "@/features/status/account-page";
import { AccountOrders } from "@/features/status/order-history";
import { storefrontPrivateRobots } from "@/lib/tenant/storefront-seo";

export const metadata: Metadata = {
  title: "Your orders | Crave Storefront",
  description: "View your customer order history.",
  robots: storefrontPrivateRobots,
};

export default async function AccountOrdersPage() {
  const runtime = await readAccountPageRuntime();
  if (!runtime) {
    notFound();
  }

  return (
    <AccountPageShell accountHref="/account/orders">
      <AccountOrders {...runtime} />
    </AccountPageShell>
  );
}
