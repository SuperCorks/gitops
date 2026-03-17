import { execSync } from "child_process";

export interface Version {
  major: number;
  minor: number;
  patch: number;
}

export interface Commit {
  hash: string;
  message: string;
}

export interface ReleaseInfo {
  latestTag: string;
  newVersion: string;
  commits: Commit[];
}

export const TARGET_BRANCH = "main";
export const TAG_REGEX = /^v\d+\.\d+\.\d+$/;

export function parseVersion(version: string): Version {
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

export function getLatestTag(tagPattern: RegExp): string {
  try {
    const tags = execSync(
      'git for-each-ref refs/tags/ --sort=-creatordate --format="%(refname:short)" --count=20',
      { encoding: "utf-8" },
    )
      .split("\n")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag) => tagPattern.test(tag));

    if (tags.length === 0) {
      throw new Error(`No tags matching the pattern ${tagPattern} found`);
    }

    return tags[0];
  } catch (error) {
    console.error("❌ Error getting latest tag:", error);
    console.error("💡 Make sure you have at least one tag matching the required format in your repository.");
    process.exit(1);
  }
}

export function getCommitsSinceTag(tag: string, branch: string): Commit[] {
  try {
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

export function determineVersionBump(commits: Commit[]): { major: boolean; minor: boolean; patch: boolean } {
  let hasMajor = false;
  let hasMinor = false;
  let hasPatch = false;

  for (const commit of commits) {
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

export function calculateNewVersionBase(
  currentVersion: Version,
  changes: { major: boolean; minor: boolean; patch: boolean },
): string {
  if (changes.major) {
    return `v${currentVersion.major + 1}.0.0`;
  } else if (changes.minor) {
    return `v${currentVersion.major}.${currentVersion.minor + 1}.0`;
  } else if (changes.patch) {
    return `v${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch + 1}`;
  }
  return `v${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}`;
}

export function checkBranch(expectedBranch: string): void {
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

export function formatReleaseBody(commits: Commit[], repoPath: string, previousTag: string, newVersion: string): string {
  const lines = commits.map((c) => `- ${c.hash} ${c.message}`);
  lines.push("");
  lines.push(`**Full Changelog**: https://github.com/${repoPath}/compare/${previousTag}...${newVersion}`);
  return lines.join("\n");
}

export function getRepoPath(): string {
  const remoteUrl = execSync("git config --get remote.origin.url", { encoding: "utf-8" }).trim();

  if (remoteUrl.startsWith("https://github.com/")) {
    return remoteUrl.replace("https://github.com/", "").replace(/\.git$/, "");
  } else if (remoteUrl.startsWith("git@github.com:")) {
    return remoteUrl.replace("git@github.com:", "").replace(/\.git$/, "");
  } else {
    throw new Error(`Unsupported remote URL format: ${remoteUrl}`);
  }
}

export function getGitHubReleaseUrl(targetBranch: string, newVersion: string, previousTag: string, commits: Commit[]): string {
  try {
    const repoPath = getRepoPath();
    const body = formatReleaseBody(commits, repoPath, previousTag, newVersion);
    return `https://github.com/${repoPath}/releases/new?target=${targetBranch}&tag=${encodeURIComponent(newVersion)}&title=${encodeURIComponent(newVersion)}&body=${encodeURIComponent(body)}`;
  } catch (error) {
    console.error("❌ Error getting repository URL:", error);
    console.error("💡 Make sure you're in a git repository with a GitHub remote origin");
    return `Create a new release with tag: ${newVersion}`;
  }
}

/**
 * Gather release info: fetch, check branch, find tag, get commits, calculate version.
 * Returns null if there are no new commits.
 */
export function gatherReleaseInfo(): ReleaseInfo | null {
  console.log("🔄 Fetching latest changes from all remotes...");
  execSync("git fetch --all", { stdio: "inherit" });

  console.log(`🧐 Verifying current branch is '${TARGET_BRANCH}'...`);
  checkBranch(TARGET_BRANCH);

  console.log(`🏷️  Finding latest release tag (pattern: ${TAG_REGEX})...`);
  const latestTag = getLatestTag(TAG_REGEX);
  console.log(`📝 Analyzing commits since ${latestTag} on branch ${TARGET_BRANCH}...`);
  const commits = getCommitsSinceTag(latestTag, TARGET_BRANCH);

  if (commits.length === 0) {
    console.log(`ℹ️  No new commits found on '${TARGET_BRANCH}' since last relevant tag (${latestTag}).`);
    return null;
  }

  const currentVersion = parseVersion(latestTag);
  const versionBump = determineVersionBump(commits);
  const newVersion = calculateNewVersionBase(currentVersion, versionBump);

  console.log(`📊 Current version: ${latestTag}`);
  console.log(`🚀 New version calculated: ${newVersion}`);
  console.log("Commits included:");
  commits.forEach((commit) => console.log(`- ${commit.hash} ${commit.message}`));

  return { latestTag, newVersion, commits };
}
