/**
 * 🔐 보안 Original Generation 서비스
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure, urlToBase64 } from '../../../lib/geminiClient';

// ============================================================================
// TYPES
// ============================================================================

export interface ImageAsset {
    url: string;
    generatingParams: { pose: string };
}

// ============================================================================
// HELPERS
// ============================================================================

const fileToBase64 = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
        const result = r.result as string;
        res(result.includes('base64,') ? result.split('base64,')[1] : result);
    };
    r.onerror = rej;
    r.readAsDataURL(file);
});

const fileToDataUrl = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
});

// ============================================================================
// 1. 신발 정밀 교체 (SECURE)
// ============================================================================

export async function regenerateShoesOnly(
    baseImageUrl: string,
    productFiles: File[]
): Promise<string> {
    console.log('👟 regenerateShoesOnly (SECURE)');

    const baseB64 = await urlToBase64(baseImageUrl);
    const productImages = await Promise.all(productFiles.map(async f => ({
        data: await fileToBase64(f),
        mimeType: f.type
    })));

    const prompt = `🚨 MANDATORY REQUIREMENTS - READ FIRST 🚨

TASK: Generate a photo where the model is WEARING the uploaded shoes.
⚠️ The model MUST be wearing the shoes from Image 2+ - this is non-negotiable.
⚠️ Analyze Image 1 (model photo) and match EVERYTHING to it.

---

STEP 1: ANALYZE MODEL PHOTO (Image 1)
Before generating, study Image 1 carefully:
- What is the COLOR TEMPERATURE? (warm/golden vs cool/blue)
- What is the LIGHTING MOOD? (soft/harsh, direction)
- What is the FILM LOOK? (vintage, modern, matte, contrasty)
- What is the overall AESTHETIC/VIBE?

STEP 2: APPLY SAME AESTHETIC TO SHOES
The shoes from product images must be rendered with:
- SAME color temperature as Image 1
- SAME lighting direction and quality
- SAME film look/processing
- The shoes should look like they were in the ORIGINAL PHOTO

STEP 3: NATURAL SHOE WEARING
The model must PHYSICALLY WEAR the shoes:
- Feet are INSIDE the shoes
- Ankles connect naturally to shoe collars
- Shoes conform to foot shape with natural creases
- Weight distribution shows shoes are being worn
- Shoes are flat on the floor with proper shadows

WHAT TO KEEP FROM IMAGE 1:
- Face and identity (pixel-perfect)
- Hair style and color
- Body pose and proportions
- All clothing
- Background and environment
- Lighting direction
- COLOR TEMPERATURE AND TONE

WHAT TO TAKE FROM PRODUCT IMAGES:
- Shoe design, color, material, all details
- Model must WEAR these exact shoes

QUALITY:
- Photorealistic, 8K, ultra-sharp
- Commercial photography style
- No blur, no haze

OUTPUT:
A new photograph where the model looks EXACTLY like Image 1 but is naturally WEARING the product shoes.
The shoes must match Image 1's color/tone/mood perfectly.`;

    const images = [
        { data: baseB64, mimeType: 'image/png' },
        ...productImages
    ];

    const result = await callGeminiSecure(prompt, images, { aspectRatio: '3:4' });

    if (result.type !== 'image') throw new Error('Shoe swap failed');
    console.log('✅ regenerateShoesOnly (SECURE): Complete');
    return result.data;
}

// ============================================================================
// 2. 포즈 변경 (SECURE)
// ============================================================================

export async function regenerateImageWithSpecificPose(
    baseImageUrl: string,
    pose: string
): Promise<ImageAsset> {
    console.log(`🎭 regenerateImageWithSpecificPose (SECURE): ${pose.substring(0, 50)}...`);

    const baseB64 = await urlToBase64(baseImageUrl);

    const prompt = `// --- TASK: FULL_BODY_POSE_MODIFICATION ---
// ACTION: Change the pose of the model to: "${pose}"
// INPUT: Reference Image (Source)

// [🔒 COLOR PRESERVATION - CRITICAL - NO FILTER]
// 1. **EXACT COLOR MATCH**: Copy the EXACT colors from source image.
// 2. **NO FILTERS**: Do NOT apply any color grading, filters, or tonal adjustments.
// 3. **NO DESATURATION**: Maintain full color saturation as in source.
// 4. **NO WARMING/COOLING**: Do not shift color temperature.
// 5. **SAME BRIGHTNESS**: Match exact brightness and contrast levels.
// 6. **SAME TEXTURE**: Preserve fabric and skin textures exactly as source.
// 7. If source is warm, output is warm. If source is cool, output is cool.
// 8. COLOR MISMATCH OR FILTER EFFECT = FAILURE

// [CRITICAL RULES]
// 1. **FRAMING**: FULL BODY SHOT (Head to Toe). DO NOT CROP HEAD.
// 2. **IDENTITY LOCK**: Face, Hair, and Skin Tone must be PIXEL-PERFECT match to source.
// 3. **APPAREL LOCK**: Upper body clothing and SHOES must remain IDENTICAL.
// 4. **BACKGROUND**: Keep the background IDENTICAL to source.

// [QUALITY - CRITICAL]
// - Photorealistic, Commercial Photography style
// - 8K Resolution, Ultra-Sharp Focus
// - Commercial Catalog Style quality
// - NO BLUR, NO artistic haze, NO low resolution

// [SHOE RULES]
// - TEXTURE, OUTSOLE, STITCHING, LACES, LOGO = 100% identical to source

// [NEGATIVE CONSTRAINTS]
// - No blur
// - No artistic haze
// - No distortion
// - No filters or color grading

// [OUTPUT]
// Photorealistic full-body photo with modified pose.
// Sharp 8K quality, identical identity/clothes/colors to source.
// COLORS MUST BE IDENTICAL TO SOURCE - NO FILTER EFFECTS!

SOURCE_IMAGE: [Provided image]`;

    const result = await callGeminiSecure(
        prompt,
        [{ data: baseB64, mimeType: 'image/png' }],
        { aspectRatio: '3:4' }
    );

    if (result.type !== 'image') throw new Error('Pose change failed');
    console.log('✅ regenerateImageWithSpecificPose (SECURE): Complete');
    return { url: result.data, generatingParams: { pose } };
}

// ============================================================================
// 3. 하반신 크롭 (SECURE)
// ============================================================================

export async function generateVerticalLegsCrop(baseImageUrl: string): Promise<string> {
    console.log('🦵 generateVerticalLegsCrop (SECURE)');

    const baseB64 = await urlToBase64(baseImageUrl);

    // 클로즈업 컷 - 가까이서 촬영한 사진
    const prompt = `🚨 MANDATORY OUTPUT REQUIREMENTS - READ FIRST 🚨

PHOTOGRAPHY TYPE: CLOSEUP SHOT (camera positioned CLOSE to subject)
⚠️ NOT a cropped full body photo - this is SHOT as a closeup.
⚠️ Camera is NEAR the lower body, naturally showing waist-to-feet.

COLOR RULE: EXACT MATCH to source image.
⚠️ NO filters. NO color grading. NO tone changes. NO desaturation.
⚠️ If output colors differ from source = FAILURE.

---

TASK: Take a CLOSEUP PHOTOGRAPH of a model's lower body wearing shoes.

CAMERA SETUP:
- Camera is positioned CLOSE to the model (closeup photography)
- Camera angle: Looking at the lower body from nearby
- Framing naturally shows waist/hip down to feet
- This is HOW fashion photographers shoot shoe details

WHAT THIS IMAGE SHOWS:
- Model's lower body from waist/hip down to feet
- The model is WEARING shoes (feet are INSIDE the shoes)
- Pants/trousers on the legs
- Shoes on the floor with natural shadows
- Shot from CLOSE distance (not far away then cropped)

WHY THIS IS NOT A CROP:
- This is photographed CLOSE, not cropped from full body
- Camera is near the subject, naturally framing lower body
- Like a photographer kneeling/bending to shoot shoe details
- Natural depth of field from closeup photography

PRESERVE FROM SOURCE:
- Same model (skin tone, body type)
- Same clothing (pants color, fabric)
- Same shoes (exact design, color, material)
- Same floor/background
- Same lighting direction
- SAME COLORS - NO FILTER!

QUALITY:
- Photorealistic, 8K, ultra-sharp
- Focus on shoes and legs
- No blur, no haze
- Natural closeup photography look

REFERENCE: [Source Image]`;

    const result = await callGeminiSecure(
        prompt,
        [{ data: baseB64, mimeType: 'image/png' }],
        { aspectRatio: '3:4' }
    );

    if (result.type !== 'image') throw new Error('Leg crop failed');
    console.log('✅ generateVerticalLegsCrop (SECURE): Complete');
    return result.data;
}

// ============================================================================
// 병렬 처리 헬퍼
// ============================================================================

async function generateVariations(base: ImageAsset, poses: { prompt: string, name: string }[]): Promise<ImageAsset[]> {
    const results: ImageAsset[] = [];

    for (const p of poses) {
        try {
            const a = await regenerateImageWithSpecificPose(base.url, p.prompt);
            results.push({ ...a, generatingParams: { pose: p.name } });
        } catch (e) {
            console.error(`Failed: ${p.name}:`, e);
        }
    }

    return results;
}

// ============================================================================
// 메인 진입점 (SECURE)
// ============================================================================

export async function generateInitialOriginalSet(
    productFiles: File[],
    modelFiles: File[],
    onProgress?: (msg: string) => void,
    fullBodyPoses?: { prompt: string, name: string }[],
    closeupPoses?: { prompt: string, name: string }[]
): Promise<{ modelShots: ImageAsset[], closeupShots: ImageAsset[] }> {
    console.log('🚀 generateInitialOriginalSet (SECURE)');

    const defaultFullBodyPoses = [
        { name: 'Walking', prompt: 'Walking forward towards camera. Dynamic stride.' },
        { name: 'Crossed Legs', prompt: 'Standing with legs crossed casually.' }
    ];
    const defaultCloseupPoses = [
        { name: 'Side Step', prompt: 'Close-up: Feet from the side profile.' },
        { name: '45 Degree', prompt: 'Close-up: Feet at 45-degree angle.' }
    ];

    const usedFullBodyPoses = fullBodyPoses || defaultFullBodyPoses;
    const usedCloseupPoses = closeupPoses || defaultCloseupPoses;

    // 1. 마스터 컷 생성
    onProgress?.('1/5: 모델 전신 마스터 컷 생성 중 (SECURE)...');
    const mainModelFile = modelFiles.length > 1 ? modelFiles[1] : modelFiles[0];
    const originalModelUrl = await fileToDataUrl(mainModelFile);
    const masterSwappedImageUrl = await regenerateShoesOnly(originalModelUrl, productFiles);
    const masterModelAsset: ImageAsset = { url: masterSwappedImageUrl, generatingParams: { pose: 'Front View (Master)' } };

    // 2. 전신 포즈 변형 생성
    onProgress?.('2/5: 전신 컷 변형 생성 중...');
    const modelVariations = await generateVariations(masterModelAsset, usedFullBodyPoses);

    // 3. 하반신 클로즈업 마스터 컷 생성
    onProgress?.('3/5: 하반신 클로즈업 마스터 컷 생성 중...');
    const frontCloseupUrl = await generateVerticalLegsCrop(masterSwappedImageUrl);
    const masterCloseupAsset: ImageAsset = { url: frontCloseupUrl, generatingParams: { pose: 'Original Leg Crop' } };

    // 4. 클로즈업 포즈 변형 생성
    onProgress?.('4/5: 클로즈업 변형 생성 중...');
    const closeupVariations = await generateVariations(masterCloseupAsset, usedCloseupPoses);

    // 5. 완료
    onProgress?.('5/5: 모든 이미지 마무리 중...');

    const modelShots = [masterModelAsset, ...modelVariations];
    const closeupShots = [masterCloseupAsset, ...closeupVariations];

    console.log(`✅ generateInitialOriginalSet (SECURE): Complete!`);
    return { modelShots, closeupShots };
}
