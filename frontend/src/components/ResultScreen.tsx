import type { GuessEntry, Participant } from "../services/api";
import { Card } from "./Card";
import { ResultPanel } from "./ResultPanel";
import { Scoreboard } from "./Scoreboard";

interface ResultScreenProps {
  secretWord: string;
  scores: Record<string, number>;
  participants: Participant[];
  guesses: GuessEntry[];
  isHost: boolean;
  isRestarting: boolean;
  onRestart: () => void;
}

export function ResultScreen({
  secretWord,
  scores,
  participants,
  guesses,
  isHost,
  isRestarting,
  onRestart
}: ResultScreenProps) {
  return (
    <section className="result-screen">
      <div className="result-screen__header">
        <h1 className="result-screen__title">Round Over</h1>
      </div>

      <Card title="The Word Was">
        <p className="result-screen__word">{secretWord}</p>
      </Card>

      <div className="result-screen__layout">
        <div className="result-screen__column">
          <Scoreboard scores={scores} participants={participants} />
        </div>
        <div className="result-screen__column">
          <ResultPanel guesses={guesses} participants={participants} />
        </div>
      </div>

      <div className="button-row">
        {isHost && (
          <button
            className="button button--primary"
            onClick={onRestart}
            disabled={isRestarting}
          >
            {isRestarting ? "Restarting…" : "Restart"}
          </button>
        )}
      </div>
    </section>
  );
}
