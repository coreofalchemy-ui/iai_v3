/**
 * 🔐 보안 Quick Transfer 서비스
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure, extractBase64, urlToBase64 } from '../../../lib/geminiClient';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
export type Effect =
    'beautify' |
    'studio_minimal_prop' |
    'studio_natural_floor' |
    'studio_texture_emphasis' |
    'studio_cinematic' |
    'studio_gravity' |
    'model_composite';

export type PoseVariation = typeof POSE_VARIATIONS[number];

export const POSE_VARIATIONS = [
    'side_profile_single',
    'diagonal_front_single',
    'diagonal_back_pair',
    'rear_view_pair',
    'top_closed_pair',
    'front_view_pair',
] as const;

export interface QuickTransferPipelineOptions {
    models: { name: string; url: string }[];
    shoes: { name: string; url: string }[];
    beautify: boolean;
    studio: boolean;
    modelCuts: number;
    closeupCuts: number;
}

export interface PipelineResult {
    modelCuts: string[];
    closeupCuts: string[];
    beautifiedShoes: string[];
    usedPoses: PoseVariation[];
    aiAnalysis: any;
}

export type ImageGeneratedCallback = (
    type: 'beautify' | 'modelCut' | 'closeup',
    imageUrl: string,
    index: number,
    poseName?: string
) => void;

export interface ImageAsset {
    url: string;
    generatingParams?: { pose?: string };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// POSE VARIANTS
// ============================================================================

const INITIAL_MODEL_VARIANTS = [
    { name: 'Variation: Walking', prompt: 'Change the pose to walking forward towards camera. Dynamic stride.' },
    { name: 'Variation: Crossed Legs', prompt: 'Change the pose to standing with legs crossed casually.' }
];

const INITIAL_CLOSEUP_VARIANTS = [
    { name: 'Variation: Side Step', prompt: 'Close-up edit: Show the feet from the side profile.' },
    { name: 'Variation: 45 Degree', prompt: 'Close-up edit: Feet positioned at a 45-degree angle.' }
];

// ============================================================================
// CORE GENERATION FUNCTIONS (SECURE)
// ============================================================================

/**
 * 🔐 신발만 교체 (원본 배경 유지)
 */
export async function regenerateShoesOnly(
    baseImageUrl: string,
    shoeImageUrl: string
): Promise<string> {
    const baseB64 = await urlToBase64(baseImageUrl);
    const shoeB64 = await urlToBase64(shoeImageUrl);

    const prompt = `// --- PROTOCOL: AGGRESSIVE_SHOE_REPLACEMENT ---
// TASK: COMPLETELY ERASE old shoes and paint PRODUCT_IMAGES on the feet.
// OUTPUT FORMAT: Portrait (3:4).
//
// [CRITICAL FRAMING RULES]
// 1. **NO CROPPING**: Maintain EXACT SAME framing/zoom as BASE_IMAGE.
// 2. **FULL BODY**: If BASE_IMAGE is full body, output MUST be full body.
// 3. **HEAD PRESERVATION**: Model's head and hair must be visible.
//
// [INSTRUCTIONS]
// 1. **TARGET**: Identify the feet/shoes area in BASE_IMAGE.
// 2. **ACTION**: REPLACE the shoes with exact design from PRODUCT_IMAGES.
// 3. **IDENTITY LOCK**: EVERYTHING ELSE MUST BE IDENTICAL.
// 4. **INTEGRATION**: Ensure realistic lighting and shadows.

BASE_IMAGE: [First image]
PRODUCT_IMAGES: [Second image]`;

    const result = await callGeminiSecure(
        prompt,
        [
            { data: baseB64, mimeType: 'image/png' },
            { data: shoeB64, mimeType: 'image/png' }
        ],
        { aspectRatio: '3:4' }
    );

    if (result.type !== 'image') throw new Error('Shoe regeneration failed');
    return result.data;
}

/**
 * 🔐 스튜디오로 데려오기 (배경 변경)
 */
export async function bringModelToStudio(
    modelImageUrl: string,
    shoeImageUrl: string
): Promise<string> {
    const modelB64 = await urlToBase64(modelImageUrl);
    const shoeB64 = await urlToBase64(shoeImageUrl);

    const prompt = `// --- PROTOCOL: STUDIO_MASTER_GENERATION ---
// TARGET: Place model in a "Modern Concrete Studio" with new shoes.
// OUTPUT FORMAT: Portrait (3:4).
//
// [CRITICAL PIXEL RULES]
// 1. **FACE PRESERVATION**: Face MUST be pixel-perfect identical.
// 2. **BODY PRESERVATION**: Keep EXACT body proportions and skin texture.
// 3. **SHOE REPLACEMENT**: Wear the provided PRODUCT_IMAGES.
// 4. **BACKGROUND**: Neutral grey concrete studio wall and floor.
// 5. **FRAMING**: FULL BODY SHOT. DO NOT CROP THE HEAD.

ORIGINAL_MODEL_IMAGE: [First image]
PRODUCT_IMAGES: [Second image]`;

    const result = await callGeminiSecure(
        prompt,
        [
            { data: modelB64, mimeType: 'image/png' },
            { data: shoeB64, mimeType: 'image/png' }
        ],
        { aspectRatio: '3:4' }
    );

    if (result.type !== 'image') throw new Error('Studio generation failed');
    return result.data;
}

/**
 * 🔐 하반신 클로즈업 생성
 */
export async function generateVerticalLegsCrop(baseImageUrl: string): Promise<string> {
    const baseB64 = await urlToBase64(baseImageUrl);

    const prompt = `// --- TASK: PORTRAIT_LEG_SHOT_GENERATION ---
// ACTION: Generate a PORTRAIT IMAGE (3:4) focusing on model's legs and shoes.
//
// [COMPOSITION RULES]
// 1. **FRAME**: Portrait (3:4).
// 2. **CROP**: Cut off at the waist. Show waist down to feet.
// 3. **FILL**: Legs must fill the frame.
// 4. **IDENTITY**: Keep trousers, skin tone, and shoes IDENTICAL.

SOURCE_IMAGE: [Provided image]`;

    const result = await callGeminiSecure(
        prompt,
        [{ data: baseB64, mimeType: 'image/png' }],
        { aspectRatio: '3:4' }
    );

    if (result.type !== 'image') throw new Error('Vertical leg crop failed');
    return result.data;
}

/**
 * 🔐 포즈 변형 생성
 */
export async function regenerateImageWithSpecificPose(
    baseImageUrl: string,
    pose: string
): Promise<ImageAsset> {
    const baseB64 = await urlToBase64(baseImageUrl);

    const prompt = `// --- TASK: POSE_MODIFICATION ---
// CHANGE POSE TO: ${pose}
// OUTPUT: Portrait (3:4).
//
// [CRITICAL FRAMING RULES]
// 1. **FULL BODY**: Must be full-body shot. Head to toe.
// 2. **NO CROPPING**: Do not cut off head or feet.
// 3. **IDENTITY PRESERVATION**: Face and identity must remain exact.
//
// [RULES]
// 1. **FACE & IDENTITY**: MUST MATCH SOURCE.
// 2. **CLOTHING**: Keep upper body clothing identical.
// 3. **SHOES**: Keep shoes identical.
// 4. **BACKGROUND**: Keep background identical.

REFERENCE_IMAGE: [Provided image]`;

    const result = await callGeminiSecure(
        prompt,
        [{ data: baseB64, mimeType: 'image/png' }],
        { aspectRatio: '3:4' }
    );

    if (result.type !== 'image') throw new Error('Pose modification failed');
    return { url: result.data, generatingParams: { pose } };
}

/**
 * 🔐 변형 병렬 생성
 */
async function generateVariations(baseAsset: ImageAsset, poses: { prompt: string, name: string }[]): Promise<ImageAsset[]> {
    const results: ImageAsset[] = [];

    for (const pose of poses) {
        try {
            const asset = await regenerateImageWithSpecificPose(baseAsset.url, pose.prompt);
            results.push({ url: asset.url, generatingParams: { pose: pose.name } });
        } catch (error) {
            console.error(`Failed to generate variation for ${pose.name}:`, error);
        }
    }

    return results;
}

// ============================================================================
// MAIN GENERATION SETS (SECURE)
// ============================================================================

/**
 * 🔐 원본 생성 - 배경 그대로 유지 + 신발만 교체
 */
export async function generateInitialOriginalSet(
    modelImageUrl: string,
    shoeImageUrl: string,
    onProgress?: (message: string) => void
): Promise<{ modelShots: ImageAsset[], closeupShots: ImageAsset[] }> {
    onProgress?.('1/5: 모델 전신 마스터 컷 생성 중 (SECURE)...');
    const masterSwappedImageUrl = await regenerateShoesOnly(modelImageUrl, shoeImageUrl);
    const masterModelAsset: ImageAsset = { url: masterSwappedImageUrl, generatingParams: { pose: 'Front View (Master)' } };

    onProgress?.('2/5: 전신 컷 변형 생성 중...');
    const modelVariations = await generateVariations(masterModelAsset, INITIAL_MODEL_VARIANTS);

    onProgress?.('3/5: 하반신 클로즈업 마스터 컷 생성 중...');
    const frontCloseupUrl = await generateVerticalLegsCrop(masterSwappedImageUrl);
    const masterCloseupAsset: ImageAsset = { url: frontCloseupUrl, generatingParams: { pose: 'Original Leg Crop' } };

    onProgress?.('4/5: 클로즈업 변형 생성 중...');
    const closeupVariations = await generateVariations(masterCloseupAsset, INITIAL_CLOSEUP_VARIANTS);

    onProgress?.('5/5: 모든 이미지 마무리 중...');

    return {
        modelShots: [masterModelAsset, ...modelVariations],
        closeupShots: [masterCloseupAsset, ...closeupVariations]
    };
}

/**
 * 🔐 스튜디오 생성 - 스튜디오 배경으로 변경
 */
export async function generateStudioImageSet(
    modelImageUrl: string,
    shoeImageUrl: string,
    onProgress?: (message: string) => void
): Promise<{ modelShots: ImageAsset[], closeupShots: ImageAsset[] }> {
    onProgress?.('1/5: 스튜디오 모델 마스터 컷 생성 중 (SECURE)...');
    const masterStudioUrl = await bringModelToStudio(modelImageUrl, shoeImageUrl);
    const masterStudioAsset: ImageAsset = { url: masterStudioUrl, generatingParams: { pose: 'Studio Front (Master)' } };

    onProgress?.('2/5: 스튜디오 전신 변형 생성 중...');
    const modelVariations = await generateVariations(masterStudioAsset, INITIAL_MODEL_VARIANTS);

    onProgress?.('3/5: 스튜디오 하반신 마스터 컷 생성 중...');
    const frontCloseupUrl = await generateVerticalLegsCrop(masterStudioUrl);
    const masterCloseupAsset: ImageAsset = { url: frontCloseupUrl, generatingParams: { pose: 'Studio Leg Crop' } };

    onProgress?.('4/5: 스튜디오 클로즈업 변형 생성 중...');
    const closeupVariations = await generateVariations(masterCloseupAsset, INITIAL_CLOSEUP_VARIANTS);

    onProgress?.('5/5: 모든 이미지 마무리 중...');

    return {
        modelShots: [masterStudioAsset, ...modelVariations],
        closeupShots: [masterCloseupAsset, ...closeupVariations]
    };
}

// ============================================================================
// BEAUTIFY FUNCTIONS (SECURE)
// ============================================================================

export async function generateBeautifiedShoe(shoeBase64: string, poseId: PoseVariation): Promise<string | null> {
    let poseInstruction = '';
    switch (poseId) {
        case 'side_profile_single':
            poseInstruction = `**VIEW:** Perfect Side Profile. ONE SINGLE SHOE. INSOLE NOT VISIBLE.`;
            break;
        case 'diagonal_front_single':
            poseInstruction = `**VIEW:** 45-degree Front Diagonal. ONE SINGLE SHOE. INSOLE NOT VISIBLE.`;
            break;
        case 'diagonal_back_pair':
            poseInstruction = `**VIEW:** 45-degree Rear Diagonal. PAIR OF SHOES. INSOLE NOT VISIBLE.`;
            break;
        case 'rear_view_pair':
            poseInstruction = `**VIEW:** Direct Rear View. PAIR OF SHOES. INSOLE NOT VISIBLE.`;
            break;
        case 'top_closed_pair':
            poseInstruction = `**VIEW:** Top-down view with CLOSED SHOES. INSOLE NOT VISIBLE.`;
            break;
        case 'front_view_pair':
            poseInstruction = `**VIEW:** Direct Front View. PAIR OF SHOES. INSOLE NOT VISIBLE.`;
            break;
        default:
            poseInstruction = `**VIEW:** Commercial Side Profile. INSOLE NOT VISIBLE.`;
    }

    const prompt = `// TASK: PREMIUM SHOE STUDIO SHOT

${poseInstruction}

**[BACKGROUND]** PURE WHITE (#FFFFFF). NO GRAY.

**[SHADOW]** Realistic contact shadow, opacity 15-25%.

**[RETOUCHING]**
- Remove dust, scratches, glue marks
- Show TRUE COLORS
- Premium material finish

**[IDENTITY LOCK]** All details = IDENTICAL`;

    try {
        const result = await callGeminiSecure(
            prompt,
            [{ data: shoeBase64, mimeType: 'image/png' }]
        );

        if (result.type !== 'image') return null;
        return result.data;
    } catch (error) {
        console.error('Beautify generation failed:', error);
        return null;
    }
}

// ============================================================================
// LEGACY EXPORTS
// ============================================================================

export async function analyzeModelTone(modelBase64: string): Promise<string> {
    return 'Natural lighting, neutral tones';
}

export async function generateModelCut(
    modelBase64: string,
    shoeBase64: string,
    modelTone: string,
    useStudio: boolean
): Promise<string | null> {
    try {
        const modelUrl = `data:image/png;base64,${modelBase64}`;
        const shoeUrl = `data:image/png;base64,${shoeBase64}`;

        if (useStudio) {
            return await bringModelToStudio(modelUrl, shoeUrl);
        } else {
            return await regenerateShoesOnly(modelUrl, shoeUrl);
        }
    } catch (error) {
        console.error('generateModelCut failed:', error);
        return null;
    }
}

export async function generateCloseupCut(
    modelBase64: string,
    shoeBase64: string,
    pose: PoseVariation,
    modelTone: string,
    useStudio: boolean
): Promise<string | null> {
    try {
        const modelUrl = `data:image/png;base64,${modelBase64}`;
        const shoeUrl = `data:image/png;base64,${shoeBase64}`;

        const swappedUrl = useStudio
            ? await bringModelToStudio(modelUrl, shoeUrl)
            : await regenerateShoesOnly(modelUrl, shoeUrl);

        return await generateVerticalLegsCrop(swappedUrl);
    } catch (error) {
        console.error('generateCloseupCut failed:', error);
        return null;
    }
}

// ============================================================================
// MAIN PIPELINE (SECURE)
// ============================================================================

const MODEL_POSE_VARIANTS = [
    { name: 'Front View (Master)', prompt: 'Standing front view, facing camera directly. Full body visible.' },
    { name: 'Walking', prompt: 'Walking forward towards camera. Dynamic stride. Full body.' },
    { name: 'Crossed Legs', prompt: 'Standing with legs crossed casually. Full body.' },
    { name: 'Leaning', prompt: 'Leaning slightly against invisible wall. Full body.' },
    { name: 'Side Profile', prompt: 'Side profile view, body turned 90 degrees. Full body.' },
    { name: 'Dynamic Motion', prompt: 'Dynamic walking motion, one foot forward. Full body.' },
];

const CLOSEUP_POSE_VARIANTS = [
    { name: 'Leg Crop (Master)', prompt: 'Knee down to feet crop' },
    { name: 'Side Step', prompt: 'Close-up edit: Feet from side profile.' },
    { name: '45 Degree', prompt: 'Close-up edit: Feet at 45-degree angle.' },
    { name: 'Low Angle', prompt: 'Close-up edit: Low angle looking up.' },
    { name: 'Detail Focus', prompt: 'Close-up edit: Extreme focus on details.' },
    { name: 'Walking Closeup', prompt: 'Close-up edit: Walking motion, mid-stride.' },
];

const BEAUTIFY_POSES: PoseVariation[] = [
    'side_profile_single',
    'diagonal_front_single',
    'diagonal_back_pair',
    'rear_view_pair',
    'top_closed_pair',
    'front_view_pair',
];

export async function executeQuickTransferPipeline(
    options: QuickTransferPipelineOptions,
    onProgress?: (status: string, current: number, total: number) => void,
    onImageGenerated?: ImageGeneratedCallback
): Promise<PipelineResult> {


    const result: PipelineResult = {
        modelCuts: [],
        closeupCuts: [],
        beautifiedShoes: [],
        usedPoses: [],
        aiAnalysis: null
    };

    const beautifyCount = options.beautify ? 6 : 0;
    const totalSteps = beautifyCount + options.modelCuts + options.closeupCuts;
    let currentStep = 0;

    try {
        const modelUrl = options.models[0]?.url;
        const shoeUrl = options.shoes[0]?.url;

        if (!modelUrl || !shoeUrl) {
            throw new Error('Model and shoe images required');
        }

        // Beautify
        if (options.beautify) {
            const shoeB64 = await urlToBase64(shoeUrl);

            for (let i = 0; i < 6; i++) {
                currentStep++;
                const poseName = BEAUTIFY_POSES[i];
                onProgress?.(`미화 ${i + 1}/6: ${poseName}`, currentStep, totalSteps);

                const img = await generateBeautifiedShoe(shoeB64, poseName);
                if (img) {
                    result.beautifiedShoes.push(img);
                    result.usedPoses.push(poseName);
                    onImageGenerated?.('beautify', img, i, poseName);
                }
                await delay(1000);
            }
        }

        // Model Cuts
        for (let i = 0; i < options.modelCuts; i++) {
            currentStep++;
            const poseInfo = MODEL_POSE_VARIANTS[i % MODEL_POSE_VARIANTS.length];
            onProgress?.(`모델컷 ${i + 1}/${options.modelCuts}: ${poseInfo.name}`, currentStep, totalSteps);

            try {
                let imgUrl: string;

                if (i === 0) {
                    imgUrl = options.studio
                        ? await bringModelToStudio(modelUrl, shoeUrl)
                        : await regenerateShoesOnly(modelUrl, shoeUrl);
                } else {
                    const masterUrl = result.modelCuts[0];
                    if (masterUrl) {
                        const asset = await regenerateImageWithSpecificPose(masterUrl, poseInfo.prompt);
                        imgUrl = asset.url;
                    } else {
                        imgUrl = options.studio
                            ? await bringModelToStudio(modelUrl, shoeUrl)
                            : await regenerateShoesOnly(modelUrl, shoeUrl);
                    }
                }

                result.modelCuts.push(imgUrl);
                onImageGenerated?.('modelCut', imgUrl, i, poseInfo.name);
            } catch (error) {
                console.error(`모델컷 ${i + 1} 생성 실패:`, error);
            }

            await delay(1000);
        }

        // Closeup Cuts
        const masterModelCut = result.modelCuts[0];

        for (let i = 0; i < options.closeupCuts; i++) {
            currentStep++;
            const poseInfo = CLOSEUP_POSE_VARIANTS[i % CLOSEUP_POSE_VARIANTS.length];
            onProgress?.(`클로즈업 ${i + 1}/${options.closeupCuts}: ${poseInfo.name}`, currentStep, totalSteps);

            try {
                let imgUrl: string;

                if (i === 0 && masterModelCut) {
                    imgUrl = await generateVerticalLegsCrop(masterModelCut);
                } else if (masterModelCut) {
                    const masterCloseup = result.closeupCuts[0];
                    if (masterCloseup) {
                        const asset = await regenerateImageWithSpecificPose(masterCloseup, poseInfo.prompt);
                        imgUrl = asset.url;
                    } else {
                        imgUrl = await generateVerticalLegsCrop(masterModelCut);
                    }
                } else {
                    const tempMaster = options.studio
                        ? await bringModelToStudio(modelUrl, shoeUrl)
                        : await regenerateShoesOnly(modelUrl, shoeUrl);
                    imgUrl = await generateVerticalLegsCrop(tempMaster);
                }

                result.closeupCuts.push(imgUrl);
                onImageGenerated?.('closeup', imgUrl, i, poseInfo.name);
            } catch (error) {
                console.error(`클로즈업 ${i + 1} 생성 실패:`, error);
            }

            await delay(1000);
        }



    } catch (error) {
        console.error('Pipeline error:', error);
    }

    return result;
}
