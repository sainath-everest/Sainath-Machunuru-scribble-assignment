import { AppRoutes } from "./routes";
import { GameStoreProvider } from "./state/gameStore";
import { RoomStoreProvider } from "./state/roomStore";
import "./styles/app.css";

export default function App() {
  return (
    <RoomStoreProvider>
      <GameStoreProvider>
        <AppRoutes />
      </GameStoreProvider>
    </RoomStoreProvider>
  );
}
