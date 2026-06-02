import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import { DrawingCanvas } from "../components/DrawingCanvas";
import { GuessForm } from "../components/GuessForm";
import { ResultPanel } from "../components/ResultPanel";
import { ResultScreen } from "../components/ResultScreen";
import { RoomCodeBadge } from "../components/RoomCodeBadge";
import { Scoreboard } from "../components/Scoreboard";
import { api, type StrokePoint } from "../services/api";
import { useGameState, useGameStore } from "../state/gameStore";
import { useRoomState, useRoomStore } from "../state/roomStore";

const POLL_INTERVAL_MS = 2000;

export function GamePage() {
  const navigate = useNavigate();
  const gameStore = useGameStore();
  const roomStore = useRoomStore();
  const { game, error: gameError, roundEnded } = useGameState();
  const { room, participantId } = useRoomState();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isEndingRound, setIsEndingRound] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    if (!room) {
      navigate("/", { replace: true });
    }
  }, [navigate, room]);

  useEffect(() => {
    if (roundEnded) {
      gameStore.reset();
      navigate("/lobby", { replace: true });
    }
  }, [roundEnded, gameStore, navigate]);

  useEffect(() => {
    if (!room) return;

    gameStore.fetchGame(room.code, participantId ?? undefined);

    pollRef.current = setInterval(() => {
      gameStore.fetchGame(room.code, participantId ?? undefined);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStroke = useCallback(
    async (points: StrokePoint[]) => {
      if (!room || !participantId) return;
      try {
        const { game: updated } = await api.addStroke(room.code, participantId, points);
        gameStore.setGame(updated);
      } catch {
        // swallow canvas errors — polling will resync
      }
    },
    [room, participantId, gameStore]
  );

  const handleClearCanvas = useCallback(async () => {
    if (!room || !participantId) return;
    try {
      const { game: updated } = await api.clearCanvas(room.code, participantId);
      gameStore.setGame(updated);
    } catch {
      // swallow canvas errors — polling will resync
    }
  }, [room, participantId, gameStore]);

  const handleEndRound = useCallback(async () => {
    if (!room || !participantId) return;
    setIsEndingRound(true);
    await gameStore.endRound(room.code, participantId);
    setIsEndingRound(false);
  }, [room, participantId, gameStore]);

  const handleRestart = useCallback(async () => {
    if (!room || !participantId) return;
    setIsRestarting(true);
    const updatedRoom = await gameStore.restartGame(room.code, participantId);
    if (updatedRoom) {
      roomStore.setRoomSnapshot(updatedRoom);
    }
    setIsRestarting(false);
  }, [room, participantId, gameStore, roomStore]);

  if (!room) {
    return null;
  }

  const viewer = room.participants.find((p) => p.id === participantId) ?? null;
  const isDrawer = game !== null && game.drawerId === participantId;
  const isHost = participantId === room.hostId;

  if (game?.status === "result") {
    return (
      <ResultScreen
        secretWord={game.secretWord}
        scores={game.scores}
        participants={game.participants}
        guesses={game.guesses}
        isHost={isHost}
        isRestarting={isRestarting}
        onRestart={handleRestart}
      />
    );
  }

  return (
    <section className="panel game-page">
      <div className="game-page__header">
        <div className="game-page__header-left">
          <span className="section-kicker">Round {game?.roundNumber ?? 1}</span>
          <h1 className="game-page__title">{isDrawer ? "Draw the Word!" : "Guess the Word!"}</h1>
        </div>
        <RoomCodeBadge code={room.code} />
      </div>

      <div className="game-page__layout">
        <aside className="game-page__sidebar game-page__sidebar--left">
          <Scoreboard
            scores={game?.scores ?? {}}
            participants={game?.participants ?? room.participants}
          />
          <ResultPanel
            guesses={game?.guesses ?? []}
            participants={game?.participants ?? room.participants}
          />
        </aside>

        <div className="game-page__main">
          {isDrawer && game?.secretWord ? (
            <Card title="Your Word">
              <p className="secret-word-banner">
                Draw: <strong>{game.secretWord}</strong>
              </p>
            </Card>
          ) : null}
          <Card title="Canvas">
            {game ? (
              <DrawingCanvas
                strokes={game.strokes}
                isDrawer={isDrawer}
                onStroke={handleStroke}
                onClear={handleClearCanvas}
              />
            ) : (
              <div
                className="canvas-placeholder"
                style={{ minHeight: "450px", backgroundColor: "#ffffff", border: "1px solid #e5e7eb" }}
              >
                Loading game…
              </div>
            )}
          </Card>
          {gameError ? <p className="form__error" style={{ marginTop: "8px" }}>{gameError}</p> : null}
        </div>

        <aside className="game-page__sidebar game-page__sidebar--right">
          <Card title="Player Info">
            <dl className="detail-list">
              <div>
                <dt>Name</dt>
                <dd>{viewer?.name ?? "Unknown player"}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{game ? (isDrawer ? "Drawer" : "Guesser") : "—"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Playing</dd>
              </div>
            </dl>
          </Card>

          {!isDrawer && participantId ? (
            <Card title="Your Guess">
              <GuessForm
                roomCode={room.code}
                participantId={participantId}
                onGuessResult={(updated) => gameStore.setGame(updated)}
              />
            </Card>
          ) : null}
        </aside>
      </div>

      <div className="button-row">
        {isHost && game?.status === "playing" && (
          <button
            className="button button--primary"
            onClick={handleEndRound}
            disabled={isEndingRound}
          >
            {isEndingRound ? "Ending…" : "End Round"}
          </button>
        )}
        <button className="button button--secondary" onClick={() => navigate("/lobby")}>
          Exit Game
        </button>
      </div>
    </section>
  );
}
