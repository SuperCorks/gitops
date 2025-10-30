import { describe, it, expect } from 'vitest';
import {
  initRepo,
  createAndCheckoutBranch,
  runFeat,
  run,
  addOrigin,
  cloneFromBare,
} from './utils';

function expectOk(res: ReturnType<typeof runFeat>) {
  if (res.status !== 0) {
    throw new Error(`Expected exit 0, got ${res.status}\nstdout:\n${res.stdoutStr}\nstderr:\n${res.stderrStr}`);
  }
}

function currentBranch(repoDir: string): string {
  return run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], repoDir).stdoutStr.trim();
}

describe('git feat', () => {
  it('must be run from develop or main', () => {
    const repo = initRepo();
    // We're on master of temp repo initially; switch to feature to ensure error
    createAndCheckoutBranch(repo, 'feature/tmp');
    const res = runFeat(repo, ['some feature']);
    expect(res.status).not.toBe(0);
    expect(res.stderrStr).toMatch(/must be run from 'develop' or 'main'/i);
  });

  it('creates feat/<slug> from develop by default', () => {
    const repo = initRepo(undefined, 'develop');
    const res = runFeat(repo, ['my shiny feature']);
    expectOk(res);
    expect(currentBranch(repo)).toBe('feat/my-shiny-feature');
  });

  it('respects explicit type prefix and validates allowed types', () => {
    const repo = initRepo(undefined, 'develop');
    let res = runFeat(repo, ['ci: update workflows']);
    expectOk(res);
    expect(currentBranch(repo)).toBe('ci/update-workflows');

    // Switch back to base and try invalid type
    createAndCheckoutBranch(repo, 'develop');
    res = runFeat(repo, ['foo: bad type']);
    expect(res.status).not.toBe(0);
    expect(res.stderrStr).toMatch(/Unsupported type/i);
  });

  it('errors if the target branch already exists locally', () => {
    const repo = initRepo(undefined, 'develop');
    // Create branch first
    let res = runFeat(repo, ['test case exists']);
    expectOk(res);
    // Go back to develop
    createAndCheckoutBranch(repo, 'develop');
    // Try again -> should error
    res = runFeat(repo, ['test case exists']);
    expect(res.status).not.toBe(0);
    expect(res.stderrStr).toMatch(/already exists/i);
  });

  it('prompts to update when develop is behind origin and proceeds on yes', () => {
    const repo = initRepo(undefined, 'develop');
    const remote = addOrigin(repo);
    // Push current develop
    run('git', ['push', '-u', 'origin', 'develop'], repo);

    // Make remote (origin/develop) ahead by committing in a separate clone
    const clone = cloneFromBare(remote);
    // On clone, ensure we are on develop
    createAndCheckoutBranch(clone, 'develop');
    // Add a commit and push
    const marker = 'remote-advance-' + Math.random().toString(36).slice(2);
    run('git', ['commit', '--allow-empty', '-m', `chore: ${marker}`], clone);
    run('git', ['push'], clone);

    // Back in original repo, run git-feat and answer yes to update
    const res = runFeat(repo, ['my update feature'], 'y\n');
    expect(res.status).toBe(0);
    // Should be on the new branch
    expect(currentBranch(repo)).toBe('feat/my-update-feature');
  });
});
