/**
 * Content Generator Panel - AI 캠페인 이미지 생성 UI
 * Figma-style dark theme
 */

import React, { useState, useRef, DragEvent } from 'react';
import { synthesizeShoeStudio } from '../services/shoeStudioService';
import { generateInitialOriginalSet } from '../services/originalGenerationService';

interface ContentGeneratorPanelProps {
    productImages?: string[];
    onImageGenerated?: (imageUrl: string) => void;
    onAddToPreview?: (imageUrl: string, sectionType: string) => void;
    lang?: 'ko' | 'en';
}

export default function ContentGeneratorPanel({
    productImages = [],
    onImageGenerated,
    onAddToPreview
}: ContentGeneratorPanelProps) {
    const [sourceImages, setSourceImages] = useState<File[]>([]);
    const [sourcePreviews, setSourcePreviews] = useState<string[]>([]);
    const [sourceDragActive, setSourceDragActive] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultImages, setResultImages] = useState<string[]>([]);
    const [error, setError] = useState<string>('');
    const [progressMessage, setProgressMessage] = useState<string>('');
    const sourceInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (files: FileList | File[]) => {
        const validFiles = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 10 - sourceImages.length);
        if (validFiles.length === 0) return;
        const newFiles = [...sourceImages, ...validFiles].slice(0, 10);
        setSourceImages(newFiles);
        setSourcePreviews(newFiles.map(f => URL.createObjectURL(f)));
    };

    const handleSourceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) handleFileSelect(e.target.files);
    };

    const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setSourceDragActive(true); };
    const handleDragLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setSourceDragActive(false); };
    const handleDrop = (e: DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setSourceDragActive(false);
        if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files);
    };

    const removeImage = (index: number) => {
        const newFiles = [...sourceImages];
        newFiles.splice(index, 1);
        setSourceImages(newFiles);
        setSourcePreviews(newFiles.map(f => URL.createObjectURL(f)));
    };

    const handleGenerateShoeSwap = async () => {
        if (sourceImages.length === 0) { setError('콘텐츠 이미지를 먼저 업로드하세요.'); return; }
        if (productImages.length === 0) { setError('제품 탭에서 제품 이미지를 먼저 업로드하세요.'); return; }
        setIsGenerating(true); setError(''); setResultImages([]);
        const results: string[] = [];
        try {
            for (let i = 0; i < sourceImages.length; i++) {
                setProgressMessage(`처리 중 ${i + 1}/${sourceImages.length}...`);

                // File -> DataURL 변환
                const file = sourceImages[i];
                const reader = new FileReader();
                const sourceDataUrl = await new Promise<string>((resolve) => {
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsDataURL(file);
                });

                // 제품 이미지는 URL이므로 그대로 사용 (첫 번째 제품 이미지 사용)
                // synthesizeShoeStudio(shoeImageUrl, modelImageUrl, effect)
                const imageUrl = await synthesizeShoeStudio(productImages[0], sourceDataUrl, 'minimal');
                results.push(imageUrl);
                onImageGenerated?.(imageUrl);
                onAddToPreview?.(imageUrl, 'campaign');
            }
            setResultImages(results);
        } catch (err: any) { console.error(err); setError(err.message || 'Error occurred'); }
        finally { setIsGenerating(false); setProgressMessage(''); }
    };

    const handleGenerateOriginalSet = async () => {
        if (sourceImages.length === 0 || productImages.length === 0) return;
        setIsGenerating(true); setError(''); setProgressMessage('준비 중...');
        try {
            const productFiles = await Promise.all(productImages.map(async (url, i) => {
                const res = await fetch(url);
                const blob = await res.blob();
                return new File([blob], `product_${i}.png`, { type: blob.type });
            }));
            const { modelShots, closeupShots } = await generateInitialOriginalSet(productFiles, sourceImages, (msg) => setProgressMessage(msg));
            const results = [...modelShots.map(s => s.url), ...closeupShots.map(s => s.url)];
            setResultImages(results);
            modelShots.forEach(shot => onAddToPreview?.(shot.url, 'campaign'));
            closeupShots.forEach(shot => onAddToPreview?.(shot.url, 'detail'));
        } catch (err: any) { console.error(err); setError(err.message || 'Error occurred'); }
        finally { setIsGenerating(false); setProgressMessage(''); }
    };

    const handleDownload = (url: string, index: number) => {
        const a = document.createElement('a');
        a.href = url; a.download = `campaign_${index + 1}_${Date.now()}.jpg`; a.click();
    };

    return (
        <div className="space-y-3" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
            {/* Content Image Upload */}
            <div className="bg-[#252525] rounded-lg p-3">
                <span className="text-[12px] font-medium text-[#999] mb-2 block">콘텐츠 이미지</span>
                <div
                    className={`min-h-[200px] border border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors flex flex-col items-center justify-center ${sourceDragActive ? 'border-[#888] bg-[#888]/10' : 'border-[#3c3c3c] hover:border-[#555]'
                        }`}
                    onClick={() => sourceInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <input ref={sourceInputRef} type="file" accept="image/*" multiple onChange={handleSourceInputChange} className="hidden" />
                    {sourcePreviews.length > 0 ? (
                        <div className="grid grid-cols-4 gap-1.5">
                            {sourcePreviews.map((preview, i) => (
                                <div key={i} className="relative aspect-square">
                                    <img src={preview} alt={`Content ${i + 1}`} className="w-full h-full object-cover rounded" />
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                                        className="absolute top-0.5 right-0.5 bg-black/60 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] hover:bg-red-500"
                                    >×</button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="text-[#666] text-xl mb-1">+</div>
                            <p className="text-[11px] font-medium text-[#999]">이미지를 드롭하거나 클릭하여 업로드</p>
                            <p className="text-[11px] text-[#666] mt-1">신발 이미지 최대 10장</p>
                        </>
                    )}
                </div>
                <div className="flex justify-center gap-0.5 mt-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < sourceImages.length ? 'bg-[#888]' : 'bg-[#3c3c3c]'}`} />
                    ))}
                </div>
            </div>

            {/* Product Images Status */}
            <div className="bg-[#252525] rounded-lg p-3">
                <span className="text-[12px] font-medium text-[#999] mb-2 block">제품 이미지</span>
                {productImages.length > 0 ? (
                    <div className="flex gap-1.5 flex-wrap">
                        {productImages.slice(0, 4).map((url, i) => (
                            <img key={i} src={url} alt={`Product ${i + 1}`} className="w-10 h-10 object-cover rounded" />
                        ))}
                        {productImages.length > 4 && (
                            <div className="w-10 h-10 bg-[#3c3c3c] rounded flex items-center justify-center text-[10px] text-[#999]">
                                +{productImages.length - 4}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-[11px] text-[#666]">제품 탭에서 제품 이미지를 먼저 업로드하세요</p>
                )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={handleGenerateShoeSwap}
                    disabled={isGenerating || sourceImages.length === 0 || productImages.length === 0}
                    className={`py-2.5 rounded text-[11px] font-medium transition-colors ${isGenerating || sourceImages.length === 0 || productImages.length === 0
                        ? 'bg-[#3c3c3c] text-[#666] cursor-not-allowed'
                        : 'bg-[#2c2c2c] text-white hover:bg-[#3c3c3c] border border-[#3c3c3c]'
                        }`}
                >
                    신발 교체
                </button>
                <button
                    onClick={handleGenerateOriginalSet}
                    disabled={isGenerating || sourceImages.length === 0 || productImages.length === 0}
                    className={`py-2.5 rounded text-[11px] font-medium transition-colors ${isGenerating || sourceImages.length === 0 || productImages.length === 0
                        ? 'bg-[#3c3c3c] text-[#666] cursor-not-allowed'
                        : 'bg-white text-black hover:bg-[#e5e5e5]'
                        }`}
                >
                    세트 생성
                </button>
            </div>

            {/* Progress */}
            {progressMessage && (
                <div className="text-[11px] text-center text-[#888] py-2 bg-[#252525] rounded">{progressMessage}</div>
            )}

            {/* Error */}
            {error && (
                <div className="text-[11px] text-red-400 py-2 bg-red-400/10 rounded px-3">{error}</div>
            )}

            {/* Results */}
            {resultImages.length > 0 && (
                <div className="bg-[#252525] rounded-lg p-3">
                    <span className="text-[12px] font-medium text-[#999] mb-2 block">결과 ({resultImages.length})</span>
                    <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto">
                        {resultImages.map((url, i) => (
                            <div key={i} className="relative">
                                <img src={url} alt={`Result ${i + 1}`} className="w-full rounded" />
                                <button
                                    onClick={() => handleDownload(url, i)}
                                    className="absolute top-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded hover:bg-[#888]"
                                >↓</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
