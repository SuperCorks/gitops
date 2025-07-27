#!/usr/bin/env node

import { execSync } from "child_process";

// This script helps streamline the workflow after a feature branch has been merged.
// It verifies the current branch has been properly deleted on the remote ([gone]),
// updates the develop branch, switches to it, and cleans up stale branches.
// This ensures a clean transition back to develop after successful feature merges.

// Get current branch and verify we can proceed
const currentBranch = getCurrentBranch();
if (isProtectedBranch(currentBranch)) {
  console.error("❌ Error: Cannot run git done from main or develop branch");
  process.exit(1);
}

// Check if branch is properly deleted on remote
console.log(`🔍 Checking if branch '${currentBranch}' has been deleted on remote...`);
if (!isBranchDeletedOnRemote(currentBranch)) {
  console.error(`❌ Error: Branch '${currentBranch}' still exists on remote`);
  console.error(
    "💡 Please make sure your branch has been merged and deleted on remote before running git done",
  );
  process.exit(1);
}

// Update and switch to develop
console.log("🔄 Updating develop branch...");
updateDevelop();

console.log("🔀 Switching to develop branch...");
execSync("git checkout develop", { stdio: "inherit" });

// Clean up stale branches
console.log("🧹 Running cleanup...");
execSync("git cleanup", { stdio: "inherit" });

console.log(
  "🎉 All done! Your feature branch has been cleaned up and you are now on an up-to-date develop branch.",
);

// Function definitions
// --------------------

function getCurrentBranch(): string {
  return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
}

function isProtectedBranch(branch: string): boolean {
  const protectedBranches = ["main", "develop"];
  return protectedBranches.includes(branch);
}

function isBranchDeletedOnRemote(branch: string): boolean {
  try {
    // Fetch latest remote information
    execSync("git fetch --all --prune", { stdio: "inherit" });

    // Get branch tracking info
    const branchInfo = execSync("git branch -vv", { encoding: "utf-8" })
      .split("\n")
      .find(
        (line) => line.trim().startsWith(branch === getCurrentBranch() ? "*" : " ") && line.includes(branch),
      );

    if (!branchInfo) {
      console.error(`❌ Could not find tracking information for branch '${branch}'`);
      process.exit(1);
    }

    return branchInfo.includes("[") && branchInfo.includes("gone]");
  } catch (error) {
    console.error("❌ Error checking remote branch:", error);
    process.exit(1);
  }
}

function updateDevelop(): void {
  try {
    execSync("git fetch origin develop:develop", { stdio: "inherit" });
  } catch (error) {
    console.error("❌ Error updating develop branch:", error);
    console.error("💡 Make sure you have the correct permissions and try again");
    process.exit(1);
  }
}
