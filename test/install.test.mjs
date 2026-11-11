import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(HERE, '..', 'bin', 'egm-opencode.mjs');

function run(args) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

async function tempRoot(name) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `egm-opencode-${name}-`));
  return { root, prefix: path.join(root, 'config') };
}

test('installs skills, agents, commands, and the bundle', async () => {
  const { root, prefix } = await tempRoot('install');
  const result = run(['install', '--prefix', prefix]);
  assert.equal(result.status, 0, result.stderr);

  const expected = [
    'egm/install.json',
    'egm/UPSTREAM.json',
    'egm/resources/document_standards/zoom-out-standard.md',
    'egm/agents/zoom_out.md',
    'skills/egm-brainstorm/SKILL.md',
    'skills/egm-review/SKILL.md',
    'skills/egm-review-loop/SKILL.md',
    'skills/egm-bootstrap/references/worker-return.schema.json',
    'agents/egm.md',
    'agents/egm-design.md',
    'agents/egm-zoom-out.md',
    'agents/egm-explorer.md',
    'agents/egm-bootstrap-worker.md',
    'commands/egm-brainstorm.md',
    'commands/egm-review.md',
  ];
  for (const relative of expected) {
    await fs.access(path.join(prefix, ...relative.split('/')));
  }

  const egm = await fs.readFile(path.join(prefix, 'agents', 'egm.md'), 'utf8');
  assert.match(egm, /^---\n/);
  assert.match(egm, /mode: "primary"/);
  assert.match(egm, /action: "subagent"/);
  assert.match(egm, /resource: "egm-\*"/);

  const reviewer = await fs.readFile(path.join(prefix, 'agents', 'egm-zoom-out.md'), 'utf8');
  assert.match(reviewer, /mode: "subagent"/);
  assert.match(reviewer, /Strict Read-Only Protocol/);

  const command = await fs.readFile(path.join(prefix, 'commands', 'egm-review.md'), 'utf8');
  assert.match(command, /agent: "egm"/);
  assert.match(command, /Use the `egm-review` skill/);

  await fs.rm(root, { recursive: true, force: true });
});

test('reports status and is idempotent', async () => {
  const { root, prefix } = await tempRoot('idempotent');
  assert.equal(run(['install', '--prefix', prefix]).status, 0);

  const status = run(['status', '--prefix', prefix, '--json']);
  assert.equal(status.status, 0, status.stderr);
  const parsed = JSON.parse(status.stdout);
  assert.equal(parsed.installed, true);
  assert.equal(parsed.missing.length, 0);
  assert.equal(parsed.modified.length, 0);

  const again = run(['install', '--prefix', prefix]);
  assert.equal(again.status, 0, again.stderr);
  assert.doesNotMatch(again.stdout, /Backed up/);

  await fs.rm(root, { recursive: true, force: true });
});

test('uninstall removes managed files', async () => {
  const { root, prefix } = await tempRoot('uninstall');
  assert.equal(run(['install', '--prefix', prefix]).status, 0);
  const removed = run(['uninstall', '--prefix', prefix]);
  assert.equal(removed.status, 0, removed.stderr);

  await assert.rejects(fs.access(path.join(prefix, 'agents', 'egm.md')));
  await assert.rejects(fs.access(path.join(prefix, 'egm', 'install.json')));
  assert.equal(run(['status', '--prefix', prefix]).status, 1);

  await fs.rm(root, { recursive: true, force: true });
});

test('refuses to overwrite unmanaged files unless forced', async () => {
  const { root, prefix } = await tempRoot('conflict');
  const agentPath = path.join(prefix, 'agents', 'egm.md');
  await fs.mkdir(path.dirname(agentPath), { recursive: true });
  await fs.writeFile(agentPath, '# my own agent\n');

  const refused = run(['install', '--prefix', prefix]);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Refusing to overwrite/);
  assert.equal(await fs.readFile(agentPath, 'utf8'), '# my own agent\n');

  const forced = run(['install', '--prefix', prefix, '--force']);
  assert.equal(forced.status, 0, forced.stderr);
  const backups = (await fs.readdir(path.join(prefix, 'agents'))).filter((file) =>
    file.startsWith('egm.md.bak-'),
  );
  assert.equal(backups.length, 1);
  assert.match(await fs.readFile(agentPath, 'utf8'), /EGM orchestrator/);

  await fs.rm(root, { recursive: true, force: true });
});

test('dry run writes nothing', async () => {
  const { root, prefix } = await tempRoot('dry-run');
  const result = run(['install', '--prefix', prefix, '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry run/);

  await assert.rejects(fs.access(prefix));
  await fs.rm(root, { recursive: true, force: true });
});
