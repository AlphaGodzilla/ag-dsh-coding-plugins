[中文](README.md) | [English](README.en.md)

# @ag-dsh/dsh-gen-commit-msg-zh

DSH 插件: 生成中文 git commit message 并交互提交。迁移自 Pi Coding Agent 扩展
`pi/agent/extensions/gen-commit-msg-zh`，命令名保持 `/gen-commit-msg-zh`，支持携带附加提示词运行。

## Installation

包自 1.1.0 起携带官方 `dsh.bundle` 清单（`dsh.bundle.patch` → `cordis.patch.yml`），
`dsh plugin add` 会把它注册为 profile 配置层（追加进 `dsh.profile.bundles`），下次启动时自动加载：

```sh
dsh plugin --profile <name> add @ag-dsh/dsh-gen-commit-msg-zh
```

> 安装时出现的 `missing peer @deepseek-ai/...` 警告可忽略：profile 默认
> `autoInstallPeers: false`，这些 peer 由 dsh 安装自身的模块闭包
> （`$DSH_HOME/profiles/node_modules`）在运行时提供。

也可以不经过 bundle 机制，直接把插件行写入 profile 的 `cordis.yml` / `cordis.patch.yml`：

```yaml
- id: gen-commit-msg-zh
  name: '@ag-dsh/dsh-gen-commit-msg-zh'
```

依赖的宿主服务：

| 服务 | 依赖方式 | 说明 |
|---|---|---|
| `commands` | inject（硬依赖） | 注册 `/gen-commit-msg-zh` 命令 |
| `skills` | `ctx.inject`（可选） | 注册 `git-commit-zh` 技能（非交互直接提交）；缺失时命令部分不受影响 |
| `userQuestions` | `ctx.get`（可选） | 三选 / 调整输入对话框；缺失时命令仍可用，但不会弹菜单（需要带 UI 的部署，如 `@deepseek-ai/dsh-tool-ask-user` + 客户端 UI） |

## Usage

### 交互式命令

```
/gen-commit-msg-zh [附加要求]
```

交互流程：

1. **生成轮** —— 插件把生成提示词（模板 + 可选附加要求）作为消息发给模型并触发一轮。
   模型自行运行 git 只读命令（`git status` / `git diff --staged` / `git branch --show-current` /
   `git log --oneline -10`）获取上下文，生成并展示中文 commit message。
   **本轮不做任何 git 写操作。**
2. **三选** —— 生成回合结束后弹出原生对话框：
   - **A) 提交** —— 插件跟进提交指令：模型先判断是否已有暂存改动，无则 `git add -A` 后提交，
     有则直接提交（`git commit` 用多个 `-m`：首个为标题，其余为正文）。
   - **B) 调整消息** —— 输入新的提示词，重新生成并再次三选（可循环）。
   - **C) 放弃** —— 不做任何提交。
3. **收尾** —— 提交轮结束后复位状态，不再次弹交互；结果可见于转录。

commit 由模型经 bash 执行，插件只负责编排（发提示词 / 交互 / followup），不解析消息、不执行 git。
因此需要部署允许模型调用 bash 工具并具备 git 写权限。

### 非交互技能 `git-commit-zh`

插件同时注册一个模型可调用的技能（名称与命令 `gen-commit-msg-zh` 刻意不同）：
在**非用户交互**场景（自主执行、无 UI / 无头部署、子代理、脚本化流程）下，模型可加载该技能，
直接为当前 git 改动生成推荐的中文 commit message 并提交，**无需用户确认**。
技能对模型与用户均开放（`modelInvocable: true, userInvocable: true`），且只在宿主已挂载
`skills` 服务时注册（`ctx.inject`，缺失自动跳过）。

## 命令与技能

| 名称 | 类型 | 说明 |
|---|---|---|
| `/gen-commit-msg-zh` | 命令 | 生成中文 commit message 并交互提交（需用户三选确认） |
| `git-commit-zh` | 技能 | 非交互直接提交当前改动（按推荐消息，无需用户确认） |

## Config

无（该插件不接受配置）。

## 模型可见文本

以下提示词是稳定契约，**源文件**为包内 `prompts/generate.md`、`prompts/commit.md` 与
`prompts/skill-commit.md`（运行时由 `src/prompts.ts` 读取，缺失时回退到极简 fallback）。
改动提示词时需同步更新本 README 与测试。

### 生成轮提示词（`prompts/generate.md` → `GENERATE_PROMPT`）

```
## Your task

你的任务是帮助用户生成一条 git 提交信息（commit message）。

**本轮只做只读探查与生成消息，不要执行任何 git 写命令（不要 `git add`，不要 `git commit`）。**
生成并展示 commit message 后就停下，等待用户从对话框中选择下一步。

### 获取上下文

请你自行运行以下只读 git 命令了解当前状态，不要臆测：

- `git status` —— 查看工作区与暂存区状态
- `git diff --staged` —— 查看已暂存的改动（若没有暂存改动，可再看 `git diff` 了解未暂存改动）
- `git branch --show-current` —— 当前分支
- `git log --oneline -10` —— 近期提交风格参考

### Guidelines

- 不要添加任何广告尾注，例如 "Generated with [Claude Code](https://claude.ai/code)"
- 优先针对已暂存（staged）的改动生成消息；若当前没有任何暂存改动，则针对工作区的全部改动生成消息
- 本轮不要用 `git add` 暂存任何文件，是否暂存由用户稍后决定
- 遵循下方 Format 与 Rules 生成 commit message
- 先列出修改的文件，简明总结改动，再清晰地展示生成的 commit message，然后停下等待用户选择

### Format

```
<type>:<space><message title in Chinese>

<bullet points in Chinese summarizing what was updated>
```

### Example Titles

```
feat(auth): 添加 JWT 登录流程
fix(ui): 修复侧边栏空指针问题
refactor(api): 拆分用户控制器逻辑
docs(readme): 添加使用说明章节
```

### Example with Title and Body

```
feat(auth): 添加 JWT 登录流程

- 实现了 JWT 令牌验证逻辑
- 为验证组件添加了文档说明
```

### Rules

* title is lowercase, no period at the end.
* Title should be a clear summary, max 50 Chinese characters.
* Use the body (optional) to explain *why*, not just *what*.
* Bullet points should be concise and high-level.

Avoid

* Vague titles like: "update", "fix stuff"
* Overly long or unfocused titles
* Excessive detail in bullet points

### Allowed Types

| Type     | Description                           |
| -------- | ------------------------------------- |
| feat     | New feature                           |
| fix      | Bug fix                               |
| chore    | Maintenance (e.g., tooling, deps)     |
| docs     | Documentation changes                 |
| refactor | Code restructure (no behavior change) |
| test     | Adding or refactoring tests           |
| style    | Code formatting (no logic change)     |
| perf     | Performance improvements              |
```

有附加要求时，在模板后追加：

```
### 用户附加要求

<附加要求原文>
```

### 提交轮提示词（`prompts/commit.md` → `COMMIT_PROMPT`）

```
用户已选择提交。请先运行 `git status`（或 `git diff --staged --stat`）判断是否已有暂存改动:
- 若**无**已暂存改动: 执行 `git add -A`（若我在上文附加要求中指定了提交范围, 则按该范围 add）后再提交;
- 若**已有**暂存改动: 不要再 add, 直接对已暂存内容提交。
用你上面生成的 commit message 执行 `git commit`; sandbox 环境用多个 `-m`（首个为标题, 其余为正文）, 不要加任何广告尾注。
```

### 非交互提交技能正文（`prompts/skill-commit.md` → `GIT_COMMIT_SKILL`）

```
## Task

把当前 git 工作区的改动提交为一条中文 commit message。这是**非交互执行**: 直接按下方规则生成推荐消息并提交, **不要向用户确认提交信息**, 也不要等待用户选择。

## Steps

1. 先运行只读 git 命令了解当前状态, 不要臆测:
   - `git status` —— 查看工作区与暂存区状态
   - `git diff --staged` —— 查看已暂存的改动（若没有暂存改动, 可再看 `git diff` 了解未暂存改动）
   - `git branch --show-current` —— 当前分支
   - `git log --oneline -10` —— 近期提交风格参考
2. 生成一条中文 commit message, 遵守下方 Format / Rules / Allowed Types。
3. 直接提交, 不询问用户:
   - 若**无**已暂存改动: 执行 `git add -A`（若任务中指定了提交范围, 按该范围 add）后再提交;
   - 若**已有**已暂存改动: 不要再 add, 直接对已暂存内容提交。
   - 用生成的 message 执行 `git commit`; sandbox 环境用多个 `-m`（首个为标题, 其余为正文）, 不要加任何广告尾注。

## Format

```
<type>:<space><message title in Chinese>

<bullet points in Chinese summarizing what was updated>
```

### Example Titles

```
feat(auth): 添加 JWT 登录流程
fix(ui): 修复侧边栏空指针问题
refactor(api): 拆分用户控制器逻辑
docs(readme): 添加使用说明章节
```

### Example with Title and Body

```
feat(auth): 添加 JWT 登录流程

- 实现了 JWT 令牌验证逻辑
- 为验证组件添加了文档说明
```

## Rules

* title is lowercase, no period at the end.
* Title should be a clear summary, max 50 Chinese characters.
* Use the body (optional) to explain *why*, not just *what*.
* Bullet points should be concise and high-level.

Avoid

* Vague titles like: "update", "fix stuff"
* Overly long or unfocused titles
* Excessive detail in bullet points

## Allowed Types

| Type     | Description                           |
| -------- | ------------------------------------- |
| feat     | New feature                           |
| fix      | Bug fix                               |
| chore    | Maintenance (e.g., tooling, deps)     |
| docs     | Documentation changes                 |
| refactor | Code restructure (no behavior change) |
| test     | Adding or refactoring tests           |
| style    | Code formatting (no logic change)     |
| perf     | Performance improvements              |
```

## Behavior

- 阶段状态机（`idle` / `generate` / `commit`）按会话 id 保存在**进程内**：`generate` 回合结束后弹三选；
  `commit` 回合结束后仅复位；`idle` 不干预普通对话。同一生成回合只弹一次三选（防抖）。
- 对话框被取消、agent 已失效、或部署无 `userQuestions` provider 时，流程安全回到 `idle`，不做任何提交。
- 插件消息以 `form: 'notice'` 形态写入转录（单行摘要），完整提示词作为消息正文。
- `git-commit-zh` 技能仅在宿主挂载 `skills` 服务时注册（`ctx.inject`），对模型与用户均开放
  （`modelInvocable: true, userInvocable: true`）；技能正文来自 `prompts/skill-commit.md`。

## Known Limitations and Deferred Work

- **阶段状态不跨进程持久化**：DSH 主机插件与进程同生命周期，阶段存于内存；完整重启后复位为
  `idle`。若在生成回合与三选之间重启，重跑一次 `/gen-commit-msg-zh` 即可。
- **交互菜单需要 UI 部署**：`userQuestions` 为可选服务，无 provider 时命令只触发生成轮、不弹菜单。
- **技能需要 `skills` 服务**：宿主未挂载 `dsh-skill` 时 `git-commit-zh` 不注册（命令不受影响）。
- **依赖模型与 bash 工具**：提交由模型执行，需要部署允许 bash 且具备 git 写权限。
- 未迁移 Pi 版的 `ctx.ui.notify` 通知（DSH 无对等 API）；进度通过命令结果文本与转录呈现。
