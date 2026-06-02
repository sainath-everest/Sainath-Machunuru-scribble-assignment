import {
  createElement,
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
  type PropsWithChildren
} from "react";
import { api, type GameSnapshot } from "../services/api";

export interface GameState {
  game: GameSnapshot | null;
  error: string | null;
  isLoading: boolean;
  roundEnded: boolean;
}

type Listener = () => void;

class GameStore {
  private state: GameState = {
    game: null,
    error: null,
    isLoading: false,
    roundEnded: false
  };

  private listeners = new Set<Listener>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.state;

  private setState(nextState: Partial<GameState>) {
    this.state = { ...this.state, ...nextState };
    this.listeners.forEach((listener) => listener());
  }

  async fetchGame(code: string, participantId?: string) {
    this.setState({ isLoading: true });

    try {
      const response = await api.fetchGameState(code, participantId);
      this.setState({ game: response.game, error: null, isLoading: false });
      return response.game;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load game state";
      // If the poll 409s while we were in result state, the host has restarted
      const wasInResultState = this.state.game?.status === "result";
      this.setState({
        error: message,
        isLoading: false,
        ...(wasInResultState ? { roundEnded: true } : {})
      });
      return null;
    }
  }

  setGame(game: GameSnapshot) {
    this.setState({ game, error: null });
  }

  async endRound(code: string, participantId: string) {
    try {
      const response = await api.endRound(code, participantId);
      return response.room;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to end round";
      this.setState({ error: message });
      return null;
    }
  }

  async restartGame(code: string, participantId: string) {
    try {
      const response = await api.restartGame(code, participantId);
      this.setState({ game: null, error: null, roundEnded: true });
      return response.room;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to restart";
      this.setState({ error: message });
      return null;
    }
  }

  reset() {
    this.setState({ game: null, error: null, isLoading: false, roundEnded: false });
  }
}

const GameStoreContext = createContext<GameStore | null>(null);

export function GameStoreProvider({ children }: PropsWithChildren) {
  const storeRef = useRef<GameStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = new GameStore();
  }

  return createElement(GameStoreContext.Provider, { value: storeRef.current }, children);
}

export function useGameStore() {
  const store = useContext(GameStoreContext);

  if (!store) {
    throw new Error("GameStoreProvider is missing");
  }

  return store;
}

export function useGameState() {
  const store = useGameStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
