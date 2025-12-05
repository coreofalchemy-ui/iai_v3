/**
 * 🔐 보안 Product Analysis 서비스
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure } from '../../../lib/geminiClient';

/**
 * 🔐 신발 사진을 연필 스케치로 변환
 */
export const generateSizeGuideSketch = async (shoeImageBase64: string): Promise<string> => {
    console.log('🎨 generateSizeGuideSketch (SECURE)');

    const base64 = shoeImageBase64.includes('base64,') ? shoeImageBase64.split('base64,')[1] : shoeImageBase64;

    const prompt = `
[TASK: CONVERT SHOE PHOTO TO SIZE GUIDE SKETCH]

[OUTPUT REQUIREMENTS]
1. **STYLE**: Clean pencil sketch / line drawing style
2. **LINES**: Keep only essential contour lines
3. **NO SHADING**: No fills, just clean black outline on pure white background
4. **TECHNICAL ILLUSTRATION**: Like a patent drawing

[MEASUREMENT ARROWS TO ADD]
- Horizontal arrow showing TOTAL LENGTH at bottom
- Vertical arrow showing HEEL HEIGHT at back
- Label arrows with measurement placeholders like "27cm"

[CRITICAL]
- The shoe MUST face LEFT
- Output must look like a SIZE GUIDE diagram
`;

    const result = await callGeminiSecure(
        prompt,
        [{ data: base64, mimeType: 'image/png' }],
        { aspectRatio: '16:9' }
    );

    if (result.type !== 'image') {
        throw new Error('Size guide sketch generation failed');
    }

    return result.data;
};

/**
 * 🔐 A/S 안내 텍스트 생성
 */
export const generateASInfo = async (productInfo: {
    brandName?: string;
    productName?: string;
    productType?: string;
}): Promise<string> => {
    console.log('📋 generateASInfo (SECURE)');

    const prompt = `
[TASK: GENERATE A/S (After Service) INFORMATION]

[PRODUCT INFO]
- 브랜드: ${productInfo.brandName || '브랜드명'}
- 제품명: ${productInfo.productName || '제품명'}
- 제품 유형: ${productInfo.productType || '신발'}

[OUTPUT FORMAT - KOREAN]
다음 포맷으로 A/S 안내 텍스트를 생성하세요:

■ A/S 안내
• 고객센터 운영시간 및 연락처
• A/S 접수 방법
• 무상 A/S 기간 및 조건
• 유상 A/S 안내

■ 교환/환불 안내
• 교환 및 환불 기준
• 교환/환불 불가 사유
• 배송비 안내

[STYLE]
- 전문적이고 신뢰감 있는 톤
- 명확하고 읽기 쉬운 문장
- 한국어로 작성
`;

    const result = await callGeminiSecure(prompt, []);
    return result.data;
};

/**
 * 🔐 기타 주의사항 텍스트 생성
 */
export const generateCautions = async (productInfo: {
    brandName?: string;
    productName?: string;
    productType?: string;
    material?: string;
}): Promise<string> => {
    console.log('⚠️ generateCautions (SECURE)');

    const prompt = `
[TASK: GENERATE PRODUCT CAUTIONS AND CARE INSTRUCTIONS]

[PRODUCT INFO]
- 브랜드: ${productInfo.brandName || '브랜드명'}
- 제품명: ${productInfo.productName || '제품명'}
- 제품 유형: ${productInfo.productType || '신발'}
- 소재: ${productInfo.material || '가죽/합성소재'}

[OUTPUT FORMAT - KOREAN]
다음 카테고리별로 주의사항을 생성하세요:

■ 기타 주의사항
• 습기 주의
• 직사광선 주의
• 보관 방법

■ 제품 관리법
• 일상 관리
• 세척 방법
• 건조 방법

■ CAUTION
• 가죽 제품 특성 안내
• 색상 이염 주의

[STYLE]
- 전문적이고 배려하는 톤
- 구체적이고 실용적인 조언
- 한국어로 작성
`;

    const result = await callGeminiSecure(prompt, []);
    return result.data;
};

/**
 * 🔐 제품 이미지를 분석하여 자동으로 모든 정보 생성
 */
export const analyzeProductAndGenerate = async (
    productImageBase64: string,
    options: {
        generateSizeGuide?: boolean;
        generateAS?: boolean;
        generateCautions?: boolean;
    } = { generateSizeGuide: true, generateAS: true, generateCautions: true },
    onProgress?: (status: string) => void
): Promise<{
    sizeGuideImage?: string;
    asInfo?: string;
    cautions?: string;
}> => {
    console.log('🔍 analyzeProductAndGenerate (SECURE)');
    const results: {
        sizeGuideImage?: string;
        asInfo?: string;
        cautions?: string;
    } = {};

    const productInfo = {
        brandName: 'SAMPLE PRODUCT',
        productName: '신발',
        productType: '신발',
        material: '가죽/합성소재'
    };

    const tasks: Promise<void>[] = [];

    if (options.generateSizeGuide) {
        tasks.push((async () => {
            onProgress?.('SIZE GUIDE 스케치 생성 중...');
            try {
                results.sizeGuideImage = await generateSizeGuideSketch(productImageBase64);
            } catch (e) {
                console.error('Size guide failed:', e);
            }
        })());
    }

    if (options.generateAS) {
        tasks.push((async () => {
            onProgress?.('A/S 안내 생성 중...');
            try {
                results.asInfo = await generateASInfo(productInfo);
            } catch (e) {
                console.error('AS info failed:', e);
            }
        })());
    }

    if (options.generateCautions) {
        tasks.push((async () => {
            onProgress?.('기타 주의사항 생성 중...');
            try {
                results.cautions = await generateCautions(productInfo);
            } catch (e) {
                console.error('Cautions failed:', e);
            }
        })());
    }

    await Promise.all(tasks);
    onProgress?.('완료!');

    return results;
};
