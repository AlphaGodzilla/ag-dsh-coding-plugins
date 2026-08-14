# AGENTS.md — ag-dsh-coding-plugins

> 本文件是仓库的智能体操作守则：任何修改本仓库的工作，开工前先读这里。约定参考上游 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（`docs/cordis-tutorial/`、`packages/AGENTS.md`、`docs/AGENTS.md`），本文件只保留本仓库特有的执行规则。

## 仓库是什么

DSH（DeepSeek Harness）插件合集 monorepo。每个插件是一个独立、可发布的 npm 包，位于 `packages/<name>/`；外层（根目录 + `scripts/` + `.github/`）只放 workspace 组合、共享编译/测试配置与 CI/CD 脚本。

| 路径 | 职责 |
|---|---|
| `packages/<name>/` | 一个独立 TS 插件项目：`src/`、`tests/`、`README.md`、`package.json`、`tsconfig.json` |
| `scripts/` | 外层 CI/CD 脚本（scaffold、check-workspace、clean、pack-check），tsx 运行，类型受 `tsconfig.scripts.json` 检查 |
| `.github/workflows/` | `ci.yml`（push/PR 全门禁）、`release.yml`（changesets 版本 PR + npm 发布） |
| 根目录 | pnpm workspace（`pnpm-workspace.yaml`，依赖版本集中在 `catalog`）、`tsconfig.base.json`、vitest/oxlint/changesets 配置、`dsh-workspace.json`（scope/仓库地址等 CI/CD 常量） |

## 硬性约定（standing orders）

1. **新插件必须用 `pnpm new <name>` 生成**（目录名 kebab-case；npm 名 = `<npmScope>/dsh-<name>`，scope 见 `dsh-workspace.json`）。禁止手建目录或改名；`pnpm check-workspace` 强制校验每个包的名称、导出、files、license 等。
2. **插件形状二选一，绝不混用**：函数插件 named-export `name` / `inject` / `Config` / `apply`；服务插件 default-export `Service` 子类。混用两种导出会让 Loader 丢弃函数插件的命名空间。
3. **服务注入**：可选服务用 `ctx.get('name')` 并处理 undefined；硬依赖写进 `inject` 数组后经 `ctx.<name>` 读取。`ctx` 属性代理对拓扑敏感，未声明不得访问。
4. **所有副作用必须可逆**：监听器、定时器、服务、Slot、主题都通过 `ctx.on` / `ctx.effect` 或官方 disposer 注册，保证卸载干净（HMR/热更新安全）；`apply` 内不留不受管理的全局状态。
5. **`Config` 必须是 schemastery schema**（`import z from '@deepseek-ai/schemastery'`），每个键带 `.default()`；模型可见文本（工具描述、提示词、日志、错误消息）保持稳定，并写入包 README。
6. **每个包必含** `src/index.ts`、`tests/`（vitest `*.spec.ts`，放 `tests/` 下而不是 `src/__tests__/`）、`README.md`。行为变化（配置键、默认值、错误码、wire 字段）必须同 commit 更新 README。
7. **测试**：vitest 在根目录统一运行；import 源文件写 `.ts` 扩展名（`../src/index.ts`，TS 5.7 emit 时改写为 `.js`）。产品可见的插件需要 REAL composition 测试：通过 Loader 启动 `cordis.yml` 断言可观察输出，而不是只测函数。
8. **版本与发布只走 changesets**：`pnpm changeset` 记录 → `pnpm version:packages` 应用 → main 合并后 `release.yml` 自动发布 npm。禁止手改版本号；发布需要仓库 secret `NPM_TOKEN`。
9. **提交前 `pnpm check:ci` 必须全绿**：typecheck → lint → test → build → check-workspace → pack-check，与 CI 完全同一套。PR 若改了包必须附 changeset（CI 用 `changeset status` 强制）。
10. **不提交构建产物**：`lib/`、`*.tsbuildinfo`、`coverage/` 已 gitignore；`pnpm clean` 清理。
11. **类型**：`tsconfig.base.json` 严格模式（`strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes` 等）；`moduleResolution: bundler`；相对导入必须带 `.ts` 扩展名；`tests/` 不参与 `tsc -b`（由 vitest 执行 + oxlint 把关）。
12. **依赖**：只加在包的 `package.json`，版本用 `catalog:` 协议（集中在 `pnpm-workspace.yaml` 的 `catalog`）；不向根 `package.json` 添加运行时依赖；包间依赖用 `workspace:` 协议。
13. **Cordis 参考**：API 以 `@deepseek-ai/cordis`（`Context` / `Service` / `Logger`）为准；形状与生命周期看 deepseek-harness 的 `docs/cordis-tutorial/`；文档层级规则看其 `docs/AGENTS.md`。

## 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm new <name>` | 脚手架新插件包并注册到根 tsconfig |
| `pnpm typecheck` | `tsc -b` 全仓类型检查（含 scripts） |
| `pnpm lint` / `pnpm lint:fix` | oxlint |
| `pnpm test` / `pnpm test:coverage` / `pnpm test:watch` | vitest |
| `pnpm build` | 逐个包 `tsc -b` 构建 `lib/` |
| `pnpm clean` | 清理全部构建产物 |
| `pnpm check-workspace` | 校验包结构与命名约定 |
| `pnpm pack-check` | 打包并校验产物内容 |
| `pnpm check:ci` | 全部门禁（本地 = CI） |
| `pnpm changeset` | 记录变更 |
| `pnpm version:packages` | 应用 changesets 版本号与 changelog |
| `pnpm release` | 构建后发布（仅 CI 用） |

## CI/CD 流程

- `ci.yml`（push main / PR）：`pnpm install --frozen-lockfile` → `pnpm check:ci` → PR 额外校验 changeset。
- `release.yml`（push main）：changesets/action 生成/更新 "Version Packages" PR；合并该 PR 后自动对变更包执行 `pnpm release`（build + `changeset publish`）发布到 npm。
- 发布需要仓库 secrets：`NPM_TOKEN`（npm 访问令牌，注入 `NODE_AUTH_TOKEN`；由 `actions/setup-node` 的 `registry-url` 写入用户级 `.npmrc` 完成鉴权，仓库内 `.npmrc` 不存令牌）。

## 改这个仓库的标准流程

1. 新功能先 `pnpm new`（或改现有包）。
2. 同一次改动内完成：`src/` + `tests/` + README（含配置表）。
3. 本地 `pnpm check:ci` 全绿。
4. `pnpm changeset`（按语义 patch/minor/major）。
5. 提交 PR；main 合并后由 release.yml 自动发布。
