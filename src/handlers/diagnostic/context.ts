// SPDX-FileCopyrightText: 2026 CoreWeave, Inc.
// SPDX-License-Identifier: Apache-2.0
// SPDX-PackageName: forge-openclaw

import type { DiagnosticEventPayload } from "openclaw/plugin-sdk/diagnostic-runtime";
import type { HandlerDeps } from "../deps.js";
import { setIfInt } from "../util.js";

type ContextAssembledEvent = Extract<DiagnosticEventPayload, { type: "context.assembled" }>;

export function createContextDiagnosticHandlers(deps: HandlerDeps) {
  return {
    /** `context.assembled`: stamp per-turn context sizing on the Turn. */
    onContextAssembled(event: ContextAssembledEvent): void {
      const turn = deps.registries.turns.get(event.runId);
      if (!turn) return;
      setIfInt(turn, "forge.context.message_count", event.messageCount);
      setIfInt(turn, "forge.context.history_text_chars", event.historyTextChars);
      setIfInt(turn, "forge.context.history_image_blocks", event.historyImageBlocks);
      setIfInt(turn, "forge.context.system_prompt_chars", event.systemPromptChars);
      setIfInt(turn, "forge.context.prompt_chars", event.promptChars);
      setIfInt(turn, "forge.context.prompt_images", event.promptImages);
      setIfInt(turn, "forge.context.budget_tokens", event.contextTokenBudget);
      setIfInt(turn, "forge.context.reserve_tokens", event.reserveTokens);
    },
  };
}
