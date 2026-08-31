import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  AccountPageShell,
  readAccountPageRuntime,
} from "@/features/status/account-page";
import { AccountOrders } from "@/features/status/order-history";
import { storefrontPrivateRobots } from "@/lib/tenant/storefront-seo";

export const metadata: Metadata = {
  title: "Order details | Crave Storefront",
  description: "View details for a customer order.",
  robots: storefrontPrivateRobots,
};

function isPublicOrderId(orderId: string): boolean {
  return orderId.length >= 1 && orderId.length <= 128;
}

export default async function AccountOrderDetailPage(
  props: PageProps<"/account/orders/[orderId]">,
) {
  const runtime = await readAccountPageRuntime();
  const { orderId } = await props.params;
  if (!runtime || !isPublicOrderId(orderId)) {
    notFound();
  }

  return (
    <AccountPageShell accountHref="/account/orders">
      <AccountOrders {...runtime} orderId={orderId} />
    </AccountPageShell>
  );
}
