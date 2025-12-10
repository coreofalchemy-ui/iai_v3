import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bringModelToStudio, regenerateShoesOnly } from '../detail-generator/services/quickTransferService';
import { FILTER_PRESETS, FilterPresetName, getFilterStyles } from '../detail-generator/services/photoFilterService';

// ==================== Design Tokens ====================
const colors = {
    bgBase: '#F5F5F7',
    bgSurface: '#FFFFFF',
    bgSubtle: '#F0F0F4',
    borderSoft: '#E2E2E8',
    textPrimary: '#111111',
    textSecondary: '#6E6E73',
    textMuted: '#A1A1AA',
    accentPrimary: '#111111',
    accentBlue: '#3B82F6',
};

const MAX_IMAGES = 10;

// Platform thumbnail sizes
const PLATFORM_SIZES = [
    { name: 'W컨셉', width: 640, height: 800, ratio: '4:5' },
    { name: '무신사', width: 1000, height: 1200, ratio: '5:6' },
    { name: '29CM', width: 750, height: 1000, ratio: '3:4' },
    { name: '크림', width: 800, height: 800, ratio: '1:1' },
    { name: '다운로드', width: 0, height: 0, ratio: 'original' },
];

// ==================== Types ====================
interface ImageItem {
    id: string;
    file: File;
    preview: string;
}

interface GeneratedContent {
    id: string;
    url: string;
    width: number;
    height: number;
    x: number;
    y: number;
    filter?: FilterPresetName;
    platform?: string; // 플랫폼 이름 (W컨셉, 무신사 등)
    originalWidth?: number; // 원본 너비 (리사이즈 전)
    originalHeight?: number; // 원본 높이 (리사이즈 전)
    // 프레임 내 이미지 변환
    imageScale?: number; // 이미지 스케일 (1 = 100%)
    imageOffsetX?: number; // 이미지 X 오프셋 (%)
    imageOffsetY?: number; // 이미지 Y 오프셋 (%)
    // 홀드 상태 (의류/색상 변경용)
    isHeld?: boolean;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    contentId: string | null;
}

interface SelectionBox {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    active: boolean;
}

// ==================== Component ====================
export default function ContentGeneratorApp() {
    const navigate = useNavigate();

    // Upload states
    const [modelImages, setModelImages] = useState<ImageItem[]>([]);
    const [shoeImages, setShoeImages] = useState<ImageItem[]>([]);
    const [customBackground, setCustomBackground] = useState<ImageItem | null>(null);

    // Options
    const [useStudio, setUseStudio] = useState(false);
    const [use2K, setUse2K] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

    // Generated content
    const [generatedContents, setGeneratedContents] = useState<GeneratedContent[]>([]);
    const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set());

    // History for undo
    const [history, setHistory] = useState<GeneratedContent[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Canvas zoom & pan (Figma-style)
    const [canvasZoom, setCanvasZoom] = useState(1);
    const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });

    // Drag & Resize states
    const [dragState, setDragState] = useState<{
        isDragging: boolean;
        itemId: string | null;
        startX: number;
        startY: number;
        initialPositions: Map<string, { x: number; y: number }>;
    }>({ isDragging: false, itemId: null, startX: 0, startY: 0, initialPositions: new Map() });
    const [resizeState, setResizeState] = useState({ isResizing: false, itemId: null as string | null, startX: 0, startY: 0, initialWidth: 0, initialHeight: 0 });
    const [shiftPressed, setShiftPressed] = useState(false);
    const [spacePressed, setSpacePressed] = useState(false); // For panning

    // Selection box for multi-select
    const [selectionBox, setSelectionBox] = useState<SelectionBox>({ startX: 0, startY: 0, endX: 0, endY: 0, active: false });

    // Context menu
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, contentId: null });

    // Current filter
    const [currentFilter, setCurrentFilter] = useState<FilterPresetName>('original');

    const modelInputRef = useRef<HTMLInputElement>(null);
    const shoeInputRef = useRef<HTMLInputElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Drag states for upload areas
    const [modelDragActive, setModelDragActive] = useState(false);
    const [shoeDragActive, setShoeDragActive] = useState(false);
    const [bgDragActive, setBgDragActive] = useState(false);

    // ==================== Keyboard Events ====================
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setShiftPressed(true);
            if (e.key === ' ') { e.preventDefault(); setSpacePressed(true); }
            if (e.key === 'z' && (e.ctrlKey || e.metaKey)) handleUndo();
            // Reset zoom with 0 key
            if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                setCanvasZoom(1);
                setCanvasPan({ x: 0, y: 0 });
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setShiftPressed(false);
            if (e.key === ' ') setSpacePressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [historyIndex]);

    // Canvas wheel zoom OR selected image scale adjustment
    const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // If exactly one image is selected, adjust that image's internal scale
        if (selectedContentIds.size === 1) {
            const contentId = Array.from(selectedContentIds)[0];
            const delta = e.deltaY > 0 ? -0.1 : 0.1;

            setGeneratedContents(prev => prev.map(c => {
                if (c.id === contentId) {
                    const currentScale = c.imageScale || 1;
                    const newScale = Math.max(0.5, Math.min(3, currentScale + delta));
                    return { ...c, imageScale: newScale };
                }
                return c;
            }));
            return;
        }

        // Otherwise, zoom the canvas (Figma-style - centered on mouse position)
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Mouse position relative to canvas
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate new zoom
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(0.1, Math.min(5, canvasZoom + delta));
        const zoomRatio = newZoom / canvasZoom;

        // Adjust pan to keep mouse position as anchor point
        const newPanX = mouseX - (mouseX - canvasPan.x) * zoomRatio;
        const newPanY = mouseY - (mouseY - canvasPan.y) * zoomRatio;

        setCanvasZoom(newZoom);
        setCanvasPan({ x: newPanX, y: newPanY });
    }, [canvasZoom, canvasPan, selectedContentIds, generatedContents]);

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
        if (contextMenu.visible) {
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [contextMenu.visible]);

    // ==================== History Management ====================
    const saveToHistory = useCallback((newContents: GeneratedContent[]) => {
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push([...newContents]);
            return newHistory.slice(-20); // Keep last 20 states
        });
        setHistoryIndex(prev => Math.min(prev + 1, 19));
    }, [historyIndex]);

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
            setGeneratedContents(history[historyIndex - 1] || []);
        }
    }, [history, historyIndex]);

    // ==================== Handlers ====================
    const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/')).slice(0, MAX_IMAGES - modelImages.length);
        const newItems = files.map((file, idx) => ({ id: `model-${Date.now()}-${idx}`, file, preview: URL.createObjectURL(file) }));
        setModelImages(prev => [...prev, ...newItems].slice(0, MAX_IMAGES));
    };

    const handleShoeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/')).slice(0, MAX_IMAGES - shoeImages.length);
        const newItems = files.map((file, idx) => ({ id: `shoe-${Date.now()}-${idx}`, file, preview: URL.createObjectURL(file) }));
        setShoeImages(prev => [...prev, ...newItems].slice(0, MAX_IMAGES));
    };

    // Drag & Drop handlers for Model images
    const handleModelDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setModelDragActive(true); };
    const handleModelDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setModelDragActive(false); };
    const handleModelDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setModelDragActive(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')).slice(0, MAX_IMAGES - modelImages.length);
        const newItems = files.map((file, idx) => ({ id: `model-${Date.now()}-${idx}`, file, preview: URL.createObjectURL(file) }));
        setModelImages(prev => [...prev, ...newItems].slice(0, MAX_IMAGES));
    };

    // Drag & Drop handlers for Shoe images
    const handleShoeDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setShoeDragActive(true); };
    const handleShoeDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setShoeDragActive(false); };
    const handleShoeDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setShoeDragActive(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')).slice(0, MAX_IMAGES - shoeImages.length);
        const newItems = files.map((file, idx) => ({ id: `shoe-${Date.now()}-${idx}`, file, preview: URL.createObjectURL(file) }));
        setShoeImages(prev => [...prev, ...newItems].slice(0, MAX_IMAGES));
    };

    // Drag & Drop handlers for Background
    const handleBgDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setBgDragActive(true); };
    const handleBgDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setBgDragActive(false); };
    const handleBgDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setBgDragActive(false);
        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        if (customBackground) URL.revokeObjectURL(customBackground.preview);
        setCustomBackground({ id: `bg-${Date.now()}`, file, preview: URL.createObjectURL(file) });
    };

    const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        if (customBackground) URL.revokeObjectURL(customBackground.preview);
        setCustomBackground({ id: `bg-${Date.now()}`, file, preview: URL.createObjectURL(file) });
    };

    const removeModel = (id: string) => {
        const item = modelImages.find(m => m.id === id);
        if (item) URL.revokeObjectURL(item.preview);
        setModelImages(prev => prev.filter(m => m.id !== id));
    };

    const removeShoe = (id: string) => {
        const item = shoeImages.find(s => s.id === id);
        if (item) URL.revokeObjectURL(item.preview);
        setShoeImages(prev => prev.filter(s => s.id !== id));
    };

    const removeBg = () => {
        if (customBackground) URL.revokeObjectURL(customBackground.preview);
        setCustomBackground(null);
    };

    // ==================== Generation ====================
    const handleGenerate = async () => {
        if (modelImages.length === 0 || shoeImages.length === 0) {
            alert('모델 이미지와 신발 이미지를 모두 업로드해주세요.');
            return;
        }

        setIsGenerating(true);
        const totalCount = modelImages.length;
        setProgress({ current: 0, total: totalCount, message: '생성 준비 중...' });

        const results: GeneratedContent[] = [];
        const resolution = use2K ? '2K' : '1K';

        try {
            for (let i = 0; i < modelImages.length; i++) {
                setProgress({ current: i + 1, total: totalCount, message: `모델 ${i + 1}/${totalCount} 처리 중...` });

                const modelUrl = modelImages[i].preview;
                const shoeUrl = shoeImages[Math.min(i, shoeImages.length - 1)].preview;

                let resultUrl: string;

                if (useStudio) {
                    // Studio mode: Use bringModelToStudio - unifies model+shoes tone
                    resultUrl = await bringModelToStudio(modelUrl, shoeUrl, {
                        resolution: resolution as '1K' | '4K',
                        customBackgroundUrl: customBackground?.preview
                    });
                } else {
                    // Just swap shoes without changing background
                    resultUrl = await regenerateShoesOnly(modelUrl, shoeUrl, { resolution: resolution as '1K' | '2K' | '4K' });
                }

                // Add to results with 1:1 square format
                const size = 280;
                results.push({
                    id: `content-${Date.now()}-${i}`,
                    url: resultUrl.startsWith('data:') ? resultUrl : `data:image/png;base64,${resultUrl}`,
                    width: size,
                    height: size,
                    x: 40 + (i % 3) * (size + 20),
                    y: 40 + Math.floor(i / 3) * (size + 20),
                    filter: 'original'
                });
            }

            const newContents = [...generatedContents, ...results];
            setGeneratedContents(newContents);
            saveToHistory(newContents);
        } catch (error) {
            console.error('Generation failed:', error);
            alert('콘텐츠 생성 중 오류가 발생했습니다.');
        } finally {
            setIsGenerating(false);
            setProgress({ current: 0, total: 0, message: '' });
        }
    };

    // ==================== Canvas Interactions ====================
    const handleContentClick = (e: React.MouseEvent, contentId: string) => {
        e.stopPropagation();
        // Click handling is done in mousedown for better responsiveness
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-grid')) {
            setSelectedContentIds(new Set());
        }
    };

    const handleContentMouseDown = (e: React.MouseEvent, contentId: string) => {
        const content = generatedContents.find(c => c.id === contentId);
        if (!content) return;
        e.preventDefault(); e.stopPropagation();

        // Handle multi-select with Ctrl/Shift
        let newSelectedIds: Set<string>;
        if (e.shiftKey || e.ctrlKey) {
            // Toggle selection with Ctrl/Shift
            newSelectedIds = new Set(selectedContentIds);
            if (newSelectedIds.has(contentId)) {
                newSelectedIds.delete(contentId);
            } else {
                newSelectedIds.add(contentId);
            }
            setSelectedContentIds(newSelectedIds);
            // Don't start drag if just toggling selection
            return;
        } else if (!selectedContentIds.has(contentId)) {
            // If clicking unselected item without modifier, select only it
            newSelectedIds = new Set([contentId]);
            setSelectedContentIds(newSelectedIds);
        } else {
            // Already selected, use existing selection for drag
            newSelectedIds = selectedContentIds;
        }

        // Store initial positions of all selected items for drag
        const initialPositions = new Map<string, { x: number; y: number }>();
        generatedContents.forEach(c => {
            if (newSelectedIds.has(c.id)) {
                initialPositions.set(c.id, { x: c.x, y: c.y });
            }
        });

        setDragState({
            isDragging: true,
            itemId: contentId,
            startX: e.clientX,
            startY: e.clientY,
            initialPositions
        });
    };

    const handleResizeStart = (e: React.MouseEvent, contentId: string) => {
        const content = generatedContents.find(c => c.id === contentId);
        if (!content) return;
        e.preventDefault(); e.stopPropagation();
        setResizeState({ isResizing: true, itemId: contentId, startX: e.clientX, startY: e.clientY, initialWidth: content.width, initialHeight: content.height });
    };

    // Canvas empty area click - selection box or panning
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-grid') || (e.target as HTMLElement).classList.contains('canvas-content')) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            // Space key held = panning mode
            if (spacePressed) {
                e.preventDefault();
                setIsPanning(true);
                setPanStart({ x: e.clientX, y: e.clientY, panX: canvasPan.x, panY: canvasPan.y });
                return;
            }

            // Default left click on empty canvas = selection box for multi-select
            const x = (e.clientX - rect.left - canvasPan.x) / canvasZoom;
            const y = (e.clientY - rect.top - canvasPan.y) / canvasZoom;
            setSelectionBox({ startX: x, startY: y, endX: x, endY: y, active: true });
            // Clear selection if not holding Ctrl/Shift
            if (!e.ctrlKey && !e.shiftKey) {
                setSelectedContentIds(new Set());
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // Panning
        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            setCanvasPan({ x: panStart.panX + dx, y: panStart.panY + dy });
            return;
        }

        // Selection box
        if (selectionBox.active && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left - canvasPan.x) / canvasZoom;
            const y = (e.clientY - rect.top - canvasPan.y) / canvasZoom;
            setSelectionBox(prev => ({ ...prev, endX: x, endY: y }));
        }

        // Dragging - use stored initial positions for smooth movement
        if (dragState.isDragging && dragState.itemId) {
            // Account for zoom level when calculating movement
            const dx = (e.clientX - dragState.startX) / canvasZoom;
            const dy = (e.clientY - dragState.startY) / canvasZoom;

            // If exactly 1 image selected AND Alt key pressed, adjust image offset within frame
            if (selectedContentIds.size === 1 && e.altKey) {
                const contentId = Array.from(selectedContentIds)[0];
                setGeneratedContents(prev => prev.map(c => {
                    if (c.id === contentId) {
                        const currentX = c.imageOffsetX || 0;
                        const currentY = c.imageOffsetY || 0;
                        // Scale dx/dy to percentage based on image size
                        const content = prev.find(ct => ct.id === contentId);
                        const scaleX = content ? (dx / content.width) * 100 : dx;
                        const scaleY = content ? (dy / content.height) * 100 : dy;
                        return {
                            ...c,
                            imageOffsetX: Math.max(-50, Math.min(50, currentX + scaleX)),
                            imageOffsetY: Math.max(-50, Math.min(50, currentY + scaleY))
                        };
                    }
                    return c;
                }));
                // Update drag start for next move
                setDragState(prev => ({ ...prev, startX: e.clientX, startY: e.clientY }));
                return;
            }

            // Otherwise, move all selected items based on their initial positions
            setGeneratedContents(prev => prev.map(c => {
                const initialPos = dragState.initialPositions.get(c.id);
                if (initialPos) {
                    return { ...c, x: initialPos.x + dx, y: initialPos.y + dy };
                }
                return c;
            }));
        }

        // Resizing
        if (resizeState.isResizing && resizeState.itemId) {
            const dx = e.clientX - resizeState.startX;
            const dy = e.clientY - resizeState.startY;

            if (shiftPressed) {
                // Proportional resize
                const delta = Math.max(dx, dy);
                const newWidth = Math.max(100, resizeState.initialWidth + delta);
                const ratio = resizeState.initialHeight / resizeState.initialWidth;
                const newHeight = newWidth * ratio;
                setGeneratedContents(prev => prev.map(c => c.id === resizeState.itemId
                    ? { ...c, width: newWidth, height: newHeight }
                    : c));
            } else {
                // Free resize
                const newWidth = Math.max(100, resizeState.initialWidth + dx);
                const newHeight = Math.max(100, resizeState.initialHeight + dy);
                setGeneratedContents(prev => prev.map(c => c.id === resizeState.itemId
                    ? { ...c, width: newWidth, height: newHeight }
                    : c));
            }
        }
    };

    const handleMouseUp = () => {
        // Stop panning
        if (isPanning) {
            setIsPanning(false);
            return;
        }

        // Check selection box intersection
        if (selectionBox.active) {
            const minX = Math.min(selectionBox.startX, selectionBox.endX);
            const maxX = Math.max(selectionBox.startX, selectionBox.endX);
            const minY = Math.min(selectionBox.startY, selectionBox.endY);
            const maxY = Math.max(selectionBox.startY, selectionBox.endY);

            const selected = generatedContents.filter(c => {
                const cRight = c.x + c.width;
                const cBottom = c.y + c.height;
                return !(c.x > maxX || cRight < minX || c.y > maxY || cBottom < minY);
            });

            if (selected.length > 0) {
                setSelectedContentIds(new Set(selected.map(c => c.id)));
            }
            setSelectionBox(prev => ({ ...prev, active: false }));
        }

        if (dragState.isDragging || resizeState.isResizing) {
            saveToHistory(generatedContents);
        }

        setDragState({ isDragging: false, itemId: null, startX: 0, startY: 0, initialPositions: new Map() });
        setResizeState(prev => ({ ...prev, isResizing: false, itemId: null }));
    };

    // ==================== Context Menu ====================
    const handleContextMenu = (e: React.MouseEvent, contentId: string) => {
        e.preventDefault();
        setSelectedContentIds(prev => {
            if (!prev.has(contentId)) return new Set([contentId]);
            return prev;
        });
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, contentId });
    };

    // Resize selected images on canvas (not download)
    const resizeOnCanvas = (targetWidth: number, targetHeight: number, platformName: string) => {
        // Calculate display size (scaled down for canvas view)
        const displayWidth = Math.min(targetWidth, 400);
        const displayHeight = (targetHeight / targetWidth) * displayWidth;

        const newContents = generatedContents.map(c => {
            if (selectedContentIds.has(c.id)) {
                return {
                    ...c,
                    width: displayWidth,
                    height: displayHeight,
                    platform: platformName,
                    originalWidth: targetWidth,
                    originalHeight: targetHeight
                };
            }
            return c;
        });

        setGeneratedContents(newContents);
        saveToHistory(newContents);
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    // Download selected images
    const downloadSelected = async () => {
        const selectedContents = generatedContents.filter(c => selectedContentIds.has(c.id));

        for (const content of selectedContents) {
            const img = new Image();
            img.src = content.url;
            await new Promise(resolve => { img.onload = resolve; });

            const canvas = document.createElement('canvas');
            const targetWidth = content.originalWidth || img.naturalWidth;
            const targetHeight = content.originalHeight || img.naturalHeight;
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;

            // Center crop to fit target ratio
            const srcRatio = img.naturalWidth / img.naturalHeight;
            const targetRatio = canvas.width / canvas.height;
            let srcX = 0, srcY = 0, srcW = img.naturalWidth, srcH = img.naturalHeight;

            if (srcRatio > targetRatio) {
                srcW = img.naturalHeight * targetRatio;
                srcX = (img.naturalWidth - srcW) / 2;
            } else {
                srcH = img.naturalWidth / targetRatio;
                srcY = (img.naturalHeight - srcH) / 2;
            }

            ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

            const link = document.createElement('a');
            const platform = content.platform || 'content';
            link.download = `${platform}-${content.id}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            link.click();
        }

        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    // Auto-arrange images from top-left, respecting each image's current size
    const autoArrange = () => {
        const padding = 20;
        const startX = 40;
        const startY = 40;
        let currentX = startX;
        let currentY = startY;
        let rowMaxHeight = 0;
        const canvasWidth = canvasRef.current?.clientWidth || 800;

        const newContents = generatedContents.map((c, index) => {
            // Check if we need to wrap to next row
            if (currentX + c.width > canvasWidth - padding && index > 0) {
                currentX = startX;
                currentY += rowMaxHeight + padding;
                rowMaxHeight = 0;
            }

            const newContent = { ...c, x: currentX, y: currentY };

            currentX += c.width + padding;
            rowMaxHeight = Math.max(rowMaxHeight, c.height);

            return newContent;
        });

        setGeneratedContents(newContents);
        saveToHistory(newContents);

        // Scroll canvas to top-left to show arranged images
        if (canvasRef.current) {
            canvasRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        }
    };

    const handleDeleteContent = (contentIds: Set<string>) => {
        const newContents = generatedContents.filter(c => !contentIds.has(c.id));
        setGeneratedContents(newContents);
        saveToHistory(newContents);
        setSelectedContentIds(new Set());
    };

    // ==================== Filter ====================
    const applyFilterToSelected = (filterName: FilterPresetName) => {
        setCurrentFilter(filterName);
        const newContents = generatedContents.map(c =>
            selectedContentIds.has(c.id) ? { ...c, filter: filterName } : c
        );
        setGeneratedContents(newContents);
        saveToHistory(newContents);
    };

    // ==================== Image Transform (within frame) ====================
    const adjustImageScale = (contentId: string, delta: number) => {
        const newContents = generatedContents.map(c => {
            if (c.id === contentId) {
                const currentScale = c.imageScale || 1;
                const newScale = Math.max(0.5, Math.min(3, currentScale + delta));
                return { ...c, imageScale: newScale };
            }
            return c;
        });
        setGeneratedContents(newContents);
        saveToHistory(newContents);
    };

    const centerImage = (contentId: string) => {
        const newContents = generatedContents.map(c => {
            if (c.id === contentId) {
                return { ...c, imageOffsetX: 0, imageOffsetY: 0 };
            }
            return c;
        });
        setGeneratedContents(newContents);
        saveToHistory(newContents);
    };

    const adjustImageOffset = (contentId: string, dx: number, dy: number) => {
        const newContents = generatedContents.map(c => {
            if (c.id === contentId) {
                const currentX = c.imageOffsetX || 0;
                const currentY = c.imageOffsetY || 0;
                return {
                    ...c,
                    imageOffsetX: Math.max(-50, Math.min(50, currentX + dx)),
                    imageOffsetY: Math.max(-50, Math.min(50, currentY + dy))
                };
            }
            return c;
        });
        setGeneratedContents(newContents);
    };

    // ==================== Hold Feature (Clothing/Color Change) ====================
    const toggleHold = (contentId: string) => {
        const newContents = generatedContents.map(c =>
            c.id === contentId ? { ...c, isHeld: !c.isHeld } : c
        );
        setGeneratedContents(newContents);
        saveToHistory(newContents);
    };

    const handleHeldImageDrop = async (contentId: string, files: FileList) => {
        const heldContent = generatedContents.find(c => c.id === contentId && c.isHeld);
        if (!heldContent || files.length === 0) return;

        const file = files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            const droppedImageUrl = e.target?.result as string;

            try {
                // Show loading state
                setProgress({ current: 1, total: 1, message: '🔄 AI 합성 중...' });
                setIsGenerating(true);

                // Call AI to swap the dropped item (clothing/shoes) onto the held model
                const result = await regenerateShoesOnly(
                    heldContent.url,  // Base model image
                    droppedImageUrl,  // Dropped clothing/shoe image
                    { resolution: use2K ? '2K' : '1K' }
                );

                // Update the held content with the composite result
                const newContents = generatedContents.map(c =>
                    c.id === contentId ? { ...c, url: result, isHeld: false } : c
                );
                setGeneratedContents(newContents);
                saveToHistory(newContents);

            } catch (error) {
                console.error('AI 합성 실패:', error);
                alert('AI 합성 중 오류가 발생했습니다.');
            } finally {
                setIsGenerating(false);
                setProgress({ current: 0, total: 0, message: '' });
            }
        };
        reader.readAsDataURL(file);
    };

    // ==================== Image Expansion (Outpainting) ====================
    const expandImage = async () => {
        if (selectedContentIds.size !== 1) {
            alert('확장할 이미지 1개를 선택해주세요.');
            return;
        }

        const contentId = Array.from(selectedContentIds)[0];
        const content = generatedContents.find(c => c.id === contentId);
        if (!content) return;

        try {
            setProgress({ current: 1, total: 1, message: '🔄 이미지 확장 중...' });
            setIsGenerating(true);

            // Use regenerateShoesOnly for image extension - it will preserve the model and extend
            const result = await regenerateShoesOnly(
                content.url,
                content.url, // Use same image - AI will understand to extend
                { resolution: use2K ? '2K' : '1K' }
            );

            // Add expanded image as new content
            const img = new Image();
            img.onload = () => {
                const newContent: GeneratedContent = {
                    id: `expanded-${Date.now()}`,
                    url: result,
                    width: Math.min(img.width, 400),
                    height: Math.min(img.height, 600),
                    x: content.x + content.width + 20,
                    y: content.y
                };
                const newContents = [...generatedContents, newContent];
                setGeneratedContents(newContents);
                saveToHistory(newContents);
                setSelectedContentIds(new Set([newContent.id]));
            };
            img.src = result;

        } catch (error) {
            console.error('이미지 확장 실패:', error);
            alert('이미지 확장 중 오류가 발생했습니다.');
        } finally {
            setIsGenerating(false);
            setProgress({ current: 0, total: 0, message: '' });
        }
    };

    // Canvas drop - add images directly to canvas
    const handleCanvasDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const files = e.dataTransfer.files;
        if (files.length === 0) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Calculate drop position in canvas coordinates
        const dropX = (e.clientX - rect.left - canvasPan.x) / canvasZoom;
        const dropY = (e.clientY - rect.top - canvasPan.y) / canvasZoom;

        Array.from(files).forEach((file, index) => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                const url = ev.target?.result as string;
                const img = new Image();
                img.onload = () => {
                    const displayWidth = Math.min(img.width, 300);
                    const displayHeight = (img.height / img.width) * displayWidth;

                    const newContent: GeneratedContent = {
                        id: `dropped-${Date.now()}-${index}`,
                        url,
                        width: displayWidth,
                        height: displayHeight,
                        x: dropX + (index * 20),
                        y: dropY + (index * 20)
                    };

                    setGeneratedContents(prev => {
                        const newContents = [...prev, newContent];
                        saveToHistory(newContents);
                        return newContents;
                    });
                };
                img.src = url;
            };
            reader.readAsDataURL(file);
        });
    };

    // ==================== Render ====================
    return (
        <div style={{
            height: '100vh',
            maxHeight: '100vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: colors.bgBase,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
        }}>
            {/* Header */}
            <header style={{ height: 56, background: colors.bgBase, borderBottom: `1px solid ${colors.borderSoft}` }} className="flex items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate('/')} style={{ color: colors.textSecondary }} className="hover:opacity-70 transition-opacity">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 style={{ fontSize: 17, fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.02em' }}>Content Generator</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleUndo} disabled={historyIndex <= 0}
                        style={{ background: colors.bgSubtle, color: colors.textSecondary, fontSize: 13, padding: '6px 12px', borderRadius: 8, border: `1px solid ${colors.borderSoft}` }}
                        className="hover:opacity-80 disabled:opacity-40 transition-opacity flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        뒤로
                    </button>
                    <button onClick={autoArrange} disabled={generatedContents.length === 0}
                        style={{ background: colors.bgSubtle, color: colors.textSecondary, fontSize: 13, padding: '6px 12px', borderRadius: 8, border: `1px solid ${colors.borderSoft}` }}
                        className="hover:opacity-80 disabled:opacity-40 transition-opacity flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        자동정렬
                    </button>
                    <button onClick={handleGenerate}
                        disabled={isGenerating || modelImages.length === 0 || shoeImages.length === 0}
                        style={{ background: colors.accentPrimary, color: '#FFFFFF', fontSize: 14, fontWeight: 500, padding: '8px 20px', borderRadius: 980 }}
                        className="hover:opacity-85 disabled:opacity-40 transition-opacity">
                        {isGenerating ? progress.message : `생성 (${modelImages.length}장)`}
                    </button>
                </div>
            </header>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: 24, gap: 24 }}>
                {/* Canvas Area */}
                <div ref={canvasRef}
                    style={{
                        background: colors.bgSurface,
                        borderRadius: 16,
                        boxShadow: '0 18px 45px rgba(0,0,0,0.08)',
                        cursor: spacePressed ? 'grab' : (isPanning ? 'grabbing' : 'default')
                    }}
                    className="flex-grow relative overflow-hidden"
                    onClick={handleCanvasClick}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleCanvasWheel}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleCanvasDrop}>

                    {/* Zoom/Pan Transform Wrapper */}
                    <div className="canvas-content" style={{
                        transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
                        transformOrigin: '0 0',
                        width: '2000px',
                        height: '2000px',
                        position: 'relative'
                    }}>
                        {/* Subtle Grid */}
                        <div className="canvas-grid absolute inset-0 pointer-events-none" style={{
                            backgroundImage: `radial-gradient(${colors.borderSoft} 1px, transparent 1px)`,
                            backgroundSize: '32px 32px'
                        }} />

                        {/* Progress Indicator */}
                        {isGenerating && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-40">
                                <div className="text-center">
                                    <div style={{ borderColor: colors.borderSoft, borderTopColor: colors.accentPrimary }} className="w-12 h-12 border-3 rounded-full animate-spin mx-auto mb-4" />
                                    <p style={{ fontSize: 16, fontWeight: 500, color: colors.textPrimary }}>{progress.message}</p>
                                    <p style={{ fontSize: 13, color: colors.textMuted }} className="mt-2">{progress.current}/{progress.total}</p>
                                </div>
                            </div>
                        )}

                        {/* Selection Box */}
                        {selectionBox.active && (
                            <div style={{
                                position: 'absolute',
                                left: Math.min(selectionBox.startX, selectionBox.endX),
                                top: Math.min(selectionBox.startY, selectionBox.endY),
                                width: Math.abs(selectionBox.endX - selectionBox.startX),
                                height: Math.abs(selectionBox.endY - selectionBox.startY),
                                border: `2px dashed ${colors.accentBlue}`,
                                background: 'rgba(59, 130, 246, 0.1)',
                                pointerEvents: 'none',
                                zIndex: 30
                            }} />
                        )}

                        {/* Generated Contents - No rounded corners on images */}
                        {generatedContents.map(content => {
                            const isSelected = selectedContentIds.has(content.id);
                            const filterStyles = content.filter ? getFilterStyles(content.filter) : null;
                            const isHeld = content.isHeld;

                            return (
                                <div key={content.id}
                                    style={{
                                        left: content.x, top: content.y, width: content.width, height: content.height,
                                        background: colors.bgSurface,
                                        border: isHeld ? '3px solid #FF3B30' : (isSelected ? `2px solid ${colors.accentBlue}` : `1px solid ${colors.borderSoft}`),
                                        boxShadow: isHeld ? '0 8px 30px rgba(255,59,48,0.3)' : (isSelected ? '0 8px 30px rgba(59,130,246,0.2)' : '0 4px 12px rgba(0,0,0,0.06)'),
                                        ...(filterStyles?.containerStyle || {})
                                    }}
                                    className="absolute cursor-move transition-shadow duration-200"
                                    onClick={(e) => handleContentClick(e, content.id)}
                                    onMouseDown={(e) => handleContentMouseDown(e, content.id)}
                                    onContextMenu={(e) => handleContextMenu(e, content.id)}
                                    onDragOver={(e) => { if (isHeld) e.preventDefault(); }}
                                    onDrop={(e) => {
                                        if (isHeld) {
                                            e.preventDefault();
                                            handleHeldImageDrop(content.id, e.dataTransfer.files);
                                        }
                                    }}>

                                    {/* Hold indicator - simple drop zone */}
                                    {isHeld && (
                                        <>
                                            {/* HOLD badge */}
                                            <div style={{
                                                position: 'absolute',
                                                top: 8,
                                                right: 8,
                                                background: '#FF3B30',
                                                color: '#fff',
                                                fontSize: 10,
                                                padding: '3px 8px',
                                                borderRadius: 4,
                                                fontWeight: 600,
                                                zIndex: 20
                                            }}>
                                                🔒 HOLD
                                            </div>

                                            {/* Drop zone border */}
                                            <div style={{
                                                position: 'absolute',
                                                inset: 0,
                                                border: '3px dashed #FF3B30',
                                                background: 'rgba(255, 59, 48, 0.08)',
                                                pointerEvents: 'none',
                                                zIndex: 5
                                            }} />

                                            {/* Drop hint */}
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 12,
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                background: 'rgba(0,0,0,0.85)',
                                                color: '#fff',
                                                padding: '6px 14px',
                                                borderRadius: 8,
                                                fontSize: 11,
                                                zIndex: 15,
                                                whiteSpace: 'nowrap'
                                            }}>
                                                👟 신발/의류 드롭 → AI 교체 | 우클릭 → 색상 변경
                                            </div>
                                        </>
                                    )}

                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        overflow: 'hidden',
                                        position: 'relative'
                                    }}>
                                        <img
                                            src={content.url}
                                            alt=""
                                            draggable={false}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                transform: `scale(${content.imageScale || 1}) translate(${content.imageOffsetX || 0}%, ${content.imageOffsetY || 0}%)`,
                                                transformOrigin: 'center center',
                                                transition: 'transform 0.15s ease'
                                            }}
                                        />
                                    </div>

                                    {/* Filter overlays */}
                                    {filterStyles && (
                                        <>
                                            <div style={filterStyles.overlayStyle} />
                                            <div style={filterStyles.grainStyle} />
                                            <div style={filterStyles.glowStyle} />
                                        </>
                                    )}

                                    {/* Platform label (always visible) */}
                                    {content.platform && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 4,
                                            left: 4,
                                            background: 'rgba(0,0,0,0.7)',
                                            color: '#fff',
                                            fontSize: 9,
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                            pointerEvents: 'none'
                                        }}>
                                            {content.platform} {content.originalWidth}×{content.originalHeight}
                                        </div>
                                    )}

                                    {isSelected && (
                                        <>
                                            {/* Frame resize handle */}
                                            <div style={{ background: colors.accentBlue }} className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize"
                                                onMouseDown={(e) => handleResizeStart(e, content.id)} />

                                            {/* Delete button */}
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteContent(new Set([content.id])); }} style={{ background: '#FF3B30' }}
                                                className="absolute -top-2 -right-2 w-6 h-6 text-white rounded-full text-sm flex items-center justify-center shadow-lg">×</button>

                                            {/* Image transform controls */}
                                            <div style={{
                                                position: 'absolute',
                                                top: -32,
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                display: 'flex',
                                                gap: 4,
                                                background: 'rgba(0,0,0,0.8)',
                                                padding: '4px 8px',
                                                borderRadius: 6
                                            }}>
                                                {/* Zoom out */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); adjustImageScale(content.id, -0.1); }}
                                                    style={{ width: 24, height: 24, background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14 }}
                                                >−</button>

                                                {/* Center */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); centerImage(content.id); }}
                                                    style={{ width: 24, height: 24, background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10 }}
                                                    title="중앙 정렬"
                                                >⊙</button>

                                                {/* Zoom in */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); adjustImageScale(content.id, 0.1); }}
                                                    style={{ width: 24, height: 24, background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14 }}
                                                >+</button>
                                            </div>

                                            {/* Hint */}
                                            <div style={{ background: colors.accentBlue, fontSize: 9, padding: '2px 6px' }}
                                                className="absolute bottom-2 left-2 text-white">
                                                {shiftPressed ? '비율 유지' : '↕↔ 드래그로 이동'}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}

                        {/* Selection Box */}
                        {selectionBox.active && (
                            <div style={{
                                position: 'absolute',
                                left: Math.min(selectionBox.startX, selectionBox.endX),
                                top: Math.min(selectionBox.startY, selectionBox.endY),
                                width: Math.abs(selectionBox.endX - selectionBox.startX),
                                height: Math.abs(selectionBox.endY - selectionBox.startY),
                                border: `2px dashed ${colors.accentBlue}`,
                                background: 'rgba(59, 130, 246, 0.1)',
                                pointerEvents: 'none'
                            }} />
                        )}
                    </div>{/* End canvas-content */}

                    {/* Zoom Level Indicator */}
                    <div style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 12,
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        fontSize: 11,
                        padding: '4px 10px',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}>
                        <span>{Math.round(canvasZoom * 100)}%</span>
                        <button onClick={() => { setCanvasZoom(1); setCanvasPan({ x: 0, y: 0 }); }}
                            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10 }}>리셋</button>
                    </div>
                </div>{/* End canvas ref div */}

                {/* Right Panel - FIXED, no zoom/resize allowed */}
                <div
                    style={{
                        width: 320,
                        minWidth: 320,
                        maxWidth: 320,
                        background: colors.bgSubtle,
                        borderRadius: 16,
                        flexShrink: 0
                    }}
                    className="flex flex-col overflow-y-auto"
                    onWheel={(e) => e.stopPropagation()} // Block wheel events from affecting canvas
                >
                    {/* Model Images */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12, marginBottom: 0 }} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase">모델 이미지</h3>
                            <span style={{ fontSize: 10, color: colors.textMuted }}>{modelImages.length}/{MAX_IMAGES}</span>
                        </div>
                        <div style={{
                            border: `2px dashed ${modelDragActive ? '#3B82F6' : colors.borderSoft}`,
                            borderRadius: 12,
                            minHeight: 100,
                            background: modelDragActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                            transition: 'all 0.2s ease'
                        }}
                            className={`p-3 cursor-pointer hover:border-gray-400 ${modelImages.length >= MAX_IMAGES ? 'opacity-50 pointer-events-none' : ''}`}
                            onClick={() => modelInputRef.current?.click()}
                            onDragOver={handleModelDragOver}
                            onDragEnter={handleModelDragOver}
                            onDragLeave={handleModelDragLeave}
                            onDrop={handleModelDrop}>
                            <input ref={modelInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleModelUpload} />
                            {modelImages.length === 0 ? (
                                <div className="text-center py-4">
                                    <span className="text-2xl block mb-1">👤</span>
                                    <span style={{ fontSize: 12, color: colors.textMuted }}>최대 {MAX_IMAGES}장</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 gap-1.5">
                                    {modelImages.map(m => (
                                        <div key={m.id} className="relative group aspect-square">
                                            <img src={m.preview} alt="" className="w-full h-full object-cover rounded-md" />
                                            <button onClick={(e) => { e.stopPropagation(); removeModel(m.id); }}
                                                style={{ background: '#FF3B30' }} className="absolute -top-1 -right-1 w-4 h-4 text-white rounded-full text-xs opacity-0 group-hover:opacity-100">×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 2K Quality Option */}
                        <label className="flex items-center gap-3 cursor-pointer mt-3">
                            <div onClick={(e) => { e.stopPropagation(); setUse2K(!use2K); }}
                                style={{ width: 18, height: 18, borderRadius: 4, background: use2K ? colors.accentPrimary : colors.bgSubtle, border: `1px solid ${colors.borderSoft}` }}
                                className="flex items-center justify-center">
                                {use2K && <span className="text-white text-xs">✓</span>}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 500, color: colors.textPrimary }}>2K 고화질</span>
                        </label>
                    </div>

                    {/* Shoe Images */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12, marginBottom: 0 }} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase">신발 이미지</h3>
                            <span style={{ fontSize: 10, color: colors.textMuted }}>{shoeImages.length}/{MAX_IMAGES}</span>
                        </div>
                        <div style={{
                            border: `2px dashed ${shoeDragActive ? '#3B82F6' : colors.borderSoft}`,
                            borderRadius: 12,
                            minHeight: 100,
                            background: shoeDragActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                            transition: 'all 0.2s ease'
                        }}
                            className={`p-3 cursor-pointer hover:border-gray-400 ${shoeImages.length >= MAX_IMAGES ? 'opacity-50 pointer-events-none' : ''}`}
                            onClick={() => shoeInputRef.current?.click()}
                            onDragOver={handleShoeDragOver}
                            onDragEnter={handleShoeDragOver}
                            onDragLeave={handleShoeDragLeave}
                            onDrop={handleShoeDrop}>
                            <input ref={shoeInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleShoeUpload} />
                            {shoeImages.length === 0 ? (
                                <div className="text-center py-4">
                                    <span className="text-2xl block mb-1">👟</span>
                                    <span style={{ fontSize: 12, color: colors.textMuted }}>최대 {MAX_IMAGES}장</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 gap-1.5">
                                    {shoeImages.map(s => (
                                        <div key={s.id} className="relative group aspect-square">
                                            <img src={s.preview} alt="" className="w-full h-full object-cover rounded-md" />
                                            <button onClick={(e) => { e.stopPropagation(); removeShoe(s.id); }}
                                                style={{ background: '#FF3B30' }} className="absolute -top-1 -right-1 w-4 h-4 text-white rounded-full text-xs opacity-0 group-hover:opacity-100">×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Options */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12, marginBottom: 0 }} className="p-4">
                        <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase mb-3">옵션</h3>
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                            <div onClick={() => setUseStudio(!useStudio)}
                                style={{ width: 20, height: 20, borderRadius: 6, background: useStudio ? colors.accentPrimary : colors.bgSubtle, border: `1px solid ${colors.borderSoft}` }}
                                className="flex items-center justify-center">
                                {useStudio && <span className="text-white text-xs">✓</span>}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary }}>Studio 모드</span>
                            <span style={{ fontSize: 11, color: colors.textMuted }}>(스튜디오 배경)</span>
                        </label>

                        {/* Custom Background (when Studio enabled) */}
                        {useStudio && (
                            <div style={{
                                border: `2px dashed ${bgDragActive ? '#3B82F6' : customBackground ? '#10B981' : colors.borderSoft}`,
                                borderRadius: 10,
                                minHeight: 70,
                                background: bgDragActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                transition: 'all 0.2s ease'
                            }}
                                className="cursor-pointer hover:border-green-400 overflow-hidden"
                                onClick={() => bgInputRef.current?.click()}
                                onDragOver={handleBgDragOver}
                                onDragEnter={handleBgDragOver}
                                onDragLeave={handleBgDragLeave}
                                onDrop={handleBgDrop}>
                                <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                                {customBackground ? (
                                    <div className="relative">
                                        <img src={customBackground.preview} alt="" className="w-full h-16 object-cover" />
                                        <button onClick={(e) => { e.stopPropagation(); removeBg(); }}
                                            style={{ background: '#FF3B30' }} className="absolute top-1 right-1 w-5 h-5 text-white rounded-full text-xs">×</button>
                                        <div style={{ background: '#10B981', fontSize: 9, padding: '2px 6px' }} className="absolute bottom-1 left-1 text-white rounded">커스텀 배경</div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <span className="text-lg block mb-0.5">🏞️</span>
                                        <span style={{ fontSize: 10, color: colors.textMuted }}>배경 업로드 (선택)</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Filters */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12, marginBottom: 0 }} className="p-4">
                        <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase mb-3">필터</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {Object.entries(FILTER_PRESETS).map(([key, preset]) => (
                                <button
                                    key={key}
                                    onClick={() => applyFilterToSelected(key as FilterPresetName)}
                                    disabled={selectedContentIds.size === 0}
                                    style={{
                                        background: currentFilter === key ? colors.accentPrimary : colors.bgSubtle,
                                        color: currentFilter === key ? '#fff' : colors.textPrimary,
                                        fontSize: 10,
                                        padding: '6px 8px',
                                        borderRadius: 6,
                                        border: `1px solid ${colors.borderSoft}`
                                    }}
                                    className="hover:opacity-80 disabled:opacity-40 transition-all truncate"
                                >
                                    {preset.label.split(' ')[0]}
                                </button>
                            ))}
                        </div>
                        <p style={{ fontSize: 10, color: colors.textMuted, marginTop: 8 }}>
                            {selectedContentIds.size > 0 ? `${selectedContentIds.size}개 선택됨` : '이미지 선택 후 필터 적용'}
                        </p>
                    </div>

                    {/* Image Expansion */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12, marginBottom: 0 }} className="p-4">
                        <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase mb-3">확장하기</h3>
                        <button
                            onClick={expandImage}
                            disabled={selectedContentIds.size !== 1 || isGenerating}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: selectedContentIds.size === 1 ? '#10B981' : colors.bgSubtle,
                                color: selectedContentIds.size === 1 ? '#fff' : colors.textMuted,
                                border: 'none',
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: selectedContentIds.size === 1 ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8
                            }}
                        >
                            📐 전신 확장 (AI)
                        </button>
                        <p style={{ fontSize: 10, color: colors.textMuted, marginTop: 8, lineHeight: 1.5 }}>
                            잘린 모델 사진을 선택 후 확장하면<br />AI가 전신이 보이도록 확장합니다
                        </p>
                    </div>

                    {/* Info */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12 }} className="p-4 mt-auto">
                        <h4 style={{ fontSize: 11, fontWeight: 600, color: colors.textPrimary }} className="mb-2">사용 가이드</h4>
                        <ul style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 1.8 }}>
                            <li>• 드래그로 다중 선택</li>
                            <li>• Shift+드래그: 비율 유지 리사이즈</li>
                            <li>• 우클릭: 플랫폼별 사이즈 다운로드</li>
                            <li>• Ctrl+Z: 뒤로 돌리기</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu.visible && (
                <div
                    style={{
                        position: 'fixed',
                        left: contextMenu.x,
                        top: contextMenu.y,
                        background: colors.bgSurface,
                        borderRadius: 12,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                        border: `1px solid ${colors.borderSoft}`,
                        minWidth: 200,
                        zIndex: 100,
                        overflow: 'hidden'
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <div style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.borderSoft}`, fontSize: 11, color: colors.textMuted }}>
                        사이즈 변환 (캔버스)
                    </div>
                    {PLATFORM_SIZES.filter(p => p.width > 0).map(platform => (
                        <button
                            key={platform.name}
                            onClick={() => resizeOnCanvas(platform.width, platform.height, platform.name)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                padding: '10px 12px',
                                fontSize: 13,
                                color: colors.textPrimary,
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left'
                            }}
                            className="hover:bg-gray-50"
                        >
                            <span>{platform.name}</span>
                            <span style={{ fontSize: 11, color: colors.textMuted }}>
                                {platform.width}×{platform.height}
                            </span>
                        </button>
                    ))}

                    {/* Hold Toggle */}
                    <div style={{ borderTop: `1px solid ${colors.borderSoft}` }}>
                        <button
                            onClick={() => {
                                if (contextMenu.contentId) toggleHold(contextMenu.contentId);
                                setContextMenu(prev => ({ ...prev, visible: false }));
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                width: '100%',
                                padding: '10px 12px',
                                fontSize: 13,
                                color: generatedContents.find(c => c.id === contextMenu.contentId)?.isHeld ? '#FF3B30' : colors.textPrimary,
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {generatedContents.find(c => c.id === contextMenu.contentId)?.isHeld ? '🔓 홀드 해제' : '🔒 홀드 (의류변경용)'}
                        </button>
                    </div>

                    {/* Color Change - only show when held */}
                    {generatedContents.find(c => c.id === contextMenu.contentId)?.isHeld && (
                        <div style={{ borderTop: `1px solid ${colors.borderSoft}`, padding: '8px 12px' }}>
                            <div style={{ fontSize: 10, color: colors.textMuted, marginBottom: 6 }}>색상 변경 (AI)</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {[
                                    { color: '#000000', name: '블랙' },
                                    { color: '#FFFFFF', name: '화이트' },
                                    { color: '#FF3B30', name: '레드' },
                                    { color: '#007AFF', name: '블루' },
                                    { color: '#34C759', name: '그린' },
                                    { color: '#FF9500', name: '오렌지' },
                                    { color: '#AF52DE', name: '퍼플' },
                                    { color: '#8B4513', name: '브라운' }
                                ].map(({ color, name }) => (
                                    <button key={color} onClick={() => { alert(`${name} 색상으로 변경합니다.\nAI 연결 필요`); setContextMenu(prev => ({ ...prev, visible: false })); }}
                                        style={{
                                            width: 28, height: 28,
                                            background: color,
                                            border: color === '#FFFFFF' ? '1px solid #ddd' : 'none',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                        }} title={name} />
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ borderTop: `1px solid ${colors.borderSoft}` }}>
                        <button
                            onClick={downloadSelected}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                width: '100%',
                                padding: '10px 12px',
                                fontSize: 13,
                                color: colors.accentBlue,
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                            className="hover:bg-blue-50"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            다운로드
                        </button>
                        <button
                            onClick={() => handleDeleteContent(selectedContentIds)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                width: '100%',
                                padding: '10px 12px',
                                fontSize: 13,
                                color: '#FF3B30',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                            className="hover:bg-red-50"
                        >
                            삭제
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
