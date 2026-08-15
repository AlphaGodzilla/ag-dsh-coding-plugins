[中文](README.md) | [English](README.en.md)

# @ag-dsh/dsh-gen-commit-msg-zh

DSH plugin: generate a Chinese git commit message and commit interactively. Migrated from the Pi Coding Agent extension `pi/agent/extensions/gen-commit-msg-zh`; the command name stays `/gen-commit-msg-zh` and it accepts an optional extra prompt.

## Installation

Since v1.1.0 the package ships an official `dsh.bundle` manifest (`dsh.bundle.patch` → `cordis.patch.yml`), so `dsh plugin add` registers it as a profile layer (appended to `dsh.profile.bundles`) and it loads on the next start:

```sh
dsh plugin --profile <name> add @ag-dsh/dsh-gen-commit-msg-zh
```

> The `missing peer @deepseek-ai/...` warnings at install time can be ignored: profiles default to `autoInstallPeers: false`, and these peers are provided at runtime by the dsh installation's module closure (`$DSH_HOME/profiles/node_modules`).

Alternatively, skip the bundle mechanism and add the plugin row directly to the profile's `cordis.yml` / `cordis.patch.yml`:

```yaml
- id: gen-commit-msg-zh
  name: '@ag-dsh/dsh-gen-commit-msg-zh'
```

Host services required:

| Service | Dependency | Description |
|---|---|---|
| `commands` | inject (hard) | Registers the `/gen-commit-msg-zh` command |
| `skills` | `ctx.inject` (optional) | Registers the `git-commit-zh` skill (non-interactive direct commit); the command keeps working when absent |
| `userQuestions` | `ctx.get` (optional) | Three-choice / adjustment input dialogs; the command still runs without it but shows no menu (needs a UI-backed deployment, e.g. `@deepseek-ai/dsh-tool-ask-user` + client UI) |

## Usage

### Interactive command

```
/gen-commit-msg-zh [附加要求]
```

Interactive flow:

1. **Generation turn** — the plugin sends the generation prompt (template + optional extra prompt) to the model and triggers a turn. The model runs read-only git commands (`git status` / `git diff --staged` / `git branch --show-current` / `git log --oneline -10`) to gather context, then generates and displays a Chinese commit message. **No git write command runs in this turn.**
2. **Three choices** — after the generation turn ends, a native dialog appears:
   - **A) Commit** — the plugin follows up with the commit instructions: the model first checks whether anything is staged; if not, `git add -A` then commit; otherwise commit the staged content directly (`git commit` with multiple `-m`: first as title, the rest as body).
   - **B) Adjust message** — enter a new prompt, regenerate, and get the three choices again (loops).
   - **C) Abandon** — no commit at all.
3. **Wrap-up** — after the commit turn ends the state resets without another interaction; the result is visible in the transcript.

The commit is executed by the model via bash; the plugin only orchestrates (prompts / interaction / followup) and never parses messages or runs git itself. The deployment must therefore allow the model to call the bash tool and have git write permission.

### Non-interactive skill `git-commit-zh`

The plugin also registers a model-callable skill (its name deliberately differs from the command `gen-commit-msg-zh`): in **non-user-interactive** scenarios (autonomous execution, UI-less / headless deployments, subagents, scripted flows), the model can load this skill to generate a recommended Chinese commit message for the current git changes and commit directly, **without user confirmation**. The skill is open to both model and user invocation (`modelInvocable: true, userInvocable: true`) and is registered only when the host mounts the `skills` service (`ctx.inject`, skipped when absent).

## Commands & Skills

| Name | Type | Description |
|---|---|---|
| `/gen-commit-msg-zh` | command | Generate a Chinese commit message and commit interactively (requires the user's three-choice confirmation) |
| `git-commit-zh` | skill | Non-interactive direct commit of the current changes (recommended message, no user confirmation) |

## Config

None (the plugin accepts no configuration).

## Model-visible text

The prompts below are a stable contract. **Source files** are `prompts/generate.md`, `prompts/commit.md` and `prompts/skill-commit.md` in the package (read at runtime by `src/prompts.ts`, falling back to a minimal prompt when missing). When changing a prompt, update this README and the tests in the same commit.

### Generation prompt (`prompts/generate.md` → `GENERATE_PROMPT`)

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

When an extra prompt is supplied, it is appended after the template:

```
### 用户附加要求

<附加要求原文>
```

### Commit prompt (`prompts/commit.md` → `COMMIT_PROMPT`)

```
用户已选择提交。请先运行 `git status`（或 `git diff --staged --stat`）判断是否已有暂存改动:
- 若**无**已暂存改动: 执行 `git add -A`（若我在上文附加要求中指定了提交范围, 则按该范围 add）后再提交;
- 若**已有**暂存改动: 不要再 add, 直接对已暂存内容提交。
用你上面生成的 commit message 执行 `git commit`; sandbox 环境用多个 `-m`（首个为标题, 其余为正文）, 不要加任何广告尾注。
```

### Non-interactive commit skill body (`prompts/skill-commit.md` → `GIT_COMMIT_SKILL`)

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

- The phase state machine (`idle` / `generate` / `commit`) is kept **in-process**, keyed by session id: `generate` turns end with the three-choice dialog; `commit` turns just reset; `idle` leaves ordinary conversations alone. A single generation turn shows the dialog at most once (debounced).
- When a dialog is cancelled, the agent is no longer live, or the deployment has no `userQuestions` provider, the flow safely returns to `idle` without committing.
- Plugin messages are written to the transcript as `form: 'notice'` (one-line summary) with the full prompt as the message body.
- The `git-commit-zh` skill is registered only when the host mounts the `skills` service (`ctx.inject`), open to both model and user (`modelInvocable: true, userInvocable: true`); its body comes from `prompts/skill-commit.md`.

## Known Limitations and Deferred Work

- **Phase state does not survive process restarts**: DSH host plugins live for the process lifetime, and the phase lives in memory; a full restart resets to `idle`. If the process restarts between the generation turn and the dialog, just run `/gen-commit-msg-zh` again.
- **Interactive menus need a UI deployment**: `userQuestions` is an optional service; without a provider the command only fires the generation turn and shows no menu.
- **The skill needs the `skills` service**: without `dsh-skill` mounted, `git-commit-zh` is not registered (the command is unaffected).
- **Depends on the model and the bash tool**: commits are executed by the model; the deployment must allow bash and have git write permission.
- Pi's `ctx.ui.notify` notifications were not migrated (DSH has no equivalent API); progress is shown via command result text and the transcript.
