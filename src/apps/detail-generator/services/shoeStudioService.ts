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
 * 이미지의 비율 분석 (세로형, 정사각형, 가로형)
 */
const getImageAspectFromDataUrl = (dataUrl: string): Promise<{
    aspectRatio: string;
    orientation: 'portrait' | 'square' | 'landscape';
    promptRatio: string;
    width: number;
    height: number;
    ratio: number;
}> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const width = img.width;
            const height = img.height;
            const ratio = width / height;

            let result;
            if (ratio < 0.9) {
                // 세로형 (Portrait)
                result = {
                    aspectRatio: '3:4',
                    orientation: 'portrait' as const,
                    promptRatio: 'PORTRAIT (Vertical, taller than wide, approximately 3:4 ratio)',
                    width,
                    height,
                    ratio
                };
            } else if (ratio > 1.1) {
                // 가로형 (Landscape)
                result = {
                    aspectRatio: '4:3',
                    orientation: 'landscape' as const,
                    promptRatio: 'LANDSCAPE (Horizontal, wider than tall, approximately 4:3 ratio)',
                    width,
                    height,
                    ratio
                };
            } else {
                // 정사각형 (Square)
                result = {
                    aspectRatio: '1:1',
                    orientation: 'square' as const,
                    promptRatio: 'SQUARE (Equal width and height, 1:1 ratio)',
                    width,
                    height,
                    ratio
                };
            }

            console.log(`[getImageAspectFromDataUrl] Detected: ${result.orientation} (${width}x${height}, ratio: ${ratio.toFixed(2)})`);
            resolve(result);
        };
        img.onerror = () => reject(new Error('Failed to load image for aspect analysis'));
        img.src = dataUrl;
    });
};

/**
 * 🔒 생성된 이미지를 모델 이미지의 정확한 크기로 강제 리사이즈 (HARD LOCK)
 * AI가 어떤 비율로 생성하든 상관없이, 출력은 항상 모델 이미지 크기와 동일
 */
const forceResizeToExactDimensions = (
    generatedImageDataUrl: string,
    targetWidth: number,
    targetHeight: number
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const srcWidth = img.width;
            const srcHeight = img.height;

            console.log(`[forceResize] HARD LOCK: Source ${srcWidth}x${srcHeight} → Target ${targetWidth}x${targetHeight}`);

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            // 중앙 기준 크롭 후 리사이즈
            const srcRatio = srcWidth / srcHeight;
            const targetRatio = targetWidth / targetHeight;

            let cropX = 0, cropY = 0, cropW = srcWidth, cropH = srcHeight;

            if (srcRatio > targetRatio) {
                // 소스가 더 넓음 → 좌우 크롭
                cropW = Math.round(srcHeight * targetRatio);
                cropX = Math.round((srcWidth - cropW) / 2);
            } else if (srcRatio < targetRatio) {
                // 소스가 더 좁음 → 상하 크롭
                cropH = Math.round(srcWidth / targetRatio);
                cropY = Math.round((srcHeight - cropH) / 2);
            }

            console.log(`[forceResize] Crop: (${cropX},${cropY}) ${cropW}x${cropH} → Resize: ${targetWidth}x${targetHeight}`);

            // 크롭된 부분을 정확한 타겟 크기로 리사이즈
            ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetWidth, targetHeight);

            const resultDataUrl = canvas.toDataURL('image/jpeg', 0.95);
            console.log(`[forceResize] ✓ HARD LOCKED to ${targetWidth}x${targetHeight}`);
            resolve(resultDataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image for resizing'));
        img.src = generatedImageDataUrl;
    });
};

/**
 * 🔐 신발 스튜디오 합성 (보안)
 * 모델 이미지의 원본 비율을 유지합니다.
 */
export async function synthesizeShoeStudio(
    shoeImageUrl: string,
    modelImageUrl: string,
    effect: StudioEffect = 'minimal'
): Promise<string> {
    const shoePart = await urlToGeminiPart(shoeImageUrl);
    const modelPart = await urlToGeminiPart(modelImageUrl);

    // 모델 이미지의 비율 분석
    let aspectInfo;
    try {
        aspectInfo = await getImageAspectFromDataUrl(modelImageUrl);
        console.log(`[synthesizeShoeStudio] Model image aspect: ${aspectInfo.orientation} (${aspectInfo.width}x${aspectInfo.height})`);
    } catch (e) {
        console.warn('[synthesizeShoeStudio] Could not analyze model image aspect, defaulting to portrait');
        aspectInfo = {
            aspectRatio: '3:4',
            orientation: 'portrait' as const,
            promptRatio: 'PORTRAIT (Vertical, taller than wide, approximately 3:4 ratio)',
            width: 0,
            height: 0,
            ratio: 0.75 // 3:4 portrait ratio
        };
    }

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

    const prompt = `// === SHOE SWAP TASK ===
// OUTPUT SIZE: ${aspectInfo.width}x${aspectInfo.height} pixels (EXACT)

**TASK**: Generate a NEW image at EXACTLY ${aspectInfo.width}x${aspectInfo.height} pixels.

**WHAT TO DO**:
1. Create a model wearing the SHOE from Image 1
2. The model should match the POSE and OUTFIT from Image 2
3. Generate a CLEAN STUDIO BACKGROUND (NOT copying Image 2's background)
4. Output MUST be ${aspectInfo.width}x${aspectInfo.height} pixels

**SHOE (Image 1)**: Copy this shoe EXACTLY - same color, texture, shape

**MODEL REFERENCE (Image 2)**: Copy the model's:
- Body pose and proportions
- Outfit/clothing (everything except shoes)
- Face and hair

**BACKGROUND**: Generate a new clean studio background. Do NOT copy the background from Image 2.

**CRITICAL OUTPUT SIZE**: The final image MUST be ${aspectInfo.promptRatio} format, sized to ${aspectInfo.width}x${aspectInfo.height} pixels.`;

    const result = await callGeminiSecure(
        prompt,
        [
            shoePart,
            modelPart
        ]
        // aspectRatio 제거 - 프롬프트로 비율 지정
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

    // 🔒 HARD LOCK 후처리: 생성된 이미지를 모델 이미지의 정확한 크기로 강제 리사이즈
    console.log(`[ShoeStudioService] HARD LOCK: Forcing output to ${aspectInfo.width}x${aspectInfo.height}...`);
    const generatedImageDataUrl = result.data;

    try {
        // 🔥 모델 이미지의 정확한 픽셀 크기로 강제 리사이즈
        const resizedImage = await forceResizeToExactDimensions(
            generatedImageDataUrl,
            aspectInfo.width,
            aspectInfo.height
        );
        console.log(`[ShoeStudioService] ✓ HARD LOCKED to ${aspectInfo.width}x${aspectInfo.height}`);
        return resizedImage;
    } catch (resizeError) {
        console.warn('[ShoeStudioService] Resize failed, returning original:', resizeError);
        return result.data;
    }
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
