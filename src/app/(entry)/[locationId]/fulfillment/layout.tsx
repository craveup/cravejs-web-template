import type { Metadata } from "next";
import type { ReactNode } from "react";

import { storefrontPrivateRobots } from "@/lib/tenant/storefront-seo";

export const metadata: Metadata = {
  robots: storefrontPrivateRobots,
};

export default function FulfillmentLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return children;
}
