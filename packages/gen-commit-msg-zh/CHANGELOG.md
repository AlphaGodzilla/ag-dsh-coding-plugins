# @ag-dsh/dsh-gen-commit-msg-zh

## 1.1.1

### Patch Changes

- 36b2951: docs: 安装说明补充"安装/更新后需重启 dsh 才会加载"的提示与示例命令（以 web profile 为例）；`pnpm new` 脚手架与 AGENTS.md 同步该约定。

## 1.1.0

### Minor Changes

- 1d4639f: 升级为官方 dsh bundle：新增 `dsh.bundle` 清单（`dsh.bundle.patch` → `cordis.patch.yml`，patch 以裸包名 insert 插件行），`dsh plugin add` 现在会把它注册为 profile 配置层并随启动加载，而不再只是普通依赖。安装时的 `missing peer @deepseek-ai/...` 警告可忽略（运行时由 dsh 安装的模块闭包提供）。

### Patch Changes

- b3b2f34: 修复安装失败的问题

## 1.0.0

### Major Changes

- 29faf04: gen-commit-msg-zh插件e2e测试完成已可用

### Minor Changes

- 24d8d9b: 新插件: 生成中文 git commit message 并交互提交。注册 `/gen-commit-msg-zh [附加要求]` 命令, 模型只读探查 git 后生成中文 commit message, 回合结束弹出三选 (提交 / 调整消息 / 放弃), 提交由模型经 bash 执行。迁移自 Pi Coding Agent 扩展 (pi/agent/extensions/gen-commit-msg-zh)。
