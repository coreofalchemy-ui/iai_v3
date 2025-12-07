import React, { forwardRef, useCallback, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { HeroSection } from './HeroSection';
import { TextElement } from './PreviewRenderer';
import SizeGuideSection from './SizeGuideSection';
import PrecautionsSection from './PrecautionsSection';
import ASInfoSection from './ASInfoSection';
import { RegionOverlay, ColorPickerPopup } from './RegionOverlay';
import {
    ClothingRegion,
    detectClothingRegions,
    changeRegionColor,
    replaceRegionClothing
} from '../services/modelSegmentationService';
import { ModelAnalysis } from '../services/analyzeModel';
import { FilterPresetName, getFilterStyles } from '../services/photoFilterService';

// Helper Overlay Component
const FilterOverlay = ({ activeFilter }: { activeFilter?: FilterPresetName; }) => {
    if (!activeFilter || activeFilter === 'original') return null;
    const styles = React.useMemo(() => getFilterStyles(activeFilter), [activeFilter]);
    return (
        <>
            <div style={styles.overlayStyle} />
            <div style={styles.grainStyle} />
            <div style={styles.glowStyle} />
        </>
    );
};


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
    flippedSections?: Set<string>;
    activeFilter?: FilterPresetName;
    modelAnalysis?: { [key: string]: ModelAnalysis };
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
    onDeleteLineElement,
    flippedSections = new Set(),
    activeFilter = 'original',
    modelAnalysis = {}
}, ref) => {
    // Filter Styles Memo
    const filterStyles = React.useMemo(() => activeFilter !== 'original' ? getFilterStyles(activeFilter) : null, [activeFilter]);
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

    // 그리드 셀 이미지 변환 상태 (확대/축소 및 위치)
    const [gridCellTransforms, setGridCellTransforms] = React.useState<{
        [cellKey: string]: { scale: number; x: number; y: number };
    }>({});

    // 그리드 셀 이미지 패닝 상태
    const [gridCellPanningState, setGridCellPanningState] = React.useState<{
        cellKey: string | null;
        startX: number;
        startY: number;
        initialX: number;
        initialY: number;
    }>({ cellKey: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });

    // 그리드 셀 컬럼 너비 상태 (fr 비율)
    const [gridColumnWidths, setGridColumnWidths] = React.useState<{
        [sectionKey: string]: number[];
    }>({});

    // 그리드 셀 컬럼 리사이즈 드래그 상태
    const [gridColumnResizeState, setGridColumnResizeState] = React.useState<{
        sectionKey: string | null;
        columnIndex: number;
        startX: number;
        initialWidths: number[];
    }>({ sectionKey: null, columnIndex: 0, startX: 0, initialWidths: [] });

    const [contextMenuState, setContextMenuState] = React.useState<{
        visible: boolean;
        x: number;
        y: number;
        sectionId: string | null;
    }>({ visible: false, x: 0, y: 0, sectionId: null });

    // 의류 부위 감지 상태 (섹션별)
    const [sectionRegions, setSectionRegions] = useState<{
        [sectionId: string]: ClothingRegion[];
    }>({});

    // 색상 변경 팝업 상태
    const [colorPickerState, setColorPickerState] = useState<{
        visible: boolean;
        x: number;
        y: number;
        region: ClothingRegion | null;
        sectionId: string | null;
    }>({ visible: false, x: 0, y: 0, region: null, sectionId: null });

    // AI 처리 중 상태
    const [processingRegion, setProcessingRegion] = useState<string | null>(null);

    // 분석 중인 섹션 상태 (애니메이션 표시용)
    const [analyzingSections, setAnalyzingSections] = useState<Set<string>>(new Set());

    const sectionRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});
    const imageTransformsRef = React.useRef(imageTransforms);

    // Keep ref in sync
    React.useEffect(() => {
        imageTransformsRef.current = imageTransforms;
    }, [imageTransforms]);

    // Native Wheel Listener for strict scroll blocking
    React.useEffect(() => {
        const cleanupFns: (() => void)[] = [];

        sectionOrder.forEach(sectionKey => {
            const isGlobalEditOn = isHoldOn;
            const isSelected = selectedSections?.has(sectionKey) || forceEditSections.has(sectionKey);

            if (isGlobalEditOn || isSelected) {
                const el = sectionRefs.current[sectionKey];
                const imgEl = el?.querySelector('img');

                if (imgEl) {
                    const handler = (e: WheelEvent) => {
                        // Strict prevention of invalid scrolls
                        e.preventDefault();
                        e.stopPropagation();

                        if (heldSections.has(sectionKey)) return;
                        if (!onUpdateImageTransform) return;

                        const currentTransform = imageTransformsRef.current[sectionKey] || { scale: 1, x: 0, y: 0 };
                        const delta = e.deltaY > 0 ? -0.1 : 0.1;
                        const newScale = Math.max(0.1, Math.min(5.0, currentTransform.scale + delta));

                        onUpdateImageTransform(sectionKey, {
                            ...currentTransform,
                            scale: newScale
                        });
                    };

                    imgEl.addEventListener('wheel', handler, { passive: false });
                    cleanupFns.push(() => imgEl.removeEventListener('wheel', handler));
                }
            }
        });

        return () => cleanupFns.forEach(fn => fn());
    }, [sectionOrder, selectedSections, isHoldOn, forceEditSections, heldSections, onUpdateImageTransform]);

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
                setColorPickerState(prev => ({ ...prev, visible: false }));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedLineId, onDeleteLineElement]);

    // 모델 홀드 시 세그멘테이션 실행
    useEffect(() => {
        const runSegmentation = async () => {
            for (const sectionId of Array.from(heldSections)) {
                // 이미 분석한 섹션은 스킵
                if (sectionRegions[sectionId]) continue;

                // 해당 섹션의 이미지 URL 찾기
                const imageUrl = data.imageUrls?.[sectionId] ||
                    data.imageUrls?.[`${sectionId}-0`] ||
                    (Array.isArray(data.imageUrls?.[sectionId]) ? data.imageUrls[sectionId][0] : null);

                if (imageUrl && typeof imageUrl === 'string') {
                    // 분석 시작 - 애니메이션 표시
                    setAnalyzingSections(prev => new Set([...prev, sectionId]));

                    try {
                        console.log(`🔍 Running segmentation for section: ${sectionId}`);
                        const result = await detectClothingRegions(imageUrl);
                        setSectionRegions(prev => ({
                            ...prev,
                            [sectionId]: result.regions
                        }));
                    } catch (error) {
                        console.error(`Segmentation failed for ${sectionId}:`, error);
                    } finally {
                        // 분석 완료 - 애니메이션 제거
                        setAnalyzingSections(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(sectionId);
                            return newSet;
                        });
                    }
                }
            }
        };

        if (heldSections.size > 0) {
            runSegmentation();
        }
    }, [heldSections, data.imageUrls]);

    // 부위 색상 변경 핸들러
    const handleRegionColorChange = useCallback(async (sectionId: string, region: ClothingRegion, color: string) => {
        const imageUrl = data.imageUrls?.[sectionId];
        if (!imageUrl) return;

        setProcessingRegion(`${sectionId}-${region.type}`);
        try {
            const result = await changeRegionColor(imageUrl, region, color);
            // Check if result already has data URI prefix
            const finalImage = result.startsWith('data:') ? result : `data:image/png;base64,${result}`;
            onAction?.('updateImage', sectionId, 0, finalImage);
        } catch (error) {
            console.error('Color change failed:', error);
            alert('색상 변경에 실패했습니다.');
        } finally {
            setProcessingRegion(null);
        }
    }, [data.imageUrls, onAction]);

    // 부위 의류 교체 핸들러
    const handleRegionClothingDrop = useCallback(async (sectionId: string, region: ClothingRegion, file: File) => {
        const modelImageUrl = data.imageUrls?.[sectionId];
        if (!modelImageUrl) return;

        setProcessingRegion(`${sectionId}-${region.type}`);
        try {
            // File을 base64로 변환
            const reader = new FileReader();
            const clothingBase64 = await new Promise<string>((resolve) => {
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(file);
            });

            const result = await replaceRegionClothing(modelImageUrl, region, clothingBase64);
            // Check if result already has data URI prefix
            const finalImage = result.startsWith('data:') ? result : `data:image/png;base64,${result}`;
            onAction?.('updateImage', sectionId, 0, finalImage);
        } catch (error) {
            console.error('Clothing replacement failed:', error);
            alert('의류 교체에 실패했습니다.');
        } finally {
            setProcessingRegion(null);
        }
    }, [data.imageUrls, onAction]);


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

        // If selected, ALWAYS prevent default to stop page scroll
        if (isSelected || isGlobalEditOn) {
            if (e.cancelable && e.preventDefault) e.preventDefault();
            e.stopPropagation();
        }

        if (!isGlobalEditOn && !isSelected) return;

        // If Model Hold is active, LOCK movement (but we already prevented scroll above)
        if (heldSections.has(sectionId)) return;

        if (!onUpdateImageTransform) return;

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

    // 그리드 셀 이미지 패닝 핸들러
    React.useEffect(() => {
        if (!gridCellPanningState.cellKey) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - gridCellPanningState.startX;
            const deltaY = e.clientY - gridCellPanningState.startY;

            setGridCellTransforms(prev => ({
                ...prev,
                [gridCellPanningState.cellKey!]: {
                    ...(prev[gridCellPanningState.cellKey!] || { scale: 1, x: 0, y: 0 }),
                    x: gridCellPanningState.initialX + deltaX,
                    y: gridCellPanningState.initialY + deltaY
                }
            }));
        };

        const handleMouseUp = () => {
            setGridCellPanningState({ cellKey: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [gridCellPanningState]);

    // 그리드 셀 이미지 휠 줌 핸들러
    const handleGridCellWheel = (e: React.WheelEvent, cellKey: string) => {
        e.stopPropagation();
        const currentTransform = gridCellTransforms[cellKey] || { scale: 1, x: 0, y: 0 };
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(0.5, Math.min(3.0, currentTransform.scale + delta));

        setGridCellTransforms(prev => ({
            ...prev,
            [cellKey]: { ...currentTransform, scale: newScale }
        }));
    };

    // 그리드 셀 이미지 드래그 시작 핸들러
    const handleGridCellMouseDown = (e: React.MouseEvent, cellKey: string) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const currentTransform = gridCellTransforms[cellKey] || { scale: 1, x: 0, y: 0 };

        setGridCellPanningState({
            cellKey,
            startX: e.clientX,
            startY: e.clientY,
            initialX: currentTransform.x,
            initialY: currentTransform.y
        });
    };

    // 그리드 컬럼 리사이즈 시작 핸들러
    const handleGridColumnResizeStart = (e: React.MouseEvent, sectionKey: string, columnIndex: number, cols: number) => {
        e.preventDefault();
        e.stopPropagation();

        // 기존 너비 가져오거나 기본값 생성
        const currentWidths = gridColumnWidths[sectionKey] || Array(cols).fill(1);

        setGridColumnResizeState({
            sectionKey,
            columnIndex,
            startX: e.clientX,
            initialWidths: [...currentWidths]
        });
    };

    // 그리드 컬럼 리사이즈 useEffect
    React.useEffect(() => {
        if (!gridColumnResizeState.sectionKey) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - gridColumnResizeState.startX;
            const pixelPerFr = 100; // 1fr당 픽셀 수 (대략적)
            const deltaFr = deltaX / pixelPerFr;

            const newWidths = [...gridColumnResizeState.initialWidths];
            const colIndex = gridColumnResizeState.columnIndex;

            // 왼쪽 컬럼 확대, 오른쪽 컬럼 축소 (최소 0.2fr)
            newWidths[colIndex] = Math.max(0.2, gridColumnResizeState.initialWidths[colIndex] + deltaFr);
            if (colIndex + 1 < newWidths.length) {
                newWidths[colIndex + 1] = Math.max(0.2, gridColumnResizeState.initialWidths[colIndex + 1] - deltaFr);
            }

            setGridColumnWidths(prev => ({
                ...prev,
                [gridColumnResizeState.sectionKey!]: newWidths
            }));
        };

        const handleMouseUp = () => {
            setGridColumnResizeState({ sectionKey: null, columnIndex: 0, startX: 0, initialWidths: [] });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [gridColumnResizeState]);

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
                            border: isDragging ? '1px dashed black' : '1px solid transparent',
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
                                    stroke="black"
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
                                fill={selectedLineId === line.id ? 'black' : line.strokeColor}
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
                                fill={selectedLineId === line.id ? 'black' : line.strokeColor}
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

    // Get transition settings from data
    const enableTransitions = data.enableTransitions !== false;
    const transitionType = data.transitionType || 'fade';
    const transitionDuration = data.transitionDuration || 0.5;

    // Transition CSS classes and styles
    const getTransitionStyle = () => {
        if (!enableTransitions) return {};
        switch (transitionType) {
            case 'slide':
                return { animation: `slideIn ${transitionDuration}s ease-out` };
            case 'zoom':
                return { animation: `zoomIn ${transitionDuration}s ease-out` };
            case 'fade':
            default:
                return { animation: `fadeIn ${transitionDuration}s ease-out` };
        }
    };

    return (
        <div
            ref={ref}
            className="preview-panel bg-white shadow-lg pb-8 relative"
            style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}
        >
            {/* Transition Animation Styles */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes zoomIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .section-transition {
                    animation-fill-mode: both;
                }
            `}</style>

            {/* Custom Context Menu - Rendered via Portal - REMOVED to use parent's menu */}
            {null}

            {sectionOrder.map((sectionKey) => {
                // Content Section: Size Guide
                if (sectionKey === 'size-guide') {
                    // Hide if panel is collapsed (showSizeGuide === false)
                    if (data.showSizeGuide === false) return null;
                    return (
                        <div
                            key={sectionKey}
                            data-section={sectionKey}
                            className="section-transition"
                            style={getTransitionStyle()}
                        >
                            <SizeGuideSection
                                visible={data.detailTextContent?.sizeGuide?.visible !== false}
                                productImage={
                                    // 1. First try generated sketch image
                                    data.imageUrls?.['sizeGuide-0'] ||
                                    // 2. Then try original product file
                                    (data.productFiles?.[0] ? URL.createObjectURL(data.productFiles[0]) : null) ||
                                    // 3. Fallback to any existing data URL in imageUrls
                                    (Object.values(data.imageUrls || {}).find((url: any) => typeof url === 'string' && url.startsWith('data:')) as string) ||
                                    // 4. Or try hero/products image
                                    data.imageUrls?.['hero'] ||
                                    (Array.isArray(data.imageUrls?.['products']) ? data.imageUrls['products'][0] : null)
                                }
                                sizeData={{
                                    productSpec: data.heroTextContent?.productSpec,
                                    heightSpec: data.heroTextContent?.heightSpec,
                                    customContent: data.heroTextContent?.sizeGuide,
                                    specs: {
                                        length: data.sizeGuideContent?.specLength || '280',
                                        width: data.sizeGuideContent?.specWidth || '100',
                                        heel: data.sizeGuideContent?.specHeel || '35'
                                    },
                                    disclaimer: data.detailTextContent?.sizeGuide?.disclaimer,
                                    // Pass live update values from AdjustmentPanel
                                    sizeLevel: data.sizeGuideContent?.sizeLevel,
                                    widthLevel: data.sizeGuideContent?.widthLevel,
                                    weightLevel: data.sizeGuideContent?.weightLevel,
                                    // Convert mm to cm for display (divide by 10)
                                    totalLength: data.sizeGuideContent?.specLength
                                        ? `${(parseInt(data.sizeGuideContent.specLength) / 10).toFixed(1)}cm`
                                        : (data.heroTextContent?.totalLength || '28cm'),
                                    totalHeight: data.sizeGuideContent?.specWidth
                                        ? `${(parseInt(data.sizeGuideContent.specWidth) / 10).toFixed(1)}cm`
                                        : (data.heroTextContent?.totalHeight || '10cm'),
                                    heelHeight: data.sizeGuideContent?.specHeel
                                        ? `${(parseInt(data.sizeGuideContent.specHeel) / 10).toFixed(1)}cm`
                                        : (data.heroTextContent?.heelHeight || '3.5cm')
                                }}
                            />
                        </div>
                    );
                }

                // Content Section: A/S Info
                if (sectionKey === 'as-info') {
                    // Hide if panel is collapsed (showASInfo === false)
                    if (data.showASInfo === false) return null;
                    return (
                        <div
                            key={sectionKey}
                            data-section={sectionKey}
                            className="section-transition"
                            style={getTransitionStyle()}
                        >
                            <ASInfoSection
                                visible={true}
                                asData={data.detailTextContent?.asInfo}
                                customContent={data.aiGeneratedContent?.asInfo}
                                panelContent={data.asInfoContent}
                            />
                        </div>
                    );
                }

                // Content Section: Precautions
                if (sectionKey === 'precautions') {
                    // Hide if panel is collapsed (showPrecautions === false)
                    if (data.showPrecautions === false) return null;
                    return (
                        <div
                            key={sectionKey}
                            data-section={sectionKey}
                            className="section-transition"
                            style={getTransitionStyle()}
                        >
                            <PrecautionsSection
                                visible={true}
                                precautionsData={data.detailTextContent?.precautions}
                                content={data.aiGeneratedContent?.cautions}
                                panelContent={data.precautionsContent}
                            />
                        </div>
                    );
                }

                if (sectionKey === 'hero') {
                    return (
                        <div
                            key={sectionKey}
                            className={`relative section-transition`}
                            style={getTransitionStyle()}
                            onClick={(e) => { e.stopPropagation(); }}
                            ref={el => { sectionRefs.current[sectionKey] = el; }}
                            data-section={sectionKey}
                            onContextMenu={(e) => handleContextMenu(e, sectionKey)}
                        >
                            <HeroSection content={data.heroTextContent} fieldSettings={data.heroFieldSettings} fieldOrder={data.heroFieldOrder} fontFamily={data.heroFontFamily} />
                            {renderTextElements(sectionKey)}
                            {renderLineElements(sectionKey)}
                        </div>
                    );
                }

                // Grid Sections (Collage)
                if (sectionKey.startsWith('grid-') && gridSections[sectionKey]) {
                    const grid = gridSections[sectionKey];
                    const gridHeight = sectionHeights[sectionKey] || grid.height;

                    // 컬럼 너비 가져오거나 기본값 생성
                    const columnWidths = gridColumnWidths[sectionKey] || Array(grid.cols).fill(1);
                    const templateColumns = columnWidths.map(w => `${w}fr`).join(' ');

                    return (
                        <div
                            key={sectionKey}
                            data-section={sectionKey}
                            ref={el => { sectionRefs.current[sectionKey] = el; }}
                            className={`relative group section-transition`}
                            style={{ height: `${gridHeight}px`, ...getTransitionStyle() }}
                            onContextMenu={(e) => handleContextMenu(e, sectionKey)}
                        >
                            {/* Grid Layout */}
                            <div
                                className="w-full h-full grid gap-0 p-1 bg-gray-100 relative"
                                style={{
                                    gridTemplateColumns: templateColumns,
                                    gridTemplateRows: `repeat(${grid.rows}, 1fr)`
                                }}
                            >
                                {grid.cells.map((cellImage, cellIdx) => {
                                    const colIdx = cellIdx % grid.cols;
                                    const isLastCol = colIdx === grid.cols - 1;

                                    return (
                                        <div key={`${sectionKey}-cell-${cellIdx}`} className="relative">
                                            <div
                                                className={`absolute inset-0 overflow-hidden bg-gray-200 border border-gray-300 
                                                    flex items-center justify-center cursor-pointer 
                                                    hover:border-gray-400 hover:bg-gray-50 transition-colors`}
                                                style={{ margin: '2px' }}
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
                                                    if (cellImage) return; // 이미지가 있으면 클릭 업로드 비활성화
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
                                                    <div
                                                        className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
                                                        onMouseDown={(e) => handleGridCellMouseDown(e, `${sectionKey}-${cellIdx}`)}
                                                        onWheel={(e) => handleGridCellWheel(e, `${sectionKey}-${cellIdx}`)}
                                                    >
                                                        <img
                                                            src={cellImage}
                                                            alt={`Cell ${cellIdx + 1}`}
                                                            className="w-full h-full object-cover select-none pointer-events-none"
                                                            draggable={false}
                                                            style={{
                                                                transform: `scale(${(gridCellTransforms[`${sectionKey}-${cellIdx}`]?.scale || 1)}) translate(${(gridCellTransforms[`${sectionKey}-${cellIdx}`]?.x || 0)}px, ${(gridCellTransforms[`${sectionKey}-${cellIdx}`]?.y || 0)}px)`,
                                                                transformOrigin: 'center center',
                                                                ...(filterStyles?.containerStyle || {})
                                                            }}
                                                        />
                                                        {filterStyles && <FilterOverlay activeFilter={activeFilter} />}
                                                        {/* 리셋 버튼 */}
                                                        <button
                                                            className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setGridCellTransforms(prev => ({
                                                                    ...prev,
                                                                    [`${sectionKey}-${cellIdx}`]: { scale: 1, x: 0, y: 0 }
                                                                }));
                                                            }}
                                                            title="리셋"
                                                        >
                                                            ↺
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="text-gray-400 text-center">
                                                        <div className="text-2xl mb-1">+</div>
                                                        <div className="text-xs">{cellIdx + 1}</div>
                                                    </div>
                                                )}
                                            </div>
                                            {/* 컬럼 리사이즈 핸들 (마지막 컬럼 제외) */}
                                            {!isLastCol && (
                                                <div
                                                    className="absolute top-0 right-0 w-2 h-full cursor-ew-resize z-10 hover:bg-gray-500/50 transition-colors"
                                                    style={{ transform: 'translateX(50%)' }}
                                                    onMouseDown={(e) => handleGridColumnResizeStart(e, sectionKey, colIdx, grid.cols)}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Resize Handle */}
                            <div
                                className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-gray-300 to-transparent cursor-ns-resize hover:from-gray-400"
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
                const isEditable = isHoldOn || forceEditSections.has(sectionKey) || selectedSections.has(sectionKey);
                const isFlipped = flippedSections.has(sectionKey);

                return (
                    <div
                        key={sectionKey}
                        data-section={sectionKey}
                        ref={el => { sectionRefs.current[sectionKey] = el; }}
                        className={`relative group overflow-hidden section-transition ${isHeld ? 'border-4 border-red-500' : ''}`}
                        style={{
                            height: styleHeight,
                            minHeight: isPlaceholder ? '200px' : 'auto',
                            boxSizing: 'border-box',
                            ...getTransitionStyle()
                        }}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, sectionKey)}
                        onClick={() => { /* Click disabled for upload */ }}
                        onContextMenu={(e) => handleContextMenu(e, sectionKey)}
                    >
                        {isPlaceholder ? (
                            <div className="w-full h-full border border-gray-100 flex flex-col items-center justify-center bg-white transition-colors box-border min-h-[200px] relative group">
                                {isLoading ? (
                                    // 로딩 스피너 표시
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-500 border-t-transparent mb-4"></div>
                                        <div className="text-gray-500 font-bold text-lg">이미지 생성 중...</div>
                                        <div className="text-gray-400 text-sm mt-2">잠시만 기다려주세요</div>
                                    </div>
                                ) : (
                                    // Empty Canvas State - No click to upload, only Drag & Drop
                                    // Added resize handle capability by rendering it absolutely at bottom
                                    <>
                                        {/* Optional: Visual hint only on hover or drag over logic in parent */}
                                        <div className="opacity-0 group-hover:opacity-100 text-gray-300 text-xs pointer-events-none">
                                            드래그하여 이미지 추가
                                        </div>

                                        {/* Resize Handle for Empty Section */}
                                        <div
                                            className="absolute bottom-0 left-0 right-0 h-4 bg-transparent cursor-ns-resize hover:bg-black/5 transition-colors z-20"
                                            onMouseDown={(e) => handleResizeMouseDown(e, sectionKey, explicitHeight || 200)}
                                            style={{ touchAction: 'none' }}
                                        />
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
                                        transform: `${isFlipped ? 'scaleX(-1) ' : ''}scale(${transform.scale}) translate(${transform.x}px, ${transform.y}px)`,
                                        transformOrigin: 'center center',
                                        transition: panningState.sectionId === sectionKey ? 'none' : 'transform 0.1s ease-out',
                                        ...(filterStyles?.containerStyle || {})
                                    }}
                                    draggable={false}
                                    onMouseDown={(e) => handleImageMouseDown(e, sectionKey)}
                                    /* onWheel removed in favor of native listener */
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
                                {filterStyles && <FilterOverlay activeFilter={activeFilter} />}

                                {/* Processing Overlay */}
                                {processingSections?.has(sectionKey) && (
                                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                                        <div className="px-4 py-2 bg-black/60 rounded-lg text-white font-bold shadow-lg flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                            <span>얼굴을 합성중입니다...</span>
                                        </div>
                                    </div>
                                )}



                                {/* Face Analysis Overlay (Only in Hold Mode) */}
                                {isHeld && modelAnalysis?.[sectionKey]?.regions?.map((region, idx) => (
                                    region.type === 'face' && (
                                        <div
                                            key={`face-${idx}`}
                                            className="absolute border-2 border-green-400 z-30 pointer-events-none shadow-[0_0_10px_rgba(74,222,128,0.5)]"
                                            style={{
                                                left: `${((region.x || 0.5) - (region.width || 0) / 2) * 100}%`,
                                                top: `${((region.y || 0.5) - (region.height || 0) / 2) * 100}%`,
                                                width: `${(region.width || 0) * 100}%`,
                                                height: `${(region.height || 0) * 100}%`
                                            }}
                                        >
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap flex items-center gap-1">
                                                <span>FACE DETECTED</span>
                                                <span className="opacity-75 text-[9px]">{(region.confidence * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    )
                                ))}

                                {/* Analyzing Overlay - 분석 중 애니메이션 */}
                                {analyzingSections.has(sectionKey) && (
                                    <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
                                        {/* 스캔 라인 애니메이션 */}
                                        <div
                                            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                                            style={{
                                                animation: 'scanLine 2s ease-in-out infinite',
                                                boxShadow: '0 0 20px 10px rgba(34, 211, 238, 0.3)'
                                            }}
                                        />
                                        {/* 반투명 오버레이 */}
                                        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
                                        {/* 분석 중 텍스트 */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <div className="flex items-center gap-3 bg-black/70 px-6 py-4 rounded-2xl shadow-2xl border border-cyan-400/30">
                                                <div className="relative">
                                                    <div className="w-8 h-8 border-3 border-cyan-400/30 rounded-full" />
                                                    <div className="absolute inset-0 w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                                </div>
                                                <div>
                                                    <div className="text-cyan-400 font-bold text-lg">🔍 분석 중입니다...</div>
                                                    <div className="text-white/60 text-xs mt-1">의류 부위를 감지하고 있어요</div>
                                                </div>
                                            </div>
                                        </div>
                                        <style>{`
                                            @keyframes scanLine {
                                                0% { top: 0%; opacity: 0; }
                                                10% { opacity: 1; }
                                                90% { opacity: 1; }
                                                100% { top: 100%; opacity: 0; }
                                            }
                                        `}</style>
                                    </div>
                                )}
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
                                {/* Region Overlay - 모델 홀드 시 부위별 호버/클릭 인터랙션 */}
                                {isHeld && sectionRegions[sectionKey] && (
                                    <RegionOverlay
                                        regions={sectionRegions[sectionKey]}
                                        isActive={isHeld}
                                        containerWidth={sectionRefs.current[sectionKey]?.clientWidth || 400}
                                        containerHeight={sectionRefs.current[sectionKey]?.clientHeight || 600}
                                        onRegionRightClick={(region, e) => {
                                            setColorPickerState({
                                                visible: true,
                                                x: e.clientX,
                                                y: e.clientY,
                                                region,
                                                sectionId: sectionKey
                                            });
                                        }}
                                        onRegionDrop={(region, file) => {
                                            handleRegionClothingDrop(sectionKey, region, file);
                                        }}
                                    />
                                )}
                                {/* Processing Region Overlay */}
                                {processingRegion?.startsWith(sectionKey) && (
                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-40">
                                        <div className="animate-spin rounded-full h-10 w-10 border-3 border-white border-t-transparent mb-3"></div>
                                        <div className="text-white text-sm font-semibold">AI 처리 중...</div>
                                    </div>
                                )}
                            </div>
                        )}
                        {renderTextElements(sectionKey)}
                        {renderLineElements(sectionKey)}

                        {/* Resize Handle - Only when editable (minimap ON or section selected) */}
                        {!isPlaceholder && isEditable && (
                            <div
                                className="absolute bottom-0 left-0 w-full h-5 cursor-ns-resize z-50 flex items-center justify-center bg-gradient-to-t from-gray-500/30 to-transparent hover:from-gray-500/50 transition-all"
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

            {/* 색상 변경 팝업 */}
            <ColorPickerPopup
                visible={colorPickerState.visible}
                x={colorPickerState.x}
                y={colorPickerState.y}
                region={colorPickerState.region}
                onColorSelect={(color) => {
                    if (colorPickerState.region && colorPickerState.sectionId) {
                        handleRegionColorChange(colorPickerState.sectionId, colorPickerState.region, color);
                    }
                }}
                onClose={() => setColorPickerState(prev => ({ ...prev, visible: false }))}
            />
        </div>
    );
});

PreviewPanel.displayName = 'PreviewPanel';
