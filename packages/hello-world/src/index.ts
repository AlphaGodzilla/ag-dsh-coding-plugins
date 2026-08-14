import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'

/** Display metadata used in diagnostics. */
export const name = 'hello-world'

export interface Config {
  /** Greeting text printed when the plugin mounts. */
  greeting: string
  /** Who or what receives the greeting. */
  target: string
}

/** Schemastery schema: validates plugin config and applies defaults. */
export const Config = z.object({
  greeting: z.string().default('Hello'),
  target: z.string().default('World'),
})

export function apply(ctx: Context, config: Config) {
  // Register every side effect through ctx.effect so the fiber can dispose
  // it cleanly on unload (HMR / hot-reload safe).
  ctx.effect(() => {
    ctx.logger(name).info(`${config.greeting}, ${config.target}!`)
    return () => {
      ctx.logger(name).info('goodbye')
    }
  })
}
