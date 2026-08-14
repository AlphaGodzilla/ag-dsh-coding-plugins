/**
 * `pnpm pack-check` — pack every publishable package with `pnpm pack` and
 * verify the tarball contains exactly what consumers need: package.json,
 * README.md, lib/index.js, lib/index.d.ts — and no src/ leakage.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const packagesDir = join(root, 'packages')
const errors: string[] = []
const requiredEntries = ['package.json', 'README.md', 'lib/index.js', 'lib/index.d.ts']
let checked = 0

for (const dir of readdirSync(packagesDir).toSorted()) {
  const pkgDir = join(packagesDir, dir)
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as { private?: boolean }
  if (pkg.private) continue
  checked += 1

  const tmp = mkdtempSync(join(tmpdir(), 'dsh-pack-'))
  try {
    execFileSync('pnpm', ['pack', '--pack-destination', tmp], { cwd: pkgDir, stdio: 'pipe' })
    const tarball = readdirSync(tmp).find((file) => file.endsWith('.tgz'))
    if (!tarball) {
      errors.push(`${dir}: no tarball produced`)
      continue
    }
    const entries = execFileSync('tar', ['-tzf', join(tmp, tarball)], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
    for (const rel of requiredEntries) {
      if (!entries.includes(`package/${rel}`)) errors.push(`${dir}: packed artifact is missing ${rel}`)
    }
    if (entries.some((entry) => entry.startsWith('package/src/'))) {
      errors.push(`${dir}: packed artifact leaks src/ (fix "files" in package.json)`)
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

if (errors.length > 0) {
  console.error(`✗ pack check failed with ${errors.length} error(s):`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log(`✓ pack check passed (${checked} package(s))`)
