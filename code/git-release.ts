#!/usr/bin/env node

import { execFileSync, spawnSync } from "child_process";
import * as readline from "readline";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import {
  gatherReleaseInfo,
  getGitHubReleaseUrl,
  getRepoPath,
  formatReleaseBody,
  TARGET_BRANCH,
} from "./release-utils";

if (require.main === module) {
  yargs(hideBin(process.argv))
    .scriptName("git release")
    .usage("Usage: git release <link|draft>")
    .command({
      command: "link",
      aliases: ["notes"],
      describe: "Print a pre-filled GitHub release URL for the next version",
      handler: () => runLink(),
    })
    .command({
      command: "draft",
      describe: "Preview and create a draft GitHub release with the gh CLI",
      handler: () => runDraft(),
    })
    .example("git release link", "Print the GitHub release URL with title and body pre-filled")
    .example("git release notes", "Alias for `git release link`")
    .example("git release draft", "Preview and create a draft release through the gh CLI")
    .demandCommand(1, "Please specify a subcommand: link or draft")
    .strict()
    .help()
    .alias("help", "h")
    .parseSync();
}

export function runLink(): void {
  const info = gatherReleaseInfo();
  if (!info) return;

  console.log("\n📦 Create the release at:");
  const releaseUrl = getGitHubReleaseUrl(TARGET_BRANCH, info.newVersion, info.latestTag, info.commits);
  console.log(releaseUrl);
}

function runDraft(): void {
  const info = gatherReleaseInfo();
  if (!info) return;

  ensureGhReady();

  let repoPath: string;
  try {
    repoPath = getRepoPath();
  } catch (error) {
    console.error("❌ Error getting repository URL:", error);
    console.error("💡 Make sure you're in a git repository with a GitHub remote origin");
    process.exit(1);
  }

  const body = formatReleaseBody(info.commits, repoPath, info.latestTag, info.newVersion);

  console.log("\n📋 Draft release summary:");
  console.log(`   Tag/Release: ${info.newVersion}`);
  console.log(`   Target:      ${TARGET_BRANCH}`);
  console.log(`   Body:\n`);
  body.split("\n").forEach((line) => console.log(`     ${line}`));
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("Create this draft release? [Y/n] ", (answer) => {
    rl.close();
    const normalised = answer.trim().toLowerCase();
    if (normalised !== "" && normalised !== "y" && normalised !== "yes") {
      console.log("Aborted.");
      process.exit(0);
    }

    console.log(`\n📦 Creating draft release ${info.newVersion}...`);
    try {
      const result = execFileSync(
        "gh",
        [
          "release",
          "create",
          info.newVersion,
          "--draft",
          "--target",
          TARGET_BRANCH,
          "--title",
          info.newVersion,
          "--notes",
          body,
        ],
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
      ).trim();

      console.log(`✅ Draft release created: ${result}`);
      openUrl(result);
    } catch (error: any) {
      console.error("❌ Failed to create draft release:", error.stderr || error.message);
      process.exit(1);
    }
  });
}

function ensureGhReady(): void {
  try {
    execFileSync("gh", ["--version"], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    console.error("❌ The `gh` CLI is not installed.");
    console.error("💡 Install it from https://cli.github.com/ or with your system package manager.");
    process.exit(1);
  }

  try {
    execFileSync("gh", ["auth", "status"], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (error: any) {
    console.error("❌ The `gh` CLI is not authenticated.");
    console.error("💡 Run `gh auth login` and try again.");
    const details = (error.stderr || error.stdout || "").trim();
    if (details) {
      console.error(details);
    }
    process.exit(1);
  }
}

function openUrl(url: string): void {
  console.log("🌐 Opening in browser...");

  let result;
  if (process.platform === "darwin") {
    result = spawnSync("open", [url], { stdio: "ignore" });
  } else if (process.platform === "win32") {
    result = spawnSync("cmd.exe", ["/c", "start", "", url], { stdio: "ignore", windowsHide: true });
  } else {
    result = spawnSync("xdg-open", [url], { stdio: "ignore" });
  }

  if (result.error || result.status !== 0) {
    console.warn("⚠️  Draft release created, but failed to open the browser automatically.");
  }
}
