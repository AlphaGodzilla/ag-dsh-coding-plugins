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
