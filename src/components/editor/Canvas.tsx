import { useRef, useEffect } from "react";
import fabric from "fabric";
import { useEditorStore } from "@/store/editorStore";

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const clips = useEditorStore((s) => s.clips);
  const currentTime = useEditorStore((s) => s.playback.currentTime);

  useEffect(() => {
    if (canvasRef.current) {
      fabricRef.current = new fabric.Canvas(canvasRef.current, {
        width: 1280,
        height: 720,
      });
    }
    return () => {
      fabricRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.clear();

    const activeStickers = clips.filter(
      (c) =>
        c.type === "sticker" &&
        currentTime >= c.startTime &&
        currentTime < c.startTime + c.duration
    );

    activeStickers.forEach((sticker) => {
      if (sticker.metadata?.text) {
        const text = new fabric.Text(sticker.metadata.text as string, {
          left: sticker.transforms?.x ?? 0,
          top: sticker.transforms?.y ?? 0,
          fontSize: 60,
          fill: "white",
        });
        canvas.add(text);
      }
    });

    canvas.renderAll();
  }, [clips, currentTime]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full object-contain"
    />
  );
}