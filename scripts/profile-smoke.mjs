import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const supportedProfiles = new Set(["hosted-multitenant", "standalone-cli"]);

function standaloneHost(environment) {
  const rawConfiguration = environment.STOREFRONT_STANDALONE_CONFIG_JSON;
  if (!rawConfiguration) return undefined;
  let configuration;
  try {
    configuration = JSON.parse(rawConfiguration);
  } catch {
    throw new Error("profile:smoke requires valid standalone configuration.");
  }
  if (
    typeof configuration !== "object" ||
    configuration === null ||
    Array.isArray(configuration) ||
    typeof configuration.canonicalOrigin !== "string"
  ) {
    throw new Error("profile:smoke requires valid standalone configuration.");
  }
  let origin;
  try {
    origin = new URL(configuration.canonicalOrigin);
  } catch {
    throw new Error("profile:smoke requires a canonical standalone origin.");
  }
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("profile:smoke requires a canonical standalone origin.");
  }
  return origin.host;
}

export function resolveProfileSmokeConfiguration(
  environment,
  loadGeneratedEnvironment,
) {
  if (
    !environment.STOREFRONT_PROFILE ||
    !environment.STOREFRONT_PROFILE_SMOKE_HOST
  ) {
    try {
      loadGeneratedEnvironment();
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const profile = environment.STOREFRONT_PROFILE;
  if (!supportedProfiles.has(profile)) {
    throw new Error("profile:smoke requires a supported STOREFRONT_PROFILE.");
  }
  const host =
    environment.STOREFRONT_PROFILE_SMOKE_HOST ||
    (profile === "standalone-cli" ? standaloneHost(environment) : undefined);
  if (!host) {
    throw new Error("profile:smoke requires STOREFRONT_PROFILE_SMOKE_HOST.");
  }
  const port = Number(environment.STOREFRONT_PROFILE_SMOKE_PORT ?? "4308");
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(
      "STOREFRONT_PROFILE_SMOKE_PORT must be a non-privileged port.",
    );
  }
  return { host, port, profile };
}

async function run() {
  const { host, port, profile } = resolveProfileSmokeConfiguration(
    process.env,
    () => process.loadEnvFile(".env.local"),
  );
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      String(port),
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += String(chunk);
  });

  async function request(pathname, requestHost = host) {
    return new Promise((resolve, reject) => {
      const request = httpRequest({
        hostname: "127.0.0.1",
        port,
        path: pathname,
        method: "GET",
        headers: { host: requestHost },
      });
      request.on("response", (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const headerValues = new Map(
            Object.entries(response.headers).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.join(", ") : value ?? "",
            ]),
          );
          resolve({
            status: response.statusCode ?? 0,
            headers: {
              get: (name) => headerValues.get(name.toLowerCase()) ?? null,
            },
            text: async () => Buffer.concat(chunks).toString("utf8"),
          });
        });
      });
      request.on("error", reject);
      request.end();
    });
  }

  async function waitUntilReady() {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`Storefront exited before smoke readiness.\n${output}`);
      }
      try {
        const response = await request("/account/sign-in");
        if (response.status < 500) return response;
      } catch {
        // The listener is not ready yet.
      }
      await delay(200);
    }
    throw new Error(`Timed out waiting for storefront smoke.\n${output}`);
  }

  try {
    const response = await waitUntilReady();
    const body = await response.text();

    assert.equal(response.status, 200, body);
    assert.match(
      response.headers.get("content-security-policy") ?? "",
      /frame-ancestors 'none'/,
    );
    assert.match(
      response.headers.get("x-content-type-options") ?? "",
      /nosniff/,
    );
    assert.match(body, /data-theme="base"/);
    assert.match(body, /lang="en-US"/);
    assert.doesNotMatch(body, /FIXTURE MODE/);

    if (profile === "hosted-multitenant") {
      const unknownHostResponse = await request(
        "/account/sign-in",
        "unknown.example.invalid",
      );
      assert.equal(unknownHostResponse.status, 404);
    }

    process.stdout.write(`Profile smoke passed for ${profile}.\n`);
  } finally {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(3_000).then(() => child.kill("SIGKILL")),
    ]);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await run();
}
