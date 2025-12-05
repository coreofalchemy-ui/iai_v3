/**
 * 🔐 보안 Face Synthesis 서비스 - SKULL LOCK & DOWNSCALING
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure, urlToBase64, extractBase64 } from '../../../lib/geminiClient';

// ============================================================================
// HELPERS
// ============================================================================

function dataUrlToImage(url: string): { data: string; mimeType: string } {
    if (url.includes('base64,')) {
        const [prefix, data] = url.split('base64,');
        const mimeMatch = prefix.match(/data:([^;]+)/);
        return { data, mimeType: mimeMatch ? mimeMatch[1] : 'image/png' };
    }
    return { data: url, mimeType: 'image/png' };
}

async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.includes('base64,') ? result.split('base64,')[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================================================================
// CORE PROMPT: SKULL LOCK & DOWNSCALING
// ============================================================================

function getCampaignSynthesisPrompt(): string {
    return `// ============================================================================
// PROTOCOL: SKULL LOCK + DOWNSCALING IDENTITY SYNTHESIS (SECURE)
// ============================================================================

**ABSOLUTE RULE: OUTPUT = ABSOLUTE_CANVAS + FACE_TEXTURE**

**IMAGE 1 = ABSOLUTE_CANVAS (모델 전신)**
- This defines: Body shape, Pose, Background, Color grading, Resolution, Clothing, Shoes
- SKULL LOCK: Head size, Jawline, Hair volume = FIXED MESH (절대 변경 금지)
- Everything about this image is the reference

**IMAGE 2 = FACE_TEXTURE (얼굴 사진)**
- ONLY extract: Facial features (Eyes, Nose, Lips)
- DOWNSCALING: Shrink facial features to fit within SKULL LOCK mesh
- DO NOT use: Head size, Jawline, Hair from Image 2

**OUTPUT REQUIREMENTS:**
1. Body, Pose, Clothes, Shoes, Background = 100% from Image 1
2. Skull outline, Head shape, Jawline = 100% from Image 1 (SKULL LOCK)
3. Hair style, Hair volume, Hair color = 100% from Image 1
4. ONLY facial features (Eyes, Nose, Lips) = from Image 2
5. Match skin tone to Image 1's lighting
6. Resolution and color grading = from Image 1

**CRITICAL:**
- DO NOT change the model's head size or shape
- DO NOT change the model's hairstyle or volume
- ONLY replace inner facial features while keeping outer skull structure`;
}

// ============================================================================
// MAIN SYNTHESIS FUNCTION (SECURE)
// ============================================================================

export interface SynthesisResult {
    success: boolean;
    imageUrl?: string;
    error?: string;
}

/**
 * 🔐 캠페인 이미지 합성 (얼굴 이식) - 보안 버전
 */
export async function synthesizeCampaignImage(
    targetModelImage: string | File,
    faceImage: string | File,
    shoeImages?: (string | File)[]
): Promise<SynthesisResult> {
    console.log('🔐 synthesizeCampaignImage (SECURE) called');

    try {
        // Convert inputs to base64
        let modelB64: string;
        let faceB64: string;

        if (targetModelImage instanceof File) {
            modelB64 = await fileToBase64(targetModelImage);
        } else {
            modelB64 = await urlToBase64(targetModelImage);
        }

        if (faceImage instanceof File) {
            faceB64 = await fileToBase64(faceImage);
        } else {
            faceB64 = await urlToBase64(faceImage);
        }

        const prompt = getCampaignSynthesisPrompt();

        const images = [
            { data: modelB64, mimeType: 'image/png' },
            { data: faceB64, mimeType: 'image/png' }
        ];

        // Add shoe images if provided
        if (shoeImages && shoeImages.length > 0) {
            for (const shoe of shoeImages.slice(0, 2)) {
                if (shoe instanceof File) {
                    images.push({ data: await fileToBase64(shoe), mimeType: 'image/png' });
                } else {
                    images.push({ data: await urlToBase64(shoe), mimeType: 'image/png' });
                }
            }
        }

        const result = await callGeminiSecure(prompt, images, { aspectRatio: '3:4' });

        if (result.type !== 'image') {
            return { success: false, error: 'No image generated' };
        }

        return { success: true, imageUrl: result.data };

    } catch (error: any) {
        console.error('Face synthesis failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 🔐 배치 얼굴 합성 - 보안 버전
 */
export async function batchFaceSynthesis(
    modelImages: (string | File)[],
    faceImage: string | File,
    shoeImages?: (string | File)[],
    onProgress?: (current: number, total: number, result: SynthesisResult) => void
): Promise<SynthesisResult[]> {
    console.log(`🔐 batchFaceSynthesis (SECURE): Processing ${modelImages.length} images`);
    const results: SynthesisResult[] = [];

    for (let i = 0; i < modelImages.length; i++) {
        const result = await synthesizeCampaignImage(modelImages[i], faceImage, shoeImages);
        results.push(result);
        onProgress?.(i + 1, modelImages.length, result);
    }

    return results;
}

/**
 * 🔐 단일 이미지 얼굴 교체 (SKULL LOCK) - 보안 버전
 */
export async function replaceFaceWithSkullLock(
    targetImageBase64: string,
    sourceFaceBase64: string
): Promise<string> {
    const targetB64 = targetImageBase64.includes('base64,') ? targetImageBase64.split('base64,')[1] : targetImageBase64;
    const faceB64 = sourceFaceBase64.includes('base64,') ? sourceFaceBase64.split('base64,')[1] : sourceFaceBase64;

    const prompt = getCampaignSynthesisPrompt();

    const result = await callGeminiSecure(
        prompt,
        [
            { data: targetB64, mimeType: 'image/png' },
            { data: faceB64, mimeType: 'image/png' }
        ],
        { aspectRatio: '1:1' }
    );

    if (result.type !== 'image') {
        throw new Error('Face replacement failed');
    }

    return result.data;
}
