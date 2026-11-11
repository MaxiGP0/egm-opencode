import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export function toPosix(value) {
  return value.split(path.sep).join('/');
}

export function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(target) {
  return JSON.parse(await fs.readFile(target, 'utf8'));
}

export async function readJsonIfExists(target) {
  if (!(await pathExists(target))) return null;
  return readJson(target);
}

export async function writeFile(target, data) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
}

export async function copyFile(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

export async function listFiles(root, base = root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(full, base)));
    } else if (entry.isFile()) {
      files.push(toPosix(path.relative(base, full)));
    }
  }
  return files.sort();
}

export function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function removeEmptyParents(file, stopAt) {
  let current = path.dirname(file);
  const stop = path.resolve(stopAt);
  while (current.startsWith(stop) && path.resolve(current) !== stop) {
    try {
      await fs.rmdir(current);
    } catch {
      return;
    }
    current = path.dirname(current);
  }
}

export async function removeEmptyDir(target) {
  try {
    await fs.rmdir(target);
  } catch {
    // Ignore non-empty or missing directories.
  }
}
