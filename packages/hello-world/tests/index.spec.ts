import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { Config, apply, name } from '../src/index.ts'

const plugin = { name, apply }

describe('@ag-dsh/dsh-hello-world', () => {
  it('exposes plugin metadata', () => {
    expect(name).toBe('hello-world')
    expect(typeof apply).toBe('function')
  })

  it('applies config defaults and overrides', () => {
    expect(Config({})).toEqual({ greeting: 'Hello', target: 'World' })
    expect(Config({ greeting: '你好', target: 'DSH' })).toEqual({ greeting: '你好', target: 'DSH' })
  })

  it('mounts and disposes without leaking effects', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(plugin, { greeting: 'Hi', target: 'DSH' })
    await fiber.dispose()
  })
})
