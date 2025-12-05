/**
 * Product Enhancement Service
 * 
 * AI 스튜디오 로직 통합 버전
 * @google/genai SDK + gemini-3-pro-image-preview 모델 사용
 */

import { GoogleGenAI, Modality } from "@google/genai";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
export type ProductEffect =
    'beautify' |
    'studio_minimal_prop' |
    'studio_natural_floor' |
    'studio_texture_emphasis' |
    'studio_cinematic';

export interface ProductEnhancementResult {
    id: string;
    originalFileName: string;
    status: 'pending' | 'loading' | 'done' | 'error';
    url?: string;
    error?: string;
    processingStep?: string;
    effect: ProductEffect;
    poseInfo?: { id: string; name: string; };
    addedToPreview?: boolean;
}

// 포즈 정의 - UI에서 사용 (인솔이 보이지 않는 6가지 각도)
export const beautifyPoses: { id: string; name: string; }[] = [
    { id: 'side_profile_single', name: '측면 (1발)' },
    { id: 'diagonal_front_single', name: '사선 앞 (1발)' },
    { id: 'diagonal_back_pair', name: '사선 뒤 (양발)' },
    { id: 'rear_view_pair', name: '백뷰 (양발)' },
    { id: 'top_closed_pair', name: '탑뷰 (인솔 안보임)' },
    { id: 'front_view_pair', name: '정면 (양발)' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// ============================================================================
// PROMPT LOGIC (AI 스튜디오 원본 반영)
// ============================================================================

const getPromptForEffect = (effect: ProductEffect, poseId?: string, referenceCount?: number): string => {

    // SYSTEM PERSONA - 다중 참조 이미지 분석 강화 + 절대 규칙
    const SYSTEM_ROLE = `
**SYSTEM ROLE:** You are a "World-Class Product Retoucher" and "Studio Photographer".
**INPUT:** ${referenceCount && referenceCount > 1 ? `MULTIPLE (${referenceCount}) reference photos of the SAME shoe from different angles.` : 'A raw reference photo of a shoe.'}
**OUTPUT:** A High-End Commercial Product Photo (4K Resolution).

**[CRITICAL - MANDATORY SHOE ANALYSIS BEFORE RENDERING]**
Before generating ANY output, you MUST analyze and LOCK these attributes:

1. **OUTSOLE (아웃솔):**
   - Exact shape, thickness, pattern, color
   - Boundary line between outsole and upper (갑피)
   - Tread pattern details

2. **UPPER (갑피):**
   - Material type (leather, mesh, suede, synthetic)
   - Color gradients and patterns
   - Texture and surface finish

3. **EYELETS (아일렛/신끈구멍):**
   - Exact count, position, size, material (metal/plastic)
   - Color and finish

4. **LACES (신끈):**
   - Material, color, weave pattern
   - Lacing style and tie method

5. **DESIGN ELEMENTS:**
   - All logos, brandings, stitching patterns
   - Decorative elements, overlays
   - Heel counter shape and design

**[CRITICAL EXECUTION RULES - DO NOT IGNORE]**
1.  **IDENTITY LOCK (EXTREME IMPORTANCE):**
    *   **DO NOT RE-DESIGN THE SHOE.**
    *   **ANALYZE ALL PROVIDED REFERENCE IMAGES CAREFULLY.**
    *   The output MUST match ALL attributes 100%. This is RETOUCHING, not design.
2.  **GEOMETRY & PERSPECTIVE:**
    *   Use the EXACT geometry from the input images as reference.
    *   Do not hallucinate unseen details. Only render what's visible in references.
3.  **QUALITY UPGRADE:**
    *   Remove dust, scratches, glue marks, and bad lighting.
    *   Make the material look premium while keeping identity.
`;

    // MODULE: BEAUTIFY (안티그래비티 아이솔레이션)
    if (effect === 'beautify') {
        let poseInstruction = '';

        switch (poseId) {
            case 'side_profile_single':
                poseInstruction = `
            **[LAYOUT: PERFECT SIDE PROFILE]**
            *   **SUBJECT:** ONE SINGLE SHOE (Left foot outer side).
            *   **VIEW:** Perfect Lateral (Outer) Side View.
            *   **ORIENTATION:** Toe pointing LEFT.
            *   **CAMERA:** At shoe height (eye-level).
            *   **INSOLE MUST NOT BE VISIBLE.**
                `;
                break;
            case 'diagonal_front_single':
                poseInstruction = `
            **[LAYOUT: 3/4 FRONT ANGLE]**
            *   **SUBJECT:** ONE SINGLE SHOE.
            *   **VIEW:** 45-degree front diagonal angle.
            *   **CAMERA:** Slightly above shoe level (15-20 degrees).
            *   **INSOLE MUST NOT BE VISIBLE.**
                `;
                break;
            case 'diagonal_back_pair':
                poseInstruction = `
            **[LAYOUT: PAIR - REAR DIAGONAL]**
            *   **SUBJECT:** Pair of shoes (Left & Right).
            *   **VIEW:** 45-degree rear diagonal, heels visible.
            *   **INSOLE MUST NOT BE VISIBLE.**
                `;
                break;
            case 'rear_view_pair':
                poseInstruction = `
            **[LAYOUT: PAIR - DIRECT REAR]**
            *   **SUBJECT:** Pair of shoes (Left & Right).
            *   **VIEW:** Direct Rear View, heels facing camera.
            *   **CAMERA:** At shoe height.
            *   **INSOLE MUST NOT BE VISIBLE.**
                `;
                break;
            case 'top_closed_pair':
                poseInstruction = `
            **[LAYOUT: TOP VIEW - CLOSED SHOES]**
            *   **SUBJECT:** Pair of shoes.
            *   **VIEW:** Top-down at 75-80 degree angle (NOT 90 degrees).
            *   **CRITICAL:** Shoes must appear CLOSED/WORN - INSOLE MUST NOT BE VISIBLE.
            *   **SHOW:** Lacing, tongue, and top of upper clearly.
                `;
                break;
            case 'front_view_pair':
                poseInstruction = `
            **[LAYOUT: PAIR - DIRECT FRONT]**
            *   **SUBJECT:** Pair of shoes (Left & Right).
            *   **VIEW:** Direct Front View, toe boxes facing camera.
            *   **CAMERA:** At shoe height.
            *   **INSOLE MUST NOT BE VISIBLE.**
                `;
                break;
            default:
                poseInstruction = '**LAYOUT:** Best Commercial Side Angle. INSOLE MUST NOT BE VISIBLE.';
        }

        return `${SYSTEM_ROLE}
**[TASK: PREMIUM STUDIO ISOLATION]**

${poseInstruction}

**[BACKGROUND - 절대 규칙]**
*   BACKGROUND MUST BE PURE WHITE (#FFFFFF) - 순백색만 허용
*   NO GRAY BACKGROUNDS - 회색 배경 절대 금지
*   NO OFF-WHITE - 미색 금지
*   Seamless infinite white background

**[SHADOW RENDERING - 아웃솔 그림자]**
*   Render realistic CONTACT SHADOW beneath the shoe
*   Shadow must follow the exact shape of the outsole
*   Soft ambient occlusion at the base
*   Shadow opacity: 15-25% (subtle but visible)

**[RETOUCHING SPECS]**
1.  Remove dust, scratches, scuffs, glue marks
2.  Correct color casts - show TRUE COLORS
3.  Premium material finish - make materials look luxurious
4.  Enhance texture details - leather grain, mesh weave, etc.

**[IDENTITY LOCK - 100% CLONE]**
*   Shoe silhouette = IDENTICAL
*   All logos = IDENTICAL
*   All stitching = IDENTICAL
*   All laces = IDENTICAL
*   Outsole pattern = IDENTICAL
*   Upper design = IDENTICAL
`;
    }

    // STUDIO BASE
    const studioBase = `${SYSTEM_ROLE}
**[TASK: EDITORIAL SCENE GENERATION]**
**CONSTRAINT:** Use the shoe from the input image. Do not generate a generic shoe.
**COMPOSITION:** Product in center.
`;

    // MODULE: MINIMAL PROP
    if (effect === 'studio_minimal_prop') {
        return `${studioBase}
**SCENE: "MINIMALIST LUXURY"**
*   **CONCEPT:** High-end fashion editorial.
*   **PROPS:** Simple geometric forms (Cube, Sphere) made of Concrete, Wood, or Matte Plastic.
*   **PLACEMENT:** Props should complement the shoe, not hide it.
*   **LIGHTING:** Soft, diffused beauty lighting.
*   **COLORS:** Neutral tones (Beige, Grey, White).
`;
    }

    // MODULE: NATURAL FLOOR
    if (effect === 'studio_natural_floor') {
        return `${studioBase}
**SCENE: "STREET STYLE"**
*   **BACKGROUND:** Texture of concrete, asphalt, or pavement.
*   **LIGHTING:** Hard sunlight with distinct shadows.
*   **VIBE:** Authentic, outdoor, energetic.
`;
    }

    // MODULE: TEXTURE EMPHASIS
    if (effect === 'studio_texture_emphasis') {
        return `${studioBase}
**SCENE: "DARK & DRAMATIC"**
*   **BACKGROUND:** Dark grey or black matte surface.
*   **LIGHTING:** Rim lighting (Backlight) to highlight the silhouette. Spotlight on the shoe details.
*   **VIBE:** Premium, technical, moody.
`;
    }

    // MODULE: CINEMATIC
    if (effect === 'studio_cinematic') {
        return `${studioBase}
**SCENE: "NEON CYBERPUNK"**
*   **BACKGROUND:** Dark glossy floor with reflections.
*   **LIGHTING:** Blue or Purple neon rim lights.
*   **EFFECTS:** Subtle mist/fog. Levitating slightly.
`;
    }

    return `${SYSTEM_ROLE} Photorealistic product shot.`;
};

// ============================================================================
// MAIN API FUNCTION
// ============================================================================

export const applyProductEffect = async (
    files: File[],
    effect: ProductEffect,
    onProgressUpdate: (message: string) => void,
    poseId?: string
): Promise<string> => {
    // 1. Init
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
    }

    const ai = new GoogleGenAI({ apiKey });

    onProgressUpdate(poseId === 'original_pose'
        ? '원본 형태 분석 및 배경 제거 중...'
        : `${files.length}장 참조 이미지 분석 및 시각화 중...`
    );

    const prompt = getPromptForEffect(effect, poseId, files.length);

    // 2. Payload Construction
    const imageParts: { inlineData: { data: string; mimeType: string } }[] = [];

    for (const file of files) {
        imageParts.push({
            inlineData: {
                data: await fileToBase64(file),
                mimeType: file.type
            }
        });
    }

    const parts = [...imageParts, { text: prompt }];

    // 3. Gemini API Call
    onProgressUpdate('고해상도 리터칭 및 렌더링...');

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    onProgressUpdate('최종 후처리 중...');

    // 4. Response Handling
    if (response.promptFeedback?.blockReason) {
        throw new Error(`생성 차단됨 (사유: ${response.promptFeedback.blockReason})`);
    }

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts?.[0]) {
        throw new Error('오류: 이미지가 생성되지 않았습니다.');
    }

    for (const part of candidate.content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
    }
    throw new Error('이미지 데이터 누락');
};
