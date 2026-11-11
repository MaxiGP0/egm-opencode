export const SKILL_IDS = [
  'egm-brainstorm',
  'egm-draft',
  'egm-review',
  'egm-review-loop',
  'egm-resolve',
  'egm-bootstrap',
  'egm-drift-report',
];

export const REVIEWERS = [
  {
    id: 'egm-design',
    file: 'design_critic.md',
    label: 'Design Critic',
  },
  {
    id: 'egm-structural',
    file: 'structural.md',
    label: 'Structural',
  },
  {
    id: 'egm-style',
    file: 'style.md',
    label: 'Style',
  },
  {
    id: 'egm-zoom-out',
    file: 'zoom_out.md',
    label: 'Zoom Out',
  },
  {
    id: 'egm-comprehension',
    file: 'comprehension.md',
    label: 'Comprehension',
  },
  {
    id: 'egm-implementation-readiness',
    file: 'implementation_readiness.md',
    label: 'Implementation Readiness',
  },
  {
    id: 'egm-codebase-details',
    file: 'codebase_details.md',
    label: 'Codebase Details',
  },
  {
    id: 'egm-inventive-catalyst',
    file: 'inventive_catalyst.md',
    label: 'Inventive Catalyst',
  },
];

export const COMMANDS = [
  {
    id: 'egm-brainstorm',
    description: 'EGM: explore an idea and write concepts_brief.md with fresh-context reviewers',
  },
  {
    id: 'egm-draft',
    description: 'EGM: turn a brief or notes into a design document',
  },
  {
    id: 'egm-review',
    description: 'EGM: review a design document with five fresh-context stages',
  },
  {
    id: 'egm-review-loop',
    description: 'EGM: run a configured group of reviewers on a target',
  },
  {
    id: 'egm-resolve',
    description: 'EGM: work through findings and apply approved edits',
  },
  {
    id: 'egm-bootstrap',
    description: 'EGM: create or update documentation for an existing codebase',
  },
  {
    id: 'egm-drift-report',
    description: 'EGM: compare checked-in documents with the current code',
  },
];

export const GENERATED_MARKER = 'egm-opencode:generated';

export const MANIFEST_NAME = 'install.json';
