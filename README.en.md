[中文](README.md) | [English](README.en.md)

# ag-dsh-coding-plugins

A collection of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugins for software engineering. This repository is a pnpm monorepo: every directory under `packages/` is an independent, publishable TypeScript plugin package; the outer layer owns workspace composition and CI/CD.

Development conventions and agent operating rules: see [AGENTS.md](AGENTS.md).

## Demonstration
https://github.com/user-attachments/assets/34af50d9-f270-4170-b6db-d4290d524b89

https://github.com/user-attachments/assets/5bc60971-48f8-41a4-ad98-53e3a1b6d67f

## Plugins

> Keep this table in sync when adding a plugin.

| Plugin | npm package | Description |
|---|---|---|
| [gen-commit-msg-zh](packages/gen-commit-msg-zh/README.en.md) | `@ag-dsh/dsh-gen-commit-msg-zh` | Generate a Chinese commit message and commit interactively (slash command + non-interactive skill) |
| [web-notify](packages/web-notify/README.en.md) | `@ag-dsh/dsh-web-notify` | Browser system notifications for turn completion / pending questions / approvals / errors (Chrome/Edge/Firefox/Safari) |

## Development

### Repository Structure

```
.
├── AGENTS.md                    # Agent operating rules (development conventions)
├── packages/                    # Plugin collection: one independent plugin project per directory
│   └── gen-commit-msg-zh/       #   Example plugin: generate a Chinese commit message and commit interactively
│       ├── src/index.ts         #   name / inject / apply named exports
│       ├── tests/index.spec.ts  #   vitest unit tests
│       ├── README.md            #   Package contract (behavior, required services, limitations)
│       ├── package.json         #   Publishable npm package
│       └── tsconfig.json
├── scripts/                     # Outer CI/CD scripts (run with tsx)
│   ├── scaffold.mts             #   pnpm new: scaffold a new plugin package
│   ├── check-workspace.mts      #   Validate package structure and naming conventions
│   ├── pack-check.mts           #   Pack and verify artifacts
│   └── clean.mts                #   Clean build artifacts
├── .github/workflows/
│   ├── ci.yml                   #   push/PR: full gate + changeset check
│   └── release.yml              #   changesets version PR + npm publish
├── pnpm-workspace.yaml          # workspace + catalog (centralized dependency versions)
├── dsh-workspace.json           # npm scope / node / pnpm / repository URL
├── tsconfig.base.json           # Shared strict compilation config
├── vitest.config.ts             # Root test config
└── .oxlintrc.json               # Lint config
```

### Quick Start

```sh
pnpm install        # install dependencies (pnpm >= 10)
pnpm check:ci       # full gate: typecheck → lint → test → build → workspace/pack checks
pnpm new my-tool    # scaffold a new plugin package (or hand-write one by referencing packages/gen-commit-msg-zh)
```

### Toolchain

| Stage | Tool | Command |
|---|---|---|
| Language/compile | TypeScript 5.9 (project references) | `pnpm build` / `pnpm typecheck` |
| Testing | vitest (with coverage) | `pnpm test` / `pnpm test:coverage` |
| Lint | oxlint | `pnpm lint` / `pnpm lint:fix` |
| Scaffolding | `scripts/scaffold.mts` | `pnpm new <name>` |
| Constraint checks | `scripts/check-workspace.mts` | `pnpm check-workspace` |
| Pack checks | `scripts/pack-check.mts` | `pnpm pack-check` |
| Versioning/changelog | changesets | `pnpm changeset` / `pnpm version:packages` |
| Publishing | GitHub Actions + npm | `release.yml`, requires the `NPM_TOKEN` secret |

A plugin package follows this structure: `src/index.ts` (named-export `name`/`inject`/`Config`/`apply`, `Config` is a schemastery schema), `tests/` (vitest), `README.md` (config table + behavior + Known Limitations). `pnpm check-workspace` enforces these.

### Release Flow

1. When changing a plugin package, run `pnpm changeset` to record the change (patch/minor/major).
2. After merging the PR, `release.yml` automatically opens/updates the "Version Packages" PR.
3. After merging the version PR, changed packages are built and published to npm automatically (`@ag-dsh/dsh-*`, scope in `dsh-workspace.json`).
4. After publishing, `release.yml` tags every package at the release commit as `<dir>/v<version>` (e.g. `web-notify/v1.0.0`). The changesets default `<pkgName>@<version>` tags are disabled in `.changeset/config.json` (`gitTag: false`); tagging is fully owned by this workflow and idempotent (existing tags are skipped).

## Related Links

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — upstream DSH repository (`docs/cordis-tutorial/` is the plugin development tutorial)
- [`@deepseek-ai/cordis`](https://www.npmjs.com/package/@deepseek-ai/cordis) — Cordis runtime (`Context`/`Service`/`Logger`)
- [`@deepseek-ai/schemastery`](https://www.npmjs.com/package/@deepseek-ai/schemastery) — configuration schema

## License

MIT
