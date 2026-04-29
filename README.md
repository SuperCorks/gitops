# GitOps [![npm](https://img.shields.io/npm/v/@supercorks/gitops?logo=npm)](https://www.npmjs.com/package/@supercorks/gitops)
A comprehensive suite of Git operations to streamline your development workflow with safe branch management, automated cleanup, and release automation.

## Commands

- 🚀 [git promote](#-git-promote) - Safely promote changes up your integration branch chain
- 🌊 [git propagate](#-git-propagate) - Propagate changes downstream between branches
- 🧹 [git cleanup](#-git-cleanup) - Remove local branches deleted on remote
- ✅ [git done](#-git-done) - Streamline cleanup workflow after feature branch merge
- 📋 [git release](#-git-release) - Generate release links and draft releases
- ✍️ [git wip](#-git-wip) - Quick WIP commit and optional push (blocked on main/develop)
- 💨 [git acp](#-git-acp) - Add, commit, and push (with message)
- 🌱 [git feat](#-git-feat) - Create a semantic feature branch from develop/main


## Installation & Usage

### Quick Start (Recommended)

```bash
# 1. Install globally
npm install -g @supercorks/gitops@latest

# 2. Set up Git aliases globally
git-install-aliases --global

# 3. Use Git aliases from any repository
git promote
git propagate
git cleanup
git done
git release link
git wip
git acp "feat: my cool commit"
git feat "my cool idea"
```


_Note: For other installation methods including local project installation, on-demand usage with npx, and manual alias setup, see the [Installation Options](#installation-options) section below._

## Tools Overview

### 🚀 git promote
Promote changes between branches using the available integration chain:

1. Feature branch ➜ develop, staging, or main (squash merge into the nearest available integration branch)
2. develop ➜ staging or main (fast-forward only)
3. staging ➜ main (fast-forward only)

**Usage:**
```bash
# From a feature branch (squash merge into the nearest available integration branch)
git promote "feat: add amazing capability"

# From develop or staging (fast-forward the next branch)
git promote
```

**Feature Branch Promotion Behavior:**
1. Ensures working tree is clean (fails if uncommitted changes)
2. Targets `develop` when present, otherwise `staging`, otherwise `main`
3. Updates the target branch from origin when available
4. Verifies the target branch isn't ahead of your feature branch (warns if it is)
5. Performs: git merge <feature> --no-commit --squash
6. Commits with the message you provide
7. Pushes the target branch
8. Deletes the local feature branch
9. Deletes the remote feature branch if it exists

Your feature branch history is collapsed into a single semantic commit on the nearest available integration branch.

**Integration Branch Promotion Behavior:**
- `develop` fast-forwards into `staging` when `staging` exists, otherwise directly into `main`
- `staging` fast-forwards into `main`
- Updates both branches before merging
- Uses fast-forward-only merges to prevent hidden divergence
- Pushes the promoted target branch

**Why squash feature branches?**
- Keeps integration history concise and semantic
- Avoids noisy iterative commits
- Forces synchronization with the nearest integration branch before merging

**Notes:**
- Commit message is required when promoting from a feature branch
- Running from `main` is not supported
- `develop` and `staging` are optional; the command skips missing levels automatically
- If the target integration branch has new commits you don't have, you should merge/rebase first

### 🌊 git propagate
Propagate changes between branches with two distinct modes based on your current branch.

**Usage:**
```bash
git propagate  # From main/staging/develop: propagate to the next branch in the chain
git propagate  # From the lowest available integration branch: propagate to feature branches
```

**Features:**
- **From main → staging → develop**: Fast-forward only merges, automatically skipping missing branches
- **From the lowest available integration branch → other branches**: Interactive mode with user confirmation for each branch
- Automatically updates source and target branches before merging
- Optional push confirmation for each branch when propagating to feature branches
- Skips `main`, `staging`, and `develop` when propagating to feature branches

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

### 📋 git release
Generate a release link or create a draft release based on conventional commits on `main`.

**Usage:**
```bash
git release link                     # Print a pre-filled GitHub release URL
git release notes                    # Alias for `git release link`
git release draft                    # Preview and create a draft GitHub release with `gh`
```

**Features:**
- Analyzes commit history using conventional commit format
- Automatically calculates semantic version bumps (major/minor/patch)
- Generates GitHub release URLs with pre-filled title and body
- Previews draft release content before creating it
- Requires the `gh` CLI to be installed and authenticated for draft creation
- Follows semantic versioning standards
- Attempts to open the created draft in your browser on macOS, Linux, and Windows

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
npx --package @supercorks/gitops git-install-aliases --global       # Install globally for all repositories
npx --package @supercorks/gitops git-install-aliases --local        # Install locally for current repository only
```

**Features:**
- Automatically installs aliases for all GitOps commands
- Supports both global and local installation scope
- Conflict detection prevents installing both scopes simultaneously
- Clear feedback on installation progress and results
- Easy setup for teams and individual developers


## Workflow Integration

These tools are designed to work together in a typical Git flow:

0. **Setup**: Install `@supercorks/gitops` globally and run `git-install-aliases --global` to set up convenient aliases
1. **Development**: Work on feature branches
2. **Completion**: Use `git done` after your PR is merged and branch deleted
3. **Maintenance**: Use `git cleanup` regularly to remove stale branches
4. **Feature Promotion**: Use `git promote` to move changes up `feature -> develop -> staging -> main`
5. **Fix Propagation**: Use `git propagate` to spread changes back down `main -> staging -> develop -> feature branches`
6. **Release**: Use `git release link` to generate release information or `git release draft` to create a draft


## Installation Options

### Option 1: Global Installation (Recommended)

Install globally for system-wide access and pair it with global Git aliases:

```bash
# Install globally
npm install -g @supercorks/gitops

# Or with yarn
yarn global add @supercorks/gitops

# Install aliases globally
git-install-aliases --global
```

After global installation:

```bash
# Direct command usage
git-promote
git-propagate
git-cleanup
git-done
git-release link
git-release draft
git-wip

# Or use the preferred git aliases
git promote
git propagate
git cleanup
git done
git release link
git release draft
git wip
```

**Pros:** Available everywhere, simple setup, works consistently across repositories  
**Cons:** Requires global permissions

### Option 2: On-Demand Usage (No Installation)

Use npx to run commands without installing:

```bash
# Individual tools
npx --package @supercorks/gitops git-promote
npx --package @supercorks/gitops git-propagate
npx --package @supercorks/gitops git-cleanup
npx --package @supercorks/gitops git-done
npx --package @supercorks/gitops git-release link
npx --package @supercorks/gitops git-release draft
npx --package @supercorks/gitops git-install-aliases
npx --package @supercorks/gitops git-wip
npx --package @supercorks/gitops git-acp
npx --package @supercorks/gitops git-feat
```

**Pros:** Always uses latest version, no installation required  
**Cons:** Slower execution, requires internet connection

### Option 3: Local Project Installation (Alternative Usage)

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
npx git-release link
npx git-release draft
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
git config --global alias.promote '!npx --yes --package @supercorks/gitops@latest git-promote'
git config --global alias.propagate '!npx --yes --package @supercorks/gitops@latest git-propagate'
git config --global alias.cleanup '!npx --yes --package @supercorks/gitops@latest git-cleanup'
git config --global alias.done '!npx --yes --package @supercorks/gitops@latest git-done'
git config --global alias.release '!npx --yes --package @supercorks/gitops@latest git-release'
git config --global alias.wip '!npx --yes --package @supercorks/gitops@latest git-wip'
git config --global alias.acp '!npx --yes --package @supercorks/gitops@latest git-acp'
git config --global alias.feat '!npx --yes --package @supercorks/gitops@latest git-feat'

# For local/global installation users (shorter)
git config --global alias.promote '!npx git-promote'
git config --global alias.propagate '!npx git-propagate'
git config --global alias.cleanup '!npx git-cleanup'
git config --global alias.done '!npx git-done'
git config --global alias.release '!npx git-release'
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
