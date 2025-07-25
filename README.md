# git-promote

Safely promote changes from develop to main using fast-forward-only merges to maintain a clean Git history.

## Installation

You can use this tool without installing it via npx:

```bash
npx git-promote
```

Or install it globally:

```bash
npm install -g git-promote
```

## Usage

1. Checkout your develop branch:
   ```bash
   git checkout develop
   ```

2. Run the git-promote command:
   ```bash
   git-promote
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
