#!/usr/bin/env node

import { execSync } from "child_process";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

// Argument parsing / help
yargs(hideBin(process.argv))
  .usage(
    "Usage: git cleanup\n\n" +
      "Remove local branches that have been deleted on the remote (marked as [gone])."
  )
  .help()
  .alias("help", "h")
  .parseSync();

// This script helps maintain a clean git repository by removing local branches
// that have been deleted on the remote. It fetches the latest remote information,
// identifies branches marked as [gone], and safely removes them.

// Always fetch and prune first to ensure [gone] status is accurate
try {
  console.log("Fetching and pruning remote branches...");
  execSync("git fetch --prune", { stdio: "inherit" });
} catch (error) {
  console.error("Error during fetch and prune:", error);
  process.exit(1);
}

// Run the cleanup process using fresh remote info
const branchOutput = execSync("git branch -vv", { encoding: "utf-8" });
const goneBranches = findGoneBranches(branchOutput);

if (goneBranches.length === 0) {
  console.log("No stale branches found to clean up.");
  process.exit(0);
}

console.log(`Found ${goneBranches.length} stale branches to remove:`);
goneBranches.forEach((branch) => console.log(`  - ${branch}`));

// Delete each branch
deleteBranches(goneBranches);
console.log("Cleanup complete!");

// Function definitions
// --------------------

function findGoneBranches(branchOutput: string): string[] {
  return branchOutput
    .split("\n")
    .filter((line) => line.includes("[") && line.includes("gone]"))
    .map((line) => {
      // Handle both current branch (*) and regular branch formats
      const match = line.trim().match(/^[*]?\s*(\S+)/);
      return match ? match[1] : null;
    })
    .filter(Boolean) as string[];
}

function deleteBranches(branches: string[]): void {
  // Delete branches
  branches.forEach((branch) => {
    try {
      execSync(`git branch -D ${branch}`, { stdio: "inherit" });
    } catch (error) {
      console.error(`Failed to delete branch ${branch}:`, error);
    }
  });
}
