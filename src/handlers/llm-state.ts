// SPDX-FileCopyrightText: 2026 CoreWeave, Inc.
// SPDX-License-Identifier: Apache-2.0
// SPDX-PackageName: forge-agent-lens-for-openclaw

import type { Message, Usage } from "@coreweave/forge-sdk/agentlens/tracing";
import type { HandlerDeps } from "./deps.js";
import type { LlmUsage } from "./hook-types.js";
import { totalPromptTokens } from "./util.js";
import type { LlmInputCapture } from "../state/hook-state.js";

// Close this chat span at model.call.completed/error (not run end) so its input
// and per-call output export mid-run, while the turn is still running.
export function finalizeChatSpan(
  deps: HandlerDeps,
  runId: string,
  callId: string,
  status: "ok" | "error",
  errorType: string | undefined,
): void {
  if (!closeChatSpan(deps, callId, status, errorType)) return;
  const list = deps.hookState.chatCallsByRun.get(runId);
  if (list) {
    const rest = list.filter((id) => id !== callId);
    if (rest.length) deps.hookState.chatCallsByRun.set(runId, rest);
    else deps.hookState.chatCallsByRun.delete(runId);
  }
}

// run.completed backstop: close any chat span that never saw a model.call.completed.
export function finalizeRunChatSpans(deps: HandlerDeps, runId: string): void {
  const callIds = deps.hookState.chatCallsByRun.get(runId);
  deps.hookState.chatCallsByRun.delete(runId);
  deps.hookState.systemPromptByRun.delete(runId);
  deps.hookState.currentCallByRun.delete(runId);
  for (const callId of callIds ?? []) closeChatSpan(deps, callId, "ok", undefined);
}

// Close one chat span with its captured input and (if any) output + usage.
// Returns false when the callId has no live span.
function closeChatSpan(
  deps: HandlerDeps,
  callId: string,
  status: "ok" | "error",
  errorType: string | undefined,
): boolean {
  const handle = deps.registries.calls.get(callId);
  if (!handle) return false;
  const captureContent = deps.getResolved()?.captureContent ?? false;
  const capturedOutput = deps.hookState.assistantOutputByCall.get(callId);
  const shaped = captureContent
    ? shapeMessages({ input: deps.hookState.llmInputs.get(callId), text: capturedOutput?.text })
    : { input: [], output: [] };
  const usage = toUsage(capturedOutput?.usage);
  if (shaped.input.length || shaped.output.length || usage) {
    handle.llm.record({
      inputMessages: shaped.input,
      outputMessages: shaped.output,
      ...(usage ? { usage } : {}),
    });
  }
  handle.llm.end(
    status === "error"
      ? { error: new Error(errorType ?? "model.call.error") }
      : undefined,
  );
  deps.registries.calls.delete(callId);
  deps.hookState.llmInputs.delete(callId);
  deps.hookState.assistantOutputByCall.delete(callId);
  return true;
}

// Summary wrappers from OpenClaw's convertToLlm, as of OpenClaw v2026.9.8
// (openclaw packages/agent-core/src/harness/messages.ts).
const COMPACTION_SUMMARY_PREFIX =
  "The conversation history before this point was compacted into the following summary:\n\n<summary>\n";
const COMPACTION_SUMMARY_SUFFIX = "\n</summary>";
const BRANCH_SUMMARY_PREFIX =
  "The following is a summary of a branch that this conversation came back from:\n\n<summary>\n";
const BRANCH_SUMMARY_SUFFIX = "</summary>";

type TranscriptMessage = Record<string, unknown>;

// historyMessages are OpenClaw transcript messages, not provider messages. Map them the way
// OpenClaw's convertToLlm does, so traces record the roles the model actually receives:
// custom, summary, and bash entries reach it as user turns; excluded and unknown ones never do.
function toModelMessage(value: unknown): Message | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const m = value as TranscriptMessage;
  switch (m.role) {
    case "user":
    case "assistant":
      return m as unknown as Message;
    case "toolResult":
      return { ...m, role: "tool" } as unknown as Message;
    case "custom":
      if (m.excludeFromContext) return undefined;
      // customType keeps OpenClaw's provenance (e.g. openclaw.runtime-context) on the user turn.
      return { role: "user", content: m.content, customType: m.customType } as unknown as Message;
    case "compactionSummary":
      return { role: "user", content: COMPACTION_SUMMARY_PREFIX + String(m.summary) + COMPACTION_SUMMARY_SUFFIX };
    case "branchSummary":
      return { role: "user", content: BRANCH_SUMMARY_PREFIX + String(m.summary) + BRANCH_SUMMARY_SUFFIX };
    case "bashExecution":
      return m.excludeFromContext ? undefined : { role: "user", content: bashExecutionToText(m) };
    default:
      return undefined;
  }
}

// Mirrors OpenClaw's bashExecutionToText (as of v2026.9.8), the context text the model sees for a shell run.
function bashExecutionToText(m: TranscriptMessage): string {
  let text = `Ran \`${String(m.command)}\`\n`;
  text += m.output ? `\`\`\`\n${String(m.output)}\n\`\`\`` : "(no output)";
  if (m.cancelled) {
    text += "\n\n(command cancelled)";
  } else if (m.exitCode !== null && m.exitCode !== undefined && m.exitCode !== 0) {
    text += `\n\nCommand exited with code ${String(m.exitCode)}`;
  }
  if (m.truncated && m.fullOutputPath) {
    text += `\n\n[Output truncated. Full output: ${String(m.fullOutputPath)}]`;
  }
  return text;
}

function shapeMessages(capture: {
  input?: LlmInputCapture;
  text?: string;
}): { input: Message[]; output: Message[] } {
  const out: { input: Message[]; output: Message[] } = { input: [], output: [] };
  if (capture.input) {
    if (Array.isArray(capture.input.historyMessages)) {
      for (const m of capture.input.historyMessages) {
        const message = toModelMessage(m);
        if (message) out.input.push(message);
      }
    }
    if (capture.input.prompt) {
      out.input.push({ role: "user", content: capture.input.prompt });
    }
  }
  if (capture.text) {
    out.output.push({ role: "assistant", content: capture.text });
  }
  return out;
}

function toUsage(raw: LlmUsage | undefined): Usage | undefined {
  if (!raw) return undefined;
  const usage: Usage = {
    inputTokens: totalPromptTokens(raw.input, raw.cacheRead, raw.cacheWrite),
    outputTokens: raw.output,
    cacheReadInputTokens: raw.cacheRead,
    cacheCreationInputTokens: raw.cacheWrite,
  };
  if (
    usage.inputTokens === undefined &&
    usage.outputTokens === undefined &&
    usage.cacheReadInputTokens === undefined &&
    usage.cacheCreationInputTokens === undefined
  ) {
    return undefined;
  }
  return usage;
}
