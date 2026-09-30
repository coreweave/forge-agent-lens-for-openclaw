// SPDX-FileCopyrightText: 2026 CoreWeave, Inc.
// SPDX-License-Identifier: Apache-2.0
// SPDX-PackageName: forge-agent-lens-for-openclaw

import { PACKAGE_VERSION } from "../config/version.js";

// Integration identity for the Weave Agents backend to group/filter traces by
// emitting integration (peer to other Forge integrations). Set once at each trace's root
// (the Conversation, or a rootless Turn); the SDK propagates it down the handle
// chain to every child span.
export const INTEGRATION_ATTRIBUTES: Record<string, string> = {
  "forge.integration.name": "forge-agent-lens-for-openclaw",
  "forge.integration.version": PACKAGE_VERSION,
};
