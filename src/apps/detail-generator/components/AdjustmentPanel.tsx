import React, { useState, useRef } from 'react';
import { generateAICopywriting } from '../services/geminiAICopywriter';
import { prepareImageForReplacement, batchShoeReplacement } from '../services/shoeReplacementService';
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
            const productImage = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target?.result); reader.onerror = reject; reader.readAsDataURL(productFile); });
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
            const productBase64 = productImage.includes('base64,') ? productImage.split('base64,')[1] : productImage;
            const results = await batchShoeReplacement(allImageUrls, productBase64, (current, total) => setReplaceProgress({ current, total }));
            const newImageUrls = { ...data.imageUrls };
            let successCount = 0;
            results.forEach((result, idx) => {
                if (result.result) {
                    Object.entries(newImageUrls).forEach(([key, url]) => {
                        if (url === allImageUrls[idx]) { newImageUrls[key] = result.result; successCount++; }
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
                        <div><label className="text-[9px] text-[#666] mb-0.5 block">{lang === 'ko' ? '컬러' : 'Color'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[10px] text-white focus:border-[#0d99ff] focus:outline-none" value={data.heroTextContent?.specColor || ''} onChange={(e) => updateHeroContent('specColor', e.target.value)} /></div>
                        <div><label className="text-[9px] text-[#666] mb-0.5 block">{lang === 'ko' ? '갑피' : 'Upper'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[10px] text-white focus:border-[#0d99ff] focus:outline-none" value={data.heroTextContent?.specUpper || ''} onChange={(e) => updateHeroContent('specUpper', e.target.value)} /></div>
                        <div><label className="text-[9px] text-[#666] mb-0.5 block">{lang === 'ko' ? '안감' : 'Lining'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[10px] text-white focus:border-[#0d99ff] focus:outline-none" value={data.heroTextContent?.specLining || ''} onChange={(e) => updateHeroContent('specLining', e.target.value)} /></div>
                        <div><label className="text-[9px] text-[#666] mb-0.5 block">{lang === 'ko' ? '밑창' : 'Outsole'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[10px] text-white focus:border-[#0d99ff] focus:outline-none" value={data.heroTextContent?.specOutsole || ''} onChange={(e) => updateHeroContent('specOutsole', e.target.value)} /></div>
                        <div><label className="text-[9px] text-[#666] mb-0.5 block">{lang === 'ko' ? '원산지' : 'Origin'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[10px] text-white focus:border-[#0d99ff] focus:outline-none" value={data.heroTextContent?.specOrigin || ''} onChange={(e) => updateHeroContent('specOrigin', e.target.value)} /></div>
                        <div><label className="text-[9px] text-[#666] mb-0.5 block">{lang === 'ko' ? '굽높이' : 'Heel'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[10px] text-white focus:border-[#0d99ff] focus:outline-none" value={data.heroTextContent?.heelHeight || ''} onChange={(e) => updateHeroContent('heelHeight', e.target.value)} /></div>
                    </div>
                </FieldToggleControl>
            );
        }
        if (isHeightSpec) {
            return (
                <FieldToggleControl key={id} fieldId={id} label={displayLabel} isVisible={isVisible} onToggleVisibility={() => updateFieldSetting(id, 'visible', !isVisible)} fontSize={fontSize} onFontSizeChange={(size: number) => updateFieldSetting(id, 'fontSize', size)} draggable onDragStart={handleDragStart(id)} onDragOver={handleDragOver} onDrop={handleDrop(id)}>
                    <div className="grid grid-cols-3 gap-2">
                        <div><label className="text-[9px] text-[#666] mb-0.5 block">{lang === 'ko' ? '아웃솔' : 'Outsole'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[10px] text-white focus:border-[#0d99ff] focus:outline-none" value={data.heroTextContent?.outsole || ''} onChange={(e) => updateHeroContent('outsole', e.target.value)} placeholder="3cm" /></div>
                        <div><label className="text-[9px] text-[#666] mb-0.5 block">{lang === 'ko' ? '인솔' : 'Insole'}</label><input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[10px] text-white focus:border-[#0d99ff] focus:outline-none" value={data.heroTextContent?.insole || ''} onChange={(e) => updateHeroContent('insole', e.target.value)} placeholder="1.5cm" /></div>
                        <div><label className="text-[9px] text-[#0d99ff] mb-0.5 block font-medium">{lang === 'ko' ? '총 높이' : 'Total'}</label><input className="w-full bg-[#0d99ff]/10 border border-[#0d99ff]/50 rounded px-2 py-1 text-[10px] text-[#0d99ff] font-medium focus:border-[#0d99ff] focus:outline-none" value={data.heroTextContent?.totalHeight || ''} onChange={(e) => updateHeroContent('totalHeight', e.target.value)} placeholder="4.5cm" /></div>
                    </div>
                </FieldToggleControl>
            );
        }
        return (
            <FieldToggleControl key={id} fieldId={id} label={displayLabel} isVisible={isVisible} onToggleVisibility={() => updateFieldSetting(id, 'visible', !isVisible)} fontSize={fontSize} onFontSizeChange={(size: number) => updateFieldSetting(id, 'fontSize', size)} draggable onDragStart={handleDragStart(id)} onDragOver={handleDragOver} onDrop={handleDrop(id)}>
                {multiline ? <textarea rows={2} className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[10px] text-white resize-none focus:border-[#0d99ff] focus:outline-none" value={data.heroTextContent?.[id] || ''} onChange={(e) => updateHeroContent(id, e.target.value)} />
                    : <input className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[10px] text-white focus:border-[#0d99ff] focus:outline-none" value={data.heroTextContent?.[id] || ''} onChange={(e) => updateHeroContent(id, e.target.value)} />}
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
            {/* 헤더 */}
            <div className="flex-shrink-0 h-7 bg-[#2c2c2c] border-b border-[#3c3c3c] flex items-center justify-between px-2">
                <span className="text-[9px] font-medium tracking-wide text-white">Design</span>
                <div className="flex items-center bg-[#1e1e1e] rounded overflow-hidden">
                    <button onClick={() => setLang('ko')} className={`px-1 py-0.5 text-[7px] font-medium transition-colors ${lang === 'ko' ? 'bg-[#0d99ff] text-white' : 'text-[#666] hover:text-white'}`}>KR</button>
                    <button onClick={() => setLang('en')} className={`px-1 py-0.5 text-[7px] font-medium transition-colors ${lang === 'en' ? 'bg-[#0d99ff] text-white' : 'text-[#666] hover:text-white'}`}>EN</button>
                </div>
            </div>

            {/* 탭 */}
            <div className="flex-shrink-0 border-b border-[#3c3c3c] bg-[#252525]">
                <nav className="flex">
                    {sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`flex-1 px-1 py-2 text-[9px] font-medium transition-colors ${activeSection === section.id
                                ? 'text-white bg-[#1e1e1e] border-b-2 border-[#0d99ff]'
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
                            <span className="text-[9px] font-medium text-[#999]">{lang === 'ko' ? '히어로 섹션' : 'Hero Section'}</span>
                            <button onClick={handleAIAnalysis} disabled={isGeneratingAI} className={`px-1.5 py-0.5 text-[8px] font-medium rounded transition-colors ${isGeneratingAI ? 'bg-[#3c3c3c] text-[#666]' : 'bg-[#0d99ff] text-white hover:bg-[#0b87e0]'}`}>
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
                            className="w-full bg-[#0d99ff] text-white text-[8px] font-medium py-1 rounded hover:bg-[#0b87e0] transition-colors mt-2"
                        >
                            {lang === 'ko' ? 'HTML 내보내기' : 'Export HTML'}
                        </button>
                    </div>
                )}

                {activeSection === 'products' && (
                    <div className="space-y-2">
                        {/* 제품 업로드 - 1:1 비율 */}
                        <div
                            className={`aspect-square border border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${productDragActive ? 'border-[#0d99ff] bg-[#0d99ff]/10' : 'border-[#3c3c3c] hover:border-[#555]'}`}
                            onDragOver={handleProductDragOver}
                            onDragLeave={handleProductDragLeave}
                            onDrop={handleProductDrop}
                            onClick={() => productInputRef.current?.click()}
                        >
                            <input ref={productInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleProductFileSelect} />
                            <div className="text-[#555] text-2xl mb-1">+</div>
                            <p className="text-[9px] font-medium text-[#777]">{lang === 'ko' ? '이미지 드롭 또는 클릭' : 'Drop or click'}</p>
                            <p className="text-[8px] text-[#555]">{lang === 'ko' ? '최대 10장' : 'Max 10'}</p>
                        </div>

                        {/* 업로드된 제품 */}
                        {productFiles.length > 0 && (
                            <div className="bg-[#252525] rounded p-2">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[9px] font-medium text-[#999]">{lang === 'ko' ? '소스 이미지' : 'Source'}</span>
                                    <span className="text-[8px] text-[#666]">{productFiles.length}/10</span>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                    {productFiles.map((file: File, idx: number) => (
                                        <div key={idx} onClick={() => setSelectedProductIndex(idx)} className={`relative aspect-square rounded overflow-hidden cursor-pointer ring-1 ${selectedProductIndex === idx ? 'ring-[#0d99ff]' : 'ring-transparent hover:ring-[#555]'}`}>
                                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt={`Product ${idx}`} />
                                            <button onClick={(e) => { e.stopPropagation(); removeProductFile(idx); }} className="absolute top-0 right-0 bg-black/60 text-white w-3 h-3 rounded-full flex items-center justify-center text-[8px] hover:bg-red-500">×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 액션 버튼들 */}
                        {productFiles.length > 0 && (
                            <>
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
                                            alert(`${results.filter(r => r.result).length} ${lang === 'ko' ? '배경 제거 완료' : 'removed'}`);
                                        } catch (error) { console.error(error); alert(lang === 'ko' ? '배경 제거 실패' : 'Failed'); }
                                        finally { setIsRemovingBg(false); setBgRemoveProgress({ current: 0, total: 0 }); }
                                    }}
                                    disabled={isRemovingBg}
                                    className={`w-full py-1.5 text-[9px] font-medium rounded transition-colors ${isRemovingBg ? 'bg-[#3c3c3c] text-[#666]' : 'bg-[#2c2c2c] text-white hover:bg-[#3c3c3c] border border-[#3c3c3c]'}`}
                                >
                                    {isRemovingBg ? `${bgRemoveProgress.current}/${bgRemoveProgress.total}` : (lang === 'ko' ? '배경 제거' : 'Remove BG')}
                                </button>

                                <button onClick={handleShoeReplacement} disabled={productFiles.length === 0 || isReplacingShoes}
                                    className={`w-full py-1.5 text-[9px] font-medium rounded transition-colors ${productFiles.length === 0 || isReplacingShoes ? 'bg-[#3c3c3c] text-[#666]' : 'bg-[#0d99ff] text-white hover:bg-[#0b87e0]'}`}>
                                    {isReplacingShoes ? `${replaceProgress.current}/${replaceProgress.total}` : (lang === 'ko' ? '신발 교체' : 'Replace Shoes')}
                                </button>
                            </>
                        )}

                        <ProductEnhancementPanel productFiles={productFiles} onResultsUpdate={(results: any) => {
                            const doneResults = results.filter((r: any) => r.status === 'done' && r.url);
                            if (doneResults.length > 0) {
                                const newUrls = doneResults.map((r: any) => r.url!);
                                const currentUrls = data.imageUrls?.products || [];
                                const uniqueNewUrls = newUrls.filter((url: string) => !currentUrls.includes(url));
                                if (uniqueNewUrls.length > 0) { onUpdate({ ...data, imageUrls: { ...data.imageUrls, products: [...currentUrls, ...uniqueNewUrls] } }); }
                            }
                        }} onAddSectionWithImage={onAddSectionWithImage} />
                    </div>
                )}

                {activeSection === 'models' && <ModelChapterPanel data={data} onUpdate={onUpdate} />}
                {activeSection === 'contents' && <ContentGeneratorPanel productImages={data.imageUrls?.products || []} />}

                {activeSection === 'closeup' && (
                    <div className="space-y-2">
                        {/* 텍스트 요소 */}
                        <div className="bg-[#252525] rounded p-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] font-medium text-[#999]">{lang === 'ko' ? '텍스트 요소' : 'Text Elements'}</span>
                                <button onClick={handleAddText} className="px-1.5 py-0.5 bg-[#0d99ff] text-white text-[8px] font-medium rounded hover:bg-[#0b87e0]">+</button>
                            </div>
                            <div className="text-[8px] text-[#666] mb-2">Active: <span className="text-[#0d99ff]">{previewActiveSection || 'None'}</span></div>
                            <div className="space-y-1 max-h-[120px] overflow-y-auto">
                                {textElements.map((text: TextElement) => (
                                    <div key={text.id} onClick={() => setSelectedTextId(text.id)} className={`p-1.5 rounded cursor-pointer flex justify-between items-center ${selectedTextId === text.id ? 'bg-[#0d99ff]/20 ring-1 ring-[#0d99ff]' : 'bg-[#2c2c2c] hover:bg-[#3c3c3c]'}`}>
                                        <span className="text-[9px] truncate max-w-[100px] text-white">{text.content}</span>
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteTextElement?.(text.id); }} className="text-[#666] hover:text-red-400 text-[10px]">×</button>
                                    </div>
                                ))}
                                {textElements.length === 0 && <div className="text-center text-[#666] text-[9px] py-4">{lang === 'ko' ? '텍스트 없음' : 'No text'}</div>}
                            </div>
                            {selectedText && onUpdateTextElement && (
                                <div className="border-t border-[#3c3c3c] pt-2 mt-2 space-y-1.5">
                                    <textarea className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[9px] text-white resize-none focus:border-[#0d99ff] focus:outline-none" rows={2} value={selectedText.content} onChange={(e) => onUpdateTextElement(selectedText.id, 'content', e.target.value)} />
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <input type="number" className="w-full bg-[#2c2c2c] border border-[#3c3c3c] rounded px-2 py-1 text-[9px] text-white focus:border-[#0d99ff] focus:outline-none" value={selectedText.fontSize} onChange={(e) => onUpdateTextElement(selectedText.id, 'fontSize', parseInt(e.target.value))} />
                                        <input type="color" className="w-full h-6 bg-[#2c2c2c] border border-[#3c3c3c] rounded cursor-pointer" value={selectedText.color || '#000000'} onChange={(e) => onUpdateTextElement(selectedText.id, 'color', e.target.value)} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 선 추가 */}
                        <div className="bg-[#252525] rounded p-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] font-medium text-[#999]">{lang === 'ko' ? '선 추가' : 'Add Line'}</span>
                                <button onClick={handleAddLine} className="px-1.5 py-0.5 bg-[#0d99ff] text-white text-[8px] font-medium rounded hover:bg-[#0b87e0]">+</button>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <label className="text-[8px] text-[#666] block mb-1">{lang === 'ko' ? '선 종류' : 'Line Type'}</label>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setLineType('straight')}
                                            className={`flex-1 py-1 text-[8px] rounded ${lineType === 'straight' ? 'bg-[#0d99ff]/20 text-[#0d99ff] border border-[#0d99ff]/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c] hover:border-[#555]'}`}
                                        >
                                            ─ {lang === 'ko' ? '직선' : 'Straight'}
                                        </button>
                                        <button
                                            onClick={() => setLineType('curved')}
                                            className={`flex-1 py-1 text-[8px] rounded ${lineType === 'curved' ? 'bg-[#0d99ff]/20 text-[#0d99ff] border border-[#0d99ff]/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c] hover:border-[#555]'}`}
                                        >
                                            ⌒ {lang === 'ko' ? '곡선' : 'Curved'}
                                        </button>
                                        <button
                                            onClick={() => setLineType('angled')}
                                            className={`flex-1 py-1 text-[8px] rounded ${lineType === 'angled' ? 'bg-[#0d99ff]/20 text-[#0d99ff] border border-[#0d99ff]/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c] hover:border-[#555]'}`}
                                        >
                                            └ {lang === 'ko' ? '꺾은선' : 'Angled'}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[8px] text-[#666] block mb-1">{lang === 'ko' ? '굵기' : 'Width'}: {lineWidth}px</label>
                                        <input
                                            type="range"
                                            min="1"
                                            max="10"
                                            value={lineWidth}
                                            onChange={(e) => setLineWidth(parseInt(e.target.value))}
                                            className="w-full h-1 bg-[#3c3c3c] rounded appearance-none cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[8px] text-[#666] block mb-1">{lang === 'ko' ? '끝선' : 'End Cap'}</label>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => { setLineCap('round'); setLineEnd('none'); }}
                                                className={`flex-1 py-1 text-[8px] rounded ${lineCap === 'round' && lineEnd === 'none' ? 'bg-[#0d99ff]/20 text-[#0d99ff] border border-[#0d99ff]/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c]'}`}
                                            >●</button>
                                            <button
                                                onClick={() => { setLineCap('square'); setLineEnd('none'); }}
                                                className={`flex-1 py-1 text-[8px] rounded ${lineCap === 'square' && lineEnd === 'none' ? 'bg-[#0d99ff]/20 text-[#0d99ff] border border-[#0d99ff]/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c]'}`}
                                            >■</button>
                                            <button
                                                onClick={() => setLineEnd('arrow')}
                                                className={`flex-1 py-1 text-[8px] rounded ${lineEnd === 'arrow' ? 'bg-[#0d99ff]/20 text-[#0d99ff] border border-[#0d99ff]/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c]'}`}
                                            >→</button>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[8px] text-[#666] block mb-1">{lang === 'ko' ? '색상' : 'Color'}</label>
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
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] font-medium text-[#999]">{lang === 'ko' ? '그리드/콜라주' : 'Grid/Collage'}</span>
                                <span className="text-[8px] text-[#0d99ff]">{gridCols}×{gridRows}</span>
                            </div>
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[8px] text-[#666] block mb-1">{lang === 'ko' ? '가로 칸' : 'Columns'}</label>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4].map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => setGridCols(n)}
                                                    className={`flex-1 py-1 text-[9px] font-bold rounded ${n === gridCols ? 'bg-[#0d99ff]/20 text-[#0d99ff] border border-[#0d99ff]/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c] hover:border-[#555]'}`}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[8px] text-[#666] block mb-1">{lang === 'ko' ? '세로 칸' : 'Rows'}</label>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4].map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => setGridRows(n)}
                                                    className={`flex-1 py-1 text-[9px] font-bold rounded ${n === gridRows ? 'bg-[#0d99ff]/20 text-[#0d99ff] border border-[#0d99ff]/50' : 'bg-[#2c2c2c] text-[#666] border border-[#3c3c3c] hover:border-[#555]'}`}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {/* 그리드 미리보기 */}
                                <div className="aspect-video bg-[#1e1e1e] rounded border border-[#3c3c3c] p-1">
                                    <div
                                        className="w-full h-full grid gap-0.5"
                                        style={{
                                            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                                            gridTemplateRows: `repeat(${gridRows}, 1fr)`
                                        }}
                                    >
                                        {Array.from({ length: gridCols * gridRows }).map((_, i) => (
                                            <div key={i} className="bg-[#2c2c2c] rounded-sm flex items-center justify-center text-[#555] text-[8px]">
                                                {i + 1}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={handleAddGrid}
                                    className="w-full py-1.5 text-[9px] font-medium rounded bg-[#0d99ff] text-white hover:bg-[#0b87e0] transition-colors"
                                >
                                    + {lang === 'ko' ? '그리드 섹션 추가' : 'Add Grid Section'}
                                </button>
                            </div>
                        </div>

                        {/* AI 제품 분석 섹션 */}
                        <div className="bg-[#252525] rounded p-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] font-medium text-[#999]">{lang === 'ko' ? 'AI 제품 분석' : 'AI Product Analysis'}</span>
                                <span className="text-[7px] text-[#0d99ff]">✨ AI</span>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[8px] text-[#666]">
                                    {lang === 'ko'
                                        ? '제품 사진을 분석하여 자동으로 SIZE GUIDE, A/S 안내, 주의사항을 생성합니다.'
                                        : 'Analyze product photos to auto-generate SIZE GUIDE, A/S info, and cautions.'}
                                </p>

                                {/* 토글 옵션 */}
                                <div className="space-y-1">
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <span className="text-[8px] text-[#aaa]">📐 SIZE GUIDE (스케치)</span>
                                        <input
                                            type="checkbox"
                                            defaultChecked
                                            className="w-3 h-3 rounded border-[#555] bg-[#2c2c2c] accent-[#0d99ff]"
                                        />
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <span className="text-[8px] text-[#aaa]">🛠️ A/S 안내</span>
                                        <input
                                            type="checkbox"
                                            defaultChecked
                                            className="w-3 h-3 rounded border-[#555] bg-[#2c2c2c] accent-[#0d99ff]"
                                        />
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <span className="text-[8px] text-[#aaa]">⚠️ 기타 주의사항</span>
                                        <input
                                            type="checkbox"
                                            defaultChecked
                                            className="w-3 h-3 rounded border-[#555] bg-[#2c2c2c] accent-[#0d99ff]"
                                        />
                                    </label>
                                </div>

                                {/* 생성 버튼 */}
                                <button
                                    onClick={() => {
                                        alert('AI 제품 분석 기능이 곧 구현됩니다. 제품 사진을 업로드하면 자동으로 분석합니다.');
                                    }}
                                    className="w-full py-2 text-[9px] font-medium rounded bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90 transition-opacity"
                                >
                                    🤖 {lang === 'ko' ? 'AI 콘텐츠 자동 생성' : 'Auto Generate with AI'}
                                </button>

                                <p className="text-[7px] text-[#555] text-center">
                                    * 신발 측면(왼쪽) 사진이 필요합니다
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}