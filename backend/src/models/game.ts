export type ParticipantRole = "drawer" | "guesser";
export type RoomStatus = "lobby" | "playing";

export interface Participant {
  id: string;
  name: string;
  joinedAt: string;
}

// Stored server-side only — never serialized into any shared snapshot
export interface Round {
  roundNumber: number;
  drawerId: string;
  secretWord: string;
}

export interface Room {
  code: string;
  hostId: string;
  status: RoomStatus;
  currentRound: Round | null;
  participants: Participant[];
  createdAt: string;
  updatedAt: string;
}

export interface RoomSnapshot {
  code: string;
  hostId: string;
  status: RoomStatus;
  participants: Participant[];
  availableWords: string[];
  roles: ParticipantRole[];
}

export interface RoomSessionResponse {
  participantId: string;
  room: RoomSnapshot;
}

// Game-phase snapshot types — returned by GET /rooms/:code/game
export interface GameSnapshotBase {
  code: string;
  status: "playing";
  roundNumber: number;
  drawerId: string;
  participants: Participant[];
}

export type DrawerGameSnapshot = GameSnapshotBase & { secretWord: string };
export type GuesserGameSnapshot = GameSnapshotBase;
export type GameSnapshot = DrawerGameSnapshot | GuesserGameSnapshot;
