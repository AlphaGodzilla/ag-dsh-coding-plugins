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
