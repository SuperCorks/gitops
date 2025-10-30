import { describe, it, expect } from 'vitest';
import { initRepo, createAndCheckoutBranch, write, run, addOrigin, runPromote, remoteHasBranch } from './utils';

function currentBranch(repoDir: string): string {
  return run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], repoDir).stdoutStr.trim();
}

function lastMessage(repoDir: string, branch: string): string {
  run('git', ['checkout', branch], repoDir);
  return run('git', ['log', '-1', '--pretty=%B'], repoDir).stdoutStr.trim();
}

describe('git promote', () => {
  it('feature -> develop performs squash merge, pushes develop, and deletes feature locally and remotely', () => {
    const repo = initRepo(undefined, 'develop');
    const remote = addOrigin(repo);
    // Push develop
    run('git', ['push', '-u', 'origin', 'develop'], repo);

    // Create feature from develop and push
    createAndCheckoutBranch(repo, 'feat/x');
    write(repo, 'x.txt', '1');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'feat: x 1'], repo);
    write(repo, 'x2.txt', '2');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'fix: x 2'], repo);
    run('git', ['push', '-u', 'origin', 'feat/x'], repo);

    // Promote with message
    const res = runPromote(repo, ['feat: final squash']);
    expect(res.status).toBe(0);
    expect(currentBranch(repo)).toBe('develop');
    expect(lastMessage(repo, 'develop')).toBe('feat: final squash');

    // Local feature deleted
    const localFeature = run('git', ['show-ref', '--verify', '--quiet', 'refs/heads/feat/x'], repo);
    expect(localFeature.status).not.toBe(0);

    // Remote feature deleted
    expect(remoteHasBranch(remote, 'feat/x')).toBe(false);
  });

  it('develop -> main fast-forwards and pushes main', () => {
    const repo = initRepo(undefined, 'develop');
    const remote = addOrigin(repo);

    // Create main and push both branches
    run('git', ['branch', 'main'], repo);
    run('git', ['push', '-u', 'origin', 'develop'], repo);
    run('git', ['push', '-u', 'origin', 'main'], repo);

    // Advance develop by one commit
    createAndCheckoutBranch(repo, 'develop');
    write(repo, 'd.txt', 'advance');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'feat: advance develop'], repo);
    run('git', ['push', 'origin', 'develop'], repo);

    // Run promote from develop
    const res = runPromote(repo);
    expect(res.status).toBe(0);

    // main should have the last commit message from develop
    expect(lastMessage(repo, 'main')).toBe('feat: advance develop');
  });

  it('feature -> develop when develop exists only on remote', () => {
    // Create repo and remote
    const repo = initRepo();
    addOrigin(repo);

    // Create develop locally, add a base commit, push, then delete local develop to simulate remote-only develop
    run('git', ['checkout', '-B', 'develop'], repo);
    write(repo, 'base.txt', 'base\n');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'chore: base'], repo);
    run('git', ['push', '-u', 'origin', 'develop'], repo);
    // Ensure no local develop remains
    run('git', ['checkout', 'main'], repo);
    run('git', ['branch', '-D', 'develop'], repo);

    // Create feature from remote develop tip explicitly
    const co = run('git', ['checkout', '-B', 'feat/remote-develop', 'origin/develop'], repo);
    write(repo, 'r.txt', 'r');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'feat: remote develop feature'], repo);

    const res = runPromote(repo, ['feat: squash to develop']);
    expect(res.status).toBe(0);
    // Now should be on develop and have the squash message
    expect(currentBranch(repo)).toBe('develop');
    expect(lastMessage(repo, 'develop')).toBe('feat: squash to develop');
  });

  it('errors when run from main', () => {
    const repo = initRepo(undefined, 'main');
    const res = runPromote(repo);
    expect(res.status).not.toBe(0);
    expect(res.stderrStr).toMatch(/cannot be run from main branch/i);
  });

  it('feature -> main when no develop exists', () => {
    const repo = initRepo(undefined, 'main');
    const remote = addOrigin(repo);
    run('git', ['push', '-u', 'origin', 'main'], repo);
    // Create feature from main, commit, push
    createAndCheckoutBranch(repo, 'feat/direct');
    write(repo, 'f.txt', 'f');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'feat: direct'], repo);
    run('git', ['push', '-u', 'origin', 'feat/direct'], repo);

    const res = runPromote(repo, ['feat: squash to main']);
    expect(res.status).toBe(0);
    // Should be on main now and have the squash message
    expect(currentBranch(repo)).toBe('main');
    expect(lastMessage(repo, 'main')).toBe('feat: squash to main');
  });

  it('errors if working tree is dirty on feature branch', () => {
    const repo = initRepo(undefined, 'develop');
    addOrigin(repo);
    // Create feature and dirty working tree
    createAndCheckoutBranch(repo, 'feat/dirty');
    write(repo, 'dirty.txt', 'x');
    // Do not add/commit -> uncommitted change
    const res = runPromote(repo, ['feat: message']);
    expect(res.status).not.toBe(0);
    expect(res.stderrStr).toMatch(/uncommitted changes/i);
  });
});
