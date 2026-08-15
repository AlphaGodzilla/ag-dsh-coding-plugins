[中文](README.md) | [English](README.en.md)

# @ag-dsh/dsh-web-notify

DSH Web 通知提醒插件：对话完成、需要用户回答、需要授权、对话出错时，通过**浏览器原生系统通知**（Web Notifications API）提醒你——即使标签页在后台、窗口最小化或失焦，通知仍会出现在系统通知中心（macOS 通知中心 / Windows 操作中心）。支持 Chrome / Edge / Firefox / Safari。

## Installation

以最常用的 web profile 为例：

```sh
# 安装
dsh plugin --profile web add @ag-dsh/dsh-web-notify

# ⚠️ 安装后必须重启 dsh 才会加载：先退出当前 dsh 进程，再重新启动
dsh --profile web
```

> `dsh plugin add` 只负责安装并登记进 `dsh.profile.bundles`（profile 的
> `package.json`）；运行中的进程在启动时才组合配置树，热更新不监视 bundles
> 列表，因此需要重启才生效。

也可以不经过 bundle 机制，直接把插件行写入 profile 的 `cordis.yml` / `cordis.patch.yml`
（HMR 热应用，无需重启）：

```yaml
- id: web-notify
  name: '@ag-dsh/dsh-web-notify'
```

插件行（host 半区）只是**客户端 bundle 的载体**：dsh-client-modules 扫描已加载且声明
`dsh.client` 的包，把其 `./client` 导出（`lib/client.js`）作为浏览器 bundle 提供给 Web 端。
功能全部在浏览器侧运行，host 半区无业务逻辑。

### 依赖的宿主服务

| 服务 | 依赖方式 | 说明 |
|---|---|---|
| `slots`（客户端） | `ctx.get` 可选 | 注册 `shell.overlay` 后台会话引擎、`settings.plugin.item` 配置卡片与 `conversation.session.header.utilities` 观察引擎 |
| `sessions`（客户端） | `ctx.get` 可选 | 点击通知时跳转到对应会话 |
| `timer`（客户端） | `inject` 硬依赖 | 通知 12 秒后自动关闭 |

## Usage

1. **安装并重启后**，打开 **设置 → 插件 → 插件配置**，找到 **Web 通知** 卡片（`settings.plugin.item`），默认模式为**始终**（前台/后台都通知）、提示音默认**开启**。
2. 在配置页点击**「开启通知」**并允许浏览器权限请求（Firefox / Safari 必须从该按钮发起，这是浏览器的用户手势要求）。
3. 以下时刻会弹出系统通知（「始终」模式下前台也通知，可切回「仅后台」减少打扰）：
   - **对话完成**：任一会话的 turn 结束；
   - **需要你的回答**：助手调用 `ask_user_question` 提问（含 plan-review 计划确认）；
   - **需要授权**：出现待决授权请求；
   - **对话出错**：当前会话出现错误。
4. **点击通知**可聚焦窗口并跳转到对应会话。
5. 配置页控件：
   - **通知模式**：三选一（**仅后台**=窗口失焦时通知；**始终**=前台也通知，默认；**关闭**=不通知）；
   - **提示音**：开启/关闭开关（默认开启；不同事件音调不同：完成 1 声、提问/授权 2 声、出错 3 声），附「🎵 试听」按钮可依次播放三种提示音；
   - **通知权限**：显示当前状态（已允许 / 未开启 / 被拒绝），「被拒绝」时需在浏览器站点设置中手动允许 `127.0.0.1`（或部署域名）。

## Config

无。

## 模型可见文本

以下为**稳定契约**：通知标题与正文由 `src/core.ts` 的 `notificationSpec` 生成，
改动需同步本表与测试（`tests/index.spec.ts`）。

| 事件 | 标题 | 正文（按优先级） |
|---|---|---|
| 对话完成 | 对话完成 | 「[会话标题] 最后回复摘要」（截断 220 字）→ 会话标题 → 「助手已回复，点击查看」 |
| 需要回答 | 需要你的回答（多个问题时标注「（N 个问题）」） | 问题原文（截断 220 字）→ 会话标题 → 「请回答助手的问题」 |
| 需要授权 | 需要授权（子代理会话标注「（子代理）」） | 「[会话标题] 工具名：原因」→ 会话标题 → 「需要你的授权」 |
| 对话出错 | 对话出错 | 错误信息（截断 160 字）→ 「对话运行出错」 |

通知正文在截断前会先压缩连续空白（含换行），保证单行可读；授权通知含发起会话标题与工具/原因，提问通知含问题数量与第一问原文，便于在系统通知中心直接判断是否需要处理。

设置页文案（`src/core.ts` 的 `NOTIFY_MODE_LABELS`）：`仅后台` / `始终` / `关闭`；
按钮文案：`开启通知` / `通知被拒` / `通知不可用`。

## Behavior

- **信号来源**：直接订阅 DSH Web 端已有的会话状态快照（`useSessions` / `useSession`，
  由 websocket 推送驱动，**非轮询**），无 Host RPC、无额外网络请求。
- **覆盖范围**：`shell.overlay` 引擎（不可见）观察**所有会话**（含后台会话/子代理）的
  `running` 与 `pendingInteraction` 边沿；`conversation.session.header.utilities`
  引擎提供**当前会话**的富文本通知（问题原文、授权工具名与原因、错误信息），
  该槽位位于 composer 接管区域之外，提问/授权卡片弹出时观察不会中断。
- **防误报**：每个观察点首次观察只记录基线（页面加载、切换会话、会话加入列表
  均不误报）；通知 `tag = dsh-notify:<kind>:<sessionId>`，同会话同类通知在
  系统通知中心互替，不堆积。
- **浏览器兼容**：`Notification` API 为 Chrome / Edge / Firefox / Safari 原生支持；
  `127.0.0.1` / `localhost` 属安全上下文，可正常申请权限。
- **可逆副作用**：所有 Slot 注册（观察引擎与设置页）随插件 fiber 清理，定时器经
  `ctx.timeout`（`timer` 服务），HMR/热更新安全。

## Known Limitations and Deferred Work

- **浏览器完全退出或标签页关闭时无法通知**：本插件为页面内原生通知，不依赖服务端
  推送；需要「浏览器关闭也能收到」需接入 Web Push（Chrome 需 FCM、Safari 需 APNs），
  本地 127.0.0.1 服务无法接入，不在本包范围。
- **模式与提示音为进程内内存态**：页面刷新后重置为「始终 / 开启」；浏览器级
  通知权限本身由浏览器持久化，不受影响。
- **出错通知仅覆盖当前打开会话**：后台会话出错时，其 turn 结束会以「对话完成」
  通知提示（`running` 回落是两者共用的信号）。
- **多标签页**各自触发通知，靠 `tag` 互替避免同屏堆积。
- **会话列表加载中的瞬时快照**：列表首次构建前 `items` 可能短暂为空，已做防御
  （空数组处理），不会崩溃或误报。
- **提示音受浏览器自动播放策略约束**：需先在设置页点击过一次任意按钮（如「🎵 试听」）后才可能
  出声；不满足时静默降级。
