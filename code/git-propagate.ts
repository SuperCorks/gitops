#!/usr/bin/env node

import { execSync } from "child_process";
import * as readline from "readline";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

// Argument parsing / help
yargs(hideBin(process.argv))
  .usage(
    "Usage: git propagate\n\n" +
      "From main: fast-forward propagate to develop. From develop: interactively merge into other branches.\n" +
      "If no 'develop' branch exists (locally or remote), running on main will interactively propagate main to feature branches."
  )
  .help()
  .alias("help", "h")
  .parseSync();

// This script helps propagate changes between branches:
// 1. From main -> develop (fast-forward only)
// 2. From develop -> other branches (with user confirmation for each branch)

async function main() {
  const currentBranch = getCurrentBranch();
  
  if (currentBranch === "main") {
    const hasDevelopLocal = branchExistsLocal("develop");
    const hasDevelopRemote = branchExistsOnRemote("develop");
    if (!hasDevelopLocal && !hasDevelopRemote) {
      console.log("ℹ️  No 'develop' branch detected locally or on remote. Propagating from 'main' directly to feature branches.");
      await propagateSourceToOtherBranches("main");
    } else {
      await propagateMainToDevelop();
    }
  } else if (currentBranch === "develop") {
    await propagateDevelopToOtherBranches();
  } else {
    console.error("❌ Error: git propagate must be run from either main or develop branch");
    console.error(`🌿 Current branch: ${currentBranch}`);
    process.exit(1);
  }
}

async function propagateMainToDevelop(): Promise<void> {
  console.log("🔄 Propagating changes from main to develop...");
  
  // Update main branch
  console.log("🔄 Updating main branch...");
  execSync("git pull origin main", { stdio: "inherit" });
  
  // Fetch and update develop
  console.log("🔄 Fetching and updating develop branch...");
  execSync("git fetch origin develop:develop", { stdio: "inherit" });
  
  // Switch to develop
  console.log("🔀 Switching to develop branch...");
  execSync("git checkout develop", { stdio: "inherit" });
  execSync("git pull origin develop", { stdio: "inherit" });
  
  // Attempt to merge main into develop with --ff-only
  console.log("🔄 Attempting to merge main into develop (fast-forward only)...");
  try {
    execSync("git merge main --ff-only", { stdio: "inherit" });
    console.log("✅ Successfully merged main into develop!");
    
    // Push changes to remote develop branch
    console.log("🚀 Pushing changes to remote develop branch...");
    execSync("git push origin develop", { stdio: "inherit" });
    console.log("🎉 Successfully pushed changes to develop!");
  } catch (error) {
    console.error("❌ Error: Could not fast-forward develop to main.");
    console.error("⚠️  This means develop has diverged from main.");
    console.error("💡 Please resolve any divergence before attempting to propagate.");
    process.exit(1);
  }
}

async function propagateDevelopToOtherBranches(): Promise<void> {
  console.log("🔄 Propagating changes from develop to other branches...");
  await propagateSourceToOtherBranches("develop");
}

async function propagateSourceToOtherBranches(sourceBranch: string): Promise<void> {
  // Update source branch
  console.log(`🔄 Updating ${sourceBranch} branch...`);
  execSync(`git pull origin ${sourceBranch}`, { stdio: "inherit" });

  // Get all branches except main and develop (and the source itself) & remote refs
  const allBranches = getAllBranches();
  const otherBranches = allBranches.filter(branch =>
    branch !== "main" &&
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

function branchExistsOnRemote(branch: string): boolean {
  try {
    const out = execSync(`git ls-remote --heads origin ${branch}`, { encoding: "utf-8", stdio: "pipe" }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

function branchExistsLocal(branch: string): boolean {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${branch}`);
    return true;
  } catch {
    return false;
  }
}

// Run the main function
main().catch((error) => {
  console.error("❌ An unexpected error occurred:", error);
  process.exit(1);
});
