// SPDX-FileCopyrightText: 2026 CoreWeave, Inc.
// SPDX-License-Identifier: Apache-2.0
// SPDX-PackageName: forge-agent-lens-for-openclaw

import { describe, it, expect, assert } from "vitest";
import {
  pinInMemoryExporter,
  setupTurn,
  runCompleted,
  modelCallStarted,
  modelCallCompleted,
} from "./test/helpers.js";

const exporter = pinInMemoryExporter();

// llm_input.historyMessages carries OpenClaw transcript messages. Fixtures mirror
// openclaw packages/agent-core/src/types.ts; expected text mirrors its convertToLlm.
async function exportedInputMessages(historyMessages: unknown[]): Promise<unknown> {
  const { dispatch, finish } = await setupTurn();
  dispatch.hook("llm_input", { runId: "r", prompt: "next question", historyMessages });
  dispatch.hook("model_call_started", { runId: "r", callId: "c-1" });
  modelCallStarted(dispatch, { callId: "c-1", spanId: "sp2" });
  modelCallCompleted(dispatch, { callId: "c-1", spanId: "sp2" });
  runCompleted(dispatch);
  await finish();
  const chat = exporter.getFinishedSpans().find(s => s.attributes["gen_ai.operation.name"] === "chat");
  assert(chat);
  return JSON.parse(String(chat.attributes["gen_ai.input.messages"]));
}

const PROMPT = { role: "user", content: "next question" };

describe("chat span input messages from OpenClaw history", () => {
  it("records the runtime-context custom message with the user role the model receives", async () => {
    const runtimeContext =
      "<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>>\nActive exec sessions:\nnone\n<<<END_OPENCLAW_INTERNAL_CONTEXT>>>";
    const messages = await exportedInputMessages([
      { role: "user", content: "earlier question" },
      { role: "assistant", content: [{ type: "text", text: "earlier answer" }] },
      {
        role: "custom",
        customType: "openclaw.runtime-context",
        content: runtimeContext,
        display: false,
        details: {
          source: "openclaw-runtime-context",
          runtimeContextCarrier: true,
          fragments: [{ kind: "conversation-data", text: "Active exec sessions:\nnone" }],
        },
        timestamp: 3,
      },
    ]);
    expect(messages).toEqual([
      { role: "user", content: "earlier question" },
      { role: "assistant", content: [{ type: "text", text: "earlier answer" }] },
      { role: "user", content: runtimeContext, customType: "openclaw.runtime-context" },
      PROMPT,
    ]);
  });

  it("drops messages OpenClaw excludes from model context", async () => {
    const messages = await exportedInputMessages([
      { role: "custom", customType: "ui.note", content: "display only", display: true, excludeFromContext: true, timestamp: 1 },
      {
        role: "bashExecution",
        command: "ls",
        output: "a.txt",
        exitCode: 0,
        cancelled: false,
        truncated: false,
        timestamp: 2,
        excludeFromContext: true,
      },
    ]);
    expect(messages).toEqual([PROMPT]);
  });

  it("records tool results with the tool role", async () => {
    const toolResult = {
      toolCallId: "call_1",
      toolName: "search",
      content: [{ type: "text", text: "3 results" }],
      isError: false,
      timestamp: 4,
    };
    const messages = await exportedInputMessages([{ role: "toolResult", ...toolResult }]);
    expect(messages).toEqual([{ role: "tool", ...toolResult }, PROMPT]);
  });

  it.each([
    {
      message: { role: "compactionSummary", summary: "We fixed the bug.", tokensBefore: 1200, timestamp: 5 },
      content:
        "The conversation history before this point was compacted into the following summary:\n\n<summary>\nWe fixed the bug.\n</summary>",
    },
    {
      message: { role: "branchSummary", summary: "Tried plan B.", fromId: "e1", timestamp: 6 },
      content:
        "The following is a summary of a branch that this conversation came back from:\n\n<summary>\nTried plan B.</summary>",
    },
  ])("records a $message.role as the user text the model receives", async ({ message, content }) => {
    expect(await exportedInputMessages([message])).toEqual([{ role: "user", content }, PROMPT]);
  });

  it.each([
    {
      name: "output",
      bash: { command: "ls", output: "a.txt", exitCode: 0, cancelled: false, truncated: false },
      content: "Ran `ls`\n```\na.txt\n```",
    },
    {
      name: "no output",
      bash: { command: "true", output: "", exitCode: 0, cancelled: false, truncated: false },
      content: "Ran `true`\n(no output)",
    },
    {
      name: "non-zero exit",
      bash: { command: "false", output: "", exitCode: 1, cancelled: false, truncated: false },
      content: "Ran `false`\n(no output)\n\nCommand exited with code 1",
    },
    {
      name: "a null exit code",
      bash: { command: "true", output: "", exitCode: null, cancelled: false, truncated: false },
      content: "Ran `true`\n(no output)",
    },
    {
      // Cancellation wins over the signal exit code a killed command reports.
      name: "cancelled",
      bash: { command: "sleep 9", output: "", exitCode: 130, cancelled: true, truncated: false },
      content: "Ran `sleep 9`\n(no output)\n\n(command cancelled)",
    },
    {
      name: "truncated",
      bash: { command: "cat big", output: "x", exitCode: 0, cancelled: false, truncated: true, fullOutputPath: "/tmp/out.txt" },
      content: "Ran `cat big`\n```\nx\n```\n\n[Output truncated. Full output: /tmp/out.txt]",
    },
    {
      name: "truncated output and no saved path",
      bash: { command: "cat big", output: "x", exitCode: 0, cancelled: false, truncated: true },
      content: "Ran `cat big`\n```\nx\n```",
    },
  ])("records a bash execution with $name as the user text the model receives", async ({ bash, content }) => {
    const messages = await exportedInputMessages([{ role: "bashExecution", ...bash, timestamp: 7 }]);
    expect(messages).toEqual([{ role: "user", content }, PROMPT]);
  });

  it("drops roles the model never receives", async () => {
    const messages = await exportedInputMessages([
      { role: "system", content: "ignored" },
      { role: "someFutureRole", content: "ignored" },
    ]);
    expect(messages).toEqual([PROMPT]);
  });
});
