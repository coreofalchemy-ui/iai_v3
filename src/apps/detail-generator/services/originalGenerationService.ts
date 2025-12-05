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

    const prompt = `// --- PROTOCOL: AGGRESSIVE_SHOE_REPLACEMENT (SECURE) ---
// TASK: COMPLETELY ERASE old shoes and paint PRODUCT_IMAGES on the feet.
// OUTPUT FORMAT: Portrait (3:4).
//
// [INSTRUCTIONS]
// 1. TARGET: Identify the feet/shoes area in BASE_IMAGE.
// 2. ACTION: REPLACE the shoes with exact design from PRODUCT_IMAGES.
// 3. IDENTITY LOCK: EVERYTHING ELSE (Face, Hair, Trousers, Background) MUST BE IDENTICAL.
// 4. INTEGRATION: Ensure realistic lighting and shadows.
//
// [CRITICAL SHOE RULES]
// - TEXTURE, SIZE, OUTSOLE, DESIGN, STITCHING, LACES, LOGO = 100% from product.
//
// BASE_IMAGE: [First image]
// PRODUCT_IMAGES: [Remaining images]`;

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

    const prompt = `// --- TASK: POSE_MODIFICATION (SECURE) ---
// CHANGE POSE TO: ${pose}
// OUTPUT: Portrait (3:4).
//
// [RULES]
// 1. FACE & IDENTITY: MUST MATCH SOURCE.
// 2. CLOTHING: Keep upper body clothing identical.
// 3. SHOES: Keep the shoes PIXEL-PERFECT identical.
// 4. BACKGROUND: Keep the background identical.
//
// [CRITICAL SHOE RULES]
// - TEXTURE, OUTSOLE, STITCHING, LACES, LOGO = 100% identical.
//
// REFERENCE_IMAGE: [Provided image]`;

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

    const prompt = `// --- TASK: PORTRAIT_LEG_SHOT_GENERATION (SECURE) ---
// ACTION: Generate a PORTRAIT IMAGE (3:4) focusing on model's legs and shoes.
//
// [COMPOSITION RULES]
// 1. FRAME: Portrait (3:4).
// 2. CROP: Cut off at waist. Show waist down to feet.
// 3. FILL: Legs must fill the frame.
// 4. IDENTITY: Keep trousers, skin tone, and shoes PIXEL-PERFECT identical.
//
// SOURCE_IMAGE: [Provided image]`;

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
