import React, { useState, useRef } from 'react';
import { generateFaceBatch, upscaleFace, generateBaseModelFromFace, generateAutoModel } from '../services/geminiService';
import { FILTER_PRESETS, FilterPresetName } from '../services/photoFilterService';

const colors = { bgBase: '#F5F5F7', bgSurface: '#FFFFFF', bgSubtle: '#F0F0F4', borderSoft: '#E2E2E8', textPrimary: '#111111', textSecondary: '#6E6E73', textMuted: '#A1A1AA', accentPrimary: '#111111' };

interface ModelChapterPanelProps {
    data: any;
    onUpdate: (newData: any) => void;
    lang?: 'ko' | 'en';
    heldSections?: Set<string>;
    activeFilter?: FilterPresetName;
    onFilterChange?: (filter: FilterPresetName) => void;
    sectionHeights?: { [key: string]: number };
    onUpdateSectionHeight?: (key: string, height: number) => void;
}

export default function ModelChapterPanel({
    data,
    onUpdate,
    lang = 'ko',
    heldSections,
    activeFilter = 'original',
    onFilterChange,
    sectionHeights,
    onUpdateSectionHeight
}: ModelChapterPanelProps) {
    const [referenceFaces, setReferenceFaces] = useState<Array<{ file: File; preview: string }>>([]);
    const [gender, setGender] = useState<'male' | 'female'>('female');
    const [race, setRace] = useState('한국인');
    const [age, setAge] = useState('23');
    const [generateCount, setGenerateCount] = useState(5);
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
    const [autoModelMode, setAutoModelMode] = useState(false); // 자동 모델 생성 모드

    const handleFilterClick = (filterName: FilterPresetName) => {
        if (onFilterChange) onFilterChange(filterName);
    };

    const handleReferenceFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).slice(0, 5 - referenceFaces.length);
            const newFaces = newFiles.map(file => new Promise<{ file: File; preview: string }>((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve({ file, preview: ev.target?.result as string });
                reader.readAsDataURL(file);
            }));
            Promise.all(newFaces).then(faces => setReferenceFaces(prev => [...prev, ...faces]));
        }
    };

    const removeReferenceFace = (index: number) => setReferenceFaces(prev => prev.filter((_, i) => i !== index));


    const handleGenerate = async () => {
        if (!heldSections || heldSections.size === 0) {
            alert('모델을 먼저 홀드(Lock)해주세요. 홀드된 모델을 기반으로 얼굴 변형이 생성됩니다.');
            return;
        }

        // Get the first held image
        const sectionId = Array.from(heldSections)[0];
        const heldImageUrl = data.imageUrls[sectionId];

        if (!heldImageUrl) {
            alert('홀드된 모델 이미지를 찾을 수 없습니다.');
            return;
        }

        setIsGenerating(true);
        setUpscaledFace(null);
        try {
            // Pass the held image and reference faces to the service
            const refFaceUrls = referenceFaces.map(f => f.preview);
            const faces = await generateFaceBatch(gender, race, age, heldImageUrl, generateCount, refFaceUrls);
            // Use functional update to ensure we have the latest data
            const currentFaces = data.generatedFaces || [];
            onUpdate({
                ...data,
                generatedFaces: [...currentFaces, ...faces]
            });
        } catch (e) {
            console.error('Error:', e);
            alert('Face generation failed');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSelectFace = async (faceUrl: string) => {
        setSelectedFace(faceUrl);
        setUpscaledFace(null);
    };

    const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!sliderRef.current) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        setCompareSlider((x / rect.width) * 100);
    };

    const handleApplyFaceToPreview = async () => {
        if (!selectedFace) return alert('Select a face first.');

        if (!heldSections || heldSections.size === 0) {
            alert('이미지를 홀드(Hold)해주세요. 홀드된 이미지를 레퍼런스로 모델이 재생성됩니다.');
            return;
        }

        const targetImageUrls: string[] = [];
        const imageUrls = data.imageUrls || {};
        const sectionIdList: string[] = [];

        heldSections.forEach(sectionId => {
            const url = imageUrls[sectionId];
            if (url && typeof url === 'string' && (url.startsWith('data:') || url.startsWith('http'))) {
                targetImageUrls.push(url);
                sectionIdList.push(sectionId);
            }
        });

        if (targetImageUrls.length === 0) {
            alert('홀드된 섹션에서 유효한 이미지를 찾을 수 없습니다.');
            return;
        }

        setIsReplacingAllFaces(true);
        setReplaceProgress({ current: 0, total: targetImageUrls.length });

        try {
            // ★ 각 홀드된 이미지를 레퍼런스로 사용하여 모델 생성
            const results: Array<{ original: string; result: string | null; sectionId: string }> = [];

            for (let i = 0; i < targetImageUrls.length; i++) {
                const referenceUrl = targetImageUrls[i];
                setReplaceProgress({ current: i + 1, total: targetImageUrls.length });

                try {
                    // 선택된 얼굴 + 레퍼런스 이미지(착장/비율/배경)로 모델 생성

                    const strengthValue = compareSlider === 1 ? 'creative' : 'safe';
                    const finalImage = await generateBaseModelFromFace(
                        selectedFace,
                        referenceUrl,
                        gender === 'male' ? 'm' : 'w',
                        strengthValue
                    );
                    results.push({ original: referenceUrl, result: finalImage, sectionId: sectionIdList[i] });
                } catch (e) {
                    console.error(`❌ 모델 생성 실패 (${i + 1}):`, e);
                    results.push({ original: referenceUrl, result: null, sectionId: sectionIdList[i] });
                }
            }

            const newImageUrls = { ...imageUrls };
            const addedSectionsMap = new Map<string, string[]>();

            let successCount = 0;

            results.forEach((result) => {
                if (result.result) {
                    const originalSid = result.sectionId;
                    const newSid = `face-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    newImageUrls[newSid] = result.result;

                    // Inherit height from original section
                    if (sectionHeights && onUpdateSectionHeight && sectionHeights[originalSid]) {
                        onUpdateSectionHeight(newSid, sectionHeights[originalSid]);
                    }

                    const list = addedSectionsMap.get(originalSid) || [];
                    list.push(newSid);
                    addedSectionsMap.set(originalSid, list);

                    successCount++;
                }
            });

            const currentOrder = data.sectionOrder || [];
            const finalOrder: string[] = [];

            currentOrder.forEach((sid: string) => {
                finalOrder.push(sid);
                if (addedSectionsMap.has(sid)) {
                    finalOrder.push(...addedSectionsMap.get(sid)!);
                }
            });

            if (successCount > 0) {
                onUpdate({ ...data, imageUrls: newImageUrls, sectionOrder: finalOrder });
                alert(`${successCount}개의 이미지에서 모델이 재생성되었습니다! (바로 아래에 추가됨)`);
            } else {
                alert('얼굴 합성에 실패했습니다.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Face replacement error.');
        } finally {
            setIsReplacingAllFaces(false);
            setReplaceProgress({ current: 0, total: 0 });
        }
    };

    // 자동 모델 생성 (얼굴 없이)
    const handleAutoModelGenerate = async () => {
        if (!heldSections || heldSections.size === 0) {
            alert('이미지를 홀드(Hold)해주세요. 홀드된 이미지의 옷/신발을 참고하여 새 모델이 생성됩니다.');
            return;
        }

        const targetImageUrls: string[] = [];
        const imageUrls = data.imageUrls || {};
        const sectionIdList: string[] = [];

        heldSections.forEach(sectionId => {
            const url = imageUrls[sectionId];
            if (url && typeof url === 'string' && (url.startsWith('data:') || url.startsWith('http'))) {
                targetImageUrls.push(url);
                sectionIdList.push(sectionId);
            }
        });

        if (targetImageUrls.length === 0) {
            alert('홀드된 섹션에서 유효한 이미지를 찾을 수 없습니다.');
            return;
        }

        setIsReplacingAllFaces(true);
        setReplaceProgress({ current: 0, total: targetImageUrls.length });

        try {
            const results: Array<{ result: string | null; sectionId: string }> = [];

            for (let i = 0; i < targetImageUrls.length; i++) {
                const referenceUrl = targetImageUrls[i];
                setReplaceProgress({ current: i + 1, total: targetImageUrls.length });

                try {
                    const finalImage = await generateAutoModel(
                        referenceUrl,
                        gender === 'male' ? 'm' : 'w'
                    );
                    results.push({ result: finalImage, sectionId: sectionIdList[i] });
                } catch (e) {
                    console.error(`❌ 자동 모델 생성 실패 (${i + 1}):`, e);
                    results.push({ result: null, sectionId: sectionIdList[i] });
                }
            }

            const newImageUrls = { ...imageUrls };
            const addedSectionsMap = new Map<string, string[]>();
            let successCount = 0;

            results.forEach((result) => {
                if (result.result) {
                    const originalSid = result.sectionId;
                    const newSid = `auto-model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    newImageUrls[newSid] = result.result;

                    if (sectionHeights && onUpdateSectionHeight && sectionHeights[originalSid]) {
                        onUpdateSectionHeight(newSid, sectionHeights[originalSid]);
                    }

                    const list = addedSectionsMap.get(originalSid) || [];
                    list.push(newSid);
                    addedSectionsMap.set(originalSid, list);
                    successCount++;
                }
            });

            const currentOrder = data.sectionOrder || [];
            const finalOrder: string[] = [];

            currentOrder.forEach((sid: string) => {
                finalOrder.push(sid);
                if (addedSectionsMap.has(sid)) {
                    finalOrder.push(...addedSectionsMap.get(sid)!);
                }
            });

            if (successCount > 0) {
                onUpdate({ ...data, imageUrls: newImageUrls, sectionOrder: finalOrder });
                alert(`${successCount}개의 새로운 모델이 생성되었습니다!`);
            } else {
                alert('모델 생성에 실패했습니다.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('모델 생성 오류.');
        } finally {
            setIsReplacingAllFaces(false);
            setReplaceProgress({ current: 0, total: 0 });
        }
    };

    return (
        <div className="space-y-3" style={{ fontFamily: '-apple-system, sans-serif' }}>
            {/* 확대 보기 모달 제거 */}
            {/* Photo Filter Presets */}
            <div className="p-4 bg-white rounded-xl border border-[#E2E2E8]">
                <h3 className="text-sm font-bold text-[#111] mb-3 flex items-center justify-between">
                    <span>✨ Photo Filters</span>
                    <span className="text-[10px] text-gray-400 font-normal">Model & Detail Only</span>
                </h3>
                <div className="grid grid-cols-3 gap-2">
                    {Object.values(FILTER_PRESETS).map((preset) => (
                        <button
                            key={preset.name}
                            onClick={() => handleFilterClick(preset.name as FilterPresetName)}
                            className={`
                                relative px-2 py-2 text-[11px] font-medium rounded-lg transition-all border flex flex-col items-center justify-center gap-1
                                ${activeFilter === preset.name
                                    ? 'bg-black text-white border-black shadow-md scale-[1.02]'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                                }
                            `}
                        >
                            <span>{preset.label.split(' ')[0]}</span>
                            {activeFilter === preset.name && (
                                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.5)]"></span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Reference Face Upload */}
            <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }} className="mb-2 block">참고 얼굴</span>
                <div
                    style={{ minHeight: 100, border: `2px dashed ${colors.borderSoft}`, borderRadius: 10 }}
                    className="p-3 text-center cursor-pointer flex flex-col items-center justify-center hover:border-gray-400 transition-colors relative"
                >
                    <input type="file" accept="image/*" multiple onChange={handleReferenceFaceUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />

                    {referenceFaces.length > 0 ? (
                        <div className="grid grid-cols-5 gap-1.5 w-full">
                            {referenceFaces.map((face, idx) => (
                                <div key={idx} className="relative aspect-square">
                                    <img src={face.preview} alt={`Face ${idx}`} className="w-full h-full object-cover rounded-lg" />
                                    <button onClick={(e) => { e.stopPropagation(); removeReferenceFace(idx); }} className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full text-[10px] flex items-center justify-center">×</button>
                                </div>
                            ))}
                            {referenceFaces.length < 5 && (
                                <div className="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-lg aspect-square">
                                    <div style={{ color: colors.textMuted, fontSize: 18 }}>+</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div style={{ color: colors.textMuted, fontSize: 18 }} className="mb-1">+</div>
                            <span style={{ fontSize: 11, color: colors.textMuted }}>AI 합성용 참고 얼굴 업로드 (최대 5장)</span>
                        </>
                    )}
                </div>
            </div>

            {/* AI Face Studio */}
            <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }} className="mb-3 block">AI 얼굴 스튜디오</span>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <select value={gender} onChange={(e) => setGender(e.target.value as any)} style={{ background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, padding: '6px 8px', fontSize: 11, color: colors.textPrimary }}>
                        <option value="female">여성</option><option value="male">남성</option>
                    </select>
                    <select value={race} onChange={(e) => setRace(e.target.value)} style={{ background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, padding: '6px 8px', fontSize: 11, color: colors.textPrimary }}>
                        <option value="한국인">한국인</option><option value="백인">백인</option><option value="동아시아인">동아시아인</option><option value="혼혈">혼혈</option>
                    </select>
                </div>
                <div className="space-y-3 mb-3">
                    <div style={{ background: colors.bgSubtle, borderRadius: 8, padding: 8, border: `1px solid ${colors.borderSoft}` }}>
                        <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>나이 (Age)</div>
                        <div className="grid grid-cols-6 gap-1">
                            {['21', '25', '30', '35', '40', '45'].map(val => (
                                <button key={val} onClick={() => setAge(val)} style={{ padding: '6px 0', fontSize: 11, borderRadius: 4, background: age === val ? colors.accentPrimary : colors.bgSurface, color: age === val ? '#FFF' : colors.textPrimary, border: `1px solid ${age === val ? colors.accentPrimary : colors.borderSoft}` }}>{val}</button>
                            ))}
                        </div>
                    </div>
                    <div style={{ background: colors.bgSubtle, borderRadius: 8, padding: 8, border: `1px solid ${colors.borderSoft}` }}>
                        <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>장수 (Count)</div>
                        <div className="grid grid-cols-6 gap-1">
                            {[1, 2, 3, 4, 5, 6].map(val => (
                                <button key={val} onClick={() => setGenerateCount(val)} style={{ padding: '6px 0', fontSize: 11, borderRadius: 4, background: generateCount === val ? colors.accentPrimary : colors.bgSurface, color: generateCount === val ? '#FFF' : colors.textPrimary, border: `1px solid ${generateCount === val ? colors.accentPrimary : colors.borderSoft}` }}>{val}</button>
                            ))}
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !heldSections || heldSections.size === 0}
                    style={{
                        width: '100%',
                        padding: 10,
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 500,
                        background: (isGenerating || !heldSections || heldSections.size === 0) ? colors.bgSubtle : colors.accentPrimary,
                        color: (isGenerating || !heldSections || heldSections.size === 0) ? colors.textMuted : '#FFF'
                    }}
                >
                    {isGenerating ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            생성 중...
                        </span>
                    ) : (!heldSections || heldSections.size === 0) ? (
                        '⚠️ 모델 홀드 필요'
                    ) : (
                        `모델 변형 ${generateCount}개 생성`
                    )}
                </button>

                {generatedFaces.length > 0 && (
                    <div className="mt-4 space-y-3">
                        <span style={{ fontSize: 11, fontWeight: 500, color: colors.textMuted }}>모델 변형 선택</span>
                        <div className="grid grid-cols-2 gap-2">
                            {generatedFaces.map((face: string, idx: number) => (
                                <div key={idx} onClick={() => handleSelectFace(face)} style={{ border: selectedFace === face ? `2px solid ${colors.accentPrimary}` : '2px solid transparent', borderRadius: 10 }} className="relative aspect-[3/4] cursor-pointer overflow-hidden">
                                    <img src={face} alt={`Variation ${idx + 1}`} className="w-full h-full object-cover" />
                                    {selectedFace === face && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><div style={{ background: colors.accentPrimary, color: '#FFF', fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 4 }}>선택됨</div></div>}
                                    <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">#{idx + 1}</div>
                                </div>
                            ))}
                        </div>

                        {/* Apply to Preview Button */}
                        {selectedFace && (
                            <div className="mt-3 space-y-2">
                                <button
                                    onClick={() => {
                                        // 선택된 이미지를 프리뷰에 새 섹션으로 추가
                                        const newSid = `model-variation-${Date.now()}`;
                                        const newImageUrls = { ...data.imageUrls, [newSid]: selectedFace };
                                        const newOrder = [...(data.sectionOrder || []), newSid];
                                        onUpdate({ ...data, imageUrls: newImageUrls, sectionOrder: newOrder });
                                        alert('프리뷰에 추가되었습니다!');
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: 10,
                                        borderRadius: 8,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        background: colors.accentPrimary,
                                        color: '#FFF'
                                    }}
                                >
                                    📥 프리뷰에 추가 (Add to Preview)
                                </button>
                                <button
                                    onClick={() => {
                                        const a = document.createElement('a');
                                        a.href = selectedFace;
                                        a.download = `model_variation_${Date.now()}.png`;
                                        a.click();
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: 10,
                                        borderRadius: 8,
                                        fontSize: 11,
                                        fontWeight: 500,
                                        background: 'transparent',
                                        border: `1px solid ${colors.borderSoft}`,
                                        color: colors.textPrimary,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    이미지 다운로드 (Download)
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

