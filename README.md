# forge-agent-lens-for-openclaw

[![npm version](https://img.shields.io/npm/v/@coreweave/forge-agent-lens-for-openclaw.svg)](https://www.npmjs.com/package/@coreweave/forge-agent-lens-for-openclaw)
[![ClawHub plugin](https://img.shields.io/badge/ClawHub-plugin-orange.svg)](https://clawhub.ai/coreweave/plugins/forge-agent-lens-for-openclaw)
[![CI](https://github.com/coreweave/forge-agent-lens-for-openclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/coreweave/forge-agent-lens-for-openclaw/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@coreweave/forge-agent-lens-for-openclaw.svg)](https://github.com/coreweave/forge-agent-lens-for-openclaw/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@coreweave/forge-agent-lens-for-openclaw.svg)](https://github.com/coreweave/forge-agent-lens-for-openclaw/blob/main/package.json)

OpenClaw plugin for tracing agent runs, model calls, tool calls, tokens, and
costs in CoreWeave Forge.

> [!WARNING]
> `captureContent` defaults to `true`. Prompts, replies, and tool inputs and
> results are sent unredacted to W&B. Set it to `false` to record only trace
> structure, tokens, and costs.

## Tracing SDK

Tracing uses `@coreweave/forge-sdk/agentlens/tracing`, pinned to the
`0.1.0-beta.0` prerelease. Every turn, chat, tool, and subagent span carries
`forge.integration.name = forge-agent-lens-for-openclaw` and
`forge.integration.version`, and the OTLP resource reports
`wandb.sdk.name = forge`.

## Requirements

- Node.js >= 22.14.0
- OpenClaw >= 2026.4.25
- A [W&B account](https://wandb.ai) and project

## Migrating from `weave-openclaw`

The plugin ID is now `forge` and the status command is `/forge status`, with no
`weave` aliases. Disable and uninstall the `weave` plugin before installing this
one; otherwise both plugins trace every session. Then move your settings from
`plugins.entries.weave` to `plugins.entries.forge` and replace `weave` with
`forge` in `plugins.allow`. Configuration fields, W&B credentials, `WANDB_*`
environment variables, and the `/weave/agents` dashboard route are unchanged.

Span attributes moved from `weave.*` to `forge.*`; for example, `weave.outcome`
is now `forge.outcome`. The agent version, ID, and description moved from
`weave.agent.*` to the standard `gen_ai.agent.*` attributes, and `weave.source`
was removed. Only `weave.compaction.*` keeps its name, because the Weave backend
reads it.

## Setup

Install the plugin:

```bash
openclaw plugins install clawhub:@coreweave/forge-agent-lens-for-openclaw
```

Export a [W&B API key](https://forge.coreweave.com/wandb/authorize):

```bash
export WANDB_API_KEY=<your-key>
```

Add the plugin to `~/.openclaw/openclaw.json`:

```js
{
  diagnostics: { enabled: true },
  plugins: {
    allow: ["forge"],
    entries: {
      forge: {
        enabled: true,
        config: { entity: "your-team", project: "your-project" },
        hooks: { allowConversationAccess: true },
      },
    },
  },
}
```

Restart the gateway if needed:

```bash
openclaw gateway restart
```

Run `/forge status` in a chat. When it reports `running`, view traces at:

```text
https://forge.coreweave.com/wandb/<entity>/<project>/weave/agents
```

`hooks.allowConversationAccess: true` allows prompts, replies, and per-call
token counts. Without it, trace structure, tool calls, and run totals still
work. `diagnostics.enabled: false` disables tracing.

See the [full setup guide](https://docs.coreweave.com/products/wandb/weave/guides/integrations/agents/openclaw-harness)
and [ClawHub listing](https://clawhub.ai/coreweave/plugins/forge-agent-lens-for-openclaw).

## Configuration

Only `entity` and `project` are required.

```js
{
  plugins: {
    entries: {
      forge: {
        enabled: true,
        config: {
          entity: "your-team",        // your W&B team or username
          project: "your-project",    // your W&B project name

          // Optional; see the credential lookup order below. A SecretRef keeps
          // the key out of this file. A plain string also works but is discouraged:
          //   apiKey: "your-wandb-api-key"
          apiKey: { source: "env", provider: "default", id: "WANDB_API_KEY" },

          serviceName: "openclaw-agent",   // shown in /forge status
          // These help group and label your agents in the dashboard.
          agentName: "my-agent",
          agentVersion: "v1.0",
          agentDescription: "What my agent does.",

          // On by default. Set to false to stop recording the actual message
          // text (for example, to meet a privacy or retention policy). The
          // plugin records text as-is and does not hide sensitive values, so
          // remove them beforehand if you need to.
          captureContent: true,

          // How often (in milliseconds) traces are sent.
          flushIntervalMs: 1000,
        },
        hooks: { allowConversationAccess: true },
      },
    },
  },
}
```

Environment refs work without extra setup. File and exec refs need a matching
`secrets.providers` entry; see [OpenClaw secrets management](https://docs.openclaw.ai/gateway/secrets).

Credential lookup order:

1. `apiKey` in the plugin config (SecretRef or plain string)
2. `WANDB_API_KEY`
3. `~/.netrc`

OpenClaw also loads `WANDB_API_KEY` from `~/.openclaw/.env`. Set
`WANDB_BASE_URL` for dedicated or self-hosted W&B.

## Troubleshooting

| Problem | Check |
|---|---|
| `/forge status` is not `running` | Check `entity`, `project`, the plugin version, and gateway logs. |
| No traces | Ensure diagnostics are enabled and the configured project matches `/forge status`. |
| Blank messages or model calls | Set `hooks.allowConversationAccess: true` and restart. |
| `401` or `403` | Refresh the API key and confirm project access. |
| `404` on self-hosted W&B | Check `WANDB_BASE_URL`. |
| Connection or DNS error | Check gateway network, proxy, and firewall access to W&B. |

## Manage the plugin

```bash
openclaw plugins update forge
openclaw plugins disable forge
openclaw plugins enable forge
openclaw plugins uninstall forge
```

## Development

```bash
npx pnpm@9 install --frozen-lockfile
npx pnpm@9 check

openclaw plugins install --link .
openclaw gateway restart
openclaw plugins inspect forge --runtime --json
```

## Contributing

See [CONTRIBUTING.md](https://github.com/coreweave/forge-agent-lens-for-openclaw/blob/main/CONTRIBUTING.md). Contributions require agreeing to the
[CoreWeave CLA](https://github.com/coreweave/forge-agent-lens-for-openclaw/blob/main/CLA.md).

## License

[Apache License 2.0](https://github.com/coreweave/forge-agent-lens-for-openclaw/blob/main/LICENSE)
