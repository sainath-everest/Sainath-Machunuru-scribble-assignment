import type { Participant } from "../services/api";
import { Card } from "./Card";

interface ScoreboardProps {
  scores: Record<string, number>;
  participants: Participant[];
}

export function Scoreboard({ scores, participants }: ScoreboardProps) {
  const sorted = [...participants].sort(
    (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)
  );

  return (
    <Card title="Scoreboard">
      <ul className="scoreboard__list">
        {sorted.map((p) => (
          <li key={p.id} className="scoreboard__row">
            <span className="scoreboard__name">{p.name}</span>
            <strong className="scoreboard__score">{scores[p.id] ?? 0}</strong>
          </li>
        ))}
      </ul>
    </Card>
  );
}
