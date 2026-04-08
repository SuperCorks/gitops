import { execSync } from "child_process";

export const INTEGRATION_BRANCHES = ["main", "staging", "develop"] as const;

export type IntegrationBranch = (typeof INTEGRATION_BRANCHES)[number];

const FEATURE_PROMOTION_ORDER: IntegrationBranch[] = ["develop", "staging", "main"];

export function isIntegrationBranch(branch: string): branch is IntegrationBranch {
  return INTEGRATION_BRANCHES.includes(branch as IntegrationBranch);
}

export function isFeatureBranch(branch: string): boolean {
  return !isIntegrationBranch(branch);
}

export function branchExistsOnRemote(branch: string): boolean {
  try {
    const out = execSync(`git ls-remote --heads origin ${branch}`, { encoding: "utf-8", stdio: "pipe" }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

export function branchExistsLocal(branch: string): boolean {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${branch}`);
    return true;
  } catch {
    return false;
  }
}

export function branchExists(branch: string, currentBranch?: string): boolean {
  return branch === currentBranch || branchExistsLocal(branch) || branchExistsOnRemote(branch);
}

export function getAvailableIntegrationBranches(currentBranch?: string): IntegrationBranch[] {
  return INTEGRATION_BRANCHES.filter((branch) => branchExists(branch, currentBranch));
}

export function getFeaturePromotionTarget(currentBranch?: string): IntegrationBranch {
  return FEATURE_PROMOTION_ORDER.find((branch) => branchExists(branch, currentBranch)) ?? "main";
}

export function getNextPromotionTarget(currentBranch: string): IntegrationBranch | null {
  const availableBranches = getAvailableIntegrationBranches(currentBranch);

  if (currentBranch === "develop") {
    return availableBranches.includes("staging") ? "staging" : "main";
  }

  if (currentBranch === "staging") {
    return "main";
  }

  return null;
}

export function getNextPropagationTarget(currentBranch: string): IntegrationBranch | null {
  const availableBranches = getAvailableIntegrationBranches(currentBranch);

  if (currentBranch === "main") {
    if (availableBranches.includes("staging")) {
      return "staging";
    }

    if (availableBranches.includes("develop")) {
      return "develop";
    }

    return null;
  }

  if (currentBranch === "staging") {
    return availableBranches.includes("develop") ? "develop" : null;
  }

  if (currentBranch === "develop") {
    return null;
  }

  return null;
}
