import React, { useState, useEffect } from 'react';
import { ProductEffect, ProductEnhancementResult, applyProductEffect, beautifyPoses } from '../services/productEnhancement';

const colors = { bgBase: '#F5F5F7', bgSurface: '#FFFFFF', bgSubtle: '#F0F0F4', borderSoft: '#E2E2E8', textPrimary: '#111111', textSecondary: '#6E6E73', textMuted: '#A1A1AA', accentPrimary: '#111111' };

interface ProductEnhancementPanelProps {
    productFiles: File[];
    previewSections: { id: string; url: string }[];
    onResultsUpdate: (results: ProductEnhancementResult[]) => void;
    onAddSectionWithImage?: (imageUrl: string, sectionName?: string) => void;
    onUpdatePreview?: (sectionId: string, imageUrl: string) => void;
    lang?: 'ko' | 'en';
}

const effects: { id: ProductEffect; name: string; fixed?: number }[] = [
    { id: 'beautify', name: '미화', fixed: 6 },
    { id: 'studio_minimal_prop', name: '미니멀 소품' },
    { id: 'studio_natural_floor', name: '자연광' },
    { id: 'studio_texture_emphasis', name: '텍스쳐' },
    { id: 'studio_cinematic', name: '시네마틱' },
];

export const ProductEnhancementPanel: React.FC<ProductEnhancementPanelProps> = ({
    productFiles,
    previewSections,
    onResultsUpdate,
    onAddSectionWithImage,
    onUpdatePreview,
    lang = 'ko'
}) => {
    const [selectedEffect, setSelectedEffect] = useState<ProductEffect>('beautify');
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<ProductEnhancementResult[]>([]);

    const urlToFile = async (url: string, filename: string): Promise<File> => {
        const res = await fetch(url);
        const blob = await res.blob();
        return new File([blob], filename, { type: blob.type });
    };

    const handleGenerate = async () => {
        const isBeautify = selectedEffect === 'beautify';
        const sourceFiles: { file: File, sourceId?: string }[] = [];

        if (isBeautify) {
            if (productFiles.length === 0) return;
            productFiles.forEach(file => sourceFiles.push({ file }));
        } else {
            // For concepts, use preview images with section IDs
            if (previewSections && previewSections.length > 0) {
                for (let i = 0; i < previewSections.length; i++) {
                    try {
                        const section = previewSections[i];
                        const file = await urlToFile(section.url, `preview-image-${i}.png`);
                        sourceFiles.push({ file, sourceId: section.id });
                    } catch (e) {
                        console.error("Failed to convert url to file", e);
                    }
                }
            } else {
                if (sourceFiles.length === 0) {
                    alert(lang === 'ko' ? '프리뷰에 적용된 이미지가 없습니다. 먼저 이미지를 프리뷰에 배치해주세요.' : 'No images in preview.');
                    return;
                }
            }
        }

        if (sourceFiles.length === 0) return;

        setIsProcessing(true);
        const newResults: ProductEnhancementResult[] = [];

        if (isBeautify) {
            beautifyPoses.forEach(pose => {
                newResults.push({ id: `${pose.id}-${Date.now()}`, originalFileName: 'All Files', status: 'loading', effect: selectedEffect, poseInfo: pose, processingStep: '대기 중' });
            });

            setResults(prev => [...prev, ...newResults]);
            onResultsUpdate(newResults);

            try {
                const processPose = async (pose: { id: string; name: string }, resultIndex: number) => {
                    const resultId = newResults[resultIndex].id;
                    const updateStatus = (status: 'loading' | 'done' | 'error', url?: string, step?: string) => {
                        setResults(prev => prev.map(r => r.id === resultId ? { ...r, status, url, processingStep: step } : r));
                    };

                    try {
                        updateStatus('loading', undefined, '포즈 분석 및 미화 시작...');
                        const generatedUrl = await applyProductEffect(
                            sourceFiles.map(s => s.file),
                            'beautify',
                            (msg) => updateStatus('loading', undefined, msg),
                            pose.id
                        );
                        updateStatus('done', generatedUrl, '완료');

                        const finalResult: ProductEnhancementResult = {
                            id: resultId,
                            originalFileName: 'All Files',
                            status: 'done',
                            effect: 'beautify',
                            poseInfo: pose,
                            url: generatedUrl,
                            processingStep: '완료'
                        };
                        onResultsUpdate([finalResult]);

                    } catch (e: any) {
                        console.error(e);
                        updateStatus('error', undefined, e.message || 'Error');
                    }
                };

                await Promise.all(beautifyPoses.map((pose, idx) => processPose(pose, idx)));

            } catch (e) {
                console.error(e);
            } finally {
                setIsProcessing(false);
            }

        } else {
            // Concept Logic
            sourceFiles.forEach((item, idx) => {
                newResults.push({
                    id: `${item.file.name}-${selectedEffect}-${Date.now()}-${idx}`,
                    originalFileName: item.file.name,
                    status: 'loading',
                    effect: selectedEffect,
                    processingStep: '대기 중'
                });
            });

            setResults(prev => [...prev, ...newResults]);

            try {
                const processItem = async (item: { file: File, sourceId?: string }, resultIndex: number) => {
                    const resultId = newResults[resultIndex].id;
                    const updateStatus = (status: 'loading' | 'done' | 'error', url?: string, step?: string) => {
                        setResults(prev => prev.map(r => r.id === resultId ? { ...r, status, url, processingStep: step } : r));
                    };

                    try {
                        const generatedUrl = await applyProductEffect(
                            [item.file],
                            selectedEffect,
                            (msg) => updateStatus('loading', undefined, msg)
                        );
                        updateStatus('done', generatedUrl, '완료');

                        // Update Preview Immediately if sourceId exists
                        if (item.sourceId && onUpdatePreview) {
                            onUpdatePreview(item.sourceId, generatedUrl);
                        }

                        // Add to history
                        const finalResult: ProductEnhancementResult = {
                            id: resultId,
                            originalFileName: item.file.name,
                            status: 'done',
                            effect: selectedEffect,
                            url: generatedUrl,
                            processingStep: '완료',
                            addedToPreview: true // Auto applied
                        };
                        onResultsUpdate([finalResult]);

                    } catch (e: any) {
                        console.error(e);
                        updateStatus('error', undefined, e.message);
                    }
                };

                await Promise.all(sourceFiles.map((item, idx) => processItem(item, idx)));

            } catch (e) {
                console.error(e);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const getGenerationCount = () => {
        if (selectedEffect === 'beautify') return 6;
        return previewSections ? previewSections.length : 0;
    };

    return (
        <div className="space-y-3" style={{ fontFamily: '-apple-system, sans-serif' }}>
            {/* Effect Selection */}
            <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }} className="mb-2 block">효과</span>
                <div className="space-y-1">
                    {effects.map(effect => (
                        <button key={effect.id} onClick={() => setSelectedEffect(effect.id)}
                            style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500, background: selectedEffect === effect.id ? colors.accentPrimary : colors.bgSubtle, color: selectedEffect === effect.id ? '#FFF' : colors.textSecondary, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{effect.name}</span>
                            <span style={{ fontSize: 11, color: selectedEffect === effect.id ? 'rgba(255,255,255,0.7)' : colors.textMuted }}>
                                {effect.fixed ? `${effect.fixed}개 고정` : `${previewSections?.length || 0}`}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Generate Button */}
            <button onClick={handleGenerate} disabled={isProcessing || (selectedEffect === 'beautify' ? productFiles.length === 0 : (previewSections?.length || 0) === 0)}
                style={{ width: '100%', padding: 12, borderRadius: 8, fontSize: 11, fontWeight: 500, background: (isProcessing || (selectedEffect === 'beautify' ? productFiles.length === 0 : (previewSections?.length || 0) === 0)) ? colors.bgSubtle : colors.accentPrimary, color: (isProcessing || (selectedEffect === 'beautify' ? productFiles.length === 0 : (previewSections?.length || 0) === 0)) ? colors.textMuted : '#FFF', cursor: (isProcessing || (selectedEffect === 'beautify' ? productFiles.length === 0 : (previewSections?.length || 0) === 0)) ? 'not-allowed' : 'pointer' }}>
                {isProcessing ? <span className="flex items-center justify-center gap-2"><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>처리 중...</span> : `이미지 ${getGenerationCount()}개 생성`}
            </button>

            {/* Results */}
            {results.length > 0 && (
                <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                    <div className="flex justify-between items-center mb-2">
                        <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>결과</span>
                        <span style={{ fontSize: 10, color: colors.textMuted }}>{results.filter(r => r.status === 'done').length}/{results.length}</span>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {results.map(result => (
                            <div key={result.id} style={{ background: colors.bgSubtle, borderRadius: 8, padding: 8 }}>
                                {result.poseInfo && <div style={{ fontSize: 10, color: colors.textMuted }} className="mb-1.5">{result.poseInfo.name}</div>}
                                {result.status === 'loading' && (
                                    <div className="flex items-center gap-2">
                                        <svg className="w-3 h-3 animate-spin" style={{ color: colors.textMuted }} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                        <span style={{ fontSize: 10, color: colors.textMuted }}>{result.processingStep}</span>
                                    </div>
                                )}
                                {result.status === 'done' && result.url && (
                                    <div className="relative">
                                        <img src={result.url} className="w-full rounded-lg" alt="Result" />
                                        <div className="absolute top-1 right-1 bg-green-600 text-white text-[9px] px-1.5 py-0.5 rounded">추가됨</div>
                                    </div>
                                )}
                                {result.status === 'error' && <div style={{ fontSize: 10, color: '#EF4444' }}>{result.error}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProductEnhancementPanel;
