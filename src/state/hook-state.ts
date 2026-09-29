// SPDX-FileCopyrightText: 2026 CoreWeave, Inc.
// SPDX-License-Identifier: Apache-2.0
// SPDX-PackageName: forge-openclaw

import { BoundedMap } from "../util/bounded-map.js";
import type { LlmUsage } from "../handlers/hook-types.js";

// Capture buffers shared between hooks and the diagnostic service: hooks hold
// payloads (prompts, usage, tool args/results) the event stream doesn't carry.

export type LlmInputCapture = {
  prompt: string;
  historyMessages?: unknown[];
};

// Per-call assistant output from before_message_write, recorded on the chat span
// when it closes mid-run.
type AssistantOutputCapture = {
  text?: string;
  usage?: LlmUsage;
};

type ToolCallArgsCapture = {
  toolName: string;
  params: Record<string, unknown>;
  runId?: string;
};

type ToolCallResultCapture = {
  result?: unknown;
};

export type ForgeHookState = {
  llmInputs: BoundedMap<string, LlmInputCapture>; // keyed by callId, not runId
  systemPromptByRun: BoundedMap<string, string>; // reused by every model call in an attempt
  currentCallByRun: BoundedMap<string, string>; // keyed by runId
  // llm_input that arrived before model_call_started; promoted once callId is known
  pendingLlmInputByRun: BoundedMap<string, LlmInputCapture>; // keyed by runId
  toolCallArgs: BoundedMap<string, ToolCallArgsCapture>; // keyed by toolCallId
  toolCallResults: BoundedMap<string, ToolCallResultCapture>; // keyed by toolCallId
  chatCallsByRun: BoundedMap<string, string[]>; // keyed by runId
  assistantOutputByCall: BoundedMap<string, AssistantOutputCapture>; // keyed by callId
};

export function createForgeHookState(): ForgeHookState {
  return {
    llmInputs: new BoundedMap(),
    systemPromptByRun: new BoundedMap(),
    currentCallByRun: new BoundedMap(),
    pendingLlmInputByRun: new BoundedMap(),
    toolCallArgs: new BoundedMap(),
    toolCallResults: new BoundedMap(),
    chatCallsByRun: new BoundedMap(),
    assistantOutputByCall: new BoundedMap(),
  };
}

export function beginModelCall(
  state: ForgeHookState,
  runId: string,
  callId: string,
): void {
  if (!runId || !callId) return;
  state.currentCallByRun.set(runId, callId);
  const pending = state.pendingLlmInputByRun.get(runId);
  if (pending) {
    state.llmInputs.set(callId, pending);
    state.pendingLlmInputByRun.delete(runId);
  }
}

export function bufferPendingLlmInputForRun(
  state: ForgeHookState,
  runId: string,
  capture: LlmInputCapture,
): void {
  if (!runId) return;
  state.pendingLlmInputByRun.set(runId, capture);
}

export function resolveCurrentCallId(
  state: ForgeHookState,
  runId: string | undefined,
): string | undefined {
  if (!runId) return undefined;
  return state.currentCallByRun.get(runId);
}

export function captureLlmInput(
  state: ForgeHookState,
  callId: string,
  capture: LlmInputCapture,
): void {
  state.llmInputs.set(callId, capture);
}

export function captureAssistantOutput(
  state: ForgeHookState,
  callId: string,
  capture: AssistantOutputCapture,
): void {
  state.assistantOutputByCall.set(callId, capture);
}

export function captureToolStart(
  state: ForgeHookState,
  toolCallId: string,
  capture: ToolCallArgsCapture,
): void {
  if (!toolCallId) return;
  state.toolCallArgs.set(toolCallId, capture);
}

export function captureToolEnd(
  state: ForgeHookState,
  toolCallId: string,
  capture: ToolCallResultCapture,
): void {
  if (!toolCallId) return;
  state.toolCallResults.set(toolCallId, capture);
}

export function lookupToolCall(
  state: ForgeHookState,
  toolCallId: string | undefined,
): { args?: ToolCallArgsCapture; result?: ToolCallResultCapture } {
  if (!toolCallId) return {};
  return {
    args: state.toolCallArgs.get(toolCallId),
    result: state.toolCallResults.get(toolCallId),
  };
}
