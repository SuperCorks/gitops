# GitOps Suite [![npm](https://img.shields.io/npm/v/@supercorks/gitops?logo=npm)](https://www.npmjs.com/package/@supercorks/gitops)
A comprehensive suite of Git operations tools to streamline your development workflow with safe branch management, automated cleanup, and release automation.

## Installation

### Using npx

You can use these tools without installing them via npx:

```bash
# Individual tools
npx @supercorks/gitops git-promote
npx @supercorks/gitops git-cleanup
npx @supercorks/gitops git-done
npx @supercorks/gitops git-release-notes
npx @supercorks/gitops git-install-aliases
```

### Setting up Git Aliases

#### Automatic Installation (Recommended)

Use the built-in alias installer to quickly set up all aliases:

```bash
# Install globally for all repositories
npx @supercorks/gitops git-install-aliases --global

# Install locally for current repository only  
npx @supercorks/gitops git-install-aliases --local
```

#### Manual Installation

For manual setup, you can add aliases to your global Git config:

```bash
# Add aliases to your global Git config manually
git config --global alias.promote '!npx @supercorks/gitops git-promote'
git config --global alias.cleanup '!npx @supercorks/gitops git-cleanup'
git config --global alias.done '!npx @supercorks/gitops git-done'
git config --global alias.release-notes '!npx @supercorks/gitops git-release-notes'
```

After setting up aliases (either method), you can use them directly:

```bash
git promote
git cleanup
git done
git release-notes
```

## Tools Overview

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

## Workflow Integration

These tools are designed to work together in a typical Git flow:

0. **Setup**: Use `git install-aliases --global` to set up convenient aliases
1. **Development**: Work on feature branches
2. **Completion**: Use `git done` after your PR is merged and branch deleted
3. **Maintenance**: Use `git cleanup` regularly to remove stale branches
4. **Release**: Use `git promote` to move changes from develop to main
5. **Documentation**: Use `git release-notes` to generate release information
