/**
 * 🔐 보안 제품 미화 서비스
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure, extractBase64 } from '../../../lib/geminiClient';

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
// PROMPT LOGIC
// ============================================================================

const getPromptForEffect = (effect: ProductEffect, poseId?: string, referenceCount?: number): string => {
    const SYSTEM_ROLE = `
**SYSTEM ROLE:** You are a "World-Class Product Retoucher" and "Studio Photographer".
**INPUT:** ${referenceCount && referenceCount > 1 ? `MULTIPLE (${referenceCount}) reference photos of the SAME shoe.` : 'A raw reference photo of a shoe.'}
**OUTPUT:** A High-End Commercial Product Photo (4K Resolution).

**[CRITICAL - MANDATORY SHOE ANALYSIS]**
1. **OUTSOLE**: Exact shape, thickness, pattern, color
2. **UPPER**: Material type, color gradients, texture
3. **EYELETS**: Exact count, position, size
4. **LACES**: Material, color, lacing style
5. **DESIGN ELEMENTS**: All logos, stitching patterns

**[EXECUTION RULES]**
1. **IDENTITY LOCK**: DO NOT RE-DESIGN THE SHOE.
2. **GEOMETRY**: Use EXACT geometry from input.
3. **QUALITY**: Remove dust, scratches, make premium.
`;

    if (effect === 'beautify') {
        let poseInstruction = '';
        switch (poseId) {
            case 'side_profile_single':
                poseInstruction = `**VIEW:** Perfect Side Profile. ONE SINGLE SHOE. Toe pointing LEFT. INSOLE NOT VISIBLE.`;
                break;
            case 'diagonal_front_single':
                poseInstruction = `**VIEW:** 45-degree Front Diagonal. ONE SINGLE SHOE. INSOLE NOT VISIBLE.`;
                break;
            case 'diagonal_back_pair':
                poseInstruction = `**VIEW:** 45-degree Rear Diagonal. PAIR OF SHOES. INSOLE NOT VISIBLE.`;
                break;
            case 'rear_view_pair':
                poseInstruction = `**VIEW:** Direct Rear View. PAIR OF SHOES. INSOLE NOT VISIBLE.`;
                break;
            case 'top_closed_pair':
                poseInstruction = `**VIEW:** Top-down view with CLOSED SHOES. PAIR. INSOLE NOT VISIBLE.`;
                break;
            case 'front_view_pair':
                poseInstruction = `**VIEW:** Direct Front View. PAIR OF SHOES. INSOLE NOT VISIBLE.`;
                break;
            default:
                poseInstruction = `**VIEW:** Best Commercial Side Angle. INSOLE NOT VISIBLE.`;
        }

        return `${SYSTEM_ROLE}
**[TASK: PREMIUM STUDIO ISOLATION]**

${poseInstruction}

**[BACKGROUND - 절대 규칙]**
- BACKGROUND MUST BE PURE WHITE (#FFFFFF)
- NO GRAY BACKGROUNDS - 회색 배경 금지
- Seamless infinite white background

**[SHADOW RENDERING]**
- Render realistic CONTACT SHADOW beneath shoe
- Shadow opacity: 15-25%

**[RETOUCHING SPECS]**
1. Remove dust, scratches, glue marks
2. Correct color casts - show TRUE COLORS
3. Premium material finish
4. Enhance texture details

**[IDENTITY LOCK - 100% CLONE]**
All details = IDENTICAL
`;
    }

    const studioBase = `${SYSTEM_ROLE}
**[TASK: EDITORIAL SCENE GENERATION]**
**CONSTRAINT:** Use the shoe from input. Do not generate generic shoe.
`;

    if (effect === 'studio_minimal_prop') {
        return `${studioBase}
**SCENE: "MINIMALIST LUXURY"**
- Props: Simple geometric forms (Cube, Sphere)
- Lighting: Soft, diffused beauty lighting
- Colors: Neutral tones (Beige, Grey, White)`;
    }

    if (effect === 'studio_natural_floor') {
        return `${studioBase}
**SCENE: "STREET STYLE"**
- Background: Concrete, asphalt, or pavement texture
- Lighting: Hard sunlight with distinct shadows
- Vibe: Authentic, outdoor, energetic`;
    }

    if (effect === 'studio_texture_emphasis') {
        return `${studioBase}
**SCENE: "DARK & DRAMATIC"**
- Background: Dark grey or black matte surface
- Lighting: Rim lighting to highlight silhouette
- Vibe: Premium, technical, moody`;
    }

    if (effect === 'studio_cinematic') {
        return `${studioBase}
**SCENE: "NEON CYBERPUNK"**
- Background: Dark glossy floor with reflections
- Lighting: Blue or Purple neon rim lights
- Effects: Subtle mist/fog, levitating slightly`;
    }

    return `${SYSTEM_ROLE} Photorealistic product shot.`;
};

// ============================================================================
// MAIN API FUNCTION (SECURE)
// ============================================================================

export const applyProductEffect = async (
    files: File[],
    effect: ProductEffect,
    onProgressUpdate: (message: string) => void,
    poseId?: string
): Promise<string> => {
    onProgressUpdate(poseId === 'original_pose'
        ? '원본 형태 분석 및 배경 제거 중...'
        : `${files.length}장 참조 이미지 분석 및 시각화 중...`
    );

    const prompt = getPromptForEffect(effect, poseId, files.length);

    // Convert files to base64
    const images = await Promise.all(files.map(async (file) => ({
        data: await fileToBase64(file),
        mimeType: file.type
    })));

    onProgressUpdate('고해상도 리터칭 및 렌더링... (SECURE)');

    const result = await callGeminiSecure(prompt, images);

    onProgressUpdate('최종 후처리 중...');

    if (result.type !== 'image') {
        throw new Error('이미지가 생성되지 않았습니다.');
    }

    return result.data;
};
