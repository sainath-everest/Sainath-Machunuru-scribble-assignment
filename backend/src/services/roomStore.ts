import { randomUUID } from "node:crypto";
import type { GameSnapshot, Participant, Room, RoomSnapshot } from "../models/game.js";
import { HttpError } from "../api/schemas.js";
import { STARTER_ROLES, STARTER_WORDS } from "../seed/starterData.js";

const rooms = new Map<string, Room>();

function now() {
  return new Date().toISOString();
}

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

function generateUniqueCode() {
  let code = generateCode();

  while (rooms.has(code)) {
    code = generateCode();
  }

  return code;
}

function displayName(name?: string) {
  return name || "Player";
}

function createParticipant(name?: string): Participant {
  return {
    id: randomUUID(),
    name: displayName(name),
    joinedAt: now()
  };
}

function cloneRoom(room: Room) {
  return structuredClone(room);
}

export function listWords() {
  return [...STARTER_WORDS];
}

export function createRoom(playerName?: string) {
  const participant = createParticipant(playerName);
  const room: Room = {
    code: generateUniqueCode(),
    hostId: participant.id,
    status: "lobby",
    currentRound: null,
    participants: [participant],
    createdAt: now(),
    updatedAt: now()
  };

  rooms.set(room.code, room);

  return {
    room: cloneRoom(room),
    participantId: participant.id
  };
}

export function joinRoom(code: string, playerName?: string) {
  const room = rooms.get(code);

  if (!room) {
    return null;
  }

  const participant = createParticipant(playerName);
  room.participants.push(participant);
  room.updatedAt = now();
  rooms.set(room.code, room);

  return {
    room: cloneRoom(room),
    participantId: participant.id
  };
}

export function getRoom(code: string) {
  const room = rooms.get(code);
  return room ? cloneRoom(room) : null;
}

export function saveRoom(room: Room) {
  room.updatedAt = now();
  rooms.set(room.code, cloneRoom(room));
  return getRoom(room.code);
}

export function startGame(code: string, participantId: string) {
  const room = rooms.get(code.toUpperCase());

  if (!room) {
    return null;
  }

  if (room.status === "playing") {
    throw new HttpError(409, "Game already started");
  }

  if (participantId !== room.hostId) {
    throw new HttpError(403, "Only the host can start the game");
  }

  if (room.participants.length < 2) {
    throw new HttpError(400, "Need at least 2 players to start");
  }

  const hostStillPresent = room.participants.some((p) => p.id === room.hostId);
  const drawerId = hostStillPresent ? room.hostId : room.participants[0].id;
  const secretWord = STARTER_WORDS[Math.floor(Math.random() * STARTER_WORDS.length)];

  room.status = "playing";
  room.currentRound = { roundNumber: 1, drawerId, secretWord };
  room.updatedAt = now();
  rooms.set(room.code, room);

  return { room: cloneRoom(room) };
}

export function toRoomSnapshot(room: Room, viewerParticipantId?: string): RoomSnapshot {
  void viewerParticipantId;

  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    participants: room.participants.map((participant) => ({ ...participant })),
    availableWords: listWords(),
    roles: [...STARTER_ROLES]
  };
}

export function toGameSnapshot(room: Room, viewerParticipantId?: string): GameSnapshot {
  const round = room.currentRound;

  if (!round) {
    throw new HttpError(409, "Game has not started yet");
  }

  const base = {
    code: room.code,
    status: "playing" as const,
    roundNumber: round.roundNumber,
    drawerId: round.drawerId,
    participants: room.participants.map((participant) => ({ ...participant }))
  };

  if (viewerParticipantId === round.drawerId) {
    return { ...base, secretWord: round.secretWord };
  }

  return base;
}
