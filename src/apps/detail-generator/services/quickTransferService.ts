/**
 * 🔐 보안 Quick Transfer 서비스
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure, extractBase64, urlToBase64 } from '../../../lib/geminiClient';
import { GeminiImagePart } from '../../../lib/geminiClient';

// Helper to extract image dimensions from base64
const extractImageDimensions = (base64Data: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 1024, height: 1365 }); // Fallback
        img.src = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`;
    });
};

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
    'side_low_angle_single',
    'front_view_pair',
] as const;

// 40+ Safe Poses (No Sole Visibility)
const SAFE_POSE_VARIANTS = [
    { name: 'Standing Front - Neutral', prompt: 'Full body shot, standing facing forward, arms neutral by side, feet flat on ground.' },
    { name: 'Standing Front - Hands in Pocket', prompt: 'Full body shot, standing facing forward, hands in pockets, feet flat on ground.' },
    { name: 'Standing Front - Arms Crossed', prompt: 'Full body shot, standing facing forward, arms crossed, feet flat on ground.' },
    { name: 'Standing 3/4 Left - Neutral', prompt: 'Full body shot, turned 45 degrees left, feet flat on ground.' },
    { name: 'Standing 3/4 Right - Neutral', prompt: 'Full body shot, turned 45 degrees right, feet flat on ground.' },
    { name: 'Standing Side Left', prompt: 'Full body shot, side profile facing left, feet flat on ground.' },
    { name: 'Standing Side Right', prompt: 'Full body shot, side profile facing right, feet flat on ground.' },
    { name: 'Leaning Against Wall', prompt: 'Full body shot, leaning back against a wall, casual pose, feet flat on ground.' },
    { name: 'Wide Stance Front', prompt: 'Full body shot, facing forward, feet shoulder width apart, confident stance.' },
    { name: 'One Leg Forward', prompt: 'Full body shot, one leg slightly forward, both feet flat on ground.' },
    { name: 'Looking Over Shoulder', prompt: 'Full body shot, back to camera, looking back over shoulder, feet flat on ground.' },
    { name: 'Rear View - Neutral', prompt: 'Full body shot, back to camera, standing straight, feet flat on ground.' },
    { name: 'Rear View - Walking Away', prompt: 'Full body shot, back to camera, walking away, soles NOT visible (flat phase).' },
    { name: 'Casual Lean', prompt: 'Full body shot, shifting weight to one hip, casual stance.' },
    { name: 'Model Pose - Hand on Hip', prompt: 'Full body shot, one hand on hip, fashion stance, feet flat.' },
    { name: 'Model Pose - Jacket Hold', prompt: 'Full body shot, holding jacket lapel, confident look.' },
    { name: 'Model Pose - Hair Touch', prompt: 'Full body shot, one hand touching hair, elegant stance.' },
    { name: 'Minimalist Standing', prompt: 'Full body shot, minimal movement, focus on silhouette, feet planted.' },
    { name: 'Street Style - Waiting', prompt: 'Full body shot, standing as if waiting for someone, relaxed.' },
    { name: 'Street Style - Phone Check', prompt: 'Full body shot, looking at phone, casual standing.' },
    // A/B variants for diversity
    { name: 'Standing - Weight Left', prompt: 'Full body shot, shifting weight to left leg, relaxed.' },
    { name: 'Standing - Weight Right', prompt: 'Full body shot, shifting weight to right leg, relaxed.' },
    { name: 'Leaning Forward', prompt: 'Full body shot, slight lean towards camera, engaging pose.' },
    { name: 'Leaning Back', prompt: 'Full body shot, slight lean backwards, relaxed pose.' },
    { name: 'Crossed Legs Standing', prompt: 'Full body shot, standing with legs crossed at ankles, feet flat.' },
    { name: 'Side Glance', prompt: 'Full body shot, body forward, head turned to side.' },
    { name: 'Hands Clasped', prompt: 'Full body shot, hands clasped in front, polite stance.' },
    { name: 'Hands Behind Back', prompt: 'Full body shot, hands behind back, open chest.' },
    { name: 'Walking Towards - Flat', prompt: 'Full body shot, walking towards camera, mid-stance with foot flat.' },
    { name: 'Turning Around', prompt: 'Full body shot, in motion of turning, feet planted.' },
    { name: 'Step to Side', prompt: 'Full body shot, taking a step to the side, feet flat.' },
    { name: 'High Fashion Stand', prompt: 'Full body shot, angular fashion pose, feet grounded.' },
    { name: 'Relaxed Slouch', prompt: 'Full body shot, slight slouch, very casual.' },
    { name: 'Attention Pose', prompt: 'Full body shot, standing at attention, formal.' },
    { name: 'Greeting Pose', prompt: 'Full body shot, one hand raised in greeting.' },
    { name: 'Victory V', prompt: 'Full body shot, making V sign, cheerful.' },
    { name: 'Thinking Pose', prompt: 'Full body shot, hand on chin, thoughtful.' },
    { name: 'Pointing', prompt: 'Full body shot, pointing at something, dynamic.' },
    { name: 'Hands on Knees', prompt: 'Full body shot, bending slightly with hands on knees.' },
    { name: 'Stretching', prompt: 'Full body shot, arms stretched overhead, feet flat.' }
];

// Helper to get unique poses
function getUniquePoses(count: number, usedNames: Set<string>): { name: string, prompt: string }[] {
    const available = SAFE_POSE_VARIANTS.filter(p => !usedNames.has(p.name));
    // Shuffle
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    // Mark as used
    selected.forEach(p => usedNames.add(p.name));
    return selected;
}

export interface QuickTransferPipelineOptions {
    models: { name: string; url: string }[];
    shoes: { name: string; url: string }[];
    beautify: boolean;
    studio: boolean;
    modelCuts: number;
    closeupCuts: number;
    resolution: '1K' | '4K';
    customBackground?: string;  // 커스텀 배경 이미지 URL (선택)
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

// 20 Closeup Lower Body Poses (하반신 클로즈업 전용 - 허리 아래만)
const CLOSEUP_LOWER_BODY_POSES = [
    { name: 'Side Profile Standing', prompt: 'Side profile view of lower body. Feet flat on ground, relaxed stance. Show from waist down only.' },
    { name: 'Front Standing Neutral', prompt: 'Front view of lower body. Both feet flat, shoulder width apart. Waist down only.' },
    { name: 'Walking Stride', prompt: 'Mid-stride walking pose. One foot forward, one back. Lower body only from waist down.' },
    { name: 'Crossed Ankles', prompt: 'Standing with ankles crossed. Relaxed pose. Show waist to feet only.' },
    { name: 'Weight on Left', prompt: 'Standing with weight shifted to left leg. Casual stance. Lower body only.' },
    { name: 'Weight on Right', prompt: 'Standing with weight shifted to right leg. Casual stance. Lower body only.' },
    { name: 'Tiptoe Stance', prompt: 'Standing on tiptoes. Heels raised high. Show knees down to feet.' },
    { name: 'One Foot Forward', prompt: 'One foot stepped forward. Confident pose. Waist down only.' },
    { name: 'Feet Together', prompt: 'Feet together, heels touching. Formal stance. Lower body only.' },
    { name: 'Wide Stance', prompt: 'Wide power stance. Feet wider than shoulders. Waist to feet.' },
    { name: '45 Degree Left', prompt: 'Body turned 45 degrees left. Lower body perspective. Waist down.' },
    { name: '45 Degree Right', prompt: 'Body turned 45 degrees right. Lower body perspective. Waist down.' },
    { name: 'Back View Standing', prompt: 'Rear view of lower body. Standing straight. Show from waist to feet.' },
    { name: 'Step to Side', prompt: 'Taking a step to the side. Dynamic movement. Lower body only.' },
    { name: 'Knee Bent Casual', prompt: 'One knee slightly bent, relaxed pose. Fashion style. Waist down only.' },
    { name: 'Feet Angled Outward', prompt: 'Standing with feet angled outward. Ballet-inspired. Lower body only.' },
    { name: 'Feet Angled Inward', prompt: 'Standing with feet slightly angled inward. Cute casual pose. Waist down.' },
    { name: 'Low Angle Dramatic', prompt: 'Low camera angle looking up at shoes. Dramatic perspective. Feet to knees.' },
    { name: 'Walking Away', prompt: 'Walking away from camera. Rear view lower body. Mid-stride.' },
    { name: 'Dynamic Jump Prep', prompt: 'About to jump, knees slightly bent. Dynamic energy. Lower body only.' }
];

// Helper to get random unique closeup poses
function getRandomCloseupPoses(count: number, usedNames: Set<string>): { name: string; prompt: string }[] {
    const available = CLOSEUP_LOWER_BODY_POSES.filter(p => !usedNames.has(p.name));
    // Shuffle using Fisher-Yates
    const shuffled = [...available];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));
    selected.forEach(p => usedNames.add(p.name));
    return selected;
}

// ============================================================================
// CORE GENERATION FUNCTIONS (SECURE)
// ============================================================================

/**
 * 🔐 신발만 교체 (원본 배경 유지)
 */
export async function regenerateShoesOnly(
    baseImageUrl: string,
    shoeImageUrl: string,
    options?: { resolution?: '1K' | '2K' | '4K' }
): Promise<string> {
    const baseB64 = await urlToBase64(baseImageUrl);
    const shoeB64 = await urlToBase64(shoeImageUrl);

    const prompt = `// --- PROTOCOL: AGGRESSIVE_SHOE_REPLACEMENT ---
// TASK: COMPLETELY ERASE old shoes and paint PRODUCT_IMAGES on the feet.
// RESOLUTION_MODE: ${options?.resolution || '1K'}
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
// 3. **INTEGRATION**: Shoes must realistically touch the ground. ADD SHADOWS to contact points.
// 4. **BLENDING**: MATCH lighting and color tone of the shoes to the model's environment.
// 5. **QUALITY**: Masterpiece, 8k resolution, highly detailed texture, photorealistic. NO "CUTOUT" LOOK.

BASE_IMAGE: [First image]
PRODUCT_IMAGES: [Second image]`;

    // Map resolution to config if needed, or pass as metadata
    // For now we pass it in prompt or logic, but if server supports it:
    // Extract dimensions from base model to preserve aspect ratio
    const dimensions = await extractImageDimensions(baseB64);
    const aspectRatio = `${dimensions.width}:${dimensions.height}`;

    const config = {
        imageSize: options?.resolution === '4K' ? '4K' : '1K',
        aspectRatio
    };

    const result = await callGeminiSecure(
        prompt,
        [
            { data: baseB64, mimeType: 'image/png' },
            { data: shoeB64, mimeType: 'image/png' }
        ],
        config
    );

    if (result.type !== 'image') throw new Error('Shoe regeneration failed');
    return result.data;
}

/**
 * 🔐 스튜디오로 데려오기 (배경 변경) - 커스텀 배경 지원
 */
export async function bringModelToStudio(
    modelImageUrl: string,
    shoeImageUrl: string,
    options?: { resolution?: '1K' | '4K'; customBackgroundUrl?: string }
): Promise<string> {
    const modelB64 = await urlToBase64(modelImageUrl);
    const shoeB64 = await urlToBase64(shoeImageUrl);

    // Check for custom background
    const hasCustomBg = options?.customBackgroundUrl;
    let bgB64: string | null = null;
    if (hasCustomBg) {
        bgB64 = await urlToBase64(options.customBackgroundUrl!);
    }

    // Different prompt based on whether custom background is provided
    const prompt = hasCustomBg
        ? `// --- PROTOCOL: CUSTOM_BACKGROUND_COMPOSITE ---
// TARGET: Place model in the provided CUSTOM BACKGROUND with new shoes.
// RESOLUTION_MODE: ${options?.resolution || '1K'}
// OUTPUT FORMAT: Portrait (3:4).
//
// [BACKGROUND ANALYSIS]
// 1. **ANALYZE IMAGE 3**: Study the lighting, atmosphere, perspective, and environment.
// 2. **LIGHTING MATCHING**: Match model's lighting to the background's light source direction and color temperature.
// 3. **PERSPECTIVE MATCHING**: Place model at natural scale and position within the scene.
// 4. **SHADOW INTEGRATION**: Add realistic shadows that match the background's lighting.
//
// [CRITICAL PIXEL RULES]
// 1. **FACE PRESERVATION**: Face MUST be pixel-perfect identical to original model.
// 2. **BODY PRESERVATION**: Keep EXACT body proportions and skin texture.
// 3. **SHOE REPLACEMENT**: Wear the provided PRODUCT_IMAGES (Image 2).
// 4. **NATURAL INTEGRATION**: Model must look like they were photographed in this environment.
// 5. **FRAMING**: FULL BODY SHOT. DO NOT CROP THE HEAD.
//
// [AVOID]
// - Unnatural lighting on model that doesn't match background
// - Model looking pasted or floating
// - Different perspective/scale that looks wrong
// - Visible edges or compositing artifacts

ORIGINAL_MODEL_IMAGE: [First image]
PRODUCT_IMAGES: [Second image]
CUSTOM_BACKGROUND: [Third image]`
        : `// --- PROTOCOL: STUDIO_MASTER_GENERATION ---
// TARGET: Place model in a "Modern Concrete Studio" with new shoes.
// RESOLUTION_MODE: ${options?.resolution || '1K'}
// OUTPUT FORMAT: Portrait (3:4).
//
// [CRITICAL PIXEL RULES]
// 1. **FACE PRESERVATION**: Face MUST be pixel-perfect identical.
// 2. **BODY PRESERVATION**: Keep EXACT body proportions and skin texture.
// 3. **SHOE REPLACEMENT**: Wear the provided PRODUCT_IMAGES.
// 4. **BACKGROUND**: Neutral grey concrete studio wall and floor.
// 5. **FRAMING**: FULL BODY SHOT. DO NOT CROP THE HEAD.
// 6. **QUALITY**: Commercial photography, 8k resolution, sharp focus, high fidelity.

ORIGINAL_MODEL_IMAGE: [First image]
PRODUCT_IMAGES: [Second image]`;

    // Force strict output size: 750x900
    const config = {
        imageSize: '1K',
        aspectRatio: '750:900'
    };

    // Build images array - include custom background if provided
    const images = hasCustomBg && bgB64
        ? [
            { data: modelB64, mimeType: 'image/png' as const },
            { data: shoeB64, mimeType: 'image/png' as const },
            { data: bgB64, mimeType: 'image/png' as const }
        ]
        : [
            { data: modelB64, mimeType: 'image/png' as const },
            { data: shoeB64, mimeType: 'image/png' as const }
        ];

    const result = await callGeminiSecure(prompt, images, config);

    if (result.type !== 'image') throw new Error('Studio generation failed');
    return result.data;
}

/**
 * 🔐 하반신 클로즈업 생성
 */
export async function generateVerticalLegsCrop(baseImageUrl: string): Promise<string> {
    const baseB64 = await urlToBase64(baseImageUrl);

    const prompt = `
    **ROLE**: Professional Fashion Photographer (Hypebeast/Streetwear Specialist)
    **TASK**: Regenerate this photo as a **WAIST-DOWN CLOSE-UP**.
    **CRITICAL CONSTRAINT**: The input image is a reference. Create a new image focusing ONLY on the lower body.

    ⚠️ **ABSOLUTE FRAMING RULES** ⚠️:
    1. **TOP BORDER**: MUST cut off at the **WAIST** or **BELT LINE**. Nothing above waist visible.
    2. **FOCUS**: High-detail focus on the **SHOES** and **LEGS** (Pants/Skirt).
    3. **EXCLUSION**: ❌ NO HEAD. ❌ NO CHEST. ❌ NO SHOULDERS. ❌ NO FACE. ❌ NO ARMS.
    4. **COMPOSITION**: "Shoe Detail Shot" - shoes fully visible and centered at the bottom.
    5. **FRAME CHECK**: If ANY part above waist is visible = FAILURE.

    **IMAGE QUALITY (원본 화질 유지)**:
    - **MATCH SOURCE QUALITY**: Output quality MUST match the input image EXACTLY.
    - **ULTRA SHARP**: Crystal clear, razor-sharp focus. NO blur, NO haze, NO softness.
    - **8K RESOLUTION**: Professional high-definition, ultra-detailed output.
    - **PRESERVE TEXTURE**: Maintain all fabric textures, material details exactly.
    - **CLEAN EDGES**: All edges must be crisp and well-defined.

    **STYLE PRESERVATION**:
    - Perfectly replicate the original outfit (lower body), shoes, and background texture.
    - Maintain the original lighting mood, shadows, and highlights EXACTLY.
    - Same color grading and tone as the original.

    **OUTPUT**: Ultra-high-resolution, vertical image of the lower body only. Razor-sharp quality.
    `;

    // Extract dimensions from base model to preserve aspect ratio
    const dimensions = await extractImageDimensions(baseB64);
    const aspectRatio = `${dimensions.width}:${dimensions.height}`;

    const result = await callGeminiSecure(
        prompt,
        [{ data: baseB64, mimeType: 'image/png' }],
        { aspectRatio }
    );

    if (result.type !== 'image') throw new Error('Vertical leg crop failed');
    return result.data;
}

/**
 * 🔐 포즈 변형 생성
 */
export async function regenerateImageWithSpecificPose(
    baseImageUrl: string,
    pose: string,
    options?: { resolution?: '1K' | '4K' }
): Promise<ImageAsset> {
    const baseB64 = await urlToBase64(baseImageUrl);

    const prompt = `// --- TASK: POSE_MODIFICATION ---
// CHANGE POSE TO: ${pose}
// STRICT CONSTRAINT: FEET MUST BE FLAT ON GROUND. NO SOLES VISIBLE.
// RESOLUTION_MODE: ${options?.resolution || '1K'}
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

    // Extract dimensions from base model to preserve aspect ratio
    const dimensions = await extractImageDimensions(baseB64);
    const aspectRatio = `${dimensions.width}:${dimensions.height}`;

    const config = {
        imageSize: options?.resolution === '4K' ? '4K' : '1K',
        aspectRatio
    };

    const result = await callGeminiSecure(
        prompt,
        [{ data: baseB64, mimeType: 'image/png' }],
        config
    );

    if (result.type !== 'image') throw new Error('Pose modification failed');
    return { url: result.data, generatingParams: { pose } };
}

/**
 * 🔐 클로즈업 전용 포즈 변형 생성 (하반신만 - 허리 아래)
 */
export async function regenerateCloseupWithVariation(
    baseImageUrl: string,
    pose: string,
    options?: { resolution?: '1K' | '4K' }
): Promise<ImageAsset> {
    const baseB64 = await urlToBase64(baseImageUrl);

    const prompt = `// --- TASK: CLOSEUP_LOWER_BODY_VARIATION ---
// NEW POSE: ${pose}
// RESOLUTION_MODE: ${options?.resolution || '4K'}
// OUTPUT: Portrait (3:4).
//
// ⚠️ [ABSOLUTE FRAMING RULES - 절대 규칙] ⚠️
// 1. **WAIST-DOWN ONLY**: Frame MUST start from WAIST/BELT LINE and go down to FEET.
// 2. **NO UPPER BODY**: ABSOLUTELY NO HEAD, NO FACE, NO CHEST, NO SHOULDERS visible.
// 3. **MANDATORY CROP**: The TOP of the image MUST be at the WAIST LEVEL.
// 4. **SHOE FOCUS**: Shoes MUST be fully visible and be the main focus.
// 5. **FRAME CHECK**: If any part ABOVE the waist is visible = FAILURE.
//
// [IMAGE QUALITY - 원본 화질 유지]
// - **MATCH SOURCE QUALITY**: Output quality MUST match the input image quality EXACTLY.
// - **ULTRA SHARP**: Crystal clear, razor-sharp focus. NO blur, NO haze, NO softness.
// - **8K RESOLUTION**: Professional high-definition, ultra-detailed output.
// - **PRESERVE TEXTURE**: Maintain all fabric textures, material details, surface quality.
// - **CLEAN EDGES**: All edges must be crisp and well-defined.
//
// [STRICT PRESERVATION RULES]
// 1. **SHOES**: Keep shoes 100% IDENTICAL - same design, color, details, texture.
// 2. **PANTS/CLOTHING**: Keep lower body clothing EXACTLY the same - color, texture, fit.
// 3. **BACKGROUND**: Keep background IDENTICAL to source.
// 4. **LIGHTING**: Maintain IDENTICAL lighting as source - same shadows, highlights.
//
// [COMPOSITION - 구도]
// - Show: Waist → Hips → Thighs → Knees → Shins → Ankles → Shoes
// - The shoes should be at the bottom of the frame, fully visible.
// - Natural, fashion editorial style leg positioning.
//
// [FORBIDDEN - 금지]
// - ❌ NO upper body (chest, shoulders, arms, hands)
// - ❌ NO face or head under any circumstances
// - ❌ NO blurry or soft focus output
// - ❌ NO quality degradation from source

REFERENCE_IMAGE: [Use this as quality reference - match its sharpness and detail level]`;

    // Force strict output size: 750x900
    const config = {
        imageSize: '1K',
        aspectRatio: '750:900'
    };

    const result = await callGeminiSecure(
        prompt,
        [{ data: baseB64, mimeType: 'image/png' }],
        config
    );

    if (result.type !== 'image') throw new Error('Closeup pose modification failed');
    return { url: result.data, generatingParams: { pose } };
}

/**
 * 🔐 변형 병렬 생성
 */
// Update generateVariations to accept resolution and unique poses
async function generateVariations(
    baseAsset: ImageAsset,
    poses: { prompt: string, name: string }[],
    options?: { resolution?: '1K' | '4K' }
): Promise<ImageAsset[]> {
    const results: ImageAsset[] = [];

    for (const pose of poses) {
        try {
            const asset = await regenerateImageWithSpecificPose(baseAsset.url, pose.prompt, options);
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
    resolution: '1K' | '4K' = '1K',
    onProgress?: (message: string) => void,
    usedPoses = new Set<string>()
): Promise<{ modelShots: ImageAsset[], closeupShots: ImageAsset[] }> {
    onProgress?.('1/5: 모델 전신 마스터 컷 생성 중 (SECURE)...');
    const masterSwappedImageUrl = await regenerateShoesOnly(modelImageUrl, shoeImageUrl, { resolution });
    const masterModelAsset: ImageAsset = { url: masterSwappedImageUrl, generatingParams: { pose: 'Front View (Master)' } };
    usedPoses.add('Front View (Master)');

    onProgress?.('2/5: 전신 컷 변형 생성 중...');
    // Use unique poses
    const modelPoses = getUniquePoses(3, usedPoses); // Defaulting to 3 variations alongside master if implicit, or parameterize
    const modelVariations = await generateVariations(masterModelAsset, modelPoses, { resolution });

    onProgress?.('3/5: 하반신 클로즈업 마스터 컷 생성 중...');
    const frontCloseupUrl = await generateVerticalLegsCrop(masterSwappedImageUrl);
    const masterCloseupAsset: ImageAsset = { url: frontCloseupUrl, generatingParams: { pose: 'Original Leg Crop' } };

    onProgress?.('4/5: 클로즈업 변형 생성 중...');
    const closeupPoses = getUniquePoses(3, usedPoses); // Closeup variants from the safe list as well
    const closeupVariations = await generateVariations(masterCloseupAsset, closeupPoses, { resolution });

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
    resolution: '1K' | '4K' = '1K',
    onProgress?: (message: string) => void,
    usedPoses = new Set<string>()
): Promise<{ modelShots: ImageAsset[], closeupShots: ImageAsset[] }> {
    onProgress?.('1/5: 스튜디오 모델 마스터 컷 생성 중 (SECURE)...');
    const masterStudioUrl = await bringModelToStudio(modelImageUrl, shoeImageUrl, { resolution });
    const masterStudioAsset: ImageAsset = { url: masterStudioUrl, generatingParams: { pose: 'Studio Front (Master)' } };
    usedPoses.add('Studio Front (Master)');

    onProgress?.('2/5: 스튜디오 전신 변형 생성 중...');
    const modelPoses = getUniquePoses(3, usedPoses);
    const modelVariations = await generateVariations(masterStudioAsset, modelPoses, { resolution });

    onProgress?.('3/5: 스튜디오 하반신 마스터 컷 생성 중...');
    const frontCloseupUrl = await generateVerticalLegsCrop(masterStudioUrl);
    const masterCloseupAsset: ImageAsset = { url: frontCloseupUrl, generatingParams: { pose: 'Studio Leg Crop' } };

    onProgress?.('4/5: 스튜디오 클로즈업 변형 생성 중...');
    const closeupPoses = getUniquePoses(3, usedPoses);
    const closeupVariations = await generateVariations(masterCloseupAsset, closeupPoses, { resolution });

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
            poseInstruction = `**VIEW:** Perfect Side Profile. ONE SINGLE SHOE. **MUST FACE LEFT** (Toe pointing LEFT). INSOLE NOT VISIBLE.`;
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
        case 'side_low_angle_single':
            poseInstruction = `**VIEW:** Low angle side profile shot. ONE SINGLE SHOE. Camera positioned low, looking up at the shoe. INSOLE NOT VISIBLE.`;
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
    'side_low_angle_single',
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

        // Initialize Used Poses Set to track uniqueness across this session
        const usedPoses = new Set<string>();

        // Model Cuts
        if (options.modelCuts > 0) {
            // 1. Generate Master Model Cut (Index 0)
            currentStep++;
            onProgress?.(`모델컷 1/${options.modelCuts}: Master Cut`, currentStep, totalSteps);

            let masterModelUrl = '';
            try {
                if (options.studio) {
                    masterModelUrl = await bringModelToStudio(modelUrl, shoeUrl, { resolution: options.resolution, customBackgroundUrl: options.customBackground });
                    usedPoses.add('Studio Front (Master)');
                } else {
                    masterModelUrl = await regenerateShoesOnly(modelUrl, shoeUrl, { resolution: options.resolution });
                    usedPoses.add('Front View (Master)');
                }

                result.modelCuts.push(masterModelUrl);
                onImageGenerated?.('modelCut', masterModelUrl, 0, 'Master Cut');
            } catch (error) {
                console.error('Master Model Cut failed:', error);
                onImageGenerated?.('modelCut', 'error', 0, 'Master Cut');
            }

            // 2. Generate Variations (Index 1+)
            if (options.modelCuts > 1) {
                const neededVars = options.modelCuts - 1;

                if (masterModelUrl) {
                    const poses = getUniquePoses(neededVars, usedPoses);

                    for (let i = 0; i < neededVars; i++) {
                        currentStep++;
                        const pose = poses[i];
                        onProgress?.(`모델컷 ${i + 2}/${options.modelCuts}: ${pose.name}`, currentStep, totalSteps);

                        try {
                            const asset = await regenerateImageWithSpecificPose(masterModelUrl, pose.prompt, { resolution: options.resolution });
                            result.modelCuts.push(asset.url);
                            result.usedPoses.push(pose.name as PoseVariation);
                            onImageGenerated?.('modelCut', asset.url, i + 1, pose.name);
                        } catch (error) {
                            console.error(`Variation ${i + 1} failed:`, error);
                            onImageGenerated?.('modelCut', 'error', i + 1, pose.name);
                        }
                        await delay(1000);
                    }
                } else {
                    // Master failed, so all variations fail
                    for (let i = 0; i < neededVars; i++) {
                        currentStep++;
                        onProgress?.(`모델컷 ${i + 2}/${options.modelCuts}: Skipped (Master Failed)`, currentStep, totalSteps);
                        onImageGenerated?.('modelCut', 'error', i + 1, 'Skipped');
                    }
                }
            }
        }

        // Closeup Cuts
        if (options.closeupCuts > 0) {
            // 1. Generate Master Closeup (Index 0)
            currentStep++;
            onProgress?.(`클로즈업 1/${options.closeupCuts}: Leg Crop`, currentStep, totalSteps);

            let masterCloseupUrl = '';
            try {
                // Use the master model cut if available, otherwise regenerate temp master
                let sourceForCrop = result.modelCuts[0];
                if (!sourceForCrop) {
                    sourceForCrop = options.studio
                        ? await bringModelToStudio(modelUrl, shoeUrl, { resolution: options.resolution, customBackgroundUrl: options.customBackground })
                        : await regenerateShoesOnly(modelUrl, shoeUrl, { resolution: options.resolution });
                }

                masterCloseupUrl = await generateVerticalLegsCrop(sourceForCrop);
                usedPoses.add('Leg Crop (Master)');

                result.closeupCuts.push(masterCloseupUrl);
                onImageGenerated?.('closeup', masterCloseupUrl, 0, 'Leg Crop');
            } catch (error) {
                console.error('Master Closeup failed:', error);
                onImageGenerated?.('closeup', 'error', 0, 'Leg Crop');
            }

            // 2. Generate Closeup Variations (Index 1+)
            if (options.closeupCuts > 1) {
                const neededVars = options.closeupCuts - 1;

                if (masterCloseupUrl) {
                    // Use random poses from 20 lower body poses
                    const usedCloseupPoses = new Set<string>();
                    usedCloseupPoses.add('Leg Crop (Master)'); // Master is already used
                    const randomPoses = getRandomCloseupPoses(neededVars, usedCloseupPoses);

                    for (let i = 0; i < neededVars; i++) {
                        currentStep++;
                        const pose = randomPoses[i] || CLOSEUP_LOWER_BODY_POSES[i % CLOSEUP_LOWER_BODY_POSES.length];
                        onProgress?.(`클로즈업 ${i + 2}/${options.closeupCuts}: ${pose.name}`, currentStep, totalSteps);

                        try {
                            // Use closeup-specific variation function (lower body only)
                            const asset = await regenerateCloseupWithVariation(masterCloseupUrl, pose.prompt, { resolution: options.resolution });
                            result.closeupCuts.push(asset.url);
                            onImageGenerated?.('closeup', asset.url, i + 1, pose.name);
                        } catch (error) {
                            console.error(`Closeup Variation ${i + 1} failed:`, error);
                            onImageGenerated?.('closeup', 'error', i + 1, pose.name);
                        }
                        await delay(1000);
                    }
                } else {
                    // Master failed, so all variations fail
                    for (let i = 0; i < neededVars; i++) {
                        currentStep++;
                        onProgress?.(`클로즈업 ${i + 2}/${options.closeupCuts}: Skipped (Master Failed)`, currentStep, totalSteps);
                        onImageGenerated?.('closeup', 'error', i + 1, 'Skipped');
                    }
                }
            }
        }



    } catch (error) {
        console.error('Pipeline error:', error);
    }

    return result;
}
