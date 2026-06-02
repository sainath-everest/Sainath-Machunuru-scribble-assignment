export type ParticipantRole = "drawer" | "guesser";
export type RoomStatus = "lobby" | "playing" | "result";

export interface Participant {
  id: string;
  name: string;
  joinedAt: string;
}

// Canvas drawing types
export interface StrokePoint {
  x: number;
  y: number;
}

export type Stroke = StrokePoint[];

// One accepted guess record within a round
export interface Guess {
  participantId: string;
  text: string;
  correct: boolean;
  submittedAt: string;
}

// Stored server-side only — never serialized into any shared snapshot
export interface Round {
  roundNumber: number;
  drawerId: string;
  secretWord: string;
  strokes: Stroke[];
  guesses: Guess[];
  scores: Record<string, number>;
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
  status: "playing" | "result";
  roundNumber: number;
  drawerId: string;
  participants: Participant[];
  strokes: Stroke[];
  guesses: Guess[];
  scores: Record<string, number>;
}

export type DrawerGameSnapshot = GameSnapshotBase & { status: "playing"; secretWord: string };
export type GuesserGameSnapshot = GameSnapshotBase & { status: "playing" };

// In result state secretWord is visible to ALL participants
export type ResultGameSnapshot = GameSnapshotBase & { status: "result"; secretWord: string };

export type GameSnapshot = DrawerGameSnapshot | GuesserGameSnapshot | ResultGameSnapshot;
