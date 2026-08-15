# AGENTS.md — ag-dsh-coding-plugins

> 本文件是仓库的智能体操作守则：任何修改本仓库的工作，开工前先读这里。约定参考上游 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（`docs/cordis-tutorial/`、`packages/AGENTS.md`、`docs/AGENTS.md`），本文件只保留本仓库特有的执行规则。

## 仓库是什么

DSH（DeepSeek Harness）插件合集 monorepo。每个插件是一个独立、可发布的 npm 包，位于 `packages/<name>/`；外层（根目录 + `scripts/` + `.github/`）只放 workspace 组合、共享编译/测试配置与 CI/CD 脚本。

| 路径 | 职责 |
|---|---|
| `packages/<name>/` | 一个独立 TS 插件项目：`src/`、`tests/`、双语文档（`README.md` + `README.en.md`）、`package.json`、`tsconfig.json` |
| `scripts/` | 外层 CI/CD 脚本（scaffold、check-workspace、clean、pack-check），tsx 运行，类型受 `tsconfig.scripts.json` 检查 |
| `.github/workflows/` | `ci.yml`（push/PR 全门禁）、`release.yml`（changesets 版本 PR + npm 发布） |
| 根目录 | pnpm workspace（`pnpm-workspace.yaml`，依赖版本集中在 `catalog`）、`tsconfig.base.json`、vitest/oxlint/changesets 配置、`dsh-workspace.json`（scope/仓库地址等 CI/CD 常量） |

## 硬性约定（standing orders）

1. **新插件必须用 `pnpm new <name>` 生成**（目录名 kebab-case；npm 名 = `<npmScope>/dsh-<name>`，scope 见 `dsh-workspace.json`）。禁止手建目录或改名；`pnpm check-workspace` 强制校验每个包的名称、导出、files、license 等。
2. **插件形状二选一，绝不混用**：函数插件 named-export `name` / `inject` / `Config` / `apply`；服务插件 default-export `Service` 子类。混用两种导出会让 Loader 丢弃函数插件的命名空间。
3. **服务注入**：可选服务用 `ctx.get('name')` 并处理 undefined；硬依赖写进 `inject` 数组后经 `ctx.<name>` 读取。`ctx` 属性代理对拓扑敏感，未声明不得访问。
4. **所有副作用必须可逆**：监听器、定时器、服务、Slot、主题都通过 `ctx.on` / `ctx.effect` 或官方 disposer 注册，保证卸载干净（HMR/热更新安全）；`apply` 内不留不受管理的全局状态。
5. **`Config` 必须是 schemastery schema**（`import z from '@deepseek-ai/schemastery'`），每个键带 `.default()`；模型可见文本（工具描述、提示词、日志、错误消息）保持稳定，并写入包 README。
6. **每个包必含** `src/index.ts`、`tests/`（vitest `*.spec.ts`，放 `tests/` 下而不是 `src/__tests__/`）、**双语文档**（`README.md` + `README.en.md`，规范见下方「README 文档规范」）。行为变化（配置键、默认值、错误码、wire 字段）必须同 commit 更新两份 README。
7. **测试**：vitest 在根目录统一运行；import 源文件写 `.ts` 扩展名（`../src/index.ts`，TS 5.7 emit 时改写为 `.js`）。产品可见的插件需要 REAL composition 测试：通过 Loader 启动 `cordis.yml` 断言可观察输出，而不是只测函数。
8. **版本与发布只走 changesets**：`pnpm changeset` 记录 → `pnpm version:packages` 应用 → main 合并后 `release.yml` 自动发布 npm。禁止手改版本号；发布需要仓库 secret `NPM_TOKEN`。
9. **提交前 `pnpm check:ci` 必须全绿**：typecheck → lint → test → build → check-workspace → pack-check，与 CI 完全同一套。PR 若改了包必须附 changeset（CI 用 `changeset status` 强制）。
10. **不提交构建产物**：`lib/`、`*.tsbuildinfo`、`coverage/` 已 gitignore；`pnpm clean` 清理。
11. **类型**：`tsconfig.base.json` 严格模式（`strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes` 等）；`moduleResolution: bundler`；相对导入必须带 `.ts` 扩展名；`tests/` 不参与 `tsc -b`（由 vitest 执行 + oxlint 把关）。
12. **依赖**：只加在包的 `package.json`，版本用 `catalog:` 协议（集中在 `pnpm-workspace.yaml` 的 `catalog`）；不向根 `package.json` 添加运行时依赖；包间依赖用 `workspace:` 协议。
13. **Cordis 参考**：API 以 `@deepseek-ai/cordis`（`Context` / `Service` / `Logger`）为准；形状与生命周期看 deepseek-harness 的 `docs/cordis-tutorial/`；文档层级规则看其 `docs/AGENTS.md`。
14. **官方 bundle 契约**：每个发布包必须在 `package.json` 声明 `dsh.bundle.patch`（指向包根 `cordis.patch.yml`），并把 `cordis.patch.yml` 加入 `files` 与 `exports`——否则 `dsh plugin add` 只会把它装成普通依赖、不会注册为 profile 层。bundle patch 用 `- insert:` 以**裸包名**插入插件行（`name: '<npm名>'`）；相对路径会相对 profile 根解析，不可用。安装时的 `missing peer @deepseek-ai/...` 警告可忽略：profile 默认 `autoInstallPeers: false`，运行时由 dsh 安装的模块闭包 `$DSH_HOME/profiles/node_modules` 提供（`check-workspace` 强制本契约）。

## README 文档规范

所有 README（根与每个插件包）均为**双语**：`README.md` 用中文（默认语言），`README.en.md` 用英文（备选语言）。两份文档内容保持一致（一份翻译自另一份），唯模型可见文本（提示词、命令文案等）保持原文、不翻译。

### 通用规则

1. **顶部跳转链接**：两份文档的**第一行**必须是 `[中文](README.md) | [English](README.en.md)`（相对链接）。
2. **同步更新**：行为变化（配置键、默认值、错误码、wire 字段、命令/技能、提示词）必须**同 commit** 更新两份 README；只改其一视为未完成（关联约定 6）。
3. **强制校验**：`check-workspace` 要求每个包同时存在 `README.md` 与 `README.en.md`；`pack-check` 要求打包产物包含两者（npm 自动打包 `README*`）；`pnpm new` 生成的脚手架自带双语模板。
4. **语言版本一致**：结构、章节、说明文字一一对应；中文版使用简体中文。

### 根 README 结构（`README.md` / `README.en.md`）

1. 顶部语言跳转链接
2. `# ag-dsh-coding-plugins` + 仓库简介 + 指向 [AGENTS.md](AGENTS.md) 的开发约定入口
3. `## 插件列表`：表格列出每个插件（插件名 / npm 包 / 版本 / 说明）。**插件名列本身即 README 链接**（中文版链 `packages/<name>/README.md`，英文版链 `packages/<name>/README.en.md`）。**每新增一个插件必须同步更新本表**
4. `## 开发`（仓库结构 / 快速开始 / 工具链 / 发布流程）
5. `## 相关链接`、`## License`

### 插件 README 结构（`packages/<name>/README.md` 与 `README.en.md`）

按以下顺序组织（无对应内容的小节省略）：

1. 顶部语言跳转链接
2. `# <npm 包名>` + 一句话简介（功能 + 来源/背景）
3. `## Installation`：`dsh plugin` 命令 + **安装/更新后需重启 dsh 的提示与示例命令（以 web profile 为例）** + `cordis.yml` 行 + **依赖的宿主服务表**（服务 / 依赖方式：inject 硬依赖、`ctx.get`/`ctx.inject` 可选 / 说明）
4. `## Usage`：命令用法与交互流程；技能等模型面入口逐个说明
5. 命令与技能一览表（名称 / 类型 / 说明）
6. `## Config`：schemastery 配置表（键 / 类型 / 默认值 / 说明）；无配置写"无"
7. `## 模型可见文本`：稳定契约。标注**源文件**（如 `prompts/*.md` → 常量名）并列出全文（保持原样不翻译）；改动需同步 README 与测试（关联约定 5）
8. `## Behavior`：可观察行为与副作用说明
9. `## Known Limitations and Deferred Work`：已知限制与未完成项（进程内状态、可选服务缺失时的降级等）

### 参考实现

`packages/gen-commit-msg-zh/`（`README.md` 中文 + `README.en.md` 英文）即本规范的参考实现。

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
2. 同一次改动内完成：`src/` + `tests/` + 双语 README（`README.md` + `README.en.md`，含配置表、模型可见文本）。
3. 本地 `pnpm check:ci` 全绿。
4. `pnpm changeset`（按语义 patch/minor/major）。
5. 提交 PR；main 合并后由 release.yml 自动发布。
