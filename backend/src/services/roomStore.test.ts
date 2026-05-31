import { describe, expect, it } from "vitest";
import { createRoom, joinRoom, toRoomSnapshot } from "./roomStore.js";

describe("roomStore", () => {
  it("createRoom returns a room with a 4-character uppercase code", () => {
    const result = createRoom("Alice");

    expect(result.room.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(result.room.participants).toHaveLength(1);
    expect(result.room.participants[0].name).toBe("Alice");
    expect(result.participantId).toBeDefined();
  });

  it("createRoom sets hostId to the creator's participantId", () => {
    const result = createRoom("Alice");

    expect(result.room.hostId).toBe(result.participantId);
  });

  it("toRoomSnapshot includes hostId", () => {
    const { room } = createRoom("Alice");
    const snapshot = toRoomSnapshot(room);

    expect(snapshot.hostId).toBe(room.hostId);
  });

  it("joinRoom returns null for an unknown room code", () => {
    const result = joinRoom("ZZZZ", "Bob");

    expect(result).toBeNull();
  });

  it("joinRoom preserves original hostId when a second player joins", () => {
    const hostResult = createRoom("Alice");
    const joinResult = joinRoom(hostResult.room.code, "Bob");

    expect(joinResult).not.toBeNull();
    expect(joinResult!.room.hostId).toBe(hostResult.participantId);
  });

  it("rooms are isolated — joining room 2 does not affect room 1's participants", () => {
    const room1 = createRoom("Alice");
    const room2 = createRoom("Carol");

    joinRoom(room2.room.code, "Dave");

    const updatedRoom1 = joinRoom(room1.room.code, "Eve");

    expect(updatedRoom1).not.toBeNull();
    expect(updatedRoom1!.room.participants).toHaveLength(2);
    expect(updatedRoom1!.room.participants.map((p) => p.name)).not.toContain("Dave");
    expect(updatedRoom1!.room.participants.map((p) => p.name)).not.toContain("Carol");
  });
});
