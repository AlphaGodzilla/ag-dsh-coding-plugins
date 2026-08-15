/**
 * dsh-web-notify 浏览器半区：订阅 DSH Web 端已有的会话状态快照（websocket 推送
 * 的 useSessions / useSession），在对话完成、需要回答、需要授权、出错时通过
 * Web Notifications API 弹出系统通知（Chrome / Edge / Firefox / Safari）。
 *
 * 本文件由 build-client.mjs 打包为 dsh-client-modules 要求的独立 bundle
 * （window.__ModuleLoader__.load 工厂，`<pkg>/client` 导出），react 与
 * @deepseek-ai/* 保持 external，由 Web 端模块系统提供。
 */
import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import {
  NOTIFY_MODE_LABELS,
  NOTIFY_MODES,
  NOTIFY_TAG_PREFIX,
  type ChatViewLike,
  type NotifyKind,
  type NotifyMode,
  approvalDetail,
  lastAssistantText,
  notificationSpec,
  shouldNotify,
  truncate,
} from './core.ts'

/** 浏览器半区插件名。 */
export const name = 'web-notify'

/** 定时器（通知自动关闭）为硬依赖。 */
export const inject = ['timer']

/** 会话列表条目的最小形态（来自 SessionListState.items 的 wire 形状）。 */
interface SessionListEntry {
  id: string
  displayTitle?: string
  running?: boolean
  pendingInteraction?: string | null
  origin?: string
}

/** SessionListState 最小形态（shell.overlay 标准 props useSessions 的快照）。 */
interface SessionListState {
  items?: SessionListEntry[]
  current?: string
}

/** 当前会话快照的最小形态（ConversationSnapshot，header.utilities 标准 props）。 */
interface ConversationSnapshot {
  running?: boolean
  chat?: ChatViewLike
  pending?: Array<{
    key: string
    kind: string
    payload?: {
      questions?: Array<{ question?: string }>
      toolName?: string
      reason?: string
    }
  }>
  lastAgentError?: string
}

type SnapshotSelectorHook<S> = <T>(selector: (state: S) => T) => T

/** shell.overlay 条目标准 props。 */
interface OverlayProps {
  useSessions: SnapshotSelectorHook<SessionListState>
}

/** conversation.session.header.utilities 条目标准 props。 */
interface HeaderProps {
  sessionId: string
  useSessions: SnapshotSelectorHook<SessionListState>
  useSession: SnapshotSelectorHook<ConversationSnapshot>
}

/** 客户端 slots 服务最小形态。 */
interface SlotsServiceFace {
  inject: (key: string, effect: () => unknown) => () => void
  register: (
    options: { name: string; id: string; order?: number; label?: string | (() => string) },
    render: (props: never) => unknown,
  ) => unknown
}

/** 客户端 sessions 服务最小形态（点击通知跳转会话）。 */
interface SessionServiceFace {
  open: (id: string) => void
}

/** timer 服务最小形态（`ctx.timeout` 由 timer 混入在运行时提供，cordis 类型未静态声明）。 */
interface TimerFace {
  timeout: (callback: () => void, delay: number) => () => void
}

/** 插件配置卡片（settings.plugin.item）内容区内联样式，主题中性。 */
const SETTINGS_STYLE = {
  p: { margin: '0 0 14px', opacity: 0.75, fontSize: 13, lineHeight: 1.6 },
  row: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  label: { width: 88, flexShrink: 0, fontSize: 13 },
  modeBtn: {
    padding: '4px 14px',
    borderRadius: 6,
    border: '1px solid var(--dsw-alias-border-l2)',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 13,
  },
  modeActive: { fontWeight: 600, borderColor: 'currentColor' },
  btn: {
    padding: '4px 14px',
    borderRadius: 6,
    border: '1px solid var(--dsw-alias-border-l2)',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 13,
  },
  cta: { fontWeight: 600, borderColor: 'var(--dsw-alias-state-business-primary)', color: 'var(--dsw-alias-state-business-primary)' },
  hint: { fontSize: 12, opacity: 0.6, lineHeight: 1.6, margin: '4px 0 0' },
} as const

/**
 * 插件配置卡片可折叠样式（对齐产品内置插件卡片：
 * dsh-client-ui-settings-plugin-inventory，全部使用主题 CSS 变量适配明暗主题）。
 */
const CARD_CSS = [
  '.dshn-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:10px;min-width:0;overflow:hidden}',
  '.dshn-card[data-open="true"]{border-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-shadow-lv1)}',
  '.dshn-card-head{width:100%;box-sizing:border-box;min-height:52px;color:inherit;font:inherit;text-align:left;cursor:pointer;background:transparent;border:0;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px}',
  '.dshn-card-head:hover,.dshn-card[data-open="true"] .dshn-card-head{background:var(--dsw-alias-interactive-bg-hover)}',
  '.dshn-card-head:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}',
  '.dshn-card-title{font-size:14px;font-weight:600;line-height:20px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.dshn-card-trailing{display:inline-flex;align-items:center;gap:7px;color:var(--dsw-alias-label-tertiary);flex:none}',
  '.dshn-card-configtag{background:var(--dsw-alias-bg-layer-1);min-height:20px;color:var(--dsw-alias-label-secondary);white-space:nowrap;border-radius:5px;align-items:center;padding:1px 6px;font-size:11px;line-height:16px;display:inline-flex}',
  '.dshn-card-chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .14s var(--ds-ease-in-out)}',
  '.dshn-card[data-open="true"] .dshn-card-chevron{transform:rotate(180deg)}',
  '.dshn-card-body{border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);padding:12px 14px}',
].join('')

export function apply(ctx: Context) {
  const slots = ctx.get('slots') as SlotsServiceFace | undefined
  if (slots === undefined) return
  const sessionsSvc = ctx.get('sessions') as SessionServiceFace | undefined
  const timer = ctx as unknown as TimerFace

  // 进程内内存态（页面刷新后重置为默认值：始终通知 + 提示音开启）。
  const state: { mode: NotifyMode; sound: boolean; permission: string } = {
    mode: 'always',
    sound: true,
    permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  }

  let audioCtx: AudioContext | null = null
  function beep(times: number, freq: number) {
    if (!state.sound) return
    try {
      const AC = window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (typeof AC !== 'function') return
      if (audioCtx === null) audioCtx = new AC()
      if (audioCtx.state === 'suspended') void audioCtx.resume().catch(() => {})
      for (let i = 0; i < times; i++) {
        const t0 = audioCtx.currentTime + i * 0.22
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, t0)
        gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2)
        osc.start(t0)
        osc.stop(t0 + 0.22)
      }
    } catch {
      // 自动播放策略或浏览器不支持：静默
    }
  }

  function notify(
    kind: NotifyKind,
    sessionId: string,
    sessionTitle: string,
    detail?: string,
    opts?: { beeps?: number; freq?: number; count?: number; subagent?: boolean },
  ) {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      if (!shouldNotify(state.mode, typeof document !== 'undefined' && document.hasFocus())) return
      const spec = notificationSpec(kind, sessionTitle, detail, {
        ...(opts?.count !== undefined ? { count: opts.count } : {}),
        ...(opts?.subagent !== undefined ? { subagent: opts.subagent } : {}),
      })
      const n = new Notification(String(spec.title), {
        body: String(spec.body),
        tag: `${NOTIFY_TAG_PREFIX}:${kind}:${sessionId}`,
        silent: true,
      })
      n.addEventListener('click', () => {
        try {
          window.focus()
        } catch {
          /* ignore */
        }
        try {
          if (sessionsSvc !== undefined) sessionsSvc.open(sessionId)
        } catch {
          /* ignore */
        }
        n.close()
      })
      timer.timeout(() => {
        try {
          n.close()
        } catch {
          /* ignore */
        }
      }, 12000)
      beep(opts?.beeps ?? 1, opts?.freq ?? 660)
    } catch {
      // 权限被撤、浏览器不支持等：静默
    }
  }

  // ① shell.overlay：后台会话引擎 + 右下角药丸控件（root 级，常驻）。
  slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'dsh-notify-pill' },
    (props: never) => {
      const overlayProps = props as OverlayProps
      const list = overlayProps.useSessions((s) => s) ?? {}
      const items = Array.isArray(list.items) ? list.items : []
      const current = list.current
      const prevRunning = React.useRef(new Map<string, boolean>())
      const prevPending = React.useRef(new Map<string, string | null>())

      // 后台会话（非当前选中）的 running / pendingInteraction 边沿检测；
      // 首次观察只记录基线（防加载/切会话时误报）。
      React.useEffect(() => {
        const ids = new Set<string>()
        for (const item of items) {
          ids.add(item.id)
          if (item.id === current) continue
          const prevRun = prevRunning.current.get(item.id)
          if (prevRun === undefined) {
            prevRunning.current.set(item.id, item.running === true)
          } else {
            if (prevRun && item.running !== true) {
              notify('turn', item.id, truncate(item.displayTitle ?? item.id, 80))
            }
            prevRunning.current.set(item.id, item.running === true)
          }
          const nextPending = item.pendingInteraction ?? null
          const prevPen = prevPending.current.get(item.id)
          if (prevPen === undefined) {
            prevPending.current.set(item.id, nextPending)
          } else if (prevPen !== nextPending) {
            const title = truncate(item.displayTitle ?? item.id, 80)
            const subagent = item.origin === 'subagent'
            if (nextPending === 'question' || nextPending === 'plan-review') {
              notify('question', item.id, title, undefined, { beeps: 2, freq: 880 })
            } else if (nextPending === 'approval') {
              notify('approval', item.id, title, undefined, { beeps: 2, freq: 880, subagent })
            }
            prevPending.current.set(item.id, nextPending)
          }
        }
        for (const key of prevRunning.current.keys()) if (!ids.has(key)) prevRunning.current.delete(key)
        for (const key of prevPending.current.keys()) if (!ids.has(key)) prevPending.current.delete(key)
      }, [items, current])

      // 不可见：仅承载后台会话观察引擎，配置入口见「设置 → 插件 → Web 通知」。
      return null
    },
  ))

  // ①b settings.plugin.item：插件配置分区内的可折叠配置卡片
  //（结构对齐产品内置插件卡片：标题栏 + 展开内容区 + chevron）。
  slots.inject('settings.plugin.item', () => slots.register(
    { name: 'settings.plugin.item', id: 'dsh-web-notify', order: 30, label: 'Web 通知' },
    () => {
      const [open, setOpen] = React.useState(false)
      const [, force] = React.useState(0)
      const setMode = (mode: NotifyMode) => {
        state.mode = mode
        force((x) => x + 1)
      }
      const onToggleSound = () => {
        state.sound = !state.sound
        force((x) => x + 1)
      }
      const onEnable = async () => {
        try {
          const res = await Notification.requestPermission()
          state.permission = res || Notification.permission
        } catch {
          console.error('dsh-web-notify: permission request failed')
        }
        force((x) => x + 1)
      }
      // 试听：依次播放完成（1 声 660Hz）→ 提问/授权（2 声 880Hz）→ 出错（3 声 440Hz）。
      const onDemoSound = () => {
        beep(1, 660)
        timer.timeout(() => beep(2, 880), 600)
        timer.timeout(() => beep(3, 440), 1300)
      }

      const rows: React.ReactNode[] = []
      // 通知模式
      rows.push(React.createElement('div', { key: 'mode', style: SETTINGS_STYLE.row },
        React.createElement('span', { style: SETTINGS_STYLE.label }, '通知模式'),
        ...NOTIFY_MODES.map((mode) => React.createElement('button', {
          key: mode,
          onClick: () => setMode(mode),
          style: mode === state.mode ? { ...SETTINGS_STYLE.modeBtn, ...SETTINGS_STYLE.modeActive } : SETTINGS_STYLE.modeBtn,
          title: mode === 'auto' ? '窗口失焦时通知' : mode === 'always' ? '前台与后台都通知' : '不通知',
        }, NOTIFY_MODE_LABELS[mode])),
      ))
      // 提示音
      rows.push(React.createElement('div', { key: 'sound', style: SETTINGS_STYLE.row },
        React.createElement('span', { style: SETTINGS_STYLE.label }, '提示音'),
        React.createElement('button', { onClick: onToggleSound, style: SETTINGS_STYLE.btn }, state.sound ? '开启 🔊' : '关闭 🔇'),
        React.createElement('button', { onClick: onDemoSound, style: SETTINGS_STYLE.btn }, '🎵 试听'),
      ))
      // 通知权限
      let permissionCell: React.ReactNode
      if (state.permission === 'granted') {
        permissionCell = React.createElement('span', null, '已允许')
      } else if (state.permission === 'default') {
        permissionCell = React.createElement('button', {
          onClick: onEnable,
          style: { ...SETTINGS_STYLE.btn, ...SETTINGS_STYLE.cta },
        }, '开启通知')
      } else if (state.permission === 'denied') {
        permissionCell = React.createElement('span', null, '被拒绝（请在浏览器站点设置中允许本网站通知）')
      } else {
        permissionCell = React.createElement('span', null, '当前浏览器不支持通知')
      }
      rows.push(React.createElement('div', { key: 'permission', style: SETTINGS_STYLE.row },
        React.createElement('span', { style: SETTINGS_STYLE.label }, '通知权限'),
        permissionCell,
      ))

      // 标题栏右侧：当前模式标签 + 展开 chevron
      const trailing = React.createElement('span', { className: 'dshn-card-trailing' },
        React.createElement('span', { className: 'dshn-card-configtag' }, NOTIFY_MODE_LABELS[state.mode]),
        React.createElement('svg', {
          className: 'dshn-card-chevron',
          width: 16,
          height: 16,
          viewBox: '0 0 16 16',
          'aria-hidden': true,
        },
          React.createElement('path', {
            d: 'M4 6l4 4 4-4',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.5,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }),
        ),
      )

      return React.createElement('div', {
        className: 'dshn-card',
        'data-open': open ? 'true' : undefined,
      },
        React.createElement('button', {
          type: 'button',
          className: 'dshn-card-head',
          onClick: () => setOpen(!open),
          'aria-expanded': open,
        },
          React.createElement('span', { className: 'dshn-card-title' }, 'Web 通知提醒(dsh-web-notify)'),
          trailing,
        ),
        open ? React.createElement('div', { className: 'dshn-card-body' },
          React.createElement('p', { style: SETTINGS_STYLE.p },
            '对话完成、需要回答、需要授权、对话出错时，通过浏览器系统通知提醒你；点击通知可跳转到对应会话。',
          ),
          ...rows,
          React.createElement('p', { style: SETTINGS_STYLE.hint },
            '说明：通知模式「仅后台」仅在窗口失焦时通知，「始终」前台也通知（默认）；提示音默认开启，受浏览器自动播放策略约束（需先点击本页任意按钮一次）。',
          ),
        ) : null,
      )
    },
  ))

  // ② conversation.session.header.utilities：当前会话富文本引擎（不可见）。
  // 该槽位位于 composer 接管区域之外，问题/授权卡片出现时不会卸载，
  // 可提供问题原文、授权工具名与原因、出错信息等富文本通知。
  slots.inject('conversation.session.header.utilities', () => slots.register(
    { name: 'conversation.session.header.utilities', id: 'dsh-notify-session' },
    (props: never) => {
      const headerProps = props as HeaderProps
      const sessionId = headerProps.sessionId
      const snap = headerProps.useSession((s) => s) ?? {}
      const running = snap.running === true
      const pending = Array.isArray(snap.pending) ? snap.pending : []
      const lastError = snap.lastAgentError
      const list = headerProps.useSessions((s) => s) ?? {}
      const itemsList = Array.isArray(list.items) ? list.items : []
      const prevRunRef = React.useRef<boolean | null>(null)
      const prevErrRef = React.useRef<string | undefined>(undefined)
      const errSeededRef = React.useRef(false)
      const seenRef = React.useRef(new Set<string>())
      const seededRef = React.useRef(false)
      const activeSessionRef = React.useRef<string | null>(null)

      // 会话切换（组件实例可能复用而非重挂）：重置全部基线，
      // 避免把上一会话的 running/pending/error 状态误判为当前会话的事件。
      if (activeSessionRef.current !== sessionId) {
        activeSessionRef.current = sessionId
        prevRunRef.current = null
        prevErrRef.current = undefined
        errSeededRef.current = false
        seenRef.current = new Set()
        seededRef.current = false
      }

      // 当前会话 turn 完成（running true→false）：正文含最后一条助手回复摘要。
      React.useEffect(() => {
        if (prevRunRef.current === null) {
          prevRunRef.current = running
          return
        }
        if (prevRunRef.current && !running) {
          const entry = itemsList.find((i) => i.id === sessionId)
          const title = entry?.displayTitle ?? ''
          const reply = lastAssistantText(snap.chat)
          const body = reply
            ? (title ? `[${title}] ${reply}` : reply)
            : title || '助手已回复，点击查看'
          notify('turn', sessionId, title, truncate(body, 220))
        }
        prevRunRef.current = running
      }, [running, sessionId, itemsList])

      // 当前会话新增待回答/待授权（首渲染先种子化，不重复通知既有等待）。
      React.useEffect(() => {
        if (!seededRef.current) {
          seededRef.current = true
          for (const w of pending) seenRef.current.add(w.key)
          return
        }
        for (const w of pending) {
          if (seenRef.current.has(w.key)) continue
          seenRef.current.add(w.key)
          const entry = itemsList.find((i) => i.id === sessionId)
          const sessionTitle = entry?.displayTitle ?? ''
          if (w.kind === 'question') {
            const qs = w.payload?.questions
            const q = Array.isArray(qs) ? qs[0] : undefined
            const count = Array.isArray(qs) ? qs.length : 1
            notify('question', sessionId, sessionTitle, truncate(q?.question ?? '请回答助手的问题', 220), {
              beeps: 2,
              freq: 880,
              count,
            })
          } else if (w.kind === 'approval') {
            const detail = approvalDetail(w.payload)
            const combined = detail ? (sessionTitle ? `[${sessionTitle}] ${detail}` : detail) : undefined
            notify('approval', sessionId, sessionTitle, combined, {
              beeps: 2,
              freq: 880,
              subagent: entry?.origin === 'subagent',
            })
          }
        }
      }, [pending, sessionId])

      // 当前会话出错（lastAgentError 变化；首观察只种子化基线）。
      React.useEffect(() => {
        if (lastError === undefined) {
          prevErrRef.current = undefined
          return
        }
        if (!errSeededRef.current) {
          errSeededRef.current = true
          prevErrRef.current = lastError
          return
        }
        if (prevErrRef.current === lastError) return
        prevErrRef.current = lastError
        notify('error', sessionId, '', truncate(lastError, 160), { beeps: 3, freq: 440 })
      }, [lastError, sessionId])

      return null
    },
  ))

  // 可折叠卡片样式：随插件 fiber 卸载自动移除（可逆副作用）。
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.setAttribute('data-plugin-css', 'dsh-web-notify-card')
    tag.textContent = CARD_CSS
    document.head.append(tag)
    return () => {
      tag.remove()
    }
  })
}
