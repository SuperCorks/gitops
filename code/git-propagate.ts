#!/usr/bin/env node

import { execSync } from "child_process";
import * as readline from "readline";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import {
  branchExistsLocal,
  branchExistsOnRemote,
  getNextPropagationTarget,
  isIntegrationBranch,
} from "./branch-flow";

// Argument parsing / help
yargs(hideBin(process.argv))
  .usage(
    "Usage: git propagate\n\n" +
      "From main: fast-forward propagate to staging or develop when present. From staging/develop: continue propagating downstream.\n" +
      "If there is no lower integration branch available, the current branch is interactively propagated to feature branches."
  )
  .help()
  .alias("help", "h")
  .parseSync();

// This script helps propagate changes between branches:
// 1. main -> staging -> develop (fast-forward only, skipping missing branches)
// 2. lowest available integration branch -> feature branches (with user confirmation for each branch)

async function main() {
  const currentBranch = getCurrentBranch();

  if (!isIntegrationBranch(currentBranch)) {
    console.error("❌ Error: git propagate must be run from main, staging, or develop");
    console.error(`🌿 Current branch: ${currentBranch}`);
    process.exit(1);
  }

  const targetBranch = getNextPropagationTarget(currentBranch);
  if (targetBranch) {
    await propagateIntegrationBranch(currentBranch, targetBranch);
    return;
  }

  console.log(`ℹ️  No lower integration branch detected below '${currentBranch}'. Propagating directly to feature branches.`);
  await propagateSourceToOtherBranches(currentBranch);
}

async function propagateIntegrationBranch(sourceBranch: string, targetBranch: string): Promise<void> {
  console.log(`🔄 Propagating changes from ${sourceBranch} to ${targetBranch}...`);

  console.log(`🔄 Updating ${sourceBranch} branch...`);
  updateCheckedOutBranch(sourceBranch);

  console.log(`🔄 Fetching and updating ${targetBranch} branch...`);
  ensureLocalBranchRef(targetBranch);

  console.log(`🔀 Switching to ${targetBranch} branch...`);
  execSync(`git checkout ${targetBranch}`, { stdio: "inherit" });
  updateCheckedOutBranch(targetBranch);

  console.log(`🔄 Attempting to merge ${sourceBranch} into ${targetBranch} (fast-forward only)...`);
  try {
    execSync(`git merge ${sourceBranch} --ff-only`, { stdio: "inherit" });
    console.log(`✅ Successfully merged ${sourceBranch} into ${targetBranch}!`);

    console.log(`🚀 Pushing changes to remote ${targetBranch} branch...`);
    execSync(`git push origin ${targetBranch}`, { stdio: "inherit" });
    console.log(`🎉 Successfully pushed changes to ${targetBranch}!`);
  } catch (error) {
    console.error(`❌ Error: Could not fast-forward '${targetBranch}' to '${sourceBranch}'.`);
    console.error(`⚠️  This means '${targetBranch}' has diverged from '${sourceBranch}'.`);
    console.error("💡 Please resolve any divergence before attempting to propagate.");
    process.exit(1);
  }
}

async function propagateSourceToOtherBranches(sourceBranch: string): Promise<void> {
  // Update source branch
  console.log(`🔄 Updating ${sourceBranch} branch...`);
  updateCheckedOutBranch(sourceBranch);

  // Get all branches except integration branches (and the source itself) & remote refs
  const allBranches = getAllBranches();
  const otherBranches = allBranches.filter(branch =>
    branch !== "main" &&
    branch !== "staging" &&
    branch !== "develop" &&
    branch !== sourceBranch &&
    !branch.startsWith("origin/") &&
    branch.trim() !== ""
  );

  if (otherBranches.length === 0) {
    console.log("ℹ️  No other branches found to propagate to.");
    return;
  }

  console.log(`\n📋 Found ${otherBranches.length} other branches:`);
  otherBranches.forEach(branch => console.log(`   • ${branch}`));
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  for (const branch of otherBranches) {
    const shouldMerge = await askUserConfirmation(rl, `🤔 Merge ${sourceBranch} into "${branch}"? (y/n): `);

    if (shouldMerge) {
      try {
        await mergeSourceIntoBranch(sourceBranch, branch);
        console.log(`✅ Successfully merged ${sourceBranch} into ${branch}!\n`);
      } catch (error) {
        console.error(`❌ Failed to merge ${sourceBranch} into ${branch}`);
        console.error(`⚠️  Error: ${error}`);
        console.log("");
      }
    } else {
      console.log(`⏭️  Skipped ${branch}\n`);
    }
  }

  rl.close();

  console.log("🎉 Propagation complete!");
}

async function mergeSourceIntoBranch(sourceBranch: string, branch: string): Promise<void> {
  console.log(`🔄 Processing branch: ${branch}`);

  // Fetch and update the target branch
  console.log(`   📥 Fetching ${branch}...`);
  try {
    execSync(`git fetch origin ${branch}:${branch}`, { stdio: "pipe" });
  } catch (error) {
    // Branch might not exist on remote, that's okay
    console.log(`   ℹ️  Branch ${branch} not found on remote (local only)`);
  }

  // Switch to the target branch
  console.log(`   🔀 Switching to ${branch}...`);
  execSync(`git checkout ${branch}`, { stdio: "inherit" });

  // Pull latest changes if branch exists on remote
  try {
    execSync(`git pull origin ${branch}`, { stdio: "pipe" });
    console.log(`   📥 Updated ${branch} from remote`);
  } catch (error) {
    console.log(`   ℹ️  No remote tracking for ${branch}`);
  }

  // Merge source into the branch
  console.log(`   🔄 Merging ${sourceBranch} into ${branch}...`);
  execSync(`git merge ${sourceBranch}`, { stdio: "inherit" });

  // Ask if user wants to push
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const shouldPush = await askUserConfirmation(rl, `   🚀 Push ${branch} to remote? (y/n): `);
  rl.close();

  if (shouldPush) {
    try {
      execSync(`git push origin ${branch}`, { stdio: "inherit" });
      console.log(`   ✅ Pushed ${branch} to remote`);
    } catch (error) {
      console.log(`   ⚠️  Failed to push ${branch} to remote: ${error}`);
    }
  }
}

function askUserConfirmation(rl: readline.Interface, question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
    });
  });
}

function getCurrentBranch(): string {
  return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
}

function getAllBranches(): string[] {
  const output = execSync("git branch", { encoding: "utf-8" });
  return output
    .split("\n")
    .map(line => line.replace(/^\*?\s+/, "").trim())
    .filter(line => line.length > 0);
}

function ensureLocalBranchRef(branch: string): void {
  if (branchExistsOnRemote(branch)) {
    execSync(`git fetch origin ${branch}:${branch}`, { stdio: "inherit" });
    return;
  }

  if (branchExistsLocal(branch)) {
    console.log(`ℹ️  Using local '${branch}' branch (no remote branch found).`);
    return;
  }

  console.error(`❌ Error: Could not find '${branch}' locally or on remote.`);
  process.exit(1);
}

function updateCheckedOutBranch(branch: string): void {
  if (branchExistsOnRemote(branch)) {
    execSync(`git pull origin ${branch}`, { stdio: "inherit" });
    return;
  }

  console.log(`ℹ️  Skipping pull for '${branch}' because no remote branch exists.`);
}

// Run the main function
main().catch((error) => {
  console.error("❌ An unexpected error occurred:", error);
  process.exit(1);
});
