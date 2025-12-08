import React, { useState, useRef } from 'react';
import { generateAICopywriting } from '../services/geminiAICopywriter';
import { batchReplaceShoes, fileToDataUrl } from '../services/shoeReplacementService';
import { batchRemoveBackground } from '../services/backgroundRemovalService';
import ModelChapterPanel from './ModelChapterPanel';
import ProductEnhancementPanel from './ProductEnhancementPanel';
import ContentGeneratorPanel from './ContentGeneratorPanel';
import { TextElement } from './PreviewRenderer';
import { FieldToggleControl } from './FieldToggleControl';
import { FilterPresetName } from '../services/photoFilterService';

// 선 요소 타입
export interface LineElement {
    id: string;
    sectionId: string;
    type: 'straight' | 'curved' | 'angled';
    strokeWidth: number;
    strokeColor: string;
    lineCap: 'round' | 'square' | 'butt';
    lineEnd: 'none' | 'arrow';
}

// 그리드 섹션 타입
export interface GridSection {
    id: string;
    cols: number;
    rows: number;
    height: number;
    cells: (string | null)[];
}

interface AdjustmentPanelProps {
    data: any;
    onUpdate: (newData: any) => void;
    showAIAnalysis?: boolean;
    onToggleAIAnalysis?: () => void;
    onAddSection?: () => void;
    activeSection?: string;
    textElements?: TextElement[];
    onAddTextElement?: (text: TextElement) => void;
    onUpdateTextElement?: (id: string, prop: keyof TextElement, value: any) => void;
    onDeleteTextElement?: (id: string) => void;
    onAddSpacerSection?: () => void;
    onAddSectionWithImage?: (imageUrl: string, sectionName?: string) => void;
    lineElements?: LineElement[];
    onAddLineElement?: (line: LineElement) => void;
    onDeleteLineElement?: (id: string) => void;
    onAddGridSection?: (grid: GridSection) => void;
    heldSections?: Set<string>;
    activeFilter?: FilterPresetName;
    onFilterChange?: (filter: FilterPresetName) => void;
    sectionHeights?: { [key: string]: number };
    onUpdateHeights?: (key: string, height: number) => void;
    onSetActiveSection?: (section: string) => void;
}

type Section = 'hero' | 'products' | 'models' | 'contents' | 'closeup';

const HERO_FIELDS = [
    { id: 'brandLine', label: 'Brand / Line', labelKo: '브랜드 / 라인', defaultSize: 12 },
    { id: 'productName', label: 'Product Name', labelKo: '상품명', defaultSize: 32 },
    { id: 'subName', label: 'Sub Name', labelKo: '서브명', defaultSize: 18 },
    { id: 'stylingMatch', label: 'Styling Match', labelKo: '스타일링', defaultSize: 14, multiline: true },
    { id: 'craftsmanship', label: 'Craftsmanship', labelKo: '제작 공정', defaultSize: 14, multiline: true },
    { id: 'technology', label: 'Technology', labelKo: '테크놀로지', defaultSize: 14 },
    { id: 'productSpec', label: 'Product Spec', labelKo: '제품 스펙', defaultSize: 13, isSpec: true },
    { id: 'heightSpec', label: 'Height Spec', labelKo: '키높이 스펙', defaultSize: 16, isHeightSpec: true },
    { id: 'sizeGuide', label: 'Size Guide', labelKo: '사이즈 가이드', defaultSize: 14, multiline: true },
];

const DEFAULT_FIELD_SETTINGS: Record<string, { visible: boolean; fontSize: number }> = {};
HERO_FIELDS.forEach(f => { DEFAULT_FIELD_SETTINGS[f.id] = { visible: true, fontSize: f.defaultSize }; });
const DEFAULT_FIELD_ORDER = HERO_FIELDS.map(f => f.id);

const generateStandaloneHeroHTML = (data: any): string => {
    const content = data.heroTextContent || {};
    const settings = data.heroFieldSettings || DEFAULT_FIELD_SETTINGS;
    const order = data.heroFieldOrder || DEFAULT_FIELD_ORDER;
    const isVisible = (field: string) => settings[field]?.visible !== false;
    const getFontSize = (field: string) => settings[field]?.fontSize || 14;
    const renderField = (fieldId: string): string => {
        if (!isVisible(fieldId)) return '';
        switch (fieldId) {
            case 'brandLine': return `<div style="font-size:${getFontSize('brandLine')}px;letter-spacing:1px;color:#888;margin-bottom:8px;font-weight:500;">${content.brandLine || ''}</div>`;
            case 'productName': return `<h1 style="font-size:${getFontSize('productName')}px;font-weight:800;margin:0 0 16px 0;line-height:1.2;">${content.productName || ''}${isVisible('subName') && content.subName ? ` <span style="font-weight:300;color:#ccc;">—</span> <span style="color:#666;font-size:${getFontSize('subName')}px;">${content.subName}</span>` : ''}</h1>`;
            case 'stylingMatch': return content.stylingMatch ? `<div style="margin-bottom:12px;font-size:${getFontSize('stylingMatch')}px;line-height:1.7;color:#444;">${content.stylingMatch}</div>` : '';
            case 'craftsmanship': return content.craftsmanship ? `<div style="margin-bottom:16px;font-size:${getFontSize('craftsmanship')}px;line-height:1.7;color:#444;">${content.craftsmanship}</div>` : '';
            case 'technology': return content.technology ? `<div style="background:#f9fafb;border-left:4px solid #111;padding:16px;margin-bottom:16px;border-radius:0 8px 8px 0;"><h3 style="margin:0 0 8px 0;font-size:14px;font-weight:700;color:#111;">Technology</h3><p style="margin:0;font-size:${getFontSize('technology')}px;color:#555;line-height:1.6;">${content.technology}</p></div>` : '';
            case 'productSpec': return `<div style="margin-bottom:16px;"><h3 style="font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:12px;text-transform:uppercase;color:#111;">Product Spec</h3><table style="width:100%;border-collapse:collapse;font-size:${getFontSize('productSpec')}px;border-top:2px solid #eee;"><tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;width:80px;">Color</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-weight:500;">${content.specColor || '-'}</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;width:80px;">Upper</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-weight:500;">${content.specUpper || '-'}</td></tr><tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;">Lining</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-weight:500;">${content.specLining || '-'}</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;">Outsole</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-weight:500;">${content.specOutsole || '-'}</td></tr><tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;">Origin</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-weight:500;">${content.specOrigin || '-'}</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;">굽 높이</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-weight:500;">${content.heelHeight || '-'}</td></tr></table></div>`;
            case 'heightSpec': return `<div style="margin-bottom:16px;"><h3 style="font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:12px;text-transform:uppercase;color:#111;border-bottom:2px solid #111;padding-bottom:4px;display:inline-block;">Height Spec</h3><table style="width:100%;border:1px solid #e5e7eb;border-radius:12px;border-collapse:separate;"><tr><td style="text-align:center;padding:20px;width:33%;"><div style="font-size:11px;color:#6b7280;margin-bottom:4px;">아웃솔 (Outsole)</div><div style="font-weight:700;font-size:${getFontSize('heightSpec')}px;color:#111;">${content.outsole || '3'} CM</div></td><td style="text-align:center;padding:20px;width:33%;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;"><div style="font-size:11px;color:#6b7280;margin-bottom:4px;">인솔 (Insole)</div><div style="font-weight:700;font-size:${getFontSize('heightSpec')}px;color:#111;">${content.insole || '1.5'} CM</div></td><td style="text-align:center;padding:20px;width:33%;"><div style="font-size:11px;color:#ef4444;margin-bottom:4px;font-weight:600;">총 키높이 (Total)</div><div style="font-weight:800;font-size:${getFontSize('heightSpec') + 2}px;color:#ef4444;">${content.totalHeight || '4.5'} CM</div></td></tr></table></div>`;
            case 'sizeGuide': return content.sizeGuide ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;display:flex;align-items:flex-start;"><div style="background:#ef4444;color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;font-size:11px;">✓</div><div><h3 style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#ef4444;text-transform:uppercase;">Size Guide</h3><p style="margin:0;font-size:${getFontSize('sizeGuide')}px;line-height:1.5;color:#4b5563;">${content.sizeGuide.replace(/\n/g, '<br>')}</p></div></div>` : '';
            default: return '';
        }
    };
    const fieldsHtml = order.map((id: string) => renderField(id)).filter(Boolean).join('\n    ');
    return `<!-- 상품 상세 설명 HTML -->\n<div style="max-width:860px;margin:0 auto;padding:20px;font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333;line-height:1.6;">\n    ${fieldsHtml}\n</div>`;
};

// 슬라이더 스타일 컴포넌트 - 얇은 흰 줄 + 테두리만 있는 동그라미
const SliderStyles = () => (
    <style>{`
        .minimal-slider {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            width: 100%;
            height: 1px;
            background: transparent !important;
            background-color: transparent !important;
            border: none !important;
            border-radius: 0;
            outline: none;
            cursor: pointer;
            margin: 10px 0;
            padding: 0;
            box-shadow: none !important;
        }
        .minimal-slider::-webkit-slider-container {
            background: transparent !important;
        }
        .minimal-slider::-webkit-slider-runnable-track {
            height: 1px;
            background: #666;
            border: none;
            border-radius: 0;
        }
        .minimal-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 10px;
            height: 10px;
            background: transparent;
            border-radius: 50%;
            cursor: pointer;
            border: 1.5px solid #ccc;
            box-sizing: border-box;
            margin-top: -5px;
        }
        .minimal-slider::-webkit-slider-thumb:hover {
            background: rgba(255,255,255,0.1);
        }
        .minimal-slider::-moz-range-thumb {
            width: 10px;
            height: 10px;
            background: transparent;
            border-radius: 50%;
            cursor: pointer;
            border: 1.5px solid #ccc;
            box-sizing: border-box;
        }
        .minimal-slider::-moz-range-track {
            height: 1px;
            background: #666;
            border: none;
            border-radius: 0;
        }
        .minimal-slider::-moz-range-progress {
            background: transparent;
        }
        .minimal-slider:focus {
            outline: none;
        }
    `}</style>
);

export default function AdjustmentPanel({ data, onUpdate, activeSection: previewActiveSection, textElements = [], onAddTextElement, onUpdateTextElement, onDeleteTextElement, onAddSectionWithImage, lineElements = [], onAddLineElement, onDeleteLineElement, onAddGridSection, heldSections, activeFilter, onFilterChange }: AdjustmentPanelProps) {
    const [activeSection, setActiveSection] = useState<Section>('hero');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
    const [draggedField, setDraggedField] = useState<string | null>(null);
    const [selectedProductIndex, setSelectedProductIndex] = useState<number>(0);
    const [productDragActive, setProductDragActive] = useState(false);
    const [isReplacingShoes, setIsReplacingShoes] = useState(false);
    const [replaceProgress, setReplaceProgress] = useState({ current: 0, total: 0 });
    const productInputRef = useRef<HTMLInputElement>(null);
    const [isRemovingBg, setIsRemovingBg] = useState(false);
    const [bgRemoveProgress, setBgRemoveProgress] = useState({ current: 0, total: 0 });
    const [lang, setLang] = useState<'ko' | 'en'>('ko');

    // AI 생성 이미지 및 다수 선택 상태
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [selectedUploadedIndices, setSelectedUploadedIndices] = useState<Set<number>>(new Set());
    const [selectedGeneratedIndices, setSelectedGeneratedIndices] = useState<Set<number>>(new Set());

    // 선 추가 상태
    const [lineType, setLineType] = useState<'straight' | 'curved' | 'angled'>('straight');
    const [lineWidth, setLineWidth] = useState(2);
    const [lineCap, setLineCap] = useState<'round' | 'square' | 'butt'>('round');
    const [lineEnd, setLineEnd] = useState<'none' | 'arrow'>('none');
    const [lineColor, setLineColor] = useState('#000000');

    // 그리드 상태
    const [gridCols, setGridCols] = useState(2);
    const [gridRows, setGridRows] = useState(2);
    const [gridHeight, setGridHeight] = useState(400);

    // 디테일 패널 섹션 접기 상태
    const [collapsedSections, setCollapsedSections] = useState<{
        grid: boolean;
        transition: boolean;
        aiAnalysis: boolean;
        sizeGuide: boolean;
        asInfo: boolean;
        precautions: boolean;
    }>({
        grid: false,
        transition: false,
        aiAnalysis: false,
        sizeGuide: false,
        asInfo: false,
        precautions: false
    });

    const toggleSection = (section: keyof typeof collapsedSections) => {
        const newCollapsed = !collapsedSections[section];
        setCollapsedSections(prev => ({ ...prev, [section]: newCollapsed }));

        // 프리뷰 visibility와 동기화 (접으면 숨김, 펼치면 표시)
        if (section === 'sizeGuide') {
            onUpdate({ ...data, showSizeGuide: !newCollapsed });
        } else if (section === 'asInfo') {
            onUpdate({ ...data, showASInfo: !newCollapsed });
        } else if (section === 'precautions') {
            onUpdate({ ...data, showPrecautions: !newCollapsed });
        }
    };

    const fieldSettings = data.heroFieldSettings || DEFAULT_FIELD_SETTINGS;
    const fieldOrder = data.heroFieldOrder || DEFAULT_FIELD_ORDER;
    const productFiles = data.productFiles || [];

    const updateHeroContent = (field: string, value: string) => {
        onUpdate({ ...data, heroTextContent: { ...data.heroTextContent, [field]: value } });
    };
    const updateFieldSetting = (field: string, setting: 'visible' | 'fontSize', value: boolean | number) => {
        onUpdate({ ...data, heroFieldSettings: { ...fieldSettings, [field]: { ...fieldSettings[field], [setting]: value } } });
    };
    const handleDragStart = (fieldId: string) => (e: React.DragEvent) => { setDraggedField(fieldId); e.dataTransfer.effectAllowed = 'move'; };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
    const handleDrop = (targetFieldId: string) => (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggedField || draggedField === targetFieldId) return;
        const newOrder = [...fieldOrder];
        const draggedIdx = newOrder.indexOf(draggedField);
        const targetIdx = newOrder.indexOf(targetFieldId);
        if (draggedIdx !== -1 && targetIdx !== -1) { newOrder.splice(draggedIdx, 1); newOrder.splice(targetIdx, 0, draggedField); onUpdate({ ...data, heroFieldOrder: newOrder }); }
        setDraggedField(null);
    };

    const handleAIAnalysis = async () => {
        setIsGeneratingAI(true);
        try {
            const productFile = productFiles[0];
            if (!productFile) { alert('제품 이미지가 없습니다.'); return; }
            const productImage = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target?.result as string); reader.onerror = reject; reader.readAsDataURL(productFile); });
            const aiCopy = await generateAICopywriting(productImage);

            // Auto-add detail sections if they don't exist
            const sectionsToAdd = ['size-guide', 'as-info', 'precautions'];
            let newSectionOrder = [...(data.sectionOrder || [])];
            let orderChanged = false;

            sectionsToAdd.forEach(section => {
                if (!newSectionOrder.includes(section)) {
                    newSectionOrder.push(section);
                    orderChanged = true;
                }
            });

            onUpdate({
                ...data,
                heroTextContent: { ...data.heroTextContent, ...aiCopy },
                sectionOrder: orderChanged ? newSectionOrder : data.sectionOrder
            });
        } catch (error) { console.error('AI 분석 실패:', error); alert('AI 분석에 실패했습니다.'); }
        finally { setIsGeneratingAI(false); }
    };

    const handleProductDragOver = (e: React.DragEvent) => { e.preventDefault(); setProductDragActive(true); };
    const handleProductDragLeave = () => setProductDragActive(false);

    // 🔒 단순화된 업로드 로직 - Map으로 중복 제거
    const handleProductDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setProductDragActive(false);

        const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (droppedFiles.length === 0) return;

        // Map을 사용하여 중복 제거 (key: name+size)
        const fileMap = new Map<string, File>();

        // 기존 파일 먼저 추가
        productFiles.forEach((f: File) => fileMap.set(`${f.name}_${f.size}`, f));

        // 새 파일 추가 (중복이면 덮어쓰지 않음)
        droppedFiles.forEach(f => {
            const key = `${f.name}_${f.size}`;
            if (!fileMap.has(key)) {
                fileMap.set(key, f);
            }
        });

        const finalFiles = Array.from(fileMap.values()).slice(0, 10);
        console.log('[Drop] 최종 파일 수:', finalFiles.length);
        onUpdate({ ...data, productFiles: finalFiles });
    };

    const handleProductFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
        if (selectedFiles.length === 0) {
            e.target.value = '';
            return;
        }

        // Map을 사용하여 중복 제거 (key: name+size)
        const fileMap = new Map<string, File>();

        // 기존 파일 먼저 추가
        productFiles.forEach((f: File) => fileMap.set(`${f.name}_${f.size}`, f));

        // 새 파일 추가 (중복이면 덮어쓰지 않음)
        selectedFiles.forEach(f => {
            const key = `${f.name}_${f.size}`;
            if (!fileMap.has(key)) {
                fileMap.set(key, f);
            }
        });

        const finalFiles = Array.from(fileMap.values()).slice(0, 10);
        console.log('[Select] 최종 파일 수:', finalFiles.length);
        onUpdate({ ...data, productFiles: finalFiles });

        e.target.value = '';
    };

    const removeProductFile = (index: number) => {
        const newFiles = [...productFiles];
        newFiles.splice(index, 1);
        onUpdate({ ...data, productFiles: newFiles });
        if (selectedProductIndex >= newFiles.length) setSelectedProductIndex(Math.max(0, newFiles.length - 1));
    };

    const handleShoeReplacement = async () => {
        const selectedFile = productFiles[selectedProductIndex];
        if (!selectedFile) { alert('교체할 제품 이미지를 선택하세요.'); return; }
        const allImageUrls: string[] = [];
        Object.entries(data.imageUrls || {}).forEach(([key, value]) => {
            if (key !== 'products' && typeof value === 'string' && value.startsWith('data:')) {
                allImageUrls.push(value);
            }
        });
        if (allImageUrls.length === 0) { alert('프리뷰에 이미지가 없습니다.'); return; }
        setIsReplacingShoes(true);
        setReplaceProgress({ current: 0, total: allImageUrls.length });
        try {
            const reader = new FileReader();
            reader.readAsDataURL(selectedFile);
            await new Promise(resolve => reader.onload = resolve);
            const productImage = reader.result as string;
            const results = await batchReplaceShoes(allImageUrls, productImage, (current: number, total: number, msg?: string) => setReplaceProgress({ current, total }));
            const newImageUrls = { ...data.imageUrls };
            let successCount = 0;
            results.forEach((result: { success: boolean; url: string }, idx: number) => {
                if (result.success && result.url) {
                    Object.entries(newImageUrls).forEach(([key, url]) => {
                        if (url === allImageUrls[idx]) { newImageUrls[key] = result.url; successCount++; }
                    });
                }
            });
            if (successCount > 0) { onUpdate({ ...data, imageUrls: newImageUrls }); alert(`${successCount}개 이미지의 신발이 교체되었습니다.`); }
            else { alert('신발 교체에 실패했습니다.'); }
        } catch (error) { console.error('신발 교체 오류:', error); alert('신발 교체 중 오류가 발생했습니다.'); }
        finally { setIsReplacingShoes(false); setReplaceProgress({ current: 0, total: 0 }); }
    };

    const handleAddText = () => {
        if (!onAddTextElement) return;
        const newText: TextElement = { id: `text-${Date.now()}`, sectionId: previewActiveSection || 'hero', content: '텍스트를 입력하세요', top: 50, left: 50, width: 200, height: 50, fontSize: 16, fontFamily: 'Noto Sans KR', color: '#000000', fontWeight: 'normal', textAlign: 'left' };
        onAddTextElement(newText);
        setSelectedTextId(newText.id);
    };

    // 선 추가 핸들러
    const handleAddLine = () => {
        if (!onAddLineElement) {
            alert('선 추가 기능이 준비 중입니다.');
            return;
        }
        const newLine: LineElement = {
            id: `line-${Date.now()}`,
            sectionId: previewActiveSection || 'hero',
            type: lineType,
            strokeWidth: lineWidth,
            strokeColor: lineColor,
            lineCap: lineCap,
            lineEnd: lineEnd
        };
        onAddLineElement(newLine);
    };

    // 그리드 섹션 추가 핸들러
    const handleAddGrid = () => {
        if (!onAddGridSection) {
            alert('그리드 추가 기능이 준비 중입니다.');
            return;
        }
        const newGrid: GridSection = {
            id: `grid-${Date.now()}`,
            cols: gridCols,
            rows: gridRows,
            height: gridHeight,
            cells: Array(gridCols * gridRows).fill(null)
        };
        onAddGridSection(newGrid);
    };

    const selectedText = textElements.find(t => t.id === selectedTextId);

    const renderField = (fieldDef: typeof HERO_FIELDS[0]) => {
        const { id, label, labelKo, defaultSize, multiline, isSpec, isHeightSpec } = fieldDef;
        const displayLabel = lang === 'ko' ? labelKo : label;
        const isVisible = fieldSettings[id]?.visible !== false;
        const fontSize = fieldSettings[id]?.fontSize || defaultSize;

        if (isSpec) {
            return (
                <FieldToggleControl key={id} fieldId={id} label={displayLabel} isVisible={isVisible} onToggleVisibility={() => updateFieldSetting(id, 'visible', !isVisible)} fontSize={fontSize} onFontSizeChange={(size: number) => updateFieldSetting(id, 'fontSize', size)} draggable onDragStart={handleDragStart(id)} onDragOver={handleDragOver} onDrop={handleDrop(id)}>
                    <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '컬러' : 'Color'}</label><input className="w-full bg-[#F0F0F4] border border-[#E2E2E8] rounded px-2 py-1 text-[11px] text-[#111] focus:border-[#111] focus:outline-none" value={data.heroTextContent?.specColor || ''} onChange={(e) => updateHeroContent('specColor', e.target.value)} /></div>
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '갑피' : 'Upper'}</label><input className="w-full bg-[#F0F0F4] border border-[#E2E2E8] rounded px-2 py-1 text-[11px] text-[#111] focus:border-[#111] focus:outline-none" value={data.heroTextContent?.specUpper || ''} onChange={(e) => updateHeroContent('specUpper', e.target.value)} /></div>
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '안감' : 'Lining'}</label><input className="w-full bg-[#F0F0F4] border border-[#E2E2E8] rounded px-2 py-1 text-[11px] text-[#111] focus:border-[#111] focus:outline-none" value={data.heroTextContent?.specLining || ''} onChange={(e) => updateHeroContent('specLining', e.target.value)} /></div>
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '밑창' : 'Outsole'}</label><input className="w-full bg-[#F0F0F4] border border-[#E2E2E8] rounded px-2 py-1 text-[11px] text-[#111] focus:border-[#111] focus:outline-none" value={data.heroTextContent?.specOutsole || ''} onChange={(e) => updateHeroContent('specOutsole', e.target.value)} /></div>
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '원산지' : 'Origin'}</label><input className="w-full bg-[#F0F0F4] border border-[#E2E2E8] rounded px-2 py-1 text-[11px] text-[#111] focus:border-[#111] focus:outline-none" value={data.heroTextContent?.specOrigin || ''} onChange={(e) => updateHeroContent('specOrigin', e.target.value)} /></div>
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '굽높이' : 'Heel'}</label><input className="w-full bg-[#F0F0F4] border border-[#E2E2E8] rounded px-2 py-1 text-[11px] text-[#111] focus:border-[#111] focus:outline-none" value={data.heroTextContent?.heelHeight || ''} onChange={(e) => updateHeroContent('heelHeight', e.target.value)} /></div>
                    </div>
                </FieldToggleControl>
            );
        }
        if (isHeightSpec) {
            return (
                <FieldToggleControl key={id} fieldId={id} label={displayLabel} isVisible={isVisible} onToggleVisibility={() => updateFieldSetting(id, 'visible', !isVisible)} fontSize={fontSize} onFontSizeChange={(size: number) => updateFieldSetting(id, 'fontSize', size)} draggable onDragStart={handleDragStart(id)} onDragOver={handleDragOver} onDrop={handleDrop(id)}>
                    <div className="grid grid-cols-3 gap-2">
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '아웃솔' : 'Outsole'}</label><input className="w-full bg-[#F0F0F4] border border-[#E2E2E8] rounded px-2 py-1 text-[11px] text-[#111] focus:border-[#111] focus:outline-none" value={data.heroTextContent?.outsole || ''} onChange={(e) => updateHeroContent('outsole', e.target.value)} placeholder="3cm" /></div>
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '인솔' : 'Insole'}</label><input className="w-full bg-[#F0F0F4] border border-[#E2E2E8] rounded px-2 py-1 text-[11px] text-[#111] focus:border-[#111] focus:outline-none" value={data.heroTextContent?.insole || ''} onChange={(e) => updateHeroContent('insole', e.target.value)} placeholder="1.5cm" /></div>
                        <div><label className="text-[12px] text-[#111] mb-0.5 block font-medium">{lang === 'ko' ? '총 높이' : 'Total'}</label><input className="w-full bg-[#FFF] border border-[#E2E2E8] rounded px-2 py-1 text-[11px] text-[#111] font-medium focus:border-[#111] focus:outline-none" value={data.heroTextContent?.totalHeight || ''} onChange={(e) => updateHeroContent('totalHeight', e.target.value)} placeholder="4.5cm" /></div>
                    </div>
                </FieldToggleControl>
            );
        }
        return (
            <FieldToggleControl key={id} fieldId={id} label={displayLabel} isVisible={isVisible} onToggleVisibility={() => updateFieldSetting(id, 'visible', !isVisible)} fontSize={fontSize} onFontSizeChange={(size: number) => updateFieldSetting(id, 'fontSize', size)} draggable onDragStart={handleDragStart(id)} onDragOver={handleDragOver} onDrop={handleDrop(id)}>
                {multiline ? <textarea rows={2} className="w-full bg-[#F0F0F4] border border-[#E2E2E8] rounded px-2 py-1 text-[11px] text-[#111] resize-none focus:border-[#111] focus:outline-none" value={data.heroTextContent?.[id] || ''} onChange={(e) => updateHeroContent(id, e.target.value)} />
                    : <input className="w-full bg-[#F0F0F4] border border-[#E2E2E8] rounded px-2 py-1 text-[11px] text-[#111] focus:border-[#111] focus:outline-none" value={data.heroTextContent?.[id] || ''} onChange={(e) => updateHeroContent(id, e.target.value)} />}
            </FieldToggleControl>
        );
    };

    const orderedFields = fieldOrder.map((id: string) => HERO_FIELDS.find(f => f.id === id)).filter(Boolean);

    const sections = [
        { id: 'hero' as Section, label: lang === 'ko' ? '히어로' : 'Hero' },
        { id: 'products' as Section, label: lang === 'ko' ? '제품' : 'Products' },
        { id: 'models' as Section, label: lang === 'ko' ? '모델' : 'Models' },
        { id: 'contents' as Section, label: lang === 'ko' ? '콘텐츠' : 'Contents' },
        { id: 'closeup' as Section, label: lang === 'ko' ? '디테일' : 'Detail' }
    ];

    const colors = { bgBase: '#F5F5F7', bgSurface: '#FFFFFF', bgSubtle: '#F0F0F4', borderSoft: '#E2E2E8', textPrimary: '#111111', textSecondary: '#6E6E73', textMuted: '#A1A1AA', accentPrimary: '#111111' };

    return (
        <div className="h-full flex flex-col" style={{ background: colors.bgSubtle, fontFamily: '-apple-system, sans-serif', color: colors.textPrimary }}>
            <SliderStyles />
            {/* 헤더 */}
            <div style={{ background: colors.bgSurface, borderBottom: `1px solid ${colors.borderSoft}` }} className="flex-shrink-0 h-10 flex items-center justify-between px-3">
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>Design</span>
                <div style={{ background: colors.bgSubtle, borderRadius: 6, padding: 2 }} className="flex items-center overflow-hidden">
                    <button onClick={() => setLang('ko')} style={{ padding: '4px 8px', fontSize: 11, fontWeight: 500, borderRadius: 4, background: lang === 'ko' ? colors.accentPrimary : 'transparent', color: lang === 'ko' ? '#FFF' : colors.textMuted }}>KR</button>
                    <button onClick={() => setLang('en')} style={{ padding: '4px 8px', fontSize: 11, fontWeight: 500, borderRadius: 4, background: lang === 'en' ? colors.accentPrimary : 'transparent', color: lang === 'en' ? '#FFF' : colors.textMuted }}>EN</button>
                </div>
            </div>

            {/* 탭 */}
            <div style={{ background: colors.bgSurface, borderBottom: `1px solid ${colors.borderSoft}` }} className="flex-shrink-0">
                <nav className="flex">
                    {sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            style={{ flex: 1, padding: '10px 4px', fontSize: 11, fontWeight: 500, transition: 'all 0.15s', background: 'transparent', borderBottom: activeSection === section.id ? `2px solid ${colors.accentPrimary}` : '2px solid transparent', color: activeSection === section.id ? colors.textPrimary : colors.textMuted }}
                        >
                            {section.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* 콘텐츠 */}
            <div className="flex-grow overflow-y-auto p-2">
                {activeSection === 'hero' && (
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[12px] font-medium text-[#999]">{lang === 'ko' ? '히어로 섹션' : 'Hero Section'}</span>
                            <button onClick={handleAIAnalysis} disabled={isGeneratingAI} className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${isGeneratingAI ? 'bg-gray-100 text-gray-400' : 'bg-[#111] text-white hover:bg-black'}`}>
                                {isGeneratingAI ? 'Analyzing...' : 'AI'}
                            </button>
                        </div>
                        {/* 서체 선택 */}
                        <div style={{ background: colors.bgSurface, borderRadius: 10, padding: 10, border: `1px solid ${colors.borderSoft}`, marginBottom: 8 }}>
                            <div className="flex items-center justify-between">
                                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>{lang === 'ko' ? '서체' : 'Font'}</span>
                                <select
                                    value={data.heroFontFamily || 'Noto Sans KR'}
                                    onChange={(e) => onUpdate({ ...data, heroFontFamily: e.target.value })}
                                    style={{
                                        fontSize: 11,
                                        padding: '4px 8px',
                                        borderRadius: 6,
                                        border: `1px solid ${colors.borderSoft}`,
                                        background: colors.bgSubtle,
                                        color: colors.textPrimary,
                                        fontFamily: data.heroFontFamily || 'Noto Sans KR',
                                        minWidth: 140,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="Noto Sans KR" style={{ fontFamily: 'Noto Sans KR' }}>Noto Sans KR</option>
                                    <option value="Noto Serif KR" style={{ fontFamily: 'Noto Serif KR' }}>Noto Serif KR</option>
                                    <option value="Pretendard" style={{ fontFamily: 'Pretendard' }}>Pretendard</option>
                                    <option value="Spoqa Han Sans Neo" style={{ fontFamily: 'Spoqa Han Sans Neo' }}>Spoqa Han Sans</option>
                                    <option value="Roboto" style={{ fontFamily: 'Roboto' }}>Roboto</option>
                                    <option value="Poppins" style={{ fontFamily: 'Poppins' }}>Poppins</option>
                                    <option value="Playfair Display" style={{ fontFamily: 'Playfair Display' }}>Playfair Display</option>
                                    <option value="Montserrat" style={{ fontFamily: 'Montserrat' }}>Montserrat</option>
                                    <option value="Inter" style={{ fontFamily: 'Inter' }}>Inter</option>
                                    <option value="Raleway" style={{ fontFamily: 'Raleway' }}>Raleway</option>
                                </select>
                            </div>
                        </div>
                        {orderedFields.map((fieldDef: any) => renderField(fieldDef))}
                        <button
                            onClick={() => {
                                const heroHtml = generateStandaloneHeroHTML(data);
                                const blob = new Blob([heroHtml], { type: 'text/html' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${data.heroTextContent?.productName || 'hero'}_section.html`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            className="w-full bg-white text-black text-[11px] font-medium py-1 rounded hover:bg-[#e5e5e5] transition-colors mt-2"
                        >
                            {lang === 'ko' ? 'HTML 내보내기' : 'Export HTML'}
                        </button>
                    </div>
                )}

                {activeSection === 'products' && (
                    <div className="space-y-2">
                        {/* 제품 업로드 영역 */}
                        <div
                            style={{ minHeight: 100 }}
                            className={`border border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${productDragActive ? 'border-blue-500 bg-blue-50' : 'border-[#E2E2E8] hover:border-gray-400 bg-white'}`}
                            onDragOver={handleProductDragOver}
                            onDragLeave={handleProductDragLeave}
                            onDrop={handleProductDrop}
                            onClick={() => productInputRef.current?.click()}
                        >
                            <input ref={productInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleProductFileSelect} />
                            <div className="text-[#555] text-xl mb-0.5">+</div>
                            <p className="text-[11px] font-medium text-[#777]">{lang === 'ko' ? '이미지 드롭 또는 클릭' : 'Drop or click'}</p>
                        </div>

                        {/* 분리형 이미지 패널 */}
                        <div className="grid grid-cols-2 gap-2">
                            {/* 왼쪽: 사용자 업로드 이미지 */}
                            <div className="bg-white border border-[#E2E2E8] rounded p-2">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[12px] font-medium text-[#666]">{lang === 'ko' ? '사용자 업로드' : 'User Upload'}</span>
                                    <span className="text-[12px] text-[#999]">{productFiles.length}</span>
                                </div>
                                <div className="grid grid-cols-1 gap-1 min-h-[120px] max-h-[400px] overflow-y-auto">
                                    {productFiles.map((file: File, idx: number) => (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                const newSet = new Set(selectedUploadedIndices);
                                                if (newSet.has(idx)) newSet.delete(idx);
                                                else newSet.add(idx);
                                                setSelectedUploadedIndices(newSet);
                                            }}
                                            className={`relative aspect-square rounded overflow-hidden cursor-pointer ring-2 ${selectedUploadedIndices.has(idx) ? 'ring-white' : 'ring-transparent hover:ring-[#555]'}`}
                                        >
                                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt={`Upload ${idx}`} />
                                            {selectedUploadedIndices.has(idx) && <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center text-black text-[10px]">✓</div>}
                                            <button onClick={(e) => { e.stopPropagation(); removeProductFile(idx); setSelectedUploadedIndices(prev => { const n = new Set(prev); n.delete(idx); return n; }); }} className="absolute top-0.5 right-0.5 bg-black/70 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] hover:bg-red-500">×</button>
                                        </div>
                                    ))}
                                    {productFiles.length === 0 && <div className="text-center text-[10px] text-[#555] py-4">{lang === 'ko' ? '없음' : 'None'}</div>}
                                </div>
                            </div>

                            {/* 오른쪽: AI 생성 이미지 */}
                            <div className="bg-white border border-[#E2E2E8] rounded p-2">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[12px] font-medium text-[#666]">{lang === 'ko' ? 'AI 생성' : 'AI Gen'}</span>
                                    <span className="text-[12px] text-[#999]">{generatedImages.length}</span>
                                </div>
                                <div className="grid grid-cols-1 gap-1 min-h-[120px] max-h-[400px] overflow-y-auto">
                                    {generatedImages.map((url: string, idx: number) => (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                const newSet = new Set(selectedGeneratedIndices);
                                                if (newSet.has(idx)) newSet.delete(idx);
                                                else newSet.add(idx);
                                                setSelectedGeneratedIndices(newSet);
                                            }}
                                            className={`relative aspect-square rounded overflow-hidden cursor-pointer ring-2 ${selectedGeneratedIndices.has(idx) ? 'ring-white' : 'ring-transparent hover:ring-[#555]'}`}
                                        >
                                            <img src={url} className="w-full h-full object-cover" alt={`Generated ${idx}`} />
                                            {selectedGeneratedIndices.has(idx) && <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center text-black text-[10px]">✓</div>}
                                            <div className="absolute top-0.5 right-0.5 flex gap-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `ai_gen_${idx}_${Date.now()}.png`;
                                                        a.click();
                                                    }}
                                                    className="bg-black/70 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] hover:bg-blue-500"
                                                    title="Download"
                                                >
                                                    ↓
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); setGeneratedImages(prev => prev.filter((_, i) => i !== idx)); setSelectedGeneratedIndices(prev => { const n = new Set(prev); n.delete(idx); return n; }); }} className="bg-black/70 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] hover:bg-red-500">×</button>
                                            </div>
                                        </div>
                                    ))}
                                    {generatedImages.length === 0 && <div className="text-center text-[10px] text-[#555] py-4">{lang === 'ko' ? '없음' : 'None'}</div>}
                                </div>
                            </div>
                        </div>

                        {/* 선택된 이미지 수 표시 */}
                        {(selectedUploadedIndices.size > 0 || selectedGeneratedIndices.size > 0) && (
                            <div className="text-[11px] text-[#666] text-center">
                                {lang === 'ko' ? `${selectedUploadedIndices.size + selectedGeneratedIndices.size}개 선택됨` : `${selectedUploadedIndices.size + selectedGeneratedIndices.size} selected`}
                            </div>
                        )}

                        {/* 액션 버튼들 */}
                        <div className="space-y-1.5">
                            <button
                                onClick={async () => {
                                    if (isRemovingBg || productFiles.length === 0) return;
                                    setIsRemovingBg(true);
                                    setBgRemoveProgress({ current: 0, total: productFiles.length });
                                    try {
                                        const base64Images: string[] = [];
                                        for (const file of productFiles) {
                                            const reader = new FileReader();
                                            const base64 = await new Promise<string>((resolve) => { reader.onload = (e) => resolve(e.target?.result as string); reader.readAsDataURL(file); });
                                            base64Images.push(base64);
                                        }
                                        const results = await batchRemoveBackground(base64Images, (current, total) => setBgRemoveProgress({ current, total }));
                                        const successResults = results.filter(r => r.result);
                                        if (successResults.length > 0) {
                                            setGeneratedImages(prev => [...prev, ...successResults.map(r => r.result!)]);
                                        }
                                        alert(`${successResults.length} ${lang === 'ko' ? '배경 제거 완료' : 'removed'}`);
                                    } catch (error) { console.error(error); alert(lang === 'ko' ? '배경 제거 실패' : 'Failed'); }
                                    finally { setIsRemovingBg(false); setBgRemoveProgress({ current: 0, total: 0 }); }
                                }}
                                disabled={isRemovingBg || productFiles.length === 0}
                                className={`w-full py-1.5 text-[11px] font-medium rounded transition-colors ${isRemovingBg || productFiles.length === 0 ? 'bg-gray-100 text-gray-400' : 'bg-[#111] text-white hover:bg-black border border-transparent'}`}
                            >
                                {isRemovingBg ? `${bgRemoveProgress.current}/${bgRemoveProgress.total}` : (lang === 'ko' ? '배경 제거' : 'Remove BG')}
                            </button>

                            <button
                                onClick={() => {
                                    // 선택된 이미지들을 프리뷰에 추가
                                    const selectedUrls: string[] = [];
                                    selectedUploadedIndices.forEach(idx => {
                                        if (productFiles[idx]) {
                                            selectedUrls.push(URL.createObjectURL(productFiles[idx]));
                                        }
                                    });
                                    selectedGeneratedIndices.forEach(idx => {
                                        if (generatedImages[idx]) {
                                            selectedUrls.push(generatedImages[idx]);
                                        }
                                    });
                                    if (selectedUrls.length === 0) {
                                        alert(lang === 'ko' ? '이미지를 선택해주세요' : 'Select images first');
                                        return;
                                    }
                                    selectedUrls.forEach(url => {
                                        onAddSectionWithImage?.(url);
                                    });
                                    setSelectedUploadedIndices(new Set());
                                    setSelectedGeneratedIndices(new Set());
                                }}
                                disabled={selectedUploadedIndices.size === 0 && selectedGeneratedIndices.size === 0}
                                className={`w-full py-2 text-[12px] font-bold rounded transition-colors ${selectedUploadedIndices.size === 0 && selectedGeneratedIndices.size === 0 ? 'bg-[#3c3c3c] text-[#666]' : 'bg-white text-black hover:bg-[#e5e5e5]'}`}
                            >
                                {lang === 'ko' ? '프리뷰 적용' : 'Apply to Preview'} {(selectedUploadedIndices.size + selectedGeneratedIndices.size) > 0 && `(${selectedUploadedIndices.size + selectedGeneratedIndices.size})`}
                            </button>
                        </div>

                        {/* 구분선 */}
                        <div className="border-t border-[#3c3c3c] my-3"></div>

                        {/* 구분선 */}
                        <div className="border-t border-[#3c3c3c] my-3"></div>

                        <ProductEnhancementPanel
                            productFiles={productFiles}
                            previewSections={(() => {
                                const sections: { id: string; url: string }[] = [];
                                if (data.imageUrls) {
                                    Object.entries(data.imageUrls).forEach(([key, url]) => {
                                        // 제품 이미지 섹션만 필터링 ('product-' 접두사로 시작하는 것만)
                                        if (key.startsWith('product-') && typeof url === 'string' && (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:'))) {
                                            sections.push({ id: key, url: url });
                                        }
                                    });
                                }
                                return sections;
                            })()}
                            lang={lang}
                            onUpdatePreview={(sectionId, imageUrl) => {
                                const newImageUrls = { ...data.imageUrls, [sectionId]: imageUrl };
                                onUpdate({ ...data, imageUrls: newImageUrls });
                            }}
                            onResultsUpdate={(results: any) => {
                                const doneResults = results.filter((r: any) => r.status === 'done' && r.url);
                                if (doneResults.length > 0) {
                                    const newUrls = doneResults.map((r: any) => r.url!);
                                    setGeneratedImages(prev => {
                                        const combined = [...prev, ...newUrls];
                                        return Array.from(new Set(combined));
                                    });
                                }
                            }}
                            onAddSectionWithImage={onAddSectionWithImage}
                        />
                    </div>
                )}

                {activeSection === 'models' && (
                    <ModelChapterPanel
                        data={data}
                        onUpdate={onUpdate}
                        lang={lang}
                        heldSections={heldSections}
                        activeFilter={activeFilter}
                        onFilterChange={onFilterChange}
                    />
                )}
                {activeSection === 'contents' && (
                    <ContentGeneratorPanel
                        productImages={productFiles.map((f: File) => URL.createObjectURL(f))}
                        onAddToPreview={onAddSectionWithImage}
                        lang={lang}
                        savedResults={data.contentGenerations || []}
                        onUpdateResults={(results) => onUpdate({ ...data, contentGenerations: results })}
                        onImageGenerated={(url) => {
                            setGeneratedImages(prev => [...prev, url]);
                        }}
                        // Persist source images
                        savedSourceImages={data.imageUrls?.contentSourceImages || []}
                        onUpdateSourceImages={(newImages) => {
                            onUpdate({
                                ...data,
                                imageUrls: {
                                    ...data.imageUrls,
                                    contentSourceImages: newImages
                                }
                            });
                        }}
                    />
                )}

                {activeSection === 'closeup' && (
                    <div className="space-y-2">
                        {/* 텍스트 요소 */}
                        <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                            <div className="flex justify-between items-center mb-2">
                                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>{lang === 'ko' ? '텍스트 요소' : 'Text Elements'}</span>
                                <button onClick={handleAddText} style={{ padding: '4px 8px', background: colors.accentPrimary, color: '#FFF', fontSize: 11, fontWeight: 500, borderRadius: 6 }}>+</button>
                            </div>
                            <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>Active: <span style={{ color: colors.textPrimary }}>{previewActiveSection || 'None'}</span></div>
                            <div className="space-y-1 max-h-[120px] overflow-y-auto">
                                {textElements.map((text: TextElement) => (
                                    <div key={text.id} onClick={() => setSelectedTextId(text.id)} style={{ padding: 8, borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: selectedTextId === text.id ? colors.bgSubtle : 'transparent', border: selectedTextId === text.id ? `1px solid ${colors.accentPrimary}` : '1px solid transparent' }}>
                                        <span style={{ fontSize: 12, maxWidth: 100, color: colors.textPrimary }} className="truncate">{text.content}</span>
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteTextElement?.(text.id); }} style={{ color: colors.textMuted, fontSize: 10 }} className="hover:text-red-400">×</button>
                                    </div>
                                ))}
                                {textElements.length === 0 && <div style={{ textAlign: 'center', color: colors.textMuted, fontSize: 12, padding: 16 }}>{lang === 'ko' ? '텍스트 없음' : 'No text'}</div>}
                            </div>
                            {selectedText && onUpdateTextElement && (
                                <div style={{ borderTop: `1px solid ${colors.borderSoft}`, paddingTop: 10, marginTop: 10 }} className="space-y-1.5">
                                    <textarea style={{ width: '100%', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: colors.textPrimary, resize: 'none' }} rows={2} value={selectedText.content} onChange={(e) => onUpdateTextElement(selectedText.id, 'content', e.target.value)} />
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <input type="number" style={{ width: '100%', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, color: colors.textPrimary }} value={selectedText.fontSize} onChange={(e) => onUpdateTextElement(selectedText.id, 'fontSize', parseInt(e.target.value))} />
                                        <input type="color" style={{ width: '100%', height: 28, background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, cursor: 'pointer' }} value={selectedText.color || '#000000'} onChange={(e) => onUpdateTextElement(selectedText.id, 'color', e.target.value)} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 선 추가 */}
                        <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                            <div className="flex justify-between items-center mb-2">
                                <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>{lang === 'ko' ? '선 추가' : 'Add Line'}</span>
                                <button onClick={handleAddLine} style={{ padding: '4px 8px', background: colors.accentPrimary, color: '#FFF', fontSize: 11, fontWeight: 500, borderRadius: 6 }}>+</button>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <label style={{ fontSize: 11, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '선 종류' : 'Line Type'}</label>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setLineType('straight')}
                                            style={{ flex: 1, padding: '6px 4px', fontSize: 11, borderRadius: 6, background: lineType === 'straight' ? colors.accentPrimary : colors.bgSubtle, color: lineType === 'straight' ? '#FFF' : colors.textSecondary, border: `1px solid ${lineType === 'straight' ? colors.accentPrimary : colors.borderSoft}` }}
                                        >
                                            ─ {lang === 'ko' ? '직선' : 'Straight'}
                                        </button>
                                        <button
                                            onClick={() => setLineType('curved')}
                                            style={{ flex: 1, padding: '6px 4px', fontSize: 11, borderRadius: 6, background: lineType === 'curved' ? colors.accentPrimary : colors.bgSubtle, color: lineType === 'curved' ? '#FFF' : colors.textSecondary, border: `1px solid ${lineType === 'curved' ? colors.accentPrimary : colors.borderSoft}` }}
                                        >
                                            ⌒ {lang === 'ko' ? '곡선' : 'Curved'}
                                        </button>
                                        <button
                                            onClick={() => setLineType('angled')}
                                            style={{ flex: 1, padding: '6px 4px', fontSize: 11, borderRadius: 6, background: lineType === 'angled' ? colors.accentPrimary : colors.bgSubtle, color: lineType === 'angled' ? '#FFF' : colors.textSecondary, border: `1px solid ${lineType === 'angled' ? colors.accentPrimary : colors.borderSoft}` }}
                                        >
                                            └ {lang === 'ko' ? '꺾은선' : 'Angled'}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label style={{ fontSize: 11, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '굵기' : 'Width'}: {lineWidth}px</label>
                                        <input
                                            type="range"
                                            min="1"
                                            max="10"
                                            value={lineWidth}
                                            onChange={(e) => setLineWidth(parseInt(e.target.value))}
                                            className="w-full h-auto cursor-pointer"
                                            style={{ accentColor: colors.accentPrimary }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 11, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '끝선' : 'End Cap'}</label>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => { setLineCap('round'); setLineEnd('none'); }}
                                                style={{ flex: 1, padding: '6px 4px', fontSize: 11, borderRadius: 6, background: lineCap === 'round' && lineEnd === 'none' ? colors.accentPrimary : colors.bgSubtle, color: lineCap === 'round' && lineEnd === 'none' ? '#FFF' : colors.textSecondary, border: `1px solid ${colors.borderSoft}` }}
                                            >●</button>
                                            <button
                                                onClick={() => { setLineCap('square'); setLineEnd('none'); }}
                                                style={{ flex: 1, padding: '6px 4px', fontSize: 11, borderRadius: 6, background: lineCap === 'square' && lineEnd === 'none' ? colors.accentPrimary : colors.bgSubtle, color: lineCap === 'square' && lineEnd === 'none' ? '#FFF' : colors.textSecondary, border: `1px solid ${colors.borderSoft}` }}
                                            >■</button>
                                            <button
                                                onClick={() => setLineEnd('arrow')}
                                                style={{ flex: 1, padding: '6px 4px', fontSize: 11, borderRadius: 6, background: lineEnd === 'arrow' ? colors.accentPrimary : colors.bgSubtle, color: lineEnd === 'arrow' ? '#FFF' : colors.textSecondary, border: `1px solid ${colors.borderSoft}` }}
                                            >→</button>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: 11, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '색상' : 'Color'}</label>
                                    <input
                                        type="color"
                                        value={lineColor}
                                        onChange={(e) => setLineColor(e.target.value)}
                                        style={{ width: '100%', height: 28, background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, cursor: 'pointer' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 그리드/콜라주 추가 */}
                        <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                            <div
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: collapsedSections.grid ? 0 : 10 }}
                                onClick={() => toggleSection('grid')}
                            >
                                <div className="flex items-center gap-2">
                                    <span style={{ fontSize: 10, color: colors.textMuted, transition: 'transform 0.15s' }} className={collapsedSections.grid ? '' : 'rotate-90'}>▶</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>{lang === 'ko' ? '그리드/콜라주' : 'Grid/Collage'}</span>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 600, color: colors.textPrimary }}>{gridCols}×{gridRows}</span>
                            </div>
                            {!collapsedSections.grid && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label style={{ fontSize: 11, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '가로 칸' : 'Columns'}</label>
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4].map(n => (
                                                    <button
                                                        key={n}
                                                        onClick={() => setGridCols(n)}
                                                        style={{ flex: 1, padding: '6px 4px', fontSize: 12, fontWeight: 600, borderRadius: 6, background: n === gridCols ? colors.accentPrimary : colors.bgSubtle, color: n === gridCols ? '#FFF' : colors.textSecondary, border: `1px solid ${n === gridCols ? colors.accentPrimary : colors.borderSoft}` }}
                                                    >
                                                        {n}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 11, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '세로 칸' : 'Rows'}</label>
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4].map(n => (
                                                    <button
                                                        key={n}
                                                        onClick={() => setGridRows(n)}
                                                        style={{ flex: 1, padding: '6px 4px', fontSize: 12, fontWeight: 600, borderRadius: 6, background: n === gridRows ? colors.accentPrimary : colors.bgSubtle, color: n === gridRows ? '#FFF' : colors.textSecondary, border: `1px solid ${n === gridRows ? colors.accentPrimary : colors.borderSoft}` }}
                                                    >
                                                        {n}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleAddGrid}
                                        style={{ width: '100%', padding: '10px', fontSize: 12, fontWeight: 500, borderRadius: 8, background: colors.accentPrimary, color: '#FFF' }}
                                    >
                                        + {lang === 'ko' ? '그리드 섹션 추가' : 'Add Grid Section'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 퀵 트랜지션 섹션 */}
                        <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                            <div
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: collapsedSections.transition ? 0 : 10 }}
                                onClick={() => toggleSection('transition')}
                            >
                                <div className="flex items-center gap-2">
                                    <span style={{ fontSize: 10, color: colors.textMuted, transition: 'transform 0.15s' }} className={collapsedSections.transition ? '' : 'rotate-90'}>▶</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>{lang === 'ko' ? '트랜지션 효과' : 'Transition Effects'}</span>
                                </div>
                                <label className="flex items-center gap-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={data.enableTransitions !== false}
                                        onChange={(e) => onUpdate({ ...data, enableTransitions: e.target.checked })}
                                        className="w-3 h-3 rounded"
                                        style={{ accentColor: colors.accentPrimary }}
                                    />
                                    <span style={{ fontSize: 10, color: colors.textMuted }}>{lang === 'ko' ? '활성화' : 'Enable'}</span>
                                </label>
                            </div>
                            {!collapsedSections.transition && data.enableTransitions !== false && (
                                <div className="space-y-2">
                                    <div>
                                        <label style={{ fontSize: 11, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '효과 종류' : 'Effect Type'}</label>
                                        <div className="flex gap-1">
                                            {[
                                                { id: 'fade', label: lang === 'ko' ? '페이드' : 'Fade' },
                                                { id: 'slide', label: lang === 'ko' ? '슬라이드' : 'Slide' },
                                                { id: 'zoom', label: lang === 'ko' ? '줌' : 'Zoom' }
                                            ].map(effect => (
                                                <button
                                                    key={effect.id}
                                                    onClick={() => onUpdate({ ...data, transitionType: effect.id })}
                                                    style={{ flex: 1, padding: '6px 4px', fontSize: 11, borderRadius: 6, background: (data.transitionType || 'fade') === effect.id ? colors.accentPrimary : colors.bgSubtle, color: (data.transitionType || 'fade') === effect.id ? '#FFF' : colors.textSecondary, border: `1px solid ${colors.borderSoft}` }}
                                                >
                                                    {effect.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 11, color: colors.textMuted, display: 'block', marginBottom: 4 }}>
                                            {lang === 'ko' ? '지속 시간' : 'Duration'}: {(data.transitionDuration || 0.5).toFixed(1)}s
                                        </label>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="2"
                                            step="0.1"
                                            value={data.transitionDuration || 0.5}
                                            onChange={(e) => onUpdate({ ...data, transitionDuration: parseFloat(e.target.value) })}
                                            className="minimal-slider"
                                            style={{ accentColor: colors.accentPrimary }}
                                        />
                                    </div>
                                    <p style={{ fontSize: 9, color: colors.textMuted }}>
                                        * {lang === 'ko' ? '섹션 간 스크롤 시 애니메이션이 적용됩니다' : 'Animation applied when scrolling between sections'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* AI 제품 분석 섹션 */}
                        <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                            <div
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: collapsedSections.aiAnalysis ? 0 : 10 }}
                                onClick={() => toggleSection('aiAnalysis')}
                            >
                                <div className="flex items-center gap-2">
                                    <span style={{ fontSize: 10, color: colors.textMuted, transition: 'transform 0.15s' }} className={collapsedSections.aiAnalysis ? '' : 'rotate-90'}>▶</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>{lang === 'ko' ? 'AI 제품 분석' : 'AI Product Analysis'}</span>
                                </div>
                                <span style={{ fontSize: 9, padding: '2px 6px', background: colors.accentPrimary, color: '#FFF', borderRadius: 4 }}>✨ AI</span>
                            </div>
                            {!collapsedSections.aiAnalysis && (
                                <div className="space-y-2">
                                    <p style={{ fontSize: 11, color: colors.textMuted }}>
                                        {lang === 'ko'
                                            ? '제품 사진을 분석하여 자동으로 SIZE GUIDE, A/S 안내, 주의사항을 생성합니다.'
                                            : 'Analyze product photos to auto-generate SIZE GUIDE, A/S info, and cautions.'}
                                    </p>

                                    {/* 생성 버튼 */}
                                    <button
                                        onClick={async () => {
                                            if (!productFiles || productFiles.length === 0) {
                                                alert(lang === 'ko' ? '제품 사진을 먼저 업로드해주세요' : 'Please upload product photos first');
                                                return;
                                            }
                                            setIsGeneratingAI(true);
                                            try {
                                                // 제품 이미지를 base64로 변환
                                                const file = productFiles[0];
                                                const base64 = await new Promise<string>((resolve) => {
                                                    const reader = new FileReader();
                                                    reader.onload = (e) => resolve(e.target?.result as string);
                                                    reader.readAsDataURL(file);
                                                });

                                                // Gemini API로 제품 분석
                                                const { callGeminiSecure, extractBase64 } = await import('../../../lib/geminiClient');
                                                const imageData = extractBase64(base64);

                                                const analysisPrompt = `당신은 신발 상세페이지 전문 카피라이터입니다. 이 신발 이미지를 분석하고 아래 JSON 형식으로 상세 정보를 작성해주세요.

{
  "brandLine": "브랜드/라인명 (예: NIKE AIR MAX, ADIDAS ULTRABOOST)",
  "productName": "상품명 (한국어, 예: 클래식 워커 프리미엄)",
  "subName": "서브명/색상 (예: Earth Brown / Premium Suede)",
  "styling": "스타일링 설명 (2-3문장)",
  "manufacturing": "제작 공정 설명 (2-3문장)",
  "technology": "핵심 기술 (1문장)",
  "specs": {
    "color": "색상명",
    "upper": "갑피 소재",
    "lining": "안감 소재",
    "outsole": "밑창 소재",
    "origin": "원산지"
  },
  "heightSpec": {
    "outsole": "3",
    "insole": "1.5",
    "total": "4.5"
  },
  "sizeGuide": "사이즈 가이드 안내 문구"
}

JSON만 출력하세요. 다른 텍스트 없이 순수 JSON만 출력하세요.`;

                                                const result = await callGeminiSecure(analysisPrompt, [imageData]);

                                                if (result.type === 'text') {
                                                    try {
                                                        // JSON 파싱
                                                        const jsonMatch = result.data.match(/\{[\s\S]*\}/);
                                                        if (jsonMatch) {
                                                            const analysisData = JSON.parse(jsonMatch[0]);

                                                            // 히어로 섹션 데이터 업데이트
                                                            const newData = { ...data };
                                                            if (analysisData.brandLine) newData.brandLine = analysisData.brandLine;
                                                            if (analysisData.productName) newData.productName = analysisData.productName;
                                                            if (analysisData.subName) newData.subName = analysisData.subName;
                                                            if (analysisData.styling) newData.styling = analysisData.styling;
                                                            if (analysisData.manufacturing) newData.manufacturing = analysisData.manufacturing;
                                                            if (analysisData.technology) newData.technology = analysisData.technology;
                                                            if (analysisData.specs) {
                                                                newData.specs = { ...newData.specs, ...analysisData.specs };
                                                            }
                                                            if (analysisData.heightSpec) {
                                                                newData.heightSpec = analysisData.heightSpec;
                                                            }
                                                            if (analysisData.sizeGuide) newData.sizeGuide = analysisData.sizeGuide;

                                                            // heroTextContent 업데이트
                                                            newData.heroTextContent = {
                                                                ...newData.heroTextContent,
                                                                brandLine: analysisData.brandLine || newData.heroTextContent?.brandLine,
                                                                productName: analysisData.productName || newData.heroTextContent?.productName,
                                                                subName: analysisData.subName || newData.heroTextContent?.subName,
                                                                stylingMatch: analysisData.styling || newData.heroTextContent?.stylingMatch,
                                                                craftsmanship: analysisData.manufacturing || newData.heroTextContent?.craftsmanship,
                                                                technology: analysisData.technology || newData.heroTextContent?.technology,
                                                                specColor: analysisData.specs?.color || newData.heroTextContent?.specColor,
                                                                specUpper: analysisData.specs?.upper || newData.heroTextContent?.specUpper,
                                                                specLining: analysisData.specs?.lining || newData.heroTextContent?.specLining,
                                                                specOutsole: analysisData.specs?.outsole || newData.heroTextContent?.specOutsole,
                                                                specOrigin: analysisData.specs?.origin || newData.heroTextContent?.specOrigin,
                                                                outsole: analysisData.heightSpec?.outsole || newData.heroTextContent?.outsole,
                                                                insole: analysisData.heightSpec?.insole || newData.heroTextContent?.insole,
                                                                totalHeight: analysisData.heightSpec?.total || newData.heroTextContent?.totalHeight,
                                                                sizeGuide: analysisData.sizeGuide || newData.heroTextContent?.sizeGuide,
                                                            };

                                                            // 데이터 업데이트
                                                            onUpdate(newData);

                                                            // Size Guide / 주의사항 / A/S 섹션 HTML 생성 및 프리뷰 추가
                                                            if (onAddSectionWithImage) {
                                                                // Size Guide 섹션 HTML (inline styles로 구성)
                                                                const sizeGuideHtml = `data:text/html;charset=utf-8,${encodeURIComponent(`
<div style="font-family: 'Noto Sans KR', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; background: white;">
    <h1 style="font-size: 28px; font-weight: 900; margin-bottom: 40px; text-align: center; letter-spacing: -0.5px;">SIZE GUIDE</h1>
    <div style="background: #f9fafb; border-radius: 16px; padding: 40px; margin-bottom: 24px; text-align: center;">
        <p style="color: #9ca3af; font-size: 14px;">[제품 이미지 영역]</p>
    </div>
    <p style="font-size: 12px; color: #6b7280; text-align: center; margin-bottom: 32px;">* 250사이즈 기준</p>
    <div style="display: flex; flex-direction: column; gap: 24px;">
        <div style="display: flex; align-items: center; gap: 16px;">
            <span style="width: 80px; font-weight: 700;">사이즈</span>
            <div style="flex: 1; display: flex; justify-content: space-between; font-size: 12px; color: #6b7280;">
                <span>작음</span><span style="font-weight: 700; color: black;">보통</span><span>여유</span>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
            <span style="width: 80px; font-weight: 700;">발볼 너비</span>
            <div style="flex: 1; display: flex; justify-content: space-between; font-size: 12px; color: #6b7280;">
                <span>좁음</span><span style="font-weight: 700; color: black;">보통</span><span>넓음</span>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
            <span style="width: 80px; font-weight: 700;">무게</span>
            <div style="flex: 1; display: flex; justify-content: space-between; font-size: 12px; color: #6b7280;">
                <span>가벼움</span><span style="font-weight: 700; color: black;">보통</span><span>무거움</span>
            </div>
        </div>
    </div>
</div>`)}`;

                                                                // 주의사항 섹션 HTML
                                                                const precautionsHtml = `data:text/html;charset=utf-8,${encodeURIComponent(`
<div style="font-family: 'Noto Sans KR', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; background: white;">
    <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 32px;">기타 주의 사항</h2>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;">
        <div style="display: flex; gap: 16px; align-items: flex-start;">
            <div style="width: 48px; height: 48px; background: #f3f4f6; border-radius: 12px; display: flex; align-items: center; justify-content: center;">💧</div>
            <div><h3 style="font-weight: 700; margin-bottom: 8px;">습기 주의</h3><p style="font-size: 14px; color: #6b7280; line-height: 1.6;">가죽 제품은 습기에 약해 변색이나 얼룩이 생길 수 있습니다.</p></div>
        </div>
        <div style="display: flex; gap: 16px; align-items: flex-start;">
            <div style="width: 48px; height: 48px; background: #f3f4f6; border-radius: 12px; display: flex; align-items: center; justify-content: center;">☀️</div>
            <div><h3 style="font-weight: 700; margin-bottom: 8px;">직사광선 주의</h3><p style="font-size: 14px; color: #6b7280; line-height: 1.6;">직사광선에 장시간 노출 시 가죽 변색 우려가 있습니다.</p></div>
        </div>
        <div style="display: flex; gap: 16px; align-items: flex-start;">
            <div style="width: 48px; height: 48px; background: #f3f4f6; border-radius: 12px; display: flex; align-items: center; justify-content: center;">📦</div>
            <div><h3 style="font-weight: 700; margin-bottom: 8px;">보관 방법</h3><p style="font-size: 14px; color: #6b7280; line-height: 1.6;">통기성 좋은 천 커버를 사용해 주세요.</p></div>
        </div>
        <div style="display: flex; gap: 16px; align-items: flex-start;">
            <div style="width: 48px; height: 48px; background: #f3f4f6; border-radius: 12px; display: flex; align-items: center; justify-content: center;">✨</div>
            <div><h3 style="font-weight: 700; margin-bottom: 8px;">오염 관리</h3><p style="font-size: 14px; color: #6b7280; line-height: 1.6;">가죽 전용 클리너를 이용해 주세요.</p></div>
        </div>
    </div>
</div>`)}`;

                                                                // A/S 안내 섹션 HTML
                                                                const asInfoHtml = `data:text/html;charset=utf-8,${encodeURIComponent(`
<div style="font-family: 'Noto Sans KR', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; background: white;">
    <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 32px;">A/S 안내</h2>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px; margin-bottom: 32px;">
        <div>
            <h3 style="font-size: 16px; font-weight: 700; border-left: 4px solid black; padding-left: 12px; margin-bottom: 16px;">제품에 하자가 있을 경우</h3>
            <ul style="font-size: 14px; color: #6b7280; line-height: 1.8; padding-left: 16px;">
                <li>제품 상태 확인 후 정확한 안내가 가능합니다.</li>
                <li>사진/영상 자료와 함께 문의해 주세요.</li>
            </ul>
        </div>
        <div>
            <h3 style="font-size: 16px; font-weight: 700; border-left: 4px solid black; padding-left: 12px; margin-bottom: 16px;">A/S 연락처</h3>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; font-size: 14px;">
                <p><span style="color: #6b7280;">고객센터</span> 000-0000-0000</p>
            </div>
        </div>
    </div>
    <div style="border: 2px solid #fecaca; background: #fef2f2; border-radius: 12px; padding: 24px;">
        <h3 style="color: #dc2626; font-weight: 700; font-size: 18px; margin-bottom: 16px;">⚠️ CAUTION</h3>
        <ul style="font-size: 14px; color: #4b5563; line-height: 1.8; padding-left: 16px;">
            <li>가죽 특성상 개체별 색감 차이가 있을 수 있습니다.</li>
            <li style="color: #dc2626; font-weight: 700;">사이즈 확인 시 제품 하자 발생 시 교환/환불이 불가합니다.</li>
        </ul>
    </div>
</div>`)}`;

                                                                // 섹션들을 프리뷰에 추가 - HTML을 이미지로 변환하여 추가
                                                                const htmlToImage = async (htmlContent: string, sectionName: string): Promise<string> => {
                                                                    return new Promise((resolve, reject) => {
                                                                        const iframe = document.createElement('iframe');
                                                                        iframe.style.position = 'absolute';
                                                                        iframe.style.left = '-9999px';
                                                                        iframe.style.width = '800px';
                                                                        iframe.style.height = '1200px';
                                                                        document.body.appendChild(iframe);

                                                                        const doc = iframe.contentWindow?.document;
                                                                        if (!doc) {
                                                                            document.body.removeChild(iframe);
                                                                            reject('Iframe document not found');
                                                                            return;
                                                                        }

                                                                        doc.open();
                                                                        doc.write(htmlContent);
                                                                        doc.close();

                                                                        setTimeout(async () => {
                                                                            try {
                                                                                const { default: html2canvas } = await import('html2canvas');
                                                                                const canvas = await html2canvas(doc.body, {
                                                                                    scale: 2,
                                                                                    useCORS: true,
                                                                                    logging: false,
                                                                                    backgroundColor: '#ffffff'
                                                                                });
                                                                                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                                                                document.body.removeChild(iframe);
                                                                                resolve(dataUrl);
                                                                            } catch (error) {
                                                                                document.body.removeChild(iframe);
                                                                                reject(error);
                                                                            }
                                                                        }, 500);
                                                                    });
                                                                };

                                                                // Size Guide 섹션 추가
                                                                if (data.showSizeGuide !== false) {
                                                                    try {
                                                                        const sizeGuideImg = await htmlToImage(sizeGuideHtml, 'Size Guide');
                                                                        onAddSectionWithImage?.(sizeGuideImg, 'size-guide');
                                                                    } catch (e) {
                                                                        console.error('Size Guide generation failed:', e);
                                                                    }
                                                                }

                                                                // 주의사항 섹션 추가
                                                                if (data.showPrecautions !== false) {
                                                                    try {
                                                                        const precautionsImg = await htmlToImage(`
                                                                        <div style="font-family: 'Noto Sans KR', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; background: white;">
                                                                            <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 32px;">기타 주의 사항</h2>
                                                                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;">
                                                                                <div style="display: flex; gap: 16px; align-items: flex-start;">
                                                                                    <div style="width: 48px; height: 48px; background: #f3f4f6; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px;">💧</div>
                                                                                    <div><h3 style="font-weight: 700; margin-bottom: 8px;">습기 주의</h3><p style="font-size: 14px; color: #6b7280; line-height: 1.6;">가죽 제품은 습기에 약해 변색이나 얼룩이 생길 수 있습니다.</p></div>
                                                                                </div>
                                                                                <div style="display: flex; gap: 16px; align-items: flex-start;">
                                                                                    <div style="width: 48px; height: 48px; background: #f3f4f6; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px;">☀️</div>
                                                                                    <div><h3 style="font-weight: 700; margin-bottom: 8px;">직사광선 주의</h3><p style="font-size: 14px; color: #6b7280; line-height: 1.6;">직사광선에 장시간 노출 시 가죽 변색 우려가 있습니다.</p></div>
                                                                                </div>
                                                                                <div style="display: flex; gap: 16px; align-items: flex-start;">
                                                                                    <div style="width: 48px; height: 48px; background: #f3f4f6; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px;">📦</div>
                                                                                    <div><h3 style="font-weight: 700; margin-bottom: 8px;">보관 방법</h3><p style="font-size: 14px; color: #6b7280; line-height: 1.6;">통기성 좋은 천 커버를 사용해 주세요.</p></div>
                                                                                </div>
                                                                                <div style="display: flex; gap: 16px; align-items: flex-start;">
                                                                                    <div style="width: 48px; height: 48px; background: #f3f4f6; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px;">✨</div>
                                                                                    <div><h3 style="font-weight: 700; margin-bottom: 8px;">오염 관리</h3><p style="font-size: 14px; color: #6b7280; line-height: 1.6;">가죽 전용 클리너를 이용해 주세요.</p></div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    `, 'Precautions');
                                                                        onAddSectionWithImage?.(precautionsImg, 'precautions');
                                                                    } catch (e) { console.error('주의사항 변환 실패:', e); }
                                                                }

                                                                // A/S 안내 섹션 추가
                                                                if (data.showASInfo !== false) {
                                                                    try {
                                                                        const asInfoImg = await htmlToImage(`
                                                                        <div style="font-family: 'Noto Sans KR', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; background: white;">
                                                                            <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 32px;">A/S 안내</h2>
                                                                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px; margin-bottom: 32px;">
                                                                                <div>
                                                                                    <h3 style="font-size: 16px; font-weight: 700; border-left: 4px solid black; padding-left: 12px; margin-bottom: 16px;">제품에 하자가 있을 경우</h3>
                                                                                    <ul style="font-size: 14px; color: #6b7280; line-height: 1.8; padding-left: 16px;">
                                                                                        <li>제품 상태 확인 후 정확한 안내가 가능합니다.</li>
                                                                                        <li>사진/영상 자료와 함께 문의해 주세요.</li>
                                                                                    </ul>
                                                                                </div>
                                                                                <div>
                                                                                    <h3 style="font-size: 16px; font-weight: 700; border-left: 4px solid black; padding-left: 12px; margin-bottom: 16px;">A/S 연락처</h3>
                                                                                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; font-size: 14px;">
                                                                                        <p><span style="color: #6b7280;">고객센터</span> 000-0000-0000</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div style="border: 2px solid #fecaca; background: #fef2f2; border-radius: 12px; padding: 24px;">
                                                                                <h3 style="color: #dc2626; font-weight: 700; font-size: 18px; margin-bottom: 16px;">⚠️ CAUTION</h3>
                                                                                <ul style="font-size: 14px; color: #4b5563; line-height: 1.8; padding-left: 16px;">
                                                                                    <li>가죽 특성상 개체별 색감 차이가 있을 수 있습니다.</li>
                                                                                    <li style="color: #dc2626; font-weight: 700;">사이즈 확인 시 제품 하자 발생 시 교환/환불이 불가합니다.</li>
                                                                                </ul>
                                                                            </div>
                                                                        </div>
                                                                    `, 'A/S Info');
                                                                        onAddSectionWithImage?.(asInfoImg, 'as-info');
                                                                    } catch (e) { console.error('A/S 안내 변환 실패:', e); }
                                                                }
                                                            }

                                                            alert(lang === 'ko' ? '✅ AI 분석 완료! 히어로 섹션과 안내 섹션이 자동으로 추가되었습니다.' : '✅ AI analysis complete! Hero and info sections added automatically.');
                                                        }
                                                    } catch (parseError) {
                                                        console.error('JSON parse error:', parseError);
                                                        alert(lang === 'ko' ? '분석 결과 파싱 실패' : 'Failed to parse analysis');
                                                    }
                                                }
                                            } catch (error) {
                                                console.error('AI generation error:', error);
                                                alert(lang === 'ko' ? 'AI 분석 실패: ' + (error as Error).message : 'AI analysis failed');
                                            } finally {
                                                setIsGeneratingAI(false);
                                            }
                                        }}
                                        disabled={isGeneratingAI || !productFiles || productFiles.length === 0}
                                        className={`w-full py-2 text-[12px] font-medium rounded transition-opacity ${isGeneratingAI || !productFiles || productFiles.length === 0
                                            ? 'bg-[#3c3c3c] text-[#666] cursor-not-allowed'
                                            : 'bg-white text-black hover:bg-[#e5e5e5]'
                                            }`}
                                    >
                                        {isGeneratingAI ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                {lang === 'ko' ? 'AI 분석 중...' : 'AI Analyzing...'}
                                            </span>
                                        ) : `🤖 ${lang === 'ko' ? 'AI 콘텐츠 자동 생성' : 'Auto Generate with AI'}`}
                                    </button>

                                    <p className="text-[9px] text-[#555] text-center">
                                        * {lang === 'ko' ? '제품 탭에서 사진 업로드 → 히어로 섹션 자동 채우기' : 'Upload photos in Products → Auto-fill Hero section'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* 콘텐츠 섹션 수정 */}
                        <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                            <div
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: collapsedSections.sizeGuide ? 0 : 10 }}
                                onClick={() => toggleSection('sizeGuide')}
                            >
                                <div className="flex items-center gap-2">
                                    <span style={{ fontSize: 10, color: colors.textMuted, transition: 'transform 0.15s' }} className={collapsedSections.sizeGuide ? '' : 'rotate-90'}>▶</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>{lang === 'ko' ? 'SIZE GUIDE 수정' : 'SIZE GUIDE Edit'}</span>
                                </div>
                            </div>
                            {!collapsedSections.sizeGuide && (
                                <div className="space-y-2">
                                    <div>
                                        <label style={{ fontSize: 10, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '기준 사이즈' : 'Base Size'}</label>
                                        <input
                                            type="text"
                                            value={data.sizeGuideContent?.baseSize || '250'}
                                            onChange={(e) => onUpdate({ ...data, sizeGuideContent: { ...data.sizeGuideContent, baseSize: e.target.value } })}
                                            style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: colors.textPrimary }}
                                            placeholder="250"
                                        />
                                    </div>
                                    {/* 사이즈 스펙 입력 필드 */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label style={{ fontSize: 10, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '전체 길이 (mm)' : 'Total Length'}</label>
                                            <input
                                                type="number"
                                                value={data.sizeGuideContent?.specLength || '280'}
                                                onChange={(e) => onUpdate({ ...data, sizeGuideContent: { ...data.sizeGuideContent, specLength: e.target.value } })}
                                                style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: colors.textPrimary }}
                                                placeholder="280"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 10, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '전체 높이 (mm)' : 'Total Height'}</label>
                                            <input
                                                type="number"
                                                value={data.sizeGuideContent?.specWidth || '100'}
                                                onChange={(e) => onUpdate({ ...data, sizeGuideContent: { ...data.sizeGuideContent, specWidth: e.target.value } })}
                                                style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: colors.textPrimary }}
                                                placeholder="100"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 10, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '굽높이 (mm)' : 'Heel Height'}</label>
                                            <input
                                                type="number"
                                                value={data.sizeGuideContent?.specHeel || '35'}
                                                onChange={(e) => onUpdate({ ...data, sizeGuideContent: { ...data.sizeGuideContent, specHeel: e.target.value } })}
                                                style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: colors.textPrimary }}
                                                placeholder="35"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label style={{ fontSize: 10, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '사이즈' : 'Size'}</label>
                                            <select
                                                value={data.sizeGuideContent?.sizeLevel || 'normal'}
                                                onChange={(e) => onUpdate({ ...data, sizeGuideContent: { ...data.sizeGuideContent, sizeLevel: e.target.value } })}
                                                style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: colors.textPrimary }}
                                            >
                                                <option value="small">{lang === 'ko' ? '작음' : 'Small'}</option>
                                                <option value="normal">{lang === 'ko' ? '보통' : 'Normal'}</option>
                                                <option value="large">{lang === 'ko' ? '여유' : 'Large'}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 10, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '발볼' : 'Width'}</label>
                                            <select
                                                value={data.sizeGuideContent?.widthLevel || 'normal'}
                                                onChange={(e) => onUpdate({ ...data, sizeGuideContent: { ...data.sizeGuideContent, widthLevel: e.target.value } })}
                                                style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: colors.textPrimary }}
                                            >
                                                <option value="narrow">{lang === 'ko' ? '좁음' : 'Narrow'}</option>
                                                <option value="normal">{lang === 'ko' ? '보통' : 'Normal'}</option>
                                                <option value="wide">{lang === 'ko' ? '넓음' : 'Wide'}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 10, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '무게' : 'Weight'}</label>
                                            <select
                                                value={data.sizeGuideContent?.weightLevel || 'normal'}
                                                onChange={(e) => onUpdate({ ...data, sizeGuideContent: { ...data.sizeGuideContent, weightLevel: e.target.value } })}
                                                style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: colors.textPrimary }}
                                            >
                                                <option value="light">{lang === 'ko' ? '가벼움' : 'Light'}</option>
                                                <option value="normal">{lang === 'ko' ? '보통' : 'Normal'}</option>
                                                <option value="heavy">{lang === 'ko' ? '무거움' : 'Heavy'}</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 10, color: colors.textMuted, display: 'block', marginBottom: 4 }}>{lang === 'ko' ? '글꼴 크기' : 'Font Size'}: {data.sizeGuideContent?.fontSize || 14}px</label>
                                        <input
                                            type="range"
                                            min="10"
                                            max="24"
                                            value={data.sizeGuideContent?.fontSize || 14}
                                            onChange={(e) => onUpdate({ ...data, sizeGuideContent: { ...data.sizeGuideContent, fontSize: parseInt(e.target.value) } })}
                                            className="minimal-slider"
                                            style={{ accentColor: colors.accentPrimary }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* A/S 안내 수정 */}
                        <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                            <div
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: collapsedSections.asInfo ? 0 : 10 }}
                                onClick={() => toggleSection('asInfo')}
                            >
                                <div className="flex items-center gap-2">
                                    <span style={{ fontSize: 10, color: colors.textMuted, transition: 'transform 0.15s' }} className={collapsedSections.asInfo ? '' : 'rotate-90'}>▶</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>{lang === 'ko' ? 'A/S 안내 수정' : 'A/S Info Edit'}</span>
                                </div>
                            </div>
                            {!collapsedSections.asInfo && (
                                <div className="space-y-3">
                                    {/* 제품 하자 안내 */}
                                    <div style={{ borderBottom: `1px solid ${colors.borderSoft}`, paddingBottom: 10 }}>
                                        <label style={{ fontSize: 11, color: colors.textSecondary, display: 'block', marginBottom: 6, fontWeight: 600 }}>제품에 하자가 있을 경우</label>
                                        <textarea
                                            value={data.asInfoContent?.defectInfo || '제품 상태 확인 후 정확한 안내가 가능합니다.\n구매처 문의하기를 통해 [사진/영상] 자료와 함께 내용을 남겨주시면, 유관부서 전달 후 조치 방안을 상세히 안내드리겠습니다.'}
                                            onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, defectInfo: e.target.value } })}
                                            style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: colors.textPrimary, minHeight: 60, resize: 'vertical' }}
                                        />
                                    </div>

                                    {/* A/S 연락처 */}
                                    <div style={{ borderBottom: `1px solid ${colors.borderSoft}`, paddingBottom: 10 }}>
                                        <label style={{ fontSize: 11, color: colors.textSecondary, display: 'block', marginBottom: 6, fontWeight: 600 }}>A/S 안내</label>
                                        <input
                                            type="text"
                                            placeholder="고객센터 번호"
                                            value={data.asInfoContent?.phone || '000-0000-0000'}
                                            onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, phone: e.target.value } })}
                                            style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: colors.textPrimary, marginBottom: 6 }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="채널 문의 (예: @카카오톡채널아이디)"
                                            value={data.asInfoContent?.channel || '@카카오톡채널아이디'}
                                            onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, channel: e.target.value } })}
                                            style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: colors.textPrimary }}
                                        />
                                    </div>

                                    {/* CAUTION 항목들 */}
                                    <div style={{ borderBottom: `1px solid ${colors.borderSoft}`, paddingBottom: 10 }}>
                                        <label style={{ fontSize: 11, color: '#dc2626', display: 'block', marginBottom: 6, fontWeight: 600 }}>⚠️ CAUTION (주의사항)</label>
                                        <textarea
                                            value={data.asInfoContent?.caution1 || '가죽 특성상 개체별 색감 차이, 고유 주름 및 미세 스크래치가 있을 수 있으며, 이염이 발생할 수 있습니다.'}
                                            onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, caution1: e.target.value } })}
                                            style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: colors.textPrimary, minHeight: 40, resize: 'vertical', marginBottom: 6 }}
                                        />
                                        <textarea
                                            value={data.asInfoContent?.caution2 || '생산 과정의 에이징 작업으로 인해 수령 시 자연스러운 주름이 있을 수 있으며 이는 불량이 아닙니다.'}
                                            onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, caution2: e.target.value } })}
                                            style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: colors.textPrimary, minHeight: 40, resize: 'vertical', marginBottom: 6 }}
                                        />
                                        <textarea
                                            value={data.asInfoContent?.caution3 || '사이즈 확인 과정에서 제품 하자(가죽 손상, 과도한 시착 주름) 발생 시 교환/환불이 불가합니다. 동봉된 슈혼 사용을 권장합니다.'}
                                            onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, caution3: e.target.value } })}
                                            style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: '#dc2626', minHeight: 40, resize: 'vertical', fontWeight: 500 }}
                                        />
                                    </div>

                                    {/* 교환/환불 정책 */}
                                    <div>
                                        <label style={{ fontSize: 11, color: colors.textSecondary, display: 'block', marginBottom: 6, fontWeight: 600 }}>교환/환불 정책</label>
                                        <div className="space-y-2">
                                            <div>
                                                <label style={{ fontSize: 10, color: colors.textMuted }}>가능 조건</label>
                                                <input
                                                    type="text"
                                                    value={data.asInfoContent?.refundCondition || '상품 수령 후 7일 이내, 제품을 착용한 흔적이 없는 경우에 한해 가능합니다.'}
                                                    onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, refundCondition: e.target.value } })}
                                                    style={{ width: '100%', padding: '6px 8px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 6, fontSize: 10, color: colors.textPrimary }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 10, color: colors.textMuted }}>비용 안내</label>
                                                <input
                                                    type="text"
                                                    value={data.asInfoContent?.refundCost || '제품 하자: 무료 교환/환불, 단순 변심: 고객 부담 (왕복 배송비)'}
                                                    onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, refundCost: e.target.value } })}
                                                    style={{ width: '100%', padding: '6px 8px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 6, fontSize: 10, color: colors.textPrimary }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 10, color: colors.textMuted }}>불가능한 경우 (줄바꿈으로 구분)</label>
                                                <textarea
                                                    value={data.asInfoContent?.refundImpossible || '상품이 훼손 되었거나 사용(착용) 흔적이 있는 경우\n소비자 귀책으로 상품이 멸실 또는 훼손된 경우\n시간 경과로 재판매가 곤란할 정도로 상품 가치가 감소한 경우\n복제 가능한 상품의 포장을 개봉한 경우\n주문 제작(커스텀) 상품인 경우'}
                                                    onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, refundImpossible: e.target.value } })}
                                                    style={{ width: '100%', padding: '6px 8px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 6, fontSize: 10, color: colors.textPrimary, minHeight: 60, resize: 'vertical' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 10, color: colors.textMuted }}>신청 절차</label>
                                                <input
                                                    type="text"
                                                    value={data.asInfoContent?.refundProcedure || '구매처 고객센터를 통해 신청 접수 → 반송 안내에 따라 상품 발송 → 상품 검수 후 3~5영업일 이내 처리'}
                                                    onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, refundProcedure: e.target.value } })}
                                                    style={{ width: '100%', padding: '6px 8px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 6, fontSize: 10, color: colors.textPrimary }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 기타 주의사항 수정 */}
                        <div style={{ background: colors.bgSurface, borderRadius: 12, padding: 12, border: `1px solid ${colors.borderSoft}` }}>
                            <div
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: collapsedSections.precautions ? 0 : 10 }}
                                onClick={() => toggleSection('precautions')}
                            >
                                <div className="flex items-center gap-2">
                                    <span style={{ fontSize: 10, color: colors.textMuted, transition: 'transform 0.15s' }} className={collapsedSections.precautions ? '' : 'rotate-90'}>▶</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>{lang === 'ko' ? '기타 주의사항 수정' : 'Precautions Edit'}</span>
                                </div>
                            </div>
                            {!collapsedSections.precautions && (
                                <div className="space-y-3">
                                    <div>
                                        <label style={{ fontSize: 11, color: colors.textSecondary, display: 'block', marginBottom: 6, fontWeight: 600 }}>제목</label>
                                        <input
                                            type="text"
                                            value={data.precautionsContent?.title || '기타 주의 사항'}
                                            onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, title: e.target.value } })}
                                            style={{ width: '100%', padding: '8px 10px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, fontSize: 11, color: colors.textPrimary }}
                                        />
                                    </div>

                                    {/* 습기 주의 */}
                                    <div style={{ borderBottom: `1px solid ${colors.borderSoft}`, paddingBottom: 10 }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span style={{ fontSize: 14 }}>💧</span>
                                            <input
                                                type="text"
                                                value={data.precautionsContent?.item1Title || '습기 주의'}
                                                onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, item1Title: e.target.value } })}
                                                style={{ flex: 1, padding: '6px 8px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 6, fontSize: 11, color: colors.textPrimary, fontWeight: 600 }}
                                            />
                                        </div>
                                        <textarea
                                            value={data.precautionsContent?.item1Desc || '가죽 제품은 습기에 약해 변색이나 얼룩이 생길 수 있습니다. 우천 시 착용을 피하고, 젖었을 땐 마른 수건으로 닦아 통풍이 잘되는 그늘에 건조해 주세요.'}
                                            onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, item1Desc: e.target.value } })}
                                            style={{ width: '100%', padding: '6px 8px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 6, fontSize: 10, color: colors.textPrimary, minHeight: 50, resize: 'vertical' }}
                                        />
                                    </div>

                                    {/* 직사광선 주의 */}
                                    <div style={{ borderBottom: `1px solid ${colors.borderSoft}`, paddingBottom: 10 }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span style={{ fontSize: 14 }}>☀️</span>
                                            <input
                                                type="text"
                                                value={data.precautionsContent?.item2Title || '직사광선 주의'}
                                                onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, item2Title: e.target.value } })}
                                                style={{ flex: 1, padding: '6px 8px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 6, fontSize: 11, color: colors.textPrimary, fontWeight: 600 }}
                                            />
                                        </div>
                                        <textarea
                                            value={data.precautionsContent?.item2Desc || '직사광선에 장시간 노출 시 가죽 변색이나 이염 우려가 있습니다. 보관 시에는 햇빛이 닿지 않는 서늘한 곳을 권장합니다.'}
                                            onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, item2Desc: e.target.value } })}
                                            style={{ width: '100%', padding: '6px 8px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 6, fontSize: 10, color: colors.textPrimary, minHeight: 50, resize: 'vertical' }}
                                        />
                                    </div>

                                    {/* 보관 방법 */}
                                    <div style={{ borderBottom: `1px solid ${colors.borderSoft}`, paddingBottom: 10 }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span style={{ fontSize: 14 }}>📦</span>
                                            <input
                                                type="text"
                                                value={data.precautionsContent?.item3Title || '보관 방법'}
                                                onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, item3Title: e.target.value } })}
                                                style={{ flex: 1, padding: '6px 8px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 6, fontSize: 11, color: colors.textPrimary, fontWeight: 600 }}
                                            />
                                        </div>
                                        <textarea
                                            value={data.precautionsContent?.item3Desc || '슈트리를 넣어 형태를 유지하고, 통기성 좋은 천 커버를 사용해 주세요. 밀폐된 비닐백 보관은 피해주세요.'}
                                            onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, item3Desc: e.target.value } })}
                                            style={{ width: '100%', padding: '6px 8px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 6, fontSize: 10, color: colors.textPrimary, minHeight: 50, resize: 'vertical' }}
                                        />
                                    </div>

                                    {/* 오염 관리 */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span style={{ fontSize: 14 }}>🧽</span>
                                            <input
                                                type="text"
                                                value={data.precautionsContent?.item4Title || '오염 관리'}
                                                onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, item4Title: e.target.value } })}
                                                style={{ flex: 1, padding: '6px 8px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 6, fontSize: 11, color: colors.textPrimary, fontWeight: 600 }}
                                            />
                                        </div>
                                        <textarea
                                            value={data.precautionsContent?.item4Desc || '오염 발생 시 가죽 전용 클리너를 이용해 주세요. 물이나 일반 세제 사용은 피해주세요.'}
                                            onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, item4Desc: e.target.value } })}
                                            style={{ width: '100%', padding: '6px 8px', background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 6, fontSize: 10, color: colors.textPrimary, minHeight: 50, resize: 'vertical' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div >
                )
                }
            </div >
        </div >
    );
}