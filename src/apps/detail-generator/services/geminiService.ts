import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Modality } from "@google/genai";
import { UploadedImage, LookbookImage, ModelGender, ModelAge, ModelEthnicity, ProductDetailInfo, AutoFilledProductInfo } from "../types";
import { urlToBase64 } from "./faceService";

// Use Gemini 3 Pro Image Preview (Nano Banana Pro) for image generation
const MODEL_NAME = 'gemini-3-pro-image-preview';

const getApiKey = (): string | undefined => {
    // Adapted for Vite environment
    if (import.meta.env.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
    if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
    if (typeof window !== 'undefined' && (window as any).aistudio?.getApiKey) return (window as any).aistudio.getApiKey();
    return undefined;
};

const getAI = () => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("AUTH_ERROR");
    return new GoogleGenAI({ apiKey });
};

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Helper to extract image from response (copied from Studio)
function getImageUrlFromResponse(response: any): string {
    for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error('No image found in the response.');
}

// 포즈 라이브러리
const MALE_FULL_BODY = [
    `[POSE] Mid-stride walk towards camera. [HANDS] Right hand is raised to upper chest level, Left hand in pant pocket.`,
    `[POSE] Standing still, angled 45-degrees. [HANDS] Left hand raised touching the chin/jawline.`,
    `[POSE] Leaning against a wall, one leg crossed over the other. [HANDS] Arms crossed over chest.`,
    `[POSE] Sitting on a stool, legs spread wide. [HANDS] Hands resting on knees.`,
    `[POSE] Walking away from camera, looking back over shoulder. [HANDS] Hands in pockets.`
];
const FEMALE_FULL_BODY = [
    `[POSE] Standing at a slight 3/4 angle. [HANDS] Both hands loosely clasped together in front of the thighs.`,
    `[POSE] Standing facing forward, weight shifted to one hip. [HANDS] Left hand raised, fingers running through hair.`,
    `[POSE] Walking towards camera, hair blowing in wind. [HANDS] Arms swinging naturally.`,
    `[POSE] Sitting on the floor, legs to one side. [HANDS] One hand on floor for support, other on lap.`,
    `[POSE] Leaning forward, hands on hips. [HANDS] Hands on hips, elbows out.`
];
const MALE_DETAIL_POSES = [`[FRAME] Knee-down shot.`, `[FRAME] Low-angle ground shot.`, `[FRAME] Close up of shoes from side.`];
const FEMALE_DETAIL_POSES = [`[FRAME] Dynamic side stride close-up.`, `[FRAME] Top-down view.`, `[FRAME] Close up of shoes from front.`];

// --- 얼굴 생성 로직 (핵심) ---
// --- 얼굴 생성 로직 (K-Pop Idol Style Enhanced) ---
export const generateFaceBatch = async (
    gender: 'male' | 'female',
    race: string,
    age: string,
    referenceFaces: string[] = []
): Promise<string[]> => {
    console.log('🚀 generateFaceBatch called (K-Pop Idol Style Enhanced)', { gender, race, age, refCount: referenceFaces.length });
    const ai = getAI();
    const genderTerm = gender === 'male' ? 'male' : 'female';

    // 1. 인종 매핑 – 한국인/동아시아 쪽으로 좁히기 (비주얼 최적화)
    const raceMapping: Record<string, string> = {
        "한국인": "Korean",
        "코리안": "Korean",
        "동아시아인": "East Asian",
        "아시아인": "East Asian",
        "백인": "White",
        "흑인": "Black",
        "히스패닉": "Hispanic/Latino",
        "중동인": "Middle Eastern",
        "혼혈": "Mixed race"
    };
    const englishRace = raceMapping[race] || "Korean";

    // 2. 무드: 실사 K-POP 아이돌 + 힙한 촬영 (프롬프트 강화)
    const vibeKeywords = gender === 'female'
        ? "Most beautiful K-pop girl group center member, trending Korean beauty standard, cat-eye or puppy-eye visual, flawless but realistic skin, charismatic gaze, high-end fashion magazine face"
        : "Most handsome K-pop boy group center member, sharp jawline, trending Korean male beauty standard, clear skin, intense gaze, high-end fashion magazine face";

    // 3. 헤어스타일 5종 (다양성 확보)
    const hairStylesFemale = [
        "long straight black hair with soft layers and natural shine",
        "medium length hime cut inspired style, clean but modern",
        "soft wavy hair with see-through bangs, natural volume",
        "low ponytail with loose front pieces framing the face",
        "short chic bob cut with slight C-curl at the ends"
    ];

    const hairStylesMale = [
        "clean two-block cut with natural volume, light fringe",
        "messy textured hair with soft waves, slightly parted bangs",
        "sleek down perm style with calm fringe, idol styling",
        "modern mullet with subtle layers, not too extreme",
        "grown-out natural waves, slightly tousled idol look"
    ];

    const hairStyles = gender === 'female' ? hairStylesFemale : hairStylesMale;

    // 4. 배경 5종 – 클린 스튜디오, 누끼(Crop) 친화적
    const studioBackgrounds = [
        "solid light grey Korean studio backdrop with soft gradient",
        "clean warm beige backdrop used in beauty editorials",
        "cool pale blue seamless studio background",
        "subtle pastel mint studio wall with very soft texture",
        "solid off-white background with slight falloff in light"
    ];

    // 5장 병렬 생성
    const promises = Array(5).fill(null).map(async (_, idx) => {
        try {
            const hairStyle = hairStyles[idx % hairStyles.length];
            const bg = studioBackgrounds[idx % studioBackgrounds.length];

            let prompt = `
[SUBJECT]
Extreme close-up portrait of a ${age}-year-old ${englishRace} ${genderTerm}.
Style: Top-tier K-pop Idol Visual Center.
The face must be EXTREMELY beautiful/handsome, fitting strict K-pop beauty standards.

[VIBE]
${vibeKeywords}

[SKIN & TEXTURE]
Real photography texture (8k resolution).
Visible pores and skin details, BUT keep the overall complexion clear and healthy (Idol skin care).
No heavy acne, no distortions, no plastic blur.
Natural makeup (K-beauty style).

[HAIR]
${hairStyle}
Hair must look professionally styled by a Cheongdam-dong salon.

[CROP AND FRAMING]
Framed from shoulders and neck up, focus on the face.
No visible clothing logos.
Neutral, non-sexual presentation.

[BACKGROUND]
${bg}
Simple, clean, and even lighting on the background to make the face stand out.
Easy to cut out for design use.

[STYLE]
High-end Korean idol photoshoot for an album concept photo.
Shot on a professional digital camera or high-end film camera.
Direct or semi-direct soft flash to give trendy K-pop look.
Full color only, no black and white, no monochrome.

[AVOID]
Ugly, distorted, messy skin, weird eyes, cartoonish, 3d render, plastic doll, overly smooth, blurry, low resolution.
            `;

            let parts: any[] = [{ text: prompt }];

            if (referenceFaces.length > 0) {
                const refFace = referenceFaces[idx % referenceFaces.length];
                const base64 = refFace.includes('base64,') ? refFace.split('base64,')[1] : refFace;
                parts.unshift({ inlineData: { data: base64, mimeType: 'image/jpeg' } });

                // Enhanced Reference Prompt
                prompt += `
                \n\n[CRITICAL INSTRUCTION: IDENTITY PRESERVATION]
                - **SOURCE**: Use the provided image as the **STRICT REFERENCE** for facial identity, bone structure, and features.
                - **GOAL**: The output face MUST look exactly like the person in the reference image.
                - **MODIFICATION**: Apply the "K-pop Idol" styling, makeup, and "Hyper-realistic Skin Texture" defined above to this identity.
                - **DO NOT CHANGE**: Do not change the person's identity. Only enhance the quality, skin texture, and lighting.
                `;

                parts[parts.length - 1] = { text: prompt };
            }

            console.log(`Generating face #${idx + 1}...`);
            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: { parts: parts },
                config: {
                    // @ts-ignore
                    imageConfig: { aspectRatio: '1:1', imageSize: '1K' },
                    safetySettings: SAFETY_SETTINGS
                }
            });

            return getImageUrlFromResponse(response);

        } catch (e) {
            console.error(`Face #${idx} failed:`, e);
            return null;
        }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter((img): img is string => img !== null);
    console.log(`✅ Generated ${validResults.length} faces`);
    return validResults;
};

// --- 후보 모델 생성 (얼굴 합성 포함) ---
export const generateCandidatesStream = async (
    refImages: UploadedImage[],
    gender: ModelGender,
    age: ModelAge,
    ethnicity: ModelEthnicity,
    onImageGenerated: (img: LookbookImage) => void,
    targetFaceImage?: string | null
): Promise<void> => {
    const ai = getAI();
    const genderTerm = gender === 'w' ? 'FEMALE' : 'MALE';
    const tasks = Array.from({ length: 5 }).map((_, i) => ({ seed: Math.random() * 10000000, index: i, refImage: refImages[i % refImages.length] }));

    const BATCH_SIZE = 1;
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
        const batch = tasks.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (task) => {
            const refPart = { inlineData: { data: task.refImage.base64, mimeType: task.refImage.mimeType } };
            let promptParts: any[] = [refPart];
            let systemPrompt = "";

            if (targetFaceImage) {
                let faceBase64 = targetFaceImage.includes('base64,') ? targetFaceImage.split('base64,')[1] : targetFaceImage;
                promptParts.push({ inlineData: { data: faceBase64, mimeType: 'image/png' } });

                systemPrompt = `
              [TASK: IDENTITY SWAP / FACE REPLACEMENT]
              Input 1: Target Body/Pose Reference. Input 2: Source Face Identity.
              GOAL: Replace the face in Input 1 with the identity from Input 2.
              [STRICT RULES]
              1. **IDENTITY LOCK**: The output face must look exactly like Input 2.
              2. **POSE & BODY LOCK**: The pose, body shape, outfit, and background must match Input 1 EXACTLY.
              3. **BLENDING**: seamless integration.
              4. **QUALITY**: Photorealistic, 8k.
            `;
            } else {
                systemPrompt = `
              [TASK: IDENTITY SWAP RETOUCHING]
              INPUT: A reference photo of a model. GOAL: Keep Body/Outfit 100% IDENTICAL. Replace HEAD.
              GENERATE: ${genderTerm} model, ${age} years old, ${ethnicity}. High-end fashion photography.
            `;
            }

            promptParts.push({ text: `${systemPrompt}\n\n(Generate Candidate #${task.index + 1})` });

            try {
                const response = await ai.models.generateContent({
                    model: MODEL_NAME,
                    contents: { parts: promptParts },
                    config: {
                        // @ts-ignore
                        imageConfig: { aspectRatio: '3:4' },
                        safetySettings: SAFETY_SETTINGS
                    }
                });

                const imageUrl = getImageUrlFromResponse(response);
                onImageGenerated({ url: imageUrl, type: 'candidate', promptUsed: `Ref ${task.index + 1}` });

            } catch (e) { console.error(e); }
        }));
    }
};

// --- 최종 룩북 생성 ---
export const generateFinalLookbookStream = async (
    candidateImageUrl: string,
    refImages: UploadedImage[],
    productImages: UploadedImage[],
    bgImage: UploadedImage | null,
    gender: ModelGender,
    useFilter: boolean,
    onImageGenerated: (img: LookbookImage) => void,
    excludePrompts: string[] = []
): Promise<void> => {
    const ai = getAI();
    const seed = Math.floor(Math.random() * 1000000);
    const candidateBase64 = await urlToBase64(candidateImageUrl);

    const fullBodyLibrary = gender === 'w' ? FEMALE_FULL_BODY : MALE_FULL_BODY;
    const detailLibrary = gender === 'w' ? FEMALE_DETAIL_POSES : MALE_DETAIL_POSES;
    const selectedFullBody = shuffleArray([...fullBodyLibrary]).slice(0, 3);
    const selectedDetail = shuffleArray([...detailLibrary]).slice(0, 3);

    const filterPrompt = useFilter ? `[FILTER: FILM LOOK] Analog Film Photography, Grain.` : `[FILTER: DIGITAL CLEAN] Ultra-sharp 8K.`;

    const systemPromptBase = `
    [TASK: FASHION LOOKBOOK PRODUCTION]
    Input 1: SELECTED MODEL. Input 2~5: PRODUCT SHOE IMAGES.
    RULES:
    1. **IGNORE THE POSE OF INPUT 1**: Create NEW GEOMETRY.
    2. **KEEP ATTRIBUTES ONLY**: Use Input 1 as reference for Face, Outfit, Background.
    3. **PRODUCT IDENTITY LOCK**: The generated shoe MUST be identical to input product images.
    4. **NO SPLIT SCREEN**. 9:16 portrait ratio.
    ${filterPrompt}
  `;

    const tasks = [
        { type: 'model', prompt: `[SHOT 1] FULL-BODY. POSE: ${selectedFullBody[0]}` },
        { type: 'model', prompt: `[SHOT 2] FULL-BODY. POSE: ${selectedFullBody[1]}` },
        { type: 'model', prompt: `[SHOT 3] FULL-BODY. POSE: ${selectedFullBody[2]}` },
        { type: 'detail', prompt: `[SHOT 4] DETAIL KNEE-DOWN. POSE: ${selectedDetail[0]}` },
        { type: 'detail', prompt: `[SHOT 5] DETAIL KNEE-DOWN. POSE: ${selectedDetail[1]}` },
        { type: 'detail', prompt: `[SHOT 6] DETAIL KNEE-DOWN. POSE: ${selectedDetail[2]}` }
    ];

    for (let i = 0; i < tasks.length; i += 2) { // Batch 2
        const batch = tasks.slice(i, i + 2);
        await Promise.all(batch.map(async (task) => {
            const parts: any[] = [{ inlineData: { data: candidateBase64, mimeType: 'image/png' } }];
            productImages.slice(0, 4).forEach(img => parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
            if (bgImage) parts.push({ inlineData: { data: bgImage.base64, mimeType: bgImage.mimeType } });

            try {
                const response = await ai.models.generateContent({
                    model: MODEL_NAME,
                    contents: { parts: [...parts, { text: `${systemPromptBase}\n\n${task.prompt}` }] },
                    config: {
                        // @ts-ignore
                        imageConfig: { aspectRatio: '9:16' },
                        seed: seed,
                        safetySettings: SAFETY_SETTINGS
                    }
                });

                const imageUrl = getImageUrlFromResponse(response);
                onImageGenerated({ url: imageUrl, type: task.type as any, promptUsed: task.prompt });

            } catch (e) { console.error(e); }
        }));
    }
};

export const upscaleFace = async (base64Image: string): Promise<string> => {
    console.log('🚀 upscaleFace called');
    const ai = getAI();
    const base64 = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
    const prompt = `Upscale this face image. High resolution, highly detailed, sharp focus, improve skin texture and lighting. Keep identity exactly the same.`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                    { inlineData: { data: base64, mimeType: 'image/png' } },
                    { text: prompt }
                ]
            },
            config: {
                // @ts-ignore
                imageConfig: { aspectRatio: '1:1' },
                safetySettings: SAFETY_SETTINGS
            }
        });

        return getImageUrlFromResponse(response);
    } catch (e) {
        console.error('Upscale failed:', e);
        throw e;
    }
};

/**
 * 단일 이미지의 얼굴 교체
 */
export const replaceFaceInImage = async (
    targetImageBase64: string,
    sourceFaceBase64: string
): Promise<string> => {
    console.log('🔄 replaceFaceInImage called');
    const ai = getAI();

    const targetB64 = targetImageBase64.includes('base64,') ? targetImageBase64.split('base64,')[1] : targetImageBase64;
    const faceB64 = sourceFaceBase64.includes('base64,') ? sourceFaceBase64.split('base64,')[1] : sourceFaceBase64;

    const prompt = `
[TASK: FACE SWAP / IDENTITY REPLACEMENT]

[INPUTS]
- Image 1: Target photo (keep body, pose, clothing, background)
- Image 2: Source face (the new identity to apply)

[CRITICAL RULES]
1. **IDENTITY LOCK**: The output face MUST look EXACTLY like Image 2 (the source face).
2. **BODY/POSE LOCK**: Keep the body pose, clothing, and background from Image 1 EXACTLY as they are.
3. **SEAMLESS BLENDING**: The face must naturally fit onto the target body with proper lighting, skin tone matching, and shadow consistency.
4. **HIGH QUALITY**: Output in high resolution, photorealistic quality.
5. **PRESERVE EVERYTHING ELSE**: Hair style can adapt to match the source face, but clothing and body must remain unchanged.

[OUTPUT]
A seamlessly composited photo where Image 1's face is replaced with Image 2's identity, while everything else remains the same.
`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                    { inlineData: { data: targetB64, mimeType: 'image/png' } },
                    { inlineData: { data: faceB64, mimeType: 'image/png' } },
                    { text: prompt }
                ]
            },
            config: {
                // @ts-ignore
                imageConfig: { aspectRatio: '1:1', imageSize: '1K' },
                safetySettings: SAFETY_SETTINGS
            }
        });

        return getImageUrlFromResponse(response);
    } catch (e) {
        console.error('Face replacement failed:', e);
        throw e;
    }
};

/**
 * 프리뷰의 모든 이미지에서 일괄 얼굴 교체
 */
export const batchFaceReplacement = async (
    targetImageUrls: string[],
    sourceFaceBase64: string,
    onProgress?: (current: number, total: number) => void
): Promise<Array<{ original: string; result: string | null; error?: string }>> => {
    console.log(`🎭 batchFaceReplacement: Processing ${targetImageUrls.length} images`);

    const results: Array<{ original: string; result: string | null; error?: string }> = [];

    for (let i = 0; i < targetImageUrls.length; i++) {
        const targetUrl = targetImageUrls[i];
        onProgress?.(i + 1, targetImageUrls.length);

        try {
            // Convert URL to base64 if needed
            let targetBase64 = targetUrl;
            if (!targetUrl.includes('base64,')) {
                const response = await fetch(targetUrl);
                const blob = await response.blob();
                targetBase64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            }

            const result = await replaceFaceInImage(targetBase64, sourceFaceBase64);
            results.push({ original: targetUrl, result });
            console.log(`✅ Face replaced in image ${i + 1}/${targetImageUrls.length}`);
        } catch (e: any) {
            console.error(`❌ Failed to replace face in image ${i + 1}:`, e);
            results.push({ original: targetUrl, result: null, error: e.message });
        }
    }

    return results;
};

// Export genAI instance for analyzeModel.ts
export const genAI = new GoogleGenAI({ apiKey: getApiKey() || '' });

