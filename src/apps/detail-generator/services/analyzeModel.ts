/**
 * 🔐 보안 Analyze Model 서비스
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure, urlToBase64 } from '../../../lib/geminiClient';

export interface ClothingRegion {
    type: 'face' | 'hat' | 'glasses' | 'top' | 'inner' | 'bottom' | 'shoes' | 'skirt' | 'pants' | 'socks';
    bbox: { x: number; y: number; width: number; height: number };
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
    confidence: number;
}

export interface ModelAnalysis {
    imageUrl: string;
    regions: ClothingRegion[];
    analyzedAt: number;
}

/**
 * 🔐 모델 이미지 분석 - 보안 버전
 */
export async function analyzeModelImage(imageUrl: string): Promise<ModelAnalysis> {
    const base64 = await urlToBase64(imageUrl);

    const prompt = `Analyze this fashion model image and detect positions of clothing items.

For each detected item, provide:
- type: one of ["face", "hat", "glasses", "top", "inner", "bottom", "shoes"]
- x, y: normalized coordinates (0-1) of the item center
- width, height: normalized dimensions (0-1)
- angle: rotation angle in degrees
- confidence: detection confidence (0-1)

Respond in JSON format:
{
    "regions": [
        {"type": "face", "x": 0.5, "y": 0.15, "width": 0.2, "height": 0.15, "angle": 0, "confidence": 0.95},
        {"type": "top", "x": 0.5, "y": 0.4, "width": 0.4, "height": 0.25, "angle": 0, "confidence": 0.9}
    ]
}`;

    try {
        const result = await callGeminiSecure(
            prompt,
            [{ data: base64, mimeType: 'image/jpeg' }]
        );

        const parsed = JSON.parse(result.data);
        const regions = (parsed.regions || []).map((r: any) => ({
            ...r,
            bbox: { x: r.x, y: r.y, width: r.width, height: r.height }
        }));

        return {
            imageUrl,
            regions,
            analyzedAt: Date.now()
        };
    } catch (e) {
        console.error('Failed to analyze model image:', e);
        return { imageUrl, regions: [], analyzedAt: Date.now() };
    }
}

/**
 * 🔐 아이템 유형 감지 - 보안 버전
 */
export async function detectItemType(imageUrl: string): Promise<string> {
    const base64 = await urlToBase64(imageUrl);

    const prompt = `What type of clothing item is in this image?
Respond with ONLY one word from this list:
- hat
- glasses
- top
- inner
- bottom
- shoes
- unknown`;

    try {
        const result = await callGeminiSecure(
            prompt,
            [{ data: base64, mimeType: 'image/jpeg' }]
        );

        const type = result.data.trim().toLowerCase();
        const validTypes = ['hat', 'glasses', 'top', 'inner', 'bottom', 'shoes'];
        return validTypes.includes(type) ? type : 'unknown';
    } catch (e) {
        console.error('Failed to detect item type:', e);
        return 'unknown';
    }
}

/**
 * 🔐 의류 아이템 합성 - 보안 버전
 */
export async function compositeClothingItem(params: {
    baseImage: string;
    itemImage: string;
    itemType: string;
    targetRegion: ClothingRegion;
}): Promise<string> {

    const baseB64 = await urlToBase64(params.baseImage);
    const itemB64 = await urlToBase64(params.itemImage);

    const prompt = `// --- TASK: CLOTHING_COMPOSITE (SECURE) ---
// Replace the ${params.itemType} on the model with the provided item.

**[CRITICAL RULES]**
1. Keep model's face, body, and pose IDENTICAL
2. Replace ONLY the ${params.itemType} region
3. Maintain realistic lighting and shadows
4. Ensure seamless integration
5. Keep background unchanged

Target region: x=${params.targetRegion.x}, y=${params.targetRegion.y}

BASE_IMAGE: [First image]
ITEM_IMAGE: [Second image]`;

    const result = await callGeminiSecure(
        prompt,
        [
            { data: baseB64, mimeType: 'image/png' },
            { data: itemB64, mimeType: 'image/png' }
        ]
    );

    if (result.type !== 'image') {
        throw new Error('Composite failed');
    }

    return result.data;
}

/**
 * 🔐 아이템 색상 변경 - 보안 버전
 */
export async function changeItemColor(params: {
    baseImage: string;
    itemType: string;
    targetColor: string;
    colorName: string;
    targetRegion?: ClothingRegion;
}): Promise<string> {
    console.log(`🔐 changeItemColor (SECURE): ${params.itemType} to ${params.colorName}`);

    const baseB64 = await urlToBase64(params.baseImage);

    const prompt = `// --- TASK: COLOR_CHANGE (SECURE) ---
// Change the color of the ${params.itemType} to ${params.colorName} (${params.targetColor}).

**[CRITICAL RULES]**
1. Keep model's face, body, and pose IDENTICAL
2. Change ONLY the ${params.itemType} color
3. Maintain fabric texture and details
4. Keep realistic lighting and shadows
5. Keep background unchanged

Output a high-quality fashion photo with the color change applied.`;

    const result = await callGeminiSecure(
        prompt,
        [{ data: baseB64, mimeType: 'image/png' }]
    );

    if (result.type !== 'image') {
        throw new Error('Color change failed');
    }

    return result.data;
}
