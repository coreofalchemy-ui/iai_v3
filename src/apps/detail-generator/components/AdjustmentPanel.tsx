import React, { useState, useRef } from 'react';
import { generateAICopywriting } from '../services/geminiAICopywriter';
import { batchReplaceShoes, fileToDataUrl } from '../services/shoeReplacementService';
import { batchRemoveBackground } from '../services/backgroundRemovalService';
import ModelChapterPanel from './ModelChapterPanel';
import ProductEnhancementPanel from './ProductEnhancementPanel';
import ContentGeneratorPanel from './ContentGeneratorPanel';
import { TextElement } from './PreviewRenderer';
import { FieldToggleControl } from './FieldToggleControl';

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

export default function AdjustmentPanel({ data, onUpdate, activeSection: previewActiveSection, textElements = [], onAddTextElement, onUpdateTextElement, onDeleteTextElement, onAddSectionWithImage, lineElements = [], onAddLineElement, onDeleteLineElement, onAddGridSection }: AdjustmentPanelProps) {
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
            onUpdate({ ...data, heroTextContent: { ...data.heroTextContent, ...aiCopy } });
        } catch (error) { console.error('AI 분석 실패:', error); alert('AI 분석에 실패했습니다.'); }
        finally { setIsGeneratingAI(false); }
    };

    const handleProductDragOver = (e: React.DragEvent) => { e.preventDefault(); setProductDragActive(true); };
    const handleProductDragLeave = () => setProductDragActive(false);
    const handleProductDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setProductDragActive(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            const newFiles = [...productFiles, ...files].slice(0, 10);
            onUpdate({ ...data, productFiles: newFiles });
        }
    };
    const handleProductFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            const newFiles = [...productFiles, ...files].slice(0, 10);
            onUpdate({ ...data, productFiles: newFiles });
        }
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
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '컬러' : 'Color'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[11px] text-white focus:border-white focus:outline-none" value={data.heroTextContent?.specColor || ''} onChange={(e) => updateHeroContent('specColor', e.target.value)} /></div>
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '갑피' : 'Upper'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[11px] text-white focus:border-white focus:outline-none" value={data.heroTextContent?.specUpper || ''} onChange={(e) => updateHeroContent('specUpper', e.target.value)} /></div>
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '안감' : 'Lining'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[11px] text-white focus:border-white focus:outline-none" value={data.heroTextContent?.specLining || ''} onChange={(e) => updateHeroContent('specLining', e.target.value)} /></div>
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '밑창' : 'Outsole'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[11px] text-white focus:border-white focus:outline-none" value={data.heroTextContent?.specOutsole || ''} onChange={(e) => updateHeroContent('specOutsole', e.target.value)} /></div>
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '원산지' : 'Origin'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[11px] text-white focus:border-white focus:outline-none" value={data.heroTextContent?.specOrigin || ''} onChange={(e) => updateHeroContent('specOrigin', e.target.value)} /></div>
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '굽높이' : 'Heel'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[11px] text-white focus:border-white focus:outline-none" value={data.heroTextContent?.heelHeight || ''} onChange={(e) => updateHeroContent('heelHeight', e.target.value)} /></div>
                    </div>
                </FieldToggleControl>
            );
        }
        if (isHeightSpec) {
            return (
                <FieldToggleControl key={id} fieldId={id} label={displayLabel} isVisible={isVisible} onToggleVisibility={() => updateFieldSetting(id, 'visible', !isVisible)} fontSize={fontSize} onFontSizeChange={(size: number) => updateFieldSetting(id, 'fontSize', size)} draggable onDragStart={handleDragStart(id)} onDragOver={handleDragOver} onDrop={handleDrop(id)}>
                    <div className="grid grid-cols-3 gap-2">
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '아웃솔' : 'Outsole'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[11px] text-white focus:border-white focus:outline-none" value={data.heroTextContent?.outsole || ''} onChange={(e) => updateHeroContent('outsole', e.target.value)} placeholder="3cm" /></div>
                        <div><label className="text-[12px] text-[#666] mb-0.5 block">{lang === 'ko' ? '인솔' : 'Insole'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[11px] text-white focus:border-white focus:outline-none" value={data.heroTextContent?.insole || ''} onChange={(e) => updateHeroContent('insole', e.target.value)} placeholder="1.5cm" /></div>
                        <div><label className="text-[12px] text-white mb-0.5 block font-medium">{lang === 'ko' ? '총 높이' : 'Total'}</label><input className="w-full bg-white/10 border border-white/50 rounded px-2 py-1 text-[11px] text-white font-medium focus:border-white focus:outline-none" value={data.heroTextContent?.totalHeight || ''} onChange={(e) => updateHeroContent('totalHeight', e.target.value)} placeholder="4.5cm" /></div>
                    </div>
                </FieldToggleControl>
            );
        }
        return (
            <FieldToggleControl key={id} fieldId={id} label={displayLabel} isVisible={isVisible} onToggleVisibility={() => updateFieldSetting(id, 'visible', !isVisible)} fontSize={fontSize} onFontSizeChange={(size: number) => updateFieldSetting(id, 'fontSize', size)} draggable onDragStart={handleDragStart(id)} onDragOver={handleDragOver} onDrop={handleDrop(id)}>
                {multiline ? <textarea rows={2} className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[11px] text-white resize-none focus:border-white focus:outline-none" value={data.heroTextContent?.[id] || ''} onChange={(e) => updateHeroContent(id, e.target.value)} />
                    : <input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[11px] text-white focus:border-white focus:outline-none" value={data.heroTextContent?.[id] || ''} onChange={(e) => updateHeroContent(id, e.target.value)} />}
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

    return (
        <div className="h-full flex flex-col bg-[#1e1e1e] text-[#e5e5e5]" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
            <SliderStyles />
            {/* 헤더 */}
            <div className="flex-shrink-0 h-7 bg-[#2c2c2c] border-b border-[#3c3c3c] flex items-center justify-between px-2">
                <span className="text-[12px] font-medium tracking-wide text-white">Design</span>
                <div className="flex items-center bg-[#1e1e1e] rounded overflow-hidden">
                    <button onClick={() => setLang('ko')} className={`px-1 py-0.5 text-[11px] font-medium transition-colors ${lang === 'ko' ? 'bg-white text-black' : 'text-[#666] hover:text-white'}`}>KR</button>
                    <button onClick={() => setLang('en')} className={`px-1 py-0.5 text-[11px] font-medium transition-colors ${lang === 'en' ? 'bg-white text-black' : 'text-[#666] hover:text-white'}`}>EN</button>
                </div>
            </div>

            {/* 탭 */}
            <div className="flex-shrink-0 border-b border-[#3c3c3c] bg-[#252525]">
                <nav className="flex">
                    {sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`flex-1 px-1 py-2 text-[12px] font-medium transition-colors ${activeSection === section.id
                                ? 'text-white bg-[#1e1e1e] border-b-2 border-white'
                                : 'text-[#999] hover:text-white hover:bg-[#2c2c2c]'
                                }`}
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
                            <button onClick={handleAIAnalysis} disabled={isGeneratingAI} className={`px-1.5 py-0.5 text-[11px] font-medium rounded transition-colors ${isGeneratingAI ? 'bg-[#3c3c3c] text-[#666]' : 'bg-white text-black hover:bg-[#e5e5e5]'}`}>
                                {isGeneratingAI ? 'Analyzing...' : 'AI'}
                            </button>
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
                            className={`h-24 border border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${productDragActive ? 'border-white bg-white/10' : 'border-[#3c3c3c] hover:border-[#555]'}`}
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
                            <div className="bg-[#252525] rounded p-2">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[12px] font-medium text-[#999]">{lang === 'ko' ? '업로드' : 'Upload'}</span>
                                    <span className="text-[12px] text-[#666]">{productFiles.length}</span>
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
                            <div className="bg-[#252525] rounded p-2">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[12px] font-medium text-[#999]">{lang === 'ko' ? 'AI 생성' : 'AI Gen'}</span>
                                    <span className="text-[12px] text-[#666]">{generatedImages.length}</span>
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
                                            <button onClick={(e) => { e.stopPropagation(); setGeneratedImages(prev => prev.filter((_, i) => i !== idx)); setSelectedGeneratedIndices(prev => { const n = new Set(prev); n.delete(idx); return n; }); }} className="absolute top-0.5 right-0.5 bg-black/70 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] hover:bg-red-500">×</button>
                                        </div>
                                    ))}
                                    {generatedImages.length === 0 && <div className="text-center text-[10px] text-[#555] py-4">{lang === 'ko' ? '없음' : 'None'}</div>}
                                </div>
                            </div>
                        </div>

                        {/* 선택된 이미지 수 표시 */}
                        {(selectedUploadedIndices.size > 0 || selectedGeneratedIndices.size > 0) && (
                            <div className="text-[11px] text-white text-center">
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
                                className={`w-full py-1.5 text-[11px] font-medium rounded transition-colors ${isRemovingBg || productFiles.length === 0 ? 'bg-[#3c3c3c] text-[#666]' : 'bg-[#2c2c2c] text-white hover:bg-[#3c3c3c] border border-[#3c3c3c]'}`}
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

                        <ProductEnhancementPanel productFiles={productFiles} lang={lang} onResultsUpdate={(results: any) => {
                            const doneResults = results.filter((r: any) => r.status === 'done' && r.url);
                            if (doneResults.length > 0) {
                                const newUrls = doneResults.map((r: any) => r.url!);
                                setGeneratedImages(prev => [...prev, ...newUrls.filter((url: string) => !prev.includes(url))]);
                            }
                        }} onAddSectionWithImage={onAddSectionWithImage} />
                    </div>
                )}

                {activeSection === 'models' && <ModelChapterPanel data={data} onUpdate={onUpdate} lang={lang} />}
                {activeSection === 'contents' && <ContentGeneratorPanel productImages={productFiles.map((f: File) => URL.createObjectURL(f))} onAddToPreview={onAddSectionWithImage} lang={lang} />}

                {activeSection === 'closeup' && (
                    <div className="space-y-2">
                        {/* 텍스트 요소 */}
                        <div className="bg-[#252525] rounded p-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[12px] font-medium text-[#999]">{lang === 'ko' ? '텍스트 요소' : 'Text Elements'}</span>
                                <button onClick={handleAddText} className="px-1.5 py-0.5 bg-white text-black text-[11px] font-medium rounded hover:bg-[#e5e5e5]">+</button>
                            </div>
                            <div className="text-[11px] text-[#666] mb-2">Active: <span className="text-white">{previewActiveSection || 'None'}</span></div>
                            <div className="space-y-1 max-h-[120px] overflow-y-auto">
                                {textElements.map((text: TextElement) => (
                                    <div key={text.id} onClick={() => setSelectedTextId(text.id)} className={`p-1.5 rounded cursor-pointer flex justify-between items-center ${selectedTextId === text.id ? 'bg-white/20 ring-1 ring-white' : 'bg-[#2c2c2c] hover:bg-[#3c3c3c]'}`}>
                                        <span className="text-[12px] truncate max-w-[100px] text-white">{text.content}</span>
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteTextElement?.(text.id); }} className="text-[#666] hover:text-red-400 text-[10px]">×</button>
                                    </div>
                                ))}
                                {textElements.length === 0 && <div className="text-center text-[#666] text-[12px] py-4">{lang === 'ko' ? '텍스트 없음' : 'No text'}</div>}
                            </div>
                            {selectedText && onUpdateTextElement && (
                                <div className="border-t border-[#3c3c3c] pt-2 mt-2 space-y-1.5">
                                    <textarea className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[12px] text-white resize-none focus:border-white focus:outline-none" rows={2} value={selectedText.content} onChange={(e) => onUpdateTextElement(selectedText.id, 'content', e.target.value)} />
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <input type="number" className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[12px] text-white focus:border-white focus:outline-none" value={selectedText.fontSize} onChange={(e) => onUpdateTextElement(selectedText.id, 'fontSize', parseInt(e.target.value))} />
                                        <input type="color" className="w-full h-6 bg-[#2c2c2c] border border-[#3c3c3c] rounded cursor-pointer" value={selectedText.color || '#000000'} onChange={(e) => onUpdateTextElement(selectedText.id, 'color', e.target.value)} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 선 추가 */}
                        <div className="bg-[#252525] rounded p-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[12px] font-medium text-[#999]">{lang === 'ko' ? '선 추가' : 'Add Line'}</span>
                                <button onClick={handleAddLine} className="px-1.5 py-0.5 bg-white text-black text-[11px] font-medium rounded hover:bg-[#e5e5e5]">+</button>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <label className="text-[11px] text-[#666] block mb-1">{lang === 'ko' ? '선 종류' : 'Line Type'}</label>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setLineType('straight')}
                                            className={`flex-1 py-1 text-[11px] rounded ${lineType === 'straight' ? 'bg-white/20 text-white border border-white/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c] hover:border-[#555]'}`}
                                        >
                                            ─ {lang === 'ko' ? '직선' : 'Straight'}
                                        </button>
                                        <button
                                            onClick={() => setLineType('curved')}
                                            className={`flex-1 py-1 text-[11px] rounded ${lineType === 'curved' ? 'bg-white/20 text-white border border-white/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c] hover:border-[#555]'}`}
                                        >
                                            ⌒ {lang === 'ko' ? '곡선' : 'Curved'}
                                        </button>
                                        <button
                                            onClick={() => setLineType('angled')}
                                            className={`flex-1 py-1 text-[11px] rounded ${lineType === 'angled' ? 'bg-white/20 text-white border border-white/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c] hover:border-[#555]'}`}
                                        >
                                            └ {lang === 'ko' ? '꺾은선' : 'Angled'}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] text-[#666] block mb-1">{lang === 'ko' ? '굵기' : 'Width'}: {lineWidth}px</label>
                                        <input
                                            type="range"
                                            min="1"
                                            max="10"
                                            value={lineWidth}
                                            onChange={(e) => setLineWidth(parseInt(e.target.value))}
                                            className="w-full h-auto accent-white cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-[#666] block mb-1">{lang === 'ko' ? '끝선' : 'End Cap'}</label>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => { setLineCap('round'); setLineEnd('none'); }}
                                                className={`flex-1 py-1 text-[11px] rounded ${lineCap === 'round' && lineEnd === 'none' ? 'bg-white/20 text-white border border-white/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c]'}`}
                                            >●</button>
                                            <button
                                                onClick={() => { setLineCap('square'); setLineEnd('none'); }}
                                                className={`flex-1 py-1 text-[11px] rounded ${lineCap === 'square' && lineEnd === 'none' ? 'bg-white/20 text-white border border-white/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c]'}`}
                                            >■</button>
                                            <button
                                                onClick={() => setLineEnd('arrow')}
                                                className={`flex-1 py-1 text-[11px] rounded ${lineEnd === 'arrow' ? 'bg-white/20 text-white border border-white/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c]'}`}
                                            >→</button>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] text-[#666] block mb-1">{lang === 'ko' ? '색상' : 'Color'}</label>
                                    <input
                                        type="color"
                                        value={lineColor}
                                        onChange={(e) => setLineColor(e.target.value)}
                                        className="w-full h-6 bg-[#2c2c2c] border border-[#3c3c3c] rounded cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 그리드/콜라주 추가 */}
                        <div className="bg-[#252525] rounded p-2">
                            <div
                                className="flex justify-between items-center cursor-pointer hover:bg-[#2c2c2c] -mx-2 -mt-2 px-2 pt-2 pb-2 rounded-t"
                                onClick={() => toggleSection('grid')}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] text-[#555] transition-transform ${collapsedSections.grid ? '' : 'rotate-90'}`}>▶</span>
                                    <span className="text-[12px] font-medium text-[#999]">{lang === 'ko' ? '그리드/콜라주' : 'Grid/Collage'}</span>
                                </div>
                                <span className="text-[11px] text-white">{gridCols}×{gridRows}</span>
                            </div>
                            {!collapsedSections.grid && (
                                <div className="space-y-2 mt-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[11px] text-[#666] block mb-1">{lang === 'ko' ? '가로 칸' : 'Columns'}</label>
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4].map(n => (
                                                    <button
                                                        key={n}
                                                        onClick={() => setGridCols(n)}
                                                        className={`flex-1 py-1 text-[12px] font-bold rounded ${n === gridCols ? 'bg-white/20 text-white border border-white/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c] hover:border-[#555]'}`}
                                                    >
                                                        {n}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[11px] text-[#666] block mb-1">{lang === 'ko' ? '세로 칸' : 'Rows'}</label>
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4].map(n => (
                                                    <button
                                                        key={n}
                                                        onClick={() => setGridRows(n)}
                                                        className={`flex-1 py-1 text-[12px] font-bold rounded ${n === gridRows ? 'bg-white/20 text-white border border-white/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c] hover:border-[#555]'}`}
                                                    >
                                                        {n}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleAddGrid}
                                        className="w-full py-1.5 text-[12px] font-medium rounded bg-white text-black hover:bg-[#e5e5e5] transition-colors"
                                    >
                                        + {lang === 'ko' ? '그리드 섹션 추가' : 'Add Grid Section'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 퀵 트랜지션 섹션 */}
                        <div className="bg-[#252525] rounded p-2">
                            <div
                                className="flex justify-between items-center cursor-pointer hover:bg-[#2c2c2c] -mx-2 -mt-2 px-2 pt-2 pb-2 rounded-t"
                                onClick={() => toggleSection('transition')}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] text-[#555] transition-transform ${collapsedSections.transition ? '' : 'rotate-90'}`}>▶</span>
                                    <span className="text-[12px] font-medium text-[#999]">{lang === 'ko' ? '트랜지션 효과' : 'Transition Effects'}</span>
                                </div>
                                <label className="flex items-center gap-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={data.enableTransitions !== false}
                                        onChange={(e) => onUpdate({ ...data, enableTransitions: e.target.checked })}
                                        className="w-3 h-3 rounded border-[#555] bg-[#2c2c2c] accent-white"
                                    />
                                    <span className="text-[10px] text-[#666]">{lang === 'ko' ? '활성화' : 'Enable'}</span>
                                </label>
                            </div>
                            {!collapsedSections.transition && data.enableTransitions !== false && (
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-[11px] text-[#666] block mb-1">{lang === 'ko' ? '효과 종류' : 'Effect Type'}</label>
                                        <div className="flex gap-1">
                                            {[
                                                { id: 'fade', label: lang === 'ko' ? '페이드' : 'Fade' },
                                                { id: 'slide', label: lang === 'ko' ? '슬라이드' : 'Slide' },
                                                { id: 'zoom', label: lang === 'ko' ? '줌' : 'Zoom' }
                                            ].map(effect => (
                                                <button
                                                    key={effect.id}
                                                    onClick={() => onUpdate({ ...data, transitionType: effect.id })}
                                                    className={`flex-1 py-1 text-[11px] rounded ${(data.transitionType || 'fade') === effect.id ? 'bg-white/20 text-white border border-white/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c] hover:border-[#555]'}`}
                                                >
                                                    {effect.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-[#666] block mb-1">
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
                                        />
                                    </div>
                                    <p className="text-[9px] text-[#555]">
                                        * {lang === 'ko' ? '섹션 간 스크롤 시 애니메이션이 적용됩니다' : 'Animation applied when scrolling between sections'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* AI 제품 분석 섹션 */}
                        <div className="bg-[#252525] rounded p-2">
                            <div
                                className="flex justify-between items-center cursor-pointer hover:bg-[#2c2c2c] -mx-2 -mt-2 px-2 pt-2 pb-2 rounded-t"
                                onClick={() => toggleSection('aiAnalysis')}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] text-[#555] transition-transform ${collapsedSections.aiAnalysis ? '' : 'rotate-90'}`}>▶</span>
                                    <span className="text-[12px] font-medium text-[#999]">{lang === 'ko' ? 'AI 제품 분석' : 'AI Product Analysis'}</span>
                                </div>
                                <span className="text-[7px] text-white">✨ AI</span>
                            </div>
                            {!collapsedSections.aiAnalysis && (
                                <div className="space-y-2 mt-2">
                                    <p className="text-[11px] text-[#666]">
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

                                                                        const doc = iframe.contentDocument || iframe.contentWindow?.document;
                                                                        if (!doc) { document.body.removeChild(iframe); reject(new Error('iframe 생성 실패')); return; }

                                                                        doc.open();
                                                                        doc.write(`<!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:white;font-family:'Noto Sans KR',sans-serif;}</style></head><body>${htmlContent}</body></html>`);
                                                                        doc.close();

                                                                        setTimeout(async () => {
                                                                            try {
                                                                                const html2canvasModule = await import('html2canvas');
                                                                                const html2canvas = html2canvasModule.default;
                                                                                const canvas = await html2canvas(doc.body, {
                                                                                    width: 800,
                                                                                    backgroundColor: '#ffffff',
                                                                                    useCORS: true,
                                                                                    scale: 2
                                                                                });
                                                                                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                                                                                document.body.removeChild(iframe);
                                                                                resolve(dataUrl);
                                                                            } catch (e) {
                                                                                document.body.removeChild(iframe);
                                                                                reject(e);
                                                                            }
                                                                        }, 500);
                                                                    });
                                                                };

                                                                // Size Guide 섹션 추가
                                                                if (data.showSizeGuide !== false) {
                                                                    try {
                                                                        const sizeGuideImg = await htmlToImage(`
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
                                                                        </div>
                                                                    `, 'Size Guide');
                                                                        onAddSectionWithImage?.(sizeGuideImg, 'size-guide');
                                                                    } catch (e) { console.error('Size Guide 변환 실패:', e); }
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
                        <div className="bg-[#252525] rounded p-2">
                            <div
                                className="flex justify-between items-center cursor-pointer hover:bg-[#2c2c2c] -mx-2 -mt-2 px-2 pt-2 pb-2 rounded-t"
                                onClick={() => toggleSection('sizeGuide')}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] text-[#555] transition-transform ${collapsedSections.sizeGuide ? '' : 'rotate-90'}`}>▶</span>
                                    <span className="text-[12px] font-medium text-[#999]">{lang === 'ko' ? 'SIZE GUIDE 수정' : 'SIZE GUIDE Edit'}</span>
                                </div>
                            </div>
                            {!collapsedSections.sizeGuide && (
                                <div className="space-y-2 mt-2">
                                    <div>
                                        <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '기준 사이즈' : 'Base Size'}</label>
                                        <input
                                            type="text"
                                            value={data.sizeGuideContent?.baseSize || '250'}
                                            onChange={(e) => onUpdate({ ...data, sizeGuideContent: { ...data.sizeGuideContent, baseSize: e.target.value } })}
                                            className="w-full px-2 py-1 bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[11px] text-white"
                                            placeholder="250"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '사이즈' : 'Size'}</label>
                                            <select
                                                value={data.sizeGuideContent?.sizeLevel || 'normal'}
                                                onChange={(e) => onUpdate({ ...data, sizeGuideContent: { ...data.sizeGuideContent, sizeLevel: e.target.value } })}
                                                className="w-full px-2 py-1 bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[11px] text-white"
                                            >
                                                <option value="small">{lang === 'ko' ? '작음' : 'Small'}</option>
                                                <option value="normal">{lang === 'ko' ? '보통' : 'Normal'}</option>
                                                <option value="large">{lang === 'ko' ? '여유' : 'Large'}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '발볼' : 'Width'}</label>
                                            <select
                                                value={data.sizeGuideContent?.widthLevel || 'normal'}
                                                onChange={(e) => onUpdate({ ...data, sizeGuideContent: { ...data.sizeGuideContent, widthLevel: e.target.value } })}
                                                className="w-full px-2 py-1 bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[11px] text-white"
                                            >
                                                <option value="narrow">{lang === 'ko' ? '좁음' : 'Narrow'}</option>
                                                <option value="normal">{lang === 'ko' ? '보통' : 'Normal'}</option>
                                                <option value="wide">{lang === 'ko' ? '넓음' : 'Wide'}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '무게' : 'Weight'}</label>
                                            <select
                                                value={data.sizeGuideContent?.weightLevel || 'normal'}
                                                onChange={(e) => onUpdate({ ...data, sizeGuideContent: { ...data.sizeGuideContent, weightLevel: e.target.value } })}
                                                className="w-full px-2 py-1 bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[11px] text-white"
                                            >
                                                <option value="light">{lang === 'ko' ? '가벼움' : 'Light'}</option>
                                                <option value="normal">{lang === 'ko' ? '보통' : 'Normal'}</option>
                                                <option value="heavy">{lang === 'ko' ? '무거움' : 'Heavy'}</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '글꼴 크기' : 'Font Size'}: {data.sizeGuideContent?.fontSize || 14}px</label>
                                        <input
                                            type="range"
                                            min="10"
                                            max="24"
                                            value={data.sizeGuideContent?.fontSize || 14}
                                            onChange={(e) => onUpdate({ ...data, sizeGuideContent: { ...data.sizeGuideContent, fontSize: parseInt(e.target.value) } })}
                                            className="minimal-slider"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* A/S 안내 수정 */}
                        <div className="bg-[#252525] rounded p-2">
                            <div
                                className="flex justify-between items-center cursor-pointer hover:bg-[#2c2c2c] -mx-2 -mt-2 px-2 pt-2 pb-2 rounded-t"
                                onClick={() => toggleSection('asInfo')}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] text-[#555] transition-transform ${collapsedSections.asInfo ? '' : 'rotate-90'}`}>▶</span>
                                    <span className="text-[12px] font-medium text-[#999]">{lang === 'ko' ? 'A/S 안내 수정' : 'A/S Info Edit'}</span>
                                </div>
                            </div>
                            {!collapsedSections.asInfo && (
                                <div className="space-y-2 mt-2">
                                    <div>
                                        <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '제목' : 'Title'}</label>
                                        <input
                                            type="text"
                                            value={data.asInfoContent?.title || 'A/S 안내'}
                                            onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, title: e.target.value } })}
                                            className="w-full px-2 py-1 bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[11px] text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '고객센터 번호' : 'Contact Number'}</label>
                                        <input
                                            type="text"
                                            value={data.asInfoContent?.phone || '000-0000-0000'}
                                            onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, phone: e.target.value } })}
                                            className="w-full px-2 py-1 bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[11px] text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '안내 사항 1' : 'Info 1'}</label>
                                        <textarea
                                            value={data.asInfoContent?.info1 || '제품 상태 확인 후 정확한 안내가 가능합니다.\n사진/영상 자료와 함께 문의해 주세요.'}
                                            onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, info1: e.target.value } })}
                                            className="w-full px-2 py-1 bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[11px] text-white min-h-[50px]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '주의사항 (빨간색)' : 'Cautions (Red)'}</label>
                                        <textarea
                                            value={data.asInfoContent?.cautions || '가죽 특성상 개체별 색감 차이가 있을 수 있습니다.\n사이즈 확인 시 제품 하자 발생 시 교환/환불이 불가합니다.'}
                                            onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, cautions: e.target.value } })}
                                            className="w-full px-2 py-1 bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[11px] text-white min-h-[50px]"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '글꼴 크기' : 'Font'}: {data.asInfoContent?.fontSize || 14}px</label>
                                            <input
                                                type="range"
                                                min="10"
                                                max="24"
                                                value={data.asInfoContent?.fontSize || 14}
                                                onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, fontSize: parseInt(e.target.value) } })}
                                                className="minimal-slider"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '너비' : 'Width'}: {data.asInfoContent?.width || 100}%</label>
                                            <input
                                                type="range"
                                                min="50"
                                                max="100"
                                                value={data.asInfoContent?.width || 100}
                                                onChange={(e) => onUpdate({ ...data, asInfoContent: { ...data.asInfoContent, width: parseInt(e.target.value) } })}
                                                className="minimal-slider"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 기타 주의사항 수정 */}
                        <div className="bg-[#252525] rounded p-2">
                            <div
                                className="flex justify-between items-center cursor-pointer hover:bg-[#2c2c2c] -mx-2 -mt-2 px-2 pt-2 pb-2 rounded-t"
                                onClick={() => toggleSection('precautions')}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] text-[#555] transition-transform ${collapsedSections.precautions ? '' : 'rotate-90'}`}>▶</span>
                                    <span className="text-[12px] font-medium text-[#999]">{lang === 'ko' ? '기타 주의사항 수정' : 'Precautions Edit'}</span>
                                </div>
                            </div>
                            {!collapsedSections.precautions && (
                                <div className="space-y-2 mt-2">
                                    <div>
                                        <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '제목' : 'Title'}</label>
                                        <input
                                            type="text"
                                            value={data.precautionsContent?.title || '기타 주의 사항'}
                                            onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, title: e.target.value } })}
                                            className="w-full px-2 py-1 bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[11px] text-white"
                                        />
                                    </div>
                                    {[1, 2, 3, 4].map((idx) => (
                                        <div key={idx} className="grid grid-cols-[80px_1fr] gap-2">
                                            <input
                                                type="text"
                                                value={data.precautionsContent?.[`item${idx}Title`] || ['습기 주의', '직사광선 주의', '보관 방법', '오염 관리'][idx - 1]}
                                                onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, [`item${idx}Title`]: e.target.value } })}
                                                className="px-2 py-1 bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[10px] text-white"
                                                placeholder={`항목 ${idx}`}
                                            />
                                            <input
                                                type="text"
                                                value={data.precautionsContent?.[`item${idx}Desc`] || ['가죽 제품은 습기에 약해 변색이나 얼룩이 생길 수 있습니다.', '직사광선에 장시간 노출 시 가죽 변색 우려가 있습니다.', '통기성 좋은 천 커버를 사용해 주세요.', '가죽 전용 클리너를 이용해 주세요.'][idx - 1]}
                                                onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, [`item${idx}Desc`]: e.target.value } })}
                                                className="px-2 py-1 bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[10px] text-white"
                                                placeholder={`설명 ${idx}`}
                                            />
                                        </div>
                                    ))}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '글꼴 크기' : 'Font'}: {data.precautionsContent?.fontSize || 14}px</label>
                                            <input
                                                type="range"
                                                min="10"
                                                max="24"
                                                value={data.precautionsContent?.fontSize || 14}
                                                onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, fontSize: parseInt(e.target.value) } })}
                                                className="minimal-slider"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-[#666] block mb-1">{lang === 'ko' ? '너비' : 'Width'}: {data.precautionsContent?.width || 100}%</label>
                                            <input
                                                type="range"
                                                min="50"
                                                max="100"
                                                value={data.precautionsContent?.width || 100}
                                                onChange={(e) => onUpdate({ ...data, precautionsContent: { ...data.precautionsContent, width: parseInt(e.target.value) } })}
                                                className="minimal-slider"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}