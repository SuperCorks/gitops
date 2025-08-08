#!/usr/bin/env node

import { execSync } from "child_process";

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

function shouldPush(argv: string[]): boolean {
  return !argv.includes("--no-push") && !argv.includes("-np");
}

function main() {
  const branch = getCurrentBranch();
  if (isProtectedBranch(branch)) {
    console.error("❌ Error: git wip cannot be run on 'main' or 'develop'.");
    console.error(`🌿 Current branch: ${branch}`);
    process.exit(1);
  }

  console.log("💾 Saving WIP on branch:", branch);

  try {
    console.log("➕ Adding changes (git add .)...");
    execSync("git add .", { stdio: "inherit" });

    console.log('📝 Committing (git commit -m "wip")...');
    execSync('git commit -m "wip"', { stdio: "pipe" });
  } catch (error: any) {
    // If commit fails (e.g., nothing to commit), exit gracefully
    const message = String(error?.stdout || error?.stderr || error?.message || error || "");
    if (message.includes("nothing to commit") || message.includes("no changes added to commit")) {
      console.log("ℹ️  Nothing to commit. Skipping push.");
      process.exit(0);
    }
    console.error("❌ Error during WIP commit:", message || error);
    process.exit(1);
  }

  if (shouldPush(process.argv.slice(2))) {
    try {
      console.log("🚀 Pushing branch to remote (git push)...");
      execSync("git push", { stdio: "inherit" });
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
