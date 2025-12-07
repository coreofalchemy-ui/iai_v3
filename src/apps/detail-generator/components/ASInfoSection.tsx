/**
 * AS Info Section - A/S 안내 섹션
 * HTML 디자인 참조 - 하자 안내, A/S 안내, CAUTION 박스, 교환/환불 정책
 */

import React from 'react';

interface ASInfoData {
    defect?: { title: string; content: string[] };
    contact?: { title: string; desc: string; info: string };
    caution?: { title: string; content: string[]; icons?: { label: string }[] };
    refund?: { title: string; policy: { condition: string; cost: string; impossible: string[]; procedure: string } };
}

interface ASInfoSectionProps {
    visible?: boolean;
    asData?: ASInfoData;
    customContent?: string; // Legacy fallback
    panelContent?: {
        title?: string;
        phone?: string;
        info1?: string;
        cautions?: string;
        fontSize?: number;
        width?: number;
    };
}

// 기본 데이터
const defaultASData: ASInfoData = {
    defect: {
        title: '제품에 하자가 있을 경우',
        content: [
            '제품 상태 확인 후 정확한 안내가 가능합니다.',
            '구매처 문의하기를 통해 [사진/영상] 자료와 함께 내용을 남겨주시면, 유관부서 전달 후 조치 방안을 상세히 안내드리겠습니다.'
        ]
    },
    contact: {
        title: 'A/S 안내',
        desc: '고객센터로 연락 주시면 내용 확인 후 순차적으로 도움을 드리겠습니다.',
        info: '고객센터: 000-0000-0000\n채널 문의: @카카오톡채널아이디'
    },
    caution: {
        title: 'Caution',
        content: [
            '가죽 특성상 개체별 색감 차이, 고유 주름 및 미세 스크래치가 있을 수 있으며, 이염이 발생할 수 있습니다.',
            '생산 과정의 에이징 작업으로 인해 수령 시 자연스러운 주름이 있을 수 있으며 이는 불량이 아닙니다.',
            '사이즈 확인 과정에서 제품 하자(가죽 손상, 과도한 시착 주름) 발생 시 교환/환불이 불가합니다. 동봉된 슈혼 사용을 권장합니다.'
        ],
        icons: [
            { label: '주름 주의' },
            { label: '착용 주의' }
        ]
    },
    refund: {
        title: '교환/환불 정책',
        policy: {
            condition: '상품 수령 후 7일 이내, 제품을 착용한 흔적이 없는 경우에 한해 가능합니다.',
            cost: '제품 하자: 무료 교환/환불\n단순 변심: 고객 부담 (왕복 배송비)',
            impossible: [
                '상품이 훼손 되었거나 사용(착용) 흔적이 있는 경우',
                '소비자 귀책으로 상품이 멸실 또는 훼손된 경우',
                '시간 경과로 재판매가 곤란할 정도로 상품 가치가 감소한 경우',
                '복제 가능한 상품의 포장을 개봉한 경우',
                '주문 제작(커스텀) 상품인 경우'
            ],
            procedure: '구매처 고객센터를 통해 신청 접수 → 반송 안내에 따라 상품 발송 → 상품 검수 후 3~5영업일 이내 처리'
        }
    }
};

export default function ASInfoSection({ visible = true, asData, customContent, panelContent }: ASInfoSectionProps) {
    if (!visible) return null;

    // Merge panel content with defaults
    const data = asData && Object.keys(asData).length > 0 ? asData : defaultASData;

    // Override with panel content if provided
    const defect = {
        ...data.defect,
        content: panelContent?.info1 ? panelContent.info1.split('\n') : data.defect?.content
    };
    const contact = {
        ...data.contact,
        title: panelContent?.title || data.contact?.title,
        info: panelContent?.phone ? `고객센터: ${panelContent.phone}` : data.contact?.info
    };
    const caution = {
        ...data.caution,
        content: panelContent?.cautions ? panelContent.cautions.split('\n') : data.caution?.content
    };
    const refund = data.refund;

    return (
        <div style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            maxWidth: '100%',
            margin: '0 auto',
            padding: '48px 24px',
            background: 'white'
        }}>
            {/* Top Grid: Defect & Contact */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '40px',
                marginBottom: '40px'
            }}>
                {/* Defect Handling */}
                {defect && (
                    <div>
                        <h2 style={{
                            fontSize: '18px',
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
                            {(defect.content || []).map((line, idx) => (
                                <li key={idx}>{line}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* A/S Info */}
                {contact && (
                    <div>
                        <h2 style={{
                            fontSize: '18px',
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

            {/* CAUTION Box */}
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
                        {(caution.content || []).map((line, idx) => (
                            <li key={idx} style={idx === (caution.content || []).length - 1 ? { fontWeight: 700, color: '#dc2626' } : {}}>
                                {line}
                            </li>
                        ))}
                    </ul>

                    {/* Warning Icons */}
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

            {/* Exchange/Refund Policy */}
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
