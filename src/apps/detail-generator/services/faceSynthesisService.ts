/**
 * Face Synthesis Service - SKULL LOCK & DOWNSCALING
 * 
 * 핵심 원리:
 * 1. SKULL LOCK: 모델 사진의 머리 크기/턱선/헤어 볼륨 = 고정된 메쉬
 * 2. DOWNSCALING: 얼굴 사진을 모델의 작은 얼굴 영역에 맞춰 축소 투영
 * 3. 이미지 순서: [모델 전신, 얼굴] - 첫 번째가 절대 기준
 * 4. Temperature 0.4: AI 창의성 억제, 기하학적 제약 철저 준수
 * 5. ABSOLUTE CANVAS: 모델 사진의 톤/색감/배경/화질이 절대 기준
 */

import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

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

// ============================================================================
// HELPERS
// ============================================================================

const fileToGenerativePart = async (file: File) => {
    const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
    });
    return { inlineData: { data: b64, mimeType: file.type } };
};

const dataUrlToGenerativePart = (url: string) => {
    const b64 = url.split(',')[1];
    const mime = url.match(/data:(.*?);base64/)?.[1] || 'image/png';
    return { inlineData: { data: b64, mimeType: mime } };
};

export const urlToBase64 = async (url: string): Promise<string> => {
    if (url.startsWith('data:')) {
        return url.includes('base64,') ? url.split('base64,')[1] : url;
    }
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onloadend = () => {
            const result = r.result as string;
            res(result.includes('base64,') ? result.split('base64,')[1] : result);
        };
        r.onerror = rej;
        r.readAsDataURL(blob);
    });
};

// ============================================================================
// CORE PROMPT: SKULL LOCK & DOWNSCALING
// ============================================================================

const getCampaignSynthesisPrompt = () => `
**ROLE: MASTER PORTRAIT PAINTER** (역할: 마스터 포트레이트 화가)

**CORE CONCEPT - 핵심 개념:**
You are NOT cutting and pasting a face. You are RE-PAINTING/RE-DRAWING the face.
Think of it as: "Looking at IMAGE 2's face and PAINTING that person's features onto IMAGE 1"
The result must look like IMAGE 2's person was the ORIGINAL subject in IMAGE 1's photo shoot.

**INPUT ANALYSIS (이미지 역할 정의):**
* **IMAGE 1 [TARGET PHOTO]**: **ABSOLUTE SACRED CANVAS** (절대 신성한 캔버스).
  - This photo is UNTOUCHABLE except for the face.
  - Body, pose, clothes, background, lighting, color grade, shadows, atmosphere = 100% LOCKED.
  - The DIMENSIONS of this image MUST be preserved exactly.
* **IMAGE 2 [FACE REFERENCE]**: **IDENTITY GUIDE** (아이덴티티 가이드).
  - Use as VISUAL REFERENCE for face identity (eyes, nose, lips, brow shape).
  - Ignore its lighting, color, skin tone - paint the face to match IMAGE 1's style.

**[CRITICAL] WHAT YOU ARE DOING:**
1. Study the lighting and color atmosphere of IMAGE 1
2. Study the face identity from IMAGE 2
3. RE-DRAW/PAINT that person's face AS IF they were the original model in IMAGE 1
4. Match EVERY aspect of IMAGE 1's style: skin tone, shadow depth, color warmth, sharpness

**[CRITICAL] SIZE LOCK - 출력 사이즈 고정:** 
- OUTPUT = EXACT SAME pixel dimensions as IMAGE 1
- DO NOT shrink, crop, expand, or change aspect ratio
- This is an IN-PLACE EDIT, not a new image generation

**[CRITICAL] TONE & MANNER MATCHING (톤앤매너 완전 일치):**
1. **COLOR TEMPERATURE**: If IMAGE 1 is warm, the face MUST be warm
2. **SHADOW STYLE**: Match IMAGE 1's shadow softness/hardness exactly
3. **SKIN TONE**: Paint skin to match the color palette of IMAGE 1
4. **LIGHT DIRECTION**: Shadows on face must match IMAGE 1's lighting
5. **GRAIN/SHARPNESS**: Match IMAGE 1's image texture exactly
6. **ATMOSPHERE**: The face must FEEL like it belongs in the photo

**SEAMLESS INTEGRATION:**
- Hairline: INVISIBLE transition
- Jawline: PERFECT blend with neck
- Neck skin: Continuous with body skin tone
- NO visible edges, seams, or color mismatches

**GEOMETRIC CONSTRAINTS:**
- Head size = IDENTICAL to IMAGE 1's original head
- Skull shape = IMAGE 1's skull shape
- Face angle = IMAGE 1's head angle

**OUTPUT:**
- The EXACT same photo as IMAGE 1, but with IMAGE 2's person's face painted in
- As if IMAGE 2's person was the original model at that photoshoot
`;


// ============================================================================
// MAIN SYNTHESIS FUNCTION
// ============================================================================

export interface SynthesisResult {
    success: boolean;
    imageUrl?: string;
    error?: string;
}

/**
 * 캠페인 이미지 합성 (얼굴 이식)
 * 
 * @param targetModelImage - 모델 전신 사진 (ABSOLUTE CANVAS)
 * @param faceImage - 얼굴 사진 (TEXTURE SOURCE)
 * @param shoeImages - 신발 사진들 (Optional)
 * @returns 합성된 이미지
 * 
 * CRITICAL: 이미지 순서가 중요! [모델, 얼굴] 순서를 반드시 지킬 것!
 */
export async function synthesizeCampaignImage(
    targetModelImage: string | File,
    faceImage: string | File,
    shoeImages?: (string | File)[]
): Promise<SynthesisResult> {
    console.log('🎭 synthesizeCampaignImage: Starting SKULL LOCK synthesis...');

    try {
        const ai = getAI();

        // 1. 이미지를 Base64 파트로 변환
        // CRITICAL ORDERING: 모델 → 얼굴 순서!
        let targetPart: any;
        let facePart: any;

        if (typeof targetModelImage === 'string') {
            targetPart = dataUrlToGenerativePart(targetModelImage);
        } else {
            targetPart = await fileToGenerativePart(targetModelImage);
        }

        if (typeof faceImage === 'string') {
            facePart = dataUrlToGenerativePart(faceImage);
        } else {
            facePart = await fileToGenerativePart(faceImage);
        }

        // 2. 신발 이미지 (옵션)
        const shoeParts: any[] = [];
        if (shoeImages && shoeImages.length > 0) {
            for (const shoe of shoeImages.slice(0, 4)) {
                if (typeof shoe === 'string') {
                    shoeParts.push(dataUrlToGenerativePart(shoe));
                } else {
                    shoeParts.push(await fileToGenerativePart(shoe));
                }
            }
        }

        // 3. 프롬프트 생성 (SKULL LOCK & DOWNSCALING)
        const prompt = getCampaignSynthesisPrompt();

        // 4. 배열 순서가 중요 (CRITICAL ORDERING)
        // [0]: 패션 모델 (ABSOLUTE CANVAS) - 기준점
        // [1]: 얼굴 (TEXTURE SOURCE) - 이식할 아이덴티티
        // [2+]: 신발 (Optional)
        const allParts = [
            { text: prompt },
            { text: "IMAGE 1 [FASHION MODEL - ABSOLUTE CANVAS]:" },
            targetPart,
            { text: "IMAGE 2 [FACE ID - TEXTURE SOURCE]:" },
            facePart,
            ...(shoeParts.length > 0 ? [{ text: "PRODUCT SHOES:" }, ...shoeParts] : [])
        ];

        console.log('📦 Parts order: [Prompt, Model, Face, Shoes...]');

        // 5. 생성 요청 (Temperature 0.4로 창의성 억제)
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: { parts: allParts },
            config: {
                // @ts-ignore
                imageConfig: { aspectRatio: '3:4' },
                safetySettings: SAFETY_SETTINGS,
                temperature: 0.4 // 낮은 온도 = 기하학적 제약 철저 준수
            }
        });

        // 6. 결과 추출
        const candidates = response?.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error("Face synthesis failed - no candidates returned");
        }
        const imagePart = candidates[0]?.content?.parts?.find((p: any) => p.inlineData);
        if (!imagePart?.inlineData) {
            throw new Error("Face synthesis failed - no image generated");
        }

        const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        console.log('✅ synthesizeCampaignImage: SKULL LOCK synthesis complete');

        return { success: true, imageUrl };

    } catch (error: any) {
        console.error('❌ synthesizeCampaignImage failed:', error);
        return { success: false, error: error.message || String(error) };
    }
}

/**
 * 배치 얼굴 합성 (여러 모델 이미지에 동일 얼굴 적용)
 */
export async function batchFaceSynthesis(
    modelImages: (string | File)[],
    faceImage: string | File,
    shoeImages?: (string | File)[],
    onProgress?: (current: number, total: number, result: SynthesisResult) => void
): Promise<SynthesisResult[]> {
    console.log(`🎭 batchFaceSynthesis: Processing ${modelImages.length} images...`);

    const results: SynthesisResult[] = [];

    for (let i = 0; i < modelImages.length; i++) {
        const modelImage = modelImages[i];

        try {
            const result = await synthesizeCampaignImage(modelImage, faceImage, shoeImages);
            results.push(result);
            onProgress?.(i + 1, modelImages.length, result);
            console.log(`✅ Synthesized ${i + 1}/${modelImages.length}`);
        } catch (error: any) {
            const errorResult = { success: false, error: error.message };
            results.push(errorResult);
            onProgress?.(i + 1, modelImages.length, errorResult);
            console.error(`❌ Failed ${i + 1}/${modelImages.length}:`, error);
        }
    }

    return results;
}

/**
 * 단일 이미지 얼굴 교체 (기존 replaceFaceInImage 대체)
 * SKULL LOCK 로직 적용
 */
export async function replaceFaceWithSkullLock(
    targetImageBase64: string,
    sourceFaceBase64: string
): Promise<string> {
    console.log('🔄 replaceFaceWithSkullLock: Starting...');

    const result = await synthesizeCampaignImage(targetImageBase64, sourceFaceBase64);

    if (!result.success || !result.imageUrl) {
        throw new Error(result.error || 'Face replacement failed');
    }

    return result.imageUrl;
}
