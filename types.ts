
export interface Point {
  x: number;
  y: number;
}

export interface DrawingAction {
  points: Point[];
  brushSize: number;
  mode: ToolMode;
}

export enum ToolMode {
  BRUSH = 'BRUSH',
  ERASER = 'ERASER',
  PAN = 'PAN'
}

export interface AppState {
  originalImage: string | null;
  currentImage: string | null;
  maskDataUrl: string | null;
  history: string[];
  isProcessing: boolean;
  brushSize: number;
  toolMode: ToolMode;
  showOriginal: boolean;
}
