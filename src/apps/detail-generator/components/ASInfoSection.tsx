/**
 * AS Info Section - A/S 안내 섹션
 */

import React from 'react';

interface ASInfoData {
    defect?: { title: string; content: string[] };
    contact?: { title: string; desc: string; info: string };
    caution?: { title: string; content: string[]; icons: { label: string }[] };
    refund?: { title: string; policy: { condition: string; cost: string; impossible: string[]; procedure: string } };
}

interface ASInfoSectionProps {
    visible?: boolean;
    asData?: ASInfoData;
    customContent?: string; // Legacy fallback
}

export default function ASInfoSection({ visible = true, asData, customContent }: ASInfoSectionProps) {
    if (!visible) return null;

    // Use structured data if available, otherwise display custom content or nothing
    // If neither, we might want to show defaults, but the App init handles default data now.

    // If customContent exists (and asData lacks specific fields, or as priority), show it.
    // However, the plan is to move away from unstructured text. 
    // We'll treat customContent as a fallback if asData is empty.
    const isDataEmpty = !asData || Object.keys(asData).length === 0;

    if (isDataEmpty && customContent) {
        return (
            <div style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                maxWidth: '100%',
                margin: '0 auto',
                padding: '48px 24px',
                background: 'white',
                borderTop: '8px solid #f3f4f6'
            }}>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.6', color: '#4b5563' }}>
                    {customContent}
                </div>
            </div>
        );
    }

    const { defect, contact, caution, refund } = asData || {};

    return (
        <div style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            maxWidth: '100%',
            margin: '0 auto',
            padding: '48px 24px',
            background: 'white',
            borderTop: '8px solid #f3f4f6'
        }}>
            {/* 상단 그리드 */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '40px',
                marginBottom: '40px'
            }}>
                {/* 하자 안내 */}
                {defect && (
                    <div>
                        <h2 style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            marginBottom: '16px',
                            borderLeft: '4px solid black',
                            paddingLeft: '12px'
                        }}>{defect.title}</h2>
                        <ul style={{
                            fontSize: '14px',
                            color: '#6b7280',
                            lineHeight: 1.8,
                            paddingLeft: '20px',
                            listStyleType: 'disc'
                        }}>
                            {defect.content.map((line, idx) => (
                                <li key={idx}>{line}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* A/S 안내 */}
                {contact && (
                    <div>
                        <h2 style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            marginBottom: '16px',
                            borderLeft: '4px solid black',
                            paddingLeft: '12px'
                        }}>{contact.title}</h2>
                        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, marginBottom: '12px' }}>
                            {contact.desc}
                        </p>
                        <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px', fontSize: '14px' }}>
                            <p style={{ fontWeight: 500, whiteSpace: 'pre-line' }}>
                                {contact.info}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* CAUTION 박스 */}
            {caution && (
                <div style={{
                    border: '2px solid #fecaca',
                    background: 'rgba(254, 242, 242, 0.3)',
                    borderRadius: '12px',
                    padding: '24px 32px',
                    marginBottom: '40px'
                }}>
                    <h2 style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        color: '#dc2626',
                        marginBottom: '20px',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        ⚠️ {caution.title}
                    </h2>
                    <ul style={{
                        fontSize: '14px',
                        color: '#4b5563',
                        lineHeight: 1.8,
                        paddingLeft: '20px',
                        listStyleType: 'disc'
                    }}>
                        {caution.content.map((line, idx) => (
                            <li key={idx} style={idx === caution.content.length - 1 ? { fontWeight: 700, color: '#dc2626' } : {}}>
                                {line}
                            </li>
                        ))}
                    </ul>

                    {/* 경고 아이콘 */}
                    {caution.icons && caution.icons.length > 0 && (
                        <div style={{
                            display: 'flex',
                            gap: '32px',
                            marginTop: '32px',
                            justifyContent: 'center',
                            borderTop: '1px solid #fecaca',
                            paddingTop: '24px'
                        }}>
                            {caution.icons.map((icon, idx) => (
                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '50%',
                                        border: '2px solid #f87171',
                                        background: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative'
                                    }}>
                                        <span style={{ fontSize: '24px' }}>{idx === 0 ? '👟' : '🧦'}</span>
                                        <div style={{
                                            position: 'absolute',
                                            width: '40px',
                                            height: '2px',
                                            background: '#ef4444',
                                            transform: 'rotate(-45deg)'
                                        }} />
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: 700, marginTop: '8px', color: '#ef4444' }}>{icon.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 교환/환불 정책 */}
            {refund && (
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '40px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>{refund.title}</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px 32px', fontSize: '14px', color: '#6b7280' }}>
                        <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '8px' }}>
                            <h4 style={{ fontWeight: 700, color: 'black', marginBottom: '8px', fontSize: '15px' }}>가능 조건</h4>
                            <p>{refund.policy.condition}</p>
                        </div>

                        <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '8px' }}>
                            <h4 style={{ fontWeight: 700, color: 'black', marginBottom: '8px', fontSize: '15px' }}>비용 안내</h4>
                            <p style={{ whiteSpace: 'pre-line' }}>{refund.policy.cost}</p>
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                            <h4 style={{ fontWeight: 700, color: 'black', marginBottom: '12px', fontSize: '15px' }}>불가능한 경우</h4>
                            <ul style={{ paddingLeft: '20px', listStyleType: 'disc', lineHeight: 1.8 }}>
                                {refund.policy.impossible.map((item, idx) => (
                                    <li key={idx}>{item}</li>
                                ))}
                            </ul>
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                            <h4 style={{ fontWeight: 700, color: 'black', marginBottom: '8px', fontSize: '15px' }}>신청 절차</h4>
                            <p>{refund.policy.procedure}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
