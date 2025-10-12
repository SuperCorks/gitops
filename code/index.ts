#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Read version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Determine which script to run based on how this was invoked
const scriptName = path.basename(process.argv[1]);

// Common yargs configuration
const commonYargs = yargs(hideBin(process.argv))
  .version(version)
  .help()
  .alias('help', 'h');

switch (scriptName) {
  case 'git-promote':
    // Configure yargs for git-promote (no additional options needed)
    commonYargs.usage('Usage: git-promote\n\nSafely promote changes from develop to main using fast-forward-only merges.');
    require('./git-promote');
    break;
    
  case 'git-cleanup':
    // Configure yargs for git-cleanup (no additional options needed)
    commonYargs.usage('Usage: git-cleanup\n\nRemove local branches that have been deleted on the remote.');
    require('./git-cleanup');
    break;
    
  case 'git-done':
    // Configure yargs for git-done (no additional options needed)
    commonYargs.usage('Usage: git-done\n\nStreamline workflow after a feature branch has been merged and deleted on remote.');
    require('./git-done');
    break;
    
  case 'git-release-notes':
    // Configure yargs for git-release-notes (no additional options needed)
    commonYargs.usage('Usage: git-release-notes\n\nGenerate release notes and calculate semantic version.');
    require('./git-release-notes');
    break;
    
  case 'git-install-aliases':
    // Configure yargs for git-install-aliases with scope options
    commonYargs
      .usage('Usage: git-install-aliases [options]\n\nInstall git aliases for all GitOps suite commands.')
      .option('global', {
        alias: 'g',
        type: 'boolean',
        description: 'Install aliases globally for all repositories',
        conflicts: 'local'
      })
      .option('local', {
        alias: 'l',
        type: 'boolean', 
        description: 'Install aliases locally for current repository only',
        conflicts: 'global'
      })
      .check((argv) => {
        if (!argv.global && !argv.local) {
          throw new Error('You must specify either --global or --local');
        }
        return true;
      });
    require('./git-install-aliases');
    break;
  
  case 'git-wip':
    // Configure yargs for git-wip
    commonYargs
      .usage('Usage: git-wip [--no-push|-np]\n\nCreate a quick WIP commit and optionally push it (skips push with --no-push or -np).');
    require('./git-wip');
    break;
  case 'git-acp':
    // Configure yargs for git-acp
    commonYargs
      .usage('Usage: git-acp <commit message>\n\nStage all changes, commit with the provided message, then push. Prompts for confirmation on main.');
    require('./git-acp');
    break;
  case 'git-feat':
    // Configure yargs for git-feat
    commonYargs
      .usage('Usage: git-feat <semantic message>\n\nCreate a feature branch from develop or main using semantic naming (e.g., feat/my-new-feature).');
    require('./git-feat');
    break;
    
  default:
    console.error(`Unknown command: ${scriptName}`);
  console.error('Available commands: git-promote, git-cleanup, git-done, git-release-notes, git-install-aliases, git-wip, git-acp, git-feat');
    process.exit(1);
}
