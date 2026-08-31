/**
 * Builds the narrower payload a generated project receives.
 *
 * The public source repository and the CLI payload are different artifacts and
 * were previously the same one. Serving both from a single `git archive` meant
 * every file the payload did not want had to be excluded from the repository
 * too -- which removed inputs the repository's own build and tests still read,
 * and left a published tree that could not verify itself.
 *
 * The repository keeps everything it needs. This selects, from that tree, what
 * a scaffolded storefront actually receives.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export class CliPayloadError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "CliPayloadError";
    this.code = code;
  }
}

function toPattern(entry) {
  if (!entry.includes("*")) {
    return entry.endsWith("/")
      ? { kind: "prefix", value: entry }
      : { kind: "exact", value: entry };
  }
  // `**/` crosses directories; a bare `*` does not. A pattern ending in `/`
  // names a directory, so everything beneath it matches.
  const source = entry
    .split("**/")
    .map((part) => part.replace(/[.+^${}()|[\]\\]/gu, "\\$&").replace(/\*/gu, "[^/]*"))
    .join("(?:.*/)?");
  return {
    kind: "regexp",
    value: new RegExp(`^${entry.endsWith("/") ? `${source}.*` : source}$`, "u"),
  };
}

function matches(patterns, candidate) {
  return patterns.some((pattern) => {
    if (pattern.kind === "prefix") return candidate.startsWith(pattern.value);
    if (pattern.kind === "exact") return candidate === pattern.value;
    return pattern.value.test(candidate);
  });
}

export function readCliPayloadManifest(manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.include) || manifest.include.length === 0) {
    throw new CliPayloadError("PAYLOAD_INCLUDE_EMPTY");
  }
  return manifest;
}

/**
 * Decide the payload's membership from a source member list. Pure, so the
 * selection can be tested without building a tarball.
 */
export function selectCliPayloadMembers(sourceMembers, manifest) {
  const include = manifest.include.map(toPattern);
  const exclude = (manifest.exclude ?? []).map(toPattern);
  const selected = sourceMembers
    .filter((member) => matches(include, member))
    .filter((member) => !matches(exclude, member))
    .sort();
  if (selected.length === 0) throw new CliPayloadError("PAYLOAD_EMPTY");
  return selected;
}

export function buildCliPayload({
  archivePrefix,
  manifestPath,
  outputPath,
  repositoryRoot,
  treeish = "HEAD",
}) {
  if (
    typeof archivePrefix !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(archivePrefix)
  ) {
    throw new CliPayloadError("PAYLOAD_PREFIX_INVALID");
  }
  const manifest = readCliPayloadManifest(manifestPath);
  const sourceMembers = execFileSync("git", ["ls-tree", "-r", "--name-only", treeish], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const members = selectCliPayloadMembers(sourceMembers, manifest);
  // `git archive` with explicit paths keeps the payload byte-identical to the
  // reviewed tree; nothing is copied through a working directory.
  execFileSync(
    "git",
    [
      "archive",
      "--format=tar",
      `--prefix=${archivePrefix}/`,
      "-o",
      outputPath,
      treeish,
      "--",
      ...members,
    ],
    { cwd: repositoryRoot, maxBuffer: 256 * 1024 * 1024 },
  );

  return {
    integrity: `sha256-${createHash("sha256").update(readFileSync(outputPath)).digest("base64")}`,
    memberCount: members.length,
    members,
    outputPath: path.resolve(outputPath),
  };
}

function isDirectExecution() {
  return Boolean(
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href,
  );
}

if (isDirectExecution()) {
  const outputPath = path.resolve(process.argv[2] ?? "cli-payload.tar");
  const packageManifest = JSON.parse(readFileSync("package.json", "utf8"));
  const result = buildCliPayload({
    archivePrefix: `cravejs-web-template-${packageManifest.version}`,
    manifestPath: "distribution/cli-payload.json",
    outputPath,
    repositoryRoot: process.cwd(),
  });
  console.log(
    `CLI payload: ${result.memberCount} members, ${result.integrity}, ${result.outputPath}`,
  );
}
