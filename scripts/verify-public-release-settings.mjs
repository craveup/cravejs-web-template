import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

const canonicalRepository = "craveup/cravejs-web-template";
const publicReleaseEnvironment = "public-release";
const apiVersion = "2026-03-10";

class PublicReleaseSettingsError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function requireSetting(condition, code) {
  if (!condition) throw new PublicReleaseSettingsError(code);
}

export function validatePublicReleaseSettings({
  environment,
  immutableReleases,
  repository,
}) {
  requireSetting(repository?.full_name === canonicalRepository, "REPOSITORY");
  requireSetting(
    repository?.visibility === "public" && repository?.private === false,
    "VISIBILITY",
  );
  requireSetting(immutableReleases?.enabled === true, "IMMUTABLE_RELEASES");
  requireSetting(environment?.name === publicReleaseEnvironment, "ENVIRONMENT");
  requireSetting(environment?.can_admins_bypass === false, "ADMIN_BYPASS");
  requireSetting(
    environment?.deployment_branch_policy?.protected_branches === true,
    "PROTECTED_BRANCHES",
  );

  const reviewerRule = environment?.protection_rules?.find(
    (rule) => rule?.type === "required_reviewers",
  );
  requireSetting(
    reviewerRule?.prevent_self_review === true &&
      Array.isArray(reviewerRule.reviewers) &&
      reviewerRule.reviewers.length > 0,
    "REQUIRED_REVIEWERS",
  );
}

function readRepositorySetting(endpoint) {
  return JSON.parse(
    execFileSync(
      "gh",
      [
        "api",
        "-H",
        `X-GitHub-Api-Version: ${apiVersion}`,
        endpoint,
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ),
  );
}

export function verifyPublicReleaseSettings() {
  requireSetting(process.env.GITHUB_REPOSITORY === canonicalRepository, "REPOSITORY");
  requireSetting(Boolean(process.env.GH_TOKEN), "TOKEN");
  validatePublicReleaseSettings({
    repository: readRepositorySetting(`repos/${canonicalRepository}`),
    environment: readRepositorySetting(
      `repos/${canonicalRepository}/environments/${publicReleaseEnvironment}`,
    ),
    immutableReleases: readRepositorySetting(
      `repos/${canonicalRepository}/immutable-releases`,
    ),
  });
}

function isDirectExecution() {
  if (typeof process.argv[1] !== "string") return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  try {
    verifyPublicReleaseSettings();
    process.stdout.write("Public release settings are valid.\n");
  } catch (error) {
    const code =
      error instanceof PublicReleaseSettingsError
        ? error.code
        : "PUBLIC_RELEASE_SETTINGS";
    process.stderr.write(`Public release settings failed: ${code}\n`);
    process.exitCode = 1;
  }
}
