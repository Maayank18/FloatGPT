import React, { useState, useRef, useEffect } from 'react';
import { 
  MousePointer, 
  PenTool, 
  Highlighter, 
  Square, 
  Circle, 
  ArrowUpRight, 
  Minus, 
  Type, 
  Eraser, 
  Undo2, 
  Redo2, 
  Trash2, 
  Download, 
  Crop, 
  X, 
  ChevronUp
} from 'lucide-react';
import { useCanvasStore } from './canvasStore';
import { ShapeType, PRESET_COLORS, STROKE_SIZES } from './drawingTypes';

interface CanvasToolbarProps {
  className?: string;
  onClose?: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({ className = '', onClose }) => {
  const {
    tool,
    setTool,
    shape,
    setShape,
    color,
    setColor,
    size,
    setSize,
    history,
    redoStack,
    undo,
    redo,
    clear,
    setOpen,
    onSaveTrigger,
    onSnipTrigger
  } = useCanvasStore();

  const [showShapePicker, setShowShapePicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);

  const toolbarRef = useRef<HTMLDivElement>(null);

  const canUndo = history.length > 0;
  const canRedo = redoStack.length > 0;

  // Close all dropdowns when clicking outside the toolbar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowShapePicker(false);
        setShowColorPicker(false);
        setShowSizePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClose = () => {
    if (onClose) onClose();
    else setOpen(false);
  };

  const closeAllPickers = () => {
    setShowShapePicker(false);
    setShowColorPicker(false);
    setShowSizePicker(false);
  };

  const renderShapeIcon = (type: ShapeType) => {
    switch (type) {
      case 'rectangle': return <Square className="w-3.5 h-3.5" />;
      case 'circle': return <Circle className="w-3.5 h-3.5" />;
      case 'arrow': return <ArrowUpRight className="w-3.5 h-3.5" />;
      case 'line': return <Minus className="w-3.5 h-3.5" />;
    }
  };

  /**
   * Wrapper that prevents ALL pointer/mouse events from propagating
   * to the parent (FloatingAssistant drag handler, ScreenCanvas drawing handler).
   * This is the single chokepoint that isolates toolbar interactions.
   */
  const stopAll = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      ref={toolbarRef}
      className={`select-none flex items-center flex-nowrap shrink-0 w-fit shadow-xl rounded-2xl border border-card-border bg-panel/95 backdrop-blur-xl px-2 py-1 gap-1 electron-no-drag ${className}`}
      style={{ pointerEvents: 'auto' }}
      // Block ALL event types from escaping the toolbar
      onPointerDown={stopAll}
      onMouseDown={stopAll}
      onClick={stopAll}
    >
      {/* ─── Drawing Tools ─────────────────────────────── */}

      {/* Pointer / Pass-Through Mode */}
      <button
        onClick={() => { closeAllPickers(); setTool('pointer'); }}
        className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
          tool === 'pointer'
            ? 'bg-accent text-white shadow-sm ring-1 ring-accent/30'
            : 'text-text-muted hover:text-text-primary hover:bg-card-border/40'
        }`}
        title="Pointer Mode (Interact with window)"
      >
        <MousePointer className="w-3.5 h-3.5" />
      </button>

      {/* Pen */}
      <button
        onClick={() => { closeAllPickers(); setTool('pen'); }}
        className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
          tool === 'pen'
            ? 'bg-accent text-white shadow-sm ring-1 ring-accent/30'
            : 'text-text-muted hover:text-text-primary hover:bg-card-border/40'
        }`}
        title="Pen (P)"
      >
        <PenTool className="w-3.5 h-3.5" />
      </button>

      {/* Highlighter */}
      <button
        onClick={() => { closeAllPickers(); setTool('highlighter'); }}
        className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
          tool === 'highlighter'
            ? 'bg-amber-500 text-black shadow-sm ring-1 ring-amber-400/40'
            : 'text-text-muted hover:text-text-primary hover:bg-card-border/40'
        }`}
        title="Highlighter (H)"
      >
        <Highlighter className="w-3.5 h-3.5" />
      </button>

      {/* Shapes Dropdown — opens UPWARD to avoid clipping */}
      <div className="relative">
        <button
          onClick={() => {
            setTool('shape');
            setShowShapePicker(!showShapePicker);
            setShowColorPicker(false);
            setShowSizePicker(false);
          }}
          className={`p-1.5 rounded-lg transition-all flex items-center gap-0.5 ${
            tool === 'shape'
              ? 'bg-accent text-white shadow-sm ring-1 ring-accent/30'
              : 'text-text-muted hover:text-text-primary hover:bg-card-border/40'
          }`}
          title="Shapes (S)"
        >
          {renderShapeIcon(shape)}
          <ChevronUp className="w-2.5 h-2.5 opacity-60" />
        </button>

        {showShapePicker && (
          <div className="absolute left-0 bottom-full mb-1.5 p-1 bg-panel/95 backdrop-blur-xl border border-card-border rounded-xl shadow-xl flex flex-col gap-0.5 z-[10020] min-w-[90px]">
            {(['rectangle', 'circle', 'arrow', 'line'] as ShapeType[]).map((sh) => (
              <button
                key={sh}
                onClick={() => {
                  setShape(sh);
                  setTool('shape');
                  setShowShapePicker(false);
                }}
                className={`flex items-center gap-2 px-2 py-1 text-xs rounded-lg transition-colors capitalize ${
                  shape === sh && tool === 'shape'
                    ? 'bg-accent/20 text-accent font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-card-border/40'
                }`}
              >
                {renderShapeIcon(sh)}
                <span className="text-[11px]">{sh}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Text */}
      <button
        onClick={() => { closeAllPickers(); setTool('text'); }}
        className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
          tool === 'text'
            ? 'bg-accent text-white shadow-sm ring-1 ring-accent/30'
            : 'text-text-muted hover:text-text-primary hover:bg-card-border/40'
        }`}
        title="Text Note (T)"
      >
        <Type className="w-3.5 h-3.5" />
      </button>

      {/* Eraser */}
      <button
        onClick={() => { closeAllPickers(); setTool('eraser'); }}
        className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
          tool === 'eraser'
            ? 'bg-rose-500 text-white shadow-sm'
            : 'text-text-muted hover:text-text-primary hover:bg-card-border/40'
        }`}
        title="Eraser (E)"
      >
        <Eraser className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-4 bg-card-border/60 mx-0.5" />

      {/* ─── Settings ──────────────────────────────────── */}

      {/* Color Dot Picker — opens UPWARD */}
      <div className="relative">
        <button
          onClick={() => {
            setShowColorPicker(!showColorPicker);
            setShowShapePicker(false);
            setShowSizePicker(false);
          }}
          className="p-1 rounded-lg border border-card-border hover:border-text-muted transition-all flex items-center justify-center"
          title="Color Palette"
        >
          <div 
            className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-inner"
            style={{ backgroundColor: color }}
          />
        </button>

        {showColorPicker && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 p-1.5 bg-panel/95 backdrop-blur-xl border border-card-border rounded-xl shadow-2xl grid grid-cols-4 gap-1.5 z-[10020] min-w-[120px]">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  setColor(c.value);
                  setShowColorPicker(false);
                }}
                className={`w-5 h-5 rounded-full border transition-all ${
                  color === c.value
                    ? 'border-accent ring-2 ring-accent/40 scale-110'
                    : 'border-card-border/60 hover:scale-105'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stroke Size — opens UPWARD */}
      <div className="relative">
        <button
          onClick={() => {
            setShowSizePicker(!showSizePicker);
            setShowShapePicker(false);
            setShowColorPicker(false);
          }}
          className="px-1.5 py-1 rounded-lg border border-card-border text-[10px] font-semibold text-text-primary hover:border-text-muted transition-all flex items-center gap-1"
          title="Brush Size"
        >
          <span>{size}px</span>
        </button>

        {showSizePicker && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 p-1 bg-panel/95 backdrop-blur-xl border border-card-border rounded-xl shadow-xl flex flex-col gap-0.5 z-[10020] min-w-[80px]">
            {STROKE_SIZES.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  setSize(s.value);
                  setShowSizePicker(false);
                }}
                className={`flex items-center justify-between px-2 py-1 text-[11px] rounded-lg transition-colors ${
                  size === s.value
                    ? 'bg-accent/20 text-accent font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-card-border/40'
                }`}
              >
                <span>{s.label}</span>
                <span className="text-[9px] opacity-60">{s.value}px</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-card-border/60 mx-0.5" />

      {/* ─── Actions ───────────────────────────────────── */}

      {/* Undo */}
      <button
        onClick={() => undo()}
        disabled={!canUndo}
        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-card-border/40 disabled:opacity-30 disabled:pointer-events-none transition-all"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="w-3.5 h-3.5" />
      </button>

      {/* Redo */}
      <button
        onClick={() => redo()}
        disabled={!canRedo}
        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-card-border/40 disabled:opacity-30 disabled:pointer-events-none transition-all"
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="w-3.5 h-3.5" />
      </button>

      {/* Clear */}
      <button
        onClick={() => clear()}
        className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-all"
        title="Clear All (C)"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Snip / Camera */}
      <button
        onClick={() => {
          setTool('snip');
          if (onSnipTrigger) onSnipTrigger();
        }}
        className={`p-1.5 rounded-lg transition-all ${
          tool === 'snip'
            ? 'bg-accent text-white shadow-sm'
            : 'text-text-muted hover:text-text-primary hover:bg-card-border/40'
        }`}
        title="Snip / Crop Selection"
      >
        <Crop className="w-3.5 h-3.5" />
      </button>

      {/* Save PNG */}
      <button
        onClick={() => {
          if (onSaveTrigger) onSaveTrigger();
        }}
        className="p-1.5 rounded-lg text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
        title="Export Canvas PNG"
      >
        <Download className="w-3.5 h-3.5" />
      </button>

      {/* Close Button */}
      <button
        onClick={handleClose}
        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors ml-0.5"
        title="Exit Canvas (Esc)"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
