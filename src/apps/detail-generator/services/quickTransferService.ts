/**
 * Quick Transfer Service
 * 
 * AI 스튜디오 "상세페이지에 모델 및 클로즈컷 생성로직" 완전 적용 버전
 * 
 * 두 가지 모드:
 * 1. 원본 생성 (generateInitialOriginalSet): 배경 그대로 유지 + 신발만 교체
 * 2. 스튜디오 생성 (generateStudioImageSet): 스튜디오 배경으로 변경
 * 
 * 생성 결과: 모델컷 3장 (1 마스터 + 2 변형) + 클로즈업 3장 (1 마스터 + 2 변형)
 */

import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";

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
    'side_profile_single',       // 측면 (1발) - 인솔 안보임
    'diagonal_front_single',     // 사선 앞 (1발) - 인솔 안보임
    'diagonal_back_pair',        // 사선 뒤 (양발) - 인솔 안보임
    'rear_view_pair',            // 백뷰 (양발) - 인솔 안보임
    'top_closed_pair',           // 탑뷰 (양발, 인솔 안보이는 각도)
    'front_view_pair',           // 정면 (양발) - 인솔 안보임
] as const;

export interface QuickTransferPipelineOptions {
    models: { name: string; url: string }[];
    shoes: { name: string; url: string }[];
    beautify: boolean;
    studio: boolean;  // true = 스튜디오 배경, false = 원본 배경 유지
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

// 이미지 생성 시 호출되는 콜백 (스트리밍)
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
// SAFETY & CONFIG
// ============================================================================

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const VERTICAL_IMAGE_CONFIG = {
    aspectRatio: '3:4',
    responseModalities: [Modality.IMAGE],
    safetySettings
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getApiClient = () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
    return new GoogleGenAI({ apiKey });
};

async function urlToBase64(url: string): Promise<string> {
    if (url.startsWith('data:')) {
        return url.split(',')[1];
    }
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function dataUrlToGenerativePart(url: string) {
    const base64Data = url.split(',')[1];
    if (!base64Data) throw new Error("Invalid data URL for conversion.");
    const mimeType = url.match(/data:(.*?);base64/)?.[1] || 'image/png';
    return { inlineData: { data: base64Data, mimeType } };
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Timeout wrapper
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 90000, errorMessage: string = "Request timed out"): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });
    return Promise.race([
        promise.then(res => {
            clearTimeout(timeoutId);
            return res;
        }),
        timeoutPromise
    ]);
};

// ============================================================================
// POSE VARIANTS (AI 스튜디오 원본)
// ============================================================================

const INITIAL_MODEL_VARIANTS = [
    { name: 'Variation: Walking', prompt: 'Change the pose to walking forward towards camera. Dynamic stride. Shoes clearly visible. Full body.' },
    { name: 'Variation: Crossed Legs', prompt: 'Change the pose to standing with legs crossed casually. Relaxed fashion stance. Full body.' }
];

const INITIAL_CLOSEUP_VARIANTS = [
    { name: 'Variation: Side Step', prompt: 'Close-up edit: Show the feet from the side profile, taking a step. Emphasize side of shoe.' },
    { name: 'Variation: 45 Degree', prompt: 'Close-up edit: Feet positioned at a 45-degree angle to the camera. Flattering angle showing both front and side.' }
];

// ============================================================================
// CORE GENERATION FUNCTIONS (AI 스튜디오 원본 로직)
// ============================================================================

/**
 * 신발만 교체 (원본 배경 유지) - AGGRESSIVE_SHOE_REPLACEMENT
 */
export async function regenerateShoesOnly(
    baseImageUrl: string,
    shoeImageUrl: string
): Promise<string> {
    const ai = getApiClient();
    const baseImagePart = dataUrlToGenerativePart(baseImageUrl);
    const shoeBase64 = await urlToBase64(shoeImageUrl);

    const prompt = `// --- PROTOCOL: AGGRESSIVE_SHOE_REPLACEMENT (GEMINI 3.0 PRO) ---
// TASK: COMPLETELY ERASE old shoes and paint PRODUCT_IMAGES on the feet.
// OUTPUT FORMAT: Portrait (3:4).
//
// [CRITICAL FRAMING RULES]
// 1. **NO CROPPING**: The output MUST maintain the EXACT SAME framing/zoom as BASE_IMAGE.
// 2. **FULL BODY**: If BASE_IMAGE is full body, output MUST be full body. DO NOT ZOOM IN ON SHOES.
// 3. **HEAD PRESERVATION**: The model's head and hair must be fully visible and untouched.
//
// [INSTRUCTIONS]
// 1. **TARGET**: Identify the feet/shoes area in BASE_IMAGE.
// 2. **ACTION**: REPLACE the shoes with the exact design, color, and texture from PRODUCT_IMAGES.
// 3. **IDENTITY LOCK**: EVERYTHING ELSE (Face, Hair, Trousers, Background, Skin) MUST BE IDENTICAL PIXEL-FOR-PIXEL.
// 4. **INTEGRATION**: Ensure realistic lighting and shadows on the new shoes.
//
// DO NOT just blend. SWAP them. IGNORE ORIGINAL SHOES. KEEP ORIGINAL COMPOSITION.`;

    const response = await withTimeout(ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
            parts: [
                { text: prompt },
                { text: "BASE_IMAGE:" },
                baseImagePart,
                { text: "PRODUCT_IMAGES:" },
                { inlineData: { mimeType: 'image/png', data: shoeBase64 } },
            ]
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    }), 90000, "신발 교체 시간이 초과되었습니다.");

    const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData) throw new Error("Shoe regeneration failed to return an image.");
    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}

/**
 * 스튜디오로 데려오기 (배경 변경) - STUDIO_MASTER_GENERATION
 */
export async function bringModelToStudio(
    modelImageUrl: string,
    shoeImageUrl: string
): Promise<string> {
    const ai = getApiClient();
    const modelBase64 = await urlToBase64(modelImageUrl);
    const shoeBase64 = await urlToBase64(shoeImageUrl);

    const prompt = `// --- PROTOCOL: STUDIO_MASTER_GENERATION (GEMINI 3.0 PRO) ---
// TARGET: Place model in a "Modern Concrete Studio" with new shoes.
// OUTPUT FORMAT: Portrait (3:4).
//
// [CRITICAL PIXEL RULES]
// 1. **FACE PRESERVATION**: The face MUST be pixel-perfect identical to ORIGINAL_MODEL_IMAGE. No "AI face" smoothing.
// 2. **BODY PRESERVATION**: Keep EXACT body proportions and skin texture.
// 3. **SHOE REPLACEMENT**: Wear the provided PRODUCT_IMAGES.
// 4. **BACKGROUND**: Neutral grey concrete studio wall and floor. Soft shadows.
// 5. **FRAMING**: FULL BODY SHOT. DO NOT CROP THE HEAD. Leave headroom. Ensure feet are visible.
//
// Render a photorealistic full-body portrait shot.`;

    const response = await withTimeout(ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
            parts: [
                { text: prompt },
                { text: "ORIGINAL_MODEL_IMAGE:" },
                { inlineData: { mimeType: 'image/png', data: modelBase64 } },
                { text: "PRODUCT_IMAGES:" },
                { inlineData: { mimeType: 'image/png', data: shoeBase64 } },
            ]
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    }), 90000, "스튜디오 생성 시간이 초과되었습니다.");

    const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData) throw new Error("Failed to bring model to studio.");
    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}

/**
 * 하반신 클로즈업 생성 (세로형 다리 크롭)
 */
export async function generateVerticalLegsCrop(baseImageUrl: string): Promise<string> {
    const ai = getApiClient();
    const baseImagePart = dataUrlToGenerativePart(baseImageUrl);

    const prompt = `// --- TASK: PORTRAIT_LEG_SHOT_GENERATION ---
// ACTION: Generate a PORTRAIT IMAGE (3:4) focusing on the model's legs and shoes.
// SOURCE: Use the provided SOURCE_IMAGE.
//
// [COMPOSITION RULES]
// 1. **FRAME**: The image MUST be Portrait (3:4).
// 2. **CROP**: Cut off at the waist. Show waist down to feet.
// 3. **FILL**: The legs must fill the frame compositionally.
// 4. **IDENTITY**: Keep the trousers, skin tone, and shoes IDENTICAL to source.
//
// Output: High resolution portrait photograph.`;

    const response = await withTimeout(ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }, { text: "SOURCE_IMAGE:" }, baseImagePart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    }), 90000, "클로즈업 생성 시간이 초과되었습니다.");

    const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData) throw new Error("Vertical leg crop generation failed.");

    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}

/**
 * 포즈 변형 생성
 */
export async function regenerateImageWithSpecificPose(
    baseImageUrl: string,
    pose: string
): Promise<ImageAsset> {
    const ai = getApiClient();
    const sourceImagePart = dataUrlToGenerativePart(baseImageUrl);

    const prompt = `// --- TASK: POSE_MODIFICATION (EDIT ONLY) ---
// CHANGE POSE TO: ${pose}
// OUTPUT: Portrait (3:4).
//
// [CRITICAL FRAMING RULES]
// 1. **FULL BODY**: The output MUST be a full-body shot. Head to toe.
// 2. **NO CROPPING**: Do not cut off the head or feet. Leave padding at the top and bottom.
// 3. **IDENTITY PRESERVATION**: Face and identity must remain exactly the same as REFERENCE_IMAGE.
//
// [RULES]
// 1. **FACE & IDENTITY**: MUST MATCH SOURCE.
// 2. **CLOTHING**: Keep upper body clothing identical.
// 3. **SHOES**: Keep the shoes identical.
// 4. **BACKGROUND**: Keep the background identical.
//
// Output: Full body shot, Portrait.`;

    const response = await withTimeout(ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
            parts: [
                { text: prompt },
                { text: "REFERENCE_IMAGE:" },
                sourceImagePart,
            ]
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    }), 90000, "자세 변경 시간이 초과되었습니다.");

    const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData) throw new Error("Image modification failed to return an image.");

    const newUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    return { url: newUrl, generatingParams: { pose } };
}

/**
 * 변형 병렬 생성
 */
async function generateVariations(baseAsset: ImageAsset, poses: { prompt: string, name: string }[]): Promise<ImageAsset[]> {
    const promises = poses.map(async (pose) => {
        try {
            const asset = await regenerateImageWithSpecificPose(baseAsset.url, pose.prompt);
            return { url: asset.url, generatingParams: { pose: pose.name } } as ImageAsset;
        } catch (error) {
            console.error(`Failed to generate variation for ${pose.name}:`, error);
            return null;
        }
    });

    const results = await Promise.all(promises);
    return results.filter((res): res is ImageAsset => res !== null);
}

// ============================================================================
// MAIN GENERATION SETS (AI 스튜디오 원본 로직)
// ============================================================================

/**
 * 원본 생성 - 배경 그대로 유지 + 신발만 교체
 * 결과: 모델컷 3장 (1 마스터 + 2 변형) + 클로즈업 3장 (1 마스터 + 2 변형)
 */
export async function generateInitialOriginalSet(
    modelImageUrl: string,
    shoeImageUrl: string,
    onProgress?: (message: string) => void
): Promise<{ modelShots: ImageAsset[], closeupShots: ImageAsset[] }> {

    // 1. Master Model Cut (신발 교체, 배경 유지)
    onProgress?.('1/5: 모델 전신 마스터 컷 생성 중 (신발 교체)...');
    const masterSwappedImageUrl = await regenerateShoesOnly(modelImageUrl, shoeImageUrl);
    const masterModelAsset: ImageAsset = { url: masterSwappedImageUrl, generatingParams: { pose: 'Front View (Master)' } };

    // 2. Model Variations (병렬)
    onProgress?.('2/5: 전신 컷 변형 생성 중 (병렬 처리)...');
    const modelVariationsPromise = generateVariations(masterModelAsset, INITIAL_MODEL_VARIANTS);

    // 3. Master Closeup
    onProgress?.('3/5: 하반신 클로즈업 마스터 컷 생성 중...');
    const frontCloseupUrl = await generateVerticalLegsCrop(masterSwappedImageUrl);
    const masterCloseupAsset: ImageAsset = { url: frontCloseupUrl, generatingParams: { pose: 'Original Leg Crop' } };

    // 4. Closeup Variations (병렬)
    onProgress?.('4/5: 클로즈업 변형 생성 중 (병렬 처리)...');
    const closeupVariationsPromise = generateVariations(masterCloseupAsset, INITIAL_CLOSEUP_VARIANTS);

    // 5. Wait for all
    onProgress?.('5/5: 모든 이미지 마무리 중...');
    const [modelVariations, closeupVariations] = await Promise.all([modelVariationsPromise, closeupVariationsPromise]);

    const modelShots = [masterModelAsset, ...modelVariations];
    const closeupShots = [masterCloseupAsset, ...closeupVariations];

    return { modelShots, closeupShots };
}

/**
 * 스튜디오 생성 - 스튜디오 배경으로 변경
 * 결과: 모델컷 3장 (1 마스터 + 2 변형) + 클로즈업 3장 (1 마스터 + 2 변형)
 */
export async function generateStudioImageSet(
    modelImageUrl: string,
    shoeImageUrl: string,
    onProgress?: (message: string) => void
): Promise<{ modelShots: ImageAsset[], closeupShots: ImageAsset[] }> {

    // 1. Master Studio Cut
    onProgress?.('1/5: 스튜디오 모델 마스터 컷 생성 중...');
    const masterStudioUrl = await bringModelToStudio(modelImageUrl, shoeImageUrl);
    const masterStudioAsset: ImageAsset = { url: masterStudioUrl, generatingParams: { pose: 'Studio Front (Master)' } };

    // 2. Model Variations (병렬)
    onProgress?.('2/5: 스튜디오 전신 변형 생성 중...');
    const modelVariationsPromise = generateVariations(masterStudioAsset, INITIAL_MODEL_VARIANTS);

    // 3. Master Closeup
    onProgress?.('3/5: 스튜디오 하반신 마스터 컷 생성 중...');
    const frontCloseupUrl = await generateVerticalLegsCrop(masterStudioUrl);
    const masterCloseupAsset: ImageAsset = { url: frontCloseupUrl, generatingParams: { pose: 'Studio Leg Crop' } };

    // 4. Closeup Variations (병렬)
    onProgress?.('4/5: 스튜디오 클로즈업 변형 생성 중...');
    const closeupVariationsPromise = generateVariations(masterCloseupAsset, INITIAL_CLOSEUP_VARIANTS);

    // 5. Wait for all
    onProgress?.('5/5: 모든 이미지 마무리 중...');
    const [modelVariations, closeupVariations] = await Promise.all([modelVariationsPromise, closeupVariationsPromise]);

    const modelShots = [masterStudioAsset, ...modelVariations];
    const closeupShots = [masterCloseupAsset, ...closeupVariations];

    return { modelShots, closeupShots };
}

// ============================================================================
// BEAUTIFY FUNCTIONS
// ============================================================================

export async function generateBeautifiedShoe(shoeBase64: string, poseId: PoseVariation): Promise<string | null> {
    const ai = getApiClient();

    // ========================================================================
    // [MANDATORY SHOE ANALYSIS - 절대 규칙]
    // AI가 신발 사진의 모든 정보를 정확하게 파악해야 합니다.
    // ========================================================================
    const MANDATORY_ANALYSIS = `
**[CRITICAL - MANDATORY SHOE ANALYSIS BEFORE RENDERING]**
Before generating ANY output, you MUST analyze and LOCK these attributes:

1. **OUTSOLE (아웃솔):**
   - Exact shape, thickness, pattern, color
   - Boundary line between outsole and upper (갑피)
   - Tread pattern details

2. **UPPER (갑피):**
   - Material type (leather, mesh, suede, synthetic)
   - Color gradients and patterns
   - Texture and surface finish

3. **EYELETS (아일렛/신끈구멍):**
   - Exact count, position, size, material (metal/plastic)
   - Color and finish

4. **LACES (신끈):**
   - Material, color, weave pattern
   - Lacing style and tie method

5. **DESIGN ELEMENTS:**
   - All logos, brandings, stitching patterns
   - Decorative elements, overlays
   - Heel counter shape and design

**[ABSOLUTE RULE]:** The output shoe MUST be 100% identical to input. NO REDESIGNING.`;

    let poseInstruction = '';
    switch (poseId) {
        case 'side_profile_single':
            poseInstruction = `**VIEW:** Perfect Lateral (Outer) Side View. ONE SINGLE SHOE.
- Toe pointing LEFT
- Camera at shoe height (eye-level with shoe)
- INSOLE MUST NOT BE VISIBLE
- Show full outsole profile clearly`;
            break;
        case 'diagonal_front_single':
            poseInstruction = `**VIEW:** 45-degree Front Diagonal. ONE SINGLE SHOE.
- Toe box and outer side visible
- Camera slightly above shoe level (15-20 degrees)
- INSOLE MUST NOT BE VISIBLE
- Emphasize toe cap and front design`;
            break;
        case 'diagonal_back_pair':
            poseInstruction = `**VIEW:** 45-degree Rear Diagonal. PAIR OF SHOES.
- Heels and outer sides visible
- Camera slightly above shoe level
- INSOLE MUST NOT BE VISIBLE
- Show heel counter and back design`;
            break;
        case 'rear_view_pair':
            poseInstruction = `**VIEW:** Direct Rear View. PAIR OF SHOES.
- Heels facing camera directly
- Camera at shoe height
- INSOLE MUST NOT BE VISIBLE
- Show heel tabs, pull loops, and back stitching`;
            break;
        case 'top_closed_pair':
            poseInstruction = `**VIEW:** Top-down view with CLOSED SHOES. PAIR OF SHOES.
- Camera looking down at 75-80 degree angle (NOT 90 degrees)
- INSOLE MUST NOT BE VISIBLE - shoes must appear worn/closed
- Show lacing, tongue, and top of upper
- Slight angle to hide inner shoe cavity`;
            break;
        case 'front_view_pair':
            poseInstruction = `**VIEW:** Direct Front View. PAIR OF SHOES.
- Toe boxes facing camera
- Camera at shoe height
- INSOLE MUST NOT BE VISIBLE
- Show front profile, toe cap design`;
            break;
        default:
            poseInstruction = `**VIEW:** Commercial Side Profile. INSOLE MUST NOT BE VISIBLE.`;
    }

    const prompt = `// ========================================================================
// TASK: PREMIUM SHOE STUDIO SHOT (신발 미화)
// ========================================================================

${MANDATORY_ANALYSIS}

${poseInstruction}

**[BACKGROUND - 절대 규칙]**
- BACKGROUND MUST BE PURE WHITE (#FFFFFF) - 순백색만 허용
- NO GRAY BACKGROUNDS - 회색 배경 절대 금지
- NO OFF-WHITE - 미색 금지
- Seamless infinite white background

**[SHADOW RENDERING - 아웃솔 그림자]**
- Render realistic CONTACT SHADOW beneath the shoe
- Shadow must follow the exact shape of the outsole
- Soft ambient occlusion at the base
- Shadow opacity: 15-25% (subtle but visible)

**[RETOUCHING SPECS]**
1. Remove dust, scratches, scuffs, glue marks
2. Correct color casts - show TRUE COLORS
3. Premium material finish - make materials look luxurious
4. Enhance texture details - leather grain, mesh weave, etc.

**[IDENTITY LOCK - 100% CLONE]**
- Shoe silhouette = IDENTICAL
- All logos = IDENTICAL
- All stitching = IDENTICAL
- All laces = IDENTICAL
- Outsole pattern = IDENTICAL
- Upper design = IDENTICAL

Output: High-resolution commercial product shot.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/png', data: shoeBase64 } },
                ]
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
        if (!imagePart?.inlineData) return null;
        return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    } catch (error) {
        console.error('Beautify generation failed:', error);
        return null;
    }
}

// ============================================================================
// LEGACY EXPORTS (호환성)
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

        // First create shoe-swapped image, then crop
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
// MAIN PIPELINE - 장수 선택 반영 버전
// ============================================================================

// 모델컷 포즈 배열 (6개)
const MODEL_POSE_VARIANTS = [
    { name: 'Front View (Master)', prompt: 'Standing front view, facing camera directly. Full body visible.' },
    { name: 'Walking', prompt: 'Walking forward towards camera. Dynamic stride. Shoes clearly visible. Full body.' },
    { name: 'Crossed Legs', prompt: 'Standing with legs crossed casually. Relaxed fashion stance. Full body.' },
    { name: 'Leaning', prompt: 'Leaning slightly against invisible wall. Cool, relaxed pose. Full body.' },
    { name: 'Side Profile', prompt: 'Side profile view, body turned 90 degrees. Full body visible.' },
    { name: 'Dynamic Motion', prompt: 'Dynamic walking motion, one foot forward. Fashion editorial style. Full body.' },
];

// 클로즈업 포즈 배열 (6개)
const CLOSEUP_POSE_VARIANTS = [
    { name: 'Leg Crop (Master)', prompt: 'Knee down to feet crop' },
    { name: 'Side Step', prompt: 'Close-up edit: Show the feet from the side profile, taking a step. Emphasize side of shoe.' },
    { name: '45 Degree', prompt: 'Close-up edit: Feet positioned at a 45-degree angle to the camera. Flattering angle showing both front and side.' },
    { name: 'Low Angle', prompt: 'Close-up edit: Low angle shot looking up at the shoes. Dynamic and powerful.' },
    { name: 'Detail Focus', prompt: 'Close-up edit: Extreme focus on shoe details, texture and materials visible.' },
    { name: 'Walking Closeup', prompt: 'Close-up edit: Walking motion, mid-stride, shoes in motion.' },
];

// 미화 각도 배열 (6개 고정) - 인솔이 보이지 않는 각도만
const BEAUTIFY_POSES: PoseVariation[] = [
    'side_profile_single',      // 측면 (1발) - 인솔 안보임
    'diagonal_front_single',    // 사선 앞 (1발) - 인솔 안보임
    'diagonal_back_pair',       // 사선 뒤 (양발) - 인솔 안보임
    'rear_view_pair',           // 백뷰 (양발) - 인솔 안보임
    'top_closed_pair',          // 탑뷰 (인솔 안보이는 각도)
    'front_view_pair',          // 정면 (양발) - 인솔 안보임
];

export async function executeQuickTransferPipeline(
    options: QuickTransferPipelineOptions,
    onProgress?: (status: string, current: number, total: number) => void,
    onImageGenerated?: ImageGeneratedCallback
): Promise<PipelineResult> {
    console.log('='.repeat(50));
    console.log('QUICK TRANSFER PIPELINE START');
    console.log('Mode:', options.studio ? 'STUDIO (배경 변경)' : 'ORIGINAL (배경 유지)');
    console.log('Model Cuts:', options.modelCuts);
    console.log('Closeup Cuts:', options.closeupCuts);
    console.log('Beautify:', options.beautify);
    console.log('='.repeat(50));

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

        // =============================================
        // 1. 미화 (Beautify) - 항상 6장 고정
        // =============================================
        if (options.beautify) {
            const shoeBase64 = await urlToBase64(shoeUrl);

            for (let i = 0; i < 6; i++) {
                currentStep++;
                const poseName = BEAUTIFY_POSES[i];
                onProgress?.(`미화 ${i + 1}/6: ${poseName}`, currentStep, totalSteps);

                const img = await generateBeautifiedShoe(shoeBase64, poseName);
                if (img) {
                    result.beautifiedShoes.push(img);
                    result.usedPoses.push(poseName);
                    // 이미지 생성되면 즉시 콜백 호출 (스트리밍)
                    onImageGenerated?.('beautify', img, i, poseName);
                }
                await delay(1000);
            }
        }

        // =============================================
        // 2. 모델컷 - 선택된 장수만큼 생성
        // =============================================
        for (let i = 0; i < options.modelCuts; i++) {
            currentStep++;
            const poseInfo = MODEL_POSE_VARIANTS[i % MODEL_POSE_VARIANTS.length];
            onProgress?.(`모델컷 ${i + 1}/${options.modelCuts}: ${poseInfo.name}`, currentStep, totalSteps);

            try {
                let imgUrl: string;

                if (i === 0) {
                    // 첫 번째는 마스터 컷 (신발 교체)
                    if (options.studio) {
                        imgUrl = await bringModelToStudio(modelUrl, shoeUrl);
                    } else {
                        imgUrl = await regenerateShoesOnly(modelUrl, shoeUrl);
                    }
                } else {
                    // 두 번째부터는 마스터 기반 포즈 변형
                    const masterUrl = result.modelCuts[0];
                    if (masterUrl) {
                        const asset = await regenerateImageWithSpecificPose(masterUrl, poseInfo.prompt);
                        imgUrl = asset.url;
                    } else {
                        // 마스터가 없으면 새로 생성
                        if (options.studio) {
                            imgUrl = await bringModelToStudio(modelUrl, shoeUrl);
                        } else {
                            imgUrl = await regenerateShoesOnly(modelUrl, shoeUrl);
                        }
                    }
                }

                result.modelCuts.push(imgUrl);
                // 이미지 생성되면 즉시 콜백 호출 (스트리밍)
                onImageGenerated?.('modelCut', imgUrl, i, poseInfo.name);
            } catch (error) {
                console.error(`모델컷 ${i + 1} 생성 실패:`, error);
            }

            await delay(1000);
        }

        // =============================================
        // 3. 클로즈업컷 - 선택된 장수만큼 생성
        // =============================================
        const masterModelCut = result.modelCuts[0];

        for (let i = 0; i < options.closeupCuts; i++) {
            currentStep++;
            const poseInfo = CLOSEUP_POSE_VARIANTS[i % CLOSEUP_POSE_VARIANTS.length];
            onProgress?.(`클로즈업 ${i + 1}/${options.closeupCuts}: ${poseInfo.name}`, currentStep, totalSteps);

            try {
                let imgUrl: string;

                if (i === 0 && masterModelCut) {
                    // 첫 번째는 마스터컷 기반 세로 크롭
                    imgUrl = await generateVerticalLegsCrop(masterModelCut);
                } else if (masterModelCut) {
                    // 두 번째부터는 마스터 클로즈업 기반 변형
                    const masterCloseup = result.closeupCuts[0];
                    if (masterCloseup) {
                        const asset = await regenerateImageWithSpecificPose(masterCloseup, poseInfo.prompt);
                        imgUrl = asset.url;
                    } else {
                        imgUrl = await generateVerticalLegsCrop(masterModelCut);
                    }
                } else {
                    // 마스터 모델컷이 없으면 직접 생성
                    if (options.studio) {
                        const tempMaster = await bringModelToStudio(modelUrl, shoeUrl);
                        imgUrl = await generateVerticalLegsCrop(tempMaster);
                    } else {
                        const tempMaster = await regenerateShoesOnly(modelUrl, shoeUrl);
                        imgUrl = await generateVerticalLegsCrop(tempMaster);
                    }
                }

                result.closeupCuts.push(imgUrl);
                // 이미지 생성되면 즉시 콜백 호출 (스트리밍)
                onImageGenerated?.('closeup', imgUrl, i, poseInfo.name);
            } catch (error) {
                console.error(`클로즈업 ${i + 1} 생성 실패:`, error);
            }

            await delay(1000);
        }

        onProgress?.('완료!', totalSteps, totalSteps);

    } catch (error) {
        console.error('Pipeline error:', error);
    }

    console.log('='.repeat(50));
    console.log('PIPELINE RESULT:');
    console.log('Beautified:', result.beautifiedShoes.length);
    console.log('Model Cuts:', result.modelCuts.length);
    console.log('Closeup Cuts:', result.closeupCuts.length);
    console.log('='.repeat(50));

    return result;
}

