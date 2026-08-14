import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import type { AskUserQuestionAnswer } from '@deepseek-ai/dsh-user-questions'
import { describe, expect, it, vi } from 'vitest'
import {
  CHOICE_OPTIONS,
  COMMIT_PROMPT,
  GENERATE_PROMPT,
  GIT_COMMIT_SKILL,
  GIT_COMMIT_SKILL_NAME,
  GenCommitFlow,
  apply,
  buildGeneratePrompt,
  inject,
  mapChoiceAnswer,
  name,
  pluginUserMessage,
} from '../src/index.ts'

/** 构造一个仅包含流程所需字段的假 agent。 */
function fakeAgent(id: string, followup = vi.fn()): Agent {
  return { session: { id }, followup } as unknown as Agent
}

/** 构造一个假的三选对话框实现, 可脚本化每次答案。 */
function fakeQuestions(script: Array<AskUserQuestionAnswer | Error>) {
  const ask = vi.fn(async () => {
    const next = script.shift()
    if (next instanceof Error) throw next
    if (next === undefined) throw new Error('fakeQuestions: 脚本已用尽')
    return next
  })
  return { ask }
}

function flowDeps(overrides: Partial<Parameters<GenCommitFlow>[0]> = {}) {
  const followup = vi.fn()
  const askChoice = vi.fn(async (): Promise<never> => { throw new Error('unexpected askChoice') })
  const askAdjustment = vi.fn(async (): Promise<string | undefined> => undefined)
  const logWarn = vi.fn()
  return {
    followup,
    askChoice,
    askAdjustment,
    logWarn,
    ...overrides,
  }
}

const choiceAnswer = (label: string): AskUserQuestionAnswer => ({
  answers: [{ id: 'gen-commit-msg-choice', selected: [label] }],
})

describe('gen-commit-msg-zh 插件元数据', () => {
  it('暴露正确的插件名与 apply', () => {
    expect(name).toBe('gen-commit-msg-zh')
    expect(typeof apply).toBe('function')
    expect(inject).toEqual(['commands'])
  })
})

describe('buildGeneratePrompt 提示词组装', () => {
  it('无附加要求时返回模板正文', () => {
    expect(buildGeneratePrompt('')).toBe(GENERATE_PROMPT)
    expect(buildGeneratePrompt('   ')).toBe(GENERATE_PROMPT)
  })

  it('有附加要求时拼接用户附加要求小节', () => {
    const prompt = buildGeneratePrompt('  标题改用 fix 类型  ')
    expect(prompt).toContain('### 用户附加要求\n\n标题改用 fix 类型')
    expect(prompt.startsWith(GENERATE_PROMPT)).toBe(true)
  })
})

describe('mapChoiceAnswer 三选映射', () => {
  it('把 A/B/C 前缀映射为对应动作', () => {
    expect(mapChoiceAnswer(['A) 提交'])).toBe('commit')
    expect(mapChoiceAnswer(['B) 调整消息'])).toBe('regenerate')
    expect(mapChoiceAnswer(['C) 放弃'])).toBe('abandon')
  })

  it('无法识别时返回 undefined', () => {
    expect(mapChoiceAnswer(undefined)).toBeUndefined()
    expect(mapChoiceAnswer([])).toBeUndefined()
    expect(mapChoiceAnswer(['X) 未知'])).toBeUndefined()
  })
})

describe('pluginUserMessage 插件消息构造', () => {
  it('生成 notice 形态的插件用户消息', () => {
    const message = pluginUserMessage('正文', '摘要')
    expect(message.role).toBe('user')
    expect(message.content).toEqual([{ type: 'text', text: '正文' }])
    expect(message.source).toMatchObject({
      kind: 'plugin',
      plugin: name,
      form: 'notice',
      summary: '摘要',
    })
  })
})

describe('GenCommitFlow.start 命令入口', () => {
  it('发起生成回合并返回命令结果文本', () => {
    const deps = flowDeps({ askChoice: vi.fn() })
    const flow = new GenCommitFlow(deps)
    const agent = fakeAgent('s1')

    const result = flow.start(agent, ' 附加要求 ')

    expect(result).toEqual({ kind: 'success', text: expect.stringContaining('附加要求') })
    expect(deps.followup).toHaveBeenCalledTimes(1)
    expect(deps.followup.mock.calls[0]?.[1]).toBe(buildGeneratePrompt('附加要求'))
  })
})

describe('GenCommitFlow.onIdle 回合结束流程', () => {
  it('选择提交: 跟进提交指令, 提交轮结束后不再弹交互', async () => {
    const deps = flowDeps({ askChoice: vi.fn(async () => 'commit') })
    const flow = new GenCommitFlow(deps)
    const agent = fakeAgent('s1')
    flow.start(agent, '')

    await flow.onIdle(agent)
    expect(deps.followup).toHaveBeenLastCalledWith(agent, COMMIT_PROMPT, expect.any(String))

    await flow.onIdle(agent)
    expect(deps.askChoice).toHaveBeenCalledTimes(1)
    expect(deps.followup).toHaveBeenCalledTimes(2)
  })

  it('选择调整: 输入文本后重新生成, 下个回合再次三选', async () => {
    const deps = flowDeps({
      askChoice: vi.fn(async () => 'regenerate'),
      askAdjustment: vi.fn(async () => ' 标题改用 fix 类型 '),
    })
    const flow = new GenCommitFlow(deps)
    const agent = fakeAgent('s1')
    flow.start(agent, '')

    await flow.onIdle(agent)
    expect(deps.followup).toHaveBeenLastCalledWith(agent, buildGeneratePrompt('标题改用 fix 类型'), expect.any(String))

    // 重新生成的回合再次结束: 三选应该再次弹出 (循环语义, 与原插件一致)
    await flow.onIdle(agent)
    expect(deps.askChoice).toHaveBeenCalledTimes(2)
    expect(deps.askAdjustment).toHaveBeenCalledTimes(2)
  })

  it('选择调整但未输入: 取消并回到 idle', async () => {
    const deps = flowDeps({
      askChoice: vi.fn(async () => 'regenerate'),
      askAdjustment: vi.fn(async () => undefined),
    })
    const flow = new GenCommitFlow(deps)
    const agent = fakeAgent('s1')
    flow.start(agent, '')

    await flow.onIdle(agent)
    expect(deps.followup).toHaveBeenCalledTimes(1) // 只有生成轮
    await flow.onIdle(agent)
    expect(deps.askChoice).toHaveBeenCalledTimes(1)
  })

  it('选择放弃: 不做任何提交', async () => {
    const deps = flowDeps({ askChoice: vi.fn(async () => 'abandon') })
    const flow = new GenCommitFlow(deps)
    const agent = fakeAgent('s1')
    flow.start(agent, '')

    await flow.onIdle(agent)
    expect(deps.followup).toHaveBeenCalledTimes(1)
    await flow.onIdle(agent)
    expect(deps.askChoice).toHaveBeenCalledTimes(1)
  })

  it('三选对话框被取消(抛错): 记警告并回到 idle', async () => {
    const deps = flowDeps({ askChoice: vi.fn(async () => { throw new Error('ASK_CANCELLED') }) })
    const flow = new GenCommitFlow(deps)
    const agent = fakeAgent('s1')
    flow.start(agent, '')

    await flow.onIdle(agent)
    expect(deps.logWarn).toHaveBeenCalledTimes(1)
    expect(deps.followup).toHaveBeenCalledTimes(1)
    await flow.onIdle(agent)
    expect(deps.askChoice).toHaveBeenCalledTimes(1)
  })

  it('idle 阶段不干预普通回合', async () => {
    const deps = flowDeps()
    const flow = new GenCommitFlow(deps)
    const agent = fakeAgent('s1')

    await flow.onIdle(agent)
    expect(deps.askChoice).not.toHaveBeenCalled()
    expect(deps.followup).not.toHaveBeenCalled()
  })

  it('同一生成回合不会重复弹三选 (menuOpen 防抖)', async () => {
    const deps = flowDeps({ askChoice: vi.fn(async () => 'abandon') })
    const flow = new GenCommitFlow(deps)
    const agent = fakeAgent('s1')
    flow.start(agent, '')

    // 三选尚未返回时再次 idle: 不应重复弹
    void flow.onIdle(agent)
    await flow.onIdle(agent)
    expect(deps.askChoice).toHaveBeenCalledTimes(1)
  })
})

describe('GIT_COMMIT_SKILL 非交互提交技能正文', () => {
  it('从 skill-commit.md 加载非空正文并包含非交互提交指引', () => {
    expect(GIT_COMMIT_SKILL.length).toBeGreaterThan(100)
    expect(GIT_COMMIT_SKILL).toContain('非交互执行')
    expect(GIT_COMMIT_SKILL).toContain('不要向用户确认提交信息')
    expect(GIT_COMMIT_SKILL).toContain('git commit')
  })
})

describe('apply 挂接 (真实 cordis 上下文)', () => {
  it('注册命令、handler 发起生成、回合结束触发三选', async () => {
    const ctx = new Context()
    const registered: Array<{ name: string; description: string; handler: (invocation: any) => unknown }> = []
    ctx.provide('commands', {
      register: (definition: (typeof registered)[number]) => {
        registered.push(definition)
        return () => {}
      },
    })

    const questions = fakeQuestions([choiceAnswer('C) 放弃')])
    ctx.provide('userQuestions', questions)

    const fiber = await ctx.plugin({ name, apply, inject }, {})
    expect(registered).toHaveLength(1)
    expect(registered[0]?.name).toBe('gen-commit-msg-zh')
    expect(registered[0]?.description).toContain('中文')

    const agent = fakeAgent('s1')
    const result = registered[0]?.handler({ agent, rawInput: '', commandId: 'c1', signal: new AbortController().signal })
    expect(result).toMatchObject({ kind: 'success' })
    expect(agent.followup).toHaveBeenCalledTimes(1)
    const sent = agent.followup.mock.calls[0]?.[0] as { content: Array<{ text: string }> }
    expect(sent.content[0]?.text).toBe(GENERATE_PROMPT)

    // 生成回合结束 → 三选弹出; 选 C) 放弃 → 无跟进
    ctx.emit('agent/status', { agent, status: 'idle' })
    await vi.waitFor(() => expect(questions.ask).toHaveBeenCalledTimes(1))
    const choiceQuestion = questions.ask.mock.calls[0]?.[0]?.questions?.[0]
    expect(choiceQuestion?.id).toBe('gen-commit-msg-choice')
    expect(choiceQuestion?.options).toHaveLength(CHOICE_OPTIONS.length)

    await fiber.dispose()
  })

  it('无 userQuestions 服务时命令仍可用, 交互时优雅降级', async () => {
    const ctx = new Context()
    const registered: Array<{ handler: (invocation: any) => unknown }> = []
    ctx.provide('commands', {
      register: (definition: (typeof registered)[number]) => {
        registered.push(definition)
        return () => {}
      },
    })

    const fiber = await ctx.plugin({ name, apply, inject }, {})
    const agent = fakeAgent('s2')
    const result = registered[0]?.handler({ agent, rawInput: '', commandId: 'c2', signal: new AbortController().signal })
    expect(result).toMatchObject({ kind: 'success' })
    expect(agent.followup).toHaveBeenCalledTimes(1)

    await fiber.dispose()
  })

  it('注册 git-commit-zh 技能: 模型可调用、用户不可调用、名称与命令不同', async () => {
    const ctx = new Context()
    const registeredSkills: SkillRegistration[] = []
    ctx.provide('commands', {
      register: () => () => {},
    })
    ctx.provide('skills', {
      register: (skill: SkillRegistration) => {
        registeredSkills.push(skill)
        return () => {}
      },
    })

    const fiber = await ctx.plugin({ name, apply, inject }, {})
    await vi.waitFor(() => expect(registeredSkills).toHaveLength(1))

    const skill = registeredSkills[0]
    expect(skill?.name).toBe(GIT_COMMIT_SKILL_NAME)
    // 技能名与命令名刻意不同
    expect(skill?.name).not.toBe('gen-commit-msg-zh')
    expect(skill?.description.length).toBeGreaterThan(0)
    expect(skill?.whenToUse).toBeDefined()
    expect(skill?.content).toBe(GIT_COMMIT_SKILL)
    expect(skill?.invocation).toEqual({ modelInvocable: true, userInvocable: false })
    expect(skill?.source).toBe('custom')

    await fiber.dispose()
  })
})
