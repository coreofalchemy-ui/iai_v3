import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";
import html2canvas from 'html2canvas';

// ==================== Design Tokens (Grey on Grey) ====================
const colors = {
    bgBase: '#F5F5F7',
    bgSurface: '#FFFFFF',
    bgSubtle: '#F0F0F4',
    borderSoft: '#E2E2E8',
    textPrimary: '#111111',
    textSecondary: '#6E6E73',
    textMuted: '#A1A1AA',
    accentPrimary: '#111111',
};

// ==================== Types ====================
interface ShoeSource { id: string; url: string; file: File; }
interface ShoeModel { id: string; sourceUrls: string[]; analyzed: boolean; }
interface ContentItem {
    id: string;
    baseUrl: string;
    currentUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isSelected: boolean;
    isProcessing: boolean;
}
interface TextOverlay {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
}

// ==================== Component ====================
export default function ContentGeneratorApp() {
    const navigate = useNavigate();

    const [shoeSources, setShoeSources] = useState<ShoeSource[]>([]);
    const [shoeModel, setShoeModel] = useState<ShoeModel | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [contentItems, setContentItems] = useState<ContentItem[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
    const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
    const [showTextInput, setShowTextInput] = useState(false);
    const [newText, setNewText] = useState('');
    const [textColor, setTextColor] = useState(colors.textPrimary);
    const [textSize, setTextSize] = useState(48);

    const [dragState, setDragState] = useState({ isDragging: false, itemId: null as string | null, startX: 0, startY: 0, initialX: 0, initialY: 0 });
    const [textDragState, setTextDragState] = useState({ isDragging: false, textId: null as string | null, startX: 0, startY: 0, initialX: 0, initialY: 0 });
    const [resizeState, setResizeState] = useState({ isResizing: false, itemId: null as string | null, startX: 0, startY: 0, initialWidth: 0, initialHeight: 0 });

    const canvasRef = useRef<HTMLDivElement>(null);
    const shoeInputRef = useRef<HTMLInputElement>(null);
    const contentInputRef = useRef<HTMLInputElement>(null);
    const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
    const selectedItem = contentItems.find(item => item.id === selectedItemId);

    // ==================== Shoe Upload ====================
    const handleShoeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/')).slice(0, 3);
        const newSources = files.map((file, idx) => ({ id: `shoe-${Date.now()}-${idx}`, url: URL.createObjectURL(file), file }));
        setShoeSources(prev => [...prev, ...newSources].slice(0, 3));
    };

    const handleRemoveShoe = (id: string) => {
        setShoeSources(prev => prev.filter(s => s.id !== id));
        if (shoeSources.length <= 1) setShoeModel(null);
    };

    useEffect(() => {
        if (shoeSources.length > 0 && !shoeModel) {
            setIsAnalyzing(true);
            setTimeout(() => {
                setShoeModel({ id: `model-${Date.now()}`, sourceUrls: shoeSources.map(s => s.url), analyzed: true });
                setIsAnalyzing(false);
            }, 1500);
        }
    }, [shoeSources]);

    // ==================== Content Upload ====================
    const handleContentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
        files.forEach((file, idx) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                const width = Math.min(300, img.naturalWidth);
                const height = width / aspectRatio;
                const newItem: ContentItem = {
                    id: `content-${Date.now()}-${idx}`,
                    baseUrl: url, currentUrl: url,
                    x: 80 + (idx % 2) * 340, y: 80 + Math.floor(idx / 2) * 360,
                    width, height, isSelected: false, isProcessing: !!shoeModel
                };
                setContentItems(prev => [...prev, newItem]);
                if (shoeModel) {
                    setTimeout(() => {
                        setContentItems(prev => prev.map(item => item.id === newItem.id ? { ...item, isProcessing: false } : item));
                    }, 2000);
                }
            };
            img.src = url;
        });
    };

    // ==================== Canvas Interactions ====================
    const handleItemClick = (e: React.MouseEvent, itemId: string) => {
        e.stopPropagation();
        setContentItems(prev => prev.map(item => ({ ...item, isSelected: item.id === itemId })));
        setSelectedItemId(itemId);
        setSelectedTextId(null);
    };

    const handleCanvasClick = () => {
        setContentItems(prev => prev.map(item => ({ ...item, isSelected: false })));
        setSelectedItemId(null);
        setSelectedTextId(null);
    };

    const handleItemMouseDown = (e: React.MouseEvent, itemId: string) => {
        const item = contentItems.find(i => i.id === itemId);
        if (!item) return;
        e.preventDefault(); e.stopPropagation();
        setDragState({ isDragging: true, itemId, startX: e.clientX, startY: e.clientY, initialX: item.x, initialY: item.y });
    };

    const handleResizeStart = (e: React.MouseEvent, itemId: string) => {
        const item = contentItems.find(i => i.id === itemId);
        if (!item) return;
        e.preventDefault(); e.stopPropagation();
        setResizeState({ isResizing: true, itemId, startX: e.clientX, startY: e.clientY, initialWidth: item.width, initialHeight: item.height });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragState.isDragging && dragState.itemId) {
            setContentItems(prev => prev.map(item => item.id === dragState.itemId
                ? { ...item, x: dragState.initialX + e.clientX - dragState.startX, y: dragState.initialY + e.clientY - dragState.startY }
                : item));
        }
        if (textDragState.isDragging && textDragState.textId) {
            setTextOverlays(prev => prev.map(t => t.id === textDragState.textId
                ? { ...t, x: textDragState.initialX + e.clientX - textDragState.startX, y: textDragState.initialY + e.clientY - textDragState.startY }
                : t));
        }
        if (resizeState.isResizing && resizeState.itemId) {
            const dx = e.clientX - resizeState.startX;
            setContentItems(prev => prev.map(item => item.id === resizeState.itemId
                ? { ...item, width: Math.max(150, resizeState.initialWidth + dx), height: Math.max(150, resizeState.initialHeight + dx * (item.height / item.width)) }
                : item));
        }
    };

    const handleMouseUp = () => {
        setDragState(prev => ({ ...prev, isDragging: false, itemId: null }));
        setTextDragState(prev => ({ ...prev, isDragging: false, textId: null }));
        setResizeState(prev => ({ ...prev, isResizing: false, itemId: null }));
    };

    // ==================== Edit Actions ====================
    const handleChangePose = async () => {
        if (!selectedItem) return;
        setContentItems(prev => prev.map(item => item.id === selectedItemId ? { ...item, isProcessing: true } : item));
        await new Promise(r => setTimeout(r, 2000));
        setContentItems(prev => prev.map(item => item.id === selectedItemId ? { ...item, isProcessing: false } : item));
    };

    const handleChangePantsColor = async () => {
        if (!selectedItem) return;
        setContentItems(prev => prev.map(item => item.id === selectedItemId ? { ...item, isProcessing: true } : item));
        await new Promise(r => setTimeout(r, 2000));
        setContentItems(prev => prev.map(item => item.id === selectedItemId ? { ...item, isProcessing: false } : item));
    };

    const handleDeleteItem = (itemId: string) => {
        setContentItems(prev => prev.filter(item => item.id !== itemId));
        if (selectedItemId === itemId) setSelectedItemId(null);
    };

    // ==================== Text Overlay ====================
    const handleAddText = () => {
        if (!newText.trim()) return;
        setTextOverlays(prev => [...prev, { id: `text-${Date.now()}`, text: newText, x: 200, y: 80, fontSize: textSize, color: textColor }]);
        setNewText('');
        setShowTextInput(false);
    };

    const handleTextMouseDown = (e: React.MouseEvent, textId: string) => {
        e.preventDefault(); e.stopPropagation();
        const text = textOverlays.find(t => t.id === textId);
        if (!text) return;
        setTextDragState({ isDragging: true, textId, startX: e.clientX, startY: e.clientY, initialX: text.x, initialY: text.y });
        setSelectedTextId(textId);
        setSelectedItemId(null);
    };

    // ==================== Save ====================
    const handleSave = useCallback(async () => {
        if (!canvasRef.current) return;
        const canvas = await html2canvas(canvasRef.current, { backgroundColor: colors.bgBase, scale: 2 });
        const link = document.createElement('a');
        link.download = `content-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }, []);

    // ==================== Render ====================
    return (
        <div className="min-h-screen flex flex-col" style={{ background: colors.bgBase, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
            {/* Header */}
            <header style={{ height: 56, background: colors.bgBase, borderBottom: `1px solid ${colors.borderSoft}` }} className="flex items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate('/')} style={{ color: colors.textSecondary }} className="hover:opacity-70 transition-opacity">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 style={{ fontSize: 17, fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.02em' }}>Content Generator</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setShowTextInput(!showTextInput)} style={{ fontSize: 14, color: colors.textSecondary }} className="hover:opacity-70 transition-opacity">텍스트 추가</button>
                    <button onClick={handleSave} disabled={contentItems.length === 0}
                        style={{ background: colors.accentPrimary, color: '#FFFFFF', fontSize: 14, fontWeight: 500, padding: '8px 20px', borderRadius: 980 }}
                        className="hover:opacity-85 disabled:opacity-40 transition-opacity">
                        저장
                    </button>
                </div>
            </header>

            {/* Text Input Popup */}
            {showTextInput && (
                <div style={{ background: colors.bgSurface, border: `1px solid ${colors.borderSoft}`, borderRadius: 16, boxShadow: '0 18px 45px rgba(0,0,0,0.08)' }}
                    className="absolute top-16 right-8 z-50 p-5 w-72">
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }} className="mb-4">텍스트 추가</h4>
                    <input type="text" value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="입력..."
                        style={{ background: colors.bgSubtle, border: 'none', borderRadius: 10, fontSize: 14, color: colors.textPrimary }}
                        className="w-full px-4 py-3 mb-3 outline-none" />
                    <div className="flex gap-3 mb-4">
                        <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                        <select value={textSize} onChange={(e) => setTextSize(Number(e.target.value))}
                            style={{ background: colors.bgSubtle, border: 'none', borderRadius: 10, fontSize: 14, color: colors.textPrimary }}
                            className="flex-grow px-3">
                            <option value={32}>32px</option><option value={48}>48px</option><option value={64}>64px</option><option value={80}>80px</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleAddText} style={{ background: colors.accentPrimary, color: '#FFF', borderRadius: 10, fontSize: 14, fontWeight: 500 }} className="flex-1 py-2.5">추가</button>
                        <button onClick={() => setShowTextInput(false)} style={{ background: colors.bgSubtle, color: colors.textPrimary, borderRadius: 10, fontSize: 14 }} className="flex-1 py-2.5">취소</button>
                    </div>
                </div>
            )}

            <div className="flex-grow flex overflow-hidden p-6 gap-6">
                {/* Canvas Card */}
                <div ref={canvasRef}
                    style={{ background: colors.bgSurface, borderRadius: 16, boxShadow: '0 18px 45px rgba(0,0,0,0.08)' }}
                    className="flex-grow relative overflow-hidden"
                    onClick={handleCanvasClick} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>

                    {/* Subtle Grid */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                        backgroundImage: `radial-gradient(${colors.borderSoft} 1px, transparent 1px)`,
                        backgroundSize: '32px 32px'
                    }} />

                    {/* Empty State */}
                    {contentItems.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center max-w-md px-8">
                                <div style={{ width: 100, height: 100, background: colors.bgSubtle, borderRadius: 28 }} className="mx-auto mb-6 flex items-center justify-center">
                                    <span className="text-4xl">👟</span>
                                </div>
                                <h2 style={{ fontSize: 32, fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1 }} className="mb-4">
                                    Content<br />Generator
                                </h2>
                                <p style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 1.6 }}>
                                    신발 이미지를 업로드하고<br />콘텐츠에 자동으로 적용하세요
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Content Items */}
                    {contentItems.map(item => (
                        <div key={item.id}
                            style={{
                                left: item.x, top: item.y, width: item.width, height: item.height,
                                background: colors.bgSurface,
                                border: item.isSelected ? `2px solid ${colors.accentPrimary}` : `1px solid ${colors.borderSoft}`,
                                borderRadius: 12,
                                boxShadow: item.isSelected ? '0 8px 30px rgba(0,0,0,0.12)' : '0 4px 12px rgba(0,0,0,0.06)'
                            }}
                            className="absolute cursor-move transition-all duration-200"
                            onClick={(e) => handleItemClick(e, item.id)}
                            onMouseDown={(e) => handleItemMouseDown(e, item.id)}>
                            <img src={item.currentUrl} alt="" className="w-full h-full object-cover" style={{ borderRadius: 10 }} draggable={false} />

                            {item.isProcessing && (
                                <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 10 }} className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                        <div style={{ borderColor: colors.borderSoft, borderTopColor: colors.accentPrimary }} className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-2" />
                                        <p style={{ fontSize: 12, color: colors.textSecondary }}>신발 교체 중...</p>
                                    </div>
                                </div>
                            )}

                            {item.isSelected && !item.isProcessing && (
                                <>
                                    <div style={{ background: colors.accentPrimary }} className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize rounded-tl-lg" onMouseDown={(e) => handleResizeStart(e, item.id)} />
                                    <button onClick={() => handleDeleteItem(item.id)} style={{ background: '#FF3B30' }} className="absolute -top-2 -right-2 w-6 h-6 text-white rounded-full text-sm flex items-center justify-center shadow-lg">×</button>
                                </>
                            )}
                        </div>
                    ))}

                    {/* Text Overlays */}
                    {textOverlays.map(text => (
                        <div key={text.id}
                            style={{
                                left: text.x, top: text.y, fontSize: text.fontSize, color: text.color, fontWeight: 600, letterSpacing: '-0.02em',
                                border: selectedTextId === text.id ? `2px solid ${colors.accentPrimary}` : 'none', padding: selectedTextId === text.id ? 4 : 0
                            }}
                            className="absolute cursor-move select-none"
                            onMouseDown={(e) => handleTextMouseDown(e, text.id)}>
                            {text.text}
                            {selectedTextId === text.id && (
                                <button onClick={() => { setTextOverlays(prev => prev.filter(t => t.id !== text.id)); setSelectedTextId(null); }}
                                    style={{ background: '#FF3B30' }} className="absolute -top-2 -right-2 w-5 h-5 text-white rounded-full text-xs flex items-center justify-center">×</button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Right Panel */}
                <div style={{ width: 300, background: colors.bgSubtle, borderRadius: 16 }} className="flex flex-col overflow-hidden">
                    {/* Shoe Section */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12, marginBottom: 0 }} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase">신발 이미지</h3>
                            {shoeModel && <span style={{ fontSize: 10, color: '#34C759', fontWeight: 500 }}>✓ 분석 완료</span>}
                        </div>
                        <div style={{ border: `2px dashed ${colors.borderSoft}`, borderRadius: 12, height: 100 }}
                            className="flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
                            onClick={() => shoeInputRef.current?.click()}>
                            <input ref={shoeInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleShoeUpload} />
                            {shoeSources.length === 0 ? (
                                <div className="text-center">
                                    <span className="text-2xl block mb-1">👟</span>
                                    <span style={{ fontSize: 12, color: colors.textMuted }}>1~3장 업로드</span>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    {shoeSources.map(shoe => (
                                        <div key={shoe.id} className="relative group">
                                            <img src={shoe.url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                                            <button onClick={(e) => { e.stopPropagation(); handleRemoveShoe(shoe.id); }}
                                                style={{ background: '#FF3B30' }} className="absolute -top-1 -right-1 w-4 h-4 text-white rounded-full text-xs opacity-0 group-hover:opacity-100">×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {isAnalyzing && <p style={{ fontSize: 11, color: colors.textMuted }} className="mt-2 flex items-center gap-1">
                            <span className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />분석 중...
                        </p>}
                    </div>

                    {/* Content Section */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12, marginBottom: 0 }} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase">콘텐츠 이미지</h3>
                            <span style={{ fontSize: 11, color: colors.textMuted }}>{contentItems.length}장</span>
                        </div>
                        <div style={{ border: `2px dashed ${colors.borderSoft}`, borderRadius: 12, height: 110 }}
                            className="flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
                            onClick={() => contentInputRef.current?.click()}>
                            <input ref={contentInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleContentUpload} />
                            <div className="text-center">
                                <span className="text-2xl block mb-1">📸</span>
                                <span style={{ fontSize: 12, color: colors.textMuted }}>룩북/라이프스타일</span>
                                <p style={{ fontSize: 10, color: colors.textMuted }} className="mt-0.5">자동 신발 교체</p>
                            </div>
                        </div>
                    </div>

                    {/* Edit Actions */}
                    {selectedItem && !selectedItem.isProcessing && (
                        <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12, marginBottom: 0 }} className="p-4">
                            <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase mb-3">추가 편집</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={handleChangePose} disabled={!shoeModel}
                                    style={{ background: colors.bgSubtle, borderRadius: 10, border: `1px solid ${colors.borderSoft}` }}
                                    className="p-3 text-center hover:bg-gray-100 disabled:opacity-40 transition-colors">
                                    <span className="text-xl block mb-1">🧍</span>
                                    <span style={{ fontSize: 11, color: colors.textPrimary, fontWeight: 500 }}>자세 변경</span>
                                </button>
                                <button onClick={handleChangePantsColor} disabled={!shoeModel}
                                    style={{ background: colors.bgSubtle, borderRadius: 10, border: `1px solid ${colors.borderSoft}` }}
                                    className="p-3 text-center hover:bg-gray-100 disabled:opacity-40 transition-colors">
                                    <span className="text-xl block mb-1">👖</span>
                                    <span style={{ fontSize: 11, color: colors.textPrimary, fontWeight: 500 }}>바지 컬러</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Guide */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12 }} className="p-4 mt-auto">
                        <h4 style={{ fontSize: 11, fontWeight: 600, color: colors.textPrimary }} className="mb-2">사용 가이드</h4>
                        <ul style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 1.8 }}>
                            <li>1. 신발 이미지 업로드</li>
                            <li>2. 콘텐츠 이미지 → 자동 교체</li>
                            <li>3. 드래그로 위치 조정</li>
                            <li>4. 선택 후 추가 편집</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
