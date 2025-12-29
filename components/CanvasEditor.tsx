
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Point, ToolMode } from '../types';

interface CanvasEditorProps {
  imageUrl: string | null;
  maskUrl: string | null;
  brushSize: number;
  toolMode: ToolMode;
  showOriginal: boolean;
  originalImage: string | null;
  onUpdateMask: (maskDataUrl: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessing: boolean;
}

const CanvasEditor: React.FC<CanvasEditorProps> = ({ 
  imageUrl, 
  maskUrl, 
  brushSize, 
  toolMode, 
  showOriginal, 
  originalImage,
  onUpdateMask,
  onUpload,
  isProcessing
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number, y: number, isOverImage: boolean } | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Initializing neural core...");

  // Update canvas size when image changes
  useEffect(() => {
    if (!imageUrl || !containerRef.current) return;

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      const container = containerRef.current!;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imageAspect = img.width / img.height;
      const containerAspect = containerWidth / containerHeight;

      let dWidth, dHeight;
      const padding = 80;
      if (imageAspect > containerAspect) {
        dWidth = containerWidth - padding;
        dHeight = dWidth / imageAspect;
      } else {
        dHeight = containerHeight - padding;
        dWidth = dHeight * imageAspect;
      }

      setDisplaySize({ width: dWidth, height: dHeight });
      setNaturalSize({ width: img.width, height: img.height });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
  }, [imageUrl]);

  // Sync mask to canvas
  useEffect(() => {
    if (!canvasRef.current || naturalSize.width === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, naturalSize.width, naturalSize.height);

    if (maskUrl) {
      const maskImg = new Image();
      maskImg.src = maskUrl;
      maskImg.onload = () => {
        ctx.drawImage(maskImg, 0, 0, naturalSize.width, naturalSize.height);
      };
    }
  }, [naturalSize, maskUrl]);

  // Rotate loading messages
  useEffect(() => {
    if (!isProcessing) {
      setLoadingMessage("Scanning environment...");
      return;
    }
    const messages = ["Analyzing neural nodes...", "Mapping visual context...", "Synthesizing pixels...", "Refining edge coherence...", "Finalizing reconstruction..."];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setLoadingMessage(messages[i]);
    }, 1800);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const getCanvasCoordinates = (clientX: number, clientY: number): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    // Convert screen coordinates to relative coordinates within the scaled/panned canvas
    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;

    if (normX < 0 || normX > 1 || normY < 0 || normY > 1) return null;

    return {
      x: normX * naturalSize.width,
      y: normY * naturalSize.height
    };
  };

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(Math.max(prev + delta, 1), 5));
    if (zoom + delta <= 1) setOffset({ x: 0, y: 0 });
  };

  const startInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    if (toolMode === ToolMode.PAN) {
      setIsPanning(true);
      setLastPanPoint({ x: clientX, y: clientY });
      return;
    }

    const coords = getCanvasCoordinates(clientX, clientY);
    if (!coords) return;

    setIsDrawing(true);
    setLastPoint(coords);
    
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    }
  };

  const draw = useCallback((currentPoint: Point) => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing || !lastPoint) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Brush size remains consistent relative to the image
    const scaleFactor = naturalSize.width / displaySize.width;
    const actualBrushSize = (brushSize / zoom) * scaleFactor;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = actualBrushSize;
    ctx.strokeStyle = toolMode === ToolMode.BRUSH ? 'white' : 'black';
    ctx.globalCompositeOperation = 'source-over';

    const midPoint = {
      x: (lastPoint.x + currentPoint.x) / 2,
      y: (lastPoint.y + currentPoint.y) / 2
    };

    ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midPoint.x, midPoint.y);
    ctx.stroke();
    
    setLastPoint(currentPoint);
  }, [isDrawing, lastPoint, brushSize, toolMode, naturalSize, displaySize, zoom]);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    if (isPanning && lastPanPoint) {
      const dx = clientX - lastPanPoint.x;
      const dy = clientY - lastPanPoint.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPoint({ x: clientX, y: clientY });
      return;
    }

    const coords = getCanvasCoordinates(clientX, clientY);
    setMousePos({ x: clientX, y: clientY, isOverImage: !!coords });

    if (isDrawing && coords) {
      draw(coords);
    }
  };

  const endInteraction = () => {
    if (isDrawing) {
      setIsDrawing(false);
      setLastPoint(null);
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) onUpdateMask(canvas.toDataURL('image/png'));
      }, 50);
    }
    setIsPanning(false);
    setLastPanPoint(null);
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full flex items-center justify-center overflow-hidden touch-none p-4"
      onMouseMove={handleMove}
      onMouseLeave={() => {
        setMousePos(null);
        endInteraction();
      }}
      style={{
        cursor: isPanning ? 'grabbing' : (toolMode === ToolMode.PAN ? 'grab' : (mousePos?.isOverImage && !isProcessing ? 'none' : 'default'))
      }}
    >
      {imageUrl ? (
        <>
          <div 
            className="relative transition-transform duration-200 ease-out"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              width: displaySize.width,
              height: displaySize.height,
            }}
            onMouseDown={startInteraction}
            onMouseMove={handleMove}
            onMouseUp={endInteraction}
            onTouchStart={startInteraction}
            onTouchMove={handleMove}
            onTouchEnd={endInteraction}
          >
            <div className="relative w-full h-full rounded-[1.5rem] overflow-hidden select-none shadow-2xl border border-white/10">
              <img 
                src={showOriginal ? (originalImage || imageUrl) : imageUrl} 
                className={`w-full h-full object-contain pointer-events-none select-none transition-all duration-700 ${isProcessing ? 'opacity-40 blur-lg scale-105' : ''}`}
                alt="Editing Area"
                draggable={false}
              />

              <canvas
                ref={canvasRef}
                width={naturalSize.width}
                height={naturalSize.height}
                className={`absolute top-0 left-0 w-full h-full pointer-events-none mix-blend-screen opacity-60 ${showOriginal ? 'opacity-0' : ''} transition-opacity duration-300`}
                style={{ 
                  filter: 'invert(1) sepia(1) saturate(10) hue-rotate(80deg) brightness(1.1) drop-shadow(0 0 5px #30e87a)' 
                }}
              />

              {isProcessing && (
                <div className="absolute inset-0 z-50 overflow-hidden flex flex-col items-center justify-center">
                  <div className="scan-line"></div>
                  <div className="bg-black/40 backdrop-blur-md px-8 py-6 rounded-3xl border border-primary/20 flex flex-col items-center shadow-2xl">
                    <div className="relative size-12 mb-4">
                      <div className="absolute inset-0 border-4 border-primary/10 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-white text-[10px] font-bold tracking-widest uppercase animate-pulse">{loadingMessage}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Floating Zoom Controls */}
          <div className="absolute top-6 right-6 flex flex-col gap-2 z-[60]">
            <div className="bg-surface-dark/80 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 flex flex-col gap-1 shadow-2xl">
              <button onClick={() => handleZoom(0.5)} className="size-10 flex items-center justify-center rounded-xl text-white/60 hover:text-primary hover:bg-primary/10 transition-all">
                <span className="material-symbols-outlined text-[20px]">zoom_in</span>
              </button>
              <div className="h-px bg-white/5 mx-2"></div>
              <button onClick={() => handleZoom(-0.5)} className="size-10 flex items-center justify-center rounded-xl text-white/60 hover:text-primary hover:bg-primary/10 transition-all">
                <span className="material-symbols-outlined text-[20px]">zoom_out</span>
              </button>
              <div className="h-px bg-white/5 mx-2"></div>
              <button onClick={() => {setZoom(1); setOffset({x:0, y:0});}} className="size-10 flex items-center justify-center rounded-xl text-white/60 hover:text-primary hover:bg-primary/10 transition-all">
                <span className="material-symbols-outlined text-[20px]">restart_alt</span>
              </button>
            </div>
            <div className="bg-primary/10 backdrop-blur-md border border-primary/20 rounded-xl py-1 px-3 text-center">
              <span className="text-primary text-[10px] font-bold tracking-tighter">{Math.round(zoom * 100)}%</span>
            </div>
          </div>

          {/* Custom Brush Cursor */}
          {!isProcessing && mousePos && mousePos.isOverImage && toolMode !== ToolMode.PAN && (
            <div 
              className="fixed pointer-events-none rounded-full border-2 border-primary/80 bg-primary/10 z-[100] shadow-[0_0_15px_rgba(48,232,122,0.5)] transition-transform duration-75"
              style={{
                left: mousePos.x,
                top: mousePos.y,
                width: brushSize,
                height: brushSize,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
        </>
      ) : (
        <label className="flex flex-col items-center justify-center cursor-pointer group relative">
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          <div className="absolute -inset-10 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          <div className="relative mb-8 size-48 rounded-[3rem] bg-surface-dark border border-white/10 flex items-center justify-center shadow-2xl group-hover:border-primary/40 group-hover:bg-surface-dark/80 transition-all duration-500 overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-tr from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
             <div className="relative flex flex-col items-center animate-float">
                <span className="material-symbols-outlined text-6xl text-primary/30 group-hover:text-primary transition-all duration-500 transform group-hover:scale-110">cloud_upload</span>
                <div className="h-1 w-8 bg-primary/20 rounded-full mt-4 group-hover:w-16 transition-all duration-500"></div>
             </div>
          </div>
          <div className="text-center z-10 space-y-2">
            <h2 className="text-white font-bold text-2xl tracking-wider group-hover:text-primary transition-colors duration-500">Initialize Canvas</h2>
            <p className="text-white/40 font-medium text-[10px] tracking-[0.4em] uppercase">Select media to begin removal</p>
          </div>
        </label>
      )}
    </div>
  );
};

export default CanvasEditor;
