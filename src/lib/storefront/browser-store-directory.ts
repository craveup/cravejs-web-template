"use client";

import { storefrontClient } from "./browser-client";
import { createStorefrontStoreDirectory } from "./store-directory";

export const browserStoreDirectory =
  createStorefrontStoreDirectory(storefrontClient);
