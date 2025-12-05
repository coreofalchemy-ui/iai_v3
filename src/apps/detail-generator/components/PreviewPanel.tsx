import React, { forwardRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { HeroSection } from './HeroSection';
import { TextElement } from './PreviewRenderer';

interface PreviewPanelProps {
    data: any;
    imageZoomLevels: any;
    onAction: any;
    onZoom: any;
    activeSection: string;
    onSectionVisible: any;
    sectionOrder: string[];
    showAIAnalysis: boolean;
    onHtmlUpdate: (html: string) => void;
    textElements: TextElement[];
    onAddTextElement: (text: TextElement) => void;
    onUpdateTextElement: (id: string, prop: keyof TextElement, value: any) => void;
    onDeleteTextElement: (id: string) => void;
    onUpdateAllTextElements: (elements: TextElement[]) => void;
    onContextMenu: (e: React.MouseEvent, type: string, index: number, section: string) => void;
    sectionHeights: { [key: string]: number };
    onUpdateSectionHeight: (id: string, height: number) => void;
    imageTransforms?: { [key: string]: { scale: number, x: number, y: number } };
    onUpdateImageTransform?: (sectionId: string, transform: { scale: number, x: number, y: number }) => void;
    lockedImages?: Set<string>;
    onDeleteSection?: (sectionId: string) => void;
    heldSections?: Set<string>;
    selectedSections?: Set<string>; // For wheel/drag control
    onToggleHold?: (sectionId: string) => void;
    onCompositeImage?: (sectionId: string, source: File | { url: string, type: string }) => void;
    isHoldOn?: boolean;
    forceEditSections?: Set<string>;
    onForceEdit?: (sectionId: string) => void;
    onCancelForceEdit?: (sectionId: string) => void;
    processingSections?: Set<string>; // Sections currently being processed
    gridSections?: { [sectionId: string]: { cols: number; rows: number; height: number; cells: (string | null)[] } };
    onUpdateGridCell?: (sectionId: string, cellIndex: number, imageUrl: string) => void;
    lineElements?: Array<{
        id: string;
        sectionId: string;
        type: 'straight' | 'curved' | 'angled';
        strokeWidth: number;
        strokeColor: string;
        lineCap: 'round' | 'square' | 'arrow' | 'butt';
        lineEnd: 'none' | 'arrow';
        x1?: number;
        y1?: number;
        x2?: number;
        y2?: number;
    }>;
    onUpdateLineElement?: (id: string, updates: { x1?: number; y1?: number; x2?: number; y2?: number }) => void;
    onDeleteLineElement?: (id: string) => void;
}

export const PreviewPanel = forwardRef<HTMLDivElement, PreviewPanelProps>(({
    data,
    sectionOrder,
    onAction,
    onContextMenu,
    textElements = [],
    onUpdateTextElement,
    sectionHeights = {},
    onUpdateSectionHeight,
    onSectionVisible,
    imageTransforms = {},
    onUpdateImageTransform,
    onDeleteSection,
    heldSections = new Set(),
    selectedSections = new Set(),
    onToggleHold,
    onCompositeImage,
    isHoldOn = true,
    forceEditSections = new Set(),
    onForceEdit,
    onCancelForceEdit,
    processingSections = new Set(),
    gridSections = {},
    onUpdateGridCell,
    lineElements = [],
    onUpdateLineElement,
    onDeleteLineElement
}, ref) => {
    // 선택된 선 ID 상태
    const [selectedLineId, setSelectedLineId] = React.useState<string | null>(null);

    // 선 드래그 상태
    const [lineDraggingState, setLineDraggingState] = React.useState<{
        lineId: string | null;
        handle: 'start' | 'end' | 'whole';
        startMouseX: number;
        startMouseY: number;
        initialX1: number;
        initialY1: number;
        initialX2: number;
        initialY2: number;
    }>({ lineId: null, handle: 'whole', startMouseX: 0, startMouseY: 0, initialX1: 0, initialY1: 0, initialX2: 0, initialY2: 0 });

    const [draggingState, setDraggingState] = React.useState<{
        id: string | null;
        startX: number;
        startY: number;
        initialLeft: number;
        initialTop: number;
        currentLeft: number;
        currentTop: number;
    }>({ id: null, startX: 0, startY: 0, initialLeft: 0, initialTop: 0, currentLeft: 0, currentTop: 0 });

    const [resizingState, setResizingState] = React.useState<{
        sectionId: string | null;
        startY: number;
        startHeight: number;
    }>({ sectionId: null, startY: 0, startHeight: 0 });

    const [panningState, setPanningState] = React.useState<{
        sectionId: string | null;
        startX: number;
        startY: number;
        initialX: number;
        initialY: number;
    }>({ sectionId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });

    const [contextMenuState, setContextMenuState] = React.useState<{
        visible: boolean;
        x: number;
        y: number;
        sectionId: string | null;
    }>({ visible: false, x: 0, y: 0, sectionId: null });

    const sectionRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Close context menu on click outside
    React.useEffect(() => {
        const handleClick = () => setContextMenuState({ visible: false, x: 0, y: 0, sectionId: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Delete key handler for selected line
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLineId && onDeleteLineElement) {
                e.preventDefault();
                onDeleteLineElement(selectedLineId);
                setSelectedLineId(null);
            }
            // ESC 키로 선택 해제
            if (e.key === 'Escape') {
                setSelectedLineId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedLineId, onDeleteLineElement]);

    // 선 드래그 이벤트 핸들러
    React.useEffect(() => {
        if (!lineDraggingState.lineId) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - lineDraggingState.startMouseX;
            const deltaY = e.clientY - lineDraggingState.startMouseY;

            if (lineDraggingState.handle === 'start') {
                // 시작점만 이동
                onUpdateLineElement?.(lineDraggingState.lineId!, {
                    x1: lineDraggingState.initialX1 + deltaX,
                    y1: lineDraggingState.initialY1 + deltaY
                });
            } else if (lineDraggingState.handle === 'end') {
                // 끝점만 이동
                onUpdateLineElement?.(lineDraggingState.lineId!, {
                    x2: lineDraggingState.initialX2 + deltaX,
                    y2: lineDraggingState.initialY2 + deltaY
                });
            } else {
                // 전체 선 이동
                onUpdateLineElement?.(lineDraggingState.lineId!, {
                    x1: lineDraggingState.initialX1 + deltaX,
                    y1: lineDraggingState.initialY1 + deltaY,
                    x2: lineDraggingState.initialX2 + deltaX,
                    y2: lineDraggingState.initialY2 + deltaY
                });
            }
        };

        const handleMouseUp = () => {
            setLineDraggingState({ lineId: null, handle: 'whole', startMouseX: 0, startMouseY: 0, initialX1: 0, initialY1: 0, initialX2: 0, initialY2: 0 });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [lineDraggingState, onUpdateLineElement]);

    // Intersection Observer for active section detection
    React.useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const sectionId = entry.target.getAttribute('data-section');
                    if (sectionId && onSectionVisible) {
                        onSectionVisible(sectionId);
                    }
                }
            });
        }, { threshold: 0.3 }); // Lower threshold for better detection of tall sections

        Object.values(sectionRefs.current).forEach(el => {
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [sectionOrder, onSectionVisible]);

    const handleTextMouseDown = (e: React.MouseEvent, text: TextElement) => {
        e.stopPropagation();
        e.preventDefault();
        setDraggingState({
            id: text.id,
            startX: e.clientX,
            startY: e.clientY,
            initialLeft: text.left,
            initialTop: text.top,
            currentLeft: text.left,
            currentTop: text.top
        });
    };

    const handleResizeMouseDown = (e: React.MouseEvent, sectionId: string, currentHeight: number) => {
        e.stopPropagation();
        e.preventDefault();
        setResizingState({
            sectionId,
            startY: e.clientY,
            startHeight: currentHeight
        });
    };

    const handleImageMouseDown = (e: React.MouseEvent, sectionId: string) => {
        // Allow if MINIMAP toggle is ON (isHoldOn) OR if this section is selected
        const isGlobalEditOn = isHoldOn;
        const isSelected = selectedSections?.has(sectionId) || forceEditSections.has(sectionId);
        if (!isGlobalEditOn && !isSelected) return;

        // If Model Hold is active, LOCK movement (return early)
        if (heldSections.has(sectionId)) return;

        if (e.button !== 0) return;
        e.preventDefault();

        const currentTransform = imageTransforms[sectionId] || { scale: 1, x: 0, y: 0 };

        setPanningState({
            sectionId,
            startX: e.clientX,
            startY: e.clientY,
            initialX: currentTransform.x,
            initialY: currentTransform.y
        });
    };

    const handleImageWheel = (e: React.WheelEvent, sectionId: string) => {
        // Allow if MINIMAP toggle is ON (isHoldOn) OR if this section is selected
        const isGlobalEditOn = isHoldOn;
        const isSelected = selectedSections?.has(sectionId) || forceEditSections.has(sectionId);
        if (!isGlobalEditOn && !isSelected) return;

        // If Model Hold is active, LOCK movement (return early)
        if (heldSections.has(sectionId)) return;

        if (!onUpdateImageTransform) return;

        // Try to prevent default (might be passive)
        e.stopPropagation();

        const currentTransform = imageTransforms[sectionId] || { scale: 1, x: 0, y: 0 };
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(0.1, Math.min(5.0, currentTransform.scale + delta));

        onUpdateImageTransform(sectionId, {
            ...currentTransform,
            scale: newScale
        });
    };



    const handleContextMenu = (e: React.MouseEvent, sectionId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (onContextMenu) {
            onContextMenu(e, 'section', 0, sectionId);
        }
    };

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (draggingState.id) {
                const deltaX = e.clientX - draggingState.startX;
                const deltaY = e.clientY - draggingState.startY;
                setDraggingState(prev => ({
                    ...prev,
                    currentLeft: prev.initialLeft + deltaX,
                    currentTop: prev.initialTop + deltaY
                }));
            } else if (resizingState.sectionId) {
                const deltaY = e.clientY - resizingState.startY;
                const newHeight = Math.max(50, resizingState.startHeight + deltaY); // Min height 50px
                onUpdateSectionHeight(resizingState.sectionId, newHeight);
            } else if (panningState.sectionId && onUpdateImageTransform) {
                const deltaX = e.clientX - panningState.startX;
                const deltaY = e.clientY - panningState.startY;

                const currentTransform = imageTransforms[panningState.sectionId] || { scale: 1, x: 0, y: 0 };

                onUpdateImageTransform(panningState.sectionId, {
                    ...currentTransform,
                    x: panningState.initialX + deltaX,
                    y: panningState.initialY + deltaY
                });
            }
        };

        const handleMouseUp = () => {
            if (draggingState.id) {
                onUpdateTextElement(draggingState.id, 'left', draggingState.currentLeft);
                onUpdateTextElement(draggingState.id, 'top', draggingState.currentTop);
                setDraggingState({ id: null, startX: 0, startY: 0, initialLeft: 0, initialTop: 0, currentLeft: 0, currentTop: 0 });
            }
            if (resizingState.sectionId) {
                setResizingState({ sectionId: null, startY: 0, startHeight: 0 });
            }
            if (panningState.sectionId) {
                setPanningState({ sectionId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });
            }
        };

        if (draggingState.id || resizingState.sectionId || panningState.sectionId) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingState, resizingState, panningState, onUpdateTextElement, onUpdateSectionHeight, onUpdateImageTransform, imageTransforms]);

    // Helper to load image and set height
    const loadImageAndSetHeight = (file: File, sectionKey: string) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            if (result) {
                // Create an image element to get dimensions
                const img = new Image();
                img.onload = () => {
                    // Calculate height based on 1000px width
                    const aspectRatio = img.naturalHeight / img.naturalWidth;
                    const calculatedHeight = 1000 * aspectRatio;

                    onAction('updateImage', sectionKey, 0, result);
                    onUpdateSectionHeight(sectionKey, calculatedHeight);

                    // Reset transform
                    if (onUpdateImageTransform) {
                        onUpdateImageTransform(sectionKey, { scale: 1, x: 0, y: 0 });
                    }
                };
                img.src = result;
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = React.useCallback((e: React.DragEvent, sectionKey: string) => {
        e.preventDefault();
        e.stopPropagation();

        // 1. Check for Internal Product Drag
        const productData = e.dataTransfer.getData('application/coaii-product');
        if (productData) {
            try {
                const product = JSON.parse(productData);
                if (heldSections.has(sectionKey) && onCompositeImage) {
                    onCompositeImage(sectionKey, product);
                } else {
                    // If not held, just replace image for convenience
                    onAction('updateImage', sectionKey, 0, product.url);
                }
            } catch (err) {
                console.error('Failed to parse product data', err);
            }
            return;
        }

        // 2. Check for File Drop
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];

            // If section is held, use composite logic
            if (heldSections.has(sectionKey) && onCompositeImage) {
                onCompositeImage(sectionKey, file);
            } else {
                // Normal replacement
                loadImageAndSetHeight(file, sectionKey);
            }
        }
    }, [onAction, onUpdateSectionHeight, onUpdateImageTransform, heldSections, onCompositeImage]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleClickUpload = (sectionKey: string) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (ev: any) => {
            if (ev.target.files && ev.target.files.length > 0) {
                loadImageAndSetHeight(ev.target.files[0], sectionKey);
            }
        };
        input.click();
    };



    const renderTextElements = (sectionId: string) => {
        return textElements
            .filter(text => text.sectionId === sectionId)
            .map(text => {
                const isDragging = draggingState.id === text.id;
                return (
                    <div
                        key={text.id}
                        style={{
                            position: 'absolute',
                            top: isDragging ? draggingState.currentTop : text.top,
                            left: isDragging ? draggingState.currentLeft : text.left,
                            fontSize: text.fontSize,
                            fontFamily: text.fontFamily,
                            color: text.color || '#000',
                            fontWeight: text.fontWeight || 'normal',
                            textAlign: text.textAlign || 'left',
                            cursor: 'move',
                            zIndex: 1000,
                            whiteSpace: 'pre-wrap',
                            userSelect: 'none',
                            border: isDragging ? '1px dashed blue' : '1px solid transparent',
                            padding: '4px'
                        }}
                        onMouseDown={(e) => handleTextMouseDown(e, text)}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {text.content}
                    </div>
                );
            });
    };

    // 선 요소 렌더링 함수
    const renderLineElements = (sectionId: string) => {
        const sectionLines = lineElements.filter(line => line.sectionId === sectionId);
        if (sectionLines.length === 0) return null;

        return (
            <svg
                className="absolute inset-0 pointer-events-none"
                style={{ width: '100%', height: '100%', zIndex: 999 }}
            >
                {sectionLines.map(line => {
                    const x1 = line.x1 || 50;
                    const y1 = line.y1 || 50;
                    const x2 = line.x2 || 200;
                    const y2 = line.y2 || 50;

                    // 선 타입에 따른 path 생성
                    let pathD = '';
                    if (line.type === 'straight') {
                        pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
                    } else if (line.type === 'curved') {
                        // 곡선: 중간 제어점 생성
                        const midX = (x1 + x2) / 2;
                        const midY = Math.min(y1, y2) - 50; // 위로 볼록
                        pathD = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;
                    } else if (line.type === 'angled') {
                        // 꺾은선: 중간에 꺾임점
                        const midX = (x1 + x2) / 2;
                        pathD = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
                    }

                    // 화살표 마커 정의
                    const markerId = `arrow-${line.id}`;

                    return (
                        <g key={line.id}>
                            {line.lineEnd === 'arrow' && (
                                <defs>
                                    <marker
                                        id={markerId}
                                        markerWidth="10"
                                        markerHeight="10"
                                        refX="9"
                                        refY="3"
                                        orient="auto"
                                        markerUnits="strokeWidth"
                                    >
                                        <path d="M0,0 L0,6 L9,3 z" fill={line.strokeColor} />
                                    </marker>
                                </defs>
                            )}
                            {/* 선택 표시 - 선택된 경우 파란 점선 테두리 */}
                            {selectedLineId === line.id && (
                                <path
                                    d={pathD}
                                    stroke="#3b82f6"
                                    strokeWidth={line.strokeWidth + 6}
                                    fill="none"
                                    strokeDasharray="5,5"
                                    style={{ pointerEvents: 'none' }}
                                />
                            )}
                            <path
                                d={pathD}
                                stroke={line.strokeColor}
                                strokeWidth={Math.max(line.strokeWidth, 10)} // 최소 10px로 클릭 영역 확대
                                fill="none"
                                strokeLinecap={line.lineCap === 'arrow' ? 'round' : line.lineCap}
                                markerEnd={line.lineEnd === 'arrow' ? `url(#${markerId})` : undefined}
                                style={{ pointerEvents: 'auto', cursor: 'grab', opacity: line.strokeWidth < 10 ? 0 : 1 }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedLineId(line.id); // 선택 상태 설정
                                    setLineDraggingState({
                                        lineId: line.id,
                                        handle: 'whole',
                                        startMouseX: e.clientX,
                                        startMouseY: e.clientY,
                                        initialX1: x1,
                                        initialY1: y1,
                                        initialX2: x2,
                                        initialY2: y2
                                    });
                                }}
                            />
                            {/* 실제 선 (얇은 선) */}
                            <path
                                d={pathD}
                                stroke={line.strokeColor}
                                strokeWidth={line.strokeWidth}
                                fill="none"
                                strokeLinecap={line.lineCap === 'arrow' ? 'round' : line.lineCap}
                                markerEnd={line.lineEnd === 'arrow' ? `url(#${markerId})` : undefined}
                                style={{ pointerEvents: 'none' }}
                            />
                            {/* 시작점 핸들 - 선택된 경우에만 표시 */}
                            <circle
                                cx={x1} cy={y1} r={selectedLineId === line.id ? 10 : 8}
                                fill={selectedLineId === line.id ? '#3b82f6' : line.strokeColor}
                                opacity={selectedLineId === line.id ? 1 : 0.7}
                                style={{ cursor: 'move', pointerEvents: 'auto' }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedLineId(line.id);
                                    setLineDraggingState({
                                        lineId: line.id,
                                        handle: 'start',
                                        startMouseX: e.clientX,
                                        startMouseY: e.clientY,
                                        initialX1: x1,
                                        initialY1: y1,
                                        initialX2: x2,
                                        initialY2: y2
                                    });
                                }}
                            />
                            {/* 끝점 핸들 - 선택된 경우에만 표시 */}
                            <circle
                                cx={x2} cy={y2} r={selectedLineId === line.id ? 10 : 8}
                                fill={selectedLineId === line.id ? '#3b82f6' : line.strokeColor}
                                opacity={selectedLineId === line.id ? 1 : 0.7}
                                style={{ cursor: 'move', pointerEvents: 'auto' }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedLineId(line.id);
                                    setLineDraggingState({
                                        lineId: line.id,
                                        handle: 'end',
                                        startMouseX: e.clientX,
                                        startMouseY: e.clientY,
                                        initialX1: x1,
                                        initialY1: y1,
                                        initialX2: x2,
                                        initialY2: y2
                                    });
                                }}
                            />
                        </g>
                    );
                })}
            </svg>
        );
    };

    return (
        <div
            ref={ref}
            className="preview-panel bg-white shadow-lg pb-8 relative"
            style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}
        >
            {/* Custom Context Menu - Rendered via Portal - REMOVED to use parent's menu */}
            {null}

            {sectionOrder.map((sectionKey) => {
                if (sectionKey === 'hero') {
                    return (
                        <div
                            key={sectionKey}
                            className="relative"
                            onClick={(e) => { e.stopPropagation(); }}
                            ref={el => { sectionRefs.current[sectionKey] = el; }}
                            data-section={sectionKey}
                            onContextMenu={(e) => handleContextMenu(e, sectionKey)}
                        >
                            <HeroSection content={data.heroTextContent} fieldSettings={data.heroFieldSettings} fieldOrder={data.heroFieldOrder} />
                            {renderTextElements(sectionKey)}
                            {renderLineElements(sectionKey)}
                        </div>
                    );
                }

                // Grid Sections (Collage)
                if (sectionKey.startsWith('grid-') && gridSections[sectionKey]) {
                    const grid = gridSections[sectionKey];
                    const gridHeight = sectionHeights[sectionKey] || grid.height;

                    return (
                        <div
                            key={sectionKey}
                            data-section={sectionKey}
                            ref={el => { sectionRefs.current[sectionKey] = el; }}
                            className="relative group"
                            style={{ height: `${gridHeight}px` }}
                            onContextMenu={(e) => handleContextMenu(e, sectionKey)}
                        >
                            {/* Grid Layout */}
                            <div
                                className="w-full h-full grid gap-1 p-1 bg-gray-100"
                                style={{
                                    gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
                                    gridTemplateRows: `repeat(${grid.rows}, 1fr)`
                                }}
                            >
                                {grid.cells.map((cellImage, cellIdx) => (
                                    <div
                                        key={`${sectionKey}-cell-${cellIdx}`}
                                        className={`relative overflow-hidden bg-gray-200 border-2 border-dashed border-gray-300 
                                            flex items-center justify-center cursor-pointer 
                                            hover:border-blue-400 hover:bg-blue-50 transition-colors`}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                                const file = e.dataTransfer.files[0];
                                                const reader = new FileReader();
                                                reader.onload = (ev) => {
                                                    const imageUrl = ev.target?.result as string;
                                                    if (onUpdateGridCell) {
                                                        onUpdateGridCell(sectionKey, cellIdx, imageUrl);
                                                    }
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.onchange = (ev: any) => {
                                                if (ev.target.files && ev.target.files.length > 0) {
                                                    const file = ev.target.files[0];
                                                    const reader = new FileReader();
                                                    reader.onload = (evr) => {
                                                        const imageUrl = evr.target?.result as string;
                                                        if (onUpdateGridCell) {
                                                            onUpdateGridCell(sectionKey, cellIdx, imageUrl);
                                                        }
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            };
                                            input.click();
                                        }}
                                    >
                                        {cellImage ? (
                                            <img
                                                src={cellImage}
                                                alt={`Cell ${cellIdx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="text-gray-400 text-center">
                                                <div className="text-2xl mb-1">+</div>
                                                <div className="text-xs">{cellIdx + 1}</div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Resize Handle */}
                            <div
                                className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-gray-300 to-transparent cursor-ns-resize hover:from-blue-400"
                                onMouseDown={(e) => handleResizeMouseDown(e, sectionKey, gridHeight)}
                            />

                            {/* Grid Info Badge */}
                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                {grid.cols}×{grid.rows} Grid
                            </div>

                            {renderTextElements(sectionKey)}
                        </div>
                    );
                }

                // Custom Sections (Images)
                const imageUrl = data.imageUrls?.[sectionKey];
                const isLoading = imageUrl === 'loading'; // 스트리밍 로딩 상태
                const isPlaceholder = !imageUrl || imageUrl.includes('placeholder') || imageUrl.includes('via.placeholder') || isLoading;

                // Determine height: use explicit height if available, otherwise default logic
                const explicitHeight = sectionHeights[sectionKey];
                const styleHeight = explicitHeight ? `${explicitHeight}px` : (isPlaceholder ? '200px' : 'auto');

                // Image Transform
                const transform = imageTransforms?.[sectionKey] || { scale: 1, x: 0, y: 0 };
                const isHeld = heldSections.has(sectionKey);
                const isEditable = isHoldOn || forceEditSections.has(sectionKey);

                return (
                    <div
                        key={sectionKey}
                        data-section={sectionKey}
                        ref={el => { sectionRefs.current[sectionKey] = el; }}
                        className={`relative group overflow-hidden ${isHeld ? 'border-4 border-red-500' : ''}`}
                        style={{
                            minHeight: isPlaceholder ? '200px' : 'auto',
                            boxSizing: 'border-box'
                        }}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, sectionKey)}
                        onClick={() => isPlaceholder && handleClickUpload(sectionKey)}
                        onContextMenu={(e) => handleContextMenu(e, sectionKey)}
                    >
                        {isPlaceholder ? (
                            <div className="w-full h-full border-4 border-dashed border-gray-200 flex flex-col items-center justify-center bg-gray-50 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer box-border min-h-[200px]">
                                {isLoading ? (
                                    // 로딩 스피너 표시
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                                        <div className="text-blue-500 font-bold text-lg">이미지 생성 중...</div>
                                        <div className="text-gray-400 text-sm mt-2">잠시만 기다려주세요</div>
                                    </div>
                                ) : sectionKey.startsWith('spacer-') ? (
                                    // Minimal placeholder for spacer
                                    <div className="text-gray-400 font-bold flex flex-col items-center">
                                        <span>여백 (높이 조절 가능)</span>
                                        <span className="text-xs font-normal mt-1">이미지 드롭 가능</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-6xl mb-6">📷</div>
                                        <div className="text-gray-500 font-bold text-xl">이미지를 드래그하여 업로드하세요</div>
                                        <div className="text-gray-400 text-base mt-3">또는 클릭하여 선택</div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div
                                className="relative w-full"
                            >
                                <img
                                    src={imageUrl}
                                    alt="Section"
                                    className={`w-full h-auto block select-none ${isEditable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${processingSections?.has(sectionKey) ? 'blur-sm' : ''}`}
                                    style={{
                                        transform: `scale(${transform.scale}) translate(${transform.x}px, ${transform.y}px)`,
                                        transformOrigin: 'center center',
                                        transition: panningState.sectionId === sectionKey ? 'none' : 'transform 0.1s ease-out'
                                    }}
                                    draggable={false}
                                    onMouseDown={(e) => handleImageMouseDown(e, sectionKey)}
                                    onWheel={(e) => !isPlaceholder && handleImageWheel(e, sectionKey)}
                                    onLoad={(e) => {
                                        // Auto-calculate section height based on image dimensions
                                        const img = e.currentTarget;
                                        if (img.naturalWidth > 0 && img.naturalHeight > 0 && !sectionHeights[sectionKey]) {
                                            const aspectRatio = img.naturalHeight / img.naturalWidth;
                                            const calculatedHeight = 1000 * aspectRatio;
                                            onUpdateSectionHeight(sectionKey, calculatedHeight);
                                        }
                                    }}
                                />
                                {/* Processing Overlay */}
                                {processingSections?.has(sectionKey) && (
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center z-30 pointer-events-none">
                                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4"></div>
                                        <div className="text-white text-xl font-bold">변경중입니다...</div>
                                        <div className="text-white/70 text-sm mt-2">AI가 의류를 교체하고 있어요</div>
                                    </div>
                                )}
                                {/* Hold Indicator */}
                                {isHeld && !processingSections?.has(sectionKey) && (
                                    <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md z-20 pointer-events-none">
                                        LOCKED 🔒
                                    </div>
                                )}
                            </div>
                        )}
                        {renderTextElements(sectionKey)}
                        {renderLineElements(sectionKey)}

                        {/* Resize Handle - Only when editable (minimap ON or section selected) */}
                        {!isPlaceholder && isEditable && (
                            <div
                                className="absolute bottom-0 left-0 w-full h-5 cursor-ns-resize z-50 flex items-center justify-center bg-gradient-to-t from-blue-500/30 to-transparent hover:from-blue-500/50 transition-all"
                                onMouseDown={(e) => {
                                    const currentH = explicitHeight || e.currentTarget.parentElement?.clientHeight || 100;
                                    handleResizeMouseDown(e, sectionKey, currentH);
                                }}
                            >
                                <div className="w-16 h-1 bg-white rounded-full shadow-sm"></div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
});

PreviewPanel.displayName = 'PreviewPanel';
