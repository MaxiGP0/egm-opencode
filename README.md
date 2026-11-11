# EGM for OpenCode V2

**Elephant-Goldfish Model (EGM) as a native OpenCode V2 setup: design with context, review with fresh eyes.**

[English](README.md) · [Español](README.es.md)

This repository is an **unofficial adapter** that installs the [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model) into [OpenCode](https://opencode.ai) V2. It vendors a pinned copy of the upstream skills, personas, and document standards, then generates the OpenCode agents, commands, and permissions needed to run the workflow.

EGM is not a code generator. It is a design and review workflow:

| Role | Context | Responsibility |
| --- | --- | --- |
| **Elephant** | Your project, requirements, and earlier decisions | Explores the problem and drafts the specification. |
| **Goldfish** | The document and referenced sources, without the earlier conversation | Finds missing assumptions, unclear requirements, and implementation risks. |
| **You** | Goals and constraints | Resolve trade-offs, approve the design, and decide what to build. |

Fresh reviewers only work if they actually get a fresh context. This adapter runs every Goldfish as an OpenCode subagent in a child session with read-only permissions.

## Requirements

- **OpenCode V2** (tested with `2.2.7` on Windows 11).
- **Node.js 18 or newer** for the installer.
- No Python, symlinks, or admin rights required.

The adapter targets the V2 `subagent` and `permissions` interfaces. It does not use the old V1 `task` / `permission` interfaces.

## Install

Clone the repository and run the installer:

```sh
git clone https://github.com/MaxiGP0/egm-opencode.git
cd egm-opencode
node bin/egm-opencode.mjs install --global
```

That writes to the OpenCode global config directory:

```text
~/.config/opencode/
├── skills/egm-*/          # 7 EGM skills
├── agents/egm*.md         # orchestrator + 8 reviewers + explorer + bootstrap worker
├── commands/egm-*.md      # 7 slash commands
└── egm/                   # pinned bundle: personas, resources, docs
```

On Windows, `~` is `%USERPROFILE%`. If `XDG_CONFIG_HOME` is set, the installer uses it instead.

### Project-local install

To keep EGM inside one repository instead of your global configuration:

```sh
node bin/egm-opencode.mjs install --project /path/to/project
```

This writes to `/path/to/project/.opencode/` using the same layout.

### Check, update, remove

```sh
# Show what is installed and whether files changed
node bin/egm-opencode.mjs status --global

# After git pull, reinstall. Unmodified managed files are updated in place.
node bin/egm-opencode.mjs install --global

# Remove only files that egm-opencode installed
node bin/egm-opencode.mjs uninstall --global
```

The installer never edits `opencode.json`. It only adds self-contained Markdown agents, commands, and skills, so your existing configuration stays untouched. OpenCode reloads them automatically.

If a file with the same name already exists and was not installed by this tool, the installer stops and lists the conflict. Re-run with `--force` to move the existing file aside and keep a timestamped backup.

## Use it

Start OpenCode with the EGM agent:

```sh
opencode --agent egm
```

Or, in an existing session, select the **`egm`** agent from the agent picker (Tab) and then run one of the commands:

```text
/egm-brainstorm Add webhook delivery to this project.
/egm-draft
/egm-review docs/designs/webhooks.md
```

You can also ask for a skill by name in an ordinary message:

```text
Use the egm-review skill to review docs/designs/webhooks.md.
```

Use ordinary chat messages for untrusted review material. OpenCode expands shell markers in slash-command arguments before the agent's tool permissions apply, so do not paste untrusted text into `/egm-*` arguments. The command templates in this repository do not contain shell blocks.

### The flow

1. **`/egm-brainstorm`** explores the idea with you and writes `concepts_brief.md` after seven reviewers challenge it.
2. **`/egm-draft`** turns the brief into `design_draft.md`, pausing for feedback as sections are written.
3. **`/egm-review`** runs five review stages with fresh reviewers: Zoom Out, Comprehension, Critic, Intermediate Zoom Out, and Implementation Readiness.
4. **`/egm-resolve`** works through findings and applies only the edits you approve.
5. **`/egm-bootstrap`** documents an existing codebase; **`/egm-drift-report`** compares checked-in docs with the current code.

The workflow writes artifacts into the project working directory by default. To use another folder, add this line to your prompt or to a loaded `AGENTS.md`:

```text
EGM artifact directory: .dev/docs
```

A relative path is resolved against the project working directory. Design documents and other committed project files do not move.

### Commands

| Command | What it does |
| --- | --- |
| `/egm-brainstorm` | Explore an idea and write `concepts_brief.md`. |
| `/egm-draft` | Turn a brief or notes into a design document. |
| `/egm-review` | Review a design with five fresh-context stages. |
| `/egm-review-loop` | Run a configured group of reviewers on a target. |
| `/egm-resolve` | Work through findings and apply approved edits. |
| `/egm-bootstrap` | Create or update documentation for an existing codebase. |
| `/egm-drift-report` | Compare checked-in documents with the current code. |

## How the OpenCode integration works

- **`egm` primary agent**: the Elephant. It can load only `egm-*` skills and launch only `egm-*` subagents. It can read, search, and write project files; shell commands and most other tools ask first.
- **Eight reviewer subagents** (`egm-design`, `egm-structural`, `egm-style`, `egm-zoom-out`, `egm-comprehension`, `egm-implementation-readiness`, `egm-codebase-details`, `egm-inventive-catalyst`): each runs in a fresh child session, can only read/glob, and cannot edit, run shell, search with grep, delegate, or load skills.
- **`egm-explorer`**: a read-only scout for bootstrap. It returns JSON interface/invariants/side-effects summaries.
- **`egm-bootstrap-worker`**: a bootstrap sub-orchestrator that can write documentation inside its assigned subtree and spawn only `egm-explorer`.
- **No `egm-synthesizer` agent**: the upstream synthesizer is a nested orchestrator. This adapter deliberately dispatches reviewers directly from the Elephant and synthesizes their findings in the parent. That avoids depending on nested subagent support.
- **Skills stay canonical**: the `SKILL.md` files and personas are copied from upstream. The adapter adds a system-prompt preamble that maps harness-specific names to OpenCode V2 (`subagent`, `agent`, no `sessionID`, foreground execution) and tells the Elephant to ignore Claude/Codex-specific docs.

### Installed layout

```text
<config-root>/
├── skills/
│   ├── egm-brainstorm/SKILL.md
│   ├── egm-draft/SKILL.md
│   ├── egm-review/SKILL.md
│   ├── egm-review-loop/SKILL.md
│   ├── egm-resolve/SKILL.md
│   ├── egm-bootstrap/SKILL.md
│   └── egm-drift-report/SKILL.md
├── agents/
│   ├── egm.md
│   ├── egm-design.md
│   ├── egm-structural.md
│   ├── egm-style.md
│   ├── egm-zoom-out.md
│   ├── egm-comprehension.md
│   ├── egm-implementation-readiness.md
│   ├── egm-codebase-details.md
│   ├── egm-inventive-catalyst.md
│   ├── egm-explorer.md
│   └── egm-bootstrap-worker.md
├── commands/
│   └── egm-*.md
└── egm/
    ├── install.json          # versions, upstream commit, file hashes
    ├── UPSTREAM.json
    ├── agents/
    ├── resources/
    └── docs/
```

The `egm/` bundle is stored outside the project so that it survives project changes. Its absolute path is written into the generated agent prompts. Do not move the installation directory without reinstalling.

## Verify the install

```sh
opencode debug agents
```

The output should include `egm`, the eight `egm-*` reviewers, `egm-explorer`, and `egm-bootstrap-worker`. For a project-local install, run the command from the project directory.

The installer's own tests run offline:

```sh
npm test
```

### Verification status

Tested on Windows 11 with OpenCode `2.2.7`:

- `opencode debug agents` discovers `egm`, the eight reviewers, `egm-explorer`, and `egm-bootstrap-worker`.
- The `egm` agent loaded the `egm-drift-report` skill through the `skill` tool.
- The `egm` agent launched `egm-zoom-out` through the `subagent` tool and received its answer.
- A live `egm-zoom-out` review read the target document and the Zoom Out standard, then returned severity-ranked findings.
- The offline installer tests pass.

The full five-stage `/egm-review` workflow has not been exercised end to end in this repository's test record. Treat that as the next verification step before relying on it for a critical design review.

## Isolation and security limits

- A fresh child session is not a sandbox. Reviewers are restricted by OpenCode permissions, not by the operating system.
- Reviewers deny `grep` because grep is matched by search expression, not by file path, so it could bypass the `.env` read rules. The Elephant is allowed to use grep; treat the `.env` deny rules as a guardrail, not as a security boundary.
- OpenCode may include project or user instruction files in child sessions. Fresh context means the earlier conversation is not passed; it does not guarantee that host instructions are excluded.
- Paths outside the project are blocked for reviewers by default. If a target document lives outside the project, move it into the project, or add an `external_directory` permission for that directory. Reviewers can always read the installed `egm/` bundle.
- Bootstrap parallel workers rely on nested subagents. The sequential bootstrap flow is the supported path; parallel worker mode is installed but host-dependent.
- The commands are design workflows. They produce design documents and illustrative code, not production implementation.

## Differences from the upstream OpenCode adapter

The upstream repository ships an **experimental OpenCode V1** adapter (`adapters/opencode/install.py`). It targets OpenCode `1.18.29`, uses `task` / `permission`, requires Python and POSIX symlinks, and is not listed as a supported harness yet.

This adapter is different:

| Upstream V1 adapter | This adapter |
| --- | --- |
| OpenCode V1 (`task`, `permission`) | OpenCode V2 (`subagent`, `permissions`) |
| Python 3.10+ | Node.js 18+ |
| POSIX symlinks | Plain file copies; works on Windows |
| Separate `OPENCODE_CONFIG` candidate bundle | Global or project-local auto-discovered files |
| 8 reviewers, no explorer/worker | 8 reviewers + explorer + bootstrap worker |

## Repository layout

```text
.
├── bin/egm-opencode.mjs      # CLI
├── src/                      # installer, plan builder, prompts, permissions
├── vendor/egm/               # pinned upstream EGM content
├── test/                     # offline installer tests
├── README.md
├── README.es.md
├── AUTHORS
├── LICENSE
└── NOTICE
```

## Author

**Máximo Gomez Pessoa**

- GitHub: [@MaxiGP0](https://github.com/MaxiGP0)
- LinkedIn: [maximo-gomez-pessoa](https://www.linkedin.com/in/maximo-gomez-pessoa/)

## License and attribution

This project is licensed under the **Apache License 2.0**. Copyright 2026 Máximo Gomez Pessoa. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [AUTHORS](AUTHORS).

The files under `vendor/egm/` are derived from the [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model), Copyright 2026 Google LLC, licensed under Apache 2.0. The upstream commit is recorded in [`vendor/egm/UPSTREAM.json`](vendor/egm/UPSTREAM.json).

This is an unofficial community adapter. It is not affiliated with Google and is **not an officially supported Google product**. EGM itself is also described upstream as not an officially supported Google product.

## Credits

- [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model) and [egm.dev](https://egm.dev), by Google and the EGM contributors.
- Dave Rensin's original essay, [Elephants, Goldfish, and the New Golden Age of Software Engineering](https://medium.com/@drensin/elephants-goldfish-and-the-new-golden-age-of-software-engineering-c33641a48874).
- [OpenCode](https://opencode.ai) for the agent, skill, command, and subagent interfaces.
