import { toPosix } from './fs-utils.mjs';

function bundleRules(bundle) {
  const root = toPosix(bundle);
  return [
    { action: 'external_directory', resource: root, effect: 'allow' },
    { action: 'external_directory', resource: `${root}/*`, effect: 'allow' },
  ];
}

function envReadRules() {
  return [
    { action: 'read', resource: '*', effect: 'allow' },
    { action: 'read', resource: '*.env', effect: 'deny' },
    { action: 'read', resource: '*.env.*', effect: 'deny' },
    { action: 'read', resource: '*.env.example', effect: 'allow' },
  ];
}

export function orchestratorPermissions(bundle) {
  return [
    { action: '*', resource: '*', effect: 'ask' },
    ...envReadRules(),
    { action: 'glob', resource: '*', effect: 'allow' },
    { action: 'grep', resource: '*', effect: 'allow' },
    { action: 'edit', resource: '*', effect: 'allow' },
    { action: 'question', resource: '*', effect: 'allow' },
    { action: 'skill', resource: '*', effect: 'deny' },
    { action: 'skill', resource: 'egm-*', effect: 'allow' },
    { action: 'subagent', resource: '*', effect: 'deny' },
    { action: 'subagent', resource: 'egm-*', effect: 'allow' },
    { action: 'external_directory', resource: '*', effect: 'ask' },
    ...bundleRules(bundle),
  ];
}

export function reviewerPermissions(bundle) {
  return [
    { action: '*', resource: '*', effect: 'deny' },
    ...envReadRules(),
    { action: 'glob', resource: '*', effect: 'allow' },
    { action: 'grep', resource: '*', effect: 'deny' },
    { action: 'external_directory', resource: '*', effect: 'deny' },
    ...bundleRules(bundle),
  ];
}

export function explorerPermissions(bundle) {
  return [
    { action: '*', resource: '*', effect: 'deny' },
    ...envReadRules(),
    { action: 'glob', resource: '*', effect: 'allow' },
    { action: 'grep', resource: '*', effect: 'allow' },
    { action: 'external_directory', resource: '*', effect: 'deny' },
    ...bundleRules(bundle),
  ];
}

export function bootstrapWorkerPermissions(bundle) {
  return [
    { action: '*', resource: '*', effect: 'deny' },
    ...envReadRules(),
    { action: 'glob', resource: '*', effect: 'allow' },
    { action: 'grep', resource: '*', effect: 'allow' },
    { action: 'edit', resource: '*', effect: 'allow' },
    { action: 'skill', resource: '*', effect: 'deny' },
    { action: 'skill', resource: 'egm-bootstrap', effect: 'allow' },
    { action: 'subagent', resource: '*', effect: 'deny' },
    { action: 'subagent', resource: 'egm-explorer', effect: 'allow' },
    { action: 'external_directory', resource: '*', effect: 'deny' },
    ...bundleRules(bundle),
  ];
}
