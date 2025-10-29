#!/usr/bin/env node

import { execSync, spawnSync } from "child_process";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// This script saves a quick Work-In-Progress snapshot on the current branch.
// It will:
//   1) git add .
//   2) git commit -m "wip"
//   3) git push (unless --no-push or -np is passed)
// It fails if run on protected branches: main or develop.

function getCurrentBranch(): string {
  return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
}

function isProtectedBranch(branch: string): boolean {
  return branch === "main" || branch === "develop";
}

// yargs parsing for flags + optional commit message positional args
// New behavior:
//  * Default does NOT skip CI. To skip, use: --skip ci
//  * To skip hooks, use: --skip hooks (equivalent to --no-verify)
//  * Combine: --skip hooks ci (order doesn't matter)
//  * Message is any remaining positional args
// Back-compat conveniences:
//  * "-nh"        -> --skip=hooks (historical shorthand for no hooks)
//  * "--no-verify" still supported and maps to skip hooks
const normalizedArgv = hideBin(process.argv).map((a) => {
  if (a === "-nh") return "--skip=hooks";
  return a;
});
const argv = yargs(normalizedArgv)
  .usage(
    "Usage: git wip [options] [commit message]\n\n" +
      "Examples:\n" +
      "  git wip\n" +
      "  git wip --skip ci\n" +
      "  git wip --skip hooks ci\n" +
      "  git wip --skip hooks ci \"message\"\n" +
      "  git wip commit message\n\n" +
      "Creates a quick WIP commit (git add .; git commit -m <message>) and optionally pushes (default on).\n" +
      "Use --no-push to skip pushing. Default commit message is 'wip'.\n" +
      "Use --skip ci to append [skip ci]. Use --skip hooks to pass --no-verify to git commit."
  )
  .option("push", {
    type: "boolean",
    default: true,
    description: "Push after committing (disable with --no-push)",
  })
  .option("skip", {
    type: "array",
    string: true as any,
    description: "Skip certain steps: one or more of: hooks, ci",
  })
  .option("verify", {
    type: "boolean",
    default: true,
    description: "Run git hooks (legacy: --no-verify is equivalent to --skip hooks)",
  })
  .help()
  .alias("help", "h")
  .parseSync() as unknown as {
    _: (string | number)[];
    push: boolean;
    skip?: (string | number)[];
    verify: boolean;
  };

  
function shouldPush(): boolean {
  // With positive "push" option, --no-push sets argv.push === false (standard yargs behavior)
  return Boolean((argv as any).push);
}

function hasUpstream(): boolean {
  try {
    // This throws if no upstream is set
    execSync("git rev-parse --abbrev-ref --symbolic-full-name @{u}", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function getDefaultRemote(): string | null {
  try {
    const remotes = execSync("git remote", { encoding: "utf-8" })
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
    if (remotes.includes("origin")) return "origin";
    return remotes[0] ?? null;
  } catch {
    return null;
  }
}

function main() {
  const branch = getCurrentBranch();
  if (isProtectedBranch(branch)) {
    console.error("❌ Error: git wip cannot be run on 'main' or 'develop'.");
    console.error(`🌿 Current branch: ${branch}`);
    process.exit(1);
  }

  console.log("💾 Saving WIP on branch:", branch);

  // Determine skip settings
  const skipVals = new Set((argv.skip ?? []).map((v) => String(v).toLowerCase()));
  const skipHooks = skipVals.has("hooks") || (argv as any).verify === false; // support --no-verify
  const skipCi = skipVals.has("ci");

  // Build commit message from remaining positional args. Join so multiple words become one message.
  const commitMessageRaw = argv._.length ? String(argv._.join(" ")) : "wip";
  const commitMessage = skipCi ? `${commitMessageRaw}\n[skip ci]` : commitMessageRaw;
  // Use spawnSync with arg array instead of shell quoting for cross-platform safety (Windows CMD needs double quotes).

  try {
    console.log("➕ Adding changes (git add .)...");
    execSync("git add .", { stdio: "inherit" });

    const commitArgs = ["commit", "-m", commitMessage];
    if (skipHooks) commitArgs.push("--no-verify");
    console.log(
      `📝 Committing (git ${commitArgs.join(" ")}${skipCi ? " (with [skip ci])" : ""})...`
    );
    try {
      const commitResult = spawnSync("git", commitArgs, { stdio: "inherit" });
      if (commitResult.status !== 0) {
        const status = commitResult.status ?? 1;
        // We can't easily capture output with inherit, so run a lightweight status check for no-op commit.
        try {
          const dry = execSync("git diff --cached --name-status", { encoding: "utf-8" }).trim();
          if (!dry) {
            console.log("ℹ️  Nothing to commit. Skipping push.");
            process.exit(0);
          }
        } catch {/* ignore */}
        console.error("❌ git commit failed (hook or validation). Output above.");
        process.exit(status);
      }
    } catch (error: any) {
      const status = error?.status ?? 1;
      console.error("❌ git commit execution error.");
      process.exit(status);
    }
  } catch (error: any) {
    // This outer catch would only be reached for add . failing
    const message = String(error?.message || error || "");
    console.error("❌ Error while staging changes:", message);
    process.exit(1);
  }

  if (shouldPush()) {
    try {
      if (hasUpstream()) {
        console.log("🚀 Pushing branch to remote (git push)...");
        execSync("git push", { stdio: "inherit" });
      } else {
        const remote = getDefaultRemote();
        if (!remote) {
          console.log("ℹ️  No git remotes configured. Skipping push.");
        } else {
          console.log(`🚀 First push; setting upstream (git push -u ${remote} ${branch})...`);
          execSync(`git push -u ${remote} ${branch}`, { stdio: "inherit" });
        }
      }
    } catch (error) {
      console.error("⚠️  Push failed:", error);
      process.exit(1);
    }
  } else {
    console.log("⏭️  Skipping push due to --no-push/-np flag.");
  }

  console.log("🎉 WIP saved.");
}

main();
