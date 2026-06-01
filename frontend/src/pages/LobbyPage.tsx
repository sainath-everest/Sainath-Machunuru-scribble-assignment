import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { RoomCodeBadge } from "../components/RoomCodeBadge";
import { api } from "../services/api";
import { useGameStore } from "../state/gameStore";
import { useRoomState, useRoomStore } from "../state/roomStore";

const POLL_INTERVAL_MS = 2000;

export function LobbyPage() {
  const navigate = useNavigate();
  const roomStore = useRoomStore();
  const gameStore = useGameStore();
  const { room, participantId, isLoading } = useRoomState();
  const [pollError, setPollError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!room) {
      navigate("/", { replace: true });
    }
  }, [navigate, room]);

  useEffect(() => {
    if (!room) return;

    pollRef.current = setInterval(async () => {
      try {
        const updated = await roomStore.fetchRoom();
        setPollError(null);
        if (updated?.status === "playing") {
          navigate("/game");
        }
      } catch (caughtError) {
        setPollError(caughtError instanceof Error ? caughtError.message : "Unable to refresh room");
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStartGame() {
    if (!room || !participantId) return;

    try {
      setStartError(null);
      setIsStarting(true);
      await api.startGame(room.code, participantId);
      gameStore.reset();
      navigate("/game");
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Unable to start game");
    } finally {
      setIsStarting(false);
    }
  }

  if (!room) {
    return null;
  }

  const isHost = room.hostId === participantId;
  const canStart = isHost && room.participants.length >= 2;

  return (
    <section className="panel placeholder-page">
      <div className="lobby-header">
        <PageHeader
          kicker="Waiting for players"
          title="Lobby"
          description="Share the room code with friends so they can join your game."
        />
        <RoomCodeBadge code={room.code} />
      </div>

      <div className="summary-grid">
        <Card title="Participants">
          {room.participants.length === 0 ? (
            <p>No participants are connected to this room yet.</p>
          ) : (
            <ul className="player-list">
              {room.participants.map((participant) => (
                <li key={participant.id}>
                  <span>{participant.name}</span>
                  {participant.id === room.hostId ? (
                    <span className="player-list__badge">Host</span>
                  ) : (
                    <span className="player-list__meta">joined</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Status">
          <p className="status-line" style={{ backgroundColor: isLoading ? "#fef3c7" : "#e0e7ff", color: isLoading ? "#b45309" : "#3730a3" }}>
            {isLoading ? "Refreshing players…" : "Ready to play"}
          </p>
          {pollError ? <p className="form__error" style={{ marginTop: "8px" }}>{pollError}</p> : null}
          {!isHost ? <p style={{ marginTop: "8px" }}>Waiting for the host to start the game.</p> : null}
          {isHost && !canStart ? <p style={{ marginTop: "8px" }}>Need at least 2 players to start.</p> : null}
        </Card>
      </div>

      <div className="button-row button-row--spread">
        {isHost ? (
          <>
            {startError ? <p className="form__error">{startError}</p> : null}
            <button
              className="button button--primary"
              disabled={!canStart || isStarting}
              onClick={handleStartGame}
            >
              {isStarting ? "Starting…" : "Start Game"}
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
