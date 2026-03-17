import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { initRepo, write, run, addOrigin, runRelease, tmpDir } from './utils';

function tag(repo: string, name: string) {
  run('git', ['tag', name], repo);
}

function commit(repo: string, message: string) {
  write(repo, `file-${Math.random().toString(36).slice(2)}.txt`, message);
  run('git', ['add', '.'], repo);
  run('git', ['commit', '-m', message], repo);
}

function makeFakeExecutable(dir: string, name: string, script: string) {
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, name);
  writeFileSync(filePath, script, { encoding: 'utf-8' });
  chmodSync(filePath, 0o755);
  return filePath;
}

describe('git release', () => {
  it('shows accurate help text', () => {
    const repo = initRepo(undefined, 'main');
    const res = runRelease(repo, ['--help']);

    expect(res.status).toBe(0);
    expect(res.stdoutStr).toMatch(/Usage: git release <link\|draft>/);
    expect(res.stdoutStr).toMatch(/aliases: notes/);
    expect(res.stdoutStr).toMatch(/draft/);
  });

  it('calculates minor bump when link is used (fallback URL if non-GitHub origin)', () => {
    const repo = initRepo(undefined, 'main');
    addOrigin(repo);
    run('git', ['push', '-u', 'origin', 'main'], repo);
    tag(repo, 'v1.0.0');
    commit(repo, 'fix: patch issue');
    commit(repo, 'feat: add feature');

    const res = runRelease(repo, ['link']);
    expect(res.status).toBe(0);
    expect(res.stdoutStr).toMatch(/Current version: v1\.0\.0/);
    expect(res.stdoutStr).toMatch(/New version calculated: v1\.1\.0/);
    expect(res.stdoutStr).toMatch(/Create a new release with tag: v1\.1\.0/);
  });

  it('accepts notes as an alias for link', () => {
    const repo = initRepo(undefined, 'main');
    addOrigin(repo);
    run('git', ['push', '-u', 'origin', 'main'], repo);
    tag(repo, 'v2.3.4');

    commit(repo, 'feat!: breaking api change');

    const res = runRelease(repo, ['notes']);
    expect(res.status).toBe(0);
    expect(res.stdoutStr).toMatch(/Current version: v2\.3\.4/);
    expect(res.stdoutStr).toMatch(/New version calculated: v3\.0\.0/);
  });

  it('errors when run from non-main branch', () => {
    const repo = initRepo(undefined, 'develop');
    const res = runRelease(repo, ['link']);
    expect(res.status).not.toBe(0);
    expect(res.stderrStr).toMatch(/must be generated from the 'main' branch/i);
  });

  it('calculates patch bump when docs commit present', () => {
    const repo = initRepo(undefined, 'main');
    addOrigin(repo);
    run('git', ['push', '-u', 'origin', 'main'], repo);
    tag(repo, 'v0.5.0');

    commit(repo, 'docs: update readme');

    const res = runRelease(repo, ['link']);
    expect(res.status).toBe(0);
    expect(res.stdoutStr).toMatch(/Current version: v0\.5\.0/);
    expect(res.stdoutStr).toMatch(/New version calculated: v0\.5\.1/);
  });

  it('prints no-new-commits message when nothing since tag', () => {
    const repo = initRepo(undefined, 'main');
    addOrigin(repo);
    run('git', ['push', '-u', 'origin', 'main'], repo);
    tag(repo, 'v2.0.0');

    const res = runRelease(repo, ['link']);
    expect(res.status).toBe(0);
    expect(res.stdoutStr).toMatch(/No new commits found on 'main' since last relevant tag/);
  });

  it('fails draft when gh is not installed', () => {
    const repo = initRepo(undefined, 'main');
    addOrigin(repo);
    run('git', ['push', '-u', 'origin', 'main'], repo);
    tag(repo, 'v1.0.0');
    commit(repo, 'fix: patch issue');

    const binDir = tmpDir('gitops-bin-');
    makeFakeExecutable(
      binDir,
      'gh',
      '#!/bin/sh\necho "gh: command not found" 1>&2\nexit 127\n',
    );

    const res = runRelease(repo, ['draft'], { PATH: `${binDir}:${process.env.PATH ?? ''}` }, 'y\n');
    expect(res.status).not.toBe(0);
    expect(res.stderrStr).toMatch(/`gh` CLI is not installed/i);
  });

  it('fails draft when gh is not authenticated', () => {
    const repo = initRepo(undefined, 'main');
    addOrigin(repo);
    run('git', ['push', '-u', 'origin', 'main'], repo);
    tag(repo, 'v1.0.0');
    commit(repo, 'fix: patch issue');

    const binDir = tmpDir('gitops-bin-');
    makeFakeExecutable(
      binDir,
      'gh',
      '#!/bin/sh\nif [ "$1" = "--version" ]; then\n  echo "gh version 2.0.0"\n  exit 0\nfi\nif [ "$1" = "auth" ] && [ "$2" = "status" ]; then\n  echo "not logged in" 1>&2\n  exit 1\nfi\necho "unexpected gh call" 1>&2\nexit 2\n',
    );

    const res = runRelease(repo, ['draft'], { PATH: `${binDir}:${process.env.PATH ?? ''}` }, 'y\n');
    expect(res.status).not.toBe(0);
    expect(res.stderrStr).toMatch(/`gh` CLI is not authenticated/i);
  });
});
