/**
 * 🔐 보안 Shoe Studio 서비스 (Content Generator 전용 복제본)
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

    const prompt = `// === 🔒 PHOTO EDIT MODE - SEAMLESS SHOE SWAP ===
// ⚠️ THIS IS PHOTO EDITING, NOT IMAGE GENERATION ⚠️
// The goal is to make shoes look like they were ORIGINALLY in the photo.

**🎯 MISSION: Replace shoes so naturally that no one can tell they were edited**

[STEP 1: ANALYZE ORIGINAL PHOTO (Image 2)]
Before doing ANYTHING, study Image 2 carefully:
- What is the COLOR TEMPERATURE? (warm/golden? cool/blue? neutral?)
- What is the SHARPNESS level? (sharp? soft? slightly blurry?)
- Is there FILM GRAIN or noise?
- What is the CONTRAST level? (high? low? medium?)
- What is the SATURATION level? (vibrant? muted? desaturated?)
- What is the overall BRIGHTNESS? (bright? dark? moody?)

[STEP 2: PRESERVATION RULES - DO NOT CHANGE]
- Background: KEEP 100% identical
- Model/person: KEEP 100% identical
- Clothing: KEEP 100% identical
- Lighting direction: KEEP identical
- Overall mood: KEEP identical
- Image quality: KEEP identical (if blurry, stay blurry)

[STEP 3: SHOE COLOR GRADING - CRITICAL]
The new shoes from Image 1 must be TRANSFORMED to match Image 2's look:

🌡️ **COLOR TEMPERATURE:**
- If Image 2 is WARM/GOLDEN → Add warm undertones to shoes (not pure black)
- If Image 2 is COOL/BLUE → Add cool undertones to shoes
- Black shoes in warm photos should have BROWN/TAN tint, not pure black

📸 **SHARPNESS MATCHING:**
- If Image 2 is SOFT → Make shoes equally SOFT, reduce edge sharpness
- If Image 2 is SHARP → Keep shoes sharp
- Match the EXACT blur level of the surrounding pixels

🎞️ **FILM LOOK:**
- If Image 2 has grain → Add SAME grain to shoes
- If Image 2 has vintage processing → Apply SAME to shoes
- Match the EXACT noise pattern

🎨 **SATURATION & CONTRAST:**
- If Image 2 is LOW SATURATION → Desaturate the shoes to match
- If Image 2 has LIFTED BLACKS → Don't make shoes pure black
- Match the EXACT contrast curve

💡 **BRIGHTNESS:**
- Shoes should NOT be brighter/cleaner than their surroundings
- If the image is moody/dark, shoes must be moody/dark too
- No "spotlight" effect on shoes

[🚫 ABSOLUTE FAILURES - AVOID AT ALL COSTS]
- ❌ Shoes that look SHARPER than the rest of the image
- ❌ Shoes that are MORE SATURATED than surroundings
- ❌ Pure BLACK shoes in a WARM-toned photo
- ❌ Shoes that look "pasted on" or CGI
- ❌ Shoes that "pop out" from the image
- ❌ Any visible editing seams

[OUTPUT]
- Resolution: ${aspectInfo.width}x${aspectInfo.height} pixels
- Content: Image 2 with shoes seamlessly replaced
- Quality: MUST BE IDENTICAL to Image 2

Image 1: SOURCE for shoe design (use as reference for shape/style)
Image 2: MASTER photo - preserve everything, match all settings to this`;

    const result = await callGeminiSecure(
        prompt,
        [
            shoePart,
            modelPart
        ],
        {
            // 이미지 생성을 트리거하기 위해 config 전달
            aspectRatio: aspectInfo.aspectRatio
        }
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
