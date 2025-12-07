import React from 'react';

interface FieldSettings {
    visible?: boolean;
    fontSize?: number;
}

interface HeroSectionProps {
    content: any;
    fieldSettings?: Record<string, FieldSettings>;
    fieldOrder?: string[];
    fontFamily?: string;
}

// Default settings
const DEFAULT_SETTINGS: Record<string, { visible: boolean; fontSize: number }> = {
    brandLine: { visible: true, fontSize: 11 },
    productName: { visible: true, fontSize: 28 },
    subName: { visible: true, fontSize: 28 },
    stylingMatch: { visible: true, fontSize: 14 },
    craftsmanship: { visible: true, fontSize: 14 },
    technology: { visible: true, fontSize: 13 },
    productSpec: { visible: true, fontSize: 13 },
    heightSpec: { visible: true, fontSize: 16 },
    sizeGuide: { visible: true, fontSize: 13 },
};

// Default field order
const DEFAULT_ORDER = ['brandLine', 'productName', 'subName', 'stylingMatch', 'craftsmanship', 'technology', 'productSpec', 'heightSpec', 'sizeGuide'];

// Default placeholder text for AI
const DEFAULT_TEXT: Record<string, string> = {
    brandLine: 'BRAND NAME',
    productName: 'Sample Product',
    subName: 'Color / Model',
    stylingMatch: '🤖 AI가 검색 최적화 키워드로 스타일링 매치 정보를 자동 작성합니다',
    craftsmanship: '🤖 AI가 소재와 제작 공정을 분석하여 상세 설명을 생성합니다',
    technology: '🤖 AI가 제품 기술 특징을 분석하여 추천합니다',
    sizeGuide: '🤖 AI가 사이즈 추천 및 가이드를 자동으로 작성합니다\n평소 신는 사이즈 그대로 추천드립니다',
};

export const HeroSection: React.FC<HeroSectionProps> = ({ content, fieldSettings, fieldOrder, fontFamily = 'Noto Sans KR' }) => {
    const data = content || {};
    const settings = { ...DEFAULT_SETTINGS, ...fieldSettings };
    const order = fieldOrder || DEFAULT_ORDER;

    const isVisible = (field: string) => settings[field]?.visible !== false;
    const getFontSize = (field: string) => settings[field]?.fontSize || DEFAULT_SETTINGS[field]?.fontSize || 14;
    const getText = (field: string) => data[field] || DEFAULT_TEXT[field] || '';

    const renderField = (fieldId: string) => {
        if (!isVisible(fieldId)) return null;

        switch (fieldId) {
            case 'brandLine':
                return (
                    <div key={fieldId} style={{ fontSize: `${getFontSize('brandLine')}px`, letterSpacing: '1px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>
                        {getText('brandLine')}
                    </div>
                );

            case 'productName':
                return (
                    <h1 key={fieldId} style={{ fontSize: `${getFontSize('productName')}px`, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 16px 0', lineHeight: 1.2 }}>
                        {getText('productName')}
                        {isVisible('subName') && (
                            <>
                                <span style={{ fontWeight: 300, color: '#ccc', margin: '0 8px' }}>—</span>
                                <span style={{ color: '#666', fontSize: `${getFontSize('subName')}px` }}>{getText('subName')}</span>
                            </>
                        )}
                    </h1>
                );

            case 'subName':
                return null;

            case 'stylingMatch':
                return (
                    <div key={fieldId} style={{ marginBottom: '12px', fontSize: `${getFontSize('stylingMatch')}px`, lineHeight: 1.7, color: data.stylingMatch ? '#444' : '#9ca3af', fontStyle: data.stylingMatch ? 'normal' : 'italic', whiteSpace: 'pre-line' }}>
                        {getText('stylingMatch')}
                    </div>
                );

            case 'craftsmanship':
                return (
                    <div key={fieldId} style={{ marginBottom: '16px', fontSize: `${getFontSize('craftsmanship')}px`, lineHeight: 1.7, color: data.craftsmanship ? '#444' : '#9ca3af', fontStyle: data.craftsmanship ? 'normal' : 'italic', whiteSpace: 'pre-line' }}>
                        {getText('craftsmanship')}
                    </div>
                );

            case 'technology':
                return (
                    <div key={fieldId} style={{ backgroundColor: '#f9fafb', borderLeft: '4px solid #111', padding: '16px', marginBottom: '16px', borderRadius: '0 8px 8px 0' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700, color: '#111' }}>Technology</h3>
                        <p style={{ margin: '0', fontSize: `${getFontSize('technology')}px`, color: data.technology ? '#555' : '#9ca3af', lineHeight: 1.6, fontStyle: data.technology ? 'normal' : 'italic', whiteSpace: 'pre-line' }}>
                            {getText('technology')}
                        </p>
                    </div>
                );

            case 'productSpec':
                return (
                    <div key={fieldId} style={{ marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', marginBottom: '12px', textTransform: 'uppercase', color: '#111' }}>Product Spec</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: `${getFontSize('productSpec')}px`, borderTop: '2px solid #eee', paddingTop: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '5px' }}>
                                <span style={{ color: '#9ca3af' }}>Color</span>
                                <span style={{ fontWeight: 500 }}>{data.specColor || '🤖 AI 분석'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '5px' }}>
                                <span style={{ color: '#9ca3af' }}>Upper</span>
                                <span style={{ fontWeight: 500 }}>{data.specUpper || '🤖 AI 분석'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '5px' }}>
                                <span style={{ color: '#9ca3af' }}>Lining</span>
                                <span style={{ fontWeight: 500 }}>{data.specLining || '🤖 AI 분석'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '5px' }}>
                                <span style={{ color: '#9ca3af' }}>Outsole</span>
                                <span style={{ fontWeight: 500 }}>{data.specOutsole || '🤖 AI 분석'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '5px' }}>
                                <span style={{ color: '#9ca3af' }}>Origin</span>
                                <span style={{ fontWeight: 500 }}>{data.specOrigin || '🤖 AI 분석'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '5px' }}>
                                <span style={{ color: '#9ca3af' }}>Heel Height</span>
                                <span style={{ fontWeight: 500 }}>{data.heelHeight || '3.5cm'}</span>
                            </div>
                        </div>
                    </div>
                );

            case 'heightSpec':
                return (
                    <div key={fieldId} style={{ marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', marginBottom: '12px', textTransform: 'uppercase', color: '#111', borderBottom: '2px solid #111', paddingBottom: '4px', display: 'inline-block' }}>Height Spec</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#fff', border: '1px solid #e5e7eb', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Outsole</div>
                                <div style={{ fontWeight: 700, fontSize: `${getFontSize('heightSpec')}px`, color: '#111' }}>{data.outsole || '3cm'}</div>
                            </div>
                            <div style={{ textAlign: 'center', flex: 1, borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>
                                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Insole</div>
                                <div style={{ fontWeight: 700, fontSize: `${getFontSize('heightSpec')}px`, color: '#111' }}>{data.insole || '1.5cm'}</div>
                            </div>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '4px', fontWeight: 600 }}>Total</div>
                                <div style={{ fontWeight: 800, fontSize: `${getFontSize('heightSpec') + 2}px`, color: '#ef4444' }}>{data.totalHeight || '4.5cm'}</div>
                            </div>
                        </div>
                    </div>
                );

            case 'sizeGuide':
                const sizeGuideText = getText('sizeGuide');
                return (
                    <div key={fieldId} style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'start' }}>
                        <div style={{ background: '#ef4444', color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', flexShrink: 0, fontSize: '11px' }}>✓</div>
                        <div>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>Size Guide</h3>
                            <p style={{ margin: '0', fontSize: `${getFontSize('sizeGuide')}px`, lineHeight: 1.5, color: data.sizeGuide ? '#4b5563' : '#9ca3af', fontStyle: data.sizeGuide ? 'normal' : 'italic' }}>
                                {sizeGuideText.split('\n').map((line: string, i: number) => <React.Fragment key={i}>{line}<br /></React.Fragment>)}
                            </p>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div data-section="hero" className="hero-section" style={{ padding: '20px 40px 8px', maxWidth: '1000px', margin: '0 auto', fontFamily: `'${fontFamily}', sans-serif`, color: '#333', backgroundColor: 'white' }}>
            {order.map(fieldId => renderField(fieldId))}
        </div>
    );
};
