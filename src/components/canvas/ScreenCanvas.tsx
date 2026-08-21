import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from './canvasStore';
import { 
  ShapeType, 
  Point 
} from './drawingTypes';
import { getStroke } from 'perfect-freehand';

const getSvgPathFromStroke = (stroke: number[][]) => {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );
  d.push('Z');
  return d.join(' ');
};

const drawFreehandStroke = (ctx: CanvasRenderingContext2D, points: Point[], color: string, size: number, tool: string) => {
  if (points.length < 2) return;
  const isHighlighter = tool === 'highlighter';
  const isEraser = tool === 'eraser';
  
  const strokeOutline = getStroke(
    points.map(p => [p.x, p.y]),
    {
      size: isHighlighter ? size * 3 : size,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    }
  );
  
  const pathData = getSvgPathFromStroke(strokeOutline as number[][]);
  const path = new Path2D(pathData);
  
  ctx.fillStyle = isHighlighter ? `${color}66` : color;
  ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
  ctx.fill(path);
};

export const ScreenCanvas: React.FC = () => {
  const {
    isOpen,
    tool,
    shape,
    color,
    size,
    strokes,
    shapes,
    texts,
    setStrokes,
    setShapes,
    setTexts,
    pushHistory,
    undo,
    redo,
    clear,
    setOpen,
    setTool,
    registerSaveTrigger,
    registerSnipTrigger
  } = useCanvasStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active interaction states (using refs for 60fps performance without React re-renders)
  const isDrawing = useRef(false);
  const currentStroke = useRef<Point[]>([]);
  const shapeStart = useRef<Point | null>(null);
  const shapeCurrent = useRef<Point | null>(null);

  // Snip Tool Selection Box
  const [snipStart, setSnipStart] = useState<Point | null>(null);
  const [snipCurrent, setSnipCurrent] = useState<Point | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Text Annotation placement
  const [activeTextInput, setActiveTextInput] = useState<{ x: number; y: number; text: string } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing inside text input
      if (activeTextInput) {
        if (e.key === 'Escape') setActiveTextInput(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'Escape') {
        if (tool !== 'pointer') setTool('pointer');
        else setOpen(false);
      } else if (e.key.toLowerCase() === 'p') {
        setTool('pen');
      } else if (e.key.toLowerCase() === 'h') {
        setTool('highlighter');
      } else if (e.key.toLowerCase() === 's') {
        setTool('shape');
      } else if (e.key.toLowerCase() === 't') {
        setTool('text');
      } else if (e.key.toLowerCase() === 'e') {
        setTool('eraser');
      } else if (e.key.toLowerCase() === 'c') {
        clear();
        showToast("Canvas cleared");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTextInput, undo, redo, clear, tool, setTool, setOpen]);

  // Resize canvas with High-DPI support
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, [isOpen, resizeCanvas]);

  // Main Canvas Render Loop
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // 1. Draw saved strokes
    strokes.forEach(s => {
      drawFreehandStroke(ctx, s.points, s.color, s.size, s.tool);
    });

    // 2. Draw saved shapes
    ctx.globalCompositeOperation = 'source-over';
    shapes.forEach(sh => {
      drawSingleShape(ctx, sh.shapeType, sh.startPoint, sh.endPoint, sh.color, sh.size);
    });

    // 3. Draw saved text annotations
    texts.forEach(txt => {
      ctx.font = `600 ${txt.fontSize}px sans-serif`;
      ctx.fillStyle = txt.color;
      ctx.fillText(txt.text, txt.x, txt.y);
    });

    // 4. Draw active in-progress stroke
    if (isDrawing.current && currentStroke.current.length > 1) {
      drawFreehandStroke(ctx, currentStroke.current, color, size, tool);
    }

    // 5. Draw active in-progress shape preview
    if (tool === 'shape' && isDrawing.current && shapeStart.current && shapeCurrent.current) {
      ctx.globalCompositeOperation = 'source-over';
      drawSingleShape(ctx, shape, shapeStart.current, shapeCurrent.current, color, size, true);
    }

    ctx.restore();
  }, [strokes, shapes, texts, tool, shape, color, size]);

  useEffect(() => {
    if (isOpen) {
      redrawCanvas();
    }
  }, [isOpen, redrawCanvas]);

  // Helper: Draw single shape
  const drawSingleShape = (
    ctx: CanvasRenderingContext2D,
    shapeType: ShapeType,
    start: Point,
    end: Point,
    strokeColor: string,
    strokeSize: number,
    isDraft = false
  ) => {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (isDraft) ctx.setLineDash([6, 6]);
    else ctx.setLineDash([]);

    if (shapeType === 'rectangle') {
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      ctx.strokeRect(x, y, w, h);
    } else if (shapeType === 'circle') {
      const radiusX = Math.abs(end.x - start.x) / 2;
      const radiusY = Math.abs(end.y - start.y) / 2;
      const centerX = Math.min(start.x, end.x) + radiusX;
      const centerY = Math.min(start.y, end.y) + radiusY;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shapeType === 'line') {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (shapeType === 'arrow') {
      const headlen = Math.max(16, strokeSize * 3);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const angle = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };

  // Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'pointer') return;
    const pt: Point = { x: e.clientX, y: e.clientY };

    if (tool === 'text') {
      setActiveTextInput({ x: pt.x, y: pt.y, text: '' });
      return;
    }

    if (tool === 'snip') {
      setSnipStart(pt);
      setSnipCurrent(pt);
      return;
    }

    isDrawing.current = true;

    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
      currentStroke.current = [pt];
    } else if (tool === 'shape') {
      shapeStart.current = pt;
      shapeCurrent.current = pt;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt: Point = { x: e.clientX, y: e.clientY };

    if (tool === 'snip' && snipStart) {
      setSnipCurrent(pt);
      return;
    }

    if (!isDrawing.current) return;

    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
      currentStroke.current.push(pt);
      requestAnimationFrame(redrawCanvas);
    } else if (tool === 'shape') {
      shapeCurrent.current = pt;
      requestAnimationFrame(redrawCanvas);
    }
  };

  const handlePointerUp = () => {
    if (tool === 'snip' && snipStart && snipCurrent) {
      handleCompleteSnip(snipStart, snipCurrent);
      setSnipStart(null);
      setSnipCurrent(null);
      setTool('pointer');
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    if ((tool === 'pen' || tool === 'highlighter' || tool === 'eraser') && currentStroke.current.length > 0) {
      pushHistory();
      setStrokes(prev => [...prev, {
        id: `stroke_${Date.now()}`,
        tool: tool as 'pen' | 'highlighter' | 'eraser',
        color,
        size,
        points: currentStroke.current
      }]);
      currentStroke.current = [];
    } else if (tool === 'shape' && shapeStart.current && shapeCurrent.current) {
      if (Math.abs(shapeCurrent.current.x - shapeStart.current.x) > 3 || Math.abs(shapeCurrent.current.y - shapeStart.current.y) > 3) {
        pushHistory();
        setShapes(prev => [...prev, {
          id: `shape_${Date.now()}`,
          shapeType: shape,
          color,
          size,
          startPoint: shapeStart.current!,
          endPoint: shapeCurrent.current!
        }]);
      }
      shapeStart.current = null;
      shapeCurrent.current = null;
    }
    requestAnimationFrame(redrawCanvas);
  };

  // Snip & Pin Complete Handler
  const handleCompleteSnip = (start: Point, end: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);

    if (w < 10 || h < 10) return;

    try {
      const dpr = window.devicePixelRatio || 1;
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = w * dpr;
      cropCanvas.height = h * dpr;
      const cropCtx = cropCanvas.getContext('2d');
      if (cropCtx) {
        cropCtx.drawImage(
          canvas,
          x * dpr, y * dpr, w * dpr, h * dpr,
          0, 0, w * dpr, h * dpr
        );

        cropCanvas.toBlob((blob) => {
          if (blob && navigator.clipboard && window.ClipboardItem) {
            navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]).then(() => {
              showToast("Cropped snip copied to clipboard!");
            }).catch(() => {
              downloadBlob(blob, `floatgpt-snip-${Date.now()}.png`);
              showToast("Snip saved as PNG");
            });
          }
        }, 'image/png');
      }
    } catch (err) {
      console.warn("Snip error:", err);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Save Full Canvas PNG
  const handleSaveCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, `floatgpt-canvas-${Date.now()}.png`);
        showToast("Full canvas exported to PNG!");
      }
    }, 'image/png');
  }, []);

  useEffect(() => {
    registerSaveTrigger(handleSaveCanvas);
    registerSnipTrigger(() => setTool('snip'));
  }, [registerSaveTrigger, registerSnipTrigger, handleSaveCanvas, setTool]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[90] overflow-hidden select-none"
      style={{ pointerEvents: tool === 'pointer' ? 'none' : 'auto' }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10010] bg-panel/95 border border-card-border px-4 py-2 rounded-xl text-xs font-semibold text-text-primary shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}

      {/* Interactive Drawing Canvas Layer */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="absolute inset-0 w-full h-full"
        style={{
          pointerEvents: tool === 'pointer' ? 'none' : 'auto',
          cursor: tool === 'pointer' ? 'default' : tool === 'eraser' ? 'crosshair' : tool === 'text' ? 'text' : 'crosshair'
        }}
      />

      {/* Active Text Input Callout */}
      {activeTextInput && (
        <div 
          style={{ left: `${activeTextInput.x}px`, top: `${activeTextInput.y}px` }}
          className="absolute z-[10000] -translate-y-1/2"
        >
          <input
            autoFocus
            type="text"
            value={activeTextInput.text}
            onChange={(e) => setActiveTextInput(prev => prev ? { ...prev, text: e.target.value } : null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (activeTextInput.text.trim()) {
                  pushHistory();
                  setTexts(prev => [...prev, {
                    id: `text_${Date.now()}`,
                    x: activeTextInput.x,
                    y: activeTextInput.y,
                    text: activeTextInput.text,
                    color,
                    fontSize: Math.max(16, size * 3.5)
                  }]);
                }
                setActiveTextInput(null);
              } else if (e.key === 'Escape') {
                setActiveTextInput(null);
              }
            }}
            onBlur={() => {
              if (activeTextInput.text.trim()) {
                pushHistory();
                setTexts(prev => [...prev, {
                  id: `text_${Date.now()}`,
                  x: activeTextInput.x,
                  y: activeTextInput.y,
                  text: activeTextInput.text,
                  color,
                  fontSize: Math.max(16, size * 3.5)
                }]);
              }
              setActiveTextInput(null);
            }}
            placeholder="Type note and press Enter..."
            className="bg-panel/95 border border-accent rounded-lg px-3 py-1.5 text-sm font-semibold shadow-2xl focus:outline-none backdrop-blur-md min-w-[200px]"
            style={{ color }}
          />
        </div>
      )}

      {/* Snip Selection Box Overlay */}
      {tool === 'snip' && snipStart && snipCurrent && (
        <div
          style={{
            left: `${Math.min(snipStart.x, snipCurrent.x)}px`,
            top: `${Math.min(snipStart.y, snipCurrent.y)}px`,
            width: `${Math.abs(snipCurrent.x - snipStart.x)}px`,
            height: `${Math.abs(snipCurrent.y - snipStart.y)}px`,
          }}
          className="absolute border-2 border-dashed border-accent bg-accent/10 pointer-events-none z-[10005] rounded shadow-sm"
        />
      )}
    </div>
  );
};
