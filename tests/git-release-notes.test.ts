import { describe, it, expect } from 'vitest';
import { initRepo, createAndCheckoutBranch, write, run, addOrigin } from './utils';
import { resolve } from 'node:path';

function tag(repo: string, name: string) {
  run('git', ['tag', name], repo);
}

function commit(repo: string, message: string) {
  write(repo, `file-${Math.random().toString(36).slice(2)}.txt`, message);
  run('git', ['add', '.'], repo);
  run('git', ['commit', '-m', message], repo);
}

describe('git release-notes', () => {
  it('calculates minor bump when feat present (fallback URL if non-GitHub origin)', () => {
    const repo = initRepo(undefined, 'main');
    const remote = addOrigin(repo);
    // Push initial main so fetch --all is happy
    run('git', ['push', '-u', 'origin', 'main'], repo);

    // Tag v1.0.0
    tag(repo, 'v1.0.0');

    // Commits since tag: one fix and one feat
    commit(repo, 'fix: patch issue');
    commit(repo, 'feat: add feature');

    const cli = resolve(__dirname, '..', 'build', 'git-release-notes.js');
    const res = run(process.execPath, [cli], repo);
    expect(res.status).toBe(0);
    expect(res.stdoutStr).toMatch(/Current version: v1\.0\.0/);
    expect(res.stdoutStr).toMatch(/New version calculated: v1\.1\.0/);
    // Since origin is local bare, URL fallback likely used
    expect(res.stdoutStr).toMatch(/Create a new release with tag: v1\.1\.0/);
  });

  it('calculates major bump when breaking change present', () => {
    const repo = initRepo(undefined, 'main');
    const remote = addOrigin(repo);
    run('git', ['push', '-u', 'origin', 'main'], repo);
    tag(repo, 'v2.3.4');

    commit(repo, 'feat!: breaking api change');

    const cli = resolve(__dirname, '..', 'build', 'git-release-notes.js');
    const res = run(process.execPath, [cli], repo);
    expect(res.status).toBe(0);
    expect(res.stdoutStr).toMatch(/Current version: v2\.3\.4/);
    expect(res.stdoutStr).toMatch(/New version calculated: v3\.0\.0/);
  });

  it('errors when run from non-main branch', () => {
    const repo = initRepo(undefined, 'develop');
    const cli = resolve(__dirname, '..', 'build', 'git-release-notes.js');
    const res = run(process.execPath, [cli], repo);
    expect(res.status).not.toBe(0);
    expect(res.stderrStr).toMatch(/must be generated from the 'main' branch/i);
  });

  it('calculates patch bump when docs commit present', () => {
    const repo = initRepo(undefined, 'main');
    const remote = addOrigin(repo);
    run('git', ['push', '-u', 'origin', 'main'], repo);
    tag(repo, 'v0.5.0');

    commit(repo, 'docs: update readme');

    const cli = resolve(__dirname, '..', 'build', 'git-release-notes.js');
    const res = run(process.execPath, [cli], repo);
    expect(res.status).toBe(0);
    expect(res.stdoutStr).toMatch(/Current version: v0\.5\.0/);
    expect(res.stdoutStr).toMatch(/New version calculated: v0\.5\.1/);
  });

  it('prints no-new-commits message when nothing since tag', () => {
    const repo = initRepo(undefined, 'main');
    const remote = addOrigin(repo);
    run('git', ['push', '-u', 'origin', 'main'], repo);
    tag(repo, 'v2.0.0');

    const cli = resolve(__dirname, '..', 'build', 'git-release-notes.js');
    const res = run(process.execPath, [cli], repo);
    expect(res.status).toBe(0);
    expect(res.stdoutStr).toMatch(/No new commits found on 'main' since last relevant tag/);
  });
});
