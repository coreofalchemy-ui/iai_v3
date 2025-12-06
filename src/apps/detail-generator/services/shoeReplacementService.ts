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

    const prompt = `[TASK: PRECISION SHOE REPLACEMENT]

[IMAGE 1] CONTENT - Photo where shoes need to be replaced
[IMAGE 2] NEW SHOE - The exact shoe product to use as replacement

[SHOE ANALYSIS - CRITICAL]
Carefully analyze NEW SHOE (Image 2) for:
- OUTSOLE: Exact shape, thickness, tread pattern, color
- UPPER: Material texture (leather, suede, canvas, mesh), color, pattern
- STITCHING: Thread color, stitch type, placement
- CONSTRUCTION: Sole attachment method, heel design, toe shape
- DETAILS: Laces, eyelets, branding, decorative elements, pull tabs

[REPLACEMENT RULES]
1. Replace ALL shoes visible in Image 1 with the EXACT shoe from Image 2
2. Each replacement shoe MUST have:
   - Identical outsole design and tread pattern
   - Identical upper material and texture rendering
   - Identical stitching details
   - Identical color (match EXACTLY)
   - Correct perspective matching the foot angle
3. PRESERVE everything else in Image 1:
   - Model's pose, body, clothing, face
   - Background and environment
   - Lighting and shadows

[QUALITY]
- 1K resolution output
- Professional commercial photography quality
- Realistic material rendering
- Natural shadows under the shoes

[OUTPUT]
Same scene as Image 1 with shoes replaced by exact copy of Image 2's shoe.`;

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
