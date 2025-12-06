/**
 * Content Generator Panel - AI 캠페인 이미지 생성 UI
 * Grey on Grey Design System
 */

import React, { useState, useRef, DragEvent } from 'react';
import { synthesizeShoeStudio } from '../services/shoeStudioService';
import { generateInitialOriginalSet } from '../services/originalGenerationService';

const colors = { bgBase: '#F5F5F7', bgSurface: '#FFFFFF', bgSubtle: '#F0F0F4', borderSoft: '#E2E2E8', textPrimary: '#111111', textSecondary: '#6E6E73', textMuted: '#A1A1AA', accentPrimary: '#111111' };

interface ContentGeneratorPanelProps {
    productImages?: string[];
    onImageGenerated?: (imageUrl: string) => void;
    onAddToPreview?: (imageUrl: string, sectionType: string) => void;
    lang?: 'ko' | 'en';
}

export default function ContentGeneratorPanel({ productImages = [], onImageGenerated, onAddToPreview }: ContentGeneratorPanelProps) {
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

    const handleSourceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) handleFileSelect(e.target.files); };
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setSourceDragActive(true); };
    const handleDragLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setSourceDragActive(false); };
    const handleDrop = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setSourceDragActive(false); if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files); };

    const removeImage = (index: number) => {
        const newFiles = [...sourceImages]; newFiles.splice(index, 1);
        setSourceImages(newFiles); setSourcePreviews(newFiles.map(f => URL.createObjectURL(f)));
    };

    const handleGenerateShoeSwap = async () => {
        if (sourceImages.length === 0) return setError('콘텐츠 이미지를 먼저 업로드하세요.');
        if (productImages.length === 0) return setError('제품 탭에서 제품 이미지를 먼저 업로드하세요.');
        setIsGenerating(true); setError(''); setResultImages([]);
        const results: string[] = [];
        try {
            for (let i = 0; i < sourceImages.length; i++) {
                setProgressMessage(`처리 중 ${i + 1}/${sourceImages.length}...`);
                const file = sourceImages[i];
                const reader = new FileReader();
                const sourceDataUrl = await new Promise<string>((resolve) => { reader.onload = (e) => resolve(e.target?.result as string); reader.readAsDataURL(file); });
                const imageUrl = await synthesizeShoeStudio(productImages[0], sourceDataUrl, 'minimal');
                results.push(imageUrl); onImageGenerated?.(imageUrl); onAddToPreview?.(imageUrl, 'campaign');
            }
            setResultImages(results);
        } catch (err: any) { console.error(err); setError(err.message || 'Error occurred'); }
        finally { setIsGenerating(false); setProgressMessage(''); }
    };

    const handleGenerateOriginalSet = async () => {
        if (sourceImages.length === 0 || productImages.length === 0) return;
        setIsGenerating(true); setError(''); setProgressMessage('준비 중...');
        try {
            const productFiles = await Promise.all(productImages.map(async (url, i) => { const res = await fetch(url); const blob = await res.blob(); return new File([blob], `product_${i}.png`, { type: blob.type }); }));
            const { modelShots, closeupShots } = await generateInitialOriginalSet(productFiles, sourceImages, (msg) => setProgressMessage(msg));
            const results = [...modelShots.map(s => s.url), ...closeupShots.map(s => s.url)];
            setResultImages(results);
            modelShots.forEach(shot => onAddToPreview?.(shot.url, 'campaign'));
            closeupShots.forEach(shot => onAddToPreview?.(shot.url, 'detail'));
        } catch (err: any) { console.error(err); setError(err.message || 'Error occurred'); }
        finally { setIsGenerating(false); setProgressMessage(''); }
    };

    const handleDownload = (url: string, index: number) => { const a = document.createElement('a'); a.href = url; a.download = `campaign_${index + 1}_${Date.now()}.jpg`; a.click(); };

    return (
        <div className="space-y-3" style={{ fontFamily: '-apple-system, sans-serif' }}>
            {/* Content Image Upload */}
            <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }} className="mb-2 block">콘텐츠 이미지</span>
                <div
                    style={{ minHeight: 160, border: `2px dashed ${sourceDragActive ? colors.accentPrimary : colors.borderSoft}`, borderRadius: 10, background: sourceDragActive ? colors.bgSubtle : 'transparent' }}
                    className="p-4 text-center cursor-pointer flex flex-col items-center justify-center"
                    onClick={() => sourceInputRef.current?.click()}
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                >
                    <input ref={sourceInputRef} type="file" accept="image/*" multiple onChange={handleSourceInputChange} className="hidden" />
                    {sourcePreviews.length > 0 ? (
                        <div className="grid grid-cols-4 gap-1.5">
                            {sourcePreviews.map((preview, i) => (
                                <div key={i} className="relative aspect-square">
                                    <img src={preview} alt={`Content ${i + 1}`} className="w-full h-full object-cover rounded-lg" />
                                    <button onClick={(e) => { e.stopPropagation(); removeImage(i); }} className="absolute top-0.5 right-0.5 bg-black/60 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] hover:bg-red-500">×</button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div style={{ color: colors.textMuted, fontSize: 20 }} className="mb-1">+</div>
                            <p style={{ fontSize: 11, fontWeight: 500, color: colors.textSecondary }}>이미지를 드롭하거나 클릭하여 업로드</p>
                            <p style={{ fontSize: 11, color: colors.textMuted }} className="mt-1">신발 이미지 최대 10장</p>
                        </>
                    )}
                </div>
                <div className="flex justify-center gap-0.5 mt-2">
                    {Array.from({ length: 10 }).map((_, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i < sourceImages.length ? colors.accentPrimary : colors.borderSoft }} />)}
                </div>
            </div>

            {/* Product Images Status */}
            <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }} className="mb-2 block">제품 이미지</span>
                {productImages.length > 0 ? (
                    <div className="flex gap-1.5 flex-wrap">
                        {productImages.slice(0, 4).map((url, i) => <img key={i} src={url} alt={`Product ${i + 1}`} className="w-10 h-10 object-cover rounded-lg" />)}
                        {productImages.length > 4 && <div style={{ background: colors.bgSubtle, color: colors.textMuted }} className="w-10 h-10 rounded-lg flex items-center justify-center text-[10px]">+{productImages.length - 4}</div>}
                    </div>
                ) : <p style={{ fontSize: 11, color: colors.textMuted }}>제품 탭에서 제품 이미지를 먼저 업로드하세요</p>}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
                <button onClick={handleGenerateShoeSwap} disabled={isGenerating || sourceImages.length === 0 || productImages.length === 0}
                    style={{ padding: 12, borderRadius: 8, fontSize: 11, fontWeight: 500, background: 'transparent', border: `1px solid ${colors.borderSoft}`, color: (isGenerating || sourceImages.length === 0 || productImages.length === 0) ? colors.textMuted : colors.textPrimary, cursor: (isGenerating || sourceImages.length === 0 || productImages.length === 0) ? 'not-allowed' : 'pointer' }}>신발 교체</button>
                <button onClick={handleGenerateOriginalSet} disabled={isGenerating || sourceImages.length === 0 || productImages.length === 0}
                    style={{ padding: 12, borderRadius: 8, fontSize: 11, fontWeight: 500, background: (isGenerating || sourceImages.length === 0 || productImages.length === 0) ? colors.bgSubtle : colors.accentPrimary, color: (isGenerating || sourceImages.length === 0 || productImages.length === 0) ? colors.textMuted : '#FFF', cursor: (isGenerating || sourceImages.length === 0 || productImages.length === 0) ? 'not-allowed' : 'pointer' }}>세트 생성</button>
            </div>

            {progressMessage && <div style={{ fontSize: 11, textAlign: 'center', color: colors.textSecondary, padding: 8, background: colors.bgSubtle, borderRadius: 8 }}>{progressMessage}</div>}
            {error && <div style={{ fontSize: 11, color: '#EF4444', padding: 8, background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>{error}</div>}

            {resultImages.length > 0 && (
                <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }} className="mb-2 block">결과 ({resultImages.length})</span>
                    <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto">
                        {resultImages.map((url, i) => (
                            <div key={i} className="relative">
                                <img src={url} alt={`Result ${i + 1}`} className="w-full rounded-lg" />
                                <button onClick={() => handleDownload(url, i)} className="absolute top-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded hover:bg-gray-700">↓</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
