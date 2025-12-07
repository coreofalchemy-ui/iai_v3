/**
 * Model Segmentation Service
 * AI를 사용하여 모델 이미지에서 의류 부위를 감지
 * 지원 부위: 신발, 하의, 내의, 상의, 모자
 */

import { callGeminiSecure } from '../../../lib/geminiClient';

export interface ClothingRegion {
    type: 'outer' | 'top' | 'bottom' | 'shoes' | 'socks' | 'hat';
    label: string; // 한글 라벨 (아웃터, 상의, 하의, 신발, 양말, 모자)
    bounds: {
        x: number;      // 좌상단 X (% 0-100)
        y: number;      // 좌상단 Y (% 0-100)
        width: number;  // 너비 (% 0-100)
        height: number; // 높이 (% 0-100)
    };
    confidence: number; // 신뢰도 (0-1)
}

export interface SegmentationResult {
    regions: ClothingRegion[];
    imageWidth: number;
    imageHeight: number;
}

// 캐시 (이미지 해시 → 결과)
const segmentationCache = new Map<string, SegmentationResult>();

/**
 * 이미지에서 의류 부위 감지
 */
export async function detectClothingRegions(imageBase64: string): Promise<SegmentationResult> {
    console.log('🔍 detectClothingRegions: Starting analysis');

    // 캐시 체크 (간단한 해시)
    const cacheKey = imageBase64.slice(-100);
    if (segmentationCache.has(cacheKey)) {
        console.log('📦 Using cached segmentation result');
        return segmentationCache.get(cacheKey)!;
    }

    const base64 = imageBase64.includes('base64,')
        ? imageBase64.split('base64,')[1]
        : imageBase64;

    const prompt = `
[TASK: DETECT CLOTHING REGIONS IN MODEL IMAGE]

Analyze this model/person image and identify clothing items.
Return bounding boxes for each detected clothing item.

[ITEMS TO DETECT - All 6 types must be checked]
1. outer - 아우터 (jackets, coats, cardigans, blazers, any outerwear worn over clothes)
2. top - 상의 (shirts, t-shirts, blouses, sweaters, inner tops)
3. bottom - 하의 (pants, skirts, shorts, jeans, any lower body clothing)
4. shoes - 신발 (any footwear including sneakers, heels, boots, sandals)
5. socks - 양말 (visible socks, ankle socks, crew socks)
6. hat - 모자 (hats, caps, beanies, any headwear)

[OUTPUT FORMAT]
Return valid JSON array:
{
    "regions": [
        {
            "type": "outer",
            "label": "아우터",
            "bounds": { "x": 20, "y": 15, "width": 60, "height": 35 },
            "confidence": 0.95
        },
        {
            "type": "top",
            "label": "상의",
            "bounds": { "x": 25, "y": 20, "width": 50, "height": 25 },
            "confidence": 0.92
        },
        {
            "type": "bottom",
            "label": "하의",
            "bounds": { "x": 30, "y": 45, "width": 40, "height": 35 },
            "confidence": 0.94
        },
        {
            "type": "shoes",
            "label": "신발",
            "bounds": { "x": 35, "y": 85, "width": 30, "height": 15 },
            "confidence": 0.96
        },
        {
            "type": "socks",
            "label": "양말",
            "bounds": { "x": 35, "y": 78, "width": 30, "height": 10 },
            "confidence": 0.85
        },
        {
            "type": "hat",
            "label": "모자",
            "bounds": { "x": 35, "y": 0, "width": 30, "height": 12 },
            "confidence": 0.90
        }
    ]
}

[IMPORTANT]
- x, y are top-left corner coordinates (0-100 percentage)
- width, height are dimensions (0-100 percentage)
- ONLY include items that are clearly visible in the image
- Do NOT include items that are not visible or barely visible
- confidence should reflect detection certainty (0.0 to 1.0)
- If an item is not present, do NOT include it in regions array
`;

    try {
        const result = await callGeminiSecure(
            prompt,
            [{ data: base64, mimeType: 'image/png' }]
        );

        // Parse JSON response
        let cleanText = result.data.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText);

        const segmentationResult: SegmentationResult = {
            regions: parsed.regions || [],
            imageWidth: 100,
            imageHeight: 100
        };

        // 캐시 저장
        segmentationCache.set(cacheKey, segmentationResult);

        console.log('✅ Detected regions:', segmentationResult.regions.length);
        return segmentationResult;

    } catch (error) {
        console.error('❌ Segmentation failed:', error);
        return { regions: [], imageWidth: 100, imageHeight: 100 };
    }
}

/**
 * 특정 부위 색상 변경 (AI 인페인팅)
 */
export async function changeRegionColor(
    imageBase64: string,
    region: ClothingRegion,
    newColor: string
): Promise<string> {
    console.log(`🎨 changeRegionColor: ${region.label} → ${newColor}`);

    const base64 = imageBase64.includes('base64,')
        ? imageBase64.split('base64,')[1]
        : imageBase64;

    const prompt = `
[TASK: CHANGE CLOTHING COLOR]

Change the color of the ${region.label} (${region.type}) in this image to ${newColor}.

[REGION LOCATION]
- Position: x=${region.bounds.x}%, y=${region.bounds.y}%
- Size: ${region.bounds.width}% x ${region.bounds.height}%

[REQUIREMENTS]
1. Keep the exact same clothing style and shape
2. Only change the COLOR to ${newColor}
3. Maintain realistic fabric texture and lighting
4. Do NOT change anything else in the image
5. Preserve the person, background, and other clothing items

[OUTPUT]
Return the edited image with the color changed.
`;

    const result = await callGeminiSecure(
        prompt,
        [{ data: base64, mimeType: 'image/png' }],
        { aspectRatio: '3:4' }
    );

    if (result.type !== 'image') {
        throw new Error('Color change failed - no image returned');
    }

    return result.data;
}

/**
 * 특정 부위 의류 교체 (Virtual Try-On)
 */
export async function replaceRegionClothing(
    modelImageBase64: string,
    region: ClothingRegion,
    newClothingBase64: string
): Promise<string> {
    console.log(`👔 replaceRegionClothing: Replacing ${region.label}`);

    const modelBase64 = modelImageBase64.includes('base64,')
        ? modelImageBase64.split('base64,')[1]
        : modelImageBase64;

    const clothingBase64 = newClothingBase64.includes('base64,')
        ? newClothingBase64.split('base64,')[1]
        : newClothingBase64;

    const prompt = `
[TASK: VIRTUAL TRY-ON - REPLACE CLOTHING]

Replace the ${region.label} (${region.type}) on the model with the clothing item from the second image.

[FIRST IMAGE]: Model wearing original clothing
[SECOND IMAGE]: New clothing item to apply

[REGION TO REPLACE]
- Type: ${region.type} (${region.label})
- Position: x=${region.bounds.x}%, y=${region.bounds.y}%
- Size: ${region.bounds.width}% x ${region.bounds.height}%

[REQUIREMENTS]
1. Replace the ${region.label} with the new clothing item
2. Adjust the new clothing to fit the model's pose naturally
3. Match lighting and shadows to the original image
4. Keep the model's body pose and proportions
5. Keep all OTHER clothing items unchanged
6. Create a realistic, seamless result

[OUTPUT]
Return the model image with the new clothing item applied.
`;

    const result = await callGeminiSecure(
        prompt,
        [
            { data: modelBase64, mimeType: 'image/png' },
            { data: clothingBase64, mimeType: 'image/png' }
        ],
        { aspectRatio: '3:4' }
    );

    if (result.type !== 'image') {
        throw new Error('Clothing replacement failed - no image returned');
    }

    return result.data;
}

/**
 * 좌표로 해당 부위 찾기
 */
export function findRegionAtPoint(
    regions: ClothingRegion[],
    x: number, // % 0-100
    y: number  // % 0-100
): ClothingRegion | null {
    for (const region of regions) {
        const { bounds } = region;
        if (
            x >= bounds.x &&
            x <= bounds.x + bounds.width &&
            y >= bounds.y &&
            y <= bounds.y + bounds.height
        ) {
            return region;
        }
    }
    return null;
}
