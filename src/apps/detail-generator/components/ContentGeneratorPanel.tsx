/**
 * Content Generator Panel - AI 캠페인 이미지 생성 UI
 * Grey on Grey Design System
 */

import React, { useState, useRef, DragEvent } from 'react';
import { synthesizeShoeStudio } from '../services/shoeStudioService';

const colors = { bgBase: '#F5F5F7', bgSurface: '#FFFFFF', bgSubtle: '#F0F0F4', borderSoft: '#E2E2E8', textPrimary: '#111111', textSecondary: '#6E6E73', textMuted: '#A1A1AA', accentPrimary: '#111111' };

interface ContentGeneratorPanelProps {
    productImages?: string[];
    productImageCount?: number;     // 사용자 업로드 이미지 수
    aiGeneratedCount?: number;      // AI 생성 이미지 수
    onImageGenerated?: (imageUrl: string) => void;
    onAddToPreview?: (imageUrl: string, sectionType: string) => void;
    lang?: 'ko' | 'en';
    savedResults?: string[];
    onUpdateResults?: (results: string[]) => void;
    // New props for state persistence
    savedSourceImages?: string[]; // stored as Data URLs for persistence
    onUpdateSourceImages?: (images: string[]) => void;
}

export default function ContentGeneratorPanel({
    productImages = [],
    productImageCount,
    aiGeneratedCount,
    onImageGenerated,
    onAddToPreview,
    savedResults = [],
    onUpdateResults,
    savedSourceImages = [],
    onUpdateSourceImages,
    lang = 'ko'
}: ContentGeneratorPanelProps) {
    // We now use Data URLs (strings) instead of File objects for easier persistence in JSON state
    const [localSourceImages, setLocalSourceImages] = useState<string[]>([]);

    // Determine source of truth
    const sourceImages = onUpdateSourceImages ? savedSourceImages : localSourceImages;
    const setSourceImages = (newImages: string[]) => {
        if (onUpdateSourceImages) {
            onUpdateSourceImages(newImages);
        } else {
            setLocalSourceImages(newImages);
        }
    };

    const [sourceDragActive, setSourceDragActive] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string>('');
    const [progressMessage, setProgressMessage] = useState<string>('');
    const sourceInputRef = useRef<HTMLInputElement>(null);

    // Results persistence
    const [localResults, setLocalResults] = useState<string[]>([]);
    const activeResults = onUpdateResults ? savedResults : localResults;
    const setActiveResults = (newResults: string[]) => {
        if (onUpdateResults) {
            onUpdateResults(newResults);
        } else {
            setLocalResults(newResults);
        }
    };

    // Helper to read file as Data URL
    const fileToDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleFileSelect = async (files: FileList | File[]) => {
        const incomingFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (incomingFiles.length === 0) return;

        // Convert key info for duplicate checking (approximate since we don't have file objects for persisted strings)
        // For persisted strings (data URLs), we can't easily check name/size against new Files.
        // However, we can check if the *content* matches by converting new files to data URLs.

        const newImageUrls: string[] = [];

        for (const file of incomingFiles) {
            try {
                const dataUrl = await fileToDataUrl(file);
                // Check for duplicates in existing sourceImages
                // This is an expensive check (string comparison of large base64) but accurate and necessary
                const isDuplicate = sourceImages.some(existingUrl => existingUrl === dataUrl);

                if (!isDuplicate) {
                    newImageUrls.push(dataUrl);
                }
            } catch (e) {
                console.error("Failed to read file:", e);
            }
        }

        if (newImageUrls.length === 0) return;

        const updatedImages = [...sourceImages, ...newImageUrls].slice(0, 10);
        setSourceImages(updatedImages);
    };

    const handleSourceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) handleFileSelect(e.target.files); };
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setSourceDragActive(true); };
    const handleDragLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setSourceDragActive(false); };
    const handleDrop = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setSourceDragActive(false); if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files); };

    const removeImage = (index: number) => {
        const newImages = [...sourceImages];
        newImages.splice(index, 1);
        setSourceImages(newImages);
    };

    const handleGenerateShoeSwap = async () => {
        console.log('[ContentGeneratorPanel] Starting generation...');
        if (sourceImages.length === 0) return setError('콘텐츠 이미지를 먼저 업로드하세요.');
        if (productImages.length === 0) return setError('제품 탭에서 제품 이미지를 먼저 업로드하세요.');

        setIsGenerating(true);
        setError('');

        try {
            const newGeneratedUrls: string[] = [];
            for (let i = 0; i < sourceImages.length; i++) {
                console.log(`[ContentGeneratorPanel] Processing image ${i + 1}/${sourceImages.length}`);
                setProgressMessage(`신발 교체 중... ${i + 1}/${sourceImages.length}`);

                // sourceImages are now Data URLs directly
                const sourceDataUrl = sourceImages[i];

                // Use 'replacement' logic
                const imageUrl = await synthesizeShoeStudio(productImages[0], sourceDataUrl, 'minimal');

                // --- DEBUGGING LOGS ---
                console.log('[ContentGeneratorPanel] Generation returned.');
                console.log('[ContentGeneratorPanel] Image URL Type:', typeof imageUrl);
                console.log('[ContentGeneratorPanel] Image URL Length:', imageUrl?.length);
                if (imageUrl && imageUrl.startsWith('data:image')) {
                    console.log('[ContentGeneratorPanel] Valid Data URL detected');
                } else {
                    console.log('[ContentGeneratorPanel] WARNING: Invalid Data URL format:', imageUrl?.substring(0, 50) + '...');
                }
                // ----------------------

                newGeneratedUrls.push(imageUrl);
                onImageGenerated?.(imageUrl);

                // 🔒 No longer auto-add to preview
                // User will click ADD button on each result to add to preview
                console.log(`[ContentGeneratorPanel] Image ${i + 1} generated, saved to results`);
            }

            // Append new results to existing ones
            console.log('[ContentGeneratorPanel] Updating results with new URLs:', newGeneratedUrls.length);
            setActiveResults([...activeResults, ...newGeneratedUrls]);

        } catch (err: any) {
            console.error('[ContentGeneratorPanel] Error:', err);
            setError(err.message || '신발 교체 중 오류가 발생했습니다.');
        } finally {
            setIsGenerating(false);
            setProgressMessage('');
            console.log('[ContentGeneratorPanel] Finished generation.');
        }
    };

    const handleDownload = (url: string, index: number) => { const a = document.createElement('a'); a.href = url; a.download = `campaign_${index + 1}_${Date.now()}.jpg`; a.click(); };

    return (
        <div className="space-y-3" style={{ fontFamily: '-apple-system, sans-serif' }}>
            {/* Content Image Upload */}
            <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }} className="mb-2 block">{lang === 'ko' ? '콘텐츠 이미지' : 'Content Images'}</span>
                <div
                    style={{ minHeight: 100, border: `2px dashed ${sourceDragActive ? colors.accentPrimary : colors.borderSoft}`, borderRadius: 10, background: sourceDragActive ? colors.bgSubtle : 'transparent' }}
                    className="p-4 text-center cursor-pointer flex flex-col items-center justify-center"
                    onClick={() => sourceInputRef.current?.click()}
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                >
                    <input ref={sourceInputRef} type="file" accept="image/*" multiple onChange={handleSourceInputChange} className="hidden" />
                    {sourceImages.length > 0 ? (
                        <div className="grid grid-cols-4 gap-1.5">
                            {sourceImages.map((preview, i) => (
                                <div key={i} className="relative aspect-square">
                                    <img src={preview} alt={`Content ${i + 1}`} className="w-full h-full object-cover rounded-lg" />
                                    <button onClick={(e) => { e.stopPropagation(); removeImage(i); }} className="absolute top-0.5 right-0.5 bg-black/60 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] hover:bg-red-500">×</button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div style={{ color: colors.textMuted, fontSize: 20 }} className="mb-1">+</div>
                            <p style={{ fontSize: 11, fontWeight: 500, color: colors.textSecondary }}>{lang === 'ko' ? '이미지를 드롭하거나 클릭하여 업로드' : 'Drop images or click to upload'}</p>
                            <p style={{ fontSize: 11, color: colors.textMuted }} className="mt-1">{lang === 'ko' ? '신발이 포함된 사진 권장' : 'Photos with shoes recommended'}</p>
                        </>
                    )}
                </div>
                <div className="flex justify-center gap-0.5 mt-2">
                    {Array.from({ length: 10 }).map((_, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i < sourceImages.length ? colors.accentPrimary : colors.borderSoft }} />)}
                </div>
            </div>

            {/* Product Images Status */}
            <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                <div className="flex justify-between items-center mb-2">
                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>{lang === 'ko' ? '제품 이미지' : 'Product Images'}</span>
                    {productImages.length > 0 && (
                        <span style={{ fontSize: 10, color: colors.textMuted }}>
                            {productImageCount !== undefined && aiGeneratedCount !== undefined
                                ? `${lang === 'ko' ? '업로드' : 'Upload'} ${productImageCount} + ${lang === 'ko' ? 'AI' : 'AI'} ${aiGeneratedCount}`
                                : productImages.length
                            }
                        </span>
                    )}
                </div>
                {productImages.length > 0 ? (
                    <div className="flex gap-1.5 flex-wrap">
                        {productImages.slice(0, 4).map((url, i) => <img key={i} src={url} alt={`Product ${i + 1}`} className="w-10 h-10 object-cover rounded-lg" />)}
                        {productImages.length > 4 && <div style={{ background: colors.bgSubtle, color: colors.textMuted }} className="w-10 h-10 rounded-lg flex items-center justify-center text-[10px]">+{productImages.length - 4}</div>}
                    </div>
                ) : <p style={{ fontSize: 11, color: colors.textMuted }}>{lang === 'ko' ? '제품 탭에서 제품 이미지를 먼저 업로드하세요' : 'Upload product images in Product tab first'}</p>}
            </div>

            {/* Action Buttons */}
            <button
                onClick={handleGenerateShoeSwap}
                disabled={isGenerating || sourceImages.length === 0 || productImages.length === 0}
                style={{
                    width: '100%',
                    padding: 14,
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    background: (isGenerating || sourceImages.length === 0 || productImages.length === 0) ? colors.bgSubtle : colors.accentPrimary,
                    color: (isGenerating || sourceImages.length === 0 || productImages.length === 0) ? colors.textMuted : '#FFF',
                    cursor: (isGenerating || sourceImages.length === 0 || productImages.length === 0) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                }}
            >
                {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {progressMessage || (lang === 'ko' ? '생성 중...' : 'Generating...')}
                    </span>
                ) : (lang === 'ko' ? '신발 교체' : 'Replace Shoes')}
            </button>

            {error && <div style={{ fontSize: 11, color: '#EF4444', padding: 8, background: 'rgba(239,68,68,0.1)', borderRadius: 8, textAlign: 'center' }}>{error}</div>}

            {/* Results Area */}
            {activeResults.length > 0 && (
                <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                    <div className="flex justify-between items-center mb-2">
                        <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>{lang === 'ko' ? `결과 (${activeResults.length})` : `Results (${activeResults.length})`}</span>
                        <button
                            onClick={() => setActiveResults([])}
                            style={{ fontSize: 10, color: colors.textMuted, cursor: 'pointer' }}
                        >
                            {lang === 'ko' ? '모두 지우기' : 'Clear All'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-[600px] overflow-y-auto">
                        {activeResults.map((url, i) => (
                            <div key={i} className="relative group">
                                <img src={url} alt={`Result ${i + 1}`} className="w-full rounded-lg border border-gray-100" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                                    <button onClick={() => handleDownload(url, i)} className="bg-white/90 text-black text-[10px] px-2 py-1 rounded hover:bg-white font-medium">Down</button>
                                    <button onClick={() => onAddToPreview?.(url, 'campaign')} className="bg-white/90 text-black text-[10px] px-2 py-1 rounded hover:bg-white font-medium">Add</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
