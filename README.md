# git-promote [![npm](https://img.shields.io/npm/v/@supercorks/git-promote?logo=npm)](https://www.npmjs.com/package/@supercorks/git-promote)
Safely promote changes from develop to main using fast-forward-only merges to maintain a clean Git history.

## Installation

### Using npx

You can use this tool without installing it via npx:

```bash
npx @supercorks/git-promote@latest
```

### Setting up a Git Alias

For convenient access, you can set up a Git alias to run the command:

```bash
# Add the alias to your global Git config
git config --global alias.promote '!npx @supercorks/git-promote'
```

Then you can simply use:

```bash
git promote
```

## Usage

1. Checkout your develop branch:
   ```bash
   git checkout develop
   ```

2. Run the git-promote command:
   ```bash
   git promote
   ```

The tool will:

- Verify you're on the develop branch
- Update both develop and main branches
- Ensure develop is up-to-date with main
- Fast-forward merge develop into main
- Push the changes to the remote main branch

## Features

- Only allows fast-forward merges to maintain a clean Git history
- Prevents unintended merge conflicts or history rewrites
- Simple, intuitive command-line interface
- Provides clear error messages if issues arise
