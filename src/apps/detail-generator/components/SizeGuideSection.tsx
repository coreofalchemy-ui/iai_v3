/**
 * Size Guide Section - 사이즈 가이드 섹션
 * 제품 이미지 기반 스케치 + 히어로 섹션 데이터 연동
 */

import React from 'react';

export interface SizeGuideSectionProps {
    visible?: boolean;
    productImage?: string;  // 제품 이미지 URL
    sizeData?: {
        productSpec?: string;  // 히어로 섹션의 제품 스펙 (Legacy parse fallback)
        heightSpec?: string;   // 키높이 스펙
        customContent?: string; // 단순 텍스트 (Legacy)
        // New Structured Data
        specs?: { length: string; width: string; heel: string };
        disclaimer?: string;
    };
}

export default function SizeGuideSection({
    visible = true,
    productImage,
    sizeData = {}
}: SizeGuideSectionProps) {
    if (!visible) return null;

    // 스펙 파싱 (예: "총장 280mm | 볼폭 100mm | 굽높이 35mm")
    const parseSpecs = (spec?: string) => {
        if (!spec) return { length: '280', width: '100', heel: '35' };
        const parts = spec.split('|').map(s => s.trim());
        const length = parts.find(p => p.includes('총장'))?.match(/\d+/)?.[0] || '280';
        const width = parts.find(p => p.includes('볼폭'))?.match(/\d+/)?.[0] || '100';
        const heel = parts.find(p => p.includes('굽'))?.match(/\d+/)?.[0] || '35';
        return { length, width, heel };
    };

    // Use manual specs if available, otherwise parse legacy string, or default
    const specs = sizeData.specs || parseSpecs(sizeData.productSpec);

    return (
        <div style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            maxWidth: '100%',
            margin: '0 auto',
            padding: '40px 24px',
            background: 'white',
            borderTop: '8px solid #f3f4f6'
        }}>
            <h1 style={{
                fontSize: '28px',
                fontWeight: 900,
                marginBottom: '40px',
                textAlign: 'center',
                letterSpacing: '-0.5px',
                textTransform: 'uppercase'
            }}>Size Guide</h1>

            {/* Custom Size Guide Text / Disclaimer */}
            {(sizeData.disclaimer || sizeData.customContent) && (
                <div style={{
                    whiteSpace: 'pre-wrap',
                    fontSize: '14px',
                    color: '#333',
                    marginBottom: '24px',
                    lineHeight: '1.6',
                    textAlign: 'center'
                }}>
                    {sizeData.disclaimer || sizeData.customContent}
                </div>
            )}

            {/* 제품 스케치 영역 */}
            <div style={{
                background: '#fafafa',
                borderRadius: '16px',
                padding: '40px',
                marginBottom: '24px',
                position: 'relative',
                border: '1px solid #e5e7eb'
            }}>
                {productImage ? (
                    <div style={{ position: 'relative' }}>
                        {/* 제품 이미지 (스케치 스타일 필터) */}
                        <img
                            src={productImage}
                            alt="Product"
                            style={{
                                width: '100%',
                                maxWidth: '400px',
                                margin: '0 auto',
                                display: 'block',
                                filter: 'grayscale(100%) contrast(1.2)',
                                opacity: 0.8
                            }}
                        />

                        {/* 치수 표시선들 */}
                        <svg style={{
                            position: 'absolute',
                            top: 0,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '400px',
                            height: '100%',
                            pointerEvents: 'none'
                        }}>
                            {/* 총장 라인 */}
                            <line x1="50" y1="30" x2="350" y2="30" stroke="#333" strokeWidth="1" strokeDasharray="4,2" />
                            <line x1="50" y1="25" x2="50" y2="35" stroke="#333" strokeWidth="1" />
                            <line x1="350" y1="25" x2="350" y2="35" stroke="#333" strokeWidth="1" />
                            <text x="200" y="22" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#333">
                                {specs.length}mm
                            </text>

                            {/* 볼폭 라인 (세로) */}
                            <line x1="380" y1="80" x2="380" y2="180" stroke="#333" strokeWidth="1" strokeDasharray="4,2" />
                            <line x1="375" y1="80" x2="385" y2="80" stroke="#333" strokeWidth="1" />
                            <line x1="375" y1="180" x2="385" y2="180" stroke="#333" strokeWidth="1" />
                            <text x="390" y="135" textAnchor="start" fontSize="11" fontWeight="bold" fill="#333" transform="rotate(90, 390, 135)">
                                {specs.width}mm
                            </text>
                        </svg>
                    </div>
                ) : (
                    <div style={{
                        height: '200px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        color: '#9ca3af'
                    }}>
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                        </svg>
                        <p style={{ marginTop: '16px', fontSize: '14px' }}>제품 이미지를 업로드하면 스케치가 표시됩니다</p>
                    </div>
                )}
            </div>

            {/* 치수 정보 */}
            <div style={{
                background: '#f9fafb',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px'
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
                    <div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>총장</div>
                        <div style={{ fontSize: '20px', fontWeight: 700 }}>{specs.length}<span style={{ fontSize: '12px', fontWeight: 400 }}>mm</span></div>
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>볼폭</div>
                        <div style={{ fontSize: '20px', fontWeight: 700 }}>{specs.width}<span style={{ fontSize: '12px', fontWeight: 400 }}>mm</span></div>
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>굽높이</div>
                        <div style={{ fontSize: '20px', fontWeight: 700 }}>{specs.heel}<span style={{ fontSize: '12px', fontWeight: 400 }}>mm</span></div>
                    </div>
                </div>
            </div>

            {/* 키높이 정보 */}
            {sizeData.heightSpec && (
                <div style={{
                    background: '#111',
                    color: 'white',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    <div style={{ fontSize: '24px' }}>📏</div>
                    <div>
                        <div style={{ fontSize: '12px', opacity: 0.7 }}>HEIGHT SPEC</div>
                        <div style={{ fontSize: '18px', fontWeight: 700 }}>{sizeData.heightSpec}</div>
                    </div>
                </div>
            )}

            <p style={{
                fontSize: '12px',
                color: '#6b7280',
                textAlign: 'center',
                marginBottom: '32px'
            }}>
                * 사이즈 측정 방법과 기준에 따라 약간의 오차가 발생할 수 있습니다.<br />
                * 250사이즈 기준
            </p>

            {/* 스케일 바들 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {/* 사이즈 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <span style={{ width: '80px', fontWeight: 700, fontSize: '14px' }}>사이즈</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                            <span>작음</span>
                            <span style={{ fontWeight: 700, color: 'black' }}>보통</span>
                            <span>여유</span>
                        </div>
                        <div style={{ position: 'relative', height: '4px', background: '#e5e7eb', borderRadius: '2px' }}>
                            <div style={{
                                position: 'absolute',
                                left: '50%',
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

                {/* 발볼 너비 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <span style={{ width: '80px', fontWeight: 700, fontSize: '14px' }}>발볼 너비</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                            <span>좁음</span>
                            <span style={{ fontWeight: 700, color: 'black' }}>보통</span>
                            <span>넓음</span>
                        </div>
                        <div style={{ position: 'relative', height: '4px', background: '#e5e7eb', borderRadius: '2px' }}>
                            <div style={{
                                position: 'absolute',
                                left: '50%',
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

                {/* 무게 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <span style={{ width: '80px', fontWeight: 700, fontSize: '14px' }}>무게</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                            <span>가벼움</span>
                            <span style={{ fontWeight: 700, color: 'black' }}>보통</span>
                            <span>무거움</span>
                        </div>
                        <div style={{ position: 'relative', height: '4px', background: '#e5e7eb', borderRadius: '2px' }}>
                            <div style={{
                                position: 'absolute',
                                left: '50%',
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
