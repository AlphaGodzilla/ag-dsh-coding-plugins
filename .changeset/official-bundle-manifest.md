---
'@ag-dsh/dsh-gen-commit-msg-zh': minor
---

升级为官方 dsh bundle：新增 `dsh.bundle` 清单（`dsh.bundle.patch` → `cordis.patch.yml`，patch 以裸包名 insert 插件行），`dsh plugin add` 现在会把它注册为 profile 配置层并随启动加载，而不再只是普通依赖。安装时的 `missing peer @deepseek-ai/...` 警告可忽略（运行时由 dsh 安装的模块闭包提供）。
