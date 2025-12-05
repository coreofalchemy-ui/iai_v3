import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

// Use Gemini 3 Pro Image Preview model
const MODEL_NAME = 'gemini-3-pro-image-preview';

const getApiKey = (): string | undefined => {
    if (import.meta.env.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
    if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
    return undefined;
};

const getAI = () => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("AUTH_ERROR");
    return new GoogleGenAI({ apiKey });
};

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

// Helper to extract image from response
function getImageUrlFromResponse(response: any): string {
    for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error('No image found in the response.');
}

// Helper to extract text from response
function getTextFromResponse(response: any): string {
    for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
            if (part.text) {
                return part.text;
            }
        }
    }
    throw new Error('No text found in the response.');
}

/**
 * 신발 사진을 연필 스케치로 변환하고 SIZE GUIDE용 이미지 생성
 * @param shoeImageBase64 신발 측면 사진 (왼쪽을 향한)
 */
export const generateSizeGuideSketch = async (shoeImageBase64: string): Promise<string> => {
    console.log('🎨 generateSizeGuideSketch: Converting shoe to sketch');
    const ai = getAI();

    const base64 = shoeImageBase64.includes('base64,') ? shoeImageBase64.split('base64,')[1] : shoeImageBase64;

    const prompt = `
[TASK: CONVERT SHOE PHOTO TO SIZE GUIDE SKETCH]

[INPUT]
A side view photo of a shoe facing LEFT.

[OUTPUT REQUIREMENTS]
1. **STYLE**: Clean pencil sketch / line drawing style
2. **LINES**: Keep only essential contour lines of the shoe silhouette
3. **NO SHADING**: No fills, no shading, just clean black outline on pure white background
4. **TECHNICAL ILLUSTRATION**: Similar to a technical product drawing

[MEASUREMENT ARROWS TO ADD]
- A horizontal arrow showing TOTAL LENGTH (from heel to toe) at the bottom
- A vertical arrow showing HEEL HEIGHT at the back heel
- A vertical arrow showing ANKLE HEIGHT at the ankle opening
- Label each arrow with measurement placeholder text like "27cm", "12cm", "7cm"

[STYLE REFERENCE]
- Minimalist technical product illustration
- Like a patent drawing or product spec sheet
- Pure white background, black contour lines only
- No color, no texture, no shadows

[CRITICAL]
- The shoe MUST face LEFT
- Output must look like a SIZE GUIDE diagram
- Include measurement arrows with labels
`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                    { inlineData: { data: base64, mimeType: 'image/png' } },
                    { text: prompt }
                ]
            },
            config: {
                // @ts-ignore
                imageConfig: { aspectRatio: '16:9', imageSize: '1K' },
                safetySettings: SAFETY_SETTINGS
            }
        });

        return getImageUrlFromResponse(response);
    } catch (e) {
        console.error('Size guide sketch generation failed:', e);
        throw e;
    }
};

/**
 * A/S 안내 텍스트 생성
 * @param productInfo 제품 정보 (브랜드명, 제품명 등)
 */
export const generateASInfo = async (productInfo: {
    brandName?: string;
    productName?: string;
    productType?: string;
}): Promise<string> => {
    console.log('📋 generateASInfo: Generating A/S info');
    const ai = getAI();

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
• A/S 진행 절차

■ 교환/환불 안내
• 교환 및 환불 기준
• 교환/환불 불가 사유
• 택사 또는 환불 배송비 안내

[STYLE]
- 전문적이고 신뢰감 있는 톤
- 명확하고 읽기 쉬운 문장
- 불릿 포인트 사용
- 한국어로 작성

[OUTPUT]
JSON 형식으로 출력하지 말고, 깔끔한 텍스트로 출력하세요.
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp', // Text model for faster response
            contents: { parts: [{ text: prompt }] },
            config: { safetySettings: SAFETY_SETTINGS }
        });

        return getTextFromResponse(response);
    } catch (e) {
        console.error('A/S info generation failed:', e);
        throw e;
    }
};

/**
 * 기타 주의사항 텍스트 생성
 * @param productInfo 제품 정보
 */
export const generateCautions = async (productInfo: {
    brandName?: string;
    productName?: string;
    productType?: string;
    material?: string;
}): Promise<string> => {
    console.log('⚠️ generateCautions: Generating cautions');
    const ai = getAI();

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
• 오염 방지
• 장기 미착용시

■ 제품 관리법
• 일상 관리
• 세척 방법
• 건조 방법
• 보관 팁

■ CAUTION
• 가죽 제품 특성 안내
• 색상 이염 주의
• 사이즈 관련 안내
• 기타 주의점

[STYLE]
- 전문적이고 배려하는 톤
- 구체적이고 실용적인 조언
- 불릿 포인트 사용
- 한국어로 작성

[OUTPUT]
JSON 형식으로 출력하지 말고, 깔끔한 텍스트로 출력하세요.
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp', // Text model for faster response
            contents: { parts: [{ text: prompt }] },
            config: { safetySettings: SAFETY_SETTINGS }
        });

        return getTextFromResponse(response);
    } catch (e) {
        console.error('Cautions generation failed:', e);
        throw e;
    }
};

/**
 * 제품 이미지를 분석하여 자동으로 모든 정보 생성
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
    console.log('🔍 analyzeProductAndGenerate: Starting full analysis');
    const results: {
        sizeGuideImage?: string;
        asInfo?: string;
        cautions?: string;
    } = {};

    // Default product info (could be extracted from image analysis)
    const productInfo = {
        brandName: 'SAMPLE PRODUCT',
        productName: '신발',
        productType: '신발',
        material: '가죽/합성소재'
    };

    // Generate in parallel for speed
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
