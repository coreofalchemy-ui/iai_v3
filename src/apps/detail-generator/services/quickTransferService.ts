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

    const prompt = `🚨 MANDATORY REQUIREMENTS - READ FIRST 🚨

TASK: Generate a photo where the model is WEARING the uploaded shoes.
⚠️ The model MUST be wearing the shoes from Image 2 - this is non-negotiable.
⚠️ SHOE DETAILS MUST BE 100% IDENTICAL - NO CHANGES ALLOWED.

---

🔒 ABSOLUTE LOCK - MODEL (Image 1):
The following elements are LOCKED and CANNOT be modified:
- Face and facial features (pixel-perfect preservation)
- Hair style, color, and texture
- Body pose and proportions (exact same position)
- All clothing (shirt, pants, accessories)
- Background and environment
- Camera angle and framing
- Lighting direction and quality

---

🔒 ABSOLUTE LOCK - SHOE DETAILS (Image 2):
You MUST analyze and preserve every single shoe detail:

STEP 1: 3D GEOMETRY ANALYSIS
- Shoe silhouette and overall shape
- Sole thickness and curvature
- Toe box shape (round, square, pointed)
- Heel height and angle
- Upper height and collar shape

STEP 2: SURFACE DETAIL ANALYSIS
- Material type (leather, suede, mesh, canvas, synthetic)
- Surface texture (smooth, pebbled, perforated, ribbed)
- Stitching patterns and thread colors
- Panel divisions and overlays
- Logo placement and size
- Embossed/debossed patterns

STEP 3: COLOR ANALYSIS
- Primary color and shade (EXACT hex match)
- Secondary colors and accents
- Gradient or color-blocking patterns
- Midsole and outsole colors
- Lace/strap colors

STEP 4: HARDWARE & ACCESSORIES
- Lace type (flat, round, rope)
- Eyelets (metal color and shape)
- Buckles, zippers, velcro
- Brand logos and tags
- Reflective elements

---

RENDERING REQUIREMENTS:
1. Render shoes as 3D objects with correct perspective
2. Apply model photo's lighting to shoes naturally
3. Shoes must be ON the model's feet (not floating)
4. Ankle-to-shoe connection must be natural
5. Shoes touch the ground with proper shadow
6. Shoe proportions match foot size realistically

WHAT TO KEEP FROM IMAGE 1:
- Everything except the shoes on feet

WHAT TO TAKE FROM IMAGE 2:
- Every single detail of the shoe
- Must be 100% identical - no simplification

FRAMING:
- Full body shot (head to toe)
- Do not crop head or feet
- Same camera angle as Image 1

QUALITY:
- Photorealistic, 8K, ultra-sharp
- Commercial photography style
- No blur, no haze
- Shoes must look like actual product photography

OUTPUT:
A photograph where the model from Image 1 is wearing the EXACT shoes from Image 2.
Every shoe detail (stitching, texture, logo, color) must be perfectly preserved.`;


    // Map resolution to config if needed, or pass as metadata
    // For now we pass it in prompt or logic, but if server supports it:
    // Extract dimensions from base model to preserve aspect ratio
    const dimensions = await extractImageDimensions(baseB64);
    const aspectRatio = `${dimensions.width}:${dimensions.height}`;

    // Use resolution option for image size
    const imageSize = options?.resolution || '1K';
    const config = {
        imageSize,
        aspectRatio: '750:900'
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
 * 🔲 이미지 자동 확장 (Outpainting) - 사용자가 지정한 프레임 정확히 채우기
 */
export async function expandImageAuto(
    imageUrl: string,
    options: {
        expandTop: number;
        expandRight: number;
        expandBottom: number;
        expandLeft: number;
        resolution?: '1K' | '2K' | '4K';
    }
): Promise<string> {
    console.log(`🔲 이미지 자동 확장 시작 - 상:${options.expandTop} 우:${options.expandRight} 하:${options.expandBottom} 좌:${options.expandLeft}`);

    const imageB64 = await urlToBase64(imageUrl);

    // 원본 이미지 크기 가져오기
    const originalDim = await extractImageDimensions(imageB64);
    const originalWidth = originalDim.width;
    const originalHeight = originalDim.height;

    // 확장 후 총 크기 계산
    const newWidth = originalWidth + options.expandLeft + options.expandRight;
    const newHeight = originalHeight + options.expandTop + options.expandBottom;

    console.log(`📐 원본: ${originalWidth}x${originalHeight} → 확장 후: ${newWidth}x${newHeight}`);

    // 확장 방향 설명
    const expansionDesc: string[] = [];
    if (options.expandTop > 0) expansionDesc.push(`상단 ${options.expandTop}px 추가`);
    if (options.expandBottom > 0) expansionDesc.push(`하단 ${options.expandBottom}px 추가`);
    if (options.expandLeft > 0) expansionDesc.push(`좌측 ${options.expandLeft}px 추가`);
    if (options.expandRight > 0) expansionDesc.push(`우측 ${options.expandRight}px 추가`);

    const prompt = `[TASK: OUTPAINTING - FILL EXACT EXPANDED CANVAS]

You are given an image and must EXPAND it to fill a LARGER canvas.

[CANVAS SPECIFICATIONS]
- Original Image Size: ${originalWidth} x ${originalHeight} pixels
- Target Canvas Size: ${newWidth} x ${newHeight} pixels
- Expansion: ${expansionDesc.join(', ')}

[CRITICAL INSTRUCTION]
1. Place the ORIGINAL IMAGE in the center of the new canvas
2. FILL all EMPTY space around it with AI-generated content
3. The expanded areas MUST be filled - NO blank/empty space allowed
4. The output MUST match the expanded dimensions

[EXPANSION RULES]
- Analyze the model's face, clothing, and background
- Expand the BACKGROUND naturally into the empty areas
- If body parts need to extend (head, feet), render them naturally
- Maintain consistent lighting, shadows, and style
- Create seamless transitions - NO visible seams

[QUALITY REQUIREMENTS]
- Photorealistic output
- Face remains the focal point
- Natural continuation of clothing and background
- Match exact colors and tones from original

Generate the expanded image now.`;

    const imageParts: GeminiImagePart[] = [
        { data: imageB64, mimeType: 'image/png' }
    ];

    // 동적으로 aspect ratio 계산 (단순화: 가로:세로)
    const aspectRatio = `${newWidth}:${newHeight}`;
    console.log(`📐 동적 aspect ratio: ${aspectRatio}`);

    const config = {
        imageSize: options.resolution || '1K',
        aspectRatio: aspectRatio
    };

    const result = await callGeminiSecure(prompt, imageParts, config);

    if (result.type !== 'image') {
        throw new Error('이미지 확장 실패');
    }

    console.log('✅ 이미지 확장 완료');
    return result.data;
}

/**
 * 👟 다중 신발 참조 착화 (regenerateShoesOnly 프롬프트 구조 적용)
 * 모델은 100% 보존, 신발만 교체
 */
export async function applyShoeFromMultipleReferences(
    modelImageUrl: string,
    shoeImageUrls: string[],
    options?: { resolution?: '1K' | '2K' | '4K'; isBoots?: boolean; isTightFit?: boolean }
): Promise<string> {
    console.log(`👟 다중 신발 참조 착화 시작 - ${shoeImageUrls.length}장의 신발 이미지 분석`);

    const modelB64 = await urlToBase64(modelImageUrl);

    // 모든 신발 이미지를 base64로 변환 (최대 4장)
    const limitedShoeUrls = shoeImageUrls.slice(0, 4);
    const shoeB64List: string[] = [];
    for (const url of limitedShoeUrls) {
        const b64 = await urlToBase64(url);
        shoeB64List.push(b64);
    }

    const isBoots = options?.isBoots || false;
    const isTightFit = options?.isTightFit || false;

    // 부츠/핏 옵션
    const bootSpec = isBoots
        ? '⚠️ BOOTS MODE: The shoe shaft MUST extend UP to just below the knee (Knee-high Boots). Clone texture and wrap around calf seamlessly.'
        : '';
    const fitSpec = isTightFit
        ? '⚠️ TIGHT FIT: The shoe/boot shaft must FOLLOW THE EXACT CONTOUR of the leg/ankle. ZERO GAP. Like a second skin.'
        : '';

    // regenerateShoesOnly와 동일한 프롬프트 구조 사용
    const prompt = `🚨 MANDATORY REQUIREMENTS - READ FIRST 🚨

TASK: Generate a photo where the model is WEARING the uploaded shoes.
⚠️ The model MUST be wearing the shoes from Image 2+ - this is non-negotiable.
⚠️ SHOE DETAILS MUST BE 100% IDENTICAL - NO CHANGES ALLOWED.
${bootSpec}
${fitSpec}

---

🔒 ABSOLUTE LOCK - MODEL (Image 1):
The following elements are LOCKED and CANNOT be modified:
- Face and facial features (pixel-perfect preservation)
- Hair style, color, and texture
- Body pose and proportions (exact same position)
- All clothing (shirt, pants, accessories)
- Background and environment
- Camera angle and framing
- Lighting direction and quality

---

🔒 ABSOLUTE LOCK - SHOE DETAILS (Image 2+):
You MUST analyze and preserve every single shoe detail from ${limitedShoeUrls.length} reference images:

STEP 1: 3D GEOMETRY ANALYSIS
- Shoe silhouette and overall shape
- Sole thickness and curvature
- Toe box shape (round, square, pointed)
- Heel height and angle
- Upper height and collar shape

STEP 2: SURFACE DETAIL ANALYSIS
- Material type (leather, suede, mesh, canvas, synthetic)
- Surface texture (smooth, pebbled, perforated, ribbed)
- Stitching patterns and thread colors
- Panel divisions and overlays
- Logo placement and size
- Embossed/debossed patterns

STEP 3: COLOR ANALYSIS
- Primary color and shade (EXACT hex match)
- Secondary colors and accents
- Gradient or color-blocking patterns
- Midsole and outsole colors
- Lace/strap colors

STEP 4: HARDWARE & ACCESSORIES
- Lace type (flat, round, rope)
- Eyelets (metal color and shape)
- Buckles, zippers, velcro
- Brand logos and tags
- Reflective elements

---

RENDERING REQUIREMENTS:
1. Render shoes as 3D objects with correct perspective
2. Apply model photo's lighting to shoes naturally
3. Shoes must be ON the model's feet (not floating)
4. Ankle-to-shoe connection must be natural
5. Shoes touch the ground with proper shadow
6. Shoe proportions match foot size realistically

WHAT TO KEEP FROM IMAGE 1:
- Everything except the shoes on feet

WHAT TO TAKE FROM IMAGE 2+:
- Every single detail of the shoe
- Must be 100% identical - no simplification

FRAMING:
- Full body shot (head to toe)
- Do not crop head or feet
- Same camera angle as Image 1

QUALITY:
- Photorealistic, 8K, ultra-sharp
- Commercial photography style
- No blur, no haze
- Shoes must look like actual product photography

OUTPUT:
A photograph where the model from Image 1 is wearing the EXACT shoes from Image 2+.
Every shoe detail (stitching, texture, logo, color) must be perfectly preserved.`;

    const imageParts: GeminiImagePart[] = [
        { data: modelB64, mimeType: 'image/png' },
        ...shoeB64List.map(data => ({ data, mimeType: 'image/png' as const }))
    ];

    // 원본 이미지의 aspect ratio 가져오기
    const dimensions = await extractImageDimensions(modelB64);
    const aspectRatio = `${dimensions.width}:${dimensions.height}`;

    const imageSize = options?.resolution || '1K';
    const config = {
        imageSize,
        aspectRatio: '750:900' // regenerateShoesOnly와 동일
    };

    const result = await callGeminiSecure(prompt, imageParts, config);

    if (result.type !== 'image') {
        throw new Error('다중 신발 참조 착화 실패');
    }

    console.log(`✅ 신발 착화 완료`);
    return result.data;
}

/**
 * 🔐 스튜디오로 데려오기 (배경 변경) - 커스텀 배경 지원
 */
export async function bringModelToStudio(
    modelImageUrl: string,
    shoeImageUrl: string,
    options?: { resolution?: '1K' | '2K' | '4K'; customBackgroundUrl?: string }
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
    // 커스텀 배경: 합성이 아닌 완전히 새로운 이미지 생성
    const prompt = hasCustomBg
        ? `🚨 MANDATORY REQUIREMENTS - READ FIRST 🚨

TASK: Generate a photo of the model WEARING uploaded shoes in the custom background.
⚠️ Model MUST be wearing shoes from Image 2 - non-negotiable.
⚠️ Analyze Image 1 (model) and Image 3 (background) to create unified scene.

---

STEP 1: ANALYZE INPUTS
Image 1 (Model): Study face, body, clothing, pose
Image 2 (Shoes): These are the shoes the model MUST wear
Image 3 (Background): Study environment, lighting, mood, colors

STEP 2: CREATE UNIFIED SCENE
Generate a NEW photo where:
- Model exists NATURALLY in the background environment
- Lighting on model matches background lighting direction
- Color temperature is consistent across entire image
- Model casts appropriate shadows on the ground

STEP 3: NATURAL SHOE WEARING
The model must PHYSICALLY WEAR the shoes:
- Feet are INSIDE the shoes
- Ankles connect naturally to shoe collars
- Shoes conform to foot shape with natural creases
- Shoes are flat on the ground with proper shadows
- Shoe color/tone matches the scene's lighting

WHAT TO KEEP FROM IMAGE 1:
- Face and identity (pixel-perfect)
- Body pose and proportions
- All clothing

WHAT TO TAKE FROM IMAGE 2:
- Shoe design, color, material
- Model must WEAR these exact shoes

WHAT TO TAKE FROM IMAGE 3:
- Environment style and mood
- Lighting direction and quality
- Color temperature

FRAMING:
- Full body shot (head to toe)
- Do not crop head or feet

OUTPUT:
A new photograph where model is naturally placed in the environment, wearing the shoes.
Everything looks like ONE cohesive professional photo.`
        : `🚨 MANDATORY REQUIREMENTS - READ FIRST 🚨

TASK: Generate a photo of the model WEARING uploaded shoes in a vintage studio.
⚠️ Model MUST be wearing shoes from Image 2 - non-negotiable.
⚠️ Analyze Image 1 (model) to preserve identity perfectly.

---

STEP 1: ANALYZE MODEL PHOTO (Image 1)
Study the model's:
- Face and identity (must preserve exactly)
- Body proportions and pose
- Clothing style and colors

STEP 2: CREATE STUDIO BACKGROUND
Generate a vintage concrete studio with:
- Weathered grey concrete wall with subtle texture
- Smooth concrete floor matching wall tone
- DIAGONAL NATURAL SUNLIGHT from upper right (morning sun)
- Dramatic diagonal shadow lines on wall/floor
- Slightly warm undertones from sunlight

STEP 3: NATURAL SHOE WEARING
The model must PHYSICALLY WEAR the shoes:
- Feet are INSIDE the shoes
- Ankles connect naturally to shoe collars
- Shoes conform to foot shape with natural creases
- Weight distribution shows shoes are being worn
- Laces/straps appear tied/fastened on feet
- Shoes are flat on floor with proper shadows
- Shoe lighting matches the studio's diagonal sunlight

WHAT TO KEEP FROM IMAGE 1:
- Face and identity (pixel-perfect)
- Body pose and proportions
- All clothing

WHAT TO TAKE FROM IMAGE 2:
- Shoe design, color, material
- Model must WEAR these exact shoes

FRAMING:
- Full body shot (head to toe)
- Do not crop head or feet
- Output: 750x900 pixels

QUALITY:
- Photorealistic, 8K, ultra-sharp
- Commercial photography style
- No blur, no haze

OUTPUT:
A professional studio photograph where model naturally wears the shoes.`;

    // Use resolution option for image size
    const imageSize = options?.resolution || '1K';
    const config = {
        imageSize,
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

    // 🔒 HARD LOCK: Force resize to exactly 750x900 regardless of AI output
    const forcedResult = await forceResizeTo750x900(result.data);
    console.log('[bringModelToStudio] 🔒 HARD LOCKED to 750x900');
    return forcedResult;
}

/**
 * 🔒 강제로 이미지를 750x900 크기로 리사이즈
 */
async function forceResizeTo750x900(imageDataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const TARGET_WIDTH = 750;
            const TARGET_HEIGHT = 900;

            const canvas = document.createElement('canvas');
            canvas.width = TARGET_WIDTH;
            canvas.height = TARGET_HEIGHT;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            // 중앙 기준 크롭 후 리사이즈
            const srcWidth = img.width;
            const srcHeight = img.height;
            const srcRatio = srcWidth / srcHeight;
            const targetRatio = TARGET_WIDTH / TARGET_HEIGHT;

            let cropX = 0, cropY = 0, cropW = srcWidth, cropH = srcHeight;

            if (srcRatio > targetRatio) {
                // 소스가 더 넓음 → 좌우 크롭
                cropW = Math.round(srcHeight * targetRatio);
                cropX = Math.round((srcWidth - cropW) / 2);
            } else if (srcRatio < targetRatio) {
                // 소스가 더 좁음 → 상하 크롭
                cropH = Math.round(srcWidth / targetRatio);
                cropY = Math.round((srcHeight - cropH) / 2);
            }

            console.log(`[forceResizeTo750x900] Source: ${srcWidth}x${srcHeight} → Target: ${TARGET_WIDTH}x${TARGET_HEIGHT}`);

            ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = () => reject(new Error('Failed to load image for resizing'));
        img.src = imageDataUrl;
    });
}

/**
 * 🔐 하반신 클로즈업 생성 - 신발 중심 레그샷
 */
export async function generateVerticalLegsCrop(baseImageUrl: string): Promise<string> {
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

    // 포즈 변경 - 필터 효과 제거
    const prompt = `// --- TASK: POSE_MODIFICATION ---
// CHANGE POSE TO: ${pose}
// STRICT CONSTRAINT: FEET MUST BE FLAT ON GROUND. NO SOLES VISIBLE.
// RESOLUTION_MODE: ${options?.resolution || '1K'}
// OUTPUT: Portrait (3:4).

// [🔒 COLOR PRESERVATION - CRITICAL - NO FILTER]
// 1. **EXACT COLOR MATCH**: Copy the EXACT colors from source image.
// 2. **NO FILTERS**: Do NOT apply any color grading, filters, or tonal adjustments.
// 3. **NO DESATURATION**: Maintain full color saturation as in source.
// 4. **NO WARMING/COOLING**: Do not shift color temperature.
// 5. **SAME BRIGHTNESS**: Match exact brightness and contrast levels.
// 6. **SAME TEXTURE**: Preserve fabric and skin textures exactly as source.
// 7. COLOR MISMATCH OR FILTER EFFECT = FAILURE

// [CRITICAL FRAMING RULES]
// 1. **FULL BODY**: Must be full-body shot. Head to toe.
// 2. **NO CROPPING**: Do not cut off head or feet.
// 3. **IDENTITY PRESERVATION**: Face and identity must remain exact.

// [RULES]
// 1. **FACE & IDENTITY**: MUST MATCH SOURCE.
// 2. **CLOTHING**: Keep upper body clothing identical.
// 3. **SHOES**: Keep shoes identical.
// 4. **BACKGROUND**: Keep background identical.

// [OUTPUT]
// Photorealistic full-body photo with modified pose.
// COLORS MUST BE IDENTICAL TO SOURCE - NO FILTER EFFECTS!

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
 * 🔐 클로즈업 전용 포즈 변형 생성 - 가까이서 촬영
 */
export async function regenerateCloseupWithVariation(
    baseImageUrl: string,
    pose: string,
    options?: { resolution?: '1K' | '4K' }
): Promise<ImageAsset> {
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
POSE: Change legs/feet pose to "${pose}"

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

    const config = {
        imageSize: '1K',
        aspectRatio: '3:4'
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
            poseInstruction = `**VIEW: PERFECT SIDE PROFILE (측면 90도)**
- **CAMERA POSITION**: Exactly perpendicular to the shoe (90 degrees from front)
- **CAMERA HEIGHT**: Eye-level with the shoe center
- **SUBJECT**: ONE SINGLE SHOE ONLY (한 짝만)
- **ORIENTATION**: Toe pointing LEFT, heel on RIGHT
- **INSOLE**: MUST NOT BE VISIBLE
- **UNIQUE IDENTIFIER**: THIS IS VIEW #1 - PURE PROFILE SILHOUETTE`;
            break;
        case 'diagonal_front_single':
            poseInstruction = `**VIEW: 45-DEGREE FRONT DIAGONAL (사선 앞 45도) - CRITICAL ANGLE**
- **CAMERA POSITION**: Camera placed at 45 degrees from direct front (between front and side)
- **CAMERA HEIGHT**: Slightly above shoe level (looking down at 15-20 degree angle)
- **SUBJECT**: ONE SINGLE SHOE ONLY (한 짝만)
- **ORIENTATION**: Shoe angled to show BOTH the toe box AND the outer side wall
- **INSOLE**: MUST NOT BE VISIBLE
- **VISIBLE ELEMENTS**: Toe cap + side panel + partial lacing = 3/4 VIEW
- **UNIQUE IDENTIFIER**: THIS IS VIEW #2 - THE CLASSIC HERO SHOT ANGLE`;
            break;
        case 'diagonal_back_pair':
            poseInstruction = `**VIEW: 45-DEGREE REAR DIAGONAL (사선 뒤 45도)**
- **CAMERA POSITION**: Camera placed at 45 degrees from direct back (between rear and side)
- **CAMERA HEIGHT**: Slightly above shoe level (looking down at 15-20 degree angle)
- **SUBJECT**: PAIR OF SHOES (양발) arranged together
- **ORIENTATION**: Show BOTH heel counters AND outer side walls
- **INSOLE**: MUST NOT BE VISIBLE
- **VISIBLE ELEMENTS**: Heel tabs + back portion + side panels of both shoes
- **UNIQUE IDENTIFIER**: THIS IS VIEW #3 - REAR 3/4 ANGLE`;
            break;
        case 'rear_view_pair':
            poseInstruction = `**VIEW: DIRECT REAR VIEW (백뷰 정면)**
- **CAMERA POSITION**: Directly behind the shoes (180 degrees from front)
- **CAMERA HEIGHT**: Eye-level with heel center
- **SUBJECT**: PAIR OF SHOES (양발) - perfectly symmetrical arrangement
- **ORIENTATION**: Looking straight at both heels, centered composition
- **INSOLE**: MUST NOT BE VISIBLE
- **VISIBLE ELEMENTS**: Both heel counters, back tabs, heel logos
- **UNIQUE IDENTIFIER**: THIS IS VIEW #4 - PURE BACK VIEW`;
            break;
        case 'side_low_angle_single':
            poseInstruction = `**VIEW: LOW ANGLE SIDE PROFILE (로우앵글 측면)**
- **CAMERA POSITION**: Floor-level, perpendicular to shoe
- **CAMERA HEIGHT**: GROUND LEVEL - looking UP at the shoe (dramatic low angle)
- **SUBJECT**: ONE SINGLE SHOE ONLY (한 짝만)
- **ORIENTATION**: Toe pointing LEFT, camera shooting upward from below
- **INSOLE**: MUST NOT BE VISIBLE
- **VISIBLE ELEMENTS**: Outsole edge visible, dramatic heroic perspective
- **UNIQUE IDENTIFIER**: THIS IS VIEW #5 - DRAMATIC WORM'S EYE VIEW`;
            break;
        case 'front_view_pair':
            poseInstruction = `**VIEW: DIRECT FRONT VIEW (정면뷰)**
- **CAMERA POSITION**: Directly in front of the shoes (0 degrees, facing toe boxes)
- **CAMERA HEIGHT**: Eye-level with toe box center
- **SUBJECT**: PAIR OF SHOES (양발) - side by side, symmetrical
- **ORIENTATION**: Looking straight at both toe boxes, perfectly centered
- **INSOLE**: MUST NOT BE VISIBLE
- **VISIBLE ELEMENTS**: Both toe caps, full lacing system, tongue tops
- **UNIQUE IDENTIFIER**: THIS IS VIEW #6 - PURE FRONT VIEW`;
            break;
        default:
            poseInstruction = `**VIEW:** Commercial Side Profile. ONE SINGLE SHOE. INSOLE NOT VISIBLE.`;
    }

    const prompt = `🚨 MANDATORY OUTPUT REQUIREMENTS - READ FIRST 🚨

BACKGROUND: PURE WHITE (#FFFFFF) - ABSOLUTELY NO EXCEPTIONS
⚠️ NOT off-white, NOT cream, NOT gray. PURE WHITE ONLY.

NO DOTS OR MARKS: Remove ALL black dots, dark spots, or marks ANYWHERE in the image.
⚠️ ESPECIALLY check top-left corner, top-right corner, and all edges.
⚠️ Black/dark dots in corners = ABSOLUTE FAILURE.

NO TEXT: Do NOT add ANY text, letters, numbers, watermarks, or written content.
⚠️ Text in output = ABSOLUTE FAILURE.

---

// TASK: PREMIUM SHOE STUDIO SHOT - UNIQUE ANGLE GENERATION
// ⚠️ EACH VIEW MUST BE COMPLETELY DIFFERENT FROM OTHER VIEWS ⚠️

${poseInstruction}

**[BACKGROUND - STRICT REQUIREMENT]**
- PURE WHITE BACKGROUND (#FFFFFF) - NO exceptions
- NO GRAY, NO OFF-WHITE - must be pure white
- Seamless infinite white studio background
- NO BLACK DOTS or dark spots anywhere, especially in corners

**[NO TEXT RULE - CRITICAL]**
- Do NOT add ANY text, letters, numbers, or labels
- Do NOT add watermarks or signatures
- ONLY the shoe, nothing else

**[SHADOW]** 
- Realistic contact shadow beneath shoe
- Shadow opacity: 15-25%
- Natural, soft edge shadow

**[RETOUCHING]**
- Remove all dust, scratches, glue marks, imperfections
- Show TRUE accurate colors of the shoe
- Premium material finish with realistic texture
- Commercial quality, 8K resolution

**[IDENTITY LOCK - CRITICAL]**
- Every detail of the shoe = IDENTICAL to input
- Do NOT redesign, modify, or reimagine the shoe
- Clone the exact shoe, only change the viewing angle

**[NEGATIVE - DO NOT INCLUDE]**
black dot, dark spot, black mark, dark mark, corner dot, corner artifact, top-left dot, top-right dot, edge artifact, text, letters, numbers, words, watermark, label, writing, typography, gray background, off-white background`;

    try {
        const result = await callGeminiSecure(
            prompt,
            [{ data: shoeBase64, mimeType: 'image/png' }],
            { aspectRatio: '1:1' }  // Square format for product shots
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

// ============================================================================
// EXPAND TO FULL BODY (Image Outpainting)
// ============================================================================
/**
 * Expand a cropped model image to show the full body
 * Uses AI outpainting to extend the image while maintaining quality and style
 */
export async function expandToFullBody(
    croppedImageUrl: string,
    options: { resolution?: '1K' | '2K' | '4K' } = {}
): Promise<string> {
    console.log('🔄 Expanding image to full body...');

    const resolution = options.resolution || '1K';

    // Get base64 of the cropped image
    const croppedB64 = await urlToBase64(croppedImageUrl);

    // Get image dimensions to determine crop direction
    const dimensions = await extractImageDimensions(croppedImageUrl);
    const isWiderThanTall = dimensions.width > dimensions.height;

    const prompt = `🚨 UNCONDITIONALLY PRESERVE ORIGINAL IMAGE & EXPAND TO FULL BODY 🚨
    
[TASK]
You are an expert AI Outpainter. Your task is to take the provided cropped image and EXTEND the canvas to reveal the FULL BODY of the model.
- INPUT: A cropped image (e.g., only legs, only torso, or cut-off head).
- OUTPUT: A Full Body Portrait (Head to Toe) where the original image exists UNCHANGED inside the new larger canvas.

[CRITICAL RULE: PIXEL PRESERVATION]
1. **DO NOT CHANGE THE ORIGINAL IMAGE**: The pixels provided in the input MUST exist 100% IDENTICALLY in the output.
2. **SEAMLESS EXTENSION**: You must paint the "missing" parts (head, feet, arms) AROUND the original image.
3. **NO RE-IMAGINING**: Do not change the pose of the visible parts. Do not change the clothes of the visible parts.

[GENERATION RULES]
1. **IF HEAD IS MISSING**: Generate a face/head that matches the skin tone, body angle, and fashion style of the visible body.
2. **IF LEGS/FEET ARE MISSING**: Generate legs and shoes that match the outfit and standing pose.
3. **IF BACKGROUND IS CROPPED**: Extend the background seamlessly in all directions.

[FULL BODY GUARANTEE]
- The final result MUST show the TOP OF THE HEAD to the SOLES OF THE SHOES.
- Do NOT crop the head. Do NOT crop the feet.
- Even if the input is just a pair of shoes, you must hallucinate/generate the ENTIRE rest of the body (legs, torso, head) to match those shoes.

[CONSISTENCY]
- Skin tone must match exactly.
- Lighting direction must match exactly.
- Fabric textures must continue naturally.

[OUTPUT]
A high-resolution Full Body Image containing the preserved original crop + newly generated extensions.`;

    const config = {
        imageSize: resolution,
        aspectRatio: '3:4'  // Portrait for full body
    };

    const result = await callGeminiSecure(
        prompt,
        [{ data: croppedB64, mimeType: 'image/png' }],
        config
    );

    if (result.type !== 'image') {
        throw new Error('Full body expansion failed - no image returned');
    }

    console.log('✅ Full body expansion complete');
    return result.data;
}

// ============================================================================
// CAMERA ANGLE GENERATION (Generate from different viewpoints)
// ============================================================================
// 상단 4개: 전신 뷰 (Outer = 90도 측면, Inner = 45도 사선)
// 하단 4개: 하반신(다리) 클로즈업 뷰
export type CameraAnglePosition =
    // 상단 - 전신 뷰
    | 'fullbody_left_outer' | 'fullbody_left_inner'      // Full body - left side
    | 'fullbody_right_outer' | 'fullbody_right_inner'    // Full body - right side
    // 하단 - 하반신(다리) 클로즈업
    | 'legs_left_outer' | 'legs_left_inner'              // Legs closeup - left side
    | 'legs_right_outer' | 'legs_right_inner';           // Legs closeup - right side

const CAMERA_ANGLE_DESCRIPTIONS: Record<CameraAnglePosition, string> = {
    // 상단 - 전신 뷰 (Full body) - 모델 왼쪽
    'fullbody_left_outer': `📷 LEFT SIDE 90° PROFILE (전신 좌측 측면)
        - Camera Position: MODEL'S LEFT SIDE (모델의 왼쪽)
        - The camera is placed DIRECTLY to the model's LEFT
        - We see the LEFT shoulder, LEFT arm, LEFT leg
        - Pure silhouette profile view - minimal front visibility
        - This is a SIDE-ON SHOT from the LEFT`,

    'fullbody_left_inner': `📷 LEFT DIAGONAL 45° (전신 좌측 사선)
        - Camera Position: FRONT-LEFT of the model (모델의 왼쪽 사선)
        - The camera is between FRONT and LEFT SIDE
        - We see 3/4 of the face, LEFT shoulder more prominent
        - Dimensional depth view showing both front and left side`,

    // 상단 - 전신 뷰 (Full body) - 모델 오른쪽
    'fullbody_right_outer': `📷 RIGHT SIDE 90° PROFILE (전신 우측 측면)
        - Camera Position: MODEL'S RIGHT SIDE (모델의 오른쪽)
        - The camera is placed DIRECTLY to the model's RIGHT
        - We see the RIGHT shoulder, RIGHT arm, RIGHT leg
        - Pure silhouette profile view - minimal front visibility
        - This is the OPPOSITE of left_outer`,

    'fullbody_right_inner': `📷 RIGHT DIAGONAL 45° (전신 우측 사선)
        - Camera Position: FRONT-RIGHT of the model (모델의 오른쪽 사선)
        - The camera is between FRONT and RIGHT SIDE
        - We see 3/4 of the face, RIGHT shoulder more prominent
        - This is the OPPOSITE of left_inner`,

    // 하단 - 하반신 클로즈업 (Legs closeup) - 모델 왼쪽
    'legs_left_outer': `📷 LEGS LEFT SIDE 90° (다리 좌측 측면)
        - Camera Position: MODEL'S LEFT SIDE, waist-down (모델 왼쪽에서 다리 촬영)
        - Framing: FROM WAIST to FEET only - NO face/upper body
        - We see the LEFT leg silhouette, LEFT side of shoes
        - Pure side profile of legs/shoes`,

    'legs_left_inner': `📷 LEGS LEFT DIAGONAL 45° (다리 좌측 사선)
        - Camera Position: FRONT-LEFT, waist-down (모델 왼쪽 사선에서 다리 촬영)
        - Framing: FROM WAIST to FEET only - NO face/upper body
        - 3/4 view of legs and shoes from front-left angle`,

    // 하단 - 하반신 클로즈업 (Legs closeup) - 모델 오른쪽
    'legs_right_outer': `📷 LEGS RIGHT SIDE 90° (다리 우측 측면)
        - Camera Position: MODEL'S RIGHT SIDE, waist-down (모델 오른쪽에서 다리 촬영)
        - Framing: FROM WAIST to FEET only - NO face/upper body
        - We see the RIGHT leg silhouette, RIGHT side of shoes
        - This is the OPPOSITE of legs_left_outer`,

    'legs_right_inner': `📷 LEGS RIGHT DIAGONAL 45° (다리 우측 사선)
        - Camera Position: FRONT-RIGHT, waist-down (모델 오른쪽 사선에서 다리 촬영)
        - Framing: FROM WAIST to FEET only - NO face/upper body
        - 3/4 view of legs and shoes from front-right angle`
};

/**
 * Generate the same model from a different camera angle
 */
export async function generateFromCameraAngle(
    modelImageUrl: string,
    angle: CameraAnglePosition,
    options: { resolution?: '1K' | '2K' | '4K' } = {}
): Promise<string> {
    console.log(`📷 Generating from camera angle: ${angle}`);

    const resolution = options.resolution || '1K';
    const modelB64 = await urlToBase64(modelImageUrl);
    const angleDescription = CAMERA_ANGLE_DESCRIPTIONS[angle];

    // 하반신(다리) 클로즈업인지 확인
    const isLegsCloseup = angle.startsWith('legs_');

    const prompt = `[TASK: REGENERATE SAME MODEL FROM DIFFERENT CAMERA ANGLE]
    
You are given a reference photo of a fashion model. Generate a NEW photo of THE EXACT SAME MODEL from a different camera viewpoint.

---

🚨 CRITICAL: WHAT MUST NOT CHANGE (100% PRESERVED)
✅ Model's Face, Hair, Facial Features - IDENTICAL
✅ Model's Body Shape, Pose, Posture - SAME STANDING POSE
✅ Model's Clothing (every item) - IDENTICAL patterns, colors, fit
✅ Shoes - EXACT SAME SHOES with all details (stitching, color, brand, laces)
✅ Lighting and Color Tone - CONSISTENT with input

---

📷 CAMERA POSITION INSTRUCTION:
${angle.includes('left')
            ? `🎥 CAMERA IS ON THE LEFT SIDE (왼쪽)
       - You are photographing FROM THE MODEL'S LEFT
       - The model's LEFT shoulder/arm/leg is closer to camera
       - We see the model's LEFT PROFILE`
            : `🎥 CAMERA IS ON THE RIGHT SIDE (오른쪽)
       - You are photographing FROM THE MODEL'S RIGHT
       - The model's RIGHT shoulder/arm/leg is closer to camera
       - We see the model's RIGHT PROFILE`}

${angle.includes('outer')
            ? `📐 ANGLE: 90° PURE SIDE PROFILE (측면)
       - Camera is DIRECTLY to the side
       - Pure silhouette view - minimal front visibility`
            : `📐 ANGLE: 45° DIAGONAL / 3/4 VIEW (사선)
       - Camera is between front and side
       - We see both front and side aspects`}

---

🎬 FRAMING:
${isLegsCloseup
            ? `📍 LOWER BODY CLOSEUP (하반신 클로즈업)
       - Crop from WAIST to FEET only
       - DO NOT show face/head/upper body
       - Focus on legs and shoes`
            : `📍 FULL BODY SHOT (전신)
       - Complete head-to-toe framing
       - Include entire body without cropping`}

---

📋 DETAILED VIEWPOINT:
${angleDescription}

---

[OUTPUT]
Generate a photorealistic fashion photo matching the exact camera position and framing above.
The model, clothing, and shoes must be 100% identical to the input - only the camera angle changes.
    `;
    const oldPrompt = `[TASK: GENERATE SPECIFIC CAMERA ANGLE SHOT]

Input Model Image is provided. Generate a NEW image of correct quality consistent with input.

[VIEWPOINT INSTRUCTION - CRITICAL]
The user clicked a specific camera position dot. You MUST generate that EXACT angle.

DOT CLICKED: ${angle} (${isLegsCloseup ? 'LOWER BODY CLOSEUP' : 'FULL BODY SHOT'})

${isLegsCloseup ? `
🎬 MODE: LOWER BODY CLOSEUP (Legs & Shoes)
- **FRAMING**: Crop from Waist/Hips down to Feet. DO NOT include face/shoulders.
- **SUBJECT**: Focus on the legs, pants/skirt, and shoes.
` : `
🎬 MODE: FULL BODY SHOT (Head to Toe)
- **FRAMING**: Complete, uncropped full body.
- **SUBJECT**: The entire model.
`}

${angle.includes('left') ? `
⬅️ CAMERA POSITION: LEFT SIDE (9 o'clock)
1. **CAMERA LOCATION**: You are standing to the LEFT of the model.
2. **VISIBLE SIDE**: You must show the model's **LEFT** side (Left Arm, Left Leg, Left Ear).
3. **FACING DIRECTION**: The model should be facing towards the **RIGHT** side of the frame (3 o'clock direction).
4. **NOT VISIBLE**: The model's Right side should be hidden or further away.
` : `
➡️ CAMERA POSITION: RIGHT SIDE (3 o'clock)
1. **CAMERA LOCATION**: You are standing to the RIGHT of the model.
2. **VISIBLE SIDE**: You must show the model's **RIGHT** side (Right Arm, Right Leg, Right Ear).
3. **FACING DIRECTION**: The model should be facing towards the **LEFT** side of the frame (9 o'clock direction).
4. **NOT VISIBLE**: The model's Left side should be hidden or further away.
`}

${angle.includes('outer') ? `
📐 ANGLE: 90-DEGREE PURE SIDE PROFILE
- Strictly from the side.
- Minimal to NO front view visible.
- A perfect silhouette-like profile angle.
` : `
📐 ANGLE: 45-DEGREE THREE-QUARTER (3/4) VIEW
- Between Front and Side.
- We see dimensional depth.
- Not flat front, not flat side.
`}

[PRESERVATION RULES]
1. PRESERVE IDENTITY: Face, hair, body shape must match original.
2. PRESERVE CLOTHING: Same outfit details, colors, textures.
3. PRESERVE SHOES: Same shoes.
4. PRESERVE LIGHTING/BG: Compatible lighting and background mood.

[OUTPUT]
A photorealistic, high-quality fashion photograph matching the requested angle and framing.
`;

    const config = {
        imageSize: resolution,
        aspectRatio: isLegsCloseup ? '4:3' : '3:4'  // 다리 클로즈업은 가로, 전신은 세로
    };

    const result = await callGeminiSecure(
        prompt,
        [{ data: modelB64, mimeType: 'image/png' }],
        config
    );

    if (result.type !== 'image') {
        throw new Error(`Camera angle generation failed - ${angle}`);
    }

    console.log(`✅ Generated from angle: ${angle}`);
    return result.data;
}
