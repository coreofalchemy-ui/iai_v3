/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';

interface ComparisonModalProps {
  originalImageUrl: string;
  generatedImageUrl: string;
  onClose: () => void;
}

const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const ZoomInIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>;
const ZoomOutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>;
const FlipIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 12h10M7 16l-4-4m4 4l4-4m6 4v1m0-12v.5" transform="rotate(90 12 12)"/></svg>;
const ResetIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 4l16 16" /></svg>;
const SaveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;


const ComparisonModal: React.FC<ComparisonModalProps> = ({ originalImageUrl, generatedImageUrl, onClose }) => {
  const [showOriginal, setShowOriginal] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMousePosition = useRef({ x: 0, y: 0 });

  const resetView = () => {
    setTransform({ scale: 1, x: 0, y: 0 });
    setIsFlipped(false);
  };
  
  useEffect(() => {
    resetView();
  }, [showOriginal, originalImageUrl, generatedImageUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleZoom = (direction: 'in' | 'out', clientX?: number, clientY?: number) => {
    setTransform(prev => {
        const scaleMultiplier = 1.2;
        const newScale = direction === 'in' ? prev.scale * scaleMultiplier : prev.scale / scaleMultiplier;
        const clampedScale = Math.max(1, Math.min(newScale, 10));

        if (clampedScale === prev.scale) return prev;
        
        let newX = prev.x;
        let newY = prev.y;

        // Zoom towards the mouse pointer
        if (imageRef.current && clientX && clientY) {
            const rect = imageRef.current.getBoundingClientRect();
            const mouseX = clientX - rect.left;
            const mouseY = clientY - rect.top;

            newX = mouseX - (mouseX - prev.x) * (clampedScale / prev.scale);
            newY = mouseY - (mouseY - prev.y) * (clampedScale / prev.scale);
        }
        
        // If zooming out brings scale to 1, reset pan
        if (clampedScale === 1) {
            newX = 0;
            newY = 0;
        }

        return { scale: clampedScale, x: newX, y: newY };
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    handleZoom(e.deltaY < 0 ? 'in' : 'out', e.clientX, e.clientY);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (transform.scale > 1) {
      e.preventDefault();
      setIsPanning(true);
      lastMousePosition.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      e.preventDefault();
      const dx = e.clientX - lastMousePosition.current.x;
      const dy = e.clientY - lastMousePosition.current.y;
      lastMousePosition.current = { x: e.clientX, y: e.clientY };
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  const handleSaveView = () => {
    const image = imageRef.current;
    const container = containerRef.current;
    if (!image || !container || image.naturalWidth === 0) return;

    const { naturalWidth, naturalHeight } = image;
    const { clientWidth: vw, clientHeight: vh } = container;
    const { scale, x, y } = transform;
    
    // Calculate the 'object-contain' dimensions at scale 1
    const imageAspectRatio = naturalWidth / naturalHeight;
    const containerAspectRatio = vw / vh;
    let fitWidth, fitHeight;
    if (imageAspectRatio > containerAspectRatio) {
        fitWidth = vw;
        fitHeight = vw / imageAspectRatio;
    } else {
        fitHeight = vh;
        fitWidth = vh * imageAspectRatio;
    }

    const padX = (vw - fitWidth) / 2;
    const padY = (vh - fitHeight) / 2;
    
    // Total scale factor from original image to scaled & transformed image
    const totalScaleFactor = (fitWidth / naturalWidth) * scale;
    
    // Calculate the source rectangle from the original image
    const sx = (-(padX + x)) / totalScaleFactor;
    const sy = (-(padY + y)) / totalScaleFactor;
    const sWidth = vw / totalScaleFactor;
    const sHeight = vh / totalScaleFactor;

    // Create canvas and draw the cropped portion
    const canvas = document.createElement('canvas');
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isFlipped) {
        ctx.scale(-1, 1);
        ctx.translate(-vw, 0);
    }
    
    ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, vw, vh);

    // Trigger download
    const link = document.createElement('a');
    const timestamp = new Date().getTime();
    link.download = `view-capture-${timestamp}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="relative bg-zinc-900 rounded-xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] p-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="flex-shrink-0 flex justify-between items-center pb-4 gap-4">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowOriginal(false)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${!showOriginal ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
            >
              수정본 보기
            </button>
            <button
              onClick={() => setShowOriginal(true)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${showOriginal ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
            >
              원본 보기
            </button>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
              <button onClick={() => handleZoom('in')} className="p-2 bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 transition-colors" title="확대"><ZoomInIcon /></button>
              <button onClick={() => handleZoom('out')} className="p-2 bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 transition-colors" title="축소"><ZoomOutIcon /></button>
              <button onClick={() => setIsFlipped(prev => !prev)} className="p-2 bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 transition-colors" title="좌우 반전"><FlipIcon /></button>
              <button onClick={resetView} className="p-2 bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 transition-colors" title="초기화"><ResetIcon /></button>
              <button onClick={handleSaveView} className="p-2 bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 transition-colors" title="현재 뷰 저장"><SaveIcon /></button>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <CloseIcon />
          </button>
        </div>
        <div 
          ref={containerRef}
          className="flex-grow bg-black rounded-lg overflow-hidden flex items-center justify-center"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
          <img 
            ref={imageRef}
            src={showOriginal ? originalImageUrl : generatedImageUrl} 
            alt={showOriginal ? 'Original Image' : 'Generated Image'} 
            className="max-w-full max-h-full object-contain transition-transform duration-100"
            style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) scaleX(${isFlipped ? -1 : 1})`,
                cursor: isPanning ? 'grabbing' : (transform.scale > 1 ? 'grab' : 'default'),
                transition: isPanning ? 'none' : 'transform 0.1s ease-out',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ComparisonModal;