import React, { useState, useRef } from 'react';
import { generateFaceBatch, upscaleFace, batchFaceReplacement } from '../services/geminiService';

const colors = { bgBase: '#F5F5F7', bgSurface: '#FFFFFF', bgSubtle: '#F0F0F4', borderSoft: '#E2E2E8', textPrimary: '#111111', textSecondary: '#6E6E73', textMuted: '#A1A1AA', accentPrimary: '#111111' };

interface ModelChapterPanelProps { data: any; onUpdate: (newData: any) => void; lang?: 'ko' | 'en'; }

export default function ModelChapterPanel({ data, onUpdate }: ModelChapterPanelProps) {
    const [referenceFaces, setReferenceFaces] = useState<Array<{ file: File; preview: string }>>([]);
    const [gender, setGender] = useState<'male' | 'female'>('female');
    const [race, setRace] = useState('한국인');
    const [age, setAge] = useState('23');
    const [isGenerating, setIsGenerating] = useState(false);
    const generatedFaces = data.generatedFaces || [];
    const selectedFace = data.selectedFace || null;
    const setGeneratedFaces = (faces: string[]) => onUpdate({ ...data, generatedFaces: faces });
    const setSelectedFace = (face: string | null) => onUpdate({ ...data, selectedFace: face });
    const [upscaledFace, setUpscaledFace] = useState<string | null>(null);
    const [isUpscaling, setIsUpscaling] = useState(false);
    const [compareSlider, setCompareSlider] = useState(50);
    const sliderRef = useRef<HTMLDivElement>(null);
    const [isReplacingAllFaces, setIsReplacingAllFaces] = useState(false);
    const [replaceProgress, setReplaceProgress] = useState({ current: 0, total: 0 });

    const handleReferenceFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).slice(0, 5 - referenceFaces.length);
            const newFaces = newFiles.map(file => new Promise<{ file: File; preview: string }>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve({ file, preview: e.target?.result as string });
                reader.readAsDataURL(file);
            }));
            Promise.all(newFaces).then(faces => setReferenceFaces(prev => [...prev, ...faces]));
        }
    };

    const removeReferenceFace = (index: number) => setReferenceFaces(prev => prev.filter((_, i) => i !== index));

    const handleGenerate = async () => {
        setIsGenerating(true); setUpscaledFace(null);
        try { const faces = await generateFaceBatch(gender, race, age, referenceFaces.map(f => f.preview)); setGeneratedFaces([...generatedFaces, ...faces]); }
        catch (e) { console.error('Error:', e); alert('Face generation failed'); }
        finally { setIsGenerating(false); }
    };

    const handleSelectFace = async (faceUrl: string) => { setSelectedFace(faceUrl); setUpscaledFace(null); };

    const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!sliderRef.current) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        setCompareSlider((x / rect.width) * 100);
    };

    const handleApplyFaceToAllPreview = async () => {
        if (!selectedFace) return alert('Select a face first.');
        const allImageUrls: string[] = [];
        const imageUrls = data.imageUrls || {};
        if (imageUrls.modelShots && Array.isArray(imageUrls.modelShots)) allImageUrls.push(...imageUrls.modelShots.filter((url: string) => url?.startsWith('data:')));
        Object.entries(imageUrls).forEach(([key, value]) => { if (key.startsWith('model') && typeof value === 'string' && value.startsWith('data:') && !allImageUrls.includes(value)) allImageUrls.push(value); });
        if (allImageUrls.length === 0) return alert('No model images in preview.');
        setIsReplacingAllFaces(true); setReplaceProgress({ current: 0, total: allImageUrls.length });
        try {
            const results = await batchFaceReplacement(allImageUrls, selectedFace, (current, total) => setReplaceProgress({ current, total }));
            const newImageUrls = { ...imageUrls }; let successCount = 0;
            results.forEach((result) => {
                if (result.result) {
                    if (newImageUrls.modelShots?.length) { const idx = newImageUrls.modelShots.indexOf(result.original); if (idx !== -1) { newImageUrls.modelShots[idx] = result.result; successCount++; } }
                    Object.entries(newImageUrls).forEach(([key, value]) => { if (value === result.original) { newImageUrls[key] = result.result; successCount++; } });
                }
            });
            if (successCount > 0) { onUpdate({ ...data, imageUrls: newImageUrls }); alert(`${successCount} face(s) replaced.`); }
            else alert('Face replacement failed.');
        } catch (error) { console.error('Error:', error); alert('Face replacement error.'); }
        finally { setIsReplacingAllFaces(false); setReplaceProgress({ current: 0, total: 0 }); }
    };

    return (
        <div className="space-y-3" style={{ fontFamily: '-apple-system, sans-serif' }}>
            {/* Reference Face Upload */}
            <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }} className="mb-2 block">참고 얼굴</span>
                <p style={{ fontSize: 11, color: colors.textMuted }} className="mb-2">AI 합성용 참고 얼굴 최대 5장 업로드</p>
                {referenceFaces.length > 0 && (
                    <div className="grid grid-cols-5 gap-1.5 mb-2">
                        {referenceFaces.map((face, idx) => (
                            <div key={idx} className="relative aspect-square">
                                <img src={face.preview} alt={`Face ${idx}`} className="w-full h-full object-cover rounded-lg" />
                                <button onClick={() => removeReferenceFace(idx)} className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full text-[10px] flex items-center justify-center">×</button>
                            </div>
                        ))}
                    </div>
                )}
                {referenceFaces.length < 5 && (
                    <div style={{ border: `2px dashed ${colors.borderSoft}`, borderRadius: 10 }} className="relative aspect-square p-3 text-center cursor-pointer flex flex-col items-center justify-center hover:border-gray-400 transition-colors">
                        <input type="file" accept="image/*" multiple onChange={handleReferenceFaceUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div style={{ color: colors.textMuted, fontSize: 18 }} className="mb-1">+</div>
                        <span style={{ fontSize: 11, color: colors.textMuted }}>업로드 ({referenceFaces.length}/5)</span>
                    </div>
                )}
            </div>

            {/* AI Face Studio */}
            <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }} className="mb-3 block">AI 얼굴 스튜디오</span>
                <div className="grid grid-cols-3 gap-2 mb-3">
                    <select value={gender} onChange={(e) => setGender(e.target.value as any)} style={{ background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, padding: '6px 8px', fontSize: 11, color: colors.textPrimary }}>
                        <option value="female">여성</option><option value="male">남성</option>
                    </select>
                    <select value={race} onChange={(e) => setRace(e.target.value)} style={{ background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, padding: '6px 8px', fontSize: 11, color: colors.textPrimary }}>
                        <option value="한국인">한국인</option><option value="백인">백인</option><option value="동아시아인">동아시아인</option><option value="혼혈">혼혈</option>
                    </select>
                    <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="나이" style={{ background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, padding: '6px 8px', fontSize: 11, color: colors.textPrimary }} />
                </div>
                <button onClick={handleGenerate} disabled={isGenerating} style={{ width: '100%', padding: 10, borderRadius: 8, fontSize: 12, fontWeight: 500, background: isGenerating ? colors.bgSubtle : colors.accentPrimary, color: isGenerating ? colors.textMuted : '#FFF' }}>
                    {isGenerating ? <span className="flex items-center justify-center gap-2"><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>생성 중...</span> : '얼굴 5개 생성'}
                </button>

                {generatedFaces.length > 0 && (
                    <div className="mt-4 space-y-3">
                        <span style={{ fontSize: 11, fontWeight: 500, color: colors.textMuted }}>얼굴 선택</span>
                        <div className="grid grid-cols-2 gap-2">
                            {generatedFaces.map((face: string, idx: number) => (
                                <div key={idx} onClick={() => handleSelectFace(face)} style={{ border: selectedFace === face ? `2px solid ${colors.accentPrimary}` : '2px solid transparent', borderRadius: 10 }} className="relative aspect-square cursor-pointer overflow-hidden">
                                    <img src={face} alt={`Face ${idx + 1}`} className="w-full h-full object-cover" />
                                    {selectedFace === face && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><div style={{ background: colors.accentPrimary, color: '#FFF', fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 4 }}>선택됨</div></div>}
                                    <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">#{idx + 1}</div>
                                </div>
                            ))}
                        </div>

                        {selectedFace && (
                            <div style={{ background: colors.bgSubtle, borderRadius: 10, padding: 12 }} className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <img src={selectedFace} alt="Selected" style={{ border: `2px solid ${colors.accentPrimary}` }} className="w-12 h-12 rounded object-cover" />
                                    <div className="flex-1">
                                        <div style={{ fontSize: 11, fontWeight: 600, color: colors.textPrimary }} className="mb-1">아이덴티티 고정</div>
                                        <p style={{ fontSize: 10, color: colors.textMuted }}>이 얼굴을 프리뷰의 모든 모델 이미지에 적용</p>
                                    </div>
                                </div>
                                <button onClick={handleApplyFaceToAllPreview} disabled={isReplacingAllFaces} style={{ width: '100%', padding: 10, borderRadius: 8, fontSize: 11, fontWeight: 500, background: isReplacingAllFaces ? colors.bgSubtle : colors.accentPrimary, color: isReplacingAllFaces ? colors.textMuted : '#FFF' }}>
                                    {isReplacingAllFaces ? `교체 중... ${replaceProgress.current}/${replaceProgress.total}` : '전체 적용'}
                                </button>
                            </div>
                        )}

                        {selectedFace && (
                            <div className="flex gap-2">
                                {!upscaledFace && !isUpscaling && (
                                    <button onClick={async () => { if (!selectedFace) return; setIsUpscaling(true); try { const upscaled = await upscaleFace(selectedFace); setUpscaledFace(upscaled); } catch (e) { console.error(e); alert('Upscaling failed'); } finally { setIsUpscaling(false); } }} style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 11, fontWeight: 500, background: 'transparent', border: `1px solid ${colors.borderSoft}`, color: colors.textPrimary }}>4K 업스케일</button>
                                )}
                                <button onClick={async () => { const targetUrl = upscaledFace || selectedFace; if (!targetUrl) return; const res = await fetch(targetUrl); const blob = await res.blob(); const file = new File([blob], `generated_face_${Date.now()}.png`, { type: 'image/png' }); const currentModelFiles = data.modelFiles || []; const newFileUrl = URL.createObjectURL(file); onUpdate({ ...data, modelFiles: [...currentModelFiles, file], imageUrls: { ...data.imageUrls, modelShots: [...(data.imageUrls?.modelShots || []), newFileUrl] } }); alert('모델 목록에 추가됨'); }} style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 11, fontWeight: 500, background: colors.accentPrimary, color: '#FFF' }}>목록에 추가</button>
                            </div>
                        )}

                        {upscaledFace && (
                            <div style={{ borderTop: `1px solid ${colors.borderSoft}`, paddingTop: 12 }}>
                                <span style={{ fontSize: 10, color: colors.textMuted }} className="mb-2 block">4K 업스케일 비교</span>
                                <div ref={sliderRef} className="relative w-full aspect-square rounded-lg overflow-hidden cursor-col-resize" onMouseMove={handleSliderMove} onTouchMove={handleSliderMove}>
                                    <img src={selectedFace} className="absolute inset-0 w-full h-full object-cover" alt="Original" />
                                    <div className="absolute inset-0 w-full h-full overflow-hidden border-r-2 border-white/80" style={{ width: `${compareSlider}%` }}>
                                        <img src={upscaledFace} className="absolute top-0 left-0 max-w-none h-full object-cover" style={{ width: sliderRef.current?.offsetWidth }} alt="Upscaled" />
                                    </div>
                                    <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10" style={{ left: `${compareSlider}%` }}>
                                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow"><span className="text-[10px] text-gray-700">↔</span></div>
                                    </div>
                                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">4K</div>
                                    <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">원본</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
