import { z } from "zod";

const playerNameSchema = z
  .string({ required_error: "Player name is required" })
  .trim()
  .min(1, "Player name is required");

export const createRoomSchema = z.object({
  playerName: playerNameSchema
});

export const joinRoomSchema = z.object({
  playerName: playerNameSchema
});

export const roomCodeParamsSchema = z.object({
  code: z.string()
});

export const roomViewerQuerySchema = z.object({
  participantId: z.string().optional()
});

export const startRoomSchema = z.object({
  participantId: z
    .string({ required_error: "Participant ID is required" })
    .trim()
    .min(1, "Participant ID is required")
});

export const gameViewerQuerySchema = z.object({
  participantId: z.string().optional()
});

const strokePointSchema = z.object({
  x: z.number(),
  y: z.number()
});

export const addStrokeSchema = z.object({
  participantId: z
    .string({ required_error: "Participant ID is required" })
    .trim()
    .min(1, "Participant ID is required"),
  points: z
    .array(strokePointSchema)
    .min(1, "Stroke must contain at least one point")
});

export const canvasActionSchema = z.object({
  participantId: z
    .string({ required_error: "Participant ID is required" })
    .trim()
    .min(1, "Participant ID is required")
});

export const submitGuessSchema = z.object({
  participantId: z
    .string({ required_error: "Participant ID is required" })
    .trim()
    .min(1, "Participant ID is required"),
  text: z
    .string({ required_error: "Guess text is required" })
    .min(1, "Guess text is required")
});

export const endRoundSchema = z.object({
  participantId: z
    .string({ required_error: "Participant ID is required" })
    .trim()
    .min(1, "Participant ID is required")
});

export const restartSchema = z.object({
  participantId: z
    .string({ required_error: "Participant ID is required" })
    .trim()
    .min(1, "Participant ID is required")
});

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}
