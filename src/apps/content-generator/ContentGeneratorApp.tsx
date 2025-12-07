import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bringModelToStudio, regenerateShoesOnly } from '../detail-generator/services/quickTransferService';

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
};

const MAX_IMAGES = 10;

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
}

// ==================== Component ====================
export default function ContentGeneratorApp() {
    const navigate = useNavigate();

    // Upload states
    const [modelImages, setModelImages] = useState<ImageItem[]>([]);
    const [shoeImages, setShoeImages] = useState<ImageItem[]>([]);
    const [customBackground, setCustomBackground] = useState<ImageItem | null>(null);

    // Options
    const [useStudio, setUseStudio] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

    // Generated content
    const [generatedContents, setGeneratedContents] = useState<GeneratedContent[]>([]);
    const [selectedContentId, setSelectedContentId] = useState<string | null>(null);

    // Drag & Resize states
    const [dragState, setDragState] = useState({ isDragging: false, itemId: null as string | null, startX: 0, startY: 0, initialX: 0, initialY: 0 });
    const [resizeState, setResizeState] = useState({ isResizing: false, itemId: null as string | null, startX: 0, startY: 0, initialSize: 0 });

    const modelInputRef = useRef<HTMLInputElement>(null);
    const shoeInputRef = useRef<HTMLInputElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

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

        try {
            for (let i = 0; i < modelImages.length; i++) {
                setProgress({ current: i + 1, total: totalCount, message: `모델 ${i + 1}/${totalCount} 처리 중...` });

                const modelUrl = modelImages[i].preview;
                const shoeUrl = shoeImages[Math.min(i, shoeImages.length - 1)].preview;

                let resultUrl: string;

                if (useStudio) {
                    // Use Quick Transfer's bringModelToStudio with custom background support
                    resultUrl = await bringModelToStudio(modelUrl, shoeUrl, {
                        resolution: '1K',
                        customBackgroundUrl: customBackground?.preview
                    });
                } else {
                    // Just swap shoes without changing background
                    resultUrl = await regenerateShoesOnly(modelUrl, shoeUrl, { resolution: '1K' });
                }

                // Add to results with 1:1 square format, model slightly reduced
                const size = 280; // Square size
                results.push({
                    id: `content-${Date.now()}-${i}`,
                    url: resultUrl.startsWith('data:') ? resultUrl : `data:image/png;base64,${resultUrl}`,
                    width: size,
                    height: size, // 1:1 ratio
                    x: 40 + (i % 3) * (size + 20),
                    y: 40 + Math.floor(i / 3) * (size + 20),
                });
            }

            setGeneratedContents(prev => [...prev, ...results]);
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
        setSelectedContentId(contentId);
    };

    const handleCanvasClick = () => {
        setSelectedContentId(null);
    };

    const handleContentMouseDown = (e: React.MouseEvent, contentId: string) => {
        const content = generatedContents.find(c => c.id === contentId);
        if (!content) return;
        e.preventDefault(); e.stopPropagation();
        setDragState({ isDragging: true, itemId: contentId, startX: e.clientX, startY: e.clientY, initialX: content.x, initialY: content.y });
    };

    const handleResizeStart = (e: React.MouseEvent, contentId: string) => {
        const content = generatedContents.find(c => c.id === contentId);
        if (!content) return;
        e.preventDefault(); e.stopPropagation();
        setResizeState({ isResizing: true, itemId: contentId, startX: e.clientX, startY: e.clientY, initialSize: content.width });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragState.isDragging && dragState.itemId) {
            setGeneratedContents(prev => prev.map(c => c.id === dragState.itemId
                ? { ...c, x: dragState.initialX + e.clientX - dragState.startX, y: dragState.initialY + e.clientY - dragState.startY }
                : c));
        }
        if (resizeState.isResizing && resizeState.itemId) {
            const dx = e.clientX - resizeState.startX;
            const newSize = Math.max(100, resizeState.initialSize + dx);
            setGeneratedContents(prev => prev.map(c => c.id === resizeState.itemId
                ? { ...c, width: newSize, height: newSize } // Keep 1:1 ratio
                : c));
        }
    };

    const handleMouseUp = () => {
        setDragState(prev => ({ ...prev, isDragging: false, itemId: null }));
        setResizeState(prev => ({ ...prev, isResizing: false, itemId: null }));
    };

    // ==================== Right-click Download ====================
    const handleContextMenu = (e: React.MouseEvent, contentId: string) => {
        e.preventDefault();
        const content = generatedContents.find(c => c.id === contentId);
        if (!content) return;

        // Create download link
        const link = document.createElement('a');
        link.download = `content-${contentId}.png`;
        link.href = content.url;
        link.click();
    };

    const handleDeleteContent = (contentId: string) => {
        setGeneratedContents(prev => prev.filter(c => c.id !== contentId));
        if (selectedContentId === contentId) setSelectedContentId(null);
    };

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
                <button onClick={handleGenerate}
                    disabled={isGenerating || modelImages.length === 0 || shoeImages.length === 0}
                    style={{ background: colors.accentPrimary, color: '#FFFFFF', fontSize: 14, fontWeight: 500, padding: '8px 20px', borderRadius: 980 }}
                    className="hover:opacity-85 disabled:opacity-40 transition-opacity">
                    {isGenerating ? progress.message : `생성 (${modelImages.length}장)`}
                </button>
            </header>

            <div className="flex-grow flex overflow-hidden p-6 gap-6">
                {/* Canvas Area */}
                <div ref={canvasRef}
                    style={{ background: colors.bgSurface, borderRadius: 16, boxShadow: '0 18px 45px rgba(0,0,0,0.08)' }}
                    className="flex-grow relative overflow-auto"
                    onClick={handleCanvasClick} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>

                    {/* Subtle Grid */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                        backgroundImage: `radial-gradient(${colors.borderSoft} 1px, transparent 1px)`,
                        backgroundSize: '32px 32px'
                    }} />

                    {/* Empty State */}
                    {generatedContents.length === 0 && !isGenerating && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center max-w-md px-8">
                                <div style={{ width: 100, height: 100, background: colors.bgSubtle, borderRadius: 28 }} className="mx-auto mb-6 flex items-center justify-center">
                                    <span className="text-4xl">🎨</span>
                                </div>
                                <h2 style={{ fontSize: 28, fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1 }} className="mb-4">
                                    1:1 Square Content
                                </h2>
                                <p style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.6 }}>
                                    모델과 신발 이미지를 업로드하고<br />AI가 자연스럽게 합성합니다
                                </p>
                                <p style={{ fontSize: 12, color: colors.textMuted }} className="mt-3">
                                    우클릭으로 다운로드 가능
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Progress Indicator */}
                    {isGenerating && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                            <div className="text-center">
                                <div style={{ borderColor: colors.borderSoft, borderTopColor: colors.accentPrimary }} className="w-12 h-12 border-3 rounded-full animate-spin mx-auto mb-4" />
                                <p style={{ fontSize: 16, fontWeight: 500, color: colors.textPrimary }}>{progress.message}</p>
                                <p style={{ fontSize: 13, color: colors.textMuted }} className="mt-2">{progress.current}/{progress.total}</p>
                            </div>
                        </div>
                    )}

                    {/* Generated Contents */}
                    {generatedContents.map(content => (
                        <div key={content.id}
                            style={{
                                left: content.x, top: content.y, width: content.width, height: content.height,
                                background: colors.bgSurface,
                                border: selectedContentId === content.id ? `2px solid ${colors.accentPrimary}` : `1px solid ${colors.borderSoft}`,
                                borderRadius: 12,
                                boxShadow: selectedContentId === content.id ? '0 8px 30px rgba(0,0,0,0.12)' : '0 4px 12px rgba(0,0,0,0.06)'
                            }}
                            className="absolute cursor-move transition-all duration-200"
                            onClick={(e) => handleContentClick(e, content.id)}
                            onMouseDown={(e) => handleContentMouseDown(e, content.id)}
                            onContextMenu={(e) => handleContextMenu(e, content.id)}>
                            <img src={content.url} alt="" className="w-full h-full object-cover" style={{ borderRadius: 10 }} draggable={false} />

                            {selectedContentId === content.id && (
                                <>
                                    <div style={{ background: colors.accentPrimary }} className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize rounded-tl-lg"
                                        onMouseDown={(e) => handleResizeStart(e, content.id)} />
                                    <button onClick={() => handleDeleteContent(content.id)} style={{ background: '#FF3B30' }}
                                        className="absolute -top-2 -right-2 w-6 h-6 text-white rounded-full text-sm flex items-center justify-center shadow-lg">×</button>
                                    <div style={{ background: '#10B981', fontSize: 9, padding: '2px 6px', borderRadius: 4 }}
                                        className="absolute bottom-2 left-2 text-white">우클릭 → 다운로드</div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {/* Right Panel */}
                <div style={{ width: 320, background: colors.bgSubtle, borderRadius: 16 }} className="flex flex-col overflow-hidden">
                    {/* Model Images */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12, marginBottom: 0 }} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase">모델 이미지</h3>
                            <span style={{ fontSize: 10, color: colors.textMuted }}>{modelImages.length}/{MAX_IMAGES}</span>
                        </div>
                        <div style={{ border: `2px dashed ${colors.borderSoft}`, borderRadius: 12, minHeight: 100 }}
                            className={`p-3 cursor-pointer hover:border-gray-400 transition-colors ${modelImages.length >= MAX_IMAGES ? 'opacity-50 pointer-events-none' : ''}`}
                            onClick={() => modelInputRef.current?.click()}>
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
                    </div>

                    {/* Shoe Images */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12, marginBottom: 0 }} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase">신발 이미지</h3>
                            <span style={{ fontSize: 10, color: colors.textMuted }}>{shoeImages.length}/{MAX_IMAGES}</span>
                        </div>
                        <div style={{ border: `2px dashed ${colors.borderSoft}`, borderRadius: 12, minHeight: 100 }}
                            className={`p-3 cursor-pointer hover:border-gray-400 transition-colors ${shoeImages.length >= MAX_IMAGES ? 'opacity-50 pointer-events-none' : ''}`}
                            onClick={() => shoeInputRef.current?.click()}>
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
                            <span style={{ fontSize: 11, color: colors.textMuted }}>(배경 변환)</span>
                        </label>

                        {/* Custom Background (when Studio enabled) */}
                        {useStudio && (
                            <div style={{ border: `2px dashed ${customBackground ? '#10B981' : colors.borderSoft}`, borderRadius: 10, minHeight: 70 }}
                                className="cursor-pointer hover:border-green-400 transition-colors overflow-hidden"
                                onClick={() => bgInputRef.current?.click()}>
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

                    {/* Info */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12 }} className="p-4 mt-auto">
                        <h4 style={{ fontSize: 11, fontWeight: 600, color: colors.textPrimary }} className="mb-2">사용 가이드</h4>
                        <ul style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 1.8 }}>
                            <li>• 모델/신발 각 최대 10장</li>
                            <li>• 1:1 정사각형 출력</li>
                            <li>• 드래그로 위치/크기 조절</li>
                            <li>• 우클릭으로 다운로드</li>
                            <li>• Quick Transfer 기능 연동</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
