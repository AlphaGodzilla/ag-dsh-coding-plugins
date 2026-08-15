/**
 * `pnpm new <name> [--description="..."]` — scaffold a new plugin package
 * under packages/<name> and register it in the root tsconfig.json solution.
 *
 * The generated package follows every convention enforced by
 * scripts/check-workspace.mts, so a fresh scaffold passes `pnpm check:ci`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface WorkspaceConfig {
  name: string
  npmScope: string
  node: string
  pnpm: string
  repository: string
}

const root = process.cwd()
const args = process.argv.slice(2)
const nameArg = args.find((arg) => !arg.startsWith('--'))
const description = args
  .find((arg) => arg.startsWith('--description='))
  ?.slice('--description='.length)

if (!nameArg) {
  console.error('Usage: pnpm new <package-name> [--description="..."]')
  console.error('  <package-name> must be kebab-case, e.g. "pnpm new git-diff-tool"')
  process.exit(1)
}
if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(nameArg)) {
  console.error(`✗ "${nameArg}" is not kebab-case (lowercase letters, digits, single hyphens)`)
  process.exit(1)
}

const config = JSON.parse(readFileSync(join(root, 'dsh-workspace.json'), 'utf8')) as WorkspaceConfig
const npmName = `${config.npmScope}/dsh-${nameArg}`
const pkgDir = join(root, 'packages', nameArg)
const summary = description ?? `${nameArg} DSH plugin (Cordis)`

if (existsSync(pkgDir)) {
  console.error(`✗ packages/${nameArg} already exists`)
  process.exit(1)
}

mkdirSync(join(pkgDir, 'src'), { recursive: true })
mkdirSync(join(pkgDir, 'tests'), { recursive: true })

const packageJson = {
  name: npmName,
  description: summary,
  version: '0.1.0',
  publishConfig: { access: 'public' },
  repository: {
    type: 'git',
    url: `git+${config.repository}`,
    directory: `packages/${nameArg}`,
  },
  type: 'module',
  main: 'lib/index.js',
  types: 'lib/index.d.ts',
  exports: {
    '.': { types: './lib/index.d.ts', default: './lib/index.js' },
    './cordis.patch.yml': './cordis.patch.yml',
    './package.json': './package.json',
  },
  dsh: {
    bundle: {
      patch: './cordis.patch.yml',
    },
  },
  files: ['lib', 'cordis.patch.yml'],
  license: 'MIT',
  engines: { node: config.node },
  scripts: {
    build: 'tsc -b',
  },
  dependencies: { '@deepseek-ai/schemastery': 'catalog:' },
  peerDependencies: { '@deepseek-ai/cordis': 'catalog:' },
  devDependencies: {
    '@deepseek-ai/cordis': 'catalog:',
    typescript: 'catalog:',
    vitest: 'catalog:',
  },
}

const srcIndex = `import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'

/** Display metadata used in diagnostics. */
export const name = '${nameArg}'

export interface Config {
  /** Message printed when the plugin mounts. */
  message: string
}

/** Schemastery schema: validates plugin config and applies defaults. */
export const Config = z.object({
  message: z.string().default(\`hello from \${name}\`),
})

export function apply(ctx: Context, config: Config) {
  // Register every side effect through ctx.effect so the fiber can dispose
  // it cleanly on unload (HMR / hot-reload safe).
  ctx.effect(() => {
    ctx.logger(name).info(config.message)
    return () => {
      ctx.logger(name).info('goodbye')
    }
  })
}
`

const testsSpec = `import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { Config, apply, name } from '../src/index.ts'

const plugin = { name, apply }

describe('${npmName}', () => {
  it('exposes plugin metadata', () => {
    expect(name).toBe('${nameArg}')
    expect(typeof apply).toBe('function')
  })

  it('applies config defaults', () => {
    expect(Config({})).toEqual({ message: \`hello from \${name}\` })
  })

  it('mounts and disposes without leaking effects', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(plugin, { message: 'hi' })
    await fiber.dispose()
  })
})
`

const readme = `[中文](README.md) | [English](README.en.md)

# ${npmName}

${summary}

## Installation

以最常用的 web profile 为例：

\`\`\`sh
# 安装
dsh plugin --profile web add ${npmName}

# ⚠️ 安装后必须重启 dsh 才会加载：先退出当前 dsh 进程，再重新启动
dsh --profile web
\`\`\`

> \`dsh plugin add\` 只负责安装并登记进 \`dsh.profile.bundles\`（profile 的
> \`package.json\`）；运行中的进程在启动时才组合配置树，热更新不监视 bundles
> 列表，因此需要重启才生效。

也可以不经过 bundle 机制，直接把插件行写入 profile 的 \`cordis.yml\` / \`cordis.patch.yml\`
（HMR 热应用，无需重启）：

\`\`\`yaml
- id: ${nameArg}
  name: '${npmName}'
  config:
    message: hello
\`\`\`

## Config

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| \`message\` | \`string\` | \`hello from ${nameArg}\` | 挂载时打印的消息。 |

## Behavior

挂载时通过 Cordis logger（名为 \`${nameArg}\`）打印配置的消息；卸载时打印 \`goodbye\`。两者均通过 \`ctx.effect\` 注册，随插件 fiber 干净释放。

## Known Limitations and Deferred Work

- 无。
`

const readmeEn = `[中文](README.md) | [English](README.en.md)

# ${npmName}

${summary}

## Installation

Using the most common web profile as an example:

\`\`\`sh
# Install
dsh plugin --profile web add ${npmName}

# ⚠️ You must restart dsh after install for the plugin to load:
# exit the current dsh process first, then start it again
dsh --profile web
\`\`\`

> \`dsh plugin add\` only installs the package and registers it in \`dsh.profile.bundles\`
> (the profile's \`package.json\`); the running process composes its configuration tree
> at startup and hot reload does not watch the bundles list, so a restart is required.

Alternatively, skip the bundle mechanism and add the plugin row directly to the profile's \`cordis.yml\` / \`cordis.patch.yml\` (hot-applied by HMR, no restart needed):

\`\`\`yaml
- id: ${nameArg}
  name: '${npmName}'
  config:
    message: hello
\`\`\`

## Config

| Key | Type | Default | Description |
|---|---|---|---|
| \`message\` | \`string\` | \`hello from ${nameArg}\` | Message printed on ready. |

## Behavior

On mount, logs the configured message through the Cordis logger under the \`${nameArg}\` name; on unmount, logs \`goodbye\`. Both are registered through \`ctx.effect\`, so they are disposed cleanly with the plugin fiber.

## Known Limitations and Deferred Work

- None.
`

const bundlePatch = `# ${npmName} bundle patch — one profile layer, applied after the in-box
# bundles and before the profile's own cordis.patch.yml. A top-level YAML
# array of loader patch entries (PatchOptions). This patch inserts the plugin
# row into the profile entry tree; the bare package name resolves through the
# profile's node_modules, and the @deepseek-ai/* peer imports are provided by
# the dsh installation's module closure (symlinked under
# $DSH_HOME/profiles/node_modules).
- insert:
    - id: ${nameArg}
      name: '${npmName}'
`

const tsconfigJson = {
  extends: '../../tsconfig.base.json',
  compilerOptions: {
    rootDir: 'src',
    outDir: 'lib',
  },
  include: ['src'],
}

const files: Record<string, string> = {
  'package.json': `${JSON.stringify(packageJson, null, 2)}\n`,
  'cordis.patch.yml': bundlePatch,
  'tsconfig.json': `${JSON.stringify(tsconfigJson, null, 2)}\n`,
  'src/index.ts': srcIndex,
  'tests/index.spec.ts': testsSpec,
  'README.md': readme,
  'README.en.md': readmeEn,
}

for (const [file, content] of Object.entries(files)) {
  writeFileSync(join(pkgDir, file), content)
}

// Register the new package in the root solution.
const tsconfigPath = join(root, 'tsconfig.json')
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8')) as { references?: Array<{ path: string }> }
const refs = (tsconfig.references ?? []).map((ref) => ref.path)
const entry = `./packages/${nameArg}`
if (!refs.includes(entry)) {
  refs.push(entry)
  refs.sort((a, b) => a.localeCompare(b))
  writeFileSync(tsconfigPath, `${JSON.stringify({ files: [], references: refs.map((path) => ({ path })) }, null, 2)}\n`)
}

console.log(`✓ scaffolded ${npmName} at packages/${nameArg}`)
console.log('Next steps:')
console.log('  1. pnpm install          # link the new workspace package')
console.log('  2. edit src/index.ts, tests/index.spec.ts, README.md')
console.log('  3. pnpm check:ci         # every gate must pass')
console.log('  4. pnpm changeset        # record the change for release')
