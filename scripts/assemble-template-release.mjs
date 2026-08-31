import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { validateTemplateRelease } from "./validate-template-release.mjs";
import { buildCliPayload } from "./build-cli-payload.mjs";

const exactSemver =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const utcTimestamp =
  /^(?:(?:(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26]))|(?:(?:0[48]|[2468][048]|[13579][26])00))-02-29|(?:[0-9]{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|02-(?:0[1-9]|1[0-9]|2[0-8]))))T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]+)?Z$/;
const maximumArtifactBytes = 256 * 1024 * 1024;

class AssemblyError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new AssemblyError(code);
}

function readOptions(args) {
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
  if (normalizedArgs.length !== 6) fail("USAGE");
  const values = new Map();
  for (let index = 0; index < normalizedArgs.length; index += 2) {
    const flag = normalizedArgs[index];
    const value = normalizedArgs[index + 1];
    if (
      !["--release", "--released-at", "--output"].includes(flag) ||
      typeof value !== "string" ||
      value.length === 0 ||
      values.has(flag)
    ) {
      fail("USAGE");
    }
    values.set(flag, value);
  }
  const templateRelease = values.get("--release");
  const releasedAt = values.get("--released-at");
  const outputDirectory = values.get("--output");
  if (!templateRelease || !releasedAt || !outputDirectory) fail("USAGE");
  if (!exactSemver.test(templateRelease)) fail("RELEASE_REFERENCE");
  if (!utcTimestamp.test(releasedAt)) fail("TIMESTAMP");
  return { templateRelease, releasedAt, outputDirectory };
}

function git(repositoryRoot, args, encoding = "utf8") {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding,
    maxBuffer: maximumArtifactBytes,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function sha256Hex(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function readArchiveMember(artifactPath, memberPath) {
  return execFileSync("tar", ["-xOf", artifactPath, memberPath], {
    maxBuffer: maximumArtifactBytes,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function canonicalPathForCreation(absolutePath) {
  const missingSegments = [];
  let existingAncestor = absolutePath;

  while (!existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) fail("OUTPUT_PATH");
    missingSegments.unshift(path.basename(existingAncestor));
    existingAncestor = parent;
  }

  return {
    canonicalPath: path.join(
      realpathSync(existingAncestor),
      ...missingSegments,
    ),
    existingAncestor,
  };
}

export function sameDirectoryIdentity(firstPath, secondPath) {
  const first = statSync(firstPath, { bigint: true });
  const second = statSync(secondPath, { bigint: true });
  return (
    first.isDirectory() &&
    second.isDirectory() &&
    first.ino !== 0n &&
    second.ino !== 0n &&
    first.dev === second.dev &&
    first.ino === second.ino
  );
}

function existingPathIsWithinDirectory(existingPath, directoryRoot) {
  const existingPathStats = statSync(existingPath);
  let currentDirectory = realpathSync(
    existingPathStats.isDirectory() ? existingPath : path.dirname(existingPath),
  );

  while (true) {
    if (sameDirectoryIdentity(currentDirectory, directoryRoot)) return true;

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) return false;
    currentDirectory = parentDirectory;
  }
}

export function assembleTemplateRelease(
  { templateRelease, releasedAt, outputDirectory },
  repositoryRoot = process.cwd(),
) {
  const requestedRepositoryRoot = realpathSync(repositoryRoot);
  const gitRoot = realpathSync(
    git(requestedRepositoryRoot, ["rev-parse", "--show-toplevel"]).trim(),
  );
  if (!sameDirectoryIdentity(requestedRepositoryRoot, gitRoot)) {
    fail("REPOSITORY_ROOT");
  }
  const canonicalRepositoryRoot = gitRoot;
  if (git(canonicalRepositoryRoot, ["status", "--porcelain", "--untracked-files=all"]).trim()) {
    fail("DIRTY_SOURCE");
  }

  const templateCommit = git(canonicalRepositoryRoot, ["rev-parse", "HEAD"]).trim();
  if (!/^[0-9a-f]{40}$/.test(templateCommit)) fail("RELEASE_REFERENCE");

  if (!path.isAbsolute(outputDirectory)) fail("OUTPUT_ABSOLUTE");
  const resolvedOutputDirectory = path.resolve(outputDirectory);
  const outputLocation = canonicalPathForCreation(
    resolvedOutputDirectory,
  );
  if (
    existingPathIsWithinDirectory(
      outputLocation.existingAncestor,
      canonicalRepositoryRoot,
    )
  ) {
    fail("OUTPUT_INSIDE_SOURCE");
  }
  const canonicalOutputDirectory = outputLocation.canonicalPath;
  mkdirSync(canonicalOutputDirectory, { recursive: true });
  if (readdirSync(canonicalOutputDirectory).length > 0) fail("OUTPUT_NOT_EMPTY");

  const artifactName = `cravejs-web-template-${templateRelease}.tar`;
  const artifactPath = path.join(canonicalOutputDirectory, artifactName);
  const manifestPath = path.join(
    canonicalOutputDirectory,
    "template-release.json",
  );

  try {
    const archivePrefix = `cravejs-web-template-${templateRelease}`;
    const payload = buildCliPayload({
      archivePrefix,
      manifestPath: path.join(
        canonicalRepositoryRoot,
        "distribution/cli-payload.json",
      ),
      outputPath: artifactPath,
      repositoryRoot: canonicalRepositoryRoot,
      treeish: templateCommit,
    });
    const compatibilitySource = readArchiveMember(
      artifactPath,
      `${archivePrefix}/template/release/compatibility.json`,
    );
    const configSchemaSource = readArchiveMember(
      artifactPath,
      `${archivePrefix}/template/release/storefront-config.schema.json`,
    );
    const compatibility = JSON.parse(compatibilitySource.toString("utf8"));
    const manifest = {
      schemaVersion: 1,
      id: "web",
      repository: "craveup/cravejs-web-template",
      platform: "web",
      profile: "standalone-cli",
      templateRelease,
      templateCommit,
      templateIntegrity: payload.integrity,
      sdkPackage: compatibility.sdk.package,
      sdkVersion: compatibility.sdk.version,
      sdkIntegrity: compatibility.sdk.integrity,
      apiRelease: compatibility.openapi.apiRelease,
      openapiSha256: compatibility.openapi.sha256,
      minimumCliVersion: compatibility.cli.minimumVersion,
      configSchemaVersion: compatibility.configSchemaVersion,
      configSchemaSha256: sha256Hex(configSchemaSource),
      releasedAt,
    };

    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    validateTemplateRelease(manifestPath, {
      compatibilitySource,
      configSchemaSource,
    });
  } catch (error) {
    rmSync(artifactPath, { force: true });
    rmSync(manifestPath, { force: true });
    if (error instanceof AssemblyError) throw error;
    fail("ASSEMBLY");
  }

  return { artifactPath, manifestPath };
}

function run() {
  try {
    assembleTemplateRelease(readOptions(process.argv.slice(2)));
    process.stdout.write("Template release candidate assembled.\n");
  } catch (error) {
    const code = error instanceof AssemblyError ? error.code : "ASSEMBLY";
    process.stderr.write(`Template release assembly failed: ${code}\n`);
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
