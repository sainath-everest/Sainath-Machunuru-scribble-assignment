import { describe, expect, it } from "vitest";
import { createRoomSchema, joinRoomSchema, roomCodeParamsSchema, startRoomSchema } from "./schemas.js";

describe("schemas", () => {
  it("createRoomSchema accepts a valid body with playerName", () => {
    const result = createRoomSchema.parse({ playerName: "Alice" });

    expect(result.playerName).toBe("Alice");
  });

  it("createRoomSchema rejects missing playerName", () => {
    expect(() => createRoomSchema.parse({})).toThrow("Player name is required");
  });

  it("createRoomSchema rejects blank playerName", () => {
    expect(() => createRoomSchema.parse({ playerName: "   " })).toThrow("Player name is required");
  });

  it("joinRoomSchema rejects missing playerName", () => {
    expect(() => joinRoomSchema.parse({})).toThrow("Player name is required");
  });

  it("roomCodeParamsSchema rejects missing code", () => {
    expect(() => roomCodeParamsSchema.parse({})).toThrow();
  });

  it("startRoomSchema accepts a valid participantId", () => {
    const result = startRoomSchema.parse({ participantId: "some-uuid" });

    expect(result.participantId).toBe("some-uuid");
  });

  it("startRoomSchema rejects missing participantId", () => {
    expect(() => startRoomSchema.parse({})).toThrow("Participant ID is required");
  });

  it("startRoomSchema rejects blank participantId", () => {
    expect(() => startRoomSchema.parse({ participantId: "   " })).toThrow(
      "Participant ID is required"
    );
  });
});
