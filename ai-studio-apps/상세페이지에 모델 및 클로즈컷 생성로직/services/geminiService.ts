
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Modality, Part, HarmCategory, HarmBlockThreshold, GenerateContentResponse } from "@google/genai";
import { GeneratedData, SpecContent, TextContent, FontSizes, FontStyles, HeroTextContent, HeroTextColors, NoticeContent, ImageAsset, CollageBlock } from "../App";
import { fileToDataUrl } from "../lib/utils";
import { PREDEFINED_POSES, PREDEFINED_CLOSEUP_POSES } from "../components/PreviewPanel";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- PRODUCT ENHANCEMENT SYSTEM ROLE ---
const PRODUCT_ENHANCEMENT_SYSTEM_ROLE = `
**SYSTEM ROLE:** You are a world-class "Commercial Product Photographer" and "CGI Retoucher".
**STRICT RULES:**
1. **IDENTITY LOCK:** The shoe's logo, stitching, and leather grain must be a 100% PERFECT CLONE of the reference.
2. **PHYSICS:** Contact shadows must be precise (Ambient Occlusion).
3. **QUALITY:** Output in photorealistic quality.
`;

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Standard Image Config to enforce 3:4 Portrait generation
const VERTICAL_IMAGE_CONFIG = {
    aspectRatio: '3:4', 
    responseModalities: [Modality.IMAGE],
    safetySettings
};

// Timeout helper to prevent infinite loading (90 seconds limit)
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


// --- HELPER FUNCTIONS ---

const fileToGenerativePart = async (file: File): Promise<Part> => {
    const base64EncodedData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    return {
        inlineData: {
            data: base64EncodedData,
            mimeType: file.type,
        },
    };
};

const dataUrlToGenerativePart = (url: string): Part => {
    const base64Data = url.split(',')[1];
    if (!base64Data) throw new Error("Invalid data URL for conversion.");
    const mimeType = url.match(/data:(.*?);base64/)?.[1] || 'image/png';
    return { inlineData: { data: base64Data, mimeType } };
};

const base64ToFile = (base64: string, filename: string, mimeType: string): File => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return new File([blob], filename, { type: mimeType });
};

// Helper function to convert data URL to File object
const dataUrlToFile = async (url: string, filename: string): Promise<File> => {
    const response = await fetch(url);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/png';
    return new File([blob], filename, { type: mimeType });
};


// --- CORE GENERATION FUNCTIONS ---

async function _createCloseupWithPose(
    baseImageUrl: string,
    pose: string
): Promise<ImageAsset> {
    return regenerateImageWithSpecificPose(baseImageUrl, pose);
}

async function _generateVerticalLegsCrop(baseImageUrl: string): Promise<string> {
    const baseImagePart = dataUrlToGenerativePart(baseImageUrl);
    
    // Prompt specifically designed to fill the 3:4 frame
    const prompt = `// --- TASK: PORTRAIT_LEG_SHOT_GENERATION ---
// ACTION: Generate a PORTRAIT IMAGE (3:4) focusing on the model's legs and shoes.
// SOURCE: Use the provided \`SOURCE_IMAGE\`.
//
// [COMPOSITION RULES]
// 1. **FRAME**: The image MUST be Portrait (3:4).
// 2. **CROP**: Cut off at the waist. Show waist down to feet.
// 3. **FILL**: The legs must fill the frame compositionally.
// 4. **IDENTITY**: Keep the trousers, skin tone, and shoes IDENTICAL to source.
//
// Output: High resolution portrait photograph.`;

    const response = await withTimeout<GenerateContentResponse>(ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }, { text: "SOURCE_IMAGE:" }, baseImagePart] },
        config: { 
            imageConfig: VERTICAL_IMAGE_CONFIG,
        },
    }), 90000, "클로즈업 생성 시간이 초과되었습니다.");
    
    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!imagePart?.inlineData) throw new Error("Vertical leg crop generation failed.");
    
    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}

async function _bringModelToStudio(
    modelFile: File, 
    productFiles: File[],
    topFile?: File | null,
    pantsFile?: File | null
): Promise<string> {
    const modelPart = await fileToGenerativePart(modelFile);
    const productParts = await Promise.all(productFiles.map(fileToGenerativePart));

    const parts: Part[] = [];
    
    let prompt = `// --- PROTOCOL: STUDIO_MASTER_GENERATION (GEMINI 3.0 PRO) ---
// TARGET: Place model in a "Modern Concrete Studio" with new shoes.
// OUTPUT FORMAT: Portrait (3:4).
//
// [CRITICAL PIXEL RULES]
// 1. **FACE PRESERVATION**: The face MUST be pixel-perfect identical to \`ORIGINAL_MODEL_IMAGE\`. No "AI face" smoothing. 
// 2. **BODY PRESERVATION**: Keep EXACT body proportions and skin texture.
// 3. **SHOE REPLACEMENT**: Wear the provided \`PRODUCT_IMAGES\`.
// 4. **BACKGROUND**: Neutral grey concrete studio wall and floor. Soft shadows.
// 5. **FRAMING**: FULL BODY SHOT. DO NOT CROP THE HEAD. Leave headroom. Ensure feet are visible.`;

    if (topFile) {
        prompt += `\n// 6. **TOP REPLACEMENT**: Wear the provided \`TOP_IMAGE\`.`;
    }
    if (pantsFile) {
        prompt += `\n// 7. **BOTTOM REPLACEMENT**: Wear the provided \`BOTTOM_IMAGE\`.`;
    }

    prompt += `\n// Render a photorealistic full-body portrait shot.`;

    parts.push({ text: prompt });
    parts.push({ text: "ORIGINAL_MODEL_IMAGE:" });
    parts.push(modelPart);
    parts.push({ text: "PRODUCT_IMAGES:" });
    parts.push(...productParts);

    if (topFile) {
        const topPart = await fileToGenerativePart(topFile);
        parts.push({ text: "TOP_IMAGE:" });
        parts.push(topPart);
    }
    if (pantsFile) {
        const pantsPart = await fileToGenerativePart(pantsFile);
        parts.push({ text: "BOTTOM_IMAGE:" });
        parts.push(pantsPart);
    }

    const response = await withTimeout<GenerateContentResponse>(ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: parts },
        config: { 
            imageConfig: VERTICAL_IMAGE_CONFIG,
        },
    }), 90000, "스튜디오 생성 시간이 초과되었습니다.");

    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!imagePart?.inlineData) throw new Error("Failed to bring model to studio.");
    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}


/**
 * Regenerates ONLY the shoes on a given model image, keeping everything else identical.
 */
export async function regenerateShoesOnly(
    baseImageUrl: string,
    productFiles: File[]
): Promise<string> {
    const baseImagePart = dataUrlToGenerativePart(baseImageUrl);
    const productParts = await Promise.all(productFiles.map(fileToGenerativePart));

    const prompt = `// --- PROTOCOL: AGGRESSIVE_SHOE_REPLACEMENT (GEMINI 3.0 PRO) ---
// TASK: COMPLETELY ERASE old shoes and paint \`PRODUCT_IMAGES\` on the feet.
// OUTPUT FORMAT: Portrait (3:4).
//
// [CRITICAL FRAMING RULES]
// 1. **NO CROPPING**: The output MUST maintain the EXACT SAME framing/zoom as \`BASE_IMAGE\`.
// 2. **FULL BODY**: If \`BASE_IMAGE\` is full body, output MUST be full body. DO NOT ZOOM IN ON SHOES.
// 3. **HEAD PRESERVATION**: The model's head and hair must be fully visible and untouched.
//
// [INSTRUCTIONS]
// 1. **TARGET**: Identify the feet/shoes area in \`BASE_IMAGE\`.
// 2. **ACTION**: REPLACE the shoes with the exact design, color, and texture from \`PRODUCT_IMAGES\`.
// 3. **IDENTITY LOCK**: EVERYTHING ELSE (Face, Hair, Trousers, Background, Skin) MUST BE IDENTICAL PIXEL-FOR-PIXEL.
// 4. **INTEGRATION**: Ensure realistic lighting and shadows on the new shoes.
//
// DO NOT just blend. SWAP them. IGNORE ORIGINAL SHOES. KEEP ORIGINAL COMPOSITION.`;

    const response = await withTimeout<GenerateContentResponse>(ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [
            { text: prompt },
            { text: "BASE_IMAGE:" },
            baseImagePart,
            { text: "PRODUCT_IMAGES:" },
            ...productParts,
        ] },
        config: { 
            imageConfig: VERTICAL_IMAGE_CONFIG,
        },
    }), 90000, "신발 교체 시간이 초과되었습니다.");

    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!imagePart?.inlineData) {
        throw new Error("Shoe regeneration failed to return an image.");
    }
    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}


export async function generateFinalTighterCloseup(
    productFiles: File[],
    modelImageUrl: string
): Promise<string> {
    const productParts = await Promise.all(productFiles.map(fileToGenerativePart));
    const modelPart = dataUrlToGenerativePart(modelImageUrl);

    const tightCloseupPrompt = `// --- TASK: ARTISTIC_SHOE_CLOSEUP ---
// Create a zoomed-in, low-angle shot of the shoes.
// Focus purely on the shoe details and material.
// Output: Portrait (3:4).`;

    const response = await withTimeout<GenerateContentResponse>(ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [modelPart, ...productParts, { text: tightCloseupPrompt }] },
        config: { 
            imageConfig: VERTICAL_IMAGE_CONFIG,
        },
    }), 90000, "클로즈업 생성 시간이 초과되었습니다.");
    
    const closeupPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!closeupPart?.inlineData) throw new Error("Final tighter closeup shot generation failed.");
    return `data:${closeupPart.inlineData.mimeType};base64,${closeupPart.inlineData.data}`;
}


// --- PUBLIC API FUNCTIONS ---

export async function changeModelFace(
    originalModelShotUrls: string[],
    newFaceFiles: File[]
): Promise<{ newModelShots: string[] }> {
    const newFaceParts = await Promise.all(newFaceFiles.map(fileToGenerativePart));

    const faceSwapPrompt = `// --- PROTOCOL: FACE_SWAP_INJECTION ---
// TASK: Swap face in \`CONTEXT_IMAGE\` with \`IDENTITY_SRC_ARRAY\`.
// OUTPUT: Portrait (3:4).
//
// [RULES]
// 1. **KEEP POSE**: Head angle and gaze direction must match.
// 2. **LOCK BODY**: Do not change clothes or body.
// 3. **BLEND**: Seamless skin tone blending.`;
    
    const promises = originalModelShotUrls.map(async (url) => {
        const originalImagePart = dataUrlToGenerativePart(url);
        
        const response = await withTimeout<GenerateContentResponse>(ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [
                { text: faceSwapPrompt },
                { text: "CONTEXT_IMAGE:" },
                originalImagePart,
                { text: "IDENTITY_SRC_ARRAY:" },
                ...newFaceParts
            ] },
            config: { 
                imageConfig: VERTICAL_IMAGE_CONFIG,
            },
        }), 90000, "얼굴 변경 시간이 초과되었습니다.");

        const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (!imagePart?.inlineData) {
            throw new Error(`Failed to swap face for one of the images.`);
        }
        return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    });

    const newModelShots = await Promise.all(promises);
    return { newModelShots };
}


export async function enhanceProductImageWithPreset(file: File, preset: string): Promise<File> {
    const productPart = await fileToGenerativePart(file);

    let specificPrompt = "";

    switch (preset) {
        case 'beautify':
            specificPrompt = `
    **[TASK: COMMERCE CATALOG IMAGE - ISOLATION]**
    **SCENE:**
    * **Background:** PURE WHITE (#FFFFFF).
    * **Shadow:** NO cast shadows. Floating isolation (Nu-kki style).
    * **Lighting:** "Butterfly Lighting". Soft, even frontal fill light.
    * **Retouching:** Remove dust/scuffs, preserve leather texture perfectly.
    * **View:** Standard commercial product angle.
            `;
            break;
        case 'studio':
             specificPrompt = `
    **[TASK: EDITORIAL CAMPAIGN - MINIMALIST]**
    **SCENE:**
    * **Environment:** Clean studio. Walls are Matte Off-White (#F0F0F0). Floor is polished light grey concrete.
    * **Props:** A single, geometric concrete cube. The shoe is leaning against it.
    * **Lighting:** "Softbox Window Light" from top-left. Soft shadows.
    * **Atmosphere:** Calm, sophisticated, museum-like.
            `;
            break;
        case 'outdoor':
            specificPrompt = `
    **[TASK: STREET FASHION - SUNLIGHT]**
    **SCENE:**
    * **Environment:** Raw, textured pavement or rough bright concrete floor.
    * **Lighting:** "Hard Sunlight" (Direct Sun). High contrast. 5500K.
    * **Shadow Effect:** Use a "Gobo" to cast a shadow of a window frame or palm leaf across the floor.
    * **Atmosphere:** Energetic, organic, summer vibe.
            `;
            break;
        case 'side-lighting':
            specificPrompt = `
    **[TASK: DARK MODE - TEXTURE DETAIL]**
    **SCENE:**
    * **Background:** Dark, matte Charcoal Grey (#333333) seamless infinity wall.
    * **Lighting:** "Raking Light" (Low angle side lighting). Light creates high contrast on the surface ridges.
    * **Purpose:** Exaggerate depth—pop the suede texture, leather grain, and mesh holes.
    * **Atmosphere:** Masculine, technical, premium, heavy.
            `;
            break;
        case 'cinematic':
            specificPrompt = `
    **[TASK: FUTURE RUNWAY - CINEMATIC]**
    **SCENE:**
    * **Environment:** Dark, glossy, wet-look black floor.
    * **Atmosphere:** Low-lying fog/dry ice smoke covering the floor.
    * **Action:** "Levitation" illusion (shoe floating slightly above ground).
    * **Lighting:** Single "God Ray" spotlight from above. Rim lighting on edges.
    * **Vibe:** Cyberpunk, ethereal, movie poster quality.
            `;
            break;
        case 'off':
        default:
            return file;
    }

    const fullPrompt = `${PRODUCT_ENHANCEMENT_SYSTEM_ROLE}\n${specificPrompt}`;

    const response = await withTimeout<GenerateContentResponse>(ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [
            { text: fullPrompt },
            { text: "SOURCE_IMAGE:" },
            productPart
        ] },
        config: { 
            responseModalities: [Modality.IMAGE],
            imageConfig: {
                aspectRatio: '3:4'
            },
            safetySettings 
        }, 
    }), 90000, "이미지 보정 시간이 초과되었습니다.");

    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!imagePart?.inlineData) throw new Error("AI image enhancement failed to return an image.");
    return base64ToFile(imagePart.inlineData.data, `${preset}_${file.name}`, imagePart.inlineData.mimeType);
}

// *** GENERATION LOGIC UPDATE: 1 MASTER + 2 VARIATIONS = 3 IMAGES ***

// Helper for parallel generation
async function generateVariations(baseAsset: ImageAsset, poses: {prompt: string, name: string}[]): Promise<ImageAsset[]> {
    const promises = poses.map(async (pose) => {
        try {
            const asset = await regenerateImageWithSpecificPose(baseAsset.url, pose.prompt);
            return { ...asset, generatingParams: { pose: pose.name } };
        } catch (error) {
            console.error(`Failed to generate variation for ${pose.name}:`, error);
            return null;
        }
    });

    const results = await Promise.all(promises);
    return results.filter((res): res is ImageAsset => res !== null);
}

const INITIAL_MODEL_VARIANTS = [
    { name: 'Variation: Walking', prompt: 'Change the pose to walking forward towards camera. Dynamic stride. Shoes clearly visible. Full body.' },
    { name: 'Variation: Crossed Legs', prompt: 'Change the pose to standing with legs crossed casually. Relaxed fashion stance. Full body.' }
];

// UPDATED: Removed "Back Heel" and "Sole" related poses to avoid showing unavailable details.
// Replaced with safer angles that focus on the side and front profile.
const INITIAL_CLOSEUP_VARIANTS = [
    { name: 'Variation: Side Step', prompt: 'Close-up edit: Show the feet from the side profile, taking a step. Emphasize side of shoe.' },
    { name: 'Variation: 45 Degree', prompt: 'Close-up edit: Feet positioned at a 45-degree angle to the camera. Flattering angle showing both front and side.' }
];

export async function generateInitialOriginalSet(
    productFiles: File[],
    modelFiles: File[],
    onProgress?: (message: string) => void
): Promise<{ modelShots: ImageAsset[], closeupShots: ImageAsset[] }> {
    
    // 1. Create the Master Model Cut (Full Body)
    onProgress?.('1/5: 모델 전신 마스터 컷 생성 중 (신발 교체)...');
    const mainModelFile = modelFiles.length > 1 ? modelFiles[1] : modelFiles[0];
    const originalModelUrl = await fileToDataUrl(mainModelFile);
    
    // Step A: Master Generation (Aggressive Swap)
    const masterSwappedImageUrl = await regenerateShoesOnly(originalModelUrl, productFiles);
    const masterModelAsset: ImageAsset = { url: masterSwappedImageUrl, generatingParams: { pose: 'Front View (Master)' } };
    
    // Step B: Parallel Generation of Model Variations (Async)
    onProgress?.('2/5: 전신 컷 변형 생성 중 (병렬 처리)...');
    const modelVariationsPromise = generateVariations(masterModelAsset, INITIAL_MODEL_VARIANTS);

    // Step C: Master Closeup Generation
    onProgress?.('3/5: 하반신 클로즈업 마스터 컷 생성 중...');
    const frontCloseupUrl = await _generateVerticalLegsCrop(masterSwappedImageUrl);
    const masterCloseupAsset: ImageAsset = { url: frontCloseupUrl, generatingParams: { pose: 'Original Leg Crop' } };

    // Step D: Parallel Generation of Closeup Variations (Async)
    onProgress?.('4/5: 클로즈업 변형 생성 중 (병렬 처리)...');
    const closeupVariationsPromise = generateVariations(masterCloseupAsset, INITIAL_CLOSEUP_VARIANTS);

    // Wait for all
    onProgress?.('5/5: 모든 이미지 마무리 중...');
    const [modelVariations, closeupVariations] = await Promise.all([modelVariationsPromise, closeupVariationsPromise]);

    const modelShots = [masterModelAsset, ...modelVariations];
    const closeupShots = [masterCloseupAsset, ...closeupVariations];

    return { modelShots, closeupShots };
}

export async function generateStudioImageSet(
    productFiles: File[],
    modelFiles: File[],
    onProgress?: (message: string) => void,
    topFile?: File | null,
    pantsFile?: File | null
): Promise<{ 
    modelShots: ImageAsset[], 
    closeupShots: ImageAsset[]
}> {
    // 1. Master Studio Cut (Full Body)
    onProgress?.('1/5: 스튜디오 모델 마스터 컷 생성 중...');
    const mainModelFile = modelFiles[0]; 
    const masterStudioUrl = await _bringModelToStudio(mainModelFile, productFiles, topFile, pantsFile);
    const masterStudioAsset: ImageAsset = { url: masterStudioUrl, generatingParams: { pose: 'Studio Front (Master)' } };

    // Step B: Parallel Generation of Model Variations
    onProgress?.('2/5: 스튜디오 전신 변형 생성 중...');
    const modelVariationsPromise = generateVariations(masterStudioAsset, INITIAL_MODEL_VARIANTS);

    // Step C: Vertical Leg Closeup from Studio Master
    onProgress?.('3/5: 스튜디오 하반신 마스터 컷 생성 중...');
    const frontCloseupUrl = await _generateVerticalLegsCrop(masterStudioUrl);
    const masterCloseupAsset: ImageAsset = { url: frontCloseupUrl, generatingParams: { pose: 'Studio Leg Crop' } };

    // Step D: Parallel Generation of Closeup Variations
    onProgress?.('4/5: 스튜디오 클로즈업 변형 생성 중...');
    const closeupVariationsPromise = generateVariations(masterCloseupAsset, INITIAL_CLOSEUP_VARIANTS);

    // Wait for all
    onProgress?.('5/5: 모든 이미지 마무리 중...');
    const [modelVariations, closeupVariations] = await Promise.all([modelVariationsPromise, closeupVariationsPromise]);

    const modelShots = [masterStudioAsset, ...modelVariations];
    const closeupShots = [masterCloseupAsset, ...closeupVariations];
    
    return { modelShots, closeupShots };
}


export async function generateTextContentOnly(
    productFiles: File[],
    customInstructions: string,
): Promise<{ textContent: TextContent, specContent: SpecContent, heroTextContent: HeroTextContent, noticeContent: NoticeContent }> {
    const productParts = (await Promise.all(productFiles.map(fileToGenerativePart))).flatMap((part, index) => [{ text: `Product image ${index + 1}` }, part]);
    const textPrompt = `You are a professional copywriter. Generate text content for a shoe product detail page. Your response must be a single JSON object with four top-level keys: "textContent", "specContent", "heroTextContent", and "noticeContent".
    **RULES:**
    1. The values for "textContent", "specContent", and "noticeContent" keys MUST be objects with all their string values set to empty strings "".
    2. Write like a human for "heroTextContent". Do not mention AI. Do not use emojis.
    - "heroTextContent": { All values in English. "brandName": "Creative Brand Name", "slogan": "Catchy Slogan", "descriptionAndTags": "A multi-line string combining a product title, one or two descriptive sentences, and several hashtags at the end, each starting with #. The total length should be concise and impactful. Example: Timeless Grace in Every Stride\\nDiscover the perfect blend of classic style and contemporary comfort.\\n#KneeHighBoots #SuedeBoots #ClassicStyle" }
    Provide only the JSON object.`;
    
    const response = await withTimeout<GenerateContentResponse>(ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [...productParts, { text: textPrompt }] },
        config: { responseMimeType: 'application/json', ...(customInstructions && { systemInstruction: customInstructions }) }
    }), 30000, "텍스트 생성 시간이 초과되었습니다.");
    
    const rawText = response.text;
    if (!rawText || rawText.trim() === '') {
        throw new Error("AI failed to generate text content or returned an empty response.");
    }

    const jsonText = rawText.trim().replace(/```json|```/g, '');
    if (!jsonText) throw new Error("AI returned empty text content after cleaning.");

    let parsedContent;
    try {
        parsedContent = JSON.parse(jsonText);
    } catch (e) {
        console.error("Failed to parse JSON from AI. Raw text received:", rawText);
        throw new Error("AI returned invalid JSON for text content.");
    }

    if (!parsedContent?.textContent || !parsedContent.specContent) {
        throw new Error("AI returned unexpected format for text content.");
    }
    return parsedContent as { textContent: TextContent, specContent: SpecContent, heroTextContent: HeroTextContent, noticeContent: NoticeContent };
}


export async function regenerateModelImages(
    productFiles: File[],
    modelFiles: File[],
    onProgress?: (message: string) => void
): Promise<{ newModelShots: ImageAsset[], newCloseupShots: ImageAsset[] }> {
    // Re-run the full set generation
    const result = await generateInitialOriginalSet(productFiles, modelFiles, onProgress);
    return { newModelShots: result.modelShots, newCloseupShots: result.closeupShots };
}


export async function regenerateSingleModelImage(productFiles: File[], modelFiles: File[]): Promise<ImageAsset> {
     if (modelFiles.length < 1) throw new Error("Original model file not found for regeneration.");
    const mainModelFile = modelFiles.length > 1 ? modelFiles[1] : modelFiles[0];
    const originalModelUrl = await fileToDataUrl(mainModelFile);
    const newUrl = await regenerateShoesOnly(originalModelUrl, productFiles);

    return {
        url: newUrl,
        generatingParams: { pose: 'Front View' }
    };
}

export async function regenerateSingleStudioModelShot(productFiles: File[], modelFiles: File[]): Promise<ImageAsset> {
    const fullBodyUrl = await _bringModelToStudio(modelFiles[0], productFiles);
    return { url: fullBodyUrl, generatingParams: { pose: 'Studio Front' } };
}

export async function regenerateSingleStudioCloseupShot(baseModelImageUrl: string): Promise<ImageAsset> {
    // Regenerate using the vertical leg crop logic
    const legCloseupUrl = await _generateVerticalLegsCrop(baseModelImageUrl);
    return { url: legCloseupUrl, generatingParams: { pose: 'Studio Leg Crop' } };
}


export async function regenerateSingleCloseupImage(baseModelImageUrl: string): Promise<ImageAsset> {
    const randomCloseupPose = PREDEFINED_CLOSEUP_POSES[Math.floor(Math.random() * PREDEFINED_CLOSEUP_POSES.length)].prompt;
    return _createCloseupWithPose(baseModelImageUrl, randomCloseupPose);
}

export async function regenerateImageWithSpecificPose(
    baseImageUrl: string,
    pose: string
): Promise<ImageAsset> {
    if (!baseImageUrl) throw new Error("A base image URL is required for modification.");
    const sourceImagePart = dataUrlToGenerativePart(baseImageUrl);

    const prompt = `// --- TASK: POSE_MODIFICATION (EDIT ONLY) ---
// CHANGE POSE TO: ${pose}
// OUTPUT: Portrait (3:4).
//
// [CRITICAL FRAMING RULES]
// 1. **FULL BODY**: The output MUST be a full-body shot. Head to toe.
// 2. **NO CROPPING**: Do not cut off the head or feet. Leave padding at the top and bottom.
// 3. **IDENTITY PRESERVATION**: Face and identity must remain exactly the same as \`REFERENCE_IMAGE\`.
//
// [RULES]
// 1. **FACE & IDENTITY**: MUST MATCH SOURCE.
// 2. **CLOTHING**: Keep upper body clothing identical.
// 3. **SHOES**: Keep the shoes identical.
// 4. **BACKGROUND**: Keep the background identical.
//
// Output: Full body shot, Portrait.`;

    const response = await withTimeout<GenerateContentResponse>(ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [
            { text: prompt },
            { text: "REFERENCE_IMAGE:" },
            sourceImagePart,
        ] },
        config: { 
            imageConfig: VERTICAL_IMAGE_CONFIG,
        },
    }), 90000, "자세 변경 시간이 초과되었습니다.");
    
    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!imagePart?.inlineData) throw new Error("Image modification failed to return an image.");
    
    const newUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    return { url: newUrl, generatingParams: { pose } };
}

export async function regenerateStudioImageWithSpecificPose(
    baseImageUrl: string,
    pose: string
): Promise<ImageAsset> {
    return regenerateImageWithSpecificPose(baseImageUrl, pose);
}

export async function generateAdditionalModelImage(
    baseModelImageUrl: string
): Promise<ImageAsset> {
    const randomPose = PREDEFINED_POSES[Math.floor(Math.random() * PREDEFINED_POSES.length)].prompt;
    return regenerateImageWithSpecificPose(baseModelImageUrl, randomPose);
}

export async function generateAdditionalCloseupImage(
    baseModelImageUrl: string
): Promise<ImageAsset> {
    const randomCloseupPose = PREDEFINED_CLOSEUP_POSES[Math.floor(Math.random() * PREDEFINED_CLOSEUP_POSES.length)].prompt;
    return _createCloseupWithPose(baseModelImageUrl, randomCloseupPose);
}

export async function generateConceptShot(productFiles: File[], modelFiles: File[], productTitle: string): Promise<string> {
    if (modelFiles.length === 0) throw new Error("A model image is required for the concept shot background.");
    const productParts = await Promise.all(productFiles.map(fileToGenerativePart));
    const modelBackgroundPart = await fileToGenerativePart(modelFiles[0]);
    const prompt = `// --- TASK: PRODUCT_HERO_SHOT ---
// Remove model from scene. Place ONE shoe in the empty environment.
// Keep lighting and background identical to source.
// Output: Portrait (3:4).`;
    const response = await withTimeout<GenerateContentResponse>(ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }, {text: "Scene Reference Image:"}, modelBackgroundPart, {text: "Product Images:"}, ...productParts] },
        config: { 
            imageConfig: VERTICAL_IMAGE_CONFIG,
        },
    }), 90000, "컨셉샷 생성 시간이 초과되었습니다.");
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part?.inlineData) throw new Error("Concept shot generation failed to return an image.");
    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
}

export async function generateStudioWornCloseupShot(productFiles: File[], modelFiles: File[]): Promise<string> {
    const productParts = await Promise.all(productFiles.map(fileToGenerativePart));
    const modelParts = await Promise.all(modelFiles.map(fileToGenerativePart));
    const prompt = `// --- TASK: ARTISTIC_FOOT_CLOSEUP ---
// Generate a high-fashion closeup of a foot wearing the shoe.
// Use neutral concrete studio background.
// Output: Portrait (3:4).`;
    const response = await withTimeout<GenerateContentResponse>(ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }, ...productParts, ...modelParts] },
        config: { 
            imageConfig: VERTICAL_IMAGE_CONFIG,
        },
    }), 90000, "스튜디오 클로즈업 생성 시간이 초과되었습니다.");
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part?.inlineData) throw new Error("Studio worn close-up shot generation failed.");
    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
}

export async function generateFinalConceptShot(productFiles: File[], modelFiles: File[]): Promise<string> {
     if (modelFiles.length === 0) throw new Error("A model image is required for the final concept shot background.");
    const productParts = await Promise.all(productFiles.map(fileToGenerativePart));
    const modelBackgroundPart = await fileToGenerativePart(modelFiles[0]);
    const prompt = `// --- TASK: FINAL_PRODUCT_SHOT ---
// Remove model. Place shoe in scene.
// Match source lighting exactly.
// Output: Portrait (3:4).`;
    const response = await withTimeout<GenerateContentResponse>(ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }, {text: "Scene Reference Image:"}, modelBackgroundPart, {text: "Product Images:"}, ...productParts] },
        config: { 
            imageConfig: VERTICAL_IMAGE_CONFIG,
        },
    }), 90000, "마지막 컨셉샷 생성 시간이 초과되었습니다.");
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part?.inlineData) throw new Error("Final concept shot generation failed.");
    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
}

export function populateTemplate(
    textContent: TextContent,
    specContent: SpecContent,
    heroTextContent: HeroTextContent,
    noticeContent: NoticeContent,
    imageUrls: GeneratedData['imageUrls'],
    fontSizes: FontSizes,
    fontStyles: FontStyles,
    layoutHtml: string,
    heroTextColors: HeroTextColors,
    collageBlocks: GeneratedData['collageBlocks'],
    forExport: boolean = false,
    isHeroSectionVisible: boolean,
    isStudioWornCloseupVisible: boolean,
    isFinalConceptShotVisible: boolean,
    imageZoomLevels: { [key: string]: number } = {}
): string {
    let result = layoutHtml;

    // Helper for Object Cover to prevent stretching
    // Generated images are 3:4, so they fit perfectly in a 3:4 container with object-cover
    const COVER_STYLE = `width: 100%; height: 100%; object-fit: cover; display: block;`;
    
    // Product images: FULL WIDTH, AUTO HEIGHT (Maintains original ratio)
    const PRODUCT_IMG_STYLE = `width: 100%; height: auto; display: block; vertical-align: top;`;

    const getZoomStyle = (key: string, isProduct: boolean = false): { wrapper: string; img: string } => {
        const zoomLevel = imageZoomLevels[key];
        const baseImgStyle = isProduct ? PRODUCT_IMG_STYLE : COVER_STYLE;
        
        if (zoomLevel && zoomLevel !== 1) {
            return {
                wrapper: 'overflow: hidden; background-color: white; width: 100%; height: 100%; display: block;',
                img: `${baseImgStyle} transform: scale(${zoomLevel}); transition: transform 0.2s ease-out; transform-origin: center;`,
            };
        }
        return { wrapper: 'width: 100%; height: 100%; display: block;', img: baseImgStyle };
    };

    // --- HERO SECTION (3:4 Ratio) ---
    const heroKey = `conceptShot-0`;
    const heroStyles = getZoomStyle(heroKey);
    const heroSectionHtml = isHeroSectionVisible ? `
        <div class="hero-section relative w-full" style="aspect-ratio: 3/4; overflow: hidden;">
            <div style="width: 100%; height: 100%; background-color: white;">
                <img src="${imageUrls.conceptShot}" alt="Hero concept shot"
                    style="${heroStyles.img}"
                    data-type="conceptShot" data-gallery-type="conceptShot" data-index="0" />
            </div>
            
            <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div class="hero-text-top p-8 text-left" style="background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);">
                    <h1 class="brand-name font-bold leading-tight" style="color: ${heroTextColors.brandName}; font-family: ${fontStyles.heroBrand}; font-size: ${fontSizes.heroBrandName}px;">
                        ${heroTextContent.brandName.replace(/\n/g, '<br>')}
                    </h1>
                    <p class="slogan mt-1" style="color: ${heroTextColors.slogan}; font-family: ${fontStyles.heroMain}; font-size: ${fontSizes.slogan}px;">
                        ${heroTextContent.slogan.replace(/\n/g, '<br>')}
                    </p>
                </div>
                <div class="hero-text-bottom p-8 text-left" style="background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);">
                    <p class="description-and-tags whitespace-pre-wrap" style="color: ${heroTextColors.descriptionAndTags}; font-family: ${fontStyles.heroMain}; font-size: ${fontSizes.heroDescriptionAndTags}px;">
                        ${heroTextContent.descriptionAndTags.replace(/\n/g, '<br>')}
                    </p>
                </div>
            </div>
        </div>
    ` : '';
    result = result.replace('<!--HERO_SECTION-->', heroSectionHtml);

    // --- STUDIO WORN CLOSEUP SECTION (3:4 Ratio) ---
    const studioWornKey = `studioWornCloseup-0`;
    const studioWornStyles = getZoomStyle(studioWornKey);
    const studioWornCloseupHtml = isStudioWornCloseupVisible ? `
        <div style="aspect-ratio: 3/4; overflow: hidden;">
             <div style="${studioWornStyles.wrapper}">
                <img src="${imageUrls.studioWornCloseup}" alt="Studio worn closeup shot"
                    style="${studioWornStyles.img}"
                    data-type="studioWornCloseup" data-gallery-type="studioWornCloseup" data-index="0" />
            </div>
        </div>
    ` : '';
    result = result.replace('<!--STUDIO_WORN_CLOSEUP_SECTION-->', studioWornCloseupHtml);

    // --- PRODUCT IMAGES (Full Width, Natural Height) ---
    const productImagesHtml = imageUrls.products.map((url, i) => {
        const key = `products-${i}`;
        const styles = getZoomStyle(key, true); // true = isProduct
        return `<div style="width: 100%; display: block; margin: 0; padding: 0;">
                    <img src="${url}" alt="Product shot ${i + 1}" style="${styles.img}" data-type="products" data-gallery-type="products" data-index="${i}" />
                </div>`;
    }).join('');
    result = result.replace('<!--PRODUCT_IMAGES-->', productImagesHtml);

    // --- RENDER MODEL & CLOSEUP SECTIONS (3:4 Ratio) ---
    const renderSectionContent = (section: 'model' | 'closeup') => {
        const singleShots = section === 'model' ? imageUrls.modelShots : imageUrls.closeupShots;
        const galleryKey = section === 'model' ? 'modelShots' : 'closeupShots';
        const sectionCollages = collageBlocks.filter(b => b.section === section);

        const items = [
            ...singleShots.map(asset => ({ type: 'single', data: asset })),
            ...sectionCollages.map(block => ({ type: 'collage', data: block }))
        ];

        return items.map((item, index) => {
            if (item.type === 'single') {
                const asset = item.data as ImageAsset;
                const originalIndex = singleShots.indexOf(asset);
                const keyForZoom = `${galleryKey}-${originalIndex}`;
                const styles = getZoomStyle(keyForZoom);
                // 3:4 for generated content
                return `<div data-section-item-index="${index}" data-section="${section}" style="aspect-ratio: 3/4; overflow: hidden; width: 100%;">
                    <div style="${styles.wrapper}">
                        <img src="${asset.url}" alt="Model shot ${originalIndex + 1}" style="${styles.img}" data-type="models" data-gallery-type="${galleryKey}" data-index="${originalIndex}" />
                    </div>
                </div>`;
            } else { // collage
                const block = item.data as CollageBlock;
                const gridClass = block.layout === '2x1' ? 'grid-cols-2' : 'grid-cols-2';
                const imagesHtml = block.images.map((asset, i) => {
                    const keyForZoom = `collageBlocks-${block.id}-${i}`;
                    const styles = getZoomStyle(keyForZoom);
                    return `<div style="${styles.wrapper} width: 100%; height: 100%;">
                        <img src="${asset.url}" alt="Collage image ${i + 1}" style="${styles.img}"
                            data-type="collage" data-gallery-type="collageBlocks" data-block-id="${block.id}" data-index="${i}" />
                    </div>`;
                }).join('');
                return `<div data-section-item-index="${index}" data-section="${section}" style="aspect-ratio: 3/4; overflow: hidden; width: 100%;">
                    <div class="grid ${gridClass} gap-0 h-full w-full" data-collage-block-id="${block.id}">${imagesHtml}</div>
                </div>`;
            }
        }).join('');
    };

    result = result.replace('<!--MODEL_SECTION_CONTENT-->', renderSectionContent('model'));
    result = result.replace('<!--CLOSEUP_SECTION_CONTENT-->', renderSectionContent('closeup'));


    // --- FINAL CONCEPT SHOT (3:4 Ratio) ---
    const finalConceptKey = `finalConceptShot-0`;
    const finalConceptStyles = getZoomStyle(finalConceptKey);
    const finalConceptShotHtml = isFinalConceptShotVisible ? `
        <div style="aspect-ratio: 3/4; overflow: hidden;">
             <div style="${finalConceptStyles.wrapper}">
                <img src="${imageUrls.finalConceptShot}" alt="Final concept shot"
                    style="${finalConceptStyles.img}"
                    data-type="finalConceptShot" data-gallery-type="finalConceptShot" data-index="0" />
            </div>
        </div>
    ` : '';
    result = result.replace('<!--FINAL_CONCEPT_SHOT-->', finalConceptShotHtml);

    return result;
}

export const LAYOUT_TEMPLATE_HTML = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1000">
    <title>Product Page</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      body { margin: 0; padding: 0; background-color: #ffffff; width: 100%; min-width: 1000px; }
      img { display: block; width: 100%; margin: 0; padding: 0; vertical-align: top; }
      .font-sans { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; }
      
      /* Reset containers to ensure full width */
      .product-shots, .model-shots-container, .closeup-shots-container, .hero-section { 
          width: 100%; 
          display: flex; 
          flex-direction: column; 
          margin: 0; 
          padding: 0; 
      }
      div { box-sizing: border-box; }
      
      /* Isolate layout styles to avoid leaking into the main app when not in iframe */
      .product-page-container {
          width: 1000px;
          margin: 0 auto;
          background-color: white;
      }
    </style>
</head>
<body>
    <div class="product-page-container font-sans">
        <!--HERO_SECTION-->
        <!--STUDIO_WORN_CLOSEUP_SECTION-->
        <div class="product-shots"><!--PRODUCT_IMAGES--></div>
        <!--FILTERABLE_CONTENT_START-->
        <div class="model-shots-container">
            <!--MODEL_SECTION_CONTENT-->
        </div>
        <div class="closeup-shots-container">
            <!--CLOSEUP_SECTION_CONTENT-->
        </div>
        <!--FILTERABLE_CONTENT_END-->
        <hr class="my-0 border-gray-100 h-px">
        <!--FINAL_CONCEPT_SHOT-->
    </div>
</body>
</html>
`;
