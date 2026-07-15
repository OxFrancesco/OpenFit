import { describe, expect, test } from "bun:test";

import { isWebSocketUpgrade } from "./request-security";

describe("health agent transport boundary", () => {
  test("recognizes WebSocket upgrades so they are blocked before Agent routing", () => {
    expect(
      isWebSocketUpgrade(
        new Request("https://agent.example/agents/fitty-health-agent/user", {
          headers: { Upgrade: "websocket" }
        })
      )
    ).toBeTrue();
    expect(
      isWebSocketUpgrade(
        new Request("https://agent.example/agents/fitty-health-agent/user", {
          headers: { Upgrade: "h2c, WebSocket" }
        })
      )
    ).toBeTrue();
    expect(isWebSocketUpgrade(new Request("https://agent.example/health"))).toBeFalse();
  });
});
