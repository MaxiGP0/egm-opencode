import path from 'node:path';
import { install, status, uninstall } from './install.mjs';
import { PACKAGE_ROOT } from './templates.mjs';
import fs from 'node:fs/promises';

const HELP = `egm-opencode - Elephant-Goldfish Model for OpenCode V2

Usage:
  egm-opencode install [--global | --project [dir] | --prefix <dir>] [--force] [--dry-run]
  egm-opencode uninstall [--global | --project [dir] | --prefix <dir>] [--force]
  egm-opencode status [--global | --project [dir] | --prefix <dir>]
  egm-opencode help
  egm-opencode version

Scopes:
  --global              Install into the OpenCode global config directory (default).
  --project [dir]       Install into <dir>/.opencode. Defaults to the current directory.
  --prefix <dir>        Use an explicit config root. Intended for tests and custom setups.

Flags:
  --force               Back up and replace conflicting files or an unmanaged EGM bundle.
  --dry-run             Show what would change without writing anything.
  --json                Print machine-readable output.

Examples:
  node bin/egm-opencode.mjs install --global
  node bin/egm-opencode.mjs install --project .
  node bin/egm-opencode.mjs status --global
  node bin/egm-opencode.mjs uninstall --global
`;

function parseArgs(argv) {
  const options = {
    command: argv[0] ?? 'help',
    global: false,
    project: null,
    prefix: null,
    force: false,
    dryRun: false,
    json: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--global':
        options.global = true;
        break;
      case '--project':
        options.project = argv[index + 1] && !argv[index + 1].startsWith('--')
          ? argv[++index]
          : process.cwd();
        break;
      case '--prefix':
        if (!argv[index + 1] || argv[index + 1].startsWith('--')) {
          throw new Error('--prefix requires a directory');
        }
        options.prefix = argv[++index];
        break;
      case '--force':
        options.force = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--help':
      case '-h':
        options.command = 'help';
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function relativeList(root, files) {
  return files.map((file) => path.relative(root, file));
}

function printInstall(result) {
  const { context, plan, manifest, backups, bundleBackup, removed, skipped, dryRun } = result;
  if (dryRun) {
    console.log('Dry run: no files written.');
    console.log(`Scope:  ${context.scope}`);
    console.log(`Root:   ${context.root}`);
    console.log(`Files:  ${plan.files.length}`);
    if (bundleBackup) console.log(`Would back up unmanaged bundle to: ${bundleBackup}`);
    if (result.conflicts.length > 0) {
      console.log('Would back up conflicting files:');
      console.log(relativeList(context.root, result.conflicts.map((file) => file.abs)).map((file) => `  - ${file}`).join('\n'));
    }
    return;
  }

  const skillCount = new Set(plan.files.filter((file) => file.rel.startsWith('skills/')).map((file) => file.rel.split('/')[1])).size;
  const agentCount = plan.files.filter((file) => file.rel.startsWith('agents/')).length;
  const commandCount = plan.files.filter((file) => file.rel.startsWith('commands/')).length;

  console.log('EGM installed for OpenCode V2.');
  console.log(`  Scope:    ${context.scope}`);
  console.log(`  Root:     ${context.root}`);
  console.log(`  Bundle:   ${context.bundleRoot}`);
  console.log(`  Skills:   ${skillCount}`);
  console.log(`  Agents:   ${agentCount}`);
  console.log(`  Commands: ${commandCount}`);
  if (manifest?.upstream) {
    console.log(`  Upstream: ${manifest.upstream.version} (${manifest.upstream.commit.slice(0, 7)})`);
  }
  if (bundleBackup) console.log(`  Backed up previous bundle: ${bundleBackup}`);
  if (backups.length > 0) {
    console.log('  Backed up conflicting files:');
    for (const backup of backups) console.log(`    - ${backup}`);
  }
  if (removed.length > 0) console.log(`  Removed stale files: ${removed.length}`);
  if (skipped.length > 0) {
    console.log('  Left modified stale files in place:');
    for (const file of skipped) console.log(`    - ${file}`);
  }
  console.log('');
  console.log('Use it:');
  console.log('  opencode --agent egm');
  console.log('  Then run /egm-brainstorm, /egm-draft, /egm-review, or another /egm-* command.');
  console.log('  In an existing session, select the egm agent and ask it to use an egm-* skill.');
}

function printUninstall(result) {
  console.log('EGM removed from OpenCode.');
  console.log(`  Root: ${result.context.root}`);
  console.log(`  Files removed: ${result.removed.length}`);
  if (result.missing.length > 0) console.log(`  Already missing: ${result.missing.length}`);
  if (result.modified.length > 0) console.log(`  Forced removal of modified files: ${result.modified.length}`);
}

function printStatus(result) {
  if (!result.installed) {
    console.log('EGM is not installed at this scope.');
    console.log(`  Root: ${result.context.root}`);
    return;
  }
  const { manifest, missing, modified } = result;
  console.log('EGM is installed.');
  console.log(`  Scope:    ${manifest.scope}`);
  console.log(`  Root:     ${result.context.root}`);
  console.log(`  Version:  ${manifest.version}`);
  console.log(`  Upstream: ${manifest.upstream?.version ?? 'unknown'} (${manifest.upstream?.commit?.slice(0, 7) ?? 'unknown'})`);
  console.log(`  Installed: ${manifest.installedAt}`);
  console.log(`  Files:    ${manifest.files.length}`);
  console.log(`  Missing:  ${missing.length}`);
  console.log(`  Modified: ${modified.length}`);
  if (missing.length > 0) {
    console.log('  Missing files:');
    for (const file of missing) console.log(`    - ${file}`);
  }
  if (modified.length > 0) {
    console.log('  Modified files:');
    for (const file of modified) console.log(`    - ${file}`);
  }
}

async function printVersion() {
  const pkg = JSON.parse(await fs.readFile(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  console.log(`${pkg.name} ${pkg.version}`);
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);

  switch (options.command) {
    case 'install': {
      const result = await install(options);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printInstall(result);
      }
      return 0;
    }
    case 'uninstall': {
      const result = await uninstall(options);
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else printUninstall(result);
      return 0;
    }
    case 'status': {
      const result = await status(options);
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else printStatus(result);
      return result.installed ? 0 : 1;
    }
    case 'version':
      await printVersion();
      return 0;
    case 'help':
      console.log(HELP);
      return 0;
    default:
      console.error(`Unknown command: ${options.command}\n`);
      console.log(HELP);
      return 2;
  }
}
