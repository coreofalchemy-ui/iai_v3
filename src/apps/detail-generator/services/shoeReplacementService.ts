/**
 * 🔐 보안 신발 교체 서비스
 * 콘텐츠 이미지의 신발을 새 제품으로 교체합니다.
 */

import { callGeminiSecure, urlToBase64 } from '../../../lib/geminiClient';

export interface ShoeReplacementOptions {
    contentImageUrl: string;   // 교체할 대상 이미지 (모델 착용 사진 등)
    newShoeImageUrl: string;   // 새로 교체할 신발 이미지
}

/**
 * 🔐 신발 교체 (보안)
 * 콘텐츠 이미지의 신발을 새 신발로 교체합니다.
 */
export async function replaceShoe(options: ShoeReplacementOptions): Promise<string> {
    const contentBase64 = await urlToBase64(options.contentImageUrl);
    const shoeBase64 = await urlToBase64(options.newShoeImageUrl);

    const prompt = `[PROTOCOL: INPAINTING & COMPOSITING - GEMINI 3.0]

**TASK**: Remove the original shoes in [IMAGE 1] and composite [IMAGE 2] (New Shoe) into that exact position.

**STRICT RULES:**
1.  **MASKING**: Completely ERASE the original shoes in [IMAGE 1].
2.  **PATCHING**: Insert [IMAGE 2] (New Shoe) into the erassed area.
    *   **TEXTURE LOCK**: The inserted shoe MUST retain 100% of [IMAGE 2]'s upper material, outsole pattern, logos, and stitching.
    *   **NO HALLUCINATION**: Do not invent new details. Copy [IMAGE 2] exactly.
    *   **PERSPECTIVE WARP**: Warping [IMAGE 2] to fit the model's foot angle is allowed, but changing the design is FORBIDDEN.
3.  **ENVIRONMENT**:
    *   **SHADOWS**: Preserve the original ground shadows from [IMAGE 1].
    *   **LIGHTING**: Adjust the brightness/contrast of the inserted shoe to match [IMAGE 1]'s scene.
4.  **OUTSOLE PRECISION**: The outsole (bottom of shoe) must match [IMAGE 2] exactly. Do not flatten or simplify it.

**OUTPUT GOAL**: A photorealistic composite where the model is wearing the EXACT shoe from [IMAGE 2].`;

    const result = await callGeminiSecure(
        prompt,
        [
            { data: contentBase64, mimeType: 'image/png' },
            { data: shoeBase64, mimeType: 'image/png' }
        ],
        { imageSize: '1K' }
    );

    console.log('🔄 Gemini 응답 타입:', result.type);

    if (result.type !== 'image') {
        console.error('❌ 이미지가 아닌 응답:', result.data?.substring(0, 100));
        throw new Error('신발 교체 실패: 이미지가 생성되지 않았습니다');
    }

    // API가 이미 data URL 형식으로 반환하는지 확인
    if (result.data.startsWith('data:')) {
        console.log('✅ 신발 교체 완료 (data URL)');
        return result.data;
    }

    console.log('✅ 신발 교체 완료 (base64)');
    return `data:image/png;base64,${result.data}`;
}

/**
 * 🔐 일괄 신발 교체
 * 여러 콘텐츠 이미지의 신발을 한 번에 교체합니다.
 */
export async function batchReplaceShoes(
    contentImageUrls: string[],
    newShoeImageUrl: string,
    onProgress?: (current: number, total: number, message: string) => void
): Promise<{ url: string; success: boolean; error?: string }[]> {
    const results: { url: string; success: boolean; error?: string }[] = [];

    for (let i = 0; i < contentImageUrls.length; i++) {
        onProgress?.(i + 1, contentImageUrls.length, `이미지 ${i + 1}/${contentImageUrls.length} 처리 중...`);

        try {
            const replacedUrl = await replaceShoe({
                contentImageUrl: contentImageUrls[i],
                newShoeImageUrl
            });
            results.push({ url: replacedUrl, success: true });
        } catch (error: any) {
            console.error(`신발 교체 실패 (${i + 1}):`, error);
            results.push({ url: '', success: false, error: error.message });
        }
    }

    return results;
}

/**
 * File을 Data URL로 변환
 */
export async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
