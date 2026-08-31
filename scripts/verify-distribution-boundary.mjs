/**
 * Fail-closed check on what a release artifact actually contains.
 *
 * `.gitattributes` export-ignore already keeps internal material out of the
 * archive, but a boundary that is only configured is a boundary that silently
 * disappears when someone edits one line. This inspects the built artifact
 * instead of trusting the configuration that produced it, so the release stops
 * rather than publishing internal records, an internal hostname, or an image
 * whose rights nobody has confirmed.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

export class DistributionBoundaryError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "DistributionBoundaryError";
    this.code = code;
  }
}

/**
 * Paths the export boundary removes.
 *
 * Deliberately short. The archive is the public *source* repository, so it
 * keeps the inputs its own build, tests and governance read; excluding more
 * than this produced a published tree whose `verify` could not run. Anything
 * listed here must be read by nothing that ships, and
 * `extracted-archive-contract.test.mjs` proves that by installing the
 * extracted tree and running its full verification.
 *
 * Anchored at the repository root: an unanchored pattern matches at any depth,
 * which previously dropped `tests/distribution/` along with `distribution/`.
 */
const FORBIDDEN_PATH_PATTERNS = [
  /^output\//u,
  /^\.claude\//u,
  /^design\/figma-baseline\.json$/u,
];

/**
 * Internal infrastructure must never ship. The template takes its API origin
 * from CLI-generated configuration (`apiBaseUrl` in the storefront config
 * schema), so a hostname appearing anywhere in the artifact is a leak, not a
 * default.
 */
const FORBIDDEN_CONTENT_PATTERNS = [
  { code: "INTERNAL_DEV_HOST", pattern: /dev-api-[0-9]{6,}\.craveup\.com/u },
  { code: "CLERK_DEV_INSTANCE", pattern: /[a-z0-9-]+\.clerk\.accounts\.dev/u },
  // Production and the approved external sandbox origin are public. Other
  // development, preview, staging, internal, or guessed sandbox hosts are not.
  {
    code: "UNFINALIZED_CRAVEUP_HOST",
    pattern:
      /\b(?:(?:staging|dev|preview|internal)[a-z0-9-]*|sandbox(?!-api\.craveup\.com\b)[a-z0-9-]*)\.craveup\.com/u,
  },
];

/**
 * Everything here is an image, font or media file whose rights someone has to
 * have checked. `.svg` and `.ico` are included deliberately: they are images
 * that happen to be text or icon containers, and classifying them by their
 * encoding rather than their nature let them bypass the ownership gate --
 * which is how five Next.js and Vercel scaffold marks nearly shipped under an
 * MIT licence nobody had checked them against.
 */
const OWNERSHIP_GATED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".ico",
  ".icns",
  ".bmp",
  ".mp4",
  ".mov",
  ".webm",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
]);

/** Ownership-gated assets that are nonetheless text and must also be scanned. */
const TEXT_ENCODED_ASSET_EXTENSIONS = new Set([".svg"]);

const TEXT_SCAN_EXTENSIONS = new Set([
  ".json",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
  ".html",
  ".css",
  ".scss",
  ".sh",
  ".env",
  ".example",
  ".template",
  ".sample",
]);

/**
 * Configuration files are the most natural place to put an origin and the least
 * likely to have a scannable extension. `.env.example` reports `.example`;
 * a bare `Dockerfile` reports nothing at all. Classifying by extension alone
 * left exactly the files most likely to carry a hostname unscanned.
 */
const TEXT_SCAN_BASENAMES = new Set([
  ".env",
  ".env.example",
  ".env.local.example",
  ".env.sample",
  ".env.template",
  ".npmrc",
  ".nvmrc",
  "Dockerfile",
  "Procfile",
  "Makefile",
  "LICENSE",
  "CONTRIBUTORS",
]);

function isTextScannable(inRepository) {
  const basename = path.basename(inRepository);
  if (TEXT_SCAN_BASENAMES.has(basename)) return true;
  if (basename.startsWith(".env")) return true;
  return TEXT_SCAN_EXTENSIONS.has(path.extname(inRepository).toLowerCase());
}

function archiveEntries(artifactPath) {
  return execFileSync("tar", ["-tf", artifactPath], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Refuse names whose meaning changes across tar implementations or operating
 * systems before allowing tar to write anything to disk.
 */
export function assertSafeArchiveEntry(member) {
  if (typeof member !== "string" || member.length === 0 || member.includes("\\")) {
    throw new DistributionBoundaryError("UNSAFE_ARCHIVE_MEMBER", member);
  }
  const segments = member.split("/");
  if (
    path.posix.isAbsolute(member) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..") ||
    path.posix.normalize(member) !== member
  ) {
    throw new DistributionBoundaryError("UNSAFE_ARCHIVE_MEMBER", member);
  }
}

/**
 * Extract once, then read regular files from disk.
 *
 * `tar -xOf <archive> <member>` treats the member as a *pattern*, so a real
 * Next.js path such as `src/app/(checkout)/[locationId]/cart/page.tsx` is
 * matched as a bracket expression and never found. Every name is validated
 * before extraction so tar never receives a path whose meaning can escape or
 * change across operating systems.
 */
function createArchiveReader(artifactPath, members) {
  const extractionRoot = mkdtempSync(
    path.join(
      path.dirname(path.resolve(artifactPath)),
      ".crave-distribution-boundary-",
    ),
  );

  try {
    for (const member of members) {
      assertSafeArchiveEntry(
        member.endsWith("/") ? member.slice(0, -1) : member,
      );
    }
    execFileSync("tar", ["-xf", artifactPath, "-C", extractionRoot], {
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (error) {
    rmSync(extractionRoot, { force: true, recursive: true });
    if (error instanceof DistributionBoundaryError) throw error;
    throw new DistributionBoundaryError(
      "ARCHIVE_EXTRACTION_FAILED",
      error instanceof Error ? error.message : "unknown extraction failure",
    );
  }

  return {
    cleanup: () => rmSync(extractionRoot, { force: true, recursive: true }),
    read(member) {
      try {
        const target = path.resolve(extractionRoot, ...member.split("/"));
        const relative = path.relative(extractionRoot, target);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
          throw new DistributionBoundaryError("UNSAFE_ARCHIVE_MEMBER", member);
        }
        const metadata = lstatSync(target);
        if (!metadata.isFile()) {
          throw new DistributionBoundaryError("UNSAFE_MEMBER", member);
        }
        return readFileSync(target);
      } catch (error) {
        if (error instanceof DistributionBoundaryError) throw error;
        throw new DistributionBoundaryError("ARCHIVE_MEMBER_UNREADABLE", member);
      }
    },
  };
}

/** Strip the `name-version/` prefix `git archive` adds. */
function repositoryPath(member) {
  const separator = member.indexOf("/");
  return separator === -1 ? member : member.slice(separator + 1);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * `licensed` is a claim about someone else's work, so it only counts when it
 * says whose work and under what terms. A record naming neither is indis-
 * tinguishable from an unchecked asset, and treating it as confirmed would let
 * the word "licensed" alone carry a third-party image into an MIT repository.
 */
function confirmedAssetPaths(ownershipLedger) {
  const ledger = JSON.parse(ownershipLedger);
  const confirmed = new Map();
  const unconfirmed = [];
  const incomplete = new Map();
  for (const asset of ledger.assets ?? []) {
    if (asset.status === "crave-owned") {
      confirmed.set(asset.path, asset.sha256);
      continue;
    }
    if (asset.status === "licensed") {
      const missing = [];
      if (!nonEmpty(asset.source)) missing.push("source");
      if (!nonEmpty(asset.license)) missing.push("license");
      if (missing.length === 0) {
        confirmed.set(asset.path, asset.sha256);
      } else {
        incomplete.set(asset.path, missing.join(" and "));
      }
      continue;
    }
    unconfirmed.push(asset.path);
  }
  return { confirmed, incomplete, unconfirmed };
}

export function verifyDistributionBoundary(artifactPath, ownershipLedgerPath) {
  const entries = archiveEntries(artifactPath);
  const members = entries.filter((entry) => !entry.endsWith("/"));
  if (members.length === 0) throw new DistributionBoundaryError("EMPTY_ARTIFACT");

  for (const member of members) {
    assertSafeArchiveEntry(member);
    const inRepository = repositoryPath(member);
    for (const pattern of FORBIDDEN_PATH_PATTERNS) {
      if (pattern.test(inRepository)) {
        throw new DistributionBoundaryError("INTERNAL_PATH", inRepository);
      }
    }
  }

  const { confirmed, incomplete, unconfirmed } = confirmedAssetPaths(
    readFileSync(ownershipLedgerPath, "utf8"),
  );
  const archive = createArchiveReader(artifactPath, entries);

  try {
    for (const member of members) {
      const inRepository = repositoryPath(member);
      const extension = path.extname(inRepository).toLowerCase();
      if (OWNERSHIP_GATED_EXTENSIONS.has(extension)) {
        if (!confirmed.has(inRepository)) {
          if (incomplete.has(inRepository)) {
            throw new DistributionBoundaryError(
              "ASSET_LICENSE_INCOMPLETE",
              `${inRepository} is recorded as licensed without ${incomplete.get(inRepository)}`,
            );
          }
          throw new DistributionBoundaryError(
            unconfirmed.includes(inRepository)
              ? "ASSET_OWNERSHIP_UNCONFIRMED"
              : "ASSET_OWNERSHIP_UNRECORDED",
            inRepository,
          );
        }
        // Approval names a file *and* its bytes. Without the digest, replacing
        // an approved image with any other image inherits its approval.
        const approvedDigest = confirmed.get(inRepository);
        const actualDigest = createHash("sha256")
          .update(archive.read(member))
          .digest("hex");
        if (approvedDigest !== actualDigest) {
          throw new DistributionBoundaryError(
            "ASSET_DIGEST_MISMATCH",
            `${inRepository} is approved for ${approvedDigest ?? "no digest"} but carries ${actualDigest}`,
          );
        }
        // An SVG is markup: passing the ownership gate must not exempt it from
        // the content scan, or a hostname inside one ships unexamined.
        if (!TEXT_ENCODED_ASSET_EXTENSIONS.has(extension)) continue;
      } else if (!isTextScannable(inRepository)) {
        continue;
      }
      const contents = archive.read(member).toString("utf8");
      for (const { code, pattern } of FORBIDDEN_CONTENT_PATTERNS) {
        if (pattern.test(contents)) {
          throw new DistributionBoundaryError(code, inRepository);
        }
      }
    }
    return { members: members.length };
  } finally {
    archive.cleanup();
  }
}
