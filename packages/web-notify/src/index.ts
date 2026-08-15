import type { Context } from '@deepseek-ai/cordis'

/** Cordis 插件名（与 cordis.patch.yml 的 id 一致，同时作为日志名）。 */
export const name = 'web-notify'

/**
 * Host 半区：仅作为客户端 bundle 的载体，无业务逻辑。
 *
 * dsh-client-modules 会扫描 host Loader 中已加载且声明了 `dsh.client` 的包，
 * 把其 `./client` 导出（本包 lib/client.js，由 src/client.ts 打包生成）作为
 * 浏览器 bundle 提供给 Web 端。本插件的全部功能在客户端半区：订阅 Web 端已有
 * 的会话状态快照（useSessions / useSession），通过 Web Notifications API
 * 在对话完成 / 需要回答 / 需要授权 / 出错时弹出系统通知。
 */
export function apply(_ctx: Context) {
  // 空实现：功能在客户端半区（src/client.ts → lib/client.js）。
}
