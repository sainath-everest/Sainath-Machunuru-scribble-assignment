import type { GuessEntry, Participant } from "../services/api";
import { Card } from "./Card";

interface ResultPanelProps {
  guesses: GuessEntry[];
  participants: Participant[];
}

export function ResultPanel({ guesses, participants }: ResultPanelProps) {
  function nameFor(participantId: string) {
    return participants.find((p) => p.id === participantId)?.name ?? "Unknown";
  }

  return (
    <Card title="Activity">
      {guesses.length === 0 ? (
        <p className="result-panel__empty">No guesses yet.</p>
      ) : (
        <ul className="result-panel__list">
          {guesses.map((guess, index) => (
            <li
              key={index}
              className={`result-panel__item${guess.correct ? " result-panel__item--correct" : ""}`}
            >
              <span className="result-panel__name">{nameFor(guess.participantId)}</span>
              <span className="result-panel__text">{guess.text}</span>
              {guess.correct ? <span className="result-panel__badge">✓</span> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
