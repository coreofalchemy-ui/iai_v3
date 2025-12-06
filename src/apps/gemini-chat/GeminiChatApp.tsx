import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";
import {
    TemplatePreset,
    TemplateCategory,
    CATEGORY_INFO,
    getTemplatesByCategory,
    buildSystemPrompt,
} from './types/templatePresets';

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
    accentPurple: '#7c3aed',
};

// ==================== Types ====================
interface ImageNode {
    id: string;
    baseUrl: string;
    currentUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isLocked: boolean;
    imageScale?: number;
    artboardId?: string; // 어떤 아트보드에 속하는지
    label?: string; // 표시할 라벨 (프레임 이름 또는 "사용자 이미지")
}

interface ReferenceImage {
    id: string;
    number: number;
    imageUrl: string;
    sourcePreset: string;
    addedAt: Date;
    maskDataUrl?: string;
    originalWidth: number;
    originalHeight: number;
}

interface TextOverlay {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    imageUrl?: string;
}

interface Artboard {
    id: string;
    label: string;
    width: number;
    height: number;
    x: number;
    y: number;
    presetId: string;
}

// ==================== Gemini API Setup ====================
const genAI = new GoogleGenAI({
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || ''
});

// ==================== Main Component ====================
export default function GeminiChatApp() {
    const navigate = useNavigate();

    // --- State: Template ---
    const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('ECOMMERCE');
    const [selectedPreset, setSelectedPreset] = useState<TemplatePreset | null>(null);

    // --- State: Artboards ---
    const [artboards, setArtboards] = useState<Artboard[]>([]);
    const [selectedArtboardId, setSelectedArtboardId] = useState<string | null>(null);

    // --- State: Canvas ---
    const [canvasScale, setCanvasScale] = useState(0.5);
    const [canvasPosition, setCanvasPosition] = useState({ x: 150, y: 150 });
    const isPanning = useRef(false);
    const lastPanPosition = useRef({ x: 0, y: 0 });

    // --- State: Content ---
    const [nodes, setNodes] = useState<ImageNode[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);

    // --- State: Reference Images (AI VIEWER) ---
    const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
    const [selectedRefImageId, setSelectedRefImageId] = useState<string | null>(null);

    // --- State: Dragging ---
    const [dragState, setDragState] = useState<{
        isDragging: boolean;
        startX: number;
        startY: number;
        initialX: number;
        initialY: number;
        initialWidth?: number;
        initialHeight?: number;
        targetId: string | null;
        type: 'artboard' | 'node' | 'resize' | null;
        resizeHandle?: string;
        initialPositions?: Record<string, { x: number; y: number }>; // 다중 선택 이동을 위한 초기 위치 저장
    }>({
        isDragging: false,
        startX: 0,
        startY: 0,
        initialX: 0,
        initialY: 0,
        targetId: null,
        type: null
    });

    // --- State: Drag to AI VIEWER ---
    const [isDraggingToViewer, setIsDraggingToViewer] = useState(false);
    const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
    const viewerDropZoneRef = useRef<HTMLDivElement>(null);

    // --- State: Right Click & Context Menu ---
    const [rightClickEnabled, setRightClickEnabled] = useState(true);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

    // --- State: Multi-Selection ---
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

    // --- State: Resize Snap ---
    const [snapInfo, setSnapInfo] = useState<{ width: number; height: number; platform: string } | null>(null);

    // --- State: Brush Tool ---
    const [brushMode, setBrushMode] = useState(false);
    const [brushSize, setBrushSize] = useState(20);
    const [brushColor, setBrushColor] = useState('#FF0000');
    const [brushStrokes, setBrushStrokes] = useState<{ nodeId: string; points: { x: number; y: number }[] }[]>([]);
    const isDrawing = useRef(false);
    const currentStroke = useRef<{ x: number; y: number }[]>([]);
    const brushCanvasRef = useRef<HTMLCanvasElement>(null);

    // --- State: Chat ---
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // --- State: Text Input ---
    const [showTextInput, setShowTextInput] = useState(false);
    const [newText, setNewText] = useState('');
    const [textColor, setTextColor] = useState('#000000');
    const [textSize, setTextSize] = useState(32);

    // --- Refs ---
    const canvasRef = useRef<HTMLDivElement>(null);

    // ==================== Effects ====================
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 전역 마우스 이벤트 (드래그 중 캔버스 밖으로 나가도 계속 동작)
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isPanning.current) {
                const dx = e.clientX - lastPanPosition.current.x;
                const dy = e.clientY - lastPanPosition.current.y;
                setCanvasPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
                lastPanPosition.current = { x: e.clientX, y: e.clientY };
                return;
            }

            // --- Selection Box Update ---
            if (selectionBox) {
                const clientX = e.clientX;
                const clientY = e.clientY;
                const canvasX = (clientX - canvasPosition.x) / canvasScale;
                const canvasY = (clientY - canvasPosition.y) / canvasScale;

                setSelectionBox(prev => prev ? { ...prev, currentX: canvasX, currentY: canvasY } : null);

                // Real-time Selection
                const startCanvasX = (selectionBox.startX - canvasPosition.x) / canvasScale;
                const startCanvasY = (selectionBox.startY - canvasPosition.y) / canvasScale;

                const boxLeft = Math.min(startCanvasX, canvasX);
                const boxTop = Math.min(startCanvasY, canvasY);
                const boxRight = Math.max(startCanvasX, canvasX);
                const boxBottom = Math.max(startCanvasY, canvasY);

                const newSelectedIds: string[] = [];
                nodes.forEach(node => {
                    const centerX = node.x + node.width / 2;
                    const centerY = node.y + node.height / 2;
                    if (centerX >= boxLeft && centerX <= boxRight &&
                        centerY >= boxTop && centerY <= boxBottom) {
                        newSelectedIds.push(node.id);
                    }
                });

                if (e.shiftKey) {
                    setSelectedNodeIds(prev => Array.from(new Set([...prev, ...newSelectedIds])));
                } else {
                    setSelectedNodeIds(newSelectedIds);
                }
                return;
            }

            if (dragState.isDragging && dragState.targetId) {
                const dx = (e.clientX - dragState.startX) / canvasScale;
                const dy = (e.clientY - dragState.startY) / canvasScale;

                if (dragState.type === 'resize' && dragState.initialWidth && dragState.initialHeight) {
                    let newWidth = dragState.initialWidth!;
                    let newHeight = dragState.initialHeight!;
                    let newX = dragState.initialX;
                    let newY = dragState.initialY;

                    // Shift 키 누르면 비율 유지
                    const aspectRatio = dragState.initialWidth! / dragState.initialHeight!;
                    const isShiftPressed = e.shiftKey;

                    // --- Base Resize Calculation ---
                    if (dragState.resizeHandle?.includes('se') || dragState.resizeHandle?.includes('nw') ||
                        dragState.resizeHandle?.includes('ne') || dragState.resizeHandle?.includes('sw')) {
                        // 코너 드래그
                        const delta = Math.max(Math.abs(dx), Math.abs(dy));
                        const signX = dx >= 0 ? 1 : -1;
                        // const signY = dy >= 0 ? 1 : -1; // Unused in aspect ratio constraint logic below

                        if (isShiftPressed) {
                            // Shift: 비율 유지
                            if (dragState.resizeHandle === 'se') {
                                newWidth = Math.max(50, dragState.initialWidth! + delta * signX);
                                newHeight = newWidth / aspectRatio;
                            } else if (dragState.resizeHandle === 'nw') {
                                newWidth = Math.max(50, dragState.initialWidth! - delta * signX);
                                newHeight = newWidth / aspectRatio;
                                newX = dragState.initialX + (dragState.initialWidth! - newWidth);
                                newY = dragState.initialY + (dragState.initialHeight! - newHeight);
                            } else if (dragState.resizeHandle === 'ne') {
                                newWidth = Math.max(50, dragState.initialWidth! + delta * signX);
                                newHeight = newWidth / aspectRatio;
                                newY = dragState.initialY + (dragState.initialHeight! - newHeight);
                            } else if (dragState.resizeHandle === 'sw') {
                                newWidth = Math.max(50, dragState.initialWidth! - delta * signX);
                                newHeight = newWidth / aspectRatio;
                                newX = dragState.initialX + (dragState.initialWidth! - newWidth);
                            }
                        } else {
                            // 기본: 자유 크기 조절
                            if (dragState.resizeHandle === 'se') {
                                newWidth = Math.max(50, dragState.initialWidth! + dx);
                                newHeight = Math.max(50, dragState.initialHeight! + dy);
                            } else if (dragState.resizeHandle === 'nw') {
                                newWidth = Math.max(50, dragState.initialWidth! - dx);
                                newHeight = Math.max(50, dragState.initialHeight! - dy);
                                newX = dragState.initialX + dx;
                                newY = dragState.initialY + dy;
                            } else if (dragState.resizeHandle === 'ne') {
                                newWidth = Math.max(50, dragState.initialWidth! + dx);
                                newHeight = Math.max(50, dragState.initialHeight! - dy);
                                newY = dragState.initialY + dy;
                            } else if (dragState.resizeHandle === 'sw') {
                                newWidth = Math.max(50, dragState.initialWidth! - dx);
                                newHeight = Math.max(50, dragState.initialHeight! + dy);
                                newX = dragState.initialX + dx;
                            }
                        }
                    }

                    // --- Snap Logic ---
                    let activeSnap = null;
                    // 모든 카테고리의 템플릿 프리셋을 확인하여 스냅
                    const categories = Object.keys(CATEGORY_INFO) as TemplateCategory[];
                    for (const cat of categories) {
                        const presets = getTemplatesByCategory(cat);
                        for (const preset of presets) {
                            if (!preset.size) continue;
                            const snapThreshold = 15; // 15px 이내면 스냅

                            // 너비와 높이 모두 비슷하면 스냅
                            if (Math.abs(newWidth - preset.size.width) < snapThreshold &&
                                Math.abs(newHeight - preset.size.height) < snapThreshold) {

                                // 스냅 적용!
                                newWidth = preset.size.width;
                                newHeight = preset.size.height;

                                // 위치 보정 (왼쪽/위쪽 기준 변경 시)
                                if (dragState.resizeHandle === 'nw') {
                                    newX = dragState.initialX + (dragState.initialWidth! - newWidth);
                                    newY = dragState.initialY + (dragState.initialHeight! - newHeight);
                                } else if (dragState.resizeHandle === 'ne') {
                                    newY = dragState.initialY + (dragState.initialHeight! - newHeight);
                                } else if (dragState.resizeHandle === 'sw') {
                                    newX = dragState.initialX + (dragState.initialWidth! - newWidth);
                                }

                                activeSnap = {
                                    width: newWidth,
                                    height: newHeight,
                                    platform: preset.labelKo || preset.platform
                                };
                                break;
                            }
                        }
                        if (activeSnap) break;
                    }
                    setSnapInfo(activeSnap);

                    setNodes(prev => prev.map(n => {
                        if (n.id === dragState.targetId) {
                            return { ...n, width: newWidth, height: newHeight, x: newX, y: newY };
                        }
                        return n;
                    }));

                } else if (dragState.type === 'artboard') {
                    setArtboards(prev => prev.map(a =>
                        a.id === dragState.targetId ? { ...a, x: dragState.initialX + dx, y: dragState.initialY + dy } : a
                    ));
                } else if (dragState.type === 'node') {
                    // Multi-Node Move
                    const initialPositions = dragState.initialPositions;

                    if (initialPositions) {
                        setNodes(prev => prev.map(n => {
                            if (initialPositions[n.id]) {
                                return {
                                    ...n,
                                    x: initialPositions[n.id].x + dx,
                                    y: initialPositions[n.id].y + dy
                                };
                            }
                            return n;
                        }));
                    } else {
                        setNodes(prev => prev.map(n =>
                            n.id === dragState.targetId ? { ...n, x: dragState.initialX + dx, y: dragState.initialY + dy } : n
                        ));
                    }
                }
            }
        };

        const handleGlobalMouseUp = () => {
            isPanning.current = false;
            setSnapInfo(null);
            setSelectionBox(null);
            setDragState(prev => ({ ...prev, isDragging: false, targetId: null, type: null }));
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [dragState, canvasScale]);

    // ==================== Handlers: Category & Template ====================
    const handleCategoryClick = (categoryId: TemplateCategory) => {
        setSelectedCategory(categoryId);
        setSelectedPreset(null);
    };

    const handleTemplateClick = (preset: TemplatePreset) => {
        setSelectedPreset(preset);

        // Add new Artboard
        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;

        const worldCenterX = (viewportCenterX - canvasPosition.x) / canvasScale;
        const worldCenterY = (viewportCenterY - canvasPosition.y) / canvasScale;

        // 기존 아트보드 옆에 배치
        const offsetX = artboards.length * 50;
        const newX = worldCenterX - (preset.size.width / 2) + offsetX;
        const newY = worldCenterY - (preset.size.height / 2);

        const newArtboard: Artboard = {
            id: Date.now().toString(),
            label: preset.labelKo,
            width: preset.size.width,
            height: preset.size.height,
            x: newX,
            y: newY,
            presetId: preset.id
        };

        setArtboards(prev => [...prev, newArtboard]);
        setSelectedArtboardId(newArtboard.id);
    };

    // ==================== Handlers: Canvas Interaction ====================
    const handleWheel = useCallback((e: React.WheelEvent) => {
        // 항상 캔버스 줌 (이미지 선택 여부와 무관)
        e.preventDefault();

        // 마우스 위치 (뷰포트 기준)
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // 현재 스케일에서 마우스 위치의 캔버스 좌표
        const canvasMouseX = (mouseX - canvasPosition.x) / canvasScale;
        const canvasMouseY = (mouseY - canvasPosition.y) / canvasScale;

        // 줌 비율 계산 (매우 부드럽게 - 한 번에 5% 정도씩)
        const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
        const newScale = Math.min(5, Math.max(0.1, canvasScale * zoomFactor));

        // 마우스 위치를 기준으로 캔버스 위치 조정
        const newPosX = mouseX - canvasMouseX * newScale;
        const newPosY = mouseY - canvasMouseY * newScale;

        setCanvasScale(newScale);
        setCanvasPosition({ x: newPosX, y: newPosY });
    }, [canvasScale, canvasPosition]);

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (brushMode) return;

        // Close context menu
        setContextMenu(null);

        // Clear All Selection (캔버스, 노드, AI VIEWER)
        setSelectedArtboardId(null);
        setSelectedNodeId(null);
        setSelectedRefImageId(null); // Clear ref image selection

        // Shift 키가 눌리지 않았고 빈 공간 클릭 시 다중 선택 해제
        // (단, 드래그 셀렉션 박스 시작 시에는 유지하고 싶을 수 있으나, 보통 빈 곳 클릭하면 해제가 일반적)
        if (!e.shiftKey) {
            setSelectedNodeIds([]);
        }

        // Space 키나 휠 클릭이 아니면 Selection Box 시작 (좌클릭 시)
        if (e.button === 0 && !e.shiftKey && !((e as any).code === 'Space')) {
            // Pan 모드가 아닐 때 Selection Box 시작
            // 하지만 아래 Pan Mode 로직이 무조건 button 0이면 실행되게 되어 있어 수정 필요.
            // 일단 여기서는 초기화만. Selection Box 시작 로직은 Pan 조건부 수정 후 적용.
        }

        // Pan Mode Check (Space Key Must Be Pressed or Middle Click)
        const isSpacePressed = (e as any).code === 'Space' || e.shiftKey === false; // 임시: 현재는 Space 키 감지가 안 될 수 있으므로 로직 재검토 필요.
        // 기존: 무조건 button 0 -> Pan
        // 변경: button 0 + Space -> Pan. button 1(Middle) -> Pan.
        // 그냥 Left Click -> Selection Box

        // 하지만 사용자 경험 유지를 위해 일단 기존 Pan 유지하되, 드래그 셀렉트 도입 시 로직 변경 필요.
        // 현재 task에서는 handleNodeMouseDown만 집중. handleCanvasMouseDown의 Pan/Select 분기 로직은 다음 단계에 수행.
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            isPanning.current = true;
            lastPanPosition.current = { x: e.clientX, y: e.clientY };
        } else if (e.button === 0) {
            const canvasX = (e.clientX - canvasPosition.x) / canvasScale;
            const canvasY = (e.clientY - canvasPosition.y) / canvasScale;
            setSelectionBox({
                startX: e.clientX,
                startY: e.clientY,
                currentX: canvasX,
                currentY: canvasY
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // 전역 이벤트에서 처리됨 - React 이벤트는 fallback용
    };

    const handleMouseUp = () => {
        isPanning.current = false;
        setDragState(prev => ({ ...prev, isDragging: false, targetId: null, type: null }));
    };

    // ==================== Handlers: Artboard Interaction ====================
    const handleArtboardMouseDown = (e: React.MouseEvent, artboard: Artboard) => {
        e.stopPropagation();
        if (brushMode) return;

        setSelectedArtboardId(artboard.id);
        setSelectedNodeId(null);

        setDragState({
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            initialX: artboard.x,
            initialY: artboard.y,
            targetId: artboard.id,
            type: 'artboard'
        });
    };

    // ==================== Handlers: Image Drop ====================
    const handleDrop = (e: React.DragEvent, targetArtboard?: Artboard) => {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer.files);
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        if (imageFiles.length > 0 && targetArtboard) {
            imageFiles.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const src = ev.target?.result as string;
                    const img = new Image();
                    img.onload = () => {
                        const newId = Date.now().toString() + index;

                        const newNode: ImageNode = {
                            id: newId,
                            baseUrl: src,
                            currentUrl: src,
                            x: targetArtboard.x,
                            y: targetArtboard.y,
                            width: targetArtboard.width,
                            height: targetArtboard.height,
                            isLocked: false,
                            imageScale: 1,
                            artboardId: targetArtboard.id
                        };
                        setNodes(prev => [...prev, newNode]);
                        setSelectedNodeId(newId);
                    };
                    img.src = src;
                };
                reader.readAsDataURL(file);
            });
        }
    };

    // ==================== Handlers: Node Interaction ====================
    const handleNodeMouseDown = (e: React.MouseEvent, node: ImageNode) => {
        e.stopPropagation();
        if (brushMode) return;

        let currentSelectedIds = [...selectedNodeIds];

        // Shift Click Logic
        if (e.shiftKey) {
            if (currentSelectedIds.includes(node.id)) {
                currentSelectedIds = currentSelectedIds.filter(id => id !== node.id);
                // 메인 선택이 해제된 노드라면 메인 선택도 해제
                if (selectedNodeId === node.id) setSelectedNodeId(null);
            } else {
                currentSelectedIds.push(node.id);
                setSelectedNodeId(node.id);
            }
        } else {
            // 일반 클릭
            if (!currentSelectedIds.includes(node.id)) {
                // 선택되지 않은 노드 클릭 -> 전체 해제 후 단독 선택
                currentSelectedIds = [node.id];
                setSelectedNodeId(node.id);
            } else {
                // 이미 선택된 노드 클릭 -> 선택 유지 (드래그 준비), 메인 선택은 갱신
                setSelectedNodeId(node.id);
            }
        }

        setSelectedNodeIds(currentSelectedIds);
        setSelectedArtboardId(null);

        // 선택된 모든 노드의 초기 위치 저장
        const initialPositions: Record<string, { x: number; y: number }> = {};
        nodes.forEach(n => {
            if (currentSelectedIds.includes(n.id)) {
                initialPositions[n.id] = { x: n.x, y: n.y };
            }
        });

        setDragState({
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            initialX: node.x,
            initialY: node.y,
            targetId: node.id,
            type: 'node',
            initialPositions
        });
    };

    // ==================== Handlers: Resize ====================
    const handleResizeMouseDown = (e: React.MouseEvent, node: ImageNode, handle: string) => {
        e.stopPropagation();
        e.preventDefault();

        setDragState({
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            initialX: node.x,
            initialY: node.y,
            initialWidth: node.width,
            initialHeight: node.height,
            targetId: node.id,
            type: 'resize',
            resizeHandle: handle
        });
    };

    // ==================== Handlers: Drag Image to AI VIEWER ====================
    const handleNodeDragStart = (e: React.DragEvent, nodeId: string) => {
        setIsDraggingToViewer(true);
        setDraggedNodeId(nodeId);
        e.dataTransfer.setData('text/plain', nodeId);
    };

    const handleNodeDragEnd = () => {
        setIsDraggingToViewer(false);
        setDraggedNodeId(null);
    };

    const handleViewerDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const nodeId = e.dataTransfer.getData('text/plain');
        if (nodeId) {
            addImageToViewer(nodeId);
        }
        setIsDraggingToViewer(false);
        setDraggedNodeId(null);
    };

    const handleViewerDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    // ==================== Handlers: AI VIEWER ====================
    const addImageToViewer = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        // 이미 있으면 추가하지 않음
        if (referenceImages.find(r => r.id === nodeId)) return;

        // 브러쉬 스트로크가 있으면 마스크로 저장
        const nodeStrokes = brushStrokes.filter(s => s.nodeId === nodeId);
        let maskDataUrl: string | undefined;

        if (nodeStrokes.length > 0 && brushCanvasRef.current) {
            maskDataUrl = brushCanvasRef.current.toDataURL();
        }

        const newRef: ReferenceImage = {
            id: nodeId,
            number: referenceImages.length + 1,
            imageUrl: node.currentUrl,
            sourcePreset: selectedPreset?.id || 'unknown',
            addedAt: new Date(),
            maskDataUrl,
            originalWidth: node.width,
            originalHeight: node.height
        };
        setReferenceImages(prev => [...prev, newRef]);
    };

    // 캔버스에 파일 드롭 → 캔버스에 이미지 노드로 바로 생성 (AI VIEWER로 가지 않음!)
    const handleCanvasFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer.files);
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        // 드롭 위치 계산
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const dropX = (e.clientX - rect.left - canvasPosition.x) / canvasScale;
        const dropY = (e.clientY - rect.top - canvasPosition.y) / canvasScale;

        imageFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const src = ev.target?.result as string;
                const img = new Image();
                img.onload = () => {
                    // 이미지 크기 (적당히 축소)
                    const maxSize = 400;
                    let nodeWidth = img.width;
                    let nodeHeight = img.height;
                    if (nodeWidth > maxSize || nodeHeight > maxSize) {
                        const ratio = Math.min(maxSize / nodeWidth, maxSize / nodeHeight);
                        nodeWidth *= ratio;
                        nodeHeight *= ratio;
                    }

                    const newId = 'canvas-' + Date.now().toString() + index;
                    const newNode: ImageNode = {
                        id: newId,
                        baseUrl: src,
                        currentUrl: src,
                        x: dropX + (index * 30),
                        y: dropY + (index * 30),
                        width: nodeWidth,
                        height: nodeHeight,
                        isLocked: false,
                        imageScale: 1,
                        label: '사용자 이미지'
                    };
                    setNodes(prev => [...prev, newNode]);
                    setSelectedNodeId(newId);
                };
                img.src = src;
            };
            reader.readAsDataURL(file);
        });

        setIsDraggingToViewer(false);
    };

    // AI VIEWER에 파일 직접 드롭 (AI VIEWER 드롭존에만 사용)
    const handleViewerFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer.files);
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        imageFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const src = ev.target?.result as string;
                const img = new Image();
                img.onload = () => {
                    const newId = 'viewer-' + Date.now().toString() + index;
                    const newRef: ReferenceImage = {
                        id: newId,
                        number: referenceImages.length + index + 1,
                        imageUrl: src,
                        sourcePreset: selectedPreset?.id || 'direct-upload',
                        addedAt: new Date(),
                        originalWidth: img.width,
                        originalHeight: img.height
                    };
                    setReferenceImages(prev => [...prev, newRef]);
                    setSelectedRefImageId(newId);
                };
                img.src = src;
            };
            reader.readAsDataURL(file);
        });

        setIsDraggingToViewer(false);
    };

    // AI VIEWER에서 템플릿(아트보드)으로 이미지 드래그
    const handleRefImageDragStart = (e: React.DragEvent, refImage: ReferenceImage) => {
        e.dataTransfer.setData('application/json', JSON.stringify(refImage));
        e.dataTransfer.effectAllowed = 'copy';
    };

    // 아트보드에 AI VIEWER 이미지 드롭
    const handleArtboardRefDrop = (e: React.DragEvent, targetArtboard: Artboard) => {
        e.preventDefault();
        e.stopPropagation();

        const refData = e.dataTransfer.getData('application/json');
        if (refData) {
            try {
                const refImage: ReferenceImage = JSON.parse(refData);

                // 이미지를 아트보드에 맞게 배치 (빈 공간 유지)
                const aspectRatio = refImage.originalWidth / refImage.originalHeight;
                const boardAspect = targetArtboard.width / targetArtboard.height;

                let nodeWidth: number, nodeHeight: number;

                if (aspectRatio > boardAspect) {
                    // 이미지가 더 넓음 - 너비에 맞추기
                    nodeWidth = targetArtboard.width;
                    nodeHeight = nodeWidth / aspectRatio;
                } else {
                    // 이미지가 더 높음 - 높이에 맞추기
                    nodeHeight = targetArtboard.height;
                    nodeWidth = nodeHeight * aspectRatio;
                }

                // 중앙 배치
                const offsetX = (targetArtboard.width - nodeWidth) / 2;
                const offsetY = (targetArtboard.height - nodeHeight) / 2;

                const newId = Date.now().toString();
                const newNode: ImageNode = {
                    id: newId,
                    baseUrl: refImage.imageUrl,
                    currentUrl: refImage.imageUrl,
                    x: targetArtboard.x + offsetX,
                    y: targetArtboard.y + offsetY,
                    width: nodeWidth,
                    height: nodeHeight,
                    isLocked: false,
                    imageScale: 1,
                    artboardId: targetArtboard.id
                };

                setNodes(prev => [...prev, newNode]);
                setSelectedNodeId(newId);
            } catch (err) {
                console.error('Failed to parse ref image data', err);
            }
        }
    };

    const removeImageFromViewer = (id: string) => {
        setReferenceImages(prev => {
            const filtered = prev.filter(r => r.id !== id);
            return filtered.map((r, idx) => ({ ...r, number: idx + 1 }));
        });
    };

    // ==================== Handlers: Download ====================
    const handleDownload = async (format: 'png' | 'jpg', upscale: boolean = false) => {
        const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : (selectedNodeId ? [selectedNodeId] : []);

        if (targetIds.length === 0) {
            alert('다운로드할 이미지를 선택하세요');
            return;
        }

        targetIds.forEach((id, index) => {
            const node = nodes.find(n => n.id === id);
            if (!node) return;

            const link = document.createElement('a');
            link.download = `visual-tryon-${Date.now()}-${index + 1}.${format}`;

            if (upscale) {
                const canvas = document.createElement('canvas');
                canvas.width = node.width * 2;
                canvas.height = node.height * 2;
                const ctx = canvas.getContext('2d');

                if (ctx) {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`, 0.95);
                        link.click();
                    };
                    img.src = node.currentUrl;
                }
            } else {
                link.href = node.currentUrl;
                link.click();
            }
        });
    };

    // ==================== Handlers: Brush Tool ====================
    const handleBrushMouseDown = (e: React.MouseEvent, nodeId: string) => {
        if (!brushMode) return;
        e.stopPropagation();
        isDrawing.current = true;
        currentStroke.current = [{ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }];
    };

    const handleBrushMouseMove = (e: React.MouseEvent, nodeId: string) => {
        if (!brushMode || !isDrawing.current) return;
        const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
        currentStroke.current.push(point);
        drawBrushOnCanvas(nodeId);
    };

    const handleBrushMouseUp = (nodeId: string) => {
        if (!brushMode || !isDrawing.current) return;
        isDrawing.current = false;
        if (currentStroke.current.length > 0) {
            setBrushStrokes(prev => [...prev, { nodeId, points: [...currentStroke.current] }]);
        }
        currentStroke.current = [];
    };

    const drawBrushOnCanvas = (nodeId: string) => {
        const canvas = brushCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const points = currentStroke.current;
        if (points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(points[points.length - 2].x, points[points.length - 2].y);
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke();
    };

    const clearBrushStrokes = (nodeId: string) => {
        setBrushStrokes(prev => prev.filter(s => s.nodeId !== nodeId));
        if (brushCanvasRef.current) {
            const ctx = brushCanvasRef.current.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, brushCanvasRef.current.width, brushCanvasRef.current.height);
            }
        }
    };

    // ==================== Handlers: Detail Page Deconstruction ====================
    const handleDeconstructDetailPage = async (node: ImageNode) => {
        if (!node.currentUrl.startsWith('data:')) {
            alert('이미지 데이터를 분석할 수 없습니다.');
            return;
        }

        setIsLoading(true);

        try {
            const base64Data = node.currentUrl.split(',')[1];
            const mimeType = node.currentUrl.match(/data:(.+);base64/)?.[1] || 'image/png';

            // AI에게 상세페이지 분석 요청
            const analysisPrompt = `이 상세페이지 이미지를 분석해주세요.

다음 JSON 형식으로 응답해주세요 (반드시 JSON만 응답):
{
  "chapters": [
    {
      "title": "챕터 제목 (예: 히어로 배너, 제품 특징, 상세 정보 등)",
      "yStart": 이미지 상단에서 시작 비율 (0~1),
      "yEnd": 이미지 상단에서 끝 비율 (0~1),
      "elements": [
        {
          "type": "text" 또는 "image",
          "content": "텍스트 내용" 또는 "이미지 설명",
          "x": 좌측에서 위치 비율 (0~1),
          "y": 챕터 내 위치 비율 (0~1),
          "width": 너비 비율 (0~1),
          "height": 높이 비율 (0~1),
          "fontSize": 텍스트일 경우 폰트 크기 (px),
          "fontWeight": 텍스트일 경우 굵기 (normal/bold),
          "color": 텍스트일 경우 색상 (#hex)
        }
      ]
    }
  ]
}

상세페이지를 자연스러운 섹션으로 나누고, 각 섹션의 텍스트와 이미지 영역을 분석해주세요.`;

            const response = await genAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{
                    role: 'user',
                    parts: [
                        { text: analysisPrompt },
                        { inlineData: { mimeType, data: base64Data } }
                    ]
                }]
            });

            const responseText = response.text || '';

            // JSON 파싱 시도
            let analysisResult;
            try {
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    analysisResult = JSON.parse(jsonMatch[0]);
                }
            } catch {
                console.error('JSON 파싱 실패:', responseText);
            }

            if (analysisResult?.chapters) {
                // 원본 이미지 크기 기반으로 챕터 생성
                const originalHeight = node.height;
                const originalWidth = node.width;
                let offsetY = node.y + originalHeight + 50; // 원본 아래에 배치

                analysisResult.chapters.forEach((chapter: {
                    title: string;
                    yStart: number;
                    yEnd: number;
                    elements: Array<{
                        type: string;
                        content: string;
                        x: number;
                        y: number;
                        width: number;
                        height: number;
                        fontSize?: number;
                        fontWeight?: string;
                        color?: string;
                    }>;
                }, chapterIndex: number) => {
                    const chapterHeight = (chapter.yEnd - chapter.yStart) * originalHeight;

                    // 챕터 프레임 생성
                    const chapterBoardId = `chapter-${Date.now()}-${chapterIndex}`;
                    const newBoard: Artboard = {
                        id: chapterBoardId,
                        label: chapter.title || `챕터 ${chapterIndex + 1}`,
                        width: originalWidth,
                        height: Math.max(100, chapterHeight),
                        x: node.x + originalWidth + 100, // 원본 오른쪽에 배치
                        y: offsetY,
                        presetId: 'custom'
                    };
                    setArtboards(prev => [...prev, newBoard]);

                    // 챕터 내 요소들 생성
                    chapter.elements?.forEach((element, elemIndex) => {
                        if (element.type === 'text' && element.content) {
                            // 텍스트 오버레이 추가
                            const textId = `text-${Date.now()}-${chapterIndex}-${elemIndex}`;
                            setTextOverlays(prev => [...prev, {
                                id: textId,
                                text: element.content,
                                x: newBoard.x + (element.x || 0.1) * newBoard.width,
                                y: newBoard.y + (element.y || 0.1) * newBoard.height,
                                fontSize: element.fontSize || 16,
                                color: element.color || '#000000'
                            }]);
                        } else if (element.type === 'image') {
                            // 이미지 프레임 (빈 프레임) 생성
                            const frameId = `frame-${Date.now()}-${chapterIndex}-${elemIndex}`;
                            const frameNode: ImageNode = {
                                id: frameId,
                                baseUrl: '',
                                currentUrl: '',
                                x: newBoard.x + (element.x || 0) * newBoard.width,
                                y: newBoard.y + (element.y || 0) * newBoard.height,
                                width: (element.width || 0.5) * newBoard.width,
                                height: (element.height || 0.3) * newBoard.height,
                                isLocked: false,
                                imageScale: 1,
                                artboardId: chapterBoardId,
                                label: element.content || '이미지 영역'
                            };
                            setNodes(prev => [...prev, frameNode]);
                        }
                    });

                    offsetY += chapterHeight + 30;
                });

                // 성공 메시지
                const successMsg: Message = {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: `✅ 상세페이지 해체 완료!\n\n${analysisResult.chapters.length}개의 챕터로 분할되었습니다.\n\n각 챕터의 텍스트는 바로 편집 가능하고, 이미지 영역에는 새 이미지를 드롭할 수 있습니다.`,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, successMsg]);

            } else {
                // 분석 실패 시 기본 분할
                const errorMsg: Message = {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: `⚠️ 상세페이지 분석 중 오류가 발생했습니다.\n\n응답: ${responseText.substring(0, 200)}...`,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, errorMsg]);
            }

        } catch (error) {
            console.error('상세페이지 해체 오류:', error);
            const errorMsg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: `❌ 상세페이지 해체 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    // ==================== Handlers: Text ====================
    const handleAddText = () => {
        if (!newText.trim()) return;
        const id = Date.now().toString();
        const x = 100;
        const y = 100;

        setTextOverlays(prev => [...prev, {
            id,
            text: newText,
            x, y,
            fontSize: textSize,
            color: textColor
        }]);
        setNewText('');
        setShowTextInput(false);
    };

    // ==================== Handlers: AI Chat ====================
    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const systemPrompt = buildSystemPrompt(selectedPreset);

            // 이미지 컨텍스트 및 실제 이미지 데이터 준비
            let imageContext = "";
            const imageParts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

            if (referenceImages.length > 0) {
                imageContext = "\n\n현재 AI VIEWER에 있는 이미지:\n";
                referenceImages.forEach(img => {
                    const hasMask = img.maskDataUrl ? " [마스킹 있음 - 마스킹된 부분만 수정 요청 가능]" : "";
                    imageContext += `- ${img.number}번 이미지: ${img.sourcePreset} 플랫폼용${hasMask}\n`;

                    // 실제 이미지 데이터 추가 (Base64)
                    if (img.imageUrl.startsWith('data:')) {
                        const base64Data = img.imageUrl.split(',')[1];
                        const mimeType = img.imageUrl.match(/data:(.+);base64/)?.[1] || 'image/png';
                        imageParts.push({
                            inlineData: { mimeType, data: base64Data }
                        });
                        imageParts.push({ text: `(위 이미지: ${img.number}번)` });
                    }

                    // 마스킹 이미지도 포함
                    if (img.maskDataUrl) {
                        const maskBase64 = img.maskDataUrl.split(',')[1];
                        imageParts.push({
                            inlineData: { mimeType: 'image/png', data: maskBase64 }
                        });
                        imageParts.push({ text: `(위 이미지: ${img.number}번의 마스킹 영역 - 빨간색 부분만 수정)` });
                    }
                });
            }

            const fullPrompt = systemPrompt + imageContext + "\n\n중요: 마스킹된 부분만 수정하고, 마스킹되지 않은 부분은 절대 변경하지 마세요.\n\n사용자 요청: " + input;

            // 이미지가 있으면 Vision API로, 없으면 텍스트만
            const contentParts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [
                { text: fullPrompt },
                ...imageParts
            ];

            const response = await genAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: contentParts }]
            });

            const aiResponse = response.text || "죄송합니다. 응답을 생성할 수 없습니다.";

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: aiResponse,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);

        } catch (error) {
            console.error('Gemini API Error:', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);

        } finally {
            setIsLoading(false);
        }
    };

    // ==================== Get Current Templates ====================
    const currentTemplates = getTemplatesByCategory(selectedCategory);
    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    // ==================== Render ====================
    return (
        <div className="flex h-screen w-screen overflow-hidden font-sans" style={{ backgroundColor: colors.bgBase, color: colors.textPrimary, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
            {/* Left Area: Canvas */}
            <div className="flex-grow flex flex-col relative h-full">

                {/* Top Toolbar - 모던 디자인 */}
                <div className="absolute top-4 left-4 right-[390px] z-40 flex items-center gap-3">
                    {/* Back Button Only */}
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg px-4 py-3 border border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-600">뒤로</span>
                    </button>

                    {/* Categories */}
                    <div className="flex items-center gap-1 bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg px-2 py-1.5 border border-gray-100">
                        {CATEGORY_INFO.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => handleCategoryClick(cat.id)}
                                className={`px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${selectedCategory === cat.id
                                    ? 'bg-gray-900 text-white shadow-sm'
                                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                                    }`}
                            >
                                {cat.labelKo}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Template Selector - 두 번째 줄 */}
                <div className="absolute top-20 left-4 right-[390px] z-40">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {currentTemplates.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => handleTemplateClick(preset)}
                                className={`flex flex-col items-start px-4 py-2.5 rounded-xl transition-all shrink-0 ${selectedPreset?.id === preset.id
                                    ? 'bg-white shadow-lg border border-gray-200'
                                    : 'bg-white/60 hover:bg-white/90 border border-transparent'
                                    }`}
                            >
                                <span className={`text-xs font-semibold ${selectedPreset?.id === preset.id ? 'text-gray-900' : 'text-gray-600'}`}>
                                    {preset.labelKo}
                                </span>
                                <span className="text-[10px] text-gray-400 mt-0.5">
                                    {preset.size.width} × {preset.size.height}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Canvas Area - 파일 드롭 시 캔버스에 이미지 노드로 바로 생성 */}
                <div
                    className="absolute inset-0 z-0 overflow-hidden"
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                    onDrop={(e) => {
                        e.preventDefault();
                        const files = Array.from(e.dataTransfer.files);
                        if (files.length > 0) {
                            handleCanvasFileDrop(e);
                        }
                    }}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingToViewer(true);
                    }}
                    onDragLeave={() => setIsDraggingToViewer(false)}
                    style={{
                        backgroundColor: colors.bgBase,
                        cursor: brushMode ? 'crosshair' : isPanning.current ? 'grabbing' : 'default'
                    }}
                >
                    {/* Dot Pattern */}
                    <div className="absolute inset-0 pointer-events-none opacity-40"
                        style={{ backgroundImage: `radial-gradient(#A1A1AA 1px, transparent 1px)`, backgroundSize: '24px 24px' }}
                    />

                    {/* Welcome Message */}
                    {artboards.length === 0 && nodes.length === 0 && !isDraggingToViewer && (
                        <div
                            className="absolute top-0 left-0 bottom-0 flex items-center justify-center pointer-events-none"
                            style={{ right: '380px' }}
                        >
                            <div className="text-center">
                                <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h2 className="text-lg font-bold text-gray-900 mb-1">이미지를 여기에 드래그하세요</h2>
                                <p className="text-sm text-gray-400">캔버스에 바로 배치됩니다</p>
                            </div>
                        </div>
                    )}

                    {/* Canvas Content */}
                    <div ref={canvasRef}
                        className="absolute origin-top-left"
                        style={{
                            transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasScale})`,
                            width: 0, height: 0,
                            overflow: 'visible'
                        }}
                    >
                        {/* Artboards */}
                        {artboards.map(board => {
                            const isSelected = selectedArtboardId === board.id;
                            const boardNodes = nodes.filter(n => n.artboardId === board.id);

                            return (
                                <div
                                    key={board.id}
                                    className="absolute cursor-move"
                                    style={{
                                        left: board.x,
                                        top: board.y,
                                        width: board.width,
                                        height: board.height
                                    }}
                                    onMouseDown={(e) => handleArtboardMouseDown(e, board)}
                                    onDrop={(e) => {
                                        // AI VIEWER 이미지 드롭 확인
                                        const refData = e.dataTransfer.getData('application/json');
                                        if (refData) {
                                            handleArtboardRefDrop(e, board);
                                        } else {
                                            handleDrop(e, board);
                                        }
                                    }}
                                    onDragOver={(e) => { e.preventDefault(); }}
                                >
                                    {/* Label */}
                                    <div className="absolute -top-10 left-0 flex items-center gap-2 group/label">
                                        <span className={`text-sm font-bold whitespace-nowrap uppercase tracking-wider ${isSelected ? 'text-black' : 'text-gray-500'}`}>
                                            {board.label} <span className="font-normal opacity-70">({board.width} x {board.height})</span>
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setArtboards(prev => prev.filter(b => b.id !== board.id));
                                                setNodes(prev => prev.filter(n => n.artboardId !== board.id));
                                            }}
                                            className="opacity-0 group-hover/label:opacity-100 p-1 hover:bg-red-100 text-gray-400 hover:text-red-500 rounded transition-all"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Artboard Frame */}
                                    <div
                                        className="w-full h-full bg-white shadow-2xl relative overflow-hidden rounded-lg"
                                        style={{
                                            border: isSelected ? '3px solid #000' : '2px solid #E5E5EA',
                                            boxShadow: isSelected ? '0 0 0 3px rgba(0,0,0,0.1)' : undefined
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const files = Array.from(e.dataTransfer.files);
                                            const imageFiles = files.filter(f => f.type.startsWith('image/'));

                                            imageFiles.forEach((file, index) => {
                                                const reader = new FileReader();
                                                reader.onload = (ev) => {
                                                    const src = ev.target?.result as string;
                                                    const newId = 'frame-' + Date.now().toString() + index;
                                                    const newNode: ImageNode = {
                                                        id: newId,
                                                        baseUrl: src,
                                                        currentUrl: src,
                                                        x: 10 + (index * 20),
                                                        y: 10 + (index * 20),
                                                        width: board.width * 0.8,
                                                        height: board.height * 0.8,
                                                        isLocked: false,
                                                        imageScale: 1,
                                                        artboardId: board.id,
                                                        label: board.label
                                                    };
                                                    setNodes(prev => [...prev, newNode]);
                                                    setSelectedNodeId(newId);
                                                };
                                                reader.readAsDataURL(file);
                                            });
                                        }}
                                    >
                                        {/* Grid pattern */}
                                        <div className="absolute inset-0 opacity-[0.03]"
                                            style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }}
                                        />

                                        {/* Drop zone if no images */}
                                        {boardNodes.length === 0 && (
                                            <div className="absolute inset-0 flex items-center justify-center text-gray-300 pointer-events-none">
                                                <div className="text-center">
                                                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                    </svg>
                                                    <span className="text-sm font-medium">이미지를 드롭하세요</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Image Nodes */}
                        {nodes.map(node => {
                            const isSelected = selectedNodeIds.includes(node.id);
                            const refImage = referenceImages.find(r => r.id === node.id);

                            return (
                                <div
                                    key={node.id}
                                    className={`absolute group select-none ${isSelected ? 'z-20' : 'z-10'}`}
                                    style={{
                                        left: node.x,
                                        top: node.y,
                                        width: node.width,
                                        height: node.height,
                                        outline: isSelected ? '3px solid #000' : 'none',
                                        boxShadow: isSelected ? '0 0 0 3px rgba(0,0,0,0.1)' : undefined,
                                        overflow: isSelected ? 'visible' : 'hidden',
                                        borderRadius: '4px',
                                        cursor: brushMode ? 'crosshair' : 'move',
                                        transition: dragState.isDragging ? 'none' : 'box-shadow 0.15s ease'
                                    }}
                                    onMouseDown={(e) => brushMode ? handleBrushMouseDown(e, node.id) : handleNodeMouseDown(e, node)}
                                    onMouseMove={(e) => brushMode && handleBrushMouseMove(e, node.id)}
                                    onMouseUp={() => brushMode && handleBrushMouseUp(node.id)}
                                    onMouseLeave={() => brushMode && handleBrushMouseUp(node.id)}
                                    onContextMenu={(e) => {
                                        if (rightClickEnabled) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
                                        }
                                    }}
                                >
                                    <img
                                        src={node.currentUrl}
                                        className="w-full h-full object-cover pointer-events-none"
                                        draggable={false}
                                        alt=""
                                    />

                                    {/* Brush Canvas (for drawing) */}
                                    {brushMode && isSelected && (
                                        <canvas
                                            ref={brushCanvasRef}
                                            width={node.width}
                                            height={node.height}
                                            className="absolute inset-0 pointer-events-none"
                                            style={{ opacity: 0.7 }}
                                        />
                                    )}

                                    {/* Reference Number Badge */}
                                    {refImage && (
                                        <div className="absolute top-0 left-0 bg-purple-600 text-white text-sm font-bold w-8 h-8 flex items-center justify-center rounded-br-xl shadow-lg z-20">
                                            {refImage.number}
                                        </div>
                                    )}

                                    {/* Selection Indicator */}
                                    {isSelected && !refImage && (
                                        <div className="absolute top-0 right-0 bg-black text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-bl-lg shadow-md z-20">
                                            ✓
                                        </div>
                                    )}

                                    {/* Image Label (상단 고정 크기) */}
                                    {/* Image Label & Resize Info */}
                                    {(() => {
                                        const isResizing = dragState.type === 'resize' && dragState.targetId === node.id;
                                        // 리사이즈 중이 아니면 기존 label만 표시
                                        // 리사이즈 중이면: snapInfo가 있으면 플랫폼명+사이즈, 없으면 현재 사이즈 표시

                                        let displayText = node.label;
                                        let subText = "";
                                        let isSnapped = false;

                                        if (isResizing) {
                                            if (snapInfo) {
                                                displayText = snapInfo.platform;
                                                subText = `${snapInfo.width}x${snapInfo.height}`;
                                                isSnapped = true;
                                            } else {
                                                displayText = `${Math.round(node.width)} x ${Math.round(node.height)}`;
                                                subText = "";
                                            }
                                        }

                                        if (!displayText) return null;

                                        return (
                                            <div
                                                className={`absolute left-1/2 -translate-x-1/2 px-2 py-1 z-20 rounded flex items-center gap-1 whitespace-nowrap pointer-events-none transition-colors`}
                                                style={{
                                                    top: -28,
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    backgroundColor: isSnapped ? '#7c3aed' : 'rgba(0,0,0,0.7)',
                                                    color: 'white',
                                                    boxShadow: isSnapped ? '0 0 0 2px rgba(124, 58, 237, 0.3)' : 'none'
                                                }}
                                            >
                                                {displayText}
                                                {subText && <span className="font-normal opacity-80 text-[10px]">{subText}</span>}
                                            </div>
                                        );
                                    })()}

                                    {/* Resize Handles (when selected) */}
                                    {isSelected && !brushMode && (
                                        <>
                                            {/* Corner handles */}
                                            <div
                                                className="absolute -top-1 -left-1 w-3 h-3 bg-white border-2 border-black rounded-sm cursor-nwse-resize z-30"
                                                onMouseDown={(e) => handleResizeMouseDown(e, node, 'nw')}
                                            />
                                            <div
                                                className="absolute -top-1 -right-1 w-3 h-3 bg-white border-2 border-black rounded-sm cursor-nesw-resize z-30"
                                                onMouseDown={(e) => handleResizeMouseDown(e, node, 'ne')}
                                            />
                                            <div
                                                className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border-2 border-black rounded-sm cursor-nesw-resize z-30"
                                                onMouseDown={(e) => handleResizeMouseDown(e, node, 'sw')}
                                            />
                                            <div
                                                className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 border-black rounded-sm cursor-nwse-resize z-30"
                                                onMouseDown={(e) => handleResizeMouseDown(e, node, 'se')}
                                            />
                                            {/* 코너 핸들만 (비율 유지 리사이즈) */}
                                        </>
                                    )}
                                </div>
                            );
                        })}

                        {/* Text Overlays */}
                        {textOverlays.map(text => (
                            <div key={text.id}
                                className="absolute cursor-move select-none whitespace-pre"
                                style={{
                                    left: text.x, top: text.y,
                                    fontSize: text.fontSize, color: text.color,
                                    fontFamily: 'Inter, sans-serif', fontWeight: 700
                                }}
                            >
                                {text.text}
                            </div>
                        ))}

                        {/* Selection Box Rendering */}
                        {selectionBox && (() => {
                            const startCanvasX = (selectionBox.startX - canvasPosition.x) / canvasScale;
                            const startCanvasY = (selectionBox.startY - canvasPosition.y) / canvasScale;

                            const x = Math.min(startCanvasX, selectionBox.currentX);
                            const y = Math.min(startCanvasY, selectionBox.currentY);
                            const width = Math.abs(selectionBox.currentX - startCanvasX);
                            const height = Math.abs(selectionBox.currentY - startCanvasY);

                            return (
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: x,
                                        top: y,
                                        width: width,
                                        height: height,
                                        backgroundColor: 'rgba(124, 58, 237, 0.1)',
                                        border: '1px solid rgba(124, 58, 237, 0.5)',
                                        pointerEvents: 'none',
                                        zIndex: 9999
                                    }}
                                />
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Context Menu (우클릭 메뉴) */}
            {contextMenu && (
                <div
                    className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 py-1 z-[9999] min-w-[160px]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    {(() => {
                        const node = nodes.find(n => n.id === contextMenu.nodeId);
                        const isInViewer = referenceImages.some(r => r.id === contextMenu.nodeId);

                        return (
                            <>
                                {!isInViewer ? (
                                    <button
                                        onClick={() => {
                                            if (node) {
                                                addImageToViewer(contextMenu.nodeId);
                                            }
                                            setContextMenu(null);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        AI VIEWER 보내기
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            removeImageFromViewer(contextMenu.nodeId);
                                            setContextMenu(null);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                        AI VIEWER 해제
                                    </button>
                                )}
                                {/* 구분선 */}
                                <div className="border-t border-gray-100 my-1" />
                                {/* 상세페이지 해체 */}
                                <button
                                    onClick={() => {
                                        if (node) {
                                            handleDeconstructDetailPage(node);
                                        }
                                        setContextMenu(null);
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                                    </svg>
                                    상세페이지 해체
                                </button>
                                {/* 삭제 */}
                                <button
                                    onClick={() => {
                                        setNodes(prev => prev.filter(n => n.id !== contextMenu.nodeId));
                                        removeImageFromViewer(contextMenu.nodeId);
                                        setContextMenu(null);
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    삭제
                                </button>
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Bottom Tool Dock */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">

                {/* Brush Size Slider */}
                {brushMode && (
                    <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-gray-200/50 mb-1 flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-500">브러쉬 크기</span>
                        <input
                            type="range"
                            min="5"
                            max="50"
                            value={brushSize}
                            onChange={(e) => setBrushSize(Number(e.target.value))}
                            className="w-32 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                        <span className="text-xs text-gray-500 w-8 text-right">{brushSize}px</span>
                        <input
                            type="color"
                            value={brushColor}
                            onChange={(e) => setBrushColor(e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer border-0"
                        />
                        {selectedNodeId && (
                            <button
                                onClick={() => clearBrushStrokes(selectedNodeId)}
                                className="text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                                지우기
                            </button>
                        )}
                    </div>
                )}

                {/* Text Input Panel */}
                {showTextInput && (
                    <div className="bg-white p-4 rounded-xl shadow-2xl border border-gray-200 w-80 mb-2">
                        <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">텍스트 추가</h4>
                        <input
                            type="text"
                            value={newText}
                            onChange={(e) => setNewText(e.target.value)}
                            autoFocus
                            className="w-full bg-gray-100 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-black"
                            placeholder="내용을 입력하세요"
                        />
                        <div className="flex gap-2 mb-3">
                            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                            <select value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} className="bg-gray-100 rounded text-xs px-2 flex-grow outline-none">
                                <option value={24}>24px</option>
                                <option value={32}>32px</option>
                                <option value={48}>48px</option>
                                <option value={64}>64px</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleAddText} className="flex-1 bg-black text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-800">추가</button>
                            <button onClick={() => setShowTextInput(false)} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-200">취소</button>
                        </div>
                    </div>
                )}

                {/* Dock */}
                <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-gray-200/50">
                    {/* Select Tool */}
                    <button
                        onClick={() => setBrushMode(false)}
                        className={`p-2.5 rounded-xl transition-all ${!brushMode ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-900'}`}
                        title="선택 도구"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                    </button>

                    <div className="w-px h-6 bg-gray-200 mx-1"></div>

                    {/* Brush Tool */}
                    <button
                        onClick={() => setBrushMode(true)}
                        className={`p-2.5 rounded-xl transition-all ${brushMode ? 'bg-red-500 text-white shadow-md' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-900'}`}
                        title="브러쉬 도구 (마킹)"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>

                    <div className="w-px h-6 bg-gray-200 mx-1"></div>

                    {/* Text Tool */}
                    <button
                        onClick={() => setShowTextInput(!showTextInput)}
                        className={`p-2.5 rounded-xl transition-all ${showTextInput ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-900'}`}
                        title="텍스트 추가"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16m-7 6h7" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Right Sidebar: Chat */}
            <div
                className="absolute top-4 right-4 bottom-4 w-[360px] flex flex-col z-50 rounded-3xl overflow-hidden shadow-2xl"
                style={{ background: 'rgba(255, 255, 255, 0.98)', border: `1px solid ${colors.borderSoft}` }}
            >
                {/* Header with Download Buttons */}
                <div className="flex-shrink-0 flex items-center px-4 py-3 justify-between bg-white/90" style={{ borderBottom: `1px solid ${colors.borderSoft}` }}>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                            </svg>
                        </div>
                        <span className="text-xs font-black uppercase tracking-tight">Visual Try-on</span>
                    </div>

                    {/* Download & Upscale Buttons */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => handleDownload('png')}
                            className="px-2 py-1 rounded-lg text-[10px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                            title="PNG 다운로드"
                        >
                            PNG
                        </button>
                        <button
                            onClick={() => handleDownload('jpg')}
                            className="px-2 py-1 rounded-lg text-[10px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                            title="JPG 다운로드"
                        >
                            JPG
                        </button>
                        <button
                            onClick={async () => {
                                // 업스케일: 선택된 이미지를 2x 확대하여 새로운 이미지로 추가
                                if (!selectedNodeId) {
                                    alert('업스케일할 이미지를 선택하세요');
                                    return;
                                }
                                const node = nodes.find(n => n.id === selectedNodeId);
                                if (!node) return;

                                const canvas = document.createElement('canvas');
                                canvas.width = node.width * 2;
                                canvas.height = node.height * 2;
                                const ctx = canvas.getContext('2d');

                                if (ctx) {
                                    const img = new Image();
                                    img.crossOrigin = 'anonymous';
                                    img.onload = () => {
                                        ctx.imageSmoothingEnabled = true;
                                        ctx.imageSmoothingQuality = 'high';
                                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                        const upscaledUrl = canvas.toDataURL('image/png', 0.95);

                                        // 새 이미지 노드 생성
                                        const newId = Date.now().toString();
                                        const newNode: ImageNode = {
                                            id: newId,
                                            baseUrl: upscaledUrl,
                                            currentUrl: upscaledUrl,
                                            x: node.x + 50,
                                            y: node.y + 50,
                                            width: node.width * 2,
                                            height: node.height * 2,
                                            isLocked: false,
                                            imageScale: 0.5,
                                            artboardId: node.artboardId
                                        };
                                        setNodes(prev => [...prev, newNode]);
                                        setSelectedNodeId(newId);
                                    };
                                    img.src = node.currentUrl;
                                }
                            }}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold text-green-600 bg-green-50 hover:bg-green-100 transition-colors"
                            title="2K 업스케일 (새 이미지 생성)"
                        >
                            2K ↑
                        </button>
                        <div className="w-px h-4 bg-gray-200 mx-1" />
                        {/* 채팅 초기화 */}
                        <button
                            onClick={() => setMessages([])}
                            className="px-2 py-1 rounded-lg text-[10px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                            title="채팅 기록 삭제"
                        >
                            초기화
                        </button>
                    </div>
                </div>

                {/* AI VIEWER - 우클릭으로만 이미지 추가 가능 */}
                <div
                    ref={viewerDropZoneRef}
                    className="p-4 border-b border-gray-100 bg-gradient-to-b from-purple-50 to-white"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-1.5 bg-purple-600 px-2.5 py-1 rounded-full text-white shadow-sm">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" /></svg>
                            <span className="text-[10px] font-bold tracking-wide">AI VIEWER</span>
                        </div>
                        {referenceImages.length > 0 && (
                            <span className="text-[10px] text-gray-500">Gemini가 {referenceImages.length}개 이미지를 보고 있어요</span>
                        )}
                    </div>

                    {/* Drop Zone or Images */}
                    {referenceImages.length === 0 ? (
                        <div className="text-center py-2">
                            <p className="text-[10px] text-gray-400">우클릭으로 AI VIEWER에 추가</p>
                        </div>
                    ) : (
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                            {referenceImages.map((refImg) => {
                                const isSelected = selectedRefImageId === refImg.id;
                                return (
                                    <div
                                        key={refImg.id}
                                        className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-sm group transition-all cursor-pointer
                                            ${isSelected ? 'border-3 border-purple-600 ring-2 ring-purple-300' : 'border-2 border-purple-200 hover:border-purple-400'}`}
                                        draggable
                                        onDragStart={(e) => handleRefImageDragStart(e, refImg)}
                                        onClick={() => setSelectedRefImageId(refImg.id)}
                                    >
                                        <img src={refImg.imageUrl} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                                        <div className={`absolute top-0 left-0 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-br-lg z-10 ${isSelected ? 'bg-purple-700' : 'bg-purple-600'}`}>
                                            {refImg.number}
                                        </div>
                                        {refImg.maskDataUrl && (
                                            <div className="absolute bottom-0 right-0 bg-red-500 text-white text-[8px] px-1 rounded-tl-lg">
                                                마킹
                                            </div>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeImageFromViewer(refImg.id);
                                                if (isSelected) setSelectedRefImageId(null);
                                            }}
                                            className="absolute top-0 right-0 p-0.5 text-white bg-black/30 hover:bg-red-500 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                        {/* 선택 표시 */}
                                        {isSelected && (
                                            <div className="absolute inset-0 bg-purple-600/20 pointer-events-none" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-transparent">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-400">
                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                            </div>
                            <h3 className="text-base font-bold text-gray-900 mb-2">디자이너 어시스트</h3>
                            <div className="text-[11px] text-gray-500 leading-relaxed space-y-2 text-left">
                                <p className="font-semibold text-gray-700">📋 워크플로우:</p>
                                <p>1️⃣ 이미지 우클릭 → AI VIEWER 보내기</p>
                                <p>2️⃣ 브러쉬로 수정할 부분 마스킹</p>
                                <p>3️⃣ AI에게 요청하기</p>
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                    <p className="font-semibold text-gray-700 mb-1">💬 예시 명령:</p>
                                    <p className="text-gray-500">"1번의 마스킹된 부분을 2번처럼 바꿔줘"</p>
                                    <p className="text-gray-500">"1번 디자인 스타일로 배너 만들어줘"</p>
                                    <p className="text-gray-500">"마스킹한 부분만 다시 디자인해줘"</p>
                                </div>
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                    <p className="font-semibold text-gray-700 mb-1">✅ AI 기능:</p>
                                    <p className="text-gray-500">• 이미지 분석 (디자인, 서체, 화질)</p>
                                    <p className="text-gray-500">• 마스킹된 부분만 수정 (나머지 유지)</p>
                                    <p className="text-gray-500">• 결과물은 캔버스에 바로 출력</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${msg.role === 'assistant' ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white' : 'bg-black text-white'}`}>
                                {msg.role === 'assistant' ? 'AI' : 'Me'}
                            </div>
                            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${msg.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-gray-800'}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                                AI
                            </div>
                            <div className="bg-gray-100 rounded-2xl px-4 py-3">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef}></div>
                </div>

                {/* Input */}
                <div className="p-4 bg-white border-t border-gray-100">
                    <div className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder={isLoading ? "Gemini가 생각하는 중..." : "Gemini에게 메시지 보내기..."}
                            disabled={isLoading}
                            className="w-full bg-gray-100 text-sm border-0 rounded-2xl pl-4 pr-12 py-3 focus:ring-2 focus:ring-purple-200 focus:bg-white transition-all outline-none"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!input.trim() || isLoading}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-purple-600 text-white rounded-xl disabled:bg-gray-300 transition-colors hover:bg-purple-700"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
