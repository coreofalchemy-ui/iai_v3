/**
 * 🔐 보안 Shoe Studio 서비스
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure, urlToBase64, urlToGeminiPart } from '../../../lib/geminiClient';

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
    const shoePart = await urlToGeminiPart(shoeImageUrl);
    const modelPart = await urlToGeminiPart(modelImageUrl);

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

    const prompt = `// --- PROTOCOL: PRECISE_SHOE_REPLACEMENT (SECURE) ---
// TARGET: Replace the shoes in the MODEL_IMAGE with the shoe from PRODUCT_IMAGE.

**[CRITICAL INSTRUCTIONS]**
1. **PRESERVE SCENE:** You must keep the MODEL_IMAGE's background, lighting, and model appearance EXACTLY as is. Do NOT generate a new studio background.
2. **PRECISE SWAP:** Detect the shoes in MODEL_IMAGE and replace ONLY them with the PRODUCT_IMAGE shoe.
3. **IDENTITY LOCK:** The new shoe must be pixel-perfect identical to the PRODUCT_IMAGE (color, texture, shape).
4. **INTEGRATION:** Match the lighting, shadows, and perspective of the original scene so the replacement looks completely natural.
5. **OUTPUT:** Return the full image with the shoe replaced.

PRODUCT_IMAGE: [First image - The new shoe]
MODEL_IMAGE: [Second image - The original photo to edit]`;

    const result = await callGeminiSecure(
        prompt,
        [
            shoePart,
            modelPart
        ],
        { aspectRatio: '3:4' }
    );

    console.log('[ShoeStudioService] synthesizeShoeStudio result type:', result.type);

    if (result.type !== 'image') {
        console.error('[ShoeStudioService] Synthesis failed. Result:', result);
        throw new Error('스튜디오 합성 실패 (이미지 반환 안됨)');
    }

    // Check data validity
    if (!result.data || result.data.length < 100) {
        console.warn('[ShoeStudioService] Warning: Result data seems too short:', result.data);
    }

    return result.data;
}

/**
 * 🔐 스튜디오 효과 적용 (단일 이미지)
 */
export async function applyStudioEffect(options: StudioOptions): Promise<string | null> {
    try {
        const shoePart = await urlToGeminiPart(options.shoeImageUrl);

        const prompt = `// --- TASK: STUDIO_EFFECT (SECURE) ---
// Apply ${options.effect} effect to the shoe product.
// Keep shoe identity 100% identical.
// Output: High-end commercial product photo.`;

        const result = await callGeminiSecure(
            prompt,
            [shoePart]
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
