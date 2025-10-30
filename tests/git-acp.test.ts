import { describe, it, expect } from 'vitest';
import {
  initRepo,
  createAndCheckoutBranch,
  write,
  head,
  addOrigin,
  upstream,
  remoteHasBranch,
  runAcp,
  run,
} from './utils';

function expectOk(res: ReturnType<typeof runAcp>) {
  if (res.status !== 0) {
    throw new Error(`Expected exit 0, got ${res.status}\nstdout:\n${res.stdoutStr}\nstderr:\n${res.stderrStr}`);
  }
}

function expectFail(res: ReturnType<typeof runAcp>) {
  if (res.status === 0) {
    throw new Error(`Expected non-zero exit, got 0\nstdout:\n${res.stdoutStr}\nstderr:\n${res.stderrStr}`);
  }
}

describe('git acp', () => {
  it('requires a commit message', () => {
    const repo = initRepo(undefined, 'develop');
    const res = runAcp(repo, []);
    expect(res.status).not.toBe(0);
    expect(res.stderrStr).toMatch(/Commit message required/i);
  });

  it('asks for explicit yes on main; -y bypasses', () => {
    const repo = initRepo(undefined, 'main');
    write(repo, 'x.txt', '1');
    // Without -y, needs input 'yes' to proceed
  const resAbort = runAcp(repo, ['feat: x'], 'no\n');
    expect(resAbort.status).not.toBe(0);
    expect(resAbort.stderrStr).toMatch(/expected 'yes'/i);

    const resOk = runAcp(repo, ['-y', 'feat: x']);
    expectOk(resOk);
  });

  it('proceeds on non-main with -y and sets upstream on first push', () => {
    const repo = initRepo();
    createAndCheckoutBranch(repo, 'feat/acp');
    const remote = addOrigin(repo);
    write(repo, 'a.txt', 'a');
    const res = runAcp(repo, ['-y', 'feat: add a']);
    expectOk(res);
    expect(upstream(repo)).toBe('origin/feat/acp');
    expect(remoteHasBranch(remote, 'feat/acp')).toBe(true);
  });

  it('skips push when no remote is configured', () => {
    const repo = initRepo();
    createAndCheckoutBranch(repo, 'feat/local');
    write(repo, 'b.txt', 'b');
    const res = runAcp(repo, ['-y', 'feat: local only']);
    expectOk(res);
    expect(res.stdoutStr + res.stderrStr).toMatch(/No remote configured|Push skipped/i);
  });

  it('exits gracefully when nothing to commit', () => {
    const repo = initRepo();
    createAndCheckoutBranch(repo, 'feat/noop');
    const res = runAcp(repo, ['-y', 'feat: noop']);
    // First call will make a commit with staged initial changes? No, nothing staged, commit should no-op
    // However, acp runs `git add .` first, so it will commit only if there are changes. With empty tree, nothing to commit and exit 0.
    expect(res.status).toBe(0);
    expect(res.stdoutStr + res.stderrStr).toMatch(/Nothing to commit/i);
  });
});
