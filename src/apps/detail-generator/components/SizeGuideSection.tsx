/**
 * Size Guide Section - 사이즈 가이드 섹션
 * 선 없이 텍스트 테이블로 수치 표시
 * 사용자가 직접 텍스트 요소를 드래그하여 위치 조정 가능
 */

import React from 'react';

export interface SizeGuideSectionProps {
    visible?: boolean;
    productImage?: string;
    sizeData?: {
        productSpec?: string;
        heightSpec?: string;
        customContent?: string;
        specs?: { length: string; width: string; heel: string };
        disclaimer?: string;
        sizeLevel?: string;
        widthLevel?: string;
        weightLevel?: string;
        totalLength?: string;
        totalHeight?: string;
        heelHeight?: string;
    };
}

export default function SizeGuideSection({
    visible = true,
    productImage,
    sizeData = {}
}: SizeGuideSectionProps) {
    if (!visible) return null;

    const getPosition = (level?: string) => {
        switch (level) {
            case 'small':
            case 'narrow':
            case 'light':
                return '15%';
            case 'large':
            case 'wide':
            case 'heavy':
                return '85%';
            default:
                return '50%';
        }
    };

    // AI 분석 수치 (기본값 포함) - cm 형식
    const totalLength = sizeData.totalLength || '28cm';
    const heelHeightVal = sizeData.heelHeight || '3.5cm';

    // 전체높이는 반드시 굽높이보다 커야 함
    // AI가 잘못 분석했으면 굽높이 기준으로 보정
    const parseHeight = (val: string) => parseFloat(val.replace(/[^0-9.]/g, ''));
    const rawTotalHeight = parseHeight(sizeData.totalHeight || '4.5cm');
    const heelHeightNum = parseHeight(heelHeightVal);

    // 전체높이가 굽높이보다 작으면 굽높이 + 1cm로 보정
    const correctedTotalHeight = rawTotalHeight >= heelHeightNum
        ? rawTotalHeight
        : heelHeightNum + 1;
    const totalHeightVal = `${correctedTotalHeight.toFixed(1).replace(/\.0$/, '')}cm`;

    return (
        <div style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            maxWidth: '100%',
            margin: '0 auto',
            padding: '8px 16px', // Heavily reduced padding
            background: 'white',
            borderBottom: '8px solid #f3f4f6'
        }}>
            <h1 style={{
                fontSize: '18px',
                fontWeight: 700,
                marginBottom: '4px', // Almost no margin
                textAlign: 'center',
                letterSpacing: '2px',
                textTransform: 'uppercase'
            }}>Size Guide</h1>

            {/* 신발 이미지 - 선 없이 깔끔하게 - 적당한 여백 */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '16px' // Restore some margin for breathing room
            }}>
                <div style={{
                    width: '520px', // Slightly wider
                    height: '280px', // Increased height to avoid cutting off too much (breathing room)
                    maxWidth: '100%',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px', // Soften edges
                }}>
                    {productImage ? (
                        <img
                            src={productImage}
                            alt="Product"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover', // Keep cover to crop extreme whitespace
                                objectPosition: 'center',
                                display: 'block',
                                transform: 'scale(1.02)', // Slight zoom to avoid potential border artifacts
                                filter: 'grayscale(100%) contrast(1.1) brightness(1.05)'
                            }}
                        />
                    ) : (
                        <div style={{
                            width: '100%',
                            height: '100%',
                            background: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#9ca3af',
                            fontSize: '13px'
                        }}>
                            [제품 이미지]
                        </div>
                    )}
                </div>
            </div>

            {/* 측정 수치 테이블 */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '8px', // Reduced gap further
                marginBottom: '8px', // Minimized margin
                flexWrap: 'wrap'
            }}>
                <div style={{
                    textAlign: 'center',
                    padding: '8px 16px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    minWidth: '80px'
                }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '1px', fontWeight: 500 }}>전체 길이</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#111' }}>{totalLength}</div>
                </div>
                <div style={{
                    textAlign: 'center',
                    padding: '8px 16px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    minWidth: '80px'
                }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '1px', fontWeight: 500 }}>전체 높이</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#111' }}>{totalHeightVal}</div>
                </div>
                <div style={{
                    textAlign: 'center',
                    padding: '8px 16px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    minWidth: '80px'
                }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '1px', fontWeight: 500 }}>굽 높이</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#111' }}>{heelHeightVal}</div>
                </div>
            </div>

            <p style={{
                fontSize: '12px',
                color: '#6b7280',
                textAlign: 'center',
                marginBottom: '16px',
                fontWeight: 500
            }}>
                * 사이즈 측정 방법과 기준에 따라 약간의 오차가 발생할 수 있습니다.<br />
                * 250 사이즈 기준
            </p>

            {/* 사이즈 스케일 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <span style={{ width: '96px', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>사이즈</span>
                    <div style={{ flex: 1, paddingTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: 500 }}>
                            <span style={sizeData.sizeLevel === 'small' ? { color: 'black', fontWeight: 'bold', fontSize: '14px' } : {}}>작음</span>
                            <span style={(!sizeData.sizeLevel || sizeData.sizeLevel === 'normal') ? { color: 'black', fontWeight: 'bold', fontSize: '14px' } : {}}>보통</span>
                            <span style={sizeData.sizeLevel === 'large' ? { color: 'black', fontWeight: 'bold', fontSize: '14px' } : {}}>여유</span>
                        </div>
                        <div style={{ position: 'relative', height: '4px', background: '#e5e7eb', borderRadius: '2px', marginTop: '12px' }}>
                            <div style={{
                                position: 'absolute',
                                left: getPosition(sizeData.sizeLevel),
                                top: '50%',
                                width: '12px',
                                height: '12px',
                                background: '#111',
                                borderRadius: '50%',
                                transform: 'translate(-50%, -50%)',
                                boxShadow: '0 0 0 4px white',
                                border: '1px solid #111'
                            }} />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <span style={{ width: '96px', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>발 볼 너비</span>
                    <div style={{ flex: 1, paddingTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: 500 }}>
                            <span style={sizeData.widthLevel === 'narrow' ? { color: 'black', fontWeight: 'bold', fontSize: '14px' } : {}}>좁음</span>
                            <span style={(!sizeData.widthLevel || sizeData.widthLevel === 'normal') ? { color: 'black', fontWeight: 'bold', fontSize: '14px' } : {}}>보통</span>
                            <span style={sizeData.widthLevel === 'wide' ? { color: 'black', fontWeight: 'bold', fontSize: '14px' } : {}}>넓음</span>
                        </div>
                        <div style={{ position: 'relative', height: '4px', background: '#e5e7eb', borderRadius: '2px', marginTop: '12px' }}>
                            <div style={{
                                position: 'absolute',
                                left: getPosition(sizeData.widthLevel),
                                top: '50%',
                                width: '12px',
                                height: '12px',
                                background: '#111',
                                borderRadius: '50%',
                                transform: 'translate(-50%, -50%)',
                                boxShadow: '0 0 0 4px white',
                                border: '1px solid #111'
                            }} />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <span style={{ width: '96px', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>무게</span>
                    <div style={{ flex: 1, paddingTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: 500 }}>
                            <span style={sizeData.weightLevel === 'light' ? { color: 'black', fontWeight: 'bold', fontSize: '14px' } : {}}>가벼움</span>
                            <span style={(!sizeData.weightLevel || sizeData.weightLevel === 'normal') ? { color: 'black', fontWeight: 'bold', fontSize: '14px' } : {}}>보통</span>
                            <span style={sizeData.weightLevel === 'heavy' ? { color: 'black', fontWeight: 'bold', fontSize: '14px' } : {}}>무거움</span>
                        </div>
                        <div style={{ position: 'relative', height: '4px', background: '#e5e7eb', borderRadius: '2px', marginTop: '12px' }}>
                            <div style={{
                                position: 'absolute',
                                left: getPosition(sizeData.weightLevel),
                                top: '50%',
                                width: '12px',
                                height: '12px',
                                background: '#111',
                                borderRadius: '50%',
                                transform: 'translate(-50%, -50%)',
                                boxShadow: '0 0 0 4px white',
                                border: '1px solid #111'
                            }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
