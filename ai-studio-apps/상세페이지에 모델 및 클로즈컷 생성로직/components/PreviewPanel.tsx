
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GeneratedData, FontSizes, FontStyles, HeroTextColors, ImageAsset, CollageBlock, PLACEHOLDER_ASSET } from '../App';
import { populateTemplate } from '../services/geminiService';
import { getFilterStyles } from '../lib/utils';
import { UploadCloudIcon, RefreshCwIcon, DownloadIcon, Trash2Icon, BrushIcon, ChevronUpIcon, ChevronDownIcon, RotateCcwIcon, CopyIcon, PlusIcon, MinusIcon } from './icons';
import Spinner from './Spinner';

type ImageGalleryKey = 'products' | 'modelShots' | 'closeupShots' | 'conceptShot' | 'studioWornCloseup' | 'finalConceptShot';

const PLACEHOLDER_URL_STRING = "data:image/svg+xml,%3Csvg width='1000' height='1333' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%23f3f4f6'/%3E%3Crect width='calc(100%25 - 40px)' height='calc(100%25 - 40px)' x='20' y='20' fill='none' stroke='%23d1d5db' stroke-width='4' stroke-dasharray='24%2C12'/%3E%3C/svg%3E";

interface PreviewPanelProps {
  data: GeneratedData;
  fontSizes: FontSizes;
  fontStyles: FontStyles;
  heroTextColors: HeroTextColors;
  filterPreset: string;
  imageZoomLevels: { [key: string]: number };
  onImageZoom: (key: string, direction: 'in' | 'out') => void;
  productEnhancementPreset: string;
  onImageReplace: (galleryType: ImageGalleryKey, index: number, file: File) => void;
  onAddProductImage: (files: File[]) => void;
  onReorderSectionItem: (section: 'model' | 'closeup', index: number, direction: 'up' | 'down') => void;
  onReorderProductImage: (dragIndex: number, dropIndex: number) => void;
  onDuplicateImage: (galleryType: 'modelShots' | 'closeupShots', index: number) => void;
  onRegenerateSingle: (type: 'modelShots' | 'closeupShots', index: number) => void;
  onRegenerateShoesOnly: (type: 'modelShots' | 'closeupShots', index: number) => void;
  shoeRegenLoadingState: { type: string, index: number } | null;
  onRegenerateSingleProduct: (index: number) => void;
  singleProductEnhanceLoading: number | null;
  onRegenerateWithSpecificPose: (type: 'modelShots' | 'closeupShots', index: number, pose: string) => void;
  onDownloadSingle: (type: ImageGalleryKey, index: number) => void;
  onDeleteImage: (type: 'modelShots' | 'closeupShots', index: number) => void;
  onDeleteProductImage: (index: number) => void;
  onDeleteFinalConceptShot: () => void;
  singleImageLoadingState: { type: string, index: number } | null;
  singlePoseLoadingState: { type: string, index: number } | null;
  placeholderLoadingState: { type: string, index: number } | null;
  onGenerateForPlaceholder: (type: 'modelShots' | 'closeupShots', index: number) => void;
  onRegenerateConceptShot: () => void;
  isConceptLoading: boolean;
  onRegenerateStudioWornCloseupShot: () => void;
  isStudioWornCloseupLoading: boolean;
  onRegenerateFinalConceptShot: () => void;
  isFinalConceptLoading: boolean;
  onAddCollageBlock: (layout: '2x1' | '2x2', section: 'model' | 'closeup') => void;
  onDeleteCollageBlock: (blockId: string) => void;
  onReplaceCollageImage: (blockId: string, imageIndex: number, file: File) => void;
  onDeleteCollageImage: (blockId: string, imageIndex: number) => void;
  onReorderCollageImage: (blockId: string, dragIndex: number, dropIndex: number) => void;
}

interface ImageOverlayInfo {
    top: number;
    left: number;
    width: number;
    height: number;
    type: 'products' | 'models' | 'conceptShot' | 'studioWornCloseup' | 'finalConceptShot' | 'collage';
    galleryType: ImageGalleryKey | 'collageBlocks';
    index: number;
    blockId?: string;
    asset: ImageAsset | string;
    isFirst: boolean;
    isLast: boolean;
}

interface CollageBlockOverlayInfo {
    top: number;
    left: number;
    width: number;
    height: number;
    blockId: string;
}

interface SectionItemOverlayInfo {
    top: number;
    left: number;
    width: number;
    height: number;
    section: 'model' | 'closeup';
    index: number;
    isFirst: boolean;
    isLast: boolean;
}

export const PREDEFINED_POSES = [
    { id: 'front-view', name: '🧍 정면 서기', prompt: "Change the pose to standing straight, facing forward. Arms relaxed at sides. Shoes clearly visible." },
    { id: 'walking-towards', name: '🚶 걸어오기', prompt: "Change the pose to walking towards the camera. One leg stepping forward. Dynamic movement." },
    { id: 'side-profile', name: '측면 보기', prompt: "Change the pose to a full side profile view. Walking or standing. Show the side silhouette of the shoes." },
    { id: 'turn-back', name: '🔙 뒤돌아보기', prompt: "Change the pose to standing with back to camera, looking over the shoulder. Highlighting the heel/back of the shoes." },
    { id: 'leaning-wall', name: '🧱 벽 기대기', prompt: "Change the pose to leaning casually against a wall. One leg crossed over the other or resting back." },
    { id: 'sitting-stool', name: '🪑 앉기', prompt: "Change the pose to sitting on a high stool or chair. One leg extended, one bent. Shoes prominent." },
    { id: 'crossed-legs', name: '다리 교차', prompt: "Change the pose to standing with legs crossed at the ankles. Casual and stylish stance." },
    { id: 'wide-stance', name: '와이드 스탠스', prompt: "Change the pose to a confident wide stance (A-shape). Feet shoulder-width apart. Power pose." },
    { id: 'one-leg-up', name: '🦶 한 발 들기', prompt: "Change the pose to lifting one foot slightly, as if checking the shoe or mid-step. Sole visible." },
    { id: 'crouching', name: '🧘 쭈그리기', prompt: "Change the pose to crouching or squatting down. Streetwear style. Shoes very close to camera." },
];

export const PREDEFINED_CLOSEUP_POSES = [
    { id: 'side-step', name: '👟 측면 스텝', prompt: "Close-up edit: Show the feet from the side, taking a step. Emphasize the side profile of the shoe." },
    { id: 'heel-lift', name: '👠 힐 리프트', prompt: "Close-up edit: One heel lifted off the ground, flexing the shoe sole. Dynamic walking motion." },
    { id: 'crossed-ankles', name: '✖️ 발목 교차', prompt: "Close-up edit: Feet crossed at the ankles while standing. Casual stance showing top/side of shoes." },
    { id: 'tiptoe', name: '⬆️ 까치발', prompt: "Close-up edit: Standing on tiptoes (both feet). Tension in the calves. Showcasing the shoe shape." },
    { id: 'top-down', name: '⬇️ 내려다보기', prompt: "Close-up edit: Top-down perspective (POV). Looking down at own feet. Feet parallel." },
    { id: 'one-forward', name: '▶️ 한 발 앞', prompt: "Close-up edit: One foot placed significantly in front of the other. Lunging or walking stance." },
    { id: 'back-heel', name: '🔙 뒷모습', prompt: "Close-up edit: View from behind the heels. Walking away. Emphasis on the back design and sole." },
    { id: 'sitting-sole', name: '🦶 밑창 보여주기', prompt: "Close-up edit: Legs crossed while sitting, showing the sole of one shoe clearly to the camera." },
    { id: '45-degree', name: '📐 45도 각도', prompt: "Close-up edit: Feet positioned at a 45-degree angle to the camera. Flattering angle showing both front and side." },
    { id: 'jump-landing', name: '🦘 착지 순간', prompt: "Close-up edit: Feet just slightly off the ground or landing. Dynamic folds in trousers, action shot." },
];


export const PreviewPanel: React.FC<PreviewPanelProps> = ({ 
    data, 
    fontSizes, 
    fontStyles, 
    heroTextColors, 
    filterPreset, 
    imageZoomLevels,
    onImageZoom,
    productEnhancementPreset,
    onImageReplace,
    onAddProductImage,
    onReorderSectionItem,
    onReorderProductImage,
    onDuplicateImage,
    onRegenerateSingle,
    onRegenerateShoesOnly,
    shoeRegenLoadingState,
    onRegenerateSingleProduct,
    singleProductEnhanceLoading,
    onRegenerateWithSpecificPose,
    onDownloadSingle,
    onDeleteImage,
    onDeleteProductImage,
    onDeleteFinalConceptShot,
    singleImageLoadingState,
    singlePoseLoadingState,
    placeholderLoadingState,
    onGenerateForPlaceholder,
    onRegenerateConceptShot,
    isConceptLoading,
    onRegenerateStudioWornCloseupShot,
    isStudioWornCloseupLoading,
    onRegenerateFinalConceptShot,
    isFinalConceptLoading,
    onAddCollageBlock,
    onDeleteCollageBlock,
    onReplaceCollageImage,
    onDeleteCollageImage,
    onReorderCollageImage,
}) => {
    const { textContent, specContent, heroTextContent, noticeContent, imageUrls, collageBlocks, layoutHtml } = data;
    const [htmlContent, setHtmlContent] = useState('');
    
    // Split content for filtering
    const parts = useMemo(() => {
        if (!htmlContent) return { beforeFilterable: '', filterable: '', afterFilterable: '' };
        
        const startMarker = '<!--FILTERABLE_CONTENT_START-->';
        const endMarker = '<!--FILTERABLE_CONTENT_END-->';
        
        const startIndex = htmlContent.indexOf(startMarker);
        const endIndex = htmlContent.indexOf(endMarker);

        if (startIndex === -1 || endIndex === -1) {
            return { beforeFilterable: htmlContent, filterable: '', afterFilterable: '' };
        }

        const beforeFilterable = htmlContent.substring(0, startIndex);
        const filterableContent = htmlContent.substring(startIndex + startMarker.length, endIndex);
        const afterFilterable = htmlContent.substring(endIndex + endMarker.length);

        if (filterPreset !== 'off') {
             const styles = getFilterStyles(filterPreset);
             // Convert style objects to CSS strings
             const baseStyleStr = Object.entries(styles.base).map(([k, v]) => `${k.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}: ${v}`).join(';');
             
             let overlaysHtml = '';
             styles.overlays.forEach(overlay => {
                  const styleStr = Object.entries(overlay).map(([k, v]) => `${k.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}: ${v}`).join(';');
                  overlaysHtml += `<div style="position: absolute; inset: 0; pointer-events: none; z-index: 10; ${styleStr}"></div>`;
             });

             return { 
                 beforeFilterable, 
                 filterable: `<div style="position: relative; ${baseStyleStr}">${overlaysHtml}${filterableContent}</div>`, 
                 afterFilterable 
             };
        }

        return { beforeFilterable, filterable: filterableContent, afterFilterable };

    }, [htmlContent, filterPreset]);

    const [overlays, setOverlays] = useState<ImageOverlayInfo[]>([]);
    const [collageBlockOverlays, setCollageBlockOverlays] = useState<CollageBlockOverlayInfo[]>([]);
    const [sectionItemOverlays, setSectionItemOverlays] = useState<SectionItemOverlayInfo[]>([]);
    const contentRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const draggedItemRef = useRef<{ blockId: string, index: number } | null>(null);
    
    // Performance optimization: Prevent frequent state updates during drag
    const [draggedOverIndex, setDraggedOverIndex] = useState<{ galleryType: string; index: number, blockId?: string } | null>(null);
    const [draggedOverImage, setDraggedOverImage] = useState<{ galleryType: string; index: number; blockId?: string } | null>(null);
    
    const draggedProductIndexRef = useRef<number | null>(null);
    const [draggedOverProductIndex, setDraggedOverProductIndex] = useState<number | null>(null);

    useEffect(() => {
        if (textContent && specContent && heroTextContent && noticeContent && imageUrls && layoutHtml && fontSizes) {
            try {
                const finalHtml = populateTemplate(
                    textContent, specContent, heroTextContent, noticeContent, imageUrls, fontSizes, fontStyles, layoutHtml, heroTextColors, collageBlocks, false,
                    data.isHeroSectionVisible ?? true,
                    data.isStudioWornCloseupVisible ?? true,
                    data.isFinalConceptShotVisible ?? true,
                    imageZoomLevels
                );
                setHtmlContent(finalHtml);
            } catch (error) {
                console.error("Error populating template:", error);
                setHtmlContent("<body>레이아웃을 렌더링하는 중 오류가 발생했습니다.</body>");
            }
        }
    }, [textContent, specContent, heroTextContent, noticeContent, imageUrls, layoutHtml, fontSizes, fontStyles, heroTextColors, collageBlocks, data.isHeroSectionVisible, data.isStudioWornCloseupVisible, data.isFinalConceptShotVisible, imageZoomLevels]);

    const calculateOverlays = useCallback(() => {
        if (!contentRef.current || !wrapperRef.current) return;
        const images = contentRef.current.querySelectorAll<HTMLImageElement>('img[data-type]');
        const newOverlays: ImageOverlayInfo[] = [];
        const containerRect = wrapperRef.current.getBoundingClientRect();

        const galleryLengths = {
            products: contentRef.current.querySelectorAll('img[data-gallery-type="products"]').length,
            modelShots: contentRef.current.querySelectorAll('img[data-gallery-type="modelShots"]').length,
            closeupShots: contentRef.current.querySelectorAll('img[data-gallery-type="closeupShots"]').length,
        };

        images.forEach((img) => {
            const rect = img.getBoundingClientRect();
            const type = img.dataset.type as any;
            const galleryType = img.dataset.galleryType as ImageGalleryKey | 'collageBlocks';
            const index = parseInt(img.dataset.index || '0', 10);
            const blockId = img.dataset.blockId;
            
            const top = rect.top - containerRect.top + wrapperRef.current!.scrollTop;
            const left = rect.left - containerRect.left + wrapperRef.current!.scrollLeft;

            let asset: ImageAsset | string | undefined;
            if (galleryType === 'products') asset = imageUrls.products[index];
            else if (galleryType === 'modelShots') asset = imageUrls.modelShots[index];
            else if (galleryType === 'closeupShots') asset = imageUrls.closeupShots[index];
            else if (galleryType === 'conceptShot') asset = imageUrls.conceptShot;
            else if (galleryType === 'studioWornCloseup') asset = imageUrls.studioWornCloseup;
            else if (galleryType === 'finalConceptShot') asset = imageUrls.finalConceptShot;
            else if (galleryType === 'collageBlocks' && blockId) {
                const block = collageBlocks.find(b => b.id === blockId);
                asset = block?.images[index] || PLACEHOLDER_ASSET;
            } else {
                asset = PLACEHOLDER_ASSET;
            }

            if (!asset) return;

            let isFirst = false;
            let isLast = false;
            if (galleryType === 'products' || galleryType === 'modelShots' || galleryType === 'closeupShots') {
                isFirst = index === 0;
                isLast = index === galleryLengths[galleryType] - 1;
            }

            newOverlays.push({
                top, left, width: rect.width, height: rect.height,
                type, galleryType, index, blockId, asset: asset as ImageAsset | string, isFirst, isLast
            });
        });
        setOverlays(newOverlays);

        const sectionItems = contentRef.current.querySelectorAll<HTMLElement>('[data-section-item-index]');
        const newSectionItemOverlays: SectionItemOverlayInfo[] = [];
        sectionItems.forEach(el => {
            const rect = el.getBoundingClientRect();
            const section = el.dataset.section as 'model' | 'closeup';
            const index = parseInt(el.dataset.sectionItemIndex || '0', 10);
            const totalItems = contentRef.current?.querySelectorAll(`[data-section="${section}"]`).length || 0;
            
            newSectionItemOverlays.push({
                    top: rect.top - containerRect.top + wrapperRef.current!.scrollTop,
                    left: rect.left - containerRect.left + wrapperRef.current!.scrollLeft,
                    width: rect.width,
                    height: rect.height,
                    section, index, isFirst: index === 0, isLast: index === totalItems - 1
            });
        });
        setSectionItemOverlays(newSectionItemOverlays);

        const collageBlocksEls = contentRef.current.querySelectorAll<HTMLElement>('[data-collage-block-id]');
        const newCollageBlockOverlays: CollageBlockOverlayInfo[] = [];
        collageBlocksEls.forEach(el => {
            const rect = el.getBoundingClientRect();
            const blockId = el.dataset.collageBlockId || '';
            newCollageBlockOverlays.push({
                    top: rect.top - containerRect.top + wrapperRef.current!.scrollTop,
                    left: rect.left - containerRect.left + wrapperRef.current!.scrollLeft,
                    width: rect.width,
                    height: rect.height,
                    blockId
            });
        });
        setCollageBlockOverlays(newCollageBlockOverlays);

    }, [imageUrls, collageBlocks]);

    useEffect(() => {
        // Initial calculation
        calculateOverlays();

        // Use ResizeObserver instead of MutationObserver for better performance on layout changes
        const resizeObserver = new ResizeObserver(() => {
            calculateOverlays();
        });

        if (contentRef.current) {
            resizeObserver.observe(contentRef.current);
        }
        
        // Also observe wrapper for scrolling/resizing
        if (wrapperRef.current) {
            resizeObserver.observe(wrapperRef.current);
        }

        window.addEventListener('resize', calculateOverlays);
        
        // Fallback to catch image loads that shift layout
        const imgLoadHandler = () => calculateOverlays();
        const imgs = contentRef.current?.querySelectorAll('img');
        imgs?.forEach(img => img.addEventListener('load', imgLoadHandler));

        return () => {
            window.removeEventListener('resize', calculateOverlays);
            resizeObserver.disconnect();
            imgs?.forEach(img => img.removeEventListener('load', imgLoadHandler));
        };
    }, [calculateOverlays]);


    const handleDragStart = (e: React.DragEvent, type: 'gallery' | 'product', id: string, index: number) => {
        e.stopPropagation();
        if (type === 'gallery') {
            draggedItemRef.current = { blockId: id, index };
            e.dataTransfer.effectAllowed = 'move';
        } else {
            draggedProductIndexRef.current = index;
            e.dataTransfer.effectAllowed = 'move';
        }
    };

    const handleDragOver = (e: React.DragEvent, type: 'gallery' | 'product', id: string, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        // Optimization: only update state if the value actually changed
        if (type === 'gallery') {
             const isSame = draggedOverIndex?.galleryType === 'collageBlocks' && draggedOverIndex?.index === index && draggedOverIndex?.blockId === id;
             if (!isSame) {
                 setDraggedOverIndex({ galleryType: 'collageBlocks', index, blockId: id });
             }
        } else {
             if (draggedOverProductIndex !== index) {
                 setDraggedOverProductIndex(index);
             }
        }
    };
    
    const handleDrop = (e: React.DragEvent, type: 'gallery' | 'product', id: string, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'gallery' && draggedItemRef.current) {
             if (draggedItemRef.current.blockId === id) {
                onReorderCollageImage(id, draggedItemRef.current.index, index);
             }
             draggedItemRef.current = null;
             setDraggedOverIndex(null);
        } else if (type === 'product' && draggedProductIndexRef.current !== null) {
             onReorderProductImage(draggedProductIndexRef.current, index);
             draggedProductIndexRef.current = null;
             setDraggedOverProductIndex(null);
        }
    };

    const handleFileDrop = (e: React.DragEvent, galleryType: ImageGalleryKey | 'collageBlocks', index: number, blockId?: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDraggedOverImage(null);
        const files = Array.from(e.dataTransfer.files).filter((f: File) => f.type.startsWith('image/'));
        if (files.length > 0) {
            if (galleryType === 'collageBlocks' && blockId) {
                onReplaceCollageImage(blockId, index, files[0]);
            } else if (galleryType !== 'collageBlocks') {
                onImageReplace(galleryType, index, files[0]);
            }
        }
    };


    return (
        <div className="relative w-full h-full flex flex-col items-center overflow-hidden" id="preview-content-wrapper">
            {/* Filter Bar at the Top */}
            {filterPreset !== 'off' && (
                <div id="filter-preset-bar-wrapper" className="absolute top-0 left-0 right-0 z-30 bg-black/80 text-white py-2 px-4 text-center text-sm font-semibold backdrop-blur-sm">
                    필터 적용됨: {filterPreset.toUpperCase()}
                </div>
            )}

            <div 
                ref={wrapperRef} 
                className="w-full h-full overflow-y-auto overflow-x-hidden relative scroll-smooth"
                style={{ perspective: '1000px' }}
            >
                <div 
                    ref={contentRef} 
                    id="capture-target"
                    className="relative mx-auto bg-white shadow-2xl transition-transform duration-500"
                    dangerouslySetInnerHTML={{ __html: parts.beforeFilterable + parts.filterable + parts.afterFilterable }} 
                />

                {/* Section Reordering Overlays */}
                {sectionItemOverlays.map((overlay, i) => (
                    <div
                        key={`section-overlay-${i}`}
                        className="absolute pointer-events-none flex flex-col justify-center pl-2 gap-2 z-30 image-control-overlay"
                        style={{
                            top: overlay.top,
                            left: overlay.left, // Inside the image area
                            height: overlay.height,
                            width: '40px' // Narrow strip for controls
                        }}
                    >
                         {/* Reorder Buttons - Inside Image */}
                         <div className="pointer-events-auto flex flex-col gap-1 bg-white/80 backdrop-blur-md rounded-lg shadow-lg border border-gray-200 p-1">
                             <button
                                onClick={(e) => { e.stopPropagation(); onReorderSectionItem(overlay.section, overlay.index, 'up'); }}
                                disabled={overlay.isFirst}
                                className="p-1.5 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30"
                            >
                                <ChevronUpIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onReorderSectionItem(overlay.section, overlay.index, 'down'); }}
                                disabled={overlay.isLast}
                                className="p-1.5 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30"
                            >
                                <ChevronDownIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
                
                 {/* Collage Block Deletion Overlays */}
                {collageBlockOverlays.map((overlay, i) => (
                    <div
                         key={`collage-block-overlay-${i}`}
                         className="absolute pointer-events-none z-30 image-control-overlay"
                         style={{
                             top: overlay.top,
                             left: overlay.left + overlay.width - 40, // Right edge
                             width: 40,
                             height: 40
                         }}
                    >
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteCollageBlock(overlay.blockId); }}
                            className="pointer-events-auto p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                            title="Delete Block"
                        >
                            <Trash2Icon className="w-4 h-4" />
                        </button>
                    </div>
                ))}

                {/* Image Controls Overlays */}
                {overlays.map((overlay, i) => {
                    if (!overlay.asset) return null; // Extra safety check

                    const isPlaceholder = typeof overlay.asset === 'string' ? overlay.asset.includes('svg') : overlay.asset.url.includes('svg');
                    const isProcessing = 
                        (singleImageLoadingState?.type === overlay.galleryType && singleImageLoadingState?.index === overlay.index) ||
                        (singlePoseLoadingState?.type === overlay.galleryType && singlePoseLoadingState?.index === overlay.index) ||
                        (shoeRegenLoadingState?.type === overlay.galleryType && shoeRegenLoadingState?.index === overlay.index) ||
                        (placeholderLoadingState?.type === overlay.galleryType && placeholderLoadingState?.index === overlay.index) ||
                        (overlay.galleryType === 'conceptShot' && isConceptLoading) ||
                        (overlay.galleryType === 'studioWornCloseup' && isStudioWornCloseupLoading) ||
                        (overlay.galleryType === 'finalConceptShot' && isFinalConceptLoading);
                        
                    const isModelOrCloseup = overlay.galleryType === 'modelShots' || overlay.galleryType === 'closeupShots';
                    const isProduct = overlay.galleryType === 'products';
                    
                    const uniqueKey = `${overlay.galleryType}-${overlay.index}`;
                    const currentZoom = imageZoomLevels[uniqueKey] || 1;

                    return (
                        <div 
                            key={i}
                            className={`absolute group transition-opacity duration-200 z-20 image-control-overlay ${draggedOverImage?.galleryType === overlay.galleryType && draggedOverImage?.index === overlay.index ? 'ring-4 ring-blue-500 bg-blue-50/20' : ''}`}
                            style={{
                                top: overlay.top,
                                left: overlay.left,
                                width: overlay.width,
                                height: overlay.height,
                            }}
                            onDragOver={(e) => { 
                                e.preventDefault();
                                // Optimization: only set state if different
                                if (draggedOverImage?.galleryType !== overlay.galleryType || draggedOverImage?.index !== overlay.index) {
                                    setDraggedOverImage({ galleryType: overlay.galleryType, index: overlay.index, blockId: overlay.blockId });
                                }
                            }}
                            onDragLeave={() => setDraggedOverImage(null)}
                            onDrop={(e) => handleFileDrop(e, overlay.galleryType, overlay.index, overlay.blockId)}
                        >
                            {/* Center Control Group */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                <div className="bg-black/60 backdrop-blur-md p-3 rounded-xl flex flex-col gap-3 pointer-events-auto transform scale-90 group-hover:scale-100 transition-transform duration-200 shadow-2xl border border-white/10">
                                    
                                    {/* Row 1: Zoom Controls */}
                                    <div className="flex items-center justify-center gap-2 pb-2 border-b border-white/20 w-full">
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); onImageZoom(uniqueKey, 'out'); }}
                                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30"
                                            disabled={currentZoom <= 0.2}
                                            title="Zoom Out"
                                        >
                                            <MinusIcon className="w-4 h-4" />
                                        </button>
                                        <span className="text-xs font-mono text-white/80 w-10 text-center">{Math.round(currentZoom * 100)}%</span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onImageZoom(uniqueKey, 'in'); }}
                                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30"
                                            disabled={currentZoom >= 3}
                                            title="Zoom In"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Row 2: Primary Actions */}
                                    <div className="flex items-center gap-2 justify-center">
                                        {/* Regenerate (Model/Closeup/Product) */}
                                        {(isModelOrCloseup || isProduct) && (
                                            <button
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    if(isProduct) onRegenerateSingleProduct(overlay.index);
                                                    else onRegenerateSingle(overlay.galleryType as 'modelShots' | 'closeupShots', overlay.index);
                                                }}
                                                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors shadow-lg"
                                                title={isProduct ? "Enhance Product" : "Regenerate"}
                                            >
                                                {isProcessing ? <Spinner /> : <RefreshCwIcon className="w-5 h-5" />}
                                            </button>
                                        )}
                                        
                                        {/* Shoe Only Regen (Model/Closeup) */}
                                        {isModelOrCloseup && (
                                             <button
                                                onClick={(e) => { e.stopPropagation(); onRegenerateShoesOnly(overlay.galleryType as 'modelShots' | 'closeupShots', overlay.index); }}
                                                className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors shadow-lg"
                                                title="Regenerate Shoes Only"
                                            >
                                                 <BrushIcon className="w-5 h-5" />
                                            </button>
                                        )}

                                        {/* Duplicate (Model/Closeup/Product) */}
                                        {(isModelOrCloseup || isProduct) && (
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onDuplicateImage(overlay.galleryType as 'modelShots' | 'closeupShots', overlay.index);
                                                }}
                                                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors shadow-lg"
                                                title="Duplicate"
                                            >
                                                <CopyIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Row 3: File Actions */}
                                    <div className="flex items-center gap-2 justify-center pt-2 border-t border-white/20 w-full">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDownloadSingle(overlay.galleryType as ImageGalleryKey, overlay.index); }}
                                            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                            title="Download"
                                        >
                                            <DownloadIcon className="w-4 h-4" />
                                        </button>
                                        
                                        <label className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer" title="Replace Image">
                                            <UploadCloudIcon className="w-4 h-4" />
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*" 
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        onImageReplace(overlay.galleryType as ImageGalleryKey, overlay.index, e.target.files[0]);
                                                    }
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </label>

                                        {/* Delete */}
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                if (isModelOrCloseup) onDeleteImage(overlay.galleryType as any, overlay.index);
                                                else if (isProduct) onDeleteProductImage(overlay.index);
                                                else if (overlay.galleryType === 'finalConceptShot') onDeleteFinalConceptShot();
                                            }}
                                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-md transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2Icon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                             {/* Bottom Pose Bar - Visible on Hover for Model/Closeup */}
                             {isModelOrCloseup && (
                                <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex justify-center z-40">
                                    <div className="bg-black/80 backdrop-blur-md rounded-full px-4 py-2 shadow-2xl border border-white/10 pointer-events-auto overflow-x-auto flex gap-2 max-w-[90%] no-scrollbar">
                                        {(overlay.galleryType === 'modelShots' ? PREDEFINED_POSES : PREDEFINED_CLOSEUP_POSES).map((pose) => (
                                            <button
                                                key={pose.id}
                                                onClick={(e) => { e.stopPropagation(); onRegenerateWithSpecificPose(overlay.galleryType as any, overlay.index, pose.prompt); }}
                                                className="flex-shrink-0 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-full border border-white/10 transition-all whitespace-nowrap hover:scale-105 active:scale-95"
                                            >
                                                {pose.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                             )}

                            {/* Loading State Overlay */}
                            {isProcessing && (
                                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-50">
                                    <Spinner />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
