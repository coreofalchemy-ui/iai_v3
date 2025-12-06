import React, { useRef, useCallback, useState } from 'react';
import { Reorder } from 'framer-motion';

const colors = { bgBase: '#F5F5F7', bgSurface: '#FFFFFF', bgSubtle: '#F0F0F4', borderSoft: '#E2E2E8', textPrimary: '#111111', textSecondary: '#6E6E73', textMuted: '#A1A1AA', accentPrimary: '#111111' };

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
    sectionOrder, onReorder, activeSection, onSectionClick, data, onAddSection, previewRef,
    onAction, isHoldOn = true, onToggleHoldMode, sectionHeights, previewWidth = 1000
}) => {
    const minimapRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const [imgErrors, setImgErrors] = useState<{ [key: string]: boolean }>({});
    const [minimapScale, setMinimapScale] = useState(1);

    React.useEffect(() => { setImgErrors({}); }, [data?.imageUrls]);

    const getPreviewImage = (section: string) => {
        const directUrl = data?.imageUrls?.[section];
        if (typeof directUrl === 'string' && directUrl !== 'loading' && directUrl !== 'SPACER') return directUrl;
        if (typeof directUrl === 'object' && directUrl !== null) {
            if (directUrl.url) return directUrl.url;
            if (Array.isArray(directUrl) && directUrl.length > 0) {
                const firstItem = directUrl[0];
                if (typeof firstItem === 'string') return firstItem;
                if (firstItem?.url) return firstItem.url;
            }
        }
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
            if (sectionElement) sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleDrop = useCallback((e: React.DragEvent, section: string) => {
        e.preventDefault(); e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageUrl = event.target?.result as string;
                if (onAction && imageUrl) {
                    onAction('updateImage', section, 0, imageUrl);
                    setImgErrors(prev => ({ ...prev, [section]: false }));
                }
            };
            reader.readAsDataURL(file);
        }
    }, [onAction]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleImgError = (section: string) => { setImgErrors(prev => ({ ...prev, [section]: true })); };

    return (
        <div className="h-full flex flex-col" style={{ background: colors.bgSurface, fontFamily: '-apple-system, sans-serif' }}>
            <div style={{ padding: 10, borderBottom: `1px solid ${colors.borderSoft}` }} className="flex items-center justify-between">
                <span style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase">Minimap</span>
                {onToggleHoldMode && (
                    <button onClick={onToggleHoldMode} style={{ width: 32, height: 16, borderRadius: 8, background: isHoldOn ? colors.accentPrimary : colors.borderSoft, position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 2, left: isHoldOn ? 18 : 2, width: 12, height: 12, background: '#FFF', borderRadius: 6, transition: 'left 0.2s' }} />
                    </button>
                )}
            </div>

            {/* 줌 컨트롤 */}
            <div style={{ padding: '6px 10px', borderBottom: `1px solid ${colors.borderSoft}` }} className="flex items-center justify-center gap-1">
                <button onClick={() => setMinimapScale(prev => Math.max(0.3, prev - 0.1))} style={{ width: 20, height: 20, color: colors.textSecondary, fontSize: 14 }} className="flex items-center justify-center hover:bg-gray-100 rounded">−</button>
                <span style={{ fontSize: 9, fontWeight: 600, color: colors.textSecondary, minWidth: 35, textAlign: 'center' }}>{Math.round(minimapScale * 100)}%</span>
                <button onClick={() => setMinimapScale(prev => Math.min(1.5, prev + 0.1))} style={{ width: 20, height: 20, color: colors.textSecondary, fontSize: 14 }} className="flex items-center justify-center hover:bg-gray-100 rounded">+</button>
                <button onClick={() => setMinimapScale(0.5)} style={{ padding: '2px 4px', fontSize: 8, fontWeight: 600, color: colors.textSecondary }} className="hover:bg-gray-100 rounded">전체</button>
            </div>

            <div style={{ background: colors.bgBase }} className="flex-grow overflow-auto p-3 custom-scrollbar">
                <div style={{ transform: `scale(${minimapScale})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}>
                    <Reorder.Group axis="y" values={sectionOrder} onReorder={onReorder} style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.1)', borderRadius: 8, overflow: 'hidden' }} className="flex flex-col">
                        {sectionOrder.map((section: string) => (
                            <Reorder.Item key={section} value={section} className="cursor-grab active:cursor-grabbing">
                                <div
                                    ref={(el) => { minimapRefs.current[section] = el; }}
                                    style={{ background: colors.bgSurface, border: activeSection === section ? `2px solid ${colors.accentPrimary}` : 'none', minHeight: 40 }}
                                    className="relative overflow-hidden group"
                                    onClick={() => handleMinimapClick(section)}
                                >
                                    <div className="w-full flex items-center justify-center relative">
                                        {getPreviewImage(section) && !imgErrors[section] ? (
                                            <img src={getPreviewImage(section)!} alt={section} className="w-full h-auto block" onError={() => handleImgError(section)} />
                                        ) : (
                                            <div style={{ background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}` }} className="flex items-center justify-center w-full h-full py-4">
                                                <span style={{ fontSize: 10, color: colors.textMuted, fontWeight: 500, letterSpacing: '0.06em' }} className="uppercase">{getSectionLabel(section)}</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 z-10" onDrop={(e) => handleDrop(e, section)} onDragOver={handleDragOver} />
                                    </div>
                                    <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} className={`absolute bottom-0 left-0 right-0 p-1 text-white text-[8px] font-medium text-center ${activeSection === section ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity pointer-events-none`}>
                                        {getSectionLabel(section)}
                                    </div>
                                </div>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>

                    {onAddSection && (
                        <button onClick={onAddSection} style={{ width: '100%', marginTop: 8, aspectRatio: '1', borderRadius: 8, border: `2px dashed ${colors.borderSoft}`, color: colors.textMuted }} className="flex flex-col items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-all gap-1">
                            <span style={{ fontSize: 20, fontWeight: 300 }}>+</span>
                            <span style={{ fontSize: 10, fontWeight: 500 }}>Add</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
