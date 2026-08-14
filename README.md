# ag-dsh-coding-plugins

围绕软件工程开发的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）插件合集。本仓库是 pnpm monorepo：`packages/` 下每个目录都是一个独立、可发布的 TypeScript 插件包；外层负责 workspace 组合与 CI/CD。

开发约定与智能体操作守则见 [AGENTS.md](AGENTS.md)。

## 仓库结构

```
.
├── AGENTS.md                    # 智能体操作守则（开发约定）
├── packages/                    # 插件集合：每个目录一个独立插件项目
│   └── hello-world/             #   参考插件（规范形状 + CI 夹具）
│       ├── src/index.ts         #   name / Config / apply 命名导出
│       ├── tests/index.spec.ts  #   vitest 单测
│       ├── README.md            #   包契约（配置表、行为、限制）
│       ├── package.json         #   可发布 npm 包
│       └── tsconfig.json
├── scripts/                     # 外层 CI/CD 脚本（tsx 运行）
│   ├── scaffold.mts             #   pnpm new：生成新插件包
│   ├── check-workspace.mts      #   校验包结构与命名约定
│   ├── pack-check.mts           #   打包并校验产物
│   └── clean.mts                #   清理构建产物
├── .github/workflows/
│   ├── ci.yml                   #   push/PR：全门禁 + changeset 校验
│   └── release.yml              #   changesets 版本 PR + npm 发布
├── pnpm-workspace.yaml          # workspace + catalog（依赖版本集中处）
├── dsh-workspace.json           # npm scope / node / pnpm / 仓库地址
├── tsconfig.base.json           # 共享严格编译配置
├── vitest.config.ts             # 根级测试配置
└── .oxlintrc.json               # lint 配置
```

## 快速开始

```sh
pnpm install        # 安装依赖（pnpm >= 10）
pnpm check:ci       # 全部门禁：typecheck → lint → test → build → workspace/pack 校验
pnpm new my-tool    # 生成一个新插件包（或参考 packages/hello-world 手写）
```

## 工具链

| 环节 | 工具 | 命令 |
|---|---|---|
| 语言/编译 | TypeScript 5.9（project references） | `pnpm build` / `pnpm typecheck` |
| 测试 | vitest（含 coverage） | `pnpm test` / `pnpm test:coverage` |
| Lint | oxlint | `pnpm lint` / `pnpm lint:fix` |
| 脚手架 | `scripts/scaffold.mts` | `pnpm new <name>` |
| 约束校验 | `scripts/check-workspace.mts` | `pnpm check-workspace` |
| 打包校验 | `scripts/pack-check.mts` | `pnpm pack-check` |
| 版本/变更日志 | changesets | `pnpm changeset` / `pnpm version:packages` |
| 发布 | GitHub Actions + npm | `release.yml`，需 secret `NPM_TOKEN` |

一个插件包的构成约定：`src/index.ts`（named-export `name`/`inject`/`Config`/`apply`，`Config` 为 schemastery schema）、`tests/`（vitest）、`README.md`（配置表 + 行为 + Known Limitations）。`pnpm check-workspace` 强制这些结构。

## 发布流程

1. 改动插件包时运行 `pnpm changeset` 记录变更（patch/minor/major）。
2. 合并 PR 后，`release.yml` 自动打开/更新 "Version Packages" 版本 PR。
3. 合并版本 PR 后，自动构建并发布变更包到 npm（`@ag-dsh/dsh-*`，scope 见 `dsh-workspace.json`）。

## 相关链接

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — 上游 DSH 仓库（`docs/cordis-tutorial/` 是插件开发教程）
- [`@deepseek-ai/cordis`](https://www.npmjs.com/package/@deepseek-ai/cordis) — Cordis 运行时（`Context`/`Service`/`Logger`）
- [`@deepseek-ai/schemastery`](https://www.npmjs.com/package/@deepseek-ai/schemastery) — 配置 schema

## License

MIT
