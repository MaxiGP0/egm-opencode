import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATED_MARKER } from './constants.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = path.resolve(HERE, '..');
export const VENDOR_ROOT = path.join(PACKAGE_ROOT, 'vendor', 'egm');
const PROMPTS_ROOT = path.join(HERE, 'prompts');

export async function readPrompt(name) {
  return fs.readFile(path.join(PROMPTS_ROOT, name), 'utf8');
}

export function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: '', body: source };
  }
  return {
    frontmatter: match[1],
    body: source.slice(match[0].length),
  };
}

export async function readPersona(file) {
  const source = await fs.readFile(path.join(VENDOR_ROOT, 'agents', file), 'utf8');
  const { frontmatter, body } = parseFrontmatter(source);
  if (!frontmatter) {
    throw new Error(`Missing frontmatter in persona: ${file}`);
  }
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  return { name, description, body: body.trim() };
}

export async function readPersonaBody(file) {
  return (await readPersona(file)).body;
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function renderPermissions(permissions) {
  if (!permissions || permissions.length === 0) return '';
  const lines = ['permissions:'];
  for (const rule of permissions) {
    lines.push(`  - action: ${yamlString(rule.action)}`);
    lines.push(`    resource: ${yamlString(rule.resource)}`);
    lines.push(`    effect: ${yamlString(rule.effect)}`);
  }
  return `${lines.join('\n')}\n`;
}

export function renderAgent({ description, mode, color, permissions, body }) {
  const header = [
    '---',
    `description: ${yamlString(description)}`,
    `mode: ${yamlString(mode)}`,
  ];
  if (color) header.push(`color: ${yamlString(color)}`);
  const permissionBlock = renderPermissions(permissions);
  if (permissionBlock) header.push(permissionBlock.trimEnd());
  header.push('---');
  return [
    header.join('\n'),
    '',
    `<!-- ${GENERATED_MARKER} file. Reinstall with egm-opencode to update. -->`,
    '',
    `${body.trim()}\n`,
  ].join('\n');
}

export function renderCommand({ description, skill }) {
  return [
    '---',
    `description: ${yamlString(description)}`,
    'agent: "egm"',
    '---',
    '',
    `<!-- ${GENERATED_MARKER} file. Reinstall with egm-opencode to update. -->`,
    '',
    `Use the \`${skill}\` skill now. Treat the following as the user request:`,
    '',
    '$ARGUMENTS',
    '',
  ].join('\n');
}
