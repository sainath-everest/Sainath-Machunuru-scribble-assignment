import { useCallback, useEffect, useRef } from "react";
import type { Stroke, StrokePoint } from "../services/api";

interface DrawingCanvasProps {
  strokes: Stroke[];
  isDrawer: boolean;
  onStroke: (points: StrokePoint[]) => void;
  onClear: () => void;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 450;

function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const stroke of strokes) {
    if (stroke.length === 0) continue;

    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);

    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x, stroke[i].y);
    }

    ctx.stroke();
  }
}

export function DrawingCanvas({ strokes, isDrawer, onStroke, onClear }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStrokeRef = useRef<StrokePoint[]>([]);
  const isDrawingRef = useRef(false);

  // Redraw whenever strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawStrokes(ctx, strokes);
  }, [strokes]);

  const getPoint = useCallback((event: React.MouseEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }, []);

  function handleMouseDown(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawer) return;
    isDrawingRef.current = true;
    currentStrokeRef.current = [getPoint(event)];
  }

  function handleMouseMove(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawer || !isDrawingRef.current) return;

    const point = getPoint(event);
    currentStrokeRef.current.push(point);

    // Live preview: draw current stroke on top of existing strokes
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawStrokes(ctx, strokes);
    if (currentStrokeRef.current.length > 1) {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(currentStrokeRef.current[0].x, currentStrokeRef.current[0].y);
      for (let i = 1; i < currentStrokeRef.current.length; i++) {
        ctx.lineTo(currentStrokeRef.current[i].x, currentStrokeRef.current[i].y);
      }
      ctx.stroke();
    }
  }

  function handleMouseUp() {
    if (!isDrawer || !isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentStrokeRef.current.length > 0) {
      onStroke(currentStrokeRef.current);
    }

    currentStrokeRef.current = [];
  }

  function handleMouseLeave() {
    if (!isDrawer || !isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentStrokeRef.current.length > 0) {
      onStroke(currentStrokeRef.current);
    }

    currentStrokeRef.current = [];
  }

  return (
    <div className="drawing-canvas-container">
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          cursor: isDrawer ? "crosshair" : "default",
          border: "1px solid #e5e7eb",
          backgroundColor: "#ffffff",
          width: "100%",
          maxWidth: `${CANVAS_WIDTH}px`,
          display: "block"
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      {isDrawer && (
        <div className="button-row button-row--compact" style={{ marginTop: "8px" }}>
          <button
            className="button button--secondary button--small"
            type="button"
            onClick={onClear}
          >
            Clear Canvas
          </button>
        </div>
      )}
    </div>
  );
}
