/**
 * 打包浏览器半区（src/client.ts）为 dsh-client-modules 要求的 bundle 形态：
 * window.__ModuleLoader__.load({ id, factory }) 的 CJS 工厂。
 *
 * react 与 @deepseek-ai/* 保持 external（由 Web 端模块系统提供，不打包进产物）。
 * 构建顺序：pnpm build = tsc -b && node build-client.mjs —— tsc 生成的
 * lib/client.js（ESM）会被本脚本覆盖为 bundle 形态。
 */
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

const result = await build({
  entryPoints: ['src/client.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  external: ['react', '@deepseek-ai/*'],
  write: false,
  logLevel: 'warning',
})

const body = result.outputFiles[0].text
const bundle = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${body}
    return module.exports;
  }
});
`

writeFileSync(new URL('./lib/client.js', import.meta.url), bundle)
console.log(`✓ bundled ${pkg.name} client half → lib/client.js`)
