/**
 * gen-commit-msg-zh — 生成中文 git commit message 并交互提交
 *
 * 从 Pi Coding Agent 扩展 (pi/agent/extensions/gen-commit-msg-zh) 迁移而来,
 * 命令名保持 `/gen-commit-msg-zh`, 支持携带附加提示词运行。
 *
 * 用户故事:
 *  1. `/gen-commit-msg-zh [附加要求]` —— 把生成提示词 + 附加要求作为插件消息
 *     followup 给 LLM 并触发一轮; LLM 自行运行 git 只读命令获取上下文, 生成并
 *     展示中文 commit message, 本轮不做任何 git 写操作。
 *  2. 该回合结束 (agent/status → idle) 后弹出三选 (DSH 原生提问对话框):
 *     A) 提交     —— followup 提交指令: 无暂存则 git add 后提交, 已有暂存则直接提交
 *     B) 调整消息 —— 输入新的提示词, 重新生成并再次三选
 *     C) 放弃     —— 不做任何提交
 *  3. commit 由 LLM 经 bash 执行, 插件只负责编排 (发提示词 / 交互 / followup),
 *     不解析消息、不执行 git。
 *
 * 阶段状态机 phase (每会话进程内维护, 见 {@link GenCommitFlow}):
 *  - "idle":     普通对话, 回合结束不干预
 *  - "generate": 刚发过生成提示词, 回合结束弹三选
 *  - "commit":   刚发过提交指令, 回合结束仅复位, 不再弹交互
 */

import type { Agent } from '@deepseek-ai/dsh-agent'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import type { AskUserQuestionOption, UserQuestionService } from '@deepseek-ai/dsh-user-questions'
import type { Context } from '@deepseek-ai/cordis'

/** 模型提示词 (生成轮 / 提交轮 / 非交互提交技能): 来自包内 prompts/*.md, 见 src/prompts.ts。 */
import { COMMIT_PROMPT, GENERATE_PROMPT, GIT_COMMIT_SKILL } from './prompts.ts'
export { COMMIT_PROMPT, GENERATE_PROMPT, GIT_COMMIT_SKILL } from './prompts.ts'

/** Cordis 插件名, 同时作为日志与插件消息来源标识。 */
export const name = 'gen-commit-msg-zh'

/** 硬依赖: 命令注册服务。交互提问服务 (userQuestions) 与技能注册服务 (skills) 为可选, 分别经 ctx.get / ctx.inject 使用。 */
export const inject = ['commands']

/** 非交互提交技能名 (与命令名 /gen-commit-msg-zh 刻意不同)。 */
export const GIT_COMMIT_SKILL_NAME = 'git-commit-zh'

/** 一轮结束后的三选选项。 */
export const CHOICE_OPTIONS: readonly AskUserQuestionOption[] = [
  { label: 'A) 提交', description: '无暂存则 git add 后提交, 已有暂存则直接提交' },
  { label: 'B) 调整消息', description: '输入新的提示词, 重新生成' },
  { label: 'C) 放弃', description: '不做任何提交' },
]

/** 阶段状态机。 */
export type Phase = 'idle' | 'generate' | 'commit'

/** 用户在生成回合结束后的三选。 */
export type CommitChoice = 'commit' | 'regenerate' | 'abandon'

/** 组装生成轮提示词: 模板正文 + 可空的用户附加要求。 */
export function buildGeneratePrompt(extra: string): string {
  const trimmed = extra.trim()
  return trimmed ? `${GENERATE_PROMPT}\n\n### 用户附加要求\n\n${trimmed}` : GENERATE_PROMPT
}

/** 构造一条插件来源的用户消息 (notice 形态, 转录中以单行摘要展示)。 */
export function pluginUserMessage(text: string, summary: string): UserMessage {
  return createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'plugin', plugin: name, form: 'notice', summary },
  })
}

/** 把三选对话框的答案映射为 {@link CommitChoice}; 无法识别时返回 undefined。 */
export function mapChoiceAnswer(selected: readonly string[] | undefined): CommitChoice | undefined {
  const first = selected?.[0]
  if (first?.startsWith('A')) return 'commit'
  if (first?.startsWith('B')) return 'regenerate'
  if (first?.startsWith('C')) return 'abandon'
  return undefined
}

/** 弹出三选对话框并等待用户选择。 */
export async function askChoice(questions: UserQuestionService, agent: Agent): Promise<CommitChoice> {
  const answer = await questions.ask({
    agent,
    questions: [{
      id: 'gen-commit-msg-choice',
      question: 'commit message 已生成, 接下来做什么?',
      options: [...CHOICE_OPTIONS],
    }],
  })
  const item = answer.answers.find((entry) => entry.id === 'gen-commit-msg-choice')
  const choice = mapChoiceAnswer(item?.selected)
  if (choice === undefined) throw new Error('gen-commit-msg-zh: 无法识别的三选答案')
  return choice
}

/** 弹出调整输入对话框; 用户未输入或取消时返回 undefined。 */
export async function askAdjustment(questions: UserQuestionService, agent: Agent): Promise<string | undefined> {
  const answer = await questions.ask({
    agent,
    questions: [{
      id: 'gen-commit-msg-adjust',
      question: '如何调整 commit message?',
      detail: '例如: 标题改用 fix 类型 / 补充某项说明',
    }],
  })
  const item = answer.answers.find((entry) => entry.id === 'gen-commit-msg-adjust')
  const text = item?.custom?.trim()
  return text === '' || text === undefined ? undefined : text
}

/** 流程对外副作用, 便于测试注入。 */
export interface GenCommitFlowDeps {
  /** 把一条模型提示词作为插件消息跟进给 agent。 */
  followup(agent: Agent, text: string, summary: string): void
  /** 弹出三选对话框。 */
  askChoice(agent: Agent): Promise<CommitChoice>
  /** 弹出调整输入对话框。 */
  askAdjustment(agent: Agent): Promise<string | undefined>
  /** 记录警告 (交互失败、状态异常等)。 */
  logWarn(message: string, error?: unknown): void
}

/** 每会话的交互状态。 */
interface FlowState {
  phase: Phase
  /** 该生成回合是否已弹过三选 (防止同一回合重复弹)。 */
  menuOpen: boolean
}

/**
 * 编排生成 → 三选 → 提交/调整/放弃 的流程状态机。阶段状态按会话 id
 * 保存在进程内: DSH 主机插件与进程同生命周期, 无需落盘; 完整重启后
 * 阶段复位为 idle, 用户重新运行命令即可 (见 README Known Limitations)。
 */
export class GenCommitFlow {
  private readonly states = new Map<string, FlowState>()

  constructor(private readonly deps: GenCommitFlowDeps) {}

  /** `/gen-commit-msg-zh` 命令入口: 记录 generate 阶段并发起生成回合。 */
  start(agent: Agent, rawInput: string): CommandResult {
    const extra = rawInput.trim()
    this.setState(agent, { phase: 'generate', menuOpen: false })
    this.deps.followup(agent, buildGeneratePrompt(extra), extra ? `正在生成中文 commit message（附加要求: ${extra}）` : '正在生成中文 commit message')
    return {
      kind: 'success',
      text: extra ? `已开始生成 commit message（附加要求: ${extra}）…` : '已开始生成 commit message…',
    }
  }

  /** agent 回合结束 (agent/status → idle) 时按阶段处理。该 Promise 永不 reject。 */
  async onIdle(agent: Agent): Promise<void> {
    const state = this.stateFor(agent)
    if (state.phase === 'commit') {
      // 提交执行轮结束: 不再弹交互, 仅复位
      this.setState(agent, { phase: 'idle', menuOpen: false })
      return
    }
    if (state.phase !== 'generate' || state.menuOpen) return
    this.setState(agent, { ...state, menuOpen: true })
    try {
      const choice = await this.deps.askChoice(agent)
      switch (choice) {
        case 'commit': {
          this.setState(agent, { phase: 'commit', menuOpen: false })
          this.deps.followup(agent, COMMIT_PROMPT, '用户已选择提交, 正在执行 git commit')
          return
        }
        case 'regenerate': {
          const extra = await this.deps.askAdjustment(agent)
          if (extra === undefined) {
            // 未输入调整内容: 视为放弃调整
            this.setState(agent, { phase: 'idle', menuOpen: false })
            return
          }
          // 保持 generate, 重新生成后再次三选
          this.setState(agent, { phase: 'generate', menuOpen: false })
          this.deps.followup(agent, buildGeneratePrompt(extra), `按用户调整重新生成 commit message（调整: ${extra}）`)
          return
        }
        case 'abandon': {
          this.setState(agent, { phase: 'idle', menuOpen: false })
          return
        }
      }
    } catch (error) {
      // 对话框被取消 / agent 已失效 / 无 UI provider 等: 一律回到 idle
      this.deps.logWarn(`gen-commit-msg-zh: 交互流程中断, 已放弃: ${error instanceof Error ? error.message : String(error)}`, error)
      this.setState(agent, { phase: 'idle', menuOpen: false })
    }
  }

  private stateFor(agent: Agent): FlowState {
    const existing = this.states.get(agent.session.id)
    if (existing !== undefined) return existing
    const fresh: FlowState = { phase: 'idle', menuOpen: false }
    this.states.set(agent.session.id, fresh)
    return fresh
  }

  private setState(agent: Agent, state: FlowState): void {
    this.states.set(agent.session.id, state)
  }
}

/** 注册 `/gen-commit-msg-zh` 命令并挂接回合结束事件。 */
export function apply(ctx: Context) {
  const flow = new GenCommitFlow({
    followup: (agent, text, summary) => {
      agent.followup(pluginUserMessage(text, summary))
    },
    askChoice: (agent) => {
      const questions = ctx.get('userQuestions')
      if (questions === undefined) {
        throw new Error('userQuestions 服务不可用: 交互菜单需要带 UI 的 DSH 部署')
      }
      return askChoice(questions, agent)
    },
    askAdjustment: (agent) => {
      const questions = ctx.get('userQuestions')
      if (questions === undefined) {
        throw new Error('userQuestions 服务不可用: 交互菜单需要带 UI 的 DSH 部署')
      }
      return askAdjustment(questions, agent)
    },
    logWarn: (message, error) => {
      ctx.logger(name).warn(message, error)
    },
  })

  ctx.commands.register({
    name: 'gen-commit-msg-zh',
    description: '生成中文 git commit message 并交互提交',
    input: { hint: '[附加要求]' },
    handler: (invocation: CommandInvocation) => flow.start(invocation.agent, invocation.rawInput),
  })

  // 注册非交互提交技能: 模型在无需用户确认的场景 (自主执行 / 无 UI / 子代理)
  // 下直接按推荐消息提交。skills 服务为可选依赖, 缺失时命令部分不受影响。
  ctx.inject(['skills'], (skillCtx) => {
    skillCtx.skills.register({
      name: GIT_COMMIT_SKILL_NAME,
      description: '把当前 git 改动直接提交为一条中文 commit message（非交互, 无需用户确认）',
      whenToUse: '用户要求直接提交改动而不需要交互确认时; 在无 UI 或自主执行场景（子代理、脚本化流程）需要为当前 git 改动创建提交时',
      source: 'custom',
      invocation: { modelInvocable: true, userInvocable: true },
      content: GIT_COMMIT_SKILL,
    } satisfies SkillRegistration)
  })

  ctx.on('agent/status', ({ agent, status }) => {
    if (status !== 'idle') return
    // onIdle 内部捕获所有异常, 永不 reject, 可安全 fire-and-forget
    void flow.onIdle(agent)
  })
}
