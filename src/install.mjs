import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GENERATED_MARKER, MANIFEST_NAME } from './constants.mjs';
import {
  pathExists,
  readJsonIfExists,
  removeEmptyDir,
  removeEmptyParents,
  sha256,
  stamp,
  toPosix,
  writeFile,
} from './fs-utils.mjs';
import { buildPlan } from './plan.mjs';
import { PACKAGE_ROOT } from './templates.mjs';

export function defaultGlobalRoot(env = process.env) {
  const configHome =
    env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.trim()
      ? env.XDG_CONFIG_HOME
      : path.join(os.homedir(), '.config');
  return path.join(configHome, 'opencode');
}

export function resolveContext(options = {}) {
  if (options.prefix) {
    const root = path.resolve(options.prefix);
    return { root, bundleRoot: path.join(root, 'egm'), scope: 'prefix' };
  }
  if (options.project) {
    const projectRoot = path.resolve(options.project);
    const root = path.join(projectRoot, '.opencode');
    return { root, bundleRoot: path.join(root, 'egm'), scope: 'project', projectRoot };
  }
  const root = defaultGlobalRoot();
  return { root, bundleRoot: path.join(root, 'egm'), scope: 'global' };
}

async function readPackage() {
  return JSON.parse(await fs.readFile(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
}

async function readUpstream() {
  return JSON.parse(
    await fs.readFile(path.join(PACKAGE_ROOT, 'vendor', 'egm', 'UPSTREAM.json'), 'utf8'),
  );
}

function manifestPathFor(context) {
  return path.join(context.bundleRoot, MANIFEST_NAME);
}

function absoluteFor(context, relative) {
  return path.join(context.root, ...relative.split('/'));
}

function describeConflicts(conflicts, root) {
  const lines = conflicts.map((file) => `  - ${path.relative(root, file.abs)}`);
  return lines.join('\n');
}

export async function install(options = {}) {
  const context = resolveContext(options);
  const plan = await buildPlan(context);
  const manifestPath = manifestPathFor(context);
  const previous = await readJsonIfExists(manifestPath);
  const previousFiles = new Map((previous?.files ?? []).map((file) => [file.path, file.sha256]));

  let bundleBackup = null;
  if ((await pathExists(context.bundleRoot)) && !previous) {
    if (!options.force) {
      throw new Error(
        `Refusing to overwrite an unmanaged EGM bundle at ${context.bundleRoot}.\n` +
          'Re-run with --force to move it aside and install a fresh copy.',
      );
    }
    bundleBackup = `${context.bundleRoot}.bak-${stamp()}`;
    if (!options.dryRun) {
      await fs.rename(context.bundleRoot, bundleBackup);
    }
  }

  const conflicts = [];
  for (const file of plan.files) {
    if (!(await pathExists(file.abs))) continue;
    const destinationHash = sha256(await fs.readFile(file.abs));
    if (destinationHash === file.sha256) continue;

    if (previousFiles.has(file.rel)) {
      if (previousFiles.get(file.rel) === destinationHash) continue;
      conflicts.push(file);
      continue;
    }

    if (file.kind === 'generated') {
      const text = await fs.readFile(file.abs, 'utf8');
      if (text.includes(GENERATED_MARKER)) continue;
    }

    conflicts.push(file);
  }

  if (conflicts.length > 0 && !options.force) {
    const error = new Error(
      `Refusing to overwrite existing files that egm-opencode does not manage:\n` +
        `${describeConflicts(conflicts, context.root)}\n` +
        'Re-run with --force to back them up and continue.',
    );
    error.conflicts = conflicts;
    throw error;
  }

  if (options.dryRun) {
    return {
      context,
      plan,
      previous,
      conflicts,
      backups: [],
      bundleBackup,
      removed: [],
      skipped: [],
      dryRun: true,
    };
  }

  const backups = [];
  for (const file of conflicts) {
    const backup = `${file.abs}.bak-${stamp()}`;
    await fs.rename(file.abs, backup);
    backups.push(backup);
  }

  const planned = new Set(plan.files.map((file) => file.rel));
  const removed = [];
  const skipped = [];
  for (const old of previous?.files ?? []) {
    if (planned.has(old.path)) continue;
    const absolute = absoluteFor(context, old.path);
    if (!(await pathExists(absolute))) continue;
    const hash = sha256(await fs.readFile(absolute));
    if (hash === old.sha256 || options.force) {
      await fs.rm(absolute, { force: true });
      removed.push(old.path);
      await removeEmptyParents(absolute, context.root);
    } else {
      skipped.push(old.path);
    }
  }

  for (const file of plan.files) {
    await fs.mkdir(path.dirname(file.abs), { recursive: true });
    if (file.kind === 'generated') {
      await fs.writeFile(file.abs, file.content);
    } else {
      await fs.copyFile(file.source, file.abs);
    }
  }

  const [pkg, upstream] = await Promise.all([readPackage(), readUpstream()]);
  const manifest = {
    schemaVersion: 1,
    name: pkg.name,
    version: pkg.version,
    scope: context.scope,
    root: toPosix(context.root),
    bundleRoot: toPosix(context.bundleRoot),
    installedAt: new Date().toISOString(),
    upstream,
    files: plan.files.map((file) => ({ path: file.rel, sha256: file.sha256 })),
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    context,
    plan,
    previous,
    conflicts,
    backups,
    bundleBackup,
    removed,
    skipped,
    manifest,
    dryRun: false,
  };
}

export async function uninstall(options = {}) {
  const context = resolveContext(options);
  const manifestPath = manifestPathFor(context);
  const manifest = await readJsonIfExists(manifestPath);
  if (!manifest) {
    throw new Error(`No egm-opencode installation found at ${context.root}.`);
  }

  const removable = [];
  const missing = [];
  const modified = [];
  for (const file of manifest.files) {
    const absolute = absoluteFor(context, file.path);
    if (!(await pathExists(absolute))) {
      missing.push(file.path);
      continue;
    }
    const hash = sha256(await fs.readFile(absolute));
    if (hash === file.sha256 || options.force) {
      removable.push({ ...file, absolute });
    } else {
      modified.push(file.path);
    }
  }

  if (modified.length > 0 && !options.force) {
    const error = new Error(
      `Refusing to remove files that changed after installation:\n` +
        modified.map((file) => `  - ${file}`).join('\n') +
        '\nRe-run with --force to remove them anyway.',
    );
    error.modified = modified;
    throw error;
  }

  const removed = [];
  for (const file of removable) {
    await fs.rm(file.absolute, { force: true });
    removed.push(file.path);
    await removeEmptyParents(file.absolute, context.root);
  }

  await fs.rm(manifestPath, { force: true });
  await removeEmptyDir(context.bundleRoot);

  return { context, manifest, removed, missing, modified };
}

export async function status(options = {}) {
  const context = resolveContext(options);
  const manifest = await readJsonIfExists(manifestPathFor(context));
  if (!manifest) {
    return { installed: false, context };
  }

  const missing = [];
  const modified = [];
  for (const file of manifest.files) {
    const absolute = absoluteFor(context, file.path);
    if (!(await pathExists(absolute))) {
      missing.push(file.path);
      continue;
    }
    if (sha256(await fs.readFile(absolute)) !== file.sha256) {
      modified.push(file.path);
    }
  }

  return { installed: true, context, manifest, missing, modified };
}
