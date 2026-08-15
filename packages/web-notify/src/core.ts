/**
 * dsh-web-notify 纯逻辑核心：通知模式门控、文案组装、工具函数。
 *
 * 与浏览器解耦（不依赖 window/document/Notification），可被 vitest 直接测试；
 * 浏览器半区（src/client.ts）与测试共同消费本模块，保证行为单一事实源。
 */

/** 通知模式：auto=仅页面失焦时通知；always=始终；off=关闭。 */
export type NotifyMode = 'auto' | 'always' | 'off'

/** 通知类别（同时作为通知 tag 的一部分）。 */
export type NotifyKind = 'turn' | 'question' | 'approval' | 'error'

/** 模式循环顺序（药丸按钮点击依此切换）。 */
export const NOTIFY_MODES: readonly NotifyMode[] = ['auto', 'always', 'off']

/** 模式显示标签（药丸按钮文案，稳定契约）。 */
export const NOTIFY_MODE_LABELS: Record<NotifyMode, string> = {
  auto: '仅后台',
  always: '始终',
  off: '关闭',
}

/** 通知 tag 前缀：同会话同类通知在系统通知中心互替（不堆积）。 */
export const NOTIFY_TAG_PREFIX = 'dsh-notify'

/** 截断文本：先压缩连续空白（含换行）再截取前 max 个字符，超出以省略号结尾。 */
export function truncate(text: string, max: number): string {
  const s = String(text).replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/**
 * 模式是否应触发通知：
 * - off 恒不通知；
 * - always 无条件通知；
 * - auto 仅当页面失焦（focused=false，覆盖标签页隐藏与窗口失焦）。
 */
export function shouldNotify(mode: NotifyMode, focused: boolean): boolean {
  if (mode === 'off') return false
  if (mode === 'always') return true
  return !focused
}

/** 循环到下一个通知模式。 */
export function cycleMode(mode: NotifyMode): NotifyMode {
  return NOTIFY_MODES[(NOTIFY_MODES.indexOf(mode) + 1) % NOTIFY_MODES.length]!
}

/** 通知文案的附加上下文。 */
export interface NotifyContext {
  /** 问题数量（>1 时标题标注「N 个问题」）。 */
  count?: number
  /** 是否为子代理会话（授权标题标注「（子代理）」）。 */
  subagent?: boolean
}

/**
 * 通知文案（稳定契约，与 README「通知文案」表同步维护）：
 * - turn      对话完成 / 最后回复摘要（无摘要时退回会话标题，再退回通用文案）
 * - question  需要你的回答（多问题标注数量）/ 问题原文（无原文时退回会话标题）
 * - approval  需要授权（子代理会话标注）/ 「工具名：原因」（无详情时退回会话标题）
 * - error     对话出错 / 错误信息（无详情时用通用文案）
 */
export function notificationSpec(
  kind: NotifyKind,
  sessionTitle: string,
  detail?: string,
  context?: NotifyContext,
): { title: string; body: string } {
  switch (kind) {
    case 'turn':
      return { title: '对话完成', body: detail || sessionTitle || '助手已回复，点击查看' }
    case 'question':
      return {
        title: typeof context?.count === 'number' && context.count > 1
          ? `需要你的回答（${context.count} 个问题）`
          : '需要你的回答',
        body: detail || sessionTitle || '请回答助手的问题',
      }
    case 'approval':
      return {
        title: context?.subagent ? '需要授权（子代理）' : '需要授权',
        body: detail || sessionTitle || '需要你的授权',
      }
    case 'error':
      return { title: '对话出错', body: detail || '对话运行出错' }
  }
}

/** 授权请求载荷的最小形态（来自 approval/requested 帧的 payload）。 */
export interface ApprovalPayload {
  toolName?: string
  reason?: string
}

/** 组装授权通知正文：「工具名：原因」；无任何内容时返回 undefined。 */
export function approvalDetail(payload?: ApprovalPayload): string | undefined {
  if (payload === undefined) return undefined
  const tool = typeof payload.toolName === 'string' ? payload.toolName : ''
  const reason = typeof payload.reason === 'string' ? payload.reason : ''
  return tool + (reason ? `：${reason}` : '') || undefined
}

/** 助手消息块的最小形态（assistant-step 节点 data.blocks 的元素）。 */
export interface AssistantBlock {
  kind?: string
  text?: string
}

/** 聊天节点最小形态（snapshot.chat.nodes 的值，ChatNode）。 */
export interface ChatNodeLike {
  kind?: string
  data?: { blocks?: AssistantBlock[] }
}

/** 聊天视图快照最小形态（ConversationSnapshot.chat，nodes 为 Map 形态）。 */
export interface ChatViewLike {
  nodes?: { values?: () => Iterable<ChatNodeLike> }
}

/**
 * 从会话快照的聊天视图提取最后一个含文本的 assistant-step 节点文本
 * （拼接该步的全部 text 块）。用于「对话完成」通知正文；无结果返回空串。
 */
export function lastAssistantText(chat?: ChatViewLike): string {
  if (!chat || typeof chat !== 'object') return ''
  const nodes = chat.nodes
  if (!nodes || typeof nodes.values !== 'function') return ''
  let last = ''
  for (const node of nodes.values()) {
    if (node?.kind !== 'assistant-step') continue
    const blocks = node.data?.blocks
    if (!Array.isArray(blocks)) continue
    const text = blocks
      .filter((b) => b?.kind === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('\n')
    if (text.trim() !== '') last = text
  }
  return last
}
