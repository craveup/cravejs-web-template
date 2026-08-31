import {
  closeSync,
  constants as fileSystemConstants,
  fstatSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const releaseDirectory = new URL("../template/release/", import.meta.url);
const standaloneContentManifest = new URL(
  "../standalone/content-manifest.json",
  releaseDirectory,
);
const storefrontConfigSchema = new URL(
  "storefront-config.schema.json",
  releaseDirectory,
);
const maximumManifestBytes = 1024 * 1024;
const expectedFields = [
  "schemaVersion",
  "id",
  "repository",
  "platform",
  "profile",
  "templateRelease",
  "templateCommit",
  "templateIntegrity",
  "sdkPackage",
  "sdkVersion",
  "sdkIntegrity",
  "apiRelease",
  "openapiSha256",
  "minimumCliVersion",
  "configSchemaVersion",
  "configSchemaSha256",
  "releasedAt",
];
const canonicalIdentity = {
  id: "web",
  repository: "craveup/cravejs-web-template",
  platform: "web",
  profile: "standalone-cli",
};
const canonicalFieldConstants = {
  schemaVersion: 1,
  ...canonicalIdentity,
  sdkPackage: "@craveup/storefront-sdk",
  sdkVersion: "2.0.1",
  minimumCliVersion: "2.0.0",
  configSchemaVersion: "1.0.0",
};
const exactSemver = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const fieldPatterns = {
  templateRelease: exactSemver,
  templateCommit: /^[0-9a-f]{40}$/,
  templateIntegrity: /^sha256-(?:[A-Za-z0-9+/]{4}){10}[A-Za-z0-9+/]{2}[AEIMQUYcgkosw048]=$/,
  sdkIntegrity: /^sha512-(?:[A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/][AQgw]==$/,
  apiRelease: /^(?:[0-9a-f]{40}|(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?)$/,
  openapiSha256: /^[0-9a-f]{64}$/,
  configSchemaSha256: /^[0-9a-f]{64}$/,
  releasedAt: /^(?:(?:(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26]))|(?:(?:0[48]|[2468][048]|[13579][26])00))-02-29|(?:[0-9]{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|02-(?:0[1-9]|1[0-9]|2[0-8]))))T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]+)?Z$/,
};
const safeOwnershipPath = /^(?!.*(?:^|\/)\.\.?($|\/))(?!.*\/\/)[A-Za-z0-9.][A-Za-z0-9._/-]*$/;
const windowsReservedOwnershipSegment = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;
// Unknown fields are assessed as a set so sensitive input cannot be masked by JSON key order.
const forbiddenFieldPriority = [
  "CREDENTIAL",
  "CAPABILITY",
  "PROVIDER",
  "UNSAFE_PATH",
  "MUTABLE_REFERENCE",
  "PRIVATE_REPOSITORY",
  "UNKNOWN_FIELD",
];

class ValidationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new ValidationError(code);
}

function assertNoDuplicateJsonMembers(source) {
  let index = 0;

  const skipWhitespace = () => {
    while (/\s/.test(source[index] ?? "")) index += 1;
  };

  const parseString = () => {
    if (source[index] !== '"') throw new SyntaxError();
    const start = index;
    index += 1;
    while (index < source.length) {
      const character = source[index];
      index += 1;
      if (character === '"') return JSON.parse(source.slice(start, index));
      if (character === "\\") {
        const escape = source[index];
        index += 1;
        if (escape === "u") index += 4;
      }
    }
    throw new SyntaxError();
  };

  const parseValue = () => {
    skipWhitespace();
    if (source[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (source[index] === "}") {
        index += 1;
        return;
      }
      while (index < source.length) {
        const key = parseString();
        if (keys.has(key)) throw new SyntaxError();
        keys.add(key);
        skipWhitespace();
        if (source[index] !== ":") throw new SyntaxError();
        index += 1;
        parseValue();
        skipWhitespace();
        if (source[index] === "}") {
          index += 1;
          return;
        }
        if (source[index] !== ",") throw new SyntaxError();
        index += 1;
        skipWhitespace();
      }
      throw new SyntaxError();
    }
    if (source[index] === "[") {
      index += 1;
      skipWhitespace();
      if (source[index] === "]") {
        index += 1;
        return;
      }
      while (index < source.length) {
        parseValue();
        skipWhitespace();
        if (source[index] === "]") {
          index += 1;
          return;
        }
        if (source[index] !== ",") throw new SyntaxError();
        index += 1;
      }
      throw new SyntaxError();
    }
    if (source[index] === '"') {
      parseString();
      return;
    }
    const primitive = source.slice(index).match(
      /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/,
    );
    if (!primitive) throw new SyntaxError();
    index += primitive[0].length;
  };

  parseValue();
  skipWhitespace();
  if (index !== source.length) throw new SyntaxError();
}

function parseJsonSource(source, code) {
  try {
    assertNoDuplicateJsonMembers(source);
    return JSON.parse(source);
  } catch {
    fail(code);
  }
}

function parseJson(filePath, code) {
  try {
    return parseJsonSource(readFileSync(filePath, "utf8"), code);
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    fail(code);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key));
}

function isSafeOwnershipPath(path) {
  return typeof path === "string" && !path.endsWith("/") && safeOwnershipPath.test(path) &&
    path.split("/").every((segment) =>
      !segment.endsWith(".") && !windowsReservedOwnershipSegment.test(segment));
}

function validateSchema(schema) {
  if (!hasExactKeys(schema, [
    "$schema", "title", "type", "additionalProperties", "required", "properties",
  ]) || schema.$schema !== "https://json-schema.org/draft/2020-12/schema" ||
      schema.title !== "Repository-local template release manifest" ||
      schema.type !== "object" || schema.additionalProperties !== false) {
    fail("SCHEMA");
  }
  if (!Array.isArray(schema.required) || schema.required.length !== expectedFields.length) fail("SCHEMA");
  if (!hasExactKeys(schema.properties, expectedFields)) fail("SCHEMA");
  for (const field of expectedFields) {
    if (!schema.required.includes(field) || !Object.hasOwn(schema.properties, field)) fail("SCHEMA");
    const rule = schema.properties[field];
    if (!isPlainObject(rule)) fail("SCHEMA");
    const isConstantField = Object.hasOwn(canonicalFieldConstants, field);
    const expectedRuleKeys = isConstantField
      ? ["const"]
      : field === "releasedAt"
        ? ["type", "format", "pattern"]
        : ["type", "pattern"];
    if (!hasExactKeys(rule, expectedRuleKeys)) fail("SCHEMA");
    if (isConstantField && rule.const !== canonicalFieldConstants[field]) fail("SCHEMA");
    if (!isConstantField && rule.type !== "string") fail("SCHEMA");
    if (field === "releasedAt" && rule.format !== "date-time") fail("SCHEMA");
    if (Object.hasOwn(rule, "pattern") && rule.pattern !== fieldPatterns[field]?.source) {
      fail("SCHEMA");
    }
  }
}

function validateCompatibility(policy) {
  const expectedKeys = [
    "schemaVersion", "policyVersion", "identity", "template", "cli", "node", "pnpm", "sdk",
    "openapi", "configSchemaVersion", "upgrade",
  ];
  if (!hasExactKeys(policy, expectedKeys) || policy.schemaVersion !== 1 ||
      policy.policyVersion !== "1.0.0") {
    fail("COMPATIBILITY_POLICY");
  }
  const sectionKeys = {
    identity: ["id", "repository", "platform", "profile"],
    template: ["versioning", "minimumVersion"],
    cli: ["minimumVersion"],
    node: ["major"],
    pnpm: ["version"],
    sdk: ["package", "version", "integrity"],
    openapi: ["apiRelease", "sha256", "documentRevision", "documentDerivation"],
    upgrade: ["conflictStrategy", "allowMutableSources", "allowPrivateRepositories"],
  };
  for (const [section, keys] of Object.entries(sectionKeys)) {
    if (!hasExactKeys(policy[section], keys)) fail("COMPATIBILITY_POLICY");
  }
  for (const [field, value] of Object.entries(canonicalIdentity)) {
    if (policy.identity[field] !== value) fail("COMPATIBILITY_POLICY");
  }
  if (policy.template.versioning !== "semver-2.0.0" || policy.template.minimumVersion !== "0.1.0" ||
      !exactSemver.test(policy.template.minimumVersion) || policy.cli.minimumVersion !== "2.0.0" ||
      policy.node.major !== 24 || policy.pnpm.version !== "10.33.2" ||
      policy.sdk.package !== "@craveup/storefront-sdk" || policy.sdk.version !== "2.0.1" ||
      policy.sdk.integrity !== "sha512-dqvAtGf9+0ZVbG57iDAXNs4HAy+N37u9bmx5+y8KFFsVxOkvrPP5rhrLv7BBKvLosdhooi8YRAQsWCW9xxuJog==" ||
      policy.openapi.apiRelease !== "52cac07f74f1b8ca9a931354240560ef9beb4dce" ||
      policy.openapi.sha256 !== "9ba30418162695c27842ba6085ba00510c867137ecf83df0fe55b7808762a0d7" ||
      policy.configSchemaVersion !== "1.0.0" ||
      policy.upgrade.conflictStrategy !== "stop" || policy.upgrade.allowMutableSources !== false ||
      policy.upgrade.allowPrivateRepositories !== false) {
    fail("COMPATIBILITY_POLICY");
  }
}

function classifyForbiddenField(field, value) {
  const name = field.toLowerCase();
  const text = typeof value === "string" ? value.toLowerCase() : "";
  const diagnostics = [];
  if (/capability|(?:cart|receipt|checkout).*token|customer.*jwt|idempotency/.test(name)) {
    diagnostics.push("CAPABILITY");
  }
  if (/provider|stripe|payment/.test(name)) diagnostics.push("PROVIDER");
  if (/path|glob|directory|file/.test(name)) diagnostics.push("UNSAFE_PATH");
  if (/(?:ref|source|archive|branch|tag)/.test(name) && /(?:latest|main|dev)/.test(text)) {
    diagnostics.push("MUTABLE_REFERENCE");
  }
  if (/repository/.test(name) && /(?:private|internal)/.test(text)) {
    diagnostics.push("PRIVATE_REPOSITORY");
  }
  if (/secret|credential|api.?key|authorization|password|token|jwt/.test(name)) {
    diagnostics.push("CREDENTIAL");
  }
  return forbiddenFieldPriority.find((diagnostic) => diagnostics.includes(diagnostic)) ??
    "UNKNOWN_FIELD";
}

function schemaFailureCode(field, value) {
  if (field === "repository" && typeof value === "string" && /(?:private|internal)/i.test(value)) {
    return "PRIVATE_REPOSITORY";
  }
  if (["templateRelease", "templateCommit", "apiRelease"].includes(field)) return "RELEASE_REFERENCE";
  if (["templateIntegrity", "sdkIntegrity"].includes(field)) return "INTEGRITY";
  if (["openapiSha256", "configSchemaSha256"].includes(field)) return "DIGEST";
  if (field === "releasedAt") return "TIMESTAMP";
  if (field === "sdkVersion") return "SDK_VERSION";
  return "IDENTITY";
}

function validateManifestSchema(manifest, schema) {
  for (const field of expectedFields) {
    const rule = schema.properties[field];
    const value = manifest[field];
    if (Object.hasOwn(rule, "const") && value !== rule.const) fail(schemaFailureCode(field, value));
    if (rule.type === "string" && typeof value !== "string") fail(schemaFailureCode(field, value));
    if (rule.type === "number" && typeof value !== "number") fail(schemaFailureCode(field, value));
    if (fieldPatterns[field] && !fieldPatterns[field].test(value)) {
      fail(schemaFailureCode(field, value));
    }
  }
}

function compareSemver(left, right) {
  const parse = (version) => {
    const [withoutBuild] = version.split("+");
    const [core, prerelease] = withoutBuild.split("-", 2);
    return {
      core: core.split(".").map(Number),
      prerelease: prerelease?.split(".") ?? [],
    };
  };
  const parsedLeft = parse(left);
  const parsedRight = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (parsedLeft.core[index] !== parsedRight.core[index]) {
      return parsedLeft.core[index] < parsedRight.core[index] ? -1 : 1;
    }
  }
  if (parsedLeft.prerelease.length === 0 || parsedRight.prerelease.length === 0) {
    if (parsedLeft.prerelease.length === parsedRight.prerelease.length) return 0;
    return parsedLeft.prerelease.length === 0 ? 1 : -1;
  }
  const limit = Math.max(parsedLeft.prerelease.length, parsedRight.prerelease.length);
  for (let index = 0; index < limit; index += 1) {
    const leftIdentifier = parsedLeft.prerelease[index];
    const rightIdentifier = parsedRight.prerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;
    const leftNumeric = /^\d+$/.test(leftIdentifier);
    const rightNumeric = /^\d+$/.test(rightIdentifier);
    if (leftNumeric && rightNumeric) return Number(leftIdentifier) < Number(rightIdentifier) ? -1 : 1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftIdentifier < rightIdentifier ? -1 : 1;
  }
  return 0;
}

function pathsOverlap(left, right) {
  const normalize = (path) => path.replace(/[A-Z]/g, (character) => character.toLowerCase());
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return normalizedLeft === normalizedRight || normalizedLeft.startsWith(`${normalizedRight}/`) ||
    normalizedRight.startsWith(`${normalizedLeft}/`);
}

function validateOwnership(policy) {
  if (!hasExactKeys(policy, [
    "schemaVersion", "policyVersion", "conflictStrategy", "templateOwned", "userOwned",
  ]) || policy.schemaVersion !== 1 || !exactSemver.test(policy.policyVersion) ||
      policy.conflictStrategy !== "stop" || !Array.isArray(policy.templateOwned) ||
      !Array.isArray(policy.userOwned) || policy.templateOwned.length === 0 || policy.userOwned.length === 0) {
    fail("OWNERSHIP_POLICY");
  }
  const paths = [...policy.templateOwned, ...policy.userOwned];
  if (paths.some((path) => !isSafeOwnershipPath(path))) {
    fail("OWNERSHIP_POLICY");
  }
  for (let index = 0; index < paths.length; index += 1) {
    for (let other = index + 1; other < paths.length; other += 1) {
      if (pathsOverlap(paths[index], paths[other])) fail("OWNERSHIP_POLICY");
    }
  }
}

function ownershipPathContains(root, destination) {
  const normalizedRoot = root.toLowerCase();
  const normalizedDestination = destination.toLowerCase();
  return normalizedDestination === normalizedRoot ||
    normalizedDestination.startsWith(`${normalizedRoot}/`);
}

function validateContentManifest(manifest, ownership) {
  if (!hasExactKeys(manifest, ["schemaVersion", "profile", "files"]) ||
      manifest.schemaVersion !== 1 || manifest.profile !== "standalone-cli" ||
      !Array.isArray(manifest.files) || manifest.files.length === 0) {
    fail("OWNERSHIP_POLICY");
  }
  const sources = [];
  const destinations = [];
  for (const file of manifest.files) {
    if (!hasExactKeys(file, ["source", "destination", "ownership"]) ||
        !isSafeOwnershipPath(file.source) || !isSafeOwnershipPath(file.destination) ||
        !["template-owned", "user-owned"].includes(file.ownership)) {
      fail("OWNERSHIP_POLICY");
    }
    if (sources.some((source) => pathsOverlap(source, file.source)) ||
        destinations.some((destination) => pathsOverlap(destination, file.destination))) {
      fail("OWNERSHIP_POLICY");
    }
    sources.push(file.source);
    destinations.push(file.destination);

    const matches = [
      ...ownership.templateOwned.map((root) => ["template-owned", root]),
      ...ownership.userOwned.map((root) => ["user-owned", root]),
    ].filter(([, root]) => ownershipPathContains(root, file.destination));
    if (matches.length !== 1 || matches[0][0] !== file.ownership) {
      fail("OWNERSHIP_POLICY");
    }
  }
}

function validateManifest(manifest, schema, compatibility) {
  if (!isPlainObject(manifest)) fail("MANIFEST_SHAPE");
  const fields = Object.keys(manifest);
  for (const field of expectedFields) {
    if (!Object.hasOwn(manifest, field)) fail("MISSING_FIELD");
  }
  const unknownDiagnostics = fields
    .filter((field) => !expectedFields.includes(field))
    .map((field) => classifyForbiddenField(field, manifest[field]));
  if (unknownDiagnostics.length > 0) {
    const diagnostic = unknownDiagnostics.reduce((highestPriority, current) =>
      forbiddenFieldPriority.indexOf(current) < forbiddenFieldPriority.indexOf(highestPriority)
        ? current
        : highestPriority,
    );
    fail(diagnostic);
  }
  validateManifestSchema(manifest, schema);
  if (compareSemver(manifest.templateRelease, compatibility.template.minimumVersion) < 0) {
    fail("TEMPLATE_VERSION");
  }
  if (manifest.sdkPackage !== compatibility.sdk.package) fail("SDK_PACKAGE");
  if (manifest.sdkIntegrity !== compatibility.sdk.integrity) fail("SDK_INTEGRITY");
  if (manifest.minimumCliVersion !== compatibility.cli.minimumVersion ||
      manifest.configSchemaVersion !== compatibility.configSchemaVersion) fail("COMPATIBILITY");
  if (manifest.apiRelease !== compatibility.openapi.apiRelease ||
      manifest.openapiSha256 !== compatibility.openapi.sha256) fail("OPENAPI_BASELINE");
  // The contract is upstream's artifact. Where a downstream edit is
  // unavoidable -- the published servers block named an internal host -- the
  // derivation must be recorded, so changed bytes can never keep an unchanged
  // identity.
  if (
    !Number.isInteger(compatibility.openapi.documentRevision) ||
    compatibility.openapi.documentRevision < 1 ||
    typeof compatibility.openapi.documentDerivation !== "string" ||
    compatibility.openapi.documentDerivation.trim().length === 0
  ) {
    fail("OPENAPI_DERIVATION");
  }
}

function sourceBuffer(source, fallbackUrl) {
  if (source === undefined) {
    return Buffer.from(readFileSync(fallbackUrl, "utf8"));
  }
  return Buffer.isBuffer(source) ? source : Buffer.from(source);
}

function loadDocuments({ compatibilitySource, configSchemaSource } = {}) {
  const schema = parseJson(new URL("template-release.schema.json", releaseDirectory), "SCHEMA");
  const compatibilityBytes = sourceBuffer(
    compatibilitySource,
    new URL("compatibility.json", releaseDirectory),
  );
  const compatibility = parseJsonSource(
    compatibilityBytes.toString("utf8"),
    "COMPATIBILITY_POLICY",
  );
  const ownership = parseJson(new URL("file-ownership.json", releaseDirectory), "OWNERSHIP_POLICY");
  const contentManifest = parseJson(standaloneContentManifest, "OWNERSHIP_POLICY");
  const configSchemaBytes = sourceBuffer(
    configSchemaSource,
    storefrontConfigSchema,
  );
  parseJsonSource(configSchemaBytes.toString("utf8"), "CONFIG_SCHEMA");
  validateSchema(schema);
  validateCompatibility(compatibility);
  validateOwnership(ownership);
  validateContentManifest(contentManifest, ownership);
  return {
    schema,
    compatibility,
    configSchemaSha256: createHash("sha256")
      .update(configSchemaBytes)
      .digest("hex"),
  };
}

function readManifestSource(manifestPath) {
  let descriptor;
  try {
    const openFlags = fileSystemConstants.O_RDONLY | (fileSystemConstants.O_NONBLOCK ?? 0);
    descriptor = openSync(manifestPath, openFlags);
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size > maximumManifestBytes) fail("INPUT");
    const chunks = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let totalBytes = 0;
    while (totalBytes <= maximumManifestBytes) {
      const remainingBytes = maximumManifestBytes + 1 - totalBytes;
      const bytesRead = readSync(
        descriptor,
        buffer,
        0,
        Math.min(buffer.length, remainingBytes),
        null,
      );
      if (bytesRead === 0) break;
      if (bytesRead < 0 || bytesRead > remainingBytes) fail("INPUT");
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
      totalBytes += bytesRead;
    }
    if (totalBytes > maximumManifestBytes) fail("INPUT");
    return Buffer.concat(chunks, totalBytes).toString("utf8");
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    fail("INPUT");
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // Closing cannot change the already-determined validation result.
      }
    }
  }
}

export function validateTemplateRelease(manifestPath, documentSources) {
  const source = readManifestSource(manifestPath);
  const documents = loadDocuments(documentSources);
  const manifest = parseJsonSource(source, "MANIFEST_JSON");
  validateManifest(manifest, documents.schema, documents.compatibility);
  if (manifest.configSchemaSha256 !== documents.configSchemaSha256) {
    fail("CONFIG_SCHEMA");
  }
}

function run() {
  if (process.argv.length !== 3) {
    process.stderr.write("Usage: validate-template-release.mjs <manifest-path>\n");
    process.exitCode = 1;
    return;
  }
  try {
    validateTemplateRelease(process.argv[2]);
    process.stdout.write("Template release manifest is valid.\n");
  } catch (error) {
    const code = error instanceof ValidationError ? error.code : "INPUT";
    process.stderr.write(`Invalid template release manifest: ${code}\n`);
    process.exitCode = 1;
  }
}

function isDirectExecution() {
  if (typeof process.argv[1] !== "string") return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectExecution()) run();
