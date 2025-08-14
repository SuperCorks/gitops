#!/usr/bin/env node

import { execSync } from "child_process";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// git promote now has two modes:
// 1. From a feature branch -> develop (squash merge with provided commit message, branch deletion)
// 2. From develop -> main (fast-forward only, existing behavior)

// --- Argument Parsing (yargs) ---
// Usage patterns:
//   git promote                   (from develop -> main)
//   git promote "feat: add X"     (from feature -> develop, squash commit message)
//   git promote -m "feat: add X"  (alternative flag style on feature branch)
const argv = yargs(hideBin(process.argv))
  .usage(
    "Usage:\n" +
      "  git promote               # From develop: fast-forward main\n" +
      "  git promote <message>     # From feature: squash merge with message\n" +
      "  git promote -m <message>  # Alternate flag for message in feature mode\n\n" +
      "Promote changes between branches. Feature branches are squash merged into develop; develop fast-forwards into main."
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

if (currentBranch === "develop") {
  // develop -> main fast-forward promotion
  promoteDevelopToMain();
} else if (isFeatureBranch(currentBranch)) {
  // feature -> develop squash merge
  promoteFeatureToDevelop(currentBranch, commitMessageArg);
} else if (currentBranch === "main") {
  console.error("❌ Error: git promote cannot be run from main branch directly");
  console.error("💡 Run from develop to fast-forward main OR from a feature branch to squash into develop.");
  process.exit(1);
} else {
  // Unknown/non-standard branch naming still allowed as 'feature' branch
  promoteFeatureToDevelop(currentBranch, commitMessageArg);
}

// --------------------
// Feature -> Develop
// --------------------
function promoteFeatureToDevelop(featureBranch: string, commitMessage: string): void {
  console.log(`🚀 Promoting feature branch '${featureBranch}' to develop (squash merge)...`);

  if (!commitMessage) {
    console.error("❌ Error: Commit message is required when promoting a feature branch.");
    console.error('💡 Usage: git promote "feat: add amazing thing"');
    process.exit(1);
  }

  ensureCleanWorkingTree();

  // Step 2: update develop (fetch latest into local develop without switching first)
  console.log("🔄 Fetching latest develop branch...");
  try {
    execSync("git fetch origin develop:develop", { stdio: "inherit" });
  } catch (error) {
    console.error("❌ Error: Could not fetch develop branch.");
    console.error("💡 Ensure 'develop' exists on remote or locally.");
    process.exit(1);
  }

  // Step 3: ensure develop is not ahead of the feature branch
  console.log("🔍 Checking that develop is contained in feature branch...");
  if (!isAncestor("develop", featureBranch)) {
    console.error("❌ Error: develop has commits not present in your feature branch.");
    console.error("💡 Please run 'git merge develop' (or rebase) on your feature branch, resolve conflicts, then retry.");
    process.exit(1);
  }

  // Switch to develop
  console.log("🔀 Switching to develop branch...");
  execSync("git checkout develop", { stdio: "inherit" });
  console.log("🔄 Pulling latest develop from remote...");
  execSync("git pull origin develop", { stdio: "inherit" });

  // Perform squash merge
  console.log(`🔄 Squash merging '${featureBranch}' into develop...`);
  try {
    execSync(`git merge ${featureBranch} --no-commit --squash`, { stdio: "inherit" });
  } catch (error) {
    console.error("❌ Error: Squash merge failed.");
    console.error("💡 Resolve any conflicts, then run the same git merge command manually and commit.");
    process.exit(1);
  }

  // Commit
  console.log("📝 Creating squash commit...");
  execSync(`git commit -m "${escapeForShell(commitMessage)}"`, { stdio: "inherit" });

  // Push develop
  console.log("🚀 Pushing develop to remote...");
  execSync("git push origin develop", { stdio: "inherit" });

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

  console.log("🎉 Feature branch successfully promoted to develop!");
}

// --------------------
// Develop -> Main
// --------------------
function promoteDevelopToMain(): void {
  console.log("🚀 Promoting develop to main (fast-forward only)...");

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
}

// --------------------
// Helpers
// --------------------
function getCurrentBranch(): string {
  return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
}

function updateDevelop(): void {
  execSync("git pull origin develop", { stdio: "inherit" });
}

function isFeatureBranch(branch: string): boolean {
  // Heuristic: anything that's not main/develop considered a feature branch
  return branch !== "main" && branch !== "develop";
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

function branchExistsOnRemote(branch: string): boolean {
  try {
    const out = execSync(`git ls-remote --heads origin ${branch}`, { encoding: "utf-8", stdio: "pipe" }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

function escapeForShell(message: string): string {
  // naive escape of existing quotes
  return message.replace(/"/g, '\\"');
}
