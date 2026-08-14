---
'@ag-dsh/dsh-gen-commit-msg-zh': minor
---

新插件: 生成中文 git commit message 并交互提交。注册 `/gen-commit-msg-zh [附加要求]` 命令, 模型只读探查 git 后生成中文 commit message, 回合结束弹出三选 (提交 / 调整消息 / 放弃), 提交由模型经 bash 执行。迁移自 Pi Coding Agent 扩展 (pi/agent/extensions/gen-commit-msg-zh)。
