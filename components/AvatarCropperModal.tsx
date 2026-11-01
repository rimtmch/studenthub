import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  ZoomIn,
  ZoomOut,
  RefreshCcw,
  Check,
  X,
  Loader2,
  Move,
} from 'lucide-react';

interface AvatarCropperModalProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => Promise<void> | void;
  onCancel: () => void;
  isProcessing?: boolean;
}

const CROP_SIZE = 260; // Diameter of circular crop area in pixels

export const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({
  imageSrc,
  onCropComplete,
  onCancel,
  isProcessing = false,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [displayedSize, setDisplayedSize] = useState({ width: 0, height: 0 });

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate base displayed dimensions when image loads to fill crop viewport nicely
  const handleImageLoad = () => {
    if (!imageRef.current) return;
    const { naturalWidth, naturalHeight } = imageRef.current;
    if (!naturalWidth || !naturalHeight) return;

    // Scale so shortest side covers CROP_SIZE
    const scale = Math.max(CROP_SIZE / naturalWidth, CROP_SIZE / naturalHeight);
    setDisplayedSize({
      width: naturalWidth * scale,
      height: naturalHeight * scale,
    });
    setPan({ x: 0, y: 0 });
  };

  // Reset all adjustments
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setPan({ x: 0, y: 0 });
  };

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch pan handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    setZoom((prev) => Math.min(Math.max(1, prev + delta), 3.5));
  };

  // Global mouse up listener so drag doesn't get stuck if cursor leaves modal
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Generate the cropped and transformed image onto offscreen canvas
  const handleConfirm = useCallback(() => {
    if (!imageRef.current || isProcessing) return;
    const img = imageRef.current;

    const outputSize = 800; // Crisp 800x800px output
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, outputSize, outputSize);

    const ratio = outputSize / CROP_SIZE;

    // 1. Move origin to center of output canvas
    ctx.translate(outputSize / 2, outputSize / 2);

    // 2. User Pan offset
    ctx.translate(pan.x * ratio, pan.y * ratio);

    // 3. User Rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // 4. User Flip
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // 5. User Zoom & base size
    const drawWidth = displayedSize.width * zoom * ratio;
    const drawHeight = displayedSize.height * zoom * ratio;

    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCropComplete(blob);
        }
      },
      'image/jpeg',
      0.92
    );
  }, [pan, rotation, flipH, flipV, zoom, displayedSize, isProcessing, onCropComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 my-auto animate-scale-up text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="text-base sm:text-lg font-bold leading-tight">Crop & Edit Profile Picture</h3>
            <p className="text-xs text-slate-400 font-medium">Pan, zoom, rotate, and flip to position your avatar</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport / Interactive Crop Box */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
          onWheel={handleWheel}
          className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center select-none cursor-grab active:cursor-grabbing border border-white/10 shadow-inner"
        >
          {/* Transformed Image */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop source"
            onLoad={handleImageLoad}
            draggable={false}
            style={{
              width: displayedSize.width ? `${displayedSize.width}px` : 'auto',
              height: displayedSize.height ? `${displayedSize.height}px` : 'auto',
              transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom * (flipH ? -1 : 1)}, ${zoom * (flipV ? -1 : 1)})`,
              transition: isDragging ? 'none' : 'transform 0.12s ease-out',
              maxWidth: 'none',
              maxHeight: 'none',
              pointerEvents: 'none',
            }}
          />

          {/* Circular Crop Guide Mask */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* The circular aperture with surrounding dark shadow */}
            <div
              style={{ width: `${CROP_SIZE}px`, height: `${CROP_SIZE}px` }}
              className="rounded-full border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] relative"
            >
              {/* Subtle crosshair center helper */}
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <div className="w-3 h-0.5 bg-white rounded-full" />
                <div className="h-3 w-0.5 bg-white rounded-full absolute" />
              </div>
            </div>
          </div>

          {/* Quick hint tag */}
          <div className="absolute bottom-2.5 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[10px] font-medium text-slate-300 pointer-events-none border border-white/10 flex items-center gap-1.5 shadow-sm">
            <Move className="w-3 h-3 text-blue-400" />
            <span>Drag photo to reposition</span>
          </div>
        </div>

        {/* Zoom Control Slider */}
        <div className="space-y-1.5 px-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <ZoomIn className="w-3.5 h-3.5 text-blue-400" /> Zoom
            </span>
            <span className="text-slate-300 font-semibold">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, z - 0.15))}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition border border-white/10 cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition border border-white/10 cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Rotate, Flip & Reset Toolbar */}
        <div className="flex items-center justify-between gap-1.5 p-2 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition border border-white/5 cursor-pointer flex items-center gap-1 text-xs"
              title="Rotate 90° Left"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">-90°</span>
            </button>

            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition border border-white/5 cursor-pointer flex items-center gap-1 text-xs"
              title="Rotate 90° Right"
            >
              <RotateCw className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">+90°</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFlipH((f) => !f)}
              className={`p-2 rounded-xl transition border cursor-pointer flex items-center gap-1 text-xs ${
                flipH
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/5'
              }`}
              title="Flip Horizontally"
            >
              <FlipHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Flip H</span>
            </button>

            <button
              type="button"
              onClick={() => setFlipV((f) => !f)}
              className={`p-2 rounded-xl transition border cursor-pointer flex items-center gap-1 text-xs ${
                flipV
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/5'
              }`}
              title="Flip Vertically"
            >
              <FlipVertical className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Flip V</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition border border-white/5 cursor-pointer"
            title="Reset All Adjustments"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-sm transition border border-white/10 cursor-pointer text-center"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-white/10 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Set Picture</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
