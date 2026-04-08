#!/usr/bin/env node

import { execSync } from "child_process";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import {
  branchExistsLocal,
  branchExistsOnRemote,
  getFeaturePromotionTarget,
  getNextPromotionTarget,
  isFeatureBranch,
} from "./branch-flow";

// git promote now has two modes:
// 1. From a feature branch -> nearest available integration branch (develop, staging, or main)
// 2. From develop/staging -> next integration branch in the chain (fast-forward only)

// --- Argument Parsing (yargs) ---
// Usage patterns:
//   git promote                   (from develop/staging -> next integration branch)
//   git promote "feat: add X"     (from feature -> develop/staging/main, squash commit message)
//   git promote -m "feat: add X"  (alternative flag style on feature branch)
const argv = yargs(hideBin(process.argv))
  .usage(
    "Usage:\n" +
      "  git promote               # From develop/staging: fast-forward the next branch\n" +
      "  git promote <message>     # From feature: squash merge into develop, staging, or main\n" +
      "  git promote -m <message>  # Alternate flag for message in feature mode\n\n" +
      "Promote changes between branches. Feature branches are squash merged into the nearest available integration branch; develop promotes to staging when present, otherwise main; staging promotes to main."
  )
  .option("message", {
    alias: "m",
    type: "string",
    description: "Commit message for squash merge when promoting a feature branch",
  })
  .help()
  .alias("help", "h")
  .parseSync();

const currentBranch = getCurrentBranch();
const commitMessageArg = (argv.message || argv._.join(" ")).trim();

if (currentBranch === "main") {
  console.error("❌ Error: git promote cannot be run from main branch directly");
  console.error("💡 Run from develop or staging to fast-forward the next branch, or from a feature branch to squash into the nearest integration branch.");
  process.exit(1);
} else if (isFeatureBranch(currentBranch)) {
  promoteFeatureToBranch(currentBranch, getFeaturePromotionTarget(currentBranch), commitMessageArg);
} else {
  const targetBranch = getNextPromotionTarget(currentBranch);
  if (!targetBranch) {
    console.error(`❌ Error: git promote does not support promoting from '${currentBranch}'.`);
    process.exit(1);
  }

  promoteBranchForward(currentBranch, targetBranch);
}

// --------------------
// Feature -> Integration Branch
// --------------------
function promoteFeatureToBranch(featureBranch: string, targetBranch: string, commitMessage: string): void {
  console.log(`🚀 Promoting feature branch '${featureBranch}' to ${targetBranch} (squash merge)...`);

  if (!commitMessage) {
    console.error("❌ Error: Commit message is required when promoting a feature branch.");
    console.error('💡 Usage: git promote "feat: add amazing thing"');
    process.exit(1);
  }

  ensureCleanWorkingTree();

  ensureLocalBranchRef(targetBranch);

  console.log(`🔍 Checking that ${targetBranch} is contained in feature branch...`);
  if (!isAncestor(targetBranch, featureBranch)) {
    console.warn(`⚠️  Warning: ${targetBranch} has commits not present in your feature branch.`);
    console.warn("💡 Proceeding with squash merge; if conflicts arise, resolve them and commit manually.");
  }

  console.log(`🔀 Switching to ${targetBranch} branch...`);
  execSync(`git checkout ${targetBranch}`, { stdio: "inherit" });
  updateCheckedOutBranch(targetBranch);

  console.log(`🔄 Squash merging '${featureBranch}' into ${targetBranch}...`);
  try {
    execSync(`git merge ${featureBranch} --no-commit --squash`, { stdio: "inherit" });
  } catch (error) {
    console.error("❌ Error: Squash merge failed.");
    console.error("💡 Resolve any conflicts, then run the same git merge command manually and commit.");
    process.exit(1);
  }

  // Commit
  console.log("📝 Creating squash commit...");
  try {
    execSync(`git commit -m "${escapeForShell(commitMessage)}"`, { stdio: "inherit" });
  } catch (error: any) {
    const status = error?.status ?? 1;
    console.error("❌ git commit failed (likely pre-commit hook). Output above.");
    console.error(`💡 Fix the issue and run: git commit -m "${commitMessage}" then push ${targetBranch} manually.`);
    process.exit(status);
  }

  console.log(`🚀 Pushing ${targetBranch} to remote...`);
  execSync(`git push origin ${targetBranch}`, { stdio: "inherit" });

  // Delete feature branch locally
  console.log(`🗑️  Deleting local branch '${featureBranch}'...`);
  try {
    execSync(`git branch -D ${featureBranch}`, { stdio: "inherit" });
  } catch (error) {
    console.error(`⚠️  Warning: Could not delete local branch '${featureBranch}': ${error}`);
  }

  // Delete remote branch if exists
  console.log(`🗑️  Attempting to delete remote branch '${featureBranch}' (if it exists)...`);
  try {
    const existsRemote = branchExistsOnRemote(featureBranch);
    if (existsRemote) {
      execSync(`git push --delete origin ${featureBranch}`, { stdio: "inherit" });
      console.log("✅ Remote branch deleted.");
    } else {
      console.log("ℹ️  Remote branch not found (nothing to delete).");
    }
  } catch (error) {
    console.error(`⚠️  Warning: Could not delete remote branch '${featureBranch}': ${error}`);
  }

  console.log(`🎉 Feature branch successfully promoted to ${targetBranch}!`);
}

// --------------------
// Integration Branch -> Next Integration Branch
// --------------------
function promoteBranchForward(sourceBranch: string, targetBranch: string): void {
  console.log(`🚀 Promoting ${sourceBranch} to ${targetBranch} (fast-forward only)...`);

  console.log(`🔄 Updating ${sourceBranch} and ${targetBranch} branches...`);
  updateCheckedOutBranch(sourceBranch);
  ensureLocalBranchRef(targetBranch);

  console.log(`🔍 Ensuring ${sourceBranch} is up-to-date with ${targetBranch}...`);
  try {
    execSync(`git merge ${targetBranch} --ff-only`, { stdio: "inherit" });
  } catch (error) {
    console.error(`❌ Error: Could not fast-forward '${sourceBranch}' against '${targetBranch}'.`);
    console.error(`⚠️  This means '${sourceBranch}' has diverged from '${targetBranch}'.`);
    console.error("💡 Please resolve any divergence before attempting to promote.");
    process.exit(1);
  }

  console.log(`🔀 Switching to ${targetBranch} branch...`);
  execSync(`git checkout ${targetBranch}`, { stdio: "inherit" });
  updateCheckedOutBranch(targetBranch);

  console.log(`🔄 Attempting to merge ${sourceBranch} into ${targetBranch}...`);
  try {
    execSync(`git merge ${sourceBranch} --ff-only`, { stdio: "inherit" });
    console.log(`✅ Successfully merged ${sourceBranch} into ${targetBranch}!`);

    console.log(`🚀 Pushing changes to remote ${targetBranch} branch...`);
    execSync(`git push origin ${targetBranch}`, { stdio: "inherit" });
    console.log(`🎉 Successfully pushed changes to ${targetBranch}!`);
  } catch (error) {
    console.error(`❌ Error: Could not fast-forward '${targetBranch}' to '${sourceBranch}'.`);
    console.error(`⚠️  This usually means '${targetBranch}' has diverged from '${sourceBranch}'.`);
    console.error("💡 Please resolve any divergence before attempting to promote.");
    process.exit(1);
  }
}

// --------------------
// Helpers
// --------------------
function getCurrentBranch(): string {
  return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
}

function ensureLocalBranchRef(branch: string): void {
  if (branchExistsOnRemote(branch)) {
    console.log(`🔄 Fetching latest ${branch} branch...`);
    try {
      execSync(`git fetch origin ${branch}:${branch}`, { stdio: "inherit" });
      return;
    } catch (error) {
      console.error(`❌ Error: Could not fetch ${branch} branch.`);
      console.error(`💡 Ensure '${branch}' exists on remote or locally.`);
      process.exit(1);
    }
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
    console.log(`🔄 Pulling latest ${branch} from remote...`);
    execSync(`git pull origin ${branch}`, { stdio: "inherit" });
    return;
  }

  console.log(`ℹ️  Skipping pull for '${branch}' because no remote branch exists.`);
}

function ensureCleanWorkingTree(): void {
  console.log("🔍 Checking for uncommitted changes...");
  const status = execSync("git status --porcelain", { encoding: "utf-8" });
  if (status.trim().length > 0) {
    console.error("❌ Error: You have uncommitted changes.");
    console.error("💡 Commit or stash your changes before running git promote from a feature branch.");
    process.exit(1);
  }
}

function isAncestor(ancestor: string, descendant: string): boolean {
  try {
    execSync(`git merge-base --is-ancestor ${ancestor} ${descendant}`);
    return true;
  } catch {
    return false;
  }
}

function escapeForShell(message: string): string {
  // naive escape of existing quotes
  return message.replace(/"/g, '\\"');
}
