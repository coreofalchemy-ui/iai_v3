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

[CRITICAL - VIEW REQUIREMENT]
⚠️ MUST SHOW LATERAL (OUTER) SIDE ONLY ⚠️
- LATERAL = OUTER side of the shoe (the side facing outward when worn)
- NEVER show MEDIAL (inner) side
- If the input image shows medial/inner side, mentally flip it to show lateral/outer side
- The OUTER side typically has brand logos, decorative elements, and no zipper

[OUTPUT REQUIREMENTS]
1. **STYLE**: PURE LINE DRAWING (Outline only).
2. **NO SHADING**: Do NOT use grayscale shading or gradients. Just black lines on white background.
3. **ORIENTATION**: The shoe MUST face LEFT (Toe pointing Left).
4. **VIEW**: LATERAL (OUTER) Side Profile ONLY. Never inner/medial side.
5. **DETAIL_LEVEL**: Minimalist. Only essential contour lines.

[STRICT CONSTRAINT]
- Output must look like a technical patent drawing.
- White background (#FFFFFF).
- Black stroke (#000000).
- Show the OUTER side of the shoe, not the inner side with zipper or closure.
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
export const generateASInfo = async (product: any): Promise<string> => {
    // Fallback AS Info to ensure content is always available
    return `
■ A/S 안내
• 고객센터: 평일 09:00 - 18:00 (점심시간 12:00 - 13:00)
• A/S 접수: 홈페이지 1:1 문의 또는 고객센터 유선 상담
• 무상 A/S: 구입일로부터 1년 (제조 불량에 한함)
• 유상 A/S: 보증 기간 경과 또는 소비자 부주의

■ 교환/환불 안내
• 교환/환불 기준: 수령 후 7일 이내 (미착용, 택 부착 상태)
• 교환/환불 불가: 착용 흔적, 세탁/수선한 제품, 고객 변심 (7일 초과)
• 배송비: 단순 변심 시 고객 부담
    `.trim();
};

/**
 * 🔐 기타 주의사항 텍스트 생성
 */
export const generateCautions = async (product: any): Promise<string> => {
    return `
■ 기타 주의사항
• 습기 및 물기에 주의하여 보관하세요
• 직사광선을 피해 서늘한 곳에 보관하세요
• 장기간 보관 시 신문지 등을 넣어 형태를 유지하세요

■ 제품 관리법
• 부드러운 천으로 표면의 먼지를 제거하세요
• 오염 발생 시 즉시 물기를 제거하세요
• 전문 클리닝 서비스 이용을 권장합니다

■ CAUTION
• 천연 가죽 제품은 스크래치 및 주름이 발생할 수 있습니다
• 밝은 색상의 양말 착용 시 이염될 수 있습니다
• 젖은 바닥에서 미끄러질 수 있으니 주의하세요
    `.trim();
};

/**
 * 🔐 신발 이미지에서 상세 정보 추출 (Hero Text 및 메타데이터용)
 */
export const analyzeShoeDetails = async (shoeImageBase64: string): Promise<{
    brandName: string;
    productName: string;
    productType: string;
    material: string;
    color: string;
    style: string;
    heroCopy: {
        productName: string;
        brandLine: string;
        subName: string;
        stylingMatch: string;
        craftsmanship: string;
        technology: string;
    }
}> => {
    console.log('🔍 analyzeShoeDetails (SECURE)');
    const base64 = shoeImageBase64.includes('base64,') ? shoeImageBase64.split('base64,')[1] : shoeImageBase64;

    const prompt = `
[TASK: ANALYZE SHOE IMAGE & GENERATE PRODUCT METADATA]

[OUTPUT FORMAT - JSON ONLY]
Return valid JSON with this structure:
{
    "brandName": "BRAND NAME IN ENGLISH (UPPERCASE)",
    "productName": "PRODUCT NAME IN ENGLISH",
    "productType": "Sneakers/Boots/Loafers/Derby/Oxford etc",
    "material": "Leather/Mesh/Suede/Canvas etc",
    "color": "Main Color in English",
    "style": "Casual/Sport/Formal/Business Casual",
    "heroCopy": {
        "productName": "PRODUCT NAME IN ENGLISH (e.g. Premium Leather Derby)",
        "brandLine": "BRAND LINE IN ENGLISH UPPERCASE (e.g. ESSENTIAL COLLECTION)",
        "subName": "Color / Style in English (e.g. Black / Classic)",
        "stylingMatch": "4 lines of Korean styling advice. Each line is a complete sentence. Separate lines with \\n.",
        "craftsmanship": "4 lines of Korean material & quality description. Separate lines with \\n.",
        "technology": "2 lines of Korean technology description. Just 2 short lines. Separate with \\n. Example: 고밀도 러버 아웃솔로 미끄러짐 방지 기능.\\n인체공학적 풋베드로 장시간 착용에도 편안함 유지."
    },
    "specs": {
        "color": "Color name in ENGLISH (e.g. Black, Brown, Matte Black)",
        "upper": "Upper material in ENGLISH (e.g. Premium Leather, Suede, Mesh)",
        "lining": "Lining material in ENGLISH (e.g. Leather, Synthetic, Mesh)",
        "outsole": "Outsole material in ENGLISH (e.g. Rubber, EVA, Leather)",
        "origin": "Country of origin in ENGLISH (e.g. Korea, China, Italy)"
    },
    "heightSpec": {
        "outsole": "Xcm (e.g. 3cm, 3.5cm)",
        "insole": "Xcm (e.g. 0.5cm, 1cm)",
        "total": "Xcm (e.g. 4cm, 4.5cm)"
    },
    "heelHeight": "Xcm (e.g. 3cm, 3.5cm)",
    "sizeGuide": "AI가 분석한 사이즈 추천 문구"
}

IMPORTANT: 
- ALL spec values MUST be in ENGLISH (color, upper, lining, outsole, origin)
- technology should be only 2 lines (not 4)
- stylingMatch and craftsmanship should be 4 lines
`;


    const result = await callGeminiSecure(
        prompt,
        [{ data: base64, mimeType: 'image/png' }]
    );

    try {
        // Clean markdown code blocks if present
        let cleanText = result.data.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error('Failed to parse shoe analysis JSON:', e);
        return {
            brandName: 'Unknown Brand',
            productName: 'New Shoes',
            productType: 'Footwear',
            material: 'Mixed Materials',
            color: 'Multi',
            style: 'Casual',
            heroCopy: {
                productName: 'Premium Comfort Shoes',
                brandLine: 'ESSENTIAL COLLECTION',
                subName: 'Classic Edition',
                stylingMatch: '다양한 룩에 매치하기 좋은 데일리 아이템입니다.',
                craftsmanship: '엄선된 소재로 제작되어 편안한 착화감을 제공합니다.',
                technology: '하루 종일 신어도 편안한 쿠셔닝 기술이 적용되었습니다.'
            }
        };
    }
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
    analysisResult?: any; // Hero copy 포함
}> => {
    console.log('🔍 analyzeProductAndGenerate (SECURE)');
    const results: {
        sizeGuideImage?: string;
        asInfo?: string;
        cautions?: string;
        analysisResult?: any;
    } = {};

    // 1. 먼저 제품 상세 분석 실행
    onProgress?.('제품 상세 정보 분석 중...');
    const productInfo = await analyzeShoeDetails(productImageBase64);
    results.analysisResult = productInfo;

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
    onProgress?.('모든 분석 완료!');

    return results;
};
