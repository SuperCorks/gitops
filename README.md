# GitOps [![npm](https://img.shields.io/npm/v/@supercorks/gitops?logo=npm)](https://www.npmjs.com/package/@supercorks/gitops)
A comprehensive suite of Git operations to streamline your development workflow with safe branch management, automated cleanup, and release automation.

## Commands

- 🚀 [git promote](#-git-promote) - Safely promote changes upstream from develop to main
- 🌊 [git propagate](#-git-propagate) - Propagate changes downstream between branches
- 🧹 [git cleanup](#-git-cleanup) - Remove local branches deleted on remote
- ✅ [git done](#-git-done) - Streamline cleanup workflow after feature branch merge
- 📋 [git release-notes](#-git-release-notes) - Generate release notes and semantic versions
- ✍️ [git wip](#-git-wip) - Quick WIP commit and optional push (blocked on main/develop)


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
```


_Note: For other installation methods including global installation, on-demand usage with npx, and manual alias setup, see the [Alternative Installation Methods](#alternative-installation-methods) section below._

## Tools Overview

### ⚙️ git-install-aliases
Install git aliases for all GitOps suite commands with configurable scope.

**Usage:**
```bash
git install-aliases --global        # Install globally for all repositories
git install-aliases --local         # Install locally for current repository only
```

**Features:**
- Automatically installs aliases for all GitOps commands
- Supports both global and local installation scope
- Conflict detection prevents installing both scopes simultaneously
- Clear feedback on installation progress and results
- Easy setup for teams and individual developers

### 🚀 git-promote
Safely promote changes from develop to main using fast-forward-only merges to maintain a clean Git history.

**Usage:**
```bash
git promote  # Must be run from develop branch
```

**Features:**
- Only allows fast-forward merges to maintain clean history
- Prevents unintended merge conflicts or history rewrites
- Automatically updates both develop and main branches
- Pushes changes to remote main branch

### 🌊 git-propagate
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

### 🧹 git-cleanup
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

### ✅ git-done
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

### 📋 git-release-notes
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

### ✍️ git-wip
Create a quick "work in progress" snapshot on your current branch.

Usage:
```bash
git wip            # Adds all, commits with message "wip", and pushes
git wip --no-push  # Skips pushing
git wip -np        # Short flag for --no-push
```

Features:
- Runs: git add . ; git commit -m "wip" ; git push (unless --no-push/-np)
- Fails on protected branches main or develop
- Exits gracefully if there's nothing to commit

## Workflow Integration

These tools are designed to work together in a typical Git flow:

0. **Setup**: Use `git install-aliases --global` to set up convenient aliases
1. **Development**: Work on feature branches
2. **Completion**: Use `git done` after your PR is merged and branch deleted
3. **Maintenance**: Use `git cleanup` regularly to remove stale branches
4. **Release**: Use `git promote` to move changes from develop to main
5. **Propagation**: Use `git propagate` to spread changes from main to develop or from develop to feature branches
6. **Documentation**: Use `git release-notes` to generate release information


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

# For local/global installation users (shorter)
git config --global alias.promote '!npx git-promote'
git config --global alias.propagate '!npx git-propagate'
git config --global alias.cleanup '!npx git-cleanup'
git config --global alias.done '!npx git-done'
git config --global alias.release-notes '!npx git-release-notes'
git config --global alias.wip '!npx git-wip'
```
