/**
 * Model Segmentation Service
 * AI를 사용하여 모델 이미지에서 의류 부위를 감지
 * 지원 부위: 신발, 하의, 내의, 상의, 모자
 */

import { callGeminiSecure, urlToBase64 } from '../../../lib/geminiClient';

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

    // Convert to base64 if it's a URL/Blob
    const base64 = await urlToBase64(imageBase64);

    const prompt = `
[TASK: PRECISE CLOTHING REGION DETECTION - Korean Fashion Model]

You are analyzing a FASHION MODEL photo. Your job is to detect clothing regions with ACCURATE bounding boxes.

---

📍 BODY ZONE REFERENCE (Percentage from TOP of image):
- HEAD/HAT zone: 0% ~ 10%
- UPPER BODY (shoulders to waist): 8% ~ 40%
  • Outer layer (jacket/coat): covers 8% ~ 40%
  • Top (shirt/blouse/t-shirt): typically 15% ~ 38%
- LOWER BODY (waist to ankle): 35% ~ 85%
  • Bottom (pants/skirt): 38% ~ 80%
- LEGS LOWER (ankle area): 75% ~ 90%
  • Socks visible in this zone
- FEET zone: 80% ~ 100%
  • Shoes: typically 82% ~ 98%

---

🎯 DETECTION RULES:
1. ALWAYS detect TOP, BOTTOM, SHOES if the model is wearing them
2. Detect SOCKS if ankle/lower leg is visible and socks are worn
3. Detect OUTER if wearing jacket, coat, cardigan over the top
4. Detect HAT if wearing any headwear
5. Use the body zone percentages above for accurate Y positioning
6. Width should be centered (typically x: 15-25%, width: 50-70%)

---

🔖 LABELS (Korean):
- outer: "아우터" or "자켓"
- top: "상의" or "셔츠"
- bottom: "하의" or "바지"
- shoes: "신발"
- socks: "양말"
- hat: "모자"

---

📤 OUTPUT FORMAT (JSON only, no text):
{
    "regions": [
        { "type": "top", "label": "상의", "bounds": { "x": 15, "y": 12, "width": 70, "height": 30 }, "confidence": 0.95 },
        { "type": "bottom", "label": "하의", "bounds": { "x": 15, "y": 40, "width": 70, "height": 38 }, "confidence": 0.95 },
        { "type": "socks", "label": "양말", "bounds": { "x": 25, "y": 78, "width": 50, "height": 8 }, "confidence": 0.8 },
        { "type": "shoes", "label": "신발", "bounds": { "x": 20, "y": 85, "width": 60, "height": 13 }, "confidence": 0.95 }
    ]
}
    `;

    try {
        const result = await callGeminiSecure(
            prompt,
            [{ data: base64, mimeType: 'image/png' }],
            { responseMimeType: 'application/json' }
        );

        // Robust JSON extraction - Gemini sometimes returns text with embedded JSON
        let jsonText = result.data;

        // Remove markdown code blocks
        jsonText = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();

        // Try to find JSON object in the response
        const jsonMatch = jsonText.match(/\{[\s\S]*"regions"[\s\S]*\}/);
        if (jsonMatch) {
            jsonText = jsonMatch[0];
        } else {
            // Fallback: try parsing as-is
            console.warn('⚠️ No JSON object found in response, attempting parse anyway');
        }

        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch (parseError) {
            console.error('❌ JSON parse failed. Raw response:', result.data.substring(0, 200));
            // Return default regions for the content
            return {
                regions: [
                    { type: 'top', label: '상의', confidence: 0.7, bounds: { x: 10, y: 10, width: 80, height: 30 } },
                    { type: 'bottom', label: '하의', confidence: 0.7, bounds: { x: 10, y: 45, width: 80, height: 35 } },
                    { type: 'shoes', label: '신발', confidence: 0.7, bounds: { x: 20, y: 85, width: 60, height: 12 } }
                ],
                imageWidth: 100,
                imageHeight: 100
            };
        }

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

    // Convert to base64 if it's a URL/Blob
    const base64 = await urlToBase64(imageBase64);

    const prompt = `
[TASK: CHANGE CLOTHING COLOR - STRICT MASKING]

Change the color of the ${region.label} (${region.type}) to ${newColor} while preserving EVERYTHING else.

[REGION LOCATION]
- Position: x=${region.bounds.x}%, y=${region.bounds.y}%
- Size: ${region.bounds.width}% x ${region.bounds.height}%

[STRICT REQUIREMENTS]
1. **TARGET ONLY THE ${region.label}**: Do NOT touch skin, background, or other clothes.
2. **MAINTAIN TEXTURE**: Keep the original fabric texture, folds, and lighting. Just change the hue/saturation.
3. **NO BLEEDING**: Valid boundary is critical. The color must NOT bleed into the background.
4. **PRESERVE IDENTITY**: The model's face, body, and pose must be 100% identical.
5. **REALISM**: The result must look like a natural photo, not a flat fill.
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
 * 특정 부위 의류 교체 (Virtual Try-On) - 2단계 검증 방식
 * Pass 1: 옷 인식/분석
 * Pass 2: 검증 후 최종 출력
 */
export async function replaceRegionClothing(
    modelImageBase64: string,
    region: ClothingRegion,
    newClothingBase64: string
): Promise<string> {
    console.log(`👔 replaceRegionClothing: Replacing ${region.label} (2-Pass Verification)`);

    // Convert inputs to base64
    const modelBase64 = await urlToBase64(modelImageBase64);
    const clothingBase64 = await urlToBase64(newClothingBase64);

    // =============== PASS 1: 의류 분석 (Clothing Analysis) ===============
    console.log('📋 PASS 1: 의류 분석 중...');

    const analysisPrompt = `
[TASK: CLOTHING ANALYSIS - PASS 1]

Analyze the provided clothing item image and describe:

1. **TYPE**: What type of clothing is this? (top, pants, jacket, shoes, etc.)
2. **COLOR**: Primary and secondary colors
3. **MATERIAL**: Fabric type (cotton, leather, denim, etc.)
4. **PATTERN**: Any patterns (striped, solid, checkered, floral, etc.)
5. **DETAILS**: Notable features (buttons, zippers, logos, stitching)
6. **FIT STYLE**: Loose, slim, oversized, etc.

Also analyze how this item should be placed on the target region:
- Target: ${region.type} (${region.label})
- Bounds: x=${region.bounds.x}%, y=${region.bounds.y}%, w=${region.bounds.width}%, h=${region.bounds.height}%

Return a detailed JSON analysis:
{
    "type": "...",
    "colors": ["..."],
    "material": "...",
    "pattern": "...",
    "details": ["..."],
    "fitStyle": "...",
    "placementNotes": "..."
}
`;

    const analysisResult = await callGeminiSecure(
        analysisPrompt,
        [{ data: clothingBase64, mimeType: 'image/png' }],
        { responseMimeType: 'application/json' }
    );

    let clothingAnalysis = '{}';
    if (analysisResult.type === 'text') {
        clothingAnalysis = analysisResult.data;
        console.log('✅ PASS 1 완료 - 의류 분석:', clothingAnalysis.substring(0, 100));
    }

    // =============== PASS 2: 검증 및 최종 출력 (Verify & Generate) ===============
    console.log('🎨 PASS 2: 검증 및 최종 이미지 생성 중...');

    const generationPrompt = `
[TASK: VIRTUAL TRY-ON - PASS 2 (VERIFIED GENERATION)]

You have already analyzed the clothing item. Now apply it to the model with pixel-perfect precision.

[CLOTHING ANALYSIS (from Pass 1)]
${clothingAnalysis}

[INPUTS]
1. Image 1: Model wearing original clothing
2. Image 2: New clothing item to apply

[TARGET REGION]
- Part: ${region.type} (${region.label})
- Bounds: x=${region.bounds.x}%, y=${region.bounds.y}%, w=${region.bounds.width}%, h=${region.bounds.height}%

[EXECUTION STEPS]
1. **SEGMENT**: Identify exact pixels of original ${region.label}
2. **MASK**: Create precise mask for replacement area only
3. **TRANSFORM**: Warp new clothing to match model's pose
4. **COMPOSITE**: Layer new item maintaining fabric physics
5. **BLEND**: Match lighting, shadows, and edges seamlessly
6. **VERIFY**: Double-check no unintended changes to other areas

[STRICT PRESERVATION]
✅ Face, hair, skin - UNTOUCHED
✅ Background - IDENTICAL
✅ Other clothing - UNCHANGED
✅ Body pose - PRESERVED

[OUTPUT]
Photorealistic result where model wears the new ${region.label}.
`;

    const result = await callGeminiSecure(
        generationPrompt,
        [
            { data: modelBase64, mimeType: 'image/png' },
            { data: clothingBase64, mimeType: 'image/png' }
        ],
        { aspectRatio: '3:4' }
    );

    if (result.type !== 'image') {
        throw new Error('Clothing replacement failed - no image returned');
    }

    console.log('✅ PASS 2 완료 - 최종 이미지 생성 완료');
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
