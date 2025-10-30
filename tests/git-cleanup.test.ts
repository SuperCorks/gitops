import { describe, it, expect } from 'vitest';
import {
  initRepo,
  createAndCheckoutBranch,
  write,
  addOrigin,
  run,
} from './utils';
import { resolve } from 'node:path';

function branchExistsLocal(repoDir: string, name: string): boolean {
  const res = run('git', ['show-ref', '--verify', '--quiet', `refs/heads/${name}`], repoDir);
  return res.status === 0;
}

describe('git cleanup', () => {
  it('deletes local branches that are [gone] on remote', () => {
    const repo = initRepo(undefined, 'develop');
    const remote = addOrigin(repo);

    // Create two feature branches and push both
    createAndCheckoutBranch(repo, 'feat/a');
    write(repo, 'a.txt', 'a');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'a'], repo);
    run('git', ['push', '-u', 'origin', 'feat/a'], repo);

    createAndCheckoutBranch(repo, 'feat/b');
    write(repo, 'b.txt', 'b');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'b'], repo);
    run('git', ['push', '-u', 'origin', 'feat/b'], repo);

    // Delete feat/a on remote
    run('git', ['--git-dir', remote, 'branch', '-D', 'feat/a'], process.cwd());

    // Go back to develop and fetch prune to mark [gone]
    createAndCheckoutBranch(repo, 'develop');
    run('git', ['fetch', '--prune'], repo);

    // Sanity: both local branches exist
    expect(branchExistsLocal(repo, 'feat/a')).toBe(true);
    expect(branchExistsLocal(repo, 'feat/b')).toBe(true);

    // Run cleanup
    const cli = resolve(__dirname, '..', 'build', 'git-cleanup.js');
    const res = run(process.execPath, [cli], repo);
    expect(res.status).toBe(0);

    // feat/a should be deleted, feat/b remains
    expect(branchExistsLocal(repo, 'feat/a')).toBe(false);
    expect(branchExistsLocal(repo, 'feat/b')).toBe(true);
  });

  it('prints message when nothing to clean', () => {
    const repo = initRepo(undefined, 'develop');
    const cli = resolve(__dirname, '..', 'build', 'git-cleanup.js');
    const res = run(process.execPath, [cli], repo);
    expect(res.status).toBe(0);
    expect(res.stdoutStr).toMatch(/No stale branches/i);
  });
});
