
import React, { useState, useCallback } from 'react';
import Header from './components/Header.tsx';
import CanvasEditor from './components/CanvasEditor.tsx';
import Controls from './components/Controls.tsx';
import { ToolMode, AppState } from './types.ts';
import { removeObject } from './services/geminiService.ts';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    originalImage: null,
    currentImage: null,
    maskDataUrl: null,
    history: [],
    isProcessing: false,
    brushSize: 42,
    toolMode: ToolMode.BRUSH,
    showOriginal: false
  });

  const [redoStack, setRedoStack] = useState<string[]>([]);

  const compositeSurgicalResult = (originalSrc: string, aiResultSrc: string, maskSrc: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const originalImg = new Image();
      const aiImg = new Image();
      const maskImg = new Image();

      let loadedCount = 0;
      const onImageLoaded = () => {
        loadedCount++;
        if (loadedCount === 3) {
          const canvas = document.createElement('canvas');
          canvas.width = originalImg.width;
          canvas.height = originalImg.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject("Failed to get context");

          const maskProcCanvas = document.createElement('canvas');
          maskProcCanvas.width = originalImg.width;
          maskProcCanvas.height = originalImg.height;
          const mCtx = maskProcCanvas.getContext('2d');
          if (!mCtx) return reject("Mask context error");
          
          mCtx.drawImage(maskImg, 0, 0, originalImg.width, originalImg.height);
          const maskData = mCtx.getImageData(0, 0, maskProcCanvas.width, maskProcCanvas.height);
          const pixels = maskData.data;
          
          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i+1];
            const b = pixels[i+2];
            const avg = (r + g + b) / 3;
            pixels[i+3] = avg; 
          }
          mCtx.putImageData(maskData, 0, 0);

          ctx.drawImage(originalImg, 0, 0);

          const finalOverlayCanvas = document.createElement('canvas');
          finalOverlayCanvas.width = originalImg.width;
          finalOverlayCanvas.height = originalImg.height;
          const fCtx = finalOverlayCanvas.getContext('2d');
          if (!fCtx) return reject("Final overlay error");

          fCtx.drawImage(aiImg, 0, 0, originalImg.width, originalImg.height);
          fCtx.globalCompositeOperation = 'destination-in';
          fCtx.drawImage(maskProcCanvas, 0, 0);

          ctx.drawImage(finalOverlayCanvas, 0, 0);

          resolve(canvas.toDataURL('image/png'));
        }
      };

      originalImg.onload = onImageLoaded;
      aiImg.onload = onImageLoaded;
      maskImg.onload = onImageLoaded;
      
      originalImg.src = originalSrc;
      aiImg.src = aiResultSrc;
      maskImg.src = maskSrc;

      originalImg.onerror = reject;
      aiImg.onerror = reject;
      maskImg.onerror = reject;
    });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setState(prev => ({
        ...prev,
        originalImage: dataUrl,
        currentImage: dataUrl,
        maskDataUrl: null,
        history: [dataUrl]
      }));
      setRedoStack([]);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateMask = useCallback((maskDataUrl: string) => {
    setState(prev => ({ ...prev, maskDataUrl }));
  }, []);

  const handleRemove = async () => {
    if (!state.currentImage || !state.maskDataUrl || state.isProcessing) return;

    const currentOriginal = state.currentImage;
    const currentMask = state.maskDataUrl;

    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      const aiResultRaw = await removeObject(currentOriginal, currentMask);
      const finalCompositedResult = await compositeSurgicalResult(currentOriginal, aiResultRaw, currentMask);

      setState(prev => ({
        ...prev,
        currentImage: finalCompositedResult,
        maskDataUrl: null,
        isProcessing: false,
        history: [...prev.history, finalCompositedResult]
      }));
      setRedoStack([]);
    } catch (error: any) {
      console.error("Removal process error:", error);
      // Show the actual error message so the user knows exactly why it failed
      alert(`AI Processing Error: ${error.message || "An unexpected error occurred."}`);
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleUndo = () => {
    if (state.history.length <= 1) return;

    const newHistory = [...state.history];
    const undoneImage = newHistory.pop()!;
    setRedoStack(prev => [undoneImage, ...prev]);

    setState(prev => ({
      ...prev,
      currentImage: newHistory[newHistory.length - 1],
      history: newHistory,
      maskDataUrl: null
    }));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const newRedoStack = [...redoStack];
    const redoneImage = newRedoStack.shift()!;
    setRedoStack(newRedoStack);

    setState(prev => ({
      ...prev,
      currentImage: redoneImage,
      history: [...prev.history, redoneImage],
      maskDataUrl: null
    }));
  };

  const handleSave = () => {
    if (!state.currentImage) return;
    const link = document.createElement('a');
    link.href = state.currentImage;
    link.download = `cleaned-photo-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="bg-background-dark h-screen flex flex-col overflow-hidden text-white selection:bg-primary selection:text-black">
      <Header 
        onSave={handleSave} 
        canSave={!!state.currentImage} 
        onUpload={handleUpload}
      />

      <main className="flex-1 relative w-full flex flex-col items-center justify-center overflow-hidden">
        <CanvasEditor 
          imageUrl={state.currentImage}
          maskUrl={state.maskDataUrl}
          brushSize={state.brushSize}
          toolMode={state.toolMode}
          showOriginal={state.showOriginal}
          originalImage={state.originalImage}
          onUpdateMask={handleUpdateMask}
          onUpload={handleUpload}
          isProcessing={state.isProcessing}
        />

        {state.currentImage && state.originalImage !== state.currentImage && !state.isProcessing && (
          <div className="absolute bottom-6 z-10 w-full flex justify-center px-4">
            <button 
              onMouseDown={() => setState(prev => ({ ...prev, showOriginal: true }))}
              onMouseUp={() => setState(prev => ({ ...prev, showOriginal: false }))}
              onMouseLeave={() => setState(prev => ({ ...prev, showOriginal: false }))}
              onTouchStart={() => setState(prev => ({ ...prev, showOriginal: true }))}
              onTouchEnd={() => setState(prev => ({ ...prev, showOriginal: false }))}
              className="group flex min-w-[140px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-10 px-5 bg-surface-dark/90 backdrop-blur-md text-white border border-white/10 hover:bg-surface-dark transition-all active:scale-95 shadow-lg"
            >
              <span className={`material-symbols-outlined mr-2 text-[20px] transition-colors ${state.showOriginal ? 'text-primary' : 'group-hover:text-primary'}`}>
                {state.showOriginal ? 'visibility_off' : 'visibility'}
              </span>
              <span className="text-sm font-bold tracking-wide uppercase text-[10px]">Compare Original</span>
            </button>
          </div>
        )}
      </main>

      <Controls 
        brushSize={state.brushSize}
        onBrushSizeChange={(size) => setState(prev => ({ ...prev, brushSize: size }))}
        toolMode={state.toolMode}
        onToolModeChange={(mode) => setState(prev => ({ ...prev, toolMode: mode }))}
        onRemove={handleRemove}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={state.history.length > 1}
        canRedo={redoStack.length > 0}
        isProcessing={state.isProcessing}
        hasImage={!!state.currentImage}
        hasMask={!!state.maskDataUrl}
      />
    </div>
  );
};

export default App;
