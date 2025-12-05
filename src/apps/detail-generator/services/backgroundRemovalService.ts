/**
 * 🔐 보안 Background Removal 서비스
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure } from '../../../lib/geminiClient';

interface BackgroundRemovalResult {
    original: string;
    result: string | null;
    error?: string;
}

/**
 * 🔐 단일 이미지 배경 제거 - 보안 버전
 */
export async function removeBackground(imageBase64: string): Promise<string | null> {
    console.log('🔐 removeBackground (SECURE)');

    const base64Data = imageBase64.includes('base64,')
        ? imageBase64.split('base64,')[1]
        : imageBase64;

    const prompt = `Remove the background completely from this product image. 
    Make the background pure transparent (alpha channel = 0).
    Remove ALL shadows, reflections, and any background elements.
    Keep ONLY the product itself with clean, sharp edges.
    Output a PNG image with transparent background.
    The product should be cleanly isolated without any artifacts.`;

    try {
        const result = await callGeminiSecure(
            prompt,
            [{ data: base64Data, mimeType: 'image/png' }]
        );

        if (result.type !== 'image') {
            console.error('No image in background removal response');
            return null;
        }

        return result.data;
    } catch (error) {
        console.error('Background removal error:', error);
        return null;
    }
}

/**
 * 🔐 배치 배경 제거 - 보안 버전
 */
export async function batchRemoveBackground(
    images: string[],
    onProgress?: (current: number, total: number) => void
): Promise<BackgroundRemovalResult[]> {
    const results: BackgroundRemovalResult[] = [];

    for (let i = 0; i < images.length; i++) {
        onProgress?.(i + 1, images.length);

        try {
            const result = await removeBackground(images[i]);
            results.push({
                original: images[i],
                result: result
            });
        } catch (error) {
            results.push({
                original: images[i],
                result: null,
                error: String(error)
            });
        }

        // Small delay to avoid rate limiting
        if (i < images.length - 1) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    return results;
}
