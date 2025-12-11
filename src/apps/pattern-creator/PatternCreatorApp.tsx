import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import {
    RenderedShoe,
    GeneratedShoe,
    VectorPath,
    BezierPoint,
    renderSideView,
    applyPattern,
    renderVectorPaths,
    pathsToPhoto,
    extractPattern,
    extractComponentPattern
} from '../../services/patternService';

// ============ 상수 ============
const colors = {
    bgBase: '#1a1a1a',
    bgSurface: '#2d2d2d',
    bgSubtle: '#252525',
    borderSoft: '#3d3d3d',
    textPrimary: '#ffffff',
    textSecondary: '#a0a0a0',
    textMuted: '#666666',
    accentPrimary: '#6366f1',
    accentHover: '#818cf8',
    danger: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b'
};

const MAX_CANVAS_IMAGES = 20;

// ============ 타입 정의 ============
interface CanvasImage {
    id: string;
    url: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    role: 'none' | 'base' | 'pattern'; // 역할: 미지정 / 베이스 / 패턴
    isProcessing?: boolean;
    renderedUrl?: string; // AI 렌더링된 이미지 (베이스 지정 시)
}

interface GeneratedShoeItem {
    id: string;
    url: string;
    sourcePatternId: string;
    position: { x: number; y: number };
}

interface ContextMenuState {
    x: number;
    y: number;
    targetId: string;
    targetType: 'canvas' | 'generated';
}

// ============ 메인 컴포넌트 ============
export default function PatternCreatorApp() {
    const navigate = useNavigate();

    // 캔버스 이미지 상태
    const [canvasImages, setCanvasImages] = useState<CanvasImage[]>([]);
    const [generatedShoes, setGeneratedShoes] = useState<GeneratedShoeItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // 캔버스 상태
    const [zoom, setZoom] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // 컨텍스트 메뉴
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    // 편집 모드
    const [editingMode, setEditingMode] = useState<'none' | 'vector'>('none');
    const [vectorPaths, setVectorPaths] = useState<VectorPath[]>([]);
    const [editingImageId, setEditingImageId] = useState<string | null>(null);
    const [editingBackgroundImage, setEditingBackgroundImage] = useState<string | null>(null);

    // 로딩 상태
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingMessage, setProcessingMessage] = useState('');

    // Refs
    const canvasRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 드래그 상태
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // 리사이즈 상태
    const [resizingId, setResizingId] = useState<string | null>(null);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

    // ============ 파일 처리 ============
    const processFile = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
        });
    };

    // ============ 이미지 업로드 (렌더링 없이 원본 표시) ============
    const handleImageUpload = async (files: FileList | null) => {
        if (!files) return;

        const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
        const remaining = MAX_CANVAS_IMAGES - canvasImages.length;
        const toProcess = fileArray.slice(0, remaining);

        for (let i = 0; i < toProcess.length; i++) {
            const file = toProcess[i];
            const url = await processFile(file);
            const id = `img-${Date.now()}-${i}`;

            // 이미지 크기 계산
            const img = new Image();
            img.src = url;
            await new Promise(resolve => { img.onload = resolve; });

            const maxSize = 300;
            const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
            const width = img.width * scale;
            const height = img.height * scale;

            // 캔버스에 배치 (기존 이미지 옆에)
            const existingCount = canvasImages.length + i;
            const col = existingCount % 4;
            const row = Math.floor(existingCount / 4);

            const newImage: CanvasImage = {
                id,
                url,
                position: { x: 50 + col * (width + 30), y: 50 + row * (height + 30) },
                size: { width, height },
                role: 'none'
            };

            setCanvasImages(prev => [...prev, newImage]);
        }
    };

    // ============ 캔버스 드래그앤드롭 ============
    const handleCanvasDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        handleImageUpload(e.dataTransfer.files);
    };

    // ============ 휠 줌 (커서 기준) ============
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.1), 5);

        const zoomRatio = newZoom / zoom;
        setPanOffset({
            x: mouseX - (mouseX - panOffset.x) * zoomRatio,
            y: mouseY - (mouseY - panOffset.y) * zoomRatio
        });
        setZoom(newZoom);
    }, [zoom, panOffset]);

    // ============ 패닝 ============
    const handlePanStart = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            e.preventDefault();
            setIsPanning(true);
            setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        }
    };

    const handlePanMove = useCallback((e: MouseEvent) => {
        if (!isPanning) return;
        setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }, [isPanning, panStart]);

    const handlePanEnd = useCallback(() => setIsPanning(false), []);

    useEffect(() => {
        if (isPanning) {
            window.addEventListener('mousemove', handlePanMove);
            window.addEventListener('mouseup', handlePanEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handlePanMove);
            window.removeEventListener('mouseup', handlePanEnd);
        };
    }, [isPanning, handlePanMove, handlePanEnd]);

    // ============ 우클릭 컨텍스트 메뉴 ============
    const handleContextMenu = (e: React.MouseEvent, targetId: string, targetType: 'canvas' | 'generated') => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, targetId, targetType });
    };

    const closeContextMenu = () => setContextMenu(null);

    useEffect(() => {
        const handleClick = () => closeContextMenu();
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // ============ 베이스로 지정 (여기서 렌더링!) ============
    const handleSetAsBase = async (imageId: string) => {
        closeContextMenu();

        const image = canvasImages.find(img => img.id === imageId);
        if (!image) return;

        // 기존 베이스 해제
        setCanvasImages(prev => prev.map(img => ({
            ...img,
            role: img.id === imageId ? 'base' : (img.role === 'base' ? 'none' : img.role),
            isProcessing: img.id === imageId ? true : img.isProcessing
        })));

        setIsProcessing(true);
        setProcessingMessage('베이스 신발을 측면 뷰로 렌더링 중...');

        try {
            const renderedUrl = await renderSideView(image.url);
            setCanvasImages(prev => prev.map(img =>
                img.id === imageId
                    ? { ...img, renderedUrl, isProcessing: false }
                    : img
            ));
        } catch (error) {
            console.error('Side view rendering failed:', error);
            setCanvasImages(prev => prev.map(img =>
                img.id === imageId
                    ? { ...img, renderedUrl: img.url, isProcessing: false }
                    : img
            ));
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    // ============ 패턴으로 지정 ============
    const handleSetAsPattern = async (imageId: string) => {
        closeContextMenu();

        setCanvasImages(prev => prev.map(img => ({
            ...img,
            role: img.id === imageId ? 'pattern' : img.role,
            isProcessing: img.id === imageId ? true : img.isProcessing
        })));

        const image = canvasImages.find(img => img.id === imageId);
        if (!image) return;

        setIsProcessing(true);
        setProcessingMessage('패턴 신발 측면 뷰 렌더링 중...');

        try {
            const renderedUrl = await renderSideView(image.url);
            setCanvasImages(prev => prev.map(img =>
                img.id === imageId
                    ? { ...img, renderedUrl, isProcessing: false }
                    : img
            ));
        } catch (error) {
            console.error('Pattern rendering failed:', error);
            setCanvasImages(prev => prev.map(img =>
                img.id === imageId
                    ? { ...img, renderedUrl: img.url, isProcessing: false }
                    : img
            ));
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    // ============ 역할 해제 ============
    const handleClearRole = (imageId: string) => {
        closeContextMenu();
        setCanvasImages(prev => prev.map(img =>
            img.id === imageId
                ? { ...img, role: 'none', renderedUrl: undefined }
                : img
        ));
    };

    // ============ 패턴 적용 ============
    const handleApplyPattern = async (patternId: string) => {
        closeContextMenu();

        const baseImage = canvasImages.find(img => img.role === 'base');
        const patternImage = canvasImages.find(img => img.id === patternId);

        if (!baseImage || !patternImage) {
            alert('베이스 신발을 먼저 지정해주세요.');
            return;
        }

        setIsProcessing(true);
        setProcessingMessage('패턴을 적용 중...');

        try {
            const baseUrl = baseImage.renderedUrl || baseImage.url;
            const patternUrl = patternImage.renderedUrl || patternImage.url;

            const resultUrl = await applyPattern(baseUrl, patternUrl);

            const newGenerated: GeneratedShoeItem = {
                id: `gen-${Date.now()}`,
                url: resultUrl,
                sourcePatternId: patternId,
                position: { x: 400, y: 50 + generatedShoes.length * 280 }
            };
            setGeneratedShoes(prev => [...prev, newGenerated]);
        } catch (error) {
            console.error('Pattern apply failed:', error);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    // ============ 패턴 편집 ============
    const handleEditPattern = async (imageId: string, type: 'canvas' | 'generated') => {
        closeContextMenu();

        let imageUrl: string | null = null;
        if (type === 'canvas') {
            const img = canvasImages.find(i => i.id === imageId);
            imageUrl = img?.renderedUrl || img?.url || null;
        } else {
            const gen = generatedShoes.find(g => g.id === imageId);
            imageUrl = gen?.url || null;
        }

        if (!imageUrl) return;

        setIsProcessing(true);
        setProcessingMessage('벡터 패스 분석 중...');

        try {
            const { paths, backgroundImage } = await renderVectorPaths(imageUrl);
            setVectorPaths(paths);
            setEditingBackgroundImage(backgroundImage);
            setEditingImageId(imageId);
            setEditingMode('vector');
        } catch (error) {
            console.error('Vector path rendering failed:', error);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    // ============ 패턴 추출 ============
    const handleExtractPattern = async (imageId: string, type: 'canvas' | 'generated') => {
        closeContextMenu();

        let imageUrl: string | null = null;
        if (type === 'canvas') {
            const img = canvasImages.find(i => i.id === imageId);
            imageUrl = img?.renderedUrl || img?.url || null;
        } else {
            const gen = generatedShoes.find(g => g.id === imageId);
            imageUrl = gen?.url || null;
        }

        if (!imageUrl) return;

        setIsProcessing(true);
        setProcessingMessage('🔧 2D CAD 패턴 도면 추출 중...');

        try {
            const patternUrl = await extractPattern(imageUrl);
            const newGenerated: GeneratedShoeItem = {
                id: `pattern-extract-${Date.now()}`,
                url: patternUrl,
                sourcePatternId: imageId,
                position: { x: 400, y: 50 + generatedShoes.length * 280 }
            };
            setGeneratedShoes(prev => [...prev, newGenerated]);
        } catch (error) {
            console.error('Pattern extraction failed:', error);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    // ============ 부위별 패턴 추출 ============
    const handleExtractComponentPattern = async (
        imageId: string,
        type: 'canvas' | 'generated',
        component: 'vamp' | 'quarter' | 'tongue' | 'heel' | 'outsole'
    ) => {
        closeContextMenu();

        let imageUrl: string | null = null;
        if (type === 'canvas') {
            const img = canvasImages.find(i => i.id === imageId);
            imageUrl = img?.renderedUrl || img?.url || null;
        } else {
            const gen = generatedShoes.find(g => g.id === imageId);
            imageUrl = gen?.url || null;
        }

        if (!imageUrl) return;

        const componentNames = {
            vamp: '갑피(Vamp)',
            quarter: '쿼터(Quarter)',
            tongue: '설포(Tongue)',
            heel: '힐 카운터(Heel)',
            outsole: '아웃솔(Outsole)'
        };

        setIsProcessing(true);
        setProcessingMessage(`🔧 ${componentNames[component]} 패턴 추출 중...`);

        try {
            const patternUrl = await extractComponentPattern(imageUrl, component);
            const newGenerated: GeneratedShoeItem = {
                id: `component-${component}-${Date.now()}`,
                url: patternUrl,
                sourcePatternId: imageId,
                position: { x: 400 + Math.random() * 100, y: 50 + generatedShoes.length * 280 }
            };
            setGeneratedShoes(prev => [...prev, newGenerated]);
        } catch (error) {
            console.error(`${component} pattern extraction failed:`, error);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    // ============ 삭제 ============
    const handleDeleteImage = (imageId: string) => {
        closeContextMenu();
        setCanvasImages(prev => prev.filter(img => img.id !== imageId));
    };

    const handleDeleteGenerated = (shoeId: string) => {
        closeContextMenu();
        setGeneratedShoes(prev => prev.filter(g => g.id !== shoeId));
    };

    // ============ 이미지 드래그 ============
    const handleImageMouseDown = (e: React.MouseEvent, imageId: string) => {
        if (e.button !== 0 || e.altKey) return;
        e.stopPropagation();

        const image = canvasImages.find(img => img.id === imageId) || generatedShoes.find(g => g.id === imageId);
        if (!image) return;

        setDraggingId(imageId);
        setDragOffset({ x: e.clientX - image.position.x, y: e.clientY - image.position.y });
        setSelectedId(imageId);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!draggingId) return;

        const newPos = {
            x: (e.clientX - dragOffset.x - panOffset.x) / zoom,
            y: (e.clientY - dragOffset.y - panOffset.y) / zoom
        };

        // 캔버스 이미지 업데이트
        setCanvasImages(prev => prev.map(img =>
            img.id === draggingId ? { ...img, position: newPos } : img
        ));

        // 생성된 신발 업데이트
        setGeneratedShoes(prev => prev.map(g =>
            g.id === draggingId ? { ...g, position: newPos } : g
        ));
    }, [draggingId, dragOffset, zoom, panOffset]);

    const handleMouseUp = useCallback(() => setDraggingId(null), []);

    useEffect(() => {
        if (draggingId) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingId, handleMouseMove, handleMouseUp]);

    // ============ 이미지 리사이즈 ============
    const handleResizeMouseDown = (e: React.MouseEvent, imageId: string) => {
        e.stopPropagation();
        e.preventDefault();
        const img = canvasImages.find(i => i.id === imageId);
        if (!img) return;
        setResizingId(imageId);
        setResizeStart({ x: e.clientX, y: e.clientY, width: img.size.width, height: img.size.height });
    };

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (!resizingId) return;
        const deltaX = (e.clientX - resizeStart.x) / zoom;
        const deltaY = (e.clientY - resizeStart.y) / zoom;

        // 비율 유지하면서 리사이즈
        const newWidth = Math.max(50, resizeStart.width + deltaX);
        const aspectRatio = resizeStart.height / resizeStart.width;
        const newHeight = newWidth * aspectRatio;

        setCanvasImages(prev => prev.map(img =>
            img.id === resizingId ? { ...img, size: { width: newWidth, height: newHeight } } : img
        ));
    }, [resizingId, resizeStart, zoom]);

    const handleResizeUp = useCallback(() => setResizingId(null), []);

    useEffect(() => {
        if (resizingId) {
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeUp);
        };
    }, [resizingId, handleResizeMove, handleResizeUp]);

    // ============ 벡터 편집 완료 ============
    const handleFinishEditing = async () => {
        if (!editingBackgroundImage) return;

        setIsProcessing(true);
        setProcessingMessage('편집 내용을 사진으로 복원 중...');

        try {
            const resultUrl = await pathsToPhoto(vectorPaths, editingBackgroundImage);
            if (editingImageId) {
                // 생성된 신발 업데이트
                setGeneratedShoes(prev => prev.map(g =>
                    g.id === editingImageId ? { ...g, url: resultUrl } : g
                ));
            }
            setEditingMode('none');
            setVectorPaths([]);
            setEditingImageId(null);
            setEditingBackgroundImage(null);
        } catch (error) {
            console.error('Photo restoration failed:', error);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    const handleCancelEditing = () => {
        setEditingMode('none');
        setVectorPaths([]);
        setEditingImageId(null);
        setEditingBackgroundImage(null);
    };

    // ============ 자동 정렬 ============
    const handleAutoArrange = () => {
        const padding = 30;
        const maxItemsPerRow = 4;

        // 캔버스 이미지 정렬
        setCanvasImages(prev => {
            return prev.map((img, idx) => {
                const col = idx % maxItemsPerRow;
                const row = Math.floor(idx / maxItemsPerRow);
                return {
                    ...img,
                    position: {
                        x: padding + col * (img.size.width + padding),
                        y: padding + row * (img.size.height + padding)
                    }
                };
            });
        });

        // 생성된 신발 정렬 (오른쪽 영역)
        setGeneratedShoes(prev => {
            const startX = 500;
            return prev.map((shoe, idx) => ({
                ...shoe,
                position: {
                    x: startX,
                    y: padding + idx * 300
                }
            }));
        });

        // 뷰 리셋
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
    };

    // ============ 저장 ============
    const handleSave = async () => {
        if (!canvasRef.current) return;
        const canvas = await html2canvas(canvasRef.current, { backgroundColor: colors.bgBase, scale: 2 });
        const link = document.createElement('a');
        link.download = `pattern-design-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    };

    // ============ 베지어 곡선 렌더링 ============
    const renderBezierPath = (path: VectorPath): string => {
        if (path.points.length < 2) return '';
        let d = `M ${path.points[0].x} ${path.points[0].y}`;
        for (let i = 0; i < path.points.length - 1; i++) {
            const p1 = path.points[i];
            const p2 = path.points[i + 1];
            d += ` C ${p1.x + p1.handleOut.x} ${p1.y + p1.handleOut.y}, ${p2.x + p2.handleIn.x} ${p2.y + p2.handleIn.y}, ${p2.x} ${p2.y}`;
        }
        if (path.closed && path.points.length > 2) {
            const last = path.points[path.points.length - 1];
            const first = path.points[0];
            d += ` C ${last.x + last.handleOut.x} ${last.y + last.handleOut.y}, ${first.x + first.handleIn.x} ${first.y + first.handleIn.y}, ${first.x} ${first.y}`;
        }
        return d;
    };

    // ============ 베지어 포인트 드래그 ============
    const [draggingPoint, setDraggingPoint] = useState<{ pathId: string; pointIndex: number; type: 'anchor' | 'handleIn' | 'handleOut' } | null>(null);

    const handlePointMouseDown = (e: React.MouseEvent, pathId: string, pointIndex: number, type: 'anchor' | 'handleIn' | 'handleOut') => {
        e.stopPropagation();
        setDraggingPoint({ pathId, pointIndex, type });
    };

    const handlePointMouseMove = useCallback((e: MouseEvent) => {
        if (!draggingPoint || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - panOffset.x) / zoom;
        const y = (e.clientY - rect.top - panOffset.y) / zoom;

        setVectorPaths(prev => prev.map(path => {
            if (path.id !== draggingPoint.pathId) return path;
            return {
                ...path,
                points: path.points.map((point, idx) => {
                    if (idx !== draggingPoint.pointIndex) return point;
                    if (draggingPoint.type === 'anchor') {
                        return { ...point, x, y };
                    } else if (draggingPoint.type === 'handleIn') {
                        return { ...point, handleIn: { x: x - point.x, y: y - point.y } };
                    } else {
                        return { ...point, handleOut: { x: x - point.x, y: y - point.y } };
                    }
                })
            };
        }));
    }, [draggingPoint, zoom, panOffset]);

    const handlePointMouseUp = useCallback(() => setDraggingPoint(null), []);

    useEffect(() => {
        if (draggingPoint) {
            window.addEventListener('mousemove', handlePointMouseMove);
            window.addEventListener('mouseup', handlePointMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handlePointMouseMove);
            window.removeEventListener('mouseup', handlePointMouseUp);
        };
    }, [draggingPoint, handlePointMouseMove, handlePointMouseUp]);

    // ============ 헬퍼: 베이스 이미지 존재 여부 ============
    const hasBase = canvasImages.some(img => img.role === 'base');

    // ============ 렌더링 ============
    return (
        <div className="h-screen flex flex-col overflow-hidden" style={{ background: colors.bgBase, fontFamily: "-apple-system, sans-serif" }}>
            {/* 헤더 */}
            <header style={{ height: 56, borderBottom: `1px solid ${colors.borderSoft}` }} className="flex items-center justify-between px-6 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} style={{ color: colors.textSecondary }} className="hover:opacity-80">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 style={{ fontSize: 17, fontWeight: 600, color: colors.textPrimary }}>Pattern Creator</h1>
                    <span style={{ fontSize: 12, color: colors.textMuted, background: colors.bgSubtle, padding: '4px 8px', borderRadius: 4 }}>
                        {Math.round(zoom * 100)}%
                    </span>
                </div>
                <div className="flex gap-2">
                    {editingMode === 'vector' ? (
                        <>
                            <button onClick={handleCancelEditing} style={{ background: colors.bgSurface, color: colors.textPrimary, padding: '8px 16px', borderRadius: 8, border: `1px solid ${colors.borderSoft}`, fontSize: 13 }}>취소</button>
                            <button onClick={handleFinishEditing} style={{ background: colors.accentPrimary, color: '#FFF', padding: '8px 16px', borderRadius: 8, fontSize: 13 }}>최종 확인</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} style={{ background: colors.bgSurface, color: colors.textPrimary, padding: '8px 12px', borderRadius: 8, border: `1px solid ${colors.borderSoft}`, fontSize: 13 }}>리셋</button>
                            <button onClick={() => fileInputRef.current?.click()} style={{ background: colors.bgSurface, color: colors.textPrimary, padding: '8px 16px', borderRadius: 8, border: `1px solid ${colors.borderSoft}`, fontSize: 13 }}>
                                이미지 추가
                            </button>
                            <button onClick={handleAutoArrange} disabled={canvasImages.length === 0} style={{ background: colors.bgSurface, color: colors.textPrimary, padding: '8px 16px', borderRadius: 8, border: `1px solid ${colors.borderSoft}`, fontSize: 13 }} className="disabled:opacity-40">
                                자동 정렬
                            </button>
                            <button onClick={handleSave} disabled={canvasImages.length === 0} style={{ background: colors.accentPrimary, color: '#FFF', padding: '8px 16px', borderRadius: 8, fontSize: 13 }} className="disabled:opacity-40">저장</button>
                        </>
                    )}
                </div>
            </header>

            {/* 숨겨진 파일 인풋 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleImageUpload(e.target.files)}
            />

            {/* 메인 캔버스 영역 */}
            <div
                ref={canvasRef}
                className="flex-grow relative overflow-hidden"
                style={{ background: '#1a1a1a', cursor: isPanning ? 'grabbing' : (editingMode === 'vector' ? 'crosshair' : 'default') }}
                onWheel={handleWheel}
                onMouseDown={handlePanStart}
                onDragOver={e => e.preventDefault()}
                onDrop={handleCanvasDrop}
            >
                {/* 변환 컨테이너 */}
                <div style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    width: '100%',
                    height: '100%',
                    position: 'absolute'
                }}>
                    {/* 캔버스 이미지들 */}
                    {canvasImages.map(img => (
                        <div
                            key={img.id}
                            style={{
                                position: 'absolute',
                                left: img.position.x,
                                top: img.position.y,
                                width: img.size.width,
                                height: img.size.height,
                                cursor: 'move',
                                borderRadius: 12,
                                overflow: 'hidden',
                                border: img.role === 'base'
                                    ? `3px solid ${colors.success}`
                                    : img.role === 'pattern'
                                        ? `3px solid ${colors.warning}`
                                        : selectedId === img.id
                                            ? `2px solid ${colors.accentPrimary}`
                                            : `1px solid ${colors.borderSoft}`,
                                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                            }}
                            onMouseDown={e => handleImageMouseDown(e, img.id)}
                            onContextMenu={e => handleContextMenu(e, img.id, 'canvas')}
                        >
                            <img
                                src={img.renderedUrl || img.url}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                draggable={false}
                            />

                            {/* 역할 뱃지 */}
                            {img.role !== 'none' && (
                                <div style={{
                                    position: 'absolute',
                                    top: 8,
                                    left: 8,
                                    background: img.role === 'base' ? colors.success : colors.warning,
                                    color: '#000',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '4px 8px',
                                    borderRadius: 4
                                }}>
                                    {img.role === 'base' ? 'BASE' : 'PATTERN'}
                                </div>
                            )}

                            {/* 처리 중 오버레이 */}
                            {img.isProcessing && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}

                            {/* 리사이즈 핸들 */}
                            <div
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    bottom: 0,
                                    width: 16,
                                    height: 16,
                                    cursor: 'nwse-resize',
                                    background: 'linear-gradient(135deg, transparent 50%, #fff 50%)',
                                    opacity: selectedId === img.id ? 1 : 0.3
                                }}
                                onMouseDown={e => handleResizeMouseDown(e, img.id)}
                            />
                        </div>
                    ))}

                    {/* 생성된 신발들 */}
                    {generatedShoes.map(shoe => (
                        <div
                            key={shoe.id}
                            style={{
                                position: 'absolute',
                                left: shoe.position.x,
                                top: shoe.position.y,
                                cursor: 'move',
                                borderRadius: 12,
                                overflow: 'hidden',
                                border: `3px solid ${colors.accentPrimary}`,
                                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                            }}
                            onMouseDown={e => handleImageMouseDown(e, shoe.id)}
                            onContextMenu={e => handleContextMenu(e, shoe.id, 'generated')}
                        >
                            <img src={shoe.url} style={{ maxWidth: 350, maxHeight: 350, objectFit: 'contain' }} draggable={false} />
                            <div style={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                background: colors.accentPrimary,
                                color: '#FFF',
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '4px 8px',
                                borderRadius: 4
                            }}>
                                GENERATED
                            </div>
                        </div>
                    ))}

                    {/* 빈 상태 */}
                    {canvasImages.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center" style={{ color: colors.textMuted }}>
                                <span className="text-4xl block mb-6" style={{ opacity: 0.5 }}>+</span>
                                <p style={{ fontSize: 16, fontWeight: 500 }}>신발 이미지를 드래그하여 업로드</p>
                                <p style={{ fontSize: 13, marginTop: 8 }}>우클릭으로 베이스/패턴 지정</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 벡터 편집 오버레이 */}
                {editingMode === 'vector' && editingBackgroundImage && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
                        <div style={{ position: 'relative', width: 600, height: 600 }}>
                            <img src={editingBackgroundImage} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.5 }} />
                            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 1000 1000">
                                {vectorPaths.map(path => (
                                    <g key={path.id}>
                                        <path
                                            d={renderBezierPath(path)}
                                            fill="none"
                                            stroke={path.color}
                                            strokeWidth={path.style === 'stitch' ? 2 : 3}
                                            strokeDasharray={path.style === 'stitch' ? '8,4' : 'none'}
                                        />
                                        {path.points.map((point, idx) => (
                                            <g key={idx}>
                                                <line x1={point.x} y1={point.y} x2={point.x + point.handleIn.x} y2={point.y + point.handleIn.y} stroke="#888" strokeWidth={1} />
                                                <line x1={point.x} y1={point.y} x2={point.x + point.handleOut.x} y2={point.y + point.handleOut.y} stroke="#888" strokeWidth={1} />
                                                <circle
                                                    cx={point.x + point.handleIn.x} cy={point.y + point.handleIn.y} r={6}
                                                    fill="#6366f1" stroke="#fff" strokeWidth={2}
                                                    style={{ cursor: 'pointer' }}
                                                    onMouseDown={e => handlePointMouseDown(e, path.id, idx, 'handleIn')}
                                                />
                                                <circle
                                                    cx={point.x + point.handleOut.x} cy={point.y + point.handleOut.y} r={6}
                                                    fill="#6366f1" stroke="#fff" strokeWidth={2}
                                                    style={{ cursor: 'pointer' }}
                                                    onMouseDown={e => handlePointMouseDown(e, path.id, idx, 'handleOut')}
                                                />
                                                <rect
                                                    x={point.x - 6} y={point.y - 6} width={12} height={12}
                                                    fill="#fff" stroke={colors.accentPrimary} strokeWidth={2}
                                                    style={{ cursor: 'move' }}
                                                    onMouseDown={e => handlePointMouseDown(e, path.id, idx, 'anchor')}
                                                />
                                            </g>
                                        ))}
                                    </g>
                                ))}
                            </svg>
                        </div>
                    </div>
                )}
            </div>

            {/* 컨텍스트 메뉴 */}
            {contextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        left: contextMenu.x,
                        top: contextMenu.y,
                        background: colors.bgSurface,
                        border: `1px solid ${colors.borderSoft}`,
                        borderRadius: 8,
                        padding: '4px 0',
                        minWidth: 180,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        zIndex: 1000
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {contextMenu.targetType === 'canvas' && (
                        <>
                            {/* 역할 지정 */}
                            {canvasImages.find(img => img.id === contextMenu.targetId)?.role !== 'base' && (
                                <button
                                    onClick={() => handleSetAsBase(contextMenu.targetId)}
                                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', color: colors.success, fontSize: 13, fontWeight: 600 }}
                                    className="hover:bg-white/10"
                                >
                                    베이스로 지정
                                </button>
                            )}
                            {canvasImages.find(img => img.id === contextMenu.targetId)?.role !== 'pattern' && (
                                <button
                                    onClick={() => handleSetAsPattern(contextMenu.targetId)}
                                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', color: colors.warning, fontSize: 13, fontWeight: 600 }}
                                    className="hover:bg-white/10"
                                >
                                    패턴으로 지정
                                </button>
                            )}
                            {canvasImages.find(img => img.id === contextMenu.targetId)?.role !== 'none' && (
                                <button
                                    onClick={() => handleClearRole(contextMenu.targetId)}
                                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', color: colors.textSecondary, fontSize: 13 }}
                                    className="hover:bg-white/10"
                                >
                                    역할 해제
                                </button>
                            )}

                            <div style={{ height: 1, background: colors.borderSoft, margin: '4px 0' }} />

                            {/* 패턴 적용 (패턴으로 지정된 경우에만) */}
                            {canvasImages.find(img => img.id === contextMenu.targetId)?.role === 'pattern' && hasBase && (
                                <button
                                    onClick={() => handleApplyPattern(contextMenu.targetId)}
                                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', color: colors.accentPrimary, fontSize: 13 }}
                                    className="hover:bg-white/10"
                                >
                                    베이스에 패턴 적용
                                </button>
                            )}

                            {/* 패턴 추출 - 항상 사용 가능 */}
                            <button
                                onClick={() => handleExtractPattern(contextMenu.targetId, 'canvas')}
                                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', color: colors.textPrimary, fontSize: 13, fontWeight: 600 }}
                                className="hover:bg-white/10"
                            >
                                패턴 추출 (2D CAD)
                            </button>

                            {/* 부위별 패턴 추출 */}
                            <div style={{ paddingLeft: 12, borderLeft: `2px solid ${colors.borderSoft}`, marginLeft: 12 }}>
                                <div style={{ fontSize: 10, color: colors.textMuted, padding: '6px 4px', fontWeight: 600 }}>부위별 추출</div>
                                <button
                                    onClick={() => handleExtractComponentPattern(contextMenu.targetId, 'canvas', 'vamp')}
                                    style={{ width: '100%', padding: '6px 12px', textAlign: 'left', color: colors.textSecondary, fontSize: 12 }}
                                    className="hover:bg-white/10"
                                >
                                    갑피 (Vamp)
                                </button>
                                <button
                                    onClick={() => handleExtractComponentPattern(contextMenu.targetId, 'canvas', 'quarter')}
                                    style={{ width: '100%', padding: '6px 12px', textAlign: 'left', color: colors.textSecondary, fontSize: 12 }}
                                    className="hover:bg-white/10"
                                >
                                    쿼터 (Quarter)
                                </button>
                                <button
                                    onClick={() => handleExtractComponentPattern(contextMenu.targetId, 'canvas', 'tongue')}
                                    style={{ width: '100%', padding: '6px 12px', textAlign: 'left', color: colors.textSecondary, fontSize: 12 }}
                                    className="hover:bg-white/10"
                                >
                                    설포 (Tongue)
                                </button>
                                <button
                                    onClick={() => handleExtractComponentPattern(contextMenu.targetId, 'canvas', 'heel')}
                                    style={{ width: '100%', padding: '6px 12px', textAlign: 'left', color: colors.textSecondary, fontSize: 12 }}
                                    className="hover:bg-white/10"
                                >
                                    힐 카운터 (Heel)
                                </button>
                                <button
                                    onClick={() => handleExtractComponentPattern(contextMenu.targetId, 'canvas', 'outsole')}
                                    style={{ width: '100%', padding: '6px 12px', textAlign: 'left', color: colors.textSecondary, fontSize: 12 }}
                                    className="hover:bg-white/10"
                                >
                                    아웃솔 (Outsole)
                                </button>
                            </div>

                            {/* 편집 (역할이 지정된 경우) */}
                            {canvasImages.find(img => img.id === contextMenu.targetId)?.role !== 'none' && (
                                <button
                                    onClick={() => handleEditPattern(contextMenu.targetId, 'canvas')}
                                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', color: colors.textPrimary, fontSize: 13 }}
                                    className="hover:bg-white/10"
                                >
                                    패턴 편집
                                </button>
                            )}

                            <div style={{ height: 1, background: colors.borderSoft, margin: '4px 0' }} />

                            <button
                                onClick={() => handleDeleteImage(contextMenu.targetId)}
                                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', color: colors.danger, fontSize: 13 }}
                                className="hover:bg-white/10"
                            >
                                삭제
                            </button>
                        </>
                    )}

                    {contextMenu.targetType === 'generated' && (
                        <>
                            <button
                                onClick={() => handleExtractPattern(contextMenu.targetId, 'generated')}
                                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', color: colors.textPrimary, fontSize: 13, fontWeight: 600 }}
                                className="hover:bg-white/10"
                            >
                                패턴 추출 (2D CAD)
                            </button>

                            {/* 부위별 패턴 추출 */}
                            <div style={{ paddingLeft: 12, borderLeft: `2px solid ${colors.borderSoft}`, marginLeft: 12 }}>
                                <div style={{ fontSize: 10, color: colors.textMuted, padding: '6px 4px', fontWeight: 600 }}>부위별 추출</div>
                                <button
                                    onClick={() => handleExtractComponentPattern(contextMenu.targetId, 'generated', 'vamp')}
                                    style={{ width: '100%', padding: '6px 12px', textAlign: 'left', color: colors.textSecondary, fontSize: 12 }}
                                    className="hover:bg-white/10"
                                >
                                    갑피 (Vamp)
                                </button>
                                <button
                                    onClick={() => handleExtractComponentPattern(contextMenu.targetId, 'generated', 'quarter')}
                                    style={{ width: '100%', padding: '6px 12px', textAlign: 'left', color: colors.textSecondary, fontSize: 12 }}
                                    className="hover:bg-white/10"
                                >
                                    쿼터 (Quarter)
                                </button>
                                <button
                                    onClick={() => handleExtractComponentPattern(contextMenu.targetId, 'generated', 'tongue')}
                                    style={{ width: '100%', padding: '6px 12px', textAlign: 'left', color: colors.textSecondary, fontSize: 12 }}
                                    className="hover:bg-white/10"
                                >
                                    설포 (Tongue)
                                </button>
                                <button
                                    onClick={() => handleExtractComponentPattern(contextMenu.targetId, 'generated', 'heel')}
                                    style={{ width: '100%', padding: '6px 12px', textAlign: 'left', color: colors.textSecondary, fontSize: 12 }}
                                    className="hover:bg-white/10"
                                >
                                    힐 카운터 (Heel)
                                </button>
                                <button
                                    onClick={() => handleExtractComponentPattern(contextMenu.targetId, 'generated', 'outsole')}
                                    style={{ width: '100%', padding: '6px 12px', textAlign: 'left', color: colors.textSecondary, fontSize: 12 }}
                                    className="hover:bg-white/10"
                                >
                                    아웃솔 (Outsole)
                                </button>
                            </div>

                            <button
                                onClick={() => handleEditPattern(contextMenu.targetId, 'generated')}
                                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', color: colors.textPrimary, fontSize: 13 }}
                                className="hover:bg-white/10"
                            >
                                패턴 편집
                            </button>

                            <div style={{ height: 1, background: colors.borderSoft, margin: '4px 0' }} />
                            <button
                                onClick={() => handleDeleteGenerated(contextMenu.targetId)}
                                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', color: colors.danger, fontSize: 13 }}
                                className="hover:bg-white/10"
                            >
                                삭제
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* 로딩 오버레이 */}
            {isProcessing && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div style={{ background: colors.bgSurface, borderRadius: 16, padding: 32 }} className="text-center">
                        <div style={{ width: 48, height: 48, border: `3px solid ${colors.borderSoft}`, borderTopColor: colors.accentPrimary }} className="rounded-full animate-spin mx-auto mb-4" />
                        <p style={{ fontSize: 15, color: colors.textPrimary, fontWeight: 500 }}>{processingMessage}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
