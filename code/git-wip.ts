#!/usr/bin/env node

import { execSync } from "child_process";
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
const argv = yargs(hideBin(process.argv))
  .usage(
    "Usage: git wip [options] [commit message]\n\n" +
      "Examples:\n" +
      "  git wip\n" +
      "  git wip 'WIP: refactor auth flow'\n" +
      "  git wip --no-push 'temp: debug android build'\n\n" +
      "Creates a quick WIP commit (git add .; git commit -m <message>) and optionally pushes.\n" +
      "Skipped on protected branches main/develop. Default commit message is 'wip'."
  )
  .option("no-push", {
    alias: "np",
    type: "boolean",
    description: "Skip pushing after creating the WIP commit",
    default: false,
  })
  .help()
  .alias("help", "h")
  .parseSync();

function shouldPush(): boolean {
  return !argv["no-push"];
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

  // Build commit message from remaining positional args. Join so multiple words become one message.
  const commitMessageRaw = argv._.length ? argv._.join(" ") : "wip";
  // Safely single-quote for shell (replace ' with '\'' pattern)
  const commitMessageEscaped = commitMessageRaw.replace(/'/g, "'\\''");

  try {
    console.log("➕ Adding changes (git add .)...");
    execSync("git add .", { stdio: "inherit" });

    console.log(`📝 Committing (git commit -m '${commitMessageRaw}')...`);
    try {
      execSync(`git commit -m '${commitMessageEscaped}'`, { stdio: "inherit" });
    } catch (error: any) {
      // Handle expected non-zero exit (e.g. pre-commit hook failure) without noisy stack
      const status = error?.status ?? 1;
      const combined = String(error?.stdout || error?.stderr || "").trim();
      if (combined.includes("nothing to commit") || combined.includes("no changes added to commit")) {
        console.log("ℹ️  Nothing to commit. Skipping push.");
        process.exit(0);
      }
      console.error("❌ git commit failed (hook or validation). Output above.");
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
