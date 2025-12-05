/**
 * 🔐 보안 Shoe Studio 서비스
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure, urlToBase64 } from '../../../lib/geminiClient';

export type StudioEffect =
    'minimal' |
    'natural' |
    'texture' |
    'cinematic' |
    'gravity';

export interface StudioOptions {
    shoeImageUrl: string;
    effect: StudioEffect;
}

/**
 * 🔐 신발 스튜디오 합성 (보안)
 */
export async function synthesizeShoeStudio(
    shoeImageUrl: string,
    modelImageUrl: string,
    effect: StudioEffect = 'minimal'
): Promise<string> {
    const shoeBase64 = await urlToBase64(shoeImageUrl);
    const modelBase64 = await urlToBase64(modelImageUrl);

    let scenePrompt = '';
    switch (effect) {
        case 'minimal':
            scenePrompt = `**SCENE: "MINIMALIST LUXURY"** Props: Simple geometric forms. Lighting: Soft, diffused.`;
            break;
        case 'natural':
            scenePrompt = `**SCENE: "STREET STYLE"** Background: Concrete, asphalt. Lighting: Hard sunlight.`;
            break;
        case 'texture':
            scenePrompt = `**SCENE: "DARK & DRAMATIC"** Background: Dark matte surface. Lighting: Rim lighting.`;
            break;
        case 'cinematic':
            scenePrompt = `**SCENE: "NEON CYBERPUNK"** Background: Dark glossy floor. Lighting: Neon rim lights.`;
            break;
        case 'gravity':
            scenePrompt = `**SCENE: "ZERO GRAVITY"** Background: Grey studio. Action: Shoe floating.`;
            break;
        default:
            scenePrompt = `**SCENE:** Modern studio with soft lighting.`;
    }

    const prompt = `// --- PROTOCOL: STUDIO_SYNTHESIS (SECURE) ---
// TARGET: Place shoe product in studio environment with model reference.

**[CRITICAL RULES]**
1. **SHOE IDENTITY LOCK:** Shoe must be PIXEL-PERFECT identical to PRODUCT_IMAGE.
2. **FACE PRESERVATION:** If model is in output, face must match MODEL_IMAGE exactly.
3. **INTEGRATION:** Ensure realistic lighting and shadows.

${scenePrompt}

Create a high-end commercial photograph.

PRODUCT_IMAGE: [First image]
MODEL_IMAGE: [Second image]`;

    const result = await callGeminiSecure(
        prompt,
        [
            { data: shoeBase64, mimeType: 'image/png' },
            { data: modelBase64, mimeType: 'image/png' }
        ],
        { aspectRatio: '3:4' }
    );

    if (result.type !== 'image') {
        throw new Error('스튜디오 합성 실패');
    }
    return result.data;
}

/**
 * 🔐 스튜디오 효과 적용 (단일 이미지)
 */
export async function applyStudioEffect(options: StudioOptions): Promise<string | null> {
    try {
        const shoeBase64 = await urlToBase64(options.shoeImageUrl);

        const prompt = `// --- TASK: STUDIO_EFFECT (SECURE) ---
// Apply ${options.effect} effect to the shoe product.
// Keep shoe identity 100% identical.
// Output: High-end commercial product photo.`;

        const result = await callGeminiSecure(
            prompt,
            [{ data: shoeBase64, mimeType: 'image/png' }]
        );

        if (result.type !== 'image') return null;
        return result.data;
    } catch (error) {
        console.error('Studio effect failed:', error);
        return null;
    }
}

/**
 * 🔐 스튜디오 샷 생성
 */
export async function generateStudioShot(
    shoeImageUrl: string,
    effect: StudioEffect,
    onProgress?: (message: string) => void
): Promise<string | null> {
    onProgress?.('스튜디오 효과 적용 중... (SECURE)');
    return applyStudioEffect({ shoeImageUrl, effect });
}
