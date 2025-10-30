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
    expect(wip).toContain('npx --package @supercorks/gitops git-wip');

    const acp = run('git', ['config', '--local', '--get', 'alias.acp'], repo).stdoutStr.trim();
    expect(acp).toContain('npx --package @supercorks/gitops git-acp');

    const list = run('git', ['config', '--local', '--get-regexp', '^alias\.'], repo).stdoutStr.trim().split('\n');
    // Expect all 8 aliases to be installed
    expect(list.length).toBeGreaterThanOrEqual(8);
  });
});
