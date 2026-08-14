/**
 * `pnpm clean` — remove build artifacts (lib/, *.tsbuildinfo) from every
 * package and the root coverage/ directory.
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packagesDir = join(root, 'packages')
let removed = 0

function remove(path: string) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true })
    removed += 1
  }
}

for (const dir of readdirSync(packagesDir)) {
  const pkgDir = join(packagesDir, dir)
  if (!statSync(pkgDir).isDirectory()) continue
  remove(join(pkgDir, 'lib'))
  for (const file of readdirSync(pkgDir)) {
    if (file.endsWith('.tsbuildinfo')) remove(join(pkgDir, file))
  }
}
remove(join(root, 'coverage'))

console.log(`✓ cleaned ${removed} artifact(s)`)
