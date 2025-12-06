/**
 * Precautions Section - 기타 주의사항 섹션
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
}

export default function PrecautionsSection({ visible = true, content, precautionsData }: PrecautionsSectionProps) {
    if (!visible) return null;

    // Use structured data if available
    const items = precautionsData && precautionsData.length > 0 ? precautionsData : null;

    if (!items && content) {
        return (
            <div style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                maxWidth: '100%',
                margin: '0 auto',
                padding: '48px 24px',
                background: 'white',
                borderTop: '8px solid #f3f4f6'
            }}>
                <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '32px', color: 'black' }}>기타 주의 사항</h2>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.6', color: '#4b5563' }}>
                    {content}
                </div>
            </div>
        );
    }

    if (!items) return null;

    return (
        <div style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            maxWidth: '100%',
            margin: '0 auto',
            padding: '48px 24px',
            background: 'white',
            borderTop: '8px solid #f3f4f6'
        }}>
            <h2 style={{
                fontSize: '24px',
                fontWeight: 700,
                marginBottom: '32px',
                color: 'black'
            }}>기타 주의 사항</h2>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '32px 24px'
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
                            <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>{item.title}</h3>
                            <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.7, textAlign: 'justify' }}>
                                {item.desc}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
