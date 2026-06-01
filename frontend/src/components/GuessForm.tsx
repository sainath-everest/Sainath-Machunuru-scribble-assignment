import { useState } from "react";
import { api, type GameSnapshot } from "../services/api";

interface GuessFormProps {
  roomCode: string;
  participantId: string;
  onGuessResult: (game: GameSnapshot) => void;
  disabled?: boolean;
}

export function GuessForm({ roomCode, participantId, onGuessResult, disabled = false }: GuessFormProps) {
  const [guessText, setGuessText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = guessText.trim();

    if (!trimmed) {
      setError("Guess cannot be empty");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const { game } = await api.submitGuess(roomCode, participantId, trimmed);
      onGuessResult(game);
      setGuessText("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to submit guess");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDisabled = disabled || isSubmitting;

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label className="form__field">
        <input
          className="form__input"
          value={guessText}
          onChange={(event) => setGuessText(event.target.value)}
          placeholder="Type your guess here..."
          disabled={isDisabled}
        />
      </label>
      {error ? <p className="form__error">{error}</p> : null}
      <div className="button-row button-row--compact">
        <button className="button button--primary" type="submit" disabled={isDisabled}>
          {isSubmitting ? "Submitting…" : "Submit Guess"}
        </button>
      </div>
    </form>
  );
}
