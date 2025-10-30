# GitOps [![npm](https://img.shields.io/npm/v/@supercorks/gitops?logo=npm)](https://www.npmjs.com/package/@supercorks/gitops)
A comprehensive suite of Git operations to streamline your development workflow with safe branch management, automated cleanup, and release automation.

## Commands

- 🚀 [git promote](#-git-promote) - Safely promote changes upstream from develop to main
- 🌊 [git propagate](#-git-propagate) - Propagate changes downstream between branches
- 🧹 [git cleanup](#-git-cleanup) - Remove local branches deleted on remote
- ✅ [git done](#-git-done) - Streamline cleanup workflow after feature branch merge
- 📋 [git release-notes](#-git-release-notes) - Generate release notes and semantic versions
- ✍️ [git wip](#-git-wip) - Quick WIP commit and optional push (blocked on main/develop)
- 💨 [git acp](#-git-acp) - Add, commit, and push (with message)
- 🌱 [git feat](#-git-feat) - Create a semantic feature branch from develop/main


## Installation & Usage

### Quick Start (Recommended)

```bash
# 1. Install as a development dependency
npm install --save-dev @supercorks/gitops@latest

# 2. Set up Git aliases for your project
npx --package @supercorks/gitops git-install-aliases --local

# 3. Use Git aliases for all commands
git promote
git propagate
git cleanup
git done
git release-notes
git wip
git acp "feat: my cool commit"
git feat "my cool idea"
```


_Note: For other installation methods including global installation, on-demand usage with npx, and manual alias setup, see the [Alternative Installation Methods](#alternative-installation-methods) section below._

## Tools Overview

### 🚀 git promote
Promote changes between branches in two modes:

1. Feature branch ➜ develop (squash merge)
2. develop ➜ main (fast-forward only)

**Usage:**
```bash
# From a feature branch (squash merge into develop)
git promote "feat: add amazing capability"

# From develop (fast-forward main)
git promote
```

**Feature Branch ➜ develop Behavior:**
1. Ensures working tree is clean (fails if uncommitted changes)
2. Updates local develop from origin
3. Verifies develop isn't ahead of your feature branch (fails with guidance if it is)
4. Performs: git merge <feature> --no-commit --squash
5. Commits with the message you provide
6. Pushes develop
7. Deletes the local feature branch
8. Deletes the remote feature branch if it exists

Your feature branch history is collapsed into a single semantic commit on develop.

**Develop ➜ main Behavior:**
- Updates develop and main
- Ensures develop can fast-forward to main (ensuring no divergence)
- Fast-forwards main to develop (no merge commits)
- Pushes main

**Why squash feature branches?**
- Keeps develop history concise and semantic
- Avoids noisy iterative commits
- Forces synchronization with develop before merging

**Notes:**
- Commit message is required when promoting from a feature branch
- Running from main is not supported (use develop or a feature branch)
- If develop has new commits you don't have, you must merge/rebase first

### 🌊 git propagate
Propagate changes between branches with two distinct modes based on your current branch.

**Usage:**
```bash
git propagate  # From main: propagate to develop (fast-forward only)
git propagate  # From develop: propagate to other branches (with confirmation)
```

**Features:**
- **From main → develop**: Fast-forward only merge to maintain clean history
- **From develop → other branches**: Interactive mode with user confirmation for each branch
- Automatically updates source and target branches before merging
- Optional push confirmation for each branch when propagating from develop
- Skips main and develop branches when propagating from develop

### 🧹 git cleanup
Remove local branches that have been deleted on the remote to keep your local repository clean.

**Usage:**
```bash
git cleanup  # Can be run from any branch
```

**Features:**
- Automatically identifies branches marked as [gone]
- Safely removes stale local branches
- Fetches and prunes remote branches first
- Provides clear feedback on what's being cleaned

### ✅ git done
Streamline the workflow after a feature branch has been merged and deleted on remote.

**Usage:**
```bash
git done  # Must be run from a feature branch that's been merged/deleted on remote
```

**Features:**
- Verifies the current branch has been properly deleted on remote
- Updates and switches to develop branch
- Automatically runs cleanup to remove stale branches
- Ensures a clean transition back to develop

### 📋 git release-notes
Generate release notes and calculate the next semantic version based on conventional commits.

**Usage:**
```bash
git release-notes                    # Generate release notes from main branch
```

**Features:**
- Analyzes commit history using conventional commit format
- Automatically calculates semantic version bumps (major/minor/patch)
- Generates GitHub release URLs with pre-filled information
- Follows semantic versioning standards

### ✍️ git wip
Create a quick "work in progress" snapshot on your current branch.

Usage:
```bash
# Basics
git wip                                   # Adds all, commits with message "wip", and pushes
git wip --no-push                         # Skips pushing
git wip -np                               # Short flag for --no-push
git wip commit message                    # WIP with "commit message" as the message

# Skipping CI and hooks (order doesn't matter)
git wip --skip ci                         # Append [skip ci]
git wip --skip hooks ci                   # Skip hooks and append [skip ci]
git wip --skip hooks ci "message"         # Skip hooks/ci and use custom message

# Ambiguity-safe conventional commit message
git wip --skip hooks ci ci: conventional commit message
# => commits with message "ci: conventional commit message" and skips hooks + ci

# Back-compat shortcuts (optional)
git wip -nh "spike: try idea"             # Alias for --skip hooks (no hooks)
```

Features:
- Runs: git add . ; git commit -m <message> ; git push (unless --no-push/-np)
- Default commit message is "wip" if none provided
- Supports custom multi-word commit messages as positional args
- Fails on protected branches main or develop
- Exits gracefully if there's nothing to commit
- New default: CI is NOT skipped unless you pass `--skip ci`
- Skip git hooks with `--skip hooks` (legacy `--no-verify` and `-nh` also work)

### 💨 git acp
Stage all changes, create a commit with your provided message, and push the branch. If you are on `main`, an explicit confirmation (`yes`) is required to reduce accidental direct commits.

Usage:
```bash
git acp "feat: add telemetry collection"
git acp "fix: correct null pointer in auth"
git acp -y "chore: skip confirmation"
```

Behavior:
1. Runs `git add .`
2. Commits with the exact message you provide (message is required)
3. Pushes the branch (sets upstream if it doesn't exist yet)
4. Confirmation:
	- On `main`: must type `yes` (unless `--yes/-y` provided)
	- On other branches: press Enter or type `y`/`yes` to continue (unless `--yes/-y` provided)
5. If there is nothing to commit, exits gracefully without pushing

Notes:
- Skip interactive confirmation with `--yes` / `-y` (use responsibly, especially on `main`)
- Does not append `[skip ci]` (use `git wip` if you want automatic CI skipping)
- Intended for quick conventional commits while iterating
- Safeguard for `main` helps prevent accidental direct commits; other branches still ask but default to yes

### 🌱 git feat
Create a new feature branch with a semantic name derived from your message. Must be run from `develop` or `main`.

Usage:
```bash
# Default type is feat
git feat my new awesome feature        # => feat/my-new-awesome-feature

# Override type with a prefix
git feat ci: update github workflow    # => ci/update-github-workflow
git feat fix: address NPE on login     # => fix/address-npe-on-login
```

Behavior:
- Works only on `develop` or `main`
- Checks if your base branch is up to date with origin; if not, asks to update first (Y/n)
- Parses type prefix (`<type>: `) when provided; otherwise uses `feat`
- Supported types: `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`
- Errors if an unsupported type is provided
- Creates the branch locally and switches to it; you can push with `git push -u origin <branch>`


### ⚙️ git-install-aliases
Install git aliases for all GitOps commands with configurable scope.

**Usage:**
```bash
npx --package @supercorks/gitops git-install-aliase --global        # Install globally for all repositories
npx --package @supercorks/gitops git-install-aliase --local         # Install locally for current repository only
```

**Features:**
- Automatically installs aliases for all GitOps commands
- Supports both global and local installation scope
- Conflict detection prevents installing both scopes simultaneously
- Clear feedback on installation progress and results
- Easy setup for teams and individual developers


## Workflow Integration

These tools are designed to work together in a typical Git flow:

0. **Setup**: Use `npx --package @supercorks/gitops git-install-aliase --local` to set up convenient aliases
1. **Development**: Work on feature branches
2. **Completion**: Use `git done` after your PR is merged and branch deleted
3. **Maintenance**: Use `git cleanup` regularly to remove stale branches
4. **Feature Promotion**: Use `git promote` to move changes from develop to main
5. **Fix Propagation**: Use `git propagate` to spread changes from main to develop or from develop to feature branches
6. **Release**: Use `git release-notes` to generate release information


## Alternative Installation Methods

### Option 1: On-Demand Usage (No Installation)

Use npx to run commands without installing:

```bash
# Individual tools
npx --package @supercorks/gitops git-promote
npx --package @supercorks/gitops git-propagate
npx --package @supercorks/gitops git-cleanup
npx --package @supercorks/gitops git-done
npx --package @supercorks/gitops git-release-notes
npx --package @supercorks/gitops git-install-aliases
npx --package @supercorks/gitops git-wip
npx --package @supercorks/gitops git-acp
npx --package @supercorks/gitops git-feat
```

**Pros:** Always uses latest version, no installation required  
**Cons:** Slower execution, requires internet connection

### Option 2: Local Project Installation (Alternative Usage)

Install as a development dependency and use without Git aliases:

```bash
# Install locally
npm install --save-dev @supercorks/gitops

# Or with yarn
yarn add --dev @supercorks/gitops
```

After local installation, you can run commands in several ways:

```bash
# Using npx (recommended - works from any subdirectory)
npx git-promote
npx git-propagate
npx git-cleanup
npx git-done
npx git-release-notes
npx git-wip

# Direct execution (only from project root)
./node_modules/.bin/git-promote
./node_modules/.bin/git-propagate
./node_modules/.bin/git-cleanup

# Via npm scripts (add to package.json scripts section)
npm run promote  # if you add "promote": "git-promote" to scripts
```

**Pros:** Faster execution, version consistency, works offline  
**Cons:** Requires installation per project, longer command names

### Option 3: Global Installation

Install globally for system-wide access:

```bash
# Install globally
npm install -g @supercorks/gitops

# Or with yarn
yarn global add @supercorks/gitops
```

After global installation:

```bash
# Direct command usage
git-promote
git-propagate
git-cleanup
git-done
git-release-notes
git-wip
```

**Pros:** Available everywhere, simple command names  
**Cons:** Version inconsistency across projects, requires global permissions

### Alternative Git Alias Setup

#### Automatic Installation with Different Scopes

Use the built-in alias installer with different scopes:

```bash
# For npx users (works with any installation method)
npx --package @supercorks/gitops git-install-aliases --global

# For local installation users
npx git-install-aliases --global

# For global installation users
git-install-aliases --global
```

#### Manual Installation

Add aliases to your Git config manually:

```bash
# For npx users (most compatible)
git config --global alias.promote '!npx --package @supercorks/gitops git-promote'
git config --global alias.propagate '!npx --package @supercorks/gitops git-propagate'
git config --global alias.cleanup '!npx --package @supercorks/gitops git-cleanup'
git config --global alias.done '!npx --package @supercorks/gitops git-done'
git config --global alias.release-notes '!npx --package @supercorks/gitops git-release-notes'
git config --global alias.wip '!npx --package @supercorks/gitops git-wip'
git config --global alias.acp '!npx --package @supercorks/gitops git-acp'
git config --global alias.feat '!npx --package @supercorks/gitops git-feat'

# For local/global installation users (shorter)
git config --global alias.promote '!npx git-promote'
git config --global alias.propagate '!npx git-propagate'
git config --global alias.cleanup '!npx git-cleanup'
git config --global alias.done '!npx git-done'
git config --global alias.release-notes '!npx git-release-notes'
git config --global alias.wip '!npx git-wip'
git config --global alias.acp '!npx git-acp'
git config --global alias.feat '!npx git-feat'
```


## Developer Guide

When developing, simply run `npm run build` and use `npx` to run local commands.
```shell
npx git-acp "feat: new changes to gitops"
npx git-promote
npx git propagate
# ...
```

## Testing

This repo uses Vitest for tests.

```bash
# Install dependencies
npm install

# Run the full test suite
npm test

# Watch mode during development
npm run test:watch
```

Tested Node versions: 18, 20, and 22 (via CI matrix). If you use nvm, an `.nvmrc` is provided (20).
