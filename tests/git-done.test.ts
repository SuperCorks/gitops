import { describe, it, expect } from 'vitest';
import {
  initRepo,
  createAndCheckoutBranch,
  write,
  addOrigin,
  run,
  setLocalGitAlias,
} from './utils';
import { resolve } from 'node:path';

function currentBranch(repoDir: string): string {
  return run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], repoDir).stdoutStr.trim();
}

describe('git done', () => {
  it('errors if run from main or develop', () => {
    const repo = initRepo(undefined, 'develop');
    const cli = resolve(__dirname, '..', 'build', 'git-done.js');
    const resDev = run(process.execPath, [cli], repo);
    expect(resDev.status).not.toBe(0);
    expect(resDev.stderrStr).toMatch(/Cannot run git done from main or develop/i);

    createAndCheckoutBranch(repo, 'main');
    const resMain = run(process.execPath, [cli], repo);
    expect(resMain.status).not.toBe(0);
    expect(resMain.stderrStr).toMatch(/Cannot run git done from main or develop/i);
  });

  it('switches to develop after remote branch is deleted and runs cleanup via alias', () => {
    const repo = initRepo(undefined, 'develop');
    const remote = addOrigin(repo);
    // Push develop so updateBranch works
    run('git', ['push', '-u', 'origin', 'develop'], repo);

    // Create feature branch, commit, push
    createAndCheckoutBranch(repo, 'feat/done');
    write(repo, 'x.txt', 'x');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'x'], repo);
    run('git', ['push', '-u', 'origin', 'feat/done'], repo);

    // Delete remote feature branch to mark [gone]
    run('git', ['--git-dir', remote, 'branch', '-D', 'feat/done'], process.cwd());

    // Ensure we get [gone]
    run('git', ['fetch', '--all', '--prune'], repo);

    // Create a local git alias for cleanup to call our built script
    const cleanupCli = resolve(__dirname, '..', 'build', 'git-cleanup.js');
    setLocalGitAlias(repo, 'cleanup', `!${process.execPath} ${cleanupCli}`);

    // Run git-done from feature branch
    const cli = resolve(__dirname, '..', 'build', 'git-done.js');
    const res = run(process.execPath, [cli], repo);
    expect(res.status).toBe(0);
    expect(currentBranch(repo)).toBe('develop');
  });

  it('errors if remote branch still exists', () => {
    const repo = initRepo(undefined, 'develop');
    addOrigin(repo);
    // Create feature branch and push; but do NOT delete remote
    createAndCheckoutBranch(repo, 'feat/still-remote');
    write(repo, 'y.txt', 'y');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'y'], repo);
    run('git', ['push', '-u', 'origin', 'feat/still-remote'], repo);

    const cli = resolve(__dirname, '..', 'build', 'git-done.js');
    const res = run(process.execPath, [cli], repo);
    expect(res.status).not.toBe(0);
    expect(res.stderrStr).toMatch(/still exists on remote/i);
  });
});
