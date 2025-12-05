/**
 * Shoe Studio Service
 * 
 * AI 스튜디오 로직 통합 버전
 * 콘텐츠 패널용 스튜디오 합성 기능
 */

import { GoogleGenAI, Modality } from "@google/genai";

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function urlToBase64(url: string): Promise<string> {
    if (url.startsWith('data:')) {
        return url.split(',')[1];
    }
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

const getApiClient = () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
    return new GoogleGenAI({ apiKey });
};

// ============================================================================
// STUDIO SYNTHESIS (콘텐츠 패널용)
// ============================================================================

/**
 * 신발 스튜디오 합성 - ContentGeneratorPanel에서 사용
 */
export async function synthesizeShoeStudio(
    shoeImageUrl: string,
    modelImageUrl: string,
    effect: StudioEffect = 'minimal'
): Promise<string> {
    const ai = getApiClient();

    const shoeBase64 = await urlToBase64(shoeImageUrl);
    const modelBase64 = await urlToBase64(modelImageUrl);

    let scenePrompt = '';
    switch (effect) {
        case 'minimal':
            scenePrompt = `**SCENE: "MINIMALIST LUXURY"**
*   **CONCEPT:** High-end fashion editorial.
*   **PROPS:** Simple geometric forms (Cube, Sphere) made of Concrete.
*   **LIGHTING:** Soft, diffused beauty lighting.
*   **COLORS:** Neutral tones (Beige, Grey, White).`;
            break;
        case 'natural':
            scenePrompt = `**SCENE: "STREET STYLE"**
*   **BACKGROUND:** Texture of concrete, asphalt, or pavement.
*   **LIGHTING:** Hard sunlight with distinct shadows.
*   **VIBE:** Authentic, outdoor, energetic.`;
            break;
        case 'texture':
            scenePrompt = `**SCENE: "DARK & DRAMATIC"**
*   **BACKGROUND:** Dark grey or black matte surface.
*   **LIGHTING:** Rim lighting (Backlight) to highlight the silhouette.
*   **VIBE:** Premium, technical, moody.`;
            break;
        case 'cinematic':
            scenePrompt = `**SCENE: "NEON CYBERPUNK"**
*   **BACKGROUND:** Dark glossy floor with reflections.
*   **LIGHTING:** Blue or Purple neon rim lights.
*   **EFFECTS:** Subtle mist/fog. Levitating slightly.`;
            break;
        case 'gravity':
            scenePrompt = `**SCENE: "ZERO GRAVITY"**
*   **BACKGROUND:** Neutral grey concrete studio.
*   **ACTION:** Shoe floating in mid-air (Levitation).
*   **LIGHTING:** Soft cinematic lighting, floating shadow below.`;
            break;
        default:
            scenePrompt = `**SCENE:** Modern studio with soft lighting.`;
    }

    const prompt = `// --- PROTOCOL: STUDIO_SYNTHESIS ---
// TARGET: Place the shoe product in a studio environment with model reference.
// OUTPUT FORMAT: Portrait (3:4).

**SYSTEM ROLE:** You are a world-class Commercial Photographer.

**[CRITICAL RULES]**
1. **SHOE IDENTITY LOCK:** The shoe must be PIXEL-PERFECT identical to PRODUCT_IMAGE.
2. **FACE PRESERVATION:** If model is in the output, face must match MODEL_IMAGE exactly.
3. **INTEGRATION:** Ensure realistic lighting and shadows.

${scenePrompt}

Create a high-end commercial photograph.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
                parts: [
                    { text: prompt },
                    { text: "PRODUCT_IMAGE:" },
                    { inlineData: { mimeType: 'image/png', data: shoeBase64 } },
                    { text: "MODEL_IMAGE:" },
                    { inlineData: { mimeType: 'image/png', data: modelBase64 } },
                ]
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
        if (!imagePart?.inlineData) {
            throw new Error('스튜디오 합성 실패: 이미지가 생성되지 않았습니다.');
        }
        return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    } catch (error) {
        console.error('Studio synthesis failed:', error);
        throw error;
    }
}

/**
 * 스튜디오 효과 적용 (단일 이미지)
 */
export async function applyStudioEffect(options: StudioOptions): Promise<string | null> {
    try {
        // 단일 이미지에 효과 적용 - 모델 없이
        const ai = getApiClient();
        const shoeBase64 = await urlToBase64(options.shoeImageUrl);

        const prompt = `// --- TASK: STUDIO_EFFECT ---
// Apply ${options.effect} effect to the shoe product.
// Keep shoe identity 100% identical.
// Output: High-end commercial product photo.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/png', data: shoeBase64 } },
                ]
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
        if (!imagePart?.inlineData) return null;
        return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    } catch (error) {
        console.error('Studio effect failed:', error);
        return null;
    }
}

/**
 * 스튜디오 샷 생성
 */
export async function generateStudioShot(
    shoeImageUrl: string,
    effect: StudioEffect,
    onProgress?: (message: string) => void
): Promise<string | null> {
    onProgress?.('스튜디오 효과 적용 중...');
    return applyStudioEffect({ shoeImageUrl, effect });
}
