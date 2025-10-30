#!/usr/bin/env node

import { execSync, spawnSync } from "child_process";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import * as readline from "readline";

// git acp (add-commit-push)
// Usage: git acp "feat: add X"
//   1. git add .
//   2. git commit -m "<message>"
//   3. git push (sets upstream if missing)
// If on main, requires explicit confirmation by typing 'yes'.

const argv = yargs(hideBin(process.argv))
  .usage(
    "Usage: git acp [options] <commit message>\n\n" +
      "Stages all changes (git add .), commits with the provided message, then pushes.\n" +
      "Confirmation:\n" +
      "  • main: must type 'yes' unless --yes provided\n" +
      "  • other branches: press Enter or 'y' to proceed (default yes) unless --yes provided\n" +
      "Options:\n" +
      "  -y, --yes   Skip confirmation prompts entirely" 
  )
  .option('yes', {
    alias: 'y',
    type: 'boolean',
    description: 'Skip confirmation prompts (dangerous on main)',
    default: false
  })
  .help()
  .alias("help", "h")
  .parseSync();

function getCurrentBranch(): string {
  return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
}

function hasUpstream(): boolean {
  try {
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
      .map(r => r.trim())
      .filter(Boolean);
    if (remotes.includes("origin")) return "origin";
    return remotes[0] ?? null;
  } catch {
    return null;
  }
}

async function confirmProceed(branch: string): Promise<void> {
  if ((argv as any).yes) return; // skip confirmations entirely
  const isMain = branch === 'main';
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = isMain
      ? "You are on 'main'. Type 'yes' to commit and push these staged changes: "
      : "Commit and push these staged changes? (Y/n): ";
    rl.question(question, (answerRaw) => {
      const answer = answerRaw.trim();
      rl.close();
      if (isMain) {
        if (answer !== 'yes') {
          console.error("❌ Aborted: confirmation mismatch (expected 'yes').");
          process.exit(1);
        }
        return resolve();
      }
      // Non-main: empty or y/yes proceeds; anything else aborts
      if (answer === '' || /^y(es)?$/i.test(answer)) {
        return resolve();
      }
      console.error('❌ Aborted by user.');
      process.exit(1);
    });
  });
}

async function main() {
  const branch = getCurrentBranch();
  const commitMessage = argv._.join(" ").trim();
  if (!commitMessage) {
    console.error("❌ Error: Commit message required.\nUsage: git acp \"feat: add feature\"");
    process.exit(1);
  }
  // First informational log with colored commit message (if TTY)
  const supportsColor = process.stdout.isTTY;
  const color = (c: string) => (supportsColor ? c : "");
  const RESET = color("\x1b[0m");
  const MAGENTA = color("\x1b[35m");
  const GREEN = color("\x1b[32m");
  console.log(`Adding, committing and pushing with message: \n${MAGENTA}"${commitMessage}"${RESET}\n`);

  console.log(`➕ Staging changes (git add .) ...`);
  try {
    execSync("git add .", { stdio: "inherit" });
  } catch (e: any) {
    console.error("❌ Failed to add changes:", e?.message || e);
    process.exit(1);
  }

  // Show staged changes with native git coloring similar to user expectations
  try {
    execSync("git -c color.status=always status --short", { stdio: "inherit" });
  } catch { /* ignore */ }

  await confirmProceed(branch);

  console.log(`📝 Committing changes: \"${commitMessage}\"`);
  const commitResult = spawnSync("git", ["commit", "-m", commitMessage], { stdio: "inherit" });
  if (commitResult.status !== 0) {
    // Check if nothing to commit
    try {
      const diff = execSync("git diff --cached --name-status", { encoding: "utf-8" }).trim();
      if (!diff) {
        console.log("ℹ️  Nothing to commit. Skipping push.");
        process.exit(0);
      }
    } catch { /* ignore */ }
    console.error("❌ Commit failed.");
    process.exit(commitResult.status ?? 1);
  }

  console.log("🚀 Pushing changes...");
  try {
    if (hasUpstream()) {
      execSync("git push", { stdio: "inherit" });
    } else {
      const remote = getDefaultRemote();
      if (!remote) {
        console.log("ℹ️  No remote configured. Push skipped.");
        process.exit(0);
      }
      console.log(`First push; setting upstream (git push -u ${remote} ${branch}) ...`);
      execSync(`git push -u ${remote} ${branch}` , { stdio: "inherit" });
    }
  } catch (e: any) {
    console.error("⚠️  Push failed:", e?.message || e);
    process.exit(1);
  }

  console.log(`\n${GREEN}🎉 git acp complete with message: "${commitMessage}"${RESET}`);
}

main().catch(err => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
