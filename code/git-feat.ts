#!/usr/bin/env node

import { execSync } from "child_process";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import * as readline from "readline";

// git feat
// Create a feature branch from develop or main using a semantic branch name: <type>/<slug>
// Examples:
//   git feat my new awesome feature           => feat/my-new-awesome-feature
//   git feat ci: update github workflow       => ci/update-github-workflow
//
// Behavior:
// - Must be run from develop or main
// - Checks if current branch is up to date with origin; if not, prompts to update (Y/n)
// - Creates a new local branch without pushing
// - Errors if unsupported type prefix is provided

const SUPPORTED_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
] as const;
type CommitType = typeof SUPPORTED_TYPES[number];

const argv = yargs(hideBin(process.argv))
  .usage(
    "Usage: git feat <semantic message>\n\n" +
      "Create a feature branch from develop or main using semantic naming.\n" +
      "Examples:\n" +
      "  git feat my new awesome feature     -> feat/my-new-awesome-feature\n" +
      "  git feat ci: update workflows       -> ci/update-workflows\n" +
      "\n" +
      "Supported types: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert\n" +
      "Type can be overridden with a '<type>: ' prefix. Default type is 'feat'."
  )
  .help()
  .alias("help", "h")
  .parseSync();

function getCurrentBranch(): string {
  return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
}

function ensureAllowedBase(branch: string) {
  if (branch !== "develop" && branch !== "main") {
    console.error("❌ Error: git feat must be run from 'develop' or 'main'.");
    console.error(`🌿 Current branch: ${branch}`);
    process.exit(1);
  }
}

function fetchOrigin(): void {
  try {
    execSync("git fetch --prune", { stdio: "pipe" });
  } catch {/* ignore */}
}

function aheadBehind(branch: string): { behind: number; ahead: number } {
  try {
    // left: origin/branch (behind count); right: branch (ahead count)
    const out = execSync(
      `git rev-list --left-right --count origin/${branch}...${branch}`,
      { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
    ).trim();
    const [behindStr, aheadStr] = out.split(/\s+/);
    const behind = parseInt(behindStr || "0", 10) || 0;
    const ahead = parseInt(aheadStr || "0", 10) || 0;
    return { behind, ahead };
  } catch {
    // If no upstream, treat as not behind and not ahead (new repo scenario)
    return { behind: 0, ahead: 0 };
  }
}

async function promptYesNo(message: string, defaultYes = true): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, (answerRaw) => {
      const answer = answerRaw.trim();
      rl.close();
      if (!answer) return resolve(defaultYes);
      if (/^y(es)?$/i.test(answer)) return resolve(true);
      if (/^n(o)?$/i.test(answer)) return resolve(false);
      resolve(defaultYes);
    });
  });
}

function tryFastForwardPull(branch: string): void {
  try {
    execSync("git pull --ff-only", { stdio: "inherit" });
  } catch (e) {
    console.error("❌ Could not fast-forward. Your branch may have diverged.");
    console.error("💡 Resolve divergence (rebase or merge) and rerun git feat.");
    process.exit(1);
  }
}

function branchExistsLocal(name: string): boolean {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${name}`);
    return true;
  } catch { return false; }
}

function branchExistsRemote(name: string): boolean {
  try {
    const out = execSync(`git ls-remote --heads origin ${name}`, { encoding: "utf-8", stdio: "pipe" }).trim();
    return out.length > 0;
  } catch { return false; }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[._]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function parseTypeAndSubject(raw: string): { type: CommitType; subject: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    console.error("❌ Error: You must provide a semantic message for the branch name.");
    console.error("   Example: git feat my new awesome feature");
    process.exit(1);
  }

  const m = /^([a-zA-Z]+):\s*(.+)$/.exec(trimmed);
  if (m) {
    const maybeType = m[1].toLowerCase();
    const rest = m[2].trim();
    if ((SUPPORTED_TYPES as readonly string[]).includes(maybeType)) {
      return { type: maybeType as CommitType, subject: rest };
    } else {
      console.error(
        `❌ Error: Unsupported type '${maybeType}'.\nSupported types: ${SUPPORTED_TYPES.join("|")}`
      );
      process.exit(1);
    }
  }
  return { type: "feat", subject: trimmed };
}

function createBranch(name: string): void {
  try {
    execSync(`git checkout -b ${name}`, { stdio: "inherit" });
  } catch (e) {
    console.error("❌ Failed to create branch. See output above.");
    process.exit(1);
  }
}

async function main() {
  const base = getCurrentBranch();
  ensureAllowedBase(base);

  fetchOrigin();
  const { behind, ahead } = aheadBehind(base);
  if (behind > 0 || ahead > 0) {
    const details = `(behind ${behind}, ahead ${ahead})`;
    const shouldUpdate = await promptYesNo(
      `🔄 Current branch '${base}' is not up to date with origin ${details}. Update before creating the branch? (Y/n) `,
      true
    );
    if (shouldUpdate) {
      tryFastForwardPull(base);
    }
  }

  const message = argv._.join(" ").trim();
  const { type, subject } = parseTypeAndSubject(message);
  const slug = slugify(subject);
  if (!slug) {
    console.error("❌ Error: The provided subject produced an empty slug. Please use alphanumeric characters.");
    process.exit(1);
  }
  const newBranch = `${type}/${slug}`;

  if (branchExistsLocal(newBranch)) {
    console.error(`❌ Error: Local branch '${newBranch}' already exists.`);
    process.exit(1);
  }
  if (branchExistsRemote(newBranch)) {
    console.error(`❌ Error: Remote branch 'origin/${newBranch}' already exists.`);
    console.error("💡 Consider: git fetch && git checkout <branch> or choose a different name.");
    process.exit(1);
  }

  console.log(`🌿 Creating branch: ${newBranch}`);
  createBranch(newBranch);

  console.log("\n✅ Done. You're now on:", newBranch);
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
