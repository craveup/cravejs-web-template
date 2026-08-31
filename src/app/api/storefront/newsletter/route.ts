import "server-only";

import { createNewsletterPostHandler } from "../../../../features/newsletter/server/newsletter-route";
import { readRequestStorefrontRuntime } from "../../../../lib/tenant/server-storefront-runtime";

const POSTHandler = createNewsletterPostHandler({
  resolveRuntime: (requestHeaders) =>
    readRequestStorefrontRuntime(process.env, requestHeaders),
  provider: null,
  rateLimit: {
    async check() {
      return { allowed: true };
    },
  },
});

export async function POST(request: Request): Promise<Response> {
  return POSTHandler(request);
}
