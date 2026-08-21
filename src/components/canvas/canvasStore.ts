import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  CanvasTool, 
  ShapeType, 
  DrawingStroke, 
  ShapeElement, 
  TextElement, 
  CanvasHistoryItem 
} from './drawingTypes';

interface CanvasState {
  isOpen: boolean;
  tool: CanvasTool;
  shape: ShapeType;
  color: string;
  size: number;
  strokes: DrawingStroke[];
  shapes: ShapeElement[];
  texts: TextElement[];
  history: CanvasHistoryItem[];
  redoStack: CanvasHistoryItem[];
  
  // Actions
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setTool: (tool: CanvasTool) => void;
  setShape: (shape: ShapeType) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  setStrokes: (strokes: DrawingStroke[] | ((prev: DrawingStroke[]) => DrawingStroke[])) => void;
  setShapes: (shapes: ShapeElement[] | ((prev: ShapeElement[]) => ShapeElement[])) => void;
  setTexts: (texts: TextElement[] | ((prev: TextElement[]) => TextElement[])) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  
  // Callbacks for save and snip triggers
  onSaveTrigger?: () => void;
  onSnipTrigger?: () => void;
  registerSaveTrigger: (fn: () => void) => void;
  registerSnipTrigger: (fn: () => void) => void;
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      tool: 'pen',
      shape: 'rectangle',
      color: '#06b6d4', // Electric Cyan
      size: 5,
      strokes: [],
      shapes: [],
      texts: [],
      history: [],
      redoStack: [],

      setOpen: (open) => set({ isOpen: open }),
      toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
      setTool: (tool) => set({ tool }),
      setShape: (shape) => set({ shape }),
      setColor: (color) => set({ color }),
      setSize: (size) => set({ size }),

      setStrokes: (action) => set((s) => ({
        strokes: typeof action === 'function' ? action(s.strokes) : action
      })),

      setShapes: (action) => set((s) => ({
        shapes: typeof action === 'function' ? action(s.shapes) : action
      })),

      setTexts: (action) => set((s) => ({
        texts: typeof action === 'function' ? action(s.texts) : action
      })),

      pushHistory: () => {
        const { strokes, shapes, texts, history } = get();
        set({
          history: [...history, { strokes: [...strokes], shapes: [...shapes], texts: [...texts] }],
          redoStack: []
        });
      },

      undo: () => {
        const { history, strokes, shapes, texts, redoStack } = get();
        if (history.length === 0) return;
        const last = history[history.length - 1];
        set({
          redoStack: [...redoStack, { strokes, shapes, texts }],
          strokes: last.strokes,
          shapes: last.shapes,
          texts: last.texts,
          history: history.slice(0, -1)
        });
      },

      redo: () => {
        const { redoStack, strokes, shapes, texts, history } = get();
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        set({
          history: [...history, { strokes, shapes, texts }],
          strokes: next.strokes,
          shapes: next.shapes,
          texts: next.texts,
          redoStack: redoStack.slice(0, -1)
        });
      },

      clear: () => {
        const { strokes, shapes, texts } = get();
        if (strokes.length === 0 && shapes.length === 0 && texts.length === 0) return;
        get().pushHistory();
        set({ strokes: [], shapes: [], texts: [] });
      },

      registerSaveTrigger: (fn) => set({ onSaveTrigger: fn }),
      registerSnipTrigger: (fn) => set({ onSnipTrigger: fn }),
    }),
    {
      name: 'floatgpt-canvas-storage',
      // We do not want to persist functions, but zustand/persist handles them by ignoring them in JSON
    }
  )
);
