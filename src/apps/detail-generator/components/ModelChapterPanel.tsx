import React, { useState, useRef } from 'react';
import { generateFaceBatch, upscaleFace, batchFaceReplacement } from '../services/geminiService';

interface ModelChapterPanelProps {
    data: any;
    onUpdate: (newData: any) => void;
    lang?: 'ko' | 'en';
}

export default function ModelChapterPanel({ data, onUpdate }: ModelChapterPanelProps) {
    const [referenceFaces, setReferenceFaces] = useState<Array<{ file: File; preview: string }>>([]);
    const [gender, setGender] = useState<'male' | 'female'>('female');
    const [race, setRace] = useState('한국인');
    const [age, setAge] = useState('23');
    const [isGenerating, setIsGenerating] = useState(false);
    // Use parent data for generated faces to persist across tab switches
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
            const newFaces = newFiles.map(file => {
                const reader = new FileReader();
                return new Promise<{ file: File; preview: string }>((resolve) => {
                    reader.onload = (e) => { resolve({ file, preview: e.target?.result as string }); };
                    reader.readAsDataURL(file);
                });
            });
            Promise.all(newFaces).then(faces => { setReferenceFaces(prev => [...prev, ...faces]); });
        }
    };

    const removeReferenceFace = (index: number) => { setReferenceFaces(prev => prev.filter((_, i) => i !== index)); };

    const handleGenerate = async () => {
        setIsGenerating(true); setUpscaledFace(null);
        try {
            const faces = await generateFaceBatch(gender, race, age, referenceFaces.map(f => f.preview));
            // Append new faces to existing list (stack below)
            setGeneratedFaces([...generatedFaces, ...faces]);
        } catch (e) { console.error('Error:', e); alert('Face generation failed'); }
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
        if (!selectedFace) { alert('Select a face first.'); return; }
        const allImageUrls: string[] = [];
        const imageUrls = data.imageUrls || {};
        if (imageUrls.modelShots && Array.isArray(imageUrls.modelShots)) {
            allImageUrls.push(...imageUrls.modelShots.filter((url: string) => url && url.startsWith('data:')));
        }
        Object.entries(imageUrls).forEach(([key, value]) => {
            if (key.startsWith('model') && typeof value === 'string' && value.startsWith('data:')) {
                if (!allImageUrls.includes(value)) { allImageUrls.push(value); }
            }
        });
        if (allImageUrls.length === 0) { alert('No model images in preview.'); return; }
        setIsReplacingAllFaces(true); setReplaceProgress({ current: 0, total: allImageUrls.length });
        try {
            const results = await batchFaceReplacement(allImageUrls, selectedFace, (current, total) => setReplaceProgress({ current, total }));
            const newImageUrls = { ...imageUrls }; let successCount = 0;
            results.forEach((result) => {
                if (result.result) {
                    if (newImageUrls.modelShots && Array.isArray(newImageUrls.modelShots)) {
                        const idx = newImageUrls.modelShots.indexOf(result.original);
                        if (idx !== -1) { newImageUrls.modelShots[idx] = result.result; successCount++; }
                    }
                    Object.entries(newImageUrls).forEach(([key, value]) => {
                        if (value === result.original) { newImageUrls[key] = result.result; successCount++; }
                    });
                }
            });
            if (successCount > 0) { onUpdate({ ...data, imageUrls: newImageUrls }); alert(`${successCount} face(s) replaced.`); }
            else { alert('Face replacement failed.'); }
        } catch (error) { console.error('Error:', error); alert('Face replacement error.'); }
        finally { setIsReplacingAllFaces(false); setReplaceProgress({ current: 0, total: 0 }); }
    };

    return (
        <div className="space-y-3" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
            {/* Reference Face Upload */}
            <div className="bg-[#252525] rounded-lg p-3">
                <span className="text-[12px] font-medium text-[#999] mb-2 block">참고 얼굴</span>
                <p className="text-[11px] text-[#666] mb-2">AI 합성용 참고 얼굴 최대 5장 업로드</p>
                {referenceFaces.length > 0 && (
                    <div className="grid grid-cols-5 gap-1.5 mb-2">
                        {referenceFaces.map((face, idx) => (
                            <div key={idx} className="relative aspect-square">
                                <img src={face.preview} alt={`Face ${idx}`} className="w-full h-full object-cover rounded" />
                                <button onClick={() => removeReferenceFace(idx)} className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full text-[10px] flex items-center justify-center">×</button>
                            </div>
                        ))}
                    </div>
                )}
                {referenceFaces.length < 5 && (
                    <div className="relative aspect-square border border-dashed border-[#3c3c3c] rounded-lg p-3 hover:border-[#555] transition-colors text-center cursor-pointer flex flex-col items-center justify-center">
                        <input type="file" accept="image/*" multiple onChange={handleReferenceFaceUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="text-[#666] text-lg mb-1">+</div>
                        <span className="text-[11px] text-[#666]">업로드 ({referenceFaces.length}/5)</span>
                    </div>
                )}
            </div>

            {/* AI Face Studio */}
            <div className="bg-[#252525] rounded-lg p-3">
                <span className="text-[12px] font-medium text-[#999] mb-3 block">AI 얼굴 스튜디오</span>
                <div className="grid grid-cols-3 gap-2 mb-3">
                    <select value={gender} onChange={(e) => setGender(e.target.value as any)} className="bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1.5 text-[11px] text-white focus:border-white focus:outline-none">
                        <option value="female">여성</option>
                        <option value="male">남성</option>
                    </select>
                    <select value={race} onChange={(e) => setRace(e.target.value)} className="bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1.5 text-[11px] text-white focus:border-white focus:outline-none">
                        <option value="한국인">한국인</option>
                        <option value="백인">백인</option>
                        <option value="동아시아인">동아시아인</option>
                        <option value="혼혈">혼혈</option>
                    </select>
                    <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="나이" className="bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1.5 text-[11px] text-white focus:border-white focus:outline-none" />
                </div>
                <button onClick={handleGenerate} disabled={isGenerating} className={`w-full py-2 rounded text-[11px] font-medium transition-colors ${isGenerating ? 'bg-[#3c3c3c] text-[#666]' : 'bg-white text-black hover:bg-[#e5e5e5]'}`}>
                    {isGenerating ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                            생성 중...
                        </span>
                    ) : '얼굴 5개 생성'}
                </button>

                {/* Generated Faces Grid */}
                {generatedFaces.length > 0 && (
                    <div className="mt-4 space-y-3">
                        <span className="text-[11px] font-medium text-[#666]">얼굴 선택</span>
                        <div className="grid grid-cols-2 gap-2">
                            {generatedFaces.map((face: string, idx: number) => (
                                <div key={idx} onClick={() => handleSelectFace(face)} className={`relative aspect-square cursor-pointer rounded overflow-hidden ring-2 ${selectedFace === face ? 'ring-white' : 'ring-transparent hover:ring-[#555]'}`}>
                                    <img src={face} alt={`Face ${idx + 1}`} className="w-full h-full object-cover" />
                                    {selectedFace === face && (
                                        <div className="absolute inset-0 bg-[#888]/20 flex items-center justify-center">
                                            <div className="bg-white text-black text-[11px] font-bold px-2 py-1 rounded">선택됨</div>
                                        </div>
                                    )}
                                    <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">#{idx + 1}</div>
                                </div>
                            ))}
                        </div>

                        {/* Selected Face Actions */}
                        {selectedFace && (
                            <div className="bg-[#2c2c2c] rounded p-3 space-y-2">
                                <div className="flex items-center gap-3">
                                    <img src={selectedFace} alt="Selected" className="w-12 h-12 rounded object-cover ring-2 ring-white" />
                                    <div className="flex-1">
                                        <div className="text-[11px] font-medium text-white mb-1">아이덴티티 고정</div>
                                        <p className="text-[10px] text-[#666]">이 얼굴을 프리뷰의 모든 모델 이미지에 적용</p>
                                    </div>
                                </div>
                                <button onClick={handleApplyFaceToAllPreview} disabled={isReplacingAllFaces} className={`w-full py-2 rounded text-[11px] font-medium transition-colors ${isReplacingAllFaces ? 'bg-[#3c3c3c] text-[#666]' : 'bg-white text-black hover:bg-[#e5e5e5]'}`}>
                                    {isReplacingAllFaces ? `교체 중... ${replaceProgress.current}/${replaceProgress.total}` : '전체 적용'}
                                </button>
                            </div>
                        )}

                        {/* Upscale Option */}
                        {selectedFace && (
                            <div className="flex gap-2">
                                {!upscaledFace && !isUpscaling && (
                                    <button onClick={async () => {
                                        if (!selectedFace) return; setIsUpscaling(true);
                                        try { const upscaled = await upscaleFace(selectedFace); setUpscaledFace(upscaled); }
                                        catch (e) { console.error(e); alert('Upscaling failed'); }
                                        finally { setIsUpscaling(false); }
                                    }} className="flex-1 bg-[#2c2c2c] text-white py-2 rounded text-[11px] font-medium hover:bg-[#3c3c3c] border border-[#3c3c3c]">
                                        4K 업스케일
                                    </button>
                                )}
                                <button onClick={async () => {
                                    const targetUrl = upscaledFace || selectedFace; if (!targetUrl) return;
                                    const res = await fetch(targetUrl); const blob = await res.blob();
                                    const file = new File([blob], `generated_face_${Date.now()}.png`, { type: 'image/png' });
                                    const currentModelFiles = data.modelFiles || [];
                                    const newFileUrl = URL.createObjectURL(file);
                                    onUpdate({ ...data, modelFiles: [...currentModelFiles, file], imageUrls: { ...data.imageUrls, modelShots: [...(data.imageUrls?.modelShots || []), newFileUrl] } });
                                    alert('모델 목록에 추가됨');
                                }} className="flex-1 bg-white text-black py-2 rounded text-[11px] font-medium hover:bg-[#e5e5e5]">
                                    목록에 추가
                                </button>
                            </div>
                        )}

                        {/* Upscale Compare */}
                        {upscaledFace && (
                            <div className="pt-3 border-t border-[#3c3c3c]">
                                <span className="text-[10px] text-[#666] mb-2 block">4K 업스케일 비교</span>
                                <div ref={sliderRef} className="relative w-full aspect-square rounded overflow-hidden cursor-col-resize" onMouseMove={handleSliderMove} onTouchMove={handleSliderMove}>
                                    <img src={selectedFace} className="absolute inset-0 w-full h-full object-cover" alt="Original" />
                                    <div className="absolute inset-0 w-full h-full overflow-hidden border-r-2 border-white/80" style={{ width: `${compareSlider}%` }}>
                                        <img src={upscaledFace} className="absolute top-0 left-0 max-w-none h-full object-cover" style={{ width: sliderRef.current?.offsetWidth }} alt="Upscaled" />
                                    </div>
                                    <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10" style={{ left: `${compareSlider}%` }}>
                                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow">
                                            <span className="text-[10px] text-[#333]">↔</span>
                                        </div>
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
