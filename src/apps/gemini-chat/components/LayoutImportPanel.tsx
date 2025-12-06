/**
 * LayoutImportPanel
 * 레이아웃 가져오기 메인 패널
 * 좌측: 원본 캡쳐 뷰어 / 우측: 편집 가능한 챕터 레이아웃
 */

import React, { useState, useRef, useCallback } from 'react';
import type {
    LayoutImportState,
    ImportedChapter,
    ChapterLayout,
    LayoutBlock,
    ImageSlotBlock,
    TextBlock,
} from '../types/layoutImportTypes';
import { initialLayoutImportState } from '../types/layoutImportTypes';
import {
    processDetailPageImage,
    generateImageFromReference,
    enhanceImage,
} from '../services/layoutImportService';

// ==================== Design Tokens ====================
const colors = {
    bgBase: '#F5F5F7',
    bgSurface: '#FFFFFF',
    bgSubtle: '#F0F0F4',
    borderSoft: '#E2E2E8',
    textPrimary: '#111111',
    textSecondary: '#6E6E73',
    textMuted: '#A1A1AA',
    accentPrimary: '#111111',
    accentBlue: '#007AFF',
    accentGreen: '#34C759',
};

// ==================== Sub Components ====================

// 원본 이미지 뷰어 (좌측)
const OriginalCaptureViewer: React.FC<{
    imageUrl: string | null;
    chapters: ImportedChapter[];
    selectedChapterId: string | null;
    onChapterClick: (chapterId: string) => void;
}> = ({ imageUrl, chapters, selectedChapterId, onChapterClick }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    if (!imageUrl) {
        return (
            <div
                style={{
                    width: 300,
                    background: colors.bgSubtle,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 12,
                }}
            >
                <span style={{ fontSize: 48 }}>📄</span>
                <p style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>
                    원본 이미지가<br />여기에 표시됩니다
                </p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{
                width: 300,
                background: colors.bgSurface,
                borderRadius: 12,
                overflow: 'auto',
                position: 'relative',
            }}
        >
            <div style={{ position: 'relative' }}>
                <img
                    src={imageUrl}
                    alt="원본 상세페이지"
                    style={{ width: '100%', display: 'block' }}
                />
                {/* 챕터 오버레이 */}
                {chapters.map((chapter) => (
                    <div
                        key={chapter.id}
                        onClick={() => onChapterClick(chapter.id)}
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: chapter.crop.top * (300 / 1080), // 스케일 조정
                            height: chapter.height * (300 / 1080),
                            background: selectedChapterId === chapter.id
                                ? 'rgba(0, 122, 255, 0.15)'
                                : 'transparent',
                            border: selectedChapterId === chapter.id
                                ? '2px solid rgba(0, 122, 255, 0.5)'
                                : '1px solid rgba(0, 0, 0, 0.05)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <span
                            style={{
                                position: 'absolute',
                                top: 4,
                                left: 4,
                                fontSize: 9,
                                background: colors.textPrimary,
                                color: '#FFF',
                                padding: '2px 6px',
                                borderRadius: 4,
                            }}
                        >
                            {parseInt(chapter.id.split('-')[1]) + 1}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// 이미지 슬롯 에디터
const ImageSlotEditor: React.FC<{
    block: ImageSlotBlock;
    chapterLayout: ChapterLayout;
    onImageDrop: (slotId: string, imageUrl: string) => void;
    onGenerateImage: (slotId: string) => void;
    onEnhanceImage: (slotId: string, style: 'studio' | 'natural' | 'cinematic') => void;
    isGenerating: boolean;
}> = ({ block, chapterLayout, onImageDrop, onGenerateImage, onEnhanceImage, isGenerating }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            const url = URL.createObjectURL(files[0]);
            onImageDrop(block.slotId, url);
        }
    }, [block.slotId, onImageDrop]);

    const slotHeight = (block.bbox.height / 100) * 200; // 기준 높이 200px

    return (
        <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            style={{
                position: 'relative',
                width: '100%',
                height: Math.max(80, slotHeight),
                background: isDragOver ? 'rgba(0, 122, 255, 0.1)' : colors.bgSubtle,
                borderRadius: 8,
                border: isDragOver ? `2px dashed ${colors.accentBlue}` : `1px dashed ${colors.borderSoft}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 8,
                overflow: 'hidden',
            }}
        >
            {block.currentImageUrl ? (
                <>
                    <img
                        src={block.currentImageUrl}
                        alt=""
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 6,
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 4,
                            right: 4,
                            display: 'flex',
                            gap: 4,
                        }}
                    >
                        <button
                            onClick={() => onEnhanceImage(block.slotId, 'studio')}
                            style={{
                                background: 'rgba(0,0,0,0.7)',
                                color: '#FFF',
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: 10,
                                cursor: 'pointer',
                            }}
                        >
                            ✨ 효과 주기
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <span style={{ fontSize: 24 }}>🖼️</span>
                    <p style={{ fontSize: 11, color: colors.textMuted }}>
                        이미지 드롭 또는
                    </p>
                    <button
                        onClick={() => onGenerateImage(block.slotId)}
                        disabled={isGenerating}
                        style={{
                            background: colors.accentBlue,
                            color: '#FFF',
                            border: 'none',
                            borderRadius: 16,
                            padding: '6px 12px',
                            fontSize: 11,
                            cursor: isGenerating ? 'wait' : 'pointer',
                            opacity: isGenerating ? 0.6 : 1,
                        }}
                    >
                        {isGenerating ? '생성 중...' : '🎨 이미지 생성'}
                    </button>
                </>
            )}
        </div>
    );
};

// 텍스트 블록 에디터
const TextBlockEditor: React.FC<{
    block: TextBlock;
    onTextChange: (blockId: string, text: string) => void;
}> = ({ block, onTextChange }) => {
    const styleMap = {
        title: { fontSize: 16, fontWeight: 700 },
        body: { fontSize: 13, fontWeight: 400 },
        caption: { fontSize: 11, fontWeight: 400, color: colors.textSecondary },
    };

    const alignMap = {
        left: 'left',
        center: 'center',
        right: 'right',
    };

    return (
        <div style={{ marginBottom: 8 }}>
            <input
                type="text"
                value={block.currentText}
                onChange={(e) => onTextChange(block.blockId, e.target.value)}
                style={{
                    width: '100%',
                    background: 'transparent',
                    border: `1px solid ${colors.borderSoft}`,
                    borderRadius: 6,
                    padding: '8px 10px',
                    textAlign: alignMap[block.align] as any,
                    color: colors.textPrimary,
                    ...styleMap[block.style],
                    outline: 'none',
                }}
                placeholder={`${block.style} 텍스트 입력...`}
            />
        </div>
    );
};

// 챕터 레이아웃 에디터
const ChapterLayoutEditor: React.FC<{
    layout: ChapterLayout;
    isSelected: boolean;
    onSelect: () => void;
    onBlockUpdate: (chapterId: string, blocks: LayoutBlock[]) => void;
    onImageGenerate: (chapterId: string, slotId: string) => void;
    onImageEnhance: (chapterId: string, slotId: string, style: 'studio' | 'natural' | 'cinematic') => void;
    generatingSlotId: string | null;
}> = ({ layout, isSelected, onSelect, onBlockUpdate, onImageGenerate, onImageEnhance, generatingSlotId }) => {

    const handleTextChange = (blockId: string, text: string) => {
        const updatedBlocks = layout.blocks.map(b =>
            b.type === 'text' && b.blockId === blockId
                ? { ...b, currentText: text }
                : b
        );
        onBlockUpdate(layout.id, updatedBlocks);
    };

    const handleImageDrop = (slotId: string, imageUrl: string) => {
        const updatedBlocks = layout.blocks.map(b =>
            b.type === 'imageSlot' && b.slotId === slotId
                ? { ...b, currentImageUrl: imageUrl, isGenerated: false }
                : b
        );
        onBlockUpdate(layout.id, updatedBlocks);
    };

    return (
        <div
            onClick={onSelect}
            style={{
                background: colors.bgSurface,
                borderRadius: 12,
                border: isSelected ? `2px solid ${colors.accentBlue}` : `1px solid ${colors.borderSoft}`,
                padding: 12,
                marginBottom: 12,
                cursor: 'pointer',
            }}
        >
            {/* 헤더 */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: `1px solid ${colors.borderSoft}`,
            }}>
                <span style={{
                    background: colors.textPrimary,
                    color: '#FFF',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                }}>
                    챕터 {layout.chapterIndex + 1}
                </span>
                <img
                    src={layout.originalChapterImageUrl}
                    alt=""
                    style={{
                        width: 40,
                        height: 40,
                        objectFit: 'cover',
                        borderRadius: 4,
                        border: `1px solid ${colors.borderSoft}`,
                    }}
                />
                <span style={{ fontSize: 11, color: colors.textMuted }}>
                    레퍼런스
                </span>
            </div>

            {/* 블록들 */}
            <div>
                {layout.blocks.map((block) => {
                    if (block.type === 'imageSlot') {
                        return (
                            <ImageSlotEditor
                                key={block.slotId}
                                block={block}
                                chapterLayout={layout}
                                onImageDrop={handleImageDrop}
                                onGenerateImage={(slotId) => onImageGenerate(layout.id, slotId)}
                                onEnhanceImage={(slotId, style) => onImageEnhance(layout.id, slotId, style)}
                                isGenerating={generatingSlotId === block.slotId}
                            />
                        );
                    } else {
                        return (
                            <TextBlockEditor
                                key={block.blockId}
                                block={block}
                                onTextChange={handleTextChange}
                            />
                        );
                    }
                })}
            </div>
        </div>
    );
};

// ==================== Main Component ====================
export const LayoutImportPanel: React.FC = () => {
    const [state, setState] = useState<LayoutImportState>(initialLayoutImportState);
    const [generatingSlotId, setGeneratingSlotId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 이미지 업로드 핸들러
    const handleImageUpload = useCallback(async (file: File) => {
        const imageUrl = URL.createObjectURL(file);

        // 이미지 크기 가져오기
        const img = new Image();
        img.onload = async () => {
            setState(prev => ({
                ...prev,
                originalImageUrl: imageUrl,
                originalImageWidth: img.naturalWidth,
                originalImageHeight: img.naturalHeight,
                isProcessing: true,
                processingStep: 'splitting',
                error: null,
            }));

            try {
                // 전체 파이프라인 실행
                const { chapters, layouts } = await processDetailPageImage(
                    imageUrl,
                    img.naturalWidth,
                    img.naturalHeight,
                    (step, progress) => {
                        setState(prev => ({
                            ...prev,
                            processingStep: step as any,
                            processingProgress: progress,
                        }));
                    }
                );

                setState(prev => ({
                    ...prev,
                    chapters,
                    chapterLayouts: layouts,
                    isProcessing: false,
                    processingStep: 'done',
                    processingProgress: 100,
                }));
            } catch (error) {
                setState(prev => ({
                    ...prev,
                    isProcessing: false,
                    error: (error as Error).message,
                }));
            }
        };
        img.src = imageUrl;
    }, []);

    // 드래그앤드롭 핸들러
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            handleImageUpload(files[0]);
        }
    }, [handleImageUpload]);

    // 챕터 선택
    const handleChapterClick = useCallback((chapterId: string) => {
        setState(prev => ({ ...prev, selectedChapterId: chapterId }));
    }, []);

    // 블록 업데이트
    const handleBlockUpdate = useCallback((chapterId: string, blocks: LayoutBlock[]) => {
        setState(prev => ({
            ...prev,
            chapterLayouts: prev.chapterLayouts.map(layout =>
                layout.id === chapterId ? { ...layout, blocks } : layout
            ),
        }));
    }, []);

    // 이미지 생성
    const handleImageGenerate = useCallback(async (chapterId: string, slotId: string) => {
        const layout = state.chapterLayouts.find(l => l.id === chapterId);
        if (!layout) return;

        setGeneratingSlotId(slotId);

        try {
            // 텍스트 컨텍스트 수집
            const textContext: { title?: string; body?: string; caption?: string } = {};
            layout.blocks.forEach(b => {
                if (b.type === 'text') {
                    textContext[b.style] = b.currentText;
                }
            });

            // 슬롯 찾기
            const slot = layout.blocks.find(b => b.type === 'imageSlot' && b.slotId === slotId) as ImageSlotBlock;

            // 이미지 생성
            const generatedImage = await generateImageFromReference(
                layout.originalChapterImageUrl,
                slot.aspectRatio,
                textContext
            );

            // 업데이트
            setState(prev => ({
                ...prev,
                chapterLayouts: prev.chapterLayouts.map(l =>
                    l.id === chapterId
                        ? {
                            ...l,
                            blocks: l.blocks.map(b =>
                                b.type === 'imageSlot' && b.slotId === slotId
                                    ? { ...b, currentImageUrl: generatedImage, isGenerated: true }
                                    : b
                            ),
                        }
                        : l
                ),
            }));
        } catch (error) {
            console.error('이미지 생성 실패:', error);
        } finally {
            setGeneratingSlotId(null);
        }
    }, [state.chapterLayouts]);

    // 이미지 미화
    const handleImageEnhance = useCallback(async (
        chapterId: string,
        slotId: string,
        style: 'studio' | 'natural' | 'cinematic'
    ) => {
        const layout = state.chapterLayouts.find(l => l.id === chapterId);
        if (!layout) return;

        const slot = layout.blocks.find(b => b.type === 'imageSlot' && b.slotId === slotId) as ImageSlotBlock;
        if (!slot?.currentImageUrl) return;

        setGeneratingSlotId(slotId);

        try {
            const enhancedImage = await enhanceImage(slot.currentImageUrl, style);

            setState(prev => ({
                ...prev,
                chapterLayouts: prev.chapterLayouts.map(l =>
                    l.id === chapterId
                        ? {
                            ...l,
                            blocks: l.blocks.map(b =>
                                b.type === 'imageSlot' && b.slotId === slotId
                                    ? { ...b, currentImageUrl: enhancedImage }
                                    : b
                            ),
                        }
                        : l
                ),
            }));
        } catch (error) {
            console.error('이미지 미화 실패:', error);
        } finally {
            setGeneratingSlotId(null);
        }
    }, [state.chapterLayouts]);

    return (
        <div
            style={{
                display: 'flex',
                height: '100%',
                gap: 16,
                padding: 16,
                background: colors.bgBase,
            }}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
        >
            {/* 좌측: 원본 이미지 뷰어 */}
            <OriginalCaptureViewer
                imageUrl={state.originalImageUrl}
                chapters={state.chapters}
                selectedChapterId={state.selectedChapterId}
                onChapterClick={handleChapterClick}
            />

            {/* 우측: 편집 영역 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* 업로드 영역 */}
                {!state.originalImageUrl && !state.isProcessing && (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            flex: 1,
                            background: colors.bgSurface,
                            borderRadius: 16,
                            border: `2px dashed ${colors.borderSoft}`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 16,
                            cursor: 'pointer',
                        }}
                    >
                        <div style={{
                            width: 80,
                            height: 80,
                            background: colors.bgSubtle,
                            borderRadius: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <span style={{ fontSize: 36 }}>📥</span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, marginBottom: 8 }}>
                                상세페이지 캡쳐 업로드
                            </h3>
                            <p style={{ fontSize: 13, color: colors.textMuted }}>
                                긴 상세페이지 이미지를 드래그하거나 클릭하세요
                            </p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file);
                            }}
                        />
                    </div>
                )}

                {/* 처리 중 */}
                {state.isProcessing && (
                    <div
                        style={{
                            flex: 1,
                            background: colors.bgSurface,
                            borderRadius: 16,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 16,
                        }}
                    >
                        <div className="animate-spin" style={{
                            width: 40,
                            height: 40,
                            border: '3px solid #E2E2E8',
                            borderTopColor: colors.accentBlue,
                            borderRadius: '50%',
                        }} />
                        <p style={{ fontSize: 14, color: colors.textPrimary }}>
                            {state.processingStep === 'splitting' ? '🔍 챕터 분리 중...' : '📊 레이아웃 분석 중...'}
                        </p>
                        <div style={{
                            width: 200,
                            height: 4,
                            background: colors.bgSubtle,
                            borderRadius: 2,
                            overflow: 'hidden',
                        }}>
                            <div
                                style={{
                                    width: `${state.processingProgress}%`,
                                    height: '100%',
                                    background: colors.accentBlue,
                                    transition: 'width 0.3s',
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* 챕터 레이아웃 리스트 */}
                {state.chapterLayouts.length > 0 && !state.isProcessing && (
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        <h3 style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: colors.textSecondary,
                            marginBottom: 12,
                            position: 'sticky',
                            top: 0,
                            background: colors.bgBase,
                            padding: '4px 0',
                        }}>
                            편집 가능한 레이아웃 ({state.chapterLayouts.length}개 챕터)
                        </h3>
                        {state.chapterLayouts.map((layout) => (
                            <ChapterLayoutEditor
                                key={layout.id}
                                layout={layout}
                                isSelected={state.selectedChapterId === layout.id}
                                onSelect={() => handleChapterClick(layout.id)}
                                onBlockUpdate={handleBlockUpdate}
                                onImageGenerate={handleImageGenerate}
                                onImageEnhance={handleImageEnhance}
                                generatingSlotId={generatingSlotId}
                            />
                        ))}
                    </div>
                )}

                {/* 에러 표시 */}
                {state.error && (
                    <div style={{
                        background: '#FFEBEE',
                        color: '#C62828',
                        padding: 12,
                        borderRadius: 8,
                        fontSize: 13,
                        marginTop: 8,
                    }}>
                        ⚠️ {state.error}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LayoutImportPanel;
