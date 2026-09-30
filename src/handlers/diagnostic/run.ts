// SPDX-FileCopyrightText: 2026 CoreWeave, Inc.
// SPDX-License-Identifier: Apache-2.0
// SPDX-PackageName: forge-openclaw

import { runIsolated, startTurn } from "@coreweave/forge-sdk/agentlens/tracing";
import type { DiagnosticEventPayload } from "openclaw/plugin-sdk/diagnostic-runtime";
import type { HandlerDeps } from "../deps.js";
import { getOrCreateConversation } from "../hooks/session.js";
import { INTEGRATION_ATTRIBUTES } from "../integration.js";
import { finalizeRunChatSpans } from "../llm-state.js";
import { finalizeRunTools } from "./tool.js";

type RunStartedEvent = Extract<DiagnosticEventPayload, { type: "run.started" }>;
type RunCompletedEvent = Extract<DiagnosticEventPayload, { type: "run.completed" }>;
type RunAttemptEvent = Extract<DiagnosticEventPayload, { type: "run.attempt" }>;

export function createRunDiagnosticHandlers(deps: HandlerDeps) {
  return {
    onRunStarted(event: RunStartedEvent): void {
      const resolved = deps.getResolved();
      if (!resolved) return;
      if (deps.registries.turns.has(event.runId)) return;
      const agentName = resolved.agentName;
      // Lazy-create, not redundant with session_start: a run can reach us for a
      // live sessionKey whose session_start we never saw (plugin started mid-session).
      const conversation = getOrCreateConversation(deps, event.sessionKey, agentName);
      const turnInit = {
        agentName,
        model: event.model,
        agentVersion: resolved.agentVersion,
        agentDescription: resolved.agentDescription,
      };
      const turn = runIsolated(() =>
        conversation
          ? conversation.startTurn(turnInit)
          : startTurn({ ...turnInit, attributes: INTEGRATION_ATTRIBUTES }),
      );
      deps.registries.turns.set(event.runId, turn);
      // Index by sessionKey so tool.loop events (which omit runId) reach this Turn.
      if (event.sessionKey) deps.runIdBySession.set(event.sessionKey, event.runId);
    },

    // Only the "error" outcome marks the Turn ERROR; completed and aborted stay OK.
    onRunFinalize(event: RunCompletedEvent): void {
      finalizeRunChatSpans(deps, event.runId);
      // Close any tool span still waiting on a fire-and-forget after_tool_call
      // that never landed, so it never leaks open past its run.
      finalizeRunTools(deps, event.runId);
      const turn = deps.registries.turns.get(event.runId);
      if (!turn) return;
      turn.setAttributes({ "forge.outcome": event.outcome });
      if (isErrorOutcome(event.outcome)) {
        turn.end({ error: new Error(event.outcome) });
      } else {
        turn.end();
      }
      deps.registries.turns.delete(event.runId);
      deps.costByRun.delete(event.runId);
      deps.pendingCompactionByRun.delete(event.runId);
      if (event.sessionKey) deps.runIdBySession.delete(event.sessionKey);
    },

    onRunAttempt(event: RunAttemptEvent): void {
      const turn = deps.registries.turns.get(event.runId);
      if (!turn) return;
      turn.addEvent("run_attempt", { "forge.run.attempt": event.attempt });
    },
  };
}

function isErrorOutcome(outcome: RunCompletedEvent["outcome"]): boolean {
  return outcome === "error";
}
