[中文](README.md) | [English](README.en.md)

# ag-dsh-coding-plugins

围绕软件工程开发的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）插件合集。本仓库是 pnpm monorepo：`packages/` 下每个目录都是一个独立、可发布的 TypeScript 插件包；外层负责 workspace 组合与 CI/CD。

开发约定与智能体操作守则见 [AGENTS.md](AGENTS.md)。

## 插件演示
https://github.com/user-attachments/assets/34af50d9-f270-4170-b6db-d4290d524b89

https://github.com/user-attachments/assets/5bc60971-48f8-41a4-ad98-53e3a1b6d67f

## 插件列表

> 每新增一个插件，请同步更新本表。

| 插件 | npm 包 | 说明 |
|---|---|---|
| [gen-commit-msg-zh](packages/gen-commit-msg-zh/README.md) | `@ag-dsh/dsh-gen-commit-msg-zh` | 生成中文 commit message 并交互提交（命令 + 非交互技能） |
| [web-notify](packages/web-notify/README.md) | `@ag-dsh/dsh-web-notify` | 浏览器系统通知：对话完成/待回答/需授权/出错时提醒（Chrome/Edge/Firefox/Safari） |



## 开发

### 仓库结构

```
.
├── AGENTS.md                    # 智能体操作守则（开发约定）
├── packages/                    # 插件集合：每个目录一个独立插件项目
│   └── gen-commit-msg-zh/       #   示例插件：生成中文 commit message 并交互提交
│       ├── src/index.ts         #   name / inject / apply 命名导出
│       ├── tests/index.spec.ts  #   vitest 单测
│       ├── README.md            #   包契约（行为、依赖服务、限制）
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

### 快速开始

```sh
pnpm install        # 安装依赖（pnpm >= 10）
pnpm check:ci       # 全部门禁：typecheck → lint → test → build → workspace/pack 校验
pnpm new my-tool    # 生成一个新插件包（或参考 packages/gen-commit-msg-zh 手写）
```

### 工具链

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

### 发布流程

1. 改动插件包时运行 `pnpm changeset` 记录变更（patch/minor/major）。
2. 合并 PR 后，`release.yml` 自动打开/更新 "Version Packages" 版本 PR。
3. 合并版本 PR 后，自动构建并发布变更包到 npm（`@ag-dsh/dsh-*`，scope 见 `dsh-workspace.json`）。
4. 发布成功后，`release.yml` 在本次发布提交上为每个包打 git tag，格式为 `<目录名>/v<版本>`（如 `web-notify/v1.0.0`）。changesets 默认的 `<包名>@<版本>` tag 已在 `.changeset/config.json` 中关闭（`gitTag: false`），tag 完全由此工作流控制，幂等（已存在的 tag 跳过）。

## 相关链接

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — 上游 DSH 仓库（`docs/cordis-tutorial/` 是插件开发教程）
- [`@deepseek-ai/cordis`](https://www.npmjs.com/package/@deepseek-ai/cordis) — Cordis 运行时（`Context`/`Service`/`Logger`）
- [`@deepseek-ai/schemastery`](https://www.npmjs.com/package/@deepseek-ai/schemastery) — 配置 schema

## License

MIT
