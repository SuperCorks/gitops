#!/usr/bin/env node

import { execSync } from "child_process";

// This script generates release notes by analyzing Git history and determining the next
// semantic version from the main branch.

// --- Script Logic ---

const targetBranch = "main";
const tagRegex = /^v\d+\.\d+\.\d+$/;

// --- Script Logic ---

// First ensure we have latest changes from all remotes
console.log("🔄 Fetching latest changes from all remotes...");
execSync("git fetch --all", { stdio: "inherit" });

// Verify we're on the correct branch
console.log(`🧐 Verifying current branch is '${targetBranch}'...`);
checkBranch(targetBranch);

// Get latest tag and commits
console.log(`🏷️  Finding latest release tag (pattern: ${tagRegex})...`);
const latestTag = getLatestTag(tagRegex);
console.log(`📝 Analyzing commits since ${latestTag} on branch ${targetBranch}...`);
const commits = getCommitsSinceTag(latestTag, targetBranch);

if (commits.length > 0) {
  const currentVersion = parseVersion(latestTag);
  const versionBump = determineVersionBump(commits);
  const newVersion = calculateNewVersionBase(currentVersion, versionBump);

  console.log(`📊 Current version: ${latestTag}`);
  console.log(`🚀 New version calculated: ${newVersion}`);
  console.log("Commits included:");
  commits.forEach((commit) => console.log(`- ${commit.hash} ${commit.message}`));

  // Add release URL with target branch and tag
  console.log("\n📦 Create the release at:");
  const releaseUrl = getGitHubReleaseUrl(targetBranch, newVersion);
  console.log(releaseUrl);
} else {
  console.log(`ℹ️  No new commits found on '${targetBranch}' since last relevant tag (${latestTag}).`);
}

// Function definitions
// --------------------

interface Version {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(version: string): Version {
  const match = version.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
  };
}

function getLatestTag(tagPattern: RegExp): string {
  try {
    // Get 20 most recent tags sorted by creation date
    const tags = execSync(
      'git for-each-ref refs/tags/ --sort=-creatordate --format="%(refname:short)" --count=20',
      { encoding: "utf-8" },
    )
      .split("\n")
      .map((tag) => tag.trim())
      .filter(Boolean)
      // Only keep tags matching the required pattern
      .filter((tag) => tagPattern.test(tag));

    if (tags.length === 0) {
      throw new Error(`No tags matching the pattern ${tagPattern} found`);
    }

    // The first tag in the sorted list is the latest relevant tag
    return tags[0];
  } catch (error) {
    console.error("❌ Error getting latest tag:", error);
    console.error("💡 Make sure you have at least one tag matching the required format in your repository.");
    process.exit(1);
  }
}

interface Commit {
  hash: string;
  message: string;
}

function getCommitsSinceTag(tag: string, branch: string): Commit[] {
  try {
    // Use the specified branch in the log command
    const commits = execSync(`git --no-pager log "${tag}..${branch}" --pretty=format:"%h%x00%s"`, {
      stdio: "pipe",
      encoding: "utf-8",
    }).trim();

    if (!commits) return [];

    return commits.split("\n").map((line) => {
      const [hash, message] = line.split("\0");
      return { hash, message };
    });
  } catch (error) {
    console.error("❌ Error getting commits:", error);
    console.error("💡 There might be an issue with the git history or tag reference.");
    process.exit(1);
  }
}

function determineVersionBump(commits: Commit[]): { major: boolean; minor: boolean; patch: boolean } {
  let hasMajor = false;
  let hasMinor = false;
  let hasPatch = false;

  for (const commit of commits) {
    // Updated regex to handle optional scope: type(scope)!: or type!:
    if (commit.message.match(/^(feat|fix|refactor|style|test|docs|chore|perf)(\([^)]+\))?!:/)) {
      hasMajor = true;
    } else if (commit.message.match(/^feat(\([^)]+\))?:/)) {
      hasMinor = true;
    } else if (commit.message.match(/^(fix|refactor|style|test|docs|chore|perf)(\([^)]+\))?:/)) {
      hasPatch = true;
    }
  }

  return { major: hasMajor, minor: hasMinor, patch: hasPatch };
}

function calculateNewVersionBase(
  currentVersion: Version,
  changes: { major: boolean; minor: boolean; patch: boolean },
): string {
  // Returns only the base vX.Y.Z part
  if (changes.major) {
    return `v${currentVersion.major + 1}.0.0`;
  } else if (changes.minor) {
    return `v${currentVersion.major}.${currentVersion.minor + 1}.0`;
  } else if (changes.patch) {
    return `v${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch + 1}`;
  }
  // If no relevant changes, return the current base version string
  return `v${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}`;
}

function checkBranch(expectedBranch: string): void {
  // Renamed and parameterized
  try {
    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
    if (currentBranch !== expectedBranch) {
      console.error(`❌ Error: Release notes must be generated from the '${expectedBranch}' branch`);
      console.error(`🌿 Current branch: ${currentBranch}`);
      console.error(`💡 Please switch to the '${expectedBranch}' branch and try again`);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error checking current branch:", error);
    console.error("💡 Make sure you're in a git repository");
    process.exit(1);
  }
}

function getGitHubReleaseUrl(targetBranch: string, newVersion: string): string {
  try {
    // Get the remote origin URL
    const remoteUrl = execSync("git config --get remote.origin.url", { encoding: "utf-8" }).trim();
    
    // Parse GitHub repository from various URL formats
    let repoPath: string;
    
    if (remoteUrl.startsWith("https://github.com/")) {
      // HTTPS format: https://github.com/owner/repo.git
      repoPath = remoteUrl.replace("https://github.com/", "").replace(/\.git$/, "");
    } else if (remoteUrl.startsWith("git@github.com:")) {
      // SSH format: git@github.com:owner/repo.git
      repoPath = remoteUrl.replace("git@github.com:", "").replace(/\.git$/, "");
    } else {
      throw new Error(`Unsupported remote URL format: ${remoteUrl}`);
    }
    
    // Construct the GitHub release URL
    return `https://github.com/${repoPath}/releases/new?target=${targetBranch}&tag=${encodeURIComponent(newVersion)}&title=${encodeURIComponent(newVersion)}`;
  } catch (error) {
    console.error("❌ Error getting repository URL:", error);
    console.error("💡 Make sure you're in a git repository with a GitHub remote origin");
    // Fallback to a generic message
    return `Create a new release with tag: ${newVersion}`;
  }
}
