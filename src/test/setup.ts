import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, vi } from "vitest";

// Node 25 exposes placeholder Storage globals unless the process is started
// with --localstorage-file. Vitest preserves existing globals over JSDOM's
// browser implementations, leaving tests without clear/getItem/setItem. Bind
// the JSDOM objects for each test and restore the original descriptors after
// the environment completes.
const originalLocalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);
const originalSessionStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "sessionStorage",
);
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "Storage");
const jsdomWindow = (
  globalThis as typeof globalThis & {
    jsdom?: { window: Window & { Storage: typeof Storage } };
  }
).jsdom?.window;

function bindJsdomStorage(): void {
  if (!jsdomWindow) return;
  Object.defineProperty(globalThis, "Storage", {
    configurable: true,
    enumerable: true,
    value: jsdomWindow.Storage,
    writable: false,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    enumerable: true,
    value: jsdomWindow.localStorage,
    writable: false,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    enumerable: true,
    value: jsdomWindow.sessionStorage,
    writable: false,
  });
}

bindJsdomStorage();
beforeEach(bindJsdomStorage);

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (name: string) =>
      name === "host" ? "test-storefront.example.test" : null,
  })),
}));

afterEach(cleanup);

afterAll(() => {
  for (const [name, descriptor] of [
    ["Storage", originalStorage],
    ["localStorage", originalLocalStorage],
    ["sessionStorage", originalSessionStorage],
  ] as const) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, name);
    }
  }
});
