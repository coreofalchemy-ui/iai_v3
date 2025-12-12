import React, { useState, useRef } from 'react';

const colors = { bgBase: '#F5F5F7', bgSurface: '#FFFFFF', bgSubtle: '#F0F0F4', borderSoft: '#E2E2E8', textPrimary: '#111111', textSecondary: '#6E6E73', textMuted: '#A1A1AA', accentPrimary: '#111111' };

interface QuickTransferModalProps { visible: boolean; onClose: () => void; onGenerate: (options: QuickTransferOptions) => void; }
export interface QuickTransferOptions { models: { name: string; url: string }[]; shoes: { name: string; url: string }[]; beautify: boolean; studio: boolean; modelCuts: number; closeupCuts: number; resolution: '1K' | '4K'; customBackground?: string; }

const MAX_MODELS = 5, MAX_SHOES = 10;
export const POSE_VARIATIONS = ['standing-front', 'standing-side', 'walking-casual', 'sitting-relaxed', 'leaning-wall', 'stepping-forward', 'cross-leg-stand', 'dynamic-motion', 'fashion-pose', 'street-style'] as const;

export default function QuickTransferModal({ visible, onClose, onGenerate }: QuickTransferModalProps) {
    const [models, setModels] = useState<{ file: File; preview: string }[]>([]);
    const [shoes, setShoes] = useState<{ file: File; preview: string }[]>([]);
    const [beautify, setBeautify] = useState(true);
    const [studio, setStudio] = useState(true);
    const [modelCuts, setModelCuts] = useState(3);
    const [closeupCuts, setCloseupCuts] = useState(3);
    const [resolution, setResolution] = useState<'1K' | '4K'>('1K');
    const [isDraggingModel, setIsDraggingModel] = useState(false);
    const [isDraggingShoe, setIsDraggingShoe] = useState(false);
    const [isDraggingBg, setIsDraggingBg] = useState(false);
    const [customBackground, setCustomBackground] = useState<{ file: File; preview: string } | null>(null);
    const modelInputRef = useRef<HTMLInputElement>(null);
    const shoeInputRef = useRef<HTMLInputElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);

    if (!visible) return null;

    const handleModelSelect = (files: FileList | null) => {
        if (!files) return;
        const remaining = MAX_MODELS - models.length;
        const newFiles = Array.from(files).slice(0, remaining);

        // 🔒 중복 제거: name+size 조합으로 체크
        setModels(prev => {
            const existingKeys = new Set(prev.map(m => `${m.file.name}_${m.file.size}`));
            const uniqueNew = newFiles.filter(f => !existingKeys.has(`${f.name}_${f.size}`));
            return [...prev, ...uniqueNew.map(file => ({ file, preview: URL.createObjectURL(file) }))];
        });
    };

    const handleShoeSelect = (files: FileList | null) => {
        if (!files) return;
        const remaining = MAX_SHOES - shoes.length;
        const newFiles = Array.from(files).slice(0, remaining);

        // 🔒 중복 제거: name+size 조합으로 체크
        setShoes(prev => {
            const existingKeys = new Set(prev.map(s => `${s.file.name}_${s.file.size}`));
            const uniqueNew = newFiles.filter(f => !existingKeys.has(`${f.name}_${f.size}`));
            return [...prev, ...uniqueNew.map(file => ({ file, preview: URL.createObjectURL(file) }))];
        });
    };

    const removeModel = (i: number) => { setModels(prev => { const n = [...prev]; URL.revokeObjectURL(n[i].preview); n.splice(i, 1); return n; }); };
    const removeShoe = (i: number) => { setShoes(prev => { const n = [...prev]; URL.revokeObjectURL(n[i].preview); n.splice(i, 1); return n; }); };
    const handleBgSelect = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        if (customBackground) URL.revokeObjectURL(customBackground.preview);
        setCustomBackground({ file, preview: URL.createObjectURL(file) });
    };
    const removeBg = () => { if (customBackground) { URL.revokeObjectURL(customBackground.preview); setCustomBackground(null); } };

    const canGenerate = models.length > 0 && shoes.length > 0;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ fontFamily: "-apple-system, sans-serif" }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div style={{ background: colors.bgSurface, borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }} className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div style={{ borderBottom: `1px solid ${colors.borderSoft}` }} className="p-6 flex justify-between items-center">
                    <div>
                        <h2 style={{ fontSize: 28, fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.02em' }}>Quick Transfer</h2>
                        <p style={{ fontSize: 13, color: colors.textMuted }} className="mt-1">모델 + 신발 합성</p>
                    </div>
                    <button onClick={onClose} style={{ width: 36, height: 36, background: colors.bgSubtle, borderRadius: 18, color: colors.textSecondary, fontSize: 20 }} className="flex items-center justify-center hover:bg-gray-200">×</button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6 space-y-5">
                    {/* Model Upload */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div onClick={() => modelInputRef.current?.click()}
                            onDrop={(e) => { e.preventDefault(); setIsDraggingModel(false); handleModelSelect(e.dataTransfer.files); }}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingModel(true); }}
                            onDragLeave={() => setIsDraggingModel(false)}
                            style={{ border: `2px dashed ${isDraggingModel ? colors.accentPrimary : colors.borderSoft}`, borderRadius: 16, background: isDraggingModel ? colors.bgSubtle : colors.bgSurface, minHeight: 160 }}
                            className={`flex flex-col items-center justify-center cursor-pointer transition-all hover:border-gray-400 ${models.length >= MAX_MODELS ? 'opacity-50 pointer-events-none' : ''}`}>
                            <input ref={modelInputRef} type="file" accept="image/*" multiple onChange={(e) => handleModelSelect(e.target.files)} className="hidden" />
                            <div style={{ width: 56, height: 56, background: colors.bgSubtle, borderRadius: 16 }} className="flex items-center justify-center mb-3"><span className="text-2xl">👤</span></div>
                            <p style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>모델 이미지</p>
                            <p style={{ fontSize: 11, color: colors.textMuted }} className="mt-1">최대 {MAX_MODELS}장</p>
                            <div className="mt-3 flex gap-1">{Array.from({ length: MAX_MODELS }).map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i < models.length ? colors.accentPrimary : colors.borderSoft }} />)}</div>
                        </div>
                        <div style={{ background: colors.bgSubtle, borderRadius: 16, minHeight: 160 }} className="p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase">모델</h3>
                                {models.length > 0 && <span style={{ fontSize: 10, background: colors.accentPrimary, color: '#FFF', padding: '2px 6px', borderRadius: 8 }}>{models.length}장</span>}
                            </div>
                            {models.length === 0 ? <div className="h-[100px] flex items-center justify-center"><p style={{ fontSize: 12, color: colors.textMuted }}>없음</p></div> : (
                                <div className="grid grid-cols-4 gap-2">{models.map((m, i) => (
                                    <div key={i} style={{ border: `1px solid ${colors.borderSoft}`, borderRadius: 8 }} className="relative group aspect-square overflow-hidden bg-white">
                                        <img src={m.preview} className="w-full h-full object-cover" />
                                        <button onClick={(e) => { e.stopPropagation(); removeModel(i); }} style={{ background: '#FF3B30' }} className="absolute top-1 right-1 w-4 h-4 text-white text-xs rounded-full opacity-0 group-hover:opacity-100">×</button>
                                    </div>
                                ))}</div>
                            )}
                        </div>
                    </div>

                    {/* Shoe Upload */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div onClick={() => shoeInputRef.current?.click()}
                            onDrop={(e) => { e.preventDefault(); setIsDraggingShoe(false); handleShoeSelect(e.dataTransfer.files); }}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingShoe(true); }}
                            onDragLeave={() => setIsDraggingShoe(false)}
                            style={{ border: `2px dashed ${isDraggingShoe ? colors.accentPrimary : colors.borderSoft}`, borderRadius: 16, background: isDraggingShoe ? colors.bgSubtle : colors.bgSurface, minHeight: 160 }}
                            className={`flex flex-col items-center justify-center cursor-pointer transition-all hover:border-gray-400 ${shoes.length >= MAX_SHOES ? 'opacity-50 pointer-events-none' : ''}`}>
                            <input ref={shoeInputRef} type="file" accept="image/*" multiple onChange={(e) => handleShoeSelect(e.target.files)} className="hidden" />
                            <div style={{ width: 56, height: 56, background: colors.bgSubtle, borderRadius: 16 }} className="flex items-center justify-center mb-3"><span className="text-2xl">👟</span></div>
                            <p style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary }}>신발 이미지</p>
                            <p style={{ fontSize: 11, color: colors.textMuted }} className="mt-1">최대 {MAX_SHOES}장</p>
                            <div className="mt-3 flex gap-1">{Array.from({ length: MAX_SHOES }).map((_, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i < shoes.length ? colors.accentPrimary : colors.borderSoft }} />)}</div>
                        </div>
                        <div style={{ background: colors.bgSubtle, borderRadius: 16, minHeight: 160 }} className="p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase">신발</h3>
                                {shoes.length > 0 && <span style={{ fontSize: 10, background: colors.accentPrimary, color: '#FFF', padding: '2px 6px', borderRadius: 8 }}>{shoes.length}장</span>}
                            </div>
                            {shoes.length === 0 ? <div className="h-[100px] flex items-center justify-center"><p style={{ fontSize: 12, color: colors.textMuted }}>없음</p></div> : (
                                <div className="grid grid-cols-5 gap-2">{shoes.map((s, i) => (
                                    <div key={i} style={{ border: `1px solid ${colors.borderSoft}`, borderRadius: 8 }} className="relative group aspect-square overflow-hidden bg-white">
                                        <img src={s.preview} className="w-full h-full object-cover" />
                                        <button onClick={(e) => { e.stopPropagation(); removeShoe(i); }} style={{ background: '#FF3B30' }} className="absolute top-1 right-1 w-4 h-4 text-white text-xs rounded-full opacity-0 group-hover:opacity-100">×</button>
                                    </div>
                                ))}</div>
                            )}
                        </div>
                    </div>

                    {/* Custom Background Upload (appears when Studio is enabled) */}
                    {studio && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div onClick={() => bgInputRef.current?.click()}
                                onDrop={(e) => { e.preventDefault(); setIsDraggingBg(false); handleBgSelect(e.dataTransfer.files); }}
                                onDragOver={(e) => { e.preventDefault(); setIsDraggingBg(true); }}
                                onDragLeave={() => setIsDraggingBg(false)}
                                style={{ border: `2px dashed ${isDraggingBg ? '#10B981' : colors.borderSoft}`, borderRadius: 16, background: isDraggingBg ? '#ECFDF5' : colors.bgSurface, minHeight: 120 }}
                                className="flex flex-col items-center justify-center cursor-pointer transition-all hover:border-green-400">
                                <input ref={bgInputRef} type="file" accept="image/*" onChange={(e) => handleBgSelect(e.target.files)} className="hidden" />
                                <div style={{ width: 48, height: 48, background: '#ECFDF5', borderRadius: 14 }} className="flex items-center justify-center mb-2">
                                    <span className="text-xl">🏞️</span>
                                </div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>커스텀 배경 (선택)</p>
                                <p style={{ fontSize: 10, color: colors.textMuted }} className="mt-1">배경을 업로드하면 AI가 자연스럽게 합성</p>
                            </div>
                            <div style={{ background: customBackground ? 'transparent' : colors.bgSubtle, borderRadius: 16, minHeight: 120, overflow: 'hidden', position: 'relative' }}>
                                {customBackground ? (
                                    <div className="relative w-full h-full">
                                        <img src={customBackground.preview} alt="Custom Background" className="w-full h-full object-cover" style={{ minHeight: 120 }} />
                                        <button onClick={(e) => { e.stopPropagation(); removeBg(); }}
                                            style={{ background: '#FF3B30', position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, color: 'white', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            ×
                                        </button>
                                        <div style={{ position: 'absolute', bottom: 8, left: 8, background: '#10B981', color: 'white', fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 500 }}>
                                            커스텀 배경 적용
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center p-4">
                                        <p style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center' }}>배경 없음 - 기본 스튜디오 배경 사용</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Options */}
                    <div style={{ background: colors.bgSurface, border: `1px solid ${colors.borderSoft}`, borderRadius: 16 }} className="p-5">
                        <h3 style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }} className="mb-4">옵션</h3>
                        <div className="flex flex-wrap gap-6 mb-5">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div onClick={() => setBeautify(!beautify)} style={{ width: 20, height: 20, borderRadius: 6, background: beautify ? colors.accentPrimary : colors.bgSubtle, border: `1px solid ${colors.borderSoft}` }} className="flex items-center justify-center">
                                    {beautify && <span className="text-white text-xs">✓</span>}
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary }}>Beautify</span>
                                <span style={{ fontSize: 11, color: colors.textMuted }}>(6장 자동 생성)</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div onClick={() => setStudio(!studio)} style={{ width: 20, height: 20, borderRadius: 6, background: studio ? colors.accentPrimary : colors.bgSubtle, border: `1px solid ${colors.borderSoft}` }} className="flex items-center justify-center">
                                    {studio && <span className="text-white text-xs">✓</span>}
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary }}>Studio</span>
                                <span style={{ fontSize: 11, color: colors.textMuted }}>(배경 변환)</span>
                            </label>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 500, color: colors.textSecondary }} className="block mb-2">Model Cuts</label>
                                <div className="flex gap-1.5">{[1, 2, 3, 4, 5, 6].map(n => (
                                    <button key={n} onClick={() => setModelCuts(n)} style={{ width: 36, height: 36, borderRadius: 8, background: modelCuts === n ? colors.accentPrimary : colors.bgSubtle, color: modelCuts === n ? '#FFF' : colors.textPrimary, fontSize: 13, fontWeight: 500, border: `1px solid ${colors.borderSoft}` }}>{n}</button>
                                ))}</div>
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 500, color: colors.textSecondary }} className="block mb-2">Close-up Cuts</label>
                                <div className="flex gap-1.5">{[1, 2, 3, 4, 5, 6].map(n => (
                                    <button key={n} onClick={() => setCloseupCuts(n)} style={{ width: 36, height: 36, borderRadius: 8, background: closeupCuts === n ? colors.accentPrimary : colors.bgSubtle, color: closeupCuts === n ? '#FFF' : colors.textPrimary, fontSize: 13, fontWeight: 500, border: `1px solid ${colors.borderSoft}` }}>{n}</button>
                                ))}</div>
                            </div>
                            <div className="col-span-2">
                                <label style={{ fontSize: 12, fontWeight: 500, color: colors.textSecondary }} className="block mb-2">Quality (Resolution)</label>
                                <div className="flex gap-3">
                                    {[
                                        { id: '1K', label: '⚡ Fast (1K)', desc: 'Standard speed' },
                                        { id: '4K', label: '✨ Ultra (4K)', desc: 'Gemini 3 Pro Quality' }
                                    ].map(opt => (
                                        <button key={opt.id} onClick={() => setResolution(opt.id as any)}
                                            style={{
                                                flex: 1, padding: '10px',
                                                borderRadius: 12,
                                                background: resolution === opt.id ? colors.accentPrimary : colors.bgSubtle,
                                                color: resolution === opt.id ? '#FFF' : colors.textPrimary,
                                                border: `1px solid ${colors.borderSoft}`,
                                                textAlign: 'left'
                                            }}>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                                            <div style={{ fontSize: 11, opacity: 0.8 }}>{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ borderTop: `1px solid ${colors.borderSoft}` }} className="p-6 flex gap-3">
                    <button onClick={onClose} style={{ flex: 1, padding: '14px 24px', background: 'transparent', border: `1px solid ${colors.borderSoft}`, borderRadius: 12, fontSize: 14, fontWeight: 500, color: colors.textPrimary }} className="hover:bg-gray-50">취소</button>
                    <button onClick={async () => {
                        // Convert Blob URLs to Base64 Data URLs before navigation
                        // (Blob URLs become invalid after page navigation)
                        const convertBlobToBase64 = async (blobUrl: string): Promise<string> => {
                            if (blobUrl.startsWith('data:')) return blobUrl;
                            try {
                                const response = await fetch(blobUrl);
                                const blob = await response.blob();
                                return new Promise((resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => resolve(reader.result as string);
                                    reader.onerror = reject;
                                    reader.readAsDataURL(blob);
                                });
                            } catch (e) {
                                console.error('Failed to convert blob to base64:', e);
                                return blobUrl; // Fallback to original URL
                            }
                        };

                        // Convert all previews to Base64
                        const modelsWithBase64 = await Promise.all(models.map(async m => ({
                            name: m.file.name,
                            url: await convertBlobToBase64(m.preview)
                        })));
                        const shoesWithBase64 = await Promise.all(shoes.map(async s => ({
                            name: s.file.name,
                            url: await convertBlobToBase64(s.preview)
                        })));
                        const customBgBase64 = customBackground ? await convertBlobToBase64(customBackground.preview) : undefined;

                        onGenerate({
                            models: modelsWithBase64,
                            shoes: shoesWithBase64,
                            beautify,
                            studio,
                            modelCuts,
                            closeupCuts,
                            resolution,
                            customBackground: customBgBase64
                        });
                    }}
                        disabled={!canGenerate}
                        style={{ flex: 1, padding: '14px 24px', background: canGenerate ? colors.accentPrimary : colors.borderSoft, color: canGenerate ? '#FFF' : colors.textMuted, borderRadius: 12, fontSize: 14, fontWeight: 500 }}
                        className="disabled:cursor-not-allowed">
                        생성 ({modelCuts + closeupCuts + (beautify ? 6 : 0)}장)
                    </button>
                </div>
            </div>
        </div>
    );
}
