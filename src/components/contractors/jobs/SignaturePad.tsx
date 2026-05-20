import { useRef, useState } from 'react';

interface SignaturePadProps {
  onChange?: (dataUrl: string) => void;
}

export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);

  const position = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const point = position(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    setDrawing(true);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!drawing || !canvas || !context) return;
    const point = position(event);
    context.lineTo(point.x, point.y);
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.strokeStyle = '#0A1628';
    context.stroke();
  };

  const end = () => {
    setDrawing(false);
    const dataUrl = canvasRef.current?.toDataURL('image/png');
    if (dataUrl) onChange?.(dataUrl);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    onChange?.('');
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={720}
        height={220}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="h-44 w-full touch-none rounded-lg border border-slate-300 bg-white"
      />
      <button type="button" onClick={clear} className="mt-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Clear</button>
    </div>
  );
}

export default SignaturePad;
