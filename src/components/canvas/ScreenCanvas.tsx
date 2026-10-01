import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from './canvasStore';
import { 
  ShapeType, 
  Point 
} from './drawingTypes';
import { getStroke } from 'perfect-freehand';

const drawContext = (canvas: HTMLCanvasElement) => canvas.getContext('2d', { alpha: true, willReadFrequently: true });

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
  ctx.globalCompositeOperation = 'source-over';
  ctx.fill(path);
};

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
    ctx.ellipse(centerX, centerY, Math.max(1, radiusX), Math.max(1, radiusY), 0, 0, Math.PI * 2);
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
    // Arrowhead
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  } else if (shapeType === 'double_arrow') {
    const headlen = Math.max(16, strokeSize * 3);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    // End Arrowhead
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
    // Start Arrowhead
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(start.x + headlen * Math.cos(angle - Math.PI / 6), start.y + headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(start.x + headlen * Math.cos(angle + Math.PI / 6), start.y + headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  } else if (shapeType === 'triangle') {
    const topX = (start.x + end.x) / 2;
    const topY = Math.min(start.y, end.y);
    const botY = Math.max(start.y, end.y);
    const leftX = Math.min(start.x, end.x);
    const rightX = Math.max(start.x, end.x);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(rightX, botY);
    ctx.lineTo(leftX, botY);
    ctx.closePath();
    ctx.stroke();
  } else if (shapeType === 'diamond') {
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const leftX = Math.min(start.x, end.x);
    const rightX = Math.max(start.x, end.x);
    const topY = Math.min(start.y, end.y);
    const botY = Math.max(start.y, end.y);
    ctx.beginPath();
    ctx.moveTo(midX, topY);
    ctx.lineTo(rightX, midY);
    ctx.lineTo(midX, botY);
    ctx.lineTo(leftX, midY);
    ctx.closePath();
    ctx.stroke();
  } else if (shapeType === 'star') {
    const leftX = Math.min(start.x, end.x);
    const topY = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    const cx = leftX + w / 2;
    const cy = topY + h / 2;
    const outerR = Math.max(4, Math.min(w, h) / 2);
    const innerR = outerR * 0.45;
    const spikes = 5;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  } else if (shapeType === 'cloud') {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const w = Math.max(10, maxX - minX);
    const h = Math.max(10, maxY - minY);
    ctx.beginPath();
    ctx.moveTo(minX + w * 0.2, maxY - h * 0.2);
    ctx.bezierCurveTo(minX - w * 0.05, maxY - h * 0.2, minX - w * 0.05, minY + h * 0.4, minX + w * 0.2, minY + h * 0.4);
    ctx.bezierCurveTo(minX + w * 0.1, minY - h * 0.05, minX + w * 0.5, minY - h * 0.05, minX + w * 0.5, minY + h * 0.2);
    ctx.bezierCurveTo(minX + w * 0.6, minY - h * 0.1, maxX + w * 0.05, minY + h * 0.1, maxX - w * 0.1, minY + h * 0.4);
    ctx.bezierCurveTo(maxX + w * 0.1, minY + h * 0.4, maxX + w * 0.1, maxY - h * 0.1, maxX - w * 0.2, maxY - h * 0.2);
    ctx.bezierCurveTo(maxX - w * 0.2, maxY + h * 0.05, minX + w * 0.3, maxY + h * 0.05, minX + w * 0.2, maxY - h * 0.2);
    ctx.closePath();
    ctx.stroke();
  } else if (shapeType === 'speech_bubble') {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const w = Math.max(10, maxX - minX);
    const h = Math.max(10, maxY - minY);
    const r = Math.min(16, w * 0.15, h * 0.15);
    const bodyH = h * 0.8;
    ctx.beginPath();
    ctx.moveTo(minX + r, minY);
    ctx.lineTo(maxX - r, minY);
    ctx.quadraticCurveTo(maxX, minY, maxX, minY + r);
    ctx.lineTo(maxX, minY + bodyH - r);
    ctx.quadraticCurveTo(maxX, minY + bodyH, maxX - r, minY + bodyH);
    // Pointer triangle at bottom left
    ctx.lineTo(minX + w * 0.35, minY + bodyH);
    ctx.lineTo(minX + w * 0.15, maxY);
    ctx.lineTo(minX + w * 0.2, minY + bodyH);
    ctx.lineTo(minX + r, minY + bodyH);
    ctx.quadraticCurveTo(minX, minY + bodyH, minX, minY + bodyH - r);
    ctx.lineTo(minX, minY + r);
    ctx.quadraticCurveTo(minX, minY, minX + r, minY);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);
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
  // High-performance offscreen buffer for past strokes & shapes
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active interaction states (refs for 120fps smooth performance)
  const isDrawing = useRef(false);
  const currentStroke = useRef<Point[]>([]);
  const shapeStart = useRef<Point | null>(null);
  const shapeCurrent = useRef<Point | null>(null);
  const rafPending = useRef(false);

  // Boundary Area Eraser Selection Box
  const [eraserStart, setEraserStart] = useState<Point | null>(null);
  const [eraserCurrent, setEraserCurrent] = useState<Point | null>(null);

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
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.background = 'transparent';
    const ctx = drawContext(canvas);
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Also update/create offscreen buffer
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const offscreen = offscreenCanvasRef.current;
    offscreen.width = w * dpr;
    offscreen.height = h * dpr;
  }, []);

  useEffect(() => {
    if (isOpen) {
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, [isOpen, resizeCanvas]);

  // Bake all static history (strokes, shapes, texts) into offscreen buffer
  const bakeOffscreenBuffer = useCallback(() => {
    const offscreen = offscreenCanvasRef.current;
    if (!offscreen) return;
    const ctx = drawContext(offscreen);
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

    ctx.restore();
  }, [strokes, shapes, texts]);

  // Fast frame renderer: Blits offscreen buffer and paints active preview
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const offscreen = offscreenCanvasRef.current;
    if (!canvas || !offscreen) return;
    const ctx = drawContext(canvas);
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Ultra-fast GPU Blit (< 0.05ms)
    ctx.drawImage(offscreen, 0, 0, window.innerWidth, window.innerHeight);

    // Render active in-progress stroke on top
    if (isDrawing.current && currentStroke.current.length > 1) {
      drawFreehandStroke(ctx, currentStroke.current, color, size, tool);
    }

    // Render active shape preview on top
    if (tool === 'shape' && isDrawing.current && shapeStart.current && shapeCurrent.current) {
      ctx.globalCompositeOperation = 'source-over';
      drawSingleShape(ctx, shape, shapeStart.current, shapeCurrent.current, color, size, true);
    }

    ctx.restore();
  }, [color, size, tool, shape]);

  // Re-bake when store items change
  useEffect(() => {
    if (isOpen) {
      bakeOffscreenBuffer();
      renderFrame();
    }
  }, [isOpen, strokes, shapes, texts, bakeOffscreenBuffer, renderFrame]);

  // Pointer Event Handlers (Hardware-Accelerated 120fps)
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

    if (tool === 'eraser') {
      setEraserStart(pt);
      setEraserCurrent(pt);
      return;
    }

    isDrawing.current = true;

    if (tool === 'pen' || tool === 'highlighter') {
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

    if (tool === 'eraser' && eraserStart) {
      setEraserCurrent(pt);
      return;
    }

    if (!isDrawing.current) return;

    if (tool === 'pen' || tool === 'highlighter') {
      const lastPt = currentStroke.current[currentStroke.current.length - 1];
      // Jitter & point optimization: Skip if moved less than 1.5px
      if (lastPt) {
        const dist = Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y);
        if (dist < 1.5) return;
      }
      currentStroke.current.push(pt);
    } else if (tool === 'shape') {
      shapeCurrent.current = pt;
    }

    // Schedule high-priority RAF without queuing duplicates
    if (!rafPending.current) {
      rafPending.current = true;
      requestAnimationFrame(() => {
        rafPending.current = false;
        renderFrame();
      });
    }
  };

  const handlePointerUp = () => {
    if (tool === 'snip' && snipStart && snipCurrent) {
      handleCompleteSnip(snipStart, snipCurrent);
      setSnipStart(null);
      setSnipCurrent(null);
      setTool('pen');
      return;
    }

    // ─── Area / Boundary Eraser Handler ───
    if (tool === 'eraser' && eraserStart && eraserCurrent) {
      const x1 = Math.min(eraserStart.x, eraserCurrent.x);
      const x2 = Math.max(eraserStart.x, eraserCurrent.x);
      const y1 = Math.min(eraserStart.y, eraserCurrent.y);
      const y2 = Math.max(eraserStart.y, eraserCurrent.y);
      const w = x2 - x1;
      const h = y2 - y1;

      // Expand boundary if tapped without dragging
      const isTap = w < 5 && h < 5;
      const tapRadius = Math.max(20, size * 4);
      const minX = isTap ? x1 - tapRadius : x1;
      const maxX = isTap ? x1 + tapRadius : x2;
      const minY = isTap ? y1 - tapRadius : y1;
      const maxY = isTap ? y1 + tapRadius : y2;

      // 1. Filter out strokes that have points inside the eraser boundary
      const remainingStrokes = strokes.filter(s => {
        const hasPointInside = s.points.some(p => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
        return !hasPointInside;
      });

      // 2. Filter out shapes that intersect the eraser boundary
      const remainingShapes = shapes.filter(sh => {
        const shMinX = Math.min(sh.startPoint.x, sh.endPoint.x);
        const shMaxX = Math.max(sh.startPoint.x, sh.endPoint.x);
        const shMinY = Math.min(sh.startPoint.y, sh.endPoint.y);
        const shMaxY = Math.max(sh.startPoint.y, sh.endPoint.y);
        const overlaps = !(shMaxX < minX || shMinX > maxX || shMaxY < minY || shMinY > maxY);
        return !overlaps;
      });

      // 3. Filter out text inside the eraser boundary
      const remainingTexts = texts.filter(txt => {
        const isInside = (txt.x >= minX - 120 && txt.x <= maxX + 20 && txt.y >= minY - 30 && txt.y <= maxY + 30);
        return !isInside;
      });

      const erasedCount = (strokes.length - remainingStrokes.length) + 
                          (shapes.length - remainingShapes.length) + 
                          (texts.length - remainingTexts.length);

      if (erasedCount > 0) {
        pushHistory();
        setStrokes(remainingStrokes);
        setShapes(remainingShapes);
        setTexts(remainingTexts);
        showToast(`Erased ${erasedCount} object${erasedCount > 1 ? 's' : ''}`);
      }

      setEraserStart(null);
      setEraserCurrent(null);
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    if ((tool === 'pen' || tool === 'highlighter') && currentStroke.current.length > 0) {
      pushHistory();
      const newStroke = {
        id: `stroke_${Date.now()}`,
        tool: tool as 'pen' | 'highlighter',
        color,
        size,
        points: [...currentStroke.current]
      };
      setStrokes(prev => [...prev, newStroke]);
      currentStroke.current = [];
    } else if (tool === 'shape' && shapeStart.current && shapeCurrent.current) {
      if (Math.abs(shapeCurrent.current.x - shapeStart.current.x) > 3 || Math.abs(shapeCurrent.current.y - shapeStart.current.y) > 3) {
        pushHistory();
        const newShape = {
          id: `shape_${Date.now()}`,
          shapeType: shape,
          color,
          size,
          startPoint: shapeStart.current!,
          endPoint: shapeCurrent.current!
        };
        setShapes(prev => [...prev, newShape]);
      }
      shapeStart.current = null;
      shapeCurrent.current = null;
    }
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
        className="absolute inset-0 w-full h-full bg-transparent"
        style={{
          pointerEvents: tool === 'pointer' ? 'none' : 'auto',
          cursor: tool === 'pointer' ? 'default' : tool === 'eraser' ? 'crosshair' : tool === 'text' ? 'text' : 'crosshair'
        }}
      />

      {/* Boundary Eraser Selection Box Overlay */}
      {tool === 'eraser' && eraserStart && eraserCurrent && (
        <div
          style={{
            left: `${Math.min(eraserStart.x, eraserCurrent.x)}px`,
            top: `${Math.min(eraserStart.y, eraserCurrent.y)}px`,
            width: `${Math.abs(eraserCurrent.x - eraserStart.x)}px`,
            height: `${Math.abs(eraserCurrent.y - eraserStart.y)}px`,
          }}
          className="absolute border-2 border-dashed border-rose-500 bg-rose-500/20 pointer-events-none z-[10005] rounded-lg shadow-lg shadow-rose-500/10 flex items-center justify-center"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 bg-black/80 px-2 py-0.5 rounded-full border border-rose-500/40 shadow-sm">
            Erase Area
          </span>
        </div>
      )}

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
