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
    sectionHeights?: { [key: string]: number };
    previewWidth?: number;
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
    onToggleHoldMode,
    sectionHeights,
    previewWidth = 1000
}) => {
    const minimapRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const [imgErrors, setImgErrors] = useState<{ [key: string]: boolean }>({});
    const [minimapScale, setMinimapScale] = useState(1); // 미니맵 전체 스케일

    // Reset error state when image URL changes
    React.useEffect(() => {
        setImgErrors({});
    }, [data?.imageUrls]);

    const getPreviewImage = (section: string) => {
        // 1. 단순 문자열 URL 확인 (커스텀, Hero 등)
        const directUrl = data?.imageUrls?.[section];
        if (typeof directUrl === 'string' && directUrl !== 'loading' && directUrl !== 'SPACER') {
            // placeholder 필터링 제거 (실제 이미지가 있다면 보여줌)
            return directUrl;
        }

        // 2. 객체/배열 형태 URL 확인
        if (typeof directUrl === 'object' && directUrl !== null) {
            if (directUrl.url) return directUrl.url; // 단일 객체
            if (Array.isArray(directUrl) && directUrl.length > 0) {
                // 배열의 첫번째 항목
                const firstItem = directUrl[0];
                if (typeof firstItem === 'string') return firstItem;
                if (firstItem?.url) return firstItem.url;
            }
        }

        // 3. 레거시/특정 섹션 타입 매핑 (필요한 경우 유지, 하지만 위 로직으로 대부분 커버됨)
        if (section === 'products' && data?.imageUrls?.products?.[0]) {
            const p = data.imageUrls.products[0];
            return typeof p === 'string' ? p : p?.url;
        }

        return null;
    };

    const getSectionLabel = (section: string) => {
        if (section === 'hero') return '히어로';
        if (section === 'products') return '제품';
        if (section === 'models') return '모델';
        if (section === 'closeups') return '디테일';
        if (section.startsWith('size-guide')) return '사이즈';
        if (section.startsWith('precautions')) return '주의사항';
        if (section.startsWith('as-info')) return 'A/S';
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

    return (
        <div className="h-full flex flex-col bg-gray-50 border-r border-gray-200">
            <div className="p-2 border-b border-gray-200 bg-white flex items-center justify-between">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Minimap</div>
                {onToggleHoldMode && (
                    <button
                        onClick={onToggleHoldMode}
                        className={`
                            w-8 h-4 rounded-full relative transition-colors duration-200 focus:outline-none
                            ${isHoldOn ? 'bg-gray-500' : 'bg-gray-300'}
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
                    className="px-1 py-0.5 text-[8px] text-gray-600 hover:bg-gray-50 rounded font-bold"
                >전체</button>
            </div>

            <div
                className="flex-grow overflow-auto p-4 custom-scrollbar bg-[#e5e5e5]"
            >
                <div
                    style={{
                        transform: `scale(${minimapScale})`,
                        transformOrigin: 'top center',
                        transition: 'transform 0.2s ease-out'
                    }}
                >
                    <Reorder.Group axis="y" values={sectionOrder} onReorder={onReorder} className="flex flex-col shadow-lg">
                        {sectionOrder.map((section: string) => {
                            // 높이 계산 (기본 previewWidth 너비 기준)
                            // Hero 섹션은 텍스트 양에 따라 높이가 유동적이므로, 캡쳐된 이미지가 있으면 그 비율을 따르도록 함
                            const currentHeight = sectionHeights?.[section];
                            // 높이 정보가 없으면 기본값 사용 (하지만 캡쳐되면 업데이트됨)
                            // 1000px 기준 1.5배 비율 유지 가설 제거 -> auto

                            // aspect-ratio 스타일을 제거하고, 이미지 자체 비율에 맡기거나
                            // 캡쳐된 이미지가 없을 때만 기본 비율을 유지하도록 수정

                            return (
                                <Reorder.Item key={section} value={section} className="cursor-grab active:cursor-grabbing">
                                    <div
                                        ref={(el) => { minimapRefs.current[section] = el; }}
                                        className={`
                                        relative overflow-hidden group bg-white
                                        ${activeSection === section
                                                ? 'ring-2 ring-black z-10'
                                                : 'hover:brightness-95'}
                                    `}
                                        style={{
                                            // 높이를 강제하지 않고 이미지 비율에 따름 (이미지가 없으면 minHeight 적용)
                                            // height: currentHeight ? (currentHeight * (200 / previewWidth)) + 'px' : 'auto',
                                            height: 'auto',
                                            minHeight: '40px'
                                        }}
                                        onClick={() => handleMinimapClick(section)}
                                    >
                                        <div className="w-full bg-white flex items-center justify-center relative">
                                            {getPreviewImage(section) && !imgErrors[section] ? (
                                                <img
                                                    src={getPreviewImage(section)!}
                                                    alt={section}
                                                    className="w-full h-auto block" // object-cover -> h-auto block to preserve aspect ratio
                                                    onError={() => handleImgError(section)}
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center w-full h-full bg-gray-50 border border-gray-100">
                                                    <span className="text-[10px] text-gray-300 font-medium tracking-wider uppercase">{getSectionLabel(section)}</span>
                                                </div>
                                            )}
                                            {/* Drop Zone Overlay */}
                                            <div
                                                className="absolute inset-0 z-10"
                                                onDrop={(e) => handleDrop(e, section)}
                                                onDragOver={handleDragOver}
                                            />
                                        </div>

                                        <div className={`
                                        absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-white text-[8px] font-medium text-center
                                        ${activeSection === section ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                                        transition-opacity duration-200 pointer-events-none backdrop-blur-[2px]
                                    `}>
                                            {getSectionLabel(section)}
                                        </div>
                                    </div>
                                </Reorder.Item>
                            );
                        })}
                    </Reorder.Group>

                    {onAddSection && (
                        <button
                            onClick={onAddSection}
                            className="w-full mt-2 aspect-square rounded border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 hover:bg-gray-50 transition-all gap-1"
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
