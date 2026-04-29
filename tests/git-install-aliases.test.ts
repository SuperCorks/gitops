import { describe, it, expect } from 'vitest';
import { initRepo, run } from './utils';
import { resolve } from 'node:path';

describe('git-install-aliases', () => {
  it('installs aliases locally', () => {
    const repo = initRepo();
    const cli = resolve(__dirname, '..', 'build', 'git-install-aliases.js');
    const res = run(process.execPath, [cli, '--local'], repo);
    expect(res.status).toBe(0);

    // Verify several aliases exist
    const wip = run('git', ['config', '--local', '--get', 'alias.wip'], repo).stdoutStr.trim();
    expect(wip).toContain('npx --yes --package @supercorks/gitops@latest git-wip');

    const acp = run('git', ['config', '--local', '--get', 'alias.acp'], repo).stdoutStr.trim();
    expect(acp).toContain('npx --yes --package @supercorks/gitops@latest git-acp');

    const release = run('git', ['config', '--local', '--get', 'alias.release'], repo).stdoutStr.trim();
    expect(release).toContain('npx --yes --package @supercorks/gitops@latest git-release');

    const legacyReleaseNotes = run('git', ['config', '--local', '--get', 'alias.release-notes'], repo).stdoutStr.trim();
    expect(legacyReleaseNotes).toBe('');

    const list = run('git', ['config', '--local', '--get-regexp', '^alias\.'], repo).stdoutStr.trim().split('\n');
    // Expect all 8 aliases to be installed
    expect(list.length).toBeGreaterThanOrEqual(8);
  });
});
