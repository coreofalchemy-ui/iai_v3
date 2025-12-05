import React, { useRef, useCallback, useState } from 'react';
import { Reorder } from 'framer-motion';

interface NavigationMinimapProps {
    sectionOrder: string[];
    onReorder: (newOrder: string[]) => void;
    activeSection: string;
    onSectionClick: (section: string) => void;
    data: any;
    onAddSection?: () => void;
    previewRef?: React.RefObject<HTMLDivElement> | React.RefObject<HTMLDivElement | null>;
    previewHtml?: string;
    textElements?: any[];
    onAction?: (action: string, type: any, index: any, arg?: any) => void;
    isHoldOn?: boolean;
    onToggleHoldMode?: () => void;
}

export const NavigationMinimap: React.FC<NavigationMinimapProps> = ({
    sectionOrder,
    onReorder,
    activeSection,
    onSectionClick,
    data,
    onAddSection,
    previewRef,
    previewHtml,
    onAction,
    isHoldOn = true,
    onToggleHoldMode
}) => {
    const minimapRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const [imgErrors, setImgErrors] = useState<{ [key: string]: boolean }>({});
    const [minimapScale, setMinimapScale] = useState(1); // 미니맵 전체 스케일

    const getPreviewImage = (section: string) => {
        if (section === 'hero') return null;

        let url = null;
        const sectionUrl = data?.imageUrls?.[section];

        // 직접 섹션 ID로 접근 (동적 섹션: custom-*, shoe-*, model-cut-*, beautified-*, closeup-* 등)
        if (typeof sectionUrl === 'string' && sectionUrl !== 'loading' && sectionUrl !== 'SPACER') {
            url = sectionUrl;
        } else if (Array.isArray(sectionUrl) && sectionUrl.length > 0) {
            url = typeof sectionUrl[0] === 'string' ? sectionUrl[0] : sectionUrl[0]?.url;
        } else if (section === 'products' && data?.imageUrls?.products?.[0]) {
            url = typeof data.imageUrls.products[0] === 'string' ? data.imageUrls.products[0] : data.imageUrls.products[0]?.url;
        } else if (section === 'models' && data?.imageUrls?.modelShots?.[0]?.url) {
            url = data.imageUrls.modelShots[0].url;
        } else if (section === 'closeups' && data?.imageUrls?.closeupShots?.[0]?.url) {
            url = data.imageUrls.closeupShots[0].url;
        }

        // Filter out placeholder URLs to show empty state instead
        if (url && url.includes('via.placeholder.com')) {
            return null;
        }
        return url;
    };

    const getSectionLabel = (section: string) => {
        if (section === 'hero') return '히어로';
        if (section === 'products') return '제품';
        if (section === 'models') return '모델';
        if (section === 'closeups') return '디테일';
        return '섹션';
    };

    const handleMinimapClick = (section: string) => {
        onSectionClick(section);
        if (previewRef?.current) {
            const sectionElement = previewRef.current.querySelector(`[data-section="${section}"]`);
            if (sectionElement) {
                sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    const handleDrop = useCallback((e: React.DragEvent, section: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageUrl = event.target?.result as string;
                if (onAction && imageUrl) {
                    onAction('updateImage', section, 0, imageUrl);
                    // Reset error state for this section as we have a new image
                    setImgErrors(prev => ({ ...prev, [section]: false }));
                }
            };
            reader.readAsDataURL(file);
        }
    }, [onAction]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleImgError = (section: string) => {
        setImgErrors(prev => ({ ...prev, [section]: true }));
    };

    // 휠로 미니맵 전체 스케일 조절
    const handleMinimapWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setMinimapScale(prev => Math.max(0.3, Math.min(1.5, prev + delta)));
    };

    // 히어로 섹션 텍스트 컨텐츠 렌더링
    const renderHeroContent = () => {
        const heroData = data?.heroTextContent;
        if (!heroData) {
            return (
                <div className="flex flex-col p-2 text-[6px]">
                    <div className="w-full h-1 bg-gray-300 rounded-sm mb-0.5" />
                    <div className="w-2/3 h-0.5 bg-gray-200 rounded-sm mb-1" />
                    <div className="flex-grow bg-white border border-gray-100 rounded-sm" />
                </div>
            );
        }

        return (
            <div className="w-full h-full p-1 flex flex-col text-[4px] leading-tight overflow-hidden bg-white">
                <div className="text-[3px] text-gray-400 uppercase tracking-widest mb-0.5 truncate">
                    {heroData.brandLine || 'BRAND'}
                </div>
                <div className="text-[5px] font-bold text-gray-800 truncate mb-0.5">
                    {heroData.productName || 'Product'}
                </div>
                <div className="text-[3px] text-gray-500 truncate mb-1">
                    {heroData.subName || 'Model'}
                </div>
                <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                    {heroData.stylingMatch && (
                        <div className="text-[2.5px] text-gray-400 line-clamp-2">{heroData.stylingMatch}</div>
                    )}
                    {heroData.craftsmanship && (
                        <div className="text-[2.5px] text-gray-400 line-clamp-2">{heroData.craftsmanship}</div>
                    )}
                </div>
                <div className="mt-auto pt-0.5 border-t border-gray-100">
                    <div className="text-[3px] font-bold text-purple-600">SPEC</div>
                    <div className="flex gap-1 text-[2.5px] text-gray-500">
                        <span>Color</span>
                        <span>•</span>
                        <span>Upper</span>
                        <span>•</span>
                        <span>Outsole</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 border-r border-gray-200">
            <div className="p-2 border-b border-gray-200 bg-white flex items-center justify-between">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Minimap</div>
                {onToggleHoldMode && (
                    <button
                        onClick={onToggleHoldMode}
                        className={`
                            w-8 h-4 rounded-full relative transition-colors duration-200 focus:outline-none
                            ${isHoldOn ? 'bg-blue-500' : 'bg-gray-300'}
                        `}
                        title={isHoldOn ? "Hold ON (Edit Enabled)" : "Hold OFF (Edit Disabled)"}
                    >
                        <div
                            className={`
                                absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200
                                ${isHoldOn ? 'translate-x-4' : 'translate-x-0'}
                            `}
                        />
                    </button>
                )}
            </div>

            {/* 줌 컨트롤 */}
            <div className="px-2 py-1 border-b border-gray-100 bg-white flex items-center justify-center gap-1">
                <button
                    onClick={() => setMinimapScale(prev => Math.max(0.3, prev - 0.1))}
                    className="w-5 h-5 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded text-sm"
                >−</button>
                <span className="text-[9px] font-bold text-gray-500 min-w-[35px] text-center">{Math.round(minimapScale * 100)}%</span>
                <button
                    onClick={() => setMinimapScale(prev => Math.min(1.5, prev + 0.1))}
                    className="w-5 h-5 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded text-sm"
                >+</button>
                <button
                    onClick={() => setMinimapScale(0.5)}
                    className="px-1 py-0.5 text-[8px] text-blue-600 hover:bg-blue-50 rounded font-bold"
                >전체</button>
            </div>

            <div
                className="flex-grow overflow-auto p-2 custom-scrollbar"
                onWheel={handleMinimapWheel}
            >
                <div
                    style={{
                        transform: `scale(${minimapScale})`,
                        transformOrigin: 'top center',
                        transition: 'transform 0.2s ease-out'
                    }}
                >
                    <Reorder.Group axis="y" values={sectionOrder} onReorder={onReorder} className="space-y-2">
                        {sectionOrder.map((section: string) => (
                            <Reorder.Item key={section} value={section} className="cursor-grab active:cursor-grabbing">
                                <div
                                    ref={(el) => { minimapRefs.current[section] = el; }}
                                    className={`
                                        relative aspect-[2/3] rounded border transition-all duration-200 overflow-hidden group bg-white
                                        ${activeSection === section
                                            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                                    `}
                                    onClick={() => handleMinimapClick(section)}
                                >
                                    {section === 'hero' ? (
                                        <div className="w-full h-full bg-gradient-to-b from-gray-50 to-white overflow-hidden relative">
                                            {renderHeroContent()}
                                        </div>
                                    ) : (
                                        <div className="w-full h-full bg-white flex items-center justify-center relative">
                                            {getPreviewImage(section) && !imgErrors[section] ? (
                                                <img
                                                    src={getPreviewImage(section)!}
                                                    alt={section}
                                                    className="w-full h-full object-cover"
                                                    onError={() => handleImgError(section)}
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-gray-100 to-gray-50">
                                                    <span className="text-[10px] text-gray-400 font-medium">{getSectionLabel(section)}</span>
                                                </div>
                                            )}
                                            {/* Drop Zone Overlay - Covers the entire item to ensure drop works */}
                                            <div
                                                className="absolute inset-0 z-10"
                                                onDrop={(e) => handleDrop(e, section)}
                                                onDragOver={handleDragOver}
                                            />
                                        </div>
                                    )}

                                    <div className={`
                                        absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/70 to-transparent text-white text-[9px] font-medium text-center
                                        ${activeSection === section ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                                        transition-opacity duration-200 pointer-events-none
                                    `}>
                                        {getSectionLabel(section)}
                                    </div>
                                </div>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>

                    {onAddSection && (
                        <button
                            onClick={onAddSection}
                            className="w-full mt-2 aspect-square rounded border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all gap-1"
                            title="섹션 추가"
                        >
                            <span className="text-2xl font-light">+</span>
                            <span className="text-[10px] font-medium">Add</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
