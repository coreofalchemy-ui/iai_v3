import React, { useState, useEffect } from 'react';
import { ProductEffect, ProductEnhancementResult, applyProductEffect, beautifyPoses } from '../services/productEnhancement';

interface ProductEnhancementPanelProps {
    productFiles: File[];
    onResultsUpdate: (results: ProductEnhancementResult[]) => void;
    onAddSectionWithImage?: (imageUrl: string, sectionName?: string) => void;
}

const effects: { id: ProductEffect; name: string; fixed?: number }[] = [
    { id: 'beautify', name: '미화', fixed: 6 },
    { id: 'studio_minimal_prop', name: '미니멀 소품' },
    { id: 'studio_natural_floor', name: '자연광' },
    { id: 'studio_texture_emphasis', name: '텍스쳐' },
    { id: 'studio_cinematic', name: '시네마틱' },
];

export default function ProductEnhancementPanel({
    productFiles,
    onResultsUpdate,
    onAddSectionWithImage
}: ProductEnhancementPanelProps) {
    const [selectedEffect, setSelectedEffect] = useState<ProductEffect>('beautify');
    const [results, setResults] = useState<ProductEnhancementResult[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (onAddSectionWithImage) {
            results.forEach(result => {
                if (result.status === 'done' && result.url && !result.addedToPreview) {
                    onAddSectionWithImage(result.url, result.poseInfo?.name || result.effect);
                    setResults(prev => prev.map(r =>
                        r.id === result.id ? { ...r, addedToPreview: true } : r
                    ));
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
                        reader.onload = (ev) => {
                            const result = ev.target?.result as string;
                            onAddSectionWithImage(result, `원본 ${i + 1}`);
                            resolve();
                        };
                        reader.readAsDataURL(file);
                    });
                }
            }
            const primaryFile = productFiles[0];
            beautifyPoses.forEach(pose => {
                newResults.push({
                    id: `${primaryFile.name}-${pose.id}-${Date.now()}-${Math.random()}`,
                    originalFileName: primaryFile.name,
                    status: 'loading',
                    effect: 'beautify',
                    poseInfo: pose,
                    processingStep: '대기 중'
                });
            });
        } else {
            productFiles.forEach((file, idx) => {
                newResults.push({
                    id: `${file.name}-${selectedEffect}-${Date.now()}-${idx}`,
                    originalFileName: file.name,
                    status: 'loading',
                    effect: selectedEffect,
                    processingStep: '대기 중'
                });
            });
        }

        setResults(newResults);
        onResultsUpdate(newResults);

        for (const result of newResults) {
            try {
                const onProgress = (msg: string) => {
                    setResults(prev => prev.map(r =>
                        r.id === result.id ? { ...r, processingStep: msg } : r
                    ));
                };
                const filesToProcess = result.effect === 'beautify' ? productFiles : [productFiles.find(f => f.name === result.originalFileName)!];
                const url = await applyProductEffect(filesToProcess, result.effect, onProgress, result.poseInfo?.id);
                const updatedResult = { ...result, status: 'done' as const, url, processingStep: '완료' };
                setResults(prev => {
                    const newResults = prev.map(r => r.id === result.id ? updatedResult : r);
                    onResultsUpdate(newResults);
                    return newResults;
                });
            } catch (error: any) {
                setResults(prev => {
                    const newResults = prev.map(r =>
                        r.id === result.id ? { ...r, status: 'error' as const, error: error.message, processingStep: '실패' } : r
                    );
                    onResultsUpdate(newResults);
                    return newResults;
                });
            }
        }
        setIsProcessing(false);
    };

    const getGenerationCount = () => {
        if (selectedEffect === 'beautify') return 6;
        return productFiles.length;
    };

    return (
        <div className="space-y-3" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
            {/* Effect Selection */}
            <div className="bg-[#252525] rounded-lg p-3">
                <span className="text-[11px] font-medium text-[#999] mb-2 block">효과</span>
                <div className="space-y-1">
                    {effects.map(effect => (
                        <button
                            key={effect.id}
                            onClick={() => setSelectedEffect(effect.id)}
                            className={`w-full text-left px-3 py-2 rounded text-[11px] font-medium transition-colors flex items-center justify-between ${selectedEffect === effect.id
                                ? 'bg-[#0d99ff] text-white'
                                : 'bg-[#2c2c2c] text-[#999] hover:bg-[#3c3c3c] hover:text-white'
                                }`}
                        >
                            <span>{effect.name}</span>
                            <span className={`text-[10px] ${selectedEffect === effect.id ? 'text-white/70' : 'text-[#666]'}`}>
                                {effect.fixed ? `${effect.fixed}개 고정` : `${productFiles.length}`}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Generate Button */}
            <button
                onClick={handleGenerate}
                disabled={isProcessing || productFiles.length === 0}
                className={`w-full py-2.5 rounded text-[11px] font-medium transition-colors ${isProcessing || productFiles.length === 0
                    ? 'bg-[#3c3c3c] text-[#666] cursor-not-allowed'
                    : 'bg-[#0d99ff] text-white hover:bg-[#0b87e0]'
                    }`}
            >
                {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        처리 중...
                    </span>
                ) : `이미지 ${getGenerationCount()}개 생성`}
            </button>

            {/* Results */}
            {results.length > 0 && (
                <div className="bg-[#252525] rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] font-medium text-[#999]">결과</span>
                        <span className="text-[10px] text-[#666]">
                            {results.filter(r => r.status === 'done').length}/{results.length}
                        </span>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {results.map(result => (
                            <div key={result.id} className="bg-[#2c2c2c] rounded p-2">
                                {result.poseInfo && (
                                    <div className="text-[10px] text-[#666] mb-1.5">{result.poseInfo.name}</div>
                                )}
                                {result.status === 'loading' && (
                                    <div className="flex items-center gap-2">
                                        <svg className="w-3 h-3 animate-spin text-[#0d99ff]" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <span className="text-[10px] text-[#0d99ff]">{result.processingStep}</span>
                                    </div>
                                )}
                                {result.status === 'done' && result.url && (
                                    <div className="relative">
                                        <img src={result.url} className="w-full rounded" alt="Result" />
                                        <div className="absolute top-1 right-1 bg-[#18a34a] text-white text-[9px] px-1.5 py-0.5 rounded">
                                            추가됨
                                        </div>
                                    </div>
                                )}
                                {result.status === 'error' && (
                                    <div className="text-[10px] text-red-400">{result.error}</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
