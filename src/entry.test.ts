// SPDX-FileCopyrightText: 2026 CoreWeave, Inc.
// SPDX-License-Identifier: Apache-2.0
// SPDX-PackageName: forge-agent-lens-for-openclaw

import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import entry from "../index.js";

// Keep registration offline: this test never starts the tracing service.
describe("Forge plugin entry", () => {
  it("registers the forge service and status command with matching package metadata", async () => {
    const manifest = JSON.parse(readFileSync(new URL("../openclaw.plugin.json", import.meta.url), "utf8"));
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const registerService = vi.fn();
    const registerCommand = vi.fn();
    await entry.register!({
      pluginConfig: { entity: "team", project: "project", enabled: false },
      on: vi.fn(),
      registerService,
      registerCommand,
    } as any);

    expect(entry.id).toBe("forge");
    expect(manifest.id).toBe(entry.id);
    expect(pkg.name).toBe("@coreweave/forge-agent-lens-for-openclaw");
    expect(pkg.openclaw.install.clawhubSpec).toBe(`clawhub:${pkg.name}`);
    expect(pkg.openclaw.install.npmSpec).toBe("forge-agent-lens-for-openclaw");
    expect(registerService.mock.calls[0]?.[0].id).toBe("forge");
    const command = registerCommand.mock.calls[0]?.[0];
    expect(command.name).toBe("forge");
    expect(command.handler().text).toContain(`forge: pluginVersion=${pkg.version}`);
    expect(command.handler().text).toContain("lifecycle=not-started");
  });
});
