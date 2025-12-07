/**
 * Precautions Section - 기타 주의사항 섹션
 * HTML 디자인 참조 - 아이콘 + 그리드 레이아웃
 */

import React from 'react';

interface PrecautionItem {
    icon: string;
    title: string;
    desc: string;
}

interface PrecautionsSectionProps {
    visible?: boolean;
    content?: string; // Legacy fallback
    precautionsData?: PrecautionItem[];
    panelContent?: {
        title?: string;
        item1Title?: string;
        item1Desc?: string;
        item2Title?: string;
        item2Desc?: string;
        item3Title?: string;
        item3Desc?: string;
        item4Title?: string;
        item4Desc?: string;
        fontSize?: number;
        width?: number;
    };
}

// 기본 주의사항 데이터
const defaultPrecautions: PrecautionItem[] = [
    {
        icon: '💧',
        title: '습기 주의',
        desc: '가죽 제품은 습기에 약해 변색이나 얼룩이 생길 수 있습니다. 우천 시 착용을 피하고, 젖었을 땐 마른 수건으로 닦아 통풍이 잘되는 그늘에 건조해 주세요.'
    },
    {
        icon: '☀️',
        title: '직사광선 주의',
        desc: '직사광선에 장시간 노출 시 가죽 변색이나 이염 우려가 있습니다. 보관 시에는 햇볕이 닿지 않는 서늘한 곳을 권장합니다.'
    },
    {
        icon: '📦',
        title: '보관 방법',
        desc: '장기 보관 시 통기성 좋은 천 커버를 사용해 주세요. 비닐이나 플라스틱은 통기성이 부족해 가죽 손상의 원인이 될 수 있습니다.'
    },
    {
        icon: '✨',
        title: '오염 관리',
        desc: '알코올 성분의 세정제나 물티슈 사용은 지양해 주세요. 가죽 전용 클리너나 부드러운 마른 천을 이용해 오염 부위를 닦아주세요.'
    },
    {
        icon: '👟',
        title: '정기적인 관리',
        desc: '가죽 전용 보호제나 크림으로 주기적인 관리를 해주시면 보호막이 형성되어 제품 수명을 늘리고 오염을 예방할 수 있습니다.'
    },
    {
        icon: '🧹',
        title: '전문 클리닝',
        desc: '가정에서 해결하기 힘든 심한 얼룩이나 오염은 가죽 전문 클리닝 업체에 맡기시는 것이 가장 안전합니다.'
    }
];

export default function PrecautionsSection({ visible = true, content, precautionsData, panelContent }: PrecautionsSectionProps) {
    if (!visible) return null;

    // Build items from panel content if available, otherwise use defaults
    const baseItems = (precautionsData && precautionsData.length > 0) ? precautionsData : defaultPrecautions;

    // Override with panel content if provided
    const items = panelContent ? [
        { icon: '💧', title: panelContent.item1Title || baseItems[0]?.title, desc: panelContent.item1Desc || baseItems[0]?.desc },
        { icon: '☀️', title: panelContent.item2Title || baseItems[1]?.title, desc: panelContent.item2Desc || baseItems[1]?.desc },
        { icon: '📦', title: panelContent.item3Title || baseItems[2]?.title, desc: panelContent.item3Desc || baseItems[2]?.desc },
        { icon: '✨', title: panelContent.item4Title || baseItems[3]?.title, desc: panelContent.item4Desc || baseItems[3]?.desc },
        baseItems[4] || { icon: '👟', title: '정기적인 관리', desc: '가죽 전용 보호제나 크림으로 주기적인 관리를 해주세요.' },
        baseItems[5] || { icon: '🧹', title: '전문 클리닝', desc: '가정에서 해결하기 힘든 심한 얼룩은 전문 클리닝 업체에 맡기시는 것이 안전합니다.' }
    ] : baseItems;

    const sectionTitle = panelContent?.title || '기타 주의 사항';

    return (
        <div style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            maxWidth: '100%',
            margin: '0 auto',
            padding: '48px 24px',
            background: 'white',
            borderBottom: '8px solid #f3f4f6'
        }}>
            <h2 style={{
                fontSize: '24px',
                fontWeight: 700,
                marginBottom: '32px',
                color: 'black'
            }}>{sectionTitle}</h2>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '40px 32px'
            }}>
                {items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            background: '#f9fafb',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            flexShrink: 0
                        }}>
                            {item.icon}
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>{item.title}</h3>
                            <p style={{
                                fontSize: '14px',
                                color: '#6b7280',
                                lineHeight: 1.7,
                                textAlign: 'justify',
                                wordBreak: 'keep-all'
                            }}>
                                {item.desc}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
