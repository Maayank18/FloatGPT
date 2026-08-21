export type CanvasTool = 
  | 'pointer' 
  | 'pen' 
  | 'highlighter' 
  | 'shape' 
  | 'text' 
  | 'eraser' 
  | 'snip';

export type ShapeType = 'rectangle' | 'circle' | 'arrow' | 'line';

export interface Point {
  x: number;
  y: number;
}

export interface DrawingStroke {
  id: string;
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  size: number;
  points: Point[];
  opacity?: number;
}

export interface ShapeElement {
  id: string;
  shapeType: ShapeType;
  color: string;
  size: number;
  startPoint: Point;
  endPoint: Point;
  fill?: boolean;
}

export interface TextElement {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export interface CanvasHistoryItem {
  strokes: DrawingStroke[];
  shapes: ShapeElement[];
  texts: TextElement[];
}

export const PRESET_COLORS = [
  { name: 'Electric Cyan', value: '#06b6d4' },
  { name: 'Neon Green', value: '#10b981' },
  { name: 'Highlighter Yellow', value: '#facc15' },
  { name: 'Vibrant Orange', value: '#f97316' },
  { name: 'Crimson Red', value: '#ef4444' },
  { name: 'Cosmic Purple', value: '#a855f7' },
  { name: 'Pure White', value: '#ffffff' },
  { name: 'Deep Black', value: '#18181b' },
];

export const STROKE_SIZES = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 5 },
  { label: 'Thick', value: 12 },
  { label: 'Bold', value: 24 },
];
