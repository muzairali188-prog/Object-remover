
import React from 'react';
import { ToolMode } from '../types.ts';

interface ControlsProps {
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  toolMode: ToolMode;
  onToolModeChange: (mode: ToolMode) => void;
  onRemove: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isProcessing: boolean;
  hasImage: boolean;
  hasMask: boolean;
  cooldownRemaining?: number;
}

const Controls: React.FC<ControlsProps> = ({
  brushSize,
  onBrushSizeChange,
  toolMode,
  onToolModeChange,
  onRemove,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isProcessing,
  hasImage,
  hasMask,
  cooldownRemaining = 0
}) => {
  if (!hasImage) return null;

  const isLocked = isProcessing || cooldownRemaining > 0;

  return (
    <footer className="relative z-50 bg-background-dark/95 backdrop-blur-3xl border-t border-white/5 pb-12 pt-6 px-6 animate-in slide-in-from-bottom duration-700">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4 bg-surface-dark/30 p-4 rounded-2xl border border-white/5 shadow-inner">
               <button 
                 onClick={() => onBrushSizeChange(Math.max(5, brushSize - 5))}
                 className="size-10 flex items-center justify-center rounded-xl bg-white/5 text-white/40 hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
                 title="Decrease size"
               >
                 <span className="material-symbols-outlined text-[20px]">remove</span>
               </button>

               <div className="flex-1 relative flex items-center group h-10 px-2">
                  <div className="absolute inset-x-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary/20 to-primary transition-all duration-300 shadow-[0_0_15px_rgba(48,232,122,0.3)]" 
                      style={{ width: `${((brushSize - 5) / (120 - 5)) * 100}%` }}
                    ></div>
                  </div>
                  
                  <div 
                    className="absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 -top-12 left-1/2 -translate-x-1/2"
                    style={{ left: `calc(${((brushSize - 5) / (120 - 5)) * 100}% )` }}
                  >
                    <div 
                      className="rounded-full border border-primary/40 bg-primary/10 shadow-[0_0_20px_rgba(48,232,122,0.2)] flex items-center justify-center"
                      style={{ width: Math.max(20, brushSize / 2), height: Math.max(20, brushSize / 2) }}
                    >
                      <div className="size-1 bg-primary rounded-full"></div>
                    </div>
                  </div>

                  <input 
                      type="range"
                      min="5"
                      max="120"
                      value={brushSize}
                      onChange={(e) => onBrushSizeChange(parseInt(e.target.value))}
                      className="relative w-full h-full bg-transparent appearance-none cursor-pointer z-10 
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-5 
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white 
                        [&::-webkit-slider-thumb]:shadow-[0_0_15px_rgba(255,255,255,0.5)]
                        [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:transition-transform
                        [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
                  />
               </div>

               <button 
                 onClick={() => onBrushSizeChange(Math.min(120, brushSize + 5))}
                 className="size-10 flex items-center justify-center rounded-xl bg-white/5 text-white/40 hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
                 title="Increase size"
               >
                 <span className="material-symbols-outlined text-[20px]">add</span>
               </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-4 flex bg-surface-dark/50 p-1 rounded-2xl border border-white/5 shadow-inner">
              <button 
                onClick={() => onToolModeChange(ToolMode.BRUSH)}
                title="Brush Tool"
                disabled={isProcessing}
                className={`flex-1 h-12 flex items-center justify-center rounded-xl transition-all duration-500 ${toolMode === ToolMode.BRUSH ? 'bg-primary text-background-dark shadow-[0_0_20px_rgba(48,232,122,0.4)]' : 'text-white/30 hover:text-white hover:bg-white/5'}`}
              >
                <span className="material-symbols-outlined text-[22px] filled">draw</span>
              </button>
              <button 
                onClick={() => onToolModeChange(ToolMode.ERASER)}
                title="Eraser Tool"
                disabled={isProcessing}
                className={`flex-1 h-12 flex items-center justify-center rounded-xl transition-all duration-500 ${toolMode === ToolMode.ERASER ? 'bg-primary text-background-dark shadow-[0_0_20px_rgba(48,232,122,0.4)]' : 'text-white/30 hover:text-white hover:bg-white/5'}`}
              >
                <span className="material-symbols-outlined text-[22px]">ink_eraser</span>
              </button>
              <button 
                onClick={() => onToolModeChange(ToolMode.PAN)}
                title="Navigation Tool"
                disabled={isProcessing}
                className={`flex-1 h-12 flex items-center justify-center rounded-xl transition-all duration-500 ${toolMode === ToolMode.PAN ? 'bg-primary text-background-dark shadow-[0_0_20px_rgba(48,232,122,0.4)]' : 'text-white/30 hover:text-white hover:bg-white/5'}`}
              >
                <span className="material-symbols-outlined text-[22px]">pan_tool</span>
              </button>
            </div>

            <div className="col-span-5 flex justify-center">
              <button 
                onClick={onRemove}
                disabled={!hasMask || isLocked}
                className={`relative w-full h-14 flex items-center justify-center rounded-2xl transition-all duration-500 overflow-hidden group ${
                  hasMask && !isLocked 
                  ? 'bg-primary text-background-dark shadow-[0_10px_30px_rgba(48,232,122,0.3)] hover:shadow-[0_15px_40px_rgba(48,232,122,0.5)] hover:-translate-y-1' 
                  : 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'
                }`}
              >
                {cooldownRemaining > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">API Cooldown: {cooldownRemaining}s</span>
                  </div>
                ) : (
                  <>
                    {hasMask && !isProcessing && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none opacity-50"></div>
                    )}
                    
                    <span className="material-symbols-outlined text-[26px] group-hover:rotate-12 transition-transform">magic_button</span>

                    {hasMask && !isProcessing && (
                      <div className="absolute top-2 right-2 size-2 bg-background-dark/20 rounded-full animate-ping"></div>
                    )}
                  </>
                )}
              </button>
            </div>

            <div className="col-span-3 flex bg-surface-dark/50 p-1 rounded-2xl border border-white/5 shadow-inner">
              <button 
                onClick={onUndo}
                disabled={!canUndo || isProcessing}
                className={`flex-1 h-12 flex items-center justify-center rounded-xl transition-all ${canUndo ? 'text-white/60 hover:text-primary hover:bg-primary/5 active:scale-90' : 'text-white/10 cursor-not-allowed'}`}
                title="Undo"
              >
                <span className="material-symbols-outlined text-[22px]">undo</span>
              </button>
              <button 
                onClick={onRedo}
                disabled={!canRedo || isProcessing}
                className={`flex-1 h-12 flex items-center justify-center rounded-xl transition-all ${canRedo ? 'text-white/60 hover:text-primary hover:bg-primary/5 active:scale-90' : 'text-white/10 cursor-not-allowed'}`}
                title="Redo"
              >
                <span className="material-symbols-outlined text-[22px]">redo</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Controls;
