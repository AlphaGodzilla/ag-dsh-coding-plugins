/**
 * Workspace constraint check — the outer-layer gate that keeps every
 * packages/<name> directory a valid, publishable DSH plugin package.
 *
 * Run via `pnpm check-workspace` (part of `pnpm check:ci`).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

interface WorkspaceConfig {
  name: string
  npmScope: string
  node: string
  pnpm: string
  repository: string
}

interface Pkg {
  name?: unknown
  version?: unknown
  private?: unknown
  type?: unknown
  main?: unknown
  types?: unknown
  exports?: Record<string, unknown>
  files?: unknown
  license?: unknown
  publishConfig?: { access?: unknown }
  engines?: { node?: unknown }
  scripts?: { build?: unknown }
  repository?: { url?: unknown; directory?: unknown }
}

const root = process.cwd()
const config = JSON.parse(readFileSync(join(root, 'dsh-workspace.json'), 'utf8')) as WorkspaceConfig
const packagesDir = join(root, 'packages')
const errors: string[] = []

function check(ok: boolean, message: string) {
  if (!ok) errors.push(message)
}

const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .map((entry) => entry.name)
  .toSorted()

if (packageDirs.length === 0) {
  console.error('✗ packages/ contains no plugin directories')
  process.exit(1)
}

// The root solution tsconfig.json must reference every package.
const rootTsconfig = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8')) as {
  references?: Array<{ path: string }>
}
const referenced = new Set((rootTsconfig.references ?? []).map((ref) => ref.path.replace(/^\.\//, '').replace(/\/$/, '')))
for (const dir of packageDirs) {
  check(referenced.has(`packages/${dir}`), `root tsconfig.json is missing reference "packages/${dir}" (run pnpm new or add it)`)
}
for (const ref of referenced) {
  if (!ref.startsWith('packages/') || !packageDirs.includes(ref.slice('packages/'.length))) {
    errors.push(`root tsconfig.json references unknown package "${ref}"`)
  }
}

for (const dir of packageDirs) {
  const pkgDir = join(packagesDir, dir)
  const pkgPath = join(pkgDir, 'package.json')
  if (!existsSync(pkgPath)) {
    errors.push(`packages/${dir}: package.json is missing`)
    continue
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Pkg
  const expectedName = `${config.npmScope}/dsh-${dir}`

  check(pkg.name === expectedName, `packages/${dir}: "name" must be "${expectedName}", got "${String(pkg.name)}"`)
  check(
    typeof pkg.version === 'string' && /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(pkg.version),
    `packages/${dir}: "version" must be semver, got "${String(pkg.version)}"`,
  )
  check(pkg.private !== true, `packages/${dir}: plugin packages must be publishable (remove "private": true)`)
  check(pkg.type === 'module', `packages/${dir}: "type" must be "module"`)
  check(pkg.main === 'lib/index.js', `packages/${dir}: "main" must be "lib/index.js"`)
  check(pkg.types === 'lib/index.d.ts', `packages/${dir}: "types" must be "lib/index.d.ts"`)
  const dotExport = pkg.exports?.['.'] as { types?: unknown; default?: unknown } | undefined
  check(
    dotExport?.types === './lib/index.d.ts' && dotExport?.default === './lib/index.js',
    `packages/${dir}: exports["."] must map types→./lib/index.d.ts and default→./lib/index.js`,
  )
  check(Array.isArray(pkg.files) && pkg.files.includes('lib'), `packages/${dir}: "files" must include "lib"`)
  check(pkg.license === 'MIT', `packages/${dir}: "license" must be "MIT"`)
  check(pkg.publishConfig?.access === 'public', `packages/${dir}: publishConfig.access must be "public"`)
  check(pkg.engines?.node === config.node, `packages/${dir}: engines.node must be "${config.node}"`)
  check(typeof pkg.scripts?.build === 'string', `packages/${dir}: "scripts.build" must run the package build`)
  const repoUrl = pkg.repository?.url
  check(repoUrl === config.repository || repoUrl === `git+${config.repository}`, `packages/${dir}: repository.url must match dsh-workspace.json`)
  check(pkg.repository?.directory === `packages/${dir}`, `packages/${dir}: repository.directory must be "packages/${dir}"`)

  check(existsSync(join(pkgDir, 'src/index.ts')), `packages/${dir}: src/index.ts is missing`)
  check(existsSync(join(pkgDir, 'README.md')), `packages/${dir}: README.md is missing`)
  check(existsSync(join(pkgDir, 'tsconfig.json')), `packages/${dir}: tsconfig.json is missing`)
  const testsDir = join(pkgDir, 'tests')
  if (!existsSync(testsDir)) {
    errors.push(`packages/${dir}: tests/ directory is missing`)
  } else {
    const specCount = readdirSync(testsDir).filter((file) => file.endsWith('.spec.ts')).length
    check(specCount > 0, `packages/${dir}: tests/ must contain at least one *.spec.ts`)
  }
}

if (errors.length > 0) {
  console.error(`✗ workspace check failed with ${errors.length} error(s):`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log(`✓ workspace check passed (${packageDirs.length} package(s))`)
