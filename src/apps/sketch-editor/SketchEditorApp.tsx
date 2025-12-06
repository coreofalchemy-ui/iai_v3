import React, { useState, useRef, useCallback } from 'react';
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

interface ModelImage { id: string; url: string; originalUrl: string; isProcessed: boolean; }
interface GeneratedResult { id: string; modelId: string; type: EditType; prompt: string; url: string; timestamp: Date; }
type EditType = 'face' | 'outfit' | 'style' | 'background' | 'pose';
interface EditOption { id: EditType; name: string; nameKo: string; description: string; icon: string; placeholder: string; }

const EDIT_OPTIONS: EditOption[] = [
    { id: 'face', name: 'Change Face', nameKo: '얼굴 변경', description: '모델의 얼굴을 다른 스타일로 변경', icon: '👤', placeholder: '예: 아시아 여성, 20대' },
    { id: 'outfit', name: 'Change Outfit', nameKo: '의상 변경', description: '모델의 의상을 다른 스타일로 교체', icon: '👗', placeholder: '예: 청바지와 흰색 티셔츠' },
    { id: 'style', name: 'Change Style', nameKo: '스타일 변경', description: '전체적인 패션 스타일 변경', icon: '✨', placeholder: '예: 스트릿 패션, 미니멀' },
    { id: 'background', name: 'Change Background', nameKo: '배경 변경', description: '사진의 배경을 변경', icon: '🏞️', placeholder: '예: 스튜디오 배경' },
    { id: 'pose', name: 'Change Pose', nameKo: '포즈 변경', description: '모델의 포즈를 변경', icon: '🧍', placeholder: '예: 걷는 포즈' }
];

const QUICK_PRESETS = [
    { type: 'face' as EditType, prompt: '20대 동양인 여성', label: '20대 여성' },
    { type: 'outfit' as EditType, prompt: '캐주얼 청바지', label: '캐주얼' },
    { type: 'style' as EditType, prompt: '미니멀 시크', label: '미니멀' },
    { type: 'background' as EditType, prompt: '스튜디오 배경', label: '스튜디오' },
    { type: 'outfit' as EditType, prompt: '정장 수트', label: '비즈니스' },
    { type: 'style' as EditType, prompt: '스트릿 패션', label: '스트릿' },
];

export default function SketchEditorApp() {
    const navigate = useNavigate();
    const [modelImages, setModelImages] = useState<ModelImage[]>([]);
    const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
    const [selectedEditType, setSelectedEditType] = useState<EditType>('face');
    const [customPrompt, setCustomPrompt] = useState('');
    const [generatedResults, setGeneratedResults] = useState<GeneratedResult[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<HTMLDivElement>(null);
    const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
        for (const file of files) {
            const url = URL.createObjectURL(file);
            setModelImages(prev => [...prev, { id: `model-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, url, originalUrl: url, isProcessed: false }]);
        }
    };

    const handleApplyEdit = async (type: EditType, prompt: string) => {
        if (!selectedModelId || !prompt.trim()) return;
        setIsProcessing(true);
        try {
            await genAI.models.generateContent({ model: 'gemini-2.0-flash', contents: `패션 이미지 편집: ${EDIT_OPTIONS.find(e => e.id === type)?.nameKo} - ${prompt}` });
            await new Promise(r => setTimeout(r, 2000));
            const model = modelImages.find(m => m.id === selectedModelId);
            if (model) setGeneratedResults(prev => [...prev, { id: `result-${Date.now()}`, modelId: selectedModelId, type, prompt, url: model.url, timestamp: new Date() }]);
        } catch (e) { console.error(e); }
        finally { setIsProcessing(false); setCustomPrompt(''); }
    };

    const handleSaveGallery = useCallback(async () => {
        if (!galleryRef.current || generatedResults.length === 0) return;
        const canvas = await html2canvas(galleryRef.current, { backgroundColor: colors.bgBase, scale: 2 });
        const link = document.createElement('a');
        link.download = `model-styler-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    }, [generatedResults.length]);

    const handleDownload = useCallback(async (url: string, type: string) => {
        const response = await fetch(url);
        const blob = await response.blob();
        const link = document.createElement('a');
        link.download = `model-${type}-${Date.now()}.png`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }, []);

    const selectedModel = modelImages.find(m => m.id === selectedModelId);
    const selectedEditOption = EDIT_OPTIONS.find(e => e.id === selectedEditType);

    return (
        <div className="min-h-screen flex flex-col" style={{ background: colors.bgBase, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
            {/* Header */}
            <header style={{ height: 56, background: colors.bgBase, borderBottom: `1px solid ${colors.borderSoft}` }} className="flex items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate('/')} style={{ color: colors.textSecondary }} className="hover:opacity-70"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg></button>
                    <h1 style={{ fontSize: 17, fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.02em' }}>Model Styler</h1>
                </div>
                {generatedResults.length > 0 && (
                    <button onClick={handleSaveGallery} style={{ background: colors.accentPrimary, color: '#FFF', padding: '8px 20px', borderRadius: 980, fontSize: 14, fontWeight: 500 }} className="hover:opacity-85">저장</button>
                )}
            </header>

            <div className="flex-grow flex overflow-hidden p-6 gap-6">
                {/* Left Panel */}
                <div style={{ width: 300, background: colors.bgSubtle, borderRadius: 16 }} className="flex flex-col overflow-hidden">
                    {/* Model Upload */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12, marginBottom: 0 }} className="p-4">
                        <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase mb-3">모델 이미지</h3>
                        <div style={{ border: `2px dashed ${colors.borderSoft}`, borderRadius: 12, height: 80 }} className="flex items-center justify-center cursor-pointer hover:border-gray-400" onClick={() => inputRef.current?.click()}>
                            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
                            <span style={{ fontSize: 12, color: colors.textMuted }}>+ 모델 사진 업로드</span>
                        </div>
                        {modelImages.length > 0 && (
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                {modelImages.map(m => (
                                    <div key={m.id} style={{ border: selectedModelId === m.id ? `2px solid ${colors.accentPrimary}` : `1px solid ${colors.borderSoft}`, borderRadius: 8 }}
                                        className={`relative aspect-square overflow-hidden cursor-pointer ${selectedModelId !== m.id ? 'opacity-60 hover:opacity-100' : ''}`}
                                        onClick={() => setSelectedModelId(m.id)}>
                                        <img src={m.url} alt="" className="w-full h-full object-cover" />
                                        <button onClick={(e) => { e.stopPropagation(); setModelImages(prev => prev.filter(x => x.id !== m.id)); if (selectedModelId === m.id) setSelectedModelId(null); }}
                                            style={{ background: '#FF3B30' }} className="absolute top-1 right-1 w-4 h-4 text-white rounded-full text-xs flex items-center justify-center">×</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Edit Type */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12, marginBottom: 0 }} className="p-4">
                        <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase mb-3">편집 타입</h3>
                        <div className="flex flex-wrap gap-1.5">
                            {EDIT_OPTIONS.map(opt => (
                                <button key={opt.id} onClick={() => setSelectedEditType(opt.id)}
                                    style={{ background: selectedEditType === opt.id ? colors.accentPrimary : colors.bgSubtle, color: selectedEditType === opt.id ? '#FFF' : colors.textPrimary, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 500 }}>
                                    {opt.icon} {opt.nameKo}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Input */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12, marginBottom: 0 }} className="p-4">
                        <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase mb-2">{selectedEditOption?.icon} {selectedEditOption?.nameKo}</h3>
                        <p style={{ fontSize: 10, color: colors.textMuted }} className="mb-2">{selectedEditOption?.description}</p>
                        <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder={selectedEditOption?.placeholder}
                            style={{ background: colors.bgSubtle, border: 'none', borderRadius: 8, fontSize: 12, color: colors.textPrimary, resize: 'none' }} className="w-full h-16 p-3 outline-none" />
                        <button onClick={() => handleApplyEdit(selectedEditType, customPrompt)} disabled={isProcessing || !selectedModelId || !customPrompt.trim()}
                            style={{ background: colors.accentPrimary, color: '#FFF', borderRadius: 8, fontSize: 12, fontWeight: 500 }} className="w-full mt-2 py-2 disabled:opacity-40">
                            {isProcessing ? '처리 중...' : '적용하기'}
                        </button>
                    </div>

                    {/* Quick Presets */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12 }} className="p-4 flex-grow overflow-y-auto">
                        <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase mb-3">퀵 프리셋</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {QUICK_PRESETS.map((p, i) => (
                                <button key={i} onClick={() => { setSelectedEditType(p.type); handleApplyEdit(p.type, p.prompt); }} disabled={isProcessing || !selectedModelId}
                                    style={{ background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8 }} className="p-2 text-left hover:bg-gray-100 disabled:opacity-40">
                                    <span className="text-lg block mb-0.5">{EDIT_OPTIONS.find(o => o.id === p.type)?.icon}</span>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: colors.textPrimary }}>{p.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Canvas/Results */}
                <div style={{ background: colors.bgSurface, borderRadius: 16, boxShadow: '0 18px 45px rgba(0,0,0,0.08)' }} className="flex-grow p-6 overflow-y-auto">
                    {selectedModel ? (
                        <>
                            <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase mb-3">선택된 모델</h3>
                            <div style={{ width: 160, border: `1px solid ${colors.borderSoft}`, borderRadius: 12 }} className="aspect-[3/4] overflow-hidden mb-6">
                                <img src={selectedModel.url} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div ref={galleryRef}>
                                <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase mb-3">
                                    편집 결과 ({generatedResults.filter(r => r.modelId === selectedModelId).length})
                                </h3>
                                {generatedResults.filter(r => r.modelId === selectedModelId).length === 0 ? (
                                    <div className="text-center py-12"><span className="text-3xl block mb-2">👤</span><p style={{ fontSize: 13, color: colors.textMuted }}>왼쪽에서 편집 옵션을 선택하세요</p></div>
                                ) : (
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                        {generatedResults.filter(r => r.modelId === selectedModelId).map(res => (
                                            <div key={res.id} style={{ background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 12 }} className="overflow-hidden group">
                                                <div className="aspect-[3/4] relative">
                                                    <img src={res.url} alt="" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <button onClick={() => handleDownload(res.url, res.type)} style={{ background: colors.accentPrimary, color: '#FFF', borderRadius: 8, fontSize: 12, padding: '6px 12px' }}>저장</button>
                                                        <button onClick={() => setGeneratedResults(prev => prev.filter(r => r.id !== res.id))} style={{ background: '#FF3B30', color: '#FFF', borderRadius: 8, fontSize: 12, padding: '6px 12px' }}>삭제</button>
                                                    </div>
                                                </div>
                                                <div className="p-3">
                                                    <span style={{ fontSize: 12, fontWeight: 500, color: colors.textPrimary }}>{EDIT_OPTIONS.find(e => e.id === res.type)?.icon} {EDIT_OPTIONS.find(e => e.id === res.type)?.nameKo}</span>
                                                    <p style={{ fontSize: 10, color: colors.textMuted }} className="truncate mt-0.5">{res.prompt}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center max-w-md">
                                <div style={{ width: 100, height: 100, background: colors.bgSubtle, borderRadius: 28 }} className="mx-auto mb-6 flex items-center justify-center"><span className="text-4xl">👤</span></div>
                                <h2 style={{ fontSize: 32, fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.02em' }} className="mb-4">Model Styler</h2>
                                <p style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 1.6 }}>모델 사진을 업로드하고<br />AI로 스타일을 변경하세요</p>
                                <div className="flex flex-wrap justify-center gap-2 mt-4">
                                    {EDIT_OPTIONS.map(o => <span key={o.id} style={{ background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 20, padding: '4px 12px', fontSize: 11, color: colors.textSecondary }}>{o.icon} {o.nameKo}</span>)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isProcessing && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div style={{ background: colors.bgSurface, borderRadius: 20, boxShadow: '0 18px 45px rgba(0,0,0,0.15)' }} className="p-8 text-center">
                        <div style={{ borderColor: colors.borderSoft, borderTopColor: colors.accentPrimary }} className="w-12 h-12 border-3 rounded-full animate-spin mx-auto mb-4" />
                        <p style={{ fontSize: 15, fontWeight: 500, color: colors.textPrimary }}>AI 편집 중...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
