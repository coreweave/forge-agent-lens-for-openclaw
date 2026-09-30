// SPDX-FileCopyrightText: 2026 CoreWeave, Inc.
// SPDX-License-Identifier: Apache-2.0
// SPDX-PackageName: forge-agent-lens-for-openclaw

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { onInternalDiagnosticEvent } from "openclaw/plugin-sdk/diagnostic-runtime";
import { createForgeHookState } from "./src/state/hook-state.js";
import { createForgePlugin, renderStatus, type ForgePlugin } from "./src/plugin.js";

// register(api) can run multiple times (setup/runtime, hot-reload); cache the
// instance + subscription on globalThis so a re-import doesn't make a stale duplicate.
const PLUGIN_GLOBAL_KEY = Symbol.for("forge-agent-lens-for-openclaw.plugin");
const DIAGNOSTIC_SUBSCRIBED_KEY = Symbol.for("forge-agent-lens-for-openclaw.diagnosticSubscribed");

function getOrCreateSharedPlugin(pluginConfig: unknown): ForgePlugin {
  const g = globalThis as Record<PropertyKey, unknown>;
  const cached = g[PLUGIN_GLOBAL_KEY] as ForgePlugin | undefined;
  if (cached) return cached;
  const plugin = createForgePlugin({ pluginConfig, hookState: createForgeHookState() });
  Object.defineProperty(g, PLUGIN_GLOBAL_KEY, {
    value: plugin,
    writable: false,
    configurable: true,
    enumerable: false,
  });
  if (plugin.handlers.diagnostic && !g[DIAGNOSTIC_SUBSCRIBED_KEY]) {
    onInternalDiagnosticEvent(plugin.handlers.diagnostic);
    Object.defineProperty(g, DIAGNOSTIC_SUBSCRIBED_KEY, {
      value: true,
      writable: false,
      configurable: true,
      enumerable: false,
    });
  }
  return plugin;
}

// definePluginEntry's return type isn't exported; annotate the default export to keep its emitted type portable.
const pluginEntry: ReturnType<typeof definePluginEntry> = definePluginEntry({
  id: "forge",
  name: "CoreWeave Forge",
  description:
    "Track OpenClaw agent sessions in CoreWeave Forge for observability and debugging.",
  register(api) {
    const plugin = getOrCreateSharedPlugin(api.pluginConfig);

    const hooks = plugin.handlers.hook;
    api.on("session_start", (event, ctx) => hooks.session_start?.(event, ctx));
    api.on("session_end", (event, ctx) => hooks.session_end?.(event, ctx));
    api.on("model_call_started", (event, ctx) => hooks.model_call_started?.(event, ctx));
    api.on("llm_input", (event, ctx) => hooks.llm_input?.(event, ctx));
    api.on("before_message_write", (event, ctx) => hooks.before_message_write?.(event, ctx));
    api.on("before_tool_call", (event, ctx) => hooks.before_tool_call?.(event, ctx));
    api.on("after_tool_call", (event, ctx) => hooks.after_tool_call?.(event, ctx));
    api.on("subagent_spawned", (event, ctx) => hooks.subagent_spawned?.(event, ctx));
    api.on("subagent_ended", (event, ctx) => hooks.subagent_ended?.(event, ctx));
    api.on("before_compaction", (event, ctx) => hooks.before_compaction?.(event, ctx));
    api.on("after_compaction", (event, ctx) => hooks.after_compaction?.(event, ctx));
    api.on("agent_end", (event, ctx) => hooks.agent_end?.(event, ctx));
    api.on("message_received", (event, ctx) => hooks.message_received?.(event, ctx));

    api.registerService(plugin.service);

    api.registerCommand({
      name: "forge",
      description: "Show CoreWeave Forge plugin status",
      acceptsArgs: true,
      handler: () => ({ text: renderStatus(plugin) }),
    });
  },
});

export default pluginEntry;
