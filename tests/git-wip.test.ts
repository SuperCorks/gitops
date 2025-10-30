import { describe, it, expect } from 'vitest';
import {
  initRepo,
  createAndCheckoutBranch,
  write,
  head,
  lastMessage,
  setFailingPreCommitHook,
  addOrigin,
  remoteHasBranch,
  upstream,
  runWip,
  run,
} from './utils';

function expectOk(res: ReturnType<typeof runWip>) {
  if (res.status !== 0) {
    throw new Error(`Expected exit 0, got ${res.status}\nstdout:\n${res.stdoutStr}\nstderr:\n${res.stderrStr}`);
  }
}

function expectFail(res: ReturnType<typeof runWip>) {
  if (res.status === 0) {
    throw new Error(`Expected non-zero exit, got 0\nstdout:\n${res.stdoutStr}\nstderr:\n${res.stderrStr}`);
  }
}

describe('git wip CLI', () => {
  it('fails on protected branch main', () => {
    const repo = initRepo(undefined, 'main');
    createAndCheckoutBranch(repo, 'main');
    const res = runWip(repo, ['--no-push']);
    expect(res.status).not.toBe(0);
    expect(res.stderrStr).toMatch(/cannot be run on 'main' or 'develop'/i);
  });

  it('creates a WIP commit with default message and no push', () => {
    const repo = initRepo();
    createAndCheckoutBranch(repo, 'feat/test');
    write(repo, 'file.txt', 'hello');
    const before = head(repo);
    const res = runWip(repo, ['--no-push']);
    expectOk(res);
    const after = head(repo);
    expect(after).not.toBe(before);
    expect(lastMessage(repo)).toBe('wip');
    expect(res.stdoutStr).toMatch(/Skipping push|WIP saved/i);
  });

  it('accepts a custom multi-word commit message', () => {
    const repo = initRepo();
    createAndCheckoutBranch(repo, 'feat/custom');
    write(repo, 'a.txt', 'x');
    const res = runWip(repo, ['--no-push', 'my', 'custom', 'message']);
    expectOk(res);
    expect(lastMessage(repo)).toBe('my custom message');
  });

  it('appends [skip ci] when --skip ci is provided', () => {
    const repo = initRepo();
    createAndCheckoutBranch(repo, 'feat/skip-ci');
    write(repo, 'b.txt', 'y');
    const res = runWip(repo, ['--no-push', '--skip', 'ci']);
    expectOk(res);
    const msg = lastMessage(repo);
    expect(msg.split('\n').pop()).toBe('[skip ci]');
  });

  it('exits gracefully with nothing to commit', () => {
    const repo = initRepo();
    createAndCheckoutBranch(repo, 'feat/empty');
    const before = head(repo);
    const res = runWip(repo, ['--no-push']);
    // Should exit successfully and not create a new commit
    expect(res.status).toBe(0);
    expect(res.stdoutStr).toMatch(/Nothing to commit/i);
    const after = head(repo);
    expect(after).toBe(before);
  });

  it('fails when hooks fail, passes with -nh (skip hooks)', () => {
    const repo = initRepo();
    createAndCheckoutBranch(repo, 'feat/hooks');
    write(repo, 'c.txt', 'z');
    setFailingPreCommitHook(repo);

    const fail = runWip(repo, ['--no-push']);
    expectFail(fail);
    expect(fail.stderrStr).toMatch(/git commit failed|execution error/i);

    // Now bypass hooks
    write(repo, 'c2.txt', 'z');
    const ok = runWip(repo, ['--no-push', '-nh']);
    expectOk(ok);
    expect(lastMessage(repo)).toBe('wip');
  });

  it('pushes with -u on first push when upstream is missing', () => {
    const repo = initRepo();
    createAndCheckoutBranch(repo, 'feat/first-push');
    const remote = addOrigin(repo);
    write(repo, 'd.txt', 'push');

    const res = runWip(repo);
    expectOk(res);
    // Upstream should be set
    expect(upstream(repo)).toBe('origin/feat/first-push');
    // Remote should have the branch
    expect(remoteHasBranch(remote, 'feat/first-push')).toBe(true);
  });

  it('performs a normal push when upstream already exists', () => {
    const repo = initRepo();
    createAndCheckoutBranch(repo, 'feat/again');
    const remote = addOrigin(repo);

    // Set upstream by initial push
    write(repo, 'e.txt', 'first');
    expectOk(runWip(repo));

    const head1 = head(repo);
    write(repo, 'e.txt', 'second');
    const res = runWip(repo);
    expectOk(res);
    const head2 = head(repo);
    expect(head2).not.toBe(head1);
    // Still present on remote
    expect(remoteHasBranch(remote, 'feat/again')).toBe(true);
  });
});
