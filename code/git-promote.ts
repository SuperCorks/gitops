#!/usr/bin/env node

import { execSync } from "child_process";

// This script helps promote changes from develop to main branch using --ff-only.
// It ensures that main can only be updated if it can be fast-forwarded to develop's position,
// preventing any unintended merge conflicts or history rewrites.

// Get current branch and verify we're on develop
const currentBranch = getCurrentBranch();
if (currentBranch !== "develop") {
  console.error("❌ Error: git promote must be run from develop branch");
  console.error(`🌿 Current branch: ${currentBranch}`);
  process.exit(1);
}

// First update both branches to ensure we have the latest changes
console.log("🔄 Updating develop and main branches...");
updateDevelop();
execSync("git fetch origin main:main", { stdio: "inherit" });

// Ensure develop is up-to-date with main
console.log("🔍 Ensuring develop is up-to-date with main...");
try {
  execSync("git merge main --ff-only", { stdio: "inherit" });
} catch (error) {
  console.error("❌ Error: Could not fast-forward develop to main.");
  console.error("⚠️  This means develop has diverged from main.");
  console.error("💡 Please resolve any divergence before attempting to promote.");
  process.exit(1);
}

// Switch to main
console.log("🔀 Switching to main branch...");
execSync("git checkout main", { stdio: "inherit" });
execSync("git pull origin main", { stdio: "inherit" });

// Attempt to merge develop into main with --ff-only
console.log("🔄 Attempting to merge develop into main...");
try {
  execSync("git merge develop --ff-only", { stdio: "inherit" });
  console.log("✅  Successfully merged develop into main!");

  // Push changes to remote main branch
  console.log("🚀 Pushing changes to remote main branch...");
  execSync("git push origin main", { stdio: "inherit" });
  console.log("🎉 Successfully pushed changes to main!");
} catch (error) {
  console.error("❌ Error: Could not fast-forward main to develop.");
  console.error("⚠️  This usually means that main has diverged from develop.");
  console.error("💡 Please resolve any divergence before attempting to promote.");
  process.exit(1);
}

// Function definitions
// --------------------

function getCurrentBranch(): string {
  return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
}

function updateDevelop(): void {
  execSync("git pull origin develop", { stdio: "inherit" });
}
