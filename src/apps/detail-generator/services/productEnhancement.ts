/**
 * 🔐 보안 제품 미화 서비스
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure, extractBase64 } from '../../../lib/geminiClient';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
export type ProductEffect =
    'beautify' |
    'studio_minimal_prop' |
    'studio_natural_floor' |
    'studio_texture_emphasis' |
    'studio_cinematic';

export interface ProductEnhancementResult {
    id: string;
    originalFileName: string;
    status: 'pending' | 'loading' | 'done' | 'error';
    url?: string;
    error?: string;
    processingStep?: string;
    effect: ProductEffect;
    poseInfo?: { id: string; name: string; };
    addedToPreview?: boolean;
}

export const beautifyPoses: { id: string; name: string; }[] = [
    { id: 'side_profile_single', name: '측면 (1발)' },
    { id: 'diagonal_front_single', name: '사선 앞 (1발)' },
    { id: 'diagonal_back_pair', name: '사선 뒤 (양발)' },
    { id: 'rear_view_pair', name: '백뷰 (양발)' },
    { id: 'side_low_angle_single', name: '로우앵글 사이드 (1발)' },
    { id: 'front_view_pair', name: '정면 (양발)' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Extract image dimensions from File
 */
const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve({ width: 1024, height: 1024 }); // Fallback
        img.src = URL.createObjectURL(file);
    });
};

// ============================================================================
// PROMPT LOGIC
// ============================================================================

const getPromptForEffect = (effect: ProductEffect, poseId?: string, referenceCount?: number): string => {
    const SYSTEM_ROLE = `
**SYSTEM ROLE:** You are a "World-Class Product Retoucher" and "Studio Photographer".
**INPUT:** ${referenceCount && referenceCount > 1 ? `MULTIPLE (${referenceCount}) reference photos of the SAME shoe.` : 'A raw reference photo of a shoe.'}
**OUTPUT:** A High-End Commercial Product Photo (4K Resolution).

**[CRITICAL - MANDATORY SHOE ANALYSIS]**
1. **OUTSOLE**: Exact shape, thickness, pattern, color
2. **UPPER**: Material type, color gradients, texture
3. **EYELETS**: Exact count, position, size
4. **LACES**: Material, color, lacing style
5. **DESIGN ELEMENTS**: All logos, stitching patterns

**[EXECUTION RULES]**
1. **IDENTITY LOCK**: DO NOT RE-DESIGN THE SHOE.
2. **GEOMETRY**: Use EXACT geometry from input.
3. **QUALITY**: Remove dust, scratches, make premium.
`;

    if (effect === 'beautify') {
        return `🚨 MANDATORY OUTPUT REQUIREMENTS - READ FIRST 🚨

BACKGROUND: PURE WHITE (#FFFFFF) - ABSOLUTELY NO EXCEPTIONS
⚠️ NOT off-white, NOT cream, NOT gray. PURE WHITE ONLY.

NO DOTS OR MARKS: Remove ALL black dots, dark spots, or marks ANYWHERE in the image.
⚠️ ESPECIALLY check top-left corner, top-right corner, and all edges.
⚠️ Black/dark dots in corners = ABSOLUTE FAILURE.

NO TEXT: Do NOT add ANY text, letters, numbers, watermarks, logos, or written content.
⚠️ Text in output = ABSOLUTE FAILURE.

---

${SYSTEM_ROLE}
**[TASK: COMMERCE CATALOG IMAGE - PERFECT ISOLATION (NU-KKI STYLE)]**

**[SYSTEM ROLE OVERRIDE]**
You are a world-class "Commercial Product Photographer" and "CGI Retoucher" specializing in PERFECT PRODUCT CUTOUTS for e-commerce catalogs.

**[CRITICAL MISSION: ABSOLUTE PERFECTION]**
This is NOT artistic photography. This is TECHNICAL PRODUCT ISOLATION for online shopping platforms.

**1. BACKGROUND (ZERO TOLERANCE)**
- **Color**: PURE WHITE (#FFFFFF) - NOT off-white, NOT cream, NOT gray. PURE WHITE.
- **Shadow**: ABSOLUTELY NONE. NO cast shadow. NO contact shadow. NO ambient occlusion. NO floor reflection.
- **Effect**: "Floating Isolation" (Nu-kki style) - The shoe floats in a pure white void.
- **Edges**: RAZOR-SHARP cutout edges. NO halo. NO fringe. NO soft edges. NO gray pixels.

**2. NO BLACK DOTS OR DARK SPOTS - CRITICAL**
- **ABSOLUTE REMOVAL**: Remove ALL black dots, dark spots, or marks from the image.
- **CHECK ALL CORNERS**: Especially top-left, top-right, bottom-left, bottom-right corners.
- **CHECK ALL EDGES**: Inspect top edge, bottom edge, left edge, right edge.
- **PURE WHITE ONLY**: The background must be completely clean pure white with NO dots or artifacts.

**3. NO TEXT OR LETTERS - CRITICAL**
- **ABSOLUTE PROHIBITION**: Do NOT add ANY text, letters, numbers, or written content.
- **NO watermarks, NO labels, NO logos (except product's own logo)**
- **NO text of any language (Korean, English, or any other)**
- If input has text overlays, REMOVE them.

**4. ARTIFACTS & MARKS (ABSOLUTE REMOVAL)**
- **Dots/Marks**: Remove ANY dots, marks, specks, or artifacts.
- **Dust**: Remove all dust particles, dirt, and imperfections on the background.

**5. SUBJECT ISOLATION (STRICT RULE)**
- **What to KEEP**: ONLY THE SHOE/PRODUCT. Keep the shoe's original logo, stitching, texture.
- **What to REMOVE**: Remove model legs, hands, mannequins, plastic stands, tags, strings, or ANY non-product elements.
- **Result**: ONLY the product should remain, perfectly isolated.

**6. LIGHTING (COMMERCIAL CATALOG STYLE)**
- **Type**: "Butterfly Lighting" or "Flat Even Lighting"
- **Direction**: Soft, even, frontal fill light
- **Shadows on Product**: Minimal to none. Flat commercial lighting to show product clearly.

**6. QUALITY & RETOUCHING**
- **Surface**: Retouch to remove dust, scuffs, glue marks
- **Texture**: Preserve leather grain, mesh weave, fabric texture PERFECTLY
- **Color**: Keep original color accurate (do not over-saturate or desaturate)

**7. VIEW & ANGLE**
- **Maintain**: Keep the EXACT SAME camera angle and perspective as input
- **Do NOT**: Rotate, tilt, or change the viewing angle

**[NEGATIVE PROMPT - ABSOLUTE PROHIBITIONS]**
black dot, dark spot, black mark, dark mark, corner dot, corner artifact, top-left dot, top-right dot, edge artifact, text, letters, numbers, watermark, label, writing, typography, shadow, cast shadow, contact shadow, drop shadow, floor shadow, reflection, ambient occlusion, dark background, gray background, off-white background, beige background, cream background, soft edges, halo, fringe, blur, noise, grain, artifacts, dots, marks, specks, dust particles, corner marks, signature, model legs, model hands, mannequin parts, plastic stand, tags, strings
`;
    }

    const studioBase = `${SYSTEM_ROLE}
** [TASK: EDITORIAL SCENE GENERATION] **
** CONSTRAINT:** Use the shoe from input.Do not generate generic shoe.

** [COMPOSITION RULES - STRICT] **
            1. ** CENTERED SUBJECT **: The shoe MUST be logically centered in the frame.
2. ** PADDING **: Ensure balanced negative space around the product.
3. ** WHOLE OBJECT **: Do not cut off any part of the shoe.
`;

    if (effect === 'studio_minimal_prop') {
        return `${studioBase}
**SCENE: "CLEAN MINIMAL STUDIO" **

**[REFERENCE STYLE: KOREAN COSMETIC BRAND PHOTOGRAPHY]**
Create a clean, minimal product photography scene like high-end Korean cosmetic brand catalogs.

**[BACKGROUND - CRITICAL]**
- Color: Pure clean white to very light warm gray gradient
- Surface: Clean matte white table/platform with subtle shadow
- NO props. NO geometric shapes. JUST the product on clean surface.

**[LIGHTING - SOFT NATURAL]**
- Type: Soft diffused natural window light from upper left (45 degrees)
- Shadow: SOFT, NATURAL contact shadow beneath product
- Shadow Direction: Gentle shadow extending to lower right
- Shadow Opacity: 15-25% gray, NOT black
- NO harsh shadows. NO multiple shadows.

**[COMPOSITION]**
- Product perfectly centered
- Clean negative space around product
- Professional e-commerce catalog style
- Minimal, elegant, premium feel

**[QUALITY]**
- Ultra high resolution
- Clean, crisp edges
- Professional commercial photography quality`;
    }

    if (effect === 'studio_natural_floor') {
        return `${studioBase}
** SCENE: "STREET STYLE" **
** CRITICAL **: Generate a COMPLETELY NEW background scene.Do not copy or preserve the original image background.
- Background: Concrete, asphalt, or pavement texture
            - Lighting: Hard sunlight with distinct shadows
                - Vibe: Authentic, outdoor, energetic
                    - ** Position **: Shoe placed centrally on the ground surface.`;
    }

    if (effect === 'studio_texture_emphasis') {
        return `${studioBase}
** SCENE: "DARK & DRAMATIC" **
** CRITICAL **: Generate a COMPLETELY NEW background scene.Do not copy or preserve the original image background.
- Background: Dark grey or black matte surface
            - Lighting: Rim lighting to highlight silhouette
                - Vibe: Premium, technical, moody
                    - ** Position **: Floating or resting in the exact center of the frame.`;
    }

    if (effect === 'studio_cinematic') {
        return `${studioBase}
**SCENE: "DRAMATIC FLOATING PRODUCT SHOT"**

**[CONCEPT]**
High-end sneaker advertisement photo. The shoe is FLOATING in mid-air with a dramatic spotlight beam from above.

**[LIGHTING - CRITICAL]**
- Main Light: Single powerful SPOTLIGHT from directly above
- Light Beam: Visible volumetric light cone cutting through darkness
- Dust Particles: Visible floating dust specs illuminated by the spotlight
- Rim Light: Subtle silver/white rim light on the shoe edges
- NO neon lights. NO colored lights. Only WHITE/SILVER dramatic lighting.

**[ATMOSPHERE]**
- Background: Very dark, almost black studio
- Floor: Dark polished concrete or metal surface with subtle reflection
- Air: Dusty/misty atmosphere, dust particles visible in the light beam
- Mood: Cinematic, premium, mysterious, expensive

**[SHOE POSITIONING]**
- The shoe is LEVITATING / FLOATING in mid-air
- Positioned in the center of the spotlight beam
- Slightly tilted at a dynamic angle
- Cast shadow on the floor below (indicating it's floating)

**[QUALITY]**
- Ultra sharp focus on the shoe
- 8K resolution, commercial photography quality
- Photorealistic, not CGI look
- Magazine cover worthy

**[NEGATIVE - DO NOT INCLUDE]**
neon lights, colored lights, blue light, purple light, pink light, green light, cyberpunk, futuristic, cluttered background`;
    }

    return `${SYSTEM_ROLE} Photorealistic product shot, centered composition.`;
};

// ============================================================================
// MAIN API FUNCTION (SECURE)
// ============================================================================

export const applyProductEffect = async (
    files: File[],
    effect: ProductEffect,
    onProgressUpdate: (message: string) => void,
    poseId?: string
): Promise<string> => {
    onProgressUpdate(poseId === 'original_pose'
        ? '원본 형태 분석 및 배경 제거 중...'
        : `${files.length}장 참조 이미지 분석 및 시각화 중...`
    );

    const prompt = getPromptForEffect(effect, poseId, files.length);

    // Convert files to base64
    const images = await Promise.all(files.map(async (file) => ({
        data: await fileToBase64(file),
        mimeType: file.type
    })));

    onProgressUpdate('고해상도 리터칭 및 렌더링... (SECURE)');

    // Extract dimensions from first file to preserve aspect ratio
    const dimensions = await getImageDimensions(files[0]);
    const aspectRatio = `${dimensions.width}:${dimensions.height} `;

    // Use actual image dimensions for aspectRatio - ensures output matches input size
    const result = await callGeminiSecure(prompt, images, {
        aspectRatio: aspectRatio,
        imageSize: '1K' // 1K resolution for speed while maintaining quality
    });

    onProgressUpdate('최종 후처리 중...');

    if (result.type !== 'image') {
        throw new Error('이미지가 생성되지 않았습니다.');
    }

    return result.data;
};
