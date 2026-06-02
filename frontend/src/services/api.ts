export type ParticipantRole = "drawer" | "guesser";

export interface Participant {
  id: string;
  name: string;
  joinedAt: string;
}

export interface RoomSnapshot {
  code: string;
  hostId: string;
  status: "lobby" | "playing" | "result";
  participants: Participant[];
  availableWords: string[];
  roles: ParticipantRole[];
}

export interface StrokePoint {
  x: number;
  y: number;
}

export type Stroke = StrokePoint[];

export interface GuessEntry {
  participantId: string;
  text: string;
  correct: boolean;
  submittedAt: string;
}

export interface GameSnapshotBase {
  code: string;
  status: "playing" | "result";
  roundNumber: number;
  drawerId: string;
  participants: Participant[];
  strokes: Stroke[];
  guesses: GuessEntry[];
  scores: Record<string, number>;
}

// "playing": secretWord present only for drawer (absent for guessers)
// "result": secretWord always present for all participants
export type GameSnapshot =
  | (GameSnapshotBase & { status: "playing"; secretWord?: string })
  | (GameSnapshotBase & { status: "result"; secretWord: string });

export interface RoomSessionResponse {
  participantId: string;
  room: RoomSnapshot;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({ message: "Request failed" }))) as {
      message?: string;
    };

    throw new Error(errorBody.message ?? "Request failed");
  }

  return (await response.json()) as T;
}

export const api = {
  createRoom(playerName: string) {
    return request<RoomSessionResponse>("/rooms", {
      method: "POST",
      body: JSON.stringify({ playerName })
    });
  },
  joinRoom(code: string, playerName: string) {
    return request<RoomSessionResponse>(`/rooms/${encodeURIComponent(code)}/join`, {
      method: "POST",
      body: JSON.stringify({ playerName })
    });
  },
  fetchRoom(code: string, participantId?: string) {
    const query = participantId ? `?participantId=${encodeURIComponent(participantId)}` : "";
    return request<{ room: RoomSnapshot }>(`/rooms/${encodeURIComponent(code)}${query}`);
  },
  startGame(code: string, participantId: string) {
    return request<{ room: RoomSnapshot }>(`/rooms/${encodeURIComponent(code)}/start`, {
      method: "POST",
      body: JSON.stringify({ participantId })
    });
  },
  fetchGameState(code: string, participantId?: string) {
    const query = participantId ? `?participantId=${encodeURIComponent(participantId)}` : "";
    return request<{ game: GameSnapshot }>(`/rooms/${encodeURIComponent(code)}/game${query}`);
  },
  addStroke(code: string, participantId: string, points: StrokePoint[]) {
    return request<{ game: GameSnapshot }>(`/rooms/${encodeURIComponent(code)}/canvas/stroke`, {
      method: "POST",
      body: JSON.stringify({ participantId, points })
    });
  },
  clearCanvas(code: string, participantId: string) {
    return request<{ game: GameSnapshot }>(`/rooms/${encodeURIComponent(code)}/canvas`, {
      method: "DELETE",
      body: JSON.stringify({ participantId })
    });
  },
  submitGuess(code: string, participantId: string, text: string) {
    return request<{ game: GameSnapshot }>(`/rooms/${encodeURIComponent(code)}/guess`, {
      method: "POST",
      body: JSON.stringify({ participantId, text })
    });
  },
  endRound(code: string, participantId: string) {
    return request<{ room: RoomSnapshot }>(`/rooms/${encodeURIComponent(code)}/end`, {
      method: "POST",
      body: JSON.stringify({ participantId })
    });
  },
  restartGame(code: string, participantId: string) {
    return request<{ room: RoomSnapshot }>(`/rooms/${encodeURIComponent(code)}/restart`, {
      method: "POST",
      body: JSON.stringify({ participantId })
    });
  }
};
