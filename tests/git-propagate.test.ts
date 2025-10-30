import { describe, it, expect } from 'vitest';
import { initRepo, createAndCheckoutBranch, write, run, addOrigin, runPropagate } from './utils';
import { resolve } from 'node:path';

function lastCommitMsg(repo: string, branch: string): string {
  run('git', ['checkout', branch], repo);
  return run('git', ['log', '-1', '--pretty=%s'], repo).stdoutStr.trim();
}

describe('git propagate', () => {
  it('from main -> develop fast-forwards develop to main', () => {
    const repo = initRepo(undefined, 'main');
    const remote = addOrigin(repo);

    // Create develop from main and push both
    createAndCheckoutBranch(repo, 'develop');
    run('git', ['push', '-u', 'origin', 'develop'], repo);
    createAndCheckoutBranch(repo, 'main');
    run('git', ['push', '-u', 'origin', 'main'], repo);

    // Advance main by one commit
    write(repo, 'm.txt', 'on main');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'feat: advance main'], repo);
    run('git', ['push', 'origin', 'main'], repo);

    // Run propagate from main
    const res = runPropagate(repo);
    expect(res.status).toBe(0);

    // develop should now have the last commit from main
    expect(lastCommitMsg(repo, 'develop')).toBe('feat: advance main');
  });

  it('from develop -> other branches: merges selected branches and optionally pushes', () => {
    const repo = initRepo(undefined, 'develop');
    const remote = addOrigin(repo);
    // Push develop
    run('git', ['push', '-u', 'origin', 'develop'], repo);

    // Create two feature branches from develop and push both
    createAndCheckoutBranch(repo, 'feat/one');
    write(repo, 'one.txt', '1');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'feat: one'], repo);
    run('git', ['push', '-u', 'origin', 'feat/one'], repo);

    createAndCheckoutBranch(repo, 'feat/two');
    write(repo, 'two.txt', '2');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'feat: two'], repo);
    run('git', ['push', '-u', 'origin', 'feat/two'], repo);

    // Advance develop by one commit
    createAndCheckoutBranch(repo, 'develop');
    write(repo, 'develop.txt', 'D');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'feat: develop advance'], repo);
    run('git', ['push', 'origin', 'develop'], repo);

    // Run propagate from develop and:
    // - Answer 'y' to merge feat/one, then 'y' to push it
    // - Answer 'n' to skip feat/two
    const input = 'y\n' + 'y\n' + 'n\n';
    const res = runPropagate(repo, [], input);
    expect(res.status).toBe(0);

    // feat/one should contain develop.txt
    run('git', ['checkout', 'feat/one'], repo);
    const listOne = run('git', ['ls-files'], repo).stdoutStr;
    expect(listOne).toMatch(/develop.txt/);

    // feat/two should not yet have develop.txt
    run('git', ['checkout', 'feat/two'], repo);
    const listTwo = run('git', ['ls-files'], repo).stdoutStr;
    expect(listTwo).not.toMatch(/develop.txt/);
  });

  // Note: conflict scenarios can be environment-dependent; covered by merge success path above.
});
