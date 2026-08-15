import { describe, expect, it } from 'vitest'
import {
  NOTIFY_MODE_LABELS,
  NOTIFY_MODES,
  approvalDetail,
  cycleMode,
  lastAssistantText,
  notificationSpec,
  shouldNotify,
  truncate,
} from '../src/core.ts'
import { apply, name } from '../src/index.ts'

describe('@ag-dsh/dsh-web-notify', () => {
  it('exposes plugin metadata', () => {
    expect(name).toBe('web-notify')
    expect(typeof apply).toBe('function')
  })

  describe('truncate', () => {
    it('keeps short text unchanged', () => {
      expect(truncate('你好', 80)).toBe('你好')
    })

    it('truncates long text with ellipsis keeping the total within max', () => {
      expect(truncate('一二三四五', 3)).toBe('一二…')
    })

    it('collapses whitespace before truncating', () => {
      expect(truncate('a  b\nc   d', 10)).toBe('a b c d')
    })
  })

  describe('shouldNotify', () => {
    it('off never notifies', () => {
      expect(shouldNotify('off', false)).toBe(false)
      expect(shouldNotify('off', true)).toBe(false)
    })

    it('always notifies regardless of focus', () => {
      expect(shouldNotify('always', true)).toBe(true)
      expect(shouldNotify('always', false)).toBe(true)
    })

    it('auto notifies only when the page is unfocused', () => {
      expect(shouldNotify('auto', false)).toBe(true)
      expect(shouldNotify('auto', true)).toBe(false)
    })
  })

  describe('cycleMode', () => {
    it('cycles auto → always → off → auto', () => {
      expect(cycleMode('auto')).toBe('always')
      expect(cycleMode('always')).toBe('off')
      expect(cycleMode('off')).toBe('auto')
    })

    it('labels cover every mode', () => {
      for (const mode of NOTIFY_MODES) {
        expect(NOTIFY_MODE_LABELS[mode]).toBeTruthy()
      }
    })
  })

  describe('notificationSpec', () => {
    it('turn completion uses the session title', () => {
      expect(notificationSpec('turn', '我的会话')).toEqual({ title: '对话完成', body: '我的会话' })
    })

    it('turn completion prefers the reply detail', () => {
      expect(notificationSpec('turn', '我的会话', '[我的会话] 已完成任务')).toEqual({
        title: '对话完成',
        body: '[我的会话] 已完成任务',
      })
    })

    it('turn completion falls back to a generic body', () => {
      expect(notificationSpec('turn', '')).toEqual({ title: '对话完成', body: '助手已回复，点击查看' })
    })

    it('question prefers the question text over the session title', () => {
      expect(notificationSpec('question', '会话', '要现在继续吗？')).toEqual({
        title: '需要你的回答',
        body: '要现在继续吗？',
      })
      expect(notificationSpec('question', '会话')).toEqual({ title: '需要你的回答', body: '会话' })
    })

    it('question title counts multiple questions', () => {
      expect(notificationSpec('question', '会话', '问题一', { count: 3 })).toEqual({
        title: '需要你的回答（3 个问题）',
        body: '问题一',
      })
      expect(notificationSpec('question', '会话', '问题一', { count: 1 })).toEqual({
        title: '需要你的回答',
        body: '问题一',
      })
    })

    it('approval title marks subagent sessions', () => {
      expect(notificationSpec('approval', '会话')).toEqual({ title: '需要授权', body: '会话' })
      expect(notificationSpec('approval', '会话', undefined, { subagent: true })).toEqual({
        title: '需要授权（子代理）',
        body: '会话',
      })
    })

    it('error uses the detail', () => {
      expect(notificationSpec('error', '会话', '超时')).toEqual({ title: '对话出错', body: '超时' })
      expect(notificationSpec('error', '会话')).toEqual({ title: '对话出错', body: '对话运行出错' })
    })
  })

  describe('lastAssistantText', () => {
    it('extracts the last assistant-step text block', () => {
      const chat = {
        nodes: {
          values: () => [
            { kind: 'user', data: {} },
            { kind: 'assistant-step', data: { blocks: [{ kind: 'text', text: '第一段' }, { kind: 'tool-call', name: 'bash' }] } },
            { kind: 'assistant-step', data: { blocks: [{ kind: 'text', text: '第二段' }] } },
          ],
        },
      }
      expect(lastAssistantText(chat as never)).toBe('第二段')
    })

    it('joins multiple text blocks of the last step', () => {
      const chat = {
        nodes: {
          values: () => [
            { kind: 'assistant-step', data: { blocks: [{ kind: 'text', text: 'a' }, { kind: 'text', text: 'b' }] } },
          ],
        },
      }
      expect(lastAssistantText(chat as never)).toBe('a\nb')
    })

    it('returns an empty string when nothing is found', () => {
      expect(lastAssistantText()).toBe('')
      expect(lastAssistantText({ nodes: { values: () => [] } } as never)).toBe('')
      expect(lastAssistantText({} as never)).toBe('')
    })
  })

  describe('approvalDetail', () => {
    it('composes tool and reason', () => {
      expect(approvalDetail({ toolName: 'bash', reason: '需要提升权限' })).toBe('bash：需要提升权限')
    })

    it('omits the reason separator when absent', () => {
      expect(approvalDetail({ toolName: 'bash' })).toBe('bash')
    })

    it('returns undefined when nothing is present', () => {
      expect(approvalDetail()).toBeUndefined()
      expect(approvalDetail({})).toBeUndefined()
    })
  })
})
