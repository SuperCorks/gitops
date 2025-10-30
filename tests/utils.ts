import { mkdtempSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync, SpawnSyncReturns } from 'node:child_process';

export type CmdResult = SpawnSyncReturns<Buffer> & { stdoutStr: string; stderrStr: string };

export function run(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): CmdResult {
  const res = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'pipe',
    encoding: 'buffer',
  });
  const stdoutStr = (res.stdout || Buffer.alloc(0)).toString('utf-8');
  const stderrStr = (res.stderr || Buffer.alloc(0)).toString('utf-8');
  return Object.assign(res, { stdoutStr, stderrStr });
}

export function tmpDir(prefix = 'gitops-wip-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function initRepo(baseDir?: string, initBranch?: string): string {
  const dir = baseDir ?? tmpDir();
  run('git', ['init'], dir);
  // Configure user for non-interactive commits
  run('git', ['config', 'user.email', 'you@example.com'], dir);
  run('git', ['config', 'user.name', 'Your Name'], dir);
  if (initBranch) {
    run('git', ['checkout', '-B', initBranch], dir);
  }
  // Initial commit so HEAD exists
  writeFileSync(join(dir, 'README.md'), '# temp repo\n');
  run('git', ['add', '.'], dir);
  run('git', ['commit', '-m', 'init'], dir);
  return dir;
}

export function createAndCheckoutBranch(repoDir: string, branch: string) {
  run('git', ['checkout', '-B', branch], repoDir);
}

export function write(repoDir: string, file: string, content: string) {
  const full = join(repoDir, file);
  const parent = resolve(full, '..');
  try { mkdirSync(parent, { recursive: true }); } catch {}
  writeFileSync(full, content);
}

export function head(repoDir: string): string {
  return run('git', ['rev-parse', 'HEAD'], repoDir).stdoutStr.trim();
}

export function lastMessage(repoDir: string): string {
  return run('git', ['log', '-1', '--pretty=%B'], repoDir).stdoutStr.trim();
}

export function setFailingPreCommitHook(repoDir: string, message = 'HOOK FAIL'): void {
  const hookPath = join(repoDir, '.git', 'hooks', 'pre-commit');
  const script = `#!/usr/bin/env bash\necho "${message}" 1>&2\nexit 1\n`;
  writeFileSync(hookPath, script, { encoding: 'utf-8' });
  chmodSync(hookPath, 0o755);
}

export function addOrigin(repoDir: string, bareDir?: string): string {
  const remoteDir = bareDir ?? tmpDir('gitops-remote-');
  // Make it a bare repo
  run('git', ['init', '--bare'], remoteDir);
  run('git', ['remote', 'add', 'origin', remoteDir], repoDir);
  return remoteDir;
}

export function remoteHasBranch(remoteDir: string, ref: string): boolean {
  const result = run('git', ['--git-dir', remoteDir, 'rev-parse', '--verify', `refs/heads/${ref}`], process.cwd());
  return result.status === 0 && /^[0-9a-f]{40}\n?$/.test(result.stdoutStr);
}

export function upstream(repoDir: string): string | null {
  const res = run('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], repoDir);
  if (res.status !== 0) return null;
  return res.stdoutStr.trim();
}

export function runWip(repoDir: string, args: string[] = []): CmdResult {
  const cli = resolve(__dirname, '..', 'build', 'git-wip.js');
  return run(process.execPath, [cli, ...args], repoDir);
}
