import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import html2canvas from 'html2canvas';

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
    // 섹션별 캡처 이미지 저장
    const [sectionCaptures, setSectionCaptures] = useState<{ [key: string]: string }>({});
    const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => { setImgErrors({}); }, [data?.imageUrls]);

    // 프리뷰어 섹션을 html2canvas로 캡처
    const captureSection = useCallback(async (sectionId: string) => {
        if (!previewRef?.current) return;

        const sectionEl = previewRef.current.querySelector(`[data-section="${sectionId}"]`) as HTMLElement;
        if (!sectionEl) return;

        try {
            const canvas = await html2canvas(sectionEl, {
                scale: 0.3, // 축소 비율
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            setSectionCaptures(prev => ({ ...prev, [sectionId]: dataUrl }));
        } catch (e) {
            console.warn('Section capture failed:', sectionId, e);
        }
    }, [previewRef]);

    // 데이터 변경 시 모든 섹션 캡처 (디바운스)
    useEffect(() => {
        if (captureTimeoutRef.current) {
            clearTimeout(captureTimeoutRef.current);
        }

        captureTimeoutRef.current = setTimeout(() => {
            sectionOrder.forEach(section => {
                captureSection(section);
            });
        }, 500); // 500ms 디바운스

        return () => {
            if (captureTimeoutRef.current) {
                clearTimeout(captureTimeoutRef.current);
            }
        };
    }, [sectionOrder, data, captureSection]);

    const getSectionLabel = (section: string) => {
        if (section === 'hero') return '히어로';
        if (section === 'products') return '제품';
        if (section === 'models') return '모델';
        if (section === 'closeups') return '디테일';
        if (section.startsWith('size-guide')) return '사이즈';
        if (section.startsWith('precautions')) return '주의사항';
        if (section.startsWith('as-info')) return 'A/S';
        if (section.startsWith('beautified')) return '제품';
        if (section.startsWith('model-cut')) return '모델';
        if (section.startsWith('closeup')) return '클로즈업';
        if (section.startsWith('product')) return '제품';
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
                    // 즉시 재캡처
                    setTimeout(() => captureSection(section), 100);
                }
            };
            reader.readAsDataURL(file);
        }
    }, [onAction, captureSection]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

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
                        {sectionOrder.filter((section: string) => {
                            // Hide sections based on visibility flags
                            if (section.startsWith('size-guide') && data.showSizeGuide === false) return false;
                            if (section.startsWith('as-info') && data.showASInfo === false) return false;
                            if (section.startsWith('precautions') && data.showPrecautions === false) return false;
                            return true;
                        }).map((section: string) => (
                            <Reorder.Item key={section} value={section} className="cursor-grab active:cursor-grabbing">
                                <div
                                    ref={(el) => { minimapRefs.current[section] = el; }}
                                    style={{ background: colors.bgSurface, border: activeSection === section ? `2px solid ${colors.accentPrimary}` : 'none', minHeight: 40 }}
                                    className="relative overflow-hidden group"
                                    onClick={() => handleMinimapClick(section)}
                                >
                                    <div className="w-full flex items-center justify-center relative">
                                        {/* 캡처된 섹션 이미지 표시 (프리뷰어 축소판) */}
                                        {sectionCaptures[section] ? (
                                            <img
                                                src={sectionCaptures[section]}
                                                alt={section}
                                                className="w-full h-auto block"
                                                style={{ minHeight: 30 }}
                                            />
                                        ) : (
                                            <div style={{ background: '#ffffff', border: `1px solid ${colors.borderSoft}` }} className="flex items-center justify-center w-full py-6">
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
                        <button onClick={onAddSection} style={{ width: '100%', marginTop: 8, aspectRatio: '1', borderRadius: 8, border: `2px dashed ${colors.borderSoft}`, color: colors.textMuted, background: '#ffffff' }} className="flex flex-col items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-all gap-1">
                            <span style={{ fontSize: 20, fontWeight: 300 }}>+</span>
                            <span style={{ fontSize: 10, fontWeight: 500 }}>Add</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
