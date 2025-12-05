/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, InlineDataPart, Modality } from "@google/genai";

// ============================================================================
// [ANTI-GRAVITY ENGINE] TYPE DEFINITIONS
// ============================================================================
export type Effect = 
  'natural_light' | 
  'cinematic' | 
  'side_lighting' | 
  'beautify' | 
  'custom' |
  'studio_minimal_prop' |
  'studio_natural_floor' |
  'studio_texture_emphasis' |
  'studio_cinematic';

// Helper: File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// ============================================================================
// [ANTI-GRAVITY ENGINE] PROMPT LOGIC
// ============================================================================

/**
 * 효과(Effect) 및 포즈(Pose)에 따른 3D 렌더링 프롬프트를 생성합니다.
 * 이 함수가 엔진의 '두뇌' 역할을 합니다.
 */
const getPromptForEffect = (effect: Effect, poseId?: string): string => {
    
    // 1. SYSTEM PERSONA (핵심 역할 정의)
    // AI를 단순 편집자가 아닌 '전문 리터쳐'로 정의합니다. "3D 엔진"이라는 단어는 환각을 유발하므로 제거했습니다.
    const SYSTEM_ROLE = `
**SYSTEM ROLE:** You are a "World-Class Product Retoucher" and "Studio Photographer".
**INPUT:** A raw reference photo of a shoe.
**OUTPUT:** A High-End Commercial Product Photo (4K Resolution).

**[CRITICAL EXECUTION RULES - DO NOT IGNORE]**
1.  **IDENTITY LOCK (EXTREME IMPORTANCE):**
    *   **DO NOT RE-DESIGN THE SHOE.**
    *   The shoe's silhouette, logos, stitching, lace pattern, and material textures MUST match the input image 100%.
    *   This is a **RETOUCHING** task, not a design generation task.
    *   **NEGATIVE PROMPT:** Do not generate a random sneaker. Do not change the brand. Do not change the colorway.
2.  **GEOMETRY & PERSPECTIVE:**
    *   Use the **EXACT** geometry of the input image as the base.
    *   Do not hallucinate unseen angles unless explicitly forced by a specific pose command.
    *   If the input is "Top Down", render "Top Down". If "Side", render "Side".
3.  **QUALITY UPGRADE:**
    *   Remove dust, scratches, glue marks, and bad lighting.
    *   Make the material look premium (e.g., make leather look rich, mesh look crisp).
`;

    // 2. MODULE: BEAUTIFY (안티그래비티 아이솔레이션)
    if (effect === 'beautify') {
        let poseInstruction = '';
        
        // [NEW LOGIC] 원본 각도 유지 vs 강제 각도 변경 분기 처리
        if (poseId === 'original_pose') {
             poseInstruction = `
            **[TASK: PURE RETOUCHING - BACKGROUND REMOVAL]**
            *   **POSE:** **KEEP THE EXACT ORIGINAL ANGLE AND PERSPECTIVE.** Do not rotate the object.
            *   **ACTION:**
                1.  Carefully cut out the shoe from the background.
                2.  Place it on a clean, infinite white background.
                3.  Add a soft, realistic contact shadow at the base.
            *   **LIGHTING:** Improve the lighting on the shoe to be even and studio-quality (Softbox), but keep the form consistent.
            `;
        } else {
            // 포즈별 정밀 레이아웃 지시 (Strict Layout - Landscape)
            // 경고: 이 모드는 불가피하게 환각을 유발할 수 있음을 프롬프트 레벨에서 제어 시도
            switch (poseId) {
                case 'left_profile_single': 
                    poseInstruction = `
                    **[LAYOUT: FORCE SIDE PROFILE]**
                    *   **Warning:** If input is not side profile, you must intelligently reconstruct the side view while KEEPING THE DESIGN IDENTITY.
                    *   **SUBJECT:** ONE SINGLE SHOE (Left foot).
                    *   **VIEW:** Perfect Lateral (Outer) Side View.
                    *   **ORIENTATION:** Toe pointing LEFT.
                    `;
                    break;
                case 'left_diagonal_single': 
                    poseInstruction = `
                    **[LAYOUT: 3/4 ANGLE]**
                    *   **VIEW:** 45-degree angle showing both toe box and side.
                    *   **SUBJECT:** ONE SINGLE SHOE.
                    `;
                    break;
                case 'front_apart_pair': 
                    poseInstruction = `
                    **[LAYOUT: PAIR - FRONT VIEW]**
                    *   **SUBJECT:** Pair of shoes (Left & Right).
                    *   **VIEW:** Direct Front View.
                    `;
                    break;
                case 'top_down_instep_pair': 
                    poseInstruction = `
                    **[LAYOUT: FLAT LAY - TOP DOWN]**
                    *   **VIEW:** Camera looking straight down (90 degrees).
                    *   **SUBJECT:** Pair of shoes.
                    `;
                    break;
                default: 
                    poseInstruction = '**LAYOUT:** Best Commercial Angle based on input.';
            }
        }

        return `${SYSTEM_ROLE}
**[TASK: CLEAN STUDIO ISOLATION]**

${poseInstruction}

**[RETOUCHING SPECS]**
1.  **BACKGROUND:** PURE WHITE (#FFFFFF) Hex Code. Seamless.
2.  **SHADOW:** Natural contact shadow (Occlusion) only. No heavy drop shadows.
3.  **COLOR CORRECTION:** Remove any yellow/blue color cast from the original room lighting. True colors.
`;
    }

    // 3. MODULE: STUDIO BASE (스튜디오 공통 설정 - 가로형)
    const studioBase = `${SYSTEM_ROLE}
**[TASK: EDITORIAL SCENE GENERATION]**
**CONSTRAINT:** Use the shoe from the input image. Do not generate a generic shoe.
**COMPOSITION:** Product in center.
`;

    // 4. MODULE: MINIMAL PROP
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

    // 5. MODULE: NATURAL FLOOR
    if (effect === 'studio_natural_floor') {
        return `${studioBase}
**SCENE: "STREET STYLE"**
*   **BACKGROUND:** Texture of concrete, asphalt, or pavement.
*   **LIGHTING:** Hard sunlight with distinct shadows.
*   **VIBE:** Authentic, outdoor, energetic.
`;
    }

    // 6. MODULE: TEXTURE EMPHASIS
    if (effect === 'studio_texture_emphasis') {
        return `${studioBase}
**SCENE: "DARK & DRAMATIC"**
*   **BACKGROUND:** Dark grey or black matte surface.
*   **LIGHTING:** Rim lighting (Backlight) to highlight the silhouette. Spotlight on the shoe details.
*   **VIBE:** Premium, technical, moody.
`;
    }

    // 7. MODULE: CINEMATIC
    if (effect === 'studio_cinematic') {
        return `${studioBase}
**SCENE: "NEON CYBERPUNK"**
*   **BACKGROUND:** Dark glossy floor with reflections.
*   **LIGHTING:** Blue or Purple neon rim lights.
*   **EFFECTS:** Subtle mist/fog. Levitating slightly.
`;
    }

    // 8. MODULE: CUSTOM BACKGROUND
    if (effect === 'custom') {
        return `${SYSTEM_ROLE}
**[TASK: COMPOSITE RETOUCHING]**
*   **INSTRUCTION:** Place the exact shoe from the input image into the provided background image.
*   **PERSPECTIVE MATCH:** Adjust the shoe's placement to match the floor plane of the background.
*   **LIGHTING MATCH:** Relight the shoe to match the direction and color of the light in the background.
`;
    }

    return `${SYSTEM_ROLE} Photorealistic product shot.`;
}

// ============================================================================
// [ANTI-GRAVITY ENGINE] API HANDLERS
// ============================================================================

/**
 * 메인 이미지 생성 함수
 */
export const applyShoeEffect = async (
  files: File[],
  effect: Effect,
  onProgressUpdate: (message: string) => void,
  customBackground: File | null,
  poseId?: string
): Promise<string> => {
    // 1. Init
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    
    // 메시지 업데이트: 사용자에게 현재 진행 상황을 명확히 알림
    onProgressUpdate(poseId === 'original_pose' 
        ? '원본 형태 분석 및 배경 제거 중...' 
        : '신발 구조 분석 및 3D 시각화 중...'
    );

    const prompt = getPromptForEffect(effect, poseId);
    
    // 2. Payload Construction
    const imageParts: InlineDataPart[] = [];
    
    // 배경 이미지가 있으면 먼저 추가 (참조용)
    if (effect === 'custom' && customBackground) {
        imageParts.push({ inlineData: { data: await fileToBase64(customBackground), mimeType: customBackground.type } });
    }

    // 원본 신발 이미지 추가
    for (const file of files) {
        imageParts.push({ inlineData: { data: await fileToBase64(file), mimeType: file.type } });
    }
    
    const parts = [...imageParts, { text: prompt }];

    // 3. Gemini 3.0 Pro Call
    // 모델에게 이것이 '편집' 작업임을 강조하기 위해 config는 심플하게 유지하되
    // 프롬프트(text)에서 강력하게 통제합니다.
    onProgressUpdate('고해상도 리터칭 및 렌더링...');
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: {
            responseModalities: [ Modality.IMAGE ],
            imageConfig: {
                // 원본 각도 유지 모드일 때는 1:1 비율을 추천하지만, 
                // UI 통일성을 위해 4:3 유지. 단, 프롬프트가 중요.
                aspectRatio: '4:3', 
                imageSize: '2K'
            }
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

/**
 * 색상 변경 (Color Change) 함수
 */
export const applyColorChange = async (
  baseImageFile: File,
  onProgressUpdate: (message: string) => void,
  selectedColor: string | null,
  customColorImage: File | null,
): Promise<string> => {
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    onProgressUpdate('소재 분석 및 마스킹 영역 계산...');

    const colorInstruction = customColorImage
        ? `**Target Color:** Extract dominant color from the reference image.`
        : `**Target Color:** HEX ${selectedColor}.`;
    
    const colorChangePrompt = `
**SYSTEM ROLE:** Expert Digital Retoucher.
**TASK:** Recolor the UPPER material only.
**CONSTRAINT:** Keep OUTSOLE and LOGO 100% UNTOUCHED.

**EXECUTION:**
1.  **Masking:** Isolate 'Upper' material.
2.  **Color:** Apply ${colorInstruction}.
3.  **Realism:** Preserve stitching, grain, and highlights.
4.  **Lighting:** Blend naturally with existing light.
`;

    const parts = [
        { inlineData: { data: await fileToBase64(baseImageFile), mimeType: baseImageFile.type } },
        { text: colorChangePrompt }
    ];

    if (customColorImage) {
        parts.push({ inlineData: { data: await fileToBase64(customColorImage), mimeType: customColorImage.type } });
    }

    onProgressUpdate('Anti-Gravity: 색상 적용 렌더링...');
    const colorResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: { 
            responseModalities: [ Modality.IMAGE ],
            imageConfig: {
                aspectRatio: '1:1', // 색상 변경은 1:1 유지
                imageSize: '2K'
            }
        },
    });

    onProgressUpdate('완료');
    
    const finalCandidate = colorResponse.candidates?.[0];
    if (!finalCandidate?.content?.parts?.[0]) {
        throw new Error('색상 변경 실패');
    }

    for (const part of finalCandidate.content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
    }
    throw new Error('이미지 데이터 반환 실패');
};