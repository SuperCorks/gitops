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

// Resolve target base branch (prefer develop, fall back to main), update it, and switch
const targetBase = resolveTargetBaseBranch();
console.log(`🔄 Updating '${targetBase}' branch...`);
updateBranch(targetBase);

console.log(`🔀 Switching to '${targetBase}' branch...`);
execSync(`git checkout ${targetBase}`, { stdio: "inherit" });

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

function branchExistsLocally(branch: string): boolean {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${branch}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function branchExistsOnRemote(branch: string): boolean {
  try {
    const out = execSync(`git ls-remote --heads origin ${branch}`, { encoding: "utf-8", stdio: "pipe" }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

function resolveTargetBaseBranch(): string {
  // Prefer 'develop' if it exists locally or on remote; otherwise use 'main'
  if (branchExistsLocally("develop") || branchExistsOnRemote("develop")) {
    return "develop";
  }
  return "main";
}

function updateBranch(branch: string): void {
  try {
    execSync(`git fetch origin ${branch}:${branch}`, { stdio: "inherit" });
  } catch (error) {
    console.error(`❌ Error updating '${branch}' branch:`, error);
    console.error("💡 Make sure the branch exists and you have the correct permissions, then try again");
    process.exit(1);
  }
}
