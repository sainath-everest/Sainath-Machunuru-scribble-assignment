import { Router } from "express";
import {
  addStrokeSchema,
  canvasActionSchema,
  createRoomSchema,
  endRoundSchema,
  gameViewerQuerySchema,
  HttpError,
  joinRoomSchema,
  restartSchema,
  roomCodeParamsSchema,
  roomViewerQuerySchema,
  startRoomSchema,
  submitGuessSchema
} from "./schemas.js";
import { addStroke, clearCanvas, createRoom, endRound, getRoom, joinRoom, restartGame, startGame, submitGuess, toGameSnapshot, toRoomSnapshot } from "../services/roomStore.js";

export function createRoomsRouter() {
  const router = Router();

  router.post("/", (request, response, next) => {
    try {
      const { playerName } = createRoomSchema.parse(request.body);
      const result = createRoom(playerName);

      response.status(201).json({
        participantId: result.participantId,
        room: toRoomSnapshot(result.room, result.participantId)
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:code/join", (request, response, next) => {
    try {
      const { code } = roomCodeParamsSchema.parse(request.params);
      const { playerName } = joinRoomSchema.parse(request.body);
      const result = joinRoom(code.toUpperCase(), playerName);

      if (!result) {
        throw new HttpError(404, "Unable to join room");
      }

      response.json({
        participantId: result.participantId,
        room: toRoomSnapshot(result.room, result.participantId)
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:code", (request, response, next) => {
    try {
      const { code } = roomCodeParamsSchema.parse(request.params);
      const { participantId } = roomViewerQuerySchema.parse(request.query);
      const room = getRoom(code.toUpperCase());

      if (!room) {
        throw new HttpError(404, "Unable to load room");
      }

      response.json({
        room: toRoomSnapshot(room, participantId)
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:code/start", (request, response, next) => {
    try {
      const { code } = roomCodeParamsSchema.parse(request.params);
      const { participantId } = startRoomSchema.parse(request.body);
      const result = startGame(code, participantId);

      if (!result) {
        throw new HttpError(404, "Unable to load room");
      }

      response.json({
        room: toRoomSnapshot(result.room)
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:code/game", (request, response, next) => {
    try {
      const { code } = roomCodeParamsSchema.parse(request.params);
      const { participantId } = gameViewerQuerySchema.parse(request.query);
      const room = getRoom(code.toUpperCase());

      if (!room) {
        throw new HttpError(404, "Unable to load room");
      }

      if ((room.status !== "playing" && room.status !== "result") || !room.currentRound) {
        throw new HttpError(409, "Game has not started yet");
      }

      response.json({
        game: toGameSnapshot(room, participantId)
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:code/end", (request, response, next) => {
    try {
      const { code } = roomCodeParamsSchema.parse(request.params);
      const { participantId } = endRoundSchema.parse(request.body);
      const result = endRound(code, participantId);
      response.json({ room: toRoomSnapshot(result.room) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:code/restart", (request, response, next) => {
    try {
      const { code } = roomCodeParamsSchema.parse(request.params);
      const { participantId } = restartSchema.parse(request.body);
      const result = restartGame(code, participantId);
      response.json({ room: toRoomSnapshot(result.room) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:code/canvas/stroke", (request, response, next) => {
    try {
      const { code } = roomCodeParamsSchema.parse(request.params);
      const { participantId, points } = addStrokeSchema.parse(request.body);
      const game = addStroke(code, participantId, points);
      response.json({ game });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:code/canvas", (request, response, next) => {
    try {
      const { code } = roomCodeParamsSchema.parse(request.params);
      const { participantId } = canvasActionSchema.parse(request.body);
      const game = clearCanvas(code, participantId);
      response.json({ game });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:code/guess", (request, response, next) => {
    try {
      const { code } = roomCodeParamsSchema.parse(request.params);
      const { participantId, text } = submitGuessSchema.parse(request.body);
      const game = submitGuess(code, participantId, text);
      response.json({ game });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
