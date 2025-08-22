#!/usr/bin/env node

import { execSync } from "child_process";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import * as os from "os";

// This script installs git aliases for all GitOps suite commands
// Usage:
//   git install-aliases --global    # Install globally for all repositories
//   git install-aliases --local     # Install locally for current repository only

// --- Argument Parsing ---
const argv = yargs(hideBin(process.argv))
  .option("global", {
    alias: "g",
    type: "boolean",
    description: "Install aliases globally for all repositories",
    conflicts: "local"
  })
  .option("local", {
  alias: "l",
  type: "boolean",
  description: "Install aliases locally for current repository only",
    conflicts: "global"
  })
  .check((argv) => {
    if (!argv.global && !argv.local) {
      throw new Error("You must specify either --global or --local");
    }
    return true;
  })
  .help()
  .alias("help", "h").argv as { global?: boolean; local?: boolean };

// Determine scope
const scope = argv.global ? "--global" : "--local";
const scopeText = argv.global ? "globally" : "locally";

// Define aliases to install
const aliases = [
  {
    name: "promote",
    command: "!npx --package @supercorks/gitops git-promote",
    description: "Promote changes from develop to main"
  },
  {
    name: "propagate",
    command: "!npx --package @supercorks/gitops git-propagate",
    description: "Propagate changes between branches"
  },
  {
    name: "cleanup", 
    command: "!npx --package @supercorks/gitops git-cleanup",
    description: "Remove stale local branches"
  },
  {
    name: "done",
    command: "!npx --package @supercorks/gitops git-done", 
    description: "Complete feature branch workflow"
  },
  {
    name: "release-notes",
    command: "!npx --package @supercorks/gitops git-release-notes",
    description: "Generate release notes and version"
  },
  {
    name: "wip",
  command: "!npx --package @supercorks/gitops git-wip",
  description: "Create a WIP commit and optionally push (use --no-push to skip)"
  }
];

console.log(`🔧 Installing GitOps suite aliases ${scopeText}...`);

// Cross-platform command quoting function
function getQuotedCommand(command: string): string {
  // On Windows, we need to use double quotes and escape any existing double quotes
  // On Unix-like systems, single quotes work better and avoid variable expansion
  if (os.platform() === "win32") {
    // Escape any existing double quotes in the command
    const escapedCommand = command.replace(/"/g, '\\"');
    return `"${escapedCommand}"`;
  } else {
    return `'${command}'`;
  }
}

// Install each alias
aliases.forEach(alias => {
  try {
    console.log(`  ✓ git ${alias.name} - ${alias.description}`);
    const quotedCommand = getQuotedCommand(alias.command);
    execSync(`git config ${scope} alias.${alias.name} ${quotedCommand}`, { stdio: "pipe" });
  } catch (error) {
    console.error(`  ❌ Failed to install alias: git ${alias.name}`);
    console.error(`     Error: ${error}`);
    process.exit(1);
  }
});

console.log(`\n🎉 Successfully installed ${aliases.length} git aliases ${scopeText}!`);
console.log("\nYou can now use:");
aliases.forEach(alias => {
  console.log(`  git ${alias.name}`);
});

if (argv.global) {
  console.log("\n💡 These aliases are now available in all your git repositories.");
} else {
  console.log("\n💡 These aliases are available in this repository only.");
}
