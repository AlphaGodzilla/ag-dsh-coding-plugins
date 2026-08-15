[中文](README.md) | [English](README.en.md)

# ag-dsh-coding-plugins

A collection of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugins for software engineering. This repository is a pnpm monorepo: every directory under `packages/` is an independent, publishable TypeScript plugin package; the outer layer owns workspace composition and CI/CD.

Development conventions and agent operating rules: see [AGENTS.md](AGENTS.md).

## Plugins

> Keep this table in sync when adding a plugin.

| Plugin | npm package | Version | Docs | Description |
|---|---|---|---|---|
| gen-commit-msg-zh | `@ag-dsh/dsh-gen-commit-msg-zh` | 0.1.0 | [README](packages/gen-commit-msg-zh/README.en.md) | Generate a Chinese git commit message and commit interactively: the `/gen-commit-msg-zh` command (read-only git inspection → generate → three choices: commit / adjust message / abandon) plus the `git-commit-zh` skill (non-interactive direct commit, no user confirmation) |

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

## Related Links

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — upstream DSH repository (`docs/cordis-tutorial/` is the plugin development tutorial)
- [`@deepseek-ai/cordis`](https://www.npmjs.com/package/@deepseek-ai/cordis) — Cordis runtime (`Context`/`Service`/`Logger`)
- [`@deepseek-ai/schemastery`](https://www.npmjs.com/package/@deepseek-ai/schemastery) — configuration schema

## License

MIT
