/**
 * 模型提示词加载器: 从包内 `prompts/` 目录读取提示词文件 (与源码解耦, 便于
 * 独立编辑与 review)。文件缺失或读取失败时回退到极简 fallback, 保证插件可用。
 *
 * 注意: 加载发生在模块初始化时; `new URL('../prompts/', import.meta.url)` 在
 * src/ 与编译后的 lib/ 中均指向包根目录的 prompts/, 因此源码运行与发布包一致。
 */

import { readFileSync } from 'node:fs'

/** 包根目录下的 prompts/ 目录 (src/ 与 lib/ 都恰好位于包根下一层)。 */
const PROMPTS_DIR = new URL('../prompts/', import.meta.url)

function loadPrompt(file: string, fallback: string): string {
  try {
    const text = readFileSync(new URL(file, PROMPTS_DIR), 'utf8').trim()
    if (text) return text
  } catch {
    // 文件缺失/读取失败: 使用 fallback
  }
  return fallback
}

/** 生成轮模型提示词: 只读探查 + 生成中文 commit message, 本轮禁止 git 写命令。 */
export const GENERATE_PROMPT = loadPrompt(
  'generate.md',
  '请自行运行 git 只读命令了解改动, 生成一条中文 commit message 并展示, 本轮不要执行任何 git 写命令, 等待用户选择。',
)

/** 提交轮模型提示词: 由 LLM 经 bash 判断暂存状态并执行提交。 */
export const COMMIT_PROMPT = loadPrompt(
  'commit.md',
  '用户已选择提交。请先运行 `git status` 判断是否已有暂存改动: 无则 `git add -A` 后提交, 有则直接提交。用上面生成的 commit message 执行 `git commit`, 不要加任何广告尾注。',
)

/** `git-commit-zh` 技能正文: 非交互直接提交当前改动 (无需用户确认)。 */
export const GIT_COMMIT_SKILL = loadPrompt(
  'skill-commit.md',
  '非交互提交当前 git 改动: 运行 git 只读命令了解状态, 生成一条中文 commit message, 无暂存则 git add 后直接 git commit, 不询问用户确认。',
)
