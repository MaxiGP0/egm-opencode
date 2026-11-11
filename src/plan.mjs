import fs from 'node:fs/promises';
import path from 'node:path';
import { COMMANDS, REVIEWERS, SKILL_IDS } from './constants.mjs';
import { sha256, toPosix, listFiles } from './fs-utils.mjs';
import {
  VENDOR_ROOT,
  readPersona,
  readPrompt,
  renderAgent,
  renderCommand,
} from './templates.mjs';
import {
  bootstrapWorkerPermissions,
  explorerPermissions,
  orchestratorPermissions,
  reviewerPermissions,
} from './permissions.mjs';

function resolvePath(root, relative) {
  return path.join(root, ...relative.split('/'));
}

async function copyEntry(root, relative, source) {
  const data = await fs.readFile(source);
  return {
    rel: relative,
    abs: resolvePath(root, relative),
    kind: 'copy',
    source,
    sha256: sha256(data),
  };
}

function generatedEntry(root, relative, content) {
  const data = Buffer.from(content, 'utf8');
  return {
    rel: relative,
    abs: resolvePath(root, relative),
    kind: 'generated',
    content: data,
    sha256: sha256(data),
  };
}

async function buildAgentFiles(root, bundlePosix) {
  const files = [];
  const egmPrompt = (await readPrompt('egm.md')).replaceAll('{{BUNDLE_ROOT}}', bundlePosix);
  files.push(
    generatedEntry(
      root,
      'agents/egm.md',
      renderAgent({
        description:
          'Elephant-Goldfish Model orchestrator. Drafts design documents and runs fresh-context Goldfish reviews.',
        mode: 'primary',
        color: '#1B6EF3',
        permissions: orchestratorPermissions(bundlePosix),
        body: egmPrompt,
      }),
    ),
  );

  const reviewerPrompt = await readPrompt('reviewer.md');
  for (const reviewer of REVIEWERS) {
    const persona = await readPersona(reviewer.file);
    if (persona.name !== reviewer.id) {
      throw new Error(
        `Persona ${reviewer.file} declares name ${persona.name ?? '(missing)'}, expected ${reviewer.id}`,
      );
    }
    const body = reviewerPrompt
      .replaceAll('{{BUNDLE_ROOT}}', bundlePosix)
      .replaceAll('{{PERSONA}}', persona.body);
    files.push(
      generatedEntry(
        root,
        `agents/${reviewer.id}.md`,
        renderAgent({
          description: `EGM read-only ${reviewer.label} reviewer. Runs in a fresh context and returns findings to the orchestrator.`,
          mode: 'subagent',
          color: '#E86E00',
          permissions: reviewerPermissions(bundlePosix),
          body,
        }),
      ),
    );
  }

  const explorerPrompt = (await readPrompt('explorer.md')).replaceAll(
    '{{BUNDLE_ROOT}}',
    bundlePosix,
  );
  files.push(
    generatedEntry(
      root,
      'agents/egm-explorer.md',
      renderAgent({
        description:
          'EGM read-only codebase explorer scout. Returns JSON interface, invariants, and side effects for a directory.',
        mode: 'subagent',
        color: '#2E7D32',
        permissions: explorerPermissions(bundlePosix),
        body: explorerPrompt,
      }),
    ),
  );

  const workerPrompt = (await readPrompt('bootstrap-worker.md')).replaceAll(
    '{{BUNDLE_ROOT}}',
    bundlePosix,
  );
  files.push(
    generatedEntry(
      root,
      'agents/egm-bootstrap-worker.md',
      renderAgent({
        description:
          'EGM bootstrap sub-orchestrator worker. Documents an assigned subtree and returns a JSON subtree index.',
        mode: 'subagent',
        color: '#6A1B9A',
        permissions: bootstrapWorkerPermissions(bundlePosix),
        body: workerPrompt,
      }),
    ),
  );

  return files;
}

function buildCommandFiles(root) {
  return COMMANDS.map((command) =>
    generatedEntry(
      root,
      `commands/${command.id}.md`,
      renderCommand({ description: command.description, skill: command.id }),
    ),
  );
}

export async function buildPlan(context) {
  const { root, bundleRoot } = context;
  const files = [];
  const bundlePosix = toPosix(bundleRoot);

  const vendorFiles = await listFiles(VENDOR_ROOT);
  for (const relative of vendorFiles) {
    files.push(
      await copyEntry(
        root,
        `egm/${relative}`,
        path.join(VENDOR_ROOT, ...relative.split('/')),
      ),
    );
  }

  for (const skill of SKILL_IDS) {
    const skillRoot = path.join(VENDOR_ROOT, 'skills', skill);
    const skillFiles = await listFiles(skillRoot);
    for (const relative of skillFiles) {
      files.push(
        await copyEntry(
          root,
          `skills/${skill}/${relative}`,
          path.join(skillRoot, ...relative.split('/')),
        ),
      );
    }
  }

  files.push(...(await buildAgentFiles(root, bundlePosix)));
  files.push(...buildCommandFiles(root));

  return {
    ...context,
    bundlePosix,
    files,
  };
}
