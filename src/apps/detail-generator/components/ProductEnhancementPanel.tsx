import React, { useState, useEffect } from 'react';
import { ProductEffect, ProductEnhancementResult, applyProductEffect, beautifyPoses } from '../services/productEnhancement';

const colors = { bgBase: '#F5F5F7', bgSurface: '#FFFFFF', bgSubtle: '#F0F0F4', borderSoft: '#E2E2E8', textPrimary: '#111111', textSecondary: '#6E6E73', textMuted: '#A1A1AA', accentPrimary: '#111111' };

interface ProductEnhancementPanelProps {
    productFiles: File[];
    onResultsUpdate: (results: ProductEnhancementResult[]) => void;
    onAddSectionWithImage?: (imageUrl: string, sectionName?: string) => void;
    lang?: 'ko' | 'en';
}

const effects: { id: ProductEffect; name: string; fixed?: number }[] = [
    { id: 'beautify', name: '미화', fixed: 6 },
    { id: 'studio_minimal_prop', name: '미니멀 소품' },
    { id: 'studio_natural_floor', name: '자연광' },
    { id: 'studio_texture_emphasis', name: '텍스쳐' },
    { id: 'studio_cinematic', name: '시네마틱' },
];

export default function ProductEnhancementPanel({ productFiles, onResultsUpdate, onAddSectionWithImage }: ProductEnhancementPanelProps) {
    const [selectedEffect, setSelectedEffect] = useState<ProductEffect>('beautify');
    const [results, setResults] = useState<ProductEnhancementResult[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (onAddSectionWithImage) {
            results.forEach(result => {
                if (result.status === 'done' && result.url && !result.addedToPreview) {
                    onAddSectionWithImage(result.url, result.poseInfo?.name || result.effect);
                    setResults(prev => prev.map(r => r.id === result.id ? { ...r, addedToPreview: true } : r));
                }
            });
        }
    }, [results, onAddSectionWithImage]);

    const handleGenerate = async () => {
        if (productFiles.length === 0) return;
        setIsProcessing(true);
        const newResults: ProductEnhancementResult[] = [];

        if (selectedEffect === 'beautify') {
            if (onAddSectionWithImage) {
                for (let i = 0; i < productFiles.length; i++) {
                    const file = productFiles[i];
                    const reader = new FileReader();
                    await new Promise<void>((resolve) => {
                        reader.onload = (ev) => { const result = ev.target?.result as string; onAddSectionWithImage(result, `원본 ${i + 1}`); resolve(); };
                        reader.readAsDataURL(file);
                    });
                }
            }
            const primaryFile = productFiles[0];
            beautifyPoses.forEach(pose => {
                newResults.push({ id: `${primaryFile.name}-${pose.id}-${Date.now()}-${Math.random()}`, originalFileName: primaryFile.name, status: 'loading', effect: 'beautify', poseInfo: pose, processingStep: '대기 중' });
            });
        } else {
            productFiles.forEach((file, idx) => {
                newResults.push({ id: `${file.name}-${selectedEffect}-${Date.now()}-${idx}`, originalFileName: file.name, status: 'loading', effect: selectedEffect, processingStep: '대기 중' });
            });
        }

        setResults(newResults); onResultsUpdate(newResults);

        for (const result of newResults) {
            try {
                const onProgress = (msg: string) => setResults(prev => prev.map(r => r.id === result.id ? { ...r, processingStep: msg } : r));
                const filesToProcess = result.effect === 'beautify' ? productFiles : [productFiles.find(f => f.name === result.originalFileName)!];
                const url = await applyProductEffect(filesToProcess, result.effect, onProgress, result.poseInfo?.id);
                const updatedResult = { ...result, status: 'done' as const, url, processingStep: '완료' };
                setResults(prev => { const nr = prev.map(r => r.id === result.id ? updatedResult : r); onResultsUpdate(nr); return nr; });
            } catch (error: any) {
                setResults(prev => { const nr = prev.map(r => r.id === result.id ? { ...r, status: 'error' as const, error: error.message, processingStep: '실패' } : r); onResultsUpdate(nr); return nr; });
            }
        }
        setIsProcessing(false);
    };

    const getGenerationCount = () => selectedEffect === 'beautify' ? 6 : productFiles.length;

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
                            <span style={{ fontSize: 11, color: selectedEffect === effect.id ? 'rgba(255,255,255,0.7)' : colors.textMuted }}>{effect.fixed ? `${effect.fixed}개 고정` : `${productFiles.length}`}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Generate Button */}
            <button onClick={handleGenerate} disabled={isProcessing || productFiles.length === 0}
                style={{ width: '100%', padding: 12, borderRadius: 8, fontSize: 11, fontWeight: 500, background: (isProcessing || productFiles.length === 0) ? colors.bgSubtle : colors.accentPrimary, color: (isProcessing || productFiles.length === 0) ? colors.textMuted : '#FFF', cursor: (isProcessing || productFiles.length === 0) ? 'not-allowed' : 'pointer' }}>
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
