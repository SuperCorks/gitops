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

  it('prefers develop when both main and develop exist (main - develop - feature)', () => {
    // Init with main, create develop, ensure both exist remotely
    const repo = initRepo(); // defaults to main
    const remote = addOrigin(repo);
    // Push main so updateBranch works if chosen erroneously
    run('git', ['push', '-u', 'origin', 'main'], repo);

    // Create develop branch and push
    createAndCheckoutBranch(repo, 'develop');
    write(repo, 'dev.txt', 'dev');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'dev init'], repo);
    run('git', ['push', '-u', 'origin', 'develop'], repo);

    // Create feature off develop
    createAndCheckoutBranch(repo, 'feat/prefers-develop');
    write(repo, 'f.txt', 'f');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'f'], repo);
    run('git', ['push', '-u', 'origin', 'feat/prefers-develop'], repo);

    // Delete remote feature branch to mark [gone]
    run('git', ['--git-dir', remote, 'branch', '-D', 'feat/prefers-develop'], process.cwd());
    run('git', ['fetch', '--all', '--prune'], repo);

    // Wire local cleanup alias to our built script
    const cleanupCli = resolve(__dirname, '..', 'build', 'git-cleanup.js');
    setLocalGitAlias(repo, 'cleanup', `!${process.execPath} ${cleanupCli}`);

    const cli = resolve(__dirname, '..', 'build', 'git-done.js');
    const res = run(process.execPath, [cli], repo);
    expect(res.status).toBe(0);
    // Should land on develop, not main
    expect(currentBranch(repo)).toBe('develop');
  });

  it('prefers develop when master and develop exist (master - develop - feature)', () => {
    // Init with master, create develop, ensure both exist remotely
    const repo = initRepo(undefined, 'master');
    const remote = addOrigin(repo);
    // Push master
    run('git', ['push', '-u', 'origin', 'master'], repo);

    // Create develop branch and push
    createAndCheckoutBranch(repo, 'develop');
    write(repo, 'dev.txt', 'dev');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'dev init'], repo);
    run('git', ['push', '-u', 'origin', 'develop'], repo);

    // Create feature off develop
    createAndCheckoutBranch(repo, 'feat/master-develop');
    write(repo, 'f.txt', 'f');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'f'], repo);
    run('git', ['push', '-u', 'origin', 'feat/master-develop'], repo);

    // Delete remote feature branch to mark [gone]
    run('git', ['--git-dir', remote, 'branch', '-D', 'feat/master-develop'], process.cwd());
    run('git', ['fetch', '--all', '--prune'], repo);

    // Wire local cleanup alias to our built script
    const cleanupCli = resolve(__dirname, '..', 'build', 'git-cleanup.js');
    setLocalGitAlias(repo, 'cleanup', `!${process.execPath} ${cleanupCli}`);

    const cli = resolve(__dirname, '..', 'build', 'git-done.js');
    const res = run(process.execPath, [cli], repo);
    expect(res.status).toBe(0);
    // Should land on develop
    expect(currentBranch(repo)).toBe('develop');
  });

  it('falls back to main when there is no develop (main - feature)', () => {
    const repo = initRepo(); // defaults to main
    const remote = addOrigin(repo);
    run('git', ['push', '-u', 'origin', 'main'], repo);

    // Create feature off main
    createAndCheckoutBranch(repo, 'feat/main-only');
    write(repo, 'm.txt', 'm');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'm'], repo);
    run('git', ['push', '-u', 'origin', 'feat/main-only'], repo);

    // Delete remote feature branch to mark [gone]
    run('git', ['--git-dir', remote, 'branch', '-D', 'feat/main-only'], process.cwd());
    run('git', ['fetch', '--all', '--prune'], repo);

    // Wire local cleanup alias to our built script
    const cleanupCli = resolve(__dirname, '..', 'build', 'git-cleanup.js');
    setLocalGitAlias(repo, 'cleanup', `!${process.execPath} ${cleanupCli}`);

    const cli = resolve(__dirname, '..', 'build', 'git-done.js');
    const res = run(process.execPath, [cli], repo);
    expect(res.status).toBe(0);
    expect(currentBranch(repo)).toBe('main');
  });

  it('falls back to master when there is no develop (master - feature)', () => {
    const repo = initRepo(undefined, 'master');
    const remote = addOrigin(repo);
    run('git', ['push', '-u', 'origin', 'master'], repo);

    // Create feature off master
    createAndCheckoutBranch(repo, 'feat/master-only');
    write(repo, 'mm.txt', 'mm');
    run('git', ['add', '.'], repo);
    run('git', ['commit', '-m', 'mm'], repo);
    run('git', ['push', '-u', 'origin', 'feat/master-only'], repo);

    // Delete remote feature branch to mark [gone]
    run('git', ['--git-dir', remote, 'branch', '-D', 'feat/master-only'], process.cwd());
    run('git', ['fetch', '--all', '--prune'], repo);

    // Wire local cleanup alias to our built script
    const cleanupCli = resolve(__dirname, '..', 'build', 'git-cleanup.js');
    setLocalGitAlias(repo, 'cleanup', `!${process.execPath} ${cleanupCli}`);

    const cli = resolve(__dirname, '..', 'build', 'git-done.js');
    const res = run(process.execPath, [cli], repo);
    expect(res.status).toBe(0);
    expect(currentBranch(repo)).toBe('master');
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
