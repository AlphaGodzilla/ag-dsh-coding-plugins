# @ag-dsh/dsh-hello-world

Reference DSH plugin: demonstrates the canonical Cordis plugin shape used by every package in this repo — named exports `name` / `Config` / `apply`, a [schemastery](https://www.npmjs.com/package/@deepseek-ai/schemastery) config schema, and a `ready` listener that logs through `ctx.logger`.

## Installation

In a DSH profile directory:

```sh
dsh plugin --profile <name> add @ag-dsh/dsh-hello-world
```

or add to the profile's `cordis.yml` / `cordis.patch.yml`:

```yaml
- name: '@ag-dsh/dsh-hello-world'
  config:
    greeting: Hello
    target: World
```

## Config

| Key | Type | Default | Description |
|---|---|---|---|
| `greeting` | `string` | `'Hello'` | Greeting text printed on ready. |
| `target` | `string` | `'World'` | Who or what receives the greeting. |

## Behavior

On mount, logs `<greeting>, <target>!` through the Cordis logger under the `hello-world` name; on unmount, logs `goodbye`. Both are registered through `ctx.effect`, so they are disposed cleanly with the plugin fiber. Invalid config values fail loudly at schema validation.

## Known Limitations and Deferred Work

- None. This package exists as the reference implementation and CI fixture for the repository toolchain.
